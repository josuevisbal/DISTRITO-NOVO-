import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { PromosAdmin, type ProductoOpcion, type PromoAdmin } from './promos-admin'

export const dynamic = 'force-dynamic'

export default async function PaginaAdminPromos() {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()

  const [{ data: promos }, { data: productos }] = await Promise.all([
    supabase
      .from('promociones')
      .select(
        'id, tipo, etiqueta, titulo, descripcion, monto_minimo, precio_combo, imagen_url, activa, promocion_items(producto_id, cantidad)',
      )
      .eq('restaurante_id', staff.restaurante_id)
      .order('orden'),
    supabase
      .from('productos')
      .select('id, nombre, precio')
      .eq('restaurante_id', staff.restaurante_id)
      .eq('activo', true)
      .order('nombre'),
  ])

  const lista: PromoAdmin[] = (promos ?? []).map((p) => ({
    id: p.id,
    tipo: p.tipo,
    etiqueta: p.etiqueta,
    titulo: p.titulo,
    descripcion: p.descripcion,
    monto_minimo: p.monto_minimo,
    precio_combo: p.precio_combo,
    imagen_url: p.imagen_url,
    activa: p.activa,
    items: (p.promocion_items ?? []).map((i) => ({
      producto_id: i.producto_id,
      cantidad: i.cantidad,
    })),
  }))

  return (
    <>
      <p className="text-sm text-marca-texto-suave">
        Las promociones se aplican de verdad: el domicilio gratis pone el envío en $0 y los
        combos se cobran al precio especial. Aparecen arriba en la carta del cliente.
      </p>
      <PromosAdmin promos={lista} productos={(productos ?? []) as ProductoOpcion[]} />
    </>
  )
}
