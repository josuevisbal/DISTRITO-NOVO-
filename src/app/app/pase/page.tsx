import { BarraStaff } from '@/components/barra-staff'
import { cargarPase } from '@/lib/datos/pase'
import { exigirRol } from '@/lib/sesion'
import { PaseCliente } from './pase-cliente'

export const dynamic = 'force-dynamic'

export default async function PaginaPase() {
  const staff = await exigirRol('pase', 'admin')
  const { pedidos, despachos, domiciliarios } = await cargarPase(staff.restaurante_id)

  return (
    <>
      <BarraStaff staff={staff} titulo="Pase" />
      <PaseCliente pedidos={pedidos} despachos={despachos} domiciliarios={domiciliarios} />
    </>
  )
}
