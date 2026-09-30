import { BarraStaff } from '@/components/barra-staff'
import { cargarEstaciones, cargarTicketsCocina } from '@/lib/datos/cocina'
import { exigirRol } from '@/lib/sesion'
import { TableroCocina } from './tablero-cocina'

export const dynamic = 'force-dynamic'

/**
 * Cocina: una sola pantalla con el pedido completo en cada tarjeta. Cada plato lleva el
 * chip de su estación (rápida, asados, bebidas) y un solo botón mueve el pedido entero.
 */
export default async function PaginaCocina() {
  const staff = await exigirRol('cocina', 'admin')

  const estaciones = await cargarEstaciones(staff.restaurante_id)
  const ahora = new Date()
  const tickets = await cargarTicketsCocina(estaciones, ahora)

  // El tema (claro/oscuro) lo elige el cocinero dentro del tablero; la barra de sesión se
  // pasa como slot para que se pinte con el tema elegido.
  return (
    <TableroCocina
      tickets={tickets}
      estaciones={estaciones}
      servidorAhoraISO={ahora.toISOString()}
      barraStaff={<BarraStaff staff={staff} titulo="Cocina" />}
    />
  )
}
