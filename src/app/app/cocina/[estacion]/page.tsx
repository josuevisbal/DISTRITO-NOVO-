import { notFound } from 'next/navigation'

import { BarraStaff } from '@/components/barra-staff'
import { MarcoOscuro } from '@/components/marco-oscuro'
import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { TableroCocina, type Ticket } from './tablero-cocina'

export const dynamic = 'force-dynamic'

export default async function PaginaEstacion({
  params,
}: {
  params: Promise<{ estacion: string }>
}) {
  const { estacion } = await params
  const staff = await exigirRol('cocina', 'admin', 'pase')
  const supabase = await crearClienteServidor()

  const { data: est } = await supabase
    .from('estaciones')
    .select('id, nombre, color')
    .eq('restaurante_id', staff.restaurante_id)
    .eq('slug', estacion)
    .maybeSingle()

  if (!est) notFound()

  const ahora = new Date()

  // Solo lo que ya está disparado y aún en cocina. La RLS ya recorta a la estación del
  // usuario de cocina; el filtro explícito hace que admin y pase vean el mismo tablero.
  const { data: comandas } = await supabase
    .from('comandas')
    .select('id, pedido_id, estado, disparo_en, minutos, pedidos!inner(numero, canal, mesas(numero))')
    .eq('estacion_id', est.id)
    .in('estado', ['pendiente', 'preparando'])
    .lte('disparo_en', ahora.toISOString())
    .order('disparo_en')

  const pedidoIds = (comandas ?? []).map((c) => c.pedido_id)

  const { data: items } = pedidoIds.length
    ? await supabase
        .from('pedido_items')
        .select('pedido_id, producto_id, nombre_snap, cantidad, notas')
        .in('pedido_id', pedidoIds)
        .eq('estacion_id', est.id)
    : { data: [] }

  const itemsPorPedido = new Map<string, Ticket['items']>()
  for (const it of items ?? []) {
    const lista = itemsPorPedido.get(it.pedido_id) ?? []
    lista.push({
      producto_id: it.producto_id,
      nombre: it.nombre_snap,
      cantidad: it.cantidad,
      notas: it.notas,
    })
    itemsPorPedido.set(it.pedido_id, lista)
  }

  const tickets: Ticket[] = (comandas ?? []).map((c) => ({
    comanda_id: c.id,
    numero: c.pedidos.numero,
    mesa: c.pedidos.mesas?.numero ?? null,
    canal: c.pedidos.canal,
    estado: c.estado,
    disparo_en: c.disparo_en,
    objetivo_en: new Date(new Date(c.disparo_en).getTime() + c.minutos * 60000).toISOString(),
    items: itemsPorPedido.get(c.pedido_id) ?? [],
  }))

  return (
    <MarcoOscuro>
      <BarraStaff staff={staff} titulo={`Cocina · ${est.nombre}`} />
      <TableroCocina tickets={tickets} color={est.color} servidorAhoraISO={ahora.toISOString()} />
    </MarcoOscuro>
  )
}
