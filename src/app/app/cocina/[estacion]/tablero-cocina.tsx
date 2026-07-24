'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { IconoAlerta, IconoCheck, IconoReloj } from '@/components/iconos'
import { calcularCronometro, formatearRestante, type Semaforo } from '@/lib/cronometro'
import { crearClienteNavegador } from '@/lib/supabase/navegador'
import { cambiarDisponibilidad, cambiarEstadoComanda } from '../../acciones'

export type ItemComanda = {
  producto_id: string
  nombre: string
  cantidad: number
  notas: string | null
}

export type Ticket = {
  comanda_id: string
  numero: number
  mesa: number | null
  canal: string
  estado: 'pendiente' | 'preparando' | 'listo' | 'cancelada'
  disparo_en: string
  objetivo_en: string
  items: ItemComanda[]
}

type Props = {
  tickets: Ticket[]
  color: string
  /** Hora del servidor al armar la página, para corregir el desfase del reloj local. */
  servidorAhoraISO: string
}

/** Colores del semáforo: fijos del sistema (no de marca), con texto e ícono que acompañan. */
const SEMAFORO: Record<Semaforo, { fondo: string; borde: string; texto: string }> = {
  verde: { fondo: '#0f2e22', borde: '#2E9E8F', texto: '#7ee3cf' },
  amarillo: { fondo: '#3a2f05', borde: '#E0B02B', texto: '#f4d873' },
  rojo: { fondo: '#3a1010', borde: '#E0552B', texto: '#f6a58c' },
}

export function TableroCocina({ tickets, color, servidorAhoraISO }: Props) {
  const router = useRouter()

  // Desfase entre el reloj del servidor y el del navegador, medido una vez al montar.
  // Todos los cronómetros se calculan con la hora corregida, no con la del navegador.
  const desfaseRef = useRef(0)
  useEffect(() => {
    desfaseRef.current = new Date(servidorAhoraISO).getTime() - Date.now()
  }, [servidorAhoraISO])

  // Un tic por segundo mueve los cronómetros; los datos vienen del servidor por Realtime.
  const [, setTic] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTic((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const [enLinea, setEnLinea] = useState(true)

  // Realtime + reintento periódico: así una comanda con disparo futuro aparece sola cuando
  // su hora pasa, sin cron. Si la conexión se cae, se avisa y se sigue reintentando.
  useEffect(() => {
    const supabase = crearClienteNavegador()
    const canal = supabase
      .channel('cocina-comandas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas' }, () =>
        router.refresh(),
      )
      .subscribe((estado) => {
        setEnLinea(estado === 'SUBSCRIBED')
      })

    const id = setInterval(() => router.refresh(), 15000)
    return () => {
      supabase.removeChannel(canal)
      clearInterval(id)
    }
  }, [router])

  return (
    <>
      {!enLinea ? (
        <p className="flex items-center justify-center gap-2 bg-marca-superficie px-4 py-2 text-sm text-marca-texto">
          <IconoAlerta className="size-5 shrink-0 text-marca-acento" />
          Sin conexión. Reintentando… se muestra el último estado conocido.
        </p>
      ) : null}

      {tickets.length === 0 ? (
        <p className="mx-auto mt-24 max-w-sm px-6 text-center text-lg text-marca-texto-suave">
          Nada en preparación por ahora.
        </p>
      ) : (
        <ul className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {tickets.map((ticket) => (
            <TicketCocina
              key={ticket.comanda_id}
              ticket={ticket}
              color={color}
              desfaseRef={desfaseRef}
            />
          ))}
        </ul>
      )}
    </>
  )
}

function TicketCocina({
  ticket,
  color,
  desfaseRef,
}: {
  ticket: Ticket
  color: string
  desfaseRef: React.RefObject<number>
}) {
  const [ocupado, setOcupado] = useState(false)

  const ahora = Date.now() + desfaseRef.current
  const crono = calcularCronometro(
    new Date(ticket.disparo_en).getTime(),
    new Date(ticket.objetivo_en).getTime(),
    ahora,
  )
  const c = SEMAFORO[crono.semaforo]

  async function marcar(estado: 'preparando' | 'listo') {
    setOcupado(true)
    const r = await cambiarEstadoComanda(ticket.comanda_id, estado)
    if (!r.ok) setOcupado(false)
    // El refresco de Realtime reordena/retira el ticket; no apagamos `ocupado` en el éxito.
  }

  async function agotar(productoId: string) {
    setOcupado(true)
    await cambiarDisponibilidad(productoId, false)
    setOcupado(false)
  }

  return (
    <li
      className="flex flex-col rounded-2xl border-2 bg-marca-superficie"
      style={{ borderColor: color }}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <p className="font-titulo text-2xl font-bold text-marca-texto">
          {ticket.mesa ? `Mesa ${ticket.mesa}` : `#${ticket.numero}`}
        </p>

        {/* Semáforo: color + ícono + texto + tiempo. Nunca solo el color. */}
        <span
          className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm font-semibold tabular-nums"
          style={{ backgroundColor: c.fondo, borderColor: c.borde, color: c.texto }}
        >
          <IconoReloj className="size-4 shrink-0" />
          {crono.etiqueta} · {formatearRestante(crono.restanteSeg)}
        </span>
      </div>

      <ul className="flex-1 space-y-2 px-4 py-3">
        {ticket.items.map((item) => (
          <li key={item.producto_id} className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-lg text-marca-texto">
                <span className="font-bold">{item.cantidad}×</span> {item.nombre}
              </p>
              {item.notas ? (
                <p className="text-sm font-medium text-marca-acento">{item.notas}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => agotar(item.producto_id)}
              disabled={ocupado}
              className="min-h-11 shrink-0 rounded-lg border border-marca-borde px-2.5 text-xs text-marca-texto-suave disabled:opacity-50"
            >
              Agotar
            </button>
          </li>
        ))}
      </ul>

      <div className="p-3">
        {ticket.estado === 'pendiente' ? (
          <button
            type="button"
            onClick={() => marcar('preparando')}
            disabled={ocupado}
            className="min-h-14 w-full rounded-xl border-2 border-marca-acento text-lg font-semibold text-marca-acento disabled:opacity-60"
          >
            Empezar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => marcar('listo')}
            disabled={ocupado}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-marca-acento text-lg font-bold text-marca-acento-texto disabled:opacity-60"
          >
            <IconoCheck className="size-6 shrink-0" />
            Listo
          </button>
        )}
      </div>
    </li>
  )
}
