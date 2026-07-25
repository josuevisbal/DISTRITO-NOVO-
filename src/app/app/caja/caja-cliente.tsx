'use client'

import { useEffect, useState, type CSSProperties } from 'react'

import {
  IconoAlerta,
  IconoBillete,
  IconoCampana,
  IconoCheck,
  IconoGlobo,
  IconoIntercambio,
  IconoMoto,
  IconoReloj,
  IconoTarjeta,
} from '@/components/iconos'
import { formatearPesos } from '@/lib/formato'
import { useConteo } from '@/lib/use-conteo'
import { useRefrescarEnCambios } from '@/lib/realtime'
import { haceCuanto } from '@/lib/tiempo'
import {
  abrirTurno,
  anularPedido,
  cerrarTurno,
  confirmarContraentrega,
  legalizarDomiciliario,
  registrarCobro,
  verificarTransferencia,
  type ArqueoCierre,
} from './acciones'

export type Turno = { id: string; base_inicial: number; abierto_en: string } | null
export type Transferencia = {
  pedido_id: string
  numero: number
  cliente: string | null
  telefono: string | null
  zona: string | null
  monto_exacto: number
  creado_en: string
}
export type Contraentrega = {
  pedido_id: string
  numero: number
  canal: string
  cliente: string | null
  telefono: string | null
  zona: string | null
  total: number
  direccion: string | null
  creado_en: string
}
export type PorCobrar = {
  pedido_id: string
  numero: number
  canal: string
  mesa: number | null
  productos: string | null
  total: number
}
export type PorLegalizar = {
  domiciliario_id: string
  nombre: string
  total: number
  pedidos: number
}

const MEDIOS: { valor: 'efectivo' | 'transferencia' | 'datafono'; nombre: string }[] = [
  { valor: 'efectivo', nombre: 'Efectivo' },
  { valor: 'transferencia', nombre: 'Transferencia' },
  { valor: 'datafono', nombre: 'Datáfono' },
]

const NOMBRE_MEDIO: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  datafono: 'Datáfono',
  pasarela: 'Pasarela',
}

/** Identidad visual de cada medio de pago: ícono + color fijo del sistema. */
const MEDIO_INFO: Record<
  string,
  { Icono: (p: { className?: string }) => React.ReactNode; color: string }
> = {
  efectivo: { Icono: IconoBillete, color: '#1E9E6A' },
  transferencia: { Icono: IconoIntercambio, color: '#2563EB' },
  datafono: { Icono: IconoTarjeta, color: '#7C3AED' },
  pasarela: { Icono: IconoGlobo, color: '#D99A06' },
}

type Props = {
  turno: Turno
  arqueo: Record<string, number>
  transferencias: Transferencia[]
  contraentregas: Contraentrega[]
  porCobrar: PorCobrar[]
  porLegalizar: PorLegalizar[]
  servidorAhoraISO: string
}

export function CajaCliente(props: Props) {
  const { turno, arqueo, transferencias, contraentregas, porCobrar, porLegalizar, servidorAhoraISO } =
    props

  useRefrescarEnCambios(['pedidos'], { intervaloMs: 15000 })

  // Reloj corregido con el desfase del servidor, para los contadores de espera.
  const [ahora, setAhora] = useState(() => new Date(servidorAhoraISO).getTime())
  useEffect(() => {
    const desfase = new Date(servidorAhoraISO).getTime() - Date.now()
    const id = setInterval(() => setAhora(Date.now() + desfase), 1000)
    return () => clearInterval(id)
  }, [servidorAhoraISO])

  // El resumen del cierre vive aquí, no en el botón: así sobrevive al refresco que deja el
  // turno en null, y el cajero alcanza a ver el cuadre hasta que lo cierra a mano.
  const [cierre, setCierre] = useState<ArqueoCierre | null>(null)

  // Lista unificada: cada pedido es una fila con su tipo de acción.
  const filas: FilaCaja[] = [
    ...transferencias.map((t) => ({ tipo: 'verificar' as const, key: t.pedido_id, transferencia: t })),
    ...contraentregas.map((c) => ({ tipo: 'confirmar' as const, key: c.pedido_id, contraentrega: c })),
    ...porCobrar.map((p) => ({ tipo: 'cobrar' as const, key: p.pedido_id, cobro: p })),
  ]

  const conteos = {
    todos: filas.length,
    verificar: transferencias.length,
    confirmar: contraentregas.length,
    cobrar: porCobrar.length,
  }
  const [filtro, setFiltro] = useState<'todos' | 'verificar' | 'confirmar' | 'cobrar'>('todos')
  const visibles = filtro === 'todos' ? filas : filas.filter((f) => f.tipo === filtro)

  const ventasTurno = Object.values(arqueo).reduce((s, v) => s + v, 0)

  const pestanas = [
    { valor: 'todos', etiqueta: `Todos · ${conteos.todos}` },
    { valor: 'verificar', etiqueta: `Por verificar · ${conteos.verificar}` },
    { valor: 'confirmar', etiqueta: `Por confirmar · ${conteos.confirmar}` },
    { valor: 'cobrar', etiqueta: `Por cobrar · ${conteos.cobrar}` },
  ] as const

  return (
    <div className="space-y-5 pb-24">
      <PilaNotificaciones transferencias={transferencias} ahora={ahora} />

      {cierre ? <ResumenCierre arqueo={cierre} onCerrar={() => setCierre(null)} /> : null}

      <SeccionTurno turno={turno} arqueo={arqueo} onCerrado={setCierre} />

      {/* Filtros con contador + ventas del turno. */}
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
        {turno ? <VentasTurno total={ventasTurno} /> : null}
      </div>

      {/* Encabezado de columnas. */}
      {visibles.length > 0 ? (
        <div className="hidden grid-cols-[1.1fr_1.3fr_0.9fr_auto] gap-3 px-3 text-xs font-semibold uppercase tracking-wider text-marca-texto-suave sm:grid">
          <span>Pedido</span>
          <span>Cliente</span>
          <span>Pago</span>
          <span className="text-right">Acción</span>
        </div>
      ) : null}

      <ul className="space-y-2.5">
        {visibles.length === 0 ? (
          <li className="rounded-xl border border-dashed border-marca-borde p-6 text-center text-sm text-marca-texto-suave">
            No hay pedidos en este filtro.
          </li>
        ) : (
          visibles.map((f, i) => <FilaPedido key={f.key} fila={f} ahora={ahora} indice={i} />)
        )}
      </ul>

      {porLegalizar.length > 0 ? (
        <section className="pt-2">
          <h2 className="mb-2 text-sm font-semibold text-marca-texto">
            Efectivo de domiciliarios por legalizar
          </h2>
          <div className="space-y-2.5">
            {porLegalizar.map((l) => (
              <TarjetaLegalizar key={l.domiciliario_id} liquidacion={l} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

/** "Ventas del turno" con conteo animado al entrar. */
function VentasTurno({ total }: { total: number }) {
  const animado = useConteo(total)
  return (
    <p className="text-sm text-marca-texto-suave">
      Ventas del turno{' '}
      <span className="font-bold text-marca-texto">{formatearPesos(animado)}</span>
    </p>
  )
}

/* ---------- Lista tipo tablero ---------- */

type FilaCaja =
  | { tipo: 'verificar'; key: string; transferencia: Transferencia }
  | { tipo: 'confirmar'; key: string; contraentrega: Contraentrega }
  | { tipo: 'cobrar'; key: string; cobro: PorCobrar }

/** Colores del borde izquierdo por estado (código de un vistazo). */
const BORDE = {
  verificar: '#D99A06', // ámbar
  confirmar: '#D99A06', // ámbar
  cobrar: '#1E9E6A', // verde
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
      className="tarjeta tarjeta-hover entra grid grid-cols-1 items-center gap-3 overflow-hidden p-3 pl-4 sm:grid-cols-[1.1fr_1.3fr_0.9fr_auto]"
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
  sub,
}: {
  titulo: string
  pastilla: string
  color: string
  sub: string
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
      <p className="mt-0.5 flex items-center gap-1 text-xs text-marca-texto-suave">
        <IconoReloj className="size-3.5" />
        {sub}
      </p>
    </div>
  )
}

function ColPago({ monto, medio }: { monto: number; medio: string }) {
  return (
    <div className="sm:text-left">
      <p className="text-lg font-bold text-marca-texto">{formatearPesos(monto)}</p>
      <p className="text-xs text-marca-texto-suave">{NOMBRE_MEDIO[medio] ?? medio}</p>
    </div>
  )
}

function FilaPedido({ fila, ahora, indice }: { fila: FilaCaja; ahora: number; indice: number }) {
  if (fila.tipo === 'verificar') {
    return <FilaVerificar t={fila.transferencia} ahora={ahora} indice={indice} />
  }
  if (fila.tipo === 'confirmar') {
    return <FilaConfirmar c={fila.contraentrega} ahora={ahora} indice={indice} />
  }
  return <FilaCobrar p={fila.cobro} indice={indice} />
}

function FilaVerificar({ t, ahora, indice }: { t: Transferencia; ahora: number; indice: number }) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function verificar(ok: boolean) {
    setOcupado(true)
    setError(null)
    const r = await verificarTransferencia(
      t.pedido_id,
      ok,
      ok ? undefined : 'La transferencia no llegó al banco',
    )
    if (!r.ok) {
      setError(r.error)
      setOcupado(false)
    }
  }

  return (
    <EnvolturaFila borde={BORDE.verificar} indice={indice}>
      <ColPedido
        titulo={`#${t.numero}`}
        pastilla="Por verificar"
        color="#B07A0F"
        sub={`${haceCuanto(new Date(t.creado_en).getTime(), ahora)} · domicilio`}
      />
      <ColCliente nombre={t.cliente} telefono={t.telefono} extra={t.zona} />
      <ColPago monto={t.monto_exacto} medio="transferencia" />
      <div className="flex items-center justify-end gap-2">
        <BotonVerde onClick={() => verificar(true)} disabled={ocupado} texto="Verifiqué" />
        <BotonBorde onClick={() => verificar(false)} disabled={ocupado} texto="No llegó" />
      </div>
      {error ? <Error texto={error} /> : null}
    </EnvolturaFila>
  )
}

function FilaConfirmar({ c, ahora, indice }: { c: Contraentrega; ahora: number; indice: number }) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [anulando, setAnulando] = useState(false)

  async function confirmar() {
    setOcupado(true)
    setError(null)
    const r = await confirmarContraentrega(c.pedido_id)
    if (!r.ok) {
      setError(r.error)
      setOcupado(false)
    }
  }
  async function anular(motivo: string) {
    setOcupado(true)
    const r = await anularPedido(c.pedido_id, motivo)
    if (!r.ok) {
      setError(r.error)
      setOcupado(false)
    }
  }

  return (
    <EnvolturaFila borde={BORDE.confirmar} indice={indice}>
      <ColPedido
        titulo={`#${c.numero}`}
        pastilla="Contraentrega"
        color="#B07A0F"
        sub={`${haceCuanto(new Date(c.creado_en).getTime(), ahora)} · ${c.canal}`}
      />
      <ColCliente nombre={c.cliente} telefono={c.telefono} extra={c.zona ?? c.direccion} />
      <ColPago monto={c.total} medio="efectivo" />
      <div className="flex flex-col items-end gap-2">
        {anulando ? (
          <MotivoInline
            marcador="Motivo de la anulación"
            disabled={ocupado}
            onConfirmar={anular}
            onCancelar={() => setAnulando(false)}
          />
        ) : (
          <div className="flex items-center gap-2">
            <BotonVerde onClick={confirmar} disabled={ocupado} texto="Confirmar" />
            <BotonBorde onClick={() => setAnulando(true)} disabled={ocupado} texto="Anular" />
          </div>
        )}
      </div>
      {error ? <Error texto={error} /> : null}
    </EnvolturaFila>
  )
}

function FilaCobrar({ p, indice }: { p: PorCobrar; indice: number }) {
  const [medio, setMedio] = useState<'efectivo' | 'transferencia' | 'datafono'>('efectivo')
  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cobrar() {
    setOcupado(true)
    setError(null)
    const r = await registrarCobro(p.pedido_id, medio)
    if (!r.ok) {
      setError(r.error)
      setOcupado(false)
    }
  }

  return (
    <EnvolturaFila borde={BORDE.cobrar} indice={indice}>
      <ColPedido
        titulo={p.mesa ? `Mesa ${p.mesa}` : `#${p.numero}`}
        pastilla="Servido"
        color="#116B47"
        sub="listo para cobrar"
      />
      <div className="min-w-0">
        <p className="truncate text-marca-texto">{p.mesa ? 'Mesa de salón' : 'Para recoger'}</p>
        {p.productos ? (
          <p className="truncate text-xs text-marca-texto-suave">{p.productos}</p>
        ) : null}
      </div>
      <ColPago monto={p.total} medio={medio} />
      <div className="flex flex-col items-end gap-2">
        {abierto ? (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {MEDIOS.map((m) => (
              <button
                key={m.valor}
                type="button"
                onClick={() => setMedio(m.valor)}
                aria-pressed={medio === m.valor}
                className={`min-h-9 rounded-lg border px-2 text-xs ${
                  medio === m.valor
                    ? 'border-marca-acento bg-marca-acento font-medium text-marca-acento-texto'
                    : 'border-marca-borde text-marca-texto'
                }`}
              >
                {m.nombre}
              </button>
            ))}
            <BotonNegro onClick={cobrar} disabled={ocupado} texto="Cobrar" />
          </div>
        ) : (
          <BotonNegro onClick={() => setAbierto(true)} disabled={ocupado} texto="Cobrar" />
        )}
      </div>
      {error ? <Error texto={error} /> : null}
    </EnvolturaFila>
  )
}

function ColCliente({
  nombre,
  telefono,
  extra,
}: {
  nombre: string | null
  telefono: string | null
  extra: string | null
}) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-marca-texto">{nombre ?? 'Sin nombre'}</p>
      <p className="truncate text-xs text-marca-texto-suave">
        {[telefono, extra].filter(Boolean).join(' · ') || '—'}
      </p>
    </div>
  )
}

/* Botones de acción compartidos (verde acción, borde secundario, negro/dorado). */
function BotonVerde({
  onClick,
  disabled,
  texto,
}: {
  onClick: () => void
  disabled: boolean
  texto: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-11 rounded-lg px-3.5 text-sm font-semibold text-white disabled:opacity-60"
      style={{ backgroundColor: '#1E9E6A' }}
    >
      {texto}
    </button>
  )
}

function BotonBorde({
  onClick,
  disabled,
  texto,
}: {
  onClick: () => void
  disabled: boolean
  texto: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-11 rounded-lg border border-marca-borde px-3.5 text-sm text-marca-texto-suave disabled:opacity-50"
    >
      {texto}
    </button>
  )
}

function BotonNegro({
  onClick,
  disabled,
  texto,
}: {
  onClick: () => void
  disabled: boolean
  texto: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-11 rounded-lg bg-[#0B0B0C] px-4 text-sm font-semibold text-marca-acento disabled:opacity-60"
    >
      {texto}
    </button>
  )
}

function MotivoInline({
  marcador,
  disabled,
  onConfirmar,
  onCancelar,
}: {
  marcador: string
  disabled: boolean
  onConfirmar: (motivo: string) => void
  onCancelar: () => void
}) {
  const [motivo, setMotivo] = useState('')
  return (
    <div className="flex w-full max-w-xs items-center gap-1.5">
      <input
        autoFocus
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder={marcador}
        className="min-h-11 flex-1 rounded-lg border border-marca-borde bg-marca-fondo px-2 text-sm text-marca-texto"
      />
      <button
        type="button"
        disabled={disabled || motivo.trim() === ''}
        onClick={() => onConfirmar(motivo.trim())}
        className="min-h-11 rounded-lg border border-marca-acento px-3 text-sm font-medium text-marca-acento-fuerte disabled:opacity-50"
      >
        Anular
      </button>
      <button
        type="button"
        onClick={onCancelar}
        className="min-h-11 rounded-lg px-2 text-sm text-marca-texto-suave"
      >
        No
      </button>
    </div>
  )
}

/* ---------- Notificaciones de transferencia (tipo mensaje) ---------- */

function PilaNotificaciones({
  transferencias,
  ahora,
}: {
  transferencias: Transferencia[]
  ahora: number
}) {
  if (transferencias.length === 0) return null

  return (
    <div
      aria-label="Transferencias por verificar"
      className="fixed right-4 top-4 z-50 flex max-h-[calc(100vh-2rem)] w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 overflow-y-auto"
    >
      {transferencias.map((t) => (
        <NotificacionTransferencia key={t.pedido_id} transferencia={t} ahora={ahora} />
      ))}
    </div>
  )
}

function NotificacionTransferencia({
  transferencia,
  ahora,
}: {
  transferencia: Transferencia
  ahora: number
}) {
  const [ocupado, setOcupado] = useState(false)
  const [rechazando, setRechazando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Óptimista: la notificación sale al instante; si el servidor falla, vuelve con error.
  const [oculta, setOculta] = useState(false)

  async function verificar(ok: boolean) {
    navigator.vibrate?.(15)
    setOculta(true)
    setError(null)
    const r = await verificarTransferencia(
      transferencia.pedido_id,
      ok,
      ok ? undefined : 'La transferencia no llegó al banco',
    )
    if (!r.ok) {
      setOculta(false)
      setError(r.error)
      setOcupado(false)
    }
  }

  if (oculta) return null

  return (
    <article className="notifica overflow-hidden rounded-xl bg-marca-superficie shadow-[0_8px_24px_rgba(0,0,0,0.14)]">
      {/* Franja de color arriba, como un mensaje entrante. */}
      <div aria-hidden className="h-1.5" style={{ backgroundColor: '#D99A06' }} />

      <div className="p-3.5">
        <div className="flex items-center gap-2.5">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: '#FBF1D4', color: '#7A5A0F' }}
          >
            <IconoCampana className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold leading-tight text-marca-texto">Nueva transferencia</p>
            <p className="text-xs text-marca-texto-suave">
              Pedido #{transferencia.numero} ·{' '}
              {haceCuanto(new Date(transferencia.creado_en).getTime(), ahora)}
            </p>
          </div>
        </div>

        <p
          className="mt-3 rounded-lg border border-dashed px-3 py-2 text-center"
          style={{ borderColor: '#D99A06', backgroundColor: '#FFFDF4' }}
        >
          <span className="block text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#7A5A0F' }}>
            Verifica este valor en el banco
          </span>
          <span className="block text-2xl font-bold tabular-nums" style={{ color: '#7A5A0F' }}>
            {formatearPesos(transferencia.monto_exacto)}
          </span>
        </p>

        {error ? (
          <p role="alert" className="mt-2 flex gap-1.5 text-xs text-marca-acento-fuerte">
            <IconoAlerta className="size-4 shrink-0" />
            {error}
          </p>
        ) : null}

        {rechazando ? (
          <div className="mt-3">
            <p className="text-sm font-medium text-marca-texto">
              ¿Anular el pedido #{transferencia.numero}?
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => verificar(false)}
                disabled={ocupado}
                className="min-h-11 flex-1 rounded-lg text-sm font-bold text-white disabled:opacity-60"
                style={{ backgroundColor: '#D64533' }}
              >
                Sí, anular
              </button>
              <button
                type="button"
                onClick={() => setRechazando(false)}
                disabled={ocupado}
                className="min-h-11 rounded-lg border border-marca-borde px-3 text-sm text-marca-texto-suave"
              >
                Volver
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => verificar(true)}
              disabled={ocupado}
              className="min-h-11 flex-1 rounded-lg text-sm font-bold text-white disabled:opacity-60"
              style={{ backgroundColor: '#1E9E6A' }}
            >
              {ocupado ? 'Verificando…' : 'Verifiqué'}
            </button>
            <button
              type="button"
              onClick={() => setRechazando(true)}
              disabled={ocupado}
              className="min-h-11 rounded-lg bg-marca-superficie-tenue px-3 text-sm font-medium text-marca-texto-suave"
            >
              No llegó
            </button>
          </div>
        )}
      </div>
    </article>
  )
}

function TarjetaLegalizar({ liquidacion }: { liquidacion: PorLegalizar }) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [oculto, setOculto] = useState(false)

  async function legalizar() {
    navigator.vibrate?.(15)
    setOculto(true)
    setError(null)
    const r = await legalizarDomiciliario(liquidacion.domiciliario_id)
    if (!r.ok) {
      setOculto(false)
      setError(r.error)
      setOcupado(false)
    }
  }

  if (oculto) return null

  return (
    <article className="tarjeta p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-titulo text-lg text-marca-texto">
          <IconoMoto className="size-5 text-marca-acento-fuerte" />
          {liquidacion.nombre}
        </p>
        <p className="font-titulo text-xl font-bold text-marca-acento-fuerte">
          {formatearPesos(liquidacion.total)}
        </p>
      </div>
      <p className="mt-1 text-sm text-marca-texto-suave">
        {liquidacion.pedidos} {liquidacion.pedidos === 1 ? 'entrega' : 'entregas'} en efectivo por recibir.
      </p>

      {error ? <Error texto={error} /> : null}

      <button
        type="button"
        onClick={legalizar}
        disabled={ocupado}
        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-marca-acento font-medium text-marca-acento-texto disabled:opacity-60"
      >
        <IconoCheck className="size-5" />
        Recibí {formatearPesos(liquidacion.total)}
      </button>
    </article>
  )
}

/* ---------- Turno y arqueo ---------- */

function SeccionTurno({
  turno,
  arqueo,
  onCerrado,
}: {
  turno: Turno
  arqueo: Record<string, number>
  onCerrado: (arqueo: ArqueoCierre) => void
}) {
  if (!turno) return <AbrirTurno />

  const total = Object.values(arqueo).reduce((s, v) => s + v, 0)

  return (
    <section className="tarjeta p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-titulo text-lg text-marca-texto">Turno abierto</h2>
          <p className="text-sm text-marca-texto-suave">Base: {formatearPesos(turno.base_inicial)}</p>
        </div>
        <CerrarTurno onCerrado={onCerrado} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {['efectivo', 'transferencia', 'datafono', 'pasarela'].map((m) => (
          <TarjetaMedio key={m} medio={m} monto={arqueo[m] ?? 0} />
        ))}
      </dl>
      <p className="mt-3 text-right text-sm text-marca-texto-suave">
        Ventas del turno: <span className="font-medium text-marca-texto">{formatearPesos(total)}</span>
      </p>
    </section>
  )
}

/** Tarjeta de un medio de pago: ícono con su color + nombre + monto. */
function TarjetaMedio({ medio, monto }: { medio: string; monto: number }) {
  const info = MEDIO_INFO[medio]
  return (
    <div className="rounded-xl border border-marca-borde bg-marca-superficie p-2.5">
      <dt className="flex items-center gap-1.5 text-xs text-marca-texto-suave">
        {info ? (
          <span
            aria-hidden
            className="flex size-6 items-center justify-center rounded-md"
            style={{ backgroundColor: `${info.color}1A`, color: info.color }}
          >
            <info.Icono className="size-3.5" />
          </span>
        ) : null}
        {NOMBRE_MEDIO[medio]}
      </dt>
      <dd className="mt-1.5 text-lg font-bold tabular-nums text-marca-texto">
        {formatearPesos(monto)}
      </dd>
    </div>
  )
}

function AbrirTurno() {
  const [base, setBase] = useState('200000')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function abrir() {
    setEnviando(true)
    setError(null)
    const r = await abrirTurno(Number(base) || 0)
    if (!r.ok) {
      setError(r.error)
      setEnviando(false)
    }
  }

  return (
    <section className="rounded-xl border border-marca-acento bg-marca-superficie p-4">
      <h2 className="font-titulo text-lg text-marca-texto">No hay turno abierto</h2>
      <p className="mt-1 text-sm text-marca-texto-suave">
        Abre un turno con la base en caja para poder cobrar.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-sm text-marca-texto-suave">Base inicial</span>
          <input
            inputMode="numeric"
            value={base}
            onChange={(e) => setBase(e.target.value.replace(/\D/g, ''))}
            className="mt-1 min-h-12 w-40 rounded-lg border border-marca-borde bg-marca-fondo px-3 tabular-nums text-marca-texto"
          />
        </label>
        <button
          type="button"
          onClick={abrir}
          disabled={enviando}
          className="min-h-12 rounded-lg bg-marca-acento px-5 font-medium text-marca-acento-texto disabled:opacity-60"
        >
          {enviando ? 'Abriendo…' : 'Abrir turno'}
        </button>
      </div>
      {error ? <Error texto={error} /> : null}
    </section>
  )
}

function CerrarTurno({ onCerrado }: { onCerrado: (arqueo: ArqueoCierre) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [contado, setContado] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function cerrar() {
    setEnviando(true)
    setError(null)
    const r = await cerrarTurno(Number(contado) || 0)
    if (!r.ok) {
      setError(r.error)
      setEnviando(false)
      return
    }
    // El resumen lo pinta la página; aquí solo lo reportamos hacia arriba.
    onCerrado(r.arqueo)
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="min-h-11 shrink-0 rounded-lg border border-marca-borde px-3 text-sm text-marca-texto"
      >
        Cerrar turno
      </button>
    )
  }

  return (
    <div className="w-full max-w-xs rounded-lg border border-marca-borde bg-marca-fondo p-3">
      <label className="block">
        <span className="text-sm text-marca-texto-suave">Efectivo contado</span>
        <input
          inputMode="numeric"
          autoFocus
          value={contado}
          onChange={(e) => setContado(e.target.value.replace(/\D/g, ''))}
          className="mt-1 min-h-11 w-full rounded-lg border border-marca-borde bg-marca-superficie px-3 tabular-nums text-marca-texto"
        />
      </label>
      {error ? <Error texto={error} /> : null}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={cerrar}
          disabled={enviando}
          className="min-h-11 flex-1 rounded-lg bg-marca-acento px-3 text-sm font-medium text-marca-acento-texto disabled:opacity-60"
        >
          {enviando ? 'Cerrando…' : 'Cerrar y cuadrar'}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="min-h-11 rounded-lg border border-marca-borde px-3 text-sm text-marca-texto-suave"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

function ResumenCierre({
  arqueo,
  onCerrar,
}: {
  arqueo: ArqueoCierre
  onCerrar: () => void
}) {
  const cuadra = arqueo.diferencia === 0
  return (
    <section className="rounded-xl border-2 border-marca-acento bg-marca-superficie p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-titulo text-lg text-marca-texto">Turno cerrado</h2>
        <button
          type="button"
          onClick={onCerrar}
          className="min-h-11 rounded-lg border border-marca-borde px-3 text-sm text-marca-texto-suave"
        >
          Entendido
        </button>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {['efectivo', 'transferencia', 'datafono', 'pasarela'].map((m) => (
          <TarjetaMedio key={m} medio={m} monto={arqueo.por_medio[m] ?? 0} />
        ))}
      </dl>

      <dl className="mt-3 space-y-1 border-t border-marca-borde pt-3 text-sm">
        <Fila t="Base inicial" v={formatearPesos(arqueo.base_inicial)} />
        <Fila t="Efectivo esperado" v={formatearPesos(arqueo.efectivo_esperado)} />
        <Fila t="Efectivo contado" v={formatearPesos(arqueo.efectivo_contado)} />
        <div className="flex justify-between border-t border-marca-borde pt-1 text-base">
          <dt className="text-marca-texto-suave">Diferencia</dt>
          <dd
            className={`flex items-center gap-1.5 font-bold ${
              cuadra ? 'text-marca-texto' : 'text-marca-acento-fuerte'
            }`}
          >
            {cuadra ? <IconoCheck className="size-5" /> : <IconoAlerta className="size-5" />}
            {cuadra ? 'Cuadra' : formatearPesos(arqueo.diferencia)}
          </dd>
        </div>
      </dl>
    </section>
  )
}


function Error({ texto }: { texto: string }) {
  return (
    <p role="alert" className="mt-2 flex gap-2 text-sm text-marca-acento-fuerte">
      <IconoAlerta className="size-5 shrink-0" />
      {texto}
    </p>
  )
}

function Fila({ t, v }: { t: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-marca-texto-suave">{t}</dt>
      <dd className="text-marca-texto">{v}</dd>
    </div>
  )
}
