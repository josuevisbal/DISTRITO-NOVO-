-- ACTUALIZAR PRODUCCIÓN · caja puede quitarle el domicilio a un domiciliario
-- Correr UNA VEZ en el SQL Editor del restaurante. Seguro de re-correr.
--
-- Caja podía asignar y reasignar, pero no dejar el pedido sin nadie: si el domiciliario
-- no llegó o se le asignó por error, el pedido quedaba amarrado a él.
--
-- `quitar_domiciliario` lo devuelve a la fila de por despachar. Solo mientras NO lo haya
-- recogido: si ya salió con la comida, el camino sigue siendo que él reporte desde su
-- celular que no pudo entregarla.

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

revoke all on function quitar_domiciliario(uuid) from public, anon;
grant execute on function quitar_domiciliario(uuid) to authenticated;
