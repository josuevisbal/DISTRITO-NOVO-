'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

import {
  IconoAlerta,
  IconoCheck,
  IconoFuego,
  IconoLuna,
  IconoNota,
  IconoSol,
} from '@/components/iconos'
import { obtenerTema, obtenerTemaOperacion, variablesTema } from '@/config/tema'
import { calcularCronometro, formatearRestante, type Semaforo } from '@/lib/cronometro'
import { crearClienteNavegador } from '@/lib/supabase/navegador'
import { cambiarDisponibilidad, cambiarEstadoComanda } from '../../acciones'

export type ItemComanda = {
  producto_id: string
  nombre: string
  cantidad: number
  notas: string | null
}

export type Ticket = {
  comanda_id: string
  numero: number
  mesa: number | null
  canal: string
  estado: 'pendiente' | 'preparando' | 'listo' | 'cancelada'
  disparo_en: string
  objetivo_en: string
  minutos: number
  items: ItemComanda[]
}

type Props = {
  tickets: Ticket[]
  nombreEstacion: string
  color: string
  /** Hora del servidor al armar la página, para corregir el desfase del reloj local. */
  servidorAhoraISO: string
  /** Barra de sesión (server component) que se pinta dentro del tema elegido. */
  barraStaff: ReactNode
}

const NOMBRE_CANAL: Record<string, string> = {
  mesa: 'Mesa',
  domicilio: 'Domicilio',
  recoger: 'Recoger',
  mostrador: 'Mostrador',
  whatsapp: 'WhatsApp',
}

/**
 * Semáforo del KDS: color en el borde superior del ticket y en el chip del tiempo,
 * siempre acompañado de texto. Paleta por tema (claro/oscuro), fija del sistema.
 */
const SEMAFORO: Record<
  'claro' | 'oscuro',
  Record<Semaforo, { acento: string; chipFondo: string; chipTexto: string }>
> = {
  claro: {
    verde: { acento: '#1E9E6A', chipFondo: '#E7F6EE', chipTexto: '#116B47' },
    amarillo: { acento: '#D99A06', chipFondo: '#FBF1D4', chipTexto: '#7A5A0F' },
    rojo: { acento: '#D64533', chipFondo: '#FBE6DE', chipTexto: '#9A3320' },
  },
  oscuro: {
    verde: { acento: '#2E9E8F', chipFondo: '#0f2e22', chipTexto: '#7ee3cf' },
    amarillo: { acento: '#E0B02B', chipFondo: '#3a2f05', chipTexto: '#f4d873' },
    rojo: { acento: '#E0552B', chipFondo: '#3a1010', chipTexto: '#f6a58c' },
  },
}

/** Preferencia de tema del cocinero. Es preferencia de interfaz, no dato del negocio. */
const LLAVE_TEMA = 'kds-tema'

export function TableroCocina({
  tickets,
  nombreEstacion,
  color,
  servidorAhoraISO,
  barraStaff,
}: Props) {
  const router = useRouter()

  // Claro por defecto; el cocinero puede preferir oscuro (grasa, reflejo de parrilla).
  const [oscuro, setOscuro] = useState(false)
  useEffect(() => {
    setOscuro(localStorage.getItem(LLAVE_TEMA) === 'oscuro')
  }, [])
  function alternarTema() {
    const v = !oscuro
    setOscuro(v)
    localStorage.setItem(LLAVE_TEMA, v ? 'oscuro' : 'claro')
  }

  // Desfase entre el reloj del servidor y el del navegador, medido al montar: los
  // cronómetros y el reloj de la barra usan la hora corregida, nunca la local a secas.
  const desfaseRef = useRef(0)
  useEffect(() => {
    desfaseRef.current = new Date(servidorAhoraISO).getTime() - Date.now()
  }, [servidorAhoraISO])

  const [tic, setTic] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTic((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  void tic

  const [enLinea, setEnLinea] = useState(true)

  // Realtime + reintento periódico: una comanda con disparo futuro aparece sola cuando su
  // hora pasa, sin cron. Si la conexión se cae, se avisa y se sigue reintentando.
  useEffect(() => {
    const supabase = crearClienteNavegador()
    const canal = supabase
      .channel('cocina-comandas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas' }, () =>
        router.refresh(),
      )
      .subscribe((estado) => {
        setEnLinea(estado === 'SUBSCRIBED')
      })

    const id = setInterval(() => router.refresh(), 15000)
    return () => {
      supabase.removeChannel(canal)
      clearInterval(id)
    }
  }, [router])

  // Respuesta óptimista: el estado local pisa al del servidor apenas el cocinero toca,
  // y el servidor confirma detrás. Si la acción falla, se revierte y se reintenta a mano.
  const [sombras, setSombras] = useState<Record<string, 'preparando' | 'listo'>>({})

  async function marcar(comandaId: string, estado: 'preparando' | 'listo') {
    navigator.vibrate?.(15)
    setSombras((s) => ({ ...s, [comandaId]: estado }))
    const r = await cambiarEstadoComanda(comandaId, estado)
    if (!r.ok) {
      setSombras((s) => {
        const { [comandaId]: _, ...resto } = s
        void _
        return resto
      })
    } else {
      router.refresh()
    }
  }

  const ahora = Date.now() + desfaseRef.current
  const paleta = SEMAFORO[oscuro ? 'oscuro' : 'claro']
  const reloj = new Date(ahora).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  // Un ticket marcado listo sale de la pantalla al instante.
  const visibles = tickets
    .map((t) => ({
      ...t,
      estado: (sombras[t.comanda_id] as Ticket['estado'] | undefined) ?? t.estado,
    }))
    .filter((t) => t.estado === 'pendiente' || t.estado === 'preparando')

  return (
    <div
      style={variablesTema(oscuro ? obtenerTemaOperacion() : obtenerTema(''))}
      className="min-h-screen bg-marca-fondo text-marca-texto"
    >
      {barraStaff}

      {/* Barra de la estación: identidad, cola y reloj. */}
      <header className="sticky top-0 z-20 border-b border-marca-borde bg-marca-superficie">
        <div className="flex items-center gap-3 px-4 py-3">
          <span
            aria-hidden
            className="flex size-11 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: color }}
          >
            <IconoFuego className="size-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-tight">{nombreEstacion}</h1>
            <p className="text-xs text-marca-texto-suave">Estación de cocina</p>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <p className="text-right">
              <span className="block text-[10px] uppercase tracking-wider text-marca-texto-suave">
                En cola
              </span>
              <span className="block text-xl font-bold leading-none" style={{ color }}>
                {visibles.length}
              </span>
            </p>
            <p className="text-2xl font-bold tabular-nums">{reloj}</p>
            <button
              type="button"
              onClick={alternarTema}
              aria-label={oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              className="flex size-12 items-center justify-center rounded-xl border border-marca-borde text-marca-texto"
            >
              {oscuro ? <IconoSol className="size-5" /> : <IconoLuna className="size-5" />}
            </button>
          </div>
        </div>
      </header>

      {!enLinea ? (
        <p className="flex items-center justify-center gap-2 bg-marca-superficie-tenue px-4 py-2 text-sm">
          <IconoAlerta className="size-5 shrink-0 text-marca-acento-fuerte" />
          Sin conexión. Reintentando… se muestra el último estado conocido.
        </p>
      ) : null}

      {visibles.length === 0 ? (
        <p className="mx-auto mt-24 max-w-sm px-6 text-center text-lg text-marca-texto-suave">
          Nada en preparación por ahora.
        </p>
      ) : (
        <ul className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibles.map((ticket, i) => (
            <TicketKds
              key={ticket.comanda_id}
              ticket={ticket}
              colorEstacion={color}
              paleta={paleta}
              ahora={ahora}
              indice={i}
              onMarcar={marcar}
            />
          ))}
        </ul>
      )}

      <p className="px-4 pb-6 pt-2 text-center text-xs text-marca-texto-suave">
        El tiempo cuenta desde que la comanda entra a la estación ·{' '}
        <span style={{ color: paleta.verde.acento }}>verde en tiempo</span> ·{' '}
        <span style={{ color: paleta.amarillo.acento }}>ámbar cerca del objetivo</span> ·{' '}
        <span style={{ color: paleta.rojo.acento }}>rojo pasado</span>
      </p>
    </div>
  )
}

function TicketKds({
  ticket,
  colorEstacion,
  paleta,
  ahora,
  indice,
  onMarcar,
}: {
  ticket: Ticket
  colorEstacion: string
  paleta: Record<Semaforo, { acento: string; chipFondo: string; chipTexto: string }>
  ahora: number
  indice: number
  onMarcar: (comandaId: string, estado: 'preparando' | 'listo') => void
}) {
  const [ocupado, setOcupado] = useState(false)

  const disparo = new Date(ticket.disparo_en).getTime()
  const objetivo = new Date(ticket.objetivo_en).getTime()
  const crono = calcularCronometro(disparo, objetivo, ahora)
  const c = paleta[crono.semaforo]

  // Avance hacia el objetivo, para la barra del estado "preparando".
  const avance = Math.min(1, Math.max(0, (ahora - disparo) / Math.max(1, objetivo - disparo)))
  const quedanMin = Math.max(0, Math.ceil((objetivo - ahora) / 60000))

  async function agotar(productoId: string) {
    setOcupado(true)
    await cambiarDisponibilidad(productoId, false)
    setOcupado(false)
  }

  return (
    <li
      className="entra flex flex-col overflow-hidden rounded-2xl bg-marca-superficie shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
      style={{ '--i': indice, borderTop: `4px solid ${c.acento}` } as CSSProperties}
    >
      <div className="flex items-center gap-2 px-4 pt-3">
        <p className="text-2xl font-bold tabular-nums">#{ticket.numero}</p>
        <span className="rounded-full bg-marca-superficie-tenue px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-marca-texto-suave">
          {ticket.mesa ? `Mesa ${ticket.mesa}` : (NOMBRE_CANAL[ticket.canal] ?? ticket.canal)}
        </span>

        {/* Chip del tiempo: color + punto + cuenta. Nunca solo color. */}
        <span
          className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums"
          style={{ backgroundColor: c.chipFondo, color: c.chipTexto }}
        >
          <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: c.acento }} />
          {formatearRestante(crono.restanteSeg)}
        </span>
      </div>

      <ul className="flex-1 space-y-2.5 px-4 py-3">
        {ticket.items.map((item) => (
          <li key={item.producto_id}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-lg font-semibold leading-snug">
                <span className="mr-1.5 text-2xl font-bold" style={{ color: colorEstacion }}>
                  {item.cantidad}
                </span>
                {item.nombre}
              </p>
              <button
                type="button"
                onClick={() => agotar(item.producto_id)}
                disabled={ocupado}
                className="min-h-11 shrink-0 rounded-lg border border-marca-borde px-2.5 text-xs text-marca-texto-suave disabled:opacity-50"
              >
                Agotar
              </button>
            </div>
            {item.notas ? (
              <p
                className="mt-1.5 flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium"
                style={{
                  backgroundColor: paleta.amarillo.chipFondo,
                  color: paleta.amarillo.chipTexto,
                }}
              >
                <IconoNota className="mt-0.5 size-4 shrink-0" />
                {item.notas}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {ticket.estado === 'preparando' ? (
        <div className="px-4 pb-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-marca-superficie-tenue">
            <div
              className="h-full rounded-full transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
              style={{ width: `${avance * 100}%`, backgroundColor: c.acento }}
            />
          </div>
          <p className="mt-1 text-xs text-marca-texto-suave">
            Objetivo {ticket.minutos} min ·{' '}
            {crono.semaforo === 'rojo' ? crono.etiqueta : `quedan ${quedanMin}`}
          </p>
        </div>
      ) : null}

      <div className="p-3">
        {ticket.estado === 'pendiente' ? (
          <button
            type="button"
            onClick={() => onMarcar(ticket.comanda_id, 'preparando')}
            className="min-h-14 w-full rounded-xl bg-marca-acento text-lg font-bold text-marca-acento-texto"
          >
            Empezar a preparar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onMarcar(ticket.comanda_id, 'listo')}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl text-lg font-bold text-white"
            style={{ backgroundColor: paleta.verde.acento }}
          >
            <IconoCheck className="size-6 shrink-0" />
            Marcar listo
          </button>
        )}
      </div>
    </li>
  )
}
