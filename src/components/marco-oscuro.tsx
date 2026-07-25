import { obtenerTemaOperacion, variablesTema } from '@/config/tema'

/**
 * Envoltorio de las pantallas de operación de pie (cocina, domiciliario): aplica el tema
 * oscuro por tokens encima del tema claro del área interna. Los componentes de adentro
 * siguen usando solo `--marca-*`.
 */
export function MarcoOscuro({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={variablesTema(obtenerTemaOperacion())}
      className="min-h-screen bg-marca-fondo text-marca-texto"
    >
      {children}
    </div>
  )
}
