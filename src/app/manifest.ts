import type { MetadataRoute } from 'next'

/**
 * Manifiesto PWA para instalar el sistema en las tablets de cocina y el celular del
 * domiciliario, en modo pantalla completa. El nombre es genérico (una instancia por
 * restaurante); la marca la lleva cada pantalla desde el tema.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pedidos',
    short_name: 'Pedidos',
    description: 'Sistema de pedidos multicocina',
    start_url: '/app',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F6F3EC',
    theme_color: '#B8862B',
    icons: [{ src: '/icono.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  }
}
