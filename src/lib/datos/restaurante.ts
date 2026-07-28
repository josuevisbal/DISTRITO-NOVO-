import { crearClienteServidor } from '@/lib/supabase/servidor'

/** Datos mínimos de marca para títulos y encabezados, sin traer toda la carta. */
export async function restaurantePorSlug(slug: string) {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('restaurantes')
    .select('id, nombre, slug, whatsapp, whatsapp_pedidos, llave_pago, cuenta_pago, logo_url')
    .eq('slug', slug)
    .eq('activo', true)
    .maybeSingle()
  return data
}
