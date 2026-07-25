'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ENLACES = [
  { href: '/app/admin/carta', texto: 'Carta' },
  { href: '/app/admin/promociones', texto: 'Promociones' },
  { href: '/app/admin/zonas', texto: 'Zonas' },
  { href: '/app/admin/usuarios', texto: 'Usuarios' },
  { href: '/app/admin/reportes', texto: 'Reportes' },
]

/** Pestañas del administrador. Marca en dorado la sección actual. */
export function NavAdmin() {
  const ruta = usePathname()
  return (
    <nav className="border-b border-marca-borde bg-marca-fondo">
      <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-3 py-2">
        {ENLACES.map((e) => {
          const activa = ruta === e.href
          return (
            <Link
              key={e.href}
              href={e.href}
              aria-current={activa ? 'page' : undefined}
              className={`min-h-10 shrink-0 rounded-lg px-3 py-2 text-sm transition-colors ${
                activa
                  ? 'bg-marca-acento font-semibold text-marca-acento-texto'
                  : 'text-marca-texto-suave hover:text-marca-texto'
              }`}
            >
              {e.texto}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
