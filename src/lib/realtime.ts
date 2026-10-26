'use client'

import { useEffect, useId, useRef } from 'react'
import { useRouter } from 'next/navigation'

import { crearClienteNavegador } from '@/lib/supabase/navegador'

/** Filtro de Realtime por columna, p. ej. `estacion_id=eq.<uuid>`. */
export type Suscripcion = { tabla: string; filtro?: string }

/**
 * Ventana para juntar eventos que llegan en ráfaga.
 *
 * Un pedido nuevo no genera UN evento: entra la fila, se le actualizan los totales
 * y le nacen sus comandas, todo en la misma transacción y en unos pocos milisegundos.
 * Sin esta ventana cada uno de esos eventos disparaba su propio `router.refresh()`,
 * o sea tres o cuatro recargas completas de la pantalla para mostrar UN pedido.
 * Con la ventana, la ráfaga se convierte en una sola recarga.
 *
 * 300 ms es más que suficiente para juntar una transacción y sigue siendo
 * imperceptible para quien está mirando la pantalla.
 */
const VENTANA_RAFAGA_MS = 300

/**
 * Piso entre recargas. En hora pico entran varios pedidos casi al tiempo y cada uno
 * avanza de estado mientras los otros llegan; sin este piso, una pantalla podría
 * pasarse el servicio recargando sin parar. Nunca se pierde nada: los eventos que
 * lleguen durante la espera reprograman la recarga, que sale al cumplirse el piso.
 */
const MINIMO_ENTRE_RECARGAS_MS = 1000

/**
 * Escucha cambios en la base y refresca cuando algo se mueve.
 *
 * No mantiene estado propio: al recibir un cambio pide `router.refresh()`, así la
 * verdad sigue viniendo de la consulta con RLS y no de un estado del navegador
 * que se puede desincronizar.
 *
 * No hace polling. Cubre las dos formas reales de perderse un evento:
 *
 *  · **La conexión se cae.** En un restaurante el wifi se corta y los celulares
 *    entran y salen de la red. Al reconectar el canal, se refresca una vez para
 *    recuperar lo que pasó mientras estuvo afuera.
 *  · **La pantalla estuvo en segundo plano.** El navegador congela los sockets
 *    de las pestañas ocultas; al volver a mirarla se refresca.
 *
 * `filtro` acota la suscripción en el SERVIDOR (una estación, un canal, un
 * domiciliario). Es lo que evita que la pantalla del mesero se despierte con cada
 * domicilio, o la del domiciliario con cada pedido de mesa: con 10-15 pantallas
 * abiertas sobre los mismos datos, filtrar es la diferencia entre una app ágil y
 * una que se arrastra en hora pico.
 */
export function useRefrescarEnCambios(
  suscripciones: (string | Suscripcion)[],
  opciones?: {
    onEstado?: (enLinea: boolean) => void
    /**
     * Red de seguridad: refresco periódico ADEMÁS de los eventos.
     *
     * No sobra. Está comprobado que Realtime entrega los cambios de `comandas`
     * (la cocina se refresca sola) pero NO los de `pedidos`: con la caja abierta,
     * cambiar el estado de un pedido en la base no la mueve. Sin este intervalo,
     * caja, pase, mesero y domicilios solo se enteran al navegar — que es
     * justamente lo que pasa hoy en producción.
     *
     * Mientras no se resuelva por qué `pedidos` no llega, las pantallas de
     * operación deben llevarlo. Es lo que tiene Distrito Novo, y por eso allá el
     * "en vivo" sí funciona.
     */
    intervaloMs?: number
  },
) {
  const router = useRouter()
  const onEstado = useRef(opciones?.onEstado)
  // Se sincroniza en un efecto, no durante el render. React puede empezar un render y
  // botarlo (StrictMode, render concurrente abandonado); escribir el ref ahí dejaría
  // apuntando a un callback de una versión de la pantalla que nunca se montó, y el aviso
  // de "en línea" de la cocina terminaría en un componente muerto. El valor inicial ya
  // viene del `useRef`, así que la primera suscripción avisa bien desde el arranque.
  useEffect(() => {
    onEstado.current = opciones?.onEstado
  })
  const intervaloMs = opciones?.intervaloMs

  // Identidad propia de ESTA instancia del hook. El nombre del canal la incluye
  // para que dos componentes montados a la vez sobre las mismas tablas no compartan
  // canal ni se pisen al desmontarse (un remontaje cerraba el canal del otro).
  const idInstancia = useId()

  // Se serializa para no re-suscribir en cada render por identidad del array.
  const clave = JSON.stringify(suscripciones)

  useEffect(() => {
    // Se normaliza a objeto SIEMPRE. El hook acepta texto por comodidad
    // (`['pedidos']`), pero leer `.tabla` de un texto da `undefined`, y una
    // suscripción sin tabla escucha el ESQUEMA ENTERO: la pantalla se despertaba
    // con cada cambio de cualquier tabla —items, pagos, movimientos de caja— en vez
    // de la que nombró. Era el mayor costo de Realtime de toda la app.
    const crudo: (string | Suscripcion)[] = JSON.parse(clave)
    const lista: Suscripcion[] = crudo.map((s) => (typeof s === 'string' ? { tabla: s } : s))

    const supabase = crearClienteNavegador()
    const canal = supabase.channel(`cambios${idInstancia}-${lista.map((s) => s.tabla).join('-')}`)

    // ── Recarga con ventana de ráfaga y piso de frecuencia ──────────────────
    let temporizador: number | undefined
    let ultima = 0
    let vivo = true

    const ejecutar = () => {
      if (!vivo) return
      ultima = Date.now()
      router.refresh()
    }

    const pedirRecarga = () => {
      if (!vivo) return
      // Reprogramar el temporizador YA es juntar la ráfaga: el evento anterior que
      // seguía esperando se descarta y solo queda esta recarga.
      window.clearTimeout(temporizador)
      // Se espera lo que falte para cumplir el piso, o la ventana de ráfaga si el
      // piso ya se cumplió. Así una ráfaga se junta y una lluvia sostenida se acota.
      const desdeUltima = Date.now() - ultima
      const espera = Math.max(VENTANA_RAFAGA_MS, MINIMO_ENTRE_RECARGAS_MS - desdeUltima)
      temporizador = window.setTimeout(ejecutar, espera)
    }

    for (const s of lista) {
      canal.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: s.tabla, ...(s.filtro ? { filter: s.filtro } : {}) },
        pedirRecarga,
      )
    }

    // Primera suscripción vs. reconexión: solo en la reconexión hay que
    // recuperar lo perdido; en la primera los datos ya vienen del servidor.
    let suscritoAlgunaVez = false

    // El token del usuario se pone en el socket ANTES de suscribirse, a propósito.
    //
    // Las tablas que escuchamos están protegidas por RLS, y Realtime decide qué mandar
    // evaluando esas políticas con el token del socket. Si la suscripción sale antes de
    // que el token llegue —la sesión vive en cookies y se lee sin bloquear—, el socket
    // queda como anónimo, y para un anónimo las políticas de `pedidos` y `comandas` no
    // devuelven NADA. Lo peligroso es cómo se ve: el canal responde SUBSCRIBED, el
    // indicador se pinta "en línea", y la pantalla simplemente no se entera nunca de
    // nada. Es el modo de falla que reportó la cocina —«hay que estar actualizando»—.
    supabase.realtime
      .setAuth()
      .catch((e) => console.error('[realtime] no se pudo autenticar el socket', e))
      .then(() => {
        // Puede haberse desmontado mientras se resolvía.
        if (!vivo) return
        canal.subscribe((estado) => {
          const enLinea = estado === 'SUBSCRIBED'
          onEstado.current?.(enLinea)
          if (enLinea) {
            if (suscritoAlgunaVez) pedirRecarga()
            suscritoAlgunaVez = true
          }
        })
      })

    const alVolver = () => {
      // Al volver del segundo plano se refresca de una, sin esperar la ventana:
      // aquí el usuario está mirando y quiere ver la pantalla al día ya.
      if (document.visibilityState === 'visible') ejecutar()
    }
    document.addEventListener('visibilitychange', alVolver)

    // Red de seguridad. No corre en segundo plano: una pantalla que nadie mira no
    // gasta consultas, y al volver a ella el `visibilitychange` la pone al día.
    const idIntervalo = intervaloMs
      ? window.setInterval(() => {
          if (document.visibilityState === 'visible') pedirRecarga()
        }, intervaloMs)
      : undefined

    return () => {
      vivo = false
      window.clearTimeout(temporizador)
      if (idIntervalo) window.clearInterval(idIntervalo)
      // Si quedó una recarga sin ejecutar no se fuerza: la pantalla se desmontó y
      // la siguiente que se monte pedirá los datos frescos de todos modos.
      document.removeEventListener('visibilitychange', alVolver)
      supabase.removeChannel(canal)
    }
  }, [clave, router, idInstancia, intervaloMs])
}

/**
 * Refresca cada cierto tiempo, sin suscripción.
 *
 * Para pantallas de CONSULTA (el tablero del admin, los reportes): un resumen del
 * día no necesita enterarse al segundo, y mantenerlo suscrito sale caro. El tablero
 * cuesta 8 consultas por recarga; atado a Realtime las pagaba con cada movimiento
 * de cualquier pedido —decenas de veces por minuto en hora pico— para mostrar
 * números que nadie mira tan seguido. A intervalo cuesta 8 consultas cada minuto,
 * pase lo que pase abajo.
 *
 * No corre en segundo plano: una pestaña oculta no gasta consultas, y al volver a
 * ella se refresca de una para que nunca se vean datos viejos.
 */
export function useRefrescarCada(intervaloMs: number) {
  const router = useRouter()

  useEffect(() => {
    const tocaRefrescar = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }
    const id = window.setInterval(tocaRefrescar, intervaloMs)
    document.addEventListener('visibilitychange', tocaRefrescar)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tocaRefrescar)
    }
  }, [intervaloMs, router])
}

/**
 * Refresca UNA vez, en el momento exacto en que entra la siguiente comanda.
 *
 * Es el reemplazo del "refrescar cada 15 segundos" de la cocina. Una comanda con
 * `disparo_en` futuro no genera ningún evento de base de datos al llegar su hora
 * —simplemente empieza a ser visible—, así que Realtime no puede avisar. Pero
 * sabiendo la hora, basta un temporizador: cero consultas de relleno y la
 * comanda entra puntual en vez de hasta 15 segundos tarde.
 */
export function useRefrescarAl(momentoISO: string | null, desfaseMs = 0) {
  const router = useRouter()

  useEffect(() => {
    if (!momentoISO) return
    const faltan = new Date(momentoISO).getTime() - (Date.now() + desfaseMs)
    // Un segundo de gracia: que el servidor ya la considere disparada al pedirla.
    const id = window.setTimeout(() => router.refresh(), Math.max(500, faltan + 1000))
    return () => window.clearTimeout(id)
  }, [momentoISO, desfaseMs, router])
}
