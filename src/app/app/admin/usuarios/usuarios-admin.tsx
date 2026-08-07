'use client'

import { useState, type CSSProperties } from 'react'

import { IconoAlerta, IconoCheck, IconoMas } from '@/components/iconos'
import { Modal } from '@/components/modal'
import { useToast } from '@/components/toast'
import { Boton } from '@/components/ui/boton'
import { Pildora } from '@/components/ui/pildora'
import type { Database } from '@/lib/database.types'
import { actualizarUsuario, crearUsuario, eliminarUsuario } from './acciones'

type Rol = Database['public']['Enums']['rol_usuario']

export type UsuarioAdmin = {
  id: string
  nombre: string
  correo: string | null
  rol: Rol
  activo: boolean
}

/** Los cinco roles del sistema, en el orden en que se reparte el trabajo. */
const ROLES: Rol[] = ['admin', 'cajero', 'mesero', 'cocina', 'domicilio']

const NOMBRE_ROL: Record<Rol, string> = {
  admin: 'admin',
  cajero: 'cajero',
  mesero: 'mesero',
  cocina: 'cocina',
  domicilio: 'domicilio',
}

export function UsuariosAdmin({
  usuarios,
  yoId,
}: {
  usuarios: UsuarioAdmin[]
  yoId: string
}) {
  const [creando, setCreando] = useState(false)
  const [origen, setOrigen] = useState<{ x: number; y: number } | null>(null)

  // Quien entra aquí es admin: puede nombrar cualquiera de los cinco roles, incluido otro
  // admin. El único freno vive en la base: no se puede borrar al último administrador.
  const rolesDisponibles: Rol[] = ROLES
  const admins = usuarios.filter((u) => u.rol === 'admin' && u.activo).length

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Boton
          variante="primario"
          className="flex items-center gap-1.5 px-4"
          onClick={(e) => {
            setOrigen({ x: e.clientX, y: e.clientY })
            setCreando(true)
          }}
        >
          <IconoMas className="size-4" />
          Crear usuario
        </Boton>
      </div>

      {creando ? (
        <Modal titulo="Nuevo usuario" origen={origen} onCerrar={() => setCreando(false)}>
          <FormularioCrear roles={rolesDisponibles} onListo={() => setCreando(false)} />
        </Modal>
      ) : null}

      {/* Encabezado de columnas (pantallas medianas en adelante). */}
      <div className="hidden grid-cols-[1.4fr_1fr_9rem_6rem_6rem] gap-3 px-3 text-xs font-semibold uppercase tracking-wider text-marca-texto-suave sm:grid">
        <span>Nombre</span>
        <span>Correo</span>
        <span>Rol</span>
        <span>Acceso</span>
        <span className="text-right">Eliminar</span>
      </div>

      <ul className="space-y-2">
        {usuarios.map((u, i) => (
          <FilaUsuario
            key={u.id}
            usuario={u}
            esYo={u.id === yoId}
            rolesDisponibles={rolesDisponibles}
            ultimoAdmin={u.rol === 'admin' && admins <= 1}
            indice={i}
          />
        ))}
      </ul>
    </div>
  )
}

function FormularioCrear({ roles, onListo }: { roles: Rol[]; onListo: () => void }) {
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [rol, setRol] = useState<Rol>('cajero')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mostrar } = useToast()

  async function crear() {
    setEnviando(true)
    setError(null)
    const r = await crearUsuario({ nombre, correo, clave, rol })
    setEnviando(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    mostrar(`Usuario "${nombre.trim()}" creado`)
    onListo()
  }

  return (
    <div className="space-y-3">
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
      </div>

      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-5 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Boton
          variante="primario"
          className="flex items-center gap-1.5 px-4"
          onClick={crear}
          disabled={enviando}
        >
          <IconoCheck className="size-4" />
          {enviando ? 'Creando…' : 'Crear usuario'}
        </Boton>
        <Boton variante="secundario" className="px-4" onClick={onListo}>
          Cancelar
        </Boton>
      </div>
    </div>
  )
}

function FilaUsuario({
  usuario,
  esYo,
  rolesDisponibles,
  ultimoAdmin,
  indice,
}: {
  usuario: UsuarioAdmin
  esYo: boolean
  rolesDisponibles: Rol[]
  /** Es el único administrador activo: no se le puede quitar el rol ni el acceso. */
  ultimoAdmin: boolean
  indice: number
}) {
  const [rol, setRol] = useState<Rol>(usuario.rol)
  const [activo, setActivo] = useState(usuario.activo)
  const [confirmando, setConfirmando] = useState(false)
  const [eliminado, setEliminado] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mostrar } = useToast()

  async function aplicar(cambios: Parameters<typeof actualizarUsuario>[1]) {
    setError(null)
    const r = await actualizarUsuario(usuario.id, cambios)
    if (!r.ok) setError(r.error)
    else mostrar('Cambio guardado')
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
    mostrar(`Usuario "${usuario.nombre}" eliminado`)
    setEliminado(true)
  }

  if (eliminado) return null

  // El restaurante no puede quedarse sin administrador: la base lo impone también.
  const bloqueada = ultimoAdmin
  const puedeEliminar = !esYo && !bloqueada

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
          <p className="text-xs text-marca-texto-suave">
            Único administrador: nombra otro antes de cambiarlo.
          </p>
        ) : null}
      </div>

      <p className="min-w-0 truncate text-sm text-marca-texto-suave">{usuario.correo ?? '—'}</p>

      {bloqueada ? (
        <Pildora tono="ambar" className="w-fit capitalize">
          {NOMBRE_ROL[usuario.rol]}
        </Pildora>
      ) : (
        <select
          value={rol}
          onChange={(e) => {
            const nuevo = e.target.value as Rol
            setRol(nuevo)
            aplicar({ rol: nuevo })
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
            <Boton variante="peligro" className="px-3" onClick={eliminar} disabled={ocupado}>
              {ocupado ? '…' : 'Sí'}
            </Boton>
            <Boton
              variante="secundario"
              className="px-3"
              onClick={() => setConfirmando(false)}
              disabled={ocupado}
            >
              No
            </Boton>
          </div>
        ) : (
          <Boton
            variante="secundario"
            className="px-3 transition-colors hover:border-[#D64533] hover:text-[#D64533]"
            disabled={!puedeEliminar}
            onClick={() => setConfirmando(true)}
          >
            Eliminar
          </Boton>
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
