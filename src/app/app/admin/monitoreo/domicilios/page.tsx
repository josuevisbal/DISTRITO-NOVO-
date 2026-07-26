import { DomiciliosCliente } from '@/app/app/domicilios/domicilios-cliente'
import { AvisoMonitoreo } from '@/components/panel/aviso-monitoreo'
import { cargarEntregas } from '@/lib/datos/domicilios'
import { exigirRol } from '@/lib/sesion'

export const dynamic = 'force-dynamic'

/**
 * Monitoreo del admin: las entregas en curso, quién las lleva y su estado, en vivo y en
 * modo solo lectura. No reasigna domiciliarios desde aquí.
 */
export default async function MonitoreoDomicilios() {
  const staff = await exigirRol('admin')
  const entregas = await cargarEntregas(staff.restaurante_id)

  return (
    <>
      <AvisoMonitoreo />
      <DomiciliosCliente entregas={entregas} soloLectura />
    </>
  )
}
