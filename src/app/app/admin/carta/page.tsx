import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { CartaAdmin, type CategoriaAdmin } from './carta-admin'

export const dynamic = 'force-dynamic'

export default async function PaginaAdminCarta() {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()

  const [{ data: categorias }, { data: productos }, { data: estaciones }] = await Promise.all([
    supabase
      .from('categorias')
      .select('id, nombre')
      .eq('restaurante_id', staff.restaurante_id)
      .eq('activa', true)
      .order('orden'),
    supabase
      .from('productos')
      .select('id, nombre, precio, foto_url, destacado, disponible, categoria_id, estacion_id')
      .eq('restaurante_id', staff.restaurante_id)
      .eq('activo', true)
      .order('orden'),
    supabase
      .from('estaciones')
      .select('id, color')
      .eq('restaurante_id', staff.restaurante_id),
  ])

  const colorEstacion = new Map((estaciones ?? []).map((e) => [e.id, e.color]))

  const grupos: CategoriaAdmin[] = (categorias ?? [])
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      productos: (productos ?? [])
        .filter((p) => p.categoria_id === c.id)
        .map((p) => ({
          id: p.id,
          nombre: p.nombre,
          precio: p.precio,
          foto_url: p.foto_url,
          destacado: p.destacado,
          disponible: p.disponible,
          color_estacion: colorEstacion.get(p.estacion_id) ?? '#888888',
        })),
    }))
    .filter((c) => c.productos.length > 0)

  return (
    <>
      <p className="text-sm text-marca-texto-suave">
        Sube una foto por plato, márcalo como POPULAR o agótalo. La foto se ve al instante en
        la carta del cliente.
      </p>
      <CartaAdmin categorias={grupos} />
    </>
  )
}
