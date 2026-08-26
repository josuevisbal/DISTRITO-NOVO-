-- =====================================================================
-- ESQUEMA COMPLETO · sistema de pedidos multicocina (multi-tenant)
-- Postgres / Supabase
--
-- ESTE ES EL ÚNICO ARCHIVO QUE HAY QUE CORRER para montar un restaurante
-- nuevo. Se pega entero en el SQL Editor y se le da Run: una sola vez, de
-- arriba a abajo. No hace falta partirlo en pasos.
--
-- Es idempotente: volver a correrlo sobre una base ya montada no rompe
-- nada ni borra datos (crea lo que falte y reemplaza funciones y
-- políticas por su versión al día).
--
-- Después de este archivo:
--   1. `seed-<restaurante>.sql`  — los datos del cliente (carta, zonas, mesas)
--   2. `limpieza.sql`            — solo si quedaron datos de prueba por borrar
--
-- El historial de cómo se llegó hasta aquí vive en `historial/`. Esos
-- archivos ya NO se corren: todo su contenido está incorporado abajo.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- TIPOS ----------
-- Cinco roles, ni uno más: admin manda, y cajero/mesero/cocina/domicilio operan.
do $$ begin
  create type rol_usuario   as enum ('admin','cajero','mesero','cocina','domicilio');
  create type canal_pedido  as enum ('mesa','whatsapp','domicilio','recoger','mostrador');
  create type estado_pedido as enum ('esperando_pago','pendiente','en_cocina','listo','en_despacho','en_camino','entregado','cerrado','anulado');
  create type estado_comanda as enum ('pendiente','preparando','listo','cancelada');
  create type medio_pago    as enum ('efectivo','transferencia','datafono','pasarela','mesa');
  create type tipo_promo    as enum ('envio','combo','aviso','descuento');
  create type estado_pago   as enum ('pendiente','verificado','rechazado');
exception when duplicate_object then null; end $$;

-- Una cuenta se puede pagar entre varios medios: parte en efectivo, parte con
-- datáfono, parte transferida. El desglose real vive en `pagos` (una fila por medio);
-- 'mixto' es solo la etiqueta del pedido para que la factura lo diga.
-- Se puede agregar dentro de una transacción, pero no usarse hasta que confirme:
-- por eso solo aparece dentro de cuerpos plpgsql, que se resuelven al ejecutarse.
alter type medio_pago add value if not exists 'mixto';

-- ---------------------------------------------------------------------
-- Bases viejas: se consolidan los siete roles de antes en los cinco de hoy.
--   dueno        -> admin        (un solo rol de mando)
--   pase         -> mesero       (el pase desapareció: mesa la lleva el mesero,
--                                 domicilio lo lleva caja)
--   domiciliario -> domicilio    (el nombre del rol, como se dice en el negocio)
--
-- Postgres no borra valores de un enum, así que el tipo se reconstruye. Todo lo
-- que cuelga del tipo o del helper `mi_rol()` (políticas incluidas) se recrea
-- más abajo en este mismo archivo, así que tumbarlo aquí no deja nada suelto.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'rol_usuario' and e.enumlabel in ('dueno','pase','domiciliario')
  ) then return; end if;

  -- Políticas de storage: comparan contra el enum, así que dependen del tipo.
  execute 'drop policy if exists productos_admin_insert on storage.objects';
  execute 'drop policy if exists productos_admin_update on storage.objects';
  execute 'drop policy if exists productos_admin_delete on storage.objects';

  -- mi_rol() es SQL y devuelve el enum: de él cuelgan casi todas las políticas.
  execute 'drop function if exists mi_rol() cascade';
  execute 'drop function if exists crear_usuario(text, text, text, rol_usuario, uuid) cascade';
  execute 'drop trigger if exists tr_proteger_dueno on usuarios';
  execute 'drop function if exists _proteger_dueno() cascade';

  execute 'alter type rol_usuario rename to rol_usuario_anterior';
  execute $ct$create type rol_usuario as enum ('admin','cajero','mesero','cocina','domicilio')$ct$;
  execute $cv$
    alter table usuarios alter column rol type rol_usuario using (
      case rol::text
        when 'dueno' then 'admin'
        when 'pase' then 'mesero'
        when 'domiciliario' then 'domicilio'
        else rol::text
      end
    )::rol_usuario
  $cv$;
  execute 'drop type rol_usuario_anterior';
end $$;

-- =====================================================================
-- TABLAS
-- =====================================================================
create table if not exists restaurantes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text not null unique,
  logo_url text,
  portada_url text,         -- foto del héroe de la landing y de la carta
  whatsapp text,            -- el que ve el comensal
  llave_pago text,          -- llave Bre-B / Nequi
  cuenta_pago text,         -- cuenta bancaria mostrada al cliente
  base_caja bigint not null default 200000,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- --- Página de inicio editable desde el panel (Menú Digital › Página de inicio).
-- Sin valor, la landing usa sus textos por defecto: nada se rompe si están vacíos.
alter table restaurantes add column if not exists foto_local_url text;   -- foto del local ("Sobre nosotros")
alter table restaurantes add column if not exists direccion text;
alter table restaurantes add column if not exists horario text;
alter table restaurantes add column if not exists landing jsonb not null default '{}'::jsonb;
alter table restaurantes add column if not exists hero_video_url text;   -- si hay video, manda sobre portada_url
alter table restaurantes add column if not exists whatsapp_pedidos text; -- adonde llega el aviso de cada pedido

create table if not exists usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  nombre text not null,
  correo text,                          -- espejo de auth.users.email para el panel de Equipo
  rol rol_usuario not null,
  estacion_id uuid,                     -- histórico; ya no aplica (cocina es pantalla única)
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
create index if not exists ix_usuarios_rest on usuarios(restaurante_id);
alter table usuarios add column if not exists correo text;

create table if not exists estaciones (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  slug text not null,
  nombre text not null,
  color text not null default '#888888',
  orden int not null default 1,
  activa boolean not null default true,
  unique (restaurante_id, slug)
);

create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  slug text not null,
  nombre text not null,
  orden int not null default 1,
  activa boolean not null default true,
  unique (restaurante_id, slug)
);

create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  categoria_id uuid not null references categorias(id) on delete restrict,
  estacion_id uuid not null references estaciones(id) on delete restrict,
  nombre text not null,
  descripcion text,
  precio bigint not null check (precio >= 0),
  minutos_prep int not null default 10 check (minutos_prep between 1 and 120),
  foto_url text,
  disponible boolean not null default true,   -- lo apaga la cocina cuando se agota
  activo boolean not null default true,       -- lo apaga el admin
  destacado boolean not null default false,   -- sello "POPULAR" en la carta
  orden int not null default 1
);
create index if not exists ix_productos_rest on productos(restaurante_id, categoria_id);
alter table productos add column if not exists destacado boolean not null default false;

create table if not exists zonas_domicilio (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  nombre text not null,
  valor bigint not null check (valor >= 0),
  activa boolean not null default true
);

create table if not exists mesas (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  numero int not null,
  qr_token uuid not null default gen_random_uuid(),
  activa boolean not null default true,
  unique (restaurante_id, numero)
);

create table if not exists promociones (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  tipo tipo_promo not null,
  etiqueta text,                 -- "Solo por hoy"
  titulo text not null,          -- "Domicilio GRATIS"
  descripcion text,
  imagen_url text,
  activa boolean not null default false,
  monto_minimo bigint,           -- tipo 'envio': domicilio gratis desde este monto
  precio_combo bigint,           -- tipo 'combo'
  desde timestamptz,
  hasta timestamptz,
  orden int not null default 1,
  creado_en timestamptz not null default now()
);

create table if not exists promocion_items (
  promocion_id uuid not null references promociones(id) on delete cascade,
  producto_id uuid not null references productos(id) on delete cascade,
  cantidad int not null default 1,
  primary key (promocion_id, producto_id)
);

create sequence if not exists pedido_numero_seq start 1000;

create table if not exists pedidos (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  numero bigint not null default nextval('pedido_numero_seq'),
  token uuid not null default gen_random_uuid(),   -- para que el cliente siga su pedido sin login
  canal canal_pedido not null,
  mesa_id uuid references mesas(id),
  cliente_nombre text,
  cliente_tel text,
  direccion text,
  zona_id uuid references zonas_domicilio(id),
  indicaciones text,
  estado estado_pedido not null default 'pendiente',
  medio_pago medio_pago,
  subtotal bigint not null default 0,
  domicilio bigint not null default 0,
  total bigint not null default 0,
  codigo_pago int,          -- 3 cifras que hacen unico el valor a transferir (en desuso)
  monto_exacto bigint,      -- total ajustado con el codigo
  creado_en timestamptz not null default now(),
  confirmado_en timestamptz,
  objetivo_en timestamptz,  -- hora comprometida de salida
  confirmado_por uuid references usuarios(id),
  domiciliario_id uuid references usuarios(id),
  entregado_en timestamptz,
  motivo_anulacion text,
  nota_entrega text,        -- motivo cuando el domiciliario no pudo entregar
  anulado_por uuid references usuarios(id),
  en_edicion timestamptz    -- el cliente está modificando su pedido: caja lo ve congelado
);
create index if not exists ix_pedidos_rest_estado on pedidos(restaurante_id, estado);
create index if not exists ix_pedidos_token on pedidos(token);
alter table pedidos add column if not exists en_edicion timestamptz;

-- La propina la cobra caja al cerrar la cuenta: no entra en el total del pedido
-- (nadie la calcula sola) pero sí en el arqueo del turno.
alter table pedidos add column if not exists propina bigint not null default 0;
-- Cuando el mesero recoge lo listo y lo pone en la mesa. La cuenta sigue abierta
-- hasta que caja cobre; esto solo saca el pedido de "por recoger".
alter table pedidos add column if not exists servido_en timestamptz;
-- La mesa pidió otra ronda por el QR sobre una cuenta ya abierta y el mesero
-- todavía no la manda a cocina. Es lo que hace que la cuenta le vuelva a sonar.
alter table pedidos add column if not exists ronda_pendiente_en timestamptz;
-- El domiciliario avisó que el cliente ya no paga en efectivo sino por transferencia.
-- Caja lo ve como alerta y es quien cobra.
alter table pedidos add column if not exists pago_cambiado_en timestamptz;

create table if not exists pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  producto_id uuid not null references productos(id),
  estacion_id uuid not null references estaciones(id),
  nombre_snap text not null,        -- congelamos nombre y precio al momento del pedido
  precio_snap bigint not null,
  minutos_snap int not null,
  cantidad int not null check (cantidad > 0),
  notas text,
  promocion_id uuid references promociones(id) on delete set null  -- de qué combo salió el renglón
);
create index if not exists ix_items_pedido on pedido_items(pedido_id);
alter table pedido_items add column if not exists promocion_id uuid references promociones(id) on delete set null;
-- Ronda: cada vez que el mesero le suma productos a una cuenta abierta, lo nuevo
-- entra con una ronda más alta. Cocina ve una comanda por ronda y nunca vuelve a
-- ver lo que ya despachó.
alter table pedido_items add column if not exists ronda int not null default 1;

create table if not exists comandas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  estacion_id uuid not null references estaciones(id),
  minutos int not null,
  disparo_en timestamptz not null,   -- cuando aparece en la pantalla de esa cocina
  estado estado_comanda not null default 'pendiente',
  ronda int not null default 1,      -- 1 = el pedido original; 2, 3… lo que se sumó después
  iniciado_en timestamptz,
  listo_en timestamptz
);
create index if not exists ix_comandas_estacion on comandas(estacion_id, estado, disparo_en);
alter table comandas add column if not exists ronda int not null default 1;

-- Antes una estación tenía UNA comanda por pedido. Ahora tiene una por ronda: si el
-- mesero suma una cerveza a una mesa que ya comió, la barra recibe comanda nueva y
-- la de la primera ronda queda como estaba.
alter table comandas drop constraint if exists comandas_pedido_id_estacion_id_key;
create unique index if not exists ux_comandas_pedido_estacion_ronda
  on comandas(pedido_id, estacion_id, ronda);

create table if not exists pagos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  medio medio_pago not null,
  monto bigint not null,
  estado estado_pago not null default 'pendiente',
  referencia text,                -- id de la pasarela o nota de la transferencia
  comprobante_url text,           -- captura que manda el cliente
  verificado_por uuid references usuarios(id),
  verificado_en timestamptz,
  creado_en timestamptz not null default now()
);

create table if not exists caja_turnos (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  abierto_por uuid references usuarios(id),
  abierto_en timestamptz not null default now(),
  base_inicial bigint not null default 0,
  cerrado_por uuid references usuarios(id),
  cerrado_en timestamptz,
  efectivo_contado bigint,
  diferencia bigint,
  nota text
);

create table if not exists caja_movimientos (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references caja_turnos(id) on delete cascade,
  tipo text not null check (tipo in ('ingreso','egreso','legalizacion')),
  medio medio_pago,
  monto bigint not null,
  pedido_id uuid references pedidos(id),
  usuario_id uuid references usuarios(id),
  nota text,
  creado_en timestamptz not null default now()
);
-- Parte del ingreso que era propina: entra a la caja pero no es venta del restaurante.
alter table caja_movimientos add column if not exists propina bigint not null default 0;

-- Costos por plato: tabla APARTE para que la RLS los proteja de verdad.
-- 'productos' es de lectura pública; el costo solo lo ve administración.
create table if not exists producto_costos (
  producto_id uuid primary key references productos(id) on delete cascade,
  costo bigint not null default 0 check (costo >= 0),
  actualizado_en timestamptz not null default now()
);

-- =====================================================================
-- FUNCIONES DE APOYO
-- =====================================================================
create or replace function mi_restaurante() returns uuid
language sql stable security definer set search_path = public as $$
  select restaurante_id from usuarios where id = auth.uid() and activo
$$;

create or replace function mi_rol() returns rol_usuario
language sql stable security definer set search_path = public as $$
  select rol from usuarios where id = auth.uid() and activo
$$;

create or replace function mi_estacion() returns uuid
language sql stable security definer set search_path = public as $$
  select estacion_id from usuarios where id = auth.uid() and activo
$$;

-- =====================================================================
-- RENGLONES DE UN PEDIDO  (ayudante interno)
-- Mete los productos y los combos de un payload en un pedido, con la ronda
-- que se le diga. Lo usan las tres puertas de entrada —el comensal por el QR,
-- el equipo desde su pantalla, y la edición del propio cliente— para que el
-- precio se calcule SIEMPRE igual y en un solo sitio.
--
-- Los combos entran con su precio especial: se valida la promo (activa,
-- vigente, del restaurante, con precio_combo y sin productos agotados), sus
-- productos van a las estaciones normales y el precio_combo se prorratea entre
-- los renglones. El renglón más caro absorbe el redondeo para que la suma dé exacta.
-- =====================================================================
create or replace function _insertar_items_pedido(
  p_pedido uuid, p_rest uuid, p_payload jsonb, p_ronda int default 1
) returns void
language plpgsql security definer set search_path = public as $$
declare
  r_combo jsonb; v_promo record; v_cant_combo int; v_normal bigint;
  v_unit bigint; v_resto bigint; v_primera boolean; r_item record; v_n int;
begin
  -- items sueltos con precio del servidor
  insert into pedido_items (pedido_id, producto_id, estacion_id, nombre_snap, precio_snap,
                            minutos_snap, cantidad, notas, ronda)
  select p_pedido, pr.id, pr.estacion_id, pr.nombre, pr.precio, pr.minutos_prep,
         greatest((it->>'cantidad')::int, 1), nullif(it->>'notas',''), p_ronda
  from jsonb_array_elements(coalesce(p_payload->'items','[]'::jsonb)) it
  join productos pr on pr.id = (it->>'producto_id')::uuid
  where pr.restaurante_id = p_rest and pr.activo and pr.disponible;

  -- combos: precio especial del servidor, productos a sus estaciones normales
  for r_combo in select * from jsonb_array_elements(coalesce(p_payload->'combos','[]'::jsonb))
  loop
    select pm.id, pm.titulo, pm.precio_combo into v_promo
    from promociones pm
    where pm.id = (r_combo->>'promocion_id')::uuid
      and pm.restaurante_id = p_rest and pm.tipo = 'combo' and pm.activa
      and (pm.desde is null or pm.desde <= now())
      and (pm.hasta is null or pm.hasta >= now())
      and coalesce(pm.precio_combo, 0) > 0;
    if v_promo.id is null then raise exception 'El combo ya no está disponible'; end if;

    -- valor normal del combo y validación: TODOS sus productos activos y disponibles
    select coalesce(sum(pr.precio * pi.cantidad), 0), count(*) into v_normal, v_n
    from promocion_items pi
    join productos pr on pr.id = pi.producto_id
    where pi.promocion_id = v_promo.id
      and pr.restaurante_id = p_rest and pr.activo and pr.disponible;
    if v_n = 0 or v_normal <= 0
       or v_n <> (select count(*) from promocion_items where promocion_id = v_promo.id) then
      raise exception 'El combo "%" tiene productos agotados', v_promo.titulo;
    end if;

    v_cant_combo := greatest(coalesce((r_combo->>'cantidad')::int, 1), 1);

    -- una pasada por cada combo pedido: el redondeo cuadra exacto por combo
    for v_n in 1..v_cant_combo loop
      v_primera := true;
      for r_item in
        select pr.id, pr.estacion_id, pr.nombre, pr.precio, pr.minutos_prep, pi.cantidad
        from promocion_items pi
        join productos pr on pr.id = pi.producto_id
        where pi.promocion_id = v_promo.id
        order by (pr.precio * pi.cantidad) desc, pr.id
      loop
        v_unit := (v_promo.precio_combo * r_item.precio) / v_normal;
        v_resto := 0;
        if v_primera then
          v_resto := v_promo.precio_combo
                     - (v_unit * r_item.cantidad)
                     - (select coalesce(sum(((v_promo.precio_combo * pr2.precio) / v_normal) * pi2.cantidad), 0)
                        from promocion_items pi2
                        join productos pr2 on pr2.id = pi2.producto_id
                        where pi2.promocion_id = v_promo.id and pi2.producto_id <> r_item.id);
        end if;

        if v_resto <> 0 and r_item.cantidad > 1 then
          -- una unidad carga el ajuste, el resto va parejo
          insert into pedido_items (pedido_id, producto_id, estacion_id, nombre_snap, precio_snap, minutos_snap, cantidad, notas, promocion_id, ronda)
          values (p_pedido, r_item.id, r_item.estacion_id, r_item.nombre, v_unit + v_resto, r_item.minutos_prep, 1, v_promo.titulo, v_promo.id, p_ronda),
                 (p_pedido, r_item.id, r_item.estacion_id, r_item.nombre, v_unit, r_item.minutos_prep, r_item.cantidad - 1, v_promo.titulo, v_promo.id, p_ronda);
        else
          insert into pedido_items (pedido_id, producto_id, estacion_id, nombre_snap, precio_snap, minutos_snap, cantidad, notas, promocion_id, ronda)
          values (p_pedido, r_item.id, r_item.estacion_id, r_item.nombre, v_unit + v_resto, r_item.minutos_prep, r_item.cantidad, v_promo.titulo, v_promo.id, p_ronda);
        end if;
        v_primera := false;
      end loop;
    end loop;
  end loop;
end $$;

-- Totales del pedido, siempre desde los renglones que tiene guardados. El domicilio
-- se cobra por zona fija de barrio, gratis si hay promoción de envío vigente.
-- Devuelve el total, y deja al día el cobro pendiente si lo hay.
-- Reparte entre efectivo y transferencia lo que FALTA por pagar de un pedido.
-- `p_efectivo` es cuánto pone (o promete poner) el cliente en efectivo; el resto se
-- transfiere. No es un precio que mande el cliente: se recorta a lo que de verdad vale
-- la cuenta, y lo ya verificado no se toca. Deja UNA fila pendiente por medio y etiqueta
-- el pedido ('efectivo', 'transferencia' o 'mixto'). Devuelve lo que queda por transferir,
-- que es el valor exacto que el cliente tiene que mandar.
create or replace function _repartir_pago(p_pedido uuid, p_efectivo bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_total bigint; v_pagado bigint; v_resta bigint; v_efec bigint; v_transf bigint;
begin
  select total into v_total from pedidos where id = p_pedido;
  select coalesce(sum(monto), 0) into v_pagado
    from pagos where pedido_id = p_pedido and estado = 'verificado';

  v_resta := greatest(0, coalesce(v_total, 0) - v_pagado);
  -- Ya está todo pago: no hay nada que repartir ni etiqueta que cambiar.
  if v_resta = 0 then
    delete from pagos where pedido_id = p_pedido and estado = 'pendiente';
    return 0;
  end if;

  v_efec   := greatest(0, least(coalesce(p_efectivo, 0), v_resta));
  v_transf := v_resta - v_efec;

  delete from pagos where pedido_id = p_pedido and estado = 'pendiente';
  if v_efec > 0 then
    insert into pagos (pedido_id, medio, monto, estado)
    values (p_pedido, 'efectivo', v_efec, 'pendiente');
  end if;
  if v_transf > 0 then
    insert into pagos (pedido_id, medio, monto, estado)
    values (p_pedido, 'transferencia', v_transf, 'pendiente');
  end if;

  update pedidos
     set medio_pago = case
           when v_efec > 0 and v_transf > 0 then 'mixto'::medio_pago
           when v_transf > 0 then 'transferencia'::medio_pago
           else 'efectivo'::medio_pago
         end,
         -- Lo que el cliente transfiere exacto: SU parte, no el total de la cuenta.
         monto_exacto = case when v_transf > 0 then v_transf else v_total end
   where id = p_pedido;

  return v_transf;
end $$;

create or replace function _recalcular_totales(p_pedido uuid) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_rest uuid; v_canal canal_pedido; v_zona uuid;
  v_sub bigint; v_dom bigint := 0; v_umbral bigint; v_zona_valor bigint := 0; v_total bigint;
begin
  select restaurante_id, canal, zona_id into v_rest, v_canal, v_zona
    from pedidos where id = p_pedido;

  select coalesce(sum(precio_snap * cantidad), 0) into v_sub
    from pedido_items where pedido_id = p_pedido;

  if v_canal in ('domicilio','whatsapp') then
    select valor into v_zona_valor from zonas_domicilio
     where id = v_zona and restaurante_id = v_rest and activa;
    v_zona_valor := coalesce(v_zona_valor, 0);

    select monto_minimo into v_umbral from promociones
     where restaurante_id = v_rest and tipo = 'envio' and activa
       and (desde is null or desde <= now()) and (hasta is null or hasta >= now())
     order by orden limit 1;

    v_dom := case when v_umbral is not null and v_sub >= v_umbral then 0 else v_zona_valor end;
  end if;

  v_total := v_sub + v_dom;

  -- Sin código sumado: se transfiere exactamente el total (platos + domicilio).
  update pedidos set subtotal = v_sub, domicilio = v_dom, total = v_total,
         codigo_pago = null, monto_exacto = v_total
   where id = p_pedido;

  -- Un pago repartido no se puede estirar a lo bruto: se respeta lo que el cliente puso
  -- en efectivo y el resto vuelve a la transferencia. Lo demás sigue con su fila única.
  if (select count(*) from pagos where pedido_id = p_pedido and estado = 'pendiente') > 1 then
    perform _repartir_pago(p_pedido, (
      select coalesce(sum(monto), 0)::bigint from pagos
       where pedido_id = p_pedido and estado = 'pendiente' and medio = 'efectivo'));
  else
    update pagos set monto = v_total where pedido_id = p_pedido and estado = 'pendiente';
  end if;

  return v_total;
end $$;

-- =====================================================================
-- CREAR PEDIDO
-- El cliente NUNCA envía precios. El servidor los recalcula desde productos.
-- payload: { canal, mesa_id, cliente_nombre, cliente_tel, direccion,
--            zona_id, indicaciones, medio_pago,
--            items:  [{producto_id, cantidad, notas}],
--            combos: [{promocion_id, cantidad}] }
--
-- UNA MESA, UNA CUENTA. Si la mesa ya tiene cuenta abierta, lo que pidan por el QR
-- NO abre un pedido nuevo: entra a esa misma cuenta como una ronda más, con el mismo
-- número y el mismo total. La cuenta solo se cierra cuando caja cobra.
--
-- Esa ronda entra SIN comanda: aparece en la pantalla del mesero como algo por
-- confirmar y no llega a cocina hasta que él la aprueba. Es la regla de siempre —
-- nada entra a cocina sin que alguien del equipo dé el visto bueno—, y además evita
-- que un niño jugando con el QR llene la parrilla de pedidos.
-- =====================================================================
create or replace function crear_pedido(p_slug text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rest uuid; v_pedido uuid; v_canal canal_pedido; v_medio medio_pago;
  v_estado estado_pedido; v_num bigint; v_token uuid; v_mesa uuid; v_abierta uuid;
  v_ronda int; v_sub bigint; v_dom bigint; v_total bigint;
  v_efectivo bigint; v_transf bigint;
begin
  select id into v_rest from restaurantes where slug = p_slug and activo;
  if v_rest is null then raise exception 'Restaurante no encontrado'; end if;

  v_canal := (p_payload->>'canal')::canal_pedido;
  v_medio := nullif(p_payload->>'medio_pago','')::medio_pago;
  -- Pago repartido: cuánto piensa poner en efectivo al recibir. El resto lo transfiere.
  v_efectivo := greatest(0, coalesce(nullif(p_payload->>'efectivo','')::bigint, 0));
  if v_medio = 'mixto' and v_canal = 'mesa' then
    raise exception 'La cuenta de mesa la reparte caja al cobrar';
  end if;
  v_mesa  := nullif(p_payload->>'mesa_id','')::uuid;

  -- ¿La mesa ya tiene cuenta abierta?
  if v_canal = 'mesa' and v_mesa is not null then
    select id into v_abierta from pedidos
     where restaurante_id = v_rest and mesa_id = v_mesa
       and estado in ('pendiente','en_cocina','listo')
     order by creado_en limit 1;
  end if;

  -- ---- Sí: la ronda entra a la cuenta que ya está abierta ----
  if v_abierta is not null then
    select coalesce(max(ronda), 0) + 1 into v_ronda
      from pedido_items where pedido_id = v_abierta;

    perform _insertar_items_pedido(v_abierta, v_rest, p_payload, v_ronda);

    if not exists (select 1 from pedido_items where pedido_id = v_abierta and ronda = v_ronda) then
      raise exception 'El pedido no tiene productos disponibles';
    end if;

    v_total := _recalcular_totales(v_abierta);

    update pedidos set ronda_pendiente_en = now() where id = v_abierta;

    select numero, token, subtotal, domicilio into v_num, v_token, v_sub, v_dom
      from pedidos where id = v_abierta;

    return jsonb_build_object(
      'id', v_abierta, 'numero', v_num, 'token', v_token,
      'subtotal', v_sub, 'domicilio', v_dom, 'total', v_total,
      'codigo_pago', null, 'monto_exacto', v_total, 'estado', 'pendiente',
      'ronda', v_ronda, 'cuenta_abierta', true
    );
  end if;

  -- ---- No: pedido nuevo ----
  -- estado inicial segun como paga
  v_estado := case
    when v_canal = 'mesa' then 'pendiente'::estado_pedido            -- espera al mesero
    when v_medio = 'pasarela' then 'pendiente'::estado_pedido        -- lo confirma el webhook
    when v_medio = 'transferencia' then 'esperando_pago'::estado_pedido
    when v_medio = 'mixto' then 'esperando_pago'::estado_pedido      -- espera la parte transferida
    else 'pendiente'::estado_pedido                                  -- contraentrega: lo confirma caja
  end;

  insert into pedidos (restaurante_id, canal, mesa_id, cliente_nombre, cliente_tel,
                       direccion, zona_id, indicaciones, medio_pago, estado)
  values (v_rest, v_canal, v_mesa,
          nullif(p_payload->>'cliente_nombre',''),
          nullif(p_payload->>'cliente_tel',''),
          nullif(p_payload->>'direccion',''),
          nullif(p_payload->>'zona_id','')::uuid,
          nullif(p_payload->>'indicaciones',''),
          v_medio, v_estado)
  returning id, numero, token into v_pedido, v_num, v_token;

  perform _insertar_items_pedido(v_pedido, v_rest, p_payload, 1);

  if not exists (select 1 from pedido_items where pedido_id = v_pedido) then
    raise exception 'El pedido no tiene productos disponibles';
  end if;

  v_total := _recalcular_totales(v_pedido);
  select subtotal, domicilio into v_sub, v_dom from pedidos where id = v_pedido;

  if v_medio = 'mixto' then
    v_transf := _repartir_pago(v_pedido, v_efectivo);
    -- Si al final no quedó nada por transferir, no hay nada que verificar: sigue el
    -- camino de una contraentrega normal y lo confirma caja.
    if v_transf = 0 then
      v_estado := 'pendiente';
      update pedidos set estado = v_estado where id = v_pedido;
    end if;
  elsif v_medio is not null and v_medio <> 'mesa' then
    insert into pagos (pedido_id, medio, monto, estado)
    values (v_pedido, v_medio, v_total, 'pendiente');
  end if;

  return jsonb_build_object(
    'id', v_pedido, 'numero', v_num, 'token', v_token,
    'subtotal', v_sub, 'domicilio', v_dom, 'total', v_total,
    'codigo_pago', null, 'monto_exacto', v_total, 'estado', v_estado,
    'ronda', 1, 'cuenta_abierta', false
  );
end $$;

-- =====================================================================
-- EL CLIENTE EDITA SU MISMO PEDIDO
-- Solo mientras nadie le haya aprobado el pago (estado 'esperando_pago') y
-- solo con el token de SU pedido. Mientras edita, el pedido queda marcado
-- (`en_edicion`) para que caja lo vea congelado y no apruebe algo que está
-- cambiando. Los precios los sigue poniendo el servidor.
-- =====================================================================
create or replace function iniciar_edicion_pedido(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_estado estado_pedido; v_items jsonb;
begin
  select id, estado into v_id, v_estado from pedidos where token = p_token;
  if v_id is null then raise exception 'Pedido no encontrado'; end if;
  if v_estado <> 'esperando_pago' then
    raise exception 'Tu pedido ya fue aprobado y está en preparación: escríbenos por WhatsApp';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'producto_id', producto_id, 'cantidad', cantidad, 'notas', coalesce(notas,'')
         )), '[]'::jsonb)
    into v_items
  from pedido_items where pedido_id = v_id and promocion_id is null;

  update pedidos set en_edicion = now() where id = v_id;
  return v_items;
end $$;

create or replace function actualizar_pedido_cliente(p_token uuid, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_rest uuid; v_estado estado_pedido; v_num bigint;
        v_sub bigint; v_dom bigint; v_total bigint;
begin
  select id, restaurante_id, estado, numero into v_id, v_rest, v_estado, v_num
  from pedidos where token = p_token;
  if v_id is null then raise exception 'Pedido no encontrado'; end if;
  if v_estado <> 'esperando_pago' then
    raise exception 'Tu pedido ya fue aprobado y está en preparación: escríbenos por WhatsApp';
  end if;

  -- Fuera lo viejo: se rearma completo con lo que el cliente dejó en el carrito.
  delete from pedido_items where pedido_id = v_id;
  perform _insertar_items_pedido(v_id, v_rest, p_payload, 1);

  if not exists (select 1 from pedido_items where pedido_id = v_id) then
    raise exception 'El pedido no tiene productos disponibles';
  end if;

  v_total := _recalcular_totales(v_id);
  select subtotal, domicilio into v_sub, v_dom from pedidos where id = v_id;

  -- Con pago repartido, si al recortar el pedido ya no queda nada por transferir, no hay
  -- transferencia que verificar: el pedido pasa a ser una contraentrega normal y lo
  -- confirma caja. Si no, se quedaría esperando un pago que nadie va a aprobar.
  if not exists (
    select 1 from pagos
     where pedido_id = v_id and estado = 'pendiente' and medio = 'transferencia'
  ) then
    update pedidos set estado = 'pendiente' where id = v_id;
  end if;

  update pedidos set en_edicion = null where id = v_id;

  return jsonb_build_object('numero', v_num, 'subtotal', v_sub, 'domicilio', v_dom, 'total', v_total);
end $$;

create or replace function cancelar_edicion_pedido(p_token uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update pedidos set en_edicion = null where token = p_token and estado = 'esperando_pago';
end $$;

-- =====================================================================
-- CONFIRMAR PEDIDO
-- Todas las estaciones reciben su comanda AL MISMO TIEMPO, apenas se confirma.
-- Nadie espera turno: la barra sirve la bebida mientras el asador va con la carne.
--
-- Confirma TODAS las rondas que todavía no tienen comanda: la primera, y las que la
-- mesa fue pidiendo por el QR sin cerrar la cuenta. Por eso el mesero puede tocar
-- "confirmar" varias veces sobre la misma cuenta sin repetir nada de lo ya despachado.
--
-- `disparo_en` se queda en la tabla y vale la hora de confirmación: es cuando empieza
-- a correr el cronómetro de cada estación.
-- =====================================================================
create or replace function confirmar_pedido(p_pedido uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_max int; v_conf timestamptz := now(); v_rest uuid; v_nuevas int;
begin
  select restaurante_id into v_rest from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then
    raise exception 'No autorizado';
  end if;

  insert into comandas (pedido_id, estacion_id, minutos, disparo_en, estado, ronda)
  select p_pedido, pi.estacion_id, max(pi.minutos_snap), v_conf, 'pendiente', pi.ronda
  from pedido_items pi
  where pi.pedido_id = p_pedido
    and not exists (
      select 1 from comandas c where c.pedido_id = p_pedido and c.ronda = pi.ronda
    )
  group by pi.ronda, pi.estacion_id
  on conflict (pedido_id, estacion_id, ronda) do nothing;

  get diagnostics v_nuevas = row_count;
  if v_nuevas = 0 then raise exception 'No hay nada nuevo por confirmar en esta cuenta'; end if;

  select max(minutos_snap) into v_max from pedido_items where pedido_id = p_pedido;

  update pedidos
     set estado = 'en_cocina',
         confirmado_en = coalesce(confirmado_en, v_conf),
         objetivo_en = v_conf + make_interval(mins => coalesce(v_max, 0)),
         confirmado_por = auth.uid(),
         ronda_pendiente_en = null,
         servido_en = null
   where id = p_pedido;
end $$;

-- Comandas que quedaron con hora futura cuando el disparo era escalonado: se traen
-- a ahora para que aparezcan de una en su pantalla. Es idempotente y se agota solo
-- (ya no se crea ninguna con hora futura), así que correr el archivo otra vez no hace nada.
update comandas set disparo_en = now()
 where estado = 'pendiente' and disparo_en > now();

-- cuando la última comanda queda lista, el pedido pasa a 'listo' para el pase
create or replace function _comanda_listo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'listo' and (old.estado is distinct from 'listo') then
    new.listo_en := now();
    if not exists (
      select 1 from comandas
      where pedido_id = new.pedido_id and id <> new.id and estado <> 'listo'
    ) then
      update pedidos set estado = 'listo' where id = new.pedido_id and estado = 'en_cocina';
    end if;
  end if;
  if new.estado = 'preparando' and old.estado = 'pendiente' then
    new.iniciado_en := now();
  end if;
  return new;
end $$;

drop trigger if exists tr_comanda_listo on comandas;
create trigger tr_comanda_listo before update on comandas
for each row execute function _comanda_listo();

-- Sin turno de caja abierto no entra NINGÚN pedido, venga del canal que venga:
-- un pedido sin caja no tiene quién lo confirme ni dónde anotar la plata que trae.
-- Va como trigger sobre pedidos (y no dentro de crear_pedido) para cubrir cualquier
-- camino de inserción y sobrevivir a futuras versiones de la función.
create or replace function _pedido_exige_turno() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from caja_turnos where restaurante_id = new.restaurante_id and cerrado_en is null
  ) then
    raise exception 'Todavía no estamos recibiendo pedidos. ¡Vuelve a intentarlo en unos minutos!';
  end if;
  return new;
end $$;

drop trigger if exists tr_pedido_exige_turno on pedidos;
create trigger tr_pedido_exige_turno before insert on pedidos
for each row execute function _pedido_exige_turno();

-- =====================================================================
-- EL EQUIPO TOMA EL PEDIDO
-- No todo el mundo pide desde el QR: hay quien no tiene datos, quien llama por
-- teléfono y quien llega al mostrador y dicta. Mesero y caja escriben ese pedido
-- desde su pantalla y entra por el mismo camino que cualquier otro: los precios
-- los sigue poniendo `crear_pedido`, nunca el navegador.
--
-- `p_confirmar` decide si sale derecho a cocina. El mesero siempre confirma (ya
-- está frente al cliente); caja puede dejarlo pendiente cuando falta cobrar algo.
-- =====================================================================
create or replace function crear_pedido_interno(p_payload jsonb, p_confirmar boolean default true)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_slug text; v_res jsonb; v_id uuid;
begin
  if mi_rol() not in ('mesero','cajero','admin') then
    raise exception 'Solo mesero, caja o administración';
  end if;

  select slug into v_slug from restaurantes where id = mi_restaurante() and activo;
  if v_slug is null then raise exception 'Restaurante no encontrado'; end if;

  v_res := crear_pedido(v_slug, p_payload);
  v_id := (v_res->>'id')::uuid;

  if p_confirmar then
    perform confirmar_pedido(v_id);
    v_res := jsonb_set(v_res, '{estado}', '"en_cocina"'::jsonb);
  end if;

  return v_res;
end $$;

-- =====================================================================
-- SUMAR A UNA CUENTA ABIERTA
-- La mesa pide otra ronda sin cerrar la cuenta. Lo nuevo entra al MISMO pedido
-- (mismo número, misma cuenta) pero como una ronda aparte: cocina recibe una
-- comanda nueva y nunca vuelve a ver lo que ya despachó. El total del pedido se
-- recalcula desde los renglones.
-- =====================================================================
create or replace function agregar_items_pedido(p_pedido uuid, p_items jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rest uuid; v_estado estado_pedido; v_dom bigint; v_num bigint;
  v_ronda int; v_max int; v_sub bigint; v_total bigint; v_conf timestamptz := now();
begin
  if mi_rol() not in ('mesero','cajero','admin') then
    raise exception 'Solo mesero, caja o administración';
  end if;

  select restaurante_id, estado, domicilio, numero
    into v_rest, v_estado, v_dom, v_num
  from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;
  if v_estado not in ('pendiente','en_cocina','listo') then
    raise exception 'Esa cuenta ya no admite más productos';
  end if;

  select coalesce(max(ronda), 0) + 1 into v_ronda from pedido_items where pedido_id = p_pedido;

  insert into pedido_items (pedido_id, producto_id, estacion_id, nombre_snap, precio_snap,
                            minutos_snap, cantidad, notas, ronda)
  select p_pedido, pr.id, pr.estacion_id, pr.nombre, pr.precio, pr.minutos_prep,
         greatest((it->>'cantidad')::int, 1), nullif(it->>'notas',''), v_ronda
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) it
  join productos pr on pr.id = (it->>'producto_id')::uuid
  where pr.restaurante_id = v_rest and pr.activo and pr.disponible;

  if not found then raise exception 'Ninguno de esos productos está disponible'; end if;

  -- La ronda nueva entra completa y de una, igual que el pedido original.
  select max(m) into v_max from (
    select max(minutos_snap) m from pedido_items
    where pedido_id = p_pedido and ronda = v_ronda group by estacion_id
  ) s;

  insert into comandas (pedido_id, estacion_id, minutos, disparo_en, estado, ronda)
  select p_pedido, pi.estacion_id, max(pi.minutos_snap), v_conf, 'pendiente', v_ronda
  from pedido_items pi
  where pi.pedido_id = p_pedido and pi.ronda = v_ronda
  group by pi.estacion_id;

  select coalesce(sum(precio_snap * cantidad), 0) into v_sub
    from pedido_items where pedido_id = p_pedido;
  v_total := v_sub + coalesce(v_dom, 0);

  -- La cuenta vuelve a cocina: lo que ya se sirvió queda servido, pero el pedido
  -- no está listo hasta que salga también la ronda nueva.
  -- Lo que suma el equipo entra ya aprobado: nadie lo tiene que volver a confirmar.
  update pedidos
     set subtotal = v_sub, total = v_total, monto_exacto = v_total,
         estado = 'en_cocina', servido_en = null, ronda_pendiente_en = null,
         objetivo_en = greatest(coalesce(objetivo_en, v_conf),
                                v_conf + make_interval(mins => v_max))
   where id = p_pedido;

  update pagos set monto = v_total where pedido_id = p_pedido and estado = 'pendiente';

  return jsonb_build_object('numero', v_num, 'ronda', v_ronda,
                            'subtotal', v_sub, 'total', v_total);
end $$;

-- El mesero recogió el pedido listo y lo puso en la mesa. La cuenta sigue abierta:
-- esto solo lo saca de "por recoger" para que no lo llamen dos veces.
create or replace function marcar_servido(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_rest uuid; v_estado estado_pedido;
begin
  if mi_rol() not in ('mesero','cajero','admin') then
    raise exception 'Solo mesero, caja o administración';
  end if;

  select restaurante_id, estado into v_rest, v_estado from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;
  if v_estado <> 'listo' then raise exception 'Ese pedido todavía no está listo'; end if;

  update pedidos set servido_en = now() where id = p_pedido;
end $$;

-- Verificar una transferencia. Cubre los dos casos: la que el cliente mandó antes de
-- que se cocinara (aprobarla manda el pedido a cocina) y la que el domiciliario reportó
-- en la puerta cuando el cliente cambió de opinión (la comida ya se entregó, así que
-- aprobarla cierra la cuenta).
-- En ambos deja el ingreso en el turno abierto. Sin eso la plata de las transferencias
-- no entra al arqueo y la caja miente al cerrar.
create or replace function verificar_transferencia(p_pedido uuid, p_ok boolean, p_motivo text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_turno uuid; v_monto bigint; v_rest uuid; v_estado estado_pedido; v_pago uuid;
begin
  if mi_rol() not in ('cajero','admin') then raise exception 'Solo caja o administración'; end if;

  select restaurante_id, coalesce(monto_exacto, total), estado
    into v_rest, v_monto, v_estado from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;

  -- En un pago repartido lo transferido es SOLO una parte de la cuenta: el ingreso vale
  -- lo que dice su fila en `pagos`, no el total del pedido.
  select id, monto into v_pago, v_monto
    from pagos
   where pedido_id = p_pedido and medio = 'transferencia' and estado = 'pendiente'
   order by creado_en limit 1;
  if v_pago is null then
    select coalesce(monto_exacto, total) into v_monto from pedidos where id = p_pedido;
  end if;

  if p_ok then
    -- Aprobar mueve plata, y cada peso que entra debe quedar atado a un turno: sin
    -- turno abierto el ingreso no tenía dónde anotarse y quedaba un cobro invisible
    -- que ningún arqueo mostraría jamás. Rechazar sí se permite sin turno: no mueve plata.
    v_turno := turno_abierto();
    if v_turno is null then raise exception 'Abre un turno antes de verificar transferencias'; end if;

    if v_pago is not null then
      update pagos set estado='verificado', verificado_por=auth.uid(), verificado_en=now()
        where id = v_pago;
    else
      update pagos set estado='verificado', verificado_por=auth.uid(), verificado_en=now()
        where pedido_id = p_pedido and medio='transferencia';
    end if;

    insert into caja_movimientos (turno_id, tipo, medio, monto, pedido_id, usuario_id)
    values (v_turno, 'ingreso', 'transferencia', coalesce(v_monto,0), p_pedido, auth.uid());

    if v_estado = 'esperando_pago' then
      -- La transferencia que el cliente mandó ANTES de cocinar: aprobarla es darle
      -- salida al pedido.
      update pedidos set estado = 'pendiente' where id = p_pedido;
      perform confirmar_pedido(p_pedido);
    elsif not exists (select 1 from pagos where pedido_id = p_pedido and estado = 'pendiente') then
      -- La que el domiciliario reportó en la puerta: la comida ya se entregó y con esto
      -- la cuenta queda completa.
      update pedidos set estado = 'cerrado' where id = p_pedido and estado <> 'anulado';
    end if;
    -- Si todavía queda efectivo por entrar (pago repartido), el pedido sigue 'entregado'
    -- hasta que el domiciliario legalice su parte. La cuenta no está saldada.
  else
    if v_pago is not null then
      update pagos set estado='rechazado', verificado_por=auth.uid(), verificado_en=now()
        where id = v_pago;
    else
      update pagos set estado='rechazado', verificado_por=auth.uid(), verificado_en=now()
        where pedido_id = p_pedido and medio='transferencia';
    end if;

    if v_estado = 'entregado' then
      -- La comida ya se entregó: rechazar la transferencia no borra la venta, deja la
      -- cuenta en deuda para que caja la resuelva con el cliente.
      update pedidos set nota_entrega = coalesce(p_motivo, 'La transferencia no llegó')
       where id = p_pedido;
    else
      update pedidos set estado='anulado', motivo_anulacion = coalesce(p_motivo,'Transferencia no verificada'),
             anulado_por = auth.uid()
        where id = p_pedido;
    end if;
  end if;
end $$;

-- =====================================================================
-- CAJA · turnos, cobros y arqueo
-- La fuente de verdad del arqueo es caja_movimientos: cada peso que entra o sale deja un
-- movimiento atado al turno abierto, así los cuatro medios cuadran solos al cerrar.
-- =====================================================================

-- turno abierto del restaurante del usuario (o null)
create or replace function turno_abierto() returns uuid
language sql stable security definer set search_path = public as $$
  select t.id from caja_turnos t
  where t.restaurante_id = mi_restaurante() and t.cerrado_en is null
  order by t.abierto_en desc limit 1
$$;

-- abrir turno con base inicial; no deja dos abiertos a la vez
create or replace function abrir_turno(p_base bigint) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_turno uuid;
begin
  if mi_rol() not in ('cajero','admin') then raise exception 'Solo caja o administración'; end if;
  if turno_abierto() is not null then raise exception 'Ya hay un turno abierto'; end if;
  if p_base < 0 then raise exception 'La base no puede ser negativa'; end if;

  insert into caja_turnos (restaurante_id, abierto_por, base_inicial)
  values (mi_restaurante(), auth.uid(), p_base)
  returning id into v_turno;
  return v_turno;
end $$;

-- Registrar un cobro (mesa, mostrador, recoger) con su medio: deja el pago verificado,
-- el movimiento de caja y cierra el pedido.
--
-- La PROPINA va aparte del total: el cliente decide cuánto deja, caja lo digita y entra
-- a la caja sumado al cobro, pero queda marcado como propina para que el arqueo pueda
-- separarlo de la venta. Nadie la calcula sola: si el cliente no deja nada, va en cero.
-- La versión de tres argumentos (sin propina) se va: si quedaran las dos, una llamada
-- por nombre de parámetro no sabría a cuál ir y PostgREST devolvería "función ambigua".
drop function if exists registrar_cobro(uuid, medio_pago, bigint);
create or replace function registrar_cobro(
  p_pedido uuid, p_medio medio_pago, p_monto bigint default null, p_propina bigint default 0
) returns void
language plpgsql security definer set search_path = public as $$
declare v_turno uuid; v_rest uuid; v_total bigint; v_monto bigint; v_propina bigint;
begin
  if mi_rol() not in ('cajero','admin') then raise exception 'Solo caja o administración'; end if;
  v_turno := turno_abierto();
  if v_turno is null then raise exception 'Abre un turno antes de cobrar'; end if;
  if p_medio = 'mesa' then raise exception 'Escoge un medio de pago real'; end if;

  select restaurante_id, total into v_rest, v_total from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;

  v_propina := greatest(coalesce(p_propina, 0), 0);
  v_monto := coalesce(p_monto, v_total) + v_propina;

  insert into pagos (pedido_id, medio, monto, estado, verificado_por, verificado_en)
  values (p_pedido, p_medio, v_monto, 'verificado', auth.uid(), now());

  insert into caja_movimientos (turno_id, tipo, medio, monto, propina, pedido_id, usuario_id)
  values (v_turno, 'ingreso', p_medio, v_monto, v_propina, p_pedido, auth.uid());

  update pedidos set estado = 'cerrado', medio_pago = p_medio, propina = v_propina
   where id = p_pedido and estado <> 'anulado';
end $$;

-- =====================================================================
-- COBRO REPARTIDO ENTRE VARIOS MEDIOS
-- "Le pago $50.000 en efectivo y el resto con la tarjeta". Una cuenta, varios
-- medios: se manda una lista [{medio, monto}, …] y la base deja UNA fila en `pagos`
-- y UN movimiento de caja por cada medio, así el arqueo cuadra por medio sin que
-- nadie tenga que repartir nada a mano.
--
-- La suma tiene que dar EXACTO lo que vale la cuenta más la propina. Si no cuadra
-- la función lo dice con los dos números, para que caja corrija antes de cobrar y
-- no quede una diferencia que aparezca recién al cerrar el turno.
--
-- La propina se anota entera sobre el medio de mayor monto: el total de propinas
-- del turno queda exacto, que es lo que el arqueo necesita para separarla de la venta.
-- =====================================================================
create or replace function registrar_cobro_mixto(
  p_pedido uuid, p_pagos jsonb, p_propina bigint default 0
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_turno uuid; v_rest uuid; v_total bigint; v_propina bigint;
  v_suma bigint; v_n int; v_medio_unico medio_pago; r record;
begin
  if mi_rol() not in ('cajero','admin') then raise exception 'Solo caja o administración'; end if;
  v_turno := turno_abierto();
  if v_turno is null then raise exception 'Abre un turno antes de cobrar'; end if;

  select restaurante_id, total into v_rest, v_total from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;

  v_propina := greatest(coalesce(p_propina, 0), 0);

  select coalesce(sum(monto), 0), count(*), min(medio) filter (where true)
    into v_suma, v_n, v_medio_unico
  from (
    select (x->>'medio')::medio_pago as medio, (x->>'monto')::bigint as monto
    from jsonb_array_elements(coalesce(p_pagos, '[]'::jsonb)) x
    where nullif(x->>'medio','') is not null
      and coalesce((x->>'monto')::bigint, 0) > 0
  ) t;

  if v_n = 0 then raise exception 'Escoge al menos un medio de pago'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_pagos) x where (x->>'medio')::medio_pago = 'mesa'
  ) then raise exception 'Escoge medios de pago reales'; end if;

  if v_suma <> v_total + v_propina then
    raise exception 'Los pagos suman % y la cuenta con propina es %. Ajusta los montos.',
      v_suma, v_total + v_propina;
  end if;

  for r in
    select (x->>'medio')::medio_pago as medio, (x->>'monto')::bigint as monto
    from jsonb_array_elements(p_pagos) x
    where nullif(x->>'medio','') is not null
      and coalesce((x->>'monto')::bigint, 0) > 0
  loop
    insert into pagos (pedido_id, medio, monto, estado, verificado_por, verificado_en)
    values (p_pedido, r.medio, r.monto, 'verificado', auth.uid(), now());

    insert into caja_movimientos (turno_id, tipo, medio, monto, pedido_id, usuario_id)
    values (v_turno, 'ingreso', r.medio, r.monto, p_pedido, auth.uid());
  end loop;

  if v_propina > 0 then
    update caja_movimientos set propina = v_propina
     where id = (
       select id from caja_movimientos
        where turno_id = v_turno and pedido_id = p_pedido and tipo = 'ingreso'
        order by monto desc, id limit 1
     );
  end if;

  update pedidos
     set estado = 'cerrado', propina = v_propina,
         medio_pago = case when v_n = 1 then v_medio_unico else 'mixto'::medio_pago end
   where id = p_pedido and estado <> 'anulado';
end $$;

-- contraentrega: caja confirma un pedido en efectivo y entra a cocina.
-- El efectivo se cobra al entregar (se legaliza en la fase del domiciliario).
create or replace function confirmar_contraentrega(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_rest uuid; v_estado estado_pedido;
begin
  if mi_rol() not in ('cajero','admin') then raise exception 'Solo caja o administración'; end if;
  select restaurante_id, estado into v_rest, v_estado from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;
  if v_estado <> 'pendiente' then raise exception 'El pedido ya no está pendiente'; end if;

  perform confirmar_pedido(p_pedido);
end $$;

-- anular con motivo y responsable, desde cualquier estado menos cerrado
create or replace function anular_pedido(p_pedido uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare v_rest uuid; v_estado estado_pedido;
begin
  if mi_rol() not in ('cajero','admin') then raise exception 'Solo caja o administración'; end if;
  if coalesce(trim(p_motivo),'') = '' then raise exception 'La anulación necesita un motivo'; end if;

  select restaurante_id, estado into v_rest, v_estado from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;
  if v_estado = 'cerrado' then raise exception 'Un pedido cerrado no se anula'; end if;

  update pedidos set estado = 'anulado', motivo_anulacion = p_motivo, anulado_por = auth.uid()
   where id = p_pedido;
end $$;

-- Cerrar turno: calcula el efectivo esperado y la diferencia, y devuelve el arqueo
-- por medio de pago.
-- NADA puede quedar en el aire: no cierra si quedan pedidos del turno sin resolver
-- (en cocina, por despachar o por cobrar) ni si hay efectivo de domiciliarios sin
-- legalizar. Si no, la plata de hoy se cobraría mañana y el arqueo no cuadraría.
create or replace function cerrar_turno(p_efectivo_contado bigint, p_nota text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_turno uuid; v_base bigint; v_efectivo bigint; v_egreso bigint; v_propinas bigint;
  v_esperado bigint; v_dif bigint; v_arqueo jsonb;
  v_abiertos int; v_por_legalizar int; v_desde timestamptz;
begin
  if mi_rol() not in ('cajero','admin') then raise exception 'Solo caja o administración'; end if;
  v_turno := turno_abierto();
  if v_turno is null then raise exception 'No hay turno abierto'; end if;

  select base_inicial, abierto_en into v_base, v_desde from caja_turnos where id = v_turno;

  -- Nada puede quedar en el aire: pedidos en marcha o por cobrar del turno.
  select count(*) into v_abiertos
  from pedidos
  where restaurante_id = mi_restaurante()
    and creado_en >= v_desde
    and estado in ('esperando_pago','pendiente','en_cocina','listo','en_despacho','en_camino');

  if v_abiertos > 0 then
    raise exception 'Quedan % pedido(s) sin cerrar (en cocina, por despachar o por cobrar). Ciérralos o anúlalos antes de cerrar la caja.', v_abiertos;
  end if;

  -- Entregas ya hechas que todavía no tienen la plata en caja: el efectivo que trae
  -- el domiciliario y las transferencias que reportó en la puerta. Cerrar el turno con
  -- alguna de estas pendiente sería dar el día por cuadrado debiendo plata.
  select count(*) into v_por_legalizar
  from pedidos p
  where p.restaurante_id = mi_restaurante()
    and p.estado = 'entregado'
    and exists (select 1 from pagos g where g.pedido_id = p.id and g.estado = 'pendiente');

  if v_por_legalizar > 0 then
    raise exception 'Hay % entrega(s) sin cobrar. Recibe el efectivo y verifica las transferencias antes de cerrar la caja.', v_por_legalizar;
  end if;

  select coalesce(sum(monto) filter (where tipo in ('ingreso','legalizacion') and medio = 'efectivo'),0),
         coalesce(sum(monto) filter (where tipo = 'egreso'),0),
         coalesce(sum(propina) filter (where tipo in ('ingreso','legalizacion')),0)
    into v_efectivo, v_egreso, v_propinas
    from caja_movimientos where turno_id = v_turno;

  v_esperado := v_base + v_efectivo - v_egreso;
  v_dif := p_efectivo_contado - v_esperado;

  select coalesce(jsonb_object_agg(medio, total),'{}'::jsonb) into v_arqueo from (
    select medio::text as medio, sum(monto) as total
    from caja_movimientos
    where turno_id = v_turno and tipo in ('ingreso','legalizacion')
    group by medio
  ) s;

  update caja_turnos
     set cerrado_por = auth.uid(), cerrado_en = now(),
         efectivo_contado = p_efectivo_contado, diferencia = v_dif, nota = p_nota
   where id = v_turno;

  return jsonb_build_object(
    'base_inicial', v_base, 'efectivo_esperado', v_esperado,
    'efectivo_contado', p_efectivo_contado, 'diferencia', v_dif, 'por_medio', v_arqueo,
    'propinas', v_propinas
  );
end $$;

-- =====================================================================
-- DOMICILIARIO · asignación, entrega y legalización del efectivo
-- =====================================================================

-- Caja asigna el domiciliario. Sin pase de por medio: en cuanto cocina deja el pedido
-- 'listo', caja se lo entrega a alguien y el pedido pasa a 'en_despacho' en el mismo acto.
create or replace function asignar_domiciliario(p_pedido uuid, p_domi uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_rest uuid; v_estado estado_pedido; v_domi_rest uuid; v_domi_rol rol_usuario;
begin
  if mi_rol() not in ('cajero','admin') then raise exception 'Solo caja o administración'; end if;

  select restaurante_id, estado into v_rest, v_estado from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;
  if v_estado not in ('listo','en_despacho') then
    raise exception 'El pedido todavía no está listo para despacho';
  end if;

  select restaurante_id, rol into v_domi_rest, v_domi_rol from usuarios where id = p_domi and activo;
  if v_domi_rest is distinct from mi_restaurante() or v_domi_rol <> 'domicilio' then
    raise exception 'Domiciliario no válido';
  end if;

  update pedidos set domiciliario_id = p_domi, estado = 'en_despacho' where id = p_pedido;
end $$;

-- Caja se arrepiente: el domicilio vuelve a la fila de por despachar y queda libre para
-- otro. Solo mientras el domiciliario NO lo haya recogido. Si ya salió con la comida,
-- este no es el camino: él reporta "No pude entregar" y el pedido vuelve solo.
create or replace function quitar_domiciliario(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_rest uuid; v_estado estado_pedido;
begin
  if mi_rol() not in ('cajero','admin') then raise exception 'Solo caja o administración'; end if;

  select restaurante_id, estado into v_rest, v_estado from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;
  if v_estado = 'en_camino' then
    raise exception 'Ese pedido ya salió con el domiciliario. Si no pudo entregarlo, él lo reporta desde su celular.';
  end if;
  if v_estado <> 'en_despacho' then raise exception 'Ese pedido no tiene domiciliario asignado'; end if;

  update pedidos set domiciliario_id = null, estado = 'listo' where id = p_pedido;
end $$;

-- el domiciliario recoge: en_despacho -> en_camino (solo su pedido)
create or replace function recoger_pedido(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_domi uuid; v_estado estado_pedido;
begin
  if mi_rol() <> 'domicilio' then raise exception 'Solo el domiciliario'; end if;
  select domiciliario_id, estado into v_domi, v_estado from pedidos where id = p_pedido;
  if v_domi is distinct from auth.uid() then raise exception 'Ese pedido no es tuyo'; end if;
  if v_estado <> 'en_despacho' then raise exception 'El pedido no está por recoger'; end if;

  update pedidos set estado = 'en_camino' where id = p_pedido;
end $$;

-- El domiciliario entrega. Si ya venía pago, se cierra; si no, queda 'entregado' y es
-- caja quien recibe la plata: el efectivo al legalizar, la transferencia al verificarla.
create or replace function entregar_pedido(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_domi uuid; v_estado estado_pedido; v_medio medio_pago;
begin
  if mi_rol() <> 'domicilio' then raise exception 'Solo el domiciliario'; end if;
  select domiciliario_id, estado, medio_pago into v_domi, v_estado, v_medio
    from pedidos where id = p_pedido;
  if v_domi is distinct from auth.uid() then raise exception 'Ese pedido no es tuyo'; end if;
  if v_estado <> 'en_camino' then raise exception 'El pedido no está en camino'; end if;

  -- Solo se cierra lo que YA está pago (transferencia aprobada antes de salir, o
  -- pasarela). Todo lo demás queda 'entregado': el efectivo que trae el domiciliario
  -- y las transferencias que el cliente prometió pagar. Cerrarlo aquí sería dar por
  -- cobrada una plata que nadie ha recibido.
  update pedidos
     set estado = case
           when exists (select 1 from pagos where pedido_id = p_pedido and estado = 'verificado')
            and not exists (select 1 from pagos where pedido_id = p_pedido and estado = 'pendiente')
             then 'cerrado'::estado_pedido
           else 'entregado'::estado_pedido
         end,
         entregado_en = now()
   where id = p_pedido;
end $$;

-- El cliente dijo en la puerta que ya no paga en efectivo sino por transferencia.
-- El domiciliario lo marca desde su celular y deja de traer esa plata; caja recibe la
-- alerta y es quien verifica la transferencia y la mete al turno. Nunca cierra el
-- pedido: cerrarlo aquí sería dar por cobrado algo que todavía nadie recibió.
-- En la puerta el cliente cambia de idea sobre cómo paga: pone una parte en efectivo y
-- transfiere el resto (o transfiere todo). El domiciliario digita cuánto recibió en
-- efectivo: eso es lo único que va a traer al cierre, y lo demás queda esperando que
-- caja verifique la transferencia. El pedido NO se cierra aquí.
create or replace function repartir_pago_entrega(p_pedido uuid, p_efectivo bigint)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_domi uuid; v_estado estado_pedido; v_transf bigint; v_efec bigint;
begin
  if mi_rol() <> 'domicilio' then raise exception 'Solo el domiciliario'; end if;
  if coalesce(p_efectivo, 0) < 0 then raise exception 'El efectivo no puede ser negativo'; end if;

  select domiciliario_id, estado into v_domi, v_estado from pedidos where id = p_pedido;
  if v_domi is distinct from auth.uid() then raise exception 'Ese pedido no es tuyo'; end if;
  if v_estado not in ('en_despacho','en_camino','entregado') then
    raise exception 'Ese pedido no está en reparto';
  end if;
  if not exists (select 1 from pagos where pedido_id = p_pedido and estado = 'pendiente') then
    raise exception 'Ese pedido ya está pago';
  end if;

  v_transf := _repartir_pago(p_pedido, coalesce(p_efectivo, 0));
  select coalesce(sum(monto), 0) into v_efec
    from pagos where pedido_id = p_pedido and estado = 'pendiente' and medio = 'efectivo';

  -- Marca para caja: hay una transferencia por verificar que nadie esperaba.
  update pedidos set pago_cambiado_en = case when v_transf > 0 then now() else null end
   where id = p_pedido;

  return jsonb_build_object('efectivo', v_efec, 'transferencia', v_transf);
end $$;

-- El caso de siempre —el cliente ya no paga nada en efectivo— dicho con la misma función.
create or replace function cambiar_a_transferencia(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform repartir_pago_entrega(p_pedido, 0);
end $$;

-- no se pudo entregar: vuelve a despacho con el motivo, para que pase o caja decidan
create or replace function fallo_entrega(p_pedido uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare v_domi uuid; v_estado estado_pedido;
begin
  if mi_rol() <> 'domicilio' then raise exception 'Solo el domiciliario'; end if;
  if coalesce(trim(p_motivo),'') = '' then raise exception 'Escribe por qué no se pudo entregar'; end if;
  select domiciliario_id, estado into v_domi, v_estado from pedidos where id = p_pedido;
  if v_domi is distinct from auth.uid() then raise exception 'Ese pedido no es tuyo'; end if;
  if v_estado not in ('en_camino','en_despacho') then raise exception 'El pedido no está en reparto'; end if;

  update pedidos set estado = 'en_despacho', nota_entrega = p_motivo where id = p_pedido;
end $$;

-- caja legaliza (recibe) todo el efectivo entregado por un domiciliario en el turno abierto
create or replace function legalizar_domiciliario(p_domi uuid) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_turno uuid; v_total bigint := 0; r record;
begin
  if mi_rol() not in ('cajero','admin') then raise exception 'Solo caja o administración'; end if;
  v_turno := turno_abierto();
  if v_turno is null then raise exception 'Abre un turno antes de legalizar'; end if;

  -- Se recibe la PARTE EN EFECTIVO de cada entrega, no el total del pedido: con un pago
  -- repartido, lo demás lo transfiere el cliente y lo verifica caja aparte.
  for r in
    select g.id as pago_id, g.monto, p.id as pedido_id
      from pagos g
      join pedidos p on p.id = g.pedido_id
     where p.restaurante_id = mi_restaurante() and p.domiciliario_id = p_domi
       and p.estado = 'entregado'
       and g.estado = 'pendiente' and g.medio = 'efectivo'
  loop
    update pagos set estado = 'verificado', verificado_por = auth.uid(), verificado_en = now()
     where id = r.pago_id;

    insert into caja_movimientos (turno_id, tipo, medio, monto, pedido_id, usuario_id)
    values (v_turno, 'legalizacion', 'efectivo', r.monto, r.pedido_id, p_domi);

    -- Solo se cierra si con esto la cuenta quedó completa. Si falta una transferencia
    -- por verificar, el pedido sigue 'entregado' y caja lo ve pendiente.
    update pedidos set estado = 'cerrado'
     where id = r.pedido_id
       and not exists (select 1 from pagos where pedido_id = r.pedido_id and estado = 'pendiente');

    v_total := v_total + r.monto;
  end loop;

  return v_total;
end $$;

-- =====================================================================
-- REPORTES · métricas del restaurante (solo administración)
-- =====================================================================
create or replace function reporte_ventas(p_dias int default 30)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rest uuid; v_desde timestamptz; v_res jsonb;
  v_total bigint; v_n int; v_ticket bigint;
begin
  if mi_rol() <> 'admin' then raise exception 'Solo administración'; end if;
  v_rest := mi_restaurante();
  v_desde := now() - make_interval(days => greatest(p_dias, 1));

  select coalesce(sum(total),0), count(*) into v_total, v_n
    from pedidos where restaurante_id = v_rest and estado <> 'anulado' and creado_en >= v_desde;
  v_ticket := case when v_n > 0 then (v_total / v_n) else 0 end;

  select jsonb_build_object(
    'dias', greatest(p_dias,1),
    'total_ventas', v_total, 'num_pedidos', v_n, 'ticket_promedio', v_ticket,
    'por_canal', coalesce((select jsonb_agg(x order by x->>'canal') from (
        select jsonb_build_object('canal', canal, 'total', sum(total), 'n', count(*)) x
        from pedidos where restaurante_id = v_rest and estado <> 'anulado' and creado_en >= v_desde
        group by canal) s), '[]'::jsonb),
    'por_hora', coalesce((select jsonb_agg(x order by (x->>'hora')::int) from (
        select jsonb_build_object('hora', extract(hour from creado_en)::int, 'total', sum(total)) x
        from pedidos where restaurante_id = v_rest and estado <> 'anulado' and creado_en >= v_desde
        group by extract(hour from creado_en)) s), '[]'::jsonb),
    'top_productos', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('nombre', i.nombre_snap, 'cantidad', sum(i.cantidad)) x
        from pedido_items i join pedidos p on p.id = i.pedido_id
        where p.restaurante_id = v_rest and p.estado <> 'anulado' and p.creado_en >= v_desde
        group by i.nombre_snap order by sum(i.cantidad) desc limit 10) s), '[]'::jsonb),
    'tiempos_estacion', coalesce((select jsonb_agg(x order by x->>'estacion') from (
        select jsonb_build_object('estacion', e.nombre,
                 'minutos', round(avg(extract(epoch from (c.listo_en - c.iniciado_en))/60)::numeric, 1)) x
        from comandas c join estaciones e on e.id = c.estacion_id join pedidos p on p.id = c.pedido_id
        where p.restaurante_id = v_rest and c.listo_en is not null and c.iniciado_en is not null
          and p.creado_en >= v_desde group by e.nombre) s), '[]'::jsonb)
  ) into v_res;
  return v_res;
end $$;

-- Propinas día por día del rango. Van APARTE del reporte de ventas porque la propina no
-- es venta del restaurante (regla: se digita al cobrar y el arqueo la separa). Se agrupan
-- por el día del COBRO —cuando la plata entró a la caja y quedó marcada en
-- `caja_movimientos`—, no por el día en que se tomó el pedido: un domicilio entregado hoy
-- y cobrado mañana deja su propina en el día en que se recibió.
create or replace function propinas_por_dia(p_desde timestamptz, p_hasta timestamptz, p_zona text default 'America/Bogota')
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_rest uuid; v_res jsonb;
begin
  if mi_rol() <> 'admin' then raise exception 'Solo administración'; end if;
  v_rest := mi_restaurante();

  select coalesce(jsonb_agg(x order by x->>'dia'), '[]'::jsonb) into v_res from (
    select jsonb_build_object(
      'dia',      to_char((m.creado_en at time zone p_zona)::date, 'YYYY-MM-DD'),
      'propina',  coalesce(sum(m.propina), 0),
      'cuentas',  count(*) filter (where m.propina > 0),
      'cobrado',  coalesce(sum(m.monto - m.propina), 0)
    ) x
    from caja_movimientos m
    join caja_turnos t on t.id = m.turno_id
    where t.restaurante_id = v_rest
      and m.tipo in ('ingreso','legalizacion')
      and m.creado_en >= p_desde and m.creado_en < p_hasta
    group by (m.creado_en at time zone p_zona)::date
  ) s;

  return v_res;
end $$;

-- Reporte por rango [desde, hasta): métricas del mes. El rango y la zona llegan del
-- servidor (configuración por instancia); nada de zonas quemadas.
create or replace function reporte_rango(p_desde timestamptz, p_hasta timestamptz, p_zona text default 'America/Bogota')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rest uuid; v_res jsonb; v_total bigint; v_n int;
begin
  if mi_rol() <> 'admin' then raise exception 'Solo administración'; end if;
  v_rest := mi_restaurante();

  select coalesce(sum(total),0), count(*) into v_total, v_n
    from pedidos
    where restaurante_id = v_rest and estado <> 'anulado'
      and creado_en >= p_desde and creado_en < p_hasta;

  select jsonb_build_object(
    'total_ventas', v_total,
    'num_pedidos', v_n,
    'ticket_promedio', case when v_n > 0 then v_total / v_n else 0 end,
    'por_dia', coalesce((select jsonb_agg(x order by (x->>'dia')::int) from (
        select jsonb_build_object('dia', extract(day from creado_en at time zone p_zona)::int,
                                  'total', sum(total)) x
        from pedidos
        where restaurante_id = v_rest and estado <> 'anulado'
          and creado_en >= p_desde and creado_en < p_hasta
        group by extract(day from creado_en at time zone p_zona)) s), '[]'::jsonb),
    'por_estacion', coalesce((select jsonb_agg(x order by x->>'orden') from (
        select jsonb_build_object('nombre', e.nombre, 'color', e.color, 'orden', e.orden,
                                  'total', coalesce(sum(i.precio_snap * i.cantidad),0)) x
        from estaciones e
        left join pedido_items i on i.estacion_id = e.id
          and exists (select 1 from pedidos p where p.id = i.pedido_id
                        and p.restaurante_id = v_rest and p.estado <> 'anulado'
                        and p.creado_en >= p_desde and p.creado_en < p_hasta)
        where e.restaurante_id = v_rest and e.activa
        group by e.nombre, e.color, e.orden) s), '[]'::jsonb),
    'top_productos', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('nombre', i.nombre_snap, 'cantidad', sum(i.cantidad),
                                  'ventas', sum(i.precio_snap * i.cantidad)) x
        from pedido_items i join pedidos p on p.id = i.pedido_id
        where p.restaurante_id = v_rest and p.estado <> 'anulado'
          and p.creado_en >= p_desde and p.creado_en < p_hasta
        group by i.nombre_snap
        order by sum(i.cantidad) desc limit 8) s), '[]'::jsonb)
  ) into v_res;

  return v_res;
end $$;

-- Consulta pública del estado de UN pedido: número + teléfono (los dos los sabe solo el
-- cliente). Devuelve SOLO el estado; una fila por consulta, por índice.
create or replace function estado_pedido_publico(p_slug text, p_numero bigint, p_tel text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  select jsonb_build_object('numero', p.numero, 'estado', p.estado, 'creado_en', p.creado_en)
    into v
  from pedidos p
  join restaurantes r on r.id = p.restaurante_id
  where r.slug = p_slug
    and p.numero = p_numero
    and regexp_replace(coalesce(p.cliente_tel,''), '\D', '', 'g')
        = regexp_replace(coalesce(p_tel,''), '\D', '', 'g')
    and regexp_replace(coalesce(p_tel,''), '\D', '', 'g') <> '';
  return v;
end $$;

-- =====================================================================
-- EQUIPO · crear y eliminar usuarios sin llave de servicio
-- =====================================================================
-- Crear un usuario del equipo: cuenta de acceso + fila en usuarios, en una sola operación.
-- Solo administración crea cuentas, de cualquiera de los cinco roles.
-- OJO: las columnas de token de auth.users van en '' (no NULL) o el login falla.
-- gen_salt/crypt viven en el esquema `extensions`: hay que calificarlas.
create or replace function crear_usuario(
  p_nombre text, p_correo text, p_clave text, p_rol rol_usuario, p_estacion uuid default null
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid; v_rest uuid; v_correo text;
begin
  if mi_rol() <> 'admin' then raise exception 'Solo administración'; end if;
  v_rest := mi_restaurante();
  v_correo := lower(trim(p_correo));
  if coalesce(trim(p_nombre),'') = '' then raise exception 'El nombre es obligatorio'; end if;
  if v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'El correo no es válido'; end if;
  if length(coalesce(p_clave,'')) < 8 then raise exception 'La contraseña necesita al menos 8 caracteres'; end if;
  if exists (select 1 from auth.users where email = v_correo) then
    raise exception 'Ya existe un usuario con ese correo';
  end if;
  if p_rol = 'cocina' and p_estacion is not null and not exists (
    select 1 from estaciones e where e.id = p_estacion and e.restaurante_id = v_rest
  ) then raise exception 'Estación no válida'; end if;

  v_uid := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    v_correo, extensions.crypt(p_clave, extensions.gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_uid, v_correo,
    jsonb_build_object('sub', v_uid::text, 'email', v_correo, 'email_verified', true),
    'email', now(), now(), now()
  );

  insert into usuarios (id, restaurante_id, nombre, rol, estacion_id, correo)
  values (v_uid, v_rest, trim(p_nombre), p_rol,
          case when p_rol = 'cocina' then p_estacion else null end, v_correo);

  return v_uid;
end $$;

-- Eliminar un usuario del equipo (borra el acceso; usuarios cae en cascada).
-- Nadie se elimina a sí mismo, y el restaurante nunca se queda sin administrador:
-- si el último admin se borrara, no quedaría quién crea cuentas ni quién entra al panel.
create or replace function eliminar_usuario(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_rol rol_usuario; v_rest uuid; v_admins int;
begin
  if mi_rol() <> 'admin' then raise exception 'Solo administración'; end if;
  if p_id = auth.uid() then raise exception 'No puedes eliminarte a ti mismo'; end if;

  select rol, restaurante_id into v_rol, v_rest from usuarios where id = p_id;
  if v_rol is null or v_rest <> mi_restaurante() then raise exception 'Usuario no encontrado'; end if;

  if v_rol = 'admin' then
    select count(*) into v_admins
      from usuarios where restaurante_id = v_rest and rol = 'admin' and activo;
    if v_admins <= 1 then
      raise exception 'Es el único administrador: nombra otro antes de eliminarlo';
    end if;
  end if;

  delete from auth.users where id = p_id;
end $$;

-- =====================================================================
-- ADMINISTRACIÓN · costos por plato y rentabilidad
-- El costo de cada plato es el dato más sensible del negocio: vive en tabla aparte
-- (`producto_costos`) porque `productos` es de lectura pública.
-- =====================================================================

create or replace function actualizar_costo(p_producto uuid, p_costo bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if mi_rol() <> 'admin' then raise exception 'Solo administración'; end if;
  if p_costo < 0 then raise exception 'El costo no puede ser negativo'; end if;
  if not exists (select 1 from productos where id = p_producto and restaurante_id = mi_restaurante()) then
    raise exception 'Producto no encontrado';
  end if;

  insert into producto_costos (producto_id, costo, actualizado_en)
  values (p_producto, p_costo, now())
  on conflict (producto_id) do update set costo = excluded.costo, actualizado_en = now();
end $$;

create or replace function reporte_rentabilidad(p_dias int default 30)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_rest uuid; v_desde timestamptz; v_res jsonb;
begin
  if mi_rol() <> 'admin' then raise exception 'Solo administración'; end if;
  v_rest := mi_restaurante();
  v_desde := now() - make_interval(days => greatest(p_dias, 1));

  select jsonb_build_object(
    'dias', greatest(p_dias,1),
    'ventas', coalesce(sum(i.precio_snap * i.cantidad),0),
    'costo', coalesce(sum(coalesce(c.costo,0) * i.cantidad),0),
    'utilidad', coalesce(sum((i.precio_snap - coalesce(c.costo,0)) * i.cantidad),0),
    'sin_costo', count(distinct i.producto_id) filter (where c.costo is null or c.costo = 0),
    'por_producto', coalesce((
      select jsonb_agg(x) from (
        select jsonb_build_object(
          'producto_id', i2.producto_id, 'nombre', i2.nombre_snap,
          'unidades', sum(i2.cantidad),
          'ventas', sum(i2.precio_snap * i2.cantidad),
          'costo_unitario', coalesce(max(c2.costo),0),
          'utilidad', sum((i2.precio_snap - coalesce(c2.costo,0)) * i2.cantidad)
        ) x
        from pedido_items i2
        join pedidos p2 on p2.id = i2.pedido_id
        left join producto_costos c2 on c2.producto_id = i2.producto_id
        where p2.restaurante_id = v_rest and p2.estado <> 'anulado' and p2.creado_en >= v_desde
        group by i2.producto_id, i2.nombre_snap
        order by sum((i2.precio_snap - coalesce(c2.costo,0)) * i2.cantidad) desc
      ) s), '[]'::jsonb)
  ) into v_res
  from pedido_items i
  join pedidos p on p.id = i.pedido_id
  left join producto_costos c on c.producto_id = i.producto_id
  where p.restaurante_id = v_rest and p.estado <> 'anulado' and p.creado_en >= v_desde;

  return v_res;
end $$;

-- =====================================================================
-- RLS
-- =====================================================================
alter table restaurantes     enable row level security;
alter table usuarios         enable row level security;
alter table estaciones       enable row level security;
alter table categorias       enable row level security;
alter table productos        enable row level security;
alter table zonas_domicilio  enable row level security;
alter table mesas            enable row level security;
alter table promociones      enable row level security;
alter table promocion_items  enable row level security;
alter table pedidos          enable row level security;
alter table pedido_items     enable row level security;
alter table comandas         enable row level security;
alter table pagos            enable row level security;
alter table caja_turnos      enable row level security;
alter table caja_movimientos enable row level security;
alter table producto_costos  enable row level security;

-- --- lectura pública de la carta (el comensal no tiene cuenta) ---
drop policy if exists pub_rest    on restaurantes;
drop policy if exists pub_est     on estaciones;
drop policy if exists pub_cat     on categorias;
drop policy if exists pub_prod    on productos;
drop policy if exists pub_zona    on zonas_domicilio;
drop policy if exists pub_promo   on promociones;
drop policy if exists pub_promoit on promocion_items;
drop policy if exists pub_mesa    on mesas;

create policy pub_rest    on restaurantes    for select using (activo);
create policy pub_est     on estaciones      for select using (activa);
create policy pub_cat     on categorias      for select using (activa);
create policy pub_prod    on productos       for select using (activo);
create policy pub_zona    on zonas_domicilio for select using (activa);
create policy pub_promo   on promociones     for select using (activa);
create policy pub_promoit on promocion_items for select using (true);
create policy pub_mesa    on mesas           for select using (activa);

-- --- el comensal ve SOLO su pedido, y solo con el token ---
-- El token viaja en la cabecera, nunca en la consulta, así que no se puede pescar otro.
drop policy if exists pub_ped_token on pedidos;
create policy pub_ped_token on pedidos for select
  using (token::text = current_setting('request.headers', true)::json->>'x-pedido-token');

drop policy if exists pub_items_token on pedido_items;
create policy pub_items_token on pedido_items for select
  using (exists (
    select 1 from pedidos p
    where p.id = pedido_id
      and p.token::text = current_setting('request.headers', true)::json->>'x-pedido-token'
  ));

-- --- staff: todo dentro de su restaurante ---
-- Todas estas políticas van 'to authenticated' a propósito. Las políticas permisivas se
-- suman con OR y Postgres las evalúa TODAS, así que si una quedara abierta a 'public' un
-- comensal anónimo leyendo la carta ejecutaría mi_restaurante() —que tiene revocado el
-- EXECUTE para anon— y la consulta fallaría con "permission denied for function".
drop policy if exists staff_rest on restaurantes;
create policy staff_rest on restaurantes for all to authenticated
  using (id = mi_restaurante()) with check (id = mi_restaurante());

drop policy if exists staff_usuarios on usuarios;
create policy staff_usuarios on usuarios for select to authenticated
  using (restaurante_id = mi_restaurante());

drop policy if exists admin_usuarios on usuarios;
create policy admin_usuarios on usuarios for all to authenticated
  using (restaurante_id = mi_restaurante() and mi_rol() = 'admin')
  with check (restaurante_id = mi_restaurante() and mi_rol() = 'admin');

drop policy if exists staff_ped on pedidos;
create policy staff_ped on pedidos for select to authenticated
  using (restaurante_id = mi_restaurante());

drop policy if exists staff_ped_upd on pedidos;
create policy staff_ped_upd on pedidos for update to authenticated
  using (restaurante_id = mi_restaurante() and mi_rol() in ('admin','cajero','mesero'));

drop policy if exists staff_items on pedido_items;
create policy staff_items on pedido_items for select to authenticated
  using (exists (select 1 from pedidos p where p.id = pedido_id and p.restaurante_id = mi_restaurante()));

-- cocina: pantalla única. Ve y opera comandas de CUALQUIER estación de SU
-- restaurante (ya disparadas). La estación que ve la elige el filtro de la
-- interfaz, no el usuario; sigue sin ver precios ni datos del cliente.
drop policy if exists cocina_comandas on comandas;
create policy cocina_comandas on comandas for select to authenticated using (
  exists (select 1 from pedidos p where p.id = pedido_id and p.restaurante_id = mi_restaurante())
  and (mi_rol() <> 'cocina' or disparo_en <= now())
);

drop policy if exists cocina_comandas_upd on comandas;
create policy cocina_comandas_upd on comandas for update to authenticated using (
  exists (select 1 from pedidos p where p.id = pedido_id and p.restaurante_id = mi_restaurante())
  and mi_rol() in ('admin','cocina')
);

-- domiciliario: SOLO los pedidos que le asignaron
drop policy if exists domi_ped on pedidos;
create policy domi_ped on pedidos for select to authenticated
  using (mi_rol() = 'domicilio' and domiciliario_id = auth.uid());

drop policy if exists domi_ped_upd on pedidos;
create policy domi_ped_upd on pedidos for update to authenticated
  using (mi_rol() = 'domicilio' and domiciliario_id = auth.uid());

-- caja
drop policy if exists caja_pagos on pagos;
create policy caja_pagos on pagos for all to authenticated
  using (exists (select 1 from pedidos p where p.id = pedido_id and p.restaurante_id = mi_restaurante())
         and mi_rol() in ('admin','cajero'));

drop policy if exists caja_turnos_p on caja_turnos;
create policy caja_turnos_p on caja_turnos for all to authenticated
  using (restaurante_id = mi_restaurante() and mi_rol() in ('admin','cajero'))
  with check (restaurante_id = mi_restaurante() and mi_rol() in ('admin','cajero'));

drop policy if exists caja_mov_p on caja_movimientos;
create policy caja_mov_p on caja_movimientos for all to authenticated
  using (exists (select 1 from caja_turnos t where t.id = turno_id and t.restaurante_id = mi_restaurante()));

-- catálogo: lo escribe administración; 'disponible' también lo cambia cocina cuando
-- se agota un plato.
drop policy if exists admin_prod on productos;
create policy admin_prod on productos for all to authenticated
  using (restaurante_id = mi_restaurante() and mi_rol() in ('admin','cocina'))
  with check (restaurante_id = mi_restaurante() and mi_rol() in ('admin','cocina'));

drop policy if exists admin_cat on categorias;
create policy admin_cat on categorias for all to authenticated
  using (restaurante_id = mi_restaurante() and mi_rol() = 'admin')
  with check (restaurante_id = mi_restaurante() and mi_rol() = 'admin');

drop policy if exists admin_promo on promociones;
create policy admin_promo on promociones for all to authenticated
  using (restaurante_id = mi_restaurante() and mi_rol() = 'admin')
  with check (restaurante_id = mi_restaurante() and mi_rol() = 'admin');

-- armar los combos (qué productos lleva cada promo)
drop policy if exists admin_promo_items on promocion_items;
create policy admin_promo_items on promocion_items for all to authenticated
  using (
    mi_rol() = 'admin'
    and exists (select 1 from promociones pm where pm.id = promocion_id and pm.restaurante_id = mi_restaurante())
  )
  with check (
    mi_rol() = 'admin'
    and exists (select 1 from promociones pm where pm.id = promocion_id and pm.restaurante_id = mi_restaurante())
  );

drop policy if exists admin_zona on zonas_domicilio;
create policy admin_zona on zonas_domicilio for all to authenticated
  using (restaurante_id = mi_restaurante() and mi_rol() = 'admin')
  with check (restaurante_id = mi_restaurante() and mi_rol() = 'admin');

-- costos: SOLO administración, y solo de su restaurante
drop policy if exists costos_dueno on producto_costos;
drop policy if exists costos_admin on producto_costos;
create policy costos_admin on producto_costos for all to authenticated
  using (
    mi_rol() = 'admin'
    and exists (select 1 from productos p where p.id = producto_id and p.restaurante_id = mi_restaurante())
  )
  with check (
    mi_rol() = 'admin'
    and exists (select 1 from productos p where p.id = producto_id and p.restaurante_id = mi_restaurante())
  );

-- =====================================================================
-- STORAGE · bucket 'productos' (fotos de la carta, logo, portada, promos)
-- Público para leer; escribe administración.
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do update set public = true;

drop policy if exists productos_lectura_publica on storage.objects;
create policy productos_lectura_publica on storage.objects for select
  using (bucket_id = 'productos');

drop policy if exists productos_admin_insert on storage.objects;
create policy productos_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'productos'
    and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin' and u.activo));

drop policy if exists productos_admin_update on storage.objects;
create policy productos_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'productos'
    and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin' and u.activo));

drop policy if exists productos_admin_delete on storage.objects;
create policy productos_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'productos'
    and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin' and u.activo));

-- =====================================================================
-- REALTIME
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['comandas','pedidos','productos','promociones'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- =====================================================================
-- ENDURECIMIENTO DE PERMISOS
-- Postgres da EXECUTE a PUBLIC por defecto. Se quita y se da solo lo justo.
-- =====================================================================
revoke all on function _comanda_listo() from public, anon, authenticated;
revoke all on function _insertar_items_pedido(uuid, uuid, jsonb, int) from public, anon, authenticated;
revoke all on function _recalcular_totales(uuid) from public, anon, authenticated;
revoke all on function _repartir_pago(uuid, bigint) from public, anon, authenticated;

-- helpers de sesión: staff autenticado
revoke all on function mi_restaurante() from public, anon;
revoke all on function mi_rol() from public, anon;
revoke all on function mi_estacion() from public, anon;
grant execute on function mi_restaurante() to authenticated;
grant execute on function mi_rol() to authenticated;
grant execute on function mi_estacion() to authenticated;

-- pedido: crear y editar SÍ son públicas a propósito (el comensal no tiene cuenta).
-- Son seguras porque recalculan precios desde 'productos' y nunca aceptan montos del
-- cliente; editar además exige el token del pedido y que siga sin aprobar.
revoke all on function crear_pedido(text, jsonb) from public;
revoke all on function iniciar_edicion_pedido(uuid) from public;
revoke all on function actualizar_pedido_cliente(uuid, jsonb) from public;
revoke all on function cancelar_edicion_pedido(uuid) from public;
revoke all on function estado_pedido_publico(text, bigint, text) from public;
grant execute on function crear_pedido(text, jsonb) to anon, authenticated;
grant execute on function iniciar_edicion_pedido(uuid) to anon, authenticated;
grant execute on function actualizar_pedido_cliente(uuid, jsonb) to anon, authenticated;
grant execute on function cancelar_edicion_pedido(uuid) to anon, authenticated;
grant execute on function estado_pedido_publico(text, bigint, text) to anon, authenticated;

revoke all on function confirmar_pedido(uuid) from public, anon;
revoke all on function verificar_transferencia(uuid, boolean, text) from public, anon;
grant execute on function confirmar_pedido(uuid) to authenticated;
grant execute on function verificar_transferencia(uuid, boolean, text) to authenticated;

-- el equipo toma pedidos y suma a cuentas abiertas: staff autenticado, nunca el comensal
revoke all on function crear_pedido_interno(jsonb, boolean) from public, anon;
revoke all on function agregar_items_pedido(uuid, jsonb) from public, anon;
revoke all on function marcar_servido(uuid) from public, anon;
grant execute on function crear_pedido_interno(jsonb, boolean) to authenticated;
grant execute on function agregar_items_pedido(uuid, jsonb) to authenticated;
grant execute on function marcar_servido(uuid) to authenticated;

-- caja: solo staff autenticado; el comensal (anon) no toca caja
revoke all on function turno_abierto() from public, anon;
revoke all on function abrir_turno(bigint) from public, anon;
revoke all on function registrar_cobro(uuid, medio_pago, bigint, bigint) from public, anon;
revoke all on function registrar_cobro_mixto(uuid, jsonb, bigint) from public, anon;
revoke all on function confirmar_contraentrega(uuid) from public, anon;
revoke all on function anular_pedido(uuid, text) from public, anon;
revoke all on function cerrar_turno(bigint, text) from public, anon;
grant execute on function turno_abierto() to authenticated;
grant execute on function abrir_turno(bigint) to authenticated;
grant execute on function registrar_cobro(uuid, medio_pago, bigint, bigint) to authenticated;
grant execute on function registrar_cobro_mixto(uuid, jsonb, bigint) to authenticated;
grant execute on function confirmar_contraentrega(uuid) to authenticated;
grant execute on function anular_pedido(uuid, text) to authenticated;
grant execute on function cerrar_turno(bigint, text) to authenticated;

-- domiciliario: asignación (pase), estados de entrega (domiciliario) y legalización (caja)
revoke all on function asignar_domiciliario(uuid, uuid) from public, anon;
revoke all on function quitar_domiciliario(uuid) from public, anon;
revoke all on function recoger_pedido(uuid) from public, anon;
revoke all on function entregar_pedido(uuid) from public, anon;
revoke all on function fallo_entrega(uuid, text) from public, anon;
revoke all on function cambiar_a_transferencia(uuid) from public, anon;
revoke all on function repartir_pago_entrega(uuid, bigint) from public, anon;
revoke all on function legalizar_domiciliario(uuid) from public, anon;
grant execute on function asignar_domiciliario(uuid, uuid) to authenticated;
grant execute on function quitar_domiciliario(uuid) to authenticated;
grant execute on function recoger_pedido(uuid) to authenticated;
grant execute on function entregar_pedido(uuid) to authenticated;
grant execute on function fallo_entrega(uuid, text) to authenticated;
grant execute on function cambiar_a_transferencia(uuid) to authenticated;
grant execute on function repartir_pago_entrega(uuid, bigint) to authenticated;
grant execute on function legalizar_domiciliario(uuid) to authenticated;

-- reportes y equipo
revoke all on function reporte_ventas(int) from public, anon;
revoke all on function reporte_rango(timestamptz, timestamptz, text) from public, anon;
revoke all on function propinas_por_dia(timestamptz, timestamptz, text) from public, anon;
revoke all on function reporte_rentabilidad(int) from public, anon;
revoke all on function actualizar_costo(uuid, bigint) from public, anon;
revoke all on function crear_usuario(text, text, text, rol_usuario, uuid) from public, anon;
revoke all on function eliminar_usuario(uuid) from public, anon;
grant execute on function reporte_ventas(int) to authenticated;
grant execute on function reporte_rango(timestamptz, timestamptz, text) to authenticated;
grant execute on function propinas_por_dia(timestamptz, timestamptz, text) to authenticated;
grant execute on function reporte_rentabilidad(int) to authenticated;
grant execute on function actualizar_costo(uuid, bigint) to authenticated;
grant execute on function crear_usuario(text, text, text, rol_usuario, uuid) to authenticated;
grant execute on function eliminar_usuario(uuid) to authenticated;

-- =====================================================================
-- LISTO. Lo que sigue:
--   1. Insertar el restaurante, sus cocinas, categorías, productos, zonas
--      y mesas (usar `seed-distrito-novo.sql` como molde).
--   2. Crear la cuenta de administración y ponerle rol = 'admin':
--        update usuarios set rol = 'admin'
--        where id = (select id from auth.users where email = 'TU-CORREO');
--   3. El resto (logo, fotos, frases, promociones) se carga desde el panel.
-- =====================================================================
