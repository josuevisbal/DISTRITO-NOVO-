import { PaseCliente } from '@/app/app/pase/pase-cliente'
import { AvisoMonitoreo } from '@/components/panel/aviso-monitoreo'
import { cargarPase } from '@/lib/datos/pase'
import { exigirRol } from '@/lib/sesion'

export const dynamic = 'force-dynamic'

/**
 * Monitoreo del admin: la pantalla del pase en vivo (pedidos y el estado de sus tres
 * estaciones, más los domicilios por asignar), en modo solo lectura.
 */
export default async function MonitoreoPase() {
  const staff = await exigirRol('admin')
  const { pedidos, despachos, domiciliarios } = await cargarPase(staff.restaurante_id)

  return (
    <>
      <AvisoMonitoreo />
      <PaseCliente
        pedidos={pedidos}
        despachos={despachos}
        domiciliarios={domiciliarios}
        soloLectura
      />
    </>
  )
}
