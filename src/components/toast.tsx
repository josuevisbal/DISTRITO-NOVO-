'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'

import { IconoAlerta } from '@/components/iconos'

type Tipo = 'ok' | 'error'
type Toast = { id: number; texto: string; tipo: Tipo; saliendo: boolean }

type ContextoToast = { mostrar: (texto: string, tipo?: Tipo) => void }

const Ctx = createContext<ContextoToast | null>(null)

/** Feedback de acción: al guardar/cobrar/confirmar, un toast que entra y sale solo. */
export function useToast(): ContextoToast {
  const ctx = useContext(Ctx)
  if (!ctx) return { mostrar: () => {} } // sin proveedor: no rompe, solo no muestra
  return ctx
}

export function ProveedorToast({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const proximo = useRef(1)

  const quitar = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const mostrar = useCallback(
    (texto: string, tipo: Tipo = 'ok') => {
      const id = proximo.current++
      setToasts((t) => [...t, { id, texto, tipo, saliendo: false }])
      // A los 2.4 s marca salida; a los 2.6 s lo quita del DOM.
      window.setTimeout(() => {
        setToasts((t) => t.map((x) => (x.id === id ? { ...x, saliendo: true } : x)))
        window.setTimeout(() => quitar(id), 200)
      }, 2400)
    },
    [quitar],
  )

  return (
    <Ctx.Provider value={{ mostrar }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <article
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2.5 rounded-xl bg-[#0B0B0C] px-4 py-2.5 text-sm font-medium text-white shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${
              t.saliendo ? 'toast-sale' : 'toast-entra'
            }`}
          >
            {t.tipo === 'ok' ? (
              <CheckAnimado />
            ) : (
              <span className="text-[#f6a58c]">
                <IconoAlerta className="size-5" />
              </span>
            )}
            {t.texto}
          </article>
        ))}
      </div>
    </Ctx.Provider>
  )
}

/** Check que se dibuja solo, para la confirmación. */
function CheckAnimado() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="check-anim size-5 shrink-0"
      fill="none"
      stroke="#3fd08a"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  )
}
