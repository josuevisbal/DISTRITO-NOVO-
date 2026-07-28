'use client'

import Link from 'next/link'

/**
 * Pestañas de un módulo del panel (p. ej. Menú Digital: Carta / Página de inicio).
 * La activa va en negro con el dorado de marca; las demás con borde fino. Navegación
 * real por rutas, así cada sub-sección conserva su propia URL.
 */
export function PestanasModulo({
  opciones,
  activa,
}: {
  opciones: { href: string; etiqueta: string }[]
  activa: string
}) {
  return (
    <nav aria-label="Secciones del módulo" className="flex flex-wrap gap-2">
      {opciones.map((o) => {
        const esta = o.href === activa
        return (
          <Link
            key={o.href}
            href={o.href}
            aria-current={esta ? 'page' : undefined}
            className={`flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium transition-colors ${
              esta
                ? 'border-transparent bg-panel-lateral text-marca-acento'
                : 'border-marca-borde bg-marca-superficie text-marca-texto-suave hover:text-marca-texto'
            }`}
          >
            {o.etiqueta}
          </Link>
        )
      })}
    </nav>
  )
}
