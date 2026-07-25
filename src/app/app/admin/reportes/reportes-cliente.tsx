'use client'

import { useRouter } from 'next/navigation'
import { type CSSProperties, type ReactNode } from 'react'
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { IconoSubir, IconoBajar } from '@/components/iconos'
import { formatearPesos } from '@/lib/formato'
import { useConteo } from '@/lib/use-conteo'

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-marca-texto-suave">Rendimiento del negocio</p>

        {/* Filtro por mes: chips de los últimos meses. */}
        <div className="flex max-w-full gap-1.5 overflow-x-auto rounded-xl border border-marca-borde bg-marca-superficie p-1">
          {meses.slice(0, 6).map((m) => {
            const activo = m.anio === mesSeleccionado.anio && m.mes === mesSeleccionado.mes
            return (
              <button
                key={`${m.anio}-${m.mes}`}
                type="button"
                onClick={() => router.push(`/app/admin/reportes?mes=${m.anio}-${m.mes}`)}
                aria-pressed={activo}
                className={`min-h-10 shrink-0 rounded-lg px-3 text-sm capitalize transition-colors ${
                  activo
                    ? 'bg-marca-acento font-semibold text-marca-acento-texto'
                    : 'text-marca-texto-suave hover:text-marca-texto'
                }`}
              >
                {m.etiqueta.split(' ')[0]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi
          titulo="Ventas del mes"
          valor={actual.total_ventas}
          previo={anterior?.total_ventas ?? null}
          dinero
          nombreMesAnterior={nombreMesAnterior}
          indice={0}
        />
        <Kpi
          titulo="Pedidos"
          valor={actual.num_pedidos}
          previo={anterior?.num_pedidos ?? null}
          nombreMesAnterior={nombreMesAnterior}
          indice={1}
        />
        <Kpi
          titulo="Ticket promedio"
          valor={actual.ticket_promedio}
          previo={anterior?.ticket_promedio ?? null}
          dinero
          nombreMesAnterior={nombreMesAnterior}
          indice={2}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="tarjeta entra p-5" style={{ '--i': 3 } as CSSProperties}>
          <h2 className="mb-4 font-semibold text-marca-texto">
            Ventas por día · <span className="capitalize">{mesSeleccionado.etiqueta}</span>
          </h2>
          {actual.por_dia.length === 0 ? (
            <p className="text-sm text-marca-texto-suave">Sin ventas en este mes.</p>
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
                      style={{ width: `${pct}%`, backgroundColor: e.color }}
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
            <p className="text-sm text-marca-texto-suave">Sin ventas aún.</p>
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

function Kpi({
  titulo,
  valor,
  previo,
  dinero = false,
  nombreMesAnterior,
  indice,
}: {
  titulo: string
  valor: number
  previo: number | null
  dinero?: boolean
  nombreMesAnterior: string
  indice: number
}) {
  const animado = useConteo(valor)

  // Variación vs. mes anterior. Sin base de comparación (mes anterior en 0), no se inventa.
  const variacion = previo && previo > 0 ? Math.round(((valor - previo) / previo) * 100) : null
  const sube = variacion !== null && variacion >= 0

  return (
    <div className="tarjeta tarjeta-hover entra p-4" style={{ '--i': indice } as CSSProperties}>
      <p className="text-sm text-marca-texto-suave">{titulo}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-marca-texto">
        {dinero ? formatearPesos(animado) : animado}
      </p>
      {variacion !== null ? (
        <p
          className="mt-1.5 flex items-center gap-1 text-xs font-medium"
          style={{ color: sube ? '#116B47' : '#9A3320' }}
        >
          {sube ? <IconoSubir className="size-3.5" /> : <IconoBajar className="size-3.5" />}
          {sube ? '+' : ''}
          {variacion}% vs {nombreMesAnterior}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-marca-texto-suave">Sin datos de {nombreMesAnterior}</p>
      )}
    </div>
  )
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
