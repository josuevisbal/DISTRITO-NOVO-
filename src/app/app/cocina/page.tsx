import { redirect } from 'next/navigation'
import Link from 'next/link'

import { BarraStaff } from '@/components/barra-staff'
import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'

export const dynamic = 'force-dynamic'

/**
 * Elige estación. Si el usuario es de cocina y ya tiene su estación asignada, salta directo
 * a su tablero: en la práctica cada tablet está fija en una estación.
 */
export default async function PaginaCocina() {
  const staff = await exigirRol('cocina', 'admin', 'pase')
  const supabase = await crearClienteServidor()

  const { data: estaciones } = await supabase
    .from('estaciones')
    .select('slug, nombre, color')
    .eq('restaurante_id', staff.restaurante_id)
    .eq('activa', true)
    .order('orden')

  if (staff.rol === 'cocina' && staff.estacion_id) {
    const propia = await supabase
      .from('estaciones')
      .select('slug')
      .eq('id', staff.estacion_id)
      .maybeSingle()
    if (propia.data) redirect(`/app/cocina/${propia.data.slug}`)
  }

  return (
    <>
      <BarraStaff staff={staff} titulo="Cocina" />
      <main className="mx-auto max-w-2xl p-4">
        <p className="mb-4 text-sm text-marca-texto-suave">Escoge la estación de esta pantalla:</p>
        <ul className="grid gap-3 sm:grid-cols-3">
          {(estaciones ?? []).map((e) => (
            <li key={e.slug}>
              <Link
                href={`/app/cocina/${e.slug}`}
                className="flex min-h-24 flex-col justify-between rounded-xl border-2 p-4"
                style={{ borderColor: e.color }}
              >
                <span
                  aria-hidden
                  className="size-3 rounded-full"
                  style={{ backgroundColor: e.color }}
                />
                <span className="font-titulo text-lg text-marca-texto">{e.nombre}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  )
}
