import { crearClienteServidor } from '@/lib/supabase/servidor'
import { CORTE_POR_DEFECTO } from '@/lib/zona-horaria'

/** Hora local en que empieza el día de trabajo del restaurante (6 = 6 a. m.). */
export async function horaDeCorte(restauranteId: string): Promise<number> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('restaurantes')
    .select('hora_corte')
    .eq('id', restauranteId)
    .maybeSingle()
  const h = data?.hora_corte
  return typeof h === 'number' && h >= 0 && h <= 12 ? h : CORTE_POR_DEFECTO
}
