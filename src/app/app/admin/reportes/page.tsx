import { exigirRol } from '@/lib/sesion'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { mesActual, nombreDeMes, rangoDeMesISO, zonaDelNegocio } from '@/lib/zona-horaria'
import { Rentabilidad, type DatosRentabilidad } from './rentabilidad'
import { ReportesCliente, type ReporteMes } from './reportes-cliente'

export const dynamic = 'force-dynamic'

/** Meses navegables: el actual y los 11 anteriores. */
function mesesDisponibles(anio: number, mes: number) {
  const lista: { anio: number; mes: number; etiqueta: string }[] = []
  let a = anio
  let m = mes
  for (let i = 0; i < 12; i++) {
    lista.push({ anio: a, mes: m, etiqueta: `${nombreDeMes(m)} ${a}` })
    m -= 1
    if (m === 0) {
      m = 12
      a -= 1
    }
  }
  return lista
}

export default async function PaginaReportes({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()

  const hoy = mesActual()
  const { mes: mesParam } = await searchParams
  const [anioSel, mesSel] = (() => {
    const m = mesParam?.match(/^(\d{4})-(\d{1,2})$/)
    if (!m) return [hoy.anio, hoy.mes]
    const a = Number(m[1])
    const me = Number(m[2])
    return me >= 1 && me <= 12 ? [a, me] : [hoy.anio, hoy.mes]
  })()

  // Mes elegido y mes anterior, para las variaciones (+12 %, -3 %).
  const rango = rangoDeMesISO(anioSel, mesSel)
  const prev = mesSel === 1 ? { anio: anioSel - 1, mes: 12 } : { anio: anioSel, mes: mesSel - 1 }
  const rangoPrev = rangoDeMesISO(prev.anio, prev.mes)
  const zona = zonaDelNegocio()

  const [actualRes, anteriorRes] = await Promise.all([
    supabase.rpc('reporte_rango', { p_desde: rango.desde, p_hasta: rango.hasta, p_zona: zona }),
    supabase.rpc('reporte_rango', {
      p_desde: rangoPrev.desde,
      p_hasta: rangoPrev.hasta,
      p_zona: zona,
    }),
  ])

  const actual = actualRes.data as unknown as ReporteMes | null
  const anterior = anteriorRes.data as unknown as ReporteMes | null

  if (!actual) {
    return (
      <p className="text-sm text-marca-texto-suave">
        No se pudo cargar el reporte{actualRes.error ? `: ${actualRes.error.message}` : '.'}
      </p>
    )
  }

  // Rentabilidad: SOLO el dueño. Para cualquier otro rol ni se consulta;
  // y aunque llamaran la función a mano, la base los rechaza.
  let rentabilidad: DatosRentabilidad | null = null
  if (staff.rol === 'dueno') {
    const { data: rent } = await supabase.rpc('reporte_rentabilidad', { p_dias: 30 })
    rentabilidad = (rent as unknown as DatosRentabilidad) ?? null
  }

  return (
    <ReportesCliente
      actual={actual}
      anterior={anterior}
      mesSeleccionado={{ anio: anioSel, mes: mesSel, etiqueta: `${nombreDeMes(mesSel)} ${anioSel}` }}
      nombreMesAnterior={nombreDeMes(prev.mes)}
      meses={mesesDisponibles(hoy.anio, hoy.mes)}
      rentabilidad={rentabilidad ? <Rentabilidad datos={rentabilidad} /> : null}
    />
  )
}
