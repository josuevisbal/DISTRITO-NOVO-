'use server'

import { redirect } from 'next/navigation'

import { staffActual } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { inicioDeRol } from '@/lib/sesion'

export type ResultadoLogin = { error: string } | undefined

export async function iniciarSesion(
  _previo: ResultadoLogin,
  form: FormData,
): Promise<ResultadoLogin> {
  const correo = String(form.get('correo') ?? '').trim()
  const clave = String(form.get('clave') ?? '')
  const destino = String(form.get('destino') ?? '')

  if (!correo || !clave) {
    return { error: 'Escribe tu correo y tu contraseña.' }
  }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave })

  if (error) {
    return { error: 'Correo o contraseña incorrectos.' }
  }

  const staff = await staffActual()
  if (!staff) {
    await supabase.auth.signOut()
    return { error: 'Tu usuario no tiene acceso a este restaurante.' }
  }

  // Solo se respeta el destino si es una ruta interna, para no rebotar a un sitio externo.
  redirect(destino.startsWith('/app') ? destino : inicioDeRol(staff.rol))
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor()
  await supabase.auth.signOut()
  redirect('/app/login')
}
