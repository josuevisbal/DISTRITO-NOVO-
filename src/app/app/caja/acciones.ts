'use server'

import { revalidatePath } from 'next/cache'

import type { Database } from '@/lib/database.types'
import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'

type MedioReal = Exclude<Database['public']['Enums']['medio_pago'], 'mesa'>
type Resultado = { ok: true } | { ok: false; error: string }

export async function abrirTurno(base: number): Promise<Resultado> {
  await exigirRol('cajero', 'admin')
  const supabase = await crearClienteServidor()
  const { error } = await supabase.rpc('abrir_turno', { p_base: Math.max(0, Math.trunc(base)) })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/caja')
  revalidatePath('/app/admin/caja')
  return { ok: true }
}

export async function verificarTransferencia(
  pedidoId: string,
  ok: boolean,
  motivo?: string,
): Promise<Resultado> {
  await exigirRol('cajero', 'admin')
  const supabase = await crearClienteServidor()
  const { error } = await supabase.rpc('verificar_transferencia', {
    p_pedido: pedidoId,
    p_ok: ok,
    p_motivo: motivo,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/caja')
  revalidatePath('/app/admin/caja')
  return { ok: true }
}

export async function registrarCobro(pedidoId: string, medio: MedioReal): Promise<Resultado> {
  await exigirRol('cajero', 'admin')
  const supabase = await crearClienteServidor()
  const { error } = await supabase.rpc('registrar_cobro', { p_pedido: pedidoId, p_medio: medio })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/caja')
  revalidatePath('/app/admin/caja')
  return { ok: true }
}

export async function confirmarContraentrega(pedidoId: string): Promise<Resultado> {
  await exigirRol('cajero', 'admin')
  const supabase = await crearClienteServidor()
  const { error } = await supabase.rpc('confirmar_contraentrega', { p_pedido: pedidoId })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/caja')
  revalidatePath('/app/admin/caja')
  return { ok: true }
}

export async function anularPedido(pedidoId: string, motivo: string): Promise<Resultado> {
  await exigirRol('cajero', 'admin')
  const supabase = await crearClienteServidor()
  const { error } = await supabase.rpc('anular_pedido', { p_pedido: pedidoId, p_motivo: motivo })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/caja')
  revalidatePath('/app/admin/caja')
  return { ok: true }
}

/** Caja recibe (legaliza) todo el efectivo que un domiciliario entregó en el turno. */
export async function legalizarDomiciliario(domiId: string): Promise<Resultado> {
  await exigirRol('cajero', 'admin')
  const supabase = await crearClienteServidor()
  const { error } = await supabase.rpc('legalizar_domiciliario', { p_domi: domiId })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/caja')
  revalidatePath('/app/admin/caja')
  return { ok: true }
}

export type ArqueoCierre = {
  base_inicial: number
  efectivo_esperado: number
  efectivo_contado: number
  diferencia: number
  por_medio: Record<string, number>
}

export async function cerrarTurno(
  efectivoContado: number,
  nota?: string,
): Promise<{ ok: true; arqueo: ArqueoCierre } | { ok: false; error: string }> {
  await exigirRol('cajero', 'admin')
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase.rpc('cerrar_turno', {
    p_efectivo_contado: Math.max(0, Math.trunc(efectivoContado)),
    p_nota: nota,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/caja')
  revalidatePath('/app/admin/caja')
  return { ok: true, arqueo: data as unknown as ArqueoCierre }
}
