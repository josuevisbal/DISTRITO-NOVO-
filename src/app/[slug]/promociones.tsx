'use client'

import { IconoBolsa, IconoEtiqueta, IconoMoto } from '@/components/iconos'
import type { PromocionCarta, ProductoCarta } from '@/lib/datos/carta'
import { formatearPesos } from '@/lib/formato'

type Props = {
  promociones: PromocionCarta[]
  productos: ProductoCarta[]
  onAgregarCombo: (promo: PromocionCarta) => void
}

/**
 * Lo primero que ve el comensal al abrir la carta.
 *
 * El combo se anuncia a su `precio_combo` (el precio especial que fija el admin y que
 * `crear_pedido` cobra desde el servidor), con el valor normal tachado para que se vea
 * el ahorro. Sin `precio_combo` cargado, se anuncia la suma normal.
 */
export function BannerPromociones({ promociones, productos, onAgregarCombo }: Props) {
  if (promociones.length === 0) return null

  const porId = new Map(productos.map((p) => [p.id, p]))

  return (
    <section aria-labelledby="titulo-promos" className="px-5 pt-6 sm:px-8">
      <h2 id="titulo-promos" className="sr-only">
        Promociones
      </h2>

      <ul className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
        {promociones.map((promo) => {
          const items = promo.items
            .map((i) => {
              const producto = porId.get(i.producto_id)
              return producto ? { producto, cantidad: i.cantidad } : null
            })
            .filter((i): i is { producto: ProductoCarta; cantidad: number } => i !== null)

          const disponible = items.length > 0 && items.every((i) => i.producto.disponible)
          const valorNormal = items.reduce((s, i) => s + i.producto.precio * i.cantidad, 0)
          const precioCombo =
            promo.precio_combo && promo.precio_combo > 0 ? promo.precio_combo : valorNormal
          const conAhorro = precioCombo < valorNormal

          return (
            <li
              key={promo.id}
              className="entra relative w-[min(20rem,85vw)] shrink-0 snap-start overflow-hidden rounded-2xl border border-marca-acento/50 bg-gradient-to-br from-marca-superficie-tenue to-marca-superficie p-5 shadow-sm"
            >
              {promo.imagen_url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={promo.imagen_url}
                    alt=""
                    aria-hidden
                    className="pointer-events-none absolute inset-0 size-full object-cover opacity-30"
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(120deg, var(--marca-superficie), color-mix(in srgb, var(--marca-superficie) 55%, transparent))',
                    }}
                  />
                </>
              ) : (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full opacity-20"
                  style={{ backgroundColor: 'var(--marca-acento)' }}
                />
              )}
              <p className="relative flex items-center gap-2 text-marca-acento-fuerte">
                {promo.tipo === 'envio' ? (
                  <IconoMoto className="size-4 shrink-0" />
                ) : promo.tipo === 'combo' ? (
                  <IconoBolsa className="size-4 shrink-0" />
                ) : (
                  <IconoEtiqueta className="size-4 shrink-0" />
                )}
                {promo.etiqueta ? (
                  <span className="text-xs font-semibold uppercase tracking-[0.15em]">
                    {promo.etiqueta}
                  </span>
                ) : null}
              </p>

              <h3 className="relative mt-2 font-titulo text-xl font-bold text-marca-texto">
                {promo.titulo}
              </h3>

              {promo.descripcion ? (
                <p className="relative mt-1.5 text-sm text-marca-texto-suave">
                  {promo.descripcion}
                </p>
              ) : promo.tipo === 'envio' && promo.monto_minimo ? (
                <p className="relative mt-1.5 text-sm text-marca-texto-suave">
                  En pedidos desde {formatearPesos(promo.monto_minimo)}.
                </p>
              ) : null}

              {promo.tipo === 'combo' && items.length > 0 ? (
                <>
                  <ul className="relative mt-3 space-y-0.5 text-sm text-marca-texto-suave">
                    {items.map((i) => (
                      <li key={i.producto.id}>
                        {i.cantidad} × {i.producto.nombre}
                      </li>
                    ))}
                  </ul>

                  {conAhorro ? (
                    <p className="relative mt-2 text-sm text-marca-texto-suave">
                      Por separado:{' '}
                      <span className="line-through">{formatearPesos(valorNormal)}</span>
                    </p>
                  ) : null}

                  <button
                    type="button"
                    disabled={!disponible}
                    onClick={() => onAgregarCombo(promo)}
                    className="relative mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-marca-acento px-4 font-medium text-marca-acento-texto disabled:cursor-not-allowed disabled:bg-marca-borde disabled:text-marca-texto-suave"
                  >
                    {disponible ? (
                      <>
                        <IconoBolsa className="size-4 shrink-0" />
                        Agregar combo · {formatearPesos(precioCombo)}
                      </>
                    ) : (
                      'Agotado por ahora'
                    )}
                  </button>
                </>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
