/**
 * Vista previa de las cuentas para el checkout.
 *
 * OJO: esto no decide nada. La cuenta buena la hace `crear_pedido()` en la base, que
 * recalcula todo desde `productos` y `zonas_domicilio`. Esto solo existe para que el
 * comensal vea el total antes de confirmar, y replica la misma regla a propósito: si las
 * dos se separan, la que manda es la de la base y el pedido queda con el valor correcto.
 */
export function calcularDomicilio(params: {
  esDomicilio: boolean
  subtotal: number
  valorZona: number
  /** `monto_minimo` de la promoción de envío vigente, si hay alguna. */
  umbralEnvioGratis: number | null
}): number {
  const { esDomicilio, subtotal, valorZona, umbralEnvioGratis } = params

  if (!esDomicilio) return 0
  if (umbralEnvioGratis !== null && subtotal >= umbralEnvioGratis) return 0
  return valorZona
}
