'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { IconoAlerta } from '@/components/iconos'
import { LogoMarca } from '@/components/logo-marca'
import { iniciarSesion, type ResultadoLogin } from './acciones'

/**
 * Escena de acceso: una salchipapa de la casa bajo un foco cálido. El botón enciende y
 * apaga la luz de esa zona (a todo color con resplandor dorado, o en penumbra) y a la
 * derecha va la tarjeta de acceso con el logo de la marca adentro. Las transiciones
 * salen del sistema central y respetan reduced-motion (con menos movimiento, la escena
 * queda iluminada y sin animación). El logo se referencia desde config (LOGO_URL).
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
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10 transition-colors duration-300 motion-reduce:transition-none"
      style={{ backgroundColor: encendida ? '#17140E' : '#0B0B0C' }}
    >
      {/* Resplandor cálido del foco sobre el plato: aparece al encender. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -z-0 transition-opacity duration-300 motion-reduce:transition-none"
        style={{
          left: '22%',
          top: '42%',
          width: 640,
          height: 640,
          transform: 'translate(-50%, -50%)',
          background:
            'radial-gradient(circle, rgba(224,135,43,0.32), rgba(216,172,78,0.12) 38%, transparent 64%)',
          opacity: encendida ? 1 : 0,
        }}
      />

      <div className="relative z-10 grid w-full max-w-4xl items-center gap-10 md:grid-cols-2">
        <PlatoDeLaCasa
          foto={foto}
          encendida={encendida}
          onToggle={() => setEncendida((v) => !v)}
        />

        {/* Tarjeta de acceso, tipo vidrio. */}
        <form
          action={accion}
          className="animate-subir mx-auto w-full max-w-sm rounded-2xl border border-white/10 p-6 backdrop-blur-md transition-colors duration-300 motion-reduce:transition-none"
          style={{
            backgroundColor: encendida ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
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

          {!encendida ? (
            <p className="mt-4 text-center text-xs" style={{ color: '#7c766a' }}>
              Enciende la luz para ver el plato de la casa.
            </p>
          ) : null}
        </form>
      </div>
    </div>
  )
}

/**
 * El plato de la casa: la misma foto de portada que el dueno sube en el panel, fundida
 * con el negro por los bordes (nada de marcos). El boton de la luz la ilumina: a todo
 * color con resplandor calido, o en penumbra. Fade de 300 ms del sistema, anulado con
 * reduced-motion. Sin foto todavia, queda un circulo tenue en vez de un hueco.
 */
function PlatoDeLaCasa({
  foto,
  encendida,
  onToggle,
}: {
  foto?: string | null
  encendida: boolean
  onToggle: () => void
}) {
  return (
    <div className="mx-auto flex flex-col items-center">
      <div
        className="relative size-64 transition-[opacity,filter] duration-300 ease-out motion-reduce:transition-none sm:size-72 md:size-80"
        style={{
          opacity: encendida ? 1 : 0.16,
          filter: encendida ? 'none' : 'brightness(0.4) saturate(0.4)',
        }}
      >
        {/* Resplandor calido detras del plato. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 rounded-full blur-2xl transition-opacity duration-300 motion-reduce:transition-none"
          style={{
            background:
              'radial-gradient(circle, rgba(224,135,43,0.55), rgba(216,172,78,0.18) 45%, transparent 70%)',
            opacity: encendida ? 1 : 0,
            transform: 'scale(1.15)',
          }}
        />

        {foto ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={foto}
              alt="El plato de la casa"
              className="size-full rounded-full object-cover"
            />
            {/* Los bordes se funden con el fondo: se ve el plato, no un recorte. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background:
                  'radial-gradient(circle at 50% 45%, transparent 42%, rgba(11,11,12,0.55) 68%, #0B0B0C 92%)',
              }}
            />
          </>
        ) : (
          <div
            aria-hidden
            className="size-full rounded-full"
            style={{ background: 'radial-gradient(circle, #2a231a, transparent 70%)' }}
          />
        )}
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-pressed={encendida}
        className="mt-3 min-h-11 rounded-full border border-white/15 px-4 text-xs font-medium"
        style={{ color: '#C9A24A' }}
      >
        {encendida ? 'Apagar luz' : 'Encender luz'}
      </button>
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
