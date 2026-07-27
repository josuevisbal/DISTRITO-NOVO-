import type {
  Contraentrega,
  PorCobrar,
  PorLegalizar,
  Transferencia,
  Turno,
} from '@/app/app/caja/caja-cliente'
import { crearClienteServidor } from '@/lib/supabase/servidor'

/** Lo cobrado por un medio en el turno: monto y cuántos pedidos entraron por ahí. */
export type ArqueoMedio = { monto: number; pedidos: number }

/** Un cobro ya hecho en el turno: la trazabilidad de "Cobrados hoy". */
export type Cobrado = {
  movimiento_id: string
  numero: number | null
  cliente: string | null
  mesa: number | null
  medio: string
  monto: number
  cobrado_en: string
}

export type DatosCaja = {
  turno: Turno
  arqueo: Record<string, ArqueoMedio>
  cobrados: Cobrado[]
  transferencias: Transferencia[]
  contraentregas: Contraentrega[]
  porCobrar: PorCobrar[]
  porLegalizar: PorLegalizar[]
}

/**
 * Todo lo que pinta la pantalla de Caja, en una pasada. Lo comparten la pantalla del
 * cajero (/app/caja) y el módulo "Caja y finanzas" del panel (/app/admin/caja).
 */
export async function cargarCaja(restauranteId: string): Promise<DatosCaja> {
  const supabase = await crearClienteServidor()

  // El turno abierto es del RESTAURANTE, no de un usuario: lo mismo ve el cajero que lo
  // abrió, el dueño en su Tablero y el monitoreo. Se toma el más reciente con `limit(1)`
  // y no `maybeSingle()`: si por lo que sea quedaran dos turnos abiertos, maybeSingle
  // devuelve error y la pantalla diría "no hay turno" mientras otra dice que sí.
  const { data: turnoRows } = await supabase
    .from('caja_turnos')
    .select('id, base_inicial, abierto_en')
    .eq('restaurante_id', restauranteId)
    .is('cerrado_en', null)
    .order('abierto_en', { ascending: false })
    .limit(1)

  const turno: Turno = turnoRows?.[0] ?? null

  // Arqueo en vivo: ingresos y legalizaciones del turno, sumados y contados por medio.
  // La misma pasada arma "Cobrados hoy": cada cobro con su pedido, del más reciente al primero.
  const arqueo: Record<string, ArqueoMedio> = {}
  const cobrados: Cobrado[] = []
  if (turno) {
    const { data: movs } = await supabase
      .from('caja_movimientos')
      .select('id, medio, monto, tipo, creado_en, pedidos(numero, cliente_nombre, mesas(numero))')
      .eq('turno_id', turno.id)
      .in('tipo', ['ingreso', 'legalizacion'])
      .order('creado_en', { ascending: false })
    for (const m of movs ?? []) {
      if (!m.medio) continue
      const previo = arqueo[m.medio] ?? { monto: 0, pedidos: 0 }
      arqueo[m.medio] = { monto: previo.monto + m.monto, pedidos: previo.pedidos + 1 }
      cobrados.push({
        movimiento_id: m.id,
        numero: m.pedidos?.numero ?? null,
        cliente: m.pedidos?.cliente_nombre ?? null,
        mesa: m.pedidos?.mesas?.numero ?? null,
        medio: m.medio,
        monto: m.monto,
        cobrado_en: m.creado_en,
      })
    }
  }

  const [transfRes, contraRes, cobrarRes, entregadosRes] = await Promise.all([
    // Transferencias por verificar: alerta persistente hasta que caja actúe.
    supabase
      .from('pedidos')
      .select('id, numero, cliente_nombre, cliente_tel, monto_exacto, total, creado_en, zonas_domicilio(nombre)')
      .eq('restaurante_id', restauranteId)
      .eq('estado', 'esperando_pago')
      .order('creado_en'),
    // Contraentrega: efectivo pendiente de confirmar.
    supabase
      .from('pedidos')
      .select('id, numero, canal, cliente_nombre, cliente_tel, total, direccion, creado_en, zonas_domicilio(nombre)')
      .eq('restaurante_id', restauranteId)
      .eq('estado', 'pendiente')
      .eq('medio_pago', 'efectivo')
      .order('creado_en'),
    // Por cobrar en mostrador: mesa/recoger/mostrador en marcha y sin pago verificado.
    supabase
      .from('pedidos')
      .select('id, numero, canal, total, mesas(numero), pagos(estado), pedido_items(nombre_snap, cantidad)')
      .eq('restaurante_id', restauranteId)
      .in('canal', ['mesa', 'recoger', 'mostrador'])
      .in('estado', ['en_cocina', 'listo', 'en_despacho'])
      .order('creado_en'),
    // Efectivo entregado por domiciliarios que aún no ha entrado a caja.
    supabase
      .from('pedidos')
      .select('total, domiciliario_id, usuarios!pedidos_domiciliario_id_fkey(nombre)')
      .eq('restaurante_id', restauranteId)
      .eq('estado', 'entregado')
      .eq('medio_pago', 'efectivo'),
  ])

  const transferencias: Transferencia[] = (transfRes.data ?? []).map((p) => ({
    pedido_id: p.id,
    numero: p.numero,
    cliente: p.cliente_nombre,
    telefono: p.cliente_tel,
    zona: p.zonas_domicilio?.nombre ?? null,
    monto_exacto: p.monto_exacto ?? p.total,
    creado_en: p.creado_en,
  }))

  const contraentregas: Contraentrega[] = (contraRes.data ?? []).map((p) => ({
    pedido_id: p.id,
    numero: p.numero,
    canal: p.canal,
    cliente: p.cliente_nombre,
    telefono: p.cliente_tel,
    zona: p.zonas_domicilio?.nombre ?? null,
    total: p.total,
    direccion: p.direccion,
    creado_en: p.creado_en,
  }))

  const porCobrar: PorCobrar[] = (cobrarRes.data ?? [])
    .filter((p) => !(p.pagos ?? []).some((pago) => pago.estado === 'verificado'))
    .map((p) => ({
      pedido_id: p.id,
      numero: p.numero,
      canal: p.canal,
      mesa: p.mesas?.numero ?? null,
      productos:
        (p.pedido_items ?? []).map((i) => i.nombre_snap).slice(0, 3).join(', ') || null,
      total: p.total,
    }))

  const porLegalizarMapa = new Map<string, PorLegalizar>()
  for (const p of entregadosRes.data ?? []) {
    if (!p.domiciliario_id) continue
    const previo = porLegalizarMapa.get(p.domiciliario_id)
    if (previo) {
      previo.total += p.total
      previo.pedidos += 1
    } else {
      porLegalizarMapa.set(p.domiciliario_id, {
        domiciliario_id: p.domiciliario_id,
        nombre: p.usuarios?.nombre ?? 'Domiciliario',
        total: p.total,
        pedidos: 1,
      })
    }
  }

  return {
    turno,
    arqueo,
    cobrados,
    transferencias,
    contraentregas,
    porCobrar,
    porLegalizar: [...porLegalizarMapa.values()],
  }
}
