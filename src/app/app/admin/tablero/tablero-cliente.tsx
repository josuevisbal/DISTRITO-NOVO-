'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'

import { IconoAlerta, IconoCheck, IconoReloj } from '@/components/iconos'
import type { DatosTablero } from '@/lib/datos/tablero'
import { formatearPesos } from '@/lib/formato'
import { useRefrescarEnCambios } from '@/lib/realtime'
import { useConteo } from '@/lib/use-conteo'

export function TableroCliente({ datos, dia }: { datos: DatosTablero; dia: string }) {
  // El resumen se refresca solo cuando cambian los pedidos.
  useRefrescarEnCambios(['pedidos'], { intervaloMs: 20000 })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-marca-texto-suave">Resumen de hoy · {dia}</p>
        <span
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
            datos.turnoAbierto
              ? 'border-marca-acento text-marca-acento-fuerte'
              : 'border-marca-borde text-marca-texto-suave'
          }`}
        >
          <span
            aria-hidden
            className={`size-2 rounded-full ${datos.turnoAbierto ? 'bg-marca-acento' : 'bg-marca-borde'}`}
          />
          {datos.turnoAbierto ? 'Turno abierto' : 'Sin turno'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Ventas de hoy" valor={datos.ventasHoy} dinero indice={0} />
        <Kpi titulo="Pedidos" valor={datos.pedidosHoy} indice={1} />
        <Kpi titulo="Ticket prom." valor={datos.ticketPromedio} dinero indice={2} />
        <Kpi titulo="En cocina" valor={datos.enCocina} destacado indice={3} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(16rem,0.7fr)]">
        <section className="tarjeta entra p-5" style={{ '--i': 4 } as CSSProperties}>
          <h2 className="mb-4 font-medium text-marca-texto">Venta por punto de cocina</h2>
          {datos.porEstacion.every((e) => e.total === 0) ? (
            <p className="text-sm text-marca-texto-suave">Aún no hay ventas hoy.</p>
          ) : (
            <BarrasEstacion estaciones={datos.porEstacion} />
          )}
        </section>

        <section className="tarjeta entra p-5" style={{ '--i': 5 } as CSSProperties}>
          <h2 className="mb-4 font-medium text-marca-texto">Alertas</h2>
          {datos.alertas.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-marca-texto-suave">
              <IconoCheck className="size-4 shrink-0 text-marca-acento-fuerte" />
              Todo en orden.
            </p>
          ) : (
            <ul className="space-y-2">
              {datos.alertas.map((a) => (
                <li key={a.tipo}>
                  <Link
                    href={a.href}
                    className={`flex min-h-11 items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      a.tipo === 'transferencias'
                        ? 'border-red-200 bg-red-50 text-red-900 hover:border-red-400'
                        : 'border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-400'
                    }`}
                  >
                    {a.tipo === 'turno' ? (
                      <IconoReloj className="size-4 shrink-0" />
                    ) : (
                      <IconoAlerta className="size-4 shrink-0" />
                    )}
                    {a.texto}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function Kpi({
  titulo,
  valor,
  dinero = false,
  destacado = false,
  indice,
}: {
  titulo: string
  valor: number
  dinero?: boolean
  destacado?: boolean
  indice: number
}) {
  const animado = useConteo(valor)

  return (
    <div
      className={`tarjeta tarjeta-hover entra p-4 ${destacado ? 'border-marca-acento' : ''}`}
      style={{ '--i': indice } as CSSProperties}
    >
      <p className="text-xs uppercase tracking-wide text-marca-texto-suave">{titulo}</p>
      <p
        className={`mt-1.5 text-2xl font-bold tabular-nums ${
          destacado ? 'text-marca-acento-fuerte' : 'text-marca-texto'
        }`}
      >
        {dinero ? formatearPesos(animado) : animado}
      </p>
    </div>
  )
}

function BarrasEstacion({ estaciones }: { estaciones: DatosTablero['porEstacion'] }) {
  // Las barras crecen desde cero al montar (transición CSS), salvo con reduced-motion.
  const [montado, setMontado] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMontado(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const max = Math.max(1, ...estaciones.map((e) => e.total))

  return (
    <ul className="space-y-4">
      {estaciones.map((e) => (
        <li key={e.estacion_id}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-marca-texto">{e.nombre}</span>
            <span className="font-medium tabular-nums text-marca-texto">
              {formatearPesos(e.total)}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-marca-superficie-tenue">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
              style={{
                width: montado ? `${(e.total / max) * 100}%` : '0%',
                backgroundColor: e.color,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
