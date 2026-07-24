import { BarraStaff } from '@/components/barra-staff'
import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import {
  CajaCliente,
  type Contraentrega,
  type PorCobrar,
  type Transferencia,
  type Turno,
} from './caja-cliente'

export const dynamic = 'force-dynamic'

export default async function PaginaCaja() {
  const staff = await exigirRol('cajero', 'admin')
  const supabase = await crearClienteServidor()

  const { data: turnoRow } = await supabase
    .from('caja_turnos')
    .select('id, base_inicial, abierto_en')
    .eq('restaurante_id', staff.restaurante_id)
    .is('cerrado_en', null)
    .order('abierto_en', { ascending: false })
    .maybeSingle()

  const turno: Turno = turnoRow ?? null

  // Arqueo en vivo: ingresos y legalizaciones del turno, sumados por medio.
  const arqueo: Record<string, number> = {}
  if (turno) {
    const { data: movs } = await supabase
      .from('caja_movimientos')
      .select('medio, monto, tipo')
      .eq('turno_id', turno.id)
      .in('tipo', ['ingreso', 'legalizacion'])
    for (const m of movs ?? []) {
      if (m.medio) arqueo[m.medio] = (arqueo[m.medio] ?? 0) + m.monto
    }
  }

  const [transfRes, contraRes, cobrarRes] = await Promise.all([
    // Transferencias por verificar: alerta persistente hasta que caja actúe.
    supabase
      .from('pedidos')
      .select('id, numero, cliente_nombre, monto_exacto, total, creado_en')
      .eq('restaurante_id', staff.restaurante_id)
      .eq('estado', 'esperando_pago')
      .order('creado_en'),
    // Contraentrega: efectivo pendiente de confirmar.
    supabase
      .from('pedidos')
      .select('id, numero, canal, cliente_nombre, total, direccion')
      .eq('restaurante_id', staff.restaurante_id)
      .eq('estado', 'pendiente')
      .eq('medio_pago', 'efectivo')
      .order('creado_en'),
    // Por cobrar en mostrador: mesa/recoger/mostrador que ya están en marcha y que aún no
    // tienen un pago verificado (una transferencia ya aprobada no se vuelve a cobrar).
    supabase
      .from('pedidos')
      .select('id, numero, canal, total, mesas(numero), pagos(estado)')
      .eq('restaurante_id', staff.restaurante_id)
      .in('canal', ['mesa', 'recoger', 'mostrador'])
      .in('estado', ['en_cocina', 'listo', 'en_despacho'])
      .order('creado_en'),
  ])

  const transferencias: Transferencia[] = (transfRes.data ?? []).map((p) => ({
    pedido_id: p.id,
    numero: p.numero,
    cliente: p.cliente_nombre,
    monto_exacto: p.monto_exacto ?? p.total,
    creado_en: p.creado_en,
  }))

  const contraentregas: Contraentrega[] = (contraRes.data ?? []).map((p) => ({
    pedido_id: p.id,
    numero: p.numero,
    canal: p.canal,
    cliente: p.cliente_nombre,
    total: p.total,
    direccion: p.direccion,
  }))

  const porCobrar: PorCobrar[] = (cobrarRes.data ?? [])
    .filter((p) => !(p.pagos ?? []).some((pago) => pago.estado === 'verificado'))
    .map((p) => ({
      pedido_id: p.id,
      numero: p.numero,
      canal: p.canal,
      mesa: p.mesas?.numero ?? null,
      total: p.total,
    }))

  return (
    <>
      <BarraStaff staff={staff} titulo="Caja" />
      <CajaCliente
        turno={turno}
        arqueo={arqueo}
        transferencias={transferencias}
        contraentregas={contraentregas}
        porCobrar={porCobrar}
        servidorAhoraISO={new Date().toISOString()}
      />
    </>
  )
}
