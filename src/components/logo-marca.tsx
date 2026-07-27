'use client'

import { useState } from 'react'

import { LOGO_URL } from '@/config/tema'

/**
 * Logo de la marca. Con LOGO_URL configurado (config/tema.ts) muestra la imagen real
 * dentro de un marco circular dorado que se degrada, con una viñeta interior que funde
 * la foto con el fondo oscuro — así sirve incluso la foto del logo en la pared, sin
 * necesitar fondo transparente. Si el archivo no existe (o falla), cae sola a la
 * recreación vectorial del logotipo (la D, la banda -DISTRITO- y el óvalo Nv).
 *
 * `className` controla el tamaño: usa cuadrados (size-12, size-24…) para el circular.
 */
export function LogoMarca({ className = 'size-20' }: { className?: string }) {
  const [fallo, setFallo] = useState(false)

  if (LOGO_URL && !fallo) {
    return (
      <span
        className={`relative inline-block shrink-0 rounded-full p-[3px] ${className}`}
        style={{
          background:
            'conic-gradient(from 210deg, #D4A64A, #F0A93C 25%, rgba(212,166,74,0.12) 55%, #B8862B 80%, #D4A64A)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO_URL}
          alt="Logo"
          onError={() => setFallo(true)}
          className="size-full rounded-full object-cover"
        />
        {/* Viñeta: el borde de la foto se degrada hacia el fondo oscuro. */}
        <span
          aria-hidden
          className="absolute inset-[3px] rounded-full"
          style={{ boxShadow: 'inset 0 0 26px 12px rgba(11,11,12,0.55)' }}
        />
      </span>
    )
  }

  return (
    <svg viewBox="0 0 200 232" className={className} role="img" aria-label="Logo">
      {/* La D grande, en serif de la marca. */}
      <text
        x="100"
        y="120"
        textAnchor="middle"
        fontFamily="var(--fuente-titulo), Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fontSize="148"
        fill="#F3E3B2"
      >
        D
      </text>

      {/* Banda dorada cruzando la D. El trazo oscuro la separa de la letra. */}
      <text
        x="100"
        y="88"
        textAnchor="middle"
        fontFamily="var(--fuente-titulo), Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fontSize="23"
        letterSpacing="2.5"
        fill="#D4A64A"
        stroke="#0B0B0C"
        strokeWidth="7"
        paintOrder="stroke"
      >
        -DISTRITO-
      </text>

      {/* Óvalo con el "Nv", montado sobre la base de la D. */}
      <ellipse cx="100" cy="176" rx="58" ry="38" fill="none" stroke="#F3E3B2" strokeWidth="6" />
      <text
        x="94"
        y="190"
        textAnchor="middle"
        fontFamily="var(--fuente-titulo), Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fontSize="54"
        fill="#F3E3B2"
      >
        N
      </text>
      <text
        x="130"
        y="194"
        textAnchor="middle"
        fontFamily="var(--fuente-titulo), Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fontSize="28"
        fill="#F3E3B2"
      >
        v
      </text>
    </svg>
  )
}
