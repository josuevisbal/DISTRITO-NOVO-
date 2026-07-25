'use client'

import { useState } from 'react'

/**
 * Interruptor animado: la perilla se desliza (transform) y el riel cambia de color, con los
 * tokens del sistema central. Reutilizable en todo el panel. Respeta reduced-motion porque
 * la transición global se anula ahí.
 */
export function Interruptor({
  activa,
  onCambiar,
  textoOn = 'Activa',
  textoOff = 'Inactiva',
}: {
  activa: boolean
  onCambiar: (v: boolean) => void
  textoOn?: string
  textoOff?: string
}) {
  const [encendida, setEncendida] = useState(activa)
  return (
    <button
      type="button"
      role="switch"
      aria-checked={encendida}
      onClick={() => {
        const v = !encendida
        setEncendida(v)
        onCambiar(v)
      }}
      className="flex min-h-11 items-center gap-2"
    >
      <span
        className="relative h-7 w-12 rounded-full"
        style={{
          backgroundColor: encendida ? 'var(--marca-acento)' : 'var(--marca-borde)',
          transition: 'background-color var(--mov-media) var(--mov-estado)',
        }}
      >
        <span
          className="absolute left-1 top-1 size-5 rounded-full bg-white shadow"
          style={{
            transform: encendida ? 'translateX(20px)' : 'translateX(0)',
            transition: 'transform var(--mov-media) var(--mov-entrar)',
          }}
        />
      </span>
      <span
        className={`text-sm font-medium ${encendida ? 'text-marca-texto' : 'text-marca-texto-suave'}`}
      >
        {encendida ? textoOn : textoOff}
      </span>
    </button>
  )
}
