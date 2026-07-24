'use client'

import { useState } from 'react'

import { IconoCheck, IconoReloj } from '@/components/iconos'
import { useRefrescarEnCambios } from '@/lib/realtime'
import { liberarPedido } from '../acciones'

type EstadoComanda = 'pendiente' | 'preparando' | 'listo' | 'cancelada'

export type BarraEstacion = {
  estacion_id: string
  nombre: string
  color: string
  estado: EstadoComanda | null
}

export type PedidoPase = {
  id: string
  numero: number
  mesa: number | null
  canal: string
  estado: string
  listo: boolean
  barras: BarraEstacion[]
}

const TEXTO_COMANDA: Record<EstadoComanda, string> = {
  pendiente: 'En cola',
  preparando: 'Preparando',
  listo: 'Listo',
  cancelada: 'Cancelada',
}

export function PaseCliente({ pedidos }: { pedidos: PedidoPase[] }) {
  useRefrescarEnCambios(['pedidos', 'comandas'], { intervaloMs: 15000 })

  if (pedidos.length === 0) {
    return (
      <p className="mx-auto mt-24 max-w-sm px-6 text-center text-lg text-marca-texto-suave">
        No hay pedidos en cocina.
      </p>
    )
  }

  return (
    <ul className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {pedidos.map((p) => (
        <Tarjeta key={p.id} pedido={p} />
      ))}
    </ul>
  )
}

function Tarjeta({ pedido }: { pedido: PedidoPase }) {
  const [ocupado, setOcupado] = useState(false)

  async function liberar() {
    setOcupado(true)
    const r = await liberarPedido(pedido.id)
    if (!r.ok) setOcupado(false)
  }

  return (
    <li className="flex flex-col rounded-2xl border border-marca-borde bg-marca-superficie p-4">
      <div className="flex items-center justify-between">
        <p className="font-titulo text-2xl font-bold text-marca-texto">
          {pedido.mesa ? `Mesa ${pedido.mesa}` : `#${pedido.numero}`}
        </p>
        <span className="text-xs text-marca-texto-suave">#{pedido.numero}</span>
      </div>

      <ul className="mt-4 flex-1 space-y-2">
        {pedido.barras.map((b) => {
          const listo = b.estado === 'listo'
          const sinItems = b.estado === null
          return (
            <li
              key={b.estacion_id}
              className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                sinItems ? 'opacity-40' : ''
              }`}
              style={{ borderColor: b.color }}
            >
              <span className="flex items-center gap-2 text-marca-texto">
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: b.color }}
                />
                {b.nombre}
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {sinItems ? (
                  <span className="text-marca-texto-suave">—</span>
                ) : listo ? (
                  <>
                    <IconoCheck className="size-4 shrink-0 text-marca-acento" />
                    <span className="text-marca-texto">Listo</span>
                  </>
                ) : (
                  <>
                    <IconoReloj className="size-4 shrink-0 text-marca-texto-suave" />
                    <span className="text-marca-texto-suave">
                      {b.estado ? TEXTO_COMANDA[b.estado] : ''}
                    </span>
                  </>
                )}
              </span>
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        onClick={liberar}
        disabled={!pedido.listo || ocupado}
        className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-marca-acento text-lg font-bold text-marca-acento-texto disabled:cursor-not-allowed disabled:bg-marca-borde disabled:text-marca-texto-suave"
      >
        <IconoCheck className="size-5 shrink-0" />
        {pedido.listo ? 'Liberar a despacho' : 'Esperando cocina'}
      </button>
    </li>
  )
}
