-- =====================================================================
-- CIERRE DE CAJA · nada puede quedar abierto
-- Correr UNA VEZ en el SQL Editor del proyecto del restaurante.
-- Seguro de re-correr (idempotente).
--
-- El turno no se cierra si quedan pedidos del día sin resolver (en
-- cocina, por despachar o por cobrar) ni si hay efectivo de
-- domiciliarios sin legalizar. Si no, la plata de hoy se cobraría
-- mañana y el arqueo no cuadraría con lo que pasó en el turno.
-- Para cerrar, el cajero primero cobra o anula lo que quede.
-- =====================================================================

create or replace function cerrar_turno(p_efectivo_contado bigint, p_nota text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_turno uuid; v_base bigint; v_efectivo bigint; v_egreso bigint;
  v_esperado bigint; v_dif bigint; v_arqueo jsonb;
  v_abiertos int; v_por_legalizar int; v_desde timestamptz;
begin
  if mi_rol() not in ('cajero','admin','dueno') then raise exception 'Solo caja o administración'; end if;
  v_turno := turno_abierto();
  if v_turno is null then raise exception 'No hay turno abierto'; end if;

  select base_inicial, abierto_en into v_base, v_desde from caja_turnos where id = v_turno;

  -- Nada puede quedar en el aire: pedidos en marcha o por cobrar del turno.
  select count(*) into v_abiertos
  from pedidos
  where restaurante_id = mi_restaurante()
    and creado_en >= v_desde
    and estado in ('esperando_pago','pendiente','en_cocina','listo','en_despacho','en_camino');

  if v_abiertos > 0 then
    raise exception 'Quedan % pedido(s) sin cerrar (en cocina, por despachar o por cobrar). Ciérralos o anúlalos antes de cerrar la caja.', v_abiertos;
  end if;

  -- Efectivo de domiciliarios que aún no entró a la caja.
  select count(*) into v_por_legalizar
  from pedidos
  where restaurante_id = mi_restaurante()
    and estado = 'entregado' and medio_pago = 'efectivo';

  if v_por_legalizar > 0 then
    raise exception 'Hay % entrega(s) en efectivo sin legalizar. Recibe esa plata antes de cerrar la caja.', v_por_legalizar;
  end if;

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
