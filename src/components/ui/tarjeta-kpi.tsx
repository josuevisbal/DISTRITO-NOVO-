'use client'

import { useEffect, useState, type CSSProperties } from 'react'

import { IconoBajar, IconoSubir } from '@/components/iconos'
import { formatearPesos } from '@/lib/formato'
import { useConteo } from '@/lib/use-conteo'

/**
 * Tarjeta-indicador estándar del sistema (la referencia de calidad aprobada en caja):
 * franja de color arriba, ícono protagonista en cuadrado redondeado de fondo muy claro,
 * dato principal grande con count-up, y mini-dato de contexto con barra de progreso
 * fina que crece desde cero. Hover con leve elevación. Nada de fotos detrás de datos.
 *
 * La usan los KPIs del Tablero, los medios de pago de Caja, los indicadores de Reportes
 * y cualquier cifra destacada del panel. Un solo componente: un solo lenguaje.
 */
export type SubKpi = {
  /** Contexto pequeño bajo el dato: "8 pedidos", "vs mes anterior", etc. */
  texto: string
  /** 0–100: pinta el % a la derecha y la barra de progreso del color de la tarjeta. */
  porcentaje?: number
}

export type VariacionKpi = {
  /** % de cambio vs el período anterior; null cuando no hay base de comparación. */
  pct: number | null
  /** Contra qué se compara: "junio", "mes anterior". */
  contra: string
}

export function TarjetaKpi({
  titulo,
  valor,
  dinero = false,
  color,
  Icono,
  sub,
  variacion,
  indice = 0,
}: {
  titulo: string
  valor: number
  dinero?: boolean
  /** Color con significado del sistema (medio de pago, estación, estado). */
  color: string
  Icono: (p: { className?: string }) => React.ReactNode
  sub?: SubKpi
  /** Comparación vs el período anterior, con flecha verde/roja. */
  variacion?: VariacionKpi
  indice?: number
}) {
  const animado = useConteo(valor)

  // La barra crece desde cero al montar (transición CSS), salvo con reduced-motion.
  // En pestañas ocultas requestAnimationFrame no dispara: se salta directo al ancho final.
  const [montado, setMontado] = useState(false)
  useEffect(() => {
    if (document.visibilityState === 'hidden') {
      setMontado(true)
      return
    }
    const id = requestAnimationFrame(() => setMontado(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const pct = sub?.porcentaje !== undefined ? Math.max(0, Math.min(100, sub.porcentaje)) : undefined

  return (
    <article
      className="tarjeta tarjeta-hover entra overflow-hidden"
      style={{ '--i': indice } as CSSProperties}
    >
      {/* Franja de color: identidad del indicador de un vistazo. */}
      <div aria-hidden className="h-1.5" style={{ backgroundColor: color }} />

      <div className="p-4">
        <p className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${color}14`, color }}
          >
            <Icono className="size-5" />
          </span>
          <span className="text-sm font-medium text-marca-texto">{titulo}</span>
        </p>

        {/* Dato principal. En cero baja el tono: no hay nada que gritar. */}
        <p
          className={`mt-3 text-2xl font-bold tabular-nums ${
            valor === 0 ? 'text-marca-texto-suave' : 'text-marca-texto'
          }`}
        >
          {dinero ? formatearPesos(animado) : animado}
        </p>

        {sub ? (
          <div className="mt-1.5">
            <p className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-marca-texto-suave">{sub.texto}</span>
              {pct !== undefined ? (
                <span
                  className="font-bold tabular-nums"
                  style={{ color: valor === 0 ? 'var(--marca-texto-suave)' : color }}
                >
                  {pct}%
                </span>
              ) : null}
            </p>
            {pct !== undefined ? (
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-marca-superficie-tenue">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
                  style={{ width: montado ? `${pct}%` : '0%', backgroundColor: color }}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {variacion ? (
          variacion.pct !== null ? (
            <p
              className="mt-1.5 flex items-center gap-1 text-xs font-medium"
              style={{ color: variacion.pct >= 0 ? '#116B47' : '#9A3320' }}
            >
              {variacion.pct >= 0 ? (
                <IconoSubir className="size-3.5" />
              ) : (
                <IconoBajar className="size-3.5" />
              )}
              {variacion.pct >= 0 ? '+' : ''}
              {variacion.pct}% vs {variacion.contra}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-marca-texto-suave">Sin datos de {variacion.contra}</p>
          )
        ) : null}
      </div>
    </article>
  )
}
