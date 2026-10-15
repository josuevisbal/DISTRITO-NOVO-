alter table restaurantes add column if not exists hora_corte int not null default 6;

create table if not exists gastos (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  fecha date not null,
  monto bigint not null check (monto > 0),
  categoria text not null,
  descripcion text,
  creado_por uuid references usuarios(id) on delete set null,
  creado_en timestamptz not null default now()
);
create index if not exists ix_gastos_fecha on gastos(restaurante_id, fecha);

create or replace function dia_jornada(p_ts timestamptz, p_zona text, p_corte int)
returns date language sql stable as $$
  select ((p_ts at time zone p_zona) - make_interval(hours => p_corte))::date
$$;

create or replace function propinas_por_dia(p_desde timestamptz, p_hasta timestamptz, p_zona text default 'America/Bogota')
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_rest uuid; v_res jsonb; v_corte int;
begin
  if mi_rol() <> 'admin' then raise exception 'Solo administración'; end if;
  v_rest := mi_restaurante();
  select hora_corte into v_corte from restaurantes where id = v_rest;

  select coalesce(jsonb_agg(x order by x->>'dia'), '[]'::jsonb) into v_res from (
    select jsonb_build_object(
      'dia',      to_char(dia_jornada(m.creado_en, p_zona, v_corte), 'YYYY-MM-DD'),
      'propina',  coalesce(sum(m.propina), 0),
      'cuentas',  count(*) filter (where m.propina > 0),
      'cobrado',  coalesce(sum(m.monto - m.propina), 0)
    ) x
    from caja_movimientos m
    join caja_turnos t on t.id = m.turno_id
    left join pedidos p on p.id = m.pedido_id
    where t.restaurante_id = v_rest
      and m.tipo in ('ingreso','legalizacion')
      and (p.id is null or p.estado <> 'anulado')
      and m.creado_en >= p_desde and m.creado_en < p_hasta
    group by dia_jornada(m.creado_en, p_zona, v_corte)
  ) s;

  return v_res;
end $$;

create or replace function reporte_rango(p_desde timestamptz, p_hasta timestamptz, p_zona text default 'America/Bogota')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rest uuid; v_res jsonb; v_total bigint; v_n int; v_corte int;
begin
  if mi_rol() <> 'admin' then raise exception 'Solo administración'; end if;
  v_rest := mi_restaurante();
  select hora_corte into v_corte from restaurantes where id = v_rest;

  select coalesce(sum(total),0), count(*) into v_total, v_n
    from pedidos
    where restaurante_id = v_rest and estado <> 'anulado'
      and creado_en >= p_desde and creado_en < p_hasta;

  select jsonb_build_object(
    'total_ventas', v_total,
    'num_pedidos', v_n,
    'ticket_promedio', case when v_n > 0 then v_total / v_n else 0 end,
    'por_dia', coalesce((select jsonb_agg(x order by (x->>'dia')::int) from (
        select jsonb_build_object('dia', extract(day from dia_jornada(creado_en, p_zona, v_corte))::int,
                                  'total', sum(total)) x
        from pedidos
        where restaurante_id = v_rest and estado <> 'anulado'
          and creado_en >= p_desde and creado_en < p_hasta
        group by extract(day from dia_jornada(creado_en, p_zona, v_corte))) s), '[]'::jsonb),
    'por_estacion', coalesce((select jsonb_agg(x order by x->>'orden') from (
        select jsonb_build_object('nombre', e.nombre, 'color', e.color, 'orden', e.orden,
                                  'total', coalesce(sum(i.precio_snap * i.cantidad),0)) x
        from estaciones e
        left join pedido_items i on i.estacion_id = e.id
          and exists (select 1 from pedidos p where p.id = i.pedido_id
                        and p.restaurante_id = v_rest and p.estado <> 'anulado'
                        and p.creado_en >= p_desde and p.creado_en < p_hasta)
        where e.restaurante_id = v_rest and e.activa
        group by e.nombre, e.color, e.orden) s), '[]'::jsonb),
    'top_productos', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('nombre', i.nombre_snap, 'cantidad', sum(i.cantidad),
                                  'ventas', sum(i.precio_snap * i.cantidad)) x
        from pedido_items i join pedidos p on p.id = i.pedido_id
        where p.restaurante_id = v_rest and p.estado <> 'anulado'
          and p.creado_en >= p_desde and p.creado_en < p_hasta
        group by i.nombre_snap
        order by sum(i.cantidad) desc limit 8) s), '[]'::jsonb)
  ) into v_res;

  return v_res;
end $$;

create or replace function resumen_rentabilidad(p_desde date, p_hasta date, p_zona text default 'America/Bogota')
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_rest uuid; v_corte int; v_ini timestamptz; v_fin timestamptz; v_res jsonb;
begin
  if mi_rol() is distinct from 'admin' then raise exception 'Solo administración'; end if;
  v_rest := mi_restaurante();
  select hora_corte into v_corte from restaurantes where id = v_rest;
  v_ini := (p_desde::timestamp + make_interval(hours => v_corte)) at time zone p_zona;
  v_fin := (p_hasta::timestamp + make_interval(hours => v_corte)) at time zone p_zona;

  with ventas as (
    select dia_jornada(p.creado_en, p_zona, v_corte) as dia, sum(p.total) as ventas, count(*) as pedidos
      from pedidos p
     where p.restaurante_id = v_rest and p.estado <> 'anulado'
       and p.creado_en >= v_ini and p.creado_en < v_fin
     group by 1
  ), costos as (
    select dia_jornada(p.creado_en, p_zona, v_corte) as dia,
           sum(coalesce(c.costo, 0) * i.cantidad) as costo
      from pedido_items i
      join pedidos p on p.id = i.pedido_id
      left join producto_costos c on c.producto_id = i.producto_id
     where p.restaurante_id = v_rest and p.estado <> 'anulado'
       and p.creado_en >= v_ini and p.creado_en < v_fin
     group by 1
  ), gast as (
    select fecha as dia, sum(monto) as gastos
      from gastos
     where restaurante_id = v_rest and fecha >= p_desde and fecha < p_hasta
     group by 1
  ), dias as (
    select dia from ventas union select dia from gast union select dia from costos
  )
  select jsonb_build_object(
    'hora_corte', v_corte,
    'ventas', coalesce((select sum(ventas) from ventas), 0),
    'pedidos', coalesce((select sum(pedidos) from ventas), 0),
    'costo', coalesce((select sum(costo) from costos), 0),
    'gastos', coalesce((select sum(gastos) from gast), 0),
    'sin_costo', (
      select count(distinct i.producto_id)
        from pedido_items i join pedidos p on p.id = i.pedido_id
        left join producto_costos c on c.producto_id = i.producto_id
       where p.restaurante_id = v_rest and p.estado <> 'anulado'
         and p.creado_en >= v_ini and p.creado_en < v_fin
         and coalesce(c.costo, 0) = 0),
    'por_dia', coalesce((
      select jsonb_agg(jsonb_build_object(
               'dia', d.dia,
               'ventas', coalesce(v.ventas, 0),
               'costo', coalesce(c.costo, 0),
               'gastos', coalesce(g.gastos, 0)) order by d.dia)
        from dias d
        left join ventas v on v.dia = d.dia
        left join costos c on c.dia = d.dia
        left join gast g on g.dia = d.dia), '[]'::jsonb),
    'por_categoria', coalesce((
      select jsonb_agg(x order by (x->>'monto')::bigint desc) from (
        select jsonb_build_object('categoria', categoria, 'monto', sum(monto), 'n', count(*)) x
          from gastos
         where restaurante_id = v_rest and fecha >= p_desde and fecha < p_hasta
         group by categoria) s), '[]'::jsonb)
  ) into v_res;

  return v_res;
end $$;

alter table gastos enable row level security;
drop policy if exists gastos_admin on gastos;
create policy gastos_admin on gastos for all to authenticated
  using (restaurante_id = mi_restaurante() and mi_rol() = 'admin')
  with check (restaurante_id = mi_restaurante() and mi_rol() = 'admin');
grant select, insert, update, delete on gastos to authenticated;

revoke all on function resumen_rentabilidad(date, date, text) from public, anon;
grant execute on function resumen_rentabilidad(date, date, text) to authenticated;
grant execute on function reporte_rango(timestamptz, timestamptz, text) to authenticated;
grant execute on function propinas_por_dia(timestamptz, timestamptz, text) to authenticated;
