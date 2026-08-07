import { MeseroCliente } from '@/app/app/mesero/mesero-cliente'
import { AvisoMonitoreo } from '@/components/panel/aviso-monitoreo'
import { cargarMesero } from '@/lib/datos/mesero'
import { exigirRol } from '@/lib/sesion'

export const dynamic = 'force-dynamic'

/**
 * Monitoreo del admin: el salón en vivo (lo que pidió cada mesa, cómo va en cocina y qué
 * está por llevar), en modo solo lectura.
 */
export default async function MonitoreoSalon() {
  const staff = await exigirRol('admin')
  const datos = await cargarMesero(staff.restaurante_id)

  return (
    <>
      <AvisoMonitoreo />
      <MeseroCliente datos={datos} servidorAhoraISO={new Date().toISOString()} soloLectura />
    </>
  )
}
