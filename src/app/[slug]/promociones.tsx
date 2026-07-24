'use client'

import { IconoBolsa, IconoEtiqueta, IconoMoto } from '@/components/iconos'
import type { PromocionCarta, ProductoCarta } from '@/lib/datos/carta'
import { formatearPesos } from '@/lib/formato'

type Props = {
  promociones: PromocionCarta[]
  productos: ProductoCarta[]
  onAgregarCombo: (items: { producto: ProductoCarta; cantidad: number }[]) => void
}

/**
 * Lo primero que ve el comensal al abrir la carta.
 *
 * El precio del combo se muestra sumando los productos a su precio real, no el campo
 * `precio_combo`: `crear_pedido` cobra la suma de `productos`, así que anunciar otro valor
 * sería cobrarle al cliente algo distinto de lo que le prometimos.
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
          const valor = items.reduce((s, i) => s + i.producto.precio * i.cantidad, 0)

          return (
            <li
              key={promo.id}
              className="w-[min(20rem,85vw)] shrink-0 snap-start rounded-xl border border-marca-acento/40 bg-gradient-to-br from-marca-acento/15 to-marca-superficie p-5"
            >
              <p className="flex items-center gap-2 text-marca-acento">
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

              <h3 className="mt-2 font-titulo text-xl font-bold text-marca-texto">
                {promo.titulo}
              </h3>

              {promo.descripcion ? (
                <p className="mt-1.5 text-sm text-marca-texto-suave">{promo.descripcion}</p>
              ) : null}

              {promo.tipo === 'combo' && items.length > 0 ? (
                <>
                  <ul className="mt-3 space-y-0.5 text-sm text-marca-texto-suave">
                    {items.map((i) => (
                      <li key={i.producto.id}>
                        {i.cantidad} × {i.producto.nombre}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    disabled={!disponible}
                    onClick={() => onAgregarCombo(items)}
                    className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-marca-acento px-4 font-medium text-marca-acento-texto disabled:cursor-not-allowed disabled:bg-marca-borde disabled:text-marca-texto-suave"
                  >
                    {disponible ? (
                      <>
                        <IconoBolsa className="size-4 shrink-0" />
                        Agregar por {formatearPesos(valor)}
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
