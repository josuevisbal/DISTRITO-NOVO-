'use server'

import { revalidatePath } from 'next/cache'

import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'

type Resultado = { ok: true } | { ok: false; error: string }

/** Guarda el costo de un plato. Solo administración; la base lo vuelve a comprobar. */
export async function guardarCosto(productoId: string, costo: number): Promise<Resultado> {
  await exigirRol('admin')
  if (!Number.isFinite(costo) || costo < 0) return { ok: false, error: 'Costo no válido.' }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.rpc('actualizar_costo', {
    p_producto: productoId,
    p_costo: Math.trunc(costo),
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/admin/reportes')
  return { ok: true }
}
