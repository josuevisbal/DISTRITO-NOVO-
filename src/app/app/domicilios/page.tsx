import { BarraStaff } from '@/components/barra-staff'
import { MarcoOscuro } from '@/components/marco-oscuro'
import { cargarEntregas } from '@/lib/datos/domicilios'
import { exigirRol } from '@/lib/sesion'
import { DomiciliosCliente } from './domicilios-cliente'

export const dynamic = 'force-dynamic'

export default async function PaginaDomicilios() {
  const staff = await exigirRol('domiciliario', 'admin')

  // La RLS ya limita al domiciliario a SUS pedidos; aun así filtramos por su id. Un admin
  // (que aquí llega en operación) ve todo lo que esté en despacho o en camino.
  const entregas = await cargarEntregas(
    staff.restaurante_id,
    staff.rol === 'domiciliario' ? staff.id : undefined,
  )

  return (
    <MarcoOscuro>
      <BarraStaff staff={staff} titulo="Mis entregas" />
      <DomiciliosCliente entregas={entregas} />
    </MarcoOscuro>
  )
}
