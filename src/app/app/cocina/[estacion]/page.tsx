import { notFound } from 'next/navigation'

import { BarraStaff } from '@/components/barra-staff'
import { cargarEstaciones, cargarTicketsEstacion } from '@/lib/datos/cocina'
import { exigirRol } from '@/lib/sesion'
import { PestanasEstacion } from './pestanas-estacion'
import { TableroCocina } from './tablero-cocina'

export const dynamic = 'force-dynamic'

export default async function PaginaEstacion({
  params,
}: {
  params: Promise<{ estacion: string }>
}) {
  const { estacion } = await params
  const staff = await exigirRol('cocina', 'admin', 'pase')

  // Todas las estaciones activas para las pestañas; la actual se resuelve del listado.
  const estaciones = await cargarEstaciones(staff.restaurante_id)
  const est = estaciones.find((e) => e.slug === estacion)
  if (!est) notFound()

  const ahora = new Date()
  const tickets = await cargarTicketsEstacion(est.id, ahora)

  // El tema (claro/oscuro) lo elige el cocinero dentro del tablero; la barra de sesión se
  // pasa como slot para que se pinte con el tema elegido.
  return (
    <TableroCocina
      tickets={tickets}
      nombreEstacion={est.nombre}
      color={est.color}
      servidorAhoraISO={ahora.toISOString()}
      barraStaff={<BarraStaff staff={staff} titulo={`Cocina · ${est.nombre}`} />}
      pestanas={
        estaciones.length > 1 ? (
          <PestanasEstacion estaciones={estaciones} actual={estacion} />
        ) : null
      }
    />
  )
}
