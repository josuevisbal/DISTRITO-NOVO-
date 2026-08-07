'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Aviso sonoro para las pantallas que hay que atender de inmediato: el mesero cuando
 * entra un pedido por QR o cuando cocina deja algo listo, y caja cuando llega un
 * domicilio por confirmar.
 *
 * El sonido se sintetiza con Web Audio: dos tonos cortos, sin archivo que descargar y
 * sin depender de la conexión. Los navegadores no dejan sonar nada hasta que la persona
 * toca la pantalla, así que el contexto se crea en el primer toque y la pantalla muestra
 * un botón para activarlo cuando todavía no está listo.
 */

let contexto: AudioContext | null = null

function obtenerContexto(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!contexto) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    contexto = new Ctor()
  }
  return contexto
}

/** Dos notas cortas, audibles por encima del ruido de una cocina y nada estridentes. */
function sonar() {
  const ctx = obtenerContexto()
  if (!ctx || ctx.state !== 'running') return

  const notas = [880, 1174.7]
  notas.forEach((frecuencia, i) => {
    const osc = ctx.createOscillator()
    const vol = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = frecuencia
    const desde = ctx.currentTime + i * 0.18
    vol.gain.setValueAtTime(0.0001, desde)
    vol.gain.exponentialRampToValueAtTime(0.25, desde + 0.02)
    vol.gain.exponentialRampToValueAtTime(0.0001, desde + 0.16)
    osc.connect(vol).connect(ctx.destination)
    osc.start(desde)
    osc.stop(desde + 0.18)
  })
}

export type Aviso = {
  /** El navegador ya dejó sonar: no hace falta mostrar el botón de activar. */
  listo: boolean
  /** Enciende el sonido. Va en un botón porque exige un toque de la persona. */
  activar: () => void
}

/**
 * Suena (y vibra) cada vez que `cantidad` sube. No suena en la primera carga: solo
 * cuando algo NUEVO aparece mientras la pantalla está abierta.
 */
export function useAviso(cantidad: number): Aviso {
  const anterior = useRef<number | null>(null)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    setListo(obtenerContexto()?.state === 'running')
  }, [])

  // Cualquier toque en la pantalla sirve para desbloquear el audio.
  useEffect(() => {
    if (listo) return
    function despertar() {
      const ctx = obtenerContexto()
      if (!ctx) return
      void ctx.resume().then(() => setListo(ctx.state === 'running'))
    }
    window.addEventListener('pointerdown', despertar, { once: true })
    return () => window.removeEventListener('pointerdown', despertar)
  }, [listo])

  useEffect(() => {
    const previo = anterior.current
    anterior.current = cantidad
    if (previo === null || cantidad <= previo) return
    sonar()
    navigator.vibrate?.([120, 60, 120])
  }, [cantidad])

  const activar = useCallback(() => {
    const ctx = obtenerContexto()
    if (!ctx) return
    void ctx.resume().then(() => {
      setListo(ctx.state === 'running')
      sonar()
    })
  }, [])

  return { listo, activar }
}
