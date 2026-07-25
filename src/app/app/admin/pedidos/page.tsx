import { cargarPedidosVivos } from '@/lib/datos/pedidos-vivo'
import { exigirRol } from '@/lib/sesion'
import { PedidosVivoCliente } from './pedidos-cliente'

export const dynamic = 'force-dynamic'

/** Todos los pedidos del momento con su estado, en una vista que se actualiza sola. */
export default async function PaginaPedidosVivo() {
  const staff = await exigirRol('admin')
  const pedidos = await cargarPedidosVivos(staff.restaurante_id)

  return (
    <div className="space-y-4">
      <p className="text-sm text-marca-texto-suave">
        {pedidos.length === 0
          ? 'Nada en curso.'
          : `${pedidos.length} ${pedidos.length === 1 ? 'pedido' : 'pedidos'} en curso, del más nuevo al más viejo.`}
      </p>
      <PedidosVivoCliente pedidos={pedidos} servidorAhoraISO={new Date().toISOString()} />
    </div>
  )
}
