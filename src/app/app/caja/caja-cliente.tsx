'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'

import {
  IconoAlerta,
  IconoAtras,
  IconoBillete,
  IconoCampana,
  IconoCheck,
  IconoGlobo,
  IconoImprimir,
  IconoIntercambio,
  IconoMas,
  IconoMoto,
  IconoReloj,
  IconoTarjeta,
  IconoTienda,
} from '@/components/iconos'
import { Modal } from '@/components/modal'
import {
  SelectorProductos,
  totalEstimado,
  type CategoriaElegible,
  type ProductoElegible,
  type Renglon,
} from '@/components/pedido/selector-productos'
import { useToast } from '@/components/toast'
import { Boton } from '@/components/ui/boton'
import { FichaCliente, FichaDireccion } from '@/components/ui/ficha-cliente'
import { Pildora, type TonoPildora } from '@/components/ui/pildora'
import { Vacio } from '@/components/ui/vacio'
import { MARCA } from '@/config/tema'
import { crearPedidoInterno } from '@/app/app/acciones'
import type { ArqueoMedio, Cobrado, GrupoVenta, ResumenVentas, ZonaCaja } from '@/lib/datos/caja'
import { useAviso } from '@/lib/aviso'
import { formatearPesos } from '@/lib/formato'
import { useConteo } from '@/lib/use-conteo'
import { useRefrescarEnCambios } from '@/lib/realtime'
import { haceCuanto } from '@/lib/tiempo'
import {
  abrirTurno,
  anularPedido,
  despacharDomicilio,
  quitarDomiciliario,
  cerrarTurno,
  confirmarContraentrega,
  legalizarDomiciliario,
  registrarCobro,
  registrarCobroMixto,
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
  /** El cliente lo está modificando: caja espera a que termine. */
  en_edicion: boolean
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
  /** Qué pedidos componen esa plata: el domiciliario y caja cuentan sobre lo mismo. */
  detalle: { numero: number; total: number; cliente: string | null }[]
}
/** Una entrega ya hecha cuya plata todavía no está en caja. */
export type Entregado = {
  pedido_id: string
  numero: number
  total: number
  cliente: string | null
  direccion: string | null
  zona: string | null
  entregado_en: string | null
  domiciliario_id: string | null
  domiciliario_nombre: string | null
  /** Lo que trae el domiciliario en efectivo. Con pago repartido es solo una parte. */
  efectivo: number
  /** Lo que el cliente transfiere y verifica caja: no pasa por el domiciliario. */
  transferencia: number
  /** El domiciliario avisó del cambio desde la puerta. */
  cambio_reportado: boolean
}
export type Despacho = {
  pedido_id: string
  numero: number
  /** 'listo' = cocina terminó y espera domiciliario; 'en_despacho' = ya tiene quién lo lleva. */
  estado: 'listo' | 'en_despacho'
  direccion: string | null
  zona: string | null
  nota_entrega: string | null
  total: number
  /** Se paga al entregar: el domiciliario lleva la cuenta y trae la plata. */
  contraentrega: boolean
  domiciliario_id: string | null
  domiciliario_nombre: string | null
}
export type Domiciliario = { id: string; nombre: string }

type MedioReal = 'efectivo' | 'transferencia' | 'datafono'

const MEDIOS: { valor: MedioReal; nombre: string }[] = [
  { valor: 'efectivo', nombre: 'Efectivo' },
  { valor: 'transferencia', nombre: 'Transferencia' },
  { valor: 'datafono', nombre: 'Datáfono' },
]

const NOMBRE_MEDIO: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  datafono: 'Datáfono',
  pasarela: 'Pasarela',
  mixto: 'Pago repartido',
}

/** Identidad visual de cada medio de pago: ícono + color fijo del sistema. */
const MEDIO_INFO: Record<
  string,
  { Icono: (p: { className?: string }) => React.ReactNode; color: string }
> = {
  efectivo: { Icono: IconoBillete, color: '#1D9E75' },
  transferencia: { Icono: IconoIntercambio, color: '#2E9E8F' },
  datafono: { Icono: IconoTarjeta, color: '#5B6BF0' },
  pasarela: { Icono: IconoGlobo, color: MARCA.naranja },
  mixto: { Icono: IconoIntercambio, color: '#7C3AED' },
}

type Props = {
  turno: Turno
  arqueo: Record<string, ArqueoMedio>
  ventas: ResumenVentas
  cobrados: Cobrado[]
  transferencias: Transferencia[]
  contraentregas: Contraentrega[]
  porCobrar: PorCobrar[]
  porLegalizar: PorLegalizar[]
  entregados: Entregado[]
  despachos: Despacho[]
  categorias: CategoriaElegible[]
  productos: ProductoElegible[]
  zonas: ZonaCaja[]
  servidorAhoraISO: string
  /** Monitoreo del admin: espejo sin controles. Observa, no cobra. */
  soloLectura?: boolean
}

export function CajaCliente(props: Props) {
  const {
    turno,
    arqueo,
    ventas,
    cobrados,
    transferencias,
    contraentregas,
    porCobrar,
    porLegalizar,
    entregados,
    despachos,
    categorias,
    productos,
    zonas,
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
    ...despachos.map((d) => ({ tipo: 'despachar' as const, key: d.pedido_id, despacho: d })),
    ...entregados.map((e) => ({ tipo: 'entregado' as const, key: e.pedido_id, entregado: e })),
  ]

  const conteos = {
    todos: filas.length,
    verificar: transferencias.length,
    confirmar: contraentregas.length,
    cobrar: porCobrar.length,
    despachar: despachos.length,
    entregado: entregados.length,
  }
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const visibles = filtro === 'todos' ? filas : filas.filter((f) => f.tipo === filtro)

  // Suena cuando entra un domicilio por confirmar o cuando cocina deja uno por despachar:
  // las dos cosas que caja tiene que atender sin que nadie le avise de viva voz.
  // Suena cuando entra un domicilio por confirmar, cuando cocina deja uno por despachar
  // y cuando el domiciliario entrega: las tres cosas que caja tiene que atender sin que
  // nadie le avise de viva voz.
  const aviso = useAviso(
    soloLectura ? 0 : contraentregas.length + despachos.length + entregados.length,
  )

  // La trazabilidad del turno se puede plegar, pero por defecto acompaña a la caja.
  const [verCobrados, setVerCobrados] = useState(true)
  const [tomando, setTomando] = useState(false)

  // Las cuatro que el cajero mira todo el tiempo, y el resto plegado: siete botones
  // sueltos en un celular son ruido, pero ninguno se elimina.
  const pestanas = [
    { valor: 'todos', etiqueta: 'Todos', cuenta: conteos.todos },
    { valor: 'cobrar', etiqueta: 'Por cobrar', cuenta: conteos.cobrar },
    { valor: 'confirmar', etiqueta: 'Por confirmar', cuenta: conteos.confirmar },
    { valor: 'despachar', etiqueta: 'Domicilios', cuenta: conteos.despachar },
  ] as const
  const pestanasMas = [
    { valor: 'verificar', etiqueta: 'Por verificar', cuenta: conteos.verificar },
    { valor: 'entregado', etiqueta: 'Entregados sin cobrar', cuenta: conteos.entregado },
  ] as const

  return (
    <div className="space-y-5 pb-24">
      {/* El navegador no deja sonar nada hasta que la persona toca la pantalla. */}
      {!soloLectura && !aviso.listo ? (
        <button
          type="button"
          onClick={aviso.activar}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-marca-acento bg-marca-acento/10 px-4 text-sm font-medium text-marca-texto"
        >
          <IconoCampana className="size-4 shrink-0" />
          Activar el aviso sonoro de esta caja
        </button>
      ) : null}

      {cierre ? <ResumenCierre arqueo={cierre} onCerrar={() => setCierre(null)} /> : null}

      <SeccionTurno
        turno={turno}
        arqueo={arqueo}
        onCerrado={setCierre}
        soloLectura={soloLectura}
      />

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-marca-texto">Pedidos</h2>
          {/* No todo el mundo entra al menú digital: hay quien llama o llega al mostrador. */}
          {soloLectura ? null : (
            <Boton
              variante="primario"
              className="flex items-center gap-1.5 px-3"
              onClick={() => setTomando(true)}
            >
              <IconoMas className="size-4" />
              Tomar pedido
            </Boton>
          )}
        </div>

        <FiltrosPedidos
          pestanas={pestanas}
          pestanasMas={pestanasMas}
          filtro={filtro}
          onFiltro={setFiltro}
          cobrados={turno ? cobrados.length : null}
          verCobrados={verCobrados}
          onVerCobrados={() => setVerCobrados((v) => !v)}
        />

        {/* Encabezado de columnas: solo cabe en pantalla ancha. */}
        {visibles.length > 0 ? (
          <div className="mt-4 hidden grid-cols-[1.1fr_1.3fr_0.9fr_auto] gap-3 px-3 text-xs font-semibold uppercase tracking-wider text-marca-texto-suave sm:grid">
            <span>Pedido</span>
            <span>Cliente</span>
            <span>Pago</span>
            <span className="text-right">Acción</span>
          </div>
        ) : null}

        <ul className="mt-3 space-y-2.5">
          {visibles.length === 0 ? (
            <li>
              <Vacio texto="No hay pedidos en este filtro." Icono={IconoCheck} />
            </li>
          ) : (
            visibles.map((f, i) => (
              <FilaPedido
                key={f.key}
                fila={f}
                ahora={ahora}
                indice={i}
                soloLectura={soloLectura}
              />
            ))
          )}
        </ul>
      </section>

      {tomando ? (
        <Modal titulo="Tomar pedido" onCerrar={() => setTomando(false)}>
          <FormularioTomarPedido
            categorias={categorias}
            productos={productos}
            zonas={zonas}
            onListo={() => setTomando(false)}
          />
        </Modal>
      ) : null}

      {porLegalizar.length > 0 ? (
        <section className="pt-2">
          <h2 className="mb-1 text-sm font-semibold text-marca-texto">
            Efectivo que traen los domiciliarios
          </h2>
          <p className="mb-2 text-xs text-marca-texto-suave">
            No vuelven a caja después de cada entrega: cobran en la calle y entregan todo
            junto. El turno no cierra mientras quede algo aquí.
          </p>
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

      <ResumenPagos ventas={ventas} />

      {turno && verCobrados ? (
        <CobradosHoy cobrados={cobrados} soloLectura={soloLectura} />
      ) : null}

    </div>
  )
}

type Filtro = 'todos' | 'verificar' | 'confirmar' | 'cobrar' | 'despachar' | 'entregado'
type Pestana = { valor: Filtro; etiqueta: string; cuenta: number }

/**
 * Los estados de la lista. Arriba los cuatro que el cajero mira todo el tiempo; el resto
 * —y el rastro de lo ya cobrado— detrás de "Más estados", que se abre de un toque. No se
 * pierde ningún filtro: solo dejan de competir por la pantalla.
 */
function FiltrosPedidos({
  pestanas,
  pestanasMas,
  filtro,
  onFiltro,
  cobrados,
  verCobrados,
  onVerCobrados,
}: {
  pestanas: readonly Pestana[]
  pestanasMas: readonly Pestana[]
  filtro: Filtro
  onFiltro: (f: Filtro) => void
  /** Cuántos cobros lleva el turno; null si no hay turno abierto. */
  cobrados: number | null
  verCobrados: boolean
  onVerCobrados: () => void
}) {
  // Si el filtro activo está adentro, el grupo arranca abierto: nunca se esconde
  // lo que el cajero está viendo.
  const escondido = pestanasMas.some((p) => p.valor === filtro)
  const [abierto, setAbierto] = useState(escondido)

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {pestanas.map((p) => (
          <ChipFiltro
            key={p.valor}
            etiqueta={p.etiqueta}
            cuenta={p.cuenta}
            activa={filtro === p.valor}
            onClick={() => onFiltro(p.valor)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex min-h-10 items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-marca-texto-suave"
      >
        Más estados
        <IconoAtras
          aria-hidden
          className={`size-4 transition-transform ${abierto ? 'rotate-90' : '-rotate-90'}`}
        />
      </button>

      {abierto ? (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {pestanasMas.map((p) => (
            <ChipFiltro
              key={p.valor}
              etiqueta={p.etiqueta}
              cuenta={p.cuenta}
              activa={filtro === p.valor}
              onClick={() => onFiltro(p.valor)}
            />
          ))}

          {/* No es un filtro de pendientes: enciende el rastro de lo ya cobrado. */}
          {cobrados !== null ? (
            <button
              type="button"
              onClick={onVerCobrados}
              aria-pressed={verCobrados}
              className={`flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3 text-sm font-medium ${
                verCobrados
                  ? 'border-[#1D9E75] bg-[#E7F6EE] text-[#116B47]'
                  : 'border-marca-borde text-marca-texto-suave'
              }`}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <IconoReloj className="size-4 shrink-0" />
                <span className="truncate">Cobrados hoy</span>
              </span>
              <span className="shrink-0 tabular-nums">{cobrados}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** Chip de filtro: nombre a la izquierda, cuántos a la derecha. Táctil de 44 px. */
function ChipFiltro({
  etiqueta,
  cuenta,
  activa,
  onClick,
}: {
  etiqueta: string
  cuenta: number
  activa: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3 text-sm font-medium transition-colors ${
        activa
          ? 'border-transparent bg-panel-lateral text-marca-acento'
          : 'border-marca-borde text-marca-texto-suave hover:text-marca-texto'
      }`}
    >
      <span className="min-w-0 truncate">{etiqueta}</span>
      <span
        className={`shrink-0 tabular-nums ${
          activa ? 'text-marca-acento' : cuenta > 0 ? 'text-marca-texto' : 'text-marca-texto-suave'
        }`}
      >
        {cuenta}
      </span>
    </button>
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
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 font-semibold text-marca-texto">
          <IconoReloj className="size-4 text-[#116B47]" />
          Cobros del turno
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
          {/* Buscar por pedido o cliente, y filtrar por medio. Los medios van en una
              tira que se desliza: en un celular no caben los cinco de frente. */}
          <div className="space-y-2">
            <label className="sr-only" htmlFor="buscar-cobro">
              Buscar pedido o cliente
            </label>
            <input
              id="buscar-cobro"
              type="search"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Buscar pedido o cliente"
              className="min-h-11 w-full rounded-xl border border-marca-borde bg-marca-superficie px-3 text-sm text-marca-texto placeholder:text-marca-texto-suave/60"
            />
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {['todos', 'efectivo', 'transferencia', 'datafono', 'pasarela'].map((m) => {
                const activa = medio === m
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMedio(m)}
                    aria-pressed={activa}
                    className={`min-h-10 shrink-0 rounded-full border px-3 text-xs font-medium ${
                      activa
                        ? 'border-transparent bg-panel-lateral text-marca-acento'
                        : 'border-marca-borde text-marca-texto-suave hover:text-marca-texto'
                    }`}
                  >
                    {m === 'todos' ? 'Todos' : (NOMBRE_MEDIO[m] ?? m)}
                  </button>
                )
              })}
            </div>
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

  // Dos renglones en el celular: arriba el pedido y la plata —que nunca se recorta—,
  // abajo el detalle. En pantalla ancha vuelve a ser una sola línea.
  return (
    <li
      className="entra px-3 py-2.5 transition-colors hover:bg-marca-superficie-tenue"
      style={{ '--i': Math.min(indice, 8) } as CSSProperties}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold tabular-nums text-marca-texto">
          {cobrado.numero != null ? `#${cobrado.numero}` : '—'}
        </span>
        <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums text-marca-texto">
          {formatearPesos(cobrado.monto)}
        </span>
      </div>

      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-xs">
          <span
            className="flex shrink-0 items-center gap-1 font-semibold"
            style={{ color: info?.color }}
          >
            {info ? <info.Icono className="size-4" /> : null}
            {NOMBRE_MEDIO[cobrado.medio] ?? cobrado.medio}
          </span>
          <span className="shrink-0 tabular-nums text-marca-texto-suave" suppressHydrationWarning>
            {hora}
          </span>
          <span className="min-w-0 truncate text-marca-texto-suave">{quien}</span>
        </span>

        {/* La factura que se le entrega al cliente. En monitoreo no se imprime. */}
        {soloLectura || !cobrado.pedido_id ? null : (
          <Link
            href={`/app/caja/factura/${cobrado.pedido_id}`}
            className="flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-marca-borde px-2.5 text-xs font-medium text-marca-texto-suave transition-colors hover:border-marca-acento hover:text-marca-texto"
          >
            <IconoImprimir className="size-4 shrink-0" />
            Factura
          </Link>
        )}
      </div>
    </li>
  )
}

/* ---------- Lista tipo tablero ---------- */

type FilaCaja =
  | { tipo: 'verificar'; key: string; transferencia: Transferencia }
  | { tipo: 'confirmar'; key: string; contraentrega: Contraentrega }
  | { tipo: 'cobrar'; key: string; cobro: PorCobrar }
  | { tipo: 'despachar'; key: string; despacho: Despacho }
  | { tipo: 'entregado'; key: string; entregado: Entregado }

/** Colores del borde izquierdo por estado (código de un vistazo). */
const BORDE = {
  verificar: '#D99A06', // ámbar
  confirmar: '#D99A06', // ámbar
  cobrar: '#1E9E6A', // verde
  despachar: '#2563EB', // azul: empacado, esperando quién lo lleve
  entregado: '#7C3AED', // morado: en manos del cliente, la plata todavía no
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

/** Monto y su medio. En el celular van en la misma línea; en ancho, uno bajo el otro. */
function ColPago({ monto, medio }: { monto: number; medio: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 sm:block sm:text-left">
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
  if (fila.tipo === 'despachar') {
    return (
      <FilaDespachar d={fila.despacho} indice={indice} soloLectura={soloLectura} />
    )
  }
  if (fila.tipo === 'entregado') {
    return <FilaEntregado e={fila.entregado} indice={indice} soloLectura={soloLectura} />
  }
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
        pastilla={t.en_edicion ? 'Modificando' : 'Por verificar'}
        tono={t.en_edicion ? 'azul' : 'ambar'}
        sub={`${haceCuanto(new Date(t.creado_en).getTime(), ahora)} · domicilio`}
      />
      <ColCliente nombre={t.cliente} telefono={t.telefono} extra={t.zona} />
      <ColPago monto={t.monto_exacto} medio="transferencia" />
      {soloLectura ? (
        <EstadoSoloLectura texto="Esperando verificación" />
      ) : (
        <div className="flex items-center justify-end gap-2">
          {/* También aquí: el cliente puede pedir su cuenta antes de que se verifique. */}
          <BotonCuenta pedidoId={t.pedido_id} />
          <Boton
            variante="exito"
            onClick={() => verificar(true)}
            disabled={ocupado || t.en_edicion}
          >
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
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
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
  const [medio, setMedio] = useState<MedioReal>('efectivo')
  const [abierto, setAbierto] = useState(false)
  const [propina, setPropina] = useState('')
  const [repartido, setRepartido] = useState(false)
  const [montos, setMontos] = useState<Record<MedioReal, string>>({
    efectivo: '',
    transferencia: '',
    datafono: '',
  })
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mostrar } = useToast()

  const valorPropina = Number(propina) || 0
  const aCobrar = p.total + valorPropina
  const repartidoTotal = MEDIOS.reduce((s, m) => s + (Number(montos[m.valor]) || 0), 0)
  const falta = aCobrar - repartidoTotal

  async function cobrar() {
    setOcupado(true)
    setError(null)
    const r = repartido
      ? await registrarCobroMixto(
          p.pedido_id,
          MEDIOS.map((m) => ({ medio: m.valor, monto: Number(montos[m.valor]) || 0 })),
          valorPropina,
        )
      : await registrarCobro(p.pedido_id, medio, valorPropina)
    if (!r.ok) {
      setError(r.error)
      setOcupado(false)
    } else {
      mostrar(
        valorPropina > 0
          ? `Cobrado ${formatearPesos(aCobrar)} (propina ${formatearPesos(valorPropina)})`
          : `Cobrado ${formatearPesos(aCobrar)}`,
      )
    }
  }

  /** Reparte el faltante en el medio que se toque: un toque y ya cuadra. */
  function completar(m: MedioReal) {
    const otros = MEDIOS.filter((x) => x.valor !== m).reduce(
      (s, x) => s + (Number(montos[x.valor]) || 0),
      0,
    )
    setMontos({ ...montos, [m]: String(Math.max(0, aCobrar - otros)) })
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
      <ColPago monto={aCobrar} medio={medio} />
      {soloLectura ? (
        <EstadoSoloLectura texto="Por cobrar" />
      ) : (
      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        {abierto ? (
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            {repartido ? (
              /* Una cuenta, varios medios. Cada renglón tiene un botón que le mete
                 lo que falte, para no hacer restas de cabeza frente al cliente. */
              <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
                {MEDIOS.map((m) => (
                  <div key={m.valor} className="flex items-center gap-1.5">
                    <label
                      className="w-24 text-right text-xs text-marca-texto-suave"
                      htmlFor={`m-${m.valor}-${p.pedido_id}`}
                    >
                      {m.nombre}
                    </label>
                    <input
                      id={`m-${m.valor}-${p.pedido_id}`}
                      inputMode="numeric"
                      value={montos[m.valor]}
                      onChange={(e) =>
                        setMontos({ ...montos, [m.valor]: e.target.value.replace(/\D/g, '') })
                      }
                      placeholder="0"
                      className="min-h-9 w-28 rounded-lg border border-marca-borde bg-marca-fondo px-2 text-right text-sm tabular-nums text-marca-texto"
                    />
                    <button
                      type="button"
                      onClick={() => completar(m.valor)}
                      className="min-h-9 rounded-lg border border-marca-borde px-2 text-xs text-marca-texto-suave"
                    >
                      El resto
                    </button>
                  </div>
                ))}
              </div>
            ) : (
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
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setRepartido(!repartido)}
                className="min-h-9 rounded-lg border border-marca-borde px-2 text-xs text-marca-texto-suave"
              >
                {repartido ? 'Un solo medio' : 'Dividir el pago'}
              </button>
              <Propina
                pedidoId={p.pedido_id}
                valor={propina}
                onCambiar={setPropina}
                base={p.total}
              />
              <Boton
                variante="negro"
                className="px-4"
                onClick={cobrar}
                disabled={ocupado || (repartido && falta !== 0)}
              >
                Cobrar
              </Boton>
            </div>

            {repartido ? (
              <p
                className={`text-xs font-semibold tabular-nums ${
                  falta === 0 ? 'text-[#116B47]' : 'text-marca-acento-fuerte'
                }`}
              >
                {falta === 0
                  ? `Cuadra: ${formatearPesos(aCobrar)}`
                  : falta > 0
                    ? `Faltan ${formatearPesos(falta)}`
                    : `Sobran ${formatearPesos(-falta)}`}
              </p>
            ) : null}
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

/**
 * La propina. En Colombia es voluntaria y el 10 % es lo acostumbrado, así que hay un
 * atajo para ese caso y un campo para digitar cualquier otro valor. Va vacía por defecto:
 * nunca se cobra sola, la digita caja cuando el cliente dice que sí.
 */
function Propina({
  pedidoId,
  valor,
  onCambiar,
  base,
}: {
  pedidoId: string
  valor: string
  onCambiar: (v: string) => void
  base: number
}) {
  const sugerida = Math.round((base * 0.1) / 100) * 100
  const puesta = String(sugerida) === valor

  return (
    <span className="flex items-center gap-1">
      <label className="sr-only" htmlFor={`propina-${pedidoId}`}>
        Propina
      </label>
      <input
        id={`propina-${pedidoId}`}
        inputMode="numeric"
        value={valor}
        onChange={(e) => onCambiar(e.target.value.replace(/\D/g, ''))}
        placeholder="Propina"
        className="min-h-9 w-24 rounded-lg border border-marca-borde bg-marca-fondo px-2 text-xs tabular-nums text-marca-texto"
      />
      {sugerida > 0 ? (
        <button
          type="button"
          onClick={() => onCambiar(puesta ? '' : String(sugerida))}
          aria-pressed={puesta}
          className={`min-h-9 rounded-lg border px-2 text-xs font-medium ${
            puesta
              ? 'border-marca-acento bg-marca-acento text-marca-acento-texto'
              : 'border-marca-borde text-marca-texto-suave'
          }`}
        >
          10 %
        </button>
      ) : null}
    </span>
  )
}

/**
 * Un domicilio que cocina ya terminó. Caja escoge quién lo lleva y, en el mismo acto, el
 * pedido sale a la calle: no hay pase intermedio que lo libere.
 */
function FilaDespachar({
  d,
  indice,
  soloLectura,
}: {
  d: Despacho
  indice: number
  soloLectura: boolean
}) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mostrar } = useToast()

  const enMostrador = d.estado === 'en_despacho' && d.domiciliario_id === null

  async function correr(fn: () => Promise<{ ok: boolean; error?: string }>, aviso: string) {
    setOcupado(true)
    setError(null)
    const r = await fn()
    if (!r.ok) {
      setError(r.error ?? 'No se pudo')
      setOcupado(false)
      return
    }
    mostrar(aviso)
  }

  return (
    <EnvolturaFila borde={BORDE.despachar} indice={indice}>
      <ColPedido
        titulo={`#${d.numero}`}
        pastilla={
          d.estado === 'listo' ? 'Por despachar' : enMostrador ? 'En el mostrador' : 'En la calle'
        }
        tono={d.estado === 'listo' ? 'azul' : enMostrador ? 'ambar' : 'verde'}
        sub={d.zona ? `Domicilio · ${d.zona}` : 'Domicilio'}
      />

      <div className="min-w-0">
        {/* El barrio ya lo dice el subtítulo de arriba: aquí solo la calle. */}
        <FichaDireccion direccion={d.direccion} zona={null} />
        {d.nota_entrega ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-marca-acento-fuerte">
            <IconoAlerta className="size-3.5" /> Volvió: {d.nota_entrega}
          </p>
        ) : null}
      </div>

      <div className="flex items-baseline justify-between gap-2 sm:block sm:text-left">
        <p className="text-lg font-bold text-marca-texto">{formatearPesos(d.total)}</p>
        <p className="text-xs text-marca-texto-suave">
          {d.contraentrega ? 'Cobra el domiciliario' : 'Ya está pago'}
        </p>
      </div>

      {soloLectura ? (
        <EstadoSoloLectura
          texto={d.domiciliario_nombre ?? (enMostrador ? 'En el mostrador' : 'Sin despachar')}
        />
      ) : (
        <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
          <div className="flex items-center gap-1.5">
            {/* La cuenta se imprime y se pega al pedido: es la guía del domiciliario. */}
            <BotonCuenta pedidoId={d.pedido_id} />

            {d.estado === 'listo' ? (
              /* Caja no reparte los domicilios: los suelta al mostrador y los
                 domiciliarios se organizan entre ellos con la cuenta pegada. */
              <Boton
                variante="negro"
                className="px-3"
                onClick={() =>
                  correr(() => despacharDomicilio(d.pedido_id), `Pedido #${d.numero} al mostrador`)
                }
                disabled={ocupado}
              >
                <IconoMoto className="mr-1 inline size-4" />
                Listo, a la calle
              </Boton>
            ) : enMostrador ? (
              <span className="text-sm text-marca-texto-suave">Esperando domiciliario</span>
            ) : (
              <>
                <span className="text-sm text-marca-texto">
                  Lo lleva <span className="font-medium">{d.domiciliario_nombre}</span>
                </span>
                {/* Tomó el que no era: vuelve al mostrador para que lo tome otro. */}
                <button
                  type="button"
                  onClick={() =>
                    correr(
                      () => quitarDomiciliario(d.pedido_id),
                      `Pedido #${d.numero} de vuelta al mostrador`,
                    )
                  }
                  disabled={ocupado}
                  className="min-h-11 rounded-lg border border-marca-borde px-3 text-sm text-marca-texto-suave disabled:opacity-50"
                >
                  Quitar
                </button>
              </>
            )}
          </div>
          {error ? <Error texto={error} /> : null}
        </div>
      )}
    </EnvolturaFila>
  )
}


/**
 * Una entrega que el cliente ya tiene en la mano y cuya plata todavía no está en caja.
 *
 * El domiciliario no vuelve a la caja después de cada domicilio: sale con varios, cobra
 * en la calle y entrega todo junto al final. Así que estas filas se van acumulando y son
 * la lista de lo que hay que recibirle antes de cerrar el turno.
 *
 * Si el cliente cambió de opinión en la puerta y prefirió transferir, el domiciliario lo
 * marca desde su celular y la fila cambia: esa plata no la trae él, la verifica caja.
 */
function FilaEntregado({
  e,
  indice,
  soloLectura,
}: {
  e: Entregado
  indice: number
  soloLectura: boolean
}) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mostrar } = useToast()

  const falta = e.efectivo + e.transferencia
  const repartido = e.efectivo > 0 && e.transferencia > 0

  async function verificar() {
    setOcupado(true)
    setError(null)
    const r = await verificarTransferencia(e.pedido_id, true)
    if (!r.ok) {
      setError(r.error)
      setOcupado(false)
      return
    }
    mostrar(`Transferencia del #${e.numero} verificada`)
  }

  return (
    <EnvolturaFila borde={BORDE.entregado} indice={indice}>
      <ColPedido
        titulo={`#${e.numero}`}
        pastilla={
          repartido ? 'Pago repartido' : e.transferencia > 0 ? 'Va a transferir' : 'Efectivo en la calle'
        }
        tono={e.transferencia > 0 ? 'ambar' : 'azul'}
        sub={e.domiciliario_nombre ? `Lo llevó ${e.domiciliario_nombre}` : 'Entregado'}
      />

      <div className="min-w-0">
        <ColCliente nombre={e.cliente} telefono={null} extra={e.zona} />
        {e.cambio_reportado ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-marca-acento-fuerte">
            <IconoAlerta className="size-3.5" />
            El domiciliario avisó que el cliente prefirió transferir
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-2 sm:block sm:text-left">
        <p className="text-lg font-bold text-marca-texto">{formatearPesos(falta)}</p>
        {repartido ? (
          /* Pago repartido: se dice pieza por pieza para que caja no cobre de más ni
             espere plata que no viene. */
          <p className="text-xs text-marca-texto-suave">
            {formatearPesos(e.efectivo)} con el domiciliario ·{' '}
            {formatearPesos(e.transferencia)} por transferencia
          </p>
        ) : (
          <p className="text-xs text-marca-texto-suave">
            {e.transferencia > 0 ? 'Lo cobra caja' : 'Lo trae el domiciliario'}
          </p>
        )}
      </div>

      {soloLectura ? (
        <EstadoSoloLectura texto={e.transferencia > 0 ? 'Por verificar' : 'Por recibir'} />
      ) : e.transferencia > 0 ? (
        <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
          <Boton variante="exito" className="px-4" onClick={verificar} disabled={ocupado}>
            {ocupado
              ? 'Verificando…'
              : repartido
                ? `Llegaron ${formatearPesos(e.transferencia)}`
                : 'Ya llegó la transferencia'}
          </Boton>
          {repartido ? (
            <p className="text-xs text-marca-texto-suave">
              Los {formatearPesos(e.efectivo)} en efectivo se reciben al cierre.
            </p>
          ) : null}
          {error ? <Error texto={error} /> : null}
        </div>
      ) : (
        <EstadoSoloLectura texto="Se recibe al cierre" />
      )}
    </EnvolturaFila>
  )
}

/**
 * Caja toma un pedido a mano: el cliente que llama por teléfono, el que llega al
 * mostrador y dicta, o el que no entra al menú digital. Va por el mismo camino que
 * cualquier otro pedido y los precios los pone la base.
 */
function FormularioTomarPedido({
  categorias,
  productos,
  zonas,
  onListo,
}: {
  categorias: CategoriaElegible[]
  productos: ProductoElegible[]
  zonas: ZonaCaja[]
  onListo: () => void
}) {
  const [canal, setCanal] = useState<'mostrador' | 'recoger' | 'domicilio'>('mostrador')
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [zonaId, setZonaId] = useState('')
  const [indicaciones, setIndicaciones] = useState('')
  const [medio, setMedio] = useState<'efectivo' | 'transferencia' | 'datafono'>('efectivo')
  const [renglones, setRenglones] = useState<Renglon[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mostrar } = useToast()

  const zona = zonas.find((z) => z.id === zonaId)
  const subtotal = totalEstimado(renglones, productos)
  const envio = canal === 'domicilio' ? (zona?.valor ?? 0) : 0

  // Un domicilio que toma caja se paga al entregar: el domiciliario cobra y luego
  // legaliza esa plata. Cualquier otro medio no tendría dónde cobrarse y la venta
  // quedaría fuera del arqueo, así que aquí solo hay contraentrega.
  const medioEfectivo = canal === 'domicilio' ? 'efectivo' : medio

  async function enviar() {
    setOcupado(true)
    setError(null)
    const r = await crearPedidoInterno({
      canal,
      cliente_nombre: nombre,
      cliente_tel: telefono,
      direccion: canal === 'domicilio' ? direccion : undefined,
      zona_id: canal === 'domicilio' ? zonaId : undefined,
      indicaciones,
      medio_pago: medioEfectivo,
      items: renglones,
      confirmar: true,
    })
    if (!r.ok) {
      setError(r.error)
      setOcupado(false)
      return
    }
    mostrar(`Pedido #${r.numero} en cocina · ${formatearPesos(r.total)}`)
    onListo()
  }

  const CANALES = [
    { valor: 'mostrador' as const, nombre: 'Mostrador' },
    { valor: 'recoger' as const, nombre: 'Para recoger' },
    { valor: 'domicilio' as const, nombre: 'Domicilio' },
  ]

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-marca-texto">¿Cómo lo recibe?</legend>
        <div className="flex flex-wrap gap-1.5">
          {CANALES.map((c) => (
            <button
              key={c.valor}
              type="button"
              onClick={() => setCanal(c.valor)}
              aria-pressed={canal === c.valor}
              className={`min-h-11 rounded-lg border px-3 text-sm font-medium ${
                canal === c.valor
                  ? 'border-transparent bg-marca-acento text-marca-acento-texto'
                  : 'border-marca-borde text-marca-texto-suave'
              }`}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre del cliente" valor={nombre} onCambiar={setNombre} />
        <Campo
          etiqueta="Teléfono"
          valor={telefono}
          onCambiar={(v) => setTelefono(v.replace(/[^\d+ ]/g, ''))}
        />
      </div>

      {canal === 'domicilio' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Dirección" valor={direccion} onCambiar={setDireccion} />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-marca-texto">Barrio</span>
            <select
              value={zonaId}
              onChange={(e) => setZonaId(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-2 text-sm text-marca-texto"
            >
              <option value="">Escoge el barrio</option>
              {zonas.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.nombre} · {formatearPesos(z.valor)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <SelectorProductos
        categorias={categorias}
        productos={productos}
        renglones={renglones}
        onCambiar={setRenglones}
      />

      <Campo etiqueta="Indicaciones (opcional)" valor={indicaciones} onCambiar={setIndicaciones} />

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-marca-texto">Cómo va a pagar</legend>
        {canal === 'domicilio' ? (
          <p className="rounded-lg border border-marca-borde px-3 py-2.5 text-sm text-marca-texto-suave">
            Contraentrega: el domiciliario cobra {formatearPesos(subtotal + envio)} al
            entregar y esa plata entra a la caja cuando la legalices.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {MEDIOS.map((m) => (
              <button
                key={m.valor}
                type="button"
                onClick={() => setMedio(m.valor)}
                aria-pressed={medio === m.valor}
                className={`min-h-11 rounded-lg border px-3 text-sm ${
                  medio === m.valor
                    ? 'border-transparent bg-marca-acento font-medium text-marca-acento-texto'
                    : 'border-marca-borde text-marca-texto-suave'
                }`}
              >
                {m.nombre}
              </button>
            ))}
          </div>
        )}
        {canal !== 'domicilio' ? (
          <p className="mt-1.5 text-xs text-marca-texto-suave">
            Se cobra desde “Por cobrar” cuando el pedido esté listo; ahí también va la propina.
          </p>
        ) : null}
      </fieldset>

      {error ? <Error texto={error} /> : null}

      <div className="flex items-center justify-between gap-3 border-t border-marca-borde pt-4">
        <p className="text-sm text-marca-texto-suave">
          Total{' '}
          <span className="text-base font-bold text-marca-texto">
            {formatearPesos(subtotal + envio)}
          </span>
          {envio > 0 ? ` (domicilio ${formatearPesos(envio)})` : ''}
        </p>
        <Boton
          variante="negro"
          className="px-5"
          onClick={enviar}
          disabled={ocupado || renglones.length === 0 || !nombre.trim()}
        >
          {ocupado ? 'Enviando…' : 'Mandar a cocina'}
        </Boton>
      </div>
    </div>
  )
}

function Campo({
  etiqueta,
  valor,
  onCambiar,
}: {
  etiqueta: string
  valor: string
  onCambiar: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-marca-texto">{etiqueta}</span>
      <input
        type="text"
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        className="min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 text-sm text-marca-texto"
      />
    </label>
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
        {liquidacion.pedidos} {liquidacion.pedidos === 1 ? 'entrega' : 'entregas'} en efectivo
        por recibir.
      </p>

      {/* El detalle importa: el domiciliario y caja cuentan sobre la misma lista, y si
          falta plata se ve enseguida cuál pedido es. */}
      <ul className="mt-3 divide-y divide-marca-borde border-t border-marca-borde">
        {liquidacion.detalle.map((d) => (
          <li key={d.numero} className="flex items-center justify-between gap-3 py-1.5 text-sm">
            <span className="min-w-0 truncate text-marca-texto">
              <span className="font-semibold tabular-nums">#{d.numero}</span>
              {d.cliente ? <span className="text-marca-texto-suave"> · {d.cliente}</span> : null}
            </span>
            <span className="shrink-0 tabular-nums text-marca-texto">
              {formatearPesos(d.total)}
            </span>
          </li>
        ))}
      </ul>

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
  // Lo que de verdad hay en el cajón: la base más lo cobrado en efectivo. Las
  // transferencias y el datáfono son venta del turno, pero no plata en la mano.
  const enCaja = turno.base_inicial + (arqueo.efectivo?.monto ?? 0)
  const desde = new Date(turno.abierto_en).toLocaleTimeString('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return (
    <section className="tarjeta p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-marca-texto">Estado de la caja</h2>
          <p className="mt-0.5 text-xs text-marca-texto-suave" suppressHydrationWarning>
            Desde {desde}
          </p>
        </div>
        <Pildora tono="verde">Turno abierto</Pildora>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <RenglonTurno termino="Base inicial" valor={turno.base_inicial} />
        <RenglonTurno termino="Ventas del turno" valor={total} animado />
      </dl>

      {/* El dato que el cajero busca al abrir la pantalla: cuánta plata tiene en la mano. */}
      <div className="mt-3 border-t border-marca-borde pt-3">
        <p className="text-sm text-marca-texto-suave">Efectivo en caja</p>
        <p className="mt-0.5 font-titulo text-3xl font-bold tabular-nums text-marca-texto">
          {formatearPesos(enCaja)}
        </p>
        <p className="mt-1 text-xs text-marca-texto-suave">
          Base más lo cobrado en efectivo. Transferencias y datáfono no están en el cajón.
        </p>
      </div>

      {soloLectura ? null : (
        <CerrarTurno esperado={enCaja} onCerrado={onCerrado} />
      )}
    </section>
  )
}

/** Renglón término/valor del resumen del turno: etiqueta a la izquierda, plata a la derecha. */
function RenglonTurno({
  termino,
  valor,
  animado = false,
}: {
  termino: string
  valor: number
  /** El dato que se mueve durante el turno entra con conteo; la base es fija. */
  animado?: boolean
}) {
  const mostrado = useConteo(animado ? valor : 0)
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-marca-texto-suave">{termino}</dt>
      <dd className="font-semibold tabular-nums text-marca-texto">
        {formatearPesos(animado ? mostrado : valor)}
      </dd>
    </div>
  )
}

/** Los tres bloques del resumen, con el nombre que usa el negocio. */
const GRUPO_INFO: Record<
  GrupoVenta,
  {
    titulo: string
    detalle: string
    Icono: (p: { className?: string }) => React.ReactNode
    color: string
  }
> = {
  fisicas: {
    titulo: 'Ventas físicas',
    detalle: 'En el local',
    Icono: IconoTienda,
    color: '#1D9E75',
  },
  calle: {
    titulo: 'Ventas a la calle',
    detalle: 'Domicilios',
    Icono: IconoMoto,
    color: '#2563EB',
  },
  general: {
    titulo: 'Ventas generales',
    detalle: 'Todo el turno',
    Icono: IconoBillete,
    color: MARCA.dorado,
  },
}

/** Los medios que se muestran siempre, en el orden en que se nombran en el negocio. */
const MEDIOS_RESUMEN = ['efectivo', 'datafono', 'transferencia'] as const

/**
 * El dinero del turno en tres bloques —lo que se vendió en el local, lo que salió a la
 * calle y el total— y cada uno con el mismo desglose: efectivo, datáfono y transferencia.
 * Los dos primeros suman el tercero: es la misma plata, partida por dónde se vendió.
 */
function ResumenPagos({ ventas }: { ventas: ResumenVentas }) {
  const grupos: GrupoVenta[] = ['fisicas', 'calle', 'general']

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-marca-texto">Resumen de pagos</h2>
      {grupos.map((g) => (
        <BloqueVentas key={g} grupo={g} datos={ventas[g]} />
      ))}
    </section>
  )
}

/** Un bloque: su total arriba y debajo un renglón por medio de pago. */
function BloqueVentas({
  grupo,
  datos,
}: {
  grupo: GrupoVenta
  datos: { total: number; pedidos: number; medios: Record<string, ArqueoMedio> }
}) {
  const info = GRUPO_INFO[grupo]
  const general = grupo === 'general'

  // La pasarela solo aparece si tiene plata: hoy no se usa y un renglón en cero por
  // bloque es ruido. Lo que sí se cobró nunca se esconde.
  const medios: string[] = [
    ...MEDIOS_RESUMEN,
    ...((datos.medios.pasarela?.monto ?? 0) > 0 ? ['pasarela'] : []),
  ]

  return (
    <article className={`tarjeta overflow-hidden ${general ? 'border-2 border-marca-acento' : ''}`}>
      <header className="flex items-center justify-between gap-3 px-3 py-2.5">
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${info.color}14`, color: info.color }}
          >
            <info.Icono className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-marca-texto">{info.titulo}</span>
            <span className="block truncate text-xs text-marca-texto-suave">
              {datos.pedidos} {datos.pedidos === 1 ? 'pedido' : 'pedidos'} · {info.detalle}
            </span>
          </span>
        </span>

        <span
          className={`shrink-0 whitespace-nowrap font-bold tabular-nums ${
            general ? 'font-titulo text-2xl' : 'text-lg'
          } ${datos.total === 0 ? 'text-marca-texto-suave' : 'text-marca-texto'}`}
        >
          {formatearPesos(datos.total)}
        </span>
      </header>

      <ul className="divide-y divide-marca-borde border-t border-marca-borde">
        {medios.map((m) => {
          const dato = datos.medios[m] ?? { monto: 0, pedidos: 0 }
          const vacio = dato.monto === 0
          const medio = MEDIO_INFO[m]
          return (
            <li key={m} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <span
                  aria-hidden
                  className="shrink-0"
                  style={{ color: vacio ? 'var(--marca-texto-suave)' : medio.color }}
                >
                  <medio.Icono className="size-4" />
                </span>
                <span
                  className={`truncate ${vacio ? 'text-marca-texto-suave' : 'text-marca-texto'}`}
                >
                  {NOMBRE_MEDIO[m] ?? m}
                </span>
              </span>

              <span className="flex shrink-0 items-baseline gap-3">
                <span className="text-xs tabular-nums text-marca-texto-suave">
                  {dato.pedidos} {dato.pedidos === 1 ? 'pedido' : 'pedidos'}
                </span>
                <span
                  className={`w-[5.5rem] whitespace-nowrap text-right font-semibold tabular-nums ${
                    vacio ? 'text-marca-texto-suave' : 'text-marca-texto'
                  }`}
                >
                  {formatearPesos(dato.monto)}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </article>
  )
}

/**
 * Medio de pago del turno, en versión compacta para el celular del cajero: la
 * tarjeta-indicador estándar es demasiado alta cuando van cuatro seguidas y hay que
 * seguir bajando. Mismo lenguaje —franja de color, ícono, monto, mini-dato y barra—
 * en menos alto. En cero, todo baja de tono: el medio sigue ahí, pero no compite.
 */
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
  const vacio = monto === 0
  const color = vacio ? 'var(--marca-texto-suave)' : info.color

  return (
    <article
      className="tarjeta entra overflow-hidden p-3"
      style={{ '--i': indice, opacity: vacio ? 0.7 : 1 } as CSSProperties}
    >
      <p className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: vacio ? 'var(--marca-superficie-tenue)' : `${info.color}14`, color }}
        >
          <info.Icono className="size-3.5" />
        </span>
        <span className="min-w-0 truncate text-xs font-medium text-marca-texto-suave">
          {NOMBRE_MEDIO[medio] ?? medio}
        </span>
      </p>

      <p
        className={`mt-1.5 text-lg font-bold tabular-nums ${
          vacio ? 'text-marca-texto-suave' : 'text-marca-texto'
        }`}
      >
        {formatearPesos(monto)}
      </p>

      <p className="mt-0.5 flex items-baseline justify-between gap-2 text-[11px] text-marca-texto-suave">
        <span className="min-w-0 truncate">
          {pedidos !== undefined
            ? `${pedidos} ${pedidos === 1 ? 'pedido' : 'pedidos'}`
            : 'del turno'}
        </span>
        <span className="shrink-0 font-semibold tabular-nums" style={{ color }}>
          {pct}%
        </span>
      </p>

      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-marca-superficie-tenue">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </article>
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

/**
 * Cerrar el turno. El formulario no vive abierto ocupando pantalla: es un botón que abre
 * el cuadre en una ventana, con el efectivo esperado a la vista y la diferencia calculada
 * mientras digita. La cifra que manda sigue siendo la que devuelve la base al cerrar.
 */
function CerrarTurno({
  esperado,
  onCerrado,
}: {
  /** Base + efectivo cobrado: contra esto se compara lo que el cajero cuente. */
  esperado: number
  onCerrado: (arqueo: ArqueoCierre) => void
}) {
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

  // La diferencia solo tiene sentido cuando ya contó: en blanco no es un faltante.
  const contando = contado.trim() !== ''
  const diferencia = (Number(contado) || 0) - esperado
  const tono = diferencia === 0 ? '#116B47' : diferencia > 0 ? '#0C447C' : '#9A3320'

  return (
    <>
      <Boton
        variante="primario"
        className="mt-4 w-full justify-center"
        onClick={() => setAbierto(true)}
      >
        Cerrar turno
      </Boton>

      {abierto ? (
        <Modal titulo="Cerrar turno" onCerrar={() => setAbierto(false)}>
          <dl className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-marca-texto-suave">Efectivo esperado</dt>
              <dd className="font-semibold tabular-nums text-marca-texto">
                {formatearPesos(esperado)}
              </dd>
            </div>
          </dl>

          <label className="mt-4 block">
            <span className="text-sm text-marca-texto-suave">Efectivo contado</span>
            <input
              inputMode="numeric"
              autoFocus
              value={contado}
              onChange={(e) => setContado(e.target.value.replace(/\D/g, ''))}
              placeholder="0"
              className="mt-1 min-h-12 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 text-right text-lg tabular-nums text-marca-texto"
            />
          </label>

          <p className="mt-3 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-marca-texto-suave">Diferencia</span>
            {contando ? (
              <span className="font-bold tabular-nums" style={{ color: tono }}>
                {diferencia > 0 ? '+' : ''}
                {formatearPesos(diferencia)}
              </span>
            ) : (
              <span className="text-marca-texto-suave">—</span>
            )}
          </p>

          {error ? <Error texto={error} /> : null}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="min-h-12 flex-1 rounded-lg border border-marca-borde text-sm font-medium text-marca-texto-suave"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={cerrar}
              disabled={enviando}
              className="min-h-12 flex-[2] rounded-lg bg-marca-acento text-sm font-semibold text-marca-acento-texto disabled:opacity-60"
            >
              {enviando ? 'Cerrando…' : 'Cerrar y cuadrar'}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
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
        {/* La propina entró a la caja pero no es venta: se reparte, no se factura. */}
        <Fila t="De eso, propinas" v={formatearPesos(arqueo.propinas ?? 0)} />
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
