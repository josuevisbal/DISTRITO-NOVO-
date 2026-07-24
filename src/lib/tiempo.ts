/** "hace 3 min", "hace 1 h 05". Cuenta desde un instante del servidor hasta ahora. */
export function haceCuanto(desde: number, ahora: number): string {
  const seg = Math.max(0, Math.round((ahora - desde) / 1000))
  if (seg < 60) return 'hace un momento'
  const min = Math.floor(seg / 60)
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return `hace ${h} h ${String(m).padStart(2, '0')}`
}
