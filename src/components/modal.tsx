'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { IconoCerrar } from '@/components/iconos'

/**
 * Modal centrado que aparece escalando + fundido, con el fondo oscurecido suave. El punto
 * de origen (`origen`, en coordenadas de viewport) hace que escale "desde" el botón que lo
 * disparó. Usa los tokens del sistema central y respeta reduced-motion.
 *
 * Se pinta por portal en el contenedor del tema (el `div` que carga las variables
 * `--marca-*`), no en su sitio: si se abre desde una tarjeta que tiene `transform` —las
 * que entran animadas lo conservan—, un `position: fixed` quedaría atrapado dentro de
 * esa tarjeta en vez de cubrir la pantalla. Y no en `document.body`, porque ahí no
 * existen los colores de la marca y saldría transparente.
 */
export function Modal({
  titulo,
  origen,
  onCerrar,
  children,
}: {
  titulo: string
  origen?: { x: number; y: number } | null
  onCerrar: () => void
  children: React.ReactNode
}) {
  // Cierra con Escape.
  useEffect(() => {
    const al = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', al)
    return () => window.removeEventListener('keydown', al)
  }, [onCerrar])

  // El ancla sirve para encontrar, ya montado, el contenedor del tema más cercano.
  const ancla = useRef<HTMLSpanElement>(null)
  const [destino, setDestino] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const contenedor = ancla.current?.closest<HTMLElement>('[style*="--marca-fondo"]')
    setDestino(contenedor ?? document.body)
  }, [])

  const origenCss =
    origen && typeof window !== 'undefined'
      ? `${(origen.x / window.innerWidth) * 100}% ${(origen.y / window.innerHeight) * 100}%`
      : 'center'

  if (!destino) return <span ref={ancla} hidden />

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="modal-fondo absolute inset-0 bg-black/50"
      />
      <div
        className="modal-caja relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-marca-borde bg-marca-superficie shadow-2xl"
        style={{ '--origen': origenCss } as React.CSSProperties}
      >
        <header className="flex items-center justify-between gap-3 border-b border-marca-borde px-5 py-3.5">
          <h2 className="font-semibold text-marca-texto">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex size-9 items-center justify-center rounded-lg text-marca-texto-suave hover:bg-marca-superficie-tenue"
          >
            <IconoCerrar className="size-5" />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    destino,
  )
}
