import type { Metadata } from 'next'

import { ProveedorToast } from '@/components/toast'
import { obtenerTema, variablesTema } from '@/config/tema'
import { crearClienteServidor } from '@/lib/supabase/servidor'

/**
 * Título del área del equipo: "App {restaurante}", para distinguirla en la pestaña del
 * menú del cliente ("Menú {restaurante}"). El nombre sale de la base, no del código.
 */
export async function generateMetadata(): Promise<Metadata> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('restaurantes')
    .select('nombre')
    .eq('activo', true)
    .order('creado_en')
    .limit(1)
    .maybeSingle()

  return { title: data ? `App ${data.nombre}` : 'App del equipo' }
}

/**
 * Marco del área interna. Como cada instancia atiende a un solo restaurante, el tema se toma
 * del base: los tokens `--marca-*` quedan disponibles para todas las pantallas de staff sin
 * quemar ningún slug. Envuelve todo con el proveedor de toasts para el feedback de acción.
 */
export default function MarcoApp({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={variablesTema(obtenerTema(''))}
      className="min-h-screen bg-marca-fondo text-marca-texto"
    >
      <ProveedorToast>{children}</ProveedorToast>
    </div>
  )
}
