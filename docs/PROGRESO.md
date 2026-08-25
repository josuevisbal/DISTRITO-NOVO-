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

---

## Fase 3 — Cocinas y pase

**Objetivo:** confirmar un pedido con productos de las tres estaciones y ver los tickets
aparecer **escalonados**, no todos al tiempo.

### Hecho

- **Sesión y guardas por rol.**
  - `src/middleware.ts` + `src/lib/supabase/middleware.ts`: refrescan la sesión en cada
    request y protegen `/app` (sin sesión → login; con sesión en el login → a `/app`).
  - `src/lib/sesion.ts`: `staffActual()`, `exigirRol(...roles)` e `inicioDeRol(rol)`. La
    guarda de verdad es la RLS; esto solo evita mostrar pantallas que el rol no usa.
  - `/app/login` (Server Action con `useActionState`) e `/app` que reparte según el rol.
  - `BarraStaff`: quién eres y botón de salir, en todas las pantallas internas.
- **`/app/mesero`**: lista los pedidos de mesa `pendiente` y los confirma con
  `confirmar_pedido()`. Aquí es donde “nada entra a cocina sin confirmación”.
- **`/app/cocina` y `/app/cocina/[estacion]`**: fondo oscuro, tickets grandes, un botón
  Empezar/Listo por ticket y “Agotar” por producto. Si el usuario es de cocina, salta
  directo a su estación. Cronómetro-semáforo por ticket (verde → amarillo al 80 % →
  rojo al pasarse), con **color + ícono + texto + tiempo**, nunca solo color.
- **`/app/pase`**: cada pedido en cocina con una barra por estación (en gris la que no
  toca) y el botón **Liberar a despacho**, habilitado solo cuando el pedido está `listo`.
- **Realtime** (`src/lib/realtime.ts` y el propio tablero de cocina): mesero y pase
  refrescan del servidor ante cambios; cocina además reintenta cada 15 s para que una
  comanda con `disparo_en` futuro **aparezca sola** cuando su hora pasa, sin cron. Si la
  conexión se cae, cocina lo avisa y sigue reintentando sin perder el último estado.
- **Cronómetro anclado al servidor** (`src/lib/cronometro.ts`): el semáforo se calcula
  desde `disparo_en` y `objetivo_en` (= `disparo_en + minutos`). El navegador solo mide el
  desfase contra el reloj del servidor una vez al montar y corrige con él; nunca cronometra
  con su propio reloj a secas.
- **Usuarios de staff** (migración `crear_usuarios_staff_prueba`): siete cuentas de prueba,
  una por rol, con las tres de cocina atadas a su estación. Contraseña `distrito2026`.
- **Realtime habilitado** en `pedidos` y `comandas` (migración `realtime_pedidos_comandas`);
  la RLS sigue mandando: cada quien recibe solo lo que ya podía leer.

### Corregido: el login rechazaba a los usuarios creados a mano

Los usuarios se insertaron directo en `auth.users`. El hash y el correo estaban bien, pero
las columnas de token (`confirmation_token`, `recovery_token`, `email_change`, …) quedaron
en `NULL`, y GoTrue las lee como texto y falla al escanearlas, así que el login daba “correo
o contraseña incorrectos”. Se pasaron a cadena vacía (migración
`corregir_tokens_nulos_auth_usuarios_prueba`).

### Decisiones

- Los colores del semáforo son del **sistema**, no de la marca: son un código universal
  (verde/amarillo/rojo) y no deben cambiar por cliente. Los de la marca (`--marca-*`) siguen
  saliendo del tema; el color del **borde** de cada ticket sí es el de su estación, que vive
  en la base.
- Al marcar una comanda o liberar un pedido no se apaga el estado “ocupado” en el éxito: el
  refresco de Realtime retira o reordena la tarjeta, y apagarlo antes deja el botón activo un
  instante (riesgo de doble toque).
- El tablero filtra en la consulta por `disparo_en <= now()` además de la RLS, para que
  admin y pase vean el mismo tablero que la cocina.

### Verificado (en el navegador, extremo a extremo)

Pedido **#1004** de mesa con tres estaciones: Chicharronada (Asados, 18 min), Hamburguesa
(Comida rápida, 10 min) y Agua (Bebidas, 1 min).

1. Login del **mesero** → confirmó el pedido. `confirmar_pedido()` calculó el objetivo común
   (now + 18 min) y los disparos:

   | Estación | minutos | disparo tras confirmar |
   |---|---|---|
   | Asados | 18 | **0 min** (ya) |
   | Comida rápida | 10 | **+8 min** |
   | Bebidas | 1 | **+17 min** |

2. **Cocina Asados** (su usuario entró directo a su estación) mostró el ticket con semáforo
   verde “A tiempo” y cuenta regresiva viva; **Cocina Bebidas** mostró “Nada en preparación”
   porque su comanda aún no dispara. → **Tickets escalonados, no todos al tiempo.**
3. Se simuló que las tres estaciones terminaron: el disparador dejó el pedido en `listo`, el
   **pase** se actualizó solo por Realtime (tres barras “Listo”) y habilitó **Liberar a
   despacho**; al liberar, el pedido quedó `en_despacho`.

`tsc`, `eslint` y `npm run build` limpios (middleware de 94 kB incluido).

> Los pedidos #1001 (efectivo, pendiente), #1002 (transferencia, esperando_pago) y #1004
> (ahora en_despacho) quedan como datos de prueba para las fases de Caja y Domiciliario.

### Pendiente para fases siguientes

- Caja: verificar transferencias, contraentrega, arqueo y cierre de turno — Fase 4.
- Domiciliario: asignación y entrega — Fase 5. El pase asignará domiciliario ahí.

---

## Fase 4 — Caja y transferencias

**Objetivo:** cerrar un turno y que los cuatro medios de pago cuadren con los pedidos.

### Hecho

- **Funciones de caja** (migración `funciones_caja_turno_cobro_arqueo`, reflejadas en
  `schema.sql`). La fuente de verdad del arqueo es `caja_movimientos`: cada peso que entra
  deja un movimiento atado al turno abierto, así los cuatro medios cuadran solos.
  - `abrir_turno(base)` / `turno_abierto()` — un turno abierto a la vez por restaurante.
  - `registrar_cobro(pedido, medio, monto?)` — deja el pago verificado, el movimiento de
    caja y cierra el pedido. Para mesa, recoger y mostrador.
  - `confirmar_contraentrega(pedido)` — caja confirma un efectivo pendiente y entra a
    cocina; el efectivo se legaliza al entregar (Fase 5).
  - `anular_pedido(pedido, motivo)` — exige motivo y guarda responsable.
  - `cerrar_turno(efectivo_contado, nota?)` — calcula el efectivo esperado
    (base + ingresos efectivo − egresos) y la diferencia, y devuelve el arqueo por medio.
  - `verificar_transferencia` ahora, al aprobar, también deja el ingreso de transferencia
    en el turno abierto, para que cuente en el arqueo.
  - Todas `security definer`, revocadas de `anon` y concedidas solo a `authenticated`.
- **`/app/caja`** (guarda `cajero`/`admin`):
  - Barra de turno: abrir con base, arqueo en vivo por los cuatro medios, y cerrar.
  - **Alerta persistente de transferencias por verificar**, con el monto exacto y el
    contador de espera ("Esperando hace 37 min"). No se cierra sola: solo con "Verifiqué el
    pago" (tras ver el banco) o "Rechazar" con motivo. El texto recuerda que el pantallazo
    es una pista, no una prueba.
  - **Contraentrega por confirmar** y **Por cobrar** (mesa/recoger/mostrador) con selector
    de medio (efectivo, transferencia, datáfono).
  - **Anular con motivo** en línea, en cualquier tarjeta activa.
  - **Resumen de cierre** con el desglose por medio, base, esperado, contado y diferencia
    ("Cuadra" con check, o el faltante con alerta). Vive a nivel de página para que
    sobreviva al refresco que deja el turno en null.
- Tipos regenerados en `src/lib/database.types.ts` con las funciones nuevas.

### Corregido

- **Un pedido pagado no debe reaparecer "por cobrar".** Al verificar una transferencia de
  un pedido para recoger, entraba a cocina y volvía a salir en "Por cobrar". Ahora esa
  sección excluye los pedidos que ya tienen un pago verificado.
- **El dev server se corrompió al correr `npm run build` con `next dev` vivo**: ambos
  escriben en `.next`. Se resolvió deteniendo el preview, borrando `.next` y reiniciando.
  Regla: no compilar producción con el dev server corriendo.

### Verificado (en el navegador, contra la base)

Con el turno abierto (base $200.000):

| Medio | Pedidos | Total |
|---|---|---|
| Efectivo | #1004 (mesa, cobrado) | $60.500 |
| Transferencia | #1002 + #1003 (verificadas) | $76.405 |

Al cerrar contando $260.500 (base + efectivo): **efectivo esperado $260.500, contado
$260.500, diferencia $0** y el desglose por medio cuadra con los pedidos. También se probó
la **anulación con motivo**: pedido #1005 quedó `anulado` con motivo "Cliente no llegó a
recoger" y responsable "Cajero". `tsc`, `eslint` y `npm run build` limpios.

### Pendiente para fases siguientes

- La legalización del efectivo del domiciliario alimentará el arqueo como movimiento
  `legalizacion`/`efectivo` — Fase 5 (ya está contemplado en `cerrar_turno`).
- El ingreso por `pasarela` lo dejará el webhook — Fase 6.

---

## Fase 5 — Domiciliario

**Objetivo:** entregar un pedido en efectivo y que el monto aparezca en Caja por legalizar.

### Hecho

- **Funciones de domiciliario** (migración `funciones_domiciliario_entrega_legalizacion`,
  reflejadas en `schema.sql`; columna nueva `pedidos.nota_entrega`):
  - `asignar_domiciliario(pedido, domi)` — pase/admin; el pedido debe estar en despacho y el
    domiciliario ser del mismo restaurante.
  - `recoger_pedido(pedido)` — domiciliario; en_despacho → en_camino, solo su pedido.
  - `entregar_pedido(pedido)` — domiciliario; en_camino → `entregado` si es efectivo (queda
    por legalizar) o `cerrado` si ya venía pago.
  - `fallo_entrega(pedido, motivo)` — vuelve a despacho con el motivo en `nota_entrega`.
  - `legalizar_domiciliario(domi)` — caja; por cada entrega en efectivo de esa persona deja
    un movimiento `legalizacion`/`efectivo` en el turno, un pago verificado, y cierra el
    pedido. Devuelve el total.
  - Todas `security definer`, revocadas de `anon`, concedidas a `authenticated`.
- **`/app/domicilios`** (guarda `domiciliario`/`admin`): lista de asignados con detalle de
  **dirección grande** (se lee de pie), zona, indicaciones, **qué lleva**, y botones de
  **Llamar** (`tel:`) y **WhatsApp** (`wa.me` con indicativo, sin quemarlo). Estados:
  "Recogí, voy en camino" → "Entregué" / "No pude entregar" (con motivo).
- **Recuadro de cobro** (`src/lib/telefono.ts` para los enlaces): **amarillo** con el monto
  si es efectivo, **verde "Ya está pago · No cobrar"** si ya venía pago. El color va con
  ícono y texto, nunca solo color.
- **Pase** ahora asigna domiciliario: nueva sección "Domicilios por despachar" con la
  dirección, un selector de domiciliario y el botón Asignar/Reasignar. Si un pedido volvió
  por un intento fallido, muestra el motivo.
- **Caja** ahora tiene "Efectivo de domiciliarios por legalizar": el efectivo entregado y
  aún no recibido, agrupado por persona, con un botón "Recibí $X" que lo legaliza y lo mete
  al arqueo.
- Tipos regenerados (columna `nota_entrega` y las cinco funciones nuevas).

### Verificado (en el navegador, extremo a extremo)

Pedido **#1001** (domicilio, efectivo, $74.500):

1. **Pase**: se liberó a despacho y apareció en "Domicilios por despachar"; se le asignó el
   Domiciliario. En la base quedó `en_despacho` con `domiciliario_id`.
2. **Domiciliario**: vio la dirección grande, la zona (Riomar), el recuadro **amarillo
   "Cobrar en efectivo $74.500"**, "Qué lleva (4)", y los enlaces `tel:3009998877` y
   `wa.me/573009998877`. Marcó "Recogí, voy en camino" (→ `en_camino`) y "Entregué"
   (→ `entregado`, con `entregado_en`).
3. **Caja**: apareció "Domiciliario · $74.500 · 1 entrega por recibir". Al tocar "Recibí
   $74.500" se creó el movimiento `legalizacion`/`efectivo`, el pedido quedó `cerrado` y el
   arqueo de efectivo del turno subió a $74.500. → **el monto aparece en Caja por legalizar
   y luego cuadra.**

También se verificó el recuadro **verde "Ya está pago · No cobrar"** con el pedido #1003
(transferencia ya verificada). `tsc`, `eslint` y `npm run build` limpios.

### Pendiente para fases siguientes

- Admin: CRUD de carta, promociones, zonas y usuarios; reportes; PWA y despliegue — Fase 6.
- El webhook de pasarela dejará su ingreso en el arqueo — Fase 6.

---

## Rediseño visual y fotos (a pedido del cliente)

- **Dos temas por tokens** (`src/config/tema.ts`): la **carta del cliente** quedó negra y
  dorada premium (`obtenerTemaCarta`, como la carta impresa) y los **módulos internos**
  blancos y dorados corporativos (`obtenerTema`). Cada layout aplica el suyo. Un cambio de
  tokens repinta todo; los componentes nunca llevan color quemado.
- **Carta premium**: logotipo en Cinzel Decorative con degradado, encabezados de sección
  enmarcados, placas de precio doradas, **portada** de comidas detrás del logo, **foto por
  producto**, **sello POPULAR** (columna `destacado`) y **fondo de imagen** en la promo de
  domicilio. Animaciones de entrada (`globals.css`, clase `.entra`).
- **Admin de carta** (`/app/admin/carta`): sube, cambia y quita la foto de cada plato, y
  alterna POPULAR y disponible. La subida usa la **sesión del admin** con **RLS de Storage**
  (bucket `productos`), sin exponer `service_role` (la variable de entorno de ese key está
  inválida en este proyecto; se evitó por completo).
- **Fotos de referencia** cargadas a Storage (14 imágenes) para que la carta se vea poblada;
  el admin las reemplaza por las reales cuando quiera.
- Animaciones de entrada escalonadas en mesero, cocina, pase y domicilios.

---

## Fase 6 — Administración y despliegue (en curso)

**Hecho**
- **Reportes** (`/app/admin/reportes` + función `reporte_ventas`): ventas totales, número de
  pedidos, ticket promedio, ventas por canal, por hora, productos más vendidos y tiempo
  promedio por estación (últimos 30 días). Verificado con datos reales.
- **Promociones** (`/app/admin/promociones`): encender/apagar cada promo y editar
  etiqueta, título, descripción y el monto de envío gratis. Verificado.
- **Zonas** (`/app/admin/zonas`): editar el valor por barrio, activar/desactivar y agregar
  barrios nuevos.
- **Usuarios** (`/app/admin/usuarios`): cambiar rol, estación de cocina y acceso de cada
  persona (un admin no puede quitarse el acceso a sí mismo).
- **Carta** (`/app/admin/carta`): fotos, POPULAR y disponibilidad (arriba).
- **Navegación de admin** por pestañas (`NavAdmin`).
- **PWA**: `manifest.webmanifest` (`display: standalone`), ícono y `theme-color` para
  instalar en las tablets de cocina y el celular del domiciliario.

**Pendiente**
- Alta de nuevos logins desde el admin: requiere `service_role` válida o la API de auth;
  hoy la variable está inválida, así que los usuarios se crean por SQL/consola de Supabase.
- Webhook de pasarela (ingreso automático en el arqueo).
- Despliegue en Vercel (necesita la cuenta del cliente y conectar el repo de GitHub).

---

# Reestructuración (panel del dueño + roles en dos niveles)

## Fase R1 — Roles: dueño vs administrador

**Objetivo:** separar `dueno` (ve todo, incluida rentabilidad y costos) de `admin` (opera
el día a día, sin plata sensible), aplicado en RLS y no solo en la interfaz.

### Hecho

- **`supabase/roles-dueno.sql`** (2 pasos: el enum primero, el resto después):
  - Enum `rol_usuario` gana `dueno`.
  - **`producto_costos`** en tabla aparte con RLS solo-dueño: `productos` es de lectura
    pública (la carta), así que el costo jamás podía vivir ahí.
  - **`tr_proteger_dueno`**: ni admins ni nadie (salvo el propio dueño) puede tocar la
    cuenta del dueño ni nombrar dueños. Solo aplica a sesiones de la app; el SQL Editor
    queda libre para emergencias.
  - Todas las políticas y funciones que aceptaban `admin` ahora aceptan también `dueno`
    (caja, pase, catálogo, storage, reportes).
  - **`reporte_rentabilidad(p_dias)`** y **`actualizar_costo(producto, costo)`**: solo el
    dueño; cualquier otro rol recibe error de la base.
  - `admin@distrito.test` pasa a ser `dueno`.
- **Código**: `exigirRol` deja pasar al dueño a todo; `inicioDeRol('dueno')` → Reportes.
  En **Reportes** aparece la sección **Rentabilidad y costos** (ventas, costo, utilidad,
  margen, editor de costo por plato en línea) que solo se consulta y se monta si el rol es
  `dueno`. En **Usuarios**, solo el dueño puede asignar el rol dueño, y las filas de dueño
  se muestran bloqueadas para los admin.
- `schema.sql` y `post-seed.sql` (plantilla) al día para instalaciones nuevas.

### Verificado (extremo a extremo, base de desarrollo)

1. **Como dueño** (`admin@distrito.test`): el login lo lleva directo a Reportes, la barra
   dice "Dueño", y la sección **Rentabilidad y costos** aparece con datos reales. Se editó
   el costo de la Chicharronada ($18.000 × 2 vendidas): la utilidad de la fila y los KPI
   (costo $36.000, margen 83 %) se recalcularon al instante.
2. **Como admin** (se convirtió temporalmente al cajero en admin): Reportes carga con sus
   cuatro paneles pero **sin** Rentabilidad. Llamando la RPC a mano con su sesión, la base
   respondió **"Solo el dueño"**; leyendo `producto_costos` directo, la RLS devolvió **0
   filas** (el costo existe pero no lo ve). Intentando desactivar al dueño vía PATCH, el
   disparador respondió **"Solo el dueño puede modificar la cuenta del dueño"**.
3. El cajero volvió a su rol. `tsc`, `eslint` limpios.

> Nota operativa: la base de desarrollo se pausó (plan gratis) y al restaurarla volvió con
> el respaldo completo. En producción, la migración es `supabase/roles-dueno.sql` en dos
> pasos, pendiente de que el cliente la corra en su SQL Editor.

## Fase R2 — Armazón del panel con barra lateral y animaciones

**Objetivo:** navegar los módulos existentes dentro de una barra lateral fija con
transiciones, sin perder nada de lo que ya funcionaba.

### Hecho

- **`PanelArmazon`** (`src/components/panel/panel-armazon.tsx`) + layout de `/app/admin`:
  - Barra lateral fija a la izquierda, oscura, con el logo (iniciales del restaurante,
    leídas de la base), los 6 módulos con ícono SVG y el activo resaltado en dorado.
  - En celular se colapsa a hamburguesa con cajón lateral (se cierra al navegar).
  - Encabezado con el nombre del módulo, el usuario conectado y su rol, y Salir.
  - Contenido con **transición de módulo** (fundido + deslizamiento, 220 ms) al navegar;
    tarjetas con `.tarjeta`/`.tarjeta-hover` (12 px, borde fino, sombra suave, elevación).
    Todo respeta `prefers-reduced-motion`.
- **Colores por tokens nuevos** (`--panel-lateral*` en `tema.ts`): nada quemado en los
  componentes; el área de contenido pasó a `#FAFAFB` (gris muy claro corporativo).
- **Módulos movidos adentro**: Carta, Promociones, Zonas, **Caja y finanzas** (nueva ruta
  `/app/admin/caja` que reutiliza `cargarCaja()` compartida con la pantalla del cajero),
  Equipo (usuarios) y Reportes. Se eliminó la vieja `NavAdmin` de pestañas.
- La pantalla del cajero (`/app/caja`) quedó intacta, fuera del panel.
- Blindado: Reportes ya no revienta si la RPC devuelve null (muestra el error).

### Verificado (en el navegador)

- Como dueño: la lateral muestra los 6 módulos, "Reportes" activo en dorado, header con
  "Admin · Dueño", Rentabilidad presente. Navegación a **Caja y finanzas** dentro del panel
  con el turno real ($74.500). Carta/Promos/Zonas/Equipo cargan dentro del armazón (200).
- Transición de módulo activa (`animation: modulo 0.22s` en el main).
- **Móvil (375px)**: lateral oculta, hamburguesa abre el cajón con los 6 módulos, navegar
  cierra el cajón y cambia el módulo.
- `tsc`, `eslint` y `npm run build` limpios.

## Fase R3 — Tablero

**Objetivo:** al entrar como dueño, el Tablero es lo primero que se ve, con datos reales.

### Hecho

- **`/app/admin/tablero`** (+ `src/lib/datos/tablero.ts`): resumen del día con
  - 4 KPI con **conteo animado** (~700 ms, easing suave, salta directo con
    `prefers-reduced-motion`): ventas de hoy, pedidos, ticket promedio y en cocina.
  - **Venta por punto de cocina**: barras con el color de cada estación (de la base) que
    crecen al montar.
  - **Alertas accionables** (cada una lleva a su módulo): transferencias sin verificar
    (rojo → Caja), productos agotados (ámbar → Carta), domicilios devueltos (→ Pase) y
    turno sin abrir (→ Caja). Si no hay nada: "Todo en orden".
  - Chip de estado del turno (abierto / sin turno) y subtítulo "Resumen de hoy · día".
- **El día es el del negocio**, no el de UTC (`src/lib/zona-horaria.ts`, configurable con
  `ZONA_HORARIA`, Bogotá por defecto): a las 7 p. m. en Barranquilla las ventas no se van
  al día siguiente.
- Tablero es el primer módulo de la lateral y el destino del login para dueño y admin;
  `/app/admin` redirige ahí.
- Se refresca solo por Realtime cuando cambian los pedidos.

### Verificado (en el navegador, con datos reales)

Se crearon 2 pedidos de prueba "de hoy" vía `crear_pedido` (uno efectivo, uno
transferencia): el Tablero mostró **$41.000 · 2 pedidos · ticket $20.500 · 1 en cocina**,
la barra de Comida rápida al 100 % con su color, y la alerta roja "1 transferencia sin
verificar en caja" apuntando a Caja. El conteo animado sube de 0 al valor al entrar.

> Tropiezo de entorno: el dev server (Turbopack en Windows) quedó sirviendo un bundle roto
> de una edición intermedia y no recompiló al corregirla; el reinicio del server lo sanó.
> No era un bug del código (el build de producción ya pasaba).

## Fase R4 — Pedidos en vivo

**Objetivo:** hacer un pedido de prueba y verlo aparecer y cambiar de estado en vivo.

### Hecho

- **`/app/admin/pedidos`** (+ `src/lib/datos/pedidos-vivo.ts`): todos los pedidos del
  momento (todo estado antes de `cerrado`/`anulado`), del más nuevo al más viejo. Cada fila:
  mesa o número, canal y cliente, **píldora de estado** con color del sistema + ícono +
  texto (rojo = exige acción humana), estaciones listas x/y cuando está en cocina, ítems,
  "hace cuánto" con el reloj corregido del servidor, y el total.
- **Realtime de verdad**: la vista se refresca sola ante cualquier cambio en `pedidos` o
  `comandas` (más un reintento cada 15 s).
- **Insignia en la barra lateral**: "Pedidos en vivo" muestra el conteo en rojo, vivo
  también (conteo inicial + suscripción Realtime en el armazón; la RLS limita el conteo al
  restaurante del usuario).
- `ESTADOS_VIVOS` vive en un módulo neutro (`src/lib/estados-vivos.ts`) que comparten la
  página (server) y el contador (cliente).

### Verificado (en el navegador, en vivo)

Con la vista abierta y sin recargar:
1. Se creó el pedido **#1008** vía `crear_pedido` → **apareció solo** (de 4 a 5 filas) por
   Realtime, con su píldora "Por confirmar".
2. Se confirmó vía `confirmar_pedido` → la píldora **cambió sola a "En cocina"**.
La insignia de la lateral marcaba el conteo (4 → 5). `tsc`, `eslint` y build limpios.

## Fase R5 — Pulido de las pantallas de operación

**Objetivo:** que cocina, pase, mesero, caja y domiciliario se vean coherentes con el
resto y respeten los roles.

### Hecho

- **Cocina y domiciliario vuelven a fondo oscuro** (se usan de pie, de lejos y con prisa):
  `MarcoOscuro` aplica el tema oscuro por tokens (`obtenerTemaOperacion()` en `tema.ts`)
  sobre el claro del área interna; ningún componente cambió sus clases.
  - El **semáforo de cocina** volvió a su paleta oscura de alto contraste (relleno profundo
    + texto claro), siempre con ícono y texto.
  - El **recuadro de cobro del domiciliario** (amarillo cobrar / verde no cobrar) también.
  - Sin animaciones nuevas en estas dos pantallas: solo la entrada única de los tickets.
- **Mesero, pase y caja** (pantallas claras) adoptaron la tarjeta del panel (`.tarjeta`:
  12 px, borde fino, sombra suave), quedando visualmente iguales a los módulos del armazón.
- Los roles ya venían aplicados de la Fase R1 (dueño pasa a todas; cada rol solo la suya).

### Verificado (en el navegador)

- `/app/cocina/asados`: fondo `#0B0B0C`, ticket con semáforo rojo oscuro "Atrasado" (un
  pedido viejo de pruebas, correctamente pasado de tiempo).
- `/app/domicilios`: tema oscuro aplicado. `/app/pase`, `/app/mesero`, `/app/caja`: fondo
  claro `#FAFAFB` y tarjetas `.tarjeta`.
- `tsc`, `eslint` y `npm run build` limpios.

## Fase R6 — Fotos, limpieza y menú por familias

**Objetivo:** carta sin fotos de relleno (marcador elegante donde no haya foto real),
reportes limpios, y el menú mostrando una familia a la vez (pedido del dueño).

### Hecho

- **Menú por familias** (rediseño a pedido, estilo referencia): los chips de categoría ya
  no hacen scroll — **seleccionan la familia** y se ve solo esa, con animación de entrada
  al cambiar. Tarjetas estilo carta de restaurante: nombre en dorado, descripción, precio
  grande, botón Agregar, y el **plato redondo a la derecha**.
- **Marcador elegante sin foto**: círculo con la inicial del plato sobre un degradado del
  color de su estación (también en el admin de Carta). Cuando el admin sube la foto real,
  la reemplaza al instante; el flujo de subir/cambiar/quitar quedó intacto.
- **Fotos de relleno eliminadas** (base de desarrollo): `foto_url` en null y los 12
  `cat-*.jpg` borrados del bucket vía Storage API (SQL directo está prohibido por
  Supabase). La **portada y la imagen de la promo se conservan** (pedidas expresamente).
- **Datos de prueba borrados** (desarrollo): pedidos, items, comandas, pagos y caja en
  ceros; la numeración volvió a 1000.
- **`supabase/limpieza.sql`** para producción: mismas dos limpiezas, para correr una vez
  antes de operar de verdad (con nota de cómo borrar los archivos del bucket).

### Verificado (en el navegador)

- Entradas visible sola (4 tarjetas); clic en "Hamburguesas" → cambia la familia y solo se
  ve esa (5 tarjetas). Marcadores circulares con inicial ("C", "H") sobre el color de la
  estación. Precio grande dorado y Agregar en cada tarjeta.
- Tablero y Pedidos en vivo en ceros tras la limpieza. `tsc`, `eslint` y build limpios.

---

# Pulido visual completo (nueva ronda)

## Fase 0 — Cronómetro y datos limpios

- **Cronómetro verificado**: siempre contó desde `disparo_en` (cuando la comanda entra a
  su estación) hacia `objetivo_en` — nunca desde `creado_en`. El "-674:32" era el formato
  `m:ss` aplicado a comandas de prueba de hace días. Se humanizó: menos de una hora se ve
  `15:32`; una hora o más se ve `11 h 14 min` (`formatearRestante` en `cronometro.ts`).
- **Desarrollo en ceros confirmado** (0 pedidos/comandas/pagos/movimientos/turnos, ya
  limpiado en R6). Pedido fresco #1000 de tres estaciones: Asados mostró
  **"A tiempo · 15:32"** (verde, minutos reales) y Cocina Rápida "Nada en preparación"
  porque su comanda dispara 8 min después — escalonado y RLS intactos.
- **Producción**: correr `supabase/limpieza.sql` (una vez, antes de operar) borra pedidos,
  comandas, pagos y caja de prueba sin tocar carta, zonas, mesas, promociones ni usuarios.

## Fase 1 (pulido) — Tipografía: Inter adentro, Cinzel solo en la carta

- El cambio se hizo **en los temas, no en los componentes**: `TEMA_BASE` (panel y pantallas
  claras) y el nuevo `TEMA_OPERACION` (cocina/domiciliario oscuros) declaran
  `fuenteTitulo: var(--fuente-texto)` → todos los `font-titulo` internos resuelven a Inter
  con sus pesos 600–700 ya existentes. `TEMA_CARTA` conserva la serif.
- Verificado con estilos computados: cocina en Inter (título y tickets); carta pública con
  logo en Cinzel Decorative, encabezado de familia y nombres de plato en Cinzel.

## Fase 2 (pulido) — Cocina como KDS profesional

- **Tema claro por defecto** (coherente con el panel) con **botón sol/luna**: el cocinero
  elige y la preferencia se recuerda en el dispositivo (`localStorage`, preferencia de
  interfaz, no dato del negocio). Verificado: cambia a oscuro y sobrevive la recarga.
- **Barra de estación**: ícono de llama sobre el color de la estación, nombre, contador
  EN COLA y reloj en vivo (con el desfase del servidor corregido).
- **Tickets KDS**: borde superior de 4 px del color del semáforo y chip del tiempo con
  punto + cuenta (`1:27`, y atrasos humanizados `1 h 05 min`); número de pedido grande;
  chip de origen (MESA 7 / DOMICILIO / MOSTRADOR); cantidades grandes en el color de la
  estación; **notas del cliente en recuadro ámbar** con ícono; en preparación, **barra de
  avance** hacia el objetivo ("Objetivo 18 min · quedan 1"); botones de 56 px
  "Empezar a preparar" → "Marcar listo" (verde).
- Leyenda al pie explicando el semáforo. Realtime, reintento y aviso sin conexión intactos.
- Verificado en vivo con el ticket #1000: ámbar al 80 % del objetivo, barra de avance al
  empezar, toggle y persistencia del tema.

## Fase 3 (pulido) — Caja profesional con notificaciones tipo mensaje

- **Transferencias por verificar como notificaciones**: tarjeta fija arriba a la derecha
  con franja ámbar, campana, "Nueva transferencia", pedido y hace cuánto, el **valor
  exacto destacado** en recuadro punteado, y botones **Verifiqué** (verde) / **No llegó**
  (con confirmación "¿Anular pedido?" antes de anular). Entran deslizándose desde la
  derecha (250 ms, respeta `prefers-reduced-motion`), se apilan si hay varias y **solo se
  quitan con acción humana**. Reemplazan a la antigua sección en flujo.
- **Medios de pago como tarjetas con ícono de color** (billete verde, transferencia azul,
  datáfono morado, pasarela dorada) en el arqueo del turno y en el resumen de cierre.
- **Fade-up escalonado** de las secciones al cargar. Turno, contraentrega, cobros y
  legalización en tarjetas limpias con la tipografía nueva.
- Verificado **por uso real del dueño en el preview**: verificó las transferencias #1001 y
  #1002 desde las notificaciones (entraron a cocina y el monto quedó en el arqueo), abrió
  turno y cobró el #1000 en efectivo. `tsc` y `eslint` limpios.

## Fase 4 (pulido) — Reportes completos con filtro por mes

- **Función `reporte_rango(desde, hasta, zona)`** (solo admin/dueño): total, pedidos,
  ticket, ventas por día del mes (agrupadas en la zona del negocio), % por estación y top
  de productos. La zona llega por parámetro: nada quemado.
- **Filtro por mes**: chips de los últimos 6 meses (URL `?mes=AAAA-M`); el servidor
  consulta el mes elegido y el anterior y calcula las variaciones.
- **KPIs con comparación**: +X % / −X % con flecha verde/roja vs. el mes anterior; si el
  mes anterior no tiene datos, se dice "Sin datos de <mes>" en lugar de inventar.
- **Gráfica de línea** de ventas por día (Recharts) en dorado de marca, con tooltip en
  pesos. **% por estación** con barras de color y **ranking** de los 8 más vendidos.
- Conteo animado compartido (`src/lib/use-conteo.ts`, ahora usado también por el Tablero)
  **endurecido**: si la pestaña está oculta o hay `prefers-reduced-motion`, el número se
  fija directo (requestAnimationFrame no corre en pestañas ocultas y quedaba en 0).
- Verificado: julio 2026 → $132.500 · 3 pedidos · ticket $44.166, punto en la gráfica,
  65/33/2 % por estación, ranking, y sección de rentabilidad solo para el dueño.

## Fase de velocidad — Respuesta óptimista y micro-interacciones

**El problema (reportado por el dueño):** en cocina, tocar "Empezar a preparar" o "Marcar
listo" no cambiaba nada hasta recargar la página; igual en los demás módulos.

**Las dos causas y sus arreglos:**
1. `cambiarEstadoComanda` no revalidaba la ruta: la pantalla dependía solo de Realtime.
   Ahora revalida `/app/cocina` (layout) y `/app/pase`, y las acciones de caja revalidan
   también `/app/admin/caja`.
2. Aun revalidando, la ida al servidor se sentía. Se agregó **respuesta óptimista**: el
   estado cambia en el instante del toque y el servidor confirma detrás; si falla, se
   revierte (y en las tarjetas, vuelve con el error visible).

**Dónde aplica lo óptimista:** cocina (Empezar/Listo, el ticket cambia o sale al instante y
el contador EN COLA baja de una), pase (liberar), mesero (confirmar), caja (cobrar,
contraentrega, legalizar y las notificaciones de transferencia) y domiciliario (recogí /
entregué). Con vibración corta en dispositivos que la soportan.

**Micro-interacciones globales** (`globals.css`): todo botón, enlace y pastilla tiene
transición suave y "presión" al tocar (scale 0.96, 120 ms), hover con brillo sutil, y foco
visible dorado para teclado. Todo dentro de `prefers-reduced-motion: no-preference`.

**Medido en vivo** (con MutationObserver, sin el estrangulamiento de timers de pestañas
ocultas que ensuciaba la primera medición): **Empezar → Marcar listo: 25 ms** ·
**Marcar listo → el ticket sale: 20 ms**, y la comanda quedó `listo` en la base con el
pedido pasando a `listo` por el disparador. De ~1 s (o recarga manual) a instantáneo.

## Pulido · Fase 5 — Equipo completo

- **Crear usuarios desde el panel** (sin llave de servicio): función `crear_usuario()`
  security definer que valida (correo, contraseña ≥ 8, correo único), crea la cuenta de
  acceso y la fila de `usuarios` en una operación. admin crea roles de operación; SOLO el
  dueño crea admins. Columna nueva `usuarios.correo` (espejo del email) para la lista.
- **Eliminar usuarios** con confirmación inline (`eliminar_usuario()`): nadie se elimina a
  sí mismo, a los admins solo los toca el dueño, y la cuenta del dueño no se borra.
- **Filas alineadas en columnas**: nombre, correo, rol/estación, acceso, eliminar. El admin
  ve bloqueadas las cuentas de dueño y de otros admins (la base también lo impone).
- Tropiezo resuelto: `gen_salt` vive en el esquema `extensions` de Supabase; la función
  califica `extensions.crypt(...)`.
- Verificado E2E: creado "Mesero Dos" desde el formulario → inició sesión con su clave →
  eliminado desde la lista → sin rastro en `auth.users` ni `usuarios`.

## Pulido · Fases 6 y 7 — Promociones con foto y marca

- **Promociones**: cargador de **foto de fondo** con vista previa local antes de guardar
  (Storage vía sesión del admin), botón Quitar, e **interruptor animado** activa/inactiva.
  La carta ya pintaba `imagen_url` de fondo. Verificado E2E: elegir → vista previa →
  guardar → la imagen queda en Storage y en la tarjeta.
- **Marca**: `public/icono.svg` ahora es el monograma DN (negro + dorado) usado por el
  manifest PWA; para el logo real basta reemplazar ese archivo y `favicon.ico`, sin tocar
  código.
- **`supabase/actualizar-equipo.sql`**: script consolidado para producción con la columna
  `correo`, `crear_usuario`/`eliminar_usuario` y `reporte_rango` (correr una vez, después
  de `roles-dueno.sql`).

---

# Reestructuración de roles y flujos

## Fase F1 — Cinco roles y dos flujos completos

**Objetivo:** dejar el sistema con los cinco roles que de verdad existen en el local, y que
los dos flujos —salón y domicilio— se cierren de punta a punta sin un puesto intermedio.

### Roles: de siete a cinco

`admin · cajero · mesero · cocina · domicilio`. El enum `rol_usuario` se reconstruye en
`schema.sql` (Postgres no borra valores de un enum) y las cuentas viejas se reasignan solas:

| Antes | Ahora | Por qué |
|---|---|---|
| `dueno` | `admin` | Un solo rol de mando. Ve todo, incluidos costos y rentabilidad. |
| `pase` | `mesero` | El pase desaparece: la mesa la lleva el mesero, el domicilio lo lleva caja. |
| `domiciliario` | `domicilio` | El nombre del rol, como se dice en el negocio. |

La migración va arriba del archivo y solo corre si el enum trae los valores viejos. Tumba
`mi_rol()` con `cascade` (de ahí cuelgan casi todas las políticas) y las tres políticas de
Storage que comparan contra el enum; todo eso se recrea más abajo en el mismo archivo.
También se va `tr_proteger_dueno`. En su lugar, la base impide borrar o degradar **al
último administrador activo**: sin él nadie podría crear cuentas ni entrar al panel.

### Salón: el mesero cierra el círculo

- `/app/mesero` pasa de una lista a un puesto con cuatro pestañas: **Por confirmar**,
  **En cocina**, **Por llevar** y **Cuentas abiertas**, con las estaciones de cada pedido
  en chips de color para saber qué falta sin ir a preguntar.
- **Aviso sonoro** (`src/lib/aviso.ts`): dos tonos sintetizados con Web Audio —sin archivo
  que descargar— más vibración. Suena cuando entra un pedido por QR y cuando cocina deja
  uno listo. Como los navegadores no dejan sonar nada sin un toque previo, la pantalla
  muestra un botón para activarlo la primera vez.
- **Tomar pedido a mano**: hay clientes sin datos. `crear_pedido_interno()` (security
  definer) resuelve el slug desde `mi_restaurante()` y llama a `crear_pedido()`, así que los
  precios los sigue poniendo la base. Si la mesa ya tiene cuenta, lo nuevo entra a esa.
- **Sumar a una cuenta abierta**: `agregar_items_pedido()` mete los renglones al MISMO
  pedido con una **ronda** más alta y crea comandas nuevas con su propio disparo escalonado.
  `pedido_items.ronda` y `comandas.ronda` son columnas nuevas; el índice único de comandas
  pasa a `(pedido_id, estacion_id, ronda)`. Cocina ve una tarjeta por ronda, marcada
  "Ronda 2", y nunca vuelve a ver lo que ya despachó.
- **`marcar_servido()`**: el mesero avisa que lo llevó a la mesa. La cuenta sigue abierta
  para caja; esto solo lo saca de "por llevar".

### Domicilio: caja de punta a punta

- `asignar_domiciliario()` pasa de `pase` a `cajero`, acepta el pedido en `listo` y lo
  manda a `en_despacho` en el mismo acto: se acabó el paso de "liberar" del pase.
- Caja gana la pestaña **Domicilios** con la dirección, si es contraentrega, el botón de
  imprimir la cuenta y el selector de domiciliario.
- **Caja toma pedidos**: quien llama o llega al mostrador. Mismo `crear_pedido_interno()`,
  con canal mostrador / para recoger / domicilio, barrio con su tarifa y medio de pago.
- El domiciliario no cambia: recoge, entrega y caja legaliza el efectivo.

### Propinas y punto físico

- `pedidos.propina` y `caja_movimientos.propina`. `registrar_cobro()` recibe `p_propina`:
  el cobro entra a la caja por el total + la propina, pero la propina queda marcada aparte.
- En la fila de cobro hay un campo de propina y un atajo del **10 %** (lo acostumbrado en
  Colombia). Va vacío por defecto: nunca se cobra sola.
- El cierre de turno devuelve `propinas` y el resumen lo muestra: entró a la caja, pero no
  es venta del restaurante.
- La factura imprime la propina en su propio renglón, debajo del consumo.

### Verificación

Todo el esquema se corrió en un Postgres 16 limpio con un andamiaje mínimo de Supabase
(`auth.users`, `auth.uid()`, `storage`, roles `anon`/`authenticated`):

1. **Instalación limpia** y **segunda corrida** sobre la misma base: sin errores (es
   idempotente).
2. **Migración desde el esquema anterior** con cuatro cuentas cargadas: `dueno → admin`,
   `pase → mesero`, `domiciliario → domicilio`, `cajero` intacto, enum con cinco valores y
   las 33 políticas recreadas.
3. **Flujo de salón completo**: pedido por QR → confirmar (asados dispara ya, bebidas
   21 min después: el escalonado sigue vivo) → sumar una ronda (comanda nueva solo en
   rápida, ronda 2) → cocina termina todo → `listo` → servido → cobro con propina de
   $7.800 → `caja_movimientos` con `monto 85.800 / propina 7.800`.
4. **Flujo de domicilio completo**: caja toma el pedido ($48.000 + $6.000 de zona) → cocina
   → asignar domiciliario (pasa a `en_despacho`) → recoger → entregar → legalizar $54.000.
5. **Cierre de turno**: `{"propinas": 7800, "por_medio": {"efectivo": 139800}, …}`.

`npm run build`, `tsc --noEmit` y ESLint, en verde.

## Fase F2 — Fuera el disparo escalonado: todo entra de una

**Lo que pasaba:** en el pedido #1045 (chorizo + agua + jugo de fresa) el chorizo apareció
en Asados pero las bebidas no. No era un fallo: el escalonado calculaba que un agua toma
2 minutos y el chorizo 25, así que la comanda de Bebidas se programaba para 23 minutos
después, y hasta esa hora era invisible —la RLS y la consulta de cocina la escondían.

**La decisión del cliente:** todas las estaciones reciben su comanda **al confirmar**, sin
esperar turno. La barra sirve la bebida apenas entra el pedido mientras el asador va con la
carne.

- `confirmar_pedido()` y `agregar_items_pedido()` crean las comandas con
  `disparo_en = now()` para todas las estaciones.
- `disparo_en` **se queda** en la tabla: ahora vale la hora de confirmación, que es cuando
  arranca el cronómetro de cada estación. Nada de consultas, índices ni políticas cambió, y
  volver a escalonar sería tocar solo esas dos funciones.
- `objetivo_en` del pedido sigue siendo la hora del plato más lento: es cuando la mesa tiene
  todo servido.
- El archivo trae un rescate para las comandas que quedaron con hora futura de antes:
  `update comandas set disparo_en = now() where estado='pendiente' and disparo_en > now()`.
  Es idempotente y se agota solo, porque ya no se crea ninguna con hora futura.

**Verificado** en un Postgres 16 limpio, reproduciendo el #1045 exacto: chorizo (25 min),
agua (2 min) y jugo de fresa (4 min). Las dos comandas salen con 0 segundos de espera y la
pantalla de Bebidas muestra `1 x Agua, 1 x Jugo de fresa` de inmediato. Se simuló además una
comanda atascada a 21 minutos y, al volver a correr el archivo, quedó visible. Las rondas
que suma el mesero entran igual, sin espera.

## Fase F3 — Una mesa una cuenta, y la plata que llega después

Cinco cambios pedidos por el cliente, todos alrededor de una idea: la cuenta se cierra
cuando la plata entra, no cuando la comida sale.

### Una mesa, una cuenta

Antes, cada escaneo del QR abría un pedido nuevo: una mesa de cuatro terminaba con cuatro
cuentas. Ahora `crear_pedido()` mira si esa mesa ya tiene cuenta abierta
(`pendiente`/`en_cocina`/`listo`) y, si la tiene, mete lo pedido como una **ronda más** del
mismo pedido: mismo número, mismo total, un solo cobro al final.

Esa ronda entra **sin comanda**: aparece en la pantalla del mesero como "Pidieron más" y no
llega a cocina hasta que él la aprueba. Es la regla de siempre —nada entra a cocina sin
visto bueno— y de paso evita que un niño jugando con el QR llene la parrilla.
`confirmar_pedido()` ahora confirma **todas las rondas sin comanda**, así que el mesero
puede tocar confirmar cuantas veces haga falta sin repetir lo ya despachado.

De paso se factorizó lo que estaba duplicado: `_insertar_items_pedido()` (productos y
combos, con su prorrateo) y `_recalcular_totales()` (subtotal, domicilio por zona, promo de
envío) son ahora un solo sitio, usado por las tres puertas de entrada.

### El domiciliario no vuelve por cada entrega

Sale con varios domicilios, cobra en la calle y entrega todo junto al final del turno.
`entregar_pedido()` ya no cierra el pedido por no ser efectivo: **solo cierra lo que ya
tiene un pago verificado**. Todo lo demás queda `entregado`, que ahora significa
"la comida llegó, la plata no".

Caja gana la pestaña **Entregados sin cobrar**, con una fila por pedido, y la tarjeta de
cada domiciliario muestra el **detalle pedido por pedido** del efectivo que trae — para que
los dos cuenten sobre la misma lista. `cerrar_turno()` bloquea el cierre mientras quede
cualquier entrega sin pago verificado (antes solo miraba el efectivo).

### El cliente cambia de opinión en la puerta

`cambiar_a_transferencia()`: el domiciliario lo marca desde su celular, deja de traer esa
plata y su tarjeta pasa de "cobrar en efectivo" (amarillo) a "no recibas efectivo" (azul).
Caja lo ve como alerta y `verificar_transferencia()` —que antes solo servía para el pago
previo a cocinar— ahora distingue los dos casos: si el pedido esperaba pago, aprobarlo lo
manda a cocina; si ya está entregado, aprobarlo cierra la cuenta.

### Aviso de entregas para caja y administración

El aviso sonoro de caja suma las entregas a lo que ya vigilaba, y el Tablero gana la alerta
"N domicilios entregados sin cobrar" que lleva al monitoreo de caja.

### Pago repartido entre varios medios

`registrar_cobro_mixto(pedido, [{medio, monto}…], propina)`: una fila en `pagos` y un
movimiento de caja **por cada medio**, así el arqueo cuadra por medio sin repartir nada a
mano. La suma tiene que dar exacto la cuenta más la propina; si no cuadra, el error dice
los dos números para corregir antes de cobrar y no descubrirlo al cerrar el turno.

En la interfaz el caso común no se estorba: sigue siendo escoger medio y cobrar. Un botón
**Dividir el pago** abre un renglón por medio, cada uno con un atajo **El resto** que le
mete lo que falte —nada de restas de cabeza frente al cliente— y un contador en vivo que
dice "Faltan $X" o "Cuadra". El enum `medio_pago` gana `mixto` como etiqueta del pedido;
el desglose real vive en `pagos`.

### Verificado

Postgres 16 limpio, todo en una sola transacción (como el SQL Editor): instalación,
segunda corrida idempotente, y el recorrido completo —tres personas pidiendo por el QR de
la misma mesa (una cuenta, $45.000, tres comandas), cobro repartido 20/20/10 con $5.000 de
propina, la mesa volviendo a abrir cuenta después de cobrada, dos domicilios en efectivo
con uno cambiado a transferencia en la puerta, y el turno negándose a cerrar mientras
faltara plata. `tsc`, ESLint y `npm run build`, en verde.

## Propinas día por día en Reportes (administración)

La propina va aparte del total: la digita caja al cobrar y queda marcada en
`caja_movimientos` para que el arqueo la separe de la venta. Pero eso solo se veía por
turno, al cerrar caja: para repartir el mes había que volver a sumar cuenta por cuenta.
Reportes ya mostraba la venta del mes y ninguna propina. Se agrega la lista, como la que
ya tiene Caribbean Rooftop.

- **Función `propinas_por_dia(desde, hasta, zona)`** (solo administración, la misma puerta
  de `reporte_rango`): una fila por día con `propina`, `cuentas` (las que dejaron propina),
  y `cobrado` (la venta de ese día ya **sin** la propina).
- Sale de `caja_movimientos` —donde la propina queda marcada— y agrupa por el día del
  **cobro**, no por el día del pedido: un domicilio entregado hoy y cobrado mañana deja su
  propina en el día en que la plata entró a la caja, que es como cuadra el arqueo. Los
  egresos no cuentan; ingresos y legalizaciones sí.
- **En Reportes** (`/app/admin/reportes`): cuarta tarjeta **Propinas del mes** —con su
  variación vs. el mes anterior y cuántos días tuvieron propina— y una tabla día por día
  con día, cuentas, cobrado, propina y % del cobro, con totales al pie. Sigue el filtro de
  mes que ya existía. La propina nunca se suma a las ventas: va al lado, con su aviso de
  que es del equipo.
- Los días con cobros pero sin propina aparecen en `$0` con "—": que un día no dejara nada
  es un dato, no un hueco.
- **Para una base ya montada**: `supabase/historial/propinas-por-dia.sql` (seguro de
  re-correr). En bases nuevas ya viene en `supabase/schema.sql`.
- Verificado en Postgres 16 con datos de prueba: el cobro de las 9 p. m. de Bogotá (que en
  UTC es el día siguiente) cuenta en su día real, el egreso y el otro restaurante quedan
  fuera, el mes vecino no se cuela, y un rol que no es administración rebota con "Solo
  administración". `tsc`, ESLint y `npm run build`, en verde.
