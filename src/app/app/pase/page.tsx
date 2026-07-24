import { BarraStaff } from '@/components/barra-staff'
import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { PaseCliente, type Despacho, type PedidoPase } from './pase-cliente'

export const dynamic = 'force-dynamic'

export default async function PaginaPase() {
  const staff = await exigirRol('pase', 'admin')
  const supabase = await crearClienteServidor()

  const [{ data: estaciones }, { data: domiciliarios }] = await Promise.all([
    supabase
      .from('estaciones')
      .select('id, nombre, color')
      .eq('restaurante_id', staff.restaurante_id)
      .eq('activa', true)
      .order('orden'),
    supabase
      .from('usuarios')
      .select('id, nombre')
      .eq('restaurante_id', staff.restaurante_id)
      .eq('rol', 'domiciliario')
      .eq('activo', true)
      .order('nombre'),
  ])

  // Todo lo que está en cocina o ya listo, con sus comandas por estación.
  const { data: pedidos } = await supabase
    .from('pedidos')
    .select('id, numero, canal, estado, mesas(numero), comandas(estacion_id, estado)')
    .eq('restaurante_id', staff.restaurante_id)
    .in('estado', ['en_cocina', 'listo'])
    .order('objetivo_en', { nullsFirst: false })

  // Domicilios liberados que esperan (o ya tienen) un domiciliario.
  const { data: despachos } = await supabase
    .from('pedidos')
    .select('id, numero, direccion, nota_entrega, domiciliario_id, usuarios!pedidos_domiciliario_id_fkey(nombre), zonas_domicilio(nombre)')
    .eq('restaurante_id', staff.restaurante_id)
    .eq('canal', 'domicilio')
    .eq('estado', 'en_despacho')
    .order('creado_en')

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

  const enDespacho: Despacho[] = (despachos ?? []).map((p) => ({
    id: p.id,
    numero: p.numero,
    direccion: p.direccion,
    zona: p.zonas_domicilio?.nombre ?? null,
    nota_entrega: p.nota_entrega,
    domiciliario_id: p.domiciliario_id,
    domiciliario_nombre: p.usuarios?.nombre ?? null,
  }))

  return (
    <>
      <BarraStaff staff={staff} titulo="Pase" />
      <PaseCliente
        pedidos={lista}
        despachos={enDespacho}
        domiciliarios={domiciliarios ?? []}
      />
    </>
  )
}
