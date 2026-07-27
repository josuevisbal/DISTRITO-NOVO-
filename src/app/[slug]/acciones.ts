'use server'

import type { Database } from '@/lib/database.types'
import { crearClienteServidor } from '@/lib/supabase/servidor'

type Canal = Database['public']['Enums']['canal_pedido']
type MedioPago = Database['public']['Enums']['medio_pago']

/** Lo único que el navegador puede mandar de cada renglón. Nunca un precio. */
export type ItemPedido = { producto_id: string; cantidad: number; notas?: string }

/** Un combo del carrito: solo cuál y cuántos; el precio lo pone el servidor. */
export type ComboPedido = { promocion_id: string; cantidad: number }

export type DatosPedido = {
  canal: Canal
  medio_pago: MedioPago | null
  mesa_id?: string
  cliente_nombre?: string
  cliente_tel?: string
  direccion?: string
  zona_id?: string
  indicaciones?: string
  items: ItemPedido[]
  combos?: ComboPedido[]
}

export type ResultadoPedido =
  | {
      ok: true
      token: string
      numero: number
      /** Valores ya calculados por el servidor, para el aviso de WhatsApp. */
      subtotal: number
      domicilio: number
      total: number
    }
  | { ok: false; error: string }

/** Lo que devuelve `crear_pedido`. La función es la dueña de las cuentas, no el front. */
type RespuestaCrearPedido = {
  id: string
  numero: number
  token: string
  subtotal: number
  domicilio: number
  total: number
  monto_exacto: number
  estado: string
}

export async function crearPedido(
  slug: string,
  datos: DatosPedido,
): Promise<ResultadoPedido> {
  if (datos.items.length === 0 && (datos.combos?.length ?? 0) === 0) {
    return { ok: false, error: 'Tu pedido está vacío.' }
  }
  if (datos.canal === 'domicilio' && !datos.zona_id) {
    return { ok: false, error: 'Escoge el barrio para calcular el domicilio.' }
  }
  if (datos.canal === 'domicilio' && !datos.direccion?.trim()) {
    return { ok: false, error: 'Falta la dirección de entrega.' }
  }
  if (datos.canal !== 'mesa' && !datos.cliente_nombre?.trim()) {
    return { ok: false, error: 'Falta tu nombre.' }
  }
  if (datos.canal !== 'mesa' && !datos.cliente_tel?.trim()) {
    return { ok: false, error: 'Falta tu teléfono.' }
  }

  const supabase = await crearClienteServidor()

  // Se arma el payload a mano para que no se cuele nada que venga del navegador:
  // solo qué producto, cuántos y la nota. Los precios los pone la función en la base.
  const { data, error } = await supabase.rpc('crear_pedido', {
    p_slug: slug,
    p_payload: {
      canal: datos.canal,
      medio_pago: datos.medio_pago ?? '',
      mesa_id: datos.mesa_id ?? '',
      cliente_nombre: datos.cliente_nombre?.trim() ?? '',
      cliente_tel: datos.cliente_tel?.trim() ?? '',
      direccion: datos.direccion?.trim() ?? '',
      zona_id: datos.zona_id ?? '',
      indicaciones: datos.indicaciones?.trim() ?? '',
      items: datos.items.map((i) => ({
        producto_id: i.producto_id,
        cantidad: Math.max(1, Math.trunc(i.cantidad)),
        notas: i.notas?.trim() ?? '',
      })),
      combos: (datos.combos ?? []).map((c) => ({
        promocion_id: c.promocion_id,
        cantidad: Math.max(1, Math.trunc(c.cantidad)),
      })),
    },
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  const pedido = data as unknown as RespuestaCrearPedido
  return {
    ok: true,
    token: pedido.token,
    numero: pedido.numero,
    subtotal: pedido.subtotal,
    domicilio: pedido.domicilio,
    total: pedido.total,
  }
}
