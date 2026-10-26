import 'server-only'

import type { JWK, SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/database.types'
import { urlSupabase } from './entorno'

/**
 * Quién tiene la sesión, sin salir a preguntarlo en cada clic.
 *
 * `auth.getUser()` es honesto pero caro: cada llamada es una petición al servidor de
 * Supabase. Y se llamaba en el middleware, otra vez en la guarda de rol de cada pantalla,
 * y otra más al volver a dibujar la página después de una acción. Cuatro o cinco viajes de
 * ida y vuelta a São Paulo antes de que la pantalla consultara su primer dato: eso es lo
 * que se sentía al tocar «Cobrar».
 *
 * `getClaims()` hace lo mismo pero verificando la firma del token **aquí**, con la llave
 * pública del proyecto. Es igual de confiable —una firma que no cuadra no pasa— y no
 * cuesta red. Y no se pierde nada de lo de antes: por dentro sigue renovando el token
 * cuando está vencido, así que el personal no se sale solo a media noche.
 *
 * El detalle que lo hace funcionar es el de abajo: el juego de llaves se guarda en memoria
 * del servidor. Sin eso no habría ganado nada, porque esta aplicación crea un cliente de
 * Supabase nuevo en cada petición y cada cliente iría a buscar las llaves por su cuenta.
 */

/** Diez minutos: si el proyecto rota sus llaves, el servidor se entera solo. */
const VIGENCIA_LLAVES = 10 * 60 * 1000

let llaves: { keys: JWK[] } | null = null
let llavesPedidasEn = 0
let enCamino: Promise<{ keys: JWK[] } | null> | null = null

/**
 * Las llaves públicas del proyecto, cacheadas en memoria del servidor.
 *
 * Si falla, devuelve null y `getClaims` resuelve por su cuenta —buscándolas él mismo o
 * cayendo a `getUser()`—. Peor rendimiento, nunca una sesión mal validada.
 */
async function llavesDeFirma(): Promise<{ keys: JWK[] } | null> {
  const ahora = Date.now()
  if (llaves && ahora - llavesPedidasEn < VIGENCIA_LLAVES) return llaves

  // Varias peticiones a la vez comparten la misma búsqueda en vez de disparar una cada una.
  enCamino ??= (async () => {
    try {
      const r = await fetch(`${urlSupabase()}/auth/v1/.well-known/jwks.json`, {
        cache: 'no-store',
      })
      if (!r.ok) return null
      const cuerpo = (await r.json()) as { keys?: JWK[] }
      if (!Array.isArray(cuerpo.keys) || cuerpo.keys.length === 0) return null
      llaves = { keys: cuerpo.keys }
      llavesPedidasEn = Date.now()
      return llaves
    } catch {
      return null
    } finally {
      enCamino = null
    }
  })()

  return enCamino
}

/**
 * El id del usuario de la sesión actual, o null si no hay sesión válida.
 *
 * Si el token trae una llave que no está en las cacheadas —porque el proyecto acaba de
 * rotarlas— la librería sale a buscarla ella misma. No se queda con una versión vieja.
 */
export async function idDeSesion(
  supabase: SupabaseClient<Database>,
): Promise<string | null> {
  const jwks = await llavesDeFirma()

  const { data, error } = await supabase.auth.getClaims(
    undefined,
    jwks ? { jwks } : undefined,
  )
  if (error || !data) return null

  const sub = data.claims.sub
  return typeof sub === 'string' && sub !== '' ? sub : null
}
