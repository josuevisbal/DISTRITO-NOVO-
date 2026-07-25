'use server'

import { revalidatePath } from 'next/cache'

import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'

type Resultado = { ok: true } | { ok: false; error: string }

const BUCKET = 'productos'
const TIPOS = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

/** Devuelve la ruta dentro del bucket a partir de una URL pública, o null. */
function rutaDeUrl(url: string | null): string | null {
  if (!url) return null
  const marca = `/object/public/${BUCKET}/`
  const i = url.indexOf(marca)
  return i === -1 ? null : url.slice(i + marca.length)
}

/**
 * Sube (o reemplaza) la foto de un producto. El archivo va a Supabase Storage con la sesión
 * del propio admin —la RLS del bucket exige rol admin— y se guarda su URL en el producto.
 * Si el plato ya tenía foto, se borra la anterior.
 */
export async function subirFotoProducto(productoId: string, form: FormData): Promise<Resultado> {
  const staff = await exigirRol('admin')
  const archivo = form.get('foto')

  if (!(archivo instanceof File) || archivo.size === 0) {
    return { ok: false, error: 'Escoge una imagen.' }
  }
  if (!TIPOS.includes(archivo.type)) {
    return { ok: false, error: 'La imagen debe ser JPG, PNG o WebP.' }
  }
  if (archivo.size > MAX_BYTES) {
    return { ok: false, error: 'La imagen pesa más de 5 MB.' }
  }

  const supabase = await crearClienteServidor()
  const { data: producto } = await supabase
    .from('productos')
    .select('id, foto_url, restaurante_id')
    .eq('id', productoId)
    .maybeSingle()

  if (!producto || producto.restaurante_id !== staff.restaurante_id) {
    return { ok: false, error: 'Producto no encontrado.' }
  }

  const ext = archivo.type === 'image/png' ? 'png' : archivo.type === 'image/webp' ? 'webp' : 'jpg'
  // Nombre único por subida: evita que el navegador muestre la foto vieja en caché.
  const ruta = `${staff.restaurante_id}/${productoId}-${Date.now()}.${ext}`

  const bytes = new Uint8Array(await archivo.arrayBuffer())
  const subida = await supabase.storage
    .from(BUCKET)
    .upload(ruta, bytes, { contentType: archivo.type, upsert: true })
  if (subida.error) return { ok: false, error: subida.error.message }

  const { data: publica } = supabase.storage.from(BUCKET).getPublicUrl(ruta)

  const { error } = await supabase
    .from('productos')
    .update({ foto_url: publica.publicUrl })
    .eq('id', productoId)
  if (error) return { ok: false, error: error.message }

  // Borra la foto anterior para no acumular basura en el bucket.
  const anterior = rutaDeUrl(producto.foto_url)
  if (anterior && anterior !== ruta) {
    await supabase.storage.from(BUCKET).remove([anterior])
  }

  revalidatePath('/app/admin/carta')
  return { ok: true }
}

/** Quita la foto de un producto: la borra del bucket y limpia la URL. */
export async function quitarFotoProducto(productoId: string): Promise<Resultado> {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()

  const { data: producto } = await supabase
    .from('productos')
    .select('foto_url, restaurante_id')
    .eq('id', productoId)
    .maybeSingle()
  if (!producto || producto.restaurante_id !== staff.restaurante_id) {
    return { ok: false, error: 'Producto no encontrado.' }
  }

  const ruta = rutaDeUrl(producto.foto_url)
  if (ruta) {
    await supabase.storage.from(BUCKET).remove([ruta])
  }

  const { error } = await supabase
    .from('productos')
    .update({ foto_url: null })
    .eq('id', productoId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/admin/carta')
  return { ok: true }
}

/** Enciende o apaga un interruptor booleano del producto (destacado / disponible). */
export async function alternarProducto(
  productoId: string,
  campo: 'destacado' | 'disponible',
  valor: boolean,
): Promise<Resultado> {
  await exigirRol('admin')
  const supabase = await crearClienteServidor()
  const cambio = campo === 'destacado' ? { destacado: valor } : { disponible: valor }
  const { error } = await supabase.from('productos').update(cambio).eq('id', productoId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/admin/carta')
  return { ok: true }
}
