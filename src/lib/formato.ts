const PESOS = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** Dinero colombiano sin decimales: 32000 -> "$32.000" */
export function formatearPesos(valor: number): string {
  return PESOS.format(valor).replace(/\s/g, '')
}
