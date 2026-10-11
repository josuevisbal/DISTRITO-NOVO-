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

  if mi_rol() = 'mesero' then
    if v_canal <> 'mesa' then raise exception 'El mesero solo anula pedidos del salón'; end if;
    if exists (select 1 from pagos where pedido_id = p_pedido and estado = 'verificado') then
      raise exception 'Ese pedido ya tiene un pago recibido: lo anula caja';
    end if;
  end if;

  update pedidos set estado = 'anulado', motivo_anulacion = p_motivo, anulado_por = auth.uid()
   where id = p_pedido;

  update pagos set estado = 'rechazado', verificado_por = auth.uid(), verificado_en = now()
   where pedido_id = p_pedido and estado = 'pendiente';

  update comandas set estado = 'cancelada'
   where pedido_id = p_pedido and estado in ('pendiente','preparando');
end $$;

create or replace function cerrar_turno(p_efectivo_contado bigint, p_nota text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_turno uuid; v_base bigint; v_efectivo bigint; v_egreso bigint; v_propinas bigint;
  v_esperado bigint; v_dif bigint; v_arqueo jsonb;
  v_abiertos int; v_por_legalizar int; v_desde timestamptz; v_lista text;
begin
  if mi_rol() not in ('cajero','admin') then raise exception 'Solo caja o administración'; end if;
  v_turno := turno_abierto();
  if v_turno is null then raise exception 'No hay turno abierto'; end if;

  select base_inicial, abierto_en into v_base, v_desde from caja_turnos where id = v_turno;

  select count(*), string_agg('#' || numero, ', ' order by numero) into v_abiertos, v_lista
  from pedidos
  where restaurante_id = mi_restaurante()
    and creado_en >= v_desde
    and estado in ('esperando_pago','pendiente','en_cocina','listo','en_despacho','en_camino');

  if v_abiertos > 0 then
    raise exception 'Quedan % pedido(s) sin cerrar: %. Ciérralos o anúlalos antes de cerrar la caja.', v_abiertos, v_lista;
  end if;

  select count(*), string_agg('#' || p.numero, ', ' order by p.numero) into v_por_legalizar, v_lista
  from pedidos p
  where p.restaurante_id = mi_restaurante()
    and p.estado = 'entregado'
    and exists (select 1 from pagos g where g.pedido_id = p.id and g.estado = 'pendiente');

  if v_por_legalizar > 0 then
    raise exception 'Hay % entrega(s) sin cobrar: %. Recibe el efectivo y verifica las transferencias antes de cerrar la caja.', v_por_legalizar, v_lista;
  end if;

  select coalesce(sum(m.monto) filter (where m.tipo in ('ingreso','legalizacion') and m.medio = 'efectivo'),0),
         coalesce(sum(m.monto) filter (where m.tipo = 'egreso'),0),
         coalesce(sum(m.propina) filter (where m.tipo in ('ingreso','legalizacion')),0)
    into v_efectivo, v_egreso, v_propinas
    from caja_movimientos m
    left join pedidos p on p.id = m.pedido_id
   where m.turno_id = v_turno and (p.id is null or p.estado <> 'anulado');

  v_esperado := v_base + v_efectivo - v_egreso;
  v_dif := p_efectivo_contado - v_esperado;

  select coalesce(jsonb_object_agg(medio, total),'{}'::jsonb) into v_arqueo from (
    select m.medio::text as medio, sum(m.monto) as total
    from caja_movimientos m
    left join pedidos p on p.id = m.pedido_id
    where m.turno_id = v_turno and m.tipo in ('ingreso','legalizacion')
      and (p.id is null or p.estado <> 'anulado')
    group by m.medio
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
    left join pedidos p on p.id = m.pedido_id
    where t.restaurante_id = v_rest
      and m.tipo in ('ingreso','legalizacion')
      and (p.id is null or p.estado <> 'anulado')
      and m.creado_en >= p_desde and m.creado_en < p_hasta
    group by (m.creado_en at time zone p_zona)::date
  ) s;

  return v_res;
end $$;
