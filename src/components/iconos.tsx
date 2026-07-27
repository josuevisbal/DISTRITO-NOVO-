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

/* ---------- Íconos del panel de administración ---------- */

export function IconoTablero(props: Props) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </Svg>
  )
}

export function IconoCampana(props: Props) {
  return (
    <Svg {...props}>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </Svg>
  )
}

export function IconoCarta(props: Props) {
  return (
    <Svg {...props}>
      <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </Svg>
  )
}

export function IconoPorcentaje(props: Props) {
  return (
    <Svg {...props}>
      <path d="m6 18 12-12" />
      <circle cx="7.5" cy="7.5" r="2.25" />
      <circle cx="16.5" cy="16.5" r="2.25" />
    </Svg>
  )
}

export function IconoPin(props: Props) {
  return (
    <Svg {...props}>
      <path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Svg>
  )
}

export function IconoCaja(props: Props) {
  return (
    <Svg {...props}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M3 11h18M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Svg>
  )
}

export function IconoEquipo(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8.5" r="3.25" />
      <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M15.5 5.8a3.25 3.25 0 0 1 0 5.4M17.5 14.9c1.8.8 3 2.4 3 4.6" />
    </Svg>
  )
}

export function IconoGrafica(props: Props) {
  return (
    <Svg {...props}>
      <path d="M4 4v16h16" />
      <path d="M8 16v-5M12 16V8M16 16v-8" />
    </Svg>
  )
}

export function IconoMenu(props: Props) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  )
}

export function IconoCerrar(props: Props) {
  return (
    <Svg {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Svg>
  )
}

export function IconoSalir(props: Props) {
  return (
    <Svg {...props}>
      <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
      <path d="m15 16 4-4-4-4M19 12H9" />
    </Svg>
  )
}

export function IconoSubir(props: Props) {
  return (
    <Svg {...props}>
      <path d="M4 17l5-5 3.5 3.5L20 8" />
      <path d="M14.5 8H20v5.5" />
    </Svg>
  )
}

export function IconoBajar(props: Props) {
  return (
    <Svg {...props}>
      <path d="M4 8l5 5 3.5-3.5L20 17" />
      <path d="M14.5 17H20v-5.5" />
    </Svg>
  )
}

export function IconoBillete(props: Props) {
  return (
    <Svg {...props}>
      <rect x="3" y="7" width="18" height="11" rx="2" />
      <circle cx="12" cy="12.5" r="2.5" />
      <path d="M6.5 10.5h.01M17.5 14.5h.01" />
    </Svg>
  )
}

export function IconoIntercambio(props: Props) {
  return (
    <Svg {...props}>
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </Svg>
  )
}

export function IconoTarjeta(props: Props) {
  return (
    <Svg {...props}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </Svg>
  )
}

export function IconoGlobo(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.6 2.4 2.6 14.6 0 17-2.6-2.4-2.6-14.6 0-17Z" />
    </Svg>
  )
}

export function IconoSol(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </Svg>
  )
}

export function IconoLuna(props: Props) {
  return (
    <Svg {...props}>
      <path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5Z" />
    </Svg>
  )
}

/** Llama, para la cabecera de la estación en el KDS. */
export function IconoFuego(props: Props) {
  return (
    <Svg {...props}>
      <path d="M12 3c1 3-3 4.5-3 8a3 3 0 0 0 6 0c0-1.5-.8-2.5-.8-2.5S17 10 17 13a5 5 0 0 1-10 0c0-4.5 4-6 5-10Z" />
    </Svg>
  )
}

/** Globo de nota, para las indicaciones del cliente en el ticket. */
export function IconoNota(props: Props) {
  return (
    <Svg {...props}>
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4V6Z" />
    </Svg>
  )
}

/** Rombo con trazos, adorno para encabezados de sección (estilo carta impresa). */
export function IconoFloritura({ className }: Props) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 48 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      className={className ?? 'h-3 w-12'}
    >
      <path d="M2 6h13" />
      <path d="M46 6H33" />
      <path d="M24 2.5 27.5 6 24 9.5 20.5 6 24 2.5Z" />
      <path d="M18 6l-2-1.6M18 6l-2 1.6M30 6l2-1.6M30 6l2 1.6" />
    </svg>
  )
}

/** Silla: pedidos de mesa (salón). */
export function IconoSilla(props: Props) {
  return (
    <Svg {...props}>
      <path d="M5 11V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5" />
      <path d="M5 11a2 2 0 0 1 2 2v2h10v-2a2 2 0 1 1 4 0v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Z" />
      <path d="M6 21v-2M18 21v-2" />
    </Svg>
  )
}

/** Tienda: pedidos de mostrador / para recoger. */
export function IconoTienda(props: Props) {
  return (
    <Svg {...props}>
      <path d="M3 21h18" />
      <path d="M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7H3l2-4h14l2 4" />
      <path d="M5 21V10.85M19 21V10.85" />
      <path d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" />
    </Svg>
  )
}

/** Cubiertos: los productos del pedido. */
export function IconoCubiertos(props: Props) {
  return (
    <Svg {...props}>
      <path d="M7 3v18" />
      <path d="M4 3v4a3 3 0 0 0 6 0V3" />
      <path d="M17 3a3 3 0 0 0-3 3v5h6V6a3 3 0 0 0-3-3Z" />
      <path d="M17 11v10" />
    </Svg>
  )
}

/** WhatsApp: escribirle al cliente. */
export function IconoWhatsApp(props: Props) {
  return (
    <Svg {...props}>
      <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
      <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
    </Svg>
  )
}

/** Impresora: la factura que se le entrega al cliente. */
export function IconoImprimir(props: Props) {
  return (
    <Svg {...props}>
      <path d="M7 9V4h10v5" />
      <path d="M7 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <rect x="7" y="14" width="10" height="7" rx="1" />
    </Svg>
  )
}

/** Teléfono: contacto del restaurante. */
export function IconoTelefono(props: Props) {
  return (
    <Svg {...props}>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z" />
    </Svg>
  )
}

/** Corazón: favoritos y "hecho con amor". */
export function IconoCorazon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M12 20.5 4.7 13a4.9 4.9 0 0 1 0-6.9 4.7 4.7 0 0 1 6.8 0l.5.6.5-.6a4.7 4.7 0 0 1 6.8 0 4.9 4.9 0 0 1 0 6.9Z" />
    </Svg>
  )
}

/** Ojo: monitoreo en vivo (vista de solo lectura). */
export function IconoOjo(props: Props) {
  return (
    <Svg {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  )
}

/** Estrella de cuatro puntas para acentos decorativos. */
export function IconoDestello({ className }: Props) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className ?? 'size-4'}
    >
      <path d="M12 2c.6 4.9 2.5 6.8 7.4 7.4C14.5 10 12.6 12 12 16.8 11.4 12 9.5 10 4.6 9.4 9.5 8.8 11.4 6.9 12 2Z" />
    </svg>
  )
}
