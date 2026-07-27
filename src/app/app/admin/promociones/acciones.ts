'use server'

import { revalidatePath } from 'next/cache'

import type { Database } from '@/lib/database.types'
import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'

type Resultado = { ok: true } | { ok: false; error: string }
type TipoPromo = Database['public']['Enums']['tipo_promo']

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
  campos: {
    etiqueta: string
    titulo: string
    descripcion: string
    monto_minimo: number | null
    precio_combo?: number | null
  },
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
      ...(campos.precio_combo !== undefined
        ? {
            precio_combo:
              campos.precio_combo === null ? null : Math.max(0, Math.trunc(campos.precio_combo)),
          }
        : {}),
    })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/admin/promociones')
  return { ok: true }
}

/** Crea una promoción nueva del tipo elegido, apagada, lista para editar. */
export async function crearPromo(tipo: TipoPromo): Promise<Resultado & { id?: string }> {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()

  const TITULO: Record<string, string> = {
    envio: 'Domicilio GRATIS',
    combo: 'Nuevo combo',
    aviso: 'Nuevo aviso',
  }

  const { data: ultima } = await supabase
    .from('promociones')
    .select('orden')
    .eq('restaurante_id', staff.restaurante_id)
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('promociones')
    .insert({
      restaurante_id: staff.restaurante_id,
      tipo,
      titulo: TITULO[tipo] ?? 'Nueva promoción',
      activa: false,
      orden: (ultima?.orden ?? 0) + 1,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/admin/promociones')
  return { ok: true, id: data.id }
}

/** Elimina una promoción (sus items caen en cascada) y su foto de Storage. */
export async function eliminarPromo(id: string): Promise<Resultado> {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()

  const { data: promo } = await supabase
    .from('promociones')
    .select('imagen_url, restaurante_id')
    .eq('id', id)
    .maybeSingle()
  if (!promo || promo.restaurante_id !== staff.restaurante_id) {
    return { ok: false, error: 'Promoción no encontrada.' }
  }

  const { error } = await supabase.from('promociones').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }

  const ruta = rutaDeUrl(promo.imagen_url)
  if (ruta) await supabase.storage.from(BUCKET).remove([ruta])

  revalidatePath('/app/admin/promociones')
  return { ok: true }
}

/** Reemplaza los productos que componen un combo (la RLS exige admin/dueño). */
export async function guardarItemsCombo(
  promoId: string,
  items: { producto_id: string; cantidad: number }[],
): Promise<Resultado> {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()

  const { data: promo } = await supabase
    .from('promociones')
    .select('id, tipo, restaurante_id')
    .eq('id', promoId)
    .maybeSingle()
  if (!promo || promo.restaurante_id !== staff.restaurante_id) {
    return { ok: false, error: 'Promoción no encontrada.' }
  }
  if (promo.tipo !== 'combo') return { ok: false, error: 'Esta promoción no es un combo.' }

  // Un renglón por producto: si viene repetido, se suman las cantidades (la PK lo exige).
  const porProducto = new Map<string, number>()
  for (const i of items) {
    if (!i.producto_id) continue
    porProducto.set(
      i.producto_id,
      (porProducto.get(i.producto_id) ?? 0) + Math.max(1, Math.trunc(i.cantidad)),
    )
  }
  const limpios = [...porProducto.entries()].map(([producto_id, cantidad]) => ({
    producto_id,
    cantidad,
  }))
  if (limpios.length === 0) {
    return { ok: false, error: 'El combo necesita al menos un producto.' }
  }

  const { error: errBorrar } = await supabase
    .from('promocion_items')
    .delete()
    .eq('promocion_id', promoId)
  if (errBorrar) return { ok: false, error: errBorrar.message }

  const { error } = await supabase
    .from('promocion_items')
    .insert(limpios.map((i) => ({ promocion_id: promoId, ...i })))
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/admin/promociones')
  return { ok: true }
}
