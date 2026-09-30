import { CajaCliente } from '@/app/app/caja/caja-cliente'
import { AvisoMonitoreo } from '@/components/panel/aviso-monitoreo'
import { cargarCaja } from '@/lib/datos/caja'
import { exigirRol } from '@/lib/sesion'

export const dynamic = 'force-dynamic'

/**
 * La pantalla del cajero dentro del panel: administración ve la caja en vivo y puede
 * hacer todo lo que hace el cajero (confirmar, cobrar, verificar, despachar, cerrar).
 */
export default async function MonitoreoCaja() {
  const staff = await exigirRol('admin')
  const datos = await cargarCaja(staff.restaurante_id)

  return (
    <>
      <AvisoMonitoreo />
      <CajaCliente {...datos} servidorAhoraISO={new Date().toISOString()} />
    </>
  )
}
