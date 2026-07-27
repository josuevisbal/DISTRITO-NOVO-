'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { IconoAlerta } from '@/components/iconos'
import { LogoMarca } from '@/components/logo-marca'
import { iniciarSesion, type ResultadoLogin } from './acciones'

/**
 * Escena de acceso: la foto del plato de la casa (la portada que el dueño sube en el
 * panel) a pantalla completa y oscurecida, con la tarjeta de acceso centrada encima.
 * El velo mantiene el formulario legible sobre cualquier foto. El botón de la luz
 * atenúa el fondo sin tocar el formulario; con reduced-motion no hay animación y la
 * escena queda iluminada.
 */
export function LoginForm({
  destino,
  nombre,
  logo,
  foto,
}: {
  destino: string
  nombre: string | null
  logo?: string | null
  /** Foto del plato (la portada que el dueño subió); se funde con el negro. */
  foto?: string | null
}) {
  const [estado, accion] = useActionState<ResultadoLogin, FormData>(iniciarSesion, undefined)
  // Encendida por defecto: con reduced-motion nadie queda a oscuras.
  const [encendida, setEncendida] = useState(true)

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10"
      style={{ backgroundColor: '#0B0B0C' }}
    >
      {/* La foto del plato ocupa toda la pantalla, oscurecida, y el acceso va encima. */}
      {foto ? (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={foto}
            alt=""
            className="size-full object-cover transition-[opacity,filter] duration-300 ease-out motion-reduce:transition-none"
            style={{
              opacity: encendida ? 1 : 0.18,
              filter: encendida ? 'none' : 'brightness(0.35) saturate(0.4)',
            }}
          />
          {/* Velo oscuro: la foto se ve, pero el formulario manda. */}
          <div
            className="absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none"
            style={{
              background:
                'radial-gradient(circle at 50% 45%, rgba(11,11,12,0.55) 0%, rgba(11,11,12,0.82) 55%, #0B0B0C 100%)',
              opacity: encendida ? 1 : 0.6,
            }}
          />
        </div>
      ) : null}

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-4">
        {/* Tarjeta de acceso, tipo vidrio. */}
        <form
          action={accion}
          className="animate-subir w-full rounded-2xl border border-white/10 p-6 backdrop-blur-md"
          style={{
            backgroundColor: 'rgba(18,16,14,0.72)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
          }}
        >
          <input type="hidden" name="destino" value={destino} />

          {/* Logo de la marca, dentro del recuadro y con aire antes del título. */}
          <div className="mb-4 flex justify-center">
            <LogoMarca className="size-[92px]" url={logo} />
          </div>

          <h1 className="text-center font-titulo text-2xl font-bold" style={{ color: '#ECCB79' }}>
            {nombre ?? 'Bienvenido'}
          </h1>
          <p className="mt-1 text-center text-sm" style={{ color: '#A9A294' }}>
            Acceso del equipo
          </p>

          <div className="mt-6 space-y-4">
            <CampoOscuro
              nombre="correo"
              tipo="email"
              etiqueta="Correo"
              autoComplete="username"
              marcador="tucorreo@correo.com"
            />
            <CampoOscuro
              nombre="clave"
              tipo="password"
              etiqueta="Contraseña"
              autoComplete="current-password"
              marcador="Tu contraseña"
            />
          </div>

          {estado?.error ? (
            <p
              role="alert"
              className="entra-pastilla mt-4 flex gap-2.5 rounded-lg border border-marca-acento/60 bg-black/30 p-3 text-sm"
              style={{ color: '#F4EFE4' }}
            >
              <span className="shrink-0" style={{ color: '#ECCB79' }}>
                <IconoAlerta className="size-5" />
              </span>
              {estado.error}
            </p>
          ) : null}

          <Boton />
        </form>

        {/* El juego de la luz: atenúa la foto del fondo sin tocar el formulario. */}
        {foto ? (
          <button
            type="button"
            onClick={() => setEncendida((v) => !v)}
            aria-pressed={encendida}
            className="min-h-11 rounded-full border border-white/15 px-4 text-xs font-medium backdrop-blur-sm"
            style={{ color: '#C9A24A', backgroundColor: 'rgba(11,11,12,0.45)' }}
          >
            {encendida ? 'Apagar luz' : 'Encender luz'}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function CampoOscuro({
  nombre,
  tipo,
  etiqueta,
  autoComplete,
  marcador,
}: {
  nombre: string
  tipo: string
  etiqueta: string
  autoComplete: string
  marcador: string
}) {
  return (
    <label className="block">
      <span className="text-xs" style={{ color: '#A9A294' }}>
        {etiqueta}
      </span>
      <input
        name={nombre}
        type={tipo}
        autoComplete={autoComplete}
        placeholder={marcador}
        required
        className="mt-1.5 min-h-12 w-full rounded-lg border border-white/15 bg-black/25 px-3 text-[#F4EFE4] placeholder:text-white/30 focus:border-marca-acento"
      />
    </label>
  )
}

function Boton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-6 flex min-h-12 w-full items-center justify-center rounded-lg font-semibold disabled:opacity-60"
      style={{
        background: 'linear-gradient(100deg, #B8862B, #ECCB79 50%, #B8862B)',
        color: '#1a1408',
      }}
    >
      {pending ? 'Entrando…' : 'Entrar'}
    </button>
  )
}
