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
  IconoTarjeta,
} from '@/components/iconos'
import { formatearPesos } from '@/lib/formato'
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
  monto_exacto: number
  creado_en: string
}
export type Contraentrega = {
  pedido_id: string
  numero: number
  canal: string
  cliente: string | null
  total: number
  direccion: string | null
}
export type PorCobrar = {
  pedido_id: string
  numero: number
  canal: string
  mesa: number | null
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

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-4 pb-24">
      {/* Transferencias por verificar: notificaciones fijas tipo mensaje, arriba a la
          derecha. No se quitan solas: solo con "Verifiqué" o "No llegó". */}
      <PilaNotificaciones transferencias={transferencias} ahora={ahora} />

      {cierre ? <ResumenCierre arqueo={cierre} onCerrar={() => setCierre(null)} /> : null}

      <div className="entra" style={{ '--i': 0 } as CSSProperties}>
        <SeccionTurno turno={turno} arqueo={arqueo} onCerrado={setCierre} />
      </div>

      <Seccion titulo="Contraentrega por confirmar" cantidad={contraentregas.length} indice={1}>
        {contraentregas.length === 0 ? (
          <Vacio texto="Nada por confirmar." />
        ) : (
          contraentregas.map((c) => <TarjetaContraentrega key={c.pedido_id} pedido={c} />)
        )}
      </Seccion>

      <Seccion titulo="Por cobrar" cantidad={porCobrar.length} indice={2}>
        {porCobrar.length === 0 ? (
          <Vacio texto="No hay nada por cobrar." />
        ) : (
          porCobrar.map((p) => <TarjetaCobro key={p.pedido_id} pedido={p} />)
        )}
      </Seccion>

      <Seccion
        titulo="Efectivo de domiciliarios por legalizar"
        cantidad={porLegalizar.length}
        indice={3}
      >
        {porLegalizar.length === 0 ? (
          <Vacio texto="Ningún domiciliario tiene efectivo por entregar." />
        ) : (
          porLegalizar.map((l) => <TarjetaLegalizar key={l.domiciliario_id} liquidacion={l} />)
        )}
      </Seccion>
    </main>
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

/* ---------- Contraentrega ---------- */

function TarjetaContraentrega({ pedido }: { pedido: Contraentrega }) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [oculto, setOculto] = useState(false)

  async function confirmar() {
    navigator.vibrate?.(15)
    setOculto(true)
    setError(null)
    const r = await confirmarContraentrega(pedido.pedido_id)
    if (!r.ok) {
      setOculto(false)
      setError(r.error)
      setOcupado(false)
    }
  }

  if (oculto) return null

  return (
    <article className="tarjeta p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-titulo text-lg text-marca-texto">Pedido #{pedido.numero}</p>
          <p className="text-sm text-marca-texto-suave">
            {pedido.cliente ?? 'Sin nombre'} · efectivo contra entrega
          </p>
          {pedido.direccion ? (
            <p className="text-sm text-marca-texto-suave">{pedido.direccion}</p>
          ) : null}
        </div>
        <p className="font-medium text-marca-acento-fuerte">{formatearPesos(pedido.total)}</p>
      </div>

      {error ? <Error texto={error} /> : null}

      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={confirmar}
          disabled={ocupado}
          className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-marca-acento font-medium text-marca-acento-texto disabled:opacity-60"
        >
          <IconoCheck className="size-5" />
          Confirmar y mandar a cocina
        </button>
        <AnularEnLinea pedidoId={pedido.pedido_id} disabled={ocupado} />
      </div>
    </article>
  )
}

/* ---------- Por cobrar ---------- */

function TarjetaCobro({ pedido }: { pedido: PorCobrar }) {
  const [medio, setMedio] = useState<'efectivo' | 'transferencia' | 'datafono'>('efectivo')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [oculto, setOculto] = useState(false)

  async function cobrar() {
    navigator.vibrate?.(15)
    setOculto(true)
    setError(null)
    const r = await registrarCobro(pedido.pedido_id, medio)
    if (!r.ok) {
      setOculto(false)
      setError(r.error)
      setOcupado(false)
    }
  }

  if (oculto) return null

  return (
    <article className="tarjeta p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-titulo text-lg text-marca-texto">
          {pedido.mesa ? `Mesa ${pedido.mesa}` : `Pedido #${pedido.numero}`}
        </p>
        <p className="font-titulo text-xl font-bold text-marca-acento-fuerte">
          {formatearPesos(pedido.total)}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {MEDIOS.map((m) => {
          const activo = medio === m.valor
          return (
            <button
              key={m.valor}
              type="button"
              onClick={() => setMedio(m.valor)}
              className={`min-h-11 rounded-lg border px-3 text-sm ${
                activo
                  ? 'border-marca-acento bg-marca-acento font-medium text-marca-acento-texto'
                  : 'border-marca-borde text-marca-texto'
              }`}
            >
              {m.nombre}
            </button>
          )
        })}
      </div>

      {error ? <Error texto={error} /> : null}

      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={cobrar}
          disabled={ocupado}
          className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-marca-acento font-medium text-marca-acento-texto disabled:opacity-60"
        >
          <IconoCheck className="size-5" />
          Cobrar {NOMBRE_MEDIO[medio]}
        </button>
        <AnularEnLinea pedidoId={pedido.pedido_id} disabled={ocupado} />
      </div>
    </article>
  )
}

/* ---------- Piezas compartidas ---------- */

function AnularEnLinea({ pedidoId, disabled }: { pedidoId: string; disabled: boolean }) {
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <AccionConMotivo
        etiqueta="Anular"
        etiquetaConfirmar="Anular pedido"
        marcador="Motivo de la anulación"
        disabled={disabled}
        onConfirmar={async (motivo) => {
          const r = await anularPedido(pedidoId, motivo)
          if (!r.ok) setError(r.error)
        }}
      />
      {error ? <Error texto={error} /> : null}
    </>
  )
}

/** Botón que se abre en un textarea de motivo antes de confirmar una acción irreversible. */
function AccionConMotivo({
  etiqueta,
  etiquetaConfirmar,
  marcador,
  disabled,
  onConfirmar,
}: {
  etiqueta: string
  etiquetaConfirmar: string
  marcador: string
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
        className="min-h-11 rounded-lg border border-marca-borde px-3 text-sm text-marca-texto-suave disabled:opacity-50"
      >
        {etiqueta}
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-marca-borde p-2">
      <textarea
        autoFocus
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder={marcador}
        rows={2}
        className="w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 py-2 text-sm text-marca-texto placeholder:text-marca-texto-suave/60"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={disabled || motivo.trim() === ''}
          onClick={() => onConfirmar(motivo.trim())}
          className="min-h-11 flex-1 rounded-lg border border-marca-acento px-3 text-sm font-medium text-marca-acento-fuerte disabled:opacity-50"
        >
          {etiquetaConfirmar}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="min-h-11 rounded-lg px-3 text-sm text-marca-texto-suave"
        >
          No
        </button>
      </div>
    </div>
  )
}

function Seccion({
  titulo,
  cantidad,
  indice = 0,
  children,
}: {
  titulo: string
  cantidad: number
  indice?: number
  children: React.ReactNode
}) {
  return (
    <section className="entra" style={{ '--i': indice } as CSSProperties}>
      <h2 className="mb-3 flex items-center gap-2 font-titulo text-lg text-marca-texto">
        {titulo}
        {cantidad > 0 ? (
          <span className="rounded-full bg-marca-acento px-2 py-0.5 text-xs font-bold text-marca-acento-texto">
            {cantidad}
          </span>
        ) : null}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Vacio({ texto }: { texto: string }) {
  return <p className="rounded-lg border border-dashed border-marca-borde p-4 text-sm text-marca-texto-suave">{texto}</p>
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
