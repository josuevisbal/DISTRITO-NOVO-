import { notFound, redirect } from 'next/navigation'

import { crearClienteServidor } from '@/lib/supabase/servidor'

export const dynamic = 'force-dynamic'

/**
 * Cada instancia atiende a un restaurante, pero todo se resuelve por `slug`. La raíz manda
 * al primer restaurante activo: así no hay que quemar ningún slug en el código.
 */
export default async function Inicio() {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('restaurantes')
    .select('slug')
    .eq('activo', true)
    .order('creado_en')
    .limit(1)
    .maybeSingle()

  if (!data) notFound()
  redirect(`/${data.slug}`)
}
