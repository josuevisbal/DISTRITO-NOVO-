-- ACTUALIZAR PRODUCCIÓN · domicilio en efectivo derecho a cocina + cocina ve el pedido completo
-- Correr UNA VEZ en el SQL Editor del restaurante. Seguro de re-correr.
--
-- 1. El domicilio que se paga en efectivo no tiene pago que verificar: `crear_pedido` lo
--    manda derecho a cocina (estado 'en_cocina', comandas creadas) sin pasar por caja.
--    La confirmación vive ahora en `_confirmar_comandas` (interna) y `confirmar_pedido`
--    solo le pone el candado de restaurante.
-- 2. La pantalla de cocina muestra el pedido entero en una tarjeta y un botón mueve todas
--    sus comandas: `marcar_ronda_cocina(pedido, ronda, estado)`.

create or replace function _confirmar_comandas(p_pedido uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_max int; v_conf timestamptz := now(); v_nuevas int;
begin
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

create or replace function confirmar_pedido(p_pedido uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_rest uuid;
begin
  select restaurante_id into v_rest from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then
    raise exception 'No autorizado';
  end if;
  perform _confirmar_comandas(p_pedido);
end $$;

create or replace function marcar_ronda_cocina(p_pedido uuid, p_ronda int, p_estado text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_rest uuid;
begin
  if mi_rol() not in ('cocina','admin') then raise exception 'Solo cocina'; end if;
  if p_estado not in ('preparando','listo') then raise exception 'Estado no válido'; end if;

  select restaurante_id into v_rest from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;

  if p_estado = 'preparando' then
    update comandas set estado = 'preparando'
     where pedido_id = p_pedido and ronda = p_ronda and estado = 'pendiente';
  else
    update comandas set estado = 'listo'
     where pedido_id = p_pedido and ronda = p_ronda and estado in ('pendiente','preparando');
  end if;

  -- Por si el disparador fila a fila no alcanzó a ver la última: si ya no queda nada en
  -- cocina, el pedido está listo para el pase.
  if p_estado = 'listo' and not exists (
    select 1 from comandas where pedido_id = p_pedido and estado <> 'listo'
  ) then
    update pedidos set estado = 'listo' where id = p_pedido and estado = 'en_cocina';
  end if;
end $$;

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

  -- Domicilio en efectivo: no hay pago que verificar, así que entra derecho a cocina
  -- sin pasar por caja (decisión del restaurante). Caja lo ve cuando sale de cocina,
  -- para imprimir la cuenta y soltarlo al mostrador. Un pago repartido que al final
  -- quedó todo en efectivo sigue el mismo camino.
  if v_canal = 'domicilio' and v_estado = 'pendiente' and v_medio in ('efectivo','mixto') then
    perform _confirmar_comandas(v_pedido);
    v_estado := 'en_cocina';
  end if;

  return jsonb_build_object(
    'id', v_pedido, 'numero', v_num, 'token', v_token,
    'subtotal', v_sub, 'domicilio', v_dom, 'total', v_total,
    'codigo_pago', null, 'monto_exacto', v_total, 'estado', v_estado,
    'ronda', 1, 'cuenta_abierta', false
  );
end $$;

revoke all on function _confirmar_comandas(uuid) from public, anon, authenticated;
revoke all on function marcar_ronda_cocina(uuid, int, text) from public, anon;
grant execute on function marcar_ronda_cocina(uuid, int, text) to authenticated;
