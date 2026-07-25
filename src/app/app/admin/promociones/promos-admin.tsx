'use client'

import { useState, type CSSProperties } from 'react'

import { IconoAlerta, IconoCheck } from '@/components/iconos'
import { alternarPromo, guardarPromo } from './acciones'

export type PromoAdmin = {
  id: string
  tipo: string
  etiqueta: string | null
  titulo: string
  descripcion: string | null
  monto_minimo: number | null
  activa: boolean
}

const NOMBRE_TIPO: Record<string, string> = {
  envio: 'Domicilio gratis',
  combo: 'Combo',
  aviso: 'Aviso',
  descuento: 'Descuento',
}

export function PromosAdmin({ promos }: { promos: PromoAdmin[] }) {
  if (promos.length === 0) {
    return (
      <p className="mx-auto max-w-2xl px-4 pt-6 text-marca-texto-suave">
        No hay promociones cargadas.
      </p>
    )
  }
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-16">
      {promos.map((p, i) => (
        <TarjetaPromo key={p.id} promo={p} indice={i} />
      ))}
    </div>
  )
}

function TarjetaPromo({ promo, indice }: { promo: PromoAdmin; indice: number }) {
  const [etiqueta, setEtiqueta] = useState(promo.etiqueta ?? '')
  const [titulo, setTitulo] = useState(promo.titulo)
  const [descripcion, setDescripcion] = useState(promo.descripcion ?? '')
  const [monto, setMonto] = useState(promo.monto_minimo != null ? String(promo.monto_minimo) : '')
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    setGuardando(true)
    setError(null)
    const r = await guardarPromo(promo.id, {
      etiqueta,
      titulo,
      descripcion,
      monto_minimo: promo.tipo === 'envio' ? (monto === '' ? null : Number(monto)) : promo.monto_minimo,
    })
    setGuardando(false)
    if (!r.ok) setError(r.error)
    else {
      setGuardado(true)
      setTimeout(() => setGuardado(false), 1500)
    }
  }

  return (
    <article
      className="entra rounded-xl border border-marca-borde bg-marca-superficie p-4"
      style={{ '--i': indice } as CSSProperties}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="rounded-full border border-marca-borde px-2.5 py-0.5 text-xs text-marca-texto-suave">
          {NOMBRE_TIPO[promo.tipo] ?? promo.tipo}
        </span>
        <button
          type="button"
          onClick={() => alternarPromo(promo.id, !promo.activa)}
          className={`min-h-10 rounded-lg border px-3 text-sm font-medium ${
            promo.activa
              ? 'border-marca-acento bg-marca-acento text-marca-acento-texto'
              : 'border-marca-borde text-marca-texto-suave'
          }`}
        >
          {promo.activa ? 'Activa' : 'Inactiva'}
        </button>
      </div>

      <div className="space-y-2">
        <Campo etiqueta="Etiqueta" valor={etiqueta} onChange={setEtiqueta} marcador="Solo por hoy" />
        <Campo etiqueta="Título" valor={titulo} onChange={setTitulo} />
        <Campo etiqueta="Descripción" valor={descripcion} onChange={setDescripcion} />
        {promo.tipo === 'envio' ? (
          <label className="block">
            <span className="text-xs text-marca-texto-suave">Gratis desde (monto)</span>
            <input
              inputMode="numeric"
              value={monto}
              onChange={(e) => setMonto(e.target.value.replace(/\D/g, ''))}
              className="mt-1 min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 tabular-nums text-marca-texto"
            />
          </label>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-5 shrink-0" />
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="mt-4 flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-marca-acento px-4 font-medium text-marca-acento-texto disabled:opacity-60"
      >
        {guardado ? <IconoCheck className="size-4" /> : null}
        {guardando ? 'Guardando…' : guardado ? 'Guardado' : 'Guardar cambios'}
      </button>
    </article>
  )
}

function Campo({
  etiqueta,
  valor,
  onChange,
  marcador,
}: {
  etiqueta: string
  valor: string
  onChange: (v: string) => void
  marcador?: string
}) {
  return (
    <label className="block">
      <span className="text-xs text-marca-texto-suave">{etiqueta}</span>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={marcador}
        className="mt-1 min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 text-marca-texto"
      />
    </label>
  )
}
