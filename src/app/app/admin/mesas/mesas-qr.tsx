'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/**
 * QR por mesa para imprimir y pegar en el punto físico. El cliente lo escanea, pide desde
 * la mesa y el mesero solo confirma. La URL usa el origen actual del despliegue, así que
 * sirve tal cual en cualquier instancia sin configurar nada.
 */
export function MesasQr({
  mesas,
  slug,
  nombre,
}: {
  mesas: { id: string; numero: number; qr_token: string }[]
  slug: string
  nombre: string
}) {
  const [qrs, setQrs] = useState<Record<string, string>>({})

  useEffect(() => {
    let vivo = true
    async function generar() {
      const salida: Record<string, string> = {}
      for (const m of mesas) {
        const url = `${window.location.origin}/${slug}/mesa/${m.qr_token}`
        salida[m.id] = await QRCode.toDataURL(url, {
          width: 480,
          margin: 1,
          color: { dark: '#0B0B0C', light: '#FFFFFF' },
        })
      }
      if (vivo) setQrs(salida)
    }
    void generar()
    return () => {
      vivo = false
    }
  }, [mesas, slug])

  return (
    <div className="space-y-4">
      <div className="no-imprimir flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-marca-texto-suave">
          Imprime esta hoja y pega el QR de cada mesa. El cliente escanea, pide, y el mesero
          solo confirma.
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-11 rounded-lg bg-marca-acento px-4 font-medium text-marca-acento-texto"
        >
          Imprimir QRs
        </button>
      </div>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        {mesas.map((m) => (
          <li
            key={m.id}
            className="tarjeta entra flex flex-col items-center gap-2 p-4 text-center print:break-inside-avoid"
          >
            <p className="text-lg font-bold text-marca-texto">{nombre}</p>
            {qrs[m.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrs[m.id]} alt={`QR de la mesa ${m.numero}`} className="w-full max-w-44" />
            ) : (
              <span className="flex aspect-square w-full max-w-44 items-center justify-center text-xs text-marca-texto-suave">
                Generando…
              </span>
            )}
            <p className="text-xl font-bold text-marca-texto">Mesa {m.numero}</p>
            <p className="text-xs text-marca-texto-suave">Escanea para pedir</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
