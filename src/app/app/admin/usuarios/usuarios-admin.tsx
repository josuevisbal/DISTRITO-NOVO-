'use client'

import { useState, type CSSProperties } from 'react'

import { IconoAlerta, IconoCheck, IconoMas } from '@/components/iconos'
import type { Database } from '@/lib/database.types'
import { actualizarUsuario, crearUsuario, eliminarUsuario } from './acciones'

type Rol = Database['public']['Enums']['rol_usuario']

export type UsuarioAdmin = {
  id: string
  nombre: string
  correo: string | null
  rol: Rol
  estacion_id: string | null
  activo: boolean
}
export type EstacionOpcion = { id: string; nombre: string }

const ROLES_OPERACION: Rol[] = ['cajero', 'mesero', 'cocina', 'pase', 'domiciliario']

const NOMBRE_ROL: Record<Rol, string> = {
  dueno: 'dueño',
  admin: 'admin',
  cajero: 'cajero',
  mesero: 'mesero',
  cocina: 'cocina',
  pase: 'pase',
  domiciliario: 'domiciliario',
}

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
  const [creando, setCreando] = useState(false)

  // El dueño otorga cualquier rol; el admin solo roles de operación.
  const rolesDisponibles: Rol[] =
    miRol === 'dueno' ? ['dueno', 'admin', ...ROLES_OPERACION] : ROLES_OPERACION

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setCreando((v) => !v)}
          className="flex min-h-11 items-center gap-1.5 rounded-lg bg-marca-acento px-4 font-medium text-marca-acento-texto"
        >
          <IconoMas className="size-4" />
          Crear usuario
        </button>
      </div>

      {creando ? (
        <FormularioCrear
          estaciones={estaciones}
          roles={rolesDisponibles}
          onListo={() => setCreando(false)}
        />
      ) : null}

      {/* Encabezado de columnas (pantallas medianas en adelante). */}
      <div className="hidden grid-cols-[1.4fr_1fr_9rem_6rem_6rem] gap-3 px-3 text-xs font-semibold uppercase tracking-wider text-marca-texto-suave sm:grid">
        <span>Nombre</span>
        <span>Correo</span>
        <span>Rol / estación</span>
        <span>Acceso</span>
        <span className="text-right">Eliminar</span>
      </div>

      <ul className="space-y-2">
        {usuarios.map((u, i) => (
          <FilaUsuario
            key={u.id}
            usuario={u}
            estaciones={estaciones}
            esYo={u.id === yoId}
            miRol={miRol}
            rolesDisponibles={rolesDisponibles}
            indice={i}
          />
        ))}
      </ul>
    </div>
  )
}

function FormularioCrear({
  estaciones,
  roles,
  onListo,
}: {
  estaciones: EstacionOpcion[]
  roles: Rol[]
  onListo: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [rol, setRol] = useState<Rol>('cajero')
  const [estacion, setEstacion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function crear() {
    setEnviando(true)
    setError(null)
    const r = await crearUsuario({
      nombre,
      correo,
      clave,
      rol,
      estacion_id: estacion || null,
    })
    setEnviando(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    onListo()
  }

  return (
    <div className="tarjeta entra space-y-3 p-4">
      <h2 className="font-semibold text-marca-texto">Nuevo usuario</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre" valor={nombre} onChange={setNombre} marcador="Nombre y apellido" />
        <Campo
          etiqueta="Correo"
          valor={correo}
          onChange={setCorreo}
          tipo="email"
          marcador="persona@correo.com"
        />
        <Campo
          etiqueta="Contraseña inicial"
          valor={clave}
          onChange={setClave}
          tipo="text"
          marcador="Mínimo 8 caracteres"
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-marca-texto-suave">Rol</span>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as Rol)}
              className="mt-1 min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-2 text-marca-texto"
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {NOMBRE_ROL[r]}
                </option>
              ))}
            </select>
          </label>
          {rol === 'cocina' ? (
            <label className="block">
              <span className="text-xs text-marca-texto-suave">Estación</span>
              <select
                value={estacion}
                onChange={(e) => setEstacion(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-2 text-marca-texto"
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
        </div>
      </div>

      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-5 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={crear}
          disabled={enviando}
          className="flex min-h-11 items-center gap-1.5 rounded-lg bg-marca-acento px-4 font-medium text-marca-acento-texto disabled:opacity-60"
        >
          <IconoCheck className="size-4" />
          {enviando ? 'Creando…' : 'Crear usuario'}
        </button>
        <button
          type="button"
          onClick={onListo}
          className="min-h-11 rounded-lg border border-marca-borde px-4 text-sm text-marca-texto-suave"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

function FilaUsuario({
  usuario,
  estaciones,
  esYo,
  miRol,
  rolesDisponibles,
  indice,
}: {
  usuario: UsuarioAdmin
  estaciones: EstacionOpcion[]
  esYo: boolean
  miRol: Rol
  rolesDisponibles: Rol[]
  indice: number
}) {
  const [rol, setRol] = useState<Rol>(usuario.rol)
  const [estacion, setEstacion] = useState(usuario.estacion_id ?? '')
  const [activo, setActivo] = useState(usuario.activo)
  const [confirmando, setConfirmando] = useState(false)
  const [eliminado, setEliminado] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function aplicar(cambios: Parameters<typeof actualizarUsuario>[1]) {
    setError(null)
    const r = await actualizarUsuario(usuario.id, cambios)
    if (!r.ok) setError(r.error)
  }

  async function eliminar() {
    setOcupado(true)
    setError(null)
    const r = await eliminarUsuario(usuario.id)
    if (!r.ok) {
      setError(r.error)
      setOcupado(false)
      setConfirmando(false)
      return
    }
    // Respuesta inmediata: la fila se va ya; el refresco confirma detrás.
    setEliminado(true)
  }

  if (eliminado) return null

  // El admin no toca dueños ni a otros admins (la base también lo impone).
  const bloqueada =
    miRol !== 'dueno' && (usuario.rol === 'dueno' || (usuario.rol === 'admin' && !esYo))
  // Ni el dueño se elimina a sí mismo, ni nadie elimina al dueño.
  const puedeEliminar = !esYo && usuario.rol !== 'dueno' && !bloqueada

  return (
    <li
      className="tarjeta entra grid grid-cols-2 items-center gap-3 p-3 sm:grid-cols-[1.4fr_1fr_9rem_6rem_6rem]"
      style={{ '--i': indice } as CSSProperties}
    >
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <p className="truncate font-medium text-marca-texto">
          {usuario.nombre}
          {esYo ? <span className="ml-1 text-xs text-marca-texto-suave">(tú)</span> : null}
        </p>
        {bloqueada ? (
          <p className="text-xs text-marca-texto-suave">Solo el dueño modifica esta cuenta.</p>
        ) : null}
      </div>

      <p className="min-w-0 truncate text-sm text-marca-texto-suave">{usuario.correo ?? '—'}</p>

      {bloqueada ? (
        <span className="inline-flex w-fit rounded-full border border-marca-acento px-3 py-1 text-sm font-medium capitalize text-marca-acento-fuerte">
          {NOMBRE_ROL[usuario.rol]}
        </span>
      ) : (
        <div className="flex gap-1.5">
          <select
            value={rol}
            onChange={(e) => {
              const nuevo = e.target.value as Rol
              setRol(nuevo)
              aplicar({ rol: nuevo, estacion_id: estacion || null })
            }}
            className="min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-2 text-sm capitalize text-marca-texto"
          >
            {(rolesDisponibles.includes(usuario.rol)
              ? rolesDisponibles
              : [usuario.rol, ...rolesDisponibles]
            ).map((r) => (
              <option key={r} value={r}>
                {NOMBRE_ROL[r]}
              </option>
            ))}
          </select>
          {rol === 'cocina' ? (
            <select
              value={estacion}
              onChange={(e) => {
                setEstacion(e.target.value)
                aplicar({ rol, estacion_id: e.target.value || null })
              }}
              aria-label="Estación"
              className="min-h-11 w-24 rounded-lg border border-marca-borde bg-marca-fondo px-1.5 text-sm text-marca-texto"
            >
              <option value="">—</option>
              {estaciones.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      )}

      <button
        type="button"
        disabled={esYo || bloqueada}
        onClick={() => {
          const v = !activo
          setActivo(v)
          aplicar({ activo: v })
        }}
        className={`min-h-11 rounded-lg border px-2 text-sm ${
          activo
            ? 'border-marca-borde text-marca-texto-suave'
            : 'border-marca-acento font-medium text-marca-acento-fuerte'
        } disabled:opacity-40`}
      >
        {activo ? 'Activo' : 'Inactivo'}
      </button>

      <div className="flex justify-end">
        {confirmando ? (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={eliminar}
              disabled={ocupado}
              className="min-h-11 rounded-lg px-3 text-sm font-bold text-white disabled:opacity-60"
              style={{ backgroundColor: '#D64533' }}
            >
              {ocupado ? '…' : 'Sí'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              disabled={ocupado}
              className="min-h-11 rounded-lg border border-marca-borde px-3 text-sm text-marca-texto-suave"
            >
              No
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!puedeEliminar}
            onClick={() => setConfirmando(true)}
            className="min-h-11 rounded-lg border border-marca-borde px-3 text-sm text-marca-texto-suave transition-colors hover:border-[#D64533] hover:text-[#D64533] disabled:opacity-40"
          >
            Eliminar
          </button>
        )}
      </div>

      {error ? (
        <p
          role="alert"
          className="col-span-2 flex items-center gap-2 text-sm text-marca-acento-fuerte sm:col-span-5"
        >
          <IconoAlerta className="size-5 shrink-0" />
          {error}
        </p>
      ) : null}
    </li>
  )
}

function Campo({
  etiqueta,
  valor,
  onChange,
  tipo = 'text',
  marcador,
}: {
  etiqueta: string
  valor: string
  onChange: (v: string) => void
  tipo?: string
  marcador?: string
}) {
  return (
    <label className="block">
      <span className="text-xs text-marca-texto-suave">{etiqueta}</span>
      <input
        type={tipo}
        value={valor}
        placeholder={marcador}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 text-marca-texto placeholder:text-marca-texto-suave/60"
      />
    </label>
  )
}
