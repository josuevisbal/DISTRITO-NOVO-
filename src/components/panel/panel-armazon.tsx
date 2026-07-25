'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cerrarSesion } from '@/app/app/login/acciones'
import {
  IconoCaja,
  IconoCampana,
  IconoCarta,
  IconoCerrar,
  IconoEquipo,
  IconoGrafica,
  IconoMenu,
  IconoPin,
  IconoPorcentaje,
  IconoSalir,
  IconoTablero,
} from '@/components/iconos'
import { ESTADOS_VIVOS } from '@/lib/estados-vivos'
import type { Staff } from '@/lib/sesion'
import { crearClienteNavegador } from '@/lib/supabase/navegador'

type Modulo = {
  href: string
  titulo: string
  Icono: (p: { className?: string }) => React.ReactNode
}

const MODULOS: Modulo[] = [
  { href: '/app/admin/tablero', titulo: 'Tablero', Icono: IconoTablero },
  { href: '/app/admin/pedidos', titulo: 'Pedidos en vivo', Icono: IconoCampana },
  { href: '/app/admin/carta', titulo: 'Carta', Icono: IconoCarta },
  { href: '/app/admin/promociones', titulo: 'Promociones', Icono: IconoPorcentaje },
  { href: '/app/admin/zonas', titulo: 'Zonas', Icono: IconoPin },
  { href: '/app/admin/caja', titulo: 'Caja y finanzas', Icono: IconoCaja },
  { href: '/app/admin/usuarios', titulo: 'Equipo', Icono: IconoEquipo },
  { href: '/app/admin/reportes', titulo: 'Reportes', Icono: IconoGrafica },
]

const NOMBRE_ROL: Record<Staff['rol'], string> = {
  dueno: 'Dueño',
  admin: 'Administrador',
  cajero: 'Caja',
  mesero: 'Mesero',
  cocina: 'Cocina',
  pase: 'Pase',
  domiciliario: 'Domiciliario',
}

type Props = {
  staff: Staff
  nombreRestaurante: string
  children: React.ReactNode
}

/**
 * Armazón del panel: barra lateral fija oscura con el módulo activo en dorado, encabezado
 * con el nombre del módulo y el usuario, y el contenido con transición al navegar.
 * En celular la barra se colapsa a un menú hamburguesa.
 */
export function PanelArmazon({ staff, nombreRestaurante, children }: Props) {
  const ruta = usePathname()
  const [abierta, setAbierta] = useState(false)
  const [enVivo, setEnVivo] = useState<number | null>(null)

  // Al navegar se cierra el cajón móvil.
  useEffect(() => setAbierta(false), [ruta])

  // Contador de pedidos en vivo para la insignia de la barra: conteo inicial + Realtime.
  // La RLS ya limita el conteo al restaurante del usuario.
  useEffect(() => {
    const supabase = crearClienteNavegador()
    let vivo = true

    async function contar() {
      const { count } = await supabase
        .from('pedidos')
        .select('id', { count: 'exact', head: true })
        .in('estado', ESTADOS_VIVOS)
      if (vivo && count !== null) setEnVivo(count)
    }

    contar()
    const canal = supabase
      .channel('panel-pedidos-vivos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, contar)
      .subscribe()

    return () => {
      vivo = false
      supabase.removeChannel(canal)
    }
  }, [])

  const activo = MODULOS.find((m) => ruta.startsWith(m.href))

  return (
    <div className="flex min-h-screen">
      {/* ----- Barra lateral (escritorio) ----- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-panel-lateral lg:flex">
        <ContenidoLateral nombre={nombreRestaurante} ruta={ruta} enVivo={enVivo} />
      </aside>

      {/* ----- Cajón móvil ----- */}
      {abierta ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setAbierta(false)}
            className="absolute inset-0 bg-black/50"
          />
          <aside className="animate-escala absolute inset-y-0 left-0 flex w-64 flex-col bg-panel-lateral shadow-2xl">
            <button
              type="button"
              onClick={() => setAbierta(false)}
              aria-label="Cerrar menú"
              className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-lg text-panel-lateral-texto-suave"
            >
              <IconoCerrar className="size-5" />
            </button>
            <ContenidoLateral nombre={nombreRestaurante} ruta={ruta} enVivo={enVivo} />
          </aside>
        </div>
      ) : null}

      {/* ----- Contenido ----- */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-marca-borde bg-marca-superficie/90 px-4 py-3 backdrop-blur">
          <button
            type="button"
            onClick={() => setAbierta(true)}
            aria-label="Abrir menú"
            className="flex size-11 items-center justify-center rounded-lg border border-marca-borde text-marca-texto lg:hidden"
          >
            <IconoMenu className="size-5" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold text-marca-texto">
              {activo?.titulo ?? 'Panel'}
            </h1>
          </div>

          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-tight text-marca-texto">{staff.nombre}</p>
            <p className="text-xs text-marca-texto-suave">{NOMBRE_ROL[staff.rol]}</p>
          </div>

          <form action={cerrarSesion}>
            <button
              type="submit"
              className="flex min-h-11 items-center gap-1.5 rounded-lg border border-marca-borde px-3 text-sm text-marca-texto transition-colors hover:border-marca-acento"
            >
              <IconoSalir className="size-4" />
              Salir
            </button>
          </form>
        </header>

        {/* key=ruta reinicia la animación en cada cambio de módulo */}
        <main key={ruta} className="animate-modulo mx-auto w-full max-w-4xl flex-1 px-4 py-6">
          {children}
        </main>
      </div>
    </div>
  )
}

function ContenidoLateral({
  nombre,
  ruta,
  enVivo,
}: {
  nombre: string
  ruta: string
  enVivo: number | null
}) {
  const iniciales = nombre
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <>
      <div className="flex items-center gap-3 border-b border-panel-lateral-borde px-5 py-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-marca-acento font-titulo text-base font-bold text-marca-acento-texto">
          {iniciales}
        </span>
        <div className="min-w-0">
          <p className="truncate font-titulo text-sm font-bold text-panel-lateral-texto">
            {nombre}
          </p>
          <p className="text-xs text-panel-lateral-texto-suave">Panel del dueño</p>
        </div>
      </div>

      <nav aria-label="Módulos" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {MODULOS.map((m) => {
          const activo = ruta.startsWith(m.href)
          return (
            <Link
              key={m.href}
              href={m.href}
              aria-current={activo ? 'page' : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-all duration-200 ${
                activo
                  ? 'bg-marca-acento font-semibold text-marca-acento-texto shadow-sm'
                  : 'text-panel-lateral-texto-suave hover:translate-x-0.5 hover:bg-white/5 hover:text-panel-lateral-texto'
              }`}
            >
              <m.Icono className="size-5 shrink-0" />
              <span className="flex-1">{m.titulo}</span>
              {m.href === '/app/admin/pedidos' && enVivo !== null && enVivo > 0 ? (
                <span
                  className={`flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                    activo ? 'bg-black/20 text-marca-acento-texto' : 'bg-red-600 text-white'
                  }`}
                >
                  {enVivo}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
