import { cache } from 'react'
import { redirect } from 'next/navigation'

import type { Database } from '@/lib/database.types'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { idDeSesion } from '@/lib/supabase/sesion-verificada'

export type Rol = Database['public']['Enums']['rol_usuario']

export type Staff = {
  id: string
  nombre: string
  rol: Rol
  restaurante_id: string
  estacion_id: string | null
}

/**
 * El staff que tiene la sesión actual, o null si no hay sesión o no es staff activo.
 *
 * Va en `cache()` porque en una misma petición se pedía varias veces (armazón, página y
 * redibujo tras una acción), y la sesión se verifica por firma, sin viaje a Supabase.
 */
export const staffActual = cache(async function staffActual(): Promise<Staff | null> {
  const supabase = await crearClienteServidor()
  const usuario = await idDeSesion(supabase)
  if (!usuario) return null

  const { data } = await supabase
    .from('usuarios')
    .select('id, nombre, rol, restaurante_id, estacion_id')
    .eq('id', usuario)
    .eq('activo', true)
    .maybeSingle()

  return data
})

/**
 * Exige sesión y, si se pasan roles, que el rol esté entre ellos. Si no cumple, redirige:
 * al login si no hay sesión, o a `/app` (que reparte según el rol) si el rol no aplica.
 *
 * `admin` pasa todas las guardas: es el único rol de mando y ve absolutamente todo.
 * La guarda de verdad sigue siendo la RLS; esto solo evita pantallas en blanco.
 */
export async function exigirRol(...roles: Rol[]): Promise<Staff> {
  const staff = await staffActual()
  if (!staff) redirect('/app/login')
  if (staff.rol === 'admin') return staff
  if (roles.length > 0 && !roles.includes(staff.rol)) redirect('/app')
  return staff
}

/** A dónde mandar a cada rol al entrar. */
export function inicioDeRol(rol: Rol): string {
  switch (rol) {
    case 'admin':
      return '/app/admin/tablero'
    case 'cajero':
      return '/app/caja'
    case 'mesero':
      return '/app/mesero'
    case 'cocina':
      return '/app/cocina'
    case 'domicilio':
      return '/app/domicilios'
  }
}
