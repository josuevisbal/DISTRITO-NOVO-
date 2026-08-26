'use server'

import { revalidatePath } from 'next/cache'

import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'

type Resultado = { ok: true } | { ok: false; error: string }

/**
 * El domiciliario toma del mostrador el pedido que va a llevar: lo busca por el nombre
 * del cliente —el mismo que trae la cuenta pegada al pedido— y lo marca suyo. Si otro se
 * le adelantó, la base lo dice en vez de quitárselo.
 */
export async function tomarDomicilio(pedidoId: string): Promise<Resultado> {
  await exigirRol('domicilio')
  const supabase = await crearClienteServidor()
  const { error } = await supabase.rpc('tomar_domicilio', { p_pedido: pedidoId })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/domicilios')
  revalidatePath('/app/caja')
  return { ok: true }
}

export async function recogerPedido(pedidoId: string): Promise<Resultado> {
  await exigirRol('domicilio')
  const supabase = await crearClienteServidor()
  const { error } = await supabase.rpc('recoger_pedido', { p_pedido: pedidoId })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/domicilios')
  return { ok: true }
}

export async function entregarPedido(pedidoId: string): Promise<Resultado> {
  await exigirRol('domicilio')
  const supabase = await crearClienteServidor()
  const { error } = await supabase.rpc('entregar_pedido', { p_pedido: pedidoId })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/domicilios')
  return { ok: true }
}

/**
 * En la puerta el cliente paga distinto a lo acordado: pone una parte en efectivo y
 * transfiere el resto. El domiciliario digita cuánto recibió en efectivo —eso es lo
 * único que va a traer al cierre— y lo demás queda para que caja lo verifique. Con 0
 * de efectivo es el caso de siempre: el cliente transfiere todo. El pedido NO se cierra
 * aquí: la cuenta sigue abierta hasta que la plata entre.
 */
export async function repartirPagoEntrega(
  pedidoId: string,
  efectivo: number,
): Promise<Resultado> {
  await exigirRol('domicilio')
  const supabase = await crearClienteServidor()
  const { error } = await supabase.rpc('repartir_pago_entrega', {
    p_pedido: pedidoId,
    p_efectivo: Math.max(0, Math.trunc(efectivo)),
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/domicilios')
  revalidatePath('/app/caja')
  return { ok: true }
}

export async function falloEntrega(pedidoId: string, motivo: string): Promise<Resultado> {
  await exigirRol('domicilio')
  const supabase = await crearClienteServidor()
  const { error } = await supabase.rpc('fallo_entrega', { p_pedido: pedidoId, p_motivo: motivo })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/domicilios')
  return { ok: true }
}
