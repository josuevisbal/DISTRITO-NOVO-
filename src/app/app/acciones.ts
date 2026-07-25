'use server'

import { revalidatePath } from 'next/cache'

import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'

type Resultado = { ok: true } | { ok: false; error: string }

/**
 * Confirma un pedido: aquí se dispara el escalonado. La RLS y `confirmar_pedido()` validan
 * que el pedido sea del mismo restaurante; el rol lo acotamos a mesero (mesa) y admin.
 */
export async function confirmarPedido(pedidoId: string): Promise<Resultado> {
  await exigirRol('mesero', 'admin')
  const supabase = await crearClienteServidor()

  const { error } = await supabase.rpc('confirmar_pedido', { p_pedido: pedidoId })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/mesero')
  revalidatePath('/app/pase')
  return { ok: true }
}

/** Cocina marca su comanda: pendiente → preparando → listo. Solo su estación (RLS). */
export async function cambiarEstadoComanda(
  comandaId: string,
  estado: 'preparando' | 'listo',
): Promise<Resultado> {
  await exigirRol('cocina', 'admin', 'pase')
  const supabase = await crearClienteServidor()

  const { error } = await supabase.from('comandas').update({ estado }).eq('id', comandaId)
  if (error) return { ok: false, error: error.message }

  // La respuesta de la acción ya trae la pantalla actualizada: el tablero no depende de
  // Realtime (ni de recargar) para reflejar el cambio.
  revalidatePath('/app/cocina', 'layout')
  revalidatePath('/app/pase')
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

/** El pase libera un pedido listo hacia despacho. */
export async function liberarPedido(pedidoId: string): Promise<Resultado> {
  await exigirRol('pase', 'admin')
  const supabase = await crearClienteServidor()

  const { error } = await supabase
    .from('pedidos')
    .update({ estado: 'en_despacho' })
    .eq('id', pedidoId)
    .eq('estado', 'listo')
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/pase')
  return { ok: true }
}

/** El pase asigna un domiciliario a un pedido en despacho. */
export async function asignarDomiciliario(
  pedidoId: string,
  domiciliarioId: string,
): Promise<Resultado> {
  await exigirRol('pase', 'admin')
  const supabase = await crearClienteServidor()

  const { error } = await supabase.rpc('asignar_domiciliario', {
    p_pedido: pedidoId,
    p_domi: domiciliarioId,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/pase')
  return { ok: true }
}
