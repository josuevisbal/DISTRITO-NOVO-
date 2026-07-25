import { BarraStaff } from '@/components/barra-staff'
import { NavAdmin } from '@/components/nav-admin'
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
      .select('id, nombre, rol, estacion_id, activo')
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
      <BarraStaff staff={staff} titulo="Usuarios del equipo" />
      <NavAdmin />
      <p className="mx-auto max-w-2xl px-4 pt-4 text-sm text-marca-texto-suave">
        Cambia el rol, la estación de cocina o el acceso de cada persona del equipo.
      </p>
      <UsuariosAdmin
        usuarios={(usuarios ?? []) as UsuarioAdmin[]}
        estaciones={(estaciones ?? []) as EstacionOpcion[]}
        yoId={staff.id}
      />
    </>
  )
}
