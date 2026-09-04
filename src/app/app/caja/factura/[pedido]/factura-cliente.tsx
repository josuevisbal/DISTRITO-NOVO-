'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { LogoMarca } from '@/components/logo-marca'
import type { Factura } from '@/lib/datos/factura'
import { formatearPesos } from '@/lib/formato'

const NOMBRE_MEDIO: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  datafono: 'Datáfono',
  pasarela: 'Pasarela',
  mesa: 'Mesa',
  mixto: 'Pago repartido',
}

const NOMBRE_CANAL: Record<string, string> = {
  mesa: 'Mesa',
  domicilio: 'Domicilio',
  recoger: 'Para recoger',
  mostrador: 'Mostrador',
  whatsapp: 'WhatsApp',
}

/**
 * Factura para entregarle al cliente. Ancho de tirilla (80 mm) para que salga bien en
 * impresora térmica y también en hoja normal. Al abrirla manda a imprimir sola; los
 * botones no salen impresos.
 */
export function FacturaCliente({ factura, logo }: { factura: Factura; logo: string | null }) {
  const router = useRouter()

  // Se abre lista para imprimir: el cajero solo confirma en el diálogo.
  useEffect(() => {
    const id = setTimeout(() => window.print(), 400)
    return () => clearTimeout(id)
  }, [])

  const fecha = new Date(factura.creado_en).toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  const origen = factura.mesa
    ? `Mesa ${factura.mesa}`
    : (NOMBRE_CANAL[factura.canal] ?? factura.canal)

  return (
    <div className="min-h-screen bg-marca-fondo px-4 py-6">
      {/* Barra de acciones: no se imprime. */}
      <div className="no-imprimir mx-auto mb-4 flex max-w-[80mm] gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="min-h-11 flex-1 rounded-lg border border-marca-borde px-4 text-sm text-marca-texto"
        >
          Volver
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-11 flex-1 rounded-lg bg-marca-acento px-4 text-sm font-semibold text-marca-acento-texto"
        >
          Imprimir
        </button>
      </div>

      {/* Todo el tamaño de la tirilla cuelga de aquí: adentro las medidas van en `em`,
          así que subir esta base agranda la cuenta entera. En papel sube a 15,5 px
          (regla de impresión en globals.css), que es lo que se lee de un vistazo en una
          térmica de 58 mm. */}
      <article className="factura mx-auto max-w-[80mm] bg-white p-5 text-[13px] leading-snug text-[#111] shadow-sm">
        <header className="text-center">
          <div className="flex justify-center">
            <LogoMarca className="logo-tirilla size-20" url={logo} />
          </div>
          <h1 className="mt-2 text-[1.5em] font-bold leading-tight">
            {factura.restaurante.nombre}
          </h1>
          {factura.restaurante.whatsapp ? (
            <p className="text-[0.9em]">WhatsApp {factura.restaurante.whatsapp}</p>
          ) : null}
        </header>

        <hr className="my-3 border-dashed border-[#bbb]" />

        <div className="space-y-0.5 text-[0.95em]">
          <p className="text-[1.25em] font-bold">Pedido #{factura.numero}</p>
          <p suppressHydrationWarning>{fecha}</p>
          <p>{origen}</p>
          {factura.cliente ? <p>Cliente: {factura.cliente}</p> : null}
          {factura.telefono ? <p>Tel: {factura.telefono}</p> : null}
          {factura.direccion ? (
            <p>
              Dirección: {factura.direccion}
              {factura.zona ? ` · ${factura.zona}` : ''}
            </p>
          ) : null}
        </div>

        <hr className="my-3 border-dashed border-[#bbb]" />

        {/* En 58 mm no caben tres columnas: el nombre de un plato se parte a la mitad.
            Va la cantidad pegada al nombre y el valor a la derecha, sin partirse nunca.
            Es como se lee una tirilla de verdad. */}
        <div className="flex items-baseline justify-between border-b border-[#ddd] pb-1 text-[0.9em] font-semibold">
          <span>Producto</span>
          <span>Valor</span>
        </div>
        <ul className="mt-1 space-y-1.5 text-[0.95em]">
          {factura.items.map((i, n) => (
            <li key={n} className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 leading-snug">
                {i.cantidad > 1 ? (
                  <span className="font-semibold tabular-nums">{i.cantidad} × </span>
                ) : null}
                {i.nombre}
              </span>
              <span className="shrink-0 whitespace-nowrap tabular-nums">
                {formatearPesos(i.precio * i.cantidad)}
              </span>
            </li>
          ))}
        </ul>

        <hr className="my-3 border-dashed border-[#bbb]" />

        <dl className="space-y-1 text-[0.95em]">
          <Renglon termino="Subtotal" valor={formatearPesos(factura.subtotal)} />
          {factura.domicilio > 0 ? (
            <Renglon termino="Domicilio" valor={formatearPesos(factura.domicilio)} />
          ) : factura.canal === 'domicilio' ? (
            <Renglon termino="Domicilio" valor="Gratis" />
          ) : null}
          {/* La propina es voluntaria y va SIEMPRE aparte del total del consumo, para
              que el cliente vea qué pagó por la comida y qué dejó por el servicio. */}
          {factura.propina > 0 ? (
            <Renglon termino="Propina" valor={formatearPesos(factura.propina)} />
          ) : null}
          <div className="flex justify-between border-t border-[#ddd] pt-1.5 text-[1.5em] font-bold">
            <dt>TOTAL</dt>
            <dd className="tabular-nums">{formatearPesos(factura.total + factura.propina)}</dd>
          </div>
          {factura.medio_pago ? (
            <Renglon
              termino="Pago"
              valor={NOMBRE_MEDIO[factura.medio_pago] ?? factura.medio_pago}
            />
          ) : null}
        </dl>

        {/* Un solo pie, esté cobrada o no: el documento es el mismo. El aviso legal se
            queda porque esto no es factura electrónica. */}
        <p className="mt-4 border-t border-dashed border-[#bbb] pt-3 text-center text-[0.95em] leading-snug">
          ¡Gracias por tu compra!
          <br />
          <span className="font-bold">Este documento no es su factura de venta.</span>
        </p>
      </article>
    </div>
  )
}

function Renglon({ termino, valor }: { termino: string; valor: string }) {
  return (
    <div className="flex justify-between">
      <dt>{termino}</dt>
      <dd className="tabular-nums">{valor}</dd>
    </div>
  )
}
