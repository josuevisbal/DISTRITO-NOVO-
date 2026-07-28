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
  /** Barra lateral del panel (fondo oscuro de marca) y su acento. */
  panelLateral: string
  panelLateralTexto: string
  panelLateralTextoSuave: string
  panelLateralBorde: string
}

/**
 * Distrito Novo · blanco y dorado corporativo.
 * Toma la elegancia de la carta impresa (dorado sobre fondo sobrio, marcos, placas de
 * precio) pero en clave clara: se ve premium sin el tono oscuro que lucía informal.
 */
const TEMA_BASE: Tema = {
  fondo: '#FAFAFB', // gris muy claro del área de contenido del panel
  superficie: '#FFFFFF', // tarjetas
  superficieTenue: '#F4F4F6',
  borde: '#E7E5E0',
  texto: '#211D15', // casi negro, cálido
  textoSuave: '#635B4B',
  acento: '#B8862B', // dorado de marca (bordes, rellenos, titulares)
  acentoFuerte: '#7C5E15', // dorado oscuro para texto sobre claro (contraste ≥ 4.5)
  acentoTexto: '#211D15', // texto sobre botón dorado
  // Sans-serif también en títulos: la serif solo es de la carta pública. Adentro (panel,
  // caja, cocina) la serif se ve informal, como de Word.
  fuenteTitulo: 'var(--fuente-texto)',
  fuenteTexto: 'var(--fuente-texto)',
  panelLateral: '#0B0B0C', // barra lateral oscura del panel
  panelLateralTexto: '#F1EDE3',
  panelLateralTextoSuave: '#A39C8D',
  panelLateralBorde: '#26242B',
}

/**
 * Distrito Novo · carta del cliente, negro y dorado premium.
 * La carta es la cara al comensal: el negro con dorado se ve elegante (como la carta
 * impresa), no informal. Los módulos internos usan el tema claro corporativo.
 * El dorado va más brillante porque vive sobre negro.
 */
export const TEMA_CARTA: Tema = {
  fondo: '#0B0B0C',
  superficie: '#16151A',
  superficieTenue: '#201E24',
  borde: '#34313B',
  texto: '#F4EFE4',
  textoSuave: '#A9A294',
  acento: '#D8AC4E', // dorado metálico brillante
  acentoFuerte: '#ECCB79', // dorado claro para TEXTO sobre negro (alto contraste)
  acentoTexto: '#0B0B0C', // texto sobre botón dorado
  fuenteTitulo: 'var(--fuente-titulo)',
  fuenteTexto: 'var(--fuente-texto)',
  panelLateral: '#0B0B0C',
  panelLateralTexto: '#F1EDE3',
  panelLateralTextoSuave: '#A39C8D',
  panelLateralBorde: '#26242B',
}

/**
 * Colores de marca que viven FUERA de los dos temas: la paleta de la landing
 * pública (Pantalla 1 "que vende"), los manifiestos de instalación y los acentos
 * sueltos del panel (KPIs, sugerencias de estación). Antes estaban escritos a
 * mano por el código; ahora dar de alta otro restaurante es tocar SOLO este archivo.
 */
export const MARCA = {
  /** Dorado de marca fuera de los temas: viewport, manifiesto del equipo, KPIs. */
  dorado: TEMA_BASE.acento,
  /** Dorado claro para texto sobre negro (títulos del login, avisos de promo). */
  doradoClaro: TEMA_CARTA.acentoFuerte,
  /** Naranja cálido de la landing y de acentos operativos ("en cocina", pasarela). */
  naranja: '#E0872B',
  naranjaClara: '#F0A93C',
  /** Negro cálido de la landing y del manifiesto del menú del cliente. */
  negro: '#141210',
  negroSuave: '#1E1915',
  /** Crema de la franja de beneficios de la landing. */
  crema: '#F6F1E7',
  /** Texto claro sobre el negro de la landing (los de la carta). */
  texto: TEMA_CARTA.texto,
  textoSuave: TEMA_CARTA.textoSuave,
  /** Fondo oscuro de la app del equipo (manifiesto). */
  fondoApp: TEMA_CARTA.fondo,
}

/** Degradado dorado de los botones destacados (entrar en el login). */
export const DEGRADADO_DORADO = `linear-gradient(100deg, ${TEMA_BASE.acento}, ${TEMA_CARTA.acentoFuerte} 50%, ${TEMA_BASE.acento})`
/** Texto sobre ese degradado. */
export const DEGRADADO_DORADO_TEXTO = '#1A1408'

/** Anillo del marco circular del logo (LogoMarca): dorado que gira hacia el fondo. */
export const DEGRADADO_LOGO = `conic-gradient(from 210deg, #D4A64A, ${MARCA.naranjaClara} 25%, rgba(212,166,74,0.12) 55%, ${TEMA_BASE.acento} 80%, #D4A64A)`

/** "R, G, B" de un color hex, para usarlo con alfa en CSS: rgba(var(--x-rgb), 0.5). */
export function hexARgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

/** El negro de la landing en "R, G, B": el velo del héroe (globals.css) lo necesita
 *  con distintas transparencias. La landing lo cuelga como variable CSS. */
export const MARCA_NEGRO_RGB = hexARgb(MARCA.negro)

const TEMAS: Record<string, Tema> = {
  'distrito-novo': TEMA_BASE,
}

const TEMAS_CARTA: Record<string, Tema> = {
  'distrito-novo': TEMA_CARTA,
}

/**
 * Logo de la marca (login, menú y landing). El archivo vive en /public con esta ruta;
 * se muestra en un marco circular que se degrada hacia el fondo, así que sirve incluso
 * la foto del logo en la pared. Si el archivo no existe aún, LogoMarca cae sola al
 * monograma vectorial. Única referencia: otro cliente cambia su logo sin tocar código.
 */
export const LOGO_URL: string | null = '/logo.jpg'

/** Tema de los módulos internos (staff): blanco y dorado corporativo. */
export function obtenerTema(slug: string): Tema {
  return TEMAS[slug] ?? TEMA_BASE
}

/** Tema de la carta pública del comensal: negro y dorado premium. */
export function obtenerTemaCarta(slug: string): Tema {
  return TEMAS_CARTA[slug] ?? TEMA_CARTA
}

/**
 * Tema de las pantallas de operación de pie (cocina y domiciliario): la paleta oscura de
 * la carta pero con tipografía de interfaz — la serif es solo de cara al comensal.
 */
const TEMA_OPERACION: Tema = {
  ...TEMA_CARTA,
  fuenteTitulo: 'var(--fuente-texto)',
}

export function obtenerTemaOperacion(): Tema {
  return TEMA_OPERACION
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
    '--panel-lateral': tema.panelLateral,
    '--panel-lateral-texto': tema.panelLateralTexto,
    '--panel-lateral-texto-suave': tema.panelLateralTextoSuave,
    '--panel-lateral-borde': tema.panelLateralBorde,
  } as CSSProperties
}
