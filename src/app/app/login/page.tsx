import { restaurantePorSlug } from '@/lib/datos/restaurante'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { LoginForm } from './login-form'

export const dynamic = 'force-dynamic'

/** El nombre del restaurante sale de la base: una instancia, un restaurante. */
async function nombreRestaurante(): Promise<string | null> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('restaurantes')
    .select('slug')
    .eq('activo', true)
    .order('creado_en')
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const rest = await restaurantePorSlug(data.slug)
  return rest?.nombre ?? null
}

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string }>
}) {
  const { destino } = await searchParams
  const nombre = await nombreRestaurante()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <header className="mb-8 text-center">
        {nombre ? (
          <h1 className="font-titulo text-3xl font-bold text-marca-acento-fuerte">{nombre}</h1>
        ) : null}
        <p className="mt-1 text-sm text-marca-texto-suave">Acceso del equipo</p>
      </header>

      <LoginForm destino={destino ?? ''} />
    </main>
  )
}
