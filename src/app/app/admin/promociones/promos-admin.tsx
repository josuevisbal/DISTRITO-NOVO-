'use client'

import { useRef, useState, type CSSProperties } from 'react'

import {
  IconoAlerta,
  IconoBolsa,
  IconoCheck,
  IconoEtiqueta,
  IconoMas,
  IconoMoto,
  IconoPorcentaje,
} from '@/components/iconos'
import { Interruptor } from '@/components/interruptor'
import { useToast } from '@/components/toast'
import { Boton } from '@/components/ui/boton'
import { Pildora } from '@/components/ui/pildora'
import { Vacio } from '@/components/ui/vacio'
import { formatearPesos } from '@/lib/formato'
import {
  alternarPromo,
  crearPromo,
  eliminarPromo,
  guardarItemsCombo,
  guardarPromo,
  quitarFotoPromo,
  subirFotoPromo,
} from './acciones'

export type ItemCombo = { producto_id: string; cantidad: number }

export type PromoAdmin = {
  id: string
  tipo: string
  etiqueta: string | null
  titulo: string
  descripcion: string | null
  monto_minimo: number | null
  precio_combo: number | null
  imagen_url: string | null
  activa: boolean
  items: ItemCombo[]
}

export type ProductoOpcion = { id: string; nombre: string; precio: number }

const NOMBRE_TIPO: Record<string, string> = {
  envio: 'Domicilio gratis',
  combo: 'Combo',
  aviso: 'Aviso',
  descuento: 'Descuento',
}

/** Los tipos que se pueden crear, con su explicación de una línea. */
const TIPOS_NUEVA = [
  {
    tipo: 'envio',
    nombre: 'Domicilio gratis',
    detalle: 'El envío se pone en $0 cuando el pedido supera un monto.',
    Icono: IconoMoto,
  },
  {
    tipo: 'combo',
    nombre: 'Combo',
    detalle: 'Varios productos juntos a un precio especial que fijas tú.',
    Icono: IconoBolsa,
  },
  {
    tipo: 'aviso',
    nombre: 'Aviso',
    detalle: 'Solo texto informativo en la carta; no cambia el cobro.',
    Icono: IconoEtiqueta,
  },
] as const

export function PromosAdmin({
  promos,
  productos,
}: {
  promos: PromoAdmin[]
  productos: ProductoOpcion[]
}) {
  const [eligiendo, setEligiendo] = useState(false)
  const [creando, setCreando] = useState(false)
  const { mostrar } = useToast()

  async function crear(tipo: 'envio' | 'combo' | 'aviso') {
    setCreando(true)
    const r = await crearPromo(tipo)
    setCreando(false)
    setEligiendo(false)
    if (r.ok) mostrar(`${NOMBRE_TIPO[tipo]} creada: edítala y enciéndela cuando esté lista`)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-16">
      {/* Nueva promoción: primero se elige el tipo. */}
      {eligiendo ? (
        <div className="tarjeta p-4">
          <p className="mb-3 font-medium text-marca-texto">¿Qué tipo de promoción?</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {TIPOS_NUEVA.map((t) => (
              <button
                key={t.tipo}
                type="button"
                disabled={creando}
                onClick={() => void crear(t.tipo)}
                className="rounded-xl border border-marca-borde p-3 text-left transition-colors hover:border-marca-acento disabled:opacity-60"
              >
                <p className="flex items-center gap-1.5 font-semibold text-marca-texto">
                  <t.Icono className="size-4 shrink-0 text-marca-acento-fuerte" />
                  {t.nombre}
                </p>
                <p className="mt-1 text-xs text-marca-texto-suave">{t.detalle}</p>
              </button>
            ))}
          </div>
          <Boton
            variante="secundario"
            className="mt-3 px-4"
            onClick={() => setEligiendo(false)}
            disabled={creando}
          >
            Cancelar
          </Boton>
        </div>
      ) : (
        <div className="flex justify-end">
          <Boton
            variante="primario"
            className="flex items-center gap-1.5 px-4"
            onClick={() => setEligiendo(true)}
          >
            <IconoMas className="size-4" />
            Nueva promoción
          </Boton>
        </div>
      )}

      {promos.length === 0 ? (
        <Vacio texto="No hay promociones. Crea la primera." Icono={IconoPorcentaje} />
      ) : (
        promos.map((p, i) => (
          <TarjetaPromo key={p.id} promo={p} productos={productos} indice={i} />
        ))
      )}
    </div>
  )
}

function TarjetaPromo({
  promo,
  productos,
  indice,
}: {
  promo: PromoAdmin
  productos: ProductoOpcion[]
  indice: number
}) {
  const [etiqueta, setEtiqueta] = useState(promo.etiqueta ?? '')
  const [titulo, setTitulo] = useState(promo.titulo)
  const [descripcion, setDescripcion] = useState(promo.descripcion ?? '')
  const [monto, setMonto] = useState(promo.monto_minimo != null ? String(promo.monto_minimo) : '')
  const [precioCombo, setPrecioCombo] = useState(
    promo.precio_combo != null ? String(promo.precio_combo) : '',
  )
  const [items, setItems] = useState<ItemCombo[]>(promo.items)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mostrar } = useToast()

  const esCombo = promo.tipo === 'combo'
  const esEnvio = promo.tipo === 'envio'

  async function guardar() {
    setGuardando(true)
    setError(null)

    const r = await guardarPromo(promo.id, {
      etiqueta,
      titulo,
      descripcion,
      monto_minimo: esEnvio ? (monto === '' ? null : Number(monto)) : promo.monto_minimo,
      ...(esCombo ? { precio_combo: precioCombo === '' ? null : Number(precioCombo) } : {}),
    })
    if (!r.ok) {
      setError(r.error)
      setGuardando(false)
      return
    }

    if (esCombo) {
      const ri = await guardarItemsCombo(promo.id, items)
      if (!ri.ok) {
        setError(ri.error)
        setGuardando(false)
        return
      }
    }

    setGuardando(false)
    mostrar('Promoción guardada')
    setGuardado(true)
    setTimeout(() => setGuardado(false), 1500)
  }

  async function eliminar() {
    setGuardando(true)
    const r = await eliminarPromo(promo.id)
    setGuardando(false)
    setConfirmando(false)
    if (!r.ok) setError(r.error)
    else mostrar(`"${promo.titulo}" eliminada`)
  }

  return (
    <article className="tarjeta tarjeta-hover entra p-4" style={{ '--i': indice } as CSSProperties}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <Pildora tono={esCombo ? 'azul' : esEnvio ? 'verde' : 'gris'} punto={false}>
          {NOMBRE_TIPO[promo.tipo] ?? promo.tipo}
        </Pildora>
        <div className="flex items-center gap-2">
          <Interruptor activa={promo.activa} onCambiar={(v) => alternarPromo(promo.id, v)} />
          {confirmando ? (
            <span className="flex gap-1.5">
              <Boton variante="peligro" className="px-3" onClick={eliminar} disabled={guardando}>
                Sí
              </Boton>
              <Boton
                variante="secundario"
                className="px-3"
                onClick={() => setConfirmando(false)}
                disabled={guardando}
              >
                No
              </Boton>
            </span>
          ) : (
            <Boton
              variante="secundario"
              className="px-3 transition-colors hover:border-[#D64533] hover:text-[#D64533]"
              onClick={() => setConfirmando(true)}
            >
              Eliminar
            </Boton>
          )}
        </div>
      </div>

      <FotoPromo promo={promo} />

      <div className="space-y-2">
        <Campo etiqueta="Etiqueta" valor={etiqueta} onChange={setEtiqueta} marcador="Solo por hoy" />
        <Campo etiqueta="Título" valor={titulo} onChange={setTitulo} />
        <Campo etiqueta="Descripción" valor={descripcion} onChange={setDescripcion} />

        {esEnvio ? (
          <label className="block">
            <span className="text-xs text-marca-texto-suave">
              Monto mínimo del pedido (desde aquí el domicilio va gratis)
            </span>
            <input
              inputMode="numeric"
              value={monto}
              onChange={(e) => setMonto(e.target.value.replace(/\D/g, ''))}
              placeholder="70000"
              className="mt-1 min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 tabular-nums text-marca-texto"
            />
          </label>
        ) : null}

        {esCombo ? (
          <ArmadorCombo
            productos={productos}
            items={items}
            precioCombo={precioCombo}
            onItems={setItems}
            onPrecio={setPrecioCombo}
          />
        ) : null}
      </div>

      <VistaPrevia
        tipo={promo.tipo}
        etiqueta={etiqueta}
        titulo={titulo}
        descripcion={descripcion}
        monto={esEnvio && monto !== '' ? Number(monto) : null}
        precioCombo={esCombo && precioCombo !== '' ? Number(precioCombo) : null}
        items={items}
        productos={productos}
      />

      {error ? (
        <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-5 shrink-0" />
          {error}
        </p>
      ) : null}

      <Boton
        variante="primario"
        className="mt-4 flex items-center justify-center gap-1.5 px-4"
        onClick={guardar}
        disabled={guardando}
      >
        {guardado ? <IconoCheck className="size-4" /> : null}
        {guardando ? 'Guardando…' : guardado ? 'Guardado' : 'Guardar cambios'}
      </Boton>
    </article>
  )
}

/** Armador del combo: qué productos lo componen, en qué cantidad y a qué precio especial. */
function ArmadorCombo({
  productos,
  items,
  precioCombo,
  onItems,
  onPrecio,
}: {
  productos: ProductoOpcion[]
  items: ItemCombo[]
  precioCombo: string
  onItems: (items: ItemCombo[]) => void
  onPrecio: (v: string) => void
}) {
  const porId = new Map(productos.map((p) => [p.id, p]))
  const suma = items.reduce((s, i) => s + (porId.get(i.producto_id)?.precio ?? 0) * i.cantidad, 0)
  const precio = precioCombo === '' ? null : Number(precioCombo)
  const disponibles = productos.filter((p) => !items.some((i) => i.producto_id === p.id))

  function cambiar(indice: number, cambios: Partial<ItemCombo>) {
    onItems(items.map((i, n) => (n === indice ? { ...i, ...cambios } : i)))
  }

  return (
    <div className="rounded-xl border border-marca-borde p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-marca-texto-suave">
        Qué lleva el combo
      </p>

      <ul className="mt-2 space-y-2">
        {items.map((item, n) => (
          <li key={item.producto_id} className="flex items-center gap-2">
            <select
              value={item.producto_id}
              onChange={(e) => cambiar(n, { producto_id: e.target.value })}
              aria-label="Producto del combo"
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-marca-borde bg-marca-fondo px-2 text-sm text-marca-texto"
            >
              {[porId.get(item.producto_id), ...disponibles]
                .filter((p): p is ProductoOpcion => Boolean(p))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} · {formatearPesos(p.precio)}
                  </option>
                ))}
            </select>
            <input
              inputMode="numeric"
              value={String(item.cantidad)}
              onChange={(e) =>
                cambiar(n, { cantidad: Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1) })
              }
              aria-label="Cantidad"
              className="min-h-11 w-14 rounded-lg border border-marca-borde bg-marca-fondo px-2 text-center tabular-nums text-marca-texto"
            />
            <Boton
              variante="secundario"
              className="px-3"
              onClick={() => onItems(items.filter((_, x) => x !== n))}
            >
              Quitar
            </Boton>
          </li>
        ))}
      </ul>

      <Boton
        variante="secundario"
        className="mt-2 flex items-center gap-1.5 px-3"
        disabled={disponibles.length === 0}
        onClick={() =>
          disponibles[0] && onItems([...items, { producto_id: disponibles[0].id, cantidad: 1 }])
        }
      >
        <IconoMas className="size-4" />
        Agregar producto
      </Boton>

      <label className="mt-3 block">
        <span className="text-xs text-marca-texto-suave">Precio del combo (lo fijas tú)</span>
        <input
          inputMode="numeric"
          value={precioCombo}
          onChange={(e) => onPrecio(e.target.value.replace(/\D/g, ''))}
          placeholder="38000"
          className="mt-1 min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 tabular-nums text-marca-texto"
        />
      </label>

      {items.length > 0 ? (
        <p className="mt-2 text-xs text-marca-texto-suave">
          Por separado suma {formatearPesos(suma)}
          {precio !== null && precio > 0 && precio < suma ? (
            <span className="font-semibold" style={{ color: '#0F6E56' }}>
              {' '}
              · el cliente ahorra {formatearPesos(suma - precio)}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}

/** Cómo se verá en la carta del cliente (negro y dorado), antes de guardar. */
function VistaPrevia({
  tipo,
  etiqueta,
  titulo,
  descripcion,
  monto,
  precioCombo,
  items,
  productos,
}: {
  tipo: string
  etiqueta: string
  titulo: string
  descripcion: string
  monto: number | null
  precioCombo: number | null
  items: ItemCombo[]
  productos: ProductoOpcion[]
}) {
  const porId = new Map(productos.map((p) => [p.id, p]))
  const suma = items.reduce((s, i) => s + (porId.get(i.producto_id)?.precio ?? 0) * i.cantidad, 0)
  const precio = precioCombo && precioCombo > 0 ? precioCombo : suma

  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-marca-texto-suave">
        Así se verá en la carta
      </p>
      <div
        className="relative overflow-hidden rounded-2xl border p-5"
        style={{ backgroundColor: '#16151A', borderColor: 'rgba(216,172,78,0.5)' }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full opacity-20"
          style={{ backgroundColor: '#D8AC4E' }}
        />
        <p className="flex items-center gap-2" style={{ color: '#ECCB79' }}>
          {tipo === 'envio' ? (
            <IconoMoto className="size-4 shrink-0" />
          ) : tipo === 'combo' ? (
            <IconoBolsa className="size-4 shrink-0" />
          ) : (
            <IconoEtiqueta className="size-4 shrink-0" />
          )}
          {etiqueta ? (
            <span className="text-xs font-semibold uppercase tracking-[0.15em]">{etiqueta}</span>
          ) : null}
        </p>

        <h4
          className="mt-2 text-xl font-bold"
          style={{ color: '#F4EFE4', fontFamily: 'var(--fuente-titulo)' }}
        >
          {titulo || 'Título de la promoción'}
        </h4>

        {descripcion ? (
          <p className="mt-1.5 text-sm" style={{ color: '#A9A294' }}>
            {descripcion}
          </p>
        ) : tipo === 'envio' && monto ? (
          <p className="mt-1.5 text-sm" style={{ color: '#A9A294' }}>
            En pedidos desde {formatearPesos(monto)}.
          </p>
        ) : null}

        {tipo === 'combo' && items.length > 0 ? (
          <>
            <ul className="mt-3 space-y-0.5 text-sm" style={{ color: '#A9A294' }}>
              {items.map((i) => {
                const p = porId.get(i.producto_id)
                return p ? (
                  <li key={i.producto_id}>
                    {i.cantidad} × {p.nombre}
                  </li>
                ) : null
              })}
            </ul>
            {precio < suma ? (
              <p className="mt-2 text-sm" style={{ color: '#A9A294' }}>
                Por separado: <span className="line-through">{formatearPesos(suma)}</span>
              </p>
            ) : null}
            <span
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg font-medium"
              style={{ backgroundColor: '#D8AC4E', color: '#0B0B0C' }}
            >
              <IconoBolsa className="size-4 shrink-0" />
              Agregar combo · {formatearPesos(precio)}
            </span>
          </>
        ) : null}
      </div>
    </div>
  )
}

/** Foto de fondo de la promoción, con vista previa local antes de guardar. */
function FotoPromo({ promo }: { promo: PromoAdmin }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pendiente, setPendiente] = useState<File | null>(null)
  const [previa, setPrevia] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function elegir(archivo: File) {
    setPendiente(archivo)
    setPrevia(URL.createObjectURL(archivo))
  }

  function limpiar() {
    if (previa) URL.revokeObjectURL(previa)
    setPendiente(null)
    setPrevia(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function guardarFoto() {
    if (!pendiente) return
    setOcupado(true)
    setError(null)
    const form = new FormData()
    form.set('foto', pendiente)
    const r = await subirFotoPromo(promo.id, form)
    setOcupado(false)
    if (!r.ok) setError(r.error)
    else limpiar()
  }

  const mostrada = previa ?? promo.imagen_url

  return (
    <div className="mb-3 rounded-xl border border-marca-borde p-3">
      <div className="flex items-center gap-3">
        <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-marca-superficie-tenue">
          {mostrada ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mostrada} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-xs text-marca-texto-suave">
              Sin foto
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) elegir(f)
            }}
          />
          {pendiente ? (
            <>
              <Boton variante="primario" className="px-3" onClick={guardarFoto} disabled={ocupado}>
                {ocupado ? 'Subiendo…' : 'Guardar foto'}
              </Boton>
              <Boton variante="secundario" className="px-3" onClick={limpiar} disabled={ocupado}>
                Cancelar
              </Boton>
            </>
          ) : (
            <>
              <Boton
                variante="secundario"
                className="px-3 text-marca-texto"
                onClick={() => inputRef.current?.click()}
              >
                {promo.imagen_url ? 'Cambiar foto' : 'Subir foto de fondo'}
              </Boton>
              {promo.imagen_url ? (
                <Boton
                  variante="secundario"
                  className="px-3"
                  onClick={() => quitarFotoPromo(promo.id)}
                >
                  Quitar
                </Boton>
              ) : null}
            </>
          )}
        </div>
      </div>
      {pendiente ? (
        <p className="mt-2 text-xs text-marca-texto-suave">
          Vista previa: aún no se guarda hasta que toques “Guardar foto”.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 flex items-center gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  )
}

function Campo({
  etiqueta,
  valor,
  onChange,
  marcador,
}: {
  etiqueta: string
  valor: string
  onChange: (v: string) => void
  marcador?: string
}) {
  return (
    <label className="block">
      <span className="text-xs text-marca-texto-suave">{etiqueta}</span>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={marcador}
        className="mt-1 min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 text-marca-texto"
      />
    </label>
  )
}
