import { cargarPedidosVivos } from '@/lib/datos/pedidos-vivo'
import { exigirRol } from '@/lib/sesion'
import { PedidosVivoCliente } from './pedidos-cliente'

export const dynamic = 'force-dynamic'

/** Todos los pedidos del momento con su estado, en una vista que se actualiza sola. */
export default async function PaginaPedidosVivo() {
  const staff = await exigirRol('admin')
  const pedidos = await cargarPedidosVivos(staff.restaurante_id)

  // El conteo y los filtros por canal los pinta el propio componente.
  return <PedidosVivoCliente pedidos={pedidos} servidorAhoraISO={new Date().toISOString()} />
}
