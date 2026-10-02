-- ACTUALIZAR PRODUCCIÓN · editar y anular pedidos desde mesero y caja
-- Correr UNA VEZ en el SQL Editor del restaurante. Seguro de re-correr.
--
-- 1. `editar_pedido(pedido, items)`: mesero (solo salón), caja o admin cambian
--    cantidades, quitan o suman productos y cambian notas. Precios desde la base. Lo
--    nuevo entra como ronda con su comanda; una comanda sin platos se cancela.
-- 2. `anular_pedido`: ahora también el mesero (solo salón y sin plata recibida), y las
--    comandas del pedido anulado se cancelan para que cocina deje de verlo.
-- 3. Las comandas canceladas ya no impiden que el pedido quede "listo".

create or replace function _comanda_listo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'listo' and (old.estado is distinct from 'listo') then
    new.listo_en := now();
    if not exists (
      select 1 from comandas
      where pedido_id = new.pedido_id and id <> new.id and estado not in ('listo','cancelada')
    ) then
      update pedidos set estado = 'listo' where id = new.pedido_id and estado = 'en_cocina';
    end if;
  end if;
  if new.estado = 'preparando' and old.estado = 'pendiente' then
    new.iniciado_en := now();
  end if;
  return new;
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
    select 1 from comandas where pedido_id = p_pedido and estado not in ('listo','cancelada')
  ) then
    update pedidos set estado = 'listo' where id = p_pedido and estado = 'en_cocina';
  end if;
end $$;

create or replace function anular_pedido(p_pedido uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare v_rest uuid; v_estado estado_pedido; v_canal canal_pedido;
begin
  if mi_rol() not in ('mesero','cajero','admin') then
    raise exception 'Solo mesero, caja o administración';
  end if;
  if coalesce(trim(p_motivo),'') = '' then raise exception 'La anulación necesita un motivo'; end if;

  select restaurante_id, estado, canal into v_rest, v_estado, v_canal from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;
  if v_estado = 'cerrado' then raise exception 'Un pedido cerrado no se anula'; end if;
  if v_estado = 'anulado' then return; end if;

  -- El mesero anula lo del salón que todavía no tiene plata recibida. Lo que ya se
  -- cobró, o lo que no es de mesa, lo anula caja.
  if mi_rol() = 'mesero' then
    if v_canal <> 'mesa' then raise exception 'El mesero solo anula pedidos del salón'; end if;
    if exists (select 1 from pagos where pedido_id = p_pedido and estado = 'verificado') then
      raise exception 'Ese pedido ya tiene un pago recibido: lo anula caja';
    end if;
  end if;

  update pedidos set estado = 'anulado', motivo_anulacion = p_motivo, anulado_por = auth.uid()
   where id = p_pedido;

  -- Cocina deja de verlo: lo que no se ha terminado se cancela.
  update comandas set estado = 'cancelada'
   where pedido_id = p_pedido and estado in ('pendiente','preparando');
end $$;

create or replace function editar_pedido(p_pedido uuid, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rest uuid; v_estado estado_pedido; v_canal canal_pedido; v_num bigint;
  v_ronda_libre int; v_ronda_nueva int; r record; v_fila record; v_quitar int;
  v_agregar jsonb := '[]'::jsonb; v_conf timestamptz := now(); v_max int; v_total bigint;
begin
  if mi_rol() not in ('mesero','cajero','admin') then
    raise exception 'Solo mesero, caja o administración';
  end if;

  select restaurante_id, estado, canal, numero into v_rest, v_estado, v_canal, v_num
    from pedidos where id = p_pedido for update;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;
  if mi_rol() = 'mesero' and v_canal <> 'mesa' then
    raise exception 'El mesero solo edita pedidos del salón';
  end if;
  if v_estado not in ('pendiente','en_cocina','listo') then
    raise exception 'Ese pedido ya no se puede editar';
  end if;
  if exists (select 1 from pagos where pedido_id = p_pedido and estado = 'verificado') then
    raise exception 'Ese pedido ya tiene un pago recibido: no se puede editar';
  end if;
  if not exists (
       select 1 from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) it
        where coalesce((it->>'cantidad')::int, 0) > 0)
     and not exists (
       select 1 from pedido_items where pedido_id = p_pedido and promocion_id is not null) then
    raise exception 'El pedido quedaría vacío: si no va, anúlalo';
  end if;

  -- La ronda que todavía no tiene comanda (sin confirmar): lo nuevo va ahí.
  select max(pi.ronda) into v_ronda_libre
    from pedido_items pi
   where pi.pedido_id = p_pedido
     and not exists (select 1 from comandas c where c.pedido_id = p_pedido and c.ronda = pi.ronda);

  for r in
    select coalesce(d.producto_id, a.producto_id) as producto_id,
           coalesce(d.cantidad, 0) as deseado,
           coalesce(a.cantidad, 0) as actual,
           d.notas,
           d.producto_id is not null as viene
      from (select (it->>'producto_id')::uuid as producto_id,
                   sum(greatest(coalesce((it->>'cantidad')::int, 0), 0)) as cantidad,
                   max(nullif(trim(it->>'notas'), '')) as notas
              from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) it
             group by 1) d
      full join (select producto_id, sum(cantidad) as cantidad
                   from pedido_items
                  where pedido_id = p_pedido and promocion_id is null
                  group by 1) a
        on a.producto_id = d.producto_id
  loop
    if r.deseado < r.actual then
      v_quitar := r.actual - r.deseado;
      for v_fila in
        select id, cantidad from pedido_items
         where pedido_id = p_pedido and producto_id = r.producto_id and promocion_id is null
         order by ronda desc, id
      loop
        exit when v_quitar <= 0;
        if v_fila.cantidad <= v_quitar then
          delete from pedido_items where id = v_fila.id;
          v_quitar := v_quitar - v_fila.cantidad;
        else
          update pedido_items set cantidad = cantidad - v_quitar where id = v_fila.id;
          v_quitar := 0;
        end if;
      end loop;
    elsif r.deseado > r.actual then
      v_agregar := v_agregar || jsonb_build_object(
        'producto_id', r.producto_id, 'cantidad', r.deseado - r.actual,
        'notas', coalesce(r.notas, ''));
    end if;

    if r.viene and r.deseado > 0 then
      update pedido_items set notas = r.notas
       where pedido_id = p_pedido and producto_id = r.producto_id and promocion_id is null
         and notas is distinct from r.notas;
    end if;
  end loop;

  if jsonb_array_length(v_agregar) > 0 then
    if exists (
      select 1 from jsonb_array_elements(v_agregar) it
      left join productos pr on pr.id = (it->>'producto_id')::uuid
                            and pr.restaurante_id = v_rest and pr.activo and pr.disponible
       where pr.id is null
    ) then
      raise exception 'Uno de los productos que sumaste está agotado';
    end if;

    if v_ronda_libre is not null then
      perform _insertar_items_pedido(p_pedido, v_rest, jsonb_build_object('items', v_agregar), v_ronda_libre);
    else
      select greatest(
               coalesce((select max(ronda) from pedido_items where pedido_id = p_pedido), 0),
               coalesce((select max(ronda) from comandas where pedido_id = p_pedido), 0)) + 1
        into v_ronda_nueva;
      perform _insertar_items_pedido(p_pedido, v_rest, jsonb_build_object('items', v_agregar), v_ronda_nueva);

      -- Lo que suma el equipo entra ya aprobado y de una a todas sus estaciones.
      insert into comandas (pedido_id, estacion_id, minutos, disparo_en, estado, ronda)
      select p_pedido, estacion_id, max(minutos_snap), v_conf, 'pendiente', v_ronda_nueva
        from pedido_items where pedido_id = p_pedido and ronda = v_ronda_nueva
       group by estacion_id;

      select max(minutos_snap) into v_max from pedido_items
       where pedido_id = p_pedido and ronda = v_ronda_nueva;
      update pedidos
         set estado = 'en_cocina', servido_en = null,
             objetivo_en = greatest(coalesce(objetivo_en, v_conf), v_conf + make_interval(mins => coalesce(v_max, 0)))
       where id = p_pedido and estado in ('en_cocina','listo');
    end if;
  end if;

  -- Una comanda sin platos ya no tiene nada que cocinar.
  update comandas c set estado = 'cancelada'
   where c.pedido_id = p_pedido and c.estado in ('pendiente','preparando')
     and not exists (select 1 from pedido_items pi
                      where pi.pedido_id = p_pedido and pi.ronda = c.ronda
                        and pi.estacion_id = c.estacion_id);

  -- Si con lo que se quitó ya no queda nada en cocina, el pedido está listo.
  if exists (select 1 from comandas where pedido_id = p_pedido)
     and not exists (select 1 from comandas where pedido_id = p_pedido
                        and estado not in ('listo','cancelada')) then
    update pedidos set estado = 'listo' where id = p_pedido and estado = 'en_cocina';
  end if;

  -- Si la ronda que esperaba al mesero se quedó vacía, ya no hay nada que confirmar.
  if not exists (select 1 from pedido_items pi where pi.pedido_id = p_pedido
                    and not exists (select 1 from comandas c
                                     where c.pedido_id = p_pedido and c.ronda = pi.ronda)) then
    update pedidos set ronda_pendiente_en = null where id = p_pedido;
  end if;

  v_total := _recalcular_totales(p_pedido);
  return jsonb_build_object('numero', v_num, 'total', v_total);
end $$;

revoke all on function editar_pedido(uuid, jsonb) from public, anon;
grant execute on function editar_pedido(uuid, jsonb) to authenticated;
revoke all on function anular_pedido(uuid, text) from public, anon;
grant execute on function anular_pedido(uuid, text) to authenticated;
