import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import type { Database } from '@/lib/database.types'
import { llavePublicable, urlSupabase } from './entorno'
import { idDeSesion } from './sesion-verificada'

/**
 * Refresca la sesión en cada request y protege el área interna `/app`.
 *
 * Sin esto, un token vencido nunca se renueva y el staff se sale solo. Aquí se hace la
 * única comprobación barata —¿hay sesión?— y la de rol vive en cada pantalla, que es
 * donde se sabe qué rol se necesita.
 *
 * «Barata» de verdad: la firma del token se verifica aquí en vez de preguntarle al servidor
 * de Supabase, y la carta pública ni siquiera pasa por la comprobación.
 */
export async function actualizarSesion(request: NextRequest) {
  let respuesta = NextResponse.next({ request })

  const supabase = createServerClient<Database>(urlSupabase(), llavePublicable(), {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(nuevas) {
        for (const { name, value } of nuevas) {
          request.cookies.set(name, value)
        }
        respuesta = NextResponse.next({ request })
        for (const { name, value, options } of nuevas) {
          respuesta.cookies.set(name, value, options)
        }
      },
    },
  })

  const ruta = request.nextUrl.pathname
  const esArea = ruta.startsWith('/app')
  const esLogin = ruta === '/app/login'

  // La carta pública no tiene sesión que comprobar: cada comensal que abría el menú pagaba
  // una consulta de autenticación que no le servía.
  if (!esArea) return respuesta

  const user = await idDeSesion(supabase)

  if (!esLogin && !user) {
    const destino = request.nextUrl.clone()
    destino.pathname = '/app/login'
    destino.searchParams.set('destino', ruta)
    return NextResponse.redirect(destino)
  }

  if (esLogin && user) {
    const destino = request.nextUrl.clone()
    destino.pathname = '/app'
    destino.search = ''
    return NextResponse.redirect(destino)
  }

  return respuesta
}
