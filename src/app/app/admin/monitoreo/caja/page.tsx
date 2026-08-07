import { CajaCliente } from '@/app/app/caja/caja-cliente'
import { AvisoMonitoreo } from '@/components/panel/aviso-monitoreo'
import { cargarCaja } from '@/lib/datos/caja'
import { exigirRol } from '@/lib/sesion'

export const dynamic = 'force-dynamic'

/**
 * Monitoreo del admin: la pantalla del cajero en vivo (turno, medios de pago, pedidos
 * por cobrar/verificar y lo cobrado hoy), en modo solo lectura. No cobra ni verifica
 * desde aquí — para operar, el cajero lo hace en su puesto. El módulo "Caja y finanzas"
 * es el del panel (arqueo y cierres); este es ver la operación.
 */
export default async function MonitoreoCaja() {
  const staff = await exigirRol('admin')
  const datos = await cargarCaja(staff.restaurante_id)

  return (
    <>
      <AvisoMonitoreo />
      <CajaCliente {...datos} servidorAhoraISO={new Date().toISOString()} soloLectura />
    </>
  )
}
