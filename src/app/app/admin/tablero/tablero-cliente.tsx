'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'

import {
  IconoAlerta,
  IconoBillete,
  IconoBolsa,
  IconoCheck,
  IconoEtiqueta,
  IconoFuego,
  IconoReloj,
} from '@/components/iconos'
import { Pildora } from '@/components/ui/pildora'
import { TarjetaKpi } from '@/components/ui/tarjeta-kpi'
import { Vacio } from '@/components/ui/vacio'
import { MARCA } from '@/config/tema'
import type { DatosTablero } from '@/lib/datos/tablero'
import { formatearPesos } from '@/lib/formato'
import { useRefrescarEnCambios } from '@/lib/realtime'

export function TableroCliente({ datos, dia }: { datos: DatosTablero; dia: string }) {
  // El resumen se refresca solo cuando cambian los pedidos.
  // También los turnos: si el cajero abre o cierra uno, la alerta y la píldora del
  // Tablero deben reflejarlo al instante, no esperar al refresco periódico.
  useRefrescarEnCambios(['pedidos', 'caja_turnos'], { intervaloMs: 20000 })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-marca-texto-suave">Resumen de hoy · {dia}</p>
        <Pildora tono={datos.turnoAbierto ? 'verde' : 'gris'}>
          {datos.turnoAbierto ? 'Turno abierto' : 'Sin turno'}
        </Pildora>
      </div>

      {/* KPIs con la tarjeta-indicador estándar del sistema. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaKpi
          titulo="Ventas de hoy"
          valor={datos.ventasHoy}
          dinero
          color={MARCA.dorado}
          Icono={IconoBillete}
          sub={{ texto: `${datos.pedidosHoy} ${datos.pedidosHoy === 1 ? 'pedido' : 'pedidos'}` }}
          indice={0}
        />
        <TarjetaKpi
          titulo="Pedidos"
          valor={datos.pedidosHoy}
          color="#5B6BF0"
          Icono={IconoBolsa}
          sub={{ texto: 'de hoy' }}
          indice={1}
        />
        <TarjetaKpi
          titulo="Ticket prom."
          valor={datos.ticketPromedio}
          dinero
          color="#2E9E8F"
          Icono={IconoEtiqueta}
          sub={{ texto: 'por pedido' }}
          indice={2}
        />
        <TarjetaKpi
          titulo="En cocina"
          valor={datos.enCocina}
          color={MARCA.naranja}
          Icono={IconoFuego}
          sub={{ texto: 'en preparación' }}
          indice={3}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(16rem,0.7fr)]">
        <section className="tarjeta entra p-5" style={{ '--i': 4 } as CSSProperties}>
          <h2 className="mb-4 font-medium text-marca-texto">Venta por punto de cocina</h2>
          {datos.porEstacion.every((e) => e.total === 0) ? (
            <Vacio texto="Aún no hay ventas hoy." Icono={IconoReloj} />
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
                    className="flex min-h-11 items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors"
                    style={
                      a.tipo === 'transferencias'
                        ? { backgroundColor: '#FBE6DE', borderColor: '#F0BFAF', color: '#9A3320' }
                        : { backgroundColor: '#FBF1D4', borderColor: '#EBD9A0', color: '#7A5A0F' }
                    }
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

function BarrasEstacion({ estaciones }: { estaciones: DatosTablero['porEstacion'] }) {
  // Las barras crecen desde cero al montar (transición CSS), salvo con reduced-motion.
  // En pestañas ocultas requestAnimationFrame no dispara: se salta directo al ancho final.
  const [montado, setMontado] = useState(false)
  useEffect(() => {
    if (document.visibilityState === 'hidden') {
      setMontado(true)
      return
    }
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
