'use client'

import { useEffect, useState } from 'react'

import { IconoAlerta, IconoBolsa, IconoCheck, IconoCopiar, IconoReloj } from '@/components/iconos'
import type { PedidoSeguimiento } from '@/lib/datos/pedido'
import { pasoDe, pasosVisibles, type EstadoPedido } from '@/lib/estados'
import { formatearPesos } from '@/lib/formato'
import { crearClienteConToken } from '@/lib/supabase/token'
import { armarMensajePedido, enlacePedidoWhatsApp } from '@/lib/mensaje-pedido'
import { modificarPedido } from './acciones'

type Props = {
  token: string
  slug: string
  inicial: PedidoSeguimiento
  pago: { llave: string | null; cuenta: string | null; whatsapp: string | null; restaurante: string }
}

export function SeguimientoCliente({ token, slug, inicial, pago }: Props) {
  const [pedido, setPedido] = useState(inicial)

  // El estado avanza en cocina/caja, no aquí. Se relee del servidor cada 15 s: la verdad
  // vive en Supabase y nunca se calcula desde el reloj del navegador.
  useEffect(() => {
    const supabase = crearClienteConToken(token)
    let vivo = true

    async function refrescar() {
      const { data } = await supabase
        .from('pedidos')
        .select('estado, subtotal, domicilio, total, monto_exacto, codigo_pago')
        .eq('token', token)
        .maybeSingle()
      if (vivo && data) setPedido((prev) => ({ ...prev, ...data }))
    }

    const id = setInterval(refrescar, 15000)
    return () => {
      vivo = false
      clearInterval(id)
    }
  }, [token])

  const estado = pedido.estado as EstadoPedido
  const anulado = estado === 'anulado'
  const esperandoPago = estado === 'esperando_pago'

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-marca-texto-suave">
          Pedido #{pedido.numero}
        </p>
        <h1 className="mt-2 font-titulo text-3xl font-bold text-marca-acento-fuerte">
          {anulado ? 'Pedido anulado' : esperandoPago ? 'Falta tu pago' : 'Seguimiento'}
        </h1>
      </header>

      {esperandoPago ? (
        <PanelTransferencia pedido={pedido} pago={pago} token={token} slug={slug} />
      ) : null}

      {anulado ? (
        <p className="mt-6 flex gap-2.5 rounded-lg border border-marca-acento bg-marca-superficie p-4 text-sm text-marca-texto">
          <IconoAlerta className="size-5 shrink-0 text-marca-acento-fuerte" />
          Este pedido fue anulado. Si crees que es un error, escríbenos.
        </p>
      ) : (
        <LineaEstados estado={estado} />
      )}

      <ResumenPedido pedido={pedido} />
    </main>
  )
}

function PanelTransferencia({
  pedido,
  pago,
  token,
  slug,
}: {
  pedido: PedidoSeguimiento
  pago: { llave: string | null; cuenta: string | null; whatsapp: string | null; restaurante: string }
  token: string
  slug: string
}) {
  return (
    <section className="mt-6 rounded-xl border border-marca-acento bg-marca-superficie p-5">
      <p className="flex items-center gap-2 text-marca-acento-fuerte">
        <IconoReloj className="size-5 shrink-0" />
        <span className="font-medium">Tu pedido aún no entra a cocina</span>
      </p>
      <p className="mt-2 text-sm text-marca-texto-suave">
        Transfiere el <strong className="text-marca-texto">valor exacto</strong> de abajo y{' '}
        <strong className="text-marca-texto">envía el pantallazo por WhatsApp</strong> con tu
        número de pedido. Apenas caja lo verifique, tu pedido entra a cocina.
      </p>

      <div className="mt-4 rounded-lg border border-marca-borde bg-marca-fondo p-4 text-center">
        <p className="text-sm text-marca-texto-suave">Valor exacto a transferir</p>
        <p className="mt-1 font-titulo text-4xl font-bold text-marca-acento-fuerte">
          {formatearPesos(pedido.total)}
        </p>
        <p className="mt-1 text-xs text-marca-texto-suave">
          Es el valor de tus platos y el domicilio, sin un peso de más.
        </p>
      </div>

      {pago.llave ? <DatoCopiable etiqueta="Llave / Nequi" valor={pago.llave} /> : null}
      {pago.cuenta ? <DatoCopiable etiqueta="Cuenta" valor={pago.cuenta} /> : null}

      {/* Un solo mensaje: el pedido completo, anunciando que el comprobante va enseguida. */}
      {pago.whatsapp ? (
        <a
          href={enlacePedidoWhatsApp(
            pago.whatsapp,
            armarMensajePedido({
              restaurante: pago.restaurante,
              numero: pedido.numero,
              canal: pedido.canal,
              cliente: pedido.cliente_nombre,
              direccion: pedido.direccion,
              items: pedido.items.map((i) => ({
                nombre: i.nombre_snap,
                cantidad: i.cantidad,
                total: i.precio_snap * i.cantidad,
              })),
              subtotal: pedido.subtotal,
              domicilio: pedido.domicilio,
              total: pedido.total,
              medioPago: pedido.medio_pago,
              avisaComprobante: true,
            }),
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-marca-acento font-semibold text-marca-acento-texto"
        >
          Enviar mi pedido y el comprobante
        </a>
      ) : null}

      {/* Todavía no ha pagado y nada entró a cocina: puede rehacerlo sin problema. */}
      <BotonModificar token={token} slug={slug} />
    </section>
  )
}

/**
 * "Modificar mi pedido": anula este (que nadie ha pagado ni preparado) y devuelve al
 * cliente a la carta con sus productos ya en el carrito, para que cambie lo que quiera.
 */
function BotonModificar({ token, slug }: { token: string; slug: string }) {
  const [confirmando, setConfirmando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function modificar() {
    setOcupado(true)
    setError(null)
    const r = await modificarPedido(token)
    if (!r.ok) {
      setError(r.error)
      setOcupado(false)
      return
    }
    // La carta lee esto al abrir y rearma el carrito con lo que ya había pedido.
    sessionStorage.setItem('carrito-recuperado', JSON.stringify(r.items))
    window.location.href = `/${slug}/menu`
  }

  if (!confirmando) {
    return (
      <>
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="mt-3 min-h-11 w-full rounded-lg border border-marca-borde text-sm text-marca-texto-suave"
        >
          Modificar mi pedido
        </button>
        {error ? (
          <p role="alert" className="mt-2 text-sm text-marca-acento-fuerte">
            {error}
          </p>
        ) : null}
      </>
    )
  }

  return (
    <div className="mt-3 rounded-lg border border-marca-borde p-3">
      <p className="text-sm text-marca-texto">
        Vuelves a la carta con tu pedido en el carrito para cambiar lo que quieras. Este
        pedido se anula y al confirmar te damos un número nuevo.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={modificar}
          disabled={ocupado}
          className="min-h-11 flex-1 rounded-lg bg-marca-acento text-sm font-semibold text-marca-acento-texto disabled:opacity-60"
        >
          {ocupado ? 'Un momento…' : 'Sí, modificar'}
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          disabled={ocupado}
          className="min-h-11 rounded-lg border border-marca-borde px-4 text-sm text-marca-texto-suave"
        >
          No
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-marca-acento-fuerte">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function DatoCopiable({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const [copiado, setCopiado] = useState(false)

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(valor)
          setCopiado(true)
          setTimeout(() => setCopiado(false), 2000)
        } catch {
          // Sin portapapeles (navegador viejo o sin permiso): el valor sigue a la vista.
        }
      }}
      className="mt-3 flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-marca-borde bg-marca-fondo px-4 text-left"
    >
      <span>
        <span className="block text-xs text-marca-texto-suave">{etiqueta}</span>
        <span className="block font-medium text-marca-texto">{valor}</span>
      </span>
      <span className="flex items-center gap-1.5 text-sm text-marca-acento-fuerte">
        {copiado ? (
          <>
            <IconoCheck className="size-4 shrink-0" />
            Copiado
          </>
        ) : (
          <>
            <IconoCopiar className="size-4 shrink-0" />
            Copiar
          </>
        )}
      </span>
    </button>
  )
}

function LineaEstados({ estado }: { estado: EstadoPedido }) {
  const pasos = pasosVisibles(estado)
  const actual = pasoDe(estado)

  return (
    <ol className="mt-8 space-y-0">
      {pasos.map((paso) => {
        const indice = pasoDe(paso.estado)
        const cumplido = actual >= 0 && indice < actual
        const activo = indice === actual

        return (
          <li key={paso.estado} className="flex gap-4">
            <div className="flex flex-col items-center">
              {/* El estado no se comunica solo con color: el paso cumplido lleva un check,
                  el activo un punto lleno, y el texto cambia de peso. */}
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 ${
                  cumplido
                    ? 'border-marca-acento bg-marca-acento'
                    : activo
                      ? 'border-marca-acento'
                      : 'border-marca-borde'
                }`}
              >
                {cumplido ? (
                  <IconoCheck className="size-4 text-marca-acento-texto" />
                ) : activo ? (
                  <span className="size-2.5 rounded-full bg-marca-acento" />
                ) : (
                  <span className="size-2.5 rounded-full bg-marca-borde" />
                )}
              </span>
              {paso.estado !== pasos[pasos.length - 1].estado ? (
                <span
                  className={`w-0.5 flex-1 ${cumplido ? 'bg-marca-acento' : 'bg-marca-borde'}`}
                  style={{ minHeight: '2rem' }}
                />
              ) : null}
            </div>

            <div className={`pb-6 ${activo || cumplido ? '' : 'opacity-50'}`}>
              <p
                className={`${
                  activo ? 'font-semibold text-marca-acento-fuerte' : 'font-medium text-marca-texto'
                }`}
              >
                {paso.titulo}
              </p>
              <p className="mt-0.5 text-sm text-marca-texto-suave">{paso.detalle}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function ResumenPedido({ pedido }: { pedido: PedidoSeguimiento }) {
  return (
    <section className="mt-8 rounded-xl border border-marca-borde bg-marca-superficie p-5">
      <h2 className="flex items-center gap-2 font-titulo text-lg text-marca-texto">
        <IconoBolsa className="size-5 shrink-0 text-marca-acento-fuerte" />
        Tu pedido
      </h2>

      <ul className="mt-4 space-y-2">
        {pedido.items.map((item, i) => (
          <li key={i} className="flex justify-between gap-3 text-sm">
            <span className="text-marca-texto">
              {item.cantidad} × {item.nombre_snap}
              {item.notas ? (
                <span className="mt-0.5 block text-xs text-marca-texto-suave">
                  {item.notas}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      <dl className="mt-4 space-y-1.5 border-t border-marca-borde pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-marca-texto-suave">Subtotal</dt>
          <dd className="text-marca-texto">{formatearPesos(pedido.subtotal)}</dd>
        </div>
        {pedido.domicilio > 0 ? (
          <div className="flex justify-between">
            <dt className="text-marca-texto-suave">Domicilio</dt>
            <dd className="text-marca-texto">{formatearPesos(pedido.domicilio)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-marca-borde pt-2 text-base">
          <dt className="font-medium text-marca-texto">Total</dt>
          <dd className="font-titulo text-lg font-bold text-marca-acento-fuerte">
            {formatearPesos(pedido.total)}
          </dd>
        </div>
      </dl>
    </section>
  )
}
