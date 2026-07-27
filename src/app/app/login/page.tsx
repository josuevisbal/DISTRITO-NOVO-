import { restaurantePorSlug } from '@/lib/datos/restaurante'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { LoginForm } from './login-form'

export const dynamic = 'force-dynamic'

/** Nombre y logo salen de la base: una instancia, un restaurante. */
async function marcaDelRestaurante(): Promise<{ nombre: string | null; logo: string | null }> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('restaurantes')
    .select('slug, logo_url')
    .eq('activo', true)
    .order('creado_en')
    .limit(1)
    .maybeSingle()
  if (!data) return { nombre: null, logo: null }
  const rest = await restaurantePorSlug(data.slug)
  return { nombre: rest?.nombre ?? null, logo: data.logo_url }
}

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string }>
}) {
  const { destino } = await searchParams
  const { nombre, logo } = await marcaDelRestaurante()

  return <LoginForm destino={destino ?? ''} nombre={nombre} logo={logo} />
}
