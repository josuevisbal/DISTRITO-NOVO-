'use server'

import { revalidatePath } from 'next/cache'

import type { Database } from '@/lib/database.types'
import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'

type Rol = Database['public']['Enums']['rol_usuario']
type Resultado = { ok: true } | { ok: false; error: string }

export async function actualizarUsuario(
  id: string,
  cambios: { rol?: Rol; activo?: boolean },
): Promise<Resultado> {
  const staff = await exigirRol('admin')

  // Nadie puede desactivarse ni bajarse de rol a sí mismo: evita quedar sin acceso.
  if (id === staff.id && (cambios.activo === false || (cambios.rol && cambios.rol !== staff.rol))) {
    return { ok: false, error: 'No puedes quitarte a ti mismo el acceso.' }
  }

  const supabase = await crearClienteServidor()

  const { data: objetivo } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', id)
    .eq('restaurante_id', staff.restaurante_id)
    .maybeSingle()
  if (!objetivo) return { ok: false, error: 'Usuario no encontrado.' }

  // El restaurante nunca se queda sin quien administre: si este es el último admin
  // activo, no se le puede cambiar el rol ni quitarle el acceso.
  if (objetivo.rol === 'admin' && (cambios.activo === false || (cambios.rol && cambios.rol !== 'admin'))) {
    const { count } = await supabase
      .from('usuarios')
      .select('id', { count: 'exact', head: true })
      .eq('restaurante_id', staff.restaurante_id)
      .eq('rol', 'admin')
      .eq('activo', true)
    if ((count ?? 0) <= 1) {
      return { ok: false, error: 'Es el único administrador: nombra otro antes de cambiarlo.' }
    }
  }

  const parche: Database['public']['Tables']['usuarios']['Update'] = {}
  if (cambios.rol !== undefined) {
    parche.rol = cambios.rol
    // La estación ya no aplica a ningún rol (cocina es pantalla única): se limpia.
    parche.estacion_id = null
  }
  if (cambios.activo !== undefined) parche.activo = cambios.activo

  const { error } = await supabase
    .from('usuarios')
    .update(parche)
    .eq('id', id)
    .eq('restaurante_id', staff.restaurante_id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/admin/usuarios')
  return { ok: true }
}

export async function crearUsuario(datos: {
  nombre: string
  correo: string
  clave: string
  rol: Rol
}): Promise<Resultado> {
  await exigirRol('admin')
  const supabase = await crearClienteServidor()

  // La función de la base repite todas las validaciones y aplica los permisos de rol.
  const { error } = await supabase.rpc('crear_usuario', {
    p_nombre: datos.nombre,
    p_correo: datos.correo,
    p_clave: datos.clave,
    p_rol: datos.rol,
    p_estacion: null,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/admin/usuarios')
  return { ok: true }
}

export async function eliminarUsuario(id: string): Promise<Resultado> {
  await exigirRol('admin')
  const supabase = await crearClienteServidor()

  const { error } = await supabase.rpc('eliminar_usuario', { p_id: id })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/admin/usuarios')
  return { ok: true }
}
