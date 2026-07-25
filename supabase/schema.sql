-- =====================================================================
-- DISTRITO NOVO · Esquema base (multi-tenant desde el día uno)
-- Postgres / Supabase
-- Ejecutar completo en el SQL Editor o como migración.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- TIPOS ----------
do $$ begin
  create type rol_usuario   as enum ('admin','cajero','mesero','cocina','pase','domiciliario');
  create type canal_pedido  as enum ('mesa','whatsapp','domicilio','recoger','mostrador');
  create type estado_pedido as enum ('esperando_pago','pendiente','en_cocina','listo','en_despacho','en_camino','entregado','cerrado','anulado');
  create type estado_comanda as enum ('pendiente','preparando','listo','cancelada');
  create type medio_pago    as enum ('efectivo','transferencia','datafono','pasarela','mesa');
  create type tipo_promo    as enum ('envio','combo','aviso','descuento');
  create type estado_pago   as enum ('pendiente','verificado','rechazado');
exception when duplicate_object then null; end $$;

-- ---------- TABLAS ----------
create table if not exists restaurantes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text not null unique,
  logo_url text,
  whatsapp text,
  llave_pago text,          -- llave Bre-B / Nequi
  cuenta_pago text,         -- cuenta bancaria mostrada al cliente
  base_caja bigint not null default 200000,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table if not exists usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  nombre text not null,
  rol rol_usuario not null,
  estacion_id uuid,                     -- solo para rol 'cocina'
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
create index if not exists ix_usuarios_rest on usuarios(restaurante_id);

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
  codigo_pago int,          -- 3 cifras que hacen unico el valor a transferir
  monto_exacto bigint,      -- total ajustado con el codigo
  creado_en timestamptz not null default now(),
  confirmado_en timestamptz,
  objetivo_en timestamptz,  -- hora comprometida de salida
  confirmado_por uuid references usuarios(id),
  domiciliario_id uuid references usuarios(id),
  entregado_en timestamptz,
  motivo_anulacion text,
  nota_entrega text,        -- motivo cuando el domiciliario no pudo entregar
  anulado_por uuid references usuarios(id)
);
create index if not exists ix_pedidos_rest_estado on pedidos(restaurante_id, estado);
create index if not exists ix_pedidos_token on pedidos(token);

create table if not exists pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  producto_id uuid not null references productos(id),
  estacion_id uuid not null references estaciones(id),
  nombre_snap text not null,        -- congelamos nombre y precio al momento del pedido
  precio_snap bigint not null,
  minutos_snap int not null,
  cantidad int not null check (cantidad > 0),
  notas text
);
create index if not exists ix_items_pedido on pedido_items(pedido_id);

create table if not exists comandas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  estacion_id uuid not null references estaciones(id),
  minutos int not null,
  disparo_en timestamptz not null,   -- cuando aparece en la pantalla de esa cocina
  estado estado_comanda not null default 'pendiente',
  iniciado_en timestamptz,
  listo_en timestamptz,
  unique (pedido_id, estacion_id)
);
create index if not exists ix_comandas_estacion on comandas(estacion_id, estado, disparo_en);

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
-- CREAR PEDIDO
-- El cliente NUNCA envía precios. El servidor los recalcula desde productos.
-- payload: { canal, mesa_id, cliente_nombre, cliente_tel, direccion,
--            zona_id, indicaciones, medio_pago,
--            items: [{producto_id, cantidad, notas}] }
-- =====================================================================
create or replace function crear_pedido(p_slug text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rest uuid; v_pedido uuid; v_sub bigint := 0; v_dom bigint := 0;
  v_umbral bigint; v_zona_valor bigint := 0; v_canal canal_pedido;
  v_medio medio_pago; v_total bigint; v_cod int; v_exacto bigint;
  v_estado estado_pedido; v_num bigint; v_token uuid;
begin
  select id into v_rest from restaurantes where slug = p_slug and activo;
  if v_rest is null then raise exception 'Restaurante no encontrado'; end if;

  v_canal := (p_payload->>'canal')::canal_pedido;
  v_medio := nullif(p_payload->>'medio_pago','')::medio_pago;

  -- estado inicial segun como paga
  v_estado := case
    when v_canal = 'mesa' then 'pendiente'::estado_pedido            -- espera al mesero
    when v_medio = 'pasarela' then 'pendiente'::estado_pedido        -- lo confirma el webhook
    when v_medio = 'transferencia' then 'esperando_pago'::estado_pedido
    else 'pendiente'::estado_pedido                                  -- contraentrega: lo confirma caja
  end;

  insert into pedidos (restaurante_id, canal, mesa_id, cliente_nombre, cliente_tel,
                       direccion, zona_id, indicaciones, medio_pago, estado)
  values (v_rest, v_canal,
          nullif(p_payload->>'mesa_id','')::uuid,
          nullif(p_payload->>'cliente_nombre',''),
          nullif(p_payload->>'cliente_tel',''),
          nullif(p_payload->>'direccion',''),
          nullif(p_payload->>'zona_id','')::uuid,
          nullif(p_payload->>'indicaciones',''),
          v_medio, v_estado)
  returning id, numero, token into v_pedido, v_num, v_token;

  -- items con precio del servidor
  insert into pedido_items (pedido_id, producto_id, estacion_id, nombre_snap, precio_snap, minutos_snap, cantidad, notas)
  select v_pedido, pr.id, pr.estacion_id, pr.nombre, pr.precio, pr.minutos_prep,
         greatest((it->>'cantidad')::int, 1), nullif(it->>'notas','')
  from jsonb_array_elements(p_payload->'items') it
  join productos pr on pr.id = (it->>'producto_id')::uuid
  where pr.restaurante_id = v_rest and pr.activo and pr.disponible;

  if not exists (select 1 from pedido_items where pedido_id = v_pedido) then
    raise exception 'El pedido no tiene productos disponibles';
  end if;

  select coalesce(sum(precio_snap * cantidad),0) into v_sub from pedido_items where pedido_id = v_pedido;

  -- domicilio por zona, gratis si hay promocion de envio vigente
  if v_canal in ('domicilio','whatsapp') then
    select valor into v_zona_valor from zonas_domicilio
      where id = nullif(p_payload->>'zona_id','')::uuid and restaurante_id = v_rest and activa;
    v_zona_valor := coalesce(v_zona_valor, 0);

    select monto_minimo into v_umbral from promociones
      where restaurante_id = v_rest and tipo = 'envio' and activa
        and (desde is null or desde <= now()) and (hasta is null or hasta >= now())
      order by orden limit 1;

    v_dom := case when v_umbral is not null and v_sub >= v_umbral then 0 else v_zona_valor end;
  end if;

  v_total := v_sub + v_dom;

  -- codigo de 3 cifras: hace unico el valor a transferir para que caja lo ubique
  v_cod := 100 + (v_num % 900)::int;
  v_exacto := (v_total / 1000) * 1000 + v_cod;
  if v_exacto < v_total then v_exacto := v_exacto + 1000; end if;

  update pedidos set subtotal = v_sub, domicilio = v_dom, total = v_total,
         codigo_pago = v_cod, monto_exacto = v_exacto
  where id = v_pedido;

  if v_medio is not null and v_medio <> 'mesa' then
    insert into pagos (pedido_id, medio, monto,
                       estado)
    values (v_pedido, v_medio,
            case when v_medio = 'transferencia' then v_exacto else v_total end,
            'pendiente');
  end if;

  return jsonb_build_object(
    'id', v_pedido, 'numero', v_num, 'token', v_token,
    'subtotal', v_sub, 'domicilio', v_dom, 'total', v_total,
    'codigo_pago', v_cod, 'monto_exacto', v_exacto, 'estado', v_estado
  );
end $$;

-- =====================================================================
-- CONFIRMAR PEDIDO  ->  aquí vive el DISPARO ESCALONADO
-- Cada estación entra en el minuto justo para que todo salga junto.
-- =====================================================================
create or replace function confirmar_pedido(p_pedido uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_max int; v_conf timestamptz := now(); v_rest uuid;
begin
  select restaurante_id into v_rest from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then
    raise exception 'No autorizado';
  end if;

  select max(m) into v_max from (
    select max(minutos_snap) m from pedido_items where pedido_id = p_pedido group by estacion_id
  ) s;
  if v_max is null then raise exception 'Pedido sin items'; end if;

  insert into comandas (pedido_id, estacion_id, minutos, disparo_en, estado)
  select p_pedido, pi.estacion_id, max(pi.minutos_snap),
         v_conf + make_interval(mins => v_max - max(pi.minutos_snap)),
         'pendiente'
  from pedido_items pi
  where pi.pedido_id = p_pedido
  group by pi.estacion_id
  on conflict (pedido_id, estacion_id) do nothing;

  update pedidos
     set estado = 'en_cocina', confirmado_en = v_conf,
         objetivo_en = v_conf + make_interval(mins => v_max),
         confirmado_por = auth.uid()
   where id = p_pedido;
end $$;

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

-- verificar una transferencia: caja la aprueba y el pedido entra a cocina.
-- Al aprobar, deja también el ingreso en el turno abierto para que cuente en el arqueo.
create or replace function verificar_transferencia(p_pedido uuid, p_ok boolean, p_motivo text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_turno uuid; v_monto bigint; v_rest uuid;
begin
  if mi_rol() not in ('cajero','admin') then raise exception 'Solo caja o administración'; end if;

  select restaurante_id, monto_exacto into v_rest, v_monto from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;

  if p_ok then
    update pagos set estado='verificado', verificado_por=auth.uid(), verificado_en=now()
      where pedido_id = p_pedido and medio='transferencia';
    update pedidos set estado='pendiente' where id = p_pedido and estado='esperando_pago';
    perform confirmar_pedido(p_pedido);

    v_turno := turno_abierto();
    if v_turno is not null then
      insert into caja_movimientos (turno_id, tipo, medio, monto, pedido_id, usuario_id)
      values (v_turno, 'ingreso', 'transferencia', coalesce(v_monto,0), p_pedido, auth.uid());
    end if;
  else
    update pagos set estado='rechazado', verificado_por=auth.uid(), verificado_en=now()
      where pedido_id = p_pedido and medio='transferencia';
    update pedidos set estado='anulado', motivo_anulacion = coalesce(p_motivo,'Transferencia no verificada'),
           anulado_por = auth.uid()
      where id = p_pedido;
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

-- registrar un cobro (mesa, mostrador, recoger) con su medio: deja el pago verificado,
-- el movimiento de caja y cierra el pedido.
create or replace function registrar_cobro(p_pedido uuid, p_medio medio_pago, p_monto bigint default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_turno uuid; v_rest uuid; v_total bigint; v_monto bigint;
begin
  if mi_rol() not in ('cajero','admin') then raise exception 'Solo caja o administración'; end if;
  v_turno := turno_abierto();
  if v_turno is null then raise exception 'Abre un turno antes de cobrar'; end if;
  if p_medio = 'mesa' then raise exception 'Escoge un medio de pago real'; end if;

  select restaurante_id, total into v_rest, v_total from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;

  v_monto := coalesce(p_monto, v_total);

  insert into pagos (pedido_id, medio, monto, estado, verificado_por, verificado_en)
  values (p_pedido, p_medio, v_monto, 'verificado', auth.uid(), now());

  insert into caja_movimientos (turno_id, tipo, medio, monto, pedido_id, usuario_id)
  values (v_turno, 'ingreso', p_medio, v_monto, p_pedido, auth.uid());

  update pedidos set estado = 'cerrado', medio_pago = p_medio
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

-- cerrar turno: calcula el efectivo esperado y la diferencia, devuelve el arqueo por medio
create or replace function cerrar_turno(p_efectivo_contado bigint, p_nota text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_turno uuid; v_base bigint; v_efectivo bigint; v_egreso bigint;
  v_esperado bigint; v_dif bigint; v_arqueo jsonb;
begin
  if mi_rol() not in ('cajero','admin') then raise exception 'Solo caja o administración'; end if;
  v_turno := turno_abierto();
  if v_turno is null then raise exception 'No hay turno abierto'; end if;

  select base_inicial into v_base from caja_turnos where id = v_turno;

  select coalesce(sum(monto) filter (where tipo in ('ingreso','legalizacion') and medio = 'efectivo'),0),
         coalesce(sum(monto) filter (where tipo = 'egreso'),0)
    into v_efectivo, v_egreso
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
    'efectivo_contado', p_efectivo_contado, 'diferencia', v_dif, 'por_medio', v_arqueo
  );
end $$;

-- =====================================================================
-- DOMICILIARIO · asignación, entrega y legalización del efectivo
-- =====================================================================

-- pase/admin asigna un domiciliario a un pedido en despacho
create or replace function asignar_domiciliario(p_pedido uuid, p_domi uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_rest uuid; v_estado estado_pedido; v_domi_rest uuid; v_domi_rol rol_usuario;
begin
  if mi_rol() not in ('pase','admin') then raise exception 'Solo pase o administración'; end if;

  select restaurante_id, estado into v_rest, v_estado from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;
  if v_estado <> 'en_despacho' then raise exception 'El pedido no está listo para despacho'; end if;

  select restaurante_id, rol into v_domi_rest, v_domi_rol from usuarios where id = p_domi and activo;
  if v_domi_rest is distinct from mi_restaurante() or v_domi_rol <> 'domiciliario' then
    raise exception 'Domiciliario no válido';
  end if;

  update pedidos set domiciliario_id = p_domi where id = p_pedido;
end $$;

-- el domiciliario recoge: en_despacho -> en_camino (solo su pedido)
create or replace function recoger_pedido(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_domi uuid; v_estado estado_pedido;
begin
  if mi_rol() <> 'domiciliario' then raise exception 'Solo el domiciliario'; end if;
  select domiciliario_id, estado into v_domi, v_estado from pedidos where id = p_pedido;
  if v_domi is distinct from auth.uid() then raise exception 'Ese pedido no es tuyo'; end if;
  if v_estado <> 'en_despacho' then raise exception 'El pedido no está por recoger'; end if;

  update pedidos set estado = 'en_camino' where id = p_pedido;
end $$;

-- el domiciliario entrega. Si es efectivo, queda 'entregado' con el efectivo por legalizar
-- en caja; si ya venía pago, se cierra directo.
create or replace function entregar_pedido(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_domi uuid; v_estado estado_pedido; v_medio medio_pago;
begin
  if mi_rol() <> 'domiciliario' then raise exception 'Solo el domiciliario'; end if;
  select domiciliario_id, estado, medio_pago into v_domi, v_estado, v_medio
    from pedidos where id = p_pedido;
  if v_domi is distinct from auth.uid() then raise exception 'Ese pedido no es tuyo'; end if;
  if v_estado <> 'en_camino' then raise exception 'El pedido no está en camino'; end if;

  update pedidos
     set estado = case when v_medio = 'efectivo' then 'entregado'::estado_pedido
                       else 'cerrado'::estado_pedido end,
         entregado_en = now()
   where id = p_pedido;
end $$;

-- no se pudo entregar: vuelve a despacho con el motivo, para que pase o caja decidan
create or replace function fallo_entrega(p_pedido uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare v_domi uuid; v_estado estado_pedido;
begin
  if mi_rol() <> 'domiciliario' then raise exception 'Solo el domiciliario'; end if;
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

  for r in
    select id, total from pedidos
    where restaurante_id = mi_restaurante() and domiciliario_id = p_domi
      and estado = 'entregado' and medio_pago = 'efectivo'
  loop
    insert into pagos (pedido_id, medio, monto, estado, verificado_por, verificado_en)
    values (r.id, 'efectivo', r.total, 'verificado', auth.uid(), now());

    insert into caja_movimientos (turno_id, tipo, medio, monto, pedido_id, usuario_id)
    values (v_turno, 'legalizacion', 'efectivo', r.total, r.id, p_domi);

    update pedidos set estado = 'cerrado' where id = r.id;
    v_total := v_total + r.total;
  end loop;

  return v_total;
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

-- --- lectura pública de la carta (el comensal no tiene cuenta) ---
create policy pub_rest  on restaurantes    for select using (activo);
create policy pub_est   on estaciones      for select using (activa);
create policy pub_cat   on categorias      for select using (activa);
create policy pub_prod  on productos       for select using (activo);
create policy pub_zona  on zonas_domicilio for select using (activa);
create policy pub_promo on promociones     for select using (activa);
create policy pub_promoit on promocion_items for select using (true);
create policy pub_mesa  on mesas           for select using (activa);

-- --- el comensal ve SOLO su pedido, y solo con el token ---
create policy pub_ped_token on pedidos for select
  using (token::text = current_setting('request.headers', true)::json->>'x-pedido-token');

-- ...y los renglones de ese mismo pedido, para que el seguimiento muestre qué pidió.
-- El token viaja en la cabecera, nunca en la consulta, así que no se puede pescar otro.
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
create policy staff_rest on restaurantes for all to authenticated
  using (id = mi_restaurante()) with check (id = mi_restaurante());

create policy staff_usuarios on usuarios for select to authenticated
  using (restaurante_id = mi_restaurante());
create policy admin_usuarios on usuarios for all to authenticated
  using (restaurante_id = mi_restaurante() and mi_rol() = 'admin')
  with check (restaurante_id = mi_restaurante() and mi_rol() = 'admin');

create policy staff_ped on pedidos for select to authenticated
  using (restaurante_id = mi_restaurante());
create policy staff_ped_upd on pedidos for update to authenticated
  using (restaurante_id = mi_restaurante() and mi_rol() in ('admin','cajero','mesero','pase'));

create policy staff_items on pedido_items for select to authenticated
  using (exists (select 1 from pedidos p where p.id = pedido_id and p.restaurante_id = mi_restaurante()));

-- cocina: ve y actualiza SOLO las comandas de su estación, y solo las ya disparadas
create policy cocina_comandas on comandas for select to authenticated using (
  exists (select 1 from pedidos p where p.id = pedido_id and p.restaurante_id = mi_restaurante())
  and (mi_rol() <> 'cocina' or (estacion_id = mi_estacion() and disparo_en <= now()))
);
create policy cocina_comandas_upd on comandas for update to authenticated using (
  exists (select 1 from pedidos p where p.id = pedido_id and p.restaurante_id = mi_restaurante())
  and (mi_rol() in ('admin','pase') or (mi_rol() = 'cocina' and estacion_id = mi_estacion()))
);

-- domiciliario: SOLO los pedidos que le asignaron
create policy domi_ped on pedidos for select to authenticated
  using (mi_rol() = 'domiciliario' and domiciliario_id = auth.uid());
create policy domi_ped_upd on pedidos for update to authenticated
  using (mi_rol() = 'domiciliario' and domiciliario_id = auth.uid());

-- caja
create policy caja_pagos on pagos for all to authenticated
  using (exists (select 1 from pedidos p where p.id = pedido_id and p.restaurante_id = mi_restaurante())
         and mi_rol() in ('admin','cajero'));
create policy caja_turnos_p on caja_turnos for all to authenticated
  using (restaurante_id = mi_restaurante() and mi_rol() in ('admin','cajero'))
  with check (restaurante_id = mi_restaurante() and mi_rol() in ('admin','cajero'));
create policy caja_mov_p on caja_movimientos for all to authenticated
  using (exists (select 1 from caja_turnos t where t.id = turno_id and t.restaurante_id = mi_restaurante()));

-- catálogo: escribe el admin; 'disponible' también lo cambia cocina
create policy admin_prod on productos for all to authenticated
  using (restaurante_id = mi_restaurante() and mi_rol() in ('admin','cocina'))
  with check (restaurante_id = mi_restaurante() and mi_rol() in ('admin','cocina'));
create policy admin_cat on categorias for all to authenticated
  using (restaurante_id = mi_restaurante() and mi_rol() = 'admin')
  with check (restaurante_id = mi_restaurante() and mi_rol() = 'admin');
create policy admin_promo on promociones for all to authenticated
  using (restaurante_id = mi_restaurante() and mi_rol() = 'admin')
  with check (restaurante_id = mi_restaurante() and mi_rol() = 'admin');
create policy admin_zona on zonas_domicilio for all to authenticated
  using (restaurante_id = mi_restaurante() and mi_rol() = 'admin')
  with check (restaurante_id = mi_restaurante() and mi_rol() = 'admin');

-- permisos de ejecución
grant execute on function crear_pedido(text, jsonb) to anon, authenticated;
grant execute on function confirmar_pedido(uuid) to authenticated;
grant execute on function verificar_transferencia(uuid, boolean, text) to authenticated;

-- realtime
alter publication supabase_realtime add table comandas;
alter publication supabase_realtime add table pedidos;
alter publication supabase_realtime add table productos;
alter publication supabase_realtime add table promociones;

-- =====================================================================
-- ENDURECIMIENTO DE PERMISOS
-- Postgres da EXECUTE a PUBLIC por defecto. Se quita y se da solo lo justo.
-- =====================================================================
revoke all on function _comanda_listo() from public, anon, authenticated;

revoke all on function mi_restaurante() from public, anon;
revoke all on function mi_rol() from public, anon;
revoke all on function mi_estacion() from public, anon;
grant execute on function mi_restaurante() to authenticated;
grant execute on function mi_rol() to authenticated;
grant execute on function mi_estacion() to authenticated;

revoke all on function confirmar_pedido(uuid) from public, anon;
revoke all on function verificar_transferencia(uuid, boolean, text) from public, anon;
grant execute on function confirmar_pedido(uuid) to authenticated;
grant execute on function verificar_transferencia(uuid, boolean, text) to authenticated;

-- crear_pedido SI es pública a propósito: el comensal no tiene cuenta.
-- Es segura porque recalcula precios desde 'productos' y nunca acepta montos del cliente.
revoke all on function crear_pedido(text, jsonb) from public;
grant execute on function crear_pedido(text, jsonb) to anon, authenticated;

-- caja: solo staff autenticado; el comensal (anon) no toca caja
revoke all on function turno_abierto() from public, anon;
revoke all on function abrir_turno(bigint) from public, anon;
revoke all on function registrar_cobro(uuid, medio_pago, bigint) from public, anon;
revoke all on function confirmar_contraentrega(uuid) from public, anon;
revoke all on function anular_pedido(uuid, text) from public, anon;
revoke all on function cerrar_turno(bigint, text) from public, anon;
grant execute on function turno_abierto() to authenticated;
grant execute on function abrir_turno(bigint) to authenticated;
grant execute on function registrar_cobro(uuid, medio_pago, bigint) to authenticated;
grant execute on function confirmar_contraentrega(uuid) to authenticated;
grant execute on function anular_pedido(uuid, text) to authenticated;
grant execute on function cerrar_turno(bigint, text) to authenticated;

-- domiciliario: asignación (pase), estados de entrega (domiciliario) y legalización (caja)
revoke all on function asignar_domiciliario(uuid, uuid) from public, anon;
revoke all on function recoger_pedido(uuid) from public, anon;
revoke all on function entregar_pedido(uuid) from public, anon;
revoke all on function fallo_entrega(uuid, text) from public, anon;
revoke all on function legalizar_domiciliario(uuid) from public, anon;
grant execute on function asignar_domiciliario(uuid, uuid) to authenticated;
grant execute on function recoger_pedido(uuid) to authenticated;
grant execute on function entregar_pedido(uuid) to authenticated;
grant execute on function fallo_entrega(uuid, text) to authenticated;
grant execute on function legalizar_domiciliario(uuid) to authenticated;
