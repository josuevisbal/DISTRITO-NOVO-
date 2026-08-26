import { BarraStaff } from '@/components/barra-staff'
import { MarcoOscuro } from '@/components/marco-oscuro'
import { cargarEntregas } from '@/lib/datos/domicilios'
import { exigirRol } from '@/lib/sesion'
import { DomiciliosCliente } from './domicilios-cliente'

export const dynamic = 'force-dynamic'

export default async function PaginaDomicilios() {
  const staff = await exigirRol('domicilio', 'admin')

  // El domiciliario ve lo que ya tomó y lo que está libre en el mostrador (la RLS le
  // acota lo mismo). Un admin, que aquí llega en operación, ve todo lo que esté en
  // despacho o en camino.
  const entregas = await cargarEntregas(
    staff.restaurante_id,
    staff.rol === 'domicilio' ? staff.id : undefined,
  )

  return (
    <MarcoOscuro>
      <BarraStaff staff={staff} titulo="Mis entregas" />
      <DomiciliosCliente entregas={entregas} miId={staff.id} />
    </MarcoOscuro>
  )
}
