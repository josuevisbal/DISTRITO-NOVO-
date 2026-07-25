'use client'

import { useEffect, useState, type CSSProperties } from 'react'

import { IconoCheck, IconoMoto, IconoReloj } from '@/components/iconos'
import type { EstadoPedido, PedidoVivo } from '@/lib/datos/pedidos-vivo'
import { formatearPesos } from '@/lib/formato'
import { useRefrescarEnCambios } from '@/lib/realtime'
import { haceCuanto } from '@/lib/tiempo'

/**
 * Píldoras de estado: colores fijos del sistema sobre fondo claro (no de marca), siempre
 * acompañados del texto del estado. El rojo queda para lo que exige acción humana.
 */
const PILDORA: Record<EstadoPedido, { texto: string; clase: string }> = {
  esperando_pago: { texto: 'Esperando pago', clase: 'border-red-300 bg-red-50 text-red-900' },
  pendiente: { texto: 'Por confirmar', clase: 'border-amber-300 bg-amber-50 text-amber-900' },
  en_cocina: { texto: 'En cocina', clase: 'border-sky-300 bg-sky-50 text-sky-900' },
  listo: { texto: 'Listo', clase: 'border-emerald-300 bg-emerald-50 text-emerald-900' },
  en_despacho: { texto: 'En despacho', clase: 'border-violet-300 bg-violet-50 text-violet-900' },
  en_camino: { texto: 'En camino', clase: 'border-cyan-300 bg-cyan-50 text-cyan-900' },
  entregado: { texto: 'Entregado · por legalizar', clase: 'border-emerald-400 bg-emerald-50 text-emerald-900' },
  cerrado: { texto: 'Cerrado', clase: 'border-marca-borde bg-marca-superficie-tenue text-marca-texto-suave' },
  anulado: { texto: 'Anulado', clase: 'border-marca-borde bg-marca-superficie-tenue text-marca-texto-suave' },
}

const NOMBRE_CANAL: Record<string, string> = {
  mesa: 'Mesa',
  domicilio: 'Domicilio',
  whatsapp: 'WhatsApp',
  recoger: 'Recoger',
  mostrador: 'Mostrador',
}

export function PedidosVivoCliente({
  pedidos,
  servidorAhoraISO,
}: {
  pedidos: PedidoVivo[]
  servidorAhoraISO: string
}) {
  // Vivo de verdad: cualquier cambio en pedidos o comandas refresca del servidor.
  useRefrescarEnCambios(['pedidos', 'comandas'], { intervaloMs: 15000 })

  // Reloj corregido con el servidor para el "hace cuánto".
  const [ahora, setAhora] = useState(() => new Date(servidorAhoraISO).getTime())
  useEffect(() => {
    const desfase = new Date(servidorAhoraISO).getTime() - Date.now()
    const id = setInterval(() => setAhora(Date.now() + desfase), 1000)
    return () => clearInterval(id)
  }, [servidorAhoraISO])

  if (pedidos.length === 0) {
    return (
      <div className="tarjeta p-10 text-center">
        <p className="flex items-center justify-center gap-2 text-marca-texto-suave">
          <IconoCheck className="size-5 shrink-0 text-marca-acento-fuerte" />
          No hay pedidos en curso ahora mismo.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-2.5">
      {pedidos.map((p, i) => (
        <FilaPedido key={p.id} pedido={p} ahora={ahora} indice={i} />
      ))}
    </ul>
  )
}

function FilaPedido({
  pedido,
  ahora,
  indice,
}: {
  pedido: PedidoVivo
  ahora: number
  indice: number
}) {
  const pildora = PILDORA[pedido.estado]

  return (
    <li
      className="tarjeta tarjeta-hover entra flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
      style={{ '--i': Math.min(indice, 8) } as CSSProperties}
    >
      <div className="min-w-24">
        <p className="font-semibold text-marca-texto">
          {pedido.mesa ? `Mesa ${pedido.mesa}` : `#${pedido.numero}`}
        </p>
        <p className="text-xs text-marca-texto-suave">
          {NOMBRE_CANAL[pedido.canal] ?? pedido.canal}
          {pedido.cliente ? ` · ${pedido.cliente}` : ''}
        </p>
      </div>

      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${pildora.clase}`}
      >
        {pedido.estado === 'en_camino' ? (
          <IconoMoto className="size-3.5 shrink-0" />
        ) : pedido.estado === 'listo' || pedido.estado === 'entregado' ? (
          <IconoCheck className="size-3.5 shrink-0" />
        ) : (
          <IconoReloj className="size-3.5 shrink-0" />
        )}
        {pildora.texto}
      </span>

      {pedido.estado === 'en_cocina' && pedido.comandasTotal > 0 ? (
        <span className="text-xs tabular-nums text-marca-texto-suave">
          Estaciones listas: {pedido.comandasListas}/{pedido.comandasTotal}
        </span>
      ) : null}

      <span className="ml-auto text-xs tabular-nums text-marca-texto-suave">
        {pedido.unidades} {pedido.unidades === 1 ? 'ítem' : 'ítems'} ·{' '}
        {haceCuanto(new Date(pedido.creado_en).getTime(), ahora)}
      </span>

      <span className="w-24 text-right font-semibold tabular-nums text-marca-texto">
        {formatearPesos(pedido.total)}
      </span>
    </li>
  )
}
