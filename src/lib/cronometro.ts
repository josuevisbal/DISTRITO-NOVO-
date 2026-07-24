export type Semaforo = 'verde' | 'amarillo' | 'rojo'

export type EstadoCronometro = {
  semaforo: Semaforo
  /** Segundos que faltan para el objetivo; negativo si ya se pasó. */
  restanteSeg: number
  etiqueta: string
}

/**
 * Calcula el semáforo de un ticket desde tiempos del **servidor**.
 *
 * `disparoEn` y `objetivoEn` vienen de la base (disparo_en y disparo_en + minutos). `ahora`
 * es la hora del navegador **ya corregida** con el desfase contra el servidor: nunca se mide
 * el tiempo con el reloj del navegador a secas, porque cada tablet tiene su propia hora.
 *
 * - verde  mientras va holgado
 * - amarillo al llegar al 80 % del tiempo comprometido
 * - rojo    al pasarse del objetivo
 */
export function calcularCronometro(
  disparoEn: number,
  objetivoEn: number,
  ahora: number,
): EstadoCronometro {
  const total = Math.max(1, objetivoEn - disparoEn)
  const transcurrido = ahora - disparoEn
  const ratio = transcurrido / total
  const restanteSeg = Math.round((objetivoEn - ahora) / 1000)

  const semaforo: Semaforo = ratio >= 1 ? 'rojo' : ratio >= 0.8 ? 'amarillo' : 'verde'
  const etiqueta = semaforo === 'rojo' ? 'Atrasado' : semaforo === 'amarillo' ? 'Va cerca' : 'A tiempo'

  return { semaforo, restanteSeg, etiqueta }
}

/** Formatea segundos con signo como `m:ss` o `-m:ss`. */
export function formatearRestante(segundos: number): string {
  const signo = segundos < 0 ? '-' : ''
  const abs = Math.abs(segundos)
  const m = Math.floor(abs / 60)
  const s = abs % 60
  return `${signo}${m}:${String(s).padStart(2, '0')}`
}
