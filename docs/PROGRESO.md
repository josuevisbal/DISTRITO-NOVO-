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
