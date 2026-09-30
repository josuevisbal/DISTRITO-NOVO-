import { IconoAlerta } from '@/components/iconos'

/**
 * Aviso de las pantallas de operación dentro del panel: administración ve lo mismo que
 * el equipo y puede actuar. Recuerda que lo que toque aquí pasa de verdad.
 */
export function AvisoMonitoreo() {
  return (
    <p className="mb-4 flex items-center gap-2 rounded-lg border border-marca-borde bg-marca-superficie-tenue px-3 py-2 text-sm text-marca-texto-suave">
      <IconoAlerta className="size-4 shrink-0" />
      Operación en vivo · lo que hagas aquí queda hecho igual que si lo hiciera el equipo
    </p>
  )
}
