import type { ButtonHTMLAttributes } from 'react'

/**
 * Botón estándar del sistema. Variantes con significado, iguales en toda la app:
 *
 *  primario   → dorado de marca (acción principal del módulo)
 *  negro      → negro con texto dorado (acción fuerte de operación: cobrar, liberar)
 *  exito      → verde (confirmar / verificar / marcar listo)
 *  secundario → borde fino (acción neutra o de salida)
 *  peligro    → rojo suave (anular / eliminar)
 *
 * Hover con elevación y press con scale los pone el CSS global de `button`.
 * Área táctil mínima 44px (min-h-11).
 */
export type VarianteBoton = 'primario' | 'negro' | 'exito' | 'secundario' | 'peligro'

const CLASE: Record<VarianteBoton, string> = {
  primario: 'bg-marca-acento font-medium text-marca-acento-texto',
  negro: 'bg-panel-lateral font-semibold text-marca-acento',
  exito: 'bg-[#1E9E6A] font-semibold text-white',
  secundario: 'border border-marca-borde text-marca-texto-suave',
  peligro: 'bg-[#FBE6DE] font-semibold text-[#9A3320]',
}

export function Boton({
  variante = 'primario',
  className = '',
  type = 'button',
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBoton }) {
  return (
    <button
      type={type}
      className={`min-h-11 rounded-lg px-3.5 text-sm disabled:opacity-50 ${CLASE[variante]} ${className}`}
      {...resto}
    />
  )
}
