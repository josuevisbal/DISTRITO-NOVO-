import { redirect } from 'next/navigation'

import type { Database } from '@/lib/database.types'
import { crearClienteServidor } from '@/lib/supabase/servidor'

export type Rol = Database['public']['Enums']['rol_usuario']

export type Staff = {
  id: string
  nombre: string
  rol: Rol
  restaurante_id: string
  estacion_id: string | null
}

/** El staff que tiene la sesión actual, o null si no hay sesión o no es staff activo. */
export async function staffActual(): Promise<Staff | null> {
  const supabase = await crearClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('usuarios')
    .select('id, nombre, rol, restaurante_id, estacion_id')
    .eq('id', user.id)
    .eq('activo', true)
    .maybeSingle()

  return data
}

/**
 * Exige sesión y, si se pasan roles, que el rol esté entre ellos. Si no cumple, redirige:
 * al login si no hay sesión, o a `/app` (que reparte según el rol) si el rol no aplica.
 *
 * El dueño pasa todas las guardas: ve absolutamente todo. La diferencia dueño/admin se
 * decide en cada pantalla (p. ej. rentabilidad) y en la RLS, que es la guarda de verdad.
 */
export async function exigirRol(...roles: Rol[]): Promise<Staff> {
  const staff = await staffActual()
  if (!staff) redirect('/app/login')
  if (staff.rol === 'dueno') return staff
  if (roles.length > 0 && !roles.includes(staff.rol)) redirect('/app')
  return staff
}

/** A dónde mandar a cada rol al entrar. */
export function inicioDeRol(rol: Rol): string {
  switch (rol) {
    case 'dueno':
      return '/app/admin/tablero'
    case 'admin':
      return '/app/admin/tablero'
    case 'cajero':
      return '/app/caja'
    case 'mesero':
      return '/app/mesero'
    case 'cocina':
      return '/app/cocina'
    case 'pase':
      return '/app/pase'
    case 'domiciliario':
      return '/app/domicilios'
  }
}
