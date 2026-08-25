-- ACTUALIZAR PRODUCCIÓN · propinas día por día para administración
-- Correr UNA VEZ en el SQL Editor del restaurante. Seguro de re-correr.
--
-- Reportes mostraba la venta del mes pero no la propina, que va aparte del total y la
-- digita caja al cobrar. Sin una lista día por día, repartirla era volver a sumar
-- cuenta por cuenta.
--
-- `propinas_por_dia` la saca de `caja_movimientos`, que es donde queda marcada, y agrupa
-- por el día del COBRO: la plata cuenta el día en que entró a la caja, no el día en que
-- se tomó el pedido (un domicilio entregado hoy y cobrado mañana es propina de mañana).
-- Solo administración: es la misma puerta de `reporte_rango`.

create or replace function propinas_por_dia(p_desde timestamptz, p_hasta timestamptz, p_zona text default 'America/Bogota')
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_rest uuid; v_res jsonb;
begin
  if mi_rol() <> 'admin' then raise exception 'Solo administración'; end if;
  v_rest := mi_restaurante();

  select coalesce(jsonb_agg(x order by x->>'dia'), '[]'::jsonb) into v_res from (
    select jsonb_build_object(
      'dia',      to_char((m.creado_en at time zone p_zona)::date, 'YYYY-MM-DD'),
      'propina',  coalesce(sum(m.propina), 0),
      'cuentas',  count(*) filter (where m.propina > 0),
      'cobrado',  coalesce(sum(m.monto - m.propina), 0)
    ) x
    from caja_movimientos m
    join caja_turnos t on t.id = m.turno_id
    where t.restaurante_id = v_rest
      and m.tipo in ('ingreso','legalizacion')
      and m.creado_en >= p_desde and m.creado_en < p_hasta
    group by (m.creado_en at time zone p_zona)::date
  ) s;

  return v_res;
end $$;

revoke all on function propinas_por_dia(timestamptz, timestamptz, text) from public, anon;
grant execute on function propinas_por_dia(timestamptz, timestamptz, text) to authenticated;
