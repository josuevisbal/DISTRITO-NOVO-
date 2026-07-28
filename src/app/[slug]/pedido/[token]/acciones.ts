'use server'

import { crearClienteConToken } from '@/lib/supabase/token'

export type ItemRecuperado = { producto_id: string; cantidad: number; notas: string }

export type ResultadoModificar =
  | { ok: true; items: ItemRecuperado[] }
  | { ok: false; error: string }

/**
 * El cliente quiere cambiar su pedido y todavía no lo ha pagado. La base solo lo permite
 * si sigue en 'esperando_pago' —nada en cocina, ninguna plata movida—: lo anula y
 * devuelve sus productos para que la carta rearme el carrito.
 */
export async function modificarPedido(token: string): Promise<ResultadoModificar> {
  const supabase = crearClienteConToken(token)

  const { data, error } = await supabase.rpc('modificar_pedido_cliente', { p_token: token })
  if (error) return { ok: false, error: error.message }

  return { ok: true, items: (data ?? []) as unknown as ItemRecuperado[] }
}
