import { LOGO_URL } from '@/config/tema'

/**
 * Logo de la marca. Si hay archivo real configurado (LOGO_URL en config/tema.ts) se usa
 * ese; si no, se pinta esta recreación vectorial del logotipo de Distrito Novo: la D
 * grande, la banda dorada "-DISTRITO-" cruzándola y el óvalo con "Nv" abajo. Pensado
 * para fondo oscuro (trazos marfil + dorado de marca), sin fondo propio.
 */
export function LogoMarca({ className = 'h-20 w-auto' }: { className?: string }) {
  if (LOGO_URL) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={LOGO_URL} alt="Logo" className={className} />
  }

  return (
    <svg viewBox="0 0 200 232" className={className} role="img" aria-label="Distrito Novo">
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
