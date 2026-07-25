import { BarraStaff } from '@/components/barra-staff'
import { NavAdmin } from '@/components/nav-admin'
import { exigirRol } from '@/lib/sesion'
import { formatearPesos } from '@/lib/formato'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { Rentabilidad, type DatosRentabilidad } from './rentabilidad'

export const dynamic = 'force-dynamic'

const NOMBRE_CANAL: Record<string, string> = {
  mesa: 'Mesa',
  domicilio: 'Domicilio',
  recoger: 'Para recoger',
  whatsapp: 'WhatsApp',
  mostrador: 'Mostrador',
}

type Reporte = {
  dias: number
  total_ventas: number
  num_pedidos: number
  ticket_promedio: number
  por_canal: { canal: string; total: number; n: number }[]
  por_hora: { hora: number; total: number }[]
  top_productos: { nombre: string; cantidad: number }[]
  tiempos_estacion: { estacion: string; minutos: number }[]
}

export default async function PaginaReportes() {
  const staff = await exigirRol('admin')
  const supabase = await crearClienteServidor()
  const { data } = await supabase.rpc('reporte_ventas', { p_dias: 30 })
  const r = data as unknown as Reporte

  // Rentabilidad: SOLO el dueño. Para cualquier otro rol ni se consulta;
  // y aunque llamaran la función a mano, la base los rechaza.
  let rentabilidad: DatosRentabilidad | null = null
  if (staff.rol === 'dueno') {
    const { data: rent } = await supabase.rpc('reporte_rentabilidad', { p_dias: 30 })
    rentabilidad = rent as unknown as DatosRentabilidad
  }

  return (
    <>
      <BarraStaff staff={staff} titulo="Reportes" />
      <NavAdmin />

      <main className="mx-auto max-w-3xl space-y-8 p-4 pb-16">
        <p className="text-sm text-marca-texto-suave">Últimos {r.dias} días.</p>

        {rentabilidad ? <Rentabilidad datos={rentabilidad} /> : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Kpi titulo="Ventas" valor={formatearPesos(r.total_ventas)} />
          <Kpi titulo="Pedidos" valor={String(r.num_pedidos)} />
          <Kpi titulo="Ticket promedio" valor={formatearPesos(r.ticket_promedio)} />
        </div>

        <Panel titulo="Ventas por canal">
          {r.por_canal.length === 0 ? (
            <Vacio />
          ) : (
            <Barras
              filas={r.por_canal.map((c) => ({
                etiqueta: `${NOMBRE_CANAL[c.canal] ?? c.canal} · ${c.n}`,
                valor: c.total,
                texto: formatearPesos(c.total),
              }))}
            />
          )}
        </Panel>

        <Panel titulo="Ventas por hora">
          {r.por_hora.length === 0 ? (
            <Vacio />
          ) : (
            <Barras
              filas={r.por_hora.map((h) => ({
                etiqueta: `${String(h.hora).padStart(2, '0')}:00`,
                valor: h.total,
                texto: formatearPesos(h.total),
              }))}
            />
          )}
        </Panel>

        <Panel titulo="Productos más vendidos">
          {r.top_productos.length === 0 ? (
            <Vacio />
          ) : (
            <Barras
              filas={r.top_productos.map((p) => ({
                etiqueta: p.nombre,
                valor: p.cantidad,
                texto: `${p.cantidad}`,
              }))}
            />
          )}
        </Panel>

        <Panel titulo="Tiempo promedio por estación">
          {r.tiempos_estacion.length === 0 ? (
            <Vacio texto="Aún no hay comandas cronometradas." />
          ) : (
            <ul className="space-y-2">
              {r.tiempos_estacion.map((t) => (
                <li key={t.estacion} className="flex items-center justify-between text-sm">
                  <span className="text-marca-texto">{t.estacion}</span>
                  <span className="font-medium tabular-nums text-marca-acento-fuerte">
                    {t.minutos} min
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </main>
    </>
  )
}

function Kpi({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="entra rounded-xl border border-marca-borde bg-marca-superficie p-4">
      <p className="text-sm text-marca-texto-suave">{titulo}</p>
      <p className="mt-1 font-titulo text-2xl font-bold text-marca-texto">{valor}</p>
    </div>
  )
}

function Panel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-marca-borde bg-marca-superficie p-4">
      <h2 className="mb-3 font-titulo text-lg text-marca-texto">{titulo}</h2>
      {children}
    </section>
  )
}

function Barras({ filas }: { filas: { etiqueta: string; valor: number; texto: string }[] }) {
  const max = Math.max(1, ...filas.map((f) => f.valor))
  return (
    <ul className="space-y-2">
      {filas.map((f, i) => (
        <li key={i} className="grid grid-cols-[9rem_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-marca-texto-suave">{f.etiqueta}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-marca-superficie-tenue">
            <span
              className="block h-full rounded-full bg-marca-acento"
              style={{ width: `${(f.valor / max) * 100}%` }}
            />
          </span>
          <span className="tabular-nums text-marca-texto">{f.texto}</span>
        </li>
      ))}
    </ul>
  )
}

function Vacio({ texto = 'Sin datos en el periodo.' }: { texto?: string }) {
  return <p className="text-sm text-marca-texto-suave">{texto}</p>
}
