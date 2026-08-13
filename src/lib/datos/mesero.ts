import type { CategoriaElegible, ProductoElegible } from '@/components/pedido/selector-productos'
import { crearClienteServidor } from '@/lib/supabase/servidor'

export type EstadoComandaMesa = 'pendiente' | 'preparando' | 'listo' | 'cancelada'

/** Cómo va cada cocina en un pedido: el mesero sabe qué falta sin preguntar. */
export type BarraEstacion = {
  estacion_id: string
  nombre: string
  color: string
  estado: EstadoComandaMesa | null
}

export type ItemPedidoMesa = {
  nombre: string
  cantidad: number
  estacion: string
  notas: string | null
}

export type PedidoMesa = {
  id: string
  numero: number
  mesa: number | null
  mesa_id: string | null
  estado: string
  creado_en: string
  /** Ya lo recogió y lo puso en la mesa. La cuenta sigue abierta para caja. */
  servido: boolean
  /** La mesa pidió otra ronda por el QR y todavía no la han mandado a cocina. */
  rondaPendiente: boolean
  total: number
  items: ItemPedidoMesa[]
  /** Solo lo que está por confirmar: la ronda que llegó y aún no va a cocina. */
  itemsPendientes: ItemPedidoMesa[]
  barras: BarraEstacion[]
}

export type MesaSalon = { id: string; numero: number }

export type DatosMesero = {
  /**
   * Esperan que el mesero los mande a cocina: la cuenta nueva de una mesa, y también
   * la cuenta ya abierta a la que le llegó otra ronda por el QR.
   */
  porConfirmar: PedidoMesa[]
  /** Ya están en cocina: el mesero ve qué estación va y cuál falta. */
  enCocina: PedidoMesa[]
  /** Cocina terminó: hay que ir por ellos y llevarlos a la mesa. */
  listos: PedidoMesa[]
  /** Cuentas abiertas del salón, para sumarles otra ronda sin cerrarlas. */
  cuentas: PedidoMesa[]
  mesas: MesaSalon[]
  categorias: CategoriaElegible[]
  productos: ProductoElegible[]
}

/**
 * Todo lo que ve el mesero, en una pasada: lo que entró por QR y espera confirmación,
 * lo que está en cocina, lo que ya salió y hay que llevar a la mesa, y las cuentas
 * abiertas a las que se les puede sumar otra ronda.
 *
 * La misma consulta la usa el monitoreo del admin, que la mira en modo solo lectura.
 */
export async function cargarMesero(restauranteId: string): Promise<DatosMesero> {
  const supabase = await crearClienteServidor()

  const [{ data: estaciones }, { data: mesas }, { data: categorias }, { data: productos }] =
    await Promise.all([
      supabase
        .from('estaciones')
        .select('id, nombre, color')
        .eq('restaurante_id', restauranteId)
        .eq('activa', true)
        .order('orden'),
      supabase
        .from('mesas')
        .select('id, numero')
        .eq('restaurante_id', restauranteId)
        .eq('activa', true)
        .order('numero'),
      supabase
        .from('categorias')
        .select('id, nombre')
        .eq('restaurante_id', restauranteId)
        .eq('activa', true)
        .order('orden'),
      supabase
        .from('productos')
        .select('id, nombre, precio, categoria_id, disponible')
        .eq('restaurante_id', restauranteId)
        .eq('activo', true)
        .order('orden'),
    ])

  // Todo lo del salón que sigue vivo: sin confirmar, en cocina o listo por recoger.
  const { data: pedidos } = await supabase
    .from('pedidos')
    .select(
      'id, numero, estado, creado_en, servido_en, ronda_pendiente_en, total, mesa_id, mesas(numero), comandas(estacion_id, estado, ronda), pedido_items(nombre_snap, cantidad, notas, ronda, estaciones(nombre))',
    )
    .eq('restaurante_id', restauranteId)
    .eq('canal', 'mesa')
    .in('estado', ['pendiente', 'en_cocina', 'listo'])
    .order('creado_en')

  const lista: PedidoMesa[] = (pedidos ?? []).map((p) => {
    // Una estación puede tener varias comandas (una por ronda): la que manda es la
    // más atrasada, porque el pedido no está listo hasta que salgan todas.
    const porEstacion = new Map<string, EstadoComandaMesa>()
    for (const c of p.comandas ?? []) {
      const previo = porEstacion.get(c.estacion_id)
      if (previo === undefined || (previo === 'listo' && c.estado !== 'listo')) {
        porEstacion.set(c.estacion_id, c.estado)
      }
    }

    // Una ronda ya fue a cocina cuando tiene comanda. Lo que no la tiene es
    // justo lo que el mesero debe revisar y confirmar.
    const rondasEnCocina = new Set((p.comandas ?? []).map((c) => c.ronda))
    const aItem = (i: (typeof p.pedido_items)[number]): ItemPedidoMesa => ({
      nombre: i.nombre_snap,
      cantidad: i.cantidad,
      estacion: i.estaciones?.nombre ?? '',
      notas: i.notas,
    })

    return {
      id: p.id,
      numero: p.numero,
      mesa: p.mesas?.numero ?? null,
      mesa_id: p.mesa_id,
      estado: p.estado,
      creado_en: p.creado_en,
      servido: p.servido_en !== null,
      rondaPendiente: p.ronda_pendiente_en !== null,
      total: p.total,
      items: (p.pedido_items ?? []).map(aItem),
      itemsPendientes: (p.pedido_items ?? [])
        .filter((i) => !rondasEnCocina.has(i.ronda))
        .map(aItem),
      barras: (estaciones ?? []).map((e) => ({
        estacion_id: e.id,
        nombre: e.nombre,
        color: e.color,
        estado: porEstacion.get(e.id) ?? null,
      })),
    }
  })

  return {
    // Una cuenta abierta con ronda nueva vuelve a "por confirmar" sin dejar de estar
    // donde está: el mesero tiene que ir a mandarla a cocina.
    porConfirmar: lista.filter((p) => p.estado === 'pendiente' || p.rondaPendiente),
    enCocina: lista.filter((p) => p.estado === 'en_cocina'),
    listos: lista.filter((p) => p.estado === 'listo' && !p.servido),
    cuentas: lista.filter((p) => p.estado !== 'pendiente'),
    mesas: mesas ?? [],
    categorias: categorias ?? [],
    productos: productos ?? [],
  }
}
