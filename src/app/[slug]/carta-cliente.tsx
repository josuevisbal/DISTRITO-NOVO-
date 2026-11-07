'use client'

import { useEffect, useState } from 'react'
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
import { armarMensajePedido, enlacePedidoWhatsApp } from '@/lib/mensaje-pedido'
import { actualizarPedido, crearPedido } from './acciones'
import { BannerPromociones } from './promociones'
import { BarraPedido, MenuCarta } from './carta-menu'
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
  // Cuando se llega desde "Modificar mi pedido": el token del pedido que se está
  // editando. Con él, confirmar guarda sobre ESE pedido en vez de crear otro.
  const [editando, setEditando] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subtotal =
    lineas.reduce((s, l) => s + l.producto.precio * l.cantidad, 0) +
    combos.reduce((s, c) => s + c.precio * c.cantidad, 0)
  const unidades =
    lineas.reduce((s, l) => s + l.cantidad, 0) + combos.reduce((s, c) => s + c.cantidad, 0)

  const umbralEnvioGratis =
    carta.promociones.find((p) => p.tipo === 'envio')?.monto_minimo ?? null

  // Vuelve de "Modificar mi pedido": se rearma el carrito con lo que ya había pedido,
  // resolviendo cada producto contra la carta de ahora (precios y disponibilidad al día).
  useEffect(() => {
    const guardado = sessionStorage.getItem('pedido-en-edicion')
    if (!guardado) return
    sessionStorage.removeItem('pedido-en-edicion')

    try {
      const { token, items } = JSON.parse(guardado) as {
        token: string
        items: { producto_id: string; cantidad: number; notas: string }[]
      }
      setEditando(token)
      const porId = new Map(carta.productos.map((p) => [p.id, p]))
      const recuperadas = items
        .map((i) => {
          const producto = porId.get(i.producto_id)
          return producto && producto.disponible
            ? { producto, cantidad: i.cantidad, notas: i.notas ?? '' }
            : null
        })
        .filter((l): l is Linea => l !== null)

      if (recuperadas.length > 0) setLineas(recuperadas)
    } catch {
      // Si el guardado viene dañado, se ignora: mejor carrito vacío que uno inventado.
    }
  }, [carta.productos])

  function agregar(producto: ProductoCarta, cantidad = 1, notas = '') {
    setLineas((previas) => {
      const existente = previas.find((l) => l.producto.id === producto.id)
      if (existente) {
        // La nota nueva se suma a la que ya tenía, sin repetirla.
        const nota =
          notas && !existente.notas.includes(notas)
            ? [existente.notas, notas].filter(Boolean).join(' · ')
            : existente.notas
        return previas.map((l) =>
          l.producto.id === producto.id
            ? { ...l, cantidad: l.cantidad + cantidad, notas: nota }
            : l,
        )
      }
      return [...previas, { producto, cantidad, notas }]
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

    // Editando: se guarda sobre el MISMO pedido, con su número. No se crea otro ni se
    // manda WhatsApp de nuevo: el restaurante ya recibió el aviso de este pedido.
    if (editando) {
      const r = await actualizarPedido(editando, {
        items: lineas.map((l) => ({
          producto_id: l.producto.id,
          cantidad: l.cantidad,
          notas: l.notas,
        })),
        combos: combos.map((c) => ({ promocion_id: c.promo.id, cantidad: c.cantidad })),
      })

      if (!r.ok) {
        setError(r.error)
        setEnviando(false)
        return
      }

      router.push(`/${carta.restaurante.slug}/pedido/${editando}`)
      return
    }

    const resultado = await crearPedido(carta.restaurante.slug, {
      canal: mesa ? 'mesa' : datos?.entrega === 'recoger' ? 'recoger' : 'domicilio',
      medio_pago: mesa ? 'mesa' : (datos?.medio ?? 'efectivo'),
      efectivo: datos?.medio === 'mixto' ? Number(datos.efectivo) || 0 : undefined,
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

    // El pedido YA quedó guardado y esperando aprobación en caja. El WhatsApp es solo el
    // aviso: se arma con los valores que devolvió el servidor, nunca con los del carrito.
    const numeroWa = carta.restaurante.whatsapp_pedidos ?? carta.restaurante.whatsapp
    // En transferencia NO se manda aquí: el cliente pasa primero a ver la llave y el
    // valor exacto, y desde esa pantalla manda el pedido anunciando el comprobante.
    // Así el restaurante recibe un solo mensaje, no dos.
    // El pago dividido también pasa por la pantalla de la llave: hay una parte que
    // transferir, y de ahí sale el único mensaje al restaurante.
    const esTransferencia = datos?.medio === 'transferencia' || datos?.medio === 'mixto'
    if (!mesa && numeroWa && !esTransferencia) {
      const canal = datos?.entrega === 'recoger' ? 'recoger' : 'domicilio'
      const mensaje = armarMensajePedido({
        restaurante: carta.restaurante.nombre,
        numero: resultado.numero,
        canal,
        cliente: datos?.nombre,
        telefono: datos?.telefono,
        direccion: datos?.entrega === 'domicilio' ? datos.direccion : null,
        zona: carta.zonas.find((z) => z.id === datos?.zona_id)?.nombre ?? null,
        indicaciones: datos?.indicaciones,
        items: [
          ...combos.map((c) => ({
            nombre: `${c.promo.titulo} (${c.contenido})`,
            cantidad: c.cantidad,
            total: c.precio * c.cantidad,
          })),
          ...lineas.map((l) => ({
            nombre: l.producto.nombre,
            cantidad: l.cantidad,
            total: l.producto.precio * l.cantidad,
            notas: l.notas,
          })),
        ],
        subtotal: resultado.subtotal,
        domicilio: resultado.domicilio,
        total: resultado.total,
        medioPago: datos?.medio ?? null,
        enCocina: canal === 'domicilio' && datos?.medio === 'efectivo',
      })
      // Si el navegador bloquea la ventana, el seguimiento ofrece el enlace de respaldo.
      window.open(enlacePedidoWhatsApp(numeroWa, mensaje), '_blank', 'noopener')
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
        logo={carta.restaurante.logo_url}
        mesa={mesa}
        slug={carta.restaurante.slug}
      />

      <BannerPromociones
        promociones={carta.promociones}
        productos={carta.productos}
        onAgregarCombo={agregarCombo}
      />

      <MenuCarta
        carta={carta}
        cantidadDe={(id) => lineas.find((l) => l.producto.id === id)?.cantidad ?? 0}
        onAgregar={agregar}
      />

      {unidades > 0 ? (
        <BarraPedido
          unidades={unidades}
          subtotal={subtotal}
          umbralEnvioGratis={umbralEnvioGratis}
          esMesa={!!mesa}
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
          // Editando ya tenemos sus datos y su forma de pago: se guarda directo.
          editando={editando !== null}
          onContinuar={() =>
            mesa || editando ? void enviar() : setVista('checkout')
          }
        />
      ) : null}
    </>
  )
}

function Encabezado({
  nombre,
  portada,
  logo,
  mesa,
  slug,
}: {
  nombre: string
  portada?: string | null
  logo?: string | null
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
        <LogoMarca className="size-24" url={logo} />
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

function HojaCarrito({
  lineas,
  combos,
  subtotal,
  mesa,
  editando,
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
  /** Se está editando un pedido ya hecho: el botón guarda en vez de continuar. */
  editando?: boolean
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
              'Guardando…'
            ) : editando ? (
              <>
                <IconoCheck className="size-5 shrink-0" />
                Guardar cambios
              </>
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
