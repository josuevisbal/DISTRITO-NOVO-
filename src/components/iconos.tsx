/**
 * Íconos SVG del sistema. Nunca emojis: no escalan, no se leen igual en cada dispositivo y
 * los lectores de pantalla los cantan como texto.
 *
 * Todos heredan `currentColor` y traen `aria-hidden`: el significado lo pone el texto que
 * los acompaña, nunca el ícono solo.
 */
type Props = { className?: string }

const base = 'size-5 shrink-0'

function Svg({ className, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? base}
    >
      {children}
    </svg>
  )
}

export function IconoMas(props: Props) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

export function IconoMenos(props: Props) {
  return (
    <Svg {...props}>
      <path d="M5 12h14" />
    </Svg>
  )
}

export function IconoBolsa(props: Props) {
  return (
    <Svg {...props}>
      <path d="M6 7h12l-1 13H7L6 7Z" />
      <path d="M9 7V5a3 3 0 0 1 6 0v2" />
    </Svg>
  )
}

export function IconoCheck(props: Props) {
  return (
    <Svg {...props}>
      <path d="m5 13 4 4L19 7" />
    </Svg>
  )
}

export function IconoAtras(props: Props) {
  return (
    <Svg {...props}>
      <path d="M15 5l-7 7 7 7" />
    </Svg>
  )
}

export function IconoCopiar(props: Props) {
  return (
    <Svg {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </Svg>
  )
}

export function IconoReloj(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </Svg>
  )
}

export function IconoAlerta(props: Props) {
  return (
    <Svg {...props}>
      <path d="M12 4 3 19h18L12 4Z" />
      <path d="M12 10v4M12 17h.01" />
    </Svg>
  )
}

export function IconoEtiqueta(props: Props) {
  return (
    <Svg {...props}>
      <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9Z" />
      <circle cx="7.5" cy="7.5" r="1.25" />
    </Svg>
  )
}

export function IconoMoto(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="5.5" cy="17" r="3" />
      <circle cx="18.5" cy="17" r="3" />
      <path d="M8.5 17h7l-4-8H8m6 0h3l1.5 8" />
    </Svg>
  )
}
