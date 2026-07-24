import { crearClienteServidor } from '@/lib/supabase/servidor'

/** Lo que la carta necesita de un producto. Sin costos: eso es solo del admin. */
export type ProductoCarta = {
  id: string
  nombre: string
  descripcion: string | null
  precio: number
  categoria_id: string
  estacion_id: string
  disponible: boolean
  foto_url: string | null
}

export type CategoriaCarta = { id: string; nombre: string; slug: string }
export type ZonaCarta = { id: string; nombre: string; valor: number }

export type PromocionCarta = {
  id: string
  tipo: 'envio' | 'combo' | 'aviso' | 'descuento'
  etiqueta: string | null
  titulo: string
  descripcion: string | null
  monto_minimo: number | null
  /** Productos que el combo mete al carrito de un toque. */
  items: { producto_id: string; cantidad: number }[]
}

export type Carta = {
  restaurante: { id: string; nombre: string; slug: string; whatsapp: string | null }
  categorias: CategoriaCarta[]
  productos: ProductoCarta[]
  promociones: PromocionCarta[]
  zonas: ZonaCarta[]
}

/**
 * Todo lo que se pinta en la carta pública, en una sola pasada.
 * La RLS ya limita a lo activo y visible; aquí no se filtra por restaurante a mano más
 * allá del id, porque cada instancia tiene su propia base.
 */
export async function cargarCarta(slug: string): Promise<Carta | null> {
  const supabase = await crearClienteServidor()

  const { data: restaurante } = await supabase
    .from('restaurantes')
    .select('id, nombre, slug, whatsapp')
    .eq('slug', slug)
    .eq('activo', true)
    .maybeSingle()

  if (!restaurante) return null

  const ahora = new Date().toISOString()

  const [{ data: categorias }, { data: productos }, { data: promociones }, { data: zonas }] =
    await Promise.all([
      supabase
        .from('categorias')
        .select('id, nombre, slug')
        .eq('restaurante_id', restaurante.id)
        .eq('activa', true)
        .order('orden'),
      supabase
        .from('productos')
        .select('id, nombre, descripcion, precio, categoria_id, estacion_id, disponible, foto_url')
        .eq('restaurante_id', restaurante.id)
        .eq('activo', true)
        .order('orden'),
      supabase
        .from('promociones')
        .select('id, tipo, etiqueta, titulo, descripcion, monto_minimo, orden, desde, hasta, promocion_items(producto_id, cantidad)')
        .eq('restaurante_id', restaurante.id)
        .eq('activa', true)
        .or(`desde.is.null,desde.lte.${ahora}`)
        .or(`hasta.is.null,hasta.gte.${ahora}`)
        .order('orden'),
      supabase
        .from('zonas_domicilio')
        .select('id, nombre, valor')
        .eq('restaurante_id', restaurante.id)
        .eq('activa', true)
        .order('valor'),
    ])

  return {
    restaurante,
    categorias: categorias ?? [],
    productos: productos ?? [],
    zonas: zonas ?? [],
    promociones: (promociones ?? []).map((p) => ({
      id: p.id,
      tipo: p.tipo,
      etiqueta: p.etiqueta,
      titulo: p.titulo,
      descripcion: p.descripcion,
      monto_minimo: p.monto_minimo,
      items: (p.promocion_items ?? []).map((i) => ({
        producto_id: i.producto_id,
        cantidad: i.cantidad,
      })),
    })),
  }
}
