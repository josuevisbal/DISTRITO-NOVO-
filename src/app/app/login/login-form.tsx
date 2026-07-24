'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { IconoAlerta } from '@/components/iconos'
import { iniciarSesion, type ResultadoLogin } from './acciones'

export function LoginForm({ destino }: { destino: string }) {
  const [estado, accion] = useActionState<ResultadoLogin, FormData>(iniciarSesion, undefined)

  return (
    <form action={accion} className="w-full max-w-sm">
      <input type="hidden" name="destino" value={destino} />

      <label className="block">
        <span className="text-sm text-marca-texto-suave">Correo</span>
        <input
          name="correo"
          type="email"
          autoComplete="username"
          required
          className="mt-1.5 min-h-12 w-full rounded-lg border border-marca-borde bg-marca-superficie px-3 text-marca-texto"
        />
      </label>

      <label className="mt-4 block">
        <span className="text-sm text-marca-texto-suave">Contraseña</span>
        <input
          name="clave"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1.5 min-h-12 w-full rounded-lg border border-marca-borde bg-marca-superficie px-3 text-marca-texto"
        />
      </label>

      {estado?.error ? (
        <p
          role="alert"
          className="mt-4 flex gap-2.5 rounded-lg border border-marca-acento bg-marca-superficie p-3 text-sm text-marca-texto"
        >
          <IconoAlerta className="size-5 shrink-0 text-marca-acento" />
          {estado.error}
        </p>
      ) : null}

      <Boton />
    </form>
  )
}

function Boton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-6 flex min-h-12 w-full items-center justify-center rounded-lg bg-marca-acento font-medium text-marca-acento-texto disabled:opacity-60"
    >
      {pending ? 'Entrando…' : 'Entrar'}
    </button>
  )
}
