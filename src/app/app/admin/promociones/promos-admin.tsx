'use client'

import { useRef, useState, type CSSProperties } from 'react'

import { IconoAlerta, IconoCheck } from '@/components/iconos'
import { Interruptor } from '@/components/interruptor'
import { useToast } from '@/components/toast'
import { alternarPromo, guardarPromo, quitarFotoPromo, subirFotoPromo } from './acciones'

export type PromoAdmin = {
  id: string
  tipo: string
  etiqueta: string | null
  titulo: string
  descripcion: string | null
  monto_minimo: number | null
  imagen_url: string | null
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
  const { mostrar } = useToast()

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
      mostrar('Promoción guardada')
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
        <Interruptor activa={promo.activa} onCambiar={(v) => alternarPromo(promo.id, v)} />
      </div>

      <FotoPromo promo={promo} />

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

/** Foto de fondo de la promoción, con vista previa local antes de guardar. */
function FotoPromo({ promo }: { promo: PromoAdmin }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pendiente, setPendiente] = useState<File | null>(null)
  const [previa, setPrevia] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function elegir(archivo: File) {
    setPendiente(archivo)
    setPrevia(URL.createObjectURL(archivo))
  }

  function limpiar() {
    if (previa) URL.revokeObjectURL(previa)
    setPendiente(null)
    setPrevia(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function guardarFoto() {
    if (!pendiente) return
    setOcupado(true)
    setError(null)
    const form = new FormData()
    form.set('foto', pendiente)
    const r = await subirFotoPromo(promo.id, form)
    setOcupado(false)
    if (!r.ok) setError(r.error)
    else limpiar()
  }

  const mostrada = previa ?? promo.imagen_url

  return (
    <div className="mb-3 rounded-xl border border-marca-borde p-3">
      <div className="flex items-center gap-3">
        <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-marca-superficie-tenue">
          {mostrada ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mostrada} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-xs text-marca-texto-suave">
              Sin foto
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) elegir(f)
            }}
          />
          {pendiente ? (
            <>
              <button
                type="button"
                onClick={guardarFoto}
                disabled={ocupado}
                className="min-h-11 rounded-lg bg-marca-acento px-3 text-sm font-medium text-marca-acento-texto disabled:opacity-60"
              >
                {ocupado ? 'Subiendo…' : 'Guardar foto'}
              </button>
              <button
                type="button"
                onClick={limpiar}
                disabled={ocupado}
                className="min-h-11 rounded-lg border border-marca-borde px-3 text-sm text-marca-texto-suave"
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="min-h-11 rounded-lg border border-marca-borde px-3 text-sm text-marca-texto"
              >
                {promo.imagen_url ? 'Cambiar foto' : 'Subir foto de fondo'}
              </button>
              {promo.imagen_url ? (
                <button
                  type="button"
                  onClick={() => quitarFotoPromo(promo.id)}
                  className="min-h-11 rounded-lg border border-marca-borde px-3 text-sm text-marca-texto-suave"
                >
                  Quitar
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
      {pendiente ? (
        <p className="mt-2 text-xs text-marca-texto-suave">
          Vista previa: aún no se guarda hasta que toques “Guardar foto”.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 flex items-center gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
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
