import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { UsuariosAdmin, type UsuarioAdmin } from './usuarios-admin'

export const dynamic = 'force-dynamic'

export default async function PaginaAdminUsuarios() {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()

  const { data: usuarios } = await supabase
    .from('usuarios')
    .select('id, nombre, correo, rol, activo')
    .eq('restaurante_id', staff.restaurante_id)
    .order('nombre')

  return (
    <>
      <p className="text-sm text-marca-texto-suave">
        Crea cuentas, cambia roles y retira accesos del equipo.
      </p>
      <UsuariosAdmin usuarios={(usuarios ?? []) as UsuarioAdmin[]} yoId={staff.id} />
    </>
  )
}
