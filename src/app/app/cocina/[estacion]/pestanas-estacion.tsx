'use client'

import { useEffect } from 'react'
import Link from 'next/link'

import { LLAVE_ESTACION } from '../recordar-estacion'

export type EstacionPestana = { slug: string; nombre: string; color: string }

/**
 * Pestañas para cambiar de estación sin salir de cocina. Recuerda la estación actual
 * en esta tablet, de modo que al recargar se entra directo a ella.
 */
export function PestanasEstacion({
  estaciones,
  actual,
}: {
  estaciones: EstacionPestana[]
  actual: string
}) {
  useEffect(() => {
    localStorage.setItem(LLAVE_ESTACION, actual)
  }, [actual])

  return (
    <nav
      aria-label="Estaciones"
      className="flex gap-2 overflow-x-auto border-b border-marca-borde bg-marca-superficie px-3 py-2"
    >
      {estaciones.map((e) => {
        const activa = e.slug === actual
        return (
          <Link
            key={e.slug}
            href={`/app/cocina/${e.slug}`}
            aria-current={activa ? 'page' : undefined}
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl border-2 px-4 text-sm font-semibold transition-colors"
            style={
              activa
                ? { backgroundColor: e.color, borderColor: e.color, color: '#fff' }
                : { borderColor: 'var(--marca-borde)', color: 'var(--marca-texto-suave)' }
            }
          >
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ backgroundColor: activa ? '#fff' : e.color }}
            />
            {e.nombre}
          </Link>
        )
      })}
    </nav>
  )
}
