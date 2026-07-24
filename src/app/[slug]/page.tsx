import { notFound } from 'next/navigation'

import { cargarCarta } from '@/lib/datos/carta'
import { CartaCliente } from './carta-cliente'

export const dynamic = 'force-dynamic'

export default async function PaginaCarta({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const carta = await cargarCarta(slug)
  if (!carta) notFound()

  return <CartaCliente carta={carta} />
}
