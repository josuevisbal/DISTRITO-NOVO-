'use client'

import { useState } from 'react'

import { IconoAlerta, IconoAtras } from '@/components/iconos'
import { pasoDe, pasosVisibles, type EstadoPedido } from '@/lib/estados'
import { crearClienteNavegador } from '@/lib/supabase/navegador'

type Resultado = { numero: number; estado: EstadoPedido } | null

/**
 * Consulta pública: número de pedido + teléfono → SOLO el estado. Nunca lista pedidos ni
 * muestra renglones: una consulta puntual por índice, que aguanta a mucha gente a la vez
 * sin exponer los pedidos de otros.
 */
export function ConsultaCliente({ slug }: { slug: string }) {
  const [numero, setNumero] = useState('')
  const [telefono, setTelefono] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultado, setResultado] = useState<Resultado>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  async function consultar(e: React.FormEvent) {
    e.preventDefault()
    setBuscando(true)
    setMensaje(null)
    setResultado(null)

    const supabase = crearClienteNavegador()
    const { data, error } = await supabase.rpc('estado_pedido_publico', {
      p_slug: slug,
      p_numero: Number(numero),
      p_tel: telefono,
    })

    setBuscando(false)
    if (error) {
      setMensaje('No pudimos consultar en este momento. Intenta de nuevo.')
      return
    }
    const r = data as unknown as Resultado
    if (!r) {
      setMensaje('No encontramos un pedido con ese número y ese teléfono.')
      return
    }
    setResultado(r)
  }

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <a
        href={`/${slug}`}
        className="-ml-2 flex min-h-11 w-fit items-center gap-1.5 rounded-lg px-2 text-marca-texto-suave"
      >
        <IconoAtras className="size-5" />
        Volver a la carta
      </a>

      <h1 className="mt-3 font-titulo text-3xl font-bold text-marca-acento-fuerte">
        Consultar mi pedido
      </h1>
      <p className="mt-2 text-sm text-marca-texto-suave">
        Escribe el número de tu pedido y el teléfono con el que lo hiciste.
      </p>

      <form onSubmit={consultar} className="mt-6 space-y-3">
        <label className="block">
          <span className="text-sm text-marca-texto-suave">Número de pedido</span>
          <input
            inputMode="numeric"
            required
            value={numero}
            onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
            placeholder="1024"
            className="mt-1.5 min-h-12 w-full rounded-lg border border-marca-borde bg-marca-superficie px-3 text-lg tabular-nums text-marca-texto placeholder:text-marca-texto-suave/50"
          />
        </label>
        <label className="block">
          <span className="text-sm text-marca-texto-suave">Teléfono</span>
          <input
            type="tel"
            required
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="300 123 4567"
            className="mt-1.5 min-h-12 w-full rounded-lg border border-marca-borde bg-marca-superficie px-3 text-lg text-marca-texto placeholder:text-marca-texto-suave/50"
          />
        </label>
        <button
          type="submit"
          disabled={buscando}
          className="min-h-13 w-full rounded-lg bg-marca-acento text-lg font-semibold text-marca-acento-texto disabled:opacity-60"
        >
          {buscando ? 'Consultando…' : 'Consultar'}
        </button>
      </form>

      {mensaje ? (
        <p role="alert" className="mt-4 flex gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-5 shrink-0" />
          {mensaje}
        </p>
      ) : null}

      {resultado ? (
        <section className="animate-subir mt-8 rounded-xl border border-marca-borde bg-marca-superficie p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-marca-texto-suave">
            Pedido #{resultado.numero}
          </p>
          {resultado.estado === 'anulado' ? (
            <p className="mt-3 text-marca-texto">Este pedido fue anulado.</p>
          ) : (
            <ol className="mt-4 space-y-2.5">
              {pasosVisibles(resultado.estado).map((paso) => {
                const actual = pasoDe(resultado.estado)
                const indice = pasoDe(paso.estado)
                const cumplido = actual >= 0 && indice < actual
                const activo = indice === actual
                return (
                  <li key={paso.estado} className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className={`size-3 rounded-full ${
                        cumplido || activo ? 'bg-marca-acento' : 'bg-marca-borde'
                      }`}
                    />
                    <span
                      className={
                        activo
                          ? 'font-semibold text-marca-acento-fuerte'
                          : cumplido
                            ? 'text-marca-texto'
                            : 'text-marca-texto-suave'
                      }
                    >
                      {paso.titulo}
                      {activo ? ' · aquí va' : ''}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      ) : null}
    </main>
  )
}
