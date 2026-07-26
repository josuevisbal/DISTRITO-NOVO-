import { IconoPin, IconoWhatsApp } from '@/components/iconos'
import { capitalizarNombre } from '@/lib/formato'
import { enlaceWhatsApp } from '@/lib/telefono'

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
