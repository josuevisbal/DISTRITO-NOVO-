'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'

import {
  IconoAtras,
  IconoBolsa,
  IconoCheck,
  IconoDestello,
  IconoFloritura,
  IconoMas,
  IconoMenos,
} from '@/components/iconos'
import { LogoMarca } from '@/components/logo-marca'
import type { Carta, ProductoCarta, PromocionCarta } from '@/lib/datos/carta'
import { formatearPesos } from '@/lib/formato'
import { crearPedido } from './acciones'
import { BannerPromociones } from './promociones'
import { Checkout, type DatosCheckout } from './checkout'

type Linea = { producto: ProductoCarta; cantidad: number; notas: string }
/** Un combo en el carrito: va y se quita COMPLETO, al precio especial del combo. */
type LineaCombo = { promo: PromocionCarta; precio: number; contenido: string; cantidad: number }
type Vista = 'carta' | 'carrito' | 'checkout'

type Props = {
  carta: Carta
  /** Presente solo cuando se entró por el QR de una mesa. */
  mesa?: { id: string; numero: number }
}

export function CartaCliente({ carta, mesa }: Props) {
  const router = useRouter()
  const [lineas, setLineas] = useState<Linea[]>([])
  const [combos, setCombos] = useState<LineaCombo[]>([])
  const [vista, setVista] = useState<Vista>('carta')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subtotal =
    lineas.reduce((s, l) => s + l.producto.precio * l.cantidad, 0) +
    combos.reduce((s, c) => s + c.precio * c.cantidad, 0)
  const unidades =
    lineas.reduce((s, l) => s + l.cantidad, 0) + combos.reduce((s, c) => s + c.cantidad, 0)

  const umbralEnvioGratis =
    carta.promociones.find((p) => p.tipo === 'envio')?.monto_minimo ?? null

  function agregar(producto: ProductoCarta, cantidad = 1) {
    setLineas((previas) => {
      const existente = previas.find((l) => l.producto.id === producto.id)
      if (existente) {
        return previas.map((l) =>
          l.producto.id === producto.id ? { ...l, cantidad: l.cantidad + cantidad } : l,
        )
      }
      return [...previas, { producto, cantidad, notas: '' }]
    })
  }

  /** El combo entra como UNA unidad al precio especial; el detalle se arma para mostrarlo. */
  function agregarCombo(promo: PromocionCarta) {
    const porId = new Map(carta.productos.map((p) => [p.id, p]))
    const contenido = promo.items
      .map((i) => {
        const producto = porId.get(i.producto_id)
        return producto ? `${i.cantidad}× ${producto.nombre}` : null
      })
      .filter(Boolean)
      .join(' · ')
    const valorNormal = promo.items.reduce(
      (s, i) => s + (porId.get(i.producto_id)?.precio ?? 0) * i.cantidad,
      0,
    )
    const precio = promo.precio_combo && promo.precio_combo > 0 ? promo.precio_combo : valorNormal

    setCombos((previos) => {
      const existente = previos.find((c) => c.promo.id === promo.id)
      if (existente) {
        return previos.map((c) =>
          c.promo.id === promo.id ? { ...c, cantidad: c.cantidad + 1 } : c,
        )
      }
      return [...previos, { promo, precio, contenido, cantidad: 1 }]
    })
  }

  function cambiarCantidadCombo(promoId: string, delta: number) {
    setCombos((previos) =>
      previos
        .map((c) => (c.promo.id === promoId ? { ...c, cantidad: c.cantidad + delta } : c))
        .filter((c) => c.cantidad > 0),
    )
  }

  function cambiarCantidad(id: string, delta: number) {
    setLineas((previas) =>
      previas
        .map((l) => (l.producto.id === id ? { ...l, cantidad: l.cantidad + delta } : l))
        .filter((l) => l.cantidad > 0),
    )
  }

  function cambiarNotas(id: string, notas: string) {
    setLineas((previas) =>
      previas.map((l) => (l.producto.id === id ? { ...l, notas } : l)),
    )
  }

  async function enviar(datos?: DatosCheckout) {
    setEnviando(true)
    setError(null)

    const resultado = await crearPedido(carta.restaurante.slug, {
      canal: mesa ? 'mesa' : datos?.entrega === 'recoger' ? 'recoger' : 'domicilio',
      medio_pago: mesa ? 'mesa' : (datos?.medio ?? 'efectivo'),
      mesa_id: mesa?.id,
      cliente_nombre: datos?.nombre,
      cliente_tel: datos?.telefono,
      direccion: datos?.entrega === 'domicilio' ? datos.direccion : undefined,
      zona_id: datos?.entrega === 'domicilio' ? datos.zona_id : undefined,
      indicaciones: datos?.indicaciones,
      items: lineas.map((l) => ({
        producto_id: l.producto.id,
        cantidad: l.cantidad,
        notas: l.notas,
      })),
      // Solo cuál combo y cuántos: el precio lo pone el servidor (precio_combo).
      combos: combos.map((c) => ({ promocion_id: c.promo.id, cantidad: c.cantidad })),
    })

    if (!resultado.ok) {
      setError(resultado.error)
      setEnviando(false)
      return
    }

    // No se limpia el carrito ni se apaga `enviando`: la navegación desmonta esto, y
    // apagarlo antes deja el botón activo un instante y se puede pedir dos veces.
    router.push(`/${carta.restaurante.slug}/pedido/${resultado.token}`)
  }

  if (vista === 'checkout') {
    return (
      <Checkout
        zonas={carta.zonas}
        subtotal={subtotal}
        umbralEnvioGratis={umbralEnvioGratis}
        enviando={enviando}
        error={error}
        onVolver={() => setVista('carrito')}
        onConfirmar={(datos) => void enviar(datos)}
      />
    )
  }

  return (
    <>
      <Encabezado
        nombre={carta.restaurante.nombre}
        portada={carta.restaurante.portada_url}
        mesa={mesa}
        slug={carta.restaurante.slug}
      />

      <BannerPromociones
        promociones={carta.promociones}
        productos={carta.productos}
        onAgregarCombo={agregarCombo}
      />

      <Menu carta={carta} lineas={lineas} onAgregar={agregar} />

      {unidades > 0 ? (
        <BarraCarrito
          unidades={unidades}
          subtotal={subtotal}
          onAbrir={() => setVista('carrito')}
        />
      ) : null}

      {vista === 'carrito' ? (
        <HojaCarrito
          lineas={lineas}
          combos={combos}
          subtotal={subtotal}
          mesa={mesa}
          enviando={enviando}
          error={error}
          onCerrar={() => setVista('carta')}
          onCambiarCantidad={cambiarCantidad}
          onCambiarCantidadCombo={cambiarCantidadCombo}
          onCambiarNotas={cambiarNotas}
          onContinuar={() => (mesa ? void enviar() : setVista('checkout'))}
        />
      ) : null}
    </>
  )
}

function Encabezado({
  nombre,
  portada,
  mesa,
  slug,
}: {
  nombre: string
  portada?: string | null
  mesa?: { numero: number }
  slug: string
}) {
  return (
    <header className="fondo-papel relative overflow-hidden px-5 pb-8 pt-12 text-center sm:px-8">
      {portada ? (
        <>
          {/* Portada de comidas detrás del logo. El degradado la funde con el fondo para
              que el dorado del logotipo siga legible. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={portada}
            alt=""
            aria-hidden
            className="animate-aparecer pointer-events-none absolute inset-0 size-full object-cover opacity-40"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, color-mix(in srgb, var(--marca-fondo) 55%, transparent), var(--marca-fondo))',
            }}
          />
        </>
      ) : null}
      <div className="relative">
      {/* El logo real de la casa, en su marco circular degradado. */}
      <div className="animate-aparecer mb-4 flex justify-center">
        <LogoMarca className="size-24" />
      </div>

      {mesa ? (
        <p className="animate-escala mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full border border-marca-acento bg-marca-superficie px-3 py-1 text-sm font-medium text-marca-acento-fuerte">
          <IconoDestello className="size-3.5" />
          Mesa {mesa.numero}
        </p>
      ) : null}

      <div className="animate-aparecer flex items-center justify-center gap-3 text-marca-acento-fuerte">
        <IconoFloritura className="h-3 w-16 opacity-80" />
        <IconoDestello className="size-4" />
        <IconoFloritura className="h-3 w-16 -scale-x-100 opacity-80" />
      </div>

      <h1
        className="animate-subir mt-3 text-5xl font-black leading-none tracking-tight text-marca-acento sm:text-6xl"
        style={{ fontFamily: 'var(--fuente-logo)' }}
      >
        <span className="texto-oro">{nombre}</span>
      </h1>

      <div className="filete-oro animate-aparecer mx-auto mt-4 w-40" />

      <p className="animate-aparecer mt-4 text-marca-texto-suave">
        {mesa ? 'Arma tu pedido y el mesero lo confirma.' : 'Pide desde aquí, sin cuenta.'}
      </p>
      <a
        href={`/${slug}/consulta`}
        className="animate-aparecer mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-marca-acento px-4 text-sm font-medium text-marca-acento-fuerte"
      >
        Consultar mi pedido
      </a>
      </div>
    </header>
  )
}

function Menu({
  carta,
  lineas,
  onAgregar,
}: {
  carta: Carta
  lineas: Linea[]
  onAgregar: (p: ProductoCarta) => void
}) {
  const contenedorChips = useRef<HTMLDivElement>(null)

  const conProductos = useMemo(
    () =>
      carta.categorias
        .map((c) => ({ ...c, items: carta.productos.filter((p) => p.categoria_id === c.id) }))
        .filter((c) => c.items.length > 0),
    [carta],
  )

  // Una familia a la vez: la categoría seleccionada es la única que se muestra.
  const [activa, setActiva] = useState<string | null>(null)
  const seleccionada = conProductos.find((c) => c.id === activa) ?? conProductos[0]

  // Mantiene el chip activo a la vista en la tira, que en móvil no cabe entera.
  useEffect(() => {
    if (!seleccionada) return
    contenedorChips.current
      ?.querySelector(`[data-chip="${seleccionada.id}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [seleccionada])

  const cantidadDe = (id: string) => lineas.find((l) => l.producto.id === id)?.cantidad ?? 0
  const colorEstacion = useMemo(
    () => new Map(carta.estaciones.map((e) => [e.id, e.color])),
    [carta.estaciones],
  )

  if (!seleccionada) return null

  return (
    <>
      <nav
        aria-label="Categorías"
        className="sticky top-0 z-20 mt-6 border-b border-marca-borde bg-marca-fondo/95 backdrop-blur"
      >
        <div ref={contenedorChips} className="flex gap-2 overflow-x-auto px-5 py-3 sm:px-8">
          {conProductos.map((c) => {
            const esta = seleccionada.id === c.id
            return (
              <button
                key={c.id}
                type="button"
                data-chip={c.id}
                aria-pressed={esta}
                onClick={() => setActiva(c.id)}
                className={`min-h-11 shrink-0 rounded-full border px-4 text-sm transition-all duration-200 ${
                  esta
                    ? 'border-marca-acento bg-marca-acento font-semibold text-marca-acento-texto shadow-sm'
                    : 'border-marca-borde bg-marca-superficie text-marca-texto hover:border-marca-acento'
                }`}
              >
                {c.nombre}
              </button>
            )
          })}
        </div>
      </nav>

      {/* key=categoría reinicia la animación de entrada al cambiar de familia */}
      <div key={seleccionada.id} className="mx-auto max-w-3xl px-5 pb-40 sm:px-8">
        <section className="pt-10">
          <EncabezadoSeccion titulo={seleccionada.nombre} />

          <ul className="mt-6 grid gap-3">
            {seleccionada.items.map((producto, i) => (
              <ItemProducto
                key={producto.id}
                producto={producto}
                cantidad={cantidadDe(producto.id)}
                indice={Math.min(i, 10)}
                colorEstacion={colorEstacion.get(producto.estacion_id) ?? '#888888'}
                onAgregar={onAgregar}
              />
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}

/** Encabezado de categoría enmarcado en dorado, como los rótulos de la carta impresa. */
function EncabezadoSeccion({ titulo }: { titulo: string }) {
  return (
    <div className="flex items-center gap-4">
      <IconoFloritura className="hidden h-3 w-14 text-marca-acento opacity-70 sm:block" />
      <h2 className="marco-oro rounded-xl bg-marca-superficie px-6 py-2.5 text-center font-titulo text-xl font-bold uppercase tracking-wide text-marca-acento-fuerte sm:text-2xl">
        {titulo}
      </h2>
      <IconoFloritura className="hidden h-3 w-14 -scale-x-100 text-marca-acento opacity-70 sm:block" />
    </div>
  )
}

function ItemProducto({
  producto,
  cantidad,
  indice,
  colorEstacion,
  onAgregar,
}: {
  producto: ProductoCarta
  cantidad: number
  indice: number
  colorEstacion: string
  onAgregar: (p: ProductoCarta) => void
}) {
  return (
    <li
      className="entra flex items-center gap-4 rounded-2xl border border-marca-borde bg-marca-superficie p-4 shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-shadow hover:shadow-lg sm:gap-6 sm:p-5"
      style={{ '--i': indice } as CSSProperties}
    >
      {/* Texto a la izquierda, plato a la derecha (estilo carta de restaurante). */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h3
            className={`font-titulo text-lg font-bold leading-tight ${
              producto.disponible ? 'text-marca-acento-fuerte' : 'text-marca-texto-suave'
            }`}
          >
            {producto.nombre}
          </h3>
          {producto.destacado ? (
            <span className="entra-pastilla flex shrink-0 items-center gap-1 rounded-full border border-marca-acento px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-marca-acento-fuerte">
              <IconoDestello className="size-3" />
              Popular
            </span>
          ) : null}
        </div>

        {producto.descripcion ? (
          <p className="mt-1 text-sm leading-snug text-marca-texto-suave">
            {producto.descripcion}
          </p>
        ) : null}

        <p className="mt-3 font-titulo text-2xl font-bold tabular-nums text-marca-acento">
          {formatearPesos(producto.precio)}
        </p>

        <div className="mt-3">
          {producto.disponible ? (
            <button
              type="button"
              onClick={() => onAgregar(producto)}
              aria-label={`Agregar ${producto.nombre}`}
              className="flex min-h-11 items-center gap-1.5 rounded-lg bg-marca-acento px-4 font-medium text-marca-acento-texto shadow-sm transition-transform active:scale-95"
            >
              <IconoMas className="size-4 shrink-0" />
              {cantidad > 0 ? `Agregar · ${cantidad}` : 'Agregar'}
            </button>
          ) : (
            <span className="inline-block rounded-lg border border-marca-borde px-3 py-2.5 text-sm text-marca-texto-suave">
              Agotado
            </span>
          )}
        </div>
      </div>

      {producto.foto_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={producto.foto_url}
          alt=""
          className="size-24 shrink-0 rounded-full border-2 border-marca-borde object-cover shadow-lg sm:size-32"
        />
      ) : (
        // Sin foto real: marcador elegante con la inicial sobre el color de su estación.
        // El admin sube la foto desde el panel y aparece aquí al instante.
        <span
          aria-hidden
          className="flex size-24 shrink-0 items-center justify-center rounded-full border-2 border-marca-borde font-titulo text-4xl font-bold text-white shadow-lg sm:size-32"
          style={{
            background: `linear-gradient(135deg, ${colorEstacion}, color-mix(in srgb, ${colorEstacion} 45%, #000))`,
          }}
        >
          {producto.nombre.trim().charAt(0).toUpperCase()}
        </span>
      )}
    </li>
  )
}

function BarraCarrito({
  unidades,
  subtotal,
  onAbrir,
}: {
  unidades: number
  subtotal: number
  onAbrir: () => void
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-marca-borde bg-marca-fondo/95 p-4 backdrop-blur">
      <button
        type="button"
        onClick={onAbrir}
        className="mx-auto flex min-h-14 w-full max-w-3xl items-center justify-between gap-4 rounded-lg bg-marca-acento px-5 font-medium text-marca-acento-texto"
      >
        <span className="flex items-center gap-2">
          <IconoBolsa className="size-5 shrink-0" />
          Ver pedido · {unidades} {unidades === 1 ? 'producto' : 'productos'}
        </span>
        <span className="text-lg font-bold">{formatearPesos(subtotal)}</span>
      </button>
    </div>
  )
}

function HojaCarrito({
  lineas,
  combos,
  subtotal,
  mesa,
  enviando,
  error,
  onCerrar,
  onCambiarCantidad,
  onCambiarCantidadCombo,
  onCambiarNotas,
  onContinuar,
}: {
  lineas: Linea[]
  combos: LineaCombo[]
  subtotal: number
  mesa?: { numero: number }
  enviando: boolean
  error: string | null
  onCerrar: () => void
  onCambiarCantidad: (id: string, delta: number) => void
  onCambiarCantidadCombo: (promoId: string, delta: number) => void
  onCambiarNotas: (id: string, notas: string) => void
  onContinuar: () => void
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-marca-fondo">
      <header className="flex items-center gap-2 border-b border-marca-borde px-3 py-3">
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Volver a la carta"
          className="flex size-11 items-center justify-center rounded-lg text-marca-texto"
        >
          <IconoAtras />
        </button>
        <h2 className="font-titulo text-xl text-marca-texto">Tu pedido</h2>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-8">
        <ul className="mx-auto max-w-2xl divide-y divide-marca-borde">
          {/* Combos primero: van y se quitan completos, al precio especial. */}
          {combos.map((combo) => (
            <li key={combo.promo.id} className="py-4">
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="flex items-center gap-2 font-medium text-marca-texto">
                    <IconoBolsa className="size-4 shrink-0 text-marca-acento-fuerte" />
                    {combo.promo.titulo}
                  </h3>
                  <p className="mt-0.5 text-sm text-marca-texto-suave">{combo.contenido}</p>
                  <p className="mt-0.5 text-sm text-marca-texto-suave">
                    {formatearPesos(combo.precio)} el combo
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onCambiarCantidadCombo(combo.promo.id, -1)}
                    aria-label={`Quitar un ${combo.promo.titulo}`}
                    className="flex size-11 items-center justify-center rounded-lg border border-marca-borde text-marca-texto"
                  >
                    <IconoMenos className="size-4" />
                  </button>
                  <span className="w-9 text-center text-lg font-medium text-marca-texto">
                    {combo.cantidad}
                  </span>
                  <button
                    type="button"
                    onClick={() => onCambiarCantidadCombo(combo.promo.id, 1)}
                    aria-label={`Agregar otro ${combo.promo.titulo}`}
                    className="flex size-11 items-center justify-center rounded-lg border border-marca-borde text-marca-texto"
                  >
                    <IconoMas className="size-4" />
                  </button>
                </div>

                <p className="w-24 shrink-0 text-right font-medium text-marca-acento-fuerte">
                  {formatearPesos(combo.precio * combo.cantidad)}
                </p>
              </div>
            </li>
          ))}

          {lineas.map((linea) => (
            <li key={linea.producto.id} className="py-4">
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-marca-texto">{linea.producto.nombre}</h3>
                  <p className="mt-0.5 text-sm text-marca-texto-suave">
                    {formatearPesos(linea.producto.precio)} c/u
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onCambiarCantidad(linea.producto.id, -1)}
                    aria-label={`Quitar uno de ${linea.producto.nombre}`}
                    className="flex size-11 items-center justify-center rounded-lg border border-marca-borde text-marca-texto"
                  >
                    <IconoMenos className="size-4" />
                  </button>
                  <span className="w-9 text-center text-lg font-medium text-marca-texto">
                    {linea.cantidad}
                  </span>
                  <button
                    type="button"
                    onClick={() => onCambiarCantidad(linea.producto.id, 1)}
                    aria-label={`Agregar uno de ${linea.producto.nombre}`}
                    className="flex size-11 items-center justify-center rounded-lg border border-marca-borde text-marca-texto"
                  >
                    <IconoMas className="size-4" />
                  </button>
                </div>

                <p className="w-24 shrink-0 text-right font-medium text-marca-acento-fuerte">
                  {formatearPesos(linea.producto.precio * linea.cantidad)}
                </p>
              </div>

              <label className="mt-3 block">
                <span className="sr-only">Nota para {linea.producto.nombre}</span>
                <input
                  value={linea.notas}
                  onChange={(e) => onCambiarNotas(linea.producto.id, e.target.value)}
                  placeholder="Alguna nota para la cocina (opcional)"
                  className="min-h-11 w-full rounded-lg border border-marca-borde bg-marca-superficie px-3 text-sm text-marca-texto placeholder:text-marca-texto-suave/60"
                />
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-marca-borde p-4">
        <div className="mx-auto max-w-2xl">
          {error ? (
            <p role="alert" className="mb-3 text-sm text-marca-acento-fuerte">
              {error}
            </p>
          ) : null}

          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-marca-texto-suave">
              {mesa ? 'Total' : 'Subtotal, sin domicilio'}
            </span>
            <span className="font-titulo text-2xl font-bold text-marca-acento-fuerte">
              {formatearPesos(subtotal)}
            </span>
          </div>

          <button
            type="button"
            onClick={onContinuar}
            disabled={enviando}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-marca-acento text-lg font-medium text-marca-acento-texto disabled:opacity-60"
          >
            {enviando ? (
              'Enviando…'
            ) : mesa ? (
              <>
                <IconoCheck className="size-5 shrink-0" />
                Enviar a la mesa {mesa.numero}
              </>
            ) : (
              'Continuar'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
