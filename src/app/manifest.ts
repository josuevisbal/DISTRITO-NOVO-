import type { MetadataRoute } from 'next'

import { crearClienteServidor } from '@/lib/supabase/servidor'

/**
 * Manifiesto de la APP DEL EQUIPO: se instala en las tablets de cocina, el celular del
 * domiciliario y la caja, y abre directo en /app.
 *
 * El menú del cliente tiene el suyo aparte (/[slug]/manifest.webmanifest) para que el
 * comensal instale "Menú …" y no termine con la app del personal en su teléfono.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('restaurantes')
    .select('nombre')
    .eq('activo', true)
    .order('creado_en')
    .limit(1)
    .maybeSingle()

  const nombre = data?.nombre ?? 'Pedidos'

  return {
    name: `App ${nombre}`,
    short_name: 'App',
    description: 'Área del equipo: cocina, caja, pase y domicilios',
    id: '/app',
    start_url: '/app',
    scope: '/app',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0B0B0C',
    theme_color: '#B8862B',
    icons: [{ src: '/icono.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  }
}
