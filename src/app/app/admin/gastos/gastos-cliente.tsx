'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, type CSSProperties } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import {
  IconoAlerta,
  IconoAtras,
  IconoBillete,
  IconoBolsa,
  IconoCerrar,
  IconoGrafica,
  IconoMas,
  IconoPorcentaje,
} from '@/components/iconos'
import { Segmentado } from '@/components/segmentado'
import { useToast } from '@/components/toast'
import { Boton } from '@/components/ui/boton'
import { TarjetaKpi } from '@/components/ui/tarjeta-kpi'
import { Vacio } from '@/components/ui/vacio'
import { MARCA } from '@/config/tema'
import { formatearPesos } from '@/lib/formato'
import { eliminarGasto, fijarGananciaDesde, registrarGasto } from './acciones'

export type Resumen = {
  hora_corte: number
  ventas: number
  pedidos: number
  costo: number
  gastos: number
  sin_costo: number
  por_dia: { dia: string; ventas: number; costo: number; gastos: number }[]
  por_categoria: { categoria: string; monto: number; n: number }[]
}

export type Gasto = {
  id: string
  fecha: string
  monto: number
  categoria: string
  descripcion: string | null
}

/** Lo acumulado desde la fecha de cuadre hasta hoy: la ganancia que de verdad se tiene. */
export type Cuadre = {
  desde: string
  ventas: number
  costo: number
  gastos: number
}

type Props = {
  resumen: Resumen
  gastos: Gasto[]
  categorias: string[]
  meses: { valor: string; etiqueta: string }[]
  mesSeleccionado: string
  etiquetaMes: string
  fechaPorDefecto: string
  rango: { desde: string; hasta: string }
  cuadre: Cuadre | null
  hoy: string
}

/** "2026-10-15" -> "15 oct". */
function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
    .format(new Date(Date.UTC(a, m - 1, d, 12)))
    .replace('.', '')
}

function hora(h: number): string {
  return h === 0 ? '12 a. m.' : h < 12 ? `${h} a. m.` : h === 12 ? '12 p. m.' : `${h - 12} p. m.`
}

export function GastosCliente({
  resumen,
  gastos,
  categorias,
  meses,
  mesSeleccionado,
  etiquetaMes,
  fechaPorDefecto,
  rango,
  cuadre,
  hoy,
}: Props) {
  const router = useRouter()

  const utilidad = resumen.ventas - resumen.costo - resumen.gastos
  // La tarjeta de ganancia cuenta desde el cuadre (si lo hay), no todo el mes: el dueño
  // quiere ver la plata que de verdad tiene. Las ventas siguen siendo las del mes.
  const base = cuadre ?? resumen
  const ganancia = base.ventas - base.costo - base.gastos
  const margen = base.ventas > 0 ? Math.round((ganancia / base.ventas) * 100) : null
  const salidas = resumen.costo + resumen.gastos

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-marca-texto-suave">
          Lo que entra contra lo que sale. El día va de {hora(resumen.hora_corte)} a{' '}
          {hora(resumen.hora_corte)} del día siguiente.
        </p>
        <Segmentado
          opciones={meses}
          valor={mesSeleccionado}
          onCambiar={(v) => router.push(`/app/admin/gastos?mes=${v}`)}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaKpi
          titulo="Ventas"
          valor={resumen.ventas}
          dinero
          color={MARCA.graficaVentas}
          Icono={IconoBillete}
          sub={{ texto: `${resumen.pedidos} pedidos` }}
          indice={0}
        />
        <TarjetaKpi
          titulo="Gastos"
          valor={resumen.gastos}
          dinero
          color={MARCA.graficaGastos}
          Icono={IconoBolsa}
          sub={{
            texto: 'del total vendido',
            porcentaje:
              resumen.ventas > 0
                ? Math.min(100, Math.round((resumen.gastos / resumen.ventas) * 100))
                : undefined,
          }}
          indice={1}
        />
        <TarjetaKpi
          titulo="Costo de platos"
          valor={resumen.costo}
          dinero
          color={MARCA.dorado}
          Icono={IconoGrafica}
          sub={{
            texto:
              resumen.sin_costo > 0
                ? `${resumen.sin_costo} producto${resumen.sin_costo === 1 ? '' : 's'} sin costo`
                : 'según el costo de cada plato',
          }}
          indice={2}
        />
        <TarjetaKpi
          titulo={
            cuadre
              ? `${ganancia >= 0 ? 'Ganancia' : 'Pérdida'} desde el ${fechaCorta(cuadre.desde)}`
              : ganancia >= 0
                ? 'Ganancia'
                : 'Pérdida'
          }
          valor={Math.abs(ganancia)}
          dinero
          color={ganancia >= 0 ? MARCA.ganancia : MARCA.perdida}
          Icono={IconoPorcentaje}
          sub={{
            texto: margen === null ? 'sin ventas aún' : `margen ${margen} %`,
            porcentaje: margen !== null && margen > 0 ? Math.min(100, margen) : undefined,
          }}
          indice={3}
        />
      </div>

      <CuadreGanancia cuadre={cuadre} hoy={hoy} />

      {resumen.sin_costo > 0 ? (
        <p className="flex items-start gap-2 rounded-xl border border-marca-borde bg-marca-superficie-tenue px-3 py-2.5 text-sm text-marca-texto-suave">
          <IconoAlerta className="mt-0.5 size-4 shrink-0 text-marca-acento-fuerte" />
          <span>
            Hay {resumen.sin_costo} producto{resumen.sin_costo === 1 ? '' : 's'} vendido
            {resumen.sin_costo === 1 ? '' : 's'} sin costo cargado: la ganancia sale más alta de lo
            real. Ponles costo en Reportes, en la sección de rentabilidad.
          </span>
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <section className="tarjeta p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-titulo text-base text-marca-texto">Ventas contra gastos</h2>
              <span className="text-xs capitalize text-marca-texto-suave">{etiquetaMes}</span>
            </div>
            <PorDia datos={resumen.por_dia} />
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-marca-borde pt-3 text-sm">
              <Cifra etiqueta="Entró" valor={resumen.ventas} />
              <Cifra etiqueta="Salió" valor={salidas} />
              <Cifra etiqueta="Diferencia" valor={utilidad} />
            </div>
          </section>

          <section className="tarjeta p-4">
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-titulo text-base text-marca-texto">Ganancia por día</h2>
              <span className="text-xs text-marca-texto-suave">
                Toca un día para ver el detalle
              </span>
            </div>
            <GananciaPorDia datos={resumen.por_dia} gastos={gastos} desde={cuadre?.desde ?? null} />
          </section>

          <section className="tarjeta p-4">
            <h2 className="mb-3 font-titulo text-base text-marca-texto">En qué se va la plata</h2>
            <PorCategoria datos={resumen.por_categoria} total={resumen.gastos} />
          </section>
        </div>

        {/* En el celular, anotar el gasto va primero: es lo que más se hace desde ahí. */}
        <div className="order-first min-w-0 space-y-6 lg:order-none">
          <section className="tarjeta p-4">
            <h2 className="mb-3 font-titulo text-base text-marca-texto">Anotar un gasto</h2>
            <FormularioGasto
              categorias={categorias}
              fechaPorDefecto={fechaPorDefecto}
              min={rango.desde}
            />
          </section>

          <section className="tarjeta p-4">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 className="font-titulo text-base text-marca-texto">Gastos del mes</h2>
              <span className="text-xs text-marca-texto-suave">{gastos.length}</span>
            </div>
            {gastos.length === 0 ? (
              <Vacio texto="Todavía no hay gastos en este mes." Icono={IconoBolsa} />
            ) : (
              <ul className="divide-y divide-marca-borde">
                {gastos.map((g) => (
                  <FilaGasto key={g.id} gasto={g} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function Cifra({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-marca-texto-suave">{etiqueta}</p>
      <p className="truncate font-semibold tabular-nums text-marca-texto">
        {valor < 0 ? '-' : ''}
        {formatearPesos(Math.abs(valor))}
      </p>
    </div>
  )
}

/** Barras agrupadas por día, con leyenda, tooltip y la tabla como alternativa. */
function PorDia({ datos }: { datos: Resumen['por_dia'] }) {
  const [tabla, setTabla] = useState(false)

  if (datos.length === 0) return <Vacio texto="Sin movimientos en este mes." Icono={IconoGrafica} />

  const filas = datos.map((d) => ({
    ...d,
    etiqueta: String(Number(d.dia.slice(8))),
  }))

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4 text-xs text-marca-texto-suave">
          <Leyenda color={MARCA.graficaVentas} texto="Ventas" />
          <Leyenda color={MARCA.graficaGastos} texto="Gastos" />
        </div>
        <button
          type="button"
          onClick={() => setTabla((t) => !t)}
          className="min-h-11 rounded-lg px-2 text-xs text-marca-acento-fuerte underline-offset-2 hover:underline"
        >
          {tabla ? 'Ver gráfica' : 'Ver tabla'}
        </button>
      </div>

      {tabla ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="sticky top-0 bg-marca-superficie text-left text-xs text-marca-texto-suave">
              <tr>
                <th className="py-1.5 font-normal">Día</th>
                <th className="py-1.5 text-right font-normal">Ventas</th>
                <th className="py-1.5 text-right font-normal">Gastos</th>
                <th className="py-1.5 text-right font-normal">Quedó</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-marca-borde text-marca-texto">
              {datos.map((d) => {
                const q = d.ventas - d.costo - d.gastos
                return (
                  <tr key={d.dia}>
                    <td className="py-1.5">{fechaCorta(d.dia)}</td>
                    <td className="py-1.5 text-right">{formatearPesos(d.ventas)}</td>
                    <td className="py-1.5 text-right">{formatearPesos(d.gastos)}</td>
                    <td className="py-1.5 text-right font-semibold">
                      {q < 0 ? '-' : ''}
                      {formatearPesos(Math.abs(q))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filas} margin={{ top: 6, right: 4, bottom: 0, left: 4 }} barGap={2}>
              <XAxis
                dataKey="etiqueta"
                tickLine={false}
                axisLine={{ stroke: 'var(--marca-borde)' }}
                tick={{ fontSize: 11, fill: 'var(--marca-texto-suave)' }}
                interval="preserveStartEnd"
              />
              <YAxis hide domain={[0, 'dataMax']} />
              <Tooltip
                cursor={{ fill: 'var(--marca-superficie-tenue)' }}
                labelFormatter={(_, p) => {
                  const dia = p?.[0]?.payload?.dia as string | undefined
                  return dia ? fechaCorta(dia) : ''
                }}
                formatter={(v, nombre) => [formatearPesos(Number(v ?? 0)), nombre]}
                contentStyle={{
                  borderRadius: 10,
                  border: '1px solid var(--marca-borde)',
                  background: 'var(--marca-superficie)',
                  color: 'var(--marca-texto)',
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="ventas"
                name="Ventas"
                fill={MARCA.graficaVentas}
                radius={[4, 4, 0, 0]}
                maxBarSize={18}
              />
              <Bar
                dataKey="gastos"
                name="Gastos"
                fill={MARCA.graficaGastos}
                radius={[4, 4, 0, 0]}
                maxBarSize={18}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  )
}

/** "2026-10-15" -> "jueves, 15 oct". */
function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
    .format(new Date(Date.UTC(a, m - 1, d, 12)))
    .replace(' de ', ' ')
    .replace('.', '')
}

/**
 * La ganancia de cada día de trabajo, del más reciente al más viejo: lo que se vendió
 * menos el costo de los platos y los gastos anotados ese día. Al tocar un día se abre el
 * desglose con los gastos que lo componen.
 */
function GananciaPorDia({
  datos,
  gastos,
  desde,
}: {
  datos: Resumen['por_dia']
  gastos: Gasto[]
  /** Fecha de cuadre: los días anteriores se ven, pero no cuentan en la ganancia. */
  desde: string | null
}) {
  const [abierto, setAbierto] = useState<string | null>(null)

  if (datos.length === 0) return <Vacio texto="Sin movimientos en este mes." Icono={IconoGrafica} />

  const dias = [...datos]
    .map((d) => ({ ...d, ganancia: d.ventas - d.costo - d.gastos }))
    .sort((a, b) => b.dia.localeCompare(a.dia))
  const conVentas = dias.filter((d) => d.ventas > 0 && (desde === null || d.dia >= desde))
  const mejor =
    conVentas.length > 1 ? conVentas.reduce((m, d) => (d.ganancia > m.ganancia ? d : m)) : null
  const promedio = conVentas.length
    ? Math.round(conVentas.reduce((s, d) => s + d.ganancia, 0) / conVentas.length)
    : 0

  return (
    <>
      {conVentas.length > 0 ? (
        <p className="mb-2 text-xs text-marca-texto-suave">
          Promedio por día con ventas:{' '}
          <span className="font-semibold tabular-nums text-marca-texto">
            {promedio < 0 ? '-' : ''}
            {formatearPesos(Math.abs(promedio))}
          </span>
        </p>
      ) : null}
      <ul className="divide-y divide-marca-borde">
        {dias.map((d) => {
          const gana = d.ganancia >= 0
          const margen = d.ventas > 0 ? Math.round((d.ganancia / d.ventas) * 100) : null
          const verDetalle = abierto === d.dia
          const delDia = gastos.filter((g) => g.fecha === d.dia)
          const noCuenta = desde !== null && d.dia < desde
          return (
            <li key={d.dia} className={noCuenta ? 'opacity-60' : undefined}>
              <button
                type="button"
                onClick={() => setAbierto(verDetalle ? null : d.dia)}
                aria-expanded={verDetalle}
                className="flex min-h-14 w-full items-center gap-3 py-2.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-sm text-marca-texto">
                    <span className="first-letter:uppercase">{fechaLarga(d.dia)}</span>
                    {noCuenta ? (
                      <span className="rounded-full border border-marca-borde px-2 text-[11px] text-marca-texto-suave">
                        Antes del cuadre
                      </span>
                    ) : null}
                    {mejor?.dia === d.dia ? (
                      <span className="rounded-full border border-marca-acento px-2 text-[11px] text-marca-acento-fuerte">
                        Mejor día
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs tabular-nums text-marca-texto-suave">
                    Vendió {formatearPesos(d.ventas)}
                    {d.gastos > 0 ? ` · gastó ${formatearPesos(d.gastos)}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className="font-semibold tabular-nums"
                    style={{
                      color: gana ? MARCA.gananciaTexto : MARCA.perdida,
                    }}
                  >
                    {gana ? '' : '-'}
                    {formatearPesos(Math.abs(d.ganancia))}
                  </p>
                  <p className="text-xs text-marca-texto-suave">
                    {gana ? 'Ganancia' : 'Pérdida'}
                    {margen !== null && gana ? ` · ${margen} %` : ''}
                  </p>
                </div>
                <IconoAtras
                  className={`size-4 shrink-0 text-marca-texto-suave transition-transform ${
                    verDetalle ? 'rotate-90' : '-rotate-90'
                  }`}
                />
              </button>

              {verDetalle ? (
                <dl className="mb-3 space-y-1 rounded-lg bg-marca-superficie-tenue p-3 text-sm">
                  <Linea t="Ventas" v={d.ventas} />
                  <Linea t="Costo de los platos" v={-d.costo} />
                  {delDia.length > 0 ? (
                    delDia.map((g) => (
                      <Linea
                        key={g.id}
                        t={g.descripcion ? `${g.categoria} · ${g.descripcion}` : g.categoria}
                        v={-g.monto}
                      />
                    ))
                  ) : (
                    <Linea t="Gastos" v={-d.gastos} />
                  )}
                  <div className="flex justify-between gap-3 border-t border-marca-borde pt-1.5 font-semibold text-marca-texto">
                    <dt>{gana ? 'Ganancia del día' : 'Pérdida del día'}</dt>
                    <dd className="shrink-0 tabular-nums">
                      {gana ? '' : '-'}
                      {formatearPesos(Math.abs(d.ganancia))}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </li>
          )
        })}
      </ul>
    </>
  )
}

/**
 * La fecha desde la que se cuenta la ganancia. El dueño la mueve cuando cuadra la plata
 * que tiene: "desde hoy" es lo normal; también puede escoger otro día.
 */
function CuadreGanancia({ cuadre, hoy }: { cuadre: Cuadre | null; hoy: string }) {
  const [editando, setEditando] = useState(false)
  const [fecha, setFecha] = useState(cuadre?.desde ?? hoy)
  const [guardando, setGuardando] = useState(false)
  const { mostrar } = useToast()

  async function fijar(f: string) {
    setGuardando(true)
    const r = await fijarGananciaDesde(f)
    setGuardando(false)
    if (!r.ok) {
      mostrar(r.error)
      return
    }
    setEditando(false)
    mostrar(
      f === hoy
        ? 'La ganancia se cuenta desde hoy'
        : `La ganancia se cuenta desde el ${fechaCorta(f)}`,
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-marca-borde bg-marca-superficie px-3 py-2.5 text-sm">
      <p className="min-w-0 flex-1 text-marca-texto-suave">
        {cuadre ? (
          <>
            La ganancia se cuenta desde el{' '}
            <span className="font-semibold text-marca-texto">{fechaLarga(cuadre.desde)}</span>. Las
            ventas son las de todo el mes.
          </>
        ) : (
          'La ganancia se cuenta con todo el mes. Cuádrala para contar solo desde hoy.'
        )}
      </p>
      {editando ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="ganancia-desde">
            Contar la ganancia desde
          </label>
          <input
            id="ganancia-desde"
            type="date"
            value={fecha}
            max={hoy}
            onChange={(e) => setFecha(e.target.value)}
            className="min-h-11 rounded-lg border border-marca-borde bg-marca-fondo px-3 text-marca-texto"
          />
          <Boton
            variante="primario"
            className="px-3"
            disabled={guardando || !fecha}
            onClick={() => fijar(fecha)}
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </Boton>
          <Boton variante="secundario" className="px-3" onClick={() => setEditando(false)}>
            Cancelar
          </Boton>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {cuadre?.desde !== hoy ? (
            <Boton
              variante="primario"
              className="px-3"
              disabled={guardando}
              onClick={() => fijar(hoy)}
            >
              {guardando ? 'Guardando…' : 'Contar desde hoy'}
            </Boton>
          ) : null}
          <Boton variante="secundario" className="px-3" onClick={() => setEditando(true)}>
            Otra fecha
          </Boton>
        </div>
      )}
    </div>
  )
}

function Linea({ t, v }: { t: string; v: number }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="min-w-0 text-marca-texto-suave">{t}</dt>
      <dd className="shrink-0 tabular-nums text-marca-texto">
        {v < 0 ? '-' : ''}
        {formatearPesos(Math.abs(v))}
      </dd>
    </div>
  )
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-sm" style={{ background: color }} aria-hidden />
      {texto}
    </span>
  )
}

function PorCategoria({ datos, total }: { datos: Resumen['por_categoria']; total: number }) {
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

  if (datos.length === 0) return <Vacio texto="Cuando anotes gastos, aquí se reparten." />

  const max = Math.max(1, ...datos.map((d) => d.monto))
  return (
    <ul className="space-y-3">
      {datos.map((c) => (
        <li key={c.categoria}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-marca-texto">
              {c.categoria}{' '}
              <span className="text-xs text-marca-texto-suave">
                · {c.n} {c.n === 1 ? 'gasto' : 'gastos'}
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-marca-texto">
              {formatearPesos(c.monto)}{' '}
              <span className="text-xs text-marca-texto-suave">
                {total > 0 ? Math.round((c.monto / total) * 100) : 0} %
              </span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-marca-superficie-tenue">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
              style={{
                width: montado ? `${(c.monto / max) * 100}%` : 0,
                background: MARCA.graficaGastos,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function FormularioGasto({
  categorias,
  fechaPorDefecto,
  min,
}: {
  categorias: string[]
  fechaPorDefecto: string
  min: string
}) {
  const [monto, setMonto] = useState('')
  const [categoria, setCategoria] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fecha, setFecha] = useState(fechaPorDefecto)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mostrar } = useToast()

  // Al cambiar de mes, la fecha sugerida cambia con él.
  useEffect(() => setFecha(fechaPorDefecto), [fechaPorDefecto])

  const valor = Number(monto) || 0
  const campo =
    'mt-1 min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 text-marca-texto'

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    const r = await registrarGasto({
      fecha,
      monto: valor,
      categoria,
      descripcion,
    })
    setGuardando(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    mostrar(`Gasto de ${formatearPesos(valor)} anotado`)
    setMonto('')
    setDescripcion('')
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
      <label className="block">
        <span className="text-xs text-marca-texto-suave">Monto</span>
        <input
          inputMode="numeric"
          value={monto ? formatearPesos(valor) : ''}
          onChange={(e) => setMonto(e.target.value.replace(/\D/g, ''))}
          placeholder="$0"
          className={`${campo} text-lg font-semibold tabular-nums`}
        />
      </label>

      <label className="block">
        <span className="text-xs text-marca-texto-suave">Categoría</span>
        <input
          list="categorias-gasto"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          placeholder="Insumos, nómina, arriendo…"
          className={campo}
        />
        <datalist id="categorias-gasto">
          {categorias.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>

      <div className="flex flex-wrap gap-1.5">
        {categorias.slice(0, 8).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategoria(c)}
            className={`min-h-9 rounded-full border px-3 text-xs ${
              categoria === c
                ? 'border-marca-acento bg-marca-acento text-marca-acento-texto'
                : 'border-marca-borde text-marca-texto-suave hover:border-marca-acento'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="text-xs text-marca-texto-suave">¿En qué se gastó?</span>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={2}
          placeholder="Ej.: 20 kilos de carne en la carnicería"
          className={`${campo} py-2`}
        />
      </label>

      <label className="block">
        <span className="text-xs text-marca-texto-suave">Fecha</span>
        <input
          type="date"
          value={fecha}
          min={min}
          onChange={(e) => setFecha(e.target.value)}
          className={campo}
        />
      </label>

      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-5 shrink-0" />
          {error}
        </p>
      ) : null}

      <Boton
        type="submit"
        variante="primario"
        className="flex w-full items-center justify-center gap-1.5"
        disabled={guardando || valor <= 0 || !categoria.trim()}
      >
        <IconoMas className="size-4" />
        {guardando ? 'Guardando…' : 'Anotar gasto'}
      </Boton>
    </form>
  )
}

function FilaGasto({ gasto }: { gasto: Gasto }) {
  const [confirmando, setConfirmando] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const { mostrar } = useToast()

  async function borrar() {
    setBorrando(true)
    const r = await eliminarGasto(gasto.id)
    setBorrando(false)
    setConfirmando(false)
    mostrar(r.ok ? 'Gasto borrado' : r.error)
  }

  return (
    <li className="py-2.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-semibold tabular-nums text-marca-texto">
              {formatearPesos(gasto.monto)}
            </span>
            <span className="text-marca-texto">{gasto.categoria}</span>
          </p>
          <p className="text-xs text-marca-texto-suave">
            {fechaCorta(gasto.fecha)}
            {gasto.descripcion ? ` · ${gasto.descripcion}` : ''}
          </p>
        </div>
        {!confirmando ? (
          <button
            type="button"
            aria-label="Borrar gasto"
            onClick={() => setConfirmando(true)}
            className="grid size-11 shrink-0 place-items-center rounded-lg text-marca-texto-suave hover:bg-marca-superficie-tenue hover:text-marca-texto"
          >
            <IconoCerrar className="size-4" />
          </button>
        ) : null}
      </div>
      {confirmando ? (
        <div
          className="mt-2 flex flex-wrap items-center gap-2 text-sm"
          style={{ '--i': 0 } as CSSProperties}
        >
          <span className="text-marca-texto">¿Borrar este gasto?</span>
          <Boton variante="primario" className="px-3" onClick={borrar} disabled={borrando}>
            {borrando ? 'Borrando…' : 'Sí, borrar'}
          </Boton>
          <Boton variante="secundario" className="px-3" onClick={() => setConfirmando(false)}>
            No
          </Boton>
        </div>
      ) : null}
    </li>
  )
}
