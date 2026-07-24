import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import type { Database } from '@/lib/database.types'
import { llavePublicable, urlSupabase } from './entorno'

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * Usa la llave publicable: la RLS del esquema es la que decide qué se ve.
 */
export async function crearClienteServidor() {
  const almacen = await cookies()

  return createServerClient<Database>(urlSupabase(), llavePublicable(), {
    cookies: {
      getAll() {
        return almacen.getAll()
      },
      setAll(nuevas) {
        try {
          for (const { name, value, options } of nuevas) {
            almacen.set(name, value, options)
          }
        } catch {
          // Un Server Component no puede escribir cookies: la sesión la refresca el middleware.
        }
      },
    },
  })
}
