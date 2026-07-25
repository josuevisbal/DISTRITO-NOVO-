-- =====================================================================
-- FASE 1 · ROLES: DUEÑO vs ADMINISTRADOR
-- Correr en el SQL Editor en DOS pasos: primero el PASO 1 solo, dale Run,
-- y luego pega y corre el PASO 2. (Postgres exige confirmar el valor nuevo
-- del enum antes de poder usarlo.)
-- =====================================================================

-- ============================== PASO 1 ==============================
alter type rol_usuario add value if not exists 'dueno';

-- ============================== PASO 2 ==============================

-- --- Costos por plato: tabla APARTE para que la RLS los proteja de verdad.
-- (productos es legible por todo el mundo; el costo solo lo ve el dueño.)
create table if not exists producto_costos (
  producto_id uuid primary key references productos(id) on delete cascade,
  costo bigint not null default 0 check (costo >= 0),
  actualizado_en timestamptz not null default now()
);
alter table producto_costos enable row level security;

drop policy if exists costos_dueno on producto_costos;
create policy costos_dueno on producto_costos for all to authenticated
  using (
    mi_rol() = 'dueno'
    and exists (select 1 from productos p where p.id = producto_id and p.restaurante_id = mi_restaurante())
  )
  with check (
    mi_rol() = 'dueno'
    and exists (select 1 from productos p where p.id = producto_id and p.restaurante_id = mi_restaurante())
  );

-- --- Nadie toca al dueño salvo el propio dueño.
-- Solo aplica a sesiones de la app (auth.uid() presente): el SQL Editor y el
-- service role no tienen sesión y pueden administrar en emergencias.
create or replace function _proteger_dueno() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    if tg_op in ('UPDATE','DELETE') and old.rol = 'dueno' and mi_rol() is distinct from 'dueno' then
      raise exception 'Solo el dueño puede modificar la cuenta del dueño';
    end if;
    if tg_op in ('INSERT','UPDATE') and new.rol = 'dueno' and mi_rol() is distinct from 'dueno' then
      raise exception 'Solo el dueño puede nombrar otro dueño';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists tr_proteger_dueno on usuarios;
create trigger tr_proteger_dueno before insert or update or delete on usuarios
for each row execute function _proteger_dueno();

-- --- Políticas: donde pasaba 'admin', ahora también pasa 'dueno'.
drop policy if exists admin_usuarios on usuarios;
create policy admin_usuarios on usuarios for all to authenticated
  using (restaurante_id = mi_restaurante() and mi_rol() in ('admin','dueno'))
  with check (restaurante_id = mi_restaurante() and mi_rol() in ('admin','dueno'));

drop policy if exists staff_ped_upd on pedidos;
create policy staff_ped_upd on pedidos for update to authenticated
  using (restaurante_id = mi_restaurante() and mi_rol() in ('admin','dueno','cajero','mesero','pase'));

drop policy if exists cocina_comandas_upd on comandas;
create policy cocina_comandas_upd on comandas for update to authenticated using (
  exists (select 1 from pedidos p where p.id = pedido_id and p.restaurante_id = mi_restaurante())
  and (mi_rol() in ('admin','dueno','pase') or (mi_rol() = 'cocina' and estacion_id = mi_estacion()))
);

drop policy if exists caja_pagos on pagos;
create policy caja_pagos on pagos for all to authenticated
  using (exists (select 1 from pedidos p where p.id = pedido_id and p.restaurante_id = mi_restaurante())
         and mi_rol() in ('admin','dueno','cajero'));

drop policy if exists caja_turnos_p on caja_turnos;
create policy caja_turnos_p on caja_turnos for all to authenticated
  using (restaurante_id = mi_restaurante() and mi_rol() in ('admin','dueno','cajero'))
  with check (restaurante_id = mi_restaurante() and mi_rol() in ('admin','dueno','cajero'));

drop policy if exists admin_prod on productos;
create policy admin_prod on productos for all to authenticated
  using (restaurante_id = mi_restaurante() and mi_rol() in ('admin','dueno','cocina'))
  with check (restaurante_id = mi_restaurante() and mi_rol() in ('admin','dueno','cocina'));

drop policy if exists admin_cat on categorias;
create policy admin_cat on categorias for all to authenticated
  using (restaurante_id = mi_restaurante() and mi_rol() in ('admin','dueno'))
  with check (restaurante_id = mi_restaurante() and mi_rol() in ('admin','dueno'));

drop policy if exists admin_promo on promociones;
create policy admin_promo on promociones for all to authenticated
  using (restaurante_id = mi_restaurante() and mi_rol() in ('admin','dueno'))
  with check (restaurante_id = mi_restaurante() and mi_rol() in ('admin','dueno'));

drop policy if exists admin_zona on zonas_domicilio;
create policy admin_zona on zonas_domicilio for all to authenticated
  using (restaurante_id = mi_restaurante() and mi_rol() in ('admin','dueno'))
  with check (restaurante_id = mi_restaurante() and mi_rol() in ('admin','dueno'));

-- Storage: las fotos también las administra el dueño.
drop policy if exists productos_admin_insert on storage.objects;
create policy productos_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'productos'
    and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol in ('admin','dueno') and u.activo));

drop policy if exists productos_admin_update on storage.objects;
create policy productos_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'productos'
    and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol in ('admin','dueno') and u.activo));

drop policy if exists productos_admin_delete on storage.objects;
create policy productos_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'productos'
    and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol in ('admin','dueno') and u.activo));

-- --- Funciones: el dueño puede lo mismo que el admin (y más).
create or replace function verificar_transferencia(p_pedido uuid, p_ok boolean, p_motivo text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if mi_rol() not in ('cajero','admin','dueno') then raise exception 'Solo caja o administración'; end if;

  if p_ok then
    update pagos set estado='verificado', verificado_por=auth.uid(), verificado_en=now()
      where pedido_id = p_pedido and medio='transferencia';
    update pedidos set estado='pendiente' where id = p_pedido and estado='esperando_pago';
    perform confirmar_pedido(p_pedido);
  else
    update pagos set estado='rechazado', verificado_por=auth.uid(), verificado_en=now()
      where pedido_id = p_pedido and medio='transferencia';
    update pedidos set estado='anulado', motivo_anulacion = coalesce(p_motivo,'Transferencia no verificada'),
           anulado_por = auth.uid()
      where id = p_pedido;
  end if;
end $$;

create or replace function abrir_turno(p_base bigint) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_turno uuid;
begin
  if mi_rol() not in ('cajero','admin','dueno') then raise exception 'Solo caja o administración'; end if;
  if turno_abierto() is not null then raise exception 'Ya hay un turno abierto'; end if;
  if p_base < 0 then raise exception 'La base no puede ser negativa'; end if;

  insert into caja_turnos (restaurante_id, abierto_por, base_inicial)
  values (mi_restaurante(), auth.uid(), p_base)
  returning id into v_turno;
  return v_turno;
end $$;

create or replace function registrar_cobro(p_pedido uuid, p_medio medio_pago, p_monto bigint default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_turno uuid; v_rest uuid; v_total bigint; v_monto bigint;
begin
  if mi_rol() not in ('cajero','admin','dueno') then raise exception 'Solo caja o administración'; end if;
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

create or replace function confirmar_contraentrega(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_rest uuid; v_estado estado_pedido;
begin
  if mi_rol() not in ('cajero','admin','dueno') then raise exception 'Solo caja o administración'; end if;
  select restaurante_id, estado into v_rest, v_estado from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;
  if v_estado <> 'pendiente' then raise exception 'El pedido ya no está pendiente'; end if;

  perform confirmar_pedido(p_pedido);
end $$;

create or replace function anular_pedido(p_pedido uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare v_rest uuid; v_estado estado_pedido;
begin
  if mi_rol() not in ('cajero','admin','dueno') then raise exception 'Solo caja o administración'; end if;
  if coalesce(trim(p_motivo),'') = '' then raise exception 'La anulación necesita un motivo'; end if;

  select restaurante_id, estado into v_rest, v_estado from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;
  if v_estado = 'cerrado' then raise exception 'Un pedido cerrado no se anula'; end if;

  update pedidos set estado = 'anulado', motivo_anulacion = p_motivo, anulado_por = auth.uid()
   where id = p_pedido;
end $$;

create or replace function cerrar_turno(p_efectivo_contado bigint, p_nota text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_turno uuid; v_base bigint; v_efectivo bigint; v_egreso bigint;
  v_esperado bigint; v_dif bigint; v_arqueo jsonb;
begin
  if mi_rol() not in ('cajero','admin','dueno') then raise exception 'Solo caja o administración'; end if;
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

create or replace function asignar_domiciliario(p_pedido uuid, p_domi uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_rest uuid; v_estado estado_pedido; v_domi_rest uuid; v_domi_rol rol_usuario;
begin
  if mi_rol() not in ('pase','admin','dueno') then raise exception 'Solo pase o administración'; end if;

  select restaurante_id, estado into v_rest, v_estado from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;
  if v_estado <> 'en_despacho' then raise exception 'El pedido no está listo para despacho'; end if;

  select restaurante_id, rol into v_domi_rest, v_domi_rol from usuarios where id = p_domi and activo;
  if v_domi_rest is distinct from mi_restaurante() or v_domi_rol <> 'domiciliario' then
    raise exception 'Domiciliario no válido';
  end if;

  update pedidos set domiciliario_id = p_domi where id = p_pedido;
end $$;

create or replace function legalizar_domiciliario(p_domi uuid) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_turno uuid; v_total bigint := 0; r record;
begin
  if mi_rol() not in ('cajero','admin','dueno') then raise exception 'Solo caja o administración'; end if;
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

create or replace function reporte_ventas(p_dias int default 30)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rest uuid; v_desde timestamptz; v_res jsonb;
  v_total bigint; v_n int; v_ticket bigint;
begin
  if mi_rol() not in ('admin','dueno') then raise exception 'Solo administración'; end if;
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

-- --- RENTABILIDAD · SOLO EL DUEÑO ---
create or replace function actualizar_costo(p_producto uuid, p_costo bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if mi_rol() <> 'dueno' then raise exception 'Solo el dueño'; end if;
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
  if mi_rol() <> 'dueno' then raise exception 'Solo el dueño'; end if;
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
          'producto_id', i2.producto_id,
          'nombre', i2.nombre_snap,
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

revoke all on function actualizar_costo(uuid, bigint) from public, anon;
revoke all on function reporte_rentabilidad(int) from public, anon;
revoke all on function _proteger_dueno() from public, anon, authenticated;
grant execute on function actualizar_costo(uuid, bigint) to authenticated;
grant execute on function reporte_rentabilidad(int) to authenticated;

-- --- Tu usuario pasa a ser el dueño.
update usuarios set rol = 'dueno'
where id = (select id from auth.users where email = 'admin@distrito.test');
