'use client'

import { useState, type CSSProperties } from 'react'

import { IconoAlerta, IconoCheck, IconoMas } from '@/components/iconos'
import { useToast } from '@/components/toast'
import { formatearPesos } from '@/lib/formato'
import { alternarZona, guardarZona } from './acciones'

export type ZonaAdmin = { id: string; nombre: string; valor: number; activa: boolean }

export function ZonasAdmin({ zonas }: { zonas: ZonaAdmin[] }) {
  return (
    <div className="mx-auto max-w-2xl space-y-3 p-4 pb-16">
      {zonas.map((z, i) => (
        <FilaZona key={z.id} zona={z} indice={i} />
      ))}
      <FilaZona indice={zonas.length} nueva />
    </div>
  )
}

function FilaZona({
  zona,
  indice,
  nueva = false,
}: {
  zona?: ZonaAdmin
  indice: number
  nueva?: boolean
}) {
  const [nombre, setNombre] = useState(zona?.nombre ?? '')
  const [valor, setValor] = useState(String(zona?.valor ?? ''))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)
  const { mostrar } = useToast()

  async function guardar() {
    setGuardando(true)
    setError(null)
    const r = await guardarZona(zona?.id ?? null, nombre, Number(valor) || 0)
    setGuardando(false)
    if (!r.ok) setError(r.error)
    else {
      mostrar(nueva ? `Barrio "${nombre.trim()}" agregado` : 'Barrio guardado')
      setGuardado(true)
      setTimeout(() => setGuardado(false), 1500)
      if (nueva) {
        setNombre('')
        setValor('')
      }
    }
  }

  return (
    <div
      className="entra flex flex-wrap items-end gap-3 rounded-xl border border-marca-borde bg-marca-superficie p-3"
      style={{ '--i': indice } as CSSProperties}
    >
      <label className="min-w-32 flex-1">
        <span className="text-xs text-marca-texto-suave">{nueva ? 'Nuevo barrio' : 'Barrio'}</span>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre del barrio"
          className="mt-1 min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 text-marca-texto"
        />
      </label>

      <label className="w-32">
        <span className="text-xs text-marca-texto-suave">Domicilio</span>
        <input
          inputMode="numeric"
          value={valor}
          onChange={(e) => setValor(e.target.value.replace(/\D/g, ''))}
          placeholder="0"
          className="mt-1 min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 tabular-nums text-marca-texto"
        />
      </label>

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="flex min-h-11 items-center gap-1.5 rounded-lg bg-marca-acento px-4 font-medium text-marca-acento-texto disabled:opacity-60"
      >
        {nueva ? <IconoMas className="size-4" /> : guardado ? <IconoCheck className="size-4" /> : null}
        {guardando ? 'Guardando…' : nueva ? 'Agregar' : guardado ? 'Guardado' : 'Guardar'}
      </button>

      {!nueva && zona ? (
        <button
          type="button"
          onClick={() => alternarZona(zona.id, !zona.activa)}
          className={`min-h-11 rounded-lg border px-3 text-sm ${
            zona.activa
              ? 'border-marca-borde text-marca-texto-suave'
              : 'border-marca-acento text-marca-acento-fuerte'
          }`}
        >
          {zona.activa ? 'Activa' : 'Inactiva'}
        </button>
      ) : null}

      {!nueva && zona ? (
        <span className="w-full text-xs text-marca-texto-suave">
          Domicilio actual: {formatearPesos(zona.valor)}
        </span>
      ) : null}

      {error ? (
        <p role="alert" className="flex w-full items-center gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  )
}
