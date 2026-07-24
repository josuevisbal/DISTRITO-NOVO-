import { notFound } from 'next/navigation'

import { pedidoPorToken } from '@/lib/datos/pedido'
import { restaurantePorSlug } from '@/lib/datos/restaurante'
import { SeguimientoCliente } from './seguimiento-cliente'

export const dynamic = 'force-dynamic'

export default async function PaginaSeguimiento({
  params,
}: {
  params: Promise<{ slug: string; token: string }>
}) {
  const { slug, token } = await params

  const [restaurante, pedido] = await Promise.all([
    restaurantePorSlug(slug),
    pedidoPorToken(token),
  ])

  if (!restaurante || !pedido) notFound()

  return (
    <SeguimientoCliente
      token={token}
      inicial={pedido}
      pago={{ llave: restaurante.llave_pago, cuenta: restaurante.cuenta_pago }}
    />
  )
}
