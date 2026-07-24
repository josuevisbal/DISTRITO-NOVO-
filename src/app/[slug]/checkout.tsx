'use client'

import { useState } from 'react'

import { IconoAlerta, IconoAtras, IconoCheck, IconoMoto } from '@/components/iconos'
import { calcularDomicilio } from '@/lib/cuentas'
import type { ZonaCarta } from '@/lib/datos/carta'
import { formatearPesos } from '@/lib/formato'

export type Entrega = 'domicilio' | 'recoger'
export type Medio = 'efectivo' | 'transferencia'

export type DatosCheckout = {
  entrega: Entrega
  medio: Medio
  nombre: string
  telefono: string
  direccion: string
  zona_id: string
  indicaciones: string
}

type Props = {
  zonas: ZonaCarta[]
  subtotal: number
  umbralEnvioGratis: number | null
  enviando: boolean
  error: string | null
  onVolver: () => void
  onConfirmar: (datos: DatosCheckout) => void
}

const VACIO: DatosCheckout = {
  entrega: 'domicilio',
  medio: 'efectivo',
  nombre: '',
  telefono: '',
  direccion: '',
  zona_id: '',
  indicaciones: '',
}

export function Checkout({
  zonas,
  subtotal,
  umbralEnvioGratis,
  enviando,
  error,
  onVolver,
  onConfirmar,
}: Props) {
  const [datos, setDatos] = useState<DatosCheckout>(VACIO)

  const esDomicilio = datos.entrega === 'domicilio'
  const zona = zonas.find((z) => z.id === datos.zona_id)
  const domicilio = calcularDomicilio({
    esDomicilio,
    subtotal,
    valorZona: zona?.valor ?? 0,
    umbralEnvioGratis,
  })
  const total = subtotal + domicilio
  const envioGratis = esDomicilio && zona !== undefined && domicilio === 0
  const faltaParaEnvioGratis =
    esDomicilio && umbralEnvioGratis !== null && subtotal < umbralEnvioGratis
      ? umbralEnvioGratis - subtotal
      : null

  function cambiar<C extends keyof DatosCheckout>(campo: C, valor: DatosCheckout[C]) {
    setDatos((previo) => ({ ...previo, [campo]: valor }))
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onConfirmar(datos)
      }}
      className="mx-auto max-w-2xl px-5 pb-40 pt-5 sm:px-8"
    >
      <button
        type="button"
        onClick={onVolver}
        className="-ml-2 flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-marca-texto-suave"
      >
        <IconoAtras className="size-5 shrink-0" />
        Volver al pedido
      </button>

      <h2 className="mt-3 font-titulo text-3xl font-bold text-marca-acento-fuerte">Tus datos</h2>

      <Grupo titulo="¿Cómo lo quieres?">
        <div className="grid grid-cols-2 gap-3">
          <Opcion
            nombre="entrega"
            seleccionada={esDomicilio}
            onSelect={() => cambiar('entrega', 'domicilio')}
            titulo="A domicilio"
            detalle="Te lo llevamos"
          />
          <Opcion
            nombre="entrega"
            seleccionada={!esDomicilio}
            onSelect={() => cambiar('entrega', 'recoger')}
            titulo="Para recoger"
            detalle="Pasas por él"
          />
        </div>
      </Grupo>

      <Grupo titulo="¿Quién eres?">
        <Campo
          etiqueta="Nombre"
          valor={datos.nombre}
          onChange={(v) => cambiar('nombre', v)}
          autoComplete="name"
          requerido
        />
        <Campo
          etiqueta="Teléfono"
          valor={datos.telefono}
          onChange={(v) => cambiar('telefono', v)}
          tipo="tel"
          autoComplete="tel"
          requerido
        />
      </Grupo>

      {esDomicilio ? (
        <Grupo titulo="¿Dónde te lo dejamos?">
          <Campo
            etiqueta="Dirección"
            valor={datos.direccion}
            onChange={(v) => cambiar('direccion', v)}
            autoComplete="street-address"
            requerido
          />

          <label className="block">
            <span className="text-sm text-marca-texto-suave">Barrio</span>
            <select
              required
              value={datos.zona_id}
              onChange={(e) => cambiar('zona_id', e.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 text-marca-texto"
            >
              <option value="">Escoge tu barrio</option>
              {zonas.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.nombre} · domicilio {formatearPesos(z.valor)}
                </option>
              ))}
            </select>
            <span className="mt-1.5 block text-xs text-marca-texto-suave">
              El domicilio se cobra por barrio, no por distancia.
            </span>
          </label>

          <Campo
            etiqueta="Indicaciones (opcional)"
            valor={datos.indicaciones}
            onChange={(v) => cambiar('indicaciones', v)}
            marcador="Apartamento, portería, punto de referencia"
          />
        </Grupo>
      ) : null}

      <Grupo titulo="¿Cómo pagas?">
        <div className="grid gap-3 sm:grid-cols-2">
          <Opcion
            nombre="medio"
            seleccionada={datos.medio === 'efectivo'}
            onSelect={() => cambiar('medio', 'efectivo')}
            titulo="Efectivo"
            detalle={esDomicilio ? 'Pagas al recibir' : 'Pagas al recoger'}
          />
          <Opcion
            nombre="medio"
            seleccionada={datos.medio === 'transferencia'}
            onSelect={() => cambiar('medio', 'transferencia')}
            titulo="Transferencia"
            detalle="Te damos la llave y el valor exacto"
          />
        </div>

        {datos.medio === 'transferencia' ? (
          <p className="flex gap-2.5 rounded-lg border border-marca-borde bg-marca-superficie p-3.5 text-sm text-marca-texto-suave">
            <IconoAlerta className="size-5 shrink-0 text-marca-acento-fuerte" />
            <span>
              Tu pedido no entra a cocina hasta que alguien de caja vea la transferencia en
              el banco. Por eso el valor lleva un código al final: para poder ubicarla.
            </span>
          </p>
        ) : null}
      </Grupo>

      <dl className="mt-8 space-y-2 border-t border-marca-borde pt-5 text-sm">
        <Renglon termino="Subtotal" valor={formatearPesos(subtotal)} />
        {esDomicilio ? (
          <Renglon
            termino="Domicilio"
            valor={envioGratis ? 'Gratis' : zona ? formatearPesos(domicilio) : 'Escoge tu barrio'}
            destacado={envioGratis}
          />
        ) : null}
        <div className="flex items-baseline justify-between border-t border-marca-borde pt-3 text-lg">
          <dt className="font-titulo font-medium text-marca-texto">Total</dt>
          <dd className="font-titulo text-2xl font-bold text-marca-acento-fuerte">
            {formatearPesos(total)}
          </dd>
        </div>
      </dl>

      {faltaParaEnvioGratis !== null ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-marca-texto-suave">
          <IconoMoto className="size-4 shrink-0 text-marca-acento-fuerte" />
          Te faltan {formatearPesos(faltaParaEnvioGratis)} para el domicilio gratis.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-5 flex gap-2.5 rounded-lg border border-marca-acento bg-marca-superficie p-3.5 text-sm text-marca-texto"
        >
          <IconoAlerta className="size-5 shrink-0 text-marca-acento-fuerte" />
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enviando}
        className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-marca-acento text-lg font-medium text-marca-acento-texto disabled:opacity-60"
      >
        {enviando ? (
          'Enviando tu pedido…'
        ) : (
          <>
            <IconoCheck className="size-5 shrink-0" />
            Confirmar pedido
          </>
        )}
      </button>

      <p className="mt-3 text-center text-xs text-marca-texto-suave">
        El valor final lo calcula el restaurante al recibir el pedido.
      </p>
    </form>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-7">
      <legend className="mb-3 font-titulo text-lg text-marca-texto">{titulo}</legend>
      <div className="space-y-3">{children}</div>
    </fieldset>
  )
}

function Opcion({
  nombre,
  seleccionada,
  onSelect,
  titulo,
  detalle,
}: {
  nombre: string
  seleccionada: boolean
  onSelect: () => void
  titulo: string
  detalle: string
}) {
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3.5 ${
        seleccionada
          ? 'border-marca-acento bg-marca-acento/10'
          : 'border-marca-borde bg-marca-superficie'
      }`}
    >
      <input
        type="radio"
        name={nombre}
        checked={seleccionada}
        onChange={onSelect}
        className="sr-only"
      />
      {/* El estado no se comunica solo con el color: hay un check y el texto cambia de peso. */}
      <span
        aria-hidden
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${
          seleccionada ? 'border-marca-acento bg-marca-acento' : 'border-marca-texto-suave'
        }`}
      >
        {seleccionada ? <IconoCheck className="size-3.5 text-marca-acento-texto" /> : null}
      </span>
      <span>
        <span
          className={`block ${seleccionada ? 'font-semibold text-marca-texto' : 'text-marca-texto'}`}
        >
          {titulo}
        </span>
        <span className="block text-sm text-marca-texto-suave">{detalle}</span>
      </span>
    </label>
  )
}

function Campo({
  etiqueta,
  valor,
  onChange,
  tipo = 'text',
  autoComplete,
  marcador,
  requerido = false,
}: {
  etiqueta: string
  valor: string
  onChange: (v: string) => void
  tipo?: string
  autoComplete?: string
  marcador?: string
  requerido?: boolean
}) {
  return (
    <label className="block">
      <span className="text-sm text-marca-texto-suave">{etiqueta}</span>
      <input
        type={tipo}
        value={valor}
        required={requerido}
        autoComplete={autoComplete}
        placeholder={marcador}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 min-h-11 w-full rounded-lg border border-marca-borde bg-marca-fondo px-3 text-marca-texto placeholder:text-marca-texto-suave/60"
      />
    </label>
  )
}

function Renglon({
  termino,
  valor,
  destacado = false,
}: {
  termino: string
  valor: string
  destacado?: boolean
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-marca-texto-suave">{termino}</dt>
      <dd className={destacado ? 'font-medium text-marca-acento-fuerte' : 'text-marca-texto'}>
        {valor}
      </dd>
    </div>
  )
}
