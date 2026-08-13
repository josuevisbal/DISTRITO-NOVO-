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

/**
 * Cobra un pedido. La PROPINA va aparte del total: el cliente decide cuánto deja, caja lo
 * digita y entra a la caja sumado al cobro, pero marcado para que el arqueo lo separe de
 * la venta. Sin propina, va en cero: nadie la calcula sola.
 */
export async function registrarCobro(
  pedidoId: string,
  medio: MedioReal,
  propina = 0,
): Promise<Resultado> {
  await exigirRol('cajero', 'admin')
  const supabase = await crearClienteServidor()
  const { error } = await supabase.rpc('registrar_cobro', {
    p_pedido: pedidoId,
    p_medio: medio,
    p_propina: Math.max(0, Math.trunc(propina)),
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/caja')
  revalidatePath('/app/admin/caja')
  return { ok: true }
}

/**
 * Cobra una cuenta repartida entre varios medios: parte en efectivo, parte con datáfono,
 * parte transferida. La base exige que la suma dé exacto lo que vale la cuenta más la
 * propina, y deja un movimiento por medio para que el arqueo cuadre solo.
 */
export async function registrarCobroMixto(
  pedidoId: string,
  pagos: { medio: MedioReal; monto: number }[],
  propina = 0,
): Promise<Resultado> {
  await exigirRol('cajero', 'admin')
  const supabase = await crearClienteServidor()

  const limpios = pagos
    .map((p) => ({ medio: p.medio, monto: Math.max(0, Math.trunc(p.monto)) }))
    .filter((p) => p.monto > 0)
  if (limpios.length === 0) return { ok: false, error: 'Escoge al menos un medio de pago.' }

  const { error } = await supabase.rpc('registrar_cobro_mixto', {
    p_pedido: pedidoId,
    p_pagos: limpios,
    p_propina: Math.max(0, Math.trunc(propina)),
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/caja')
  revalidatePath('/app/admin/caja')
  return { ok: true }
}

/**
 * Caja le entrega el domicilio a un repartidor. Sin pase de por medio: en cuanto cocina
 * deja el pedido listo, caja escoge a quién se lo lleva y el pedido pasa a despacho.
 */
export async function asignarDomiciliario(
  pedidoId: string,
  domiciliarioId: string,
): Promise<Resultado> {
  await exigirRol('cajero', 'admin')
  const supabase = await crearClienteServidor()
  const { error } = await supabase.rpc('asignar_domiciliario', {
    p_pedido: pedidoId,
    p_domi: domiciliarioId,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/caja')
  revalidatePath('/app/admin/caja')
  revalidatePath('/app/domicilios')
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
  /** Cuánto del turno fue propina. Entró a la caja, pero no es venta del restaurante. */
  propinas: number
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
