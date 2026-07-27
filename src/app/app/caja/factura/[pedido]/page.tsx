import { notFound } from 'next/navigation'

import { cargarFactura } from '@/lib/datos/factura'
import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { FacturaCliente } from './factura-cliente'

export const dynamic = 'force-dynamic'

/** Factura de un pedido, para imprimir y entregarle al cliente. */
export default async function PaginaFactura({
  params,
}: {
  params: Promise<{ pedido: string }>
}) {
  const { pedido } = await params
  const staff = await exigirRol('cajero', 'admin')

  const factura = await cargarFactura(pedido, staff.restaurante_id)
  if (!factura) notFound()

  const supabase = await crearClienteServidor()
  const { data: rest } = await supabase
    .from('restaurantes')
    .select('logo_url')
    .eq('id', staff.restaurante_id)
    .maybeSingle()

  return <FacturaCliente factura={factura} logo={rest?.logo_url ?? null} />
}
