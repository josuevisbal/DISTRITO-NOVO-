'use server'

import { revalidatePath } from 'next/cache'

import type { Database } from '@/lib/database.types'
import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'

type Rol = Database['public']['Enums']['rol_usuario']
type Resultado = { ok: true } | { ok: false; error: string }

export async function actualizarUsuario(
  id: string,
  cambios: { rol?: Rol; estacion_id?: string | null; activo?: boolean },
): Promise<Resultado> {
  const staff = await exigirRol('admin')

  // Nadie puede desactivarse ni bajarse de rol a sí mismo: evita quedar sin acceso.
  if (id === staff.id && (cambios.activo === false || (cambios.rol && cambios.rol !== staff.rol))) {
    return { ok: false, error: 'No puedes quitarte a ti mismo el acceso.' }
  }

  // Solo el dueño nombra dueños. (La base lo impone también con un disparador.)
  if (cambios.rol === 'dueno' && staff.rol !== 'dueno') {
    return { ok: false, error: 'Solo el dueño puede nombrar otro dueño.' }
  }

  const supabase = await crearClienteServidor()
  const parche: Database['public']['Tables']['usuarios']['Update'] = {}
  if (cambios.rol !== undefined) parche.rol = cambios.rol
  if (cambios.activo !== undefined) parche.activo = cambios.activo
  // La estación solo aplica a cocina; en otros roles se limpia.
  if (cambios.rol !== undefined || cambios.estacion_id !== undefined) {
    parche.estacion_id =
      (cambios.rol ?? undefined) === 'cocina' ? (cambios.estacion_id ?? null) : null
  }

  const { error } = await supabase
    .from('usuarios')
    .update(parche)
    .eq('id', id)
    .eq('restaurante_id', staff.restaurante_id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/admin/usuarios')
  return { ok: true }
}
