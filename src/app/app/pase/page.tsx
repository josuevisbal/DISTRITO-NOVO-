import { BarraStaff } from '@/components/barra-staff'
import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { PaseCliente, type PedidoPase } from './pase-cliente'

export const dynamic = 'force-dynamic'

export default async function PaginaPase() {
  const staff = await exigirRol('pase', 'admin')
  const supabase = await crearClienteServidor()

  const { data: estaciones } = await supabase
    .from('estaciones')
    .select('id, nombre, color')
    .eq('restaurante_id', staff.restaurante_id)
    .eq('activa', true)
    .order('orden')

  // Todo lo que está en cocina o ya listo, con sus comandas por estación.
  const { data: pedidos } = await supabase
    .from('pedidos')
    .select('id, numero, canal, estado, mesas(numero), comandas(estacion_id, estado)')
    .eq('restaurante_id', staff.restaurante_id)
    .in('estado', ['en_cocina', 'listo'])
    .order('objetivo_en', { nullsFirst: false })

  const lista: PedidoPase[] = (pedidos ?? []).map((p) => {
    const porEstacion = new Map((p.comandas ?? []).map((c) => [c.estacion_id, c.estado]))
    return {
      id: p.id,
      numero: p.numero,
      mesa: p.mesas?.numero ?? null,
      canal: p.canal,
      estado: p.estado,
      listo: p.estado === 'listo',
      // Una barra por cada estación del restaurante; en gris la que este pedido no toca.
      barras: (estaciones ?? []).map((e) => ({
        estacion_id: e.id,
        nombre: e.nombre,
        color: e.color,
        estado: porEstacion.get(e.id) ?? null,
      })),
    }
  })

  return (
    <>
      <BarraStaff staff={staff} titulo="Pase" />
      <PaseCliente pedidos={lista} />
    </>
  )
}
