import type { Entrega } from '@/app/app/domicilios/domicilios-cliente'
import { crearClienteServidor } from '@/lib/supabase/servidor'

/**
 * Entregas en reparto (en despacho o en camino). El domiciliario ve solo las suyas
 * (se filtra por `domiId`); el admin las ve todas, con el nombre de quién las lleva,
 * para el monitoreo en modo solo lectura.
 */
export async function cargarEntregas(
  restauranteId: string,
  domiId?: string,
): Promise<Entrega[]> {
  const supabase = await crearClienteServidor()

  let consulta = supabase
    .from('pedidos')
    .select(
      'id, numero, estado, cliente_nombre, cliente_tel, direccion, indicaciones, total, medio_pago, nota_entrega, zonas_domicilio(nombre), usuarios!pedidos_domiciliario_id_fkey(nombre), pedido_items(nombre_snap, cantidad), pagos(estado)',
    )
    .eq('restaurante_id', restauranteId)
    .in('estado', ['en_despacho', 'en_camino'])
    .order('creado_en')

  if (domiId) consulta = consulta.eq('domiciliario_id', domiId)

  const { data } = await consulta

  return (data ?? []).map((p) => ({
    pedido_id: p.id,
    numero: p.numero,
    estado: p.estado as 'en_despacho' | 'en_camino',
    cliente: p.cliente_nombre,
    telefono: p.cliente_tel,
    direccion: p.direccion,
    indicaciones: p.indicaciones,
    zona: p.zonas_domicilio?.nombre ?? null,
    total: p.total,
    // "Pago" = no es efectivo, o ya hay un pago verificado (transferencia aprobada).
    pagado: p.medio_pago !== 'efectivo' || (p.pagos ?? []).some((x) => x.estado === 'verificado'),
    nota_entrega: p.nota_entrega,
    items: (p.pedido_items ?? []).map((i) => ({ nombre: i.nombre_snap, cantidad: i.cantidad })),
    domiciliario: p.usuarios?.nombre ?? null,
  }))
}
