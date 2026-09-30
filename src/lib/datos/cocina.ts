import type { Ticket } from '@/app/app/cocina/tablero-cocina'
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
 * Tickets de cocina: UNA tarjeta por pedido (y por ronda), con los platos de todas las
 * estaciones juntos y cada uno marcado con la suya. Solo lo ya disparado y aún en
 * cocina. Es la misma consulta para el cocinero y para el monitoreo del admin (la RLS
 * decide qué puede ver cada uno).
 */
export async function cargarTicketsCocina(
  estaciones: EstacionCocina[],
  ahora: Date,
): Promise<Ticket[]> {
  const supabase = await crearClienteServidor()
  const idsEstaciones = estaciones.map((e) => e.id)
  if (idsEstaciones.length === 0) return []

  const { data: comandas } = await supabase
    .from('comandas')
    .select(
      'id, pedido_id, estacion_id, estado, disparo_en, minutos, ronda, pedidos!inner(numero, canal, indicaciones, mesas(numero))',
    )
    .in('estacion_id', idsEstaciones)
    .in('estado', ['pendiente', 'preparando'])
    .lte('disparo_en', ahora.toISOString())
    .order('disparo_en')

  const pedidoIds = Array.from(new Set((comandas ?? []).map((c) => c.pedido_id)))

  const { data: items } = pedidoIds.length
    ? await supabase
        .from('pedido_items')
        .select('pedido_id, producto_id, estacion_id, nombre_snap, cantidad, notas, ronda')
        .in('pedido_id', pedidoIds)
        .in('estacion_id', idsEstaciones)
    : { data: [] }

  const ordenEstacion = new Map(estaciones.map((e, i) => [e.id, i]))
  const estacionDe = new Map(estaciones.map((e) => [e.id, e]))

  // Cada tarjeta lleva SOLO los renglones de su ronda. Si el mesero le sumó otra ronda a
  // una cuenta abierta, cocina recibe una tarjeta nueva y no vuelve a ver lo que ya
  // despachó en la primera. Los platos van agrupados por estación, en su orden.
  const itemsPorRonda = new Map<string, Ticket['items']>()
  const ordenados = [...(items ?? [])].sort(
    (a, b) => (ordenEstacion.get(a.estacion_id) ?? 0) - (ordenEstacion.get(b.estacion_id) ?? 0),
  )
  for (const it of ordenados) {
    const est = estacionDe.get(it.estacion_id)
    if (!est) continue
    const llave = `${it.pedido_id}·${it.ronda}`
    const lista = itemsPorRonda.get(llave) ?? []
    lista.push({
      producto_id: it.producto_id,
      nombre: it.nombre_snap,
      cantidad: it.cantidad,
      notas: it.notas,
      estacion: { nombre: est.nombre, color: est.color },
    })
    itemsPorRonda.set(llave, lista)
  }

  // Una tarjeta por pedido y ronda: junta las comandas de todas sus estaciones. El
  // cronómetro arranca con la primera que se disparó y el objetivo es el más largo.
  const tickets = new Map<string, Ticket>()
  for (const c of comandas ?? []) {
    const llave = `${c.pedido_id}·${c.ronda}`
    const objetivo = new Date(new Date(c.disparo_en).getTime() + c.minutos * 60000)
    const previo = tickets.get(llave)
    if (previo) {
      previo.comandas += 1
      if (c.estado === 'preparando') previo.estado = 'preparando'
      if (c.disparo_en < previo.disparo_en) previo.disparo_en = c.disparo_en
      if (objetivo.toISOString() > previo.objetivo_en) {
        previo.objetivo_en = objetivo.toISOString()
        previo.minutos = c.minutos
      }
      continue
    }
    tickets.set(llave, {
      pedido_id: c.pedido_id,
      ronda: c.ronda,
      comandas: 1,
      numero: c.pedidos.numero,
      mesa: c.pedidos.mesas?.numero ?? null,
      canal: c.pedidos.canal,
      indicaciones: c.pedidos.indicaciones,
      estado: c.estado,
      disparo_en: c.disparo_en,
      objetivo_en: objetivo.toISOString(),
      minutos: c.minutos,
      items: itemsPorRonda.get(llave) ?? [],
    })
  }

  return Array.from(tickets.values()).sort((a, b) => a.disparo_en.localeCompare(b.disparo_en))
}
