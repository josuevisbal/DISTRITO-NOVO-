'use server'

import { revalidatePath } from 'next/cache'

import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'

type Resultado = { ok: true } | { ok: false; error: string }

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

export async function falloEntrega(pedidoId: string, motivo: string): Promise<Resultado> {
  await exigirRol('domicilio')
  const supabase = await crearClienteServidor()
  const { error } = await supabase.rpc('fallo_entrega', { p_pedido: pedidoId, p_motivo: motivo })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/domicilios')
  return { ok: true }
}
