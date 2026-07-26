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
  telefono: string | null
  direccion: string | null
  zona: string | null
  total: number
  creado_en: string
  /** Comandas listas / totales, para los pedidos en cocina. */
  comandasListas: number
  comandasTotal: number
  unidades: number
  /** Qué lleva: "2× Salchipapa · 1× Agua". */
  productos: { nombre: string; cantidad: number }[]
}

/** Pedidos del momento, del más nuevo al más viejo, con su detalle completo. */
export async function cargarPedidosVivos(restauranteId: string): Promise<PedidoVivo[]> {
  const supabase = await crearClienteServidor()

  const { data } = await supabase
    .from('pedidos')
    .select(
      'id, numero, estado, canal, total, cliente_nombre, cliente_tel, direccion, creado_en, mesas(numero), zonas_domicilio(nombre), comandas(estado), pedido_items(nombre_snap, cantidad)',
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
    telefono: p.cliente_tel,
    direccion: p.direccion,
    zona: p.zonas_domicilio?.nombre ?? null,
    total: p.total,
    creado_en: p.creado_en,
    comandasListas: (p.comandas ?? []).filter((c) => c.estado === 'listo').length,
    comandasTotal: (p.comandas ?? []).length,
    unidades: (p.pedido_items ?? []).reduce((s, i) => s + i.cantidad, 0),
    productos: (p.pedido_items ?? []).map((i) => ({ nombre: i.nombre_snap, cantidad: i.cantidad })),
  }))
}
