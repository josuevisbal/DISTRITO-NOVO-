'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'

import {
  IconoAlerta,
  IconoBillete,
  IconoCampana,
  IconoCheck,
  IconoGlobo,
  IconoImprimir,
  IconoIntercambio,
  IconoMoto,
  IconoReloj,
  IconoTarjeta,
} from '@/components/iconos'
import { useToast } from '@/components/toast'
import { Boton } from '@/components/ui/boton'
import { FichaCliente } from '@/components/ui/ficha-cliente'
import { Pildora, type TonoPildora } from '@/components/ui/pildora'
import { TarjetaKpi } from '@/components/ui/tarjeta-kpi'
import { Vacio } from '@/components/ui/vacio'
import type { ArqueoMedio, Cobrado } from '@/lib/datos/caja'
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
  efectivo: { Icono: IconoBillete, color: '#1D9E75' },
  transferencia: { Icono: IconoIntercambio, color: '#2E9E8F' },
  datafono: { Icono: IconoTarjeta, color: '#5B6BF0' },
  pasarela: { Icono: IconoGlobo, color: '#E0872B' },
}

type Props = {
  turno: Turno
  arqueo: Record<string, ArqueoMedio>
  cobrados: Cobrado[]
  transferencias: Transferencia[]
  contraentregas: Contraentrega[]
  porCobrar: PorCobrar[]
  porLegalizar: PorLegalizar[]
  servidorAhoraISO: string
  /** Monitoreo del admin: espejo sin controles. Observa, no cobra. */
  soloLectura?: boolean
}

export function CajaCliente(props: Props) {
  const {
    turno,
    arqueo,
    cobrados,
    transferencias,
    contraentregas,
    porCobrar,
    porLegalizar,
    servidorAhoraISO,
    soloLectura = false,
  } = props

  // El turno y sus movimientos también mueven esta pantalla (y la de monitoreo del
  // admin, que es la misma): abrir turno, cobrar o legalizar se ve al instante.
  useRefrescarEnCambios(['pedidos', 'caja_turnos', 'caja_movimientos'], { intervaloMs: 15000 })

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

  // La trazabilidad del turno se puede plegar, pero por defecto acompaña a la caja.
  const [verCobrados, setVerCobrados] = useState(true)

  const pestanas = [
    { valor: 'todos', etiqueta: `Todos · ${conteos.todos}` },
    { valor: 'verificar', etiqueta: `Por verificar · ${conteos.verificar}` },
    { valor: 'confirmar', etiqueta: `Por confirmar · ${conteos.confirmar}` },
    { valor: 'cobrar', etiqueta: `Por cobrar · ${conteos.cobrar}` },
  ] as const

  return (
    <div className="space-y-5 pb-24">
      {/* Las notificaciones son para actuar: en monitoreo no aparecen. */}
      {soloLectura ? null : (
        <PilaNotificaciones transferencias={transferencias} ahora={ahora} />
      )}

      {cierre ? <ResumenCierre arqueo={cierre} onCerrar={() => setCierre(null)} /> : null}

      <SeccionTurno
        turno={turno}
        arqueo={arqueo}
        onCerrado={setCierre}
        soloLectura={soloLectura}
      />

      {/* Filtros con contador. */}
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

          {/* Chip de trazabilidad: no es un filtro de pendientes, muestra lo ya cobrado. */}
          {turno ? (
            <button
              type="button"
              onClick={() => setVerCobrados((v) => !v)}
              aria-pressed={verCobrados}
              className={`flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${
                verCobrados
                  ? 'border-[#1D9E75] bg-[#E7F6EE] text-[#116B47]'
                  : 'border-marca-borde text-marca-texto-suave hover:text-marca-texto'
              }`}
            >
              <IconoReloj className="size-4" />
              Cobrados hoy · {cobrados.length}
            </button>
          ) : null}
        </div>
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
          <li>
            <Vacio texto="No hay pedidos en este filtro." Icono={IconoCheck} />
          </li>
        ) : (
          visibles.map((f, i) => (
            <FilaPedido key={f.key} fila={f} ahora={ahora} indice={i} soloLectura={soloLectura} />
          ))
        )}
      </ul>

      {turno && verCobrados ? (
        <CobradosHoy cobrados={cobrados} soloLectura={soloLectura} />
      ) : null}

      {porLegalizar.length > 0 ? (
        <section className="pt-2">
          <h2 className="mb-2 text-sm font-semibold text-marca-texto">
            Efectivo de domiciliarios por legalizar
          </h2>
          <div className="space-y-2.5">
            {porLegalizar.map((l) => (
              <TarjetaLegalizar
                key={l.domiciliario_id}
                liquidacion={l}
                soloLectura={soloLectura}
              />
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
    <p className="text-right text-sm text-marca-texto-suave">
      Ventas del turno{' '}
      <span className="text-base font-bold text-marca-texto">{formatearPesos(animado)}</span>
    </p>
  )
}

/* ---------- Cobrados hoy: trazabilidad del turno ---------- */

/**
 * Todo lo que ya entró a la caja en este turno, del más reciente al primero. Se puede
 * filtrar por medio de pago y buscar por pedido o cliente. Solo lectura: es el rastro.
 */
function CobradosHoy({
  cobrados,
  soloLectura,
}: {
  cobrados: Cobrado[]
  soloLectura: boolean
}) {
  const [buscar, setBuscar] = useState('')
  const [medio, setMedio] = useState<string>('todos')

  const total = cobrados.reduce((s, c) => s + c.monto, 0)

  const texto = buscar.trim().toLowerCase()
  const visibles = cobrados.filter((c) => {
    if (medio !== 'todos' && c.medio !== medio) return false
    if (!texto) return true
    const campos = [
      c.numero != null ? `#${c.numero}` : '',
      c.numero != null ? String(c.numero) : '',
      c.cliente ?? '',
      c.mesa != null ? `mesa ${c.mesa}` : '',
    ]
    return campos.some((v) => v.toLowerCase().includes(texto))
  })

  return (
    <section className="space-y-3 pt-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-marca-texto">
          <IconoReloj className="size-4 text-[#116B47]" />
          Cobrados hoy — trazabilidad del turno
        </h2>
        <p className="text-sm text-marca-texto-suave">
          {cobrados.length} {cobrados.length === 1 ? 'pedido' : 'pedidos'} ·{' '}
          <span className="font-bold text-marca-texto">{formatearPesos(total)}</span>
        </p>
      </div>

      {cobrados.length === 0 ? (
        <Vacio texto="Aún no se ha cobrado nada en este turno." Icono={IconoReloj} />
      ) : (
        <>
          {/* Filtrar por medio de pago y buscar por pedido o cliente. */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Buscar pedido o cliente"
              className="min-h-10 w-56 rounded-lg border border-marca-borde bg-marca-superficie px-3 text-sm text-marca-texto placeholder:text-marca-texto-suave/60"
            />
            {['todos', 'efectivo', 'transferencia', 'datafono', 'pasarela'].map((m) => {
              const activa = medio === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMedio(m)}
                  aria-pressed={activa}
                  className={`min-h-10 rounded-lg border px-2.5 text-xs font-medium ${
                    activa
                      ? 'border-transparent bg-[#0B0B0C] text-marca-acento'
                      : 'border-marca-borde text-marca-texto-suave hover:text-marca-texto'
                  }`}
                >
                  {m === 'todos' ? 'Todos' : (NOMBRE_MEDIO[m] ?? m)}
                </button>
              )
            })}
          </div>

          {visibles.length === 0 ? (
            <Vacio texto="Nada coincide con la búsqueda." Icono={IconoReloj} />
          ) : (
            <ul className="tarjeta divide-y divide-marca-borde overflow-hidden">
              {visibles.map((c, i) => (
                <FilaCobrado
                  key={c.movimiento_id}
                  cobrado={c}
                  indice={i}
                  soloLectura={soloLectura}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

function FilaCobrado({
  cobrado,
  indice,
  soloLectura,
}: {
  cobrado: Cobrado
  indice: number
  soloLectura: boolean
}) {
  const info = MEDIO_INFO[cobrado.medio]
  const hora = new Date(cobrado.cobrado_en).toLocaleTimeString('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const quien = cobrado.mesa != null ? `Mesa ${cobrado.mesa}` : (cobrado.cliente ?? '—')

  return (
    <li
      className="entra grid grid-cols-[4.5rem_1fr_auto_auto_6rem_auto] items-center gap-3 px-3 py-2.5 transition-colors hover:bg-marca-superficie-tenue"
      style={{ '--i': Math.min(indice, 8) } as CSSProperties}
    >
      <span className="font-semibold tabular-nums text-marca-texto">
        {cobrado.numero != null ? `#${cobrado.numero}` : '—'}
      </span>
      <span className="min-w-0 truncate text-sm text-marca-texto">{quien}</span>
      <span
        className="flex items-center gap-1.5 text-xs font-semibold"
        style={{ color: info?.color }}
      >
        {info ? <info.Icono className="size-4" /> : null}
        {NOMBRE_MEDIO[cobrado.medio] ?? cobrado.medio}
      </span>
      <span className="text-xs tabular-nums text-marca-texto-suave" suppressHydrationWarning>
        {hora}
      </span>
      <span className="text-right font-semibold tabular-nums text-marca-texto">
        {formatearPesos(cobrado.monto)}
      </span>

      {/* La factura que se le entrega al cliente. En monitoreo no se imprime. */}
      {soloLectura || !cobrado.pedido_id ? (
        <span />
      ) : (
        <Link
          href={`/app/caja/factura/${cobrado.pedido_id}`}
          className="flex min-h-9 items-center gap-1 rounded-lg border border-marca-borde px-2.5 text-xs font-medium text-marca-texto-suave transition-colors hover:border-marca-acento hover:text-marca-texto"
        >
          <IconoImprimir className="size-4 shrink-0" />
          Factura
        </Link>
      )}
    </li>
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
  tono,
  sub,
}: {
  titulo: string
  pastilla: string
  tono: TonoPildora
  sub: string
}) {
  return (
    <div>
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-marca-texto">{titulo}</span>
        <Pildora tono={tono}>{pastilla}</Pildora>
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

function FilaPedido({
  fila,
  ahora,
  indice,
  soloLectura,
}: {
  fila: FilaCaja
  ahora: number
  indice: number
  soloLectura: boolean
}) {
  if (fila.tipo === 'verificar') {
    return (
      <FilaVerificar
        t={fila.transferencia}
        ahora={ahora}
        indice={indice}
        soloLectura={soloLectura}
      />
    )
  }
  if (fila.tipo === 'confirmar') {
    return (
      <FilaConfirmar
        c={fila.contraentrega}
        ahora={ahora}
        indice={indice}
        soloLectura={soloLectura}
      />
    )
  }
  return <FilaCobrar p={fila.cobro} indice={indice} soloLectura={soloLectura} />
}

/**
 * La cuenta que se entrega ANTES de pagar: el mesero la lleva a la mesa cuando piden la
 * cuenta, y el domiciliario la lleva en una contraentrega. Sale marcada como pendiente
 * de pago, para que no se confunda con la factura ya cobrada.
 */
function BotonCuenta({ pedidoId }: { pedidoId: string }) {
  return (
    <Link
      href={`/app/caja/factura/${pedidoId}`}
      className="flex min-h-11 items-center gap-1 rounded-lg border border-marca-borde px-2.5 text-xs font-medium text-marca-texto-suave transition-colors hover:border-marca-acento hover:text-marca-texto"
    >
      <IconoImprimir className="size-4 shrink-0" />
      Cuenta
    </Link>
  )
}

/** En monitoreo, donde iría el botón va el estado en texto. */
function EstadoSoloLectura({ texto }: { texto: string }) {
  return (
    <div className="flex justify-end">
      <span className="min-h-11 rounded-lg px-4 text-sm font-semibold text-marca-texto-suave">
        {texto}
      </span>
    </div>
  )
}

function FilaVerificar({
  t,
  ahora,
  indice,
  soloLectura,
}: {
  t: Transferencia
  ahora: number
  indice: number
  soloLectura: boolean
}) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mostrar } = useToast()

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
    } else {
      mostrar(ok ? `Pedido #${t.numero} verificado, a cocina` : `Pedido #${t.numero} anulado`)
    }
  }

  return (
    <EnvolturaFila borde={BORDE.verificar} indice={indice}>
      <ColPedido
        titulo={`#${t.numero}`}
        pastilla="Por verificar"
        tono="ambar"
        sub={`${haceCuanto(new Date(t.creado_en).getTime(), ahora)} · domicilio`}
      />
      <ColCliente nombre={t.cliente} telefono={t.telefono} extra={t.zona} />
      <ColPago monto={t.monto_exacto} medio="transferencia" />
      {soloLectura ? (
        <EstadoSoloLectura texto="Esperando verificación" />
      ) : (
        <div className="flex items-center justify-end gap-2">
          <Boton variante="exito" onClick={() => verificar(true)} disabled={ocupado}>
            Verifiqué
          </Boton>
          <Boton variante="secundario" onClick={() => verificar(false)} disabled={ocupado}>
            No llegó
          </Boton>
        </div>
      )}
      {error ? <Error texto={error} /> : null}
    </EnvolturaFila>
  )
}

function FilaConfirmar({
  c,
  ahora,
  indice,
  soloLectura,
}: {
  c: Contraentrega
  ahora: number
  indice: number
  soloLectura: boolean
}) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [anulando, setAnulando] = useState(false)
  const { mostrar } = useToast()

  async function confirmar() {
    setOcupado(true)
    setError(null)
    const r = await confirmarContraentrega(c.pedido_id)
    if (!r.ok) {
      setError(r.error)
      setOcupado(false)
    } else {
      mostrar(`Pedido #${c.numero} confirmado, a cocina`)
    }
  }
  async function anular(motivo: string) {
    setOcupado(true)
    const r = await anularPedido(c.pedido_id, motivo)
    if (!r.ok) {
      setError(r.error)
      setOcupado(false)
    } else {
      mostrar(`Pedido #${c.numero} anulado`)
    }
  }

  return (
    <EnvolturaFila borde={BORDE.confirmar} indice={indice}>
      <ColPedido
        titulo={`#${c.numero}`}
        pastilla="Contraentrega"
        tono="ambar"
        sub={`${haceCuanto(new Date(c.creado_en).getTime(), ahora)} · ${c.canal}`}
      />
      <ColCliente nombre={c.cliente} telefono={c.telefono} extra={c.zona ?? c.direccion} />
      <ColPago monto={c.total} medio="efectivo" />
      {soloLectura ? (
        <EstadoSoloLectura texto="Por confirmar" />
      ) : (
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
              {/* Contraentrega: el domiciliario se lleva la cuenta para cobrar al entregar. */}
              <BotonCuenta pedidoId={c.pedido_id} />
              <Boton variante="exito" onClick={confirmar} disabled={ocupado}>
                Confirmar
              </Boton>
              <Boton variante="secundario" onClick={() => setAnulando(true)} disabled={ocupado}>
                Anular
              </Boton>
            </div>
          )}
        </div>
      )}
      {error ? <Error texto={error} /> : null}
    </EnvolturaFila>
  )
}

function FilaCobrar({
  p,
  indice,
  soloLectura,
}: {
  p: PorCobrar
  indice: number
  soloLectura: boolean
}) {
  const [medio, setMedio] = useState<'efectivo' | 'transferencia' | 'datafono'>('efectivo')
  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mostrar } = useToast()

  async function cobrar() {
    setOcupado(true)
    setError(null)
    const r = await registrarCobro(p.pedido_id, medio)
    if (!r.ok) {
      setError(r.error)
      setOcupado(false)
    } else {
      mostrar(`Cobrado ${formatearPesos(p.total)} · ${NOMBRE_MEDIO[medio]}`)
    }
  }

  return (
    <EnvolturaFila borde={BORDE.cobrar} indice={indice}>
      <ColPedido
        titulo={p.mesa ? `Mesa ${p.mesa}` : `#${p.numero}`}
        pastilla="Servido"
        tono="verde"
        sub="listo para cobrar"
      />
      <div className="min-w-0">
        <p className="truncate text-marca-texto">{p.mesa ? 'Mesa de salón' : 'Para recoger'}</p>
        {p.productos ? (
          <p className="truncate text-xs text-marca-texto-suave">{p.productos}</p>
        ) : null}
      </div>
      <ColPago monto={p.total} medio={medio} />
      {soloLectura ? (
        <EstadoSoloLectura texto="Por cobrar" />
      ) : (
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
            <Boton variante="negro" className="px-4" onClick={cobrar} disabled={ocupado}>
              Cobrar
            </Boton>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {/* "La cuenta, por favor": se imprime y el cliente la lleva a la caja. */}
            <BotonCuenta pedidoId={p.pedido_id} />
            <Boton
              variante="negro"
              className="px-4"
              onClick={() => setAbierto(true)}
              disabled={ocupado}
            >
              Cobrar
            </Boton>
          </div>
        )}
      </div>
      )}
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
  if (!nombre && !telefono) {
    return <p className="text-sm text-marca-texto-suave">Sin datos del cliente</p>
  }
  return (
    <div className="min-w-0 space-y-1">
      <FichaCliente nombre={nombre} telefono={telefono} />
      {extra ? <p className="truncate text-xs text-marca-texto-suave">{extra}</p> : null}
    </div>
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

function TarjetaLegalizar({
  liquidacion,
  soloLectura = false,
}: {
  liquidacion: PorLegalizar
  soloLectura?: boolean
}) {
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

      {soloLectura ? null : (
        <button
          type="button"
          onClick={legalizar}
          disabled={ocupado}
          className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-marca-acento font-medium text-marca-acento-texto disabled:opacity-60"
        >
          <IconoCheck className="size-5" />
          Recibí {formatearPesos(liquidacion.total)}
        </button>
      )}
    </article>
  )
}

/* ---------- Turno y arqueo ---------- */

function SeccionTurno({
  turno,
  arqueo,
  onCerrado,
  soloLectura = false,
}: {
  turno: Turno
  arqueo: Record<string, ArqueoMedio>
  onCerrado: (arqueo: ArqueoCierre) => void
  soloLectura?: boolean
}) {
  if (!turno) {
    return soloLectura ? (
      <Vacio texto="El cajero aún no ha abierto turno." Icono={IconoReloj} />
    ) : (
      <AbrirTurno />
    )
  }

  const total = Object.values(arqueo).reduce((s, v) => s + v.monto, 0)
  const desde = new Date(turno.abierto_en).toLocaleTimeString('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-marca-texto">Turno abierto</h2>
          <p className="text-sm text-marca-texto-suave" suppressHydrationWarning>
            Base: {formatearPesos(turno.base_inicial)} · desde {desde}
          </p>
        </div>
        {soloLectura ? null : <CerrarTurno onCerrado={onCerrado} />}
      </div>

      {/* Los cuatro medios con la tarjeta-indicador estándar: la composición del día de un vistazo. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {['efectivo', 'transferencia', 'datafono', 'pasarela'].map((m, i) => (
          <TarjetaMedioPago
            key={m}
            medio={m}
            monto={arqueo[m]?.monto ?? 0}
            pedidos={arqueo[m]?.pedidos ?? 0}
            total={total}
            indice={i}
          />
        ))}
      </div>

      <VentasTurno total={total} />
    </section>
  )
}

/** Medio de pago con la tarjeta-KPI estándar: monto, pedidos y % del turno con barra. */
function TarjetaMedioPago({
  medio,
  monto,
  pedidos,
  total,
  indice,
}: {
  medio: string
  monto: number
  /** Si no se conoce (cierre del turno), el mini-dato dice solo el % del total. */
  pedidos?: number
  total: number
  indice: number
}) {
  const info = MEDIO_INFO[medio]
  const pct = total > 0 ? Math.round((monto / total) * 100) : 0
  return (
    <TarjetaKpi
      titulo={NOMBRE_MEDIO[medio] ?? medio}
      valor={monto}
      dinero
      color={info.color}
      Icono={info.Icono}
      sub={{
        texto:
          pedidos !== undefined
            ? `${pedidos} ${pedidos === 1 ? 'pedido' : 'pedidos'}`
            : 'del total del turno',
        porcentaje: pct,
      }}
      indice={indice}
    />
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
  const totalCierre = Object.values(arqueo.por_medio).reduce((s, v) => s + v, 0)
  return (
    <section className="rounded-xl border-2 border-marca-acento bg-marca-superficie p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-bold text-marca-texto">Turno cerrado</h2>
        <Boton variante="secundario" onClick={onCerrar}>
          Entendido
        </Boton>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {['efectivo', 'transferencia', 'datafono', 'pasarela'].map((m, i) => (
          <TarjetaMedioPago
            key={m}
            medio={m}
            monto={arqueo.por_medio[m] ?? 0}
            total={totalCierre}
            indice={i}
          />
        ))}
      </div>

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
