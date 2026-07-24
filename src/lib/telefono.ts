/**
 * Enlaces para llamar y escribir por WhatsApp al cliente.
 * El código de país no se quema: se lee del prefijo si viene, y si no, se asume el local
 * configurado. Para Colombia el indicativo es 57, pero se pasa como parámetro para que otro
 * cliente en otro país no tenga que tocar el código.
 */
export function enlaceLlamar(tel: string): string {
  return `tel:${tel.replace(/[^\d+]/g, '')}`
}

export function enlaceWhatsApp(tel: string, indicativoPais = '57'): string {
  const soloDigitos = tel.replace(/\D/g, '')
  // Si ya trae indicativo (más de 10 dígitos), se respeta; si no, se antepone el del país.
  const numero = soloDigitos.length > 10 ? soloDigitos : `${indicativoPais}${soloDigitos}`
  return `https://wa.me/${numero}`
}
