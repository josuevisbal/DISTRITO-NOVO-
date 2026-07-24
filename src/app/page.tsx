import { obtenerTema, variablesTema } from '@/config/tema'
import { formatearPesos } from '@/lib/formato'
import { crearClienteServidor } from '@/lib/supabase/servidor'

/**
 * Página de prueba de la Fase 1: comprueba que la base responde y que la marca sale del
 * tema, no del código. En la Fase 2 la carta real vive en /[slug] y esto desaparece.
 */
export const dynamic = 'force-dynamic'

export default async function Inicio() {
  const supabase = await crearClienteServidor()

  const { data: restaurante, error: errorRestaurante } = await supabase
    .from('restaurantes')
    .select('id, nombre, slug')
    .eq('activo', true)
    .order('creado_en')
    .limit(1)
    .maybeSingle()

  if (errorRestaurante) return <Aviso mensaje={errorRestaurante.message} />
  if (!restaurante) {
    return <Aviso mensaje="No hay ningún restaurante activo. ¿Corriste el seed?" />
  }

  const [{ data: estaciones }, { data: categorias }, { data: productos, error: errorProductos }] =
    await Promise.all([
      supabase
        .from('estaciones')
        .select('id, nombre, color, orden')
        .eq('restaurante_id', restaurante.id)
        .order('orden'),
      supabase
        .from('categorias')
        .select('id, nombre, orden')
        .eq('restaurante_id', restaurante.id)
        .order('orden'),
      supabase
        .from('productos')
        .select('id, nombre, descripcion, precio, minutos_prep, disponible, categoria_id, estacion_id, orden')
        .eq('restaurante_id', restaurante.id)
        .order('orden'),
    ])

  if (errorProductos) return <Aviso mensaje={errorProductos.message} />

  const porEstacion = new Map((estaciones ?? []).map((e) => [e.id, e]))
  const tema = obtenerTema(restaurante.slug)

  return (
    <main
      style={variablesTema(tema)}
      className="min-h-screen bg-marca-fondo px-5 py-10 text-marca-texto sm:px-8"
    >
      <header className="mx-auto max-w-5xl border-b border-marca-borde pb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-marca-texto-suave">
          Fase 1 · prueba de conexión
        </p>
        <h1 className="mt-3 font-titulo text-4xl font-bold text-marca-acento sm:text-5xl">
          {restaurante.nombre}
        </h1>
        <p className="mt-3 text-marca-texto-suave">
          {productos?.length ?? 0} productos · {categorias?.length ?? 0} categorías ·{' '}
          {estaciones?.length ?? 0} estaciones, leídos desde Supabase.
        </p>
      </header>

      <div className="mx-auto mt-10 max-w-5xl space-y-12">
        {(categorias ?? []).map((categoria) => {
          const items = (productos ?? []).filter((p) => p.categoria_id === categoria.id)
          if (items.length === 0) return null

          return (
            <section key={categoria.id}>
              <h2 className="font-titulo text-2xl font-medium text-marca-texto">
                {categoria.nombre}
                <span className="ml-3 align-middle text-sm font-normal text-marca-texto-suave">
                  {items.length}
                </span>
              </h2>

              <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                {items.map((producto) => {
                  const estacion = producto.estacion_id
                    ? porEstacion.get(producto.estacion_id)
                    : undefined

                  return (
                    <li
                      key={producto.id}
                      className="flex gap-4 rounded-lg border border-marca-borde bg-marca-superficie p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-marca-texto">{producto.nombre}</h3>
                        {producto.descripcion ? (
                          <p className="mt-1 text-sm text-marca-texto-suave">
                            {producto.descripcion}
                          </p>
                        ) : null}

                        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                          {estacion ? (
                            // El color lo elige cada cliente en la base, así que no puede ir
                            // de relleno: no hay texto que garantice 4.5:1 contra cualquier
                            // color. Va de borde y punto, y el nombre lleva el color de marca.
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium text-marca-texto"
                              style={{ borderColor: estacion.color }}
                            >
                              <span
                                aria-hidden
                                className="size-2 rounded-full"
                                style={{ backgroundColor: estacion.color }}
                              />
                              {estacion.nombre}
                            </span>
                          ) : null}
                          <span className="text-marca-texto-suave">
                            {producto.minutos_prep} min
                          </span>
                          {!producto.disponible ? (
                            <span className="rounded-full border border-marca-borde px-2.5 py-1 text-marca-texto-suave">
                              Agotado
                            </span>
                          ) : null}
                        </p>
                      </div>

                      <p className="shrink-0 self-start rounded-md border border-marca-acento px-3 py-1.5 font-medium text-marca-acento">
                        {formatearPesos(producto.precio)}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
    </main>
  )
}

function Aviso({ mensaje }: { mensaje: string }) {
  const tema = obtenerTema('')

  return (
    <main
      style={variablesTema(tema)}
      className="flex min-h-screen items-center justify-center bg-marca-fondo p-8 text-marca-texto"
    >
      <div className="max-w-md rounded-lg border border-marca-borde bg-marca-superficie p-6">
        <h1 className="font-titulo text-xl text-marca-acento">No se pudo leer la carta</h1>
        <p className="mt-3 text-sm text-marca-texto-suave">{mensaje}</p>
      </div>
    </main>
  )
}
