import type { CSSProperties } from 'react'

/**
 * Único lugar donde vive la marca de un cliente.
 * Los componentes NO llevan colores: leen los tokens que expone `variablesTema`.
 * Para dar de alta otro restaurante basta con agregar su entrada aquí.
 */
export type Tema = {
  fondo: string
  superficie: string
  borde: string
  texto: string
  textoSuave: string
  acento: string
  acentoTexto: string
  fuenteTitulo: string
  fuenteTexto: string
}

const TEMA_BASE: Tema = {
  fondo: '#0B0B0C',
  superficie: '#151517',
  borde: '#2A2A2E',
  texto: '#F5F3EE',
  textoSuave: '#B6B2A8',
  acento: '#D4A64A',
  acentoTexto: '#0B0B0C',
  fuenteTitulo: 'var(--fuente-titulo)',
  fuenteTexto: 'var(--fuente-texto)',
}

const TEMAS: Record<string, Tema> = {
  'distrito-novo': TEMA_BASE,
}

export function obtenerTema(slug: string): Tema {
  return TEMAS[slug] ?? TEMA_BASE
}

/** Convierte el tema en variables CSS para colgarlas de un contenedor. */
export function variablesTema(tema: Tema): CSSProperties {
  return {
    '--marca-fondo': tema.fondo,
    '--marca-superficie': tema.superficie,
    '--marca-borde': tema.borde,
    '--marca-texto': tema.texto,
    '--marca-texto-suave': tema.textoSuave,
    '--marca-acento': tema.acento,
    '--marca-acento-texto': tema.acentoTexto,
    '--marca-fuente-titulo': tema.fuenteTitulo,
    '--marca-fuente-texto': tema.fuenteTexto,
  } as CSSProperties
}
