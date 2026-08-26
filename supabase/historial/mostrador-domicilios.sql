-- ACTUALIZAR PRODUCCIÓN · caja despacha al mostrador y el domiciliario toma lo suyo
-- Correr UNA VEZ en el SQL Editor del restaurante. Seguro de re-correr.
--
-- Antes caja escogía a mano quién llevaba cada domicilio, y el pedido solo aparecía en el
-- celular de ese domiciliario. En el local no funciona así: caja imprime la cuenta, la
-- pega al pedido y lo deja en el mostrador; los domiciliarios se organizan entre ellos
-- guiándose por la comanda pegada.
--
-- Ahora:
--   · `despachar_domicilio` — caja lo suelta al mostrador (queda 'en_despacho' SIN dueño).
--   · `tomar_domicilio`     — el domiciliario lo busca por el nombre del cliente y lo
--                             marca suyo. Si otro se le adelantó, se le dice.
--   · `quitar_domiciliario` — lo devuelve al mostrador (antes lo devolvía a 'listo').
--   · La RLS del domiciliario se amplía: ve lo suyo y lo que está libre en el mostrador,
--     nunca lo que otro se llevó.
--
-- `asignar_domiciliario` se queda en la base por si alguna instancia todavía la usa, pero
-- la aplicación ya no la llama.

create or replace function despachar_domicilio(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_rest uuid; v_estado estado_pedido; v_canal canal_pedido;
begin
  if mi_rol() not in ('cajero','admin') then raise exception 'Solo caja o administración'; end if;

  select restaurante_id, estado, canal into v_rest, v_estado, v_canal
    from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;
  if v_canal <> 'domicilio' then raise exception 'Ese pedido no es un domicilio'; end if;
  if v_estado = 'en_despacho' then return; end if;   -- ya está en el mostrador
  if v_estado <> 'listo' then raise exception 'Ese pedido todavía no está listo'; end if;

  update pedidos set estado = 'en_despacho', domiciliario_id = null where id = p_pedido;
end $$;

create or replace function tomar_domicilio(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_rest uuid; v_estado estado_pedido; v_domi uuid; v_ok int;
begin
  if mi_rol() <> 'domicilio' then raise exception 'Solo el domiciliario'; end if;

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

create or replace function quitar_domiciliario(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_rest uuid; v_estado estado_pedido; v_domi uuid;
begin
  if mi_rol() not in ('cajero','admin') then raise exception 'Solo caja o administración'; end if;

  select restaurante_id, estado, domiciliario_id into v_rest, v_estado, v_domi
    from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;
  if v_estado = 'en_camino' then
    raise exception 'Ese pedido ya salió con el domiciliario. Si no pudo entregarlo, él lo reporta desde su celular.';
  end if;
  if v_estado <> 'en_despacho' or v_domi is null then
    raise exception 'Ese pedido no tiene domiciliario asignado';
  end if;

  update pedidos set domiciliario_id = null where id = p_pedido;
end $$;

-- El domiciliario ve lo que tomó y lo que está en el mostrador esperando dueño.
drop policy if exists domi_ped on pedidos;
create policy domi_ped on pedidos for select to authenticated
  using (
    mi_rol() = 'domicilio'
    and restaurante_id = mi_restaurante()
    and (domiciliario_id = auth.uid() or (domiciliario_id is null and estado = 'en_despacho'))
  );

revoke all on function despachar_domicilio(uuid) from public, anon;
revoke all on function tomar_domicilio(uuid) from public, anon;
revoke all on function quitar_domiciliario(uuid) from public, anon;
grant execute on function despachar_domicilio(uuid) to authenticated;
grant execute on function tomar_domicilio(uuid) to authenticated;
grant execute on function quitar_domiciliario(uuid) to authenticated;
