/**
 * Encabezado estándar de módulo: título (o contexto) + subtítulo a la izquierda,
 * acción principal a la derecha. Igual en todos los módulos del panel.
 */
export function EncabezadoModulo({
  titulo,
  sub,
  accion,
}: {
  titulo: React.ReactNode
  sub?: React.ReactNode
  accion?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="font-medium text-marca-texto">{titulo}</div>
        {sub ? <div className="mt-0.5 text-sm text-marca-texto-suave">{sub}</div> : null}
      </div>
      {accion ? <div className="shrink-0">{accion}</div> : null}
    </div>
  )
}
