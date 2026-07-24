# Progreso

Bitácora de avance del sistema de pedidos multicocina. Una fase a la vez: al terminar cada
una se actualiza este archivo, se hace commit y se espera visto bueno antes de seguir.

---

## Fase 1 — Base

**Objetivo:** que `npm run dev` levante y una página de prueba liste los 84 productos
leyéndolos de Supabase.

### Hecho

- Proyecto `create-next-app` con TypeScript estricto, Tailwind 4, App Router y carpeta `src/`.
- Clientes de Supabase con `@supabase/ssr`:
  - `src/lib/supabase/servidor.ts` — Server Components, Server Actions y Route Handlers.
  - `src/lib/supabase/navegador.ts` — cliente del navegador para Realtime.
  - `src/lib/supabase/entorno.ts` — lee las variables y falla con mensaje claro si faltan.
- `supabase/schema.sql` y `supabase/seed-distrito-novo.sql` ejecutados en el proyecto
  Supabase `distrito-novo`. Carga verificada:

  | Tabla | Filas |
  |---|---|
  | `restaurantes` | 1 |
  | `estaciones` | 3 |
  | `categorias` | 12 |
  | `productos` | **84** |
  | `zonas_domicilio` | 6 |
  | `promociones` | 2 |
  | `mesas` | 12 |

  RLS activa en las 15 tablas.
- Tipos generados en `src/lib/database.types.ts`.
- `.env.example` con las tres variables. La `SERVICE_ROLE` nunca sale del servidor.
- `src/config/tema.ts`: único lugar con la marca. Expone tokens CSS
  (`--marca-fondo`, `--marca-acento`, …) que consumen los componentes. Para dar de alta
  otro restaurante basta con agregar su entrada.
- `src/lib/formato.ts`: `formatearPesos` → `$32.000`, sin decimales.
- `src/app/page.tsx`: página de prueba que lee restaurante, estaciones, categorías y los
  84 productos desde Supabase. No hardcodea nada de Distrito Novo — el restaurante se
  resuelve por consulta y la marca por `slug` desde `tema.ts`.

### Corregido: la carta pública no se podía leer

Al probar la página apareció `permission denied for function mi_restaurante`. Causa: las
políticas de staff (`staff_rest`, `admin_prod`, `admin_cat`, …) se crearon sin `to`, o sea
abiertas a `public`. Las políticas permisivas se suman con OR y Postgres las evalúa
**todas**, así que un comensal anónimo leyendo la carta terminaba ejecutando
`mi_restaurante()`, función que tiene el `execute` revocado para `anon`.

Arreglo: todas las políticas de staff, cocina, caja, domiciliario y admin quedaron acotadas
con `to authenticated`. Las `pub_*` siguen abiertas, que es su propósito. Corregido en
`supabase/schema.sql` y aplicado a la base con la migración
`acotar_politicas_staff_a_authenticated`.

Esto no era solo un estorbo de la Fase 1: sin el arreglo, la carta pública, el checkout y el
seguimiento por token de la Fase 2 fallarían igual.

### Decisiones

- El nombre del restaurante no vive en `layout.tsx`: el metadata de raíz es genérico y
  cada ruta `/[slug]` generará el suyo.
- Los colores de estación vienen de la columna `estaciones.color` en la base, no del
  código, para que otro cliente pueda tener otras estaciones.
- La página de prueba de `/` es temporal: en la Fase 2 la carta real vive en `/[slug]`.
- El badge de estación no lleva el color de la base como relleno: como el color lo elige
  cada cliente, ningún color de texto garantiza 4.5:1 contra todos (`#C2452F` de Asados
  daba 3.9:1 con texto oscuro). Va de borde y punto, con el nombre en el token de marca.

### Verificado

`npm run dev` levanta en el puerto 3000 y `/` renderiza **84 productos** en 12 secciones,
con las 3 estaciones y los precios en formato `$10.000`. Sin errores en consola.
`tsc --noEmit` y `eslint` pasan limpios.

### Pendiente para fases siguientes

- Middleware de sesión (`@supabase/ssr`) — llega con la Fase 3, cuando haya login.
- PWA y despliegue — Fase 6.

---

## Fase 2 — Carta pública y creación de pedidos

**Objetivo:** poder pedir desde el celular, que el pedido quede correcto en la base con el
domicilio calculado por zona y la promoción de envío aplicada, y ver la pantalla de
transferencia con llave y monto exacto.

### Hecho

- **Ruta `/[slug]`** (carta pública) con la identidad de Distrito Novo leída del tema: negro
  y dorado, títulos en Cinzel, precios en placas con borde dorado, categorías en chips
  horizontales pegajosos que marcan la sección visible.
  - `src/app/[slug]/layout.tsx`: cuelga el tema (`variablesTema`) y genera el `<title>` desde
    el nombre en la tabla `restaurantes`. Ningún componente conoce el slug del cliente.
  - `src/lib/datos/carta.ts`: una sola pasada trae restaurante, categorías, productos,
    promociones (con sus items) y zonas. Sin costos: eso es solo del admin.
- **Banner de promociones** arriba de todo (`promociones.tsx`): envío / combo / aviso, con
  ícono SVG por tipo. El combo agrega sus productos al carrito de un toque y muestra el
  precio **sumando los productos a su precio real**, no `precio_combo`, porque
  `crear_pedido` cobra la suma de `productos` (anunciar otro valor sería cobrar distinto).
- **Carrito y checkout** (`carta-cliente.tsx`, `checkout.tsx`): cantidades, notas por
  renglón, selector de barrio, entrega a domicilio o para recoger, y medio efectivo o
  transferencia. La vista previa del domicilio replica la regla del servidor
  (`src/lib/cuentas.ts`) pero deja claro que la cuenta que manda es la de la base.
- **Creación de pedidos** (`acciones.ts`, Server Action): llama a `crear_pedido(slug,
  payload)`. El navegador solo manda `producto_id`, `cantidad` y `notas`; **nunca un
  precio**. El estado inicial lo decide la función según canal y medio.
- **Pantalla de transferencia** en el seguimiento (`seguimiento-cliente.tsx`): valor exacto
  grande con el código de 3 cifras, llave y cuenta copiables (leídas de `restaurantes`).
  Alerta persistente de que el pedido no entra a cocina hasta que caja verifique.
- **Ruta `/[slug]/pedido/[token]`**: línea de estados con check en lo cumplido, punto en el
  activo y texto — nunca solo color. Se relee del servidor cada 15 s (la verdad vive en
  Supabase, no en el reloj del navegador).
- **Ruta `/[slug]/mesa/[qr_token]`**: la misma carta atada a una mesa; el pedido entra por
  canal `mesa` y queda `pendiente` para que lo confirme el mesero.
- **Cliente por token** (`src/lib/supabase/token.ts`): el comensal no tiene cuenta; su
  permiso es el token del pedido, que viaja en la cabecera `x-pedido-token` y la RLS compara
  contra `pedidos.token`. Va en cabecera y no en la consulta para que el filtro lo ponga la
  base, no el front.
- **Íconos SVG** en `src/components/iconos.tsx`. Cero emojis.
- `src/app/page.tsx` (raíz) ahora redirige al primer restaurante activo por su slug; se fue
  la página de prueba de la Fase 1.

### Corregido: el seguimiento no mostraba los productos

La RLS dejaba al comensal ver su pedido con el token pero no sus renglones (`pedido_items`
solo lo veía el staff). Se agregó la política `pub_items_token`: los items visibles cuando el
token en la cabecera coincide con el del pedido dueño. Corregido en `schema.sql` y aplicado
con la migración `items_visibles_con_token_del_pedido`.

### Decisiones

- El estado inicial del pedido lo pone `crear_pedido` en la base, no el front: `mesa` y
  contraentrega quedan `pendiente`, transferencia `esperando_pago`, pasarela `pendiente`
  (la confirma el webhook de la Fase 6).
- Tras confirmar no se limpia el carrito ni se apaga el `enviando`: la navegación al
  seguimiento desmonta la pantalla, y apagarlo antes dejaba el botón activo un instante,
  con riesgo de doble pedido.
- El combo del banner no usa `precio_combo` para lo que cobra: usa la suma real de los
  productos, que es lo que la base va a cobrar.

### Verificado (en el navegador, extremo a extremo)

- **Pedido #1001** — domicilio, barrio Riomar (que cuesta $8.000), subtotal $74.500. Como
  superó el umbral de $70.000 de la promo de envío, quedó con **domicilio $0** y total
  $74.500. Precios de los 4 renglones puestos por el servidor. Estado `pendiente` (efectivo).
- **Pedido #1002** — para recoger, transferencia. Quedó en `esperando_pago` y el seguimiento
  mostró el valor exacto **$10.202** (código 202), la llave `@distritonovo` y la cuenta,
  todo desde `restaurantes`.
- Ruta de mesa por QR: carga la carta con el chip "Mesa 1".
- `tsc --noEmit` y `eslint` limpios. Sin errores en consola.

> Nota: los pedidos #1001 (pendiente/efectivo) y #1002 (esperando_pago/transferencia) se
> dejaron en la base a propósito, como datos de prueba para el mesero y la caja de fases
> siguientes.

### Pendiente para fases siguientes

- Login y guardas por rol; `/app/mesero` para confirmar los pedidos de mesa — Fase 3.
- Verificación humana de la transferencia en Caja — Fase 4.
- El seed no trae ninguna promoción tipo `combo`; el camino está codificado y probado por
  tipos, pero se ejercitará cuando el admin cree una (Fase 6).
