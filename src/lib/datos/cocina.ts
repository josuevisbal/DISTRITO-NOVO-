import type { Ticket } from '@/app/app/cocina/[estacion]/tablero-cocina'
import { crearClienteServidor } from '@/lib/supabase/servidor'

export type EstacionCocina = { id: string; slug: string; nombre: string; color: string }

/** Estaciones activas del restaurante, en orden. */
export async function cargarEstaciones(restauranteId: string): Promise<EstacionCocina[]> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('estaciones')
    .select('id, slug, nombre, color')
    .eq('restaurante_id', restauranteId)
    .eq('activa', true)
    .order('orden')
  return data ?? []
}

/**
 * Tickets de una estación: solo lo ya disparado y aún en cocina. Es la misma consulta
 * para el cocinero y para el monitoreo del admin (la RLS decide qué puede ver cada uno).
 */
export async function cargarTicketsEstacion(
  estacionId: string,
  ahora: Date,
): Promise<Ticket[]> {
  const supabase = await crearClienteServidor()

  const { data: comandas } = await supabase
    .from('comandas')
    .select('id, pedido_id, estado, disparo_en, minutos, ronda, pedidos!inner(numero, canal, mesas(numero))')
    .eq('estacion_id', estacionId)
    .in('estado', ['pendiente', 'preparando'])
    .lte('disparo_en', ahora.toISOString())
    .order('disparo_en')

  const pedidoIds = (comandas ?? []).map((c) => c.pedido_id)

  const { data: items } = pedidoIds.length
    ? await supabase
        .from('pedido_items')
        .select('pedido_id, producto_id, nombre_snap, cantidad, notas, ronda')
        .in('pedido_id', pedidoIds)
        .eq('estacion_id', estacionId)
    : { data: [] }

  // Cada comanda lleva SOLO los renglones de su ronda. Si el mesero le sumó otra ronda a
  // una cuenta abierta, la cocina recibe una comanda nueva y no vuelve a ver lo que ya
  // despachó en la primera.
  const itemsPorRonda = new Map<string, Ticket['items']>()
  for (const it of items ?? []) {
    const llave = `${it.pedido_id}·${it.ronda}`
    const lista = itemsPorRonda.get(llave) ?? []
    lista.push({
      producto_id: it.producto_id,
      nombre: it.nombre_snap,
      cantidad: it.cantidad,
      notas: it.notas,
    })
    itemsPorRonda.set(llave, lista)
  }

  return (comandas ?? []).map((c) => ({
    comanda_id: c.id,
    numero: c.pedidos.numero,
    mesa: c.pedidos.mesas?.numero ?? null,
    canal: c.pedidos.canal,
    estado: c.estado,
    ronda: c.ronda,
    disparo_en: c.disparo_en,
    objetivo_en: new Date(new Date(c.disparo_en).getTime() + c.minutos * 60000).toISOString(),
    minutos: c.minutos,
    items: itemsPorRonda.get(`${c.pedido_id}·${c.ronda}`) ?? [],
  }))
}
