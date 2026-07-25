'use client'

import { useState, type CSSProperties } from 'react'

import { IconoAlerta, IconoCheck, IconoReloj } from '@/components/iconos'
import { useRefrescarEnCambios } from '@/lib/realtime'
import { confirmarPedido } from '../acciones'

export type PedidoMesa = {
  id: string
  numero: number
  mesa: number | null
  creado_en: string
  items: { nombre: string; cantidad: number; estacion: string; notas: string | null }[]
}

export function MeseroCliente({ pendientes }: { pendientes: PedidoMesa[] }) {
  // Nuevos pedidos de mesa y confirmaciones llegan en vivo; sin cronómetro aquí.
  useRefrescarEnCambios(['pedidos'], { intervaloMs: 30000 })

  if (pendientes.length === 0) {
    return (
      <p className="mx-auto mt-20 max-w-sm px-6 text-center text-marca-texto-suave">
        No hay pedidos de mesa por confirmar. Cuando alguien pida desde el QR de una mesa,
        aparece aquí.
      </p>
    )
  }

  return (
    <ul className="mx-auto max-w-2xl space-y-4 p-4">
      {pendientes.map((pedido, i) => (
        <Tarjeta key={pedido.id} pedido={pedido} indice={i} />
      ))}
    </ul>
  )
}

function Tarjeta({ pedido, indice }: { pedido: PedidoMesa; indice: number }) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmar() {
    setEnviando(true)
    setError(null)
    const r = await confirmarPedido(pedido.id)
    if (!r.ok) {
      setError(r.error)
      setEnviando(false)
    }
    // Si sale bien, el refresco de Realtime quita la tarjeta; no apagamos `enviando`.
  }

  return (
    <li
      className="entra rounded-xl border border-marca-borde bg-marca-superficie p-4"
      style={{ '--i': indice } as CSSProperties}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-titulo text-xl text-marca-texto">
            {pedido.mesa ? `Mesa ${pedido.mesa}` : `Pedido #${pedido.numero}`}
          </p>
          <p className="text-xs text-marca-texto-suave">Pedido #{pedido.numero}</p>
        </div>
        <span className="flex items-center gap-1 rounded-full border border-marca-borde px-2.5 py-1 text-xs text-marca-texto-suave">
          <IconoReloj className="size-3.5" />
          Sin confirmar
        </span>
      </div>

      <ul className="mt-3 space-y-1.5 border-t border-marca-borde pt-3">
        {pedido.items.map((item, i) => (
          <li key={i} className="text-sm text-marca-texto">
            <span className="font-medium">
              {item.cantidad} × {item.nombre}
            </span>
            <span className="text-marca-texto-suave"> · {item.estacion}</span>
            {item.notas ? (
              <span className="mt-0.5 block text-xs text-marca-texto-suave">{item.notas}</span>
            ) : null}
          </li>
        ))}
      </ul>

      {error ? (
        <p role="alert" className="mt-3 flex gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-5 shrink-0" />
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={confirmar}
        disabled={enviando}
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-marca-acento font-medium text-marca-acento-texto disabled:opacity-60"
      >
        <IconoCheck className="size-5 shrink-0" />
        {enviando ? 'Confirmando…' : 'Confirmar y mandar a cocina'}
      </button>
    </li>
  )
}
