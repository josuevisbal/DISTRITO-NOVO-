import { MeseroCliente } from '@/app/app/mesero/mesero-cliente'
import { AvisoMonitoreo } from '@/components/panel/aviso-monitoreo'
import { cargarMesero } from '@/lib/datos/mesero'
import { exigirRol } from '@/lib/sesion'

export const dynamic = 'force-dynamic'

/**
 * La pantalla del mesero dentro del panel: administración ve el salón en vivo y puede
 * confirmar, tomar pedidos, sumar rondas y marcar servido igual que un mesero.
 */
export default async function MonitoreoSalon() {
  const staff = await exigirRol('admin')
  const datos = await cargarMesero(staff.restaurante_id)

  return (
    <>
      <AvisoMonitoreo />
      <MeseroCliente datos={datos} servidorAhoraISO={new Date().toISOString()} />
    </>
  )
}
