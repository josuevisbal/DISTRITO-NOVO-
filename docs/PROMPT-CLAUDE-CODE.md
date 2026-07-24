# Prompt para Claude Code — Sistema de pedidos multicocina · Distrito Novo

> Pegar este documento completo en la **primera sesión** de Claude Code, dentro de una
> carpeta vacía. Los archivos `schema.sql` y `seed-distrito-novo.sql` deben estar en
> `supabase/` antes de empezar.

---

## Qué vas a construir

Un sistema de pedidos para un restaurante con **tres puntos de cocina en un mismo local**.
Un pedido entra por cualquier canal, se parte solo por estación, y cada estación recibe su
comanda en el minuto exacto para que todo salga junto a la mesa. Incluye finanzas, caja y
una aplicación para el domiciliario.

El cliente real es **Distrito Novo** (Barranquilla, Colombia), pero el sistema se construye
**multi-tenant desde el día uno**: toda tabla lleva `restaurante_id` y todo se resuelve por
`slug`. No hardcodees nada de Distrito Novo en el código; va en la base de datos.

Las tres estaciones son: **Comida rápida**, **Asados**, **Bebidas**.

---

## Modelo de despliegue: una plantilla, un cliente por instancia

Este código es una **plantilla reutilizable**. El primer cliente es Distrito Novo, pero el
mismo repositorio servirá para otros restaurantes, **cada uno con su propio proyecto de
Supabase**. No es SaaS multi-tenant (una base para todos): es un molde del que se sacan
copias.

Regla de oro: **el código es idéntico para todos los clientes. Lo único que cambia entre
uno y otro vive en configuración, nunca en el código.**

### Qué va en configuración (cambia por cliente)
- Nombre, WhatsApp, llave de pago, cuenta: en la tabla `restaurantes` (ya está así).
- URL y llaves de Supabase: en variables de entorno (`.env.local` / Vercel).
- Colores de marca, logo y tipografías: en un único módulo de tema
  `src/config/tema.ts`, que lee valores por `slug`. Nada de colores "quemados" en los
  componentes: los componentes leen del tema.
- La carta y las promociones: en la base de datos, cargadas por el `seed`.

### Qué NUNCA va escrito en el código
- La cadena "Distrito Novo" en ningún componente, título o metadato. Se lee del tema o de
  la tabla `restaurantes`.
- Ningún color hexadecimal de marca dentro de un componente. Van en `tema.ts` como tokens
  (`--marca-fondo`, `--marca-oro`, etc.) y los componentes usan el token.
- Ninguna llave, URL, número de cuenta o teléfono.

Prueba de fuego: para dar de alta un segundo restaurante debe bastar con (1) crear su
proyecto Supabase, (2) correr `schema.sql` y su propio `seed`, (3) crear un despliegue de
Vercel con sus variables, y (4) agregar su marca a `tema.ts`. **Sin tocar ningún
componente.** Si para el segundo cliente hay que editar un componente, algo se quemó en el
código que debía estar en configuración: corrígelo.

### Un repo, varios despliegues
El mismo repositorio de GitHub se conecta a un proyecto de Vercel por cliente, cada uno con
sus variables de entorno apuntando a su Supabase. Un bug se arregla una vez, se hace push, y
todos los despliegues se actualizan. Nunca se ramifica el código por cliente.


---

## Stack obligatorio

- **Next.js 15** (App Router) + **TypeScript** en modo estricto
- **Tailwind CSS** (sin librerías de componentes pesadas)
- **Supabase**: Postgres, Auth, Realtime, Storage
- **Vercel** para despliegue
- `@supabase/ssr` para el cliente de servidor y el de navegador
- Sin Redux, sin Zustand, sin React Query. Server Components para leer, Server Actions
  para escribir, y un hook fino de Realtime para las pantallas vivas.

**Nunca** expongas `SUPABASE_SERVICE_ROLE_KEY` al navegador. Solo en Server Actions o
Route Handlers.

---

## Reglas de negocio que NO se pueden romper

1. **Nada entra a cocina sin confirmación.**
   - Mesa → confirma el mesero.
   - Pago en línea → confirma el webhook de la pasarela.
   - Transferencia → confirma caja después de verificar el movimiento en el banco.
   - Contraentrega → confirma caja.

2. **Disparo escalonado.** Al confirmar, se calcula
   `objetivo = ahora + max(minutos de cada estación)` y cada comanda recibe
   `disparo_en = objetivo - minutos_de_esa_estación`.
   Una comanda **no aparece** en la pantalla de su cocina hasta que `disparo_en <= now()`.
   No hace falta ningún cron ni worker: es un filtro en la consulta.
   Esto ya está implementado en la función `confirmar_pedido()` del esquema.

3. **El cliente nunca envía precios.** El pedido se crea llamando a la función
   `crear_pedido(slug, payload)`, que recalcula subtotal, domicilio y total desde la tabla
   `productos`. El front solo manda `producto_id`, `cantidad` y `notas`.

4. **Transferencia con verificación humana.** El sistema le muestra al cliente la llave y
   un **valor exacto con un código de 3 cifras al final** (ej. `$37.139`). El pedido queda
   en `esperando_pago`. En Caja aparece una alerta que **no se quita sola**: solo la cierra
   alguien que verifique el movimiento real del banco y toque "Verifiqué el pago", o que la
   rechace. El pantallazo del cliente es una pista, no una prueba.

5. **Cada rol ve solo lo suyo.** La cocina no ve precios ni datos del cliente. El
   domiciliario solo ve los pedidos que le asignaron. El cajero no ve costos ni márgenes.
   Esto se aplica en RLS, no solo en la interfaz.

6. **Costo de domicilio por zona fija de barrio.** Nada de geocodificación para cobrar.
   El mapa solo sirve para que el domiciliario llegue.

7. **Promociones controladas por el administrador.** Lo primero que ve el comensal al
   abrir la carta. Tres tipos: `envio` (domicilio gratis desde X, y **afecta el cálculo
   real** del total), `combo` (agrega productos al carrito con un toque) y `aviso` (texto).

---

## Estados

**Pedido:** `esperando_pago → pendiente → en_cocina → listo → en_despacho → en_camino → entregado → cerrado`
(y `anulado` desde cualquiera, siempre con motivo y responsable).

**Comanda:** `pendiente → preparando → listo`. La visibilidad depende de `disparo_en`.

---

## Roles

| Rol | Dispositivo | Puede | No puede |
|---|---|---|---|
| comensal | su celular, sin cuenta | ver carta, pedir, pagar, seguir su pedido | ver otros pedidos |
| mesero | celular | confirmar y tomar pedidos, abrir/cerrar mesas | anular, ver finanzas |
| cocina | tablet por estación | ver su comanda, marcar preparando/listo, agotar productos | ver precios ni cliente |
| pase | tablet | ver el pedido completo, liberar, asignar domiciliario | cobrar, anular |
| cajero | computador | cobrar, verificar transferencias, confirmar contraentrega, anular con motivo, cerrar caja | ver costos ni P&G |
| domiciliario | celular | ver **sus** entregas con dirección, mapa, teléfono y monto a cobrar; marcar estados | ver otros pedidos |
| admin | cualquiera | todo, más costos, promociones, zonas, usuarios y reportes | — |

---

## Rutas

```
/[slug]                      carta pública (promociones arriba + menú por categorías)
/[slug]/mesa/[qr_token]      la misma carta, asociada a una mesa
/[slug]/pedido/[token]       seguimiento público del pedido
/app/login
/app                         redirige según el rol del usuario
/app/mesero
/app/cocina                  elige estación · /app/cocina/[estacion_slug]
/app/pase
/app/caja                    alertas de transferencia, cobros, cierre de turno
/app/domicilios              vista del domiciliario
/app/admin/carta             productos, categorías, disponibilidad
/app/admin/promociones
/app/admin/zonas
/app/admin/usuarios
/app/admin/reportes
```

---

## Fases de construcción

Trabaja **una fase a la vez**. Al terminar cada una, actualiza `docs/PROGRESO.md`,
haz commit, y **espera mi visto bueno** antes de seguir a la siguiente.

### Fase 1 — Base
- `create-next-app` con TypeScript, Tailwind, App Router, carpeta `src/`.
- Cliente Supabase (servidor y navegador) con `@supabase/ssr`.
- Ejecutar `supabase/schema.sql` y `supabase/seed-distrito-novo.sql`.
- Tipos generados: `npx supabase gen types typescript --linked > src/lib/database.types.ts`.
- `.env.example` con las tres variables.
- **Listo cuando:** `npm run dev` levanta y una página de prueba lista los 84 productos
  desde Supabase.

### Fase 2 — Carta pública y creación de pedidos
- `/[slug]` con la identidad de Distrito Novo: **negro y dorado**, títulos en serif
  (Cinzel), precios en plaquitas con borde dorado, categorías en chips horizontales.
- Banner de promociones activas arriba de todo, llamativo. El combo agrega al carrito.
- Carrito, checkout con selector de barrio y medio de pago.
- Llamada a `crear_pedido`. Pantalla de transferencia con llave y monto exacto.
- `/[slug]/pedido/[token]` con la línea de estados.
- **Listo cuando:** puedo pedir desde el celular y el registro queda correcto en la base,
  con el domicilio calculado por zona y la promoción de envío aplicada.

### Fase 3 — Cocinas y pase
- Login y guardas por rol.
- `/app/mesero` con confirmación.
- `/app/cocina/[estacion]`: fondo oscuro, tickets grandes, cronómetro por ticket con
  semáforo (verde, amarillo al 80 % del objetivo, rojo al pasarse), Realtime.
- `/app/pase`: pedido completo con las tres barras por estación, botón de liberar.
- **Listo cuando:** confirmo un pedido con productos de las tres estaciones y veo que los
  tickets aparecen escalonados, no todos al tiempo.

### Fase 4 — Caja y transferencias
- Alerta persistente de transferencias por verificar, con el monto exacto y el contador de
  espera. Solo se cierra con acción humana.
- Confirmación de contraentrega, cobro de mesas por medio de pago, anulación con motivo.
- Apertura y cierre de turno con arqueo: efectivo, transferencia, datáfono y pasarela por
  separado, base inicial, efectivo esperado y diferencia.
- **Listo cuando:** cierro un turno y los cuatro medios de pago cuadran con los pedidos.

### Fase 5 — Domiciliario
- `/app/domicilios`: lista de asignados y detalle con dirección grande, indicaciones,
  botón de llamar y de WhatsApp, qué lleva, y el recuadro de cobro —amarillo con el monto
  si es efectivo, verde con "no cobrar" si ya está pago.
- Estados: recogido → en camino → entregado / no fue posible entregar (con motivo).
- Liquidación del efectivo del turno por domiciliario, visible en Caja.
- **Listo cuando:** entrego un pedido en efectivo y el monto aparece en Caja por legalizar.

### Fase 6 — Administración y despliegue
- CRUD de carta, promociones, zonas y usuarios.
- Reportes: ventas por canal, por estación, por hora, ticket promedio, productos más
  vendidos, tiempos promedio por estación.
- PWA: manifest y `display: standalone` para las tablets de cocina.
- Despliegue en Vercel con las variables de entorno.
- **Listo cuando:** el sistema corre en una URL pública y puedo hacer un pedido real de
  punta a punta desde mi celular.

---

## Criterios de calidad

- Todo en **español**: interfaz, nombres de tablas y columnas, mensajes de error, commits.
- Formato de dinero colombiano: `$32.000`, sin decimales.
- Áreas táctiles mínimas de 44 px. Las pantallas de cocina y domiciliario se usan de pie,
  con las manos ocupadas: texto grande y botones grandes.
- Contraste mínimo 4.5:1. Nunca uses solo color para comunicar estado: acompáñalo de texto
  o ícono.
- Íconos SVG, nunca emojis.
- Nada de `localStorage` para datos del negocio. La verdad vive en Supabase.
- Los tiempos y estados se recalculan desde `disparo_en` y `objetivo_en` del servidor,
  nunca desde relojes del navegador.
- Maneja el caso sin conexión en cocina: muestra un aviso claro y reintenta; no pierdas el
  último estado conocido.

---

## Antes de empezar

1. Crea `CLAUDE.md` con el contenido que te doy aparte.
2. Crea `docs/PROGRESO.md` vacío con el encabezado de la Fase 1.
3. Confírmame el plan de la Fase 1 en tres líneas y arranca.
