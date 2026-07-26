'use client'

import { useEffect, useState, type CSSProperties } from 'react'

import { IconoCheck, IconoMoto, IconoPin, IconoReloj } from '@/components/iconos'
import { Pildora, type TonoPildora } from '@/components/ui/pildora'
import { Vacio } from '@/components/ui/vacio'
import type { EstadoPedido, PedidoVivo } from '@/lib/datos/pedidos-vivo'
import { formatearPesos } from '@/lib/formato'
import { useRefrescarEnCambios } from '@/lib/realtime'
import { haceCuanto } from '@/lib/tiempo'

/**
 * Estados con los tonos del sistema: rojo exige acción, ámbar espera una decisión,
 * azul está en proceso, verde terminó bien, gris ya no corre. El ícono acompaña
 * al texto — nunca color solo.
 */
const ESTADO: Record<EstadoPedido, { texto: string; tono: TonoPildora }> = {
  esperando_pago: { texto: 'Esperando pago', tono: 'rojo' },
  pendiente: { texto: 'Por confirmar', tono: 'ambar' },
  en_cocina: { texto: 'En cocina', tono: 'azul' },
  listo: { texto: 'Listo', tono: 'verde' },
  en_despacho: { texto: 'En despacho', tono: 'azul' },
  en_camino: { texto: 'En camino', tono: 'azul' },
  entregado: { texto: 'Entregado · por legalizar', tono: 'verde' },
  cerrado: { texto: 'Cerrado', tono: 'gris' },
  anulado: { texto: 'Anulado', tono: 'gris' },
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
    return <Vacio texto="No hay pedidos en curso ahora mismo." Icono={IconoCheck} />
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
  const estado = ESTADO[pedido.estado]

  // Qué lleva, completo: "2× Salchipapa sencilla · 1× Agua".
  const productos = pedido.productos
    .map((p) => `${p.cantidad}× ${p.nombre}`)
    .join(' · ')

  const contacto = [pedido.cliente, pedido.telefono].filter(Boolean).join(' · ')
  const lugar = [pedido.direccion, pedido.zona].filter(Boolean).join(' · ')

  return (
    <li
      className="tarjeta tarjeta-hover entra px-4 py-3"
      style={{ '--i': Math.min(indice, 8) } as CSSProperties}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-24">
          <p className="font-semibold text-marca-texto">
            {pedido.mesa ? `Mesa ${pedido.mesa}` : `#${pedido.numero}`}
          </p>
          <p className="text-xs text-marca-texto-suave">
            {NOMBRE_CANAL[pedido.canal] ?? pedido.canal}
            {contacto ? ` · ${contacto}` : ''}
          </p>
        </div>

        <Pildora tono={estado.tono} punto={false}>
          {pedido.estado === 'en_camino' ? (
            <IconoMoto className="size-3.5 shrink-0" />
          ) : pedido.estado === 'listo' || pedido.estado === 'entregado' ? (
            <IconoCheck className="size-3.5 shrink-0" />
          ) : (
            <IconoReloj className="size-3.5 shrink-0" />
          )}
          {estado.texto}
        </Pildora>

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
      </div>

      {/* Detalle completo: qué lleva y, en domicilios, a dónde va. */}
      {productos ? (
        <p className="mt-2 border-t border-marca-borde pt-2 text-sm text-marca-texto">
          {productos}
        </p>
      ) : null}
      {lugar ? (
        <p className="mt-1 flex items-start gap-1.5 text-xs text-marca-texto-suave">
          <IconoPin className="mt-0.5 size-3.5 shrink-0" />
          {lugar}
        </p>
      ) : null}
    </li>
  )
}
