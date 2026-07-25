'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { IconoAlerta } from '@/components/iconos'
import { iniciarSesion, type ResultadoLogin } from './acciones'

/**
 * Escena de acceso: una lámpara de escritorio con cordón enciende y apaga la luz (el fondo
 * pasa de oscuro a cálido) y la tarjeta de acceso, tipo vidrio, aparece con el formulario.
 * Es una pantalla decorativa a propósito: las tonalidades de la escena (lámpara prendida /
 * apagada) son del ambiente, no de la marca. El botón de acceso sí usa el dorado de marca.
 * Todo el movimiento sale del sistema central (--mov-*) y respeta reduced-motion.
 */
export function LoginForm({ destino, nombre }: { destino: string; nombre: string | null }) {
  const [estado, accion] = useActionState<ResultadoLogin, FormData>(iniciarSesion, undefined)
  const [encendida, setEncendida] = useState(true)

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10"
      style={{
        backgroundColor: encendida ? '#17140E' : '#0B0B0C',
        transition: 'background-color var(--mov-lenta) var(--mov-estado)',
      }}
    >
      {/* Resplandor cálido de la lámpara: aparece al encender. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -z-0"
        style={{
          left: '18%',
          top: '30%',
          width: 620,
          height: 620,
          transform: 'translate(-50%, -50%)',
          background:
            'radial-gradient(circle, rgba(216,172,78,0.30), rgba(216,172,78,0.10) 35%, transparent 62%)',
          opacity: encendida ? 1 : 0,
          transition: 'opacity var(--mov-lenta) var(--mov-estado)',
        }}
      />

      <div className="relative z-10 grid w-full max-w-4xl items-center gap-10 md:grid-cols-2">
        <Lampara encendida={encendida} onToggle={() => setEncendida((v) => !v)} />

        {/* Tarjeta de acceso, tipo vidrio. */}
        <form
          action={accion}
          className="animate-subir mx-auto w-full max-w-sm rounded-2xl border border-white/10 p-6 backdrop-blur-md"
          style={{
            backgroundColor: encendida ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
            transition: 'background-color var(--mov-lenta) var(--mov-estado)',
          }}
        >
          <input type="hidden" name="destino" value={destino} />

          <h1
            className="text-center font-titulo text-2xl font-bold"
            style={{ color: '#ECCB79' }}
          >
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
              Tira del cordón de la lámpara para encender la luz.
            </p>
          ) : null}
        </form>
      </div>
    </div>
  )
}

/** Lámpara de escritorio con cordón. Al tirar del cordón se enciende o apaga la luz. */
function Lampara({ encendida, onToggle }: { encendida: boolean; onToggle: () => void }) {
  return (
    <div className="mx-auto flex flex-col items-center">
      <svg viewBox="0 0 220 260" className="h-56 w-auto md:h-72" role="img" aria-label="Lámpara">
        <defs>
          <linearGradient id="pantalla" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F4F1EA" />
            <stop offset="1" stopColor="#D8D3C7" />
          </linearGradient>
        </defs>

        {/* Halo bajo la pantalla cuando está encendida */}
        <ellipse
          cx="96"
          cy="96"
          rx="92"
          ry="46"
          fill="#F6D98A"
          style={{
            opacity: encendida ? 0.5 : 0,
            transition: 'opacity var(--mov-lenta) var(--mov-estado)',
          }}
        />

        {/* Pantalla (cúpula) */}
        <path d="M22 96 A74 62 0 0 1 170 96 Z" fill="url(#pantalla)" />
        <ellipse cx="96" cy="96" rx="74" ry="12" fill="#EDE9DF" />

        {/* Cuello y base */}
        <rect x="90" y="96" width="12" height="118" rx="4" fill="#D8D3C7" />
        <rect x="60" y="214" width="72" height="14" rx="7" fill="#CFC9BC" />
        <rect x="52" y="226" width="88" height="10" rx="5" fill="#BDB6A6" />

        {/* Cordón + perilla (área para tirar) */}
        <line
          x1="150"
          y1="90"
          x2="150"
          y2={encendida ? 150 : 138}
          stroke="#9a927f"
          strokeWidth="2"
          style={{ transition: 'all var(--mov-media) var(--mov-entrar)' }}
        />
        <circle
          cx="150"
          cy={encendida ? 156 : 144}
          r="6"
          fill="#C9A24A"
          style={{ transition: 'all var(--mov-media) var(--mov-entrar)' }}
        />
      </svg>

      <button
        type="button"
        onClick={onToggle}
        aria-pressed={encendida}
        className="mt-1 min-h-11 rounded-full border border-white/15 px-4 text-xs font-medium"
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
