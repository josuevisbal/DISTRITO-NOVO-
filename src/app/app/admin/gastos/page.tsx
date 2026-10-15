import { horaDeCorte } from '@/lib/datos/jornada'
import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { diaDeJornada, fechaISO, mesActual, nombreDeMes, zonaDelNegocio } from '@/lib/zona-horaria'
import { GastosCliente, type Gasto, type Resumen } from './gastos-cliente'

export const dynamic = 'force-dynamic'

/** Categorías sugeridas; se suman las que el negocio ya ha usado. */
const SUGERIDAS = [
  'Insumos',
  'Nómina',
  'Arriendo',
  'Servicios',
  'Domicilios',
  'Mantenimiento',
  'Publicidad',
  'Otros',
]

function primeroDe(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}-01`
}

export default async function PaginaGastos({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()
  // El mes se cuenta en días de trabajo: lo vendido a la 1 a. m. del 1 es del mes anterior.
  const corte = await horaDeCorte(staff.restaurante_id)

  const hoy = mesActual(corte)
  const { mes: mesParam } = await searchParams
  const [anio, mes] = (() => {
    const m = mesParam?.match(/^(\d{4})-(\d{1,2})$/)
    const me = m ? Number(m[2]) : 0
    return m && me >= 1 && me <= 12 ? [Number(m[1]), me] : [hoy.anio, hoy.mes]
  })()
  const siguiente = mes === 12 ? { a: anio + 1, m: 1 } : { a: anio, m: mes + 1 }
  const desde = primeroDe(anio, mes)
  const hasta = primeroDe(siguiente.a, siguiente.m)

  const [resumenRes, gastosRes, usadasRes] = await Promise.all([
    supabase.rpc('resumen_rentabilidad', { p_desde: desde, p_hasta: hasta, p_zona: zonaDelNegocio() }),
    supabase
      .from('gastos')
      .select('id, fecha, monto, categoria, descripcion')
      .eq('restaurante_id', staff.restaurante_id)
      .gte('fecha', desde)
      .lt('fecha', hasta)
      .order('fecha', { ascending: false })
      .order('creado_en', { ascending: false }),
    supabase.from('gastos').select('categoria').eq('restaurante_id', staff.restaurante_id).limit(500),
  ])

  const resumen = resumenRes.data as unknown as Resumen | null
  if (!resumen) {
    return (
      <p className="text-sm text-marca-texto-suave">
        No se pudo cargar la rentabilidad{resumenRes.error ? `: ${resumenRes.error.message}` : '.'}
      </p>
    )
  }

  const usadas = (usadasRes.data ?? []).map((g) => g.categoria)
  const categorias = [...new Set([...SUGERIDAS, ...usadas])]

  // Los últimos 6 meses de trabajo, para el filtro.
  const meses: { valor: string; etiqueta: string }[] = []
  for (let i = 0, a = hoy.anio, m = hoy.mes; i < 6; i++) {
    meses.push({ valor: `${a}-${m}`, etiqueta: nombreDeMes(m) })
    m -= 1
    if (m === 0) {
      m = 12
      a -= 1
    }
  }

  // El gasto nuevo cae por defecto en el día de trabajo en curso (si es el mes que se ve).
  const hoyISO = fechaISO(diaDeJornada(corte))
  const fechaPorDefecto = hoyISO >= desde && hoyISO < hasta ? hoyISO : desde

  return (
    <GastosCliente
      resumen={resumen}
      gastos={(gastosRes.data ?? []) as Gasto[]}
      categorias={categorias}
      meses={meses}
      mesSeleccionado={`${anio}-${mes}`}
      etiquetaMes={`${nombreDeMes(mes)} ${anio}`}
      fechaPorDefecto={fechaPorDefecto}
      rango={{ desde, hasta }}
    />
  )
}
