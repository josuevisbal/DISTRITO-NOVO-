import type { Metadata } from 'next'

import { obtenerTema, variablesTema } from '@/config/tema'
import { restaurantePorSlug } from '@/lib/datos/restaurante'

type Props = {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

/** El título sale del nombre en la base, nunca escrito en el código. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const restaurante = await restaurantePorSlug(slug)
  return {
    title: restaurante?.nombre ?? 'Carta',
    description: restaurante ? `Pide en ${restaurante.nombre}` : undefined,
  }
}

/**
 * Marco de toda la experiencia del comensal. Aquí es donde se cuelga el tema de la marca:
 * los componentes de adentro solo usan los tokens `--marca-*`, sin saber de qué cliente son.
 */
export default async function MarcoComensal({ children, params }: Props) {
  const { slug } = await params
  const tema = obtenerTema(slug)

  return (
    <div style={variablesTema(tema)} className="min-h-screen bg-marca-fondo text-marca-texto">
      {children}
    </div>
  )
}
