import { createBrowserClient } from '@supabase/ssr'

import type { Database } from '@/lib/database.types'
import { llavePublicable, urlSupabase } from './entorno'

/** Cliente de Supabase para componentes de cliente (Realtime en cocina, pase y caja). */
export function crearClienteNavegador() {
  return createBrowserClient<Database>(urlSupabase(), llavePublicable())
}
