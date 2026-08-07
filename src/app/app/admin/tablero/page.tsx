import { cargarTablero } from '@/lib/datos/tablero'
import { exigirRol } from '@/lib/sesion'
import { nombreDeHoy } from '@/lib/zona-horaria'
import { TableroCliente } from './tablero-cliente'

export const dynamic = 'force-dynamic'

/** Resumen del día. Es lo primero que se ve al entrar al panel de administración. */
export default async function PaginaTablero() {
  const staff = await exigirRol('admin')
  const datos = await cargarTablero(staff.restaurante_id)

  return <TableroCliente datos={datos} dia={nombreDeHoy()} />
}
