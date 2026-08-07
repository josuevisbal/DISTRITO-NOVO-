import { crearClienteServidor } from '@/lib/supabase/servidor'

export type Factura = {
  numero: number
  creado_en: string
  canal: string
  /**
   * Si el pedido ya se cobró. Cuando no, el documento sale como CUENTA DE COBRO: es la
   * que el mesero lleva a la mesa antes de pagar, o la que el domiciliario lleva en una
   * contraentrega. Cuando sí, sale como factura con el sello de PAGADO.
   */
  pagado: boolean
  mesa: number | null
  cliente: string | null
  telefono: string | null
  direccion: string | null
  zona: string | null
  medio_pago: string | null
  subtotal: number
  domicilio: number
  /** Lo que el cliente dejó de propina al pagar. Cero mientras la cuenta no se cobre. */
  propina: number
  total: number
  items: { nombre: string; cantidad: number; precio: number }[]
  restaurante: {
    nombre: string
    direccion: string | null
    whatsapp: string | null
  }
}

/**
 * Todo lo que lleva la factura que se le entrega al cliente. Los precios salen de los
 * `_snap` del pedido, que son los que se cobraron: si el plato cambió de precio después,
 * la factura sigue diciendo lo que el cliente pagó.
 */
export async function cargarFactura(
  pedidoId: string,
  restauranteId: string,
): Promise<Factura | null> {
  const supabase = await crearClienteServidor()

  const { data } = await supabase
    .from('pedidos')
    .select(
      'numero, creado_en, canal, estado, cliente_nombre, cliente_tel, direccion, medio_pago, subtotal, domicilio, propina, total, mesas(numero), zonas_domicilio(nombre), pagos(estado), pedido_items(nombre_snap, cantidad, precio_snap)',
    )
    .eq('id', pedidoId)
    .eq('restaurante_id', restauranteId)
    .maybeSingle()

  if (!data) return null

  const { data: rest } = await supabase
    .from('restaurantes')
    .select('nombre, direccion, whatsapp')
    .eq('id', restauranteId)
    .maybeSingle()

  return {
    numero: data.numero,
    creado_en: data.creado_en,
    canal: data.canal,
    // Cobrado = el pedido quedó cerrado en caja, o ya tiene un pago verificado
    // (la transferencia que caja aprobó antes de mandarlo a cocina).
    pagado:
      data.estado === 'cerrado' || (data.pagos ?? []).some((p) => p.estado === 'verificado'),
    mesa: data.mesas?.numero ?? null,
    cliente: data.cliente_nombre,
    telefono: data.cliente_tel,
    direccion: data.direccion,
    zona: data.zonas_domicilio?.nombre ?? null,
    medio_pago: data.medio_pago,
    subtotal: data.subtotal,
    domicilio: data.domicilio,
    propina: data.propina,
    total: data.total,
    items: (data.pedido_items ?? []).map((i) => ({
      nombre: i.nombre_snap,
      cantidad: i.cantidad,
      precio: i.precio_snap,
    })),
    restaurante: {
      nombre: rest?.nombre ?? '',
      direccion: rest?.direccion ?? null,
      whatsapp: rest?.whatsapp ?? null,
    },
  }
}
