'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { crearClienteNavegador } from '@/lib/supabase/navegador'

/**
 * Escucha cambios en una tabla y refresca los datos del servidor cuando algo se mueve.
 *
 * No mantiene estado propio: al recibir un cambio pide `router.refresh()`, así la verdad
 * sigue viniendo de la consulta con RLS y no de un estado del navegador que se puede
 * desincronizar. Sirve para mesero y pase, donde no hace falta un cronómetro.
 *
 * `intervaloMs` fuerza un refresco periódico además de los eventos: red de seguridad por si
 * Realtime se cae en una tablet con mala señal.
 */
export function useRefrescarEnCambios(
  tablas: string[],
  opciones?: { intervaloMs?: number },
) {
  const router = useRouter()

  useEffect(() => {
    const supabase = crearClienteNavegador()
    const canal = supabase.channel('cambios-' + tablas.join('-'))

    for (const tabla of tablas) {
      canal.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tabla },
        () => router.refresh(),
      )
    }

    canal.subscribe()

    const id = opciones?.intervaloMs
      ? setInterval(() => router.refresh(), opciones.intervaloMs)
      : undefined

    return () => {
      supabase.removeChannel(canal)
      if (id) clearInterval(id)
    }
    // tablas se pasa como literal en cada pantalla; se serializa para no re-suscribir de más.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablas.join('-'), opciones?.intervaloMs, router])
}
