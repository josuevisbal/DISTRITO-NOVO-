'use server'

import { revalidatePath } from 'next/cache'

import type { FrasesLanding } from '@/lib/datos/carta'
import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'

type Resultado = { ok: true } | { ok: false; error: string }

const BUCKET = 'productos'
const TIPOS = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

/** Qué foto de la página de inicio se está cambiando. */
export type CampoFoto = 'portada_url' | 'foto_local_url' | 'logo_url'

// El video del héroe es decorativo y debe cargar rápido en datos móviles: corto y liviano.
const TIPOS_VIDEO = ['video/mp4', 'video/webm']
const MAX_BYTES_VIDEO = 10 * 1024 * 1024

function rutaDeUrl(url: string | null): string | null {
  if (!url) return null
  const marca = `/object/public/${BUCKET}/`
  const i = url.indexOf(marca)
  return i === -1 ? null : url.slice(i + marca.length)
}

/** Sube (o reemplaza) una foto de la página de inicio: el plato del héroe o el local. */
export async function subirFotoInicio(campo: CampoFoto, form: FormData): Promise<Resultado> {
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
  const { data: rest } = await supabase
    .from('restaurantes')
    .select('portada_url, foto_local_url, logo_url')
    .eq('id', staff.restaurante_id)
    .maybeSingle()
  if (!rest) return { ok: false, error: 'Restaurante no encontrado.' }

  const ext = archivo.type === 'image/png' ? 'png' : archivo.type === 'image/webp' ? 'webp' : 'jpg'
  const ruta = `${staff.restaurante_id}/inicio-${campo}-${Date.now()}.${ext}`
  const bytes = new Uint8Array(await archivo.arrayBuffer())

  const subida = await supabase.storage
    .from(BUCKET)
    .upload(ruta, bytes, { contentType: archivo.type, upsert: true })
  if (subida.error) return { ok: false, error: subida.error.message }

  const { data: publica } = supabase.storage.from(BUCKET).getPublicUrl(ruta)
  const { error } = await supabase
    .from('restaurantes')
    .update(
      campo === 'portada_url'
        ? { portada_url: publica.publicUrl }
        : campo === 'logo_url'
          ? { logo_url: publica.publicUrl }
          : { foto_local_url: publica.publicUrl },
    )
    .eq('id', staff.restaurante_id)
  if (error) return { ok: false, error: error.message }

  const anterior = rutaDeUrl(rest[campo])
  if (anterior && anterior !== ruta) await supabase.storage.from(BUCKET).remove([anterior])

  revalidatePath('/app/admin/inicio')
  return { ok: true }
}

/** Quita una foto de la página de inicio. */
export async function quitarFotoInicio(campo: CampoFoto): Promise<Resultado> {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()

  const { data: rest } = await supabase
    .from('restaurantes')
    .select('portada_url, foto_local_url, logo_url')
    .eq('id', staff.restaurante_id)
    .maybeSingle()
  if (!rest) return { ok: false, error: 'Restaurante no encontrado.' }

  const ruta = rutaDeUrl(rest[campo])
  if (ruta) await supabase.storage.from(BUCKET).remove([ruta])

  const { error } = await supabase
    .from('restaurantes')
    .update(
      campo === 'portada_url'
        ? { portada_url: null }
        : campo === 'logo_url'
          ? { logo_url: null }
          : { foto_local_url: null },
    )
    .eq('id', staff.restaurante_id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/admin/inicio')
  return { ok: true }
}

/**
 * Sube el video de fondo del héroe. Se valida corto y liviano (≤10 MB, MP4 o WebM)
 * porque es decorativo: si pesa, la página tarda en celular. La foto del héroe queda
 * como respaldo (poster) y se sigue mostrando mientras el video carga.
 */
export async function subirVideoHero(form: FormData): Promise<Resultado> {
  const staff = await exigirRol('admin')
  const archivo = form.get('video')

  if (!(archivo instanceof File) || archivo.size === 0) {
    return { ok: false, error: 'Escoge un video.' }
  }
  if (!TIPOS_VIDEO.includes(archivo.type)) {
    return { ok: false, error: 'El video debe ser MP4 (H.264) o WebM.' }
  }
  if (archivo.size > MAX_BYTES_VIDEO) {
    return {
      ok: false,
      error: 'El video pesa más de 10 MB. Usa uno de 5 a 12 segundos, más comprimido.',
    }
  }

  const supabase = await crearClienteServidor()
  const { data: rest } = await supabase
    .from('restaurantes')
    .select('hero_video_url')
    .eq('id', staff.restaurante_id)
    .maybeSingle()
  if (!rest) return { ok: false, error: 'Restaurante no encontrado.' }

  const ext = archivo.type === 'video/webm' ? 'webm' : 'mp4'
  const ruta = `${staff.restaurante_id}/hero-video-${Date.now()}.${ext}`
  const bytes = new Uint8Array(await archivo.arrayBuffer())

  const subida = await supabase.storage
    .from(BUCKET)
    .upload(ruta, bytes, { contentType: archivo.type, upsert: true })
  if (subida.error) return { ok: false, error: subida.error.message }

  const { data: publica } = supabase.storage.from(BUCKET).getPublicUrl(ruta)
  const { error } = await supabase
    .from('restaurantes')
    .update({ hero_video_url: publica.publicUrl })
    .eq('id', staff.restaurante_id)
  if (error) return { ok: false, error: error.message }

  const anterior = rutaDeUrl(rest.hero_video_url)
  if (anterior && anterior !== ruta) await supabase.storage.from(BUCKET).remove([anterior])

  revalidatePath('/app/admin/inicio')
  return { ok: true }
}

/** Quita el video del héroe: la portada vuelve a ser la foto. */
export async function quitarVideoHero(): Promise<Resultado> {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()

  const { data: rest } = await supabase
    .from('restaurantes')
    .select('hero_video_url')
    .eq('id', staff.restaurante_id)
    .maybeSingle()
  if (!rest) return { ok: false, error: 'Restaurante no encontrado.' }

  const ruta = rutaDeUrl(rest.hero_video_url)
  if (ruta) await supabase.storage.from(BUCKET).remove([ruta])

  const { error } = await supabase
    .from('restaurantes')
    .update({ hero_video_url: null })
    .eq('id', staff.restaurante_id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/admin/inicio')
  return { ok: true }
}

/** Guarda las frases de la página de inicio y los datos de la franja de contacto. */
export async function guardarInicio(datos: {
  frases: FrasesLanding
  direccion: string
  horario: string
  whatsapp: string
  whatsapp_pedidos: string
  llave_pago: string
  cuenta_pago: string
}): Promise<Resultado> {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()

  // Solo se guarda lo que el admin escribió; lo vacío se borra para que vuelva
  // el texto de plantilla en vez de dejar la landing en blanco.
  const frases: FrasesLanding = {}
  for (const [clave, valor] of Object.entries(datos.frases)) {
    const limpio = (valor ?? '').trim()
    if (limpio) frases[clave as keyof FrasesLanding] = limpio
  }

  const { error } = await supabase
    .from('restaurantes')
    .update({
      landing: frases,
      direccion: datos.direccion.trim() || null,
      horario: datos.horario.trim() || null,
      whatsapp: datos.whatsapp.trim() || null,
      whatsapp_pedidos: datos.whatsapp_pedidos.trim() || null,
      llave_pago: datos.llave_pago.trim() || null,
      cuenta_pago: datos.cuenta_pago.trim() || null,
    })
    .eq('id', staff.restaurante_id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/admin/inicio')
  return { ok: true }
}
