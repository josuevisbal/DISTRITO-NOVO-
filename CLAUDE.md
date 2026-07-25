# Distrito Novo · Sistema de pedidos multicocina

Restaurante con tres puntos de cocina en un mismo local: **comida rápida, asados y bebidas**.
Un pedido entra por cualquier canal, se parte por estación y cada una recibe su comanda en el
minuto justo para que todo salga junto.

Construido por 1A GROUP. **Multi-tenant desde el día uno**: todo se resuelve por
`restaurante_id` y por `slug`. Nada específico de Distrito Novo va en el código.

## Stack

Next.js 15 (App Router) · TypeScript estricto · Tailwind · Supabase (Postgres, Auth,
Realtime, Storage) · Vercel.
Server Components para leer, Server Actions para escribir, hook fino de Realtime para las
pantallas vivas. Sin librerías de estado global.

## Reglas que no se rompen

1. Nada entra a cocina sin confirmación: mesero (mesa), webhook (pasarela), o caja
   (transferencia y contraentrega).
2. El disparo escalonado vive en `confirmar_pedido()`. Una comanda no se ve hasta que
   `disparo_en <= now()`. Sin cron ni workers.
3. El cliente nunca envía precios. Todo pedido se crea con `crear_pedido(slug, payload)`,
   que recalcula desde `productos`.
4. La verificación de transferencias es humana y su alerta no se cierra sola.
5. Cada rol ve solo lo suyo, y se aplica en **RLS**, no solo en la interfaz.
6. El domicilio se cobra por zona fija de barrio. El mapa solo sirve para llegar.
7. `SUPABASE_SERVICE_ROLE_KEY` jamás llega al navegador.

## Roles

`admin · cajero · mesero · cocina · pase · domiciliario` (tabla `usuarios`).
El comensal no tiene cuenta: entra por `slug`, pide, y sigue su pedido con un `token`.

## Convenciones

- Todo en español: interfaz, esquema, mensajes, commits.
- Dinero colombiano sin decimales: `$32.000`.
- Dos temas por tokens (`src/config/tema.ts`): la **carta del cliente** va negro `#0B0B0C`
  y dorado `#D8AC4E` (premium, `obtenerTemaCarta`); los **módulos internos** van blanco y
  dorado corporativo (`obtenerTema`). Los componentes solo usan `--marca-*`; nunca colores
  quemados. Títulos en Cinzel; el logotipo de la carta en Cinzel Decorative.
- Colores de estación: rápida `#E0872B`, asados `#C2452F`, bebidas `#2E9E8F`.
- Áreas táctiles ≥ 44 px. Íconos SVG, nunca emojis. Contraste ≥ 4.5:1.
- Nada de `localStorage` para datos del negocio.

## Estructura

```
src/app/[slug]/            carta pública, mesa por QR, seguimiento
src/app/app/               pantallas internas por rol
src/lib/supabase/          clientes de servidor y navegador
src/lib/database.types.ts  tipos generados
supabase/schema.sql        esquema, funciones y RLS
supabase/seed-*.sql        carga inicial de la carta
docs/PROGRESO.md           bitácora de avance
```

## Flujo de trabajo

Una fase a la vez. Al terminar: actualizar `docs/PROGRESO.md`, commit, y esperar visto
bueno antes de seguir.
