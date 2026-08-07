import { BarraStaff } from '@/components/barra-staff'
import { cargarMesero } from '@/lib/datos/mesero'
import { exigirRol } from '@/lib/sesion'
import { MeseroCliente } from './mesero-cliente'

export const dynamic = 'force-dynamic'

/**
 * El puesto del mesero: lo que entró por el QR de cada mesa y espera confirmación, lo que
 * está en cocina, lo que ya salió y hay que llevar, y las cuentas abiertas del salón.
 */
export default async function PaginaMesero() {
  const staff = await exigirRol('mesero', 'admin')
  const datos = await cargarMesero(staff.restaurante_id)

  return (
    <>
      <BarraStaff staff={staff} titulo="Salón" />
      <MeseroCliente datos={datos} servidorAhoraISO={new Date().toISOString()} />
    </>
  )
}
