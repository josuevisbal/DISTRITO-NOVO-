'use client'

import { useEffect, useState } from 'react'

import { editarPedido, itemsParaEditar } from '@/app/app/acciones'
import { IconoAlerta } from '@/components/iconos'
import {
  SelectorProductos,
  totalEstimado,
  type CategoriaElegible,
  type ProductoElegible,
  type Renglon,
} from '@/components/pedido/selector-productos'
import { useToast } from '@/components/toast'
import { Boton } from '@/components/ui/boton'
import { formatearPesos } from '@/lib/formato'

/**
 * Editar un pedido que ya existe: arranca con lo que tiene y el equipo sube, baja o
 * quita cantidades, suma productos o cambia la nota. El precio que se ve es informativo;
 * el que queda lo recalcula la base. Cocina ve el cambio de una.
 */
export function EditarPedido({
  pedidoId,
  numero,
  categorias,
  productos,
  onListo,
}: {
  pedidoId: string
  numero: number
  categorias: CategoriaElegible[]
  productos: ProductoElegible[]
  onListo: () => void
}) {
  const [renglones, setRenglones] = useState<Renglon[] | null>(null)
  const [combos, setCombos] = useState(0)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mostrar } = useToast()

  useEffect(() => {
    let vivo = true
    void itemsParaEditar(pedidoId).then((r) => {
      if (!vivo) return
      if (!r.ok) {
        setError(r.error)
        setRenglones([])
        return
      }
      setRenglones(r.items)
      setCombos(r.combos)
    })
    return () => {
      vivo = false
    }
  }, [pedidoId])

  async function guardar() {
    if (!renglones) return
    setOcupado(true)
    setError(null)
    const r = await editarPedido(pedidoId, renglones)
    if (!r.ok) {
      setError(r.error)
      setOcupado(false)
      return
    }
    mostrar(`Pedido #${r.numero} actualizado · total ${formatearPesos(r.total)}`)
    onListo()
  }

  if (renglones === null) {
    return <p className="py-8 text-center text-sm text-marca-texto-suave">Cargando el pedido…</p>
  }

  const total = totalEstimado(renglones, productos)

  return (
    <div className="space-y-4">
      <p className="text-sm text-marca-texto-suave">
        Pedido #{numero}. Ajusta cantidades con − y +, o busca un producto para sumarlo. Lo que
        sumes le llega a cocina como comanda nueva.
      </p>
      {combos > 0 ? (
        <p className="rounded-lg bg-marca-superficie-tenue px-3 py-2 text-xs text-marca-texto-suave">
          Los combos del pedido se quedan como están.
        </p>
      ) : null}

      <SelectorProductos
        categorias={categorias}
        productos={productos}
        renglones={renglones}
        onCambiar={setRenglones}
        primeroLosDelPedido
      />

      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-marca-acento-fuerte">
          <IconoAlerta className="size-5 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-marca-borde pt-4">
        <p className="text-sm text-marca-texto-suave">
          Platos{' '}
          <span className="text-base font-bold text-marca-texto">{formatearPesos(total)}</span>
        </p>
        <Boton
          variante="negro"
          className="px-5"
          onClick={guardar}
          disabled={ocupado || (renglones.length === 0 && combos === 0)}
        >
          {ocupado ? 'Guardando…' : 'Guardar cambios'}
        </Boton>
      </div>
    </div>
  )
}

/**
 * Anular con motivo, en línea: el motivo es obligatorio y queda en el pedido. Se usa en
 * las tarjetas del mesero y de caja.
 */
export function AnularConMotivo({
  disabled,
  onConfirmar,
  onCancelar,
}: {
  disabled: boolean
  onConfirmar: (motivo: string) => void
  onCancelar: () => void
}) {
  const [motivo, setMotivo] = useState('')
  return (
    <div className="flex w-full items-center gap-1.5">
      <input
        autoFocus
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo de la anulación"
        aria-label="Motivo de la anulación"
        className="min-h-11 min-w-0 flex-1 rounded-lg border border-marca-borde bg-marca-fondo px-2 text-sm text-marca-texto"
      />
      <button
        type="button"
        disabled={disabled || motivo.trim() === ''}
        onClick={() => onConfirmar(motivo.trim())}
        className="min-h-11 shrink-0 rounded-lg border border-[#9A3320] px-3 text-sm font-medium text-[#9A3320] disabled:opacity-50"
      >
        Anular
      </button>
      <button
        type="button"
        onClick={onCancelar}
        className="min-h-11 shrink-0 rounded-lg px-2 text-sm text-marca-texto-suave"
      >
        No
      </button>
    </div>
  )
}
