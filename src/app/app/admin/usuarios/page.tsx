import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { UsuariosAdmin, type EstacionOpcion, type UsuarioAdmin } from './usuarios-admin'

export const dynamic = 'force-dynamic'

export default async function PaginaAdminUsuarios() {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()

  const [{ data: usuarios }, { data: estaciones }] = await Promise.all([
    supabase
      .from('usuarios')
      .select('id, nombre, correo, rol, estacion_id, activo')
      .eq('restaurante_id', staff.restaurante_id)
      .order('nombre'),
    supabase
      .from('estaciones')
      .select('id, nombre')
      .eq('restaurante_id', staff.restaurante_id)
      .eq('activa', true)
      .order('orden'),
  ])

  return (
    <>
      <p className="text-sm text-marca-texto-suave">
        Crea cuentas, cambia roles y estaciones, y retira accesos del equipo.
      </p>
      <UsuariosAdmin
        usuarios={(usuarios ?? []) as UsuarioAdmin[]}
        estaciones={(estaciones ?? []) as EstacionOpcion[]}
        yoId={staff.id}
        miRol={staff.rol}
      />
    </>
  )
}
