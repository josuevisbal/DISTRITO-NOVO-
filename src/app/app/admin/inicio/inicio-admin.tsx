'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'

import { IconoAlerta, IconoCheck } from '@/components/iconos'
import { useToast } from '@/components/toast'
import { Boton } from '@/components/ui/boton'
import type { FrasesLanding } from '@/lib/datos/carta'
import {
  guardarInicio,
  quitarFotoInicio,
  quitarVideoHero,
  subirFotoInicio,
  subirVideoHero,
  type CampoFoto,
} from './acciones'

/**
 * Panel de la página de inicio: el admin cambia las dos fotos grandes (el plato del
 * héroe y el local) y todas las frases de la bienvenida, más los datos de la franja
 * de contacto. Cada campo dice qué texto se usa si lo deja vacío.
 */
export function InicioAdmin({
  slug,
  logoUrl,
  portadaUrl,
  fotoLocalUrl,
  heroVideoUrl,
  direccion: direccionInicial,
  horario: horarioInicial,
  whatsapp: whatsappInicial,
  frases: frasesIniciales,
}: {
  slug: string
  logoUrl: string | null
  portadaUrl: string | null
  fotoLocalUrl: string | null
  heroVideoUrl: string | null
  direccion: string
  horario: string
  whatsapp: string
  frases: FrasesLanding
}) {
  const [frases, setFrases] = useState<FrasesLanding>(frasesIniciales)
  const [direccion, setDireccion] = useState(direccionInicial)
  const [horario, setHorario] = useState(horarioInicial)
  const [whatsapp, setWhatsapp] = useState(whatsappInicial)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mostrar } = useToast()

  function cambiar(clave: keyof FrasesLanding, valor: string) {
    setFrases((previas) => ({ ...previas, [clave]: valor }))
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    const r = await guardarInicio({ frases, direccion, horario, whatsapp })
    setGuardando(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    mostrar('Página de inicio guardada')
    setGuardado(true)
    setTimeout(() => setGuardado(false), 1500)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href={`/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center rounded-lg border border-marca-borde px-4 text-sm text-marca-texto transition-colors hover:border-marca-acento"
        >
          Ver la página del cliente
        </Link>
      </div>

      {/* ----- Fotos ----- */}
      <section className="tarjeta p-4">
        <h2 className="font-medium text-marca-texto">Fotos</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <CargadorFoto
            campo="logo_url"
            url={logoUrl}
            titulo="Logo del restaurante"
            ayuda="Va en el login, la portada y el menú, en marco circular. Sirve con fondo blanco: el borde se funde solo."
          />
          <CargadorFoto
            campo="portada_url"
            url={portadaUrl}
            titulo="Plato de la portada"
            ayuda="La foto grande del héroe. Se funde con el fondo negro."
          />
          <CargadorFoto
            campo="foto_local_url"
            url={fotoLocalUrl}
            titulo="Foto del local"
            ayuda="La de la sección “Sobre nosotros”."
          />
        </div>

        <CargadorVideo url={heroVideoUrl} />
      </section>

      {/* ----- Frases del héroe ----- */}
      <section className="tarjeta space-y-2 p-4">
        <h2 className="font-medium text-marca-texto">Frases de bienvenida</h2>
        <Campo
          etiqueta="Frase cursiva (arriba del título)"
          valor={frases.script ?? ''}
          onChange={(v) => cambiar('script', v)}
          marcador="Del carbón a tu mesa"
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <Campo
            etiqueta="Título · primera línea (blanca)"
            valor={frases.titulo_blanco ?? ''}
            onChange={(v) => cambiar('titulo_blanco', v)}
            marcador="BUENA COMIDA"
          />
          <Campo
            etiqueta="Título · segunda línea (naranja)"
            valor={frases.titulo_naranja ?? ''}
            onChange={(v) => cambiar('titulo_naranja', v)}
            marcador="BUEN SABOR"
          />
        </div>
        <Campo
          etiqueta="Texto de bienvenida"
          valor={frases.bienvenida ?? ''}
          onChange={(v) => cambiar('bienvenida', v)}
          marcador="Platos hechos al momento con ingredientes frescos…"
          largo
        />
      </section>

      {/* ----- Sobre nosotros ----- */}
      <section className="tarjeta space-y-2 p-4">
        <h2 className="font-medium text-marca-texto">Sobre nosotros</h2>
        <Campo
          etiqueta="Título"
          valor={frases.nosotros_titulo ?? ''}
          onChange={(v) => cambiar('nosotros_titulo', v)}
          marcador="Un lugar donde la buena comida y los buenos momentos se encuentran"
        />
        <Campo
          etiqueta="Texto"
          valor={frases.nosotros_texto ?? ''}
          onChange={(v) => cambiar('nosotros_texto', v)}
          marcador="Creemos que cada comida es una experiencia…"
          largo
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <Campo
            etiqueta="Dato del recuadro naranja"
            valor={frases.dato ?? ''}
            onChange={(v) => cambiar('dato', v)}
            marcador="10+"
          />
          <Campo
            etiqueta="Texto del recuadro"
            valor={frases.dato_texto ?? ''}
            onChange={(v) => cambiar('dato_texto', v)}
            marcador="Años de experiencia"
          />
        </div>
      </section>

      {/* ----- Franja de contacto ----- */}
      <section className="tarjeta space-y-2 p-4">
        <h2 className="font-medium text-marca-texto">Franja de contacto</h2>
        <Campo
          etiqueta="Dirección"
          valor={direccion}
          onChange={setDireccion}
          marcador="Calle 00 #00-00, Barranquilla"
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <Campo
            etiqueta="Horario"
            valor={horario}
            onChange={setHorario}
            marcador="Lun a dom · 5:00 pm a 11:00 pm"
          />
          <Campo
            etiqueta="WhatsApp"
            valor={whatsapp}
            onChange={setWhatsapp}
            marcador="300 679 9163"
          />
        </div>
      </section>

      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-5 shrink-0" />
          {error}
        </p>
      ) : null}

      <Boton
        variante="primario"
        className="flex items-center gap-1.5 px-4"
        onClick={guardar}
        disabled={guardando}
      >
        {guardado ? <IconoCheck className="size-4" /> : null}
        {guardando ? 'Guardando…' : guardado ? 'Guardado' : 'Guardar cambios'}
      </Boton>
    </div>
  )
}

/** Video de fondo del héroe: opcional, corto y liviano. Si no hay, manda la foto. */
function CargadorVideo({ url }: { url: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function subir(archivo: File) {
    setOcupado(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('video', archivo)
      const r = await subirVideoHero(form)
      if (!r.ok) setError(r.error)
    } catch {
      // Si el envío falla (video muy pesado para el servidor, conexión caída), no dejamos
      // el botón en "Subiendo…" para siempre: se avisa y se puede reintentar.
      setError('No se pudo subir el video. Revisa que pese menos de 10 MB y reintenta.')
    } finally {
      setOcupado(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-marca-borde p-3">
      <p className="text-sm font-medium text-marca-texto">Video de fondo del héroe (opcional)</p>
      <p className="mt-0.5 text-xs text-marca-texto-suave">
        Si subes un video, la portada lo usa de fondo en vez de la foto. Corto (5–12 s),
        MP4 o WebM, máximo 10 MB. Va sin sonido y en bucle; la foto de arriba queda como
        respaldo mientras carga y en celulares que no lo reproducen.
      </p>

      {url ? (
        <video
          src={url}
          muted
          loop
          playsInline
          autoPlay
          className="mt-2 h-32 w-full rounded-lg object-cover"
        />
      ) : (
        <div className="mt-2 flex h-32 w-full items-center justify-center rounded-lg bg-marca-superficie-tenue text-xs text-marca-texto-suave">
          Sin video · se usa la foto
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void subir(f)
        }}
      />

      <div className="mt-2 flex flex-wrap gap-2">
        <Boton
          variante="secundario"
          className="px-3 text-marca-texto"
          onClick={() => inputRef.current?.click()}
          disabled={ocupado}
        >
          {ocupado ? 'Subiendo…' : url ? 'Cambiar video' : 'Subir video'}
        </Boton>
        {url ? (
          <Boton variante="secundario" className="px-3" onClick={() => quitarVideoHero()}>
            Quitar video
          </Boton>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-2 flex items-center gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  )
}

function CargadorFoto({
  campo,
  url,
  titulo,
  ayuda,
}: {
  campo: CampoFoto
  url: string | null
  titulo: string
  ayuda: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pendiente, setPendiente] = useState<File | null>(null)
  const [previa, setPrevia] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function limpiar() {
    if (previa) URL.revokeObjectURL(previa)
    setPendiente(null)
    setPrevia(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function guardarFoto() {
    if (!pendiente) return
    setOcupado(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('foto', pendiente)
      const r = await subirFotoInicio(campo, form)
      if (!r.ok) setError(r.error)
      else limpiar()
    } catch {
      setError('No se pudo subir la foto. Revisa que pese menos de 5 MB y reintenta.')
    } finally {
      setOcupado(false)
    }
  }

  const mostrada = previa ?? url

  return (
    <div className="rounded-xl border border-marca-borde p-3">
      <p className="text-sm font-medium text-marca-texto">{titulo}</p>
      <p className="mt-0.5 text-xs text-marca-texto-suave">{ayuda}</p>

      <div className="mt-2 h-32 w-full overflow-hidden rounded-lg bg-marca-superficie-tenue">
        {mostrada ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mostrada} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-xs text-marca-texto-suave">
            Sin foto
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) {
            setPendiente(f)
            setPrevia(URL.createObjectURL(f))
          }
        }}
      />

      <div className="mt-2 flex flex-wrap gap-2">
        {pendiente ? (
          <>
            <Boton variante="primario" className="px-3" onClick={guardarFoto} disabled={ocupado}>
              {ocupado ? 'Subiendo…' : 'Guardar foto'}
            </Boton>
            <Boton variante="secundario" className="px-3" onClick={limpiar} disabled={ocupado}>
              Cancelar
            </Boton>
          </>
        ) : (
          <>
            <Boton
              variante="secundario"
              className="px-3 text-marca-texto"
              onClick={() => inputRef.current?.click()}
            >
              {url ? 'Cambiar foto' : 'Subir foto'}
            </Boton>
            {url ? (
              <Boton variante="secundario" className="px-3" onClick={() => quitarFotoInicio(campo)}>
                Quitar
              </Boton>
            ) : null}
          </>
        )}
      </div>

      {pendiente ? (
        <p className="mt-2 text-xs text-marca-texto-suave">
          Vista previa: aún no se guarda hasta que toques “Guardar foto”.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 flex items-center gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  )
}

function Campo({
  etiqueta,
  valor,
  onChange,
  marcador,
  largo = false,
}: {
  etiqueta: string
  valor: string
  onChange: (v: string) => void
  marcador?: string
  largo?: boolean
}) {
  return (
    <label className="block">
      <span className="text-xs text-marca-texto-suave">{etiqueta}</span>
      {largo ? (
        <textarea
          rows={3}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder={marcador}
          className="mt-1 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 py-2 text-sm text-marca-texto placeholder:text-marca-texto-suave/60"
        />
      ) : (
        <input
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder={marcador}
          className="mt-1 min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 text-marca-texto placeholder:text-marca-texto-suave/60"
        />
      )}
    </label>
  )
}
