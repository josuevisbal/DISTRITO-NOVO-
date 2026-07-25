import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { MesasQr } from './mesas-qr'

export const dynamic = 'force-dynamic'

export default async function PaginaMesas() {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()

  const [{ data: mesas }, { data: rest }] = await Promise.all([
    supabase
      .from('mesas')
      .select('id, numero, qr_token')
      .eq('restaurante_id', staff.restaurante_id)
      .eq('activa', true)
      .order('numero'),
    supabase
      .from('restaurantes')
      .select('slug, nombre')
      .eq('id', staff.restaurante_id)
      .maybeSingle(),
  ])

  return (
    <MesasQr
      mesas={mesas ?? []}
      slug={rest?.slug ?? ''}
      nombre={rest?.nombre ?? ''}
    />
  )
}
