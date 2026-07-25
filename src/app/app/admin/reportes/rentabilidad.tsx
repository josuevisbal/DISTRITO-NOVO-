'use client'

import { useState } from 'react'

import { IconoAlerta, IconoCheck } from '@/components/iconos'
import { formatearPesos } from '@/lib/formato'
import { guardarCosto } from './acciones'

export type FilaRentabilidad = {
  producto_id: string
  nombre: string
  unidades: number
  ventas: number
  costo_unitario: number
  utilidad: number
}

export type DatosRentabilidad = {
  dias: number
  ventas: number
  costo: number
  utilidad: number
  sin_costo: number
  por_producto: FilaRentabilidad[]
}

/**
 * Rentabilidad y costos. SOLO la ve el dueño: la página no la monta para otros roles y la
 * base rechaza a cualquier otro rol en `reporte_rentabilidad` y `actualizar_costo`.
 */
export function Rentabilidad({ datos }: { datos: DatosRentabilidad }) {
  const margen = datos.ventas > 0 ? Math.round((datos.utilidad / datos.ventas) * 100) : 0

  return (
    <section className="rounded-xl border-2 border-marca-acento bg-marca-superficie p-4">
      <h2 className="mb-1 font-titulo text-lg text-marca-texto">Rentabilidad y costos</h2>
      <p className="mb-4 text-xs text-marca-texto-suave">
        Solo tú ves esta sección. El margen se calcula con el costo que cargues por plato.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-marca-borde p-3">
          <p className="text-xs text-marca-texto-suave">Ventas</p>
          <p className="mt-0.5 font-titulo text-xl font-bold text-marca-texto">
            {formatearPesos(datos.ventas)}
          </p>
        </div>
        <div className="rounded-lg border border-marca-borde p-3">
          <p className="text-xs text-marca-texto-suave">Costo</p>
          <p className="mt-0.5 font-titulo text-xl font-bold text-marca-texto">
            {formatearPesos(datos.costo)}
          </p>
        </div>
        <div className="rounded-lg border border-marca-acento p-3">
          <p className="text-xs text-marca-texto-suave">Utilidad · margen {margen}%</p>
          <p className="mt-0.5 font-titulo text-xl font-bold text-marca-acento-fuerte">
            {formatearPesos(datos.utilidad)}
          </p>
        </div>
      </div>

      {datos.sin_costo > 0 ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-marca-texto-suave">
          <IconoAlerta className="size-4 shrink-0 text-marca-acento-fuerte" />
          {datos.sin_costo} {datos.sin_costo === 1 ? 'producto vendido no tiene' : 'productos vendidos no tienen'} costo
          cargado: su utilidad sale inflada.
        </p>
      ) : null}

      {datos.por_producto.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-marca-borde text-left text-xs text-marca-texto-suave">
                <th className="py-2 pr-3 font-normal">Producto</th>
                <th className="py-2 pr-3 text-right font-normal">Unid.</th>
                <th className="py-2 pr-3 text-right font-normal">Ventas</th>
                <th className="py-2 pr-3 text-right font-normal">Costo unit.</th>
                <th className="py-2 text-right font-normal">Utilidad</th>
              </tr>
            </thead>
            <tbody>
              {datos.por_producto.map((f) => (
                <FilaProducto key={f.producto_id} fila={f} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm text-marca-texto-suave">Sin ventas en el periodo.</p>
      )}
    </section>
  )
}

function FilaProducto({ fila }: { fila: FilaRentabilidad }) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(String(fila.costo_unitario || ''))
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    setOcupado(true)
    setError(null)
    const r = await guardarCosto(fila.producto_id, Number(valor) || 0)
    setOcupado(false)
    if (!r.ok) setError(r.error)
    else setEditando(false)
  }

  return (
    <tr className="border-b border-marca-borde/60">
      <td className="py-2 pr-3 text-marca-texto">
        {fila.nombre}
        {error ? (
          <span className="block text-xs text-marca-acento-fuerte">{error}</span>
        ) : null}
      </td>
      <td className="py-2 pr-3 text-right tabular-nums text-marca-texto-suave">{fila.unidades}</td>
      <td className="py-2 pr-3 text-right tabular-nums text-marca-texto">
        {formatearPesos(fila.ventas)}
      </td>
      <td className="py-2 pr-3 text-right">
        {editando ? (
          <span className="inline-flex items-center gap-1">
            <input
              autoFocus
              inputMode="numeric"
              value={valor}
              onChange={(e) => setValor(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') guardar()
                if (e.key === 'Escape') setEditando(false)
              }}
              className="min-h-9 w-24 rounded-lg border border-marca-acento bg-marca-fondo px-2 text-right tabular-nums text-marca-texto"
            />
            <button
              type="button"
              onClick={guardar}
              disabled={ocupado}
              aria-label="Guardar costo"
              className="flex size-9 items-center justify-center rounded-lg bg-marca-acento text-marca-acento-texto disabled:opacity-50"
            >
              <IconoCheck className="size-4" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="min-h-9 rounded-lg border border-dashed border-marca-borde px-2 tabular-nums text-marca-texto hover:border-marca-acento"
          >
            {fila.costo_unitario > 0 ? formatearPesos(fila.costo_unitario) : 'Poner costo'}
          </button>
        )}
      </td>
      <td className="py-2 text-right font-medium tabular-nums text-marca-acento-fuerte">
        {formatearPesos(fila.utilidad)}
      </td>
    </tr>
  )
}
