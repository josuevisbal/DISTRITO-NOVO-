'use client'

import { useEffect, useRef, useState } from 'react'

export type OpcionSegmento = { valor: string; etiqueta: string }

/**
 * Control segmentado (pestañas/filtros) con **indicador deslizante**: la pastilla dorada del
 * activo se mueve suave a la nueva posición con transform, no parpadea de un lado a otro.
 * Parte del sistema central de movimiento (usa los tokens --mov-*). Respeta reduced-motion
 * porque anima solo transform y la transición global ya se anula en ese caso.
 */
export function Segmentado({
  opciones,
  valor,
  onCambiar,
  ancho = 'auto',
}: {
  opciones: OpcionSegmento[]
  valor: string
  onCambiar: (valor: string) => void
  ancho?: 'auto' | 'lleno'
}) {
  const contenedor = useRef<HTMLDivElement>(null)
  const [indicador, setIndicador] = useState<{ left: number; width: number } | null>(null)

  // Mide la posición del botón activo para colocar el indicador; se recalcula al cambiar
  // de selección o de tamaño de ventana.
  useEffect(() => {
    const cont = contenedor.current
    if (!cont) return
    const activo = cont.querySelector<HTMLElement>(`[data-valor="${valor}"]`)
    if (!activo) return
    const medir = () =>
      setIndicador({ left: activo.offsetLeft, width: activo.offsetWidth })
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(cont)
    return () => ro.disconnect()
  }, [valor, opciones])

  return (
    <div
      ref={contenedor}
      className={`relative flex gap-1 rounded-xl border border-marca-borde bg-marca-superficie p-1 ${
        ancho === 'lleno' ? 'w-full' : 'w-fit max-w-full overflow-x-auto'
      }`}
    >
      {indicador ? (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-1 top-1 rounded-lg bg-marca-acento shadow-sm"
          style={{
            left: 0,
            width: indicador.width,
            transform: `translateX(${indicador.left - 4}px)`,
            transition: 'transform var(--mov-lenta) var(--mov-entrar), width var(--mov-lenta) var(--mov-entrar)',
          }}
        />
      ) : null}

      {opciones.map((o) => {
        const activo = o.valor === valor
        return (
          <button
            key={o.valor}
            type="button"
            data-valor={o.valor}
            aria-pressed={activo}
            onClick={() => onCambiar(o.valor)}
            className={`relative z-10 min-h-10 shrink-0 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors ${
              activo ? 'text-marca-acento-texto' : 'text-marca-texto-suave hover:text-marca-texto'
            } ${ancho === 'lleno' ? 'flex-1' : ''}`}
          >
            {o.etiqueta}
          </button>
        )
      })}
    </div>
  )
}
