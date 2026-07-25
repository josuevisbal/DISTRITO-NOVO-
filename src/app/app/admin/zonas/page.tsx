import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { ZonasAdmin, type ZonaAdmin } from './zonas-admin'

export const dynamic = 'force-dynamic'

export default async function PaginaAdminZonas() {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()

  const { data } = await supabase
    .from('zonas_domicilio')
    .select('id, nombre, valor, activa')
    .eq('restaurante_id', staff.restaurante_id)
    .order('valor')

  const zonas: ZonaAdmin[] = data ?? []

  return (
    <>
      <p className="text-sm text-marca-texto-suave">
        El domicilio se cobra por barrio. Cambia un valor y guarda, o agrega un barrio nuevo.
      </p>
      <ZonasAdmin zonas={zonas} />
    </>
  )
}
