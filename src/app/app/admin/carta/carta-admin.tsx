'use client'

import { useRef, useState, type CSSProperties } from 'react'

import { IconoAlerta, IconoCheck, IconoDestello } from '@/components/iconos'
import { formatearPesos } from '@/lib/formato'
import { alternarProducto, quitarFotoProducto, subirFotoProducto } from './acciones'

export type ProductoAdmin = {
  id: string
  nombre: string
  precio: number
  foto_url: string | null
  destacado: boolean
  disponible: boolean
  color_estacion: string
}

export type CategoriaAdmin = { id: string; nombre: string; productos: ProductoAdmin[] }

export function CartaAdmin({ categorias }: { categorias: CategoriaAdmin[] }) {
  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4 pb-16">
      {categorias.map((cat) => (
        <section key={cat.id}>
          <h2 className="mb-3 font-titulo text-lg text-marca-texto">{cat.nombre}</h2>
          <ul className="space-y-3">
            {cat.productos.map((p, i) => (
              <FilaProducto key={p.id} producto={p} indice={i} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function FilaProducto({ producto, indice }: { producto: ProductoAdmin; indice: number }) {
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
      </div>

      {error ? (
        <p role="alert" className="flex w-full gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-5 shrink-0" />
          {error}
        </p>
      ) : null}
    </li>
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
