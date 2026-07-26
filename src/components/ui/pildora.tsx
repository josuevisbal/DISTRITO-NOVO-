/**
 * Píldora de estado estándar: fondo del color en versión suave + texto del mismo tono
 * oscuro (contraste ≥ 4.5) + puntico opcional. Los tonos tienen SIGNIFICADO fijo en
 * toda la app — no son decorativos:
 *
 *  verde → ok / listo / cobrado · ámbar → pendiente / por verificar · rojo → agotado /
 *  atrasado / error · azul → en proceso / pagado · gris → inactivo.
 *
 * `.pastilla` le da la transición suave al cambiar de estado.
 */
export type TonoPildora = 'verde' | 'ambar' | 'rojo' | 'azul' | 'gris'

const TONOS: Record<TonoPildora, { fondo: string; texto: string; punto: string }> = {
  verde: { fondo: '#E7F6EE', texto: '#116B47', punto: '#1E9E6A' },
  ambar: { fondo: '#FBF1D4', texto: '#7A5A0F', punto: '#D99A06' },
  rojo: { fondo: '#FBE6DE', texto: '#9A3320', punto: '#D64533' },
  azul: { fondo: '#E5E9FC', texto: '#33418F', punto: '#5B6BF0' },
  gris: { fondo: 'var(--marca-superficie-tenue)', texto: 'var(--marca-texto-suave)', punto: 'var(--marca-borde)' },
}

export function Pildora({
  tono,
  children,
  punto = true,
  className = '',
}: {
  tono: TonoPildora
  children: React.ReactNode
  /** Puntico de color al inicio; apágalo si la píldora ya trae ícono propio. */
  punto?: boolean
  className?: string
}) {
  const t = TONOS[tono]
  return (
    <span
      className={`pastilla entra-pastilla inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}
      style={{ backgroundColor: t.fondo, color: t.texto }}
    >
      {punto ? (
        <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: t.punto }} />
      ) : null}
      {children}
    </span>
  )
}
