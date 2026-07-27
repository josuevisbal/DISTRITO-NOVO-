import { restaurantePorSlug } from '@/lib/datos/restaurante'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { LoginForm } from './login-form'

export const dynamic = 'force-dynamic'

/** Nombre y logo salen de la base: una instancia, un restaurante. */
async function marcaDelRestaurante(): Promise<{
  nombre: string | null
  logo: string | null
  foto: string | null
}> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('restaurantes')
    .select('slug, logo_url, portada_url')
    .eq('activo', true)
    .order('creado_en')
    .limit(1)
    .maybeSingle()
  if (!data) return { nombre: null, logo: null, foto: null }
  const rest = await restaurantePorSlug(data.slug)
  // La escena usa la misma foto del héroe que el dueño subió en el panel.
  return { nombre: rest?.nombre ?? null, logo: data.logo_url, foto: data.portada_url }
}

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string }>
}) {
  const { destino } = await searchParams
  const { nombre, logo, foto } = await marcaDelRestaurante()

  return <LoginForm destino={destino ?? ''} nombre={nombre} logo={logo} foto={foto} />
}
