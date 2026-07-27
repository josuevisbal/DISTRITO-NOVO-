'use server'

import { revalidatePath } from 'next/cache'

import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'

type Resultado = { ok: true } | { ok: false; error: string }

/** "Comida rápida" -> "comida-rapida". El slug es el que viaja en la URL de cocina. */
function aSlug(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function crearEstacion(nombre: string, color: string): Promise<Resultado> {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()

  const limpio = nombre.trim()
  if (!limpio) return { ok: false, error: 'La cocina necesita un nombre.' }

  const slug = aSlug(limpio)
  if (!slug) return { ok: false, error: 'Ese nombre no sirve para armar la dirección.' }

  const { data: ultima } = await supabase
    .from('estaciones')
    .select('orden')
    .eq('restaurante_id', staff.restaurante_id)
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('estaciones').insert({
    restaurante_id: staff.restaurante_id,
    nombre: limpio,
    slug,
    color,
    orden: (ultima?.orden ?? 0) + 1,
  })
  if (error) {
    return {
      ok: false,
      error: error.code === '23505' ? 'Ya existe una cocina con ese nombre.' : error.message,
    }
  }

  revalidatePath('/app/admin/estaciones')
  revalidatePath('/app/admin/carta')
  return { ok: true }
}

export async function guardarEstacion(
  id: string,
  campos: { nombre: string; color: string },
): Promise<Resultado> {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()

  if (!campos.nombre.trim()) return { ok: false, error: 'La cocina necesita un nombre.' }

  const { error } = await supabase
    .from('estaciones')
    .update({ nombre: campos.nombre.trim(), color: campos.color })
    .eq('id', id)
    .eq('restaurante_id', staff.restaurante_id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/admin/estaciones')
  revalidatePath('/app/admin/carta')
  return { ok: true }
}

/**
 * Enciende o apaga una cocina. No se borra: los platos y las comandas viejas la
 * referencian. Apagada deja de aparecer en la carta y en el selector de cocina,
 * pero solo si ya no tiene platos activos asignados — si no, la cocina se quedaría
 * sin quién prepare esos platos.
 */
export async function alternarEstacion(id: string, activa: boolean): Promise<Resultado> {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()

  if (!activa) {
    const { count } = await supabase
      .from('productos')
      .select('id', { count: 'exact', head: true })
      .eq('restaurante_id', staff.restaurante_id)
      .eq('estacion_id', id)
      .eq('activo', true)

    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: `Esta cocina tiene ${count} plato(s) asignados. Muévelos a otra cocina antes de apagarla.`,
      }
    }
  }

  const { error } = await supabase
    .from('estaciones')
    .update({ activa })
    .eq('id', id)
    .eq('restaurante_id', staff.restaurante_id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/admin/estaciones')
  revalidatePath('/app/admin/carta')
  return { ok: true }
}
