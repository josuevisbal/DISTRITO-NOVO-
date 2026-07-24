import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/database.types'
import { llavePublicable, urlSupabase } from './entorno'

/**
 * Cliente para el seguimiento público de un pedido.
 *
 * El comensal no tiene cuenta: su permiso es el token del pedido, que viaja en la cabecera
 * `x-pedido-token` y que la RLS compara contra `pedidos.token`. Va en cabecera y no en la
 * consulta a propósito: así el filtro no lo pone el front —que se puede manipular— sino la
 * base, y no hay forma de pedir el pedido de otro.
 *
 * Sin sesión ni cookies: este cliente es anónimo y de un solo uso.
 */
export function crearClienteConToken(token: string) {
  return createClient<Database>(urlSupabase(), llavePublicable(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-pedido-token': token } },
  })
}
