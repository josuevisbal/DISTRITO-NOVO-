'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { IconoAtras, IconoBolsa, IconoCheck, IconoMas, IconoMenos } from '@/components/iconos'
import type { Carta, ProductoCarta } from '@/lib/datos/carta'
import { formatearPesos } from '@/lib/formato'
import { crearPedido } from './acciones'
import { BannerPromociones } from './promociones'
import { Checkout, type DatosCheckout } from './checkout'

type Linea = { producto: ProductoCarta; cantidad: number; notas: string }
type Vista = 'carta' | 'carrito' | 'checkout'

type Props = {
  carta: Carta
  /** Presente solo cuando se entró por el QR de una mesa. */
  mesa?: { id: string; numero: number }
}

export function CartaCliente({ carta, mesa }: Props) {
  const router = useRouter()
  const [lineas, setLineas] = useState<Linea[]>([])
  const [vista, setVista] = useState<Vista>('carta')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subtotal = lineas.reduce((s, l) => s + l.producto.precio * l.cantidad, 0)
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0)

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
      <Encabezado nombre={carta.restaurante.nombre} mesa={mesa} />

      <BannerPromociones
        promociones={carta.promociones}
        productos={carta.productos}
        onAgregarCombo={(items) => items.forEach((i) => agregar(i.producto, i.cantidad))}
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
          subtotal={subtotal}
          mesa={mesa}
          enviando={enviando}
          error={error}
          onCerrar={() => setVista('carta')}
          onCambiarCantidad={cambiarCantidad}
          onCambiarNotas={cambiarNotas}
          onContinuar={() => (mesa ? void enviar() : setVista('checkout'))}
        />
      ) : null}
    </>
  )
}

function Encabezado({ nombre, mesa }: { nombre: string; mesa?: { numero: number } }) {
  return (
    <header className="px-5 pt-10 sm:px-8">
      {mesa ? (
        <p className="mb-2 inline-block rounded-full border border-marca-acento px-3 py-1 text-sm font-medium text-marca-acento">
          Mesa {mesa.numero}
        </p>
      ) : null}
      <h1 className="font-titulo text-4xl font-bold text-marca-acento sm:text-5xl">
        {nombre}
      </h1>
      <p className="mt-2 text-marca-texto-suave">
        {mesa ? 'Arma tu pedido y el mesero lo confirma.' : 'Pide desde aquí, sin cuenta.'}
      </p>
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
  const [activa, setActiva] = useState<string | null>(null)
  const contenedorChips = useRef<HTMLDivElement>(null)

  const conProductos = useMemo(
    () =>
      carta.categorias
        .map((c) => ({ ...c, items: carta.productos.filter((p) => p.categoria_id === c.id) }))
        .filter((c) => c.items.length > 0),
    [carta],
  )

  // Marca el chip de la categoría que se está viendo. Sin esto, en una carta de 84
  // productos el comensal pierde de vista en qué parte del menú va.
  useEffect(() => {
    const observador = new IntersectionObserver(
      (entradas) => {
        const visible = entradas.find((e) => e.isIntersecting)
        if (visible) setActiva(visible.target.id.replace('categoria-', ''))
      },
      { rootMargin: '-96px 0px -70% 0px' },
    )

    for (const c of conProductos) {
      const nodo = document.getElementById(`categoria-${c.id}`)
      if (nodo) observador.observe(nodo)
    }
    return () => observador.disconnect()
  }, [conProductos])

  // Mantiene el chip activo dentro de la tira, que en móvil no cabe entera.
  useEffect(() => {
    if (!activa) return
    contenedorChips.current
      ?.querySelector(`[data-chip="${activa}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activa])

  const cantidadDe = (id: string) => lineas.find((l) => l.producto.id === id)?.cantidad ?? 0

  return (
    <>
      <nav
        aria-label="Categorías"
        className="sticky top-0 z-20 mt-6 border-b border-marca-borde bg-marca-fondo/95 backdrop-blur"
      >
        <div ref={contenedorChips} className="flex gap-2 overflow-x-auto px-5 py-3 sm:px-8">
          {conProductos.map((c) => {
            const seleccionada = activa === c.id
            return (
              <button
                key={c.id}
                type="button"
                data-chip={c.id}
                aria-current={seleccionada ? 'true' : undefined}
                onClick={() =>
                  document
                    .getElementById(`categoria-${c.id}`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                className={`min-h-11 shrink-0 rounded-full border px-4 text-sm ${
                  seleccionada
                    ? 'border-marca-acento bg-marca-acento font-semibold text-marca-acento-texto'
                    : 'border-marca-borde text-marca-texto'
                }`}
              >
                {c.nombre}
              </button>
            )
          })}
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-5 pb-40 sm:px-8">
        {conProductos.map((categoria) => (
          <section key={categoria.id} id={`categoria-${categoria.id}`} className="scroll-mt-24 pt-10">
            <h2 className="font-titulo text-2xl font-medium text-marca-texto">
              {categoria.nombre}
            </h2>

            <ul className="mt-4 divide-y divide-marca-borde">
              {categoria.items.map((producto) => {
                const cantidad = cantidadDe(producto.id)

                return (
                  <li key={producto.id} className="flex items-start gap-4 py-4">
                    <div className="min-w-0 flex-1">
                      <h3
                        className={`font-medium ${
                          producto.disponible ? 'text-marca-texto' : 'text-marca-texto-suave'
                        }`}
                      >
                        {producto.nombre}
                      </h3>
                      {producto.descripcion ? (
                        <p className="mt-1 text-sm text-marca-texto-suave">
                          {producto.descripcion}
                        </p>
                      ) : null}
                      <p className="mt-2 inline-block rounded-md border border-marca-acento px-2.5 py-1 text-sm font-medium text-marca-acento">
                        {formatearPesos(producto.precio)}
                      </p>
                    </div>

                    {producto.disponible ? (
                      <button
                        type="button"
                        onClick={() => onAgregar(producto)}
                        aria-label={`Agregar ${producto.nombre}`}
                        className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-marca-acento px-3 font-medium text-marca-acento-texto"
                      >
                        <IconoMas className="size-4 shrink-0" />
                        {cantidad > 0 ? cantidad : 'Agregar'}
                      </button>
                    ) : (
                      <span className="min-h-11 shrink-0 rounded-lg border border-marca-borde px-3 py-2.5 text-sm text-marca-texto-suave">
                        Agotado
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
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
  subtotal,
  mesa,
  enviando,
  error,
  onCerrar,
  onCambiarCantidad,
  onCambiarNotas,
  onContinuar,
}: {
  lineas: Linea[]
  subtotal: number
  mesa?: { numero: number }
  enviando: boolean
  error: string | null
  onCerrar: () => void
  onCambiarCantidad: (id: string, delta: number) => void
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

                <p className="w-24 shrink-0 text-right font-medium text-marca-acento">
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
            <p role="alert" className="mb-3 text-sm text-marca-acento">
              {error}
            </p>
          ) : null}

          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-marca-texto-suave">
              {mesa ? 'Total' : 'Subtotal, sin domicilio'}
            </span>
            <span className="font-titulo text-2xl font-bold text-marca-acento">
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
