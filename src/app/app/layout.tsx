import { obtenerTema, variablesTema } from '@/config/tema'

/**
 * Marco del área interna. Como cada instancia atiende a un solo restaurante, el tema se toma
 * del base: los tokens `--marca-*` quedan disponibles para todas las pantallas de staff sin
 * quemar ningún slug.
 */
export default function MarcoApp({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={variablesTema(obtenerTema(''))}
      className="min-h-screen bg-marca-fondo text-marca-texto"
    >
      {children}
    </div>
  )
}
