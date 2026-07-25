/**
 * Zona horaria del negocio. Configurable por instancia (variable de entorno), con Bogotá
 * por defecto: el "día" de ventas del Tablero es el día del restaurante, no el de UTC
 * (a las 7 p. m. en Barranquilla ya es mañana en UTC y las ventas se irían al día
 * equivocado).
 */
const ZONA = process.env.ZONA_HORARIA ?? 'America/Bogota'

/** Medianoche de HOY en la zona del negocio, como instante UTC (ISO). */
export function inicioDeHoyISO(): string {
  const ahora = new Date()
  // Reloj de pared del negocio interpretado como fecha local del servidor…
  const pared = new Date(ahora.toLocaleString('en-US', { timeZone: ZONA }))
  // …su medianoche…
  const inicioPared = new Date(pared)
  inicioPared.setHours(0, 0, 0, 0)
  // …y el corrimiento real entre ambos relojes la devuelve a UTC.
  const corrimiento = ahora.getTime() - pared.getTime()
  return new Date(inicioPared.getTime() + corrimiento).toISOString()
}

/** Nombre del día de hoy en español, para el subtítulo del Tablero. */
export function nombreDeHoy(): string {
  return new Intl.DateTimeFormat('es-CO', { weekday: 'long', timeZone: ZONA }).format(new Date())
}

/** Zona configurada, para pasarla a funciones de la base que agrupan por día local. */
export function zonaDelNegocio(): string {
  return ZONA
}

/** Año y mes actuales en la zona del negocio. */
export function mesActual(): { anio: number; mes: number } {
  const [anio, mes] = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .split('-')
    .map(Number)
  return { anio, mes }
}

/**
 * Rango [desde, hasta) de un mes calendario en la zona del negocio, como instantes UTC.
 * Se apoya en el mismo truco de `inicioDeHoyISO`: reloj de pared + corrimiento real.
 */
export function rangoDeMesISO(anio: number, mes: number): { desde: string; hasta: string } {
  const medianocheLocal = (a: number, m: number) => {
    // Instante aproximado del inicio del mes interpretado como UTC…
    const aproximado = new Date(Date.UTC(a, m - 1, 1, 0, 0, 0))
    // …reloj de pared del negocio en ese instante…
    const pared = new Date(aproximado.toLocaleString('en-US', { timeZone: ZONA }))
    // …y el corrimiento devuelve la medianoche local exacta a UTC.
    return new Date(aproximado.getTime() + (aproximado.getTime() - pared.getTime()))
  }
  const siguiente = mes === 12 ? { a: anio + 1, m: 1 } : { a: anio, m: mes + 1 }
  return {
    desde: medianocheLocal(anio, mes).toISOString(),
    hasta: medianocheLocal(siguiente.a, siguiente.m).toISOString(),
  }
}

/** Nombre corto del mes en español ("julio", "junio"). */
export function nombreDeMes(mes: number): string {
  return new Intl.DateTimeFormat('es-CO', { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2000, mes - 1, 15)),
  )
}
