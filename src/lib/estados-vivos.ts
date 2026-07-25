import type { Database } from '@/lib/database.types'

type EstadoPedido = Database['public']['Enums']['estado_pedido']

/**
 * Estados que cuentan como "pedido en vivo": todo lo que aún no terminó su recorrido.
 * Vive en un módulo sin imports de servidor porque lo usan tanto la página (server) como
 * el contador de la barra lateral (cliente).
 */
export const ESTADOS_VIVOS: EstadoPedido[] = [
  'esperando_pago',
  'pendiente',
  'en_cocina',
  'listo',
  'en_despacho',
  'en_camino',
  'entregado',
]
