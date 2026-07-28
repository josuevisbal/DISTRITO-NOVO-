import { NextResponse } from 'next/server'

import { restaurantePorSlug } from '@/lib/datos/restaurante'

export const dynamic = 'force-dynamic'

/**
 * Manifiesto del MENÚ DEL CLIENTE, aparte del de la app del equipo. Así el comensal
 * instala "Menú …" en su celular y abre directo en la carta, sin toparse nunca con el
 * área del personal (que tiene su propio manifiesto en /manifest.webmanifest).
 *
 * Se sirve por ruta y no con el `manifest.ts` de Next porque depende del slug: cada
 * restaurante de la plantilla instala el suyo, con su nombre y su logo.
 */
export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const restaurante = await restaurantePorSlug(slug)

  if (!restaurante) {
    return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })
  }

  // El logo que subió el dueño manda; si aún no hay, el ícono de la marca.
  const iconos = restaurante.logo_url
    ? [
        { src: restaurante.logo_url, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icono.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      ]
    : [{ src: '/icono.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]

  return NextResponse.json(
    {
      name: `Menú ${restaurante.nombre}`,
      short_name: restaurante.nombre,
      description: `Pide en ${restaurante.nombre} sin cuenta, desde tu celular`,
      id: `/${slug}`,
      start_url: `/${slug}`,
      scope: `/${slug}`,
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#141210',
      theme_color: '#E0872B',
      icons: iconos,
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  )
}
