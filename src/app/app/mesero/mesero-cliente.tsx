'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import {
  IconoAlerta,
  IconoCampana,
  IconoCheck,
  IconoMas,
  IconoReloj,
  IconoSilla,
} from '@/components/iconos'
import { Modal } from '@/components/modal'
import {
  SelectorProductos,
  totalEstimado,
  type Renglon,
} from '@/components/pedido/selector-productos'
import { useToast } from '@/components/toast'
import { Boton } from '@/components/ui/boton'
import { Pildora, type TonoPildora } from '@/components/ui/pildora'
import { Vacio } from '@/components/ui/vacio'
import { useAviso } from '@/lib/aviso'
import type { BarraEstacion, DatosMesero, PedidoMesa } from '@/lib/datos/mesero'
import { formatearPesos } from '@/lib/formato'
import { useRefrescarEnCambios } from '@/lib/realtime'
import { haceCuanto } from '@/lib/tiempo'
import {
  agregarACuenta,
  confirmarPedido,
  crearPedidoInterno,
  marcarServido,
} from '../acciones'

/** Colores del borde izquierdo por situación (código de un vistazo). */
const BORDE = {
  confirmar: '#D99A06', // ámbar: el cliente pidió y espera
  cocina: '#2563EB', // azul: en marcha
  listo: '#1E9E6A', // verde: hay que ir por él
}

type Pestana = 'confirmar' | 'cocina' | 'listos' | 'cuentas'

export function MeseroCliente({
  datos,
  servidorAhoraISO,
  soloLectura = false,
}: {
  datos: DatosMesero
  servidorAhoraISO: string
  /** Monitoreo del admin: espejo sin controles. Observa, no opera. */
  soloLectura?: boolean
}) {
  const { porConfirmar, enCocina, listos, cuentas, mesas, categorias, productos } = datos

  // Reloj corregido con el desfase del servidor, para los "hace 3 min" de cada tarjeta.
  const [ahora, setAhora] = useState(() => new Date(servidorAhoraISO).getTime())
  useEffect(() => {
    const desfase = new Date(servidorAhoraISO).getTime() - Date.now()
    const id = setInterval(() => setAhora(Date.now() + desfase), 30000)
    return () => clearInterval(id)
  }, [servidorAhoraISO])

  // Pedidos nuevos y cambios de cocina llegan en vivo; el intervalo es la red de
  // seguridad por si Realtime se cae en una tablet con mala señal.
  useRefrescarEnCambios(['pedidos', 'comandas'], { intervaloMs: 15000 })

  // Dos avisos distintos, porque son dos trabajos distintos: uno cuando la mesa pide y
  // otro cuando cocina termina y hay que ir a buscar el plato.
  const avisoNuevos = useAviso(soloLectura ? 0 : porConfirmar.length)
  const avisoListos = useAviso(soloLectura ? 0 : listos.length)
  const sonidoPendiente = !soloLectura && !avisoNuevos.listo

  const [pestana, setPestana] = useState<Pestana>('confirmar')
  const [tomando, setTomando] = useState(false)
  const [cuenta, setCuenta] = useState<PedidoMesa | null>(null)

  const pestanas: { valor: Pestana; etiqueta: string; n: number }[] = [
    { valor: 'confirmar', etiqueta: 'Por confirmar', n: porConfirmar.length },
    { valor: 'cocina', etiqueta: 'En cocina', n: enCocina.length },
    { valor: 'listos', etiqueta: 'Por llevar', n: listos.length },
    { valor: 'cuentas', etiqueta: 'Cuentas abiertas', n: cuentas.length },
  ]

  const visibles =
    pestana === 'confirmar'
      ? porConfirmar
      : pestana === 'cocina'
        ? enCocina
        : pestana === 'listos'
          ? listos
          : cuentas

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 pb-24">
      {/* El navegador no deja sonar nada hasta que la persona toca la pantalla. */}
      {sonidoPendiente ? (
        <button
          type="button"
          onClick={avisoNuevos.activar}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-marca-acento bg-marca-acento/10 px-4 text-sm font-medium text-marca-texto"
        >
          <IconoCampana className="size-4 shrink-0" />
          Activar el aviso sonoro de esta tablet
        </button>
      ) : null}

      {listos.length > 0 && pestana !== 'listos' ? (
        <button
          type="button"
          onClick={() => setPestana('listos')}
          className="flex min-h-12 w-full items-center gap-2 rounded-xl border-l-4 bg-[#E1F5EE] px-4 text-sm font-semibold text-[#0F6E56]"
          style={{ borderLeftColor: BORDE.listo }}
        >
          <IconoCheck className="size-5 shrink-0" />
          {listos.length === 1
            ? 'Hay 1 pedido listo por llevar a la mesa'
            : `Hay ${listos.length} pedidos listos por llevar a la mesa`}
        </button>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {pestanas.map((p) => {
            const activa = pestana === p.valor
            return (
              <button
                key={p.valor}
                type="button"
                onClick={() => setPestana(p.valor)}
                aria-pressed={activa}
                className={`min-h-10 rounded-lg border px-3 text-sm font-medium ${
                  activa
                    ? 'border-transparent bg-panel-lateral text-marca-acento'
                    : 'border-marca-borde text-marca-texto-suave hover:text-marca-texto'
                }`}
              >
                {p.etiqueta} · {p.n}
              </button>
            )
          })}
        </div>

        {soloLectura ? null : (
          <Boton
            variante="primario"
            className="flex items-center gap-1.5 px-4"
            onClick={() => setTomando(true)}
          >
            <IconoMas className="size-4" />
            Tomar pedido
          </Boton>
        )}
      </div>

      <ul className="space-y-2.5">
        {visibles.length === 0 ? (
          <li>
            <Vacio texto={VACIO[pestana]} Icono={IconoSilla} />
          </li>
        ) : (
          visibles.map((p, i) => (
            <Tarjeta
              key={p.id}
              pedido={p}
              vista={pestana}
              ahora={ahora}
              indice={i}
              soloLectura={soloLectura}
              onAgregar={() => setCuenta(p)}
              alAvisar={avisoListos.listo ? undefined : avisoListos.activar}
            />
          ))
        )}
      </ul>

      {tomando ? (
        <Modal titulo="Tomar pedido en la mesa" onCerrar={() => setTomando(false)}>
          <FormularioTomar
            mesas={mesas}
            cuentasAbiertas={cuentas}
            categorias={categorias}
            productos={productos}
            onListo={() => setTomando(false)}
          />
        </Modal>
      ) : null}

      {cuenta ? (
        <Modal
          titulo={cuenta.mesa ? `Agregar a la Mesa ${cuenta.mesa}` : `Agregar al #${cuenta.numero}`}
          onCerrar={() => setCuenta(null)}
        >
          <FormularioAgregar
            pedido={cuenta}
            categorias={categorias}
            productos={productos}
            onListo={() => setCuenta(null)}
          />
        </Modal>
      ) : null}
    </div>
  )
}

const VACIO: Record<Pestana, string> = {
  confirmar: 'Nada por confirmar. Cuando alguien pida desde el QR de una mesa, aparece aquí.',
  cocina: 'No hay pedidos del salón en cocina.',
  listos: 'Nada por llevar: todo lo que salió ya está en su mesa.',
  cuentas: 'No hay cuentas abiertas en el salón.',
}

/* ---------- La tarjeta de un pedido ---------- */

function Tarjeta({
  pedido,
  vista,
  ahora,
  indice,
  soloLectura,
  onAgregar,
  alAvisar,
}: {
  pedido: PedidoMesa
  vista: Pestana
  ahora: number
  indice: number
  soloLectura: boolean
  onAgregar: () => void
  /** Si el sonido aún no está desbloqueado, cualquier toque en la tarjeta lo activa. */
  alAvisar?: () => void
}) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mostrar } = useToast()

  const borde =
    pedido.estado === 'pendiente'
      ? BORDE.confirmar
      : pedido.estado === 'listo'
        ? BORDE.listo
        : BORDE.cocina

  const pastilla: { texto: string; tono: TonoPildora } =
    pedido.estado === 'pendiente'
      ? { texto: 'Sin confirmar', tono: 'ambar' }
      : pedido.estado === 'listo'
        ? { texto: pedido.servido ? 'En la mesa' : 'Listo', tono: 'verde' }
        : { texto: 'En cocina', tono: 'azul' }

  async function ejecutar(accion: () => Promise<{ ok: boolean; error?: string }>, exito: string) {
    alAvisar?.()
    setOcupado(true)
    setError(null)
    const r = await accion()
    if (!r.ok) {
      setError(r.error ?? 'No se pudo.')
      setOcupado(false)
      return
    }
    mostrar(exito)
  }

  return (
    <li
      className="tarjeta entra p-3.5 pl-4"
      style={{ '--i': indice, borderLeft: `4px solid ${borde}` } as CSSProperties}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-titulo text-lg text-marca-texto">
              {pedido.mesa ? `Mesa ${pedido.mesa}` : `Pedido #${pedido.numero}`}
            </span>
            <Pildora tono={pastilla.tono}>{pastilla.texto}</Pildora>
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-marca-texto-suave">
            <IconoReloj className="size-3.5" />
            #{pedido.numero} · {haceCuanto(new Date(pedido.creado_en).getTime(), ahora)}
          </p>
        </div>
        <p className="shrink-0 text-right text-sm font-bold text-marca-texto">
          {formatearPesos(pedido.total)}
        </p>
      </div>

      {/* Cómo va cada cocina: lo que el mesero necesita para responderle a la mesa. */}
      {pedido.estado !== 'pendiente' ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {pedido.barras.map((b) => (
            <ChipEstacion key={b.estacion_id} barra={b} />
          ))}
        </div>
      ) : null}

      {vista === 'confirmar' || vista === 'listos' ? (
        <ul className="mt-3 space-y-1.5 border-t border-marca-borde pt-3">
          {pedido.items.map((item, i) => (
            <li key={i} className="text-sm text-marca-texto">
              <span className="font-medium">
                {item.cantidad} × {item.nombre}
              </span>
              {item.estacion ? (
                <span className="text-marca-texto-suave"> · {item.estacion}</span>
              ) : null}
              {item.notas ? (
                <span className="mt-0.5 block text-xs text-marca-texto-suave">{item.notas}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 flex gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-5 shrink-0" />
          {error}
        </p>
      ) : null}

      {soloLectura ? null : (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {pedido.estado !== 'pendiente' ? (
            <Boton variante="secundario" className="px-4" onClick={onAgregar} disabled={ocupado}>
              <IconoMas className="mr-1 inline size-4" />
              Agregar productos
            </Boton>
          ) : null}

          {pedido.estado === 'pendiente' ? (
            <Boton
              variante="exito"
              className="flex min-w-48 items-center justify-center gap-2 px-4"
              disabled={ocupado}
              onClick={() =>
                ejecutar(
                  () => confirmarPedido(pedido.id),
                  `Mesa ${pedido.mesa ?? pedido.numero} mandada a cocina`,
                )
              }
            >
              <IconoCheck className="size-5 shrink-0" />
              {ocupado ? 'Confirmando…' : 'Confirmar y mandar a cocina'}
            </Boton>
          ) : null}

          {pedido.estado === 'listo' && !pedido.servido ? (
            <Boton
              variante="exito"
              className="flex min-w-48 items-center justify-center gap-2 px-4"
              disabled={ocupado}
              onClick={() =>
                ejecutar(
                  () => marcarServido(pedido.id),
                  `Pedido #${pedido.numero} entregado en la mesa`,
                )
              }
            >
              <IconoCheck className="size-5 shrink-0" />
              {ocupado ? 'Guardando…' : 'Lo llevé a la mesa'}
            </Boton>
          ) : null}
        </div>
      )}
    </li>
  )
}

/** Mini-chip de estación: verde ✓ terminó, color en curso, gris — no participa. */
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

/* ---------- Tomar un pedido a mano ---------- */

function FormularioTomar({
  mesas,
  cuentasAbiertas,
  categorias,
  productos,
  onListo,
}: {
  mesas: DatosMesero['mesas']
  cuentasAbiertas: PedidoMesa[]
  categorias: DatosMesero['categorias']
  productos: DatosMesero['productos']
  onListo: () => void
}) {
  const [mesaId, setMesaId] = useState('')
  const [renglones, setRenglones] = useState<Renglon[]>([])
  const [indicaciones, setIndicaciones] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mostrar } = useToast()

  const ocupadas = useMemo(
    () => new Map(cuentasAbiertas.filter((c) => c.mesa_id).map((c) => [c.mesa_id!, c])),
    [cuentasAbiertas],
  )
  const abierta = mesaId ? ocupadas.get(mesaId) : undefined
  const total = totalEstimado(renglones, productos)

  async function enviar() {
    setOcupado(true)
    setError(null)
    // Si la mesa ya tiene cuenta, lo nuevo entra a ESA cuenta: una mesa, un total.
    const r = abierta
      ? await agregarACuenta(abierta.id, renglones)
      : await crearPedidoInterno({
          canal: 'mesa',
          mesa_id: mesaId,
          indicaciones,
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

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-marca-texto">Mesa</legend>
        <div className="flex flex-wrap gap-1.5">
          {mesas.map((m) => {
            const activa = mesaId === m.id
            const tiene = ocupadas.has(m.id)
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMesaId(m.id)}
                aria-pressed={activa}
                className={`flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-3 text-sm font-semibold ${
                  activa
                    ? 'border-transparent bg-marca-acento text-marca-acento-texto'
                    : tiene
                      ? 'border-marca-acento text-marca-texto'
                      : 'border-marca-borde text-marca-texto-suave'
                }`}
              >
                {m.numero}
              </button>
            )
          })}
        </div>
        {abierta ? (
          <p className="mt-2 text-xs text-marca-texto-suave">
            La mesa {abierta.mesa} ya tiene la cuenta #{abierta.numero} abierta por{' '}
            {formatearPesos(abierta.total)}: lo que agregues entra a esa misma cuenta.
          </p>
        ) : null}
      </fieldset>

      <SelectorProductos
        categorias={categorias}
        productos={productos}
        renglones={renglones}
        onCambiar={setRenglones}
      />

      {abierta ? null : (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-marca-texto">
            Indicaciones (opcional)
          </span>
          <input
            type="text"
            value={indicaciones}
            onChange={(e) => setIndicaciones(e.target.value)}
            placeholder="Cumpleaños, alergias…"
            className="min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 text-sm text-marca-texto"
          />
        </label>
      )}

      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-5 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-marca-borde pt-4">
        <p className="text-sm text-marca-texto-suave">
          Total <span className="text-base font-bold text-marca-texto">{formatearPesos(total)}</span>
        </p>
        <Boton
          variante="negro"
          className="px-5"
          onClick={enviar}
          disabled={ocupado || !mesaId || renglones.length === 0}
        >
          {ocupado ? 'Enviando…' : abierta ? 'Sumar a la cuenta' : 'Mandar a cocina'}
        </Boton>
      </div>
    </div>
  )
}

/* ---------- Sumarle otra ronda a una cuenta abierta ---------- */

function FormularioAgregar({
  pedido,
  categorias,
  productos,
  onListo,
}: {
  pedido: PedidoMesa
  categorias: DatosMesero['categorias']
  productos: DatosMesero['productos']
  onListo: () => void
}) {
  const [renglones, setRenglones] = useState<Renglon[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mostrar } = useToast()

  const total = totalEstimado(renglones, productos)

  async function enviar() {
    setOcupado(true)
    setError(null)
    const r = await agregarACuenta(pedido.id, renglones)
    if (!r.ok) {
      setError(r.error)
      setOcupado(false)
      return
    }
    mostrar(`Agregado a la cuenta #${r.numero} · nuevo total ${formatearPesos(r.total)}`)
    onListo()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-marca-texto-suave">
        Cuenta #{pedido.numero} · lleva {formatearPesos(pedido.total)}. Lo que agregues entra a
        esta misma cuenta y cocina recibe una comanda nueva.
      </p>

      <SelectorProductos
        categorias={categorias}
        productos={productos}
        renglones={renglones}
        onCambiar={setRenglones}
      />

      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-5 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-marca-borde pt-4">
        <p className="text-sm text-marca-texto-suave">
          Se suman{' '}
          <span className="text-base font-bold text-marca-texto">{formatearPesos(total)}</span>
        </p>
        <Boton
          variante="negro"
          className="px-5"
          onClick={enviar}
          disabled={ocupado || renglones.length === 0}
        >
          {ocupado ? 'Enviando…' : 'Mandar a cocina'}
        </Boton>
      </div>
    </div>
  )
}
