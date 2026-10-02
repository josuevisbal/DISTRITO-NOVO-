'use client'

import { Children, createContext, useContext, useEffect, useState, type CSSProperties } from 'react'
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
  IconoMenos,
  IconoMoto,
  IconoReloj,
  IconoTarjeta,
  IconoTienda,
} from '@/components/iconos'
import { Modal } from '@/components/modal'
import { EditarPedido } from '@/components/pedido/editar-pedido'
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
  entregarEnLocal,
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
  canal: string
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
  /**
   * 'en_cocina' = se está preparando; 'listo' = cocina terminó y caja lo suelta;
   * 'en_despacho' = en el mostrador o ya tomado; 'en_camino' = va en la moto.
   */
  estado: 'en_cocina' | 'listo' | 'en_despacho' | 'en_camino'
  direccion: string | null
  zona: string | null
  nota_entrega: string | null
  total: number
  /** Se paga al entregar: el domiciliario lleva la cuenta y trae la plata. */
  contraentrega: boolean
  domiciliario_id: string | null
  domiciliario_nombre: string | null
}
/**
 * Un pedido del turno que impide cerrarlo y no cae en ninguna otra lista: el de recoger
 * que ya se pagó y quedó listo, la mesa que espera al mesero, etc.
 */
export type SinCerrar = {
  pedido_id: string
  numero: number
  canal: string
  estado: string
  mesa: number | null
  cliente: string | null
  total: number
  /** Ya tiene toda su plata verificada: solo falta entregarlo. */
  pagado: boolean
}
/** Un producto del pedido, ya juntado por nombre y nota, con el color de su estación. */
export type ProductoCaja = {
  nombre: string
  cantidad: number
  notas: string | null
  estacion: string
  color: string
  orden: number
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
  sinCerrar: SinCerrar[]
  pendientesCierre: number[]
  productosPorPedido: Record<string, ProductoCaja[]>
  categorias: CategoriaElegible[]
  productos: ProductoElegible[]
  zonas: ZonaCaja[]
  servidorAhoraISO: string
  /** Monitoreo del admin: espejo sin controles. Observa, no cobra. */
  soloLectura?: boolean
}

/** Qué lleva cada pedido: la tarjeta lo busca por su id, sin pasarlo fila por fila. */
const ProductosDe = createContext<Record<string, ProductoCaja[]>>({})

/** Abrir el editor de un pedido desde cualquier tarjeta, sin pasar la carta fila por fila. */
const AbrirEditor = createContext<(p: { id: string; numero: number }) => void>(() => {})

/**
 * Editar y anular: las acciones de ajuste de una tarjeta. Van juntas y en texto, para no
 * competir con la acción principal (cobrar, confirmar, despachar).
 */
function Ajustes({
  pedidoId,
  numero,
  onAnular,
  disabled,
}: {
  pedidoId: string
  numero: number
  onAnular: () => void
  disabled?: boolean
}) {
  const abrir = useContext(AbrirEditor)
  return (
    <span className="flex items-center gap-1">
      <BotonTexto onClick={() => abrir({ id: pedidoId, numero })} disabled={disabled}>
        Editar
      </BotonTexto>
      <BotonTexto tono="peligro" onClick={onAnular} disabled={disabled}>
        Anular
      </BotonTexto>
    </span>
  )
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
    sinCerrar,
    pendientesCierre,
    productosPorPedido,
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
    ...sinCerrar.map((x) => ({ tipo: 'sinCerrar' as const, key: x.pedido_id, sinCerrar: x })),
  ].sort((a, b) => numeroDe(a) - numeroDe(b))

  const conteos = {
    todos: filas.length,
    verificar: transferencias.length,
    confirmar: contraentregas.length,
    cobrar: porCobrar.length,
    despachar: despachos.length,
    entregado: entregados.length,
    sinCerrar: sinCerrar.length,
  }
  const [filtro, setFiltro] = useState<Filtro>('todos')
  // "Lo que falta para cerrar": exactamente los pedidos que hoy bloquean el cierre.
  const visibles =
    filtro === 'todos'
      ? filas
      : filtro === 'cierre'
        ? filas.filter((f) => pendientesCierre.includes(numeroDe(f)))
        : filas.filter((f) => f.tipo === filtro)

  // Suena cuando entra un domicilio por confirmar o cuando cocina deja uno por despachar:
  // las dos cosas que caja tiene que atender sin que nadie le avise de viva voz.
  // Suena cuando entra un domicilio por confirmar, cuando cocina deja uno por despachar
  // y cuando el domiciliario entrega: las tres cosas que caja tiene que atender sin que
  // nadie le avise de viva voz.
  const aviso = useAviso(
    soloLectura
      ? 0
      : contraentregas.length +
          despachos.length +
          // Suma otra vez los que cocina ya terminó: así suena al entrar el domicilio
          // y vuelve a sonar cuando sale de cocina y hay que soltarlo.
          despachos.filter((d) => d.estado === 'listo').length +
          entregados.length,
  )

  // La trazabilidad del turno se puede plegar, pero por defecto acompaña a la caja.
  const [verCobrados, setVerCobrados] = useState(true)
  const [tomando, setTomando] = useState(false)
  const [editando, setEditando] = useState<{ id: string; numero: number } | null>(null)

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
    { valor: 'sinCerrar', etiqueta: 'Otros sin cerrar', cuenta: conteos.sinCerrar },
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
        pendientes={pendientesCierre}
        onVerPendientes={() => {
          setFiltro('cierre')
          document.getElementById('lista-pedidos')?.scrollIntoView({ behavior: 'smooth' })
        }}
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

        {/* Vista "lo que falta para cerrar": se dice qué es y cómo volver. */}
        {filtro === 'cierre' ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border-2 border-marca-acento bg-marca-superficie px-3 py-2">
            <p className="text-sm text-marca-texto">
              {pendientesCierre.length === 0
                ? 'Ya no falta nada: puedes cerrar el turno.'
                : `Falta resolver ${pendientesCierre.length} ${
                    pendientesCierre.length === 1 ? 'pedido' : 'pedidos'
                  } para cerrar el turno.`}
            </p>
            <span className="shrink-0 whitespace-nowrap">
              <BotonTexto onClick={() => setFiltro('todos')}>Ver todos</BotonTexto>
            </span>
          </div>
        ) : null}

        {/* Leyenda de colores: la tarjeta completa dice si el pedido es del local o va a
            domicilio. El texto acompaña al color, nunca solo el color. */}
        {visibles.length > 0 ? (
          <ul aria-label="Colores de las tarjetas" className="mt-3 flex flex-wrap gap-2">
            <li className="flex items-center gap-2 rounded-full border border-tinte-local-borde bg-tinte-local px-3 py-1 text-sm text-marca-texto">
              <IconoTienda className="size-4" /> En el local
            </li>
            <li className="flex items-center gap-2 rounded-full border border-tinte-domicilio-borde bg-tinte-domicilio px-3 py-1 text-sm text-marca-texto">
              <IconoMoto className="size-4" /> Domicilio
            </li>
          </ul>
        ) : null}

        {/* Encabezado de columnas: solo cabe en pantalla ancha. */}
        {visibles.length > 0 ? (
          <div className="mt-4 hidden grid-cols-[1.1fr_1.3fr_0.9fr_auto] gap-3 px-3 text-xs font-semibold uppercase tracking-wider text-marca-texto-suave sm:grid">
            <span>Pedido</span>
            <span>Cliente</span>
            <span>Pago</span>
            <span className="text-right">Acción</span>
          </div>
        ) : null}

        <ul id="lista-pedidos" className="mt-3 scroll-mt-4 space-y-2.5">
          {visibles.length === 0 ? (
            <li>
              <Vacio texto="No hay pedidos en este filtro." Icono={IconoCheck} />
            </li>
          ) : (
            <ProductosDe.Provider value={productosPorPedido}>
            <AbrirEditor.Provider value={setEditando}>
              {visibles.map((f, i) => (
                <FilaPedido
                  key={f.key}
                  fila={f}
                  ahora={ahora}
                  indice={i}
                  soloLectura={soloLectura}
                />
              ))}
            </AbrirEditor.Provider>
            </ProductosDe.Provider>
          )}
        </ul>
      </section>

      {editando ? (
        <Modal titulo={`Editar · #${editando.numero}`} onCerrar={() => setEditando(null)}>
          <EditarPedido
            pedidoId={editando.id}
            numero={editando.numero}
            categorias={categorias}
            productos={productos}
            onListo={() => setEditando(null)}
          />
        </Modal>
      ) : null}

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

type Filtro =
  | 'todos'
  | 'verificar'
  | 'confirmar'
  | 'cobrar'
  | 'despachar'
  | 'entregado'
  | 'sinCerrar'
  | 'cierre'
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
  | { tipo: 'sinCerrar'; key: string; sinCerrar: SinCerrar }

/** Número del pedido de la fila: la lista de caja va en el orden en que llegaron. */
function numeroDe(f: FilaCaja): number {
  switch (f.tipo) {
    case 'verificar':
      return f.transferencia.numero
    case 'confirmar':
      return f.contraentrega.numero
    case 'cobrar':
      return f.cobro.numero
    case 'despachar':
      return f.despacho.numero
    case 'entregado':
      return f.entregado.numero
    case 'sinCerrar':
      return f.sinCerrar.numero
  }
}

/** Colores del borde izquierdo por estado (código de un vistazo). */
const BORDE = {
  verificar: '#D99A06', // ámbar
  confirmar: '#D99A06', // ámbar
  cobrar: '#1E9E6A', // verde
  despachar: '#2563EB', // azul: empacado, esperando quién lo lleve
  entregado: '#7C3AED', // morado: en manos del cliente, la plata todavía no
  sinCerrar: '#6B7280', // gris: quedó suelto, hay que resolverlo para cerrar
}

/**
 * La tarjeta de un pedido. Recibe SIEMPRE cuatro hijos en este orden: pedido, detalle,
 * plata y acciones. En el celular se leen como tres zonas —arriba el pedido y la plata
 * en la misma línea, luego el detalle, y abajo las acciones separadas por una raya—;
 * en pantalla ancha vuelven a ser las cuatro columnas de la tabla.
 */
/** Dónde termina el pedido: en el local (mesa, recoger, mostrador) o a domicilio. */
type Destino = 'local' | 'domicilio'

function destinoDe(canal: string): Destino {
  return canal === 'domicilio' || canal === 'whatsapp' ? 'domicilio' : 'local'
}

/** Toda la tarjeta se pinta según el destino: se distinguen de un vistazo en la lista. */
const TINTE: Record<Destino, CSSProperties> = {
  local: {
    backgroundColor: 'var(--marca-tinte-local)',
    borderColor: 'var(--marca-tinte-local-borde)',
  },
  domicilio: {
    backgroundColor: 'var(--marca-tinte-domicilio)',
    borderColor: 'var(--marca-tinte-domicilio-borde)',
  },
}

function EnvolturaFila({
  borde,
  pedidoId,
  indice,
  destino,
  resumen,
  children,
}: {
  borde: string
  pedidoId: string
  indice: number
  destino: Destino
  /** Una línea que resume la tarjeta cuando está plegada en el celular. */
  resumen?: string | null
  children: React.ReactNode
}) {
  // En el celular la tarjeta arranca PLEGADA: número, estado, plata y una línea de
  // resumen. Con muchos pedidos, ver todas abiertas era bajar y bajar. El "+" la abre;
  // en pantalla ancha no hay nada que plegar y se ve completa siempre.
  const [abierta, setAbierta] = useState(false)
  const [pedido, detalle, pago, acciones, ...resto] = Children.toArray(children)
  const productos = useContext(ProductosDe)[pedidoId] ?? []

  return (
    <li
      className="fila-pedido tarjeta tarjeta-hover entra grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 overflow-hidden p-3 pl-4 sm:grid-cols-[1.1fr_1.3fr_0.9fr_auto] sm:items-center sm:gap-3"
      style={
        { '--i': indice, ...TINTE[destino], borderLeft: `4px solid ${borde}` } as CSSProperties
      }
    >
      {pedido}

      {/* Detalle y acciones: en el celular solo cuando está abierta; en ancho, siempre.
          El detalle va antes de la plata para conservar el orden de columnas en ancho. */}
      <div className={abierta ? 'contents' : 'hidden sm:contents'}>{detalle}</div>

      {/* La plata y, solo en el celular, el botón de abrir/cerrar a su derecha. */}
      <div className="col-start-2 row-start-1 flex items-start gap-1.5 sm:contents">
        {pago}
        <button
          type="button"
          onClick={() => setAbierta((v) => !v)}
          aria-expanded={abierta}
          aria-label={abierta ? 'Ocultar detalle' : 'Ver detalle'}
          className="-mr-1 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-lg text-marca-texto-suave hover:bg-marca-superficie-tenue sm:hidden"
        >
          {abierta ? <IconoMenos className="size-5" /> : <IconoMas className="size-5" />}
        </button>
      </div>

      {!abierta && resumen ? (
        <p className="col-span-2 truncate text-sm text-marca-texto-suave sm:hidden">{resumen}</p>
      ) : null}

      <div className={abierta ? 'contents' : 'hidden sm:contents'}>
        {/* Qué lleva el pedido. En pantalla ancha va en su propia fila, debajo de las
            cuatro columnas; en el celular, entre el detalle y los botones. */}
        {productos.length > 0 ? <ListaProductos productos={productos} /> : null}
        {acciones}
        {resto}
      </div>
    </li>
  )
}

/**
 * La zona de acciones de la tarjeta. En el celular: UNA acción principal a lo ancho,
 * y debajo lo secundario —imprimir la cuenta, anular, "no llegó"— como texto, para
 * que el pulgar no tenga que escoger entre tres botones iguales. En pantalla ancha, la
 * fila compacta de siempre.
 */
/** La franja de acciones: a lo ancho y separada por una raya en el celular. */
/**
 * Los productos del pedido dentro de la tarjeta: cantidad grande, nombre, punto con el
 * color de la estación (como en cocina) y la nota debajo, en mayúscula para que no se pase.
 */
function ListaProductos({ productos }: { productos: ProductoCaja[] }) {
  const unidades = productos.reduce((s, p) => s + p.cantidad, 0)
  return (
    <div className="col-span-2 rounded-lg bg-marca-superficie/70 px-3 py-2 sm:col-span-4 sm:row-start-2">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-marca-texto-suave">
        Lleva {unidades} {unidades === 1 ? 'producto' : 'productos'}
      </p>
      <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {productos.map((p, i) => (
          <li key={i} className="min-w-0 text-sm leading-snug text-marca-texto">
            <span className="flex items-baseline gap-2">
              <span className="w-6 shrink-0 text-right font-bold tabular-nums">{p.cantidad}×</span>
              <span className="min-w-0">
                {p.nombre}
                {p.estacion ? (
                  <span
                    role="img"
                    aria-label={p.estacion}
                    title={p.estacion}
                    className="ml-1.5 inline-block size-2 -translate-y-px rounded-full align-middle"
                    style={{ backgroundColor: p.color }}
                  />
                ) : null}
              </span>
            </span>
            {p.notas ? (
              <span className="ml-8 block text-xs font-semibold uppercase text-marca-acento-fuerte">
                {p.notas}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ZonaAcciones({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-2 mt-1 border-t border-marca-borde pt-3 sm:col-span-1 sm:col-start-4 sm:row-start-1 sm:mt-0 sm:border-0 sm:pt-0">
      {children}
    </div>
  )
}

function Acciones({
  principal,
  secundaria,
  cuentaDe,
}: {
  principal: React.ReactNode
  secundaria?: React.ReactNode
  /** Pedido cuya cuenta se puede imprimir desde aquí. */
  cuentaDe?: string
}) {
  return (
    <ZonaAcciones>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        {cuentaDe ? (
          <div className="order-2 flex items-center justify-between sm:order-none sm:contents">
            <BotonCuenta pedidoId={cuentaDe} />
            {secundaria ? <div className="sm:order-last">{secundaria}</div> : null}
          </div>
        ) : secundaria ? (
          <div className="order-2 flex justify-end sm:order-last">{secundaria}</div>
        ) : null}
        <div className="order-1 flex sm:order-none [&>*]:flex-1 sm:[&>*]:flex-none">{principal}</div>
      </div>
    </ZonaAcciones>
  )
}

/** Acción secundaria en texto: no compite con la principal, pero sigue siendo táctil. */
function BotonTexto({
  children,
  onClick,
  disabled,
  tono = 'suave',
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  tono?: 'suave' | 'peligro'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 rounded-lg px-3 text-sm font-medium disabled:opacity-50 sm:border sm:border-marca-borde ${
        tono === 'peligro' ? 'text-[#9A3320]' : 'text-marca-texto-suave hover:text-marca-texto'
      }`}
    >
      {children}
    </button>
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
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-bold text-marca-texto sm:text-base">{titulo}</span>
        <Pildora tono={tono} className="whitespace-nowrap">
          {pastilla}
        </Pildora>
      </p>
      <p className="mt-0.5 flex items-center gap-1 text-xs text-marca-texto-suave">
        <IconoReloj className="size-3.5 shrink-0" />
        <span className="truncate">{sub}</span>
      </p>
    </div>
  )
}

/**
 * La plata del pedido. En el celular va arriba a la derecha, junto al número, que es
 * donde el ojo la busca; en pantalla ancha, en su propia columna.
 */
function ColPago({ monto, medio }: { monto: number; medio: string }) {
  return (
    <div className="col-start-2 row-start-1 text-right sm:col-start-auto sm:row-start-auto sm:text-left">
      <p className="whitespace-nowrap text-lg font-bold tabular-nums text-marca-texto">
        {formatearPesos(monto)}
      </p>
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
  if (fila.tipo === 'sinCerrar') {
    return <FilaSinCerrar x={fila.sinCerrar} indice={indice} soloLectura={soloLectura} />
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
    <ZonaAcciones>
      <span className="flex min-h-11 items-center justify-center rounded-lg bg-marca-superficie-tenue px-3 text-sm font-semibold text-marca-texto-suave sm:justify-end sm:bg-transparent">
        {texto}
      </span>
    </ZonaAcciones>
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
    <EnvolturaFila
      borde={BORDE.verificar}
      pedidoId={t.pedido_id}
      destino={destinoDe(t.canal)}
      indice={indice}
      resumen={[t.cliente, t.zona].filter(Boolean).join(' · ') || null}
    >
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
        <Acciones
          /* También aquí: el cliente puede pedir su cuenta antes de que se verifique. */
          cuentaDe={t.pedido_id}
          principal={
            <Boton
              variante="exito"
              className="min-h-12 sm:min-h-11"
              onClick={() => verificar(true)}
              disabled={ocupado || t.en_edicion}
            >
              <IconoCheck className="mr-1.5 inline size-4" />
              {ocupado ? 'Verificando…' : 'Verifiqué en el banco'}
            </Boton>
          }
          secundaria={
            <BotonTexto tono="peligro" onClick={() => verificar(false)} disabled={ocupado}>
              No llegó
            </BotonTexto>
          }
        />
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
    <EnvolturaFila
      borde={BORDE.confirmar}
      pedidoId={c.pedido_id}
      destino={destinoDe(c.canal)}
      indice={indice}
      resumen={[c.cliente, c.zona ?? c.direccion].filter(Boolean).join(' · ') || null}
    >
      <ColPedido
        titulo={`#${c.numero}`}
        pastilla="Nuevo"
        tono="ambar"
        sub={`${haceCuanto(new Date(c.creado_en).getTime(), ahora)} · ${c.canal}`}
      />
      <ColCliente nombre={c.cliente} telefono={c.telefono} extra={c.zona ?? c.direccion} />
      <ColPago monto={c.total} medio="efectivo" />
      {soloLectura ? (
        <EstadoSoloLectura texto="Por confirmar" />
      ) : anulando ? (
        <ZonaAcciones>
          <MotivoInline
            marcador="Motivo de la anulación"
            disabled={ocupado}
            onConfirmar={anular}
            onCancelar={() => setAnulando(false)}
          />
        </ZonaAcciones>
      ) : (
        <Acciones
          /* Contraentrega: el domiciliario se lleva la cuenta para cobrar al entregar. */
          cuentaDe={c.pedido_id}
          principal={
            <Boton
              variante="exito"
              className="min-h-12 sm:min-h-11"
              onClick={confirmar}
              disabled={ocupado}
            >
              <IconoCheck className="mr-1.5 inline size-4" />
              {ocupado ? 'Confirmando…' : 'Confirmar, a cocina'}
            </Boton>
          }
          secundaria={
            <Ajustes
              pedidoId={c.pedido_id}
              numero={c.numero}
              onAnular={() => setAnulando(true)}
              disabled={ocupado}
            />
          }
        />
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
  const [anulando, setAnulando] = useState(false)
  const { mostrar } = useToast()

  async function anular(motivo: string) {
    setOcupado(true)
    setError(null)
    const r = await anularPedido(p.pedido_id, motivo)
    if (!r.ok) {
      setError(r.error)
      setOcupado(false)
    } else {
      mostrar(`Pedido #${p.numero} anulado`)
    }
  }

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

  const titulo = p.mesa ? `Mesa ${p.mesa}` : `#${p.numero}`

  return (
    <EnvolturaFila
      borde={BORDE.cobrar}
      pedidoId={p.pedido_id}
      destino="local"
      indice={indice}
      resumen={[p.mesa ? 'Mesa de salón' : 'Para recoger', p.productos].filter(Boolean).join(' · ')}
    >
      <ColPedido
        titulo={titulo}
        pastilla="Servido"
        tono="verde"
        sub={p.mesa ? `#${p.numero} · listo para cobrar` : 'listo para cobrar'}
      />
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <p className="truncate text-marca-texto">{p.mesa ? 'Mesa de salón' : 'Para recoger'}</p>
      </div>
      <ColPago monto={p.total} medio={medio} />
      {soloLectura ? (
        <EstadoSoloLectura texto="Por cobrar" />
      ) : anulando ? (
        <ZonaAcciones>
          <MotivoInline
            marcador="Motivo de la anulación"
            disabled={ocupado}
            onConfirmar={anular}
            onCancelar={() => setAnulando(false)}
          />
        </ZonaAcciones>
      ) : (
        <Acciones
          /* "La cuenta, por favor": se imprime y el cliente la lleva a la caja. */
          cuentaDe={p.pedido_id}
          principal={
            <Boton
              variante="negro"
              className="min-h-12 sm:min-h-11"
              onClick={() => setAbierto(true)}
              disabled={ocupado}
            >
              Cobrar {formatearPesos(p.total)}
            </Boton>
          }
          secundaria={
            <Ajustes
              pedidoId={p.pedido_id}
              numero={p.numero}
              onAnular={() => setAnulando(true)}
              disabled={ocupado}
            />
          }
        />
      )}
      {error ? <Error texto={error} /> : null}

      {/* El cobro se hace en una ventana y no desplegado dentro de la tarjeta: en el
          celular, medios, propina y reparto no caben sin volverse un enredo. Aquí el
          cajero tiene una sola cosa en pantalla: esta cuenta. */}
      {abierto ? (
        <Modal titulo={`Cobrar · ${titulo}`} onCerrar={() => (ocupado ? null : setAbierto(false))}>
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-marca-texto-suave">Cuenta</span>
              <span className="font-semibold tabular-nums text-marca-texto">
                {formatearPesos(p.total)}
              </span>
            </div>

            {/* ¿Cómo paga? Un solo medio, o repartido entre varios. */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-marca-texto">
                  {repartido ? 'Repartido entre medios' : 'Medio de pago'}
                </span>
                <button
                  type="button"
                  onClick={() => setRepartido(!repartido)}
                  className="min-h-9 rounded-lg px-2 text-xs font-medium text-marca-acento-fuerte"
                >
                  {repartido ? 'Un solo medio' : 'Dividir el pago'}
                </button>
              </div>

              {repartido ? (
                /* Una cuenta, varios medios. Cada renglón tiene un botón que le mete
                   lo que falte, para no hacer restas de cabeza frente al cliente. */
                <div className="space-y-2">
                  {MEDIOS.map((m) => (
                    <div key={m.valor} className="flex items-center gap-2">
                      <label
                        className="w-24 shrink-0 text-sm text-marca-texto"
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
                        className="min-h-11 min-w-0 flex-1 rounded-lg border border-marca-borde bg-marca-fondo px-3 text-right tabular-nums text-marca-texto"
                      />
                      <button
                        type="button"
                        onClick={() => completar(m.valor)}
                        className="min-h-11 shrink-0 rounded-lg border border-marca-borde px-3 text-xs font-medium text-marca-texto-suave"
                      >
                        El resto
                      </button>
                    </div>
                  ))}
                  <p
                    className={`text-right text-sm font-semibold tabular-nums ${
                      falta === 0 ? 'text-[#116B47]' : 'text-marca-acento-fuerte'
                    }`}
                  >
                    {falta === 0
                      ? `Cuadra: ${formatearPesos(aCobrar)}`
                      : falta > 0
                        ? `Faltan ${formatearPesos(falta)}`
                        : `Sobran ${formatearPesos(-falta)}`}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {MEDIOS.map((m) => {
                    const info = MEDIO_INFO[m.valor]
                    const activo = medio === m.valor
                    return (
                      <button
                        key={m.valor}
                        type="button"
                        onClick={() => setMedio(m.valor)}
                        aria-pressed={activo}
                        className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium ${
                          activo
                            ? 'border-marca-acento bg-marca-acento/10 text-marca-texto'
                            : 'border-marca-borde text-marca-texto-suave'
                        }`}
                      >
                        <info.Icono className="size-5" />
                        {m.nombre}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* La propina, aparte de la cuenta. Nunca se cobra sola. */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-marca-texto">Propina</span>
              <Propina pedidoId={p.pedido_id} valor={propina} onCambiar={setPropina} base={p.total} />
            </div>

            <div className="flex items-baseline justify-between border-t border-marca-borde pt-3">
              <span className="text-sm text-marca-texto-suave">Total a cobrar</span>
              <span className="font-titulo text-2xl font-bold tabular-nums text-marca-texto">
                {formatearPesos(aCobrar)}
              </span>
            </div>

            {error ? <Error texto={error} /> : null}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAbierto(false)}
                disabled={ocupado}
                className="min-h-12 flex-1 rounded-lg border border-marca-borde text-sm font-medium text-marca-texto-suave disabled:opacity-50"
              >
                Cancelar
              </button>
              <Boton
                variante="negro"
                className="min-h-12 flex-[2]"
                onClick={cobrar}
                disabled={ocupado || (repartido && falta !== 0)}
              >
                {ocupado ? 'Cobrando…' : `Cobrar ${formatearPesos(aCobrar)}`}
              </Boton>
            </div>
          </div>
        </Modal>
      ) : null}
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
        className="min-h-11 w-28 rounded-lg border border-marca-borde bg-marca-fondo px-3 text-right text-sm tabular-nums text-marca-texto"
      />
      {sugerida > 0 ? (
        <button
          type="button"
          onClick={() => onCambiar(puesta ? '' : String(sugerida))}
          aria-pressed={puesta}
          className={`min-h-11 rounded-lg border px-3 text-xs font-medium ${
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
  const [anulando, setAnulando] = useState(false)
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
    <EnvolturaFila
      borde={BORDE.despachar}
      pedidoId={d.pedido_id}
      destino="domicilio"
      indice={indice}
      resumen={
        [d.domiciliario_nombre ? `Lo lleva ${d.domiciliario_nombre}` : null, d.direccion]
          .filter(Boolean)
          .join(' · ') || null
      }
    >
      <ColPedido
        titulo={`#${d.numero}`}
        pastilla={
          d.estado === 'en_cocina'
            ? 'En cocina'
            : d.estado === 'listo'
              ? 'Listo'
              : enMostrador
                ? 'En el mostrador'
                : d.estado === 'en_camino'
                  ? 'En camino'
                  : 'Tomado'
        }
        tono={
          d.estado === 'en_cocina'
            ? 'gris'
            : d.estado === 'listo'
              ? 'azul'
              : enMostrador
                ? 'ambar'
                : 'verde'
        }
        sub={d.zona ? `Domicilio · ${d.zona}` : 'Domicilio'}
      />

      <div className="col-span-2 min-w-0 sm:col-span-1">
        {/* El barrio ya lo dice el subtítulo de arriba: aquí solo la calle. */}
        <FichaDireccion direccion={d.direccion} zona={null} />
        {d.nota_entrega ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-marca-acento-fuerte">
            <IconoAlerta className="size-3.5" /> Volvió: {d.nota_entrega}
          </p>
        ) : null}
      </div>

      <div className="col-start-2 row-start-1 text-right sm:col-start-auto sm:row-start-auto sm:text-left">
        <p className="whitespace-nowrap text-lg font-bold tabular-nums text-marca-texto">
          {formatearPesos(d.total)}
        </p>
        <p className="text-xs text-marca-texto-suave">
          {d.contraentrega ? (
            /* En el celular la columna es angosta: la palabra corta deja entera la
               etiqueta de estado de la izquierda. */
            <>
              <span className="sm:hidden">Efectivo</span>
              <span className="hidden sm:inline">Cobra el domiciliario</span>
            </>
          ) : (
            'Ya está pago'
          )}
        </p>
      </div>

      {soloLectura ? (
        <EstadoSoloLectura
          texto={
            d.estado === 'en_cocina'
              ? 'En cocina'
              : (d.domiciliario_nombre ?? (enMostrador ? 'En el mostrador' : 'Sin despachar'))
          }
        />
      ) : anulando ? (
        <ZonaAcciones>
          <MotivoInline
            marcador="Motivo de la anulación"
            disabled={ocupado}
            onConfirmar={(m) =>
              correr(() => anularPedido(d.pedido_id, m), `Pedido #${d.numero} anulado`)
            }
            onCancelar={() => setAnulando(false)}
          />
        </ZonaAcciones>
      ) : d.estado === 'en_cocina' ? (
        /* Entró derecho a cocina (domicilio en efectivo). Caja ya puede imprimir la cuenta
           para tenerla lista cuando salga. */
        <Acciones
          cuentaDe={d.pedido_id}
          principal={
            <span className="flex min-h-11 items-center justify-center rounded-lg bg-marca-superficie-tenue px-3 text-sm text-marca-texto-suave sm:bg-transparent">
              Preparándose en cocina
            </span>
          }
          secundaria={
            <Ajustes
              pedidoId={d.pedido_id}
              numero={d.numero}
              onAnular={() => setAnulando(true)}
              disabled={ocupado}
            />
          }
        />
      ) : d.estado === 'en_camino' ? (
        /* Ya salió: no se le puede quitar. Si no pudo entregar, él lo reporta. */
        <Acciones
          cuentaDe={d.pedido_id}
          principal={
            <span className="flex min-h-11 items-center justify-center rounded-lg bg-marca-superficie-tenue px-3 text-sm text-marca-texto sm:bg-transparent">
              En camino con&nbsp;<span className="font-semibold">{d.domiciliario_nombre}</span>
            </span>
          }
        />
      ) : d.estado === 'listo' ? (
        /* Caja no reparte los domicilios: los suelta al mostrador y los domiciliarios se
           organizan entre ellos con la cuenta pegada. La cuenta se imprime desde aquí. */
        <Acciones
          cuentaDe={d.pedido_id}
          principal={
            <Boton
              variante="negro"
              className="min-h-12 sm:min-h-11"
              onClick={() =>
                correr(() => despacharDomicilio(d.pedido_id), `Pedido #${d.numero} al mostrador`)
              }
              disabled={ocupado}
            >
              <IconoMoto className="mr-1.5 inline size-4" />
              {ocupado ? 'Soltando…' : 'Listo, a la calle'}
            </Boton>
          }
          secundaria={
            <Ajustes
              pedidoId={d.pedido_id}
              numero={d.numero}
              onAnular={() => setAnulando(true)}
              disabled={ocupado}
            />
          }
        />
      ) : enMostrador ? (
        <Acciones
          cuentaDe={d.pedido_id}
          principal={
            <span className="flex min-h-11 items-center justify-center rounded-lg bg-marca-superficie-tenue px-3 text-sm text-marca-texto-suave sm:bg-transparent">
              Esperando domiciliario
            </span>
          }
          /* Ya salió de cocina: no se edita, pero si el cliente cancela se anula. */
          secundaria={
            <BotonTexto tono="peligro" onClick={() => setAnulando(true)} disabled={ocupado}>
              Anular
            </BotonTexto>
          }
        />
      ) : (
        <Acciones
          cuentaDe={d.pedido_id}
          principal={
            <span className="flex min-h-11 items-center justify-center rounded-lg bg-marca-superficie-tenue px-3 text-sm text-marca-texto sm:bg-transparent">
              Lo lleva&nbsp;<span className="font-semibold">{d.domiciliario_nombre}</span>
            </span>
          }
          /* Tomó el que no era: vuelve al mostrador para que lo tome otro. */
          secundaria={
            <BotonTexto
              onClick={() =>
                correr(
                  () => quitarDomiciliario(d.pedido_id),
                  `Pedido #${d.numero} de vuelta al mostrador`,
                )
              }
              disabled={ocupado}
            >
              Quitar
            </BotonTexto>
          }
        />
      )}
      {error ? <Error texto={error} /> : null}
    </EnvolturaFila>
  )
}


const ESTADO_SIN_CERRAR: Record<string, string> = {
  esperando_pago: 'Por pagar',
  pendiente: 'Nuevo',
  en_cocina: 'En cocina',
  listo: 'Listo',
  en_despacho: 'Despacho',
  en_camino: 'En camino',
}
const CANAL_SIN_CERRAR: Record<string, string> = {
  mesa: 'Mesa',
  recoger: 'Para recoger',
  mostrador: 'Mostrador',
  domicilio: 'Domicilio',
  whatsapp: 'Domicilio',
}

/**
 * Un pedido que quedó suelto y no deja cerrar el turno. Caja lo ve aquí y lo resuelve:
 * lo entrega si ya estaba pago y listo, lo confirma si nadie lo confirmó, o lo anula.
 */
function FilaSinCerrar({
  x,
  indice,
  soloLectura,
}: {
  x: SinCerrar
  indice: number
  soloLectura: boolean
}) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [anulando, setAnulando] = useState(false)
  const { mostrar } = useToast()

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

  const canal = CANAL_SIN_CERRAR[x.canal] ?? x.canal
  const titulo = x.mesa ? `Mesa ${x.mesa}` : `#${x.numero}`
  const sub = [x.mesa ? `#${x.numero}` : null, canal, x.pagado ? 'pagado' : null]
    .filter(Boolean)
    .join(' · ')
  const motivo =
    x.pagado && x.estado === 'listo'
      ? 'Ya está pago: falta entregarlo'
      : x.pagado
        ? 'Ya está pago: se está preparando'
        : x.estado === 'pendiente'
          ? 'Nadie lo ha confirmado'
          : 'Quedó sin cerrar'

  return (
    <EnvolturaFila
      borde={BORDE.sinCerrar}
      pedidoId={x.pedido_id}
      destino={destinoDe(x.canal)}
      indice={indice}
      resumen={[x.cliente, motivo].filter(Boolean).join(' · ')}
    >
      <ColPedido
        titulo={titulo}
        pastilla={ESTADO_SIN_CERRAR[x.estado] ?? x.estado}
        tono="gris"
        sub={sub}
      />
      <div className="col-span-2 min-w-0 sm:col-span-1">
        {x.cliente ? <p className="font-medium text-marca-texto">{x.cliente}</p> : null}
        <p className="text-sm text-marca-texto-suave">{motivo}</p>
      </div>
      <div className="col-start-2 row-start-1 text-right sm:col-start-auto sm:row-start-auto sm:text-left">
        <p className="whitespace-nowrap text-lg font-bold tabular-nums text-marca-texto">
          {formatearPesos(x.total)}
        </p>
        <p className="text-xs text-marca-texto-suave">{x.pagado ? 'Pagado' : 'Sin pagar'}</p>
      </div>

      {soloLectura ? (
        <EstadoSoloLectura texto={motivo} />
      ) : anulando ? (
        <ZonaAcciones>
          <MotivoInline
            marcador="Motivo de la anulación"
            disabled={ocupado}
            onConfirmar={(m) => correr(() => anularPedido(x.pedido_id, m), `Pedido #${x.numero} anulado`)}
            onCancelar={() => setAnulando(false)}
          />
        </ZonaAcciones>
      ) : x.pagado && x.estado === 'listo' ? (
        <Acciones
          cuentaDe={x.pedido_id}
          principal={
            <Boton
              variante="exito"
              className="min-h-12 sm:min-h-11"
              onClick={() =>
                correr(() => entregarEnLocal(x.pedido_id), `Pedido #${x.numero} entregado`)
              }
              disabled={ocupado}
            >
              <IconoCheck className="mr-1.5 inline size-4" />
              {ocupado ? 'Cerrando…' : 'Ya se lo llevó'}
            </Boton>
          }
        />
      ) : x.pagado ? (
        <Acciones
          cuentaDe={x.pedido_id}
          principal={
            <span className="flex min-h-11 items-center justify-center rounded-lg bg-marca-superficie-tenue px-3 text-sm text-marca-texto-suave sm:bg-transparent">
              Preparándose en cocina
            </span>
          }
        />
      ) : x.estado === 'pendiente' ? (
        <Acciones
          cuentaDe={x.pedido_id}
          principal={
            <Boton
              variante="exito"
              className="min-h-12 sm:min-h-11"
              onClick={() =>
                correr(
                  () => confirmarContraentrega(x.pedido_id),
                  `Pedido #${x.numero} confirmado, a cocina`,
                )
              }
              disabled={ocupado}
            >
              <IconoCheck className="mr-1.5 inline size-4" />
              {ocupado ? 'Confirmando…' : 'Confirmar, a cocina'}
            </Boton>
          }
          secundaria={
            <BotonTexto tono="peligro" onClick={() => setAnulando(true)} disabled={ocupado}>
              Anular
            </BotonTexto>
          }
        />
      ) : (
        <Acciones
          cuentaDe={x.pedido_id}
          principal={
            <BotonTexto tono="peligro" onClick={() => setAnulando(true)} disabled={ocupado}>
              Anular
            </BotonTexto>
          }
        />
      )}
      {error ? <Error texto={error} /> : null}
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
    <EnvolturaFila
      borde={BORDE.entregado}
      pedidoId={e.pedido_id}
      destino="domicilio"
      indice={indice}
      resumen={[e.cliente, e.zona].filter(Boolean).join(' · ') || null}
    >
      <ColPedido
        titulo={`#${e.numero}`}
        pastilla={
          repartido ? 'Pago repartido' : e.transferencia > 0 ? 'Va a transferir' : 'Por recibir'
        }
        tono={e.transferencia > 0 ? 'ambar' : 'azul'}
        sub={e.domiciliario_nombre ? `Lo llevó ${e.domiciliario_nombre}` : 'Entregado'}
      />

      <div className="col-span-2 min-w-0 sm:col-span-1">
        <ColCliente nombre={e.cliente} telefono={null} extra={e.zona} />
        {repartido ? (
          /* Pago repartido: se dice pieza por pieza para que caja no cobre de más ni
             espere plata que no viene. */
          <p className="mt-1 text-xs text-marca-texto-suave">
            {formatearPesos(e.efectivo)} con el domiciliario ·{' '}
            {formatearPesos(e.transferencia)} por transferencia
          </p>
        ) : null}
        {e.cambio_reportado ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-marca-acento-fuerte">
            <IconoAlerta className="size-3.5" />
            El domiciliario avisó que el cliente prefirió transferir
          </p>
        ) : null}
      </div>

      <div className="col-start-2 row-start-1 text-right sm:col-start-auto sm:row-start-auto sm:text-left">
        <p className="whitespace-nowrap text-lg font-bold tabular-nums text-marca-texto">
          {formatearPesos(falta)}
        </p>
        <p className="text-xs text-marca-texto-suave">
          {repartido ? (
            'Falta por entrar'
          ) : e.transferencia > 0 ? (
            'Lo cobra caja'
          ) : (
            /* Corto en el celular, para que la etiqueta de la izquierda quede entera. */
            <>
              <span className="sm:hidden">Efectivo</span>
              <span className="hidden sm:inline">Lo trae el domiciliario</span>
            </>
          )}
        </p>
      </div>

      {soloLectura ? (
        <EstadoSoloLectura texto={e.transferencia > 0 ? 'Por verificar' : 'Por recibir'} />
      ) : e.transferencia > 0 ? (
        <ZonaAcciones>
          <div className="flex flex-col gap-1.5 sm:items-end">
            <Boton
              variante="exito"
              className="min-h-12 w-full sm:min-h-11 sm:w-auto sm:px-4"
              onClick={verificar}
              disabled={ocupado}
            >
              <IconoCheck className="mr-1.5 inline size-4" />
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
        </ZonaAcciones>
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
    return <p className="col-span-2 text-sm text-marca-texto-suave sm:col-span-1">Sin datos del cliente</p>
  }
  return (
    <div className="col-span-2 min-w-0 space-y-1 sm:col-span-1">
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
    <div className="flex w-full items-center gap-1.5 sm:max-w-xs">
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
  pendientes,
  onVerPendientes,
}: {
  turno: Turno
  arqueo: Record<string, ArqueoMedio>
  onCerrado: (arqueo: ArqueoCierre) => void
  soloLectura?: boolean
  /** Números de lo que hoy impide cerrar. */
  pendientes: number[]
  onVerPendientes: () => void
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
        <CerrarTurno
          esperado={enCaja}
          onCerrado={onCerrado}
          pendientes={pendientes}
          onVerPendientes={onVerPendientes}
        />
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
  pendientes,
  onVerPendientes,
}: {
  /** Base + efectivo cobrado: contra esto se compara lo que el cajero cuente. */
  esperado: number
  onCerrado: (arqueo: ArqueoCierre) => void
  pendientes: number[]
  onVerPendientes: () => void
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
          {/* Antes de contar plata: si algo impide cerrar, se dice cuál y se lleva a él. */}
          {pendientes.length > 0 ? (
            <div role="alert" className="mb-4 rounded-lg border-2 border-marca-acento p-3">
              <p className="flex items-start gap-2 text-sm font-semibold text-marca-texto">
                <IconoAlerta className="mt-0.5 size-4 shrink-0 text-marca-acento-fuerte" />
                Todavía no se puede cerrar: {pendientes.length === 1 ? 'falta' : 'faltan'}{' '}
                {pendientes.length} {pendientes.length === 1 ? 'pedido' : 'pedidos'}.
              </p>
              <p className="mt-1 text-sm tabular-nums text-marca-texto-suave">
                {pendientes.map((n) => `#${n}`).join(', ')}
              </p>
              <Boton
                variante="secundario"
                className="mt-3 w-full justify-center"
                onClick={() => {
                  setAbierto(false)
                  onVerPendientes()
                }}
              >
                Ver esos pedidos
              </Boton>
            </div>
          ) : null}

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
              disabled={enviando || pendientes.length > 0}
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
    <p role="alert" className="col-span-2 mt-2 flex gap-2 text-sm text-marca-acento-fuerte sm:col-span-4">
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
