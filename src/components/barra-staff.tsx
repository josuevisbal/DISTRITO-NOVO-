import { cerrarSesion } from '@/app/app/login/acciones'
import type { Staff } from '@/lib/sesion'

const NOMBRE_ROL: Record<Staff['rol'], string> = {
  admin: 'Administración',
  cajero: 'Caja',
  mesero: 'Mesero',
  cocina: 'Cocina',
  pase: 'Pase',
  domiciliario: 'Domiciliario',
}

/** Barra superior del área interna: quién eres y el botón de salir. */
export function BarraStaff({ staff, titulo }: { staff: Staff; titulo: string }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-marca-borde bg-marca-fondo/95 px-4 py-3 backdrop-blur">
      <div className="min-w-0">
        <h1 className="truncate font-titulo text-lg text-marca-texto">{titulo}</h1>
        <p className="truncate text-xs text-marca-texto-suave">
          {staff.nombre} · {NOMBRE_ROL[staff.rol]}
        </p>
      </div>

      <form action={cerrarSesion}>
        <button
          type="submit"
          className="min-h-11 shrink-0 rounded-lg border border-marca-borde px-3 text-sm text-marca-texto"
        >
          Salir
        </button>
      </form>
    </header>
  )
}
