import { BarraStaff } from '@/components/barra-staff'
import { cargarCaja } from '@/lib/datos/caja'
import { exigirRol } from '@/lib/sesion'
import { CajaCliente } from './caja-cliente'

export const dynamic = 'force-dynamic'

/** Pantalla del puesto de caja (cajero). El panel tiene su propia vista en /app/admin/caja. */
export default async function PaginaCaja() {
  const staff = await exigirRol('cajero', 'admin')
  const datos = await cargarCaja(staff.restaurante_id)

  return (
    <>
      <BarraStaff staff={staff} titulo="Caja" />
      <CajaCliente {...datos} servidorAhoraISO={new Date().toISOString()} />
    </>
  )
}
