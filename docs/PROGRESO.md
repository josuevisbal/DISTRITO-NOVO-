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

_No iniciada._
