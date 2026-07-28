# Cómo montar este sistema para otro restaurante

Este proyecto se construyó como **plantilla reutilizable**: una instancia por restaurante,
cada una con su propia base de datos y su propio despliegue. La lógica no cambia; cambian
la marca, los datos y las fotos.

Este documento es el punto de partida para montar un cliente nuevo.

---

## Lo que NO hay que tocar

Funciona igual para cualquier restaurante, sin abrir el código:

- **Los roles y sus pantallas**: dueño, cajero, mesero, cocina, pase, domiciliario.
- **El flujo del pedido**: carta → caja aprueba → cocina → pase → despacho → cobro.
- **El disparo escalonado**: cada cocina recibe su comanda calculando hacia atrás desde la
  hora de salida, para que todo salga junto.
- **La caja**: turnos, arqueo por medio de pago, "Cobrados hoy", facturas y cuentas de cobro.
- **Las promociones**: domicilio gratis por monto, combos con precio especial, avisos.
- **La seguridad (RLS)**: cada rol ve solo lo suyo; los precios los pone siempre el servidor.

---

## Lo que se configura SIN tocar código

Todo esto lo hace el dueño desde el panel, o se carga en su base:

| Qué | Dónde |
| --- | --- |
| Nombre, slug, WhatsApp, dirección, horario | Tabla `restaurantes` |
| Llave de pago y cuenta bancaria | Panel → Menú Digital → Página de inicio |
| Logo, foto de portada, foto del local, video | Panel → Menú Digital → Página de inicio |
| Todas las frases de la bienvenida | Panel → Menú Digital → Página de inicio |
| Cocinas (nombre, color, cuáles hay) | Panel → Menú Digital → Cocinas |
| Categorías, platos, precios, fotos | Panel → Menú Digital → Carta |
| Zonas de domicilio y sus valores | Panel → Zonas |
| Mesas y sus QR | Panel → Mesas · QR |
| Promociones | Panel → Promociones |
| Cuentas del equipo | Panel → Equipo |

---

## Lo que SÍ hay que cambiar en el código

Poco, pero existe. Es honesto decirlo antes de empezar:

### 1. `src/config/tema.ts` — la paleta
Es el único lugar donde vive la marca. Tiene dos temas (el panel claro y la carta oscura)
y un mapa por slug:

```ts
const TEMAS: Record<string, Tema> = { 'distrito-novo': TEMA_BASE }
```

Cambiar el slug y los colores. Si el cliente nuevo no es negro+dorado, aquí se define.

### 2. `src/components/logo-marca.tsx` — el logo de respaldo
Dibuja el logotipo de Distrito Novo (la D, la banda `-DISTRITO-`, el óvalo `Nv`) para
cuando todavía no han subido su logo. **Para otro cliente hay que reemplazar ese dibujo**
por algo neutro (las iniciales del restaurante) o por su arte.

Apenas suben su logo desde el panel, este respaldo deja de verse.

### 3. `public/icono.svg` — el ícono de la app
Mismo logotipo, en versión ícono. Se ve en la pestaña del navegador y al instalar la app.

### 4. Colores sueltos por mover a tokens
Quedaron unos **12 valores de color escritos a mano** fuera de `tema.ts`, casi todos el
dorado `#B8862B` o el naranja `#E0872B` de la landing:

```
src/app/[slug]/landing.tsx          src/app/app/admin/tablero/tablero-cliente.tsx
src/app/[slug]/manifest.webmanifest/route.ts   src/app/app/admin/reportes/reportes-cliente.tsx
src/app/manifest.ts                 src/app/app/admin/estaciones/estaciones-admin.tsx
src/app/layout.tsx                  src/app/app/caja/caja-cliente.tsx
src/app/app/login/login-form.tsx    src/components/logo-marca.tsx
```

No rompen nada, pero para un segundo cliente conviene moverlos a los tokens `--marca-*`
de una vez. Es trabajo de una sola pasada.

---

## Pasos para montar un cliente nuevo

1. **Repositorio**: copiar este proyecto a uno nuevo (no un fork: son negocios distintos).
2. **Supabase**: crear proyecto nuevo y correr, en orden:
   - `supabase/schema.sql` (todo el esquema, funciones y RLS)
   - `supabase/roles-dueno.sql` — **en dos pasos**, como dice el archivo
   - `supabase/actualizar-equipo.sql`
   - `supabase/actualizar-transferencia.sql`
   - `supabase/cocina-unica.sql`
   - `supabase/promos-aplicables.sql`
   - `supabase/landing-config.sql`
   - `supabase/cierre-caja-sin-pendientes.sql`

   > Estos archivos son el historial de cambios de Distrito Novo. **Vale la pena
   > consolidarlos en un `schema.sql` único y al día** antes de montar el segundo cliente:
   > se corre uno solo y no hay riesgo de saltarse alguno.

3. **Bucket de Storage**: crear `productos` como público, con las políticas de escritura
   para `admin`/`dueno` (están en `roles-dueno.sql`).
4. **Datos base**: insertar el restaurante, sus cocinas, categorías, productos, zonas y
   mesas. `supabase/seed-distrito-novo.sql` sirve de molde.
5. **Cuenta del dueño**: crearla y ponerle `rol = 'dueno'`.
6. **Vercel**: proyecto nuevo apuntando al repo, con las variables de entorno de la
   Supabase nueva.
7. **Marca**: ajustar `tema.ts`, el logo de respaldo y el ícono.
8. **Carga desde el panel**: logo, fotos, frases, carta, zonas y promociones.

---

## Cuentas de prueba (patrón que funcionó bien)

Una por puesto, sin duplicados:

```
admin@…      dueño (ve todo, incluida rentabilidad)
cajero@…     caja
mesero@…     pedidos de mesa
cocina@…     una sola cuenta para todas las cocinas
pase@…       pase y despacho
domi@…       domicilios
```

---

## Lecciones de Distrito Novo (para no repetir tropiezos)

- **Las políticas de Storage y las RLS deben incluir `dueno` desde el principio.** Si la
  cuenta es dueño y las políticas solo nombran `admin`, las escrituras fallan en silencio:
  el botón "no hace nada" y no sale ningún error.
- **Toda plata que entra tiene que crear un `caja_movimiento`.** Si no, el arqueo miente.
  Esto aplica a cobros, transferencias verificadas y legalizaciones de domiciliarios.
- **Los Server Actions de Next tienen 1 MB de límite por defecto.** Sin subirlo, las fotos
  y videos grandes se quedan "Subiendo…" para siempre. Está en `next.config.ts`.
- **Los precios los pone siempre el servidor.** El navegador solo manda qué producto y
  cuántos, nunca un valor.
