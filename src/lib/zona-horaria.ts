/**
 * Zona horaria y día de trabajo del negocio.
 *
 * La zona es configurable por instancia (variable de entorno), con Bogotá por defecto: a
 * las 7 p. m. en Barranquilla ya es mañana en UTC y las ventas se irían al día equivocado.
 *
 * El día de trabajo ("jornada") no termina a medianoche: lo vendido de madrugada cuenta
 * para el día anterior. Cada restaurante guarda su `hora_corte` (6 = la jornada va de las
 * 6 a. m. a las 6 a. m. del día siguiente). Aquí todo recibe esa hora; la base usa la
 * misma con `dia_jornada()`.
 */
const ZONA = process.env.ZONA_HORARIA ?? 'America/Bogota'

/** Hora de corte por defecto, si el restaurante no tiene una guardada. */
export const CORTE_POR_DEFECTO = 6

/** Zona configurada, para pasarla a funciones de la base que agrupan por día local. */
export function zonaDelNegocio(): string {
  return ZONA
}

/** Instante UTC de una hora local del negocio (año, mes 1-12, día, hora). */
export function instanteLocal(anio: number, mes: number, dia: number, hora = 0): Date {
  // Instante aproximado interpretado como UTC…
  const aproximado = new Date(Date.UTC(anio, mes - 1, dia, hora, 0, 0))
  // …reloj de pared del negocio en ese instante…
  const pared = new Date(aproximado.toLocaleString('en-US', { timeZone: ZONA }))
  const paredUtc = Date.UTC(
    pared.getFullYear(),
    pared.getMonth(),
    pared.getDate(),
    pared.getHours(),
    pared.getMinutes(),
  )
  // …y el corrimiento devuelve la hora local exacta a UTC.
  return new Date(aproximado.getTime() + (aproximado.getTime() - paredUtc))
}

/** Fecha (año, mes, día) del día de trabajo en curso. */
export function diaDeJornada(corte = CORTE_POR_DEFECTO, ahora = new Date()) {
  // Se resta la hora de corte y se lee la fecha local: a la 1 a. m. sigue siendo "ayer".
  const corrido = new Date(ahora.getTime() - corte * 3600 * 1000)
  const [anio, mes, dia] = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(corrido)
    .split('-')
    .map(Number)
  return { anio, mes, dia }
}

/** "AAAA-MM-DD" de una fecha de jornada. */
export function fechaISO(f: { anio: number; mes: number; dia: number }): string {
  return `${f.anio}-${String(f.mes).padStart(2, '0')}-${String(f.dia).padStart(2, '0')}`
}

/** Inicio del día de trabajo en curso, como instante UTC (ISO). */
export function inicioDeJornadaISO(corte = CORTE_POR_DEFECTO): string {
  const d = diaDeJornada(corte)
  return instanteLocal(d.anio, d.mes, d.dia, corte).toISOString()
}

/** Nombre del día de trabajo en curso en español, para el subtítulo del Tablero. */
export function nombreDeHoy(corte = CORTE_POR_DEFECTO): string {
  const d = diaDeJornada(corte)
  return new Intl.DateTimeFormat('es-CO', { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(d.anio, d.mes - 1, d.dia, 12)),
  )
}

/** Año y mes del día de trabajo en curso. */
export function mesActual(corte = CORTE_POR_DEFECTO): { anio: number; mes: number } {
  const d = diaDeJornada(corte)
  return { anio: d.anio, mes: d.mes }
}

/**
 * Rango [desde, hasta) de un mes en días de trabajo, como instantes UTC: del día 1 a la
 * hora de corte hasta el día 1 del mes siguiente a la hora de corte.
 */
export function rangoDeMesISO(
  anio: number,
  mes: number,
  corte = CORTE_POR_DEFECTO,
): { desde: string; hasta: string } {
  const siguiente = mes === 12 ? { a: anio + 1, m: 1 } : { a: anio, m: mes + 1 }
  return {
    desde: instanteLocal(anio, mes, 1, corte).toISOString(),
    hasta: instanteLocal(siguiente.a, siguiente.m, 1, corte).toISOString(),
  }
}

/** Nombre corto del mes en español ("julio", "junio"). */
export function nombreDeMes(mes: number): string {
  return new Intl.DateTimeFormat('es-CO', { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2000, mes - 1, 15)),
  )
}
