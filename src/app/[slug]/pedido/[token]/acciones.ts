'use server'

import { crearClienteConToken } from '@/lib/supabase/token'

export type ItemRecuperado = { producto_id: string; cantidad: number; notas: string }

export type ResultadoEditar =
  | { ok: true; items: ItemRecuperado[] }
  | { ok: false; error: string }

/**
 * El cliente quiere cambiar su pedido y todavía no lo han aprobado. Congela el pedido
 * (caja no lo verifica mientras tanto) y devuelve sus productos para rearmar el carrito.
 * El mismo pedido y el mismo número: no se crea otro.
 */
export async function iniciarEdicion(token: string): Promise<ResultadoEditar> {
  const supabase = crearClienteConToken(token)

  const { data, error } = await supabase.rpc('iniciar_edicion_pedido', { p_token: token })
  if (error) return { ok: false, error: error.message }

  return { ok: true, items: (data ?? []) as unknown as ItemRecuperado[] }
}

/** Si se arrepiente, el pedido se descongela y queda como estaba. */
export async function cancelarEdicion(token: string): Promise<void> {
  const supabase = crearClienteConToken(token)
  await supabase.rpc('cancelar_edicion_pedido', { p_token: token })
}
