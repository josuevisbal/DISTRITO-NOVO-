import { DomiciliosCliente } from '@/app/app/domicilios/domicilios-cliente'
import { AvisoMonitoreo } from '@/components/panel/aviso-monitoreo'
import { cargarEntregas } from '@/lib/datos/domicilios'
import { exigirRol } from '@/lib/sesion'

export const dynamic = 'force-dynamic'

/**
 * La pantalla del domiciliario dentro del panel: administración ve todas las entregas en
 * curso, quién lleva cada una, y puede marcarlas recogidas, entregadas o con otro pago
 * a nombre del domiciliario. Lo que está en el mostrador lo puede tomar él mismo.
 */
export default async function MonitoreoDomicilios() {
  const staff = await exigirRol('admin')
  const entregas = await cargarEntregas(staff.restaurante_id)

  return (
    <>
      <AvisoMonitoreo />
      <DomiciliosCliente entregas={entregas} miId={staff.id} vistaAdmin />
    </>
  )
}
