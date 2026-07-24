import { crearClienteConToken } from '@/lib/supabase/token'

export type PedidoSeguimiento = {
  numero: number
  estado: string
  canal: string
  medio_pago: string | null
  subtotal: number
  domicilio: number
  total: number
  codigo_pago: number | null
  monto_exacto: number | null
  cliente_nombre: string | null
  direccion: string | null
  creado_en: string
  items: { nombre_snap: string; cantidad: number; notas: string | null }[]
}

/**
 * Lee un pedido con su token. El token es la única llave del comensal: viaja en la cabecera
 * y la RLS lo compara contra `pedidos.token`, así que sin el token correcto no hay pedido.
 */
export async function pedidoPorToken(token: string): Promise<PedidoSeguimiento | null> {
  const supabase = crearClienteConToken(token)

  const { data } = await supabase
    .from('pedidos')
    .select(
      'numero, estado, canal, medio_pago, subtotal, domicilio, total, codigo_pago, monto_exacto, cliente_nombre, direccion, creado_en, pedido_items(nombre_snap, cantidad, notas)',
    )
    .eq('token', token)
    .maybeSingle()

  if (!data) return null

  return {
    numero: data.numero,
    estado: data.estado,
    canal: data.canal,
    medio_pago: data.medio_pago,
    subtotal: data.subtotal,
    domicilio: data.domicilio,
    total: data.total,
    codigo_pago: data.codigo_pago,
    monto_exacto: data.monto_exacto,
    cliente_nombre: data.cliente_nombre,
    direccion: data.direccion,
    creado_en: data.creado_en,
    items: (data.pedido_items ?? []).map((i) => ({
      nombre_snap: i.nombre_snap,
      cantidad: i.cantidad,
      notas: i.notas,
    })),
  }
}
