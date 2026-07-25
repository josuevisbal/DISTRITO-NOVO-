import { CajaCliente } from '@/app/app/caja/caja-cliente'
import { cargarCaja } from '@/lib/datos/caja'
import { exigirRol } from '@/lib/sesion'

export const dynamic = 'force-dynamic'

/** Módulo "Caja y finanzas" del panel: la misma caja, dentro del armazón. */
export default async function PaginaCajaPanel() {
  const staff = await exigirRol('admin')
  const datos = await cargarCaja(staff.restaurante_id)

  return <CajaCliente {...datos} servidorAhoraISO={new Date().toISOString()} />
}
