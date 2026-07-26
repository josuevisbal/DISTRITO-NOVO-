import type { Despacho, Domiciliario, PedidoPase } from '@/app/app/pase/pase-cliente'
import { crearClienteServidor } from '@/lib/supabase/servidor'

export type DatosPase = {
  pedidos: PedidoPase[]
  despachos: Despacho[]
  domiciliarios: Domiciliario[]
}

/**
 * Todo lo que ve el pase: pedidos en cocina/listos con el estado de sus estaciones,
 * y los domicilios liberados por asignar. Misma consulta para el pase y para el
 * monitoreo del admin (que lo mira en modo solo lectura).
 */
export async function cargarPase(restauranteId: string): Promise<DatosPase> {
  const supabase = await crearClienteServidor()

  const [{ data: estaciones }, { data: domiciliarios }] = await Promise.all([
    supabase
      .from('estaciones')
      .select('id, nombre, color')
      .eq('restaurante_id', restauranteId)
      .eq('activa', true)
      .order('orden'),
    supabase
      .from('usuarios')
      .select('id, nombre')
      .eq('restaurante_id', restauranteId)
      .eq('rol', 'domiciliario')
      .eq('activo', true)
      .order('nombre'),
  ])

  // Todo lo que está en cocina o ya listo, con sus comandas por estación.
  const { data: pedidos } = await supabase
    .from('pedidos')
    .select('id, numero, canal, estado, mesas(numero), zonas_domicilio(nombre), comandas(estacion_id, estado), pedido_items(nombre_snap)')
    .eq('restaurante_id', restauranteId)
    .in('estado', ['en_cocina', 'listo'])
    .order('objetivo_en', { nullsFirst: false })

  // Domicilios liberados que esperan (o ya tienen) un domiciliario.
  const { data: despachos } = await supabase
    .from('pedidos')
    .select('id, numero, direccion, nota_entrega, domiciliario_id, usuarios!pedidos_domiciliario_id_fkey(nombre), zonas_domicilio(nombre)')
    .eq('restaurante_id', restauranteId)
    .eq('canal', 'domicilio')
    .eq('estado', 'en_despacho')
    .order('creado_en')

  const lista: PedidoPase[] = (pedidos ?? []).map((p) => {
    const porEstacion = new Map((p.comandas ?? []).map((c) => [c.estacion_id, c.estado]))
    return {
      id: p.id,
      numero: p.numero,
      mesa: p.mesas?.numero ?? null,
      canal: p.canal,
      zona: p.zonas_domicilio?.nombre ?? null,
      estado: p.estado,
      listo: p.estado === 'listo',
      productos:
        [...new Set((p.pedido_items ?? []).map((i) => i.nombre_snap))].slice(0, 3).join(' · ') ||
        null,
      // Una barra por cada estación del restaurante; en gris la que este pedido no toca.
      barras: (estaciones ?? []).map((e) => ({
        estacion_id: e.id,
        nombre: e.nombre,
        color: e.color,
        estado: porEstacion.get(e.id) ?? null,
      })),
    }
  })

  const enDespacho: Despacho[] = (despachos ?? []).map((p) => ({
    id: p.id,
    numero: p.numero,
    direccion: p.direccion,
    zona: p.zonas_domicilio?.nombre ?? null,
    nota_entrega: p.nota_entrega,
    domiciliario_id: p.domiciliario_id,
    domiciliario_nombre: p.usuarios?.nombre ?? null,
  }))

  return { pedidos: lista, despachos: enDespacho, domiciliarios: domiciliarios ?? [] }
}
