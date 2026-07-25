import { BarraStaff } from '@/components/barra-staff'
import { NavAdmin } from '@/components/nav-admin'
import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { PromosAdmin, type PromoAdmin } from './promos-admin'

export const dynamic = 'force-dynamic'

export default async function PaginaAdminPromos() {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()

  const { data } = await supabase
    .from('promociones')
    .select('id, tipo, etiqueta, titulo, descripcion, monto_minimo, activa')
    .eq('restaurante_id', staff.restaurante_id)
    .order('orden')

  const promos: PromoAdmin[] = data ?? []

  return (
    <>
      <BarraStaff staff={staff} titulo="Promociones" />
      <NavAdmin />
      <p className="mx-auto max-w-2xl px-4 pt-4 text-sm text-marca-texto-suave">
        Enciende o apaga cada promoción y edita su texto. Aparecen arriba en la carta del
        cliente.
      </p>
      <PromosAdmin promos={promos} />
    </>
  )
}
