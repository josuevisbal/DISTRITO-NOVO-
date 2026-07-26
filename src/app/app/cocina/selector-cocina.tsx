'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { IconoFuego } from '@/components/iconos'
import { LLAVE_ESTACION } from './recordar-estacion'

export type EstacionSelector = { slug: string; nombre: string; color: string }

/**
 * Pantalla de entrada de cocina: elige la estación de esta tablet. Recuerda la última
 * elegida y salta directo a ella al recargar; la primera vez muestra los tres botones.
 * Cambiar de estación luego se hace con las pestañas dentro del tablero.
 */
export function SelectorCocina({ estaciones }: { estaciones: EstacionSelector[] }) {
  const router = useRouter()
  const [listo, setListo] = useState(false)

  useEffect(() => {
    const ultima = localStorage.getItem(LLAVE_ESTACION)
    if (ultima && estaciones.some((e) => e.slug === ultima)) {
      router.replace(`/app/cocina/${ultima}`)
      return
    }
    setListo(true)
  }, [estaciones, router])

  // Mientras se decide si hay estación recordada, no parpadeamos el selector.
  if (!listo) return null

  return (
    <main className="mx-auto max-w-2xl p-4">
      <p className="mb-4 text-sm text-marca-texto-suave">Escoge la estación de esta pantalla:</p>
      <ul className="grid gap-3 sm:grid-cols-3">
        {estaciones.map((e, i) => (
          <li key={e.slug} className="entra" style={{ '--i': i } as CSSProperties}>
            <Link
              href={`/app/cocina/${e.slug}`}
              onClick={() => localStorage.setItem(LLAVE_ESTACION, e.slug)}
              className="flex min-h-28 flex-col justify-between rounded-2xl border-2 p-4 transition-transform hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:transform-none"
              style={{ borderColor: e.color }}
            >
              <span
                aria-hidden
                className="flex size-10 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: e.color }}
              >
                <IconoFuego className="size-5" />
              </span>
              <span className="font-titulo text-lg text-marca-texto">{e.nombre}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
