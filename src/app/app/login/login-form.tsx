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
}: {
  destino: string
  nombre: string | null
  logo?: string | null
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
        <Salchipapa encendida={encendida} onToggle={() => setEncendida((v) => !v)} />

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
 * Salchipapa de la casa en SVG: papas a la francesa doradas, trozos de salchicha y un
 * toque de salsas. Con la luz apagada se oscurece casi hasta no verse; encendida, brilla
 * a todo color. El fade es del sistema (~300 ms) y se anula con reduced-motion.
 */
function Salchipapa({ encendida, onToggle }: { encendida: boolean; onToggle: () => void }) {
  return (
    <div className="mx-auto flex flex-col items-center">
      <svg
        viewBox="0 0 280 210"
        className="h-52 w-auto transition-[opacity,filter] duration-300 ease-out motion-reduce:transition-none md:h-64"
        role="img"
        aria-label="Salchipapa de la casa"
        style={{
          opacity: encendida ? 1 : 0.14,
          filter: encendida ? 'none' : 'brightness(0.4) saturate(0.4)',
        }}
      >
        {/* Halo cálido pegado al plato. */}
        <ellipse
          cx="140"
          cy="150"
          rx="128"
          ry="46"
          fill="#F6D98A"
          className="transition-opacity duration-300 motion-reduce:transition-none"
          style={{ opacity: encendida ? 0.35 : 0 }}
        />

        {/* Plato hondo. */}
        <ellipse cx="140" cy="152" rx="112" ry="34" fill="#F4F1EA" />
        <ellipse cx="140" cy="147" rx="96" ry="27" fill="#E4DFD2" />

        {/* Papas a la francesa: bastones dorados en abanico. */}
        <g stroke="#B8862B" strokeWidth="1.2">
          <rect x="76" y="62" width="15" height="74" rx="5" fill="#F2C14E" transform="rotate(-18 84 99)" />
          <rect x="102" y="48" width="15" height="86" rx="5" fill="#F6D27A" transform="rotate(-8 110 91)" />
          <rect x="128" y="42" width="15" height="92" rx="5" fill="#F2C14E" />
          <rect x="154" y="48" width="15" height="86" rx="5" fill="#E8B23A" transform="rotate(8 162 91)" />
          <rect x="180" y="62" width="15" height="74" rx="5" fill="#F6D27A" transform="rotate(18 188 99)" />
          <rect x="92" y="84" width="14" height="58" rx="5" fill="#E8B23A" transform="rotate(-26 99 113)" />
          <rect x="172" y="84" width="14" height="58" rx="5" fill="#F2C14E" transform="rotate(26 179 113)" />
        </g>

        {/* Trozos de salchicha: rodajas con cara clara. */}
        <g stroke="#8A3B22" strokeWidth="1.2">
          <ellipse cx="104" cy="128" rx="17" ry="13" fill="#B65A38" />
          <ellipse cx="104" cy="125" rx="13" ry="9" fill="#D98A5F" />
          <ellipse cx="146" cy="136" rx="18" ry="13" fill="#A34D2E" />
          <ellipse cx="146" cy="133" rx="14" ry="9" fill="#D98A5F" />
          <ellipse cx="184" cy="127" rx="16" ry="12" fill="#B65A38" />
          <ellipse cx="184" cy="124" rx="12" ry="8" fill="#D98A5F" />
          <ellipse cx="124" cy="118" rx="13" ry="10" fill="#A34D2E" />
          <ellipse cx="124" cy="116" rx="10" ry="7" fill="#D98A5F" />
          <ellipse cx="166" cy="115" rx="12" ry="9" fill="#B65A38" />
          <ellipse cx="166" cy="113" rx="9" ry="6" fill="#D98A5F" />
        </g>

        {/* Salsas por encima: rosada y un hilo rojo. */}
        <path
          d="M86 120 q14 -12 30 -4 q16 8 32 -2 q16 -10 32 0 q14 8 28 2"
          fill="none"
          stroke="#F0A7B4"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.9"
        />
        <path
          d="M96 128 q16 -8 30 0 q16 8 32 0 q16 -8 30 0"
          fill="none"
          stroke="#D64533"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.85"
        />

        {/* Vapor sutil, solo con la luz encendida. */}
        <g
          className="transition-opacity duration-300 motion-reduce:transition-none"
          style={{ opacity: encendida ? 0.5 : 0 }}
          stroke="#F4EFE4"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        >
          <path d="M116 34 q6 -10 0 -20" />
          <path d="M142 28 q6 -10 0 -20" />
          <path d="M168 34 q6 -10 0 -20" />
        </g>
      </svg>

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
