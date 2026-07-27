import { notFound } from 'next/navigation'

import { cargarCarta } from '@/lib/datos/carta'
import { LandingCliente } from './landing'

export const dynamic = 'force-dynamic'

/** Pantalla 1 — la bienvenida que vende. El menú con carrito vive en /[slug]/menu. */
export default async function PaginaBienvenida({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const carta = await cargarCarta(slug)
  if (!carta) notFound()

  return <LandingCliente carta={carta} />
}
