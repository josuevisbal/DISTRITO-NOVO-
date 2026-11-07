import { horaDeCorte } from '@/lib/datos/jornada'
import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { mesActual, nombreDeMes, rangoDeMesISO } from '@/lib/zona-horaria'
import { AnuladosCliente, type Anulado } from './anulados-cliente'

export const dynamic = 'force-dynamic'

/**
 * Registro de pedidos anulados. Solo administración: la RLS no le deja ver un pedido
 * anulado a nadie más, así que caja, mesero y cocina no tienen cómo llegar aquí.
 */
export default async function PaginaAnulados({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()
  const corte = await horaDeCorte(staff.restaurante_id)

  const hoy = mesActual(corte)
  const { mes: mesParam } = await searchParams
  const [anio, mes] = (() => {
    const m = mesParam?.match(/^(\d{4})-(\d{1,2})$/)
    const me = m ? Number(m[2]) : 0
    return m && me >= 1 && me <= 12 ? [Number(m[1]), me] : [hoy.anio, hoy.mes]
  })()
  const rango = rangoDeMesISO(anio, mes, corte)

  const { data, error } = await supabase
    .from('pedidos')
    .select(
      'id, numero, creado_en, anulado_en, canal, medio_pago, total, cliente_nombre, cliente_tel, direccion, motivo_anulacion, mesas(numero), zonas_domicilio(nombre), anulador:usuarios!pedidos_anulado_por_fkey(nombre), pedido_items(nombre_snap, cantidad, precio_snap)',
    )
    .eq('restaurante_id', staff.restaurante_id)
    .eq('estado', 'anulado')
    .gte('creado_en', rango.desde)
    .lt('creado_en', rango.hasta)
    .order('creado_en', { ascending: false })

  const anulados: Anulado[] = (data ?? []).map((p) => ({
    id: p.id,
    numero: p.numero,
    creado_en: p.creado_en,
    anulado_en: p.anulado_en,
    canal: p.canal,
    medio_pago: p.medio_pago,
    total: p.total,
    cliente: p.cliente_nombre,
    telefono: p.cliente_tel,
    direccion: p.direccion,
    zona: p.zonas_domicilio?.nombre ?? null,
    mesa: p.mesas?.numero ?? null,
    motivo: p.motivo_anulacion,
    quien: p.anulador?.nombre ?? null,
    items: (p.pedido_items ?? []).map((i) => ({
      nombre: i.nombre_snap,
      cantidad: i.cantidad,
      precio: i.precio_snap,
    })),
  }))

  const meses: { valor: string; etiqueta: string }[] = []
  for (let i = 0, a = hoy.anio, m = hoy.mes; i < 6; i++) {
    meses.push({ valor: `${a}-${m}`, etiqueta: nombreDeMes(m) })
    m -= 1
    if (m === 0) {
      m = 12
      a -= 1
    }
  }

  return (
    <AnuladosCliente
      anulados={anulados}
      meses={meses}
      mesSeleccionado={`${anio}-${mes}`}
      error={error?.message ?? null}
    />
  )
}
