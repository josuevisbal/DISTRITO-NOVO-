import { BarraStaff } from '@/components/barra-staff'
import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { SelectorCocina } from './selector-cocina'

export const dynamic = 'force-dynamic'

/**
 * Entrada de cocina: pantalla única con selector de estación. No hay estación amarrada
 * al usuario; el selector recuerda la última elegida en esta tablet y salta a ella.
 */
export default async function PaginaCocina() {
  const staff = await exigirRol('cocina', 'admin')
  const supabase = await crearClienteServidor()

  const { data: estaciones } = await supabase
    .from('estaciones')
    .select('slug, nombre, color')
    .eq('restaurante_id', staff.restaurante_id)
    .eq('activa', true)
    .order('orden')

  return (
    <>
      <BarraStaff staff={staff} titulo="Cocina" />
      <SelectorCocina estaciones={estaciones ?? []} />
    </>
  )
}
