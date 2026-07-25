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
