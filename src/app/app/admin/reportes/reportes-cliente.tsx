'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { IconoBillete, IconoBolsa, IconoEtiqueta, IconoGrafica, IconoReloj } from '@/components/iconos'
import { Segmentado } from '@/components/segmentado'
import { TarjetaKpi } from '@/components/ui/tarjeta-kpi'
import { Vacio } from '@/components/ui/vacio'
import { MARCA } from '@/config/tema'
import { formatearPesos } from '@/lib/formato'

export type ReporteMes = {
  total_ventas: number
  num_pedidos: number
  ticket_promedio: number
  por_dia: { dia: number; total: number }[]
  por_estacion: { nombre: string; color: string; total: number }[]
  top_productos: { nombre: string; cantidad: number; ventas: number }[]
}

type MesRef = { anio: number; mes: number; etiqueta: string }

type Props = {
  actual: ReporteMes
  anterior: ReporteMes | null
  mesSeleccionado: MesRef
  nombreMesAnterior: string
  meses: MesRef[]
  rentabilidad: ReactNode
}

export function ReportesCliente({
  actual,
  anterior,
  mesSeleccionado,
  nombreMesAnterior,
  meses,
  rentabilidad,
}: Props) {
  const router = useRouter()

  const totalEstaciones = Math.max(
    1,
    actual.por_estacion.reduce((s, e) => s + e.total, 0),
  )

  // Las barras crecen desde cero al montar; en pestañas ocultas saltan al ancho final.
  const [montado, setMontado] = useState(false)
  useEffect(() => {
    if (document.visibilityState === 'hidden') {
      setMontado(true)
      return
    }
    const id = requestAnimationFrame(() => setMontado(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-marca-texto-suave">Rendimiento del negocio</p>

        {/* Filtro por mes: control segmentado con indicador deslizante. */}
        <Segmentado
          opciones={meses.slice(0, 6).map((m) => ({
            valor: `${m.anio}-${m.mes}`,
            etiqueta: m.etiqueta.split(' ')[0],
          }))}
          valor={`${mesSeleccionado.anio}-${mesSeleccionado.mes}`}
          onCambiar={(v) => router.push(`/app/admin/reportes?mes=${v}`)}
        />
      </div>

      {/* KPIs con la tarjeta-indicador estándar y comparación vs mes anterior. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TarjetaKpi
          titulo="Ventas del mes"
          valor={actual.total_ventas}
          dinero
          color={MARCA.dorado}
          Icono={IconoBillete}
          variacion={{
            pct: variacionPct(actual.total_ventas, anterior?.total_ventas),
            contra: nombreMesAnterior,
          }}
          indice={0}
        />
        <TarjetaKpi
          titulo="Pedidos"
          valor={actual.num_pedidos}
          color="#5B6BF0"
          Icono={IconoBolsa}
          variacion={{
            pct: variacionPct(actual.num_pedidos, anterior?.num_pedidos),
            contra: nombreMesAnterior,
          }}
          indice={1}
        />
        <TarjetaKpi
          titulo="Ticket promedio"
          valor={actual.ticket_promedio}
          dinero
          color="#2E9E8F"
          Icono={IconoEtiqueta}
          variacion={{
            pct: variacionPct(actual.ticket_promedio, anterior?.ticket_promedio),
            contra: nombreMesAnterior,
          }}
          indice={2}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="tarjeta entra p-5" style={{ '--i': 3 } as CSSProperties}>
          <h2 className="mb-4 font-semibold text-marca-texto">
            Ventas por día · <span className="capitalize">{mesSeleccionado.etiqueta}</span>
          </h2>
          {actual.por_dia.length === 0 ? (
            <Vacio texto="Sin ventas en este mes." Icono={IconoGrafica} />
          ) : (
            <GraficaVentas datos={actual.por_dia} />
          )}
        </section>

        <section className="tarjeta entra p-5" style={{ '--i': 4 } as CSSProperties}>
          <h2 className="mb-4 font-semibold text-marca-texto">Por estación</h2>
          <ul className="space-y-4">
            {actual.por_estacion.map((e) => {
              const pct = Math.round((e.total / totalEstaciones) * 100)
              return (
                <li key={e.nombre}>
                  <div className="mb-1.5 flex items-baseline justify-between text-sm">
                    <span className="text-marca-texto">{e.nombre}</span>
                    <span className="font-semibold tabular-nums text-marca-texto">{pct}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-marca-superficie-tenue">
                    <div
                      className="h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
                      style={{ width: montado ? `${pct}%` : '0%', backgroundColor: e.color }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>

          <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-marca-texto-suave">
            Lo más vendido
          </h3>
          {actual.top_productos.length === 0 ? (
            <Vacio texto="Sin ventas aún." Icono={IconoReloj} />
          ) : (
            <ol className="space-y-1.5">
              {actual.top_productos.map((p, i) => (
                <li key={p.nombre} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-marca-texto">
                    <span className="mr-1.5 text-xs tabular-nums text-marca-texto-suave">
                      {i + 1}.
                    </span>
                    {p.nombre}
                  </span>
                  <span className="font-semibold tabular-nums text-marca-texto">{p.cantidad}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {rentabilidad}
    </div>
  )
}

/** Variación vs. mes anterior. Sin base de comparación (mes anterior en 0), no se inventa. */
function variacionPct(valor: number, previo: number | null | undefined): number | null {
  return previo && previo > 0 ? Math.round(((valor - previo) / previo) * 100) : null
}

function GraficaVentas({ datos }: { datos: { dia: number; total: number }[] }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
          <XAxis
            dataKey="dia"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'var(--marca-texto-suave)' }}
          />
          <YAxis hide domain={[0, 'dataMax']} />
          <Tooltip
            formatter={(v) => [formatearPesos(Number(v ?? 0)), 'Ventas']}
            labelFormatter={(d) => `Día ${d}`}
            contentStyle={{
              borderRadius: 10,
              border: '1px solid var(--marca-borde)',
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke="var(--marca-acento)"
            strokeWidth={2.5}
            dot={{ r: 2.5, fill: 'var(--marca-acento)' }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
