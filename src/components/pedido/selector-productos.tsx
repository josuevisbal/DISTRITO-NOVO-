'use client'

import { useMemo, useState } from 'react'

import { IconoMas, IconoMenos, IconoNota } from '@/components/iconos'
import { formatearPesos } from '@/lib/formato'

export type ProductoElegible = {
  id: string
  nombre: string
  precio: number
  categoria_id: string
  disponible: boolean
}

export type CategoriaElegible = { id: string; nombre: string }

/** Un renglón del pedido que está armando el equipo. Nunca lleva precio: lo pone la base. */
export type Renglon = { producto_id: string; cantidad: number; notas?: string }

/**
 * Lista de la carta para que el equipo arme un pedido a mano: cuando el cliente no tiene
 * datos, llama por teléfono o simplemente dicta en el mostrador.
 *
 * Solo maneja qué producto y cuántos. El precio que se ve aquí es informativo (para
 * decirle el total al cliente); el que se cobra lo recalcula `crear_pedido` en la base.
 */
export function SelectorProductos({
  categorias,
  productos,
  renglones,
  onCambiar,
}: {
  categorias: CategoriaElegible[]
  productos: ProductoElegible[]
  renglones: Renglon[]
  onCambiar: (renglones: Renglon[]) => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState<string>('todas')
  const [conNota, setConNota] = useState<string | null>(null)

  const porId = useMemo(
    () => new Map(renglones.map((r) => [r.producto_id, r])),
    [renglones],
  )

  const texto = busqueda.trim().toLowerCase()
  const visibles = productos.filter((p) => {
    if (categoria !== 'todas' && p.categoria_id !== categoria) return false
    if (!texto) return true
    return p.nombre.toLowerCase().includes(texto)
  })

  function ajustar(producto_id: string, delta: number) {
    const actual = porId.get(producto_id)
    const cantidad = (actual?.cantidad ?? 0) + delta
    navigator.vibrate?.(10)
    if (cantidad <= 0) {
      onCambiar(renglones.filter((r) => r.producto_id !== producto_id))
      if (conNota === producto_id) setConNota(null)
      return
    }
    if (actual) {
      onCambiar(renglones.map((r) => (r.producto_id === producto_id ? { ...r, cantidad } : r)))
    } else {
      onCambiar([...renglones, { producto_id, cantidad }])
    }
  }

  function anotar(producto_id: string, notas: string) {
    onCambiar(renglones.map((r) => (r.producto_id === producto_id ? { ...r, notas } : r)))
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="sr-only">Buscar producto</span>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar en la carta…"
          className="min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 text-sm text-marca-texto"
        />
      </label>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <ChipCategoria
          activa={categoria === 'todas'}
          onClick={() => setCategoria('todas')}
          texto="Todas"
        />
        {categorias.map((c) => (
          <ChipCategoria
            key={c.id}
            activa={categoria === c.id}
            onClick={() => setCategoria(c.id)}
            texto={c.nombre}
          />
        ))}
      </div>

      <ul className="max-h-[45vh] space-y-1.5 overflow-y-auto pr-1">
        {visibles.length === 0 ? (
          <li className="py-6 text-center text-sm text-marca-texto-suave">
            Nada con ese nombre.
          </li>
        ) : (
          visibles.map((p) => {
            const renglon = porId.get(p.id)
            const cantidad = renglon?.cantidad ?? 0
            return (
              <li
                key={p.id}
                className={`rounded-xl border p-2.5 ${
                  cantidad > 0 ? 'border-marca-acento bg-marca-acento/5' : 'border-marca-borde'
                } ${p.disponible ? '' : 'opacity-50'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-marca-texto">{p.nombre}</p>
                    <p className="text-xs text-marca-texto-suave">
                      {p.disponible ? formatearPesos(p.precio) : 'Agotado'}
                    </p>
                  </div>

                  {cantidad > 0 ? (
                    <button
                      type="button"
                      onClick={() => setConNota(conNota === p.id ? null : p.id)}
                      aria-label={`Nota para ${p.nombre}`}
                      aria-pressed={conNota === p.id}
                      className={`flex size-11 shrink-0 items-center justify-center rounded-lg border ${
                        renglon?.notas
                          ? 'border-marca-acento text-marca-acento-fuerte'
                          : 'border-marca-borde text-marca-texto-suave'
                      }`}
                    >
                      <IconoNota className="size-4" />
                    </button>
                  ) : null}

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => ajustar(p.id, -1)}
                      disabled={cantidad === 0}
                      aria-label={`Quitar ${p.nombre}`}
                      className="flex size-11 items-center justify-center rounded-lg border border-marca-borde text-marca-texto disabled:opacity-30"
                    >
                      <IconoMenos className="size-4" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold tabular-nums text-marca-texto">
                      {cantidad}
                    </span>
                    <button
                      type="button"
                      onClick={() => ajustar(p.id, 1)}
                      disabled={!p.disponible}
                      aria-label={`Agregar ${p.nombre}`}
                      className="flex size-11 items-center justify-center rounded-lg bg-marca-acento text-marca-acento-texto disabled:opacity-30"
                    >
                      <IconoMas className="size-4" />
                    </button>
                  </div>
                </div>

                {conNota === p.id ? (
                  <input
                    type="text"
                    autoFocus
                    value={renglon?.notas ?? ''}
                    onChange={(e) => anotar(p.id, e.target.value)}
                    placeholder="Sin cebolla, término medio…"
                    className="mt-2 min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 text-sm text-marca-texto"
                  />
                ) : null}
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}

function ChipCategoria({
  activa,
  onClick,
  texto,
}: {
  activa: boolean
  onClick: () => void
  texto: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`min-h-10 shrink-0 rounded-lg border px-3 text-xs font-medium ${
        activa
          ? 'border-transparent bg-panel-lateral text-marca-acento'
          : 'border-marca-borde text-marca-texto-suave'
      }`}
    >
      {texto}
    </button>
  )
}

/** Cuánto va el pedido según los precios de la carta. El cobro real lo hace la base. */
export function totalEstimado(renglones: Renglon[], productos: ProductoElegible[]): number {
  const precio = new Map(productos.map((p) => [p.id, p.precio]))
  return renglones.reduce((suma, r) => suma + (precio.get(r.producto_id) ?? 0) * r.cantidad, 0)
}
