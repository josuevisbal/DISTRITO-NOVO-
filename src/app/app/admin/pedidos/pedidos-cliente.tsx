'use client'

import { useEffect, useState, type CSSProperties } from 'react'

import {
  IconoCheck,
  IconoCubiertos,
  IconoMoto,
  IconoReloj,
  IconoSilla,
  IconoTienda,
} from '@/components/iconos'
import { FichaCliente, FichaDireccion } from '@/components/ui/ficha-cliente'
import { Pildora, type TonoPildora } from '@/components/ui/pildora'
import { Vacio } from '@/components/ui/vacio'
import type { EstadoPedido, PedidoVivo } from '@/lib/datos/pedidos-vivo'
import { formatearPesos } from '@/lib/formato'
import { useRefrescarEnCambios } from '@/lib/realtime'
import { haceCuanto } from '@/lib/tiempo'

/**
 * Estados con los tonos del sistema: rojo exige acción, ámbar espera una decisión,
 * azul está en proceso, verde terminó bien, gris ya no corre. El ícono acompaña
 * al texto — nunca color solo. El borde izquierdo de la fila repite el tono.
 */
const ESTADO: Record<EstadoPedido, { texto: string; tono: TonoPildora; borde: string }> = {
  esperando_pago: { texto: 'Esperando pago', tono: 'rojo', borde: '#D64533' },
  pendiente: { texto: 'Por confirmar', tono: 'ambar', borde: '#D99A06' },
  en_cocina: { texto: 'En cocina', tono: 'azul', borde: '#5B6BF0' },
  listo: { texto: 'Listo', tono: 'verde', borde: '#1E9E6A' },
  en_despacho: { texto: 'En despacho', tono: 'azul', borde: '#5B6BF0' },
  en_camino: { texto: 'En camino', tono: 'azul', borde: '#5B6BF0' },
  entregado: { texto: 'Entregado · por legalizar', tono: 'verde', borde: '#1E9E6A' },
  cerrado: { texto: 'Cerrado', tono: 'gris', borde: 'var(--marca-borde)' },
  anulado: { texto: 'Anulado', tono: 'gris', borde: 'var(--marca-borde)' },
}

const NOMBRE_CANAL: Record<string, string> = {
  mesa: 'Mesa',
  domicilio: 'Domicilio',
  whatsapp: 'WhatsApp',
  recoger: 'Recoger',
  mostrador: 'Mostrador',
}

/** Filtros por canal: cada grupo con su ícono y los canales que agrupa. */
const GRUPOS_CANAL = [
  { valor: 'mesa', etiqueta: 'Mesa', canales: ['mesa'], Icono: IconoSilla },
  { valor: 'domicilio', etiqueta: 'Domicilio', canales: ['domicilio', 'whatsapp'], Icono: IconoMoto },
  { valor: 'mostrador', etiqueta: 'Mostrador', canales: ['mostrador', 'recoger'], Icono: IconoTienda },
] as const

type FiltroCanal = 'todos' | (typeof GRUPOS_CANAL)[number]['valor']

function iconoCanal(canal: string) {
  const grupo = GRUPOS_CANAL.find((g) => (g.canales as readonly string[]).includes(canal))
  return grupo?.Icono ?? IconoTienda
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

  const [filtro, setFiltro] = useState<FiltroCanal>('todos')

  const conteo = (canales: readonly string[]) =>
    pedidos.filter((p) => canales.includes(p.canal)).length

  const visibles =
    filtro === 'todos'
      ? pedidos
      : pedidos.filter((p) => {
          const grupo = GRUPOS_CANAL.find((g) => g.valor === filtro)
          return grupo ? (grupo.canales as readonly string[]).includes(p.canal) : true
        })

  return (
    <div className="space-y-4">
      {/* Filtros por canal con contador, como en caja. */}
      <div className="flex flex-wrap items-center gap-2">
        <BotonFiltro activo={filtro === 'todos'} onClick={() => setFiltro('todos')}>
          Todos · {pedidos.length}
        </BotonFiltro>
        {GRUPOS_CANAL.map((g) => (
          <BotonFiltro key={g.valor} activo={filtro === g.valor} onClick={() => setFiltro(g.valor)}>
            <g.Icono className="size-4" />
            {g.etiqueta} · {conteo(g.canales)}
          </BotonFiltro>
        ))}
      </div>

      <p className="text-xs text-marca-texto-suave">
        {visibles.length} en curso · del más nuevo al más viejo
      </p>

      {visibles.length === 0 ? (
        <Vacio texto="No hay pedidos en este filtro." Icono={IconoCheck} />
      ) : (
        <ul className="space-y-2.5">
          {visibles.map((p, i) => (
            <FilaPedido key={p.id} pedido={p} ahora={ahora} indice={i} />
          ))}
        </ul>
      )}
    </div>
  )
}

function BotonFiltro({
  activo,
  onClick,
  children,
}: {
  activo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${
        activo
          ? 'border-transparent bg-panel-lateral text-marca-acento'
          : 'border-marca-borde bg-marca-superficie text-marca-texto-suave hover:text-marca-texto'
      }`}
    >
      {children}
    </button>
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
  const Canal = iconoCanal(pedido.canal)
  const esDomicilio = pedido.canal === 'domicilio' || pedido.canal === 'whatsapp'

  // Qué lleva, completo: "2× Salchipapa sencilla · 1× Agua".
  const productos = pedido.productos.map((p) => `${p.cantidad}× ${p.nombre}`).join(' · ')

  return (
    <li
      className="tarjeta tarjeta-hover entra grid grid-cols-1 gap-3 p-3.5 pl-4 sm:grid-cols-[minmax(9.5rem,0.8fr)_1.7fr_auto]"
      style={{ '--i': Math.min(indice, 8), borderLeft: `4px solid ${estado.borde}` } as CSSProperties}
    >
      {/* ----- QUIÉN: canal, identificador y cliente ----- */}
      <div className="space-y-2">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-marca-superficie-tenue text-marca-acento-fuerte"
          >
            <Canal className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-bold leading-tight text-marca-texto">
              {pedido.mesa ? `Mesa ${pedido.mesa}` : `#${pedido.numero}`}
            </p>
            <p className="text-xs text-marca-texto-suave">
              {NOMBRE_CANAL[pedido.canal] ?? pedido.canal}
            </p>
          </div>
        </div>

        {/* Los pedidos de mesa no llevan recuadro de cliente vacío. */}
        {!pedido.mesa ? <FichaCliente nombre={pedido.cliente} telefono={pedido.telefono} /> : null}
      </div>

      {/* ----- QUÉ Y A DÓNDE: estado, productos y dirección ----- */}
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
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
            <span className="flex items-center gap-2 text-xs tabular-nums text-marca-texto-suave">
              Estaciones {pedido.comandasListas}/{pedido.comandasTotal}
              {/* Barritas: la estación que terminó en su color, la que falta en gris. */}
              <span className="flex items-center gap-1">
                {pedido.estaciones.map((e) => (
                  <span
                    key={e.nombre}
                    title={`${e.nombre}${e.lista ? ' · lista' : ' · en cocina'}`}
                    className="h-1.5 w-4 rounded-full transition-colors duration-300"
                    style={{ backgroundColor: e.lista ? e.color : 'var(--marca-borde)' }}
                  />
                ))}
              </span>
            </span>
          ) : null}
        </div>

        {productos ? (
          <p className="flex items-start gap-1.5 text-sm text-marca-texto">
            <IconoCubiertos className="mt-0.5 size-4 shrink-0 text-marca-texto-suave" />
            {productos}
          </p>
        ) : null}

        {esDomicilio ? <FichaDireccion direccion={pedido.direccion} zona={pedido.zona} /> : null}
      </div>

      {/* ----- CUÁNTO ----- */}
      <div className="text-right">
        <p className="text-xl font-bold tabular-nums text-marca-texto">
          {formatearPesos(pedido.total)}
        </p>
        <p className="mt-0.5 text-xs tabular-nums text-marca-texto-suave">
          {pedido.unidades} {pedido.unidades === 1 ? 'ítem' : 'ítems'} ·{' '}
          {haceCuanto(new Date(pedido.creado_en).getTime(), ahora)}
        </p>
      </div>
    </li>
  )
}
