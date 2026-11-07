'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { IconoAlerta, IconoAnulado } from '@/components/iconos'
import { Segmentado } from '@/components/segmentado'
import { FichaCliente, FichaDireccion } from '@/components/ui/ficha-cliente'
import { Vacio } from '@/components/ui/vacio'
import { formatearPesos } from '@/lib/formato'

export type Anulado = {
  id: string
  numero: number
  creado_en: string
  anulado_en: string | null
  canal: string
  medio_pago: string | null
  total: number
  cliente: string | null
  telefono: string | null
  direccion: string | null
  zona: string | null
  mesa: number | null
  motivo: string | null
  quien: string | null
  items: { nombre: string; cantidad: number; precio: number }[]
}

const CANAL: Record<string, string> = {
  mesa: 'Mesa',
  domicilio: 'Domicilio',
  whatsapp: 'Domicilio',
  recoger: 'Para recoger',
  mostrador: 'Mostrador',
}

const MEDIO: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  datafono: 'Datáfono',
  pasarela: 'Pago en línea',
  mesa: 'En la mesa',
  mixto: 'Repartido',
}

const fmtFecha = new Intl.DateTimeFormat('es-CO', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'America/Bogota',
})

function fecha(iso: string): string {
  return fmtFecha.format(new Date(iso)).replace(/\./g, '')
}

export function AnuladosCliente({
  anulados,
  meses,
  mesSeleccionado,
  error,
}: {
  anulados: Anulado[]
  meses: { valor: string; etiqueta: string }[]
  mesSeleccionado: string
  error: string | null
}) {
  const router = useRouter()
  const total = anulados.reduce((s, a) => s + a.total, 0)

  return (
    <div className="space-y-5 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-marca-texto-suave">
          Solo tú ves esta lista. Caja, salón y cocina no ven los pedidos anulados ni pueden
          anular: si hay que anular uno, lo haces tú.
        </p>
        <Segmentado
          opciones={meses}
          valor={mesSeleccionado}
          onCambiar={(v) => router.push(`/app/admin/anulados?mes=${v}`)}
        />
      </div>

      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-5 shrink-0" />
          No se pudo cargar el registro: {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="tarjeta p-4">
          <p className="text-xs text-marca-texto-suave">Pedidos anulados</p>
          <p className="mt-1 font-titulo text-3xl font-bold tabular-nums text-marca-texto">
            {anulados.length}
          </p>
        </div>
        <div className="tarjeta p-4">
          <p className="text-xs text-marca-texto-suave">Lo que sumaban</p>
          <p className="mt-1 font-titulo text-3xl font-bold tabular-nums text-marca-texto">
            {formatearPesos(total)}
          </p>
        </div>
      </div>

      {anulados.length === 0 ? (
        <Vacio texto="No hay pedidos anulados en este mes." Icono={IconoAnulado} />
      ) : (
        <ul className="space-y-2.5">
          {anulados.map((a) => (
            <FilaAnulado key={a.id} a={a} />
          ))}
        </ul>
      )}
    </div>
  )
}

function FilaAnulado({ a }: { a: Anulado }) {
  const [abierto, setAbierto] = useState(false)
  const origen = a.mesa ? `Mesa ${a.mesa}` : (CANAL[a.canal] ?? a.canal)
  const unidades = a.items.reduce((s, i) => s + i.cantidad, 0)

  return (
    <li className="tarjeta overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex min-h-16 w-full items-center gap-3 p-4 text-left"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-marca-superficie-tenue text-[#9A3320]">
          <IconoAnulado className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold text-marca-texto">#{a.numero}</span>
            <span className="text-sm text-marca-texto">{origen}</span>
            {a.cliente ? (
              <span className="truncate text-sm text-marca-texto-suave">· {a.cliente}</span>
            ) : null}
          </span>
          <span className="block text-xs text-marca-texto-suave">
            Pedido {fecha(a.creado_en)}
            {a.quien ? ` · anuló ${a.quien}` : ''}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-semibold tabular-nums text-marca-texto line-through decoration-[#9A3320]/60">
            {formatearPesos(a.total)}
          </span>
          <span className="block text-xs text-marca-texto-suave">
            {unidades} {unidades === 1 ? 'producto' : 'productos'}
          </span>
        </span>
      </button>

      {abierto ? (
        <div className="space-y-3 border-t border-marca-borde px-4 py-3 text-sm">
          <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            <Dato t="Anulado" v={a.anulado_en ? fecha(a.anulado_en) : 'Sin hora registrada'} />
            <Dato t="Quién lo anuló" v={a.quien ?? 'No registrado'} />
            <Dato t="Motivo" v={a.motivo ?? 'Sin motivo'} />
            <Dato t="Pago" v={a.medio_pago ? (MEDIO[a.medio_pago] ?? a.medio_pago) : '—'} />
          </dl>
          <div className="flex flex-wrap gap-2">
            <FichaCliente nombre={a.cliente} telefono={a.telefono} />
            <FichaDireccion direccion={a.direccion} zona={a.zona} />
          </div>
          <ul className="divide-y divide-marca-borde rounded-lg border border-marca-borde">
            {a.items.map((i, k) => (
              <li key={k} className="flex justify-between gap-3 px-3 py-2">
                <span className="min-w-0 text-marca-texto">
                  <span className="font-semibold tabular-nums">{i.cantidad} ×</span> {i.nombre}
                </span>
                <span className="shrink-0 tabular-nums text-marca-texto-suave">
                  {formatearPesos(i.precio * i.cantidad)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  )
}

function Dato({ t, v }: { t: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 sm:block">
      <dt className="text-xs text-marca-texto-suave">{t}</dt>
      <dd className="text-marca-texto">{v}</dd>
    </div>
  )
}
