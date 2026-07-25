'use server'

import { revalidatePath } from 'next/cache'

import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'

type Resultado = { ok: true } | { ok: false; error: string }

export async function guardarZona(
  id: string | null,
  nombre: string,
  valor: number,
): Promise<Resultado> {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()

  if (!nombre.trim()) return { ok: false, error: 'Ponle nombre al barrio.' }
  if (!Number.isFinite(valor) || valor < 0) return { ok: false, error: 'El valor no es válido.' }
  const v = Math.trunc(valor)

  if (id) {
    const { error } = await supabase
      .from('zonas_domicilio')
      .update({ nombre: nombre.trim(), valor: v })
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
  } else {
    const { error } = await supabase
      .from('zonas_domicilio')
      .insert({ restaurante_id: staff.restaurante_id, nombre: nombre.trim(), valor: v })
    if (error) return { ok: false, error: error.message }
  }

  revalidatePath('/app/admin/zonas')
  return { ok: true }
}

export async function alternarZona(id: string, activa: boolean): Promise<Resultado> {
  await exigirRol('admin')
  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('zonas_domicilio').update({ activa }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/admin/zonas')
  return { ok: true }
}
