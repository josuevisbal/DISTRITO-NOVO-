import { BarraStaff } from '@/components/barra-staff'
import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { MeseroCliente, type PedidoMesa } from './mesero-cliente'

export const dynamic = 'force-dynamic'

export default async function PaginaMesero() {
  const staff = await exigirRol('mesero', 'admin')
  const supabase = await crearClienteServidor()

  // Pedidos de mesa que esperan la confirmación del mesero para entrar a cocina.
  const { data } = await supabase
    .from('pedidos')
    .select(
      'id, numero, creado_en, mesas(numero), pedido_items(nombre_snap, cantidad, notas, estaciones(nombre))',
    )
    .eq('restaurante_id', staff.restaurante_id)
    .eq('canal', 'mesa')
    .eq('estado', 'pendiente')
    .order('creado_en')

  const pendientes: PedidoMesa[] = (data ?? []).map((p) => ({
    id: p.id,
    numero: p.numero,
    mesa: p.mesas?.numero ?? null,
    creado_en: p.creado_en,
    items: (p.pedido_items ?? []).map((i) => ({
      nombre: i.nombre_snap,
      cantidad: i.cantidad,
      estacion: i.estaciones?.nombre ?? '',
      notas: i.notas,
    })),
  }))

  return (
    <>
      <BarraStaff staff={staff} titulo="Pedidos de mesa" />
      <MeseroCliente pendientes={pendientes} />
    </>
  )
}
