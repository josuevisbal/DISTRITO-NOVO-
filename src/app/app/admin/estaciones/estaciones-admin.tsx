'use client'

import { useState, type CSSProperties } from 'react'

import { IconoAlerta, IconoCheck, IconoFuego, IconoMas } from '@/components/iconos'
import { useToast } from '@/components/toast'
import { Boton } from '@/components/ui/boton'
import { Pildora } from '@/components/ui/pildora'
import { alternarEstacion, crearEstacion, guardarEstacion } from './acciones'

export type EstacionAdmin = {
  id: string
  nombre: string
  slug: string
  color: string
  activa: boolean
  platos: number
}

/** Colores sugeridos, los del sistema. El admin puede escribir otro. */
const COLORES = ['#E0872B', '#C2452F', '#2E9E8F', '#5B6BF0', '#B8862B', '#7C3AED']

export function EstacionesAdmin({ estaciones }: { estaciones: EstacionAdmin[] }) {
  const [creando, setCreando] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {creando ? null : (
          <Boton
            variante="primario"
            className="flex items-center gap-1.5 px-4"
            onClick={() => setCreando(true)}
          >
            <IconoMas className="size-4" />
            Nueva cocina
          </Boton>
        )}
      </div>

      {creando ? <FormularioNueva onListo={() => setCreando(false)} /> : null}

      <ul className="space-y-3">
        {estaciones.map((e, i) => (
          <FilaEstacion key={e.id} estacion={e} indice={i} />
        ))}
      </ul>
    </div>
  )
}

function FormularioNueva({ onListo }: { onListo: () => void }) {
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState(COLORES[0])
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mostrar } = useToast()

  async function crear() {
    setOcupado(true)
    setError(null)
    const r = await crearEstacion(nombre, color)
    setOcupado(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    mostrar(`Cocina "${nombre.trim()}" creada`)
    onListo()
  }

  return (
    <section className="tarjeta space-y-3 p-4">
      <h2 className="font-medium text-marca-texto">Nueva cocina</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-marca-texto-suave">Nombre</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Comida rápida, Asados, Bebidas…"
            className="mt-1 min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 text-marca-texto"
          />
        </label>
        <SelectorColor color={color} onCambiar={setColor} />
      </div>

      {error ? <Error texto={error} /> : null}

      <div className="flex gap-2">
        <Boton variante="primario" className="px-4" onClick={crear} disabled={ocupado}>
          {ocupado ? 'Creando…' : 'Crear cocina'}
        </Boton>
        <Boton variante="secundario" className="px-4" onClick={onListo} disabled={ocupado}>
          Cancelar
        </Boton>
      </div>
    </section>
  )
}

function FilaEstacion({ estacion, indice }: { estacion: EstacionAdmin; indice: number }) {
  const [nombre, setNombre] = useState(estacion.nombre)
  const [color, setColor] = useState(estacion.color)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mostrar } = useToast()

  async function guardar() {
    setGuardando(true)
    setError(null)
    const r = await guardarEstacion(estacion.id, { nombre, color })
    setGuardando(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    mostrar('Cocina guardada')
    setGuardado(true)
    setTimeout(() => setGuardado(false), 1500)
  }

  async function alternar() {
    setError(null)
    const r = await alternarEstacion(estacion.id, !estacion.activa)
    if (!r.ok) setError(r.error)
    else mostrar(estacion.activa ? 'Cocina apagada' : 'Cocina encendida')
  }

  return (
    <li className="tarjeta entra p-4" style={{ '--i': indice } as CSSProperties}>
      <div className="flex flex-wrap items-center gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ backgroundColor: color }}
        >
          <IconoFuego className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            aria-label="Nombre de la cocina"
            className="min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 font-medium text-marca-texto"
          />
          <p className="mt-1 text-xs text-marca-texto-suave">
            {estacion.platos} {estacion.platos === 1 ? 'plato' : 'platos'} · pantalla{' '}
            <code>/app/cocina/{estacion.slug}</code>
          </p>
        </div>

        <Pildora tono={estacion.activa ? 'verde' : 'gris'}>
          {estacion.activa ? 'Encendida' : 'Apagada'}
        </Pildora>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <SelectorColor color={color} onCambiar={setColor} />

        <Boton
          variante="primario"
          className="flex items-center gap-1.5 px-4"
          onClick={guardar}
          disabled={guardando}
        >
          {guardado ? <IconoCheck className="size-4" /> : null}
          {guardando ? 'Guardando…' : guardado ? 'Guardado' : 'Guardar'}
        </Boton>

        <Boton variante="secundario" className="px-3" onClick={alternar}>
          {estacion.activa ? 'Apagar' : 'Encender'}
        </Boton>
      </div>

      {error ? <Error texto={error} /> : null}
    </li>
  )
}

function SelectorColor({
  color,
  onCambiar,
}: {
  color: string
  onCambiar: (v: string) => void
}) {
  return (
    <div>
      <span className="text-xs text-marca-texto-suave">Color de la cocina</span>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {COLORES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onCambiar(c)}
            aria-label={`Usar el color ${c}`}
            aria-pressed={color.toLowerCase() === c.toLowerCase()}
            className={`size-9 rounded-lg border-2 transition-transform hover:scale-105 motion-reduce:transform-none ${
              color.toLowerCase() === c.toLowerCase()
                ? 'border-marca-texto'
                : 'border-transparent'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
        <input
          type="color"
          value={color}
          onChange={(e) => onCambiar(e.target.value)}
          aria-label="Otro color"
          className="size-9 cursor-pointer rounded-lg border border-marca-borde bg-marca-fondo"
        />
      </div>
    </div>
  )
}

function Error({ texto }: { texto: string }) {
  return (
    <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-marca-acento-fuerte">
      <IconoAlerta className="size-5 shrink-0" />
      {texto}
    </p>
  )
}
