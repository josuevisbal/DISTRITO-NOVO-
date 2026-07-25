'use server'

import { revalidatePath } from 'next/cache'

import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'

type Resultado = { ok: true } | { ok: false; error: string }

const BUCKET = 'productos'
const TIPOS = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

function rutaDeUrl(url: string | null): string | null {
  if (!url) return null
  const marca = `/object/public/${BUCKET}/`
  const i = url.indexOf(marca)
  return i === -1 ? null : url.slice(i + marca.length)
}

/** Sube (o reemplaza) la foto de fondo de una promoción. Misma vía que la carta. */
export async function subirFotoPromo(promoId: string, form: FormData): Promise<Resultado> {
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
  const { data: promo } = await supabase
    .from('promociones')
    .select('id, imagen_url, restaurante_id')
    .eq('id', promoId)
    .maybeSingle()
  if (!promo || promo.restaurante_id !== staff.restaurante_id) {
    return { ok: false, error: 'Promoción no encontrada.' }
  }

  const ext = archivo.type === 'image/png' ? 'png' : archivo.type === 'image/webp' ? 'webp' : 'jpg'
  const ruta = `${staff.restaurante_id}/promo-${promoId}-${Date.now()}.${ext}`
  const bytes = new Uint8Array(await archivo.arrayBuffer())

  const subida = await supabase.storage
    .from(BUCKET)
    .upload(ruta, bytes, { contentType: archivo.type, upsert: true })
  if (subida.error) return { ok: false, error: subida.error.message }

  const { data: publica } = supabase.storage.from(BUCKET).getPublicUrl(ruta)
  const { error } = await supabase
    .from('promociones')
    .update({ imagen_url: publica.publicUrl })
    .eq('id', promoId)
  if (error) return { ok: false, error: error.message }

  const anterior = rutaDeUrl(promo.imagen_url)
  if (anterior && anterior !== ruta) await supabase.storage.from(BUCKET).remove([anterior])

  revalidatePath('/app/admin/promociones')
  return { ok: true }
}

/** Quita la foto de fondo de una promoción. */
export async function quitarFotoPromo(promoId: string): Promise<Resultado> {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()

  const { data: promo } = await supabase
    .from('promociones')
    .select('imagen_url, restaurante_id')
    .eq('id', promoId)
    .maybeSingle()
  if (!promo || promo.restaurante_id !== staff.restaurante_id) {
    return { ok: false, error: 'Promoción no encontrada.' }
  }

  const ruta = rutaDeUrl(promo.imagen_url)
  if (ruta) await supabase.storage.from(BUCKET).remove([ruta])

  const { error } = await supabase
    .from('promociones')
    .update({ imagen_url: null })
    .eq('id', promoId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/admin/promociones')
  return { ok: true }
}

export async function alternarPromo(id: string, activa: boolean): Promise<Resultado> {
  await exigirRol('admin')
  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('promociones').update({ activa }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/admin/promociones')
  return { ok: true }
}

export async function guardarPromo(
  id: string,
  campos: { etiqueta: string; titulo: string; descripcion: string; monto_minimo: number | null },
): Promise<Resultado> {
  await exigirRol('admin')
  const supabase = await crearClienteServidor()

  if (!campos.titulo.trim()) return { ok: false, error: 'La promoción necesita un título.' }

  const { error } = await supabase
    .from('promociones')
    .update({
      etiqueta: campos.etiqueta.trim() || null,
      titulo: campos.titulo.trim(),
      descripcion: campos.descripcion.trim() || null,
      monto_minimo:
        campos.monto_minimo === null ? null : Math.max(0, Math.trunc(campos.monto_minimo)),
    })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/admin/promociones')
  return { ok: true }
}
