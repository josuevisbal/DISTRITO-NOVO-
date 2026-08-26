-- ACTUALIZAR PRODUCCIÓN · pago repartido en domicilio
-- Correr UNA VEZ en el SQL Editor del restaurante. Seguro de re-correr.
--
-- Hasta ahora un domicilio se pagaba de UNA sola forma: o todo en efectivo al recibir, o
-- todo transferido antes de cocinar. En la calle no es así: el cliente tiene $30.000
-- sueltos y transfiere el resto.
--
-- Ahora el reparto se puede decir en dos momentos:
--   · el cliente, al pedir en la carta ("Pago dividido": cuánto pone en efectivo);
--   · el domiciliario, en la puerta, si el cliente cambia de idea.
--
-- El desglose vive en `pagos`, una fila por medio. La regla que manda es la de siempre:
-- la cuenta NO se cierra hasta que toda la plata esté verificada. La transferencia la
-- aprueba caja; el efectivo entra cuando el domiciliario legaliza. Y el turno no cierra
-- mientras alguna de las dos partes siga pendiente.
--
-- Este archivo es un extracto de `../schema.sql`: son las mismas funciones, palabra por
-- palabra. Si prefieres, re-correr el esquema completo hace exactamente lo mismo.

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

create or replace function cambiar_a_transferencia(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform repartir_pago_entrega(p_pedido, 0);
end $$;

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

revoke all on function repartir_pago_entrega(uuid, bigint) from public, anon;
grant execute on function repartir_pago_entrega(uuid, bigint) to authenticated;
