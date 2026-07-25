'use client'

import { useState, type CSSProperties } from 'react'

import { IconoAlerta } from '@/components/iconos'
import type { Database } from '@/lib/database.types'
import { actualizarUsuario } from './acciones'

type Rol = Database['public']['Enums']['rol_usuario']

export type UsuarioAdmin = {
  id: string
  nombre: string
  rol: Rol
  estacion_id: string | null
  activo: boolean
}
export type EstacionOpcion = { id: string; nombre: string }

const ROLES: Rol[] = ['admin', 'cajero', 'mesero', 'cocina', 'pase', 'domiciliario']

export function UsuariosAdmin({
  usuarios,
  estaciones,
  yoId,
  miRol,
}: {
  usuarios: UsuarioAdmin[]
  estaciones: EstacionOpcion[]
  yoId: string
  miRol: Rol
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-3 p-4 pb-16">
      {usuarios.map((u, i) => (
        <FilaUsuario
          key={u.id}
          usuario={u}
          estaciones={estaciones}
          esYo={u.id === yoId}
          miRol={miRol}
          indice={i}
        />
      ))}
    </div>
  )
}

function FilaUsuario({
  usuario,
  estaciones,
  esYo,
  miRol,
  indice,
}: {
  usuario: UsuarioAdmin
  estaciones: EstacionOpcion[]
  esYo: boolean
  miRol: Rol
  indice: number
}) {
  const [rol, setRol] = useState<Rol>(usuario.rol)
  const [estacion, setEstacion] = useState(usuario.estacion_id ?? '')
  const [activo, setActivo] = useState(usuario.activo)
  const [error, setError] = useState<string | null>(null)

  async function aplicar(cambios: Parameters<typeof actualizarUsuario>[1]) {
    setError(null)
    const r = await actualizarUsuario(usuario.id, cambios)
    if (!r.ok) setError(r.error)
  }

  // La cuenta del dueño solo la toca el propio dueño (la base también lo impone).
  const esDueno = usuario.rol === 'dueno'
  const bloqueada = esDueno && miRol !== 'dueno'
  // Solo el dueño puede otorgar el rol de dueño.
  const rolesDisponibles: Rol[] = miRol === 'dueno' ? ['dueno', ...ROLES] : ROLES

  if (bloqueada) {
    return (
      <div
        className="entra flex flex-wrap items-center gap-3 rounded-xl border border-marca-borde bg-marca-superficie p-3 opacity-70"
        style={{ '--i': indice } as CSSProperties}
      >
        <p className="min-w-32 flex-1 font-medium text-marca-texto">{usuario.nombre}</p>
        <span className="rounded-full border border-marca-acento px-3 py-1 text-sm font-medium text-marca-acento-fuerte">
          Dueño
        </span>
        <span className="w-full text-xs text-marca-texto-suave">
          Solo el dueño puede modificar esta cuenta.
        </span>
      </div>
    )
  }

  return (
    <div
      className="entra flex flex-wrap items-end gap-3 rounded-xl border border-marca-borde bg-marca-superficie p-3"
      style={{ '--i': indice } as CSSProperties}
    >
      <div className="min-w-32 flex-1">
        <p className="font-medium text-marca-texto">
          {usuario.nombre}
          {esYo ? <span className="ml-1 text-xs text-marca-texto-suave">(tú)</span> : null}
        </p>
      </div>

      <label>
        <span className="block text-xs text-marca-texto-suave">Rol</span>
        <select
          value={rol}
          onChange={(e) => {
            const nuevo = e.target.value as Rol
            setRol(nuevo)
            aplicar({ rol: nuevo, estacion_id: estacion || null })
          }}
          className="mt-1 min-h-11 rounded-lg border border-marca-borde bg-marca-fondo px-2 text-marca-texto"
        >
          {rolesDisponibles.map((r) => (
            <option key={r} value={r}>
              {r === 'dueno' ? 'dueño' : r}
            </option>
          ))}
        </select>
      </label>

      {rol === 'cocina' ? (
        <label>
          <span className="block text-xs text-marca-texto-suave">Estación</span>
          <select
            value={estacion}
            onChange={(e) => {
              setEstacion(e.target.value)
              aplicar({ rol, estacion_id: e.target.value || null })
            }}
            className="mt-1 min-h-11 rounded-lg border border-marca-borde bg-marca-fondo px-2 text-marca-texto"
          >
            <option value="">—</option>
            {estaciones.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <button
        type="button"
        disabled={esYo}
        onClick={() => {
          const v = !activo
          setActivo(v)
          aplicar({ activo: v })
        }}
        className={`min-h-11 rounded-lg border px-3 text-sm ${
          activo ? 'border-marca-borde text-marca-texto-suave' : 'border-marca-acento text-marca-acento-fuerte'
        } disabled:opacity-40`}
      >
        {activo ? 'Activo' : 'Inactivo'}
      </button>

      {error ? (
        <p role="alert" className="flex w-full items-center gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  )
}
