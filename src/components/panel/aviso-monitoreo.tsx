import { IconoOjo } from '@/components/iconos'

/**
 * Aviso sutil de las pantallas de monitoreo del panel: el admin observa, no opera.
 * Es un tablero de control para ver dónde va lento, no para intervenir a distancia.
 */
export function AvisoMonitoreo() {
  return (
    <p className="mb-4 flex items-center gap-2 rounded-lg border border-marca-borde bg-marca-superficie-tenue px-3 py-2 text-sm text-marca-texto-suave">
      <IconoOjo className="size-4 shrink-0" />
      Vista de monitoreo · solo lectura
    </p>
  )
}
