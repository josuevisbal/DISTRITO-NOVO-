-- =====================================================================
-- ACTUALIZAR · pone al día un proyecto que corrió un schema.sql viejo.
-- Agrega columnas y funciones nuevas (caja, domiciliario, reportes) que
-- faltaban. Es seguro correrlo completo: todo es 'if not exists' o
-- 'create or replace'. Correr en el SQL Editor.
-- =====================================================================

-- ---------- Columnas nuevas ----------
alter table restaurantes add column if not exists portada_url text;
alter table productos     add column if not exists destacado boolean not null default false;
alter table pedidos       add column if not exists nota_entrega text;

-- ---------- Caja ----------
create or replace function turno_abierto() returns uuid
language sql stable security definer set search_path = public as $$
  select t.id from caja_turnos t
  where t.restaurante_id = mi_restaurante() and t.cerrado_en is null
  order by t.abierto_en desc limit 1
$$;

create or replace function abrir_turno(p_base bigint) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_turno uuid;
begin
  if mi_rol() not in ('cajero','admin') then raise exception 'Solo caja o administración'; end if;
  if turno_abierto() is not null then raise exception 'Ya hay un turno abierto'; end if;
  if p_base < 0 then raise exception 'La base no puede ser negativa'; end if;
  insert into caja_turnos (restaurante_id, abierto_por, base_inicial)
  values (mi_restaurante(), auth.uid(), p_base) returning id into v_turno;
  return v_turno;
end $$;

create or replace function registrar_cobro(p_pedido uuid, p_medio medio_pago, p_monto bigint default null)
returns void language plpgsql security definer set search_path = public as $$
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

create or replace function cerrar_turno(p_efectivo_contado bigint, p_nota text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
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
    into v_efectivo, v_egreso from caja_movimientos where turno_id = v_turno;
  v_esperado := v_base + v_efectivo - v_egreso;
  v_dif := p_efectivo_contado - v_esperado;
  select coalesce(jsonb_object_agg(medio, total),'{}'::jsonb) into v_arqueo from (
    select medio::text as medio, sum(monto) as total from caja_movimientos
    where turno_id = v_turno and tipo in ('ingreso','legalizacion') group by medio) s;
  update caja_turnos set cerrado_por = auth.uid(), cerrado_en = now(),
         efectivo_contado = p_efectivo_contado, diferencia = v_dif, nota = p_nota
   where id = v_turno;
  return jsonb_build_object('base_inicial', v_base, 'efectivo_esperado', v_esperado,
    'efectivo_contado', p_efectivo_contado, 'diferencia', v_dif, 'por_medio', v_arqueo);
end $$;

-- ---------- Domiciliario ----------
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

create or replace function entregar_pedido(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_domi uuid; v_estado estado_pedido; v_medio medio_pago;
begin
  if mi_rol() <> 'domiciliario' then raise exception 'Solo el domiciliario'; end if;
  select domiciliario_id, estado, medio_pago into v_domi, v_estado, v_medio from pedidos where id = p_pedido;
  if v_domi is distinct from auth.uid() then raise exception 'Ese pedido no es tuyo'; end if;
  if v_estado <> 'en_camino' then raise exception 'El pedido no está en camino'; end if;
  update pedidos set estado = case when v_medio = 'efectivo' then 'entregado'::estado_pedido
                                   else 'cerrado'::estado_pedido end,
         entregado_en = now() where id = p_pedido;
end $$;

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

create or replace function legalizar_domiciliario(p_domi uuid) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_turno uuid; v_total bigint := 0; r record;
begin
  if mi_rol() not in ('cajero','admin') then raise exception 'Solo caja o administración'; end if;
  v_turno := turno_abierto();
  if v_turno is null then raise exception 'Abre un turno antes de legalizar'; end if;
  for r in select id, total from pedidos
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

-- ---------- Reportes ----------
create or replace function reporte_ventas(p_dias int default 30)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_rest uuid; v_desde timestamptz; v_res jsonb; v_total bigint; v_n int; v_ticket bigint;
begin
  if mi_rol() <> 'admin' then raise exception 'Solo administración'; end if;
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

-- ---------- Permisos de las funciones nuevas ----------
revoke all on function turno_abierto() from public, anon;
revoke all on function abrir_turno(bigint) from public, anon;
revoke all on function registrar_cobro(uuid, medio_pago, bigint) from public, anon;
revoke all on function confirmar_contraentrega(uuid) from public, anon;
revoke all on function anular_pedido(uuid, text) from public, anon;
revoke all on function cerrar_turno(bigint, text) from public, anon;
revoke all on function asignar_domiciliario(uuid, uuid) from public, anon;
revoke all on function recoger_pedido(uuid) from public, anon;
revoke all on function entregar_pedido(uuid) from public, anon;
revoke all on function fallo_entrega(uuid, text) from public, anon;
revoke all on function legalizar_domiciliario(uuid) from public, anon;
revoke all on function reporte_ventas(int) from public, anon;
grant execute on function turno_abierto() to authenticated;
grant execute on function abrir_turno(bigint) to authenticated;
grant execute on function registrar_cobro(uuid, medio_pago, bigint) to authenticated;
grant execute on function confirmar_contraentrega(uuid) to authenticated;
grant execute on function anular_pedido(uuid, text) to authenticated;
grant execute on function cerrar_turno(bigint, text) to authenticated;
grant execute on function asignar_domiciliario(uuid, uuid) to authenticated;
grant execute on function recoger_pedido(uuid) to authenticated;
grant execute on function entregar_pedido(uuid) to authenticated;
grant execute on function fallo_entrega(uuid, text) to authenticated;
grant execute on function legalizar_domiciliario(uuid) to authenticated;
grant execute on function reporte_ventas(int) to authenticated;

-- ---------- El comensal ve los renglones de su pedido con el token ----------
drop policy if exists pub_items_token on pedido_items;
create policy pub_items_token on pedido_items for select
  using (exists (select 1 from pedidos p where p.id = pedido_id
    and p.token::text = current_setting('request.headers', true)::json->>'x-pedido-token'));
