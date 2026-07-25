import { PanelArmazon } from '@/components/panel/panel-armazon'
import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'

/**
 * Todas las rutas /app/admin/* viven dentro del armazón del panel: barra lateral fija,
 * encabezado con el módulo y el usuario, y transición al navegar. La guarda de rol vive
 * aquí una sola vez (el dueño pasa siempre; cada página puede endurecer más si lo necesita).
 */
export default async function MarcoPanel({ children }: { children: React.ReactNode }) {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()

  const { data: restaurante } = await supabase
    .from('restaurantes')
    .select('nombre')
    .eq('id', staff.restaurante_id)
    .maybeSingle()

  return (
    <PanelArmazon staff={staff} nombreRestaurante={restaurante?.nombre ?? 'Panel'}>
      {children}
    </PanelArmazon>
  )
}
