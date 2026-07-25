import { BarraStaff } from '@/components/barra-staff'
import { MarcoOscuro } from '@/components/marco-oscuro'
import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { DomiciliosCliente, type Entrega } from './domicilios-cliente'

export const dynamic = 'force-dynamic'

export default async function PaginaDomicilios() {
  const staff = await exigirRol('domiciliario', 'admin')
  const supabase = await crearClienteServidor()

  // La RLS ya limita al domiciliario a SUS pedidos; el filtro de estado deja solo lo que
  // está en reparto. Un admin ve todo lo que esté en despacho o en camino.
  let consulta = supabase
    .from('pedidos')
    .select(
      'id, numero, estado, cliente_nombre, cliente_tel, direccion, indicaciones, total, medio_pago, nota_entrega, zonas_domicilio(nombre), pedido_items(nombre_snap, cantidad), pagos(estado)',
    )
    .in('estado', ['en_despacho', 'en_camino'])
    .order('creado_en')

  if (staff.rol === 'domiciliario') {
    consulta = consulta.eq('domiciliario_id', staff.id)
  }

  const { data } = await consulta

  const entregas: Entrega[] = (data ?? []).map((p) => ({
    pedido_id: p.id,
    numero: p.numero,
    estado: p.estado as 'en_despacho' | 'en_camino',
    cliente: p.cliente_nombre,
    telefono: p.cliente_tel,
    direccion: p.direccion,
    indicaciones: p.indicaciones,
    zona: p.zonas_domicilio?.nombre ?? null,
    total: p.total,
    // "Pago" = no es efectivo, o ya hay un pago verificado (transferencia aprobada).
    pagado: p.medio_pago !== 'efectivo' || (p.pagos ?? []).some((x) => x.estado === 'verificado'),
    nota_entrega: p.nota_entrega,
    items: (p.pedido_items ?? []).map((i) => ({ nombre: i.nombre_snap, cantidad: i.cantidad })),
  }))

  return (
    <MarcoOscuro>
      <BarraStaff staff={staff} titulo="Mis entregas" />
      <DomiciliosCliente entregas={entregas} />
    </MarcoOscuro>
  )
}
