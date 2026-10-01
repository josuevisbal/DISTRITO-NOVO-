-- ACTUALIZAR PRODUCCIÓN · caja cierra pedidos del local ya pagos y el cierre dice cuáles faltan
-- Correr UNA VEZ en el SQL Editor del restaurante. Seguro de re-correr.
--
-- 1. `entregar_en_local`: un pedido de mesa, recoger o mostrador que se pagó antes de salir
--    de cocina (por ejemplo, para recoger con transferencia) se quedaba "listo" para
--    siempre y no dejaba cerrar el turno. Caja ahora lo marca "Ya se lo llevó" y queda
--    cerrado.
-- 2. `cerrar_turno`: el mensaje de error dice los números de los pedidos que faltan.

create or replace function entregar_en_local(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_rest uuid; v_estado estado_pedido; v_canal canal_pedido;
begin
  if mi_rol() not in ('cajero','admin') then raise exception 'Solo caja o administración'; end if;
  select restaurante_id, estado, canal into v_rest, v_estado, v_canal from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;
  if v_canal not in ('mesa','recoger','mostrador') then raise exception 'Ese pedido no es del local'; end if;
  if v_estado <> 'listo' then raise exception 'Ese pedido todavía no está listo'; end if;
  if exists (select 1 from pagos where pedido_id = p_pedido and estado = 'pendiente')
     or not exists (select 1 from pagos where pedido_id = p_pedido and estado = 'verificado') then
    raise exception 'Ese pedido no está pago: cóbralo primero';
  end if;

  update pedidos set estado = 'cerrado' where id = p_pedido;
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

  -- Nada puede quedar en el aire: pedidos en marcha o por cobrar del turno.
  select count(*), string_agg('#' || numero, ', ' order by numero) into v_abiertos, v_lista
  from pedidos
  where restaurante_id = mi_restaurante()
    and creado_en >= v_desde
    and estado in ('esperando_pago','pendiente','en_cocina','listo','en_despacho','en_camino');

  if v_abiertos > 0 then
    raise exception 'Quedan % pedido(s) sin cerrar: %. Ciérralos o anúlalos antes de cerrar la caja.', v_abiertos, v_lista;
  end if;

  -- Entregas ya hechas que todavía no tienen la plata en caja: el efectivo que trae
  -- el domiciliario y las transferencias que reportó en la puerta. Cerrar el turno con
  -- alguna de estas pendiente sería dar el día por cuadrado debiendo plata.
  select count(*), string_agg('#' || p.numero, ', ' order by p.numero) into v_por_legalizar, v_lista
  from pedidos p
  where p.restaurante_id = mi_restaurante()
    and p.estado = 'entregado'
    and exists (select 1 from pagos g where g.pedido_id = p.id and g.estado = 'pendiente');

  if v_por_legalizar > 0 then
    raise exception 'Hay % entrega(s) sin cobrar: %. Recibe el efectivo y verifica las transferencias antes de cerrar la caja.', v_por_legalizar, v_lista;
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

revoke all on function entregar_en_local(uuid) from public, anon;
grant execute on function entregar_en_local(uuid) to authenticated;
