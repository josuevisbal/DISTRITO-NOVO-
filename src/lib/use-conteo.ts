'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Conteo animado: sube del valor anterior al nuevo con suavizado, ~700 ms.
 * Si el sistema pide menos movimiento, salta directo al valor.
 */
export function useConteo(valor: number, ms = 700): number {
  const [v, setV] = useState(0)
  const previo = useRef(0)

  useEffect(() => {
    // Sin animación si el sistema pide menos movimiento o la pestaña no está visible:
    // requestAnimationFrame no dispara en pestañas ocultas y el número quedaría clavado.
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.visibilityState === 'hidden'
    ) {
      previo.current = valor
      setV(valor)
      return
    }
    const desde = previo.current
    previo.current = valor
    const t0 = performance.now()
    let raf = 0
    const tic = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      const suave = 1 - Math.pow(1 - p, 3)
      setV(Math.round(desde + (valor - desde) * suave))
      if (p < 1) raf = requestAnimationFrame(tic)
    }
    raf = requestAnimationFrame(tic)
    return () => cancelAnimationFrame(raf)
  }, [valor, ms])

  return v
}
