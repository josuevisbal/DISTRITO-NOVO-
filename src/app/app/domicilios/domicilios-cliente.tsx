'use client'

import { useState } from 'react'

import { IconoAlerta, IconoCheck, IconoMoto } from '@/components/iconos'
import { formatearPesos } from '@/lib/formato'
import { useRefrescarEnCambios } from '@/lib/realtime'
import { enlaceLlamar, enlaceWhatsApp } from '@/lib/telefono'
import { entregarPedido, falloEntrega, recogerPedido } from './acciones'

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
  nota_entrega: string | null
  items: { nombre: string; cantidad: number }[]
}

export function DomiciliosCliente({ entregas }: { entregas: Entrega[] }) {
  useRefrescarEnCambios(['pedidos'], { intervaloMs: 20000 })

  if (entregas.length === 0) {
    return (
      <p className="mx-auto mt-24 max-w-sm px-6 text-center text-lg text-marca-texto-suave">
        No tienes entregas asignadas por ahora.
      </p>
    )
  }

  return (
    <ul className="mx-auto max-w-xl space-y-4 p-4">
      {entregas.map((e) => (
        <TarjetaEntrega key={e.pedido_id} entrega={e} />
      ))}
    </ul>
  )
}

function TarjetaEntrega({ entrega }: { entrega: Entrega }) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function correr(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setOcupado(true)
    setError(null)
    const r = await fn()
    if (!r.ok) {
      setError(r.error ?? 'No se pudo')
      setOcupado(false)
    }
  }

  return (
    <li className="rounded-2xl border border-marca-borde bg-marca-superficie p-4">
      <div className="flex items-center justify-between">
        <p className="font-titulo text-xl text-marca-texto">Pedido #{entrega.numero}</p>
        <span className="flex items-center gap-1.5 rounded-full border border-marca-borde px-2.5 py-1 text-xs text-marca-texto-suave">
          <IconoMoto className="size-3.5" />
          {entrega.estado === 'en_despacho' ? 'Por recoger' : 'En camino'}
        </span>
      </div>

      {/* Dirección grande: se lee de pie, con las manos ocupadas. */}
      <p className="mt-3 text-2xl font-semibold leading-tight text-marca-texto">
        {entrega.direccion ?? 'Sin dirección'}
      </p>
      {entrega.zona ? <p className="text-marca-texto-suave">{entrega.zona}</p> : null}
      {entrega.indicaciones ? (
        <p className="mt-1 text-marca-texto-suave">{entrega.indicaciones}</p>
      ) : null}

      {/* Recuadro de cobro: amarillo con el monto si es efectivo, verde si ya está pago. */}
      <CobroCaja pagado={entrega.pagado} total={entrega.total} />

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

      {entrega.telefono ? (
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
        <p className="mt-3 flex gap-2 text-sm text-marca-acento">
          <IconoAlerta className="size-5 shrink-0" />
          Intento anterior: {entrega.nota_entrega}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 flex gap-2 text-sm text-marca-acento">
          <IconoAlerta className="size-5 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        {entrega.estado === 'en_despacho' ? (
          <button
            type="button"
            onClick={() => correr(() => recogerPedido(entrega.pedido_id))}
            disabled={ocupado}
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-marca-acento text-lg font-bold text-marca-acento-texto disabled:opacity-60"
          >
            <IconoMoto className="size-5" />
            Recogí, voy en camino
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => correr(() => entregarPedido(entrega.pedido_id))}
              disabled={ocupado}
              className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-marca-acento text-lg font-bold text-marca-acento-texto disabled:opacity-60"
            >
              <IconoCheck className="size-6" />
              Entregué
            </button>
            <FalloEntrega
              disabled={ocupado}
              onConfirmar={(motivo) => correr(() => falloEntrega(entrega.pedido_id, motivo))}
            />
          </>
        )}
      </div>
    </li>
  )
}

function CobroCaja({ pagado, total }: { pagado: boolean; total: number }) {
  if (pagado) {
    // Verde: ya está pago, no cobrar.
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
          className="min-h-12 flex-1 rounded-lg border border-marca-acento font-medium text-marca-acento disabled:opacity-50"
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
