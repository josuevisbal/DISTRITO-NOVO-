import { crearClienteServidor } from '@/lib/supabase/servidor'
import { inicioDeHoyISO } from '@/lib/zona-horaria'

export type VentaEstacion = {
  estacion_id: string
  nombre: string
  color: string
  total: number
}

export type AlertaTablero = {
  tipo: 'transferencias' | 'agotados' | 'devueltos' | 'entregados' | 'turno'
  cantidad: number
  texto: string
  href: string
}

export type DatosTablero = {
  ventasHoy: number
  pedidosHoy: number
  ticketPromedio: number
  enCocina: number
  turnoAbierto: boolean
  porEstacion: VentaEstacion[]
  alertas: AlertaTablero[]
}

/** Resumen del día para el Tablero. "Hoy" es el día del negocio (zona horaria propia). */
export async function cargarTablero(restauranteId: string): Promise<DatosTablero> {
  const supabase = await crearClienteServidor()
  const desde = inicioDeHoyISO()

  const [
    pedidosRes,
    cocinaRes,
    itemsRes,
    estacionesRes,
    turnoRes,
    transfRes,
    agotadosRes,
    devueltosRes,
    entregadosRes,
  ] = await Promise.all([
      // Ventas del día: todo pedido no anulado creado hoy.
      supabase
        .from('pedidos')
        .select('total')
        .eq('restaurante_id', restauranteId)
        .neq('estado', 'anulado')
        .gte('creado_en', desde),
      supabase
        .from('pedidos')
        .select('id', { count: 'exact', head: true })
        .eq('restaurante_id', restauranteId)
        .eq('estado', 'en_cocina'),
      // Venta por estación: renglones de los pedidos de hoy.
      supabase
        .from('pedido_items')
        .select('estacion_id, precio_snap, cantidad, pedidos!inner(restaurante_id, estado, creado_en)')
        .eq('pedidos.restaurante_id', restauranteId)
        .neq('pedidos.estado', 'anulado')
        .gte('pedidos.creado_en', desde),
      supabase
        .from('estaciones')
        .select('id, nombre, color')
        .eq('restaurante_id', restauranteId)
        .eq('activa', true)
        .order('orden'),
      supabase
        .from('caja_turnos')
        .select('id')
        .eq('restaurante_id', restauranteId)
        .is('cerrado_en', null)
        .limit(1),
      supabase
        .from('pedidos')
        .select('id', { count: 'exact', head: true })
        .eq('restaurante_id', restauranteId)
        .eq('estado', 'esperando_pago'),
      supabase
        .from('productos')
        .select('id', { count: 'exact', head: true })
        .eq('restaurante_id', restauranteId)
        .eq('activo', true)
        .eq('disponible', false),
      supabase
        .from('pedidos')
        .select('id', { count: 'exact', head: true })
        .eq('restaurante_id', restauranteId)
        .eq('estado', 'en_despacho')
        .not('nota_entrega', 'is', null),
      // Domicilios ya entregados cuya plata todavía no entró a la caja.
      supabase
        .from('pedidos')
        .select('id', { count: 'exact', head: true })
        .eq('restaurante_id', restauranteId)
        .eq('estado', 'entregado'),
    ])

  const totales = (pedidosRes.data ?? []).map((p) => p.total)
  const ventasHoy = totales.reduce((s, t) => s + t, 0)
  const pedidosHoy = totales.length

  const porEstacionMapa = new Map<string, number>()
  for (const i of itemsRes.data ?? []) {
    porEstacionMapa.set(
      i.estacion_id,
      (porEstacionMapa.get(i.estacion_id) ?? 0) + i.precio_snap * i.cantidad,
    )
  }

  const porEstacion: VentaEstacion[] = (estacionesRes.data ?? []).map((e) => ({
    estacion_id: e.id,
    nombre: e.nombre,
    color: e.color,
    total: porEstacionMapa.get(e.id) ?? 0,
  }))

  const turnoAbierto = (turnoRes.data ?? []).length > 0

  const alertas: AlertaTablero[] = []
  const nTransf = transfRes.count ?? 0
  if (nTransf > 0) {
    alertas.push({
      tipo: 'transferencias',
      cantidad: nTransf,
      texto:
        nTransf === 1
          ? '1 transferencia sin verificar en caja'
          : `${nTransf} transferencias sin verificar en caja`,
      href: '/app/admin/caja',
    })
  }
  const nAgotados = agotadosRes.count ?? 0
  if (nAgotados > 0) {
    alertas.push({
      tipo: 'agotados',
      cantidad: nAgotados,
      texto:
        nAgotados === 1 ? '1 producto marcado agotado' : `${nAgotados} productos marcados agotados`,
      href: '/app/admin/carta',
    })
  }
  const nDevueltos = devueltosRes.count ?? 0
  if (nDevueltos > 0) {
    alertas.push({
      tipo: 'devueltos',
      cantidad: nDevueltos,
      texto:
        nDevueltos === 1
          ? '1 domicilio volvió sin entregarse'
          : `${nDevueltos} domicilios volvieron sin entregarse`,
      href: '/app/caja',
    })
  }
  // Lo que el domiciliario ya entregó y todavía nadie ha cobrado. El turno no cierra
  // con nada de esto pendiente, así que verlo temprano evita la carrera del cierre.
  const nEntregados = entregadosRes.count ?? 0
  if (nEntregados > 0) {
    alertas.push({
      tipo: 'entregados',
      cantidad: nEntregados,
      texto:
        nEntregados === 1
          ? '1 domicilio entregado sin cobrar'
          : `${nEntregados} domicilios entregados sin cobrar`,
      href: '/app/admin/monitoreo/caja',
    })
  }
  if (!turnoAbierto) {
    alertas.push({
      tipo: 'turno',
      cantidad: 1,
      texto: 'No hay turno de caja abierto',
      href: '/app/admin/caja',
    })
  }

  return {
    ventasHoy,
    pedidosHoy,
    ticketPromedio: pedidosHoy > 0 ? Math.round(ventasHoy / pedidosHoy) : 0,
    enCocina: cocinaRes.count ?? 0,
    turnoAbierto,
    porEstacion,
    alertas,
  }
}
