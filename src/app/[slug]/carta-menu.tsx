'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import { IconoBolsa, IconoCerrar, IconoMas, IconoMenos, IconoMoto } from '@/components/iconos'
import type {
  Carta,
  CategoriaCarta,
  EstiloCategoria,
  ProductoCarta,
} from '@/lib/datos/carta'
import { formatearPesos } from '@/lib/formato'

/**
 * La carta en clave editorial: cada familia es una sección con su título (una palabra en
 * dorado itálico), su línea y su propio estilo —lista, mosaico, carrusel o compacta—, todas
 * en una sola página con la barra de familias fija arriba. Tocar un plato abre su ficha
 * para escoger cantidad y dejar una nota a la cocina.
 */

export type Agregar = (producto: ProductoCarta, cantidad: number, notas: string) => void

type Seccion = CategoriaCarta & { items: ProductoCarta[]; estiloFinal: EstiloCategoria }

/** "Hamburguesas *angus*" → "angus" en dorado itálico. Sin asteriscos, el nombre tal cual. */
export function TituloConAcento({ texto }: { texto: string }) {
  return (
    <>
      {texto.split('*').map((p, k) =>
        k % 2 ? (
          <em key={k} className="acento-carta">
            {p}
          </em>
        ) : (
          <span key={k}>{p}</span>
        ),
      )}
    </>
  )
}

/** Sin título propio: el nombre, con la última palabra de acento si son varias. */
function tituloDe(c: CategoriaCarta): string {
  if (c.titulo?.trim()) return c.titulo.trim()
  const palabras = c.nombre.trim().split(/\s+/)
  if (palabras.length < 2) return c.nombre
  return `${palabras.slice(0, -1).join(' ')} *${palabras.at(-1)}*`
}

/** Sin estilo escogido: si la mitad o más tiene foto, mosaico; si no, lista. */
function estiloDe(c: CategoriaCarta, items: ProductoCarta[]): EstiloCategoria {
  if (c.estilo) return c.estilo
  const conFoto = items.filter((p) => p.foto_url).length
  return conFoto > 0 && conFoto >= items.length / 2 ? 'mosaico' : 'lista'
}

/* ------------------------------------------------------------------ */
/* Foto del plato (o su marcador elegante mientras no tenga foto)      */
/* ------------------------------------------------------------------ */

function FotoPlato({
  producto,
  color,
  className = '',
  grande = false,
}: {
  producto: ProductoCarta
  color: string
  className?: string
  grande?: boolean
}) {
  if (producto.foto_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={producto.foto_url}
        alt=""
        loading="lazy"
        className={`size-full object-cover ${className}`}
      />
    )
  }
  // Sin foto: un brillo del color de su cocina sobre negro y la inicial en dorado tenue.
  return (
    <span
      aria-hidden
      className={`flex size-full items-center justify-center ${className}`}
      style={{
        background: `radial-gradient(120% 90% at 30% 20%, color-mix(in srgb, ${color} 38%, transparent), transparent 60%), linear-gradient(160deg, var(--marca-superficie-tenue), var(--marca-fondo))`,
      }}
    >
      <span
        className={`font-titulo font-bold text-marca-acento opacity-40 ${grande ? 'text-7xl' : 'text-2xl'}`}
      >
        {producto.nombre.trim().charAt(0).toUpperCase()}
      </span>
    </span>
  )
}

function BotonMas({ cantidad }: { cantidad: number }) {
  return (
    <span
      aria-hidden
      className="relative grid size-11 shrink-0 place-items-center rounded-full bg-marca-texto text-marca-fondo shadow-md transition-transform group-active:scale-90"
    >
      <IconoMas className="size-5" />
      {cantidad > 0 ? (
        <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-marca-acento px-1 text-[11px] font-bold leading-5 text-marca-acento-texto">
          {cantidad}
        </span>
      ) : null}
    </span>
  )
}

function Agotado({ className = '' }: { className?: string }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full border border-marca-borde bg-marca-fondo/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-marca-texto-suave backdrop-blur ${className}`}
    >
      Agotado hoy
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* La carta completa                                                    */
/* ------------------------------------------------------------------ */

export function MenuCarta({
  carta,
  cantidadDe,
  onAgregar,
}: {
  carta: Carta
  cantidadDe: (id: string) => number
  onAgregar: Agregar
}) {
  const color = useMemo(
    () => new Map(carta.estaciones.map((e) => [e.id, e.color])),
    [carta.estaciones],
  )
  const colorDe = (p: ProductoCarta) => color.get(p.estacion_id) ?? '#888888'

  const secciones: Seccion[] = useMemo(
    () =>
      carta.categorias
        .map((c) => {
          const items = carta.productos.filter((p) => p.categoria_id === c.id)
          return { ...c, items, estiloFinal: estiloDe(c, items) }
        })
        .filter((c) => c.items.length > 0),
    [carta],
  )
  const destacados = useMemo(
    () => carta.productos.filter((p) => p.destacado && p.disponible).slice(0, 10),
    [carta.productos],
  )

  const [ficha, setFicha] = useState<ProductoCarta | null>(null)
  const abrir = (p: ProductoCarta) => setFicha(p)

  return (
    <>
      {destacados.length > 0 ? (
        <section aria-labelledby="h-destacados" className="pt-10">
          <EncabezadoSeccion
            id="h-destacados"
            ceja="Los que más se piden"
            titulo="Para arrancar *con todo*"
          />
          <div className="mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:px-8 [scrollbar-width:none]">
            {destacados.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => abrir(p)}
                className="group relative aspect-[4/5] w-[72%] max-w-72 shrink-0 snap-start overflow-hidden rounded-3xl border border-marca-borde text-left"
              >
                <FotoPlato producto={p} color={colorDe(p)} grande />
                <span className="velo-carta absolute inset-0" aria-hidden />
                <span className="absolute left-3 top-3 rounded-full bg-marca-acento px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-marca-acento-texto">
                  Recomendado
                </span>
                <span className="absolute inset-x-0 bottom-0 p-4">
                  <span className="block font-titulo text-2xl font-bold leading-tight text-marca-texto">
                    {p.nombre}
                  </span>
                  <span className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-lg font-bold tabular-nums text-marca-acento-fuerte">
                      {formatearPesos(p.precio)}
                    </span>
                    <BotonMas cantidad={cantidadDe(p.id)} />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <NavFamilias secciones={secciones} />

      <div className="mx-auto max-w-3xl pb-44">
        {secciones.map((s) => (
          <section
            key={s.id}
            id={`familia-${s.slug}`}
            data-familia={s.id}
            aria-labelledby={`h-${s.slug}`}
            className="scroll-mt-20 pt-12"
          >
            <EncabezadoSeccion
              id={`h-${s.slug}`}
              ceja={s.nombre}
              titulo={tituloDe(s)}
              linea={s.subtitulo}
            />
            <div className="mt-6">
              {s.estiloFinal === 'mosaico' ? (
                <Mosaico items={s.items} colorDe={colorDe} cantidadDe={cantidadDe} onAbrir={abrir} />
              ) : s.estiloFinal === 'carrusel' ? (
                <Carrusel items={s.items} colorDe={colorDe} cantidadDe={cantidadDe} onAbrir={abrir} />
              ) : s.estiloFinal === 'compacta' ? (
                <Compacta items={s.items} colorDe={colorDe} cantidadDe={cantidadDe} onAbrir={abrir} />
              ) : (
                <Lista items={s.items} colorDe={colorDe} cantidadDe={cantidadDe} onAbrir={abrir} />
              )}
            </div>
          </section>
        ))}

        <PieCarta restaurante={carta.restaurante} />
      </div>

      {ficha ? (
        <FichaPlato
          producto={ficha}
          color={colorDe(ficha)}
          estacion={carta.estaciones.find((e) => e.id === ficha.estacion_id)?.nombre ?? null}
          enPedido={cantidadDe(ficha.id)}
          onCerrar={() => setFicha(null)}
          onAgregar={(cantidad, notas) => {
            onAgregar(ficha, cantidad, notas)
            setFicha(null)
          }}
        />
      ) : null}
    </>
  )
}

function EncabezadoSeccion({
  id,
  ceja,
  titulo,
  linea,
}: {
  id: string
  ceja: string
  titulo: string
  linea?: string | null
}) {
  return (
    <div className="px-5 sm:px-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-marca-texto-suave">
        {ceja}
      </p>
      <h2 id={id} className="mt-2 font-titulo text-[2.1rem] font-bold leading-[1.05] text-marca-texto">
        <TituloConAcento texto={titulo} />
      </h2>
      {linea ? <p className="mt-2 max-w-xl text-[15px] leading-snug text-marca-texto-suave">{linea}</p> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Barra de familias: fija arriba y marca la sección que se está viendo */
/* ------------------------------------------------------------------ */

function NavFamilias({ secciones }: { secciones: Seccion[] }) {
  const [activa, setActiva] = useState<string | null>(secciones[0]?.id ?? null)
  const tira = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const nodos = Array.from(document.querySelectorAll<HTMLElement>('[data-familia]'))
    if (nodos.length === 0) return
    const obs = new IntersectionObserver(
      (entradas) => {
        const visible = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActiva((visible.target as HTMLElement).dataset.familia ?? null)
      },
      { rootMargin: '-90px 0px -60% 0px' },
    )
    nodos.forEach((n) => obs.observe(n))
    return () => obs.disconnect()
  }, [secciones])

  // El chip activo siempre a la vista en la tira (en el celular no caben todos).
  useEffect(() => {
    if (!activa) return
    const chip = tira.current?.querySelector<HTMLElement>(`[data-chip="${activa}"]`)
    if (!chip || !tira.current) return
    const t = tira.current
    t.scrollTo({ left: chip.offsetLeft - t.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' })
  }, [activa])

  function ir(s: Seccion) {
    setActiva(s.id)
    document.getElementById(`familia-${s.slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav
      aria-label="Familias de la carta"
      className="sticky top-0 z-20 mt-10 border-b border-marca-borde bg-marca-fondo/90 backdrop-blur-md"
    >
      <div ref={tira} className="flex gap-2 overflow-x-auto px-5 py-3 sm:px-8 [scrollbar-width:none]">
        {secciones.map((s) => {
          const esta = activa === s.id
          return (
            <button
              key={s.id}
              type="button"
              data-chip={s.id}
              aria-current={esta ? 'true' : undefined}
              onClick={() => ir(s)}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors ${
                esta
                  ? 'border-marca-acento bg-marca-acento/10 text-marca-acento-fuerte'
                  : 'border-marca-borde text-marca-texto hover:border-marca-acento'
              }`}
            >
              {s.nombre}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/* ------------------------------------------------------------------ */
/* Estilos de sección                                                   */
/* ------------------------------------------------------------------ */

type PropsEstilo = {
  items: ProductoCarta[]
  colorDe: (p: ProductoCarta) => string
  cantidadDe: (id: string) => number
  onAbrir: (p: ProductoCarta) => void
}

/** Primero los populares: son los que el restaurante quiere que se vean. */
const populares = (items: ProductoCarta[]) => [
  ...items.filter((p) => p.destacado),
  ...items.filter((p) => !p.destacado),
]

function Lista({ items, colorDe, cantidadDe, onAbrir }: PropsEstilo) {
  return (
    <ul className="divide-y divide-marca-borde px-5 sm:px-8">
      {populares(items).map((p) => (
        <li key={p.id}>
          <button
            type="button"
            onClick={() => onAbrir(p)}
            className={`group flex w-full items-center gap-4 py-4 text-left ${p.disponible ? '' : 'opacity-60'}`}
          >
            <span className="size-20 shrink-0 overflow-hidden rounded-2xl border border-marca-borde">
              <FotoPlato producto={p} color={colorDe(p)} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[17px] font-semibold leading-tight text-marca-texto">{p.nombre}</span>
                {p.destacado ? (
                  <span className="rounded-full bg-marca-acento px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-marca-acento-texto">
                    Popular
                  </span>
                ) : null}
              </span>
              {p.descripcion ? (
                <span className="mt-1 line-clamp-2 block text-sm leading-snug text-marca-texto-suave">
                  {p.descripcion}
                </span>
              ) : null}
              {p.disponible ? null : <Agotado className="mt-2 inline-block" />}
            </span>
            <span className="flex shrink-0 flex-col items-end gap-2">
              <span className="font-bold tabular-nums text-marca-acento-fuerte">{formatearPesos(p.precio)}</span>
              {p.disponible ? <BotonMas cantidad={cantidadDe(p.id)} /> : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function Mosaico({ items, colorDe, cantidadDe, onAbrir }: PropsEstilo) {
  return (
    <div className="grid grid-cols-2 gap-3 px-5 sm:px-8">
      {populares(items).map((p) => {
        const ancho = p.destacado
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onAbrir(p)}
            className={`group relative overflow-hidden rounded-3xl border border-marca-borde text-left ${
              ancho ? 'col-span-2 aspect-[16/10]' : 'aspect-[4/5]'
            } ${p.disponible ? '' : 'opacity-60'}`}
          >
            <FotoPlato producto={p} color={colorDe(p)} grande={ancho} />
            <span className="velo-carta absolute inset-0" aria-hidden />
            {ancho ? (
              <span className="absolute right-3 top-3 rounded-full bg-marca-acento px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-marca-acento-texto">
                La insignia
              </span>
            ) : null}
            {p.disponible ? null : <Agotado className="absolute left-3 top-3" />}
            <span className="absolute inset-x-0 bottom-0 p-3.5">
              <span
                lang="es"
                className={`block font-titulo font-bold leading-tight text-marca-texto ${
                  ancho
                    ? 'text-[clamp(1.4rem,6.5vw,1.875rem)]'
                    : 'hyphens-auto text-[clamp(0.95rem,4.4vw,1.25rem)] [overflow-wrap:anywhere]'
                }`}
              >
                {p.nombre}
              </span>
              <span className="mt-2 flex items-center justify-between gap-2">
                <span className="font-bold tabular-nums text-marca-acento-fuerte">{formatearPesos(p.precio)}</span>
                {p.disponible ? <BotonMas cantidad={cantidadDe(p.id)} /> : null}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Carrusel({ items, colorDe, cantidadDe, onAbrir }: PropsEstilo) {
  return (
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:px-8 [scrollbar-width:none]">
      {populares(items).map((p, k) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onAbrir(p)}
          className={`group flex w-64 shrink-0 snap-start flex-col overflow-hidden rounded-3xl border border-marca-borde bg-marca-superficie text-left ${
            p.disponible ? '' : 'opacity-60'
          }`}
        >
          <span className="relative block h-40 w-full">
            <FotoPlato producto={p} color={colorDe(p)} grande />
            <span className="absolute left-3 top-3 rounded-full bg-marca-fondo/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-marca-texto backdrop-blur">
              N.º {String(k + 1).padStart(2, '0')}
            </span>
            {p.disponible ? null : <Agotado className="absolute right-3 top-3" />}
          </span>
          <span className="flex flex-1 flex-col p-4">
            <span className="font-titulo text-xl font-bold leading-tight text-marca-texto">{p.nombre}</span>
            {p.descripcion ? (
              <span className="mt-1.5 line-clamp-3 text-sm leading-snug text-marca-texto-suave">{p.descripcion}</span>
            ) : null}
            <span className="mt-auto flex items-center justify-between gap-2 pt-3">
              <span className="text-lg font-bold tabular-nums text-marca-acento-fuerte">{formatearPesos(p.precio)}</span>
              {p.disponible ? <BotonMas cantidad={cantidadDe(p.id)} /> : null}
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}

function Compacta({ items, colorDe, onAbrir }: PropsEstilo) {
  return (
    <div className="grid grid-cols-2 gap-2.5 px-5 sm:px-8">
      {populares(items).map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onAbrir(p)}
          className={`group flex min-h-20 items-center gap-2.5 rounded-2xl border border-marca-borde bg-marca-superficie p-2.5 text-left ${
            p.disponible ? '' : 'opacity-60'
          }`}
        >
          <span className="size-12 shrink-0 overflow-hidden rounded-xl">
            <FotoPlato producto={p} color={colorDe(p)} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 block text-sm font-semibold leading-tight text-marca-texto">{p.nombre}</span>
            <span className="mt-0.5 block text-sm font-bold tabular-nums text-marca-acento-fuerte">
              {p.disponible ? formatearPesos(p.precio) : 'Agotado'}
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Ficha del plato                                                      */
/* ------------------------------------------------------------------ */

function FichaPlato({
  producto,
  color,
  estacion,
  enPedido,
  onCerrar,
  onAgregar,
}: {
  producto: ProductoCarta
  color: string
  estacion: string | null
  enPedido: number
  onCerrar: () => void
  onAgregar: (cantidad: number, notas: string) => void
}) {
  const [cantidad, setCantidad] = useState(1)
  const [notas, setNotas] = useState('')

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    document.addEventListener('keydown', tecla)
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', tecla)
      document.body.style.overflow = previo
    }
  }, [onCerrar])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-label={producto.nombre}>
      <button type="button" aria-label="Cerrar" onClick={onCerrar} className="modal-fondo absolute inset-0 bg-black/70" />
      <div className="hoja-sube relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-marca-borde bg-marca-superficie sm:rounded-3xl">
        <div className="relative h-60 w-full shrink-0 sm:h-72">
          <FotoPlato producto={producto} color={color} grande />
          <span className="velo-carta absolute inset-0" aria-hidden />
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="absolute right-3 top-3 grid size-11 place-items-center rounded-full bg-marca-fondo/80 text-marca-texto backdrop-blur"
          >
            <IconoCerrar className="size-5" />
          </button>
          {estacion ? (
            <span
              className="absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ background: color }}
            >
              {estacion}
            </span>
          ) : null}
        </div>

        <div className="overflow-y-auto px-5 pb-4 pt-1">
          <h3 className="font-titulo text-3xl font-bold leading-tight text-marca-texto">{producto.nombre}</h3>
          {producto.descripcion ? (
            <p className="mt-2 leading-relaxed text-marca-texto-suave">{producto.descripcion}</p>
          ) : null}
          <p className="mt-3 text-2xl font-bold tabular-nums text-marca-acento-fuerte">
            {formatearPesos(producto.precio)}
          </p>
          {enPedido > 0 ? (
            <p className="mt-1 text-sm text-marca-texto-suave">Ya tienes {enPedido} en tu pedido.</p>
          ) : null}

          {producto.disponible ? (
            <label className="mt-5 block">
              <span className="text-sm text-marca-texto-suave">¿Algo para la cocina?</span>
              <input
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                maxLength={140}
                placeholder="Ej.: sin cebolla, salsa aparte"
                className="mt-1.5 min-h-12 w-full rounded-xl border border-marca-borde bg-marca-fondo px-4 text-marca-texto placeholder:text-marca-texto-suave/60"
              />
            </label>
          ) : null}
        </div>

        <div className="flex items-center gap-3 border-t border-marca-borde p-4">
          {producto.disponible ? (
            <>
              <div className="flex items-center rounded-full border border-marca-borde">
                <button
                  type="button"
                  onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                  aria-label="Uno menos"
                  className="grid size-12 place-items-center text-marca-texto"
                >
                  <IconoMenos className="size-5" />
                </button>
                <span className="w-8 text-center text-lg font-bold tabular-nums text-marca-texto">{cantidad}</span>
                <button
                  type="button"
                  onClick={() => setCantidad((c) => Math.min(30, c + 1))}
                  aria-label="Uno más"
                  className="grid size-12 place-items-center text-marca-texto"
                >
                  <IconoMas className="size-5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => onAgregar(cantidad, notas.trim())}
                className="flex min-h-12 flex-1 items-center justify-between gap-2 rounded-full bg-marca-acento px-5 font-semibold text-marca-acento-texto active:scale-[0.98]"
              >
                <span>Agregar</span>
                <span className="tabular-nums">{formatearPesos(producto.precio * cantidad)}</span>
              </button>
            </>
          ) : (
            <p className="w-full rounded-full border border-marca-borde py-3 text-center font-semibold text-marca-texto-suave">
              Agotado hoy
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Barra del pedido                                                     */
/* ------------------------------------------------------------------ */

export function BarraPedido({
  unidades,
  subtotal,
  umbralEnvioGratis,
  esMesa,
  onAbrir,
}: {
  unidades: number
  subtotal: number
  umbralEnvioGratis: number | null
  esMesa: boolean
  onAbrir: () => void
}) {
  const faltan = umbralEnvioGratis ? Math.max(0, umbralEnvioGratis - subtotal) : null
  const avance = umbralEnvioGratis ? Math.min(100, (subtotal / umbralEnvioGratis) * 100) : 0

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3 sm:pb-5">
      <div className="hoja-sube mx-auto max-w-xl overflow-hidden rounded-3xl border border-marca-acento/40 bg-marca-superficie/95 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-md">
        {!esMesa && faltan !== null ? (
          <div className="px-4 pt-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-marca-texto">
              <IconoMoto className="size-4 shrink-0 text-marca-acento-fuerte" />
              {faltan > 0 ? (
                <>
                  Te faltan <b className="tabular-nums">{formatearPesos(faltan)}</b> para domicilio gratis
                </>
              ) : (
                <b className="text-marca-acento-fuerte">¡Tu domicilio va gratis!</b>
              )}
            </p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-marca-superficie-tenue">
              <div
                className="h-full rounded-full bg-marca-acento transition-[width] duration-500"
                style={{ width: `${avance}%` } as CSSProperties}
              />
            </div>
          </div>
        ) : null}
        <button type="button" onClick={onAbrir} className="flex w-full items-center gap-3 p-3 text-left">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-marca-acento text-base font-bold text-marca-acento-texto">
            {unidades}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-bold tabular-nums text-marca-texto">{formatearPesos(subtotal)}</span>
            <span className="block text-xs text-marca-texto-suave">Ver tu pedido</span>
          </span>
          <span className="flex min-h-12 items-center gap-2 rounded-full bg-marca-texto px-5 font-semibold text-marca-fondo">
            <IconoBolsa className="size-5" />
            Pedir
          </span>
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Pie                                                                  */
/* ------------------------------------------------------------------ */

function PieCarta({ restaurante }: { restaurante: Carta['restaurante'] }) {
  return (
    <footer className="mt-16 border-t border-marca-borde px-5 pt-8 text-sm text-marca-texto-suave sm:px-8">
      <p className="font-titulo text-xl text-marca-texto">{restaurante.nombre}</p>
      {restaurante.direccion ? <p className="mt-2">{restaurante.direccion}</p> : null}
      {restaurante.horario ? <p className="mt-1 whitespace-pre-line">{restaurante.horario}</p> : null}
      <p className="mt-6 text-xs opacity-70">Desarrollado por 1A GROUP</p>
    </footer>
  )
}
