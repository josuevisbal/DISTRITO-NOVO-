'use server'

import { revalidatePath } from 'next/cache'

import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'

type Resultado = { ok: true } | { ok: false; error: string }

/** Registra un gasto. La base vuelve a comprobar que sea administración (RLS). */
export async function registrarGasto(datos: {
  fecha: string
  monto: number
  categoria: string
  descripcion: string
}): Promise<Resultado> {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()

  const monto = Math.trunc(datos.monto)
  if (!Number.isFinite(monto) || monto <= 0) return { ok: false, error: 'Escribe el monto.' }
  const categoria = datos.categoria.trim()
  if (!categoria) return { ok: false, error: 'Ponle una categoría.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha))
    return { ok: false, error: 'La fecha no es válida.' }

  const { error } = await supabase.from('gastos').insert({
    restaurante_id: staff.restaurante_id,
    fecha: datos.fecha,
    monto,
    categoria: categoria.charAt(0).toUpperCase() + categoria.slice(1),
    descripcion: datos.descripcion.trim() || null,
    creado_por: staff.id,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/admin/gastos')
  return { ok: true }
}

/**
 * Desde qué día de trabajo se cuenta la ganancia. El dueño la "cuadra" con la plata que
 * de verdad tiene: lo de antes de esa fecha ya no se suma. Las ventas no cambian.
 */
export async function fijarGananciaDesde(fecha: string): Promise<Resultado> {
  const staff = await exigirRol('admin')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, error: 'La fecha no es válida.' }
  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('restaurantes')
    .update({ ganancia_desde: fecha })
    .eq('id', staff.restaurante_id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/admin/gastos')
  return { ok: true }
}

export async function eliminarGasto(id: string): Promise<Resultado> {
  await exigirRol('admin')
  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('gastos').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/admin/gastos')
  return { ok: true }
}
