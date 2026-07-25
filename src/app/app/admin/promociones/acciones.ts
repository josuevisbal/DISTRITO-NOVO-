'use server'

import { revalidatePath } from 'next/cache'

import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'

type Resultado = { ok: true } | { ok: false; error: string }

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
