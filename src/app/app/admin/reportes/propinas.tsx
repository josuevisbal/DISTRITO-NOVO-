'use client'

import { type CSSProperties } from 'react'

import { IconoCorazon } from '@/components/iconos'
import { Vacio } from '@/components/ui/vacio'
import { formatearPesos } from '@/lib/formato'

/** Una fila por día con cobros: lo que entró y cuánto de eso fue propina. */
export type PropinaDia = {
  /** 'YYYY-MM-DD' en la zona del negocio. */
  dia: string
  propina: number
  /** Cuentas de ese día que dejaron propina. */
  cuentas: number
  /** Venta cobrada ese día, ya sin la propina. */
  cobrado: number
}

/**
 * Propinas día por día del mes. Va aparte de la venta a propósito: la propina no es del
 * restaurante, se digita al cobrar y esta lista es la que se usa para repartirla.
 */
export function PropinasPorDia({ datos, mes }: { datos: PropinaDia[]; mes: string }) {
  const total = datos.reduce((s, d) => s + d.propina, 0)
  const conPropina = datos.filter((d) => d.propina > 0)

  return (
    <section className="tarjeta entra p-5" style={{ '--i': 5 } as CSSProperties}>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-semibold text-marca-texto">
          Propinas por día · <span className="capitalize">{mes}</span>
        </h2>
        <p className="text-sm tabular-nums text-marca-texto-suave">
          {conPropina.length} {conPropina.length === 1 ? 'día con propina' : 'días con propina'} ·{' '}
          <span className="font-semibold text-marca-texto">{formatearPesos(total)}</span>
        </p>
      </div>
      <p className="mb-4 text-xs text-marca-texto-suave">
        Cuenta el día en que se cobró, que es cuando la plata entró a la caja. No entra en las
        ventas del mes: la propina es del equipo.
      </p>

      {datos.length === 0 ? (
        <Vacio texto="Sin cobros en este mes." Icono={IconoCorazon} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-marca-borde text-left text-xs text-marca-texto-suave">
                <th className="py-2 pr-3 font-normal">Día</th>
                <th className="py-2 pr-3 text-right font-normal">Cuentas</th>
                <th className="py-2 pr-3 text-right font-normal">Cobrado</th>
                <th className="py-2 pr-3 text-right font-normal">Propina</th>
                <th className="py-2 text-right font-normal">% del cobro</th>
              </tr>
            </thead>
            <tbody>
              {datos.map((d) => {
                const pct = d.cobrado > 0 ? Math.round((d.propina / d.cobrado) * 100) : 0
                const sinPropina = d.propina === 0
                return (
                  <tr key={d.dia} className="border-b border-marca-borde/60">
                    <td className="py-2 pr-3 text-marca-texto">{etiquetaDia(d.dia)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-marca-texto-suave">
                      {d.cuentas}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-marca-texto-suave">
                      {formatearPesos(d.cobrado)}
                    </td>
                    <td
                      className={`py-2 pr-3 text-right font-semibold tabular-nums ${
                        sinPropina ? 'text-marca-texto-suave' : 'text-marca-acento-fuerte'
                      }`}
                    >
                      {formatearPesos(d.propina)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-marca-texto-suave">
                      {sinPropina ? '—' : `${pct}%`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="py-2 pr-3 font-semibold text-marca-texto">Total</td>
                <td className="py-2 pr-3 text-right tabular-nums text-marca-texto-suave">
                  {datos.reduce((s, d) => s + d.cuentas, 0)}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-marca-texto-suave">
                  {formatearPesos(datos.reduce((s, d) => s + d.cobrado, 0))}
                </td>
                <td className="py-2 pr-3 text-right font-bold tabular-nums text-marca-acento-fuerte">
                  {formatearPesos(total)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  )
}

/** '2025-08-15' -> 'vie 15'. Se arma a mano: la fecha ya viene en la zona del negocio. */
function etiquetaDia(dia: string): string {
  const [anio, mes, d] = dia.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, mes - 1, d))
  const nombre = new Intl.DateTimeFormat('es-CO', { weekday: 'short', timeZone: 'UTC' }).format(
    fecha,
  )
  return `${nombre.replace('.', '')} ${String(d).padStart(2, '0')}`
}
