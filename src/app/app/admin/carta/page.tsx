import { PestanasModulo } from '@/components/panel/pestanas-modulo'
import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { CartaAdmin, type CategoriaAdmin } from './carta-admin'

export const dynamic = 'force-dynamic'

/** Las dos caras del Menú Digital: lo que se pide y lo que se ve al entrar. */
export const PESTANAS_MENU = [
  { href: '/app/admin/carta', etiqueta: 'Carta' },
  { href: '/app/admin/estaciones', etiqueta: 'Cocinas' },
  { href: '/app/admin/inicio', etiqueta: 'Página de inicio' },
]

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
      .select('id, nombre, descripcion, precio, minutos_prep, foto_url, destacado, disponible, categoria_id, estacion_id')
      .eq('restaurante_id', staff.restaurante_id)
      .eq('activo', true)
      .order('orden'),
    supabase
      .from('estaciones')
      .select('id, nombre, color')
      .eq('activa', true)
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
          descripcion: p.descripcion,
          precio: p.precio,
          minutos_prep: p.minutos_prep,
          foto_url: p.foto_url,
          destacado: p.destacado,
          disponible: p.disponible,
          categoria_id: p.categoria_id,
          estacion_id: p.estacion_id,
          color_estacion: colorEstacion.get(p.estacion_id) ?? '#888888',
        })),
    }))


  return (
    <div className="space-y-4">
      <PestanasModulo opciones={PESTANAS_MENU} activa="/app/admin/carta" />
      <p className="text-sm text-marca-texto-suave">
        Agrega platos, cambia precios y decide en qué cocina se preparan. Sube una foto,
        márcalo como POPULAR o agótalo: se ve al instante en la carta del cliente.
      </p>
      <CartaAdmin
        categorias={grupos}
        estaciones={(estaciones ?? []).map((e) => ({ id: e.id, nombre: e.nombre }))}
      />
    </div>
  )
}
