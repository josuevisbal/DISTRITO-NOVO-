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

/**
 * Formatea segundos con signo. Menos de una hora: `m:ss` (cuenta regresiva legible).
 * Una hora o más: `1 h 14 min`, para que un atraso grande nunca se lea como "674:32".
 */
export function formatearRestante(segundos: number): string {
  const signo = segundos < 0 ? '-' : ''
  const abs = Math.abs(segundos)
  const m = Math.floor(abs / 60)
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const mm = m % 60
    return `${signo}${h} h ${String(mm).padStart(2, '0')} min`
  }
  const s = abs % 60
  return `${signo}${m}:${String(s).padStart(2, '0')}`
}
