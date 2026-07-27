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
  destacado: boolean
}

export type CategoriaCarta = { id: string; nombre: string; slug: string }
export type ZonaCarta = { id: string; nombre: string; valor: number }
export type EstacionCarta = { id: string; nombre: string; color: string }

export type PromocionCarta = {
  id: string
  tipo: 'envio' | 'combo' | 'aviso' | 'descuento'
  etiqueta: string | null
  titulo: string
  descripcion: string | null
  monto_minimo: number | null
  /** Precio especial del combo (lo fija el admin; lo cobra el servidor). */
  precio_combo: number | null
  imagen_url: string | null
  /** Productos que el combo mete al carrito de un toque. */
  items: { producto_id: string; cantidad: number }[]
}

/** Frases de la landing que el admin puede cambiar; sin valor se usan las de plantilla. */
export type FrasesLanding = {
  script?: string
  titulo_blanco?: string
  titulo_naranja?: string
  bienvenida?: string
  nosotros_titulo?: string
  nosotros_texto?: string
  /** Recuadro naranja del "sobre nosotros": el dato grande ("10+") y su texto. */
  dato?: string
  dato_texto?: string
}

export type Carta = {
  restaurante: {
    id: string
    nombre: string
    slug: string
    whatsapp: string | null
    /** Logo subido desde el panel; se muestra en marco circular degradado. */
    logo_url: string | null
    portada_url: string | null
    /** Video de fondo del héroe. Si no hay, manda la foto de portada. */
    hero_video_url: string | null
    foto_local_url: string | null
    direccion: string | null
    horario: string | null
    landing: FrasesLanding
  }
  categorias: CategoriaCarta[]
  productos: ProductoCarta[]
  promociones: PromocionCarta[]
  zonas: ZonaCarta[]
  estaciones: EstacionCarta[]
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
    .select(
      'id, nombre, slug, whatsapp, logo_url, portada_url, hero_video_url, foto_local_url, direccion, horario, landing',
    )
    .eq('slug', slug)
    .eq('activo', true)
    .maybeSingle()

  if (!restaurante) return null

  const ahora = new Date().toISOString()

  const [
    { data: categorias },
    { data: productos },
    { data: promociones },
    { data: zonas },
    { data: estaciones },
  ] = await Promise.all([
      supabase
        .from('categorias')
        .select('id, nombre, slug')
        .eq('restaurante_id', restaurante.id)
        .eq('activa', true)
        .order('orden'),
      supabase
        .from('productos')
        .select('id, nombre, descripcion, precio, categoria_id, estacion_id, disponible, foto_url, destacado')
        .eq('restaurante_id', restaurante.id)
        .eq('activo', true)
        .order('orden'),
      supabase
        .from('promociones')
        .select('id, tipo, etiqueta, titulo, descripcion, monto_minimo, precio_combo, imagen_url, orden, desde, hasta, promocion_items(producto_id, cantidad)')
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
      supabase
        .from('estaciones')
        .select('id, nombre, color')
        .eq('restaurante_id', restaurante.id)
        .eq('activa', true)
        .order('orden'),
    ])

  return {
    restaurante: {
      ...restaurante,
      landing: (restaurante.landing ?? {}) as FrasesLanding,
    },
    categorias: categorias ?? [],
    productos: productos ?? [],
    zonas: zonas ?? [],
    estaciones: estaciones ?? [],
    promociones: (promociones ?? []).map((p) => ({
      id: p.id,
      tipo: p.tipo,
      etiqueta: p.etiqueta,
      titulo: p.titulo,
      descripcion: p.descripcion,
      monto_minimo: p.monto_minimo,
      precio_combo: p.precio_combo,
      imagen_url: p.imagen_url,
      items: (p.promocion_items ?? []).map((i) => ({
        producto_id: i.producto_id,
        cantidad: i.cantidad,
      })),
    })),
  }
}
