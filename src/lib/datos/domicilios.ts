import type { Entrega } from '@/app/app/domicilios/domicilios-cliente'
import { crearClienteServidor } from '@/lib/supabase/servidor'

/**
 * Entregas en reparto (en despacho o en camino). Caja no reparte: suelta el pedido al
 * mostrador y ahí queda sin dueño hasta que un domiciliario lo tome. Por eso el
 * domiciliario ve dos cosas —lo que ya tomó y lo que está en el mostrador— y nada de lo
 * que otro se llevó. El admin las ve todas, con el nombre de quién las lleva, para el
 * monitoreo en modo solo lectura.
 */
export async function cargarEntregas(
  restauranteId: string,
  domiId?: string,
): Promise<Entrega[]> {
  const supabase = await crearClienteServidor()

  let consulta = supabase
    .from('pedidos')
    .select(
      'id, numero, estado, domiciliario_id, cliente_nombre, cliente_tel, direccion, indicaciones, total, medio_pago, nota_entrega, pago_cambiado_en, zonas_domicilio(nombre), usuarios!pedidos_domiciliario_id_fkey(nombre), pedido_items(nombre_snap, cantidad), pagos(estado, medio, monto)',
    )
    .eq('restaurante_id', restauranteId)
    .in('estado', ['en_despacho', 'en_camino'])
    .order('creado_en')

  // Lo suyo y lo que está libre en el mostrador. Lo de otros no le sirve de nada.
  if (domiId) consulta = consulta.or(`domiciliario_id.eq.${domiId},domiciliario_id.is.null`)

  const { data } = await consulta

  return (data ?? []).map((p) => {
    // Lo que falta por pagar, medio por medio. Con pago dividido el domiciliario cobra
    // solo su parte en efectivo; la otra la transfiere el cliente y la verifica caja.
    const pendientes = (p.pagos ?? []).filter((g) => g.estado === 'pendiente')
    const sumar = (medio: string) =>
      pendientes.filter((g) => g.medio === medio).reduce((s, g) => s + g.monto, 0)
    const efectivoPendiente = sumar('efectivo')
    const transferenciaPendiente = sumar('transferencia')

    return {
    pedido_id: p.id,
    domiciliario_id: p.domiciliario_id,
    numero: p.numero,
    estado: p.estado as 'en_despacho' | 'en_camino',
    cliente: p.cliente_nombre,
    telefono: p.cliente_tel,
    direccion: p.direccion,
    indicaciones: p.indicaciones,
    zona: p.zonas_domicilio?.nombre ?? null,
    total: p.total,
    // Nada que cobrar en la calle: o ya está todo pago, o lo que falta lo transfiere
    // el cliente y lo verifica caja.
    pagado: pendientes.length === 0,
    efectivoPendiente,
    transferenciaPendiente,
    nota_entrega: p.nota_entrega,
    items: (p.pedido_items ?? []).map((i) => ({ nombre: i.nombre_snap, cantidad: i.cantidad })),
    domiciliario: p.usuarios?.nombre ?? null,
    }
  })
}
