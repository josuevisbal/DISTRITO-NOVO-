'use client'

import { useState, type CSSProperties } from 'react'

import { IconoAlerta, IconoCheck, IconoMoto, IconoReloj } from '@/components/iconos'
import { useRefrescarEnCambios } from '@/lib/realtime'
import { asignarDomiciliario, liberarPedido } from '../acciones'

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

export type Despacho = {
  id: string
  numero: number
  direccion: string | null
  zona: string | null
  nota_entrega: string | null
  domiciliario_id: string | null
  domiciliario_nombre: string | null
}

export type Domiciliario = { id: string; nombre: string }

const TEXTO_COMANDA: Record<EstadoComanda, string> = {
  pendiente: 'En cola',
  preparando: 'Preparando',
  listo: 'Listo',
  cancelada: 'Cancelada',
}

export function PaseCliente({
  pedidos,
  despachos,
  domiciliarios,
}: {
  pedidos: PedidoPase[]
  despachos: Despacho[]
  domiciliarios: Domiciliario[]
}) {
  useRefrescarEnCambios(['pedidos', 'comandas'], { intervaloMs: 15000 })

  return (
    <div className="space-y-8 p-4">
      <section>
        <h2 className="mb-3 font-titulo text-lg text-marca-texto">En cocina</h2>
        {pedidos.length === 0 ? (
          <p className="text-marca-texto-suave">No hay pedidos en cocina.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pedidos.map((p, i) => (
              <Tarjeta key={p.id} pedido={p} indice={i} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-titulo text-lg text-marca-texto">
          <IconoMoto className="size-5" />
          Domicilios por despachar
        </h2>
        {despachos.length === 0 ? (
          <p className="text-marca-texto-suave">Nada por despachar.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {despachos.map((d, i) => (
              <TarjetaDespacho key={d.id} despacho={d} domiciliarios={domiciliarios} indice={i} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Tarjeta({ pedido, indice }: { pedido: PedidoPase; indice: number }) {
  const [ocupado, setOcupado] = useState(false)

  async function liberar() {
    setOcupado(true)
    const r = await liberarPedido(pedido.id)
    if (!r.ok) setOcupado(false)
  }

  return (
    <li
      className="entra flex flex-col rounded-2xl border border-marca-borde bg-marca-superficie p-4 shadow-sm"
      style={{ '--i': indice } as CSSProperties}
    >
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
                    <IconoCheck className="size-4 shrink-0 text-marca-acento-fuerte" />
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

function TarjetaDespacho({
  despacho,
  domiciliarios,
  indice,
}: {
  despacho: Despacho
  domiciliarios: Domiciliario[]
  indice: number
}) {
  const [domi, setDomi] = useState(despacho.domiciliario_id ?? '')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function asignar() {
    if (!domi) return
    setOcupado(true)
    setError(null)
    const r = await asignarDomiciliario(despacho.id, domi)
    if (!r.ok) {
      setError(r.error)
      setOcupado(false)
    }
  }

  return (
    <li
      className="entra flex flex-col rounded-2xl border border-marca-borde bg-marca-superficie p-4 shadow-sm"
      style={{ '--i': indice } as CSSProperties}
    >
      <div className="flex items-center justify-between">
        <p className="font-titulo text-lg text-marca-texto">#{despacho.numero}</p>
        {despacho.domiciliario_nombre ? (
          <span className="flex items-center gap-1.5 text-sm text-marca-acento-fuerte">
            <IconoMoto className="size-4" />
            {despacho.domiciliario_nombre}
          </span>
        ) : null}
      </div>

      {despacho.direccion ? (
        <p className="mt-2 text-marca-texto">{despacho.direccion}</p>
      ) : null}
      {despacho.zona ? <p className="text-sm text-marca-texto-suave">{despacho.zona}</p> : null}

      {despacho.nota_entrega ? (
        <p className="mt-2 flex gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-5 shrink-0" />
          Volvió: {despacho.nota_entrega}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 flex gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-5 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-1 flex-col justify-end gap-2">
        <label className="block">
          <span className="sr-only">Domiciliario</span>
          <select
            value={domi}
            onChange={(e) => setDomi(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 text-marca-texto"
          >
            <option value="">Escoge domiciliario</option>
            {domiciliarios.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={asignar}
          disabled={ocupado || !domi || domi === despacho.domiciliario_id}
          className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-marca-acento font-medium text-marca-acento-texto disabled:opacity-50"
        >
          <IconoMoto className="size-5" />
          {despacho.domiciliario_id ? 'Reasignar' : 'Asignar domiciliario'}
        </button>
      </div>
    </li>
  )
}
