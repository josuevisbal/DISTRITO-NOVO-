import { notFound } from 'next/navigation'

import { cargarCarta } from '@/lib/datos/carta'
import { CartaCliente } from '../carta-cliente'

export const dynamic = 'force-dynamic'

/**
 * Pantalla 2 — el menú que DESPACHA: categorías, platos, carrito y checkout.
 * La bienvenida que vende vive en /[slug]; el QR de mesa entra directo aquí
 * por su propia ruta (/[slug]/mesa/[qr_token]).
 */
export default async function PaginaMenu({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const carta = await cargarCarta(slug)
  if (!carta) notFound()

  return <CartaCliente carta={carta} />
}
