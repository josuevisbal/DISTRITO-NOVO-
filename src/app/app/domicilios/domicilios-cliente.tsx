'use client'

import { useState, type CSSProperties } from 'react'

import { IconoAlerta, IconoCheck, IconoMoto } from '@/components/iconos'
import { Vacio } from '@/components/ui/vacio'
import { formatearPesos } from '@/lib/formato'
import { useRefrescarEnCambios } from '@/lib/realtime'
import { enlaceLlamar, enlaceWhatsApp } from '@/lib/telefono'
import { entregarPedido, falloEntrega, pagaPorTransferencia, recogerPedido } from './acciones'

export type Entrega = {
  pedido_id: string
  numero: number
  estado: 'en_despacho' | 'en_camino'
  cliente: string | null
  telefono: string | null
  direccion: string | null
  indicaciones: string | null
  zona: string | null
  total: number
  pagado: boolean
  /** El cliente cambió de opinión: paga por transferencia y la cobra caja. */
  vaTransferir: boolean
  nota_entrega: string | null
  items: { nombre: string; cantidad: number }[]
  /** Quién la lleva. Solo se usa en el monitoreo del admin; el domiciliario es él mismo. */
  domiciliario?: string | null
}

export function DomiciliosCliente({
  entregas,
  soloLectura = false,
}: {
  entregas: Entrega[]
  /** Monitoreo del admin: espejo sin controles. Observa, no opera. */
  soloLectura?: boolean
}) {
  useRefrescarEnCambios(['pedidos'], { intervaloMs: 20000 })
  const [busqueda, setBusqueda] = useState('')

  if (entregas.length === 0) {
    return (
      <p className="mx-auto mt-24 max-w-sm px-6 text-center text-lg text-marca-texto-suave">
        {soloLectura ? 'No hay entregas en curso por ahora.' : 'No tienes entregas asignadas por ahora.'}
      </p>
    )
  }

  const encontradas = filtrarEntregas(entregas, busqueda)

  return (
    <div className="mx-auto max-w-xl p-4">
      {/* Con varias entregas encima, encontrar "la de Ana" o "la del Prado" a mano es
          perder tiempo parado en la moto. Busca por cliente, dirección, barrio o número. */}
      {entregas.length > 1 ? (
        <div className="mb-4">
          <label className="sr-only" htmlFor="buscar-entrega">
            Buscar entrega
          </label>
          <input
            id="buscar-entrega"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Cliente, dirección, barrio o #"
            className="min-h-12 w-full rounded-xl border border-marca-borde bg-marca-superficie px-4 text-base text-marca-texto placeholder:text-marca-texto-suave/70"
          />
          {busqueda.trim() !== '' ? (
            <p className="mt-1.5 text-sm tabular-nums text-marca-texto-suave">
              {encontradas.length} de {entregas.length}
            </p>
          ) : null}
        </div>
      ) : null}

      {encontradas.length === 0 ? (
        <Vacio texto={`Ninguna entrega coincide con "${busqueda.trim()}".`} Icono={IconoMoto} />
      ) : (
        <ul className="space-y-4">
          {encontradas.map((e, i) => (
            <TarjetaEntrega key={e.pedido_id} entrega={e} indice={i} soloLectura={soloLectura} />
          ))}
        </ul>
      )}
    </div>
  )
}

/** Sin tildes y en minúsculas: "Bolívar" se encuentra escribiendo "bolivar". */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Busca en todo lo que el domiciliario sabe de la entrega: a quién se la lleva, adónde,
 * el barrio, las indicaciones y el número del pedido. Sin texto, devuelve todo.
 */
function filtrarEntregas(entregas: Entrega[], busqueda: string): Entrega[] {
  const aguja = normalizar(busqueda.trim())
  if (aguja === '') return entregas
  return entregas.filter((e) =>
    normalizar(
      [e.cliente, e.direccion, e.zona, e.indicaciones, e.telefono, `#${e.numero}`, String(e.numero)]
        .filter(Boolean)
        .join(' '),
    ).includes(aguja),
  )
}

function TarjetaEntrega({
  entrega,
  indice,
  soloLectura,
}: {
  entrega: Entrega
  indice: number
  soloLectura: boolean
}) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Óptimista: el estado cambia o la tarjeta sale apenas el domiciliario toca.
  const [estadoLocal, setEstadoLocal] = useState<Entrega['estado'] | null>(null)
  const [oculta, setOculta] = useState(false)

  const estado = estadoLocal ?? entrega.estado

  async function correr(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setOcupado(true)
    setError(null)
    const r = await fn()
    if (!r.ok) {
      setEstadoLocal(null)
      setOculta(false)
      setError(r.error ?? 'No se pudo')
    }
    setOcupado(false)
  }

  function recoger() {
    navigator.vibrate?.(15)
    setEstadoLocal('en_camino')
    void correr(() => recogerPedido(entrega.pedido_id))
  }

  function entregar() {
    navigator.vibrate?.(15)
    setOculta(true)
    void correr(() => entregarPedido(entrega.pedido_id))
  }

  if (oculta) return null

  return (
    <li
      className="entra rounded-2xl border border-marca-borde bg-marca-superficie p-4 shadow-sm"
      style={{ '--i': indice } as CSSProperties}
    >
      <div className="flex items-center justify-between">
        <p className="font-titulo text-xl text-marca-texto">Pedido #{entrega.numero}</p>
        <span className="flex items-center gap-1.5 rounded-full border border-marca-borde px-2.5 py-1 text-xs text-marca-texto-suave">
          <IconoMoto className="size-3.5" />
          {estado === 'en_despacho' ? 'Por recoger' : 'En camino'}
        </span>
      </div>

      {/* En monitoreo se muestra quién la lleva; el domiciliario en operación es él mismo. */}
      {soloLectura ? (
        <p className="mt-1 text-sm text-marca-texto-suave">
          Lleva: <span className="font-medium text-marca-texto">{entrega.domiciliario ?? 'Sin asignar'}</span>
        </p>
      ) : null}

      {/* A quién y adónde: lo primero que necesita al llegar. */}
      {entrega.cliente ? (
        <p className="mt-3 text-lg font-medium text-marca-texto">{entrega.cliente}</p>
      ) : null}

      {/* Dirección grande: se lee de pie, con las manos ocupadas. */}
      <p className={`text-2xl font-semibold leading-tight text-marca-texto ${entrega.cliente ? '' : 'mt-3'}`}>
        {entrega.direccion ?? 'Sin dirección'}
      </p>
      {entrega.zona ? <p className="text-marca-texto-suave">{entrega.zona}</p> : null}
      {entrega.indicaciones ? (
        <p className="mt-1 text-marca-texto-suave">{entrega.indicaciones}</p>
      ) : null}

      {/* Recuadro de cobro: amarillo con el monto si es efectivo, verde si ya está pago. */}
      <CobroCaja
        pagado={entrega.pagado}
        vaTransferir={entrega.vaTransferir}
        total={entrega.total}
      />

      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-marca-texto-suave">
          Qué lleva ({entrega.items.reduce((s, i) => s + i.cantidad, 0)})
        </summary>
        <ul className="mt-2 space-y-1 text-sm text-marca-texto">
          {entrega.items.map((i, n) => (
            <li key={n}>
              {i.cantidad} × {i.nombre}
            </li>
          ))}
        </ul>
      </details>

      {entrega.telefono && !soloLectura ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href={enlaceLlamar(entrega.telefono)}
            className="flex min-h-12 items-center justify-center rounded-lg border border-marca-borde font-medium text-marca-texto"
          >
            Llamar
          </a>
          <a
            href={enlaceWhatsApp(entrega.telefono)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center justify-center rounded-lg border border-marca-borde font-medium text-marca-texto"
          >
            WhatsApp
          </a>
        </div>
      ) : null}

      {entrega.nota_entrega ? (
        <p className="mt-3 flex gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-5 shrink-0" />
          Intento anterior: {entrega.nota_entrega}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 flex gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-5 shrink-0" />
          {error}
        </p>
      ) : null}

      {soloLectura ? null : (
      <div className="mt-4 flex flex-col gap-2">
        {estado === 'en_despacho' ? (
          <button
            type="button"
            onClick={recoger}
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-marca-acento text-lg font-bold text-marca-acento-texto"
          >
            <IconoMoto className="size-5" />
            Recogí, voy en camino
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={entregar}
              className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-marca-acento text-lg font-bold text-marca-acento-texto"
            >
              <IconoCheck className="size-6" />
              Entregué
            </button>
            {/* En la puerta el cliente dice que mejor transfiere. Un toque y caja
                queda avisada: el domiciliario no carga con esa plata. */}
            {!entrega.pagado && !entrega.vaTransferir ? (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => correr(() => pagaPorTransferencia(entrega.pedido_id))}
                className="flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-marca-borde text-base font-semibold text-marca-texto disabled:opacity-50"
              >
                El cliente va a pagar por transferencia
              </button>
            ) : null}
            <FalloEntrega
              disabled={ocupado}
              onConfirmar={(motivo) => correr(() => falloEntrega(entrega.pedido_id, motivo))}
            />
          </>
        )}
      </div>
      )}
    </li>
  )
}

function CobroCaja({
  pagado,
  vaTransferir,
  total,
}: {
  pagado: boolean
  vaTransferir: boolean
  total: number
}) {
  if (vaTransferir) {
    // Azul: el cliente transfiere y caja lo verifica. El domiciliario no recibe nada.
    return (
      <p
        className="mt-4 flex items-center justify-center gap-2 rounded-xl border-2 p-4 text-center text-lg font-bold"
        style={{ backgroundColor: '#101b33', borderColor: '#5B6BF0', color: '#aeb8ff' }}
      >
        <IconoCheck className="size-6 shrink-0" />
        Paga por transferencia · No recibas efectivo
      </p>
    )
  }
  if (pagado) {
    // Verde: ya está pago, no cobrar. (Paleta oscura: se lee de lejos, en la calle.)
    return (
      <p
        className="mt-4 flex items-center justify-center gap-2 rounded-xl border-2 p-4 text-lg font-bold"
        style={{ backgroundColor: '#0f2e22', borderColor: '#2E9E8F', color: '#7ee3cf' }}
      >
        <IconoCheck className="size-6 shrink-0" />
        Ya está pago · No cobrar
      </p>
    )
  }

  // Amarillo: cobrar este monto en efectivo.
  return (
    <div
      className="mt-4 rounded-xl border-2 p-4 text-center"
      style={{ backgroundColor: '#3a2f05', borderColor: '#E0B02B', color: '#f4d873' }}
    >
      <span className="block text-sm font-medium">Cobrar en efectivo</span>
      <span className="font-titulo text-3xl font-bold">{formatearPesos(total)}</span>
    </div>
  )
}

function FalloEntrega({
  disabled,
  onConfirmar,
}: {
  disabled: boolean
  onConfirmar: (motivo: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        disabled={disabled}
        className="min-h-12 rounded-xl border border-marca-borde text-marca-texto-suave disabled:opacity-50"
      >
        No pude entregar
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-marca-borde p-3">
      <textarea
        autoFocus
        rows={2}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="¿Por qué no se pudo entregar?"
        className="w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 py-2 text-sm text-marca-texto placeholder:text-marca-texto-suave/60"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={disabled || motivo.trim() === ''}
          onClick={() => onConfirmar(motivo.trim())}
          className="min-h-12 flex-1 rounded-lg border border-marca-acento font-medium text-marca-acento-fuerte disabled:opacity-50"
        >
          Reportar
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="min-h-12 rounded-lg px-3 text-marca-texto-suave"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
