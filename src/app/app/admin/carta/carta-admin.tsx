'use client'

import { useRef, useState, type CSSProperties } from 'react'

import {
  IconoAlerta,
  IconoCarta,
  IconoCheck,
  IconoDestello,
  IconoMas,
} from '@/components/iconos'
import { useToast } from '@/components/toast'
import { Boton } from '@/components/ui/boton'
import { Vacio } from '@/components/ui/vacio'
import { formatearPesos } from '@/lib/formato'
import {
  alternarProducto,
  crearProducto,
  guardarProducto,
  quitarFotoProducto,
  retirarProducto,
  subirFotoProducto,
} from './acciones'

export type ProductoAdmin = {
  id: string
  nombre: string
  descripcion: string | null
  precio: number
  minutos_prep: number
  foto_url: string | null
  destacado: boolean
  disponible: boolean
  categoria_id: string
  estacion_id: string
  color_estacion: string
}

export type CategoriaAdmin = { id: string; nombre: string; productos: ProductoAdmin[] }
export type EstacionOpcion = { id: string; nombre: string }

export function CartaAdmin({
  categorias,
  estaciones,
}: {
  categorias: CategoriaAdmin[]
  estaciones: EstacionOpcion[]
}) {
  const [familia, setFamilia] = useState<string>('todos')
  const [buscar, setBuscar] = useState('')
  const [creando, setCreando] = useState(false)

  const total = categorias.reduce((s, c) => s + c.productos.length, 0)
  const texto = buscar.trim().toLowerCase()

  // Primero la familia elegida, luego el buscador; las que quedan vacías no se pintan.
  const visibles = categorias
    .filter((c) => familia === 'todos' || c.id === familia)
    .map((c) => ({
      ...c,
      productos: texto
        ? c.productos.filter((p) => p.nombre.toLowerCase().includes(texto))
        : c.productos,
    }))
    .filter((c) => c.productos.length > 0)

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-16">
      {/* Filtros por familia + buscador: con tantos platos, bajar a buscar es incómodo. */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <ChipFamilia
            activo={familia === 'todos'}
            onClick={() => setFamilia('todos')}
            etiqueta={`Todos · ${total}`}
          />
          {categorias.map((c) => (
            <ChipFamilia
              key={c.id}
              activo={familia === c.id}
              onClick={() => setFamilia(c.id)}
              etiqueta={`${c.nombre} · ${c.productos.length}`}
            />
          ))}
        </div>

        <input
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Buscar un plato por nombre"
          className="min-h-11 w-full max-w-sm rounded-lg border border-marca-borde bg-marca-superficie px-3 text-sm text-marca-texto placeholder:text-marca-texto-suave/60"
        />
      </div>

      {/* Agregar un plato nuevo a la carta. */}
      {creando ? (
        <FormularioNuevo
          categorias={categorias}
          estaciones={estaciones}
          familiaSugerida={familia !== 'todos' ? familia : (categorias[0]?.id ?? '')}
          onListo={() => setCreando(false)}
        />
      ) : (
        <div className="flex justify-end">
          <Boton
            variante="primario"
            className="flex items-center gap-1.5 px-4"
            onClick={() => setCreando(true)}
          >
            <IconoMas className="size-4" />
            Agregar plato
          </Boton>
        </div>
      )}

      {visibles.length === 0 ? (
        <Vacio texto="Ningún plato coincide con la búsqueda." Icono={IconoCarta} />
      ) : (
        // key por filtro: la entrada escalonada se reinicia y el cambio se ve suave.
        <div key={`${familia}-${texto}`} className="space-y-8">
          {visibles.map((cat) => (
            <section key={cat.id}>
              <h2 className="mb-3 font-titulo text-lg text-marca-texto">{cat.nombre}</h2>
              <ul className="space-y-3">
                {cat.productos.map((p, i) => (
                  <FilaProducto
                    key={p.id}
                    producto={p}
                    indice={Math.min(i, 8)}
                    categorias={categorias}
                    estaciones={estaciones}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function ChipFamilia({
  activo,
  onClick,
  etiqueta,
}: {
  activo: boolean
  onClick: () => void
  etiqueta: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors ${
        activo
          ? 'border-transparent bg-panel-lateral text-marca-acento'
          : 'border-marca-borde bg-marca-superficie text-marca-texto-suave hover:text-marca-texto'
      }`}
    >
      {etiqueta}
    </button>
  )
}

/** Los campos que se editan de un plato, sin la foto ni los interruptores. */
type DatosPlato = {
  nombre: string
  descripcion: string
  precio: string
  minutos_prep: string
  categoria_id: string
  estacion_id: string
}

/** Formulario para agregar un plato nuevo a la carta. */
function FormularioNuevo({
  categorias,
  estaciones,
  familiaSugerida,
  onListo,
}: {
  categorias: CategoriaAdmin[]
  estaciones: EstacionOpcion[]
  familiaSugerida: string
  onListo: () => void
}) {
  const [datos, setDatos] = useState<DatosPlato>({
    nombre: '',
    descripcion: '',
    precio: '',
    minutos_prep: '10',
    categoria_id: familiaSugerida,
    estacion_id: estaciones[0]?.id ?? '',
  })
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mostrar } = useToast()

  async function crear() {
    setOcupado(true)
    setError(null)
    const r = await crearProducto({
      nombre: datos.nombre,
      descripcion: datos.descripcion,
      precio: Number(datos.precio) || 0,
      minutos_prep: Number(datos.minutos_prep) || 10,
      categoria_id: datos.categoria_id,
      estacion_id: datos.estacion_id,
    })
    setOcupado(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    mostrar(`"${datos.nombre.trim()}" agregado a la carta`)
    onListo()
  }

  return (
    <section className="tarjeta space-y-3 p-4">
      <h2 className="font-medium text-marca-texto">Nuevo plato</h2>
      <CamposPlato
        datos={datos}
        onCambiar={setDatos}
        categorias={categorias}
        estaciones={estaciones}
      />
      {error ? <ErrorTexto texto={error} /> : null}
      <div className="flex gap-2">
        <Boton variante="primario" className="px-4" onClick={crear} disabled={ocupado}>
          {ocupado ? 'Agregando…' : 'Agregar a la carta'}
        </Boton>
        <Boton variante="secundario" className="px-4" onClick={onListo} disabled={ocupado}>
          Cancelar
        </Boton>
      </div>
    </section>
  )
}

/** Los campos de un plato, compartidos por el alta y la edición. */
function CamposPlato({
  datos,
  onCambiar,
  categorias,
  estaciones,
}: {
  datos: DatosPlato
  onCambiar: (d: DatosPlato) => void
  categorias: CategoriaAdmin[]
  estaciones: EstacionOpcion[]
}) {
  const set = (campo: keyof DatosPlato, valor: string) =>
    onCambiar({ ...datos, [campo]: valor })

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <span className="text-xs text-marca-texto-suave">Nombre</span>
        <input
          value={datos.nombre}
          onChange={(e) => set('nombre', e.target.value)}
          placeholder="Salchipapa sencilla"
          className="mt-1 min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 text-marca-texto"
        />
      </label>

      <label className="block sm:col-span-2">
        <span className="text-xs text-marca-texto-suave">Descripción (opcional)</span>
        <input
          value={datos.descripcion}
          onChange={(e) => set('descripcion', e.target.value)}
          placeholder="Con salsas de la casa"
          className="mt-1 min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 text-marca-texto"
        />
      </label>

      <label className="block">
        <span className="text-xs text-marca-texto-suave">Precio</span>
        <input
          inputMode="numeric"
          value={datos.precio}
          onChange={(e) => set('precio', e.target.value.replace(/\D/g, ''))}
          placeholder="14000"
          className="mt-1 min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 tabular-nums text-marca-texto"
        />
      </label>

      <label className="block">
        <span className="text-xs text-marca-texto-suave">Minutos de preparación</span>
        <input
          inputMode="numeric"
          value={datos.minutos_prep}
          onChange={(e) => set('minutos_prep', e.target.value.replace(/\D/g, ''))}
          placeholder="10"
          className="mt-1 min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 tabular-nums text-marca-texto"
        />
      </label>

      <label className="block">
        <span className="text-xs text-marca-texto-suave">Familia</span>
        <select
          value={datos.categoria_id}
          onChange={(e) => set('categoria_id', e.target.value)}
          className="mt-1 min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-2 text-marca-texto"
        >
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs text-marca-texto-suave">Se prepara en</span>
        <select
          value={datos.estacion_id}
          onChange={(e) => set('estacion_id', e.target.value)}
          className="mt-1 min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-2 text-marca-texto"
        >
          {estaciones.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

function ErrorTexto({ texto }: { texto: string }) {
  return (
    <p role="alert" className="flex items-center gap-2 text-sm text-marca-acento-fuerte">
      <IconoAlerta className="size-5 shrink-0" />
      {texto}
    </p>
  )
}

function FilaProducto({
  producto,
  indice,
  categorias,
  estaciones,
}: {
  producto: ProductoAdmin
  indice: number
  categorias: CategoriaAdmin[]
  estaciones: EstacionOpcion[]
}) {
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [editando, setEditando] = useState(false)

  async function alSubir(form: FormData) {
    setSubiendo(true)
    setError(null)
    const r = await subirFotoProducto(producto.id, form)
    if (!r.ok) setError(r.error)
    setSubiendo(false)
  }

  async function quitar() {
    setSubiendo(true)
    setError(null)
    const r = await quitarFotoProducto(producto.id)
    if (!r.ok) setError(r.error)
    setSubiendo(false)
  }

  async function alternar(campo: 'destacado' | 'disponible', valor: boolean) {
    setError(null)
    const r = await alternarProducto(producto.id, campo, valor)
    if (!r.ok) setError(r.error)
  }

  return (
    <li
      className="entra flex flex-col gap-3 rounded-xl border border-marca-borde bg-marca-superficie p-3 sm:flex-row sm:items-center"
      style={{ '--i': indice } as CSSProperties}
    >
      <div className="flex items-center gap-3">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-marca-borde bg-marca-superficie-tenue">
          {producto.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={producto.foto_url} alt="" className="size-full object-cover" />
          ) : (
            // Mismo marcador que ve el comensal: inicial sobre el color de la estación.
            <span
              aria-hidden
              className="flex size-full items-center justify-center font-titulo text-xl font-bold text-white"
              style={{
                background: `linear-gradient(135deg, ${producto.color_estacion}, color-mix(in srgb, ${producto.color_estacion} 55%, #000))`,
              }}
            >
              {producto.nombre.trim().charAt(0).toUpperCase()}
            </span>
          )}
          {subiendo ? (
            <span className="absolute inset-0 grid place-items-center bg-marca-fondo/70 text-xs text-marca-texto">
              …
            </span>
          ) : null}
        </div>

        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-medium text-marca-texto">
            {producto.destacado ? (
              <IconoDestello className="size-4 shrink-0 text-marca-acento-fuerte" />
            ) : null}
            <span className="truncate">{producto.nombre}</span>
          </p>
          <p className="text-sm text-marca-texto-suave">{formatearPesos(producto.precio)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        {/* Subir / cambiar foto */}
        <form action={alSubir}>
          <input
            ref={inputRef}
            type="file"
            name="foto"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) e.currentTarget.form?.requestSubmit()
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={subiendo}
            className="min-h-11 rounded-lg border border-marca-borde px-3 text-sm text-marca-texto disabled:opacity-50"
          >
            {producto.foto_url ? 'Cambiar foto' : 'Subir foto'}
          </button>
        </form>

        {producto.foto_url ? (
          <button
            type="button"
            onClick={quitar}
            disabled={subiendo}
            className="min-h-11 rounded-lg border border-marca-borde px-3 text-sm text-marca-texto-suave disabled:opacity-50"
          >
            Quitar
          </button>
        ) : null}

        <Interruptor
          activo={producto.destacado}
          onCambiar={(v) => alternar('destacado', v)}
          etiqueta="POPULAR"
        />
        <Interruptor
          activo={producto.disponible}
          onCambiar={(v) => alternar('disponible', v)}
          etiqueta={producto.disponible ? 'Disponible' : 'Agotado'}
        />

        <button
          type="button"
          onClick={() => setEditando((v) => !v)}
          aria-expanded={editando}
          className="min-h-11 rounded-lg border border-marca-borde px-3 text-sm text-marca-texto"
        >
          {editando ? 'Cerrar' : 'Editar'}
        </button>
      </div>

      {editando ? (
        <EditorPlato
          producto={producto}
          categorias={categorias}
          estaciones={estaciones}
          onListo={() => setEditando(false)}
        />
      ) : null}

      {error ? (
        <p role="alert" className="flex w-full gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-5 shrink-0" />
          {error}
        </p>
      ) : null}
    </li>
  )
}

/** Editar un plato ya existente: nombre, precio, familia y en qué cocina se prepara. */
function EditorPlato({
  producto,
  categorias,
  estaciones,
  onListo,
}: {
  producto: ProductoAdmin
  categorias: CategoriaAdmin[]
  estaciones: EstacionOpcion[]
  onListo: () => void
}) {
  const [datos, setDatos] = useState<DatosPlato>({
    nombre: producto.nombre,
    descripcion: producto.descripcion ?? '',
    precio: String(producto.precio),
    minutos_prep: String(producto.minutos_prep),
    categoria_id: producto.categoria_id,
    estacion_id: producto.estacion_id,
  })
  const [ocupado, setOcupado] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mostrar } = useToast()

  async function guardar() {
    setOcupado(true)
    setError(null)
    const r = await guardarProducto(producto.id, {
      nombre: datos.nombre,
      descripcion: datos.descripcion,
      precio: Number(datos.precio) || 0,
      minutos_prep: Number(datos.minutos_prep) || 10,
      categoria_id: datos.categoria_id,
      estacion_id: datos.estacion_id,
    })
    setOcupado(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    mostrar('Plato guardado')
    onListo()
  }

  async function retirar() {
    setOcupado(true)
    const r = await retirarProducto(producto.id)
    setOcupado(false)
    if (!r.ok) setError(r.error)
    else mostrar(`"${producto.nombre}" salió de la carta`)
  }

  return (
    <div className="mt-3 w-full space-y-3 rounded-xl border border-marca-borde p-3">
      <CamposPlato
        datos={datos}
        onCambiar={setDatos}
        categorias={categorias}
        estaciones={estaciones}
      />

      {error ? <ErrorTexto texto={error} /> : null}

      <div className="flex flex-wrap gap-2">
        <Boton variante="primario" className="px-4" onClick={guardar} disabled={ocupado}>
          {ocupado ? 'Guardando…' : 'Guardar cambios'}
        </Boton>
        <Boton variante="secundario" className="px-4" onClick={onListo} disabled={ocupado}>
          Cancelar
        </Boton>

        <span className="ml-auto flex gap-2">
          {confirmando ? (
            <>
              <Boton variante="peligro" className="px-3" onClick={retirar} disabled={ocupado}>
                Sí, retirar
              </Boton>
              <Boton
                variante="secundario"
                className="px-3"
                onClick={() => setConfirmando(false)}
                disabled={ocupado}
              >
                No
              </Boton>
            </>
          ) : (
            <Boton
              variante="secundario"
              className="px-3 transition-colors hover:border-[#D64533] hover:text-[#D64533]"
              onClick={() => setConfirmando(true)}
            >
              Retirar de la carta
            </Boton>
          )}
        </span>
      </div>

      <p className="text-xs text-marca-texto-suave">
        Retirar no borra el plato: deja de verse en la carta pero los pedidos viejos siguen
        cuadrando.
      </p>
    </div>
  )
}

function Interruptor({
  activo,
  onCambiar,
  etiqueta,
}: {
  activo: boolean
  onCambiar: (v: boolean) => void
  etiqueta: string
}) {
  return (
    <button
      type="button"
      onClick={() => onCambiar(!activo)}
      aria-pressed={activo}
      className={`flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors ${
        activo
          ? 'border-marca-acento bg-marca-acento font-medium text-marca-acento-texto'
          : 'border-marca-borde text-marca-texto-suave'
      }`}
    >
      {activo ? <IconoCheck className="size-4 shrink-0" /> : null}
      {etiqueta}
    </button>
  )
}
