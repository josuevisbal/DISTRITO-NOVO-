import type { CSSProperties } from 'react'

/**
 * Único lugar donde vive la marca de un cliente.
 * Los componentes NO llevan colores: leen los tokens que expone `variablesTema`.
 * Para dar de alta otro restaurante basta con agregar su entrada aquí.
 */
export type Tema = {
  fondo: string
  superficie: string
  /** Superficie apenas teñida, para zonas secundarias sin cargar el blanco puro. */
  superficieTenue: string
  borde: string
  texto: string
  textoSuave: string
  /** Dorado de marca: rellenos, bordes y titulares grandes. */
  acento: string
  /** Dorado oscuro (antiguo) para TEXTO dorado pequeño sobre claro, con contraste. */
  acentoFuerte: string
  acentoTexto: string
  fuenteTitulo: string
  fuenteTexto: string
}

/**
 * Distrito Novo · blanco y dorado corporativo.
 * Toma la elegancia de la carta impresa (dorado sobre fondo sobrio, marcos, placas de
 * precio) pero en clave clara: se ve premium sin el tono oscuro que lucía informal.
 */
const TEMA_BASE: Tema = {
  fondo: '#F6F3EC', // marfil cálido
  superficie: '#FFFFFF', // tarjetas
  superficieTenue: '#FBF9F3',
  borde: '#E6DFCE',
  texto: '#211D15', // casi negro, cálido
  textoSuave: '#635B4B',
  acento: '#B8862B', // dorado de marca (bordes, rellenos, titulares)
  acentoFuerte: '#7C5E15', // dorado oscuro para texto sobre claro (contraste ≥ 4.5)
  acentoTexto: '#211D15', // texto sobre botón dorado
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
    '--marca-superficie-tenue': tema.superficieTenue,
    '--marca-borde': tema.borde,
    '--marca-texto': tema.texto,
    '--marca-texto-suave': tema.textoSuave,
    '--marca-acento': tema.acento,
    '--marca-acento-fuerte': tema.acentoFuerte,
    '--marca-acento-texto': tema.acentoTexto,
    '--marca-fuente-titulo': tema.fuenteTitulo,
    '--marca-fuente-texto': tema.fuenteTexto,
  } as CSSProperties
}
