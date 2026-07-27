import Link from 'next/link'

import {
  IconoBolsa,
  IconoCorazon,
  IconoCubiertos,
  IconoDestello,
  IconoFloritura,
  IconoFuego,
  IconoMoto,
  IconoPin,
  IconoReloj,
  IconoTelefono,
} from '@/components/iconos'
import { LogoMarca } from '@/components/logo-marca'
import type { Carta } from '@/lib/datos/carta'
import { formatearPesos } from '@/lib/formato'
import { enlaceWhatsApp } from '@/lib/telefono'

/**
 * Pantalla 1 — la bienvenida que VENDE (estilo landing de referencia): héroe con el
 * plato estrella flotando sobre el negro, franja crema de beneficios, promociones y
 * los especiales de la casa. Dos puertas: "Ver el menú" (pedir) y "Consultar mi pedido".
 *
 * Paleta propia de la landing (negro cálido + naranja de la referencia, con toques del
 * dorado de marca). Las fotos las sube el admin: portada_url es el plato del héroe y
 * productos.foto_url alimenta los especiales (los `destacado`).
 */
const NEGRO = '#141210'
const NEGRO_SUAVE = '#1E1915'
const NARANJA = '#E0872B'
const NARANJA_CLARO = '#F0A93C'
const CREMA = '#F6F1E7'
const TEXTO = '#F4EFE4'
const TEXTO_SUAVE = '#A9A294'

/** Textos de plantilla: lo que se ve si el admin no ha escrito los suyos. */
const POR_DEFECTO = {
  script: 'Del carbón a tu mesa',
  titulo_blanco: 'BUENA COMIDA',
  titulo_naranja: 'BUEN SABOR',
  bienvenida:
    'Platos hechos al momento con ingredientes frescos, servidos con amor. Pide y te lo llevamos caliente hasta tu puerta.',
  nosotros_titulo: 'Un lugar donde la buena comida y los buenos momentos se encuentran',
  nosotros_texto:
    'Creemos que cada comida es una experiencia. Del ambiente a los platos, estamos para hacer tus momentos memorables.',
  dato: '10+',
  dato_texto: 'Años de experiencia',
}

export function LandingCliente({ carta }: { carta: Carta }) {
  const { restaurante } = carta
  const base = `/${restaurante.slug}`
  // Lo que escribió el admin manda; si está vacío, el texto de plantilla.
  const t = { ...POR_DEFECTO, ...restaurante.landing }

  const umbralEnvio =
    carta.promociones.find((p) => p.tipo === 'envio')?.monto_minimo ?? null
  // Con foto primero; sin fotos igual se muestran con su marcador elegante.
  const especiales = [...carta.productos.filter((p) => p.destacado)]
    .sort((a, b) => Number(Boolean(b.foto_url)) - Number(Boolean(a.foto_url)))
    .slice(0, 3)
  const promos = carta.promociones.slice(0, 3)
  const colorEstacion = new Map(carta.estaciones.map((e) => [e.id, e.color]))

  return (
    <div style={{ backgroundColor: NEGRO, color: TEXTO }} className="min-h-screen">
      {/* ----- Barra superior ----- */}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href={base} className="flex items-center gap-3">
          <LogoMarca className="size-12" />
          <span className="hidden font-titulo text-lg font-bold sm:block">
            {restaurante.nombre}
          </span>
        </Link>

        <nav aria-label="Secciones" className="hidden items-center gap-6 text-sm md:flex">
          <a href="#inicio" style={{ color: NARANJA_CLARO }} className="font-semibold">
            Inicio
          </a>
          <Link href={`${base}/menu`} className="transition-colors hover:text-white" style={{ color: TEXTO_SUAVE }}>
            Menú
          </Link>
          <a href="#especiales" className="transition-colors hover:text-white" style={{ color: TEXTO_SUAVE }}>
            Especiales
          </a>
          <Link href={`${base}/consulta`} className="transition-colors hover:text-white" style={{ color: TEXTO_SUAVE }}>
            Mi pedido
          </Link>
        </nav>

        <Link
          href={`${base}/menu`}
          className="flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-bold transition-transform hover:scale-[1.03] motion-reduce:transform-none"
          style={{ backgroundColor: NARANJA, color: NEGRO }}
        >
          <IconoBolsa className="size-4 shrink-0" />
          Pedir ahora
        </Link>
      </header>

      {/* ----- Héroe ----- */}
      <section id="inicio" className="relative overflow-hidden">
        {/* La foto del plato estrella, full-bleed a la derecha y fundida al negro con
            degradados (nada de marcos): como la referencia. */}
        {restaurante.portada_url || restaurante.hero_video_url ? (
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-[55%] md:block">
            <FondoHero
              foto={restaurante.portada_url}
              video={restaurante.hero_video_url}
              nombre={restaurante.nombre}
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(90deg, ${NEGRO} 8%, transparent 55%), linear-gradient(180deg, ${NEGRO} 0%, transparent 35%), linear-gradient(0deg, ${NEGRO} 0%, transparent 40%)`,
              }}
            />
          </div>
        ) : null}

        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-8 sm:px-8 md:min-h-[520px] md:grid-cols-2 md:pt-14">
        <div className="entra relative z-10" style={{ '--i': 0 } as React.CSSProperties}>
          <p
            className="text-3xl"
            style={{ fontFamily: 'var(--fuente-script)', color: NARANJA_CLARO }}
          >
            {t.script}
          </p>
          <h1 className="mt-2 text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl">
            {t.titulo_blanco}
            <br />
            <span style={{ color: NARANJA }}>{t.titulo_naranja}</span>
          </h1>

          <p className="mt-4 flex items-center gap-3" style={{ color: NARANJA }}>
            <IconoFloritura className="h-3 w-14 opacity-80" />
            <IconoCorazon className="size-4" />
            <IconoFloritura className="h-3 w-14 -scale-x-100 opacity-80" />
          </p>

          <p className="mt-4 max-w-md text-sm leading-relaxed" style={{ color: TEXTO_SUAVE }}>
            {t.bienvenida}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={`${base}/menu`}
              className="flex min-h-12 items-center gap-2 rounded-full px-6 font-bold transition-transform hover:scale-[1.03] motion-reduce:transform-none"
              style={{ backgroundColor: NARANJA, color: NEGRO }}
            >
              Ver el menú
              <span aria-hidden>→</span>
            </Link>
            <Link
              href={`${base}/consulta`}
              className="flex min-h-12 items-center rounded-full border px-6 font-medium transition-colors hover:border-white"
              style={{ borderColor: 'rgba(244,239,228,0.35)', color: TEXTO }}
            >
              Consultar mi pedido
            </Link>
          </div>
        </div>

        {/* En celular va debajo del texto, también fundida al negro. */}
        {restaurante.portada_url || restaurante.hero_video_url ? (
          <div className="entra relative -mx-5 h-72 sm:-mx-8 md:hidden" style={{ '--i': 1 } as React.CSSProperties}>
            <FondoHero
              foto={restaurante.portada_url}
              video={restaurante.hero_video_url}
              nombre={restaurante.nombre}
            />
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background: `linear-gradient(180deg, ${NEGRO} 0%, transparent 30%), linear-gradient(0deg, ${NEGRO} 0%, transparent 35%)`,
              }}
            />
          </div>
        ) : (
          <div
            aria-hidden
            className="mx-auto flex size-64 items-center justify-center rounded-full md:hidden"
            style={{ backgroundColor: NEGRO_SUAVE }}
          >
            <IconoCubiertos className="size-24 opacity-40" />
          </div>
        )}
        </div>
      </section>

      {/* ----- Franja de beneficios (tarjeta crema) ----- */}
      <section aria-label="Por qué pedir aquí" className="mx-auto max-w-6xl px-5 sm:px-8">
        <div
          className="entra grid grid-cols-2 gap-6 rounded-3xl p-6 sm:p-8 md:grid-cols-4"
          style={{ backgroundColor: CREMA, color: '#211D15', '--i': 2 } as React.CSSProperties}
        >
          <Beneficio
            Icono={IconoFuego}
            titulo="A la parrilla"
            detalle="Asados al carbón y comida hecha al momento."
          />
          <Beneficio
            Icono={IconoReloj}
            titulo="Rápido"
            detalle="Tu pedido entra directo a cocina al confirmarse."
          />
          <Beneficio
            Icono={IconoMoto}
            titulo="Domicilio"
            detalle={
              umbralEnvio
                ? `Gratis en pedidos desde ${formatearPesos(umbralEnvio)}.`
                : 'Te lo llevamos caliente a tu puerta.'
            }
          />
          <Beneficio
            Icono={IconoCorazon}
            titulo="Hecho con amor"
            detalle="Cada plato sale pensado para antojarte otro."
          />
        </div>
      </section>

      {/* ----- Promociones activas ----- */}
      {promos.length > 0 ? (
        <section aria-label="Promociones" className="mx-auto max-w-6xl px-5 pt-10 sm:px-8">
          <ul className="grid gap-3 md:grid-cols-3">
            {promos.map((p, i) => (
              <li
                key={p.id}
                className="entra rounded-2xl border p-4"
                style={{
                  backgroundColor: NEGRO_SUAVE,
                  borderColor: `${NARANJA}55`,
                  '--i': 3 + i,
                } as React.CSSProperties}
              >
                {p.etiqueta ? (
                  <p
                    className="text-[11px] font-bold uppercase tracking-[0.18em]"
                    style={{ color: NARANJA_CLARO }}
                  >
                    {p.etiqueta}
                  </p>
                ) : null}
                <p className="mt-1 font-titulo text-lg font-bold">{p.titulo}</p>
                {p.descripcion ? (
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: TEXTO_SUAVE }}>
                    {p.descripcion}
                  </p>
                ) : null}
                {p.tipo === 'combo' ? (
                  <Link
                    href={`${base}/menu`}
                    className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold"
                    style={{ backgroundColor: NARANJA, color: NEGRO }}
                  >
                    Pedir combo
                    {p.precio_combo ? <span>· {formatearPesos(p.precio_combo)}</span> : null}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ----- Nuestros especiales ----- */}
      {especiales.length > 0 ? (
        <section id="especiales" className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8">
          <p
            className="text-center text-xs font-bold uppercase tracking-[0.25em]"
            style={{ color: NARANJA_CLARO }}
          >
            — Lo más pedido —
          </p>
          <h2 className="mt-2 text-center font-titulo text-3xl font-bold sm:text-4xl">
            Nuestros especiales
          </h2>
          <p className="mt-3 flex items-center justify-center gap-2" style={{ color: NARANJA }}>
            <IconoFloritura className="h-3 w-12 opacity-80" />
            <IconoDestello className="size-3.5" />
            <IconoFloritura className="h-3 w-12 -scale-x-100 opacity-80" />
          </p>

          <ul className="mt-8 grid gap-5 sm:grid-cols-2 md:grid-cols-3">
            {especiales.map((p, i) => (
              <li
                key={p.id}
                className="entra overflow-hidden rounded-2xl border transition-transform hover:-translate-y-1 motion-reduce:transform-none"
                style={{
                  backgroundColor: NEGRO_SUAVE,
                  borderColor: 'rgba(244,239,228,0.08)',
                  '--i': 4 + i,
                } as React.CSSProperties}
              >
                <Link href={`${base}/menu`} className="block">
                  <div className="relative">
                    {p.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.foto_url}
                        alt={p.nombre}
                        loading="lazy"
                        className="h-52 w-full object-cover"
                      />
                    ) : (
                      // Sin foto aún: marcador con la inicial sobre el color de su estación.
                      <div
                        aria-hidden
                        className="flex h-52 w-full items-center justify-center"
                        style={{
                          background: `linear-gradient(135deg, ${colorEstacion.get(p.estacion_id) ?? NARANJA}, ${NEGRO})`,
                        }}
                      >
                        <span className="font-titulo text-7xl font-bold text-white/90">
                          {p.nombre.trim().charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span
                      aria-hidden
                      className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-full shadow-lg"
                      style={{ backgroundColor: NARANJA, color: NEGRO }}
                    >
                      <IconoCorazon className="size-5" />
                    </span>
                    <div
                      aria-hidden
                      className="absolute inset-x-0 bottom-0 h-16"
                      style={{ background: `linear-gradient(transparent, ${NEGRO_SUAVE})` }}
                    />
                  </div>

                  <div className="p-4 pt-2">
                    <h3 className="text-lg font-bold">{p.nombre}</h3>
                    <p
                      className="mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: `${NARANJA}22`, color: NARANJA_CLARO }}
                    >
                      <IconoDestello className="size-3" />
                      Favorito de la casa
                    </p>
                    <p className="mt-2 text-xl font-bold tabular-nums" style={{ color: NARANJA }}>
                      {formatearPesos(p.precio)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ----- Puerta final al menú ----- */}
      <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
        <div
          className="entra flex flex-col items-center gap-4 rounded-3xl border px-6 py-10 text-center"
          style={{ borderColor: `${NARANJA}44`, '--i': 7 } as React.CSSProperties}
        >
          <p className="text-2xl" style={{ fontFamily: 'var(--fuente-script)', color: NARANJA_CLARO }}>
            ¿Se te antojó?
          </p>
          <h2 className="font-titulo text-2xl font-bold sm:text-3xl">
            Arma tu pedido en un minuto
          </h2>
          <Link
            href={`${base}/menu`}
            className="mt-1 flex min-h-12 items-center gap-2 rounded-full px-7 text-lg font-bold transition-transform hover:scale-[1.03] motion-reduce:transform-none"
            style={{ backgroundColor: NARANJA, color: NEGRO }}
          >
            <IconoBolsa className="size-5 shrink-0" />
            Pedir ahora
          </Link>
        </div>
      </section>

      {/* ----- Sobre nosotros ----- */}
      <section id="nosotros" className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div className="entra relative" style={{ '--i': 8 } as React.CSSProperties}>
            {restaurante.foto_local_url ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={restaurante.foto_local_url}
                  alt={`El local de ${restaurante.nombre}`}
                  loading="lazy"
                  className="h-80 w-full rounded-2xl object-cover"
                />
                {/* Recuadro naranja con el dato de la casa, como la referencia. */}
                <div
                  className="absolute -bottom-5 left-5 rounded-xl px-5 py-3 text-center shadow-xl"
                  style={{ backgroundColor: NARANJA, color: NEGRO }}
                >
                  <p className="text-2xl font-black leading-none">{t.dato}</p>
                  <p className="mt-1 text-[11px] font-semibold leading-tight">{t.dato_texto}</p>
                </div>
              </>
            ) : (
              <div
                aria-hidden
                className="flex h-80 w-full items-center justify-center rounded-2xl"
                style={{ backgroundColor: NEGRO_SUAVE }}
              >
                <IconoCubiertos className="size-16 opacity-30" />
              </div>
            )}
          </div>

          <div className="entra" style={{ '--i': 9 } as React.CSSProperties}>
            <p
              className="text-xs font-bold uppercase tracking-[0.25em]"
              style={{ color: NARANJA_CLARO }}
            >
              Sobre nosotros
            </p>
            <h2 className="mt-3 font-titulo text-3xl font-bold leading-tight">
              {t.nosotros_titulo}
            </h2>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: TEXTO_SUAVE }}>
              {t.nosotros_texto}
            </p>
            <Link
              href={`${base}/menu`}
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-bold transition-transform hover:scale-[1.03] motion-reduce:transform-none"
              style={{ backgroundColor: NARANJA, color: NEGRO }}
            >
              Ver el menú
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ----- Franja naranja de contacto ----- */}
      <section id="contacto" className="mx-auto max-w-6xl px-5 pb-10 sm:px-8">
        <div
          className="entra grid gap-6 rounded-2xl p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-4"
          style={{ backgroundColor: NARANJA, color: NEGRO, '--i': 10 } as React.CSSProperties}
        >
          <Contacto Icono={IconoPin} titulo="Dónde estamos">
            {restaurante.direccion ?? 'Pídelo a domicilio o pasa por el local.'}
          </Contacto>
          <Contacto Icono={IconoReloj} titulo="Horario">
            {restaurante.horario ?? 'Escríbenos y te confirmamos.'}
          </Contacto>
          <Contacto Icono={IconoTelefono} titulo="Escríbenos">
            {restaurante.whatsapp ? (
              <a
                href={enlaceWhatsApp(restaurante.whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                {restaurante.whatsapp}
              </a>
            ) : (
              'WhatsApp disponible pronto.'
            )}
          </Contacto>
          <Contacto Icono={IconoMoto} titulo="Domicilios">
            {umbralEnvio
              ? `Gratis desde ${formatearPesos(umbralEnvio)}.`
              : 'Te lo llevamos calientico.'}
          </Contacto>
        </div>
      </section>

      <footer
        className="border-t px-5 py-6 text-center text-xs"
        style={{ borderColor: 'rgba(244,239,228,0.08)', color: TEXTO_SUAVE }}
      >
        © {new Date().getFullYear()} {restaurante.nombre} · Todos los derechos reservados
      </footer>
    </div>
  )
}

function Contacto({
  Icono,
  titulo,
  children,
}: {
  Icono: (p: { className?: string }) => React.ReactNode
  titulo: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: NEGRO, color: NARANJA_CLARO }}
      >
        <Icono className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider">{titulo}</p>
        <p className="mt-0.5 text-sm leading-snug">{children}</p>
      </div>
    </div>
  )
}

/**
 * Fondo del héroe: video si el admin subió uno, foto si no. La foto va SIEMPRE detrás
 * (y como `poster` del video), así nunca se ve un hueco negro mientras carga o si el
 * dispositivo no reproduce. El video va mudo, en bucle y `playsinline` para que en
 * celular no se abra a pantalla completa; `preload="metadata"` para no bajarlo entero
 * de golpe. Con `prefers-reduced-motion` el video se oculta y queda la foto.
 */
function FondoHero({
  foto,
  video,
  nombre,
}: {
  foto: string | null
  video: string | null
  nombre: string
}) {
  return (
    <>
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt={`Plato estrella de ${nombre}`} className="absolute inset-0 size-full object-cover" />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${NARANJA}44, ${NEGRO} 70%)` }}
        />
      )}

      {video ? (
        <video
          src={video}
          poster={foto ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
          className="hero-video absolute inset-0 size-full object-cover"
        />
      ) : null}
    </>
  )
}

function Beneficio({
  Icono,
  titulo,
  detalle,
}: {
  Icono: (p: { className?: string }) => React.ReactNode
  titulo: string
  detalle: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span
        className="flex size-12 items-center justify-center rounded-full"
        style={{ backgroundColor: NEGRO, color: NARANJA_CLARO }}
      >
        <Icono className="size-5" />
      </span>
      <p className="text-sm font-bold uppercase tracking-wide">{titulo}</p>
      <p className="text-xs leading-relaxed" style={{ color: '#635B4B' }}>
        {detalle}
      </p>
    </div>
  )
}
