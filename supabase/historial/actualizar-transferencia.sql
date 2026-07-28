-- ACTUALIZAR PRODUCCIÓN · transferencia exacta + consulta de pedido
-- Correr UNA VEZ en el SQL Editor del restaurante. Seguro de re-correr.

create or replace function crear_pedido(p_slug text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rest uuid; v_pedido uuid; v_sub bigint := 0; v_dom bigint := 0;
  v_umbral bigint; v_zona_valor bigint := 0; v_canal canal_pedido;
  v_medio medio_pago; v_total bigint;
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

revoke all on function estado_pedido_publico(text, bigint, text) from public;
grant execute on function estado_pedido_publico(text, bigint, text) to anon, authenticated;
