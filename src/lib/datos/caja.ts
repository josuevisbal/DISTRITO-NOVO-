import type {
  Contraentrega,
  Despacho,
  Entregado,
  PorCobrar,
  PorLegalizar,
  Transferencia,
  Turno,
} from '@/app/app/caja/caja-cliente'
import type { CategoriaElegible, ProductoElegible } from '@/components/pedido/selector-productos'
import { crearClienteServidor } from '@/lib/supabase/servidor'

/** Barrio y su tarifa fija: el domicilio se cobra por zona, no por distancia. */
export type ZonaCaja = { id: string; nombre: string; valor: number }

/** Lo cobrado por un medio (o por un origen) en el turno: monto y cuántos pedidos. */
export type ArqueoMedio = { monto: number; pedidos: number }

/**
 * Los tres bloques del resumen de la caja:
 *  · `fisicas`  — lo que se vendió EN el local: mesas del salón, mostrador y para recoger.
 *  · `calle`    — lo que salió con un domiciliario (domicilio y lo que entra por WhatsApp).
 *  · `general`  — las dos anteriores juntas. Es el total del turno.
 */
export type GrupoVenta = 'fisicas' | 'calle' | 'general'

/** Un bloque del resumen: su total, cuántos pedidos y el desglose por medio de pago. */
export type ResumenGrupo = {
  total: number
  pedidos: number
  medios: Record<string, ArqueoMedio>
}

export type ResumenVentas = Record<GrupoVenta, ResumenGrupo>

/** Lo que sale con domiciliario es "de la calle"; todo lo demás se vendió en el local. */
function grupoDe(canal: string | null): Exclude<GrupoVenta, 'general'> {
  return canal === 'domicilio' || canal === 'whatsapp' ? 'calle' : 'fisicas'
}

/** Un cobro ya hecho en el turno: la trazabilidad de "Cobrados hoy". */
export type Cobrado = {
  movimiento_id: string
  /** Para abrir la factura del pedido. Null si el movimiento no venía de un pedido. */
  pedido_id: string | null
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
  /** Ventas físicas, de la calle y generales, cada una con su desglose por medio. */
  ventas: ResumenVentas
  cobrados: Cobrado[]
  transferencias: Transferencia[]
  contraentregas: Contraentrega[]
  porCobrar: PorCobrar[]
  porLegalizar: PorLegalizar[]
  /**
   * Entregas hechas que todavía no tienen la plata en caja: el efectivo que trae el
   * domiciliario y las transferencias que reportó en la puerta. Una fila por pedido.
   */
  entregados: Entregado[]
  /** Domicilios que cocina ya terminó: caja escoge quién los lleva. */
  despachos: Despacho[]
  /** La carta, para que caja tome pedidos de quien llama o llega al mostrador. */
  categorias: CategoriaElegible[]
  productos: ProductoElegible[]
  zonas: ZonaCaja[]
}

/**
 * Todo lo que pinta la pantalla de Caja, en una pasada. Lo comparten la pantalla del
 * cajero (/app/caja) y el módulo "Caja y finanzas" del panel (/app/admin/caja).
 */
export async function cargarCaja(restauranteId: string): Promise<DatosCaja> {
  const supabase = await crearClienteServidor()

  // El turno abierto es del RESTAURANTE, no de un usuario: lo mismo ve el cajero que lo
  // abrió, administración en su Tablero y el monitoreo. Se toma el más reciente con `limit(1)`
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

  // Arqueo en vivo: ingresos y legalizaciones del turno, repartidos en los tres bloques
  // del resumen y, dentro de cada uno, por medio de pago. La misma pasada arma
  // "Cobros del turno": cada cobro con su pedido, del más reciente al primero.
  const grupoVacio = (): ResumenGrupo => ({ total: 0, pedidos: 0, medios: {} })
  const ventas: ResumenVentas = {
    fisicas: grupoVacio(),
    calle: grupoVacio(),
    general: grupoVacio(),
  }
  // Un pedido pagado a medias (efectivo + transferencia) deja DOS movimientos: se anota
  // cuáles ya se contaron para no contar el mismo pedido dos veces.
  const vistos: Record<GrupoVenta, Set<string>> = {
    fisicas: new Set(),
    calle: new Set(),
    general: new Set(),
  }
  const vistosPorMedio: Record<GrupoVenta, Map<string, Set<string>>> = {
    fisicas: new Map(),
    calle: new Map(),
    general: new Map(),
  }

  function anotar(grupo: GrupoVenta, medio: string, monto: number, llave: string) {
    const bloque = ventas[grupo]
    bloque.total += monto
    if (!vistos[grupo].has(llave)) {
      bloque.pedidos += 1
      vistos[grupo].add(llave)
    }

    const yaEnMedio = vistosPorMedio[grupo].get(medio) ?? new Set<string>()
    const previo = bloque.medios[medio] ?? { monto: 0, pedidos: 0 }
    bloque.medios[medio] = {
      monto: previo.monto + monto,
      pedidos: previo.pedidos + (yaEnMedio.has(llave) ? 0 : 1),
    }
    yaEnMedio.add(llave)
    vistosPorMedio[grupo].set(medio, yaEnMedio)
  }

  const cobrados: Cobrado[] = []
  if (turno) {
    const { data: movs } = await supabase
      .from('caja_movimientos')
      .select(
        'id, medio, monto, tipo, creado_en, pedido_id, pedidos(numero, canal, cliente_nombre, mesas(numero))',
      )
      .eq('turno_id', turno.id)
      .in('tipo', ['ingreso', 'legalizacion'])
      .order('creado_en', { ascending: false })
    for (const m of movs ?? []) {
      if (!m.medio) continue
      // La llave para no contar dos veces: el pedido si lo hay, si no el movimiento.
      const llave = m.pedido_id ?? m.id
      const grupo = grupoDe(m.pedidos?.canal ?? null)
      anotar(grupo, m.medio, m.monto, llave)
      anotar('general', m.medio, m.monto, llave)

      cobrados.push({
        movimiento_id: m.id,
        pedido_id: m.pedido_id,
        numero: m.pedidos?.numero ?? null,
        cliente: m.pedidos?.cliente_nombre ?? null,
        mesa: m.pedidos?.mesas?.numero ?? null,
        medio: m.medio,
        monto: m.monto,
        cobrado_en: m.creado_en,
      })
    }
  }

  const [
    transfRes,
    contraRes,
    cobrarRes,
    entregadosRes,
    despachoRes,
    categoriaRes,
    productoRes,
    zonaRes,
  ] = await Promise.all([
    // Transferencias por verificar: alerta persistente hasta que caja actúe.
    supabase
      .from('pedidos')
      .select('id, numero, cliente_nombre, cliente_tel, monto_exacto, total, creado_en, en_edicion, zonas_domicilio(nombre)')
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
    // Todo lo entregado que aún no tiene la plata en caja, pedido por pedido: el
    // efectivo que trae el domiciliario y las transferencias que reportó en la puerta.
    supabase
      .from('pedidos')
      .select(
        'id, numero, total, medio_pago, entregado_en, pago_cambiado_en, cliente_nombre, direccion, domiciliario_id, usuarios!pedidos_domiciliario_id_fkey(nombre), zonas_domicilio(nombre), pagos(estado, medio, monto)',
      )
      .eq('restaurante_id', restauranteId)
      .eq('estado', 'entregado')
      .order('entregado_en'),
    // Domicilios que cocina terminó ('listo') y los que ya salieron a la calle
    // ('en_despacho'), para asignar o reasignar quién los lleva.
    supabase
      .from('pedidos')
      .select(
        'id, numero, estado, direccion, nota_entrega, domiciliario_id, total, medio_pago, usuarios!pedidos_domiciliario_id_fkey(nombre), zonas_domicilio(nombre)',
      )
      .eq('restaurante_id', restauranteId)
      .eq('canal', 'domicilio')
      .in('estado', ['listo', 'en_despacho'])
      .order('creado_en'),
    supabase
      .from('categorias')
      .select('id, nombre')
      .eq('restaurante_id', restauranteId)
      .eq('activa', true)
      .order('orden'),
    supabase
      .from('productos')
      .select('id, nombre, precio, categoria_id, disponible')
      .eq('restaurante_id', restauranteId)
      .eq('activo', true)
      .order('orden'),
    supabase
      .from('zonas_domicilio')
      .select('id, nombre, valor')
      .eq('restaurante_id', restauranteId)
      .eq('activa', true)
      .order('valor'),
  ])

  const transferencias: Transferencia[] = (transfRes.data ?? []).map((p) => ({
    pedido_id: p.id,
    numero: p.numero,
    cliente: p.cliente_nombre,
    telefono: p.cliente_tel,
    zona: p.zonas_domicilio?.nombre ?? null,
    monto_exacto: p.monto_exacto ?? p.total,
    creado_en: p.creado_en,
    // 15 min: si dejó la edición a medias, caja no queda bloqueada para siempre.
    en_edicion:
      p.en_edicion !== null &&
      new Date(p.en_edicion).getTime() > Date.now() - 15 * 60 * 1000,
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

  // Entregas con plata todavía en el aire. Con pago repartido una parte puede estar ya
  // verificada (la transferencia) y la otra no: lo que manda es lo que sigue pendiente.
  const entregados: Entregado[] = (entregadosRes.data ?? [])
    .map((p) => {
      const pendientes = (p.pagos ?? []).filter((g) => g.estado === 'pendiente')
      const sumar = (medio: string) =>
        pendientes.filter((g) => g.medio === medio).reduce((s, g) => s + g.monto, 0)
      return {
        pedido_id: p.id,
        numero: p.numero,
        total: p.total,
        cliente: p.cliente_nombre,
        direccion: p.direccion,
        zona: p.zonas_domicilio?.nombre ?? null,
        entregado_en: p.entregado_en,
        domiciliario_id: p.domiciliario_id,
        domiciliario_nombre: p.usuarios?.nombre ?? null,
        // Lo que trae el domiciliario y lo que tiene que verificar caja.
        efectivo: sumar('efectivo'),
        transferencia: sumar('transferencia'),
        cambio_reportado: p.pago_cambiado_en !== null,
      }
    })
    .filter((p) => p.efectivo > 0 || p.transferencia > 0)

  // El efectivo que cada domiciliario debe entregar, con el detalle de qué pedidos. Se
  // cuenta SOLO su parte en efectivo: lo transferido no pasa por sus manos.
  const porLegalizarMapa = new Map<string, PorLegalizar>()
  for (const p of entregados) {
    if (!p.domiciliario_id || p.efectivo === 0) continue
    const renglon = { numero: p.numero, total: p.efectivo, cliente: p.cliente }
    const previo = porLegalizarMapa.get(p.domiciliario_id)
    if (previo) {
      previo.total += p.efectivo
      previo.pedidos += 1
      previo.detalle.push(renglon)
    } else {
      porLegalizarMapa.set(p.domiciliario_id, {
        domiciliario_id: p.domiciliario_id,
        nombre: p.domiciliario_nombre ?? 'Domiciliario',
        total: p.efectivo,
        pedidos: 1,
        detalle: [renglon],
      })
    }
  }

  const despachos: Despacho[] = (despachoRes.data ?? []).map((p) => ({
    pedido_id: p.id,
    numero: p.numero,
    estado: p.estado as 'listo' | 'en_despacho',
    direccion: p.direccion,
    zona: p.zonas_domicilio?.nombre ?? null,
    nota_entrega: p.nota_entrega,
    total: p.total,
    contraentrega: p.medio_pago === 'efectivo',
    domiciliario_id: p.domiciliario_id,
    domiciliario_nombre: p.usuarios?.nombre ?? null,
  }))

  return {
    turno,
    // El arqueo por medio del turno es, exactamente, el desglose del bloque general.
    arqueo: ventas.general.medios,
    ventas,
    cobrados,
    transferencias,
    contraentregas,
    porCobrar,
    porLegalizar: [...porLegalizarMapa.values()],
    entregados,
    despachos,
    categorias: categoriaRes.data ?? [],
    productos: productoRes.data ?? [],
    zonas: zonaRes.data ?? [],
  }
}
