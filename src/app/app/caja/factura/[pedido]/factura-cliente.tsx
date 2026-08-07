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

      <article className="factura mx-auto max-w-[80mm] bg-white p-5 text-[#111] shadow-sm">
        <header className="text-center">
          <div className="flex justify-center">
            <LogoMarca className="size-16" url={logo} />
          </div>
          <h1 className="mt-2 text-lg font-bold">{factura.restaurante.nombre}</h1>
          {factura.restaurante.direccion ? (
            <p className="text-[11px] leading-snug">{factura.restaurante.direccion}</p>
          ) : null}
          {factura.restaurante.whatsapp ? (
            <p className="text-[11px]">WhatsApp {factura.restaurante.whatsapp}</p>
          ) : null}
        </header>

        <hr className="my-3 border-dashed border-[#bbb]" />

        {/* Qué documento es: la cuenta que se lleva antes de pagar, o la factura ya
            cobrada. Se dice claro para que nadie confunda una con otra. */}
        <p
          className="mb-2 rounded border py-1 text-center text-[11px] font-bold uppercase tracking-wider"
          style={
            factura.pagado
              ? { borderColor: '#0F6E56', color: '#0F6E56', backgroundColor: '#E1F5EE' }
              : { borderColor: '#854F0B', color: '#854F0B', backgroundColor: '#FAEEDA' }
          }
        >
          {factura.pagado ? 'Pagado' : 'Cuenta de cobro · pendiente de pago'}
        </p>

        <div className="space-y-0.5 text-[11px]">
          <p className="text-sm font-bold">Pedido #{factura.numero}</p>
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

        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-[#ddd] text-left">
              <th className="pb-1 font-semibold">Producto</th>
              <th className="pb-1 text-center font-semibold">Cant</th>
              <th className="pb-1 text-right font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody>
            {factura.items.map((i, n) => (
              <tr key={n} className="align-top">
                <td className="py-1 pr-1 leading-snug">{i.nombre}</td>
                <td className="py-1 text-center tabular-nums">{i.cantidad}</td>
                <td className="py-1 text-right tabular-nums">
                  {formatearPesos(i.precio * i.cantidad)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <hr className="my-3 border-dashed border-[#bbb]" />

        <dl className="space-y-1 text-[11px]">
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
          <div className="flex justify-between border-t border-[#ddd] pt-1.5 text-base font-bold">
            <dt>TOTAL</dt>
            <dd className="tabular-nums">{formatearPesos(factura.total + factura.propina)}</dd>
          </div>
          {factura.medio_pago ? (
            <Renglon
              termino={factura.pagado ? 'Pagado con' : 'Va a pagar con'}
              valor={NOMBRE_MEDIO[factura.medio_pago] ?? factura.medio_pago}
            />
          ) : null}
        </dl>

        {factura.pagado ? (
          <p className="mt-4 text-center text-[11px] leading-snug">
            ¡Gracias por tu compra!
            <br />
            Te esperamos pronto.
          </p>
        ) : (
          <p className="mt-4 border-t border-dashed border-[#bbb] pt-3 text-center text-[11px] leading-snug">
            <span className="font-bold">Este documento no es su factura de venta.</span>
            <br />
            {factura.canal === 'domicilio' || factura.canal === 'whatsapp'
              ? 'Pague este valor al domiciliario al recibir.'
              : 'Presente esta cuenta en la caja para pagar.'}
          </p>
        )}
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
