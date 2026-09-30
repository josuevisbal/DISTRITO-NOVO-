import { TableroCocina } from '@/app/app/cocina/tablero-cocina'
import { AvisoMonitoreo } from '@/components/panel/aviso-monitoreo'
import { cargarEstaciones, cargarTicketsCocina } from '@/lib/datos/cocina'
import { exigirRol } from '@/lib/sesion'

export const dynamic = 'force-dynamic'

/**
 * Monitoreo del admin: la pantalla de cocina tal como la ve el cocinero, en vivo y en
 * modo solo lectura. No marca ni libera nada.
 */
export default async function MonitoreoCocina() {
  const staff = await exigirRol('admin')

  const estaciones = await cargarEstaciones(staff.restaurante_id)
  if (estaciones.length === 0) {
    return (
      <>
        <AvisoMonitoreo />
        <p className="text-sm text-marca-texto-suave">No hay estaciones activas.</p>
      </>
    )
  }

  const ahora = new Date()
  const tickets = await cargarTicketsCocina(estaciones, ahora)

  return (
    <>
      <AvisoMonitoreo />
      <TableroCocina
        tickets={tickets}
        estaciones={estaciones}
        servidorAhoraISO={ahora.toISOString()}
        soloLectura
      />
    </>
  )
}
