'use server'

import { revalidatePath } from 'next/cache'

import type { Database } from '@/lib/database.types'
import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'

type Resultado = { ok: true } | { ok: false; error: string }
type Canal = Database['public']['Enums']['canal_pedido']
type MedioPago = Database['public']['Enums']['medio_pago']

/** Un renglón que arma el equipo. Como el del comensal: nunca lleva precio. */
export type ItemInterno = { producto_id: string; cantidad: number; notas?: string }

export type PedidoInterno = {
  canal: Canal
  mesa_id?: string
  cliente_nombre?: string
  cliente_tel?: string
  direccion?: string
  zona_id?: string
  indicaciones?: string
  medio_pago?: MedioPago | null
  items: ItemInterno[]
  /** Si sale derecho a cocina. Caja puede dejarlo pendiente cuando falta cobrar. */
  confirmar?: boolean
}

export type ResultadoPedidoInterno =
  | { ok: true; numero: number; total: number }
  | { ok: false; error: string }

/** Deja los renglones en lo mínimo que la base acepta: qué producto, cuántos y la nota. */
function limpiar(items: ItemInterno[]) {
  return items.map((i) => ({
    producto_id: i.producto_id,
    cantidad: Math.max(1, Math.trunc(i.cantidad)),
    notas: i.notas?.trim() ?? '',
  }))
}

/**
 * El equipo toma un pedido: el mesero en la mesa cuando el cliente no tiene datos, o caja
 * cuando el cliente llama o llega al mostrador. Entra por el mismo camino que cualquier
 * otro pedido; los precios los sigue calculando la base.
 */
export async function crearPedidoInterno(
  datos: PedidoInterno,
): Promise<ResultadoPedidoInterno> {
  await exigirRol('mesero', 'cajero', 'admin')

  if (datos.items.length === 0) return { ok: false, error: 'El pedido está vacío.' }
  if (datos.canal === 'mesa' && !datos.mesa_id) {
    return { ok: false, error: 'Escoge la mesa.' }
  }
  if (datos.canal === 'domicilio' && !datos.zona_id) {
    return { ok: false, error: 'Escoge el barrio para calcular el domicilio.' }
  }
  if (datos.canal === 'domicilio' && !datos.direccion?.trim()) {
    return { ok: false, error: 'Falta la dirección de entrega.' }
  }
  if (datos.canal !== 'mesa' && !datos.cliente_nombre?.trim()) {
    return { ok: false, error: 'Falta el nombre del cliente.' }
  }

  const supabase = await crearClienteServidor()

  const { data, error } = await supabase.rpc('crear_pedido_interno', {
    p_confirmar: datos.confirmar ?? true,
    p_payload: {
      canal: datos.canal,
      medio_pago: datos.medio_pago ?? '',
      mesa_id: datos.mesa_id ?? '',
      cliente_nombre: datos.cliente_nombre?.trim() ?? '',
      cliente_tel: datos.cliente_tel?.trim() ?? '',
      direccion: datos.direccion?.trim() ?? '',
      zona_id: datos.zona_id ?? '',
      indicaciones: datos.indicaciones?.trim() ?? '',
      items: limpiar(datos.items),
      combos: [],
    },
  })
  if (error) return { ok: false, error: error.message }

  const pedido = data as unknown as { numero: number; total: number }
  revalidatePath('/app/mesero')
  revalidatePath('/app/caja')
  revalidatePath('/app/cocina', 'layout')
  return { ok: true, numero: pedido.numero, total: pedido.total }
}

/**
 * La mesa pide otra ronda sin cerrar la cuenta: lo nuevo entra al MISMO pedido y cocina
 * recibe una comanda aparte.
 */
export async function agregarACuenta(
  pedidoId: string,
  items: ItemInterno[],
): Promise<ResultadoPedidoInterno> {
  await exigirRol('mesero', 'cajero', 'admin')
  if (items.length === 0) return { ok: false, error: 'No agregaste nada.' }

  const supabase = await crearClienteServidor()
  const { data, error } = await supabase.rpc('agregar_items_pedido', {
    p_pedido: pedidoId,
    p_items: limpiar(items),
  })
  if (error) return { ok: false, error: error.message }

  const r = data as unknown as { numero: number; total: number }
  revalidatePath('/app/mesero')
  revalidatePath('/app/caja')
  revalidatePath('/app/cocina', 'layout')
  return { ok: true, numero: r.numero, total: r.total }
}

/**
 * Lo que el pedido tiene hoy, en el formato del selector, para editarlo. Junta las rondas
 * por producto (el equipo edita "cuántos", no en qué ronda iba). Los combos no se editan
 * aquí: se quedan como están.
 */
export async function itemsParaEditar(
  pedidoId: string,
): Promise<{ ok: true; items: ItemInterno[]; combos: number } | { ok: false; error: string }> {
  await exigirRol('mesero', 'cajero', 'admin')
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('pedido_items')
    .select('producto_id, cantidad, notas, promocion_id')
    .eq('pedido_id', pedidoId)
    .order('ronda')
  if (error) return { ok: false, error: error.message }

  const porProducto = new Map<string, ItemInterno>()
  let combos = 0
  for (const i of data ?? []) {
    if (i.promocion_id) {
      combos += 1
      continue
    }
    const previo = porProducto.get(i.producto_id)
    const notas = [previo?.notas, i.notas ?? undefined]
      .filter((n): n is string => Boolean(n && n.trim()))
      .filter((n, k, arr) => arr.indexOf(n) === k)
      .join(' / ')
    porProducto.set(i.producto_id, {
      producto_id: i.producto_id,
      cantidad: (previo?.cantidad ?? 0) + i.cantidad,
      notas: notas || undefined,
    })
  }
  return { ok: true, items: [...porProducto.values()], combos }
}

/**
 * Edita un pedido: cantidades, productos y notas. Los precios los pone la base, y cocina
 * ve el cambio de una (lo que se sumó le llega como comanda nueva).
 */
export async function editarPedido(
  pedidoId: string,
  items: ItemInterno[],
): Promise<ResultadoPedidoInterno> {
  await exigirRol('mesero', 'cajero', 'admin')
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase.rpc('editar_pedido', {
    p_pedido: pedidoId,
    p_items: limpiar(items.filter((i) => i.cantidad > 0)),
  })
  if (error) return { ok: false, error: error.message }
  const r = data as unknown as { numero: number; total: number }
  revalidatePath('/app/mesero')
  revalidatePath('/app/caja')
  revalidatePath('/app/cocina', 'layout')
  return { ok: true, numero: r.numero, total: r.total }
}

/** Anula un pedido con su motivo. El mesero solo los del salón sin plata recibida. */
export async function anularPedidoEquipo(pedidoId: string, motivo: string): Promise<Resultado> {
  await exigirRol('mesero', 'cajero', 'admin')
  const supabase = await crearClienteServidor()
  const { error } = await supabase.rpc('anular_pedido', { p_pedido: pedidoId, p_motivo: motivo })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/mesero')
  revalidatePath('/app/caja')
  revalidatePath('/app/cocina', 'layout')
  return { ok: true }
}

/**
 * Confirma un pedido de mesa: manda las comandas a todas las estaciones de una. La RLS y
 * `confirmar_pedido()` validan que el pedido sea del mismo restaurante.
 */
export async function confirmarPedido(pedidoId: string): Promise<Resultado> {
  await exigirRol('mesero', 'admin')
  const supabase = await crearClienteServidor()

  const { error } = await supabase.rpc('confirmar_pedido', { p_pedido: pedidoId })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/mesero')
  revalidatePath('/app/cocina', 'layout')
  return { ok: true }
}

/** El mesero recogió lo listo y lo puso en la mesa. La cuenta sigue abierta para caja. */
export async function marcarServido(pedidoId: string): Promise<Resultado> {
  await exigirRol('mesero', 'cajero', 'admin')
  const supabase = await crearClienteServidor()

  const { error } = await supabase.rpc('marcar_servido', { p_pedido: pedidoId })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/mesero')
  revalidatePath('/app/caja')
  return { ok: true }
}

/** Cocina marca el pedido completo: pendiente → preparando → listo, todas las estaciones. */
export async function marcarRondaCocina(
  pedidoId: string,
  ronda: number,
  estado: 'preparando' | 'listo',
): Promise<Resultado> {
  await exigirRol('cocina', 'admin')
  const supabase = await crearClienteServidor()

  // Un solo toque mueve TODAS las comandas de la ronda (rápida, asados y bebidas): la
  // tarjeta de cocina es el pedido completo, no una estación.
  const { error } = await supabase.rpc('marcar_ronda_cocina', {
    p_pedido: pedidoId,
    p_ronda: ronda,
    p_estado: estado,
  })
  if (error) return { ok: false, error: error.message }

  // La respuesta de la acción ya trae la pantalla actualizada: el tablero no depende de
  // Realtime (ni de recargar) para reflejar el cambio.
  revalidatePath('/app/cocina', 'layout')
  revalidatePath('/app/mesero')
  revalidatePath('/app/caja')
  return { ok: true }
}

/** Cocina apaga o prende la disponibilidad de un producto cuando se agota. */
export async function cambiarDisponibilidad(
  productoId: string,
  disponible: boolean,
): Promise<Resultado> {
  await exigirRol('cocina', 'admin')
  const supabase = await crearClienteServidor()

  const { error } = await supabase
    .from('productos')
    .update({ disponible })
    .eq('id', productoId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/cocina', 'layout')
  return { ok: true }
}
