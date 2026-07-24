import { notFound } from 'next/navigation'

import { cargarCarta } from '@/lib/datos/carta'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { CartaCliente } from '../../carta-cliente'

export const dynamic = 'force-dynamic'

/**
 * La misma carta, pero atada a una mesa por su QR. El pedido entra por el canal 'mesa' y
 * queda 'pendiente' hasta que el mesero lo confirma: nada de precios ni pagos aquí.
 */
export default async function PaginaMesa({
  params,
}: {
  params: Promise<{ slug: string; qr_token: string }>
}) {
  const { slug, qr_token } = await params

  const carta = await cargarCarta(slug)
  if (!carta) notFound()

  const supabase = await crearClienteServidor()
  const { data: mesa } = await supabase
    .from('mesas')
    .select('id, numero')
    .eq('restaurante_id', carta.restaurante.id)
    .eq('qr_token', qr_token)
    .eq('activa', true)
    .maybeSingle()

  if (!mesa) notFound()

  return <CartaCliente carta={carta} mesa={mesa} />
}
