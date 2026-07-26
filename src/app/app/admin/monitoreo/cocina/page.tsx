import Link from 'next/link'

import { TableroCocina } from '@/app/app/cocina/[estacion]/tablero-cocina'
import { AvisoMonitoreo } from '@/components/panel/aviso-monitoreo'
import { cargarEstaciones, cargarTicketsEstacion } from '@/lib/datos/cocina'
import { exigirRol } from '@/lib/sesion'

export const dynamic = 'force-dynamic'

/**
 * Monitoreo del admin: la pantalla de cocina tal como la ve el cocinero, en vivo y en
 * modo solo lectura. El admin elige qué estación mirar; no marca ni libera nada.
 */
export default async function MonitoreoCocina({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>
}) {
  const staff = await exigirRol('admin')
  const { e } = await searchParams

  const estaciones = await cargarEstaciones(staff.restaurante_id)
  const est = estaciones.find((x) => x.slug === e) ?? estaciones[0]

  if (!est) {
    return (
      <>
        <AvisoMonitoreo />
        <p className="text-sm text-marca-texto-suave">No hay estaciones activas.</p>
      </>
    )
  }

  const ahora = new Date()
  const tickets = await cargarTicketsEstacion(est.id, ahora)

  return (
    <>
      <AvisoMonitoreo />

      {/* Selector de estación (estilo del panel). */}
      <nav aria-label="Estaciones" className="mb-4 flex flex-wrap gap-2">
        {estaciones.map((x) => {
          const activa = x.slug === est.slug
          return (
            <Link
              key={x.slug}
              href={`/app/admin/monitoreo/cocina?e=${x.slug}`}
              aria-current={activa ? 'page' : undefined}
              className="flex min-h-11 items-center gap-2 rounded-xl border-2 px-4 text-sm font-semibold transition-colors"
              style={
                activa
                  ? { backgroundColor: x.color, borderColor: x.color, color: '#fff' }
                  : { borderColor: 'var(--marca-borde)', color: 'var(--marca-texto-suave)' }
              }
            >
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ backgroundColor: activa ? '#fff' : x.color }}
              />
              {x.nombre}
            </Link>
          )
        })}
      </nav>

      <TableroCocina
        key={est.slug}
        tickets={tickets}
        nombreEstacion={est.nombre}
        color={est.color}
        servidorAhoraISO={ahora.toISOString()}
        soloLectura
      />
    </>
  )
}
