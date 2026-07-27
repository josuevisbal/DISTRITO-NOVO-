-- =====================================================================
-- PROMOCIONES QUE SÍ SE APLICAN · combos con precio especial
-- Correr UNA VEZ en el SQL Editor del proyecto del restaurante.
-- Seguro de re-correr (idempotente).
--
-- Qué cambia:
--  1) pedido_items.promocion_id: traza de qué combo salió cada renglón.
--  2) RLS de escritura en promocion_items para admin/dueño (armar combos).
--  3) crear_pedido acepta `combos: [{promocion_id, cantidad}]`: valida la
--     promo (activa, vigente, del restaurante, con precio_combo), mete sus
--     productos a las estaciones normales (el disparo escalonado no se
--     toca) y cobra precio_combo prorrateándolo entre los renglones — la
--     suma da exacto el precio del combo. El cliente jamás envía precios.
-- =====================================================================

alter table pedido_items add column if not exists promocion_id uuid references promociones(id) on delete set null;

drop policy if exists admin_promo_items on promocion_items;
create policy admin_promo_items on promocion_items for all to authenticated
  using (
    mi_rol() in ('admin','dueno')
    and exists (select 1 from promociones pm where pm.id = promocion_id and pm.restaurante_id = mi_restaurante())
  )
  with check (
    mi_rol() in ('admin','dueno')
    and exists (select 1 from promociones pm where pm.id = promocion_id and pm.restaurante_id = mi_restaurante())
  );

create or replace function crear_pedido(p_slug text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rest uuid; v_pedido uuid; v_sub bigint := 0; v_dom bigint := 0;
  v_umbral bigint; v_zona_valor bigint := 0; v_canal canal_pedido;
  v_medio medio_pago; v_total bigint;
  v_estado estado_pedido; v_num bigint; v_token uuid;
  r_combo jsonb; v_promo record; v_cant_combo int; v_normal bigint;
  v_repartido bigint; v_unit bigint; v_resto bigint; v_primera boolean;
  r_item record; v_n int;
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

  -- items sueltos con precio del servidor
  insert into pedido_items (pedido_id, producto_id, estacion_id, nombre_snap, precio_snap, minutos_snap, cantidad, notas)
  select v_pedido, pr.id, pr.estacion_id, pr.nombre, pr.precio, pr.minutos_prep,
         greatest((it->>'cantidad')::int, 1), nullif(it->>'notas','')
  from jsonb_array_elements(coalesce(p_payload->'items','[]'::jsonb)) it
  join productos pr on pr.id = (it->>'producto_id')::uuid
  where pr.restaurante_id = v_rest and pr.activo and pr.disponible;

  -- combos: precio especial del servidor, productos a sus estaciones normales
  for r_combo in select * from jsonb_array_elements(coalesce(p_payload->'combos','[]'::jsonb))
  loop
    select pm.id, pm.titulo, pm.precio_combo into v_promo
    from promociones pm
    where pm.id = (r_combo->>'promocion_id')::uuid
      and pm.restaurante_id = v_rest and pm.tipo = 'combo' and pm.activa
      and (pm.desde is null or pm.desde <= now())
      and (pm.hasta is null or pm.hasta >= now())
      and coalesce(pm.precio_combo, 0) > 0;
    if v_promo.id is null then raise exception 'El combo ya no está disponible'; end if;

    -- valor normal del combo y validación: TODOS sus productos activos y disponibles
    select coalesce(sum(pr.precio * pi.cantidad), 0), count(*) into v_normal, v_n
    from promocion_items pi
    join productos pr on pr.id = pi.producto_id
    where pi.promocion_id = v_promo.id
      and pr.restaurante_id = v_rest and pr.activo and pr.disponible;
    if v_n = 0 or v_normal <= 0
       or v_n <> (select count(*) from promocion_items where promocion_id = v_promo.id) then
      raise exception 'El combo "%" tiene productos agotados', v_promo.titulo;
    end if;

    v_cant_combo := greatest(coalesce((r_combo->>'cantidad')::int, 1), 1);

    -- una pasada por cada combo pedido: el redondeo cuadra exacto por combo
    for v_n in 1..v_cant_combo loop
      v_repartido := 0;
      v_primera := true;
      for r_item in
        select pr.id, pr.estacion_id, pr.nombre, pr.precio, pr.minutos_prep, pi.cantidad
        from promocion_items pi
        join productos pr on pr.id = pi.producto_id
        where pi.promocion_id = v_promo.id
        order by (pr.precio * pi.cantidad) desc, pr.id
      loop
        -- parte del precio del combo que le toca a cada unidad de este producto
        v_unit := (v_promo.precio_combo * r_item.precio) / v_normal;
        v_resto := 0;
        if v_primera then
          -- el renglón más caro absorbe el redondeo para que la suma dé exacta
          v_resto := v_promo.precio_combo
                     - (v_unit * r_item.cantidad)
                     - (select coalesce(sum(((v_promo.precio_combo * pr2.precio) / v_normal) * pi2.cantidad), 0)
                        from promocion_items pi2
                        join productos pr2 on pr2.id = pi2.producto_id
                        where pi2.promocion_id = v_promo.id and pi2.producto_id <> r_item.id);
        end if;

        if v_resto <> 0 and r_item.cantidad > 1 then
          -- una unidad carga el ajuste, el resto va parejo
          insert into pedido_items (pedido_id, producto_id, estacion_id, nombre_snap, precio_snap, minutos_snap, cantidad, notas, promocion_id)
          values (v_pedido, r_item.id, r_item.estacion_id, r_item.nombre, v_unit + v_resto, r_item.minutos_prep, 1, v_promo.titulo, v_promo.id),
                 (v_pedido, r_item.id, r_item.estacion_id, r_item.nombre, v_unit, r_item.minutos_prep, r_item.cantidad - 1, v_promo.titulo, v_promo.id);
        else
          insert into pedido_items (pedido_id, producto_id, estacion_id, nombre_snap, precio_snap, minutos_snap, cantidad, notas, promocion_id)
          values (v_pedido, r_item.id, r_item.estacion_id, r_item.nombre, v_unit + v_resto, r_item.minutos_prep, r_item.cantidad, v_promo.titulo, v_promo.id);
        end if;
        v_primera := false;
      end loop;
    end loop;
  end loop;

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

  -- Sin código sumado: se transfiere exactamente el total (platos + domicilio).
  update pedidos set subtotal = v_sub, domicilio = v_dom, total = v_total,
         codigo_pago = null, monto_exacto = v_total
  where id = v_pedido;

  if v_medio is not null and v_medio <> 'mesa' then
    insert into pagos (pedido_id, medio, monto, estado)
    values (v_pedido, v_medio, v_total, 'pendiente');
  end if;

  return jsonb_build_object(
    'id', v_pedido, 'numero', v_num, 'token', v_token,
    'subtotal', v_sub, 'domicilio', v_dom, 'total', v_total,
    'codigo_pago', null, 'monto_exacto', v_total, 'estado', v_estado
  );
end $$;
