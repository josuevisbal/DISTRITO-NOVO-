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
  zona: string | null
  estado: string
  listo: boolean
  productos: string | null
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

/** Colores del borde izquierdo por estado. */
const BORDE = {
  completo: '#1E9E6A', // verde: listo para liberar
  cocina: '#D99A06', // ámbar: falta cocina
  despacho: '#2563EB', // azul: por despachar
}

function origen(canal: string, mesa: number | null, zona: string | null): string {
  if (mesa) return `Mesa ${mesa}`
  if (canal === 'domicilio') return zona ? `Domicilio · ${zona}` : 'Domicilio'
  if (canal === 'recoger') return 'Para recoger'
  return canal
}

type FilaPase =
  | { tipo: 'cocina'; key: string; pedido: PedidoPase }
  | { tipo: 'despacho'; key: string; despacho: Despacho }

export function PaseCliente({
  pedidos,
  despachos,
  domiciliarios,
  soloLectura = false,
}: {
  pedidos: PedidoPase[]
  despachos: Despacho[]
  domiciliarios: Domiciliario[]
  /** Monitoreo del admin: espejo sin controles. Observa, no opera. */
  soloLectura?: boolean
}) {
  useRefrescarEnCambios(['pedidos', 'comandas'], { intervaloMs: 15000 })

  const filas: FilaPase[] = [
    ...pedidos.map((p) => ({ tipo: 'cocina' as const, key: p.id, pedido: p })),
    ...despachos.map((d) => ({ tipo: 'despacho' as const, key: d.id, despacho: d })),
  ]

  const completos = pedidos.filter((p) => p.listo).length
  const [filtro, setFiltro] = useState<'todos' | 'completos' | 'despachar'>('todos')

  const visibles = filas.filter((f) => {
    if (filtro === 'completos') return f.tipo === 'cocina' && f.pedido.listo
    if (filtro === 'despachar') return f.tipo === 'despacho'
    return true
  })

  const pestanas = [
    { valor: 'todos', etiqueta: `En curso · ${filas.length}` },
    { valor: 'completos', etiqueta: `Completos · ${completos}` },
    { valor: 'despachar', etiqueta: `Por despachar · ${despachos.length}` },
  ] as const

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {pestanas.map((p) => {
            const activa = filtro === p.valor
            return (
              <button
                key={p.valor}
                type="button"
                onClick={() => setFiltro(p.valor)}
                aria-pressed={activa}
                className={`min-h-10 rounded-lg border px-3 text-sm font-medium ${
                  activa
                    ? 'border-transparent bg-[#0B0B0C] text-marca-acento'
                    : 'border-marca-borde text-marca-texto-suave hover:text-marca-texto'
                }`}
              >
                {p.etiqueta}
              </button>
            )
          })}
        </div>
        <p className="text-sm text-marca-texto-suave">Pase y despacho</p>
      </div>

      {visibles.length > 0 ? (
        <div className="hidden grid-cols-[0.9fr_1.2fr_1.1fr_auto] gap-3 px-3 text-xs font-semibold uppercase tracking-wider text-marca-texto-suave lg:grid">
          <span>Pedido</span>
          <span>Productos</span>
          <span>Estaciones</span>
          <span className="text-right">Acción</span>
        </div>
      ) : null}

      <ul className="space-y-2.5">
        {visibles.length === 0 ? (
          <li className="rounded-xl border border-dashed border-marca-borde p-6 text-center text-sm text-marca-texto-suave">
            No hay pedidos en este filtro.
          </li>
        ) : (
          visibles.map((f, i) =>
            f.tipo === 'cocina' ? (
              <FilaCocina key={f.key} pedido={f.pedido} indice={i} soloLectura={soloLectura} />
            ) : (
              <FilaDespacho
                key={f.key}
                despacho={f.despacho}
                domiciliarios={domiciliarios}
                indice={i}
                soloLectura={soloLectura}
              />
            ),
          )
        )}
      </ul>
    </div>
  )
}

function EnvolturaFila({
  borde,
  indice,
  children,
}: {
  borde: string
  indice: number
  children: React.ReactNode
}) {
  return (
    <li
      className="tarjeta tarjeta-hover entra grid grid-cols-1 items-center gap-3 p-3 pl-4 lg:grid-cols-[0.9fr_1.2fr_1.1fr_auto]"
      style={{ '--i': indice, borderLeft: `4px solid ${borde}` } as CSSProperties}
    >
      {children}
    </li>
  )
}

function ColPedido({
  titulo,
  pastilla,
  color,
  origen: sub,
}: {
  titulo: string
  pastilla: string
  color: string
  origen: string
}) {
  return (
    <div>
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-marca-texto">{titulo}</span>
        <span
          className="entra-pastilla rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ backgroundColor: `${color}1A`, color }}
        >
          {pastilla}
        </span>
      </p>
      <p className="mt-0.5 text-xs text-marca-texto-suave">{sub}</p>
    </div>
  )
}

function FilaCocina({
  pedido,
  indice,
  soloLectura,
}: {
  pedido: PedidoPase
  indice: number
  soloLectura: boolean
}) {
  const [ocupado, setOcupado] = useState(false)

  async function liberar() {
    setOcupado(true)
    const r = await liberarPedido(pedido.id)
    if (!r.ok) setOcupado(false)
  }

  const pastilla = pedido.listo
    ? { texto: 'Completo', color: '#116B47' }
    : { texto: 'Falta cocina', color: '#B07A0F' }

  return (
    <EnvolturaFila borde={pedido.listo ? BORDE.completo : BORDE.cocina} indice={indice}>
      <ColPedido
        titulo={pedido.mesa ? `Mesa ${pedido.mesa}` : `#${pedido.numero}`}
        pastilla={pastilla.texto}
        color={pastilla.color}
        origen={origen(pedido.canal, pedido.mesa, pedido.zona)}
      />

      <p className="min-w-0 truncate text-sm text-marca-texto">{pedido.productos ?? '—'}</p>

      {/* Corazón del pase: las tres estaciones de un vistazo. */}
      <div className="flex flex-wrap gap-1.5">
        {pedido.barras.map((b) => (
          <ChipEstacion key={b.estacion_id} barra={b} />
        ))}
      </div>

      <div className="flex justify-end">
        {soloLectura ? (
          <span className="min-h-11 rounded-lg px-4 text-sm font-semibold text-marca-texto-suave">
            {pedido.listo ? 'Completo' : 'En cocina'}
          </span>
        ) : (
          <button
            type="button"
            onClick={liberar}
            disabled={!pedido.listo || ocupado}
            className={`min-h-11 rounded-lg px-4 text-sm font-semibold ${
              pedido.listo
                ? 'bg-[#0B0B0C] text-marca-acento'
                : 'cursor-not-allowed border border-marca-borde text-marca-texto-suave'
            } disabled:opacity-60`}
          >
            {pedido.listo ? 'Liberar' : 'Esperando'}
          </button>
        )}
      </div>
    </EnvolturaFila>
  )
}

/** Mini-chip de estación: verde ✓ terminó, ámbar en curso, gris — no participa. */
function ChipEstacion({ barra }: { barra: BarraEstacion }) {
  if (barra.estado === null) {
    return (
      <span className="pastilla inline-flex min-h-8 items-center rounded-lg border border-marca-borde px-2 text-xs text-marca-texto-suave">
        —
      </span>
    )
  }
  const listo = barra.estado === 'listo'
  return (
    <span
      className="pastilla inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold"
      style={{
        backgroundColor: listo ? barra.color : `${barra.color}22`,
        color: listo ? '#fff' : barra.color,
        border: listo ? 'none' : `1px solid ${barra.color}`,
      }}
    >
      {barra.nombre}
      {listo ? <IconoCheck className="size-3.5" /> : <IconoReloj className="size-3" />}
    </span>
  )
}

function FilaDespacho({
  despacho,
  domiciliarios,
  indice,
  soloLectura,
}: {
  despacho: Despacho
  domiciliarios: Domiciliario[]
  indice: number
  soloLectura: boolean
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
    <EnvolturaFila borde={BORDE.despacho} indice={indice}>
      <ColPedido
        titulo={`#${despacho.numero}`}
        pastilla="Por despachar"
        color="#1E4FBF"
        origen={despacho.zona ? `Domicilio · ${despacho.zona}` : 'Domicilio'}
      />

      <p className="min-w-0 truncate text-sm text-marca-texto">
        {despacho.direccion ?? 'Sin dirección'}
        {despacho.nota_entrega ? (
          <span className="mt-0.5 flex items-center gap-1 text-xs text-marca-acento-fuerte">
            <IconoAlerta className="size-3.5" /> Volvió: {despacho.nota_entrega}
          </span>
        ) : null}
      </p>

      <p className="flex items-center gap-1.5 text-sm text-marca-texto-suave">
        <IconoCheck className="size-4 text-marca-acento-fuerte" />
        {despacho.domiciliario_nombre
          ? `Asignado a ${despacho.domiciliario_nombre}`
          : 'Empacado, listo para asignar'}
      </p>

      {soloLectura ? (
        <div className="flex justify-end">
          <span className="min-h-11 rounded-lg px-4 text-sm font-semibold text-marca-texto-suave">
            {despacho.domiciliario_nombre ?? 'Sin asignar'}
          </span>
        </div>
      ) : (
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5">
          <label className="sr-only" htmlFor={`domi-${despacho.id}`}>
            Domiciliario
          </label>
          <select
            id={`domi-${despacho.id}`}
            value={domi}
            onChange={(e) => setDomi(e.target.value)}
            className="min-h-11 rounded-lg border border-marca-borde bg-marca-fondo px-2 text-sm text-marca-texto"
          >
            <option value="">Escoge</option>
            {domiciliarios.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={asignar}
            disabled={ocupado || !domi || domi === despacho.domiciliario_id}
            className="min-h-11 rounded-lg bg-[#0B0B0C] px-3 text-sm font-semibold text-marca-acento disabled:opacity-50"
          >
            <IconoMoto className="mr-1 inline size-4" />
            {despacho.domiciliario_id ? 'Reasignar' : 'Asignar domi'}
          </button>
        </div>
        {error ? (
          <p role="alert" className="flex items-center gap-1 text-xs text-marca-acento-fuerte">
            <IconoAlerta className="size-4" />
            {error}
          </p>
        ) : null}
      </div>
      )}
    </EnvolturaFila>
  )
}
