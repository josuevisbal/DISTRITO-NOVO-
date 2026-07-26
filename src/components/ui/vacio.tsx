/**
 * Sección vacía estándar: una línea discreta con ícono tenue, nunca un bloque gris
 * enorme. La usan todos los módulos cuando no hay datos que mostrar.
 */
export function Vacio({
  texto,
  Icono,
  className = '',
}: {
  texto: string
  Icono?: (p: { className?: string }) => React.ReactNode
  className?: string
}) {
  return (
    <p
      className={`flex items-center justify-center gap-2 rounded-xl border border-dashed border-marca-borde px-4 py-5 text-sm text-marca-texto-suave ${className}`}
    >
      {Icono ? <Icono className="size-4 shrink-0 opacity-60" /> : null}
      {texto}
    </p>
  )
}
