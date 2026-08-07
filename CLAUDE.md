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
   (transferencia, contraentrega y lo que ella misma toma).
2. El disparo escalonado vive en `confirmar_pedido()`. Una comanda no se ve hasta que
   `disparo_en <= now()`. Sin cron ni workers.
3. El cliente nunca envía precios. Todo pedido se crea con `crear_pedido(slug, payload)`,
   que recalcula desde `productos`. Lo que toma el equipo pasa por `crear_pedido_interno()`,
   que llama a la misma función; lo que se suma a una cuenta abierta, por
   `agregar_items_pedido()`.
4. La verificación de transferencias es humana y su alerta no se cierra sola.
5. Cada rol ve solo lo suyo, y se aplica en **RLS**, no solo en la interfaz.
6. El domicilio se cobra por zona fija de barrio. El mapa solo sirve para llegar.
7. La propina va aparte del total y no se calcula sola: la digita caja al cobrar y queda
   marcada en `caja_movimientos` para que el arqueo la separe de la venta.
8. `SUPABASE_SERVICE_ROLE_KEY` jamás llega al navegador.

## Roles

Cinco, ni uno más (tabla `usuarios`): `admin · cajero · mesero · cocina · domicilio`.
`admin` es el único rol de mando y ve todo, incluidos costos y rentabilidad.
El comensal no tiene cuenta: entra por `slug`, pide, y sigue su pedido con un `token`.

## Los dos flujos

**Salón.** El comensal pide por el QR de su mesa → le suena al mesero, que confirma y eso
dispara cocina → cuando salen todas las estaciones, le suena otra vez y va por el pedido.
El mesero también toma pedidos a mano (hay clientes sin datos) y le suma rondas a una
cuenta abierta sin cerrarla: lo nuevo entra al mismo pedido y cocina recibe comanda aparte.

**Domicilio.** Caja confirma el pedido, o lo toma ella misma cuando el cliente llama o
llega al mostrador → cocina → caja le asigna el domiciliario y el pedido sale a la calle.
Caja además imprime cuentas y facturas, cobra en el punto físico y registra la propina.

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
