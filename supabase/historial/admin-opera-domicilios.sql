-- ACTUALIZAR PRODUCCIÓN · administración opera también como domiciliario
-- Correr UNA VEZ en el SQL Editor del restaurante. Seguro de re-correr.
--
-- Caja, cocina y mesero ya aceptaban al admin en la base. Faltaban las funciones del
-- domiciliario: ahora el admin puede tomar un pedido del mostrador (queda a su nombre) y
-- marcar recogido, entregado, pago repartido o "no se pudo entregar" en cualquier entrega
-- de SU restaurante, a nombre del domiciliario que la lleva. El domiciliario sigue
-- operando solo lo suyo. Nadie puede sacar a la calle un pedido sin domiciliario.

create or replace function tomar_domicilio(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_rest uuid; v_estado estado_pedido; v_domi uuid; v_ok int;
begin
  if mi_rol() not in ('domicilio','admin') then raise exception 'Solo el domiciliario'; end if;

  select restaurante_id, estado, domiciliario_id into v_rest, v_estado, v_domi
    from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;
  if v_domi = auth.uid() then return; end if;                    -- ya es suyo
  if v_estado <> 'en_despacho' then raise exception 'Ese pedido no está en el mostrador'; end if;

  update pedidos set domiciliario_id = auth.uid()
   where id = p_pedido and estado = 'en_despacho' and domiciliario_id is null;
  get diagnostics v_ok = row_count;
  if v_ok = 0 then raise exception 'Otro domiciliario acaba de tomar ese pedido'; end if;
end $$;

create or replace function recoger_pedido(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_domi uuid; v_estado estado_pedido; v_rest uuid;
begin
  if mi_rol() not in ('domicilio','admin') then raise exception 'Solo el domiciliario'; end if;
  select domiciliario_id, estado, restaurante_id into v_domi, v_estado, v_rest from pedidos where id = p_pedido;
  -- Administración puede operar cualquier entrega de su restaurante (a nombre del
  -- domiciliario que la lleva); el domiciliario, solo las suyas.
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;
  if v_domi is null then raise exception 'Ese pedido todavía no tiene domiciliario'; end if;
  if v_domi is distinct from auth.uid() and mi_rol() <> 'admin' then
    raise exception 'Ese pedido no es tuyo';
  end if;
  if v_estado <> 'en_despacho' then raise exception 'El pedido no está por recoger'; end if;

  update pedidos set estado = 'en_camino' where id = p_pedido;
end $$;

create or replace function entregar_pedido(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_domi uuid; v_estado estado_pedido; v_medio medio_pago; v_rest uuid;
begin
  if mi_rol() not in ('domicilio','admin') then raise exception 'Solo el domiciliario'; end if;
  select domiciliario_id, estado, medio_pago, restaurante_id into v_domi, v_estado, v_medio, v_rest
    from pedidos where id = p_pedido;
  -- Administración puede operar cualquier entrega de su restaurante (a nombre del
  -- domiciliario que la lleva); el domiciliario, solo las suyas.
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;
  if v_domi is null then raise exception 'Ese pedido todavía no tiene domiciliario'; end if;
  if v_domi is distinct from auth.uid() and mi_rol() <> 'admin' then
    raise exception 'Ese pedido no es tuyo';
  end if;
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
declare v_domi uuid; v_estado estado_pedido; v_transf bigint; v_efec bigint; v_rest uuid;
begin
  if mi_rol() not in ('domicilio','admin') then raise exception 'Solo el domiciliario'; end if;
  if coalesce(p_efectivo, 0) < 0 then raise exception 'El efectivo no puede ser negativo'; end if;

  select domiciliario_id, estado, restaurante_id into v_domi, v_estado, v_rest from pedidos where id = p_pedido;
  -- Administración puede operar cualquier entrega de su restaurante (a nombre del
  -- domiciliario que la lleva); el domiciliario, solo las suyas.
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;
  if v_domi is null then raise exception 'Ese pedido todavía no tiene domiciliario'; end if;
  if v_domi is distinct from auth.uid() and mi_rol() <> 'admin' then
    raise exception 'Ese pedido no es tuyo';
  end if;
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

create or replace function fallo_entrega(p_pedido uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare v_domi uuid; v_estado estado_pedido; v_rest uuid;
begin
  if mi_rol() not in ('domicilio','admin') then raise exception 'Solo el domiciliario'; end if;
  if coalesce(trim(p_motivo),'') = '' then raise exception 'Escribe por qué no se pudo entregar'; end if;
  select domiciliario_id, estado, restaurante_id into v_domi, v_estado, v_rest from pedidos where id = p_pedido;
  -- Administración puede operar cualquier entrega de su restaurante (a nombre del
  -- domiciliario que la lleva); el domiciliario, solo las suyas.
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;
  if v_domi is null then raise exception 'Ese pedido todavía no tiene domiciliario'; end if;
  if v_domi is distinct from auth.uid() and mi_rol() <> 'admin' then
    raise exception 'Ese pedido no es tuyo';
  end if;
  if v_estado not in ('en_camino','en_despacho') then raise exception 'El pedido no está en reparto'; end if;

  update pedidos set estado = 'en_despacho', nota_entrega = p_motivo where id = p_pedido;
end $$;
