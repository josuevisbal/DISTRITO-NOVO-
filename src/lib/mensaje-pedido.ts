import { formatearPesos } from '@/lib/formato'

export type LineaMensaje = { nombre: string; cantidad: number; total: number }

export type DatosMensaje = {
  restaurante: string
  numero: number
  canal: string
  cliente?: string | null
  telefono?: string | null
  direccion?: string | null
  zona?: string | null
  indicaciones?: string | null
  items: LineaMensaje[]
  subtotal: number
  domicilio: number
  total: number
  medioPago?: string | null
  /**
   * Para transferencia: el mensaje sale desde la pantalla de la llave, así que además
   * de avisar el pedido anuncia que el comprobante va enseguida.
   */
  avisaComprobante?: boolean
}

const NOMBRE_MEDIO: Record<string, string> = {
  efectivo: '💵 Efectivo contra entrega',
  transferencia: '🏦 Transferencia',
  datafono: '💳 Datáfono',
  pasarela: '🌐 Pago en línea',
  mesa: '🍽️ Se paga en la mesa',
  mixto: '🏦 Parte transferida y parte en efectivo',
}

const NOMBRE_CANAL: Record<string, string> = {
  domicilio: '🛵 Domicilio',
  whatsapp: '🛵 Domicilio',
  recoger: '🏃 Para recoger',
  mostrador: '🏪 Mostrador',
  mesa: '🍽️ Mesa',
}

/**
 * El mensaje que el cliente manda por WhatsApp al restaurante. Es un AVISO: el pedido ya
 * quedó guardado en el sistema y esperando aprobación de caja, y así se lo decimos, para
 * que nadie crea que este mensaje es el que hace el pedido.
 *
 * Los valores vienen ya calculados por el servidor (`crear_pedido`): aquí solo se
 * escriben. El cliente nunca fija precios, ni siquiera en el texto.
 */
export function armarMensajePedido(d: DatosMensaje): string {
  const l: string[] = []

  l.push(`🍟 *NUEVO PEDIDO · ${d.restaurante}*`)
  l.push('')
  l.push(`🧾 *Pedido:* #${d.numero}`)
  l.push(`📦 *Tipo:* ${NOMBRE_CANAL[d.canal] ?? d.canal}`)

  if (d.cliente) l.push(`👤 *Cliente:* ${d.cliente}`)
  if (d.telefono) l.push(`📱 *Teléfono:* ${d.telefono}`)

  if (d.direccion) {
    l.push(`📍 *Dirección:* ${d.direccion}${d.zona ? ` (${d.zona})` : ''}`)
  }
  if (d.indicaciones) l.push(`🗒️ *Indicaciones:* ${d.indicaciones}`)

  l.push('')
  l.push('🛒 *LO QUE PIDIÓ*')
  l.push('━━━━━━━━━━━━━━━')
  for (const i of d.items) {
    l.push(`▪️ ${i.cantidad}× ${i.nombre} — ${formatearPesos(i.total)}`)
  }
  l.push('━━━━━━━━━━━━━━━')

  l.push(`Subtotal: ${formatearPesos(d.subtotal)}`)
  if (d.domicilio > 0) {
    l.push(`🛵 Domicilio: ${formatearPesos(d.domicilio)}`)
  } else if (d.canal === 'domicilio' || d.canal === 'whatsapp') {
    l.push('🛵 Domicilio: ¡GRATIS! 🎉')
  }
  l.push(`💰 *TOTAL A PAGAR: ${formatearPesos(d.total)}*`)

  if (d.medioPago) {
    l.push('')
    l.push(`💳 *Pago:* ${NOMBRE_MEDIO[d.medioPago] ?? d.medioPago}`)
  }

  l.push('')
  if (d.avisaComprobante) {
    l.push('📸 *Le envío el comprobante de la transferencia enseguida.*')
    l.push('')
  }
  l.push('✅ _Este pedido ya entró al sistema y está en espera de aprobación en caja._')
  l.push('¡Gracias! 🙌')

  return l.join('\n')
}

/** Enlace de WhatsApp con el mensaje ya escrito. El número va sin signos. */
export function enlacePedidoWhatsApp(
  numero: string,
  mensaje: string,
  indicativoPais = '57',
): string {
  const soloDigitos = numero.replace(/\D/g, '')
  const destino = soloDigitos.length > 10 ? soloDigitos : `${indicativoPais}${soloDigitos}`
  return `https://wa.me/${destino}?text=${encodeURIComponent(mensaje)}`
}
