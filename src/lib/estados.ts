import type { Database } from '@/lib/database.types'

export type EstadoPedido = Database['public']['Enums']['estado_pedido']

/** Los pasos que el comensal ve en la línea de estados, en orden. */
export const PASOS_PEDIDO = [
  { estado: 'esperando_pago', titulo: 'Esperando tu pago', detalle: 'Haz la transferencia y la verificamos.' },
  { estado: 'pendiente', titulo: 'Pedido recibido', detalle: 'Lo estamos confirmando.' },
  { estado: 'en_cocina', titulo: 'En cocina', detalle: 'Ya lo están preparando.' },
  { estado: 'listo', titulo: 'Listo', detalle: 'Salió de cocina.' },
  { estado: 'en_despacho', titulo: 'En despacho', detalle: 'Lo estamos empacando.' },
  { estado: 'en_camino', titulo: 'En camino', detalle: 'Va para allá.' },
  { estado: 'entregado', titulo: 'Entregado', detalle: 'Que lo disfrutes.' },
] as const satisfies readonly { estado: EstadoPedido; titulo: string; detalle: string }[]

/**
 * Índice del estado dentro de la línea. `-1` para los que no son un paso del recorrido
 * (`anulado`, y `cerrado`, que es cierre contable y al comensal no le dice nada).
 */
export function pasoDe(estado: EstadoPedido): number {
  return PASOS_PEDIDO.findIndex((p) => p.estado === estado)
}

/**
 * Un pedido que aún no se ha pagado arranca en 'esperando_pago'; los demás nunca pasan por
 * ahí, así que ese paso solo se muestra cuando aplica.
 */
export function pasosVisibles(estado: EstadoPedido) {
  return estado === 'esperando_pago'
    ? PASOS_PEDIDO
    : PASOS_PEDIDO.filter((p) => p.estado !== 'esperando_pago')
}
