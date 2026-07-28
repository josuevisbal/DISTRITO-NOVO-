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

### 4. Colores sueltos: YA NO HAY
Toda la marca vive en `tema.ts`: los dos temas, el objeto `MARCA` (paleta de la
landing, manifiestos, acentos del panel) y los degradados (`DEGRADADO_DORADO`,
`DEGRADADO_LOGO`). El resto del código los importa de ahí o usa los tokens
`--marca-*` / `bg-panel-lateral`. Las únicas excepciones son el arte propio de
Distrito Novo (`src/app/icon.svg` y el dibujo vectorial de respaldo en
`logo-marca.tsx`), que de todas formas se reemplazan enteros (puntos 2 y 3), y los
valores de respaldo del velo del héroe en `globals.css`, que solo aplican si la
landing no colgó sus variables.

---

## Pasos para montar un cliente nuevo

1. **Repositorio**: copiar este proyecto a uno nuevo (no un fork: son negocios distintos).
2. **Supabase**: crear proyecto nuevo y correr **`supabase/schema.sql` completo, una sola
   vez**. Ese único archivo trae todo: esquema, funciones, RLS, el bucket `productos` con
   sus políticas y el realtime. Es idempotente (re-correrlo no rompe nada).

   > Los scripts viejos viven en `supabase/historial/` solo como referencia; ya no se
   > corren. `schema.sql` los consolidó todos.

3. **Datos base**: insertar el restaurante, sus cocinas, categorías, productos, zonas y
   mesas. `supabase/seed-distrito-novo.sql` sirve de molde.
4. **Cuenta del dueño**: crearla y ponerle `rol = 'dueno'` (la consulta exacta está al
   final de `schema.sql`).
5. **Vercel**: proyecto nuevo apuntando al repo, con las variables de entorno de la
   Supabase nueva.
6. **Marca**: ajustar `tema.ts`, el logo de respaldo y el ícono.
7. **Carga desde el panel**: logo, fotos, frases, carta, zonas y promociones.
8. **Antes de operar de verdad**: `supabase/limpieza.sql` deja pedidos y caja en ceros
   sin tocar la carta ni los usuarios.

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
