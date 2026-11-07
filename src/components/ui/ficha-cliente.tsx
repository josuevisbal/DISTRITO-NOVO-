import { IconoNota, IconoPin, IconoTelefono, IconoWhatsApp } from '@/components/iconos'
import { capitalizarNombre } from '@/lib/formato'
import { enlaceLlamar, enlaceWhatsApp } from '@/lib/telefono'

/**
 * Ficha del cliente: nombre y teléfono juntos en su propio recuadro sutil — se leen
 * como una unidad, no sueltos. El teléfono es tocable y abre WhatsApp para escribirle.
 * La usan todas las vistas que listan pedidos (pedidos en vivo, caja, pase).
 */
export function FichaCliente({
  nombre,
  telefono,
  className = '',
}: {
  nombre: string | null
  telefono: string | null
  className?: string
}) {
  if (!nombre && !telefono) return null
  return (
    <div className={`w-fit rounded-lg bg-marca-superficie-tenue px-2.5 py-1.5 ${className}`}>
      {nombre ? (
        <p className="text-sm font-medium leading-snug text-marca-texto">
          {capitalizarNombre(nombre)}
        </p>
      ) : null}
      {telefono ? (
        <a
          href={enlaceWhatsApp(telefono)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 flex min-h-6 items-center gap-1 text-xs font-medium text-[#0F6E56]"
        >
          <IconoWhatsApp className="size-3.5 shrink-0" />
          {telefono}
        </a>
      ) : null}
    </div>
  )
}

/**
 * Ficha de la dirección: el dato clave del domicilio, en su propio recuadro con el pin
 * en rojo. Calle en peso medio, barrio debajo en gris pequeño.
 */
export function FichaDireccion({
  direccion,
  zona,
  className = '',
}: {
  direccion: string | null
  zona: string | null
  className?: string
}) {
  if (!direccion && !zona) return null
  return (
    <div
      className={`flex w-fit items-start gap-1.5 rounded-lg bg-marca-superficie-tenue px-2.5 py-1.5 ${className}`}
    >
      <IconoPin className="mt-0.5 size-4 shrink-0 text-[#C2452F]" />
      <span className="sr-only">Dirección</span>
      <div>
        {direccion ? (
          <p className="text-sm font-medium leading-snug text-marca-texto">{direccion}</p>
        ) : null}
        {zona ? <p className="text-xs text-marca-texto-suave">{zona}</p> : null}
      </div>
    </div>
  )
}

export type DatosClientePedido = {
  nombre: string | null
  telefono: string | null
  direccion: string | null
  zona: string | null
  indicaciones: string | null
}

/**
 * Todos los datos del cliente de un pedido en una franja: nombre, teléfono con botones para
 * escribirle por WhatsApp o llamarlo, dirección con su barrio y las indicaciones. Es lo que
 * el equipo necesita para no perder un pedido aunque se pierda el mensaje de WhatsApp. La
 * usan caja, cocina y el domiciliario. Sin ningún dato (una mesa), no se pinta.
 */
export function TiraCliente({
  datos,
  className = '',
}: {
  datos: DatosClientePedido | null | undefined
  className?: string
}) {
  if (!datos) return null
  const { nombre, telefono, direccion, zona, indicaciones } = datos
  if (!nombre && !telefono && !direccion && !zona) return null
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-marca-borde bg-marca-superficie px-3 py-2 ${className}`}
    >
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-marca-texto-suave">
          Cliente
        </p>
        <p className="truncate text-sm font-semibold text-marca-texto">
          {nombre ? capitalizarNombre(nombre) : 'Sin nombre'}
        </p>
      </div>

      {telefono ? (
        <div className="flex items-center gap-1.5">
          <span className="text-sm tabular-nums text-marca-texto">{telefono}</span>
          <a
            href={enlaceWhatsApp(telefono)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Escribir por WhatsApp al ${telefono}`}
            className="grid size-11 place-items-center rounded-lg text-[#0F6E56] hover:bg-marca-superficie-tenue"
          >
            <IconoWhatsApp className="size-5" />
          </a>
          <a
            href={enlaceLlamar(telefono)}
            aria-label={`Llamar al ${telefono}`}
            className="grid size-11 place-items-center rounded-lg text-marca-texto hover:bg-marca-superficie-tenue"
          >
            <IconoTelefono className="size-5" />
          </a>
        </div>
      ) : (
        <span className="text-xs text-marca-texto-suave">Sin teléfono</span>
      )}

      {direccion || zona ? (
        <div className="flex min-w-0 items-start gap-1.5">
          <IconoPin className="mt-0.5 size-4 shrink-0 text-[#C2452F]" />
          <span className="sr-only">Dirección</span>
          <p className="min-w-0 text-sm leading-snug text-marca-texto">
            {direccion ? <span className="font-medium">{direccion}</span> : null}
            {zona ? (
              <span className="text-marca-texto-suave">
                {direccion ? ' · ' : ''}
                {zona}
              </span>
            ) : null}
          </p>
        </div>
      ) : null}

      {indicaciones ? (
        <div className="flex w-full min-w-0 items-start gap-1.5 text-sm text-marca-texto-suave">
          <IconoNota className="mt-0.5 size-4 shrink-0" />
          <span className="sr-only">Indicaciones</span>
          <p className="min-w-0">{indicaciones}</p>
        </div>
      ) : null}
    </div>
  )
}
