import type { Database } from '@/lib/database.types'
import { ESTADOS_VIVOS } from '@/lib/estados-vivos'
import { crearClienteServidor } from '@/lib/supabase/servidor'

export type EstadoPedido = Database['public']['Enums']['estado_pedido']

export type PedidoVivo = {
  id: string
  numero: number
  estado: EstadoPedido
  canal: string
  mesa: number | null
  cliente: string | null
  total: number
  creado_en: string
  /** Comandas listas / totales, para los pedidos en cocina. */
  comandasListas: number
  comandasTotal: number
  unidades: number
}

/** Pedidos del momento, del más nuevo al más viejo. */
export async function cargarPedidosVivos(restauranteId: string): Promise<PedidoVivo[]> {
  const supabase = await crearClienteServidor()

  const { data } = await supabase
    .from('pedidos')
    .select(
      'id, numero, estado, canal, total, cliente_nombre, creado_en, mesas(numero), comandas(estado), pedido_items(cantidad)',
    )
    .eq('restaurante_id', restauranteId)
    .in('estado', ESTADOS_VIVOS)
    .order('creado_en', { ascending: false })

  return (data ?? []).map((p) => ({
    id: p.id,
    numero: p.numero,
    estado: p.estado,
    canal: p.canal,
    mesa: p.mesas?.numero ?? null,
    cliente: p.cliente_nombre,
    total: p.total,
    creado_en: p.creado_en,
    comandasListas: (p.comandas ?? []).filter((c) => c.estado === 'listo').length,
    comandasTotal: (p.comandas ?? []).length,
    unidades: (p.pedido_items ?? []).reduce((s, i) => s + i.cantidad, 0),
  }))
}
