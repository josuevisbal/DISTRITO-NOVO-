import { PestanasModulo } from '@/components/panel/pestanas-modulo'
import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { PESTANAS_MENU } from '../carta/page'
import { EstacionesAdmin, type EstacionAdmin } from './estaciones-admin'

export const dynamic = 'force-dynamic'

/** Las cocinas del restaurante: cuántas hay, cómo se llaman y de qué color son. */
export default async function PaginaAdminEstaciones() {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()

  const [{ data: estaciones }, { data: productos }] = await Promise.all([
    supabase
      .from('estaciones')
      .select('id, nombre, slug, color, activa')
      .eq('restaurante_id', staff.restaurante_id)
      .order('orden'),
    supabase
      .from('productos')
      .select('estacion_id')
      .eq('restaurante_id', staff.restaurante_id)
      .eq('activo', true),
  ])

  const platosPorEstacion = new Map<string, number>()
  for (const p of productos ?? []) {
    platosPorEstacion.set(p.estacion_id, (platosPorEstacion.get(p.estacion_id) ?? 0) + 1)
  }

  const lista: EstacionAdmin[] = (estaciones ?? []).map((e) => ({
    ...e,
    platos: platosPorEstacion.get(e.id) ?? 0,
  }))

  return (
    <div className="space-y-4">
      <PestanasModulo opciones={PESTANAS_MENU} activa="/app/admin/estaciones" />
      <p className="text-sm text-marca-texto-suave">
        Las cocinas que preparan los platos. Cada una tiene su pantalla y su color; el
        cada pedido se parte por estas cocinas y todas reciben su comanda a la vez.
      </p>
      <EstacionesAdmin estaciones={lista} />
    </div>
  )
}
