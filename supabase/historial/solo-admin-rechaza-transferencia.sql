create or replace function verificar_transferencia(p_pedido uuid, p_ok boolean, p_motivo text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_turno uuid; v_monto bigint; v_rest uuid; v_estado estado_pedido; v_pago uuid;
begin
  if mi_rol() not in ('cajero','admin') then raise exception 'Solo caja o administración'; end if;
  if not p_ok and mi_rol() is distinct from 'admin' then
    raise exception 'Solo administración rechaza transferencias';
  end if;

  select restaurante_id, coalesce(monto_exacto, total), estado
    into v_rest, v_monto, v_estado from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;

  select id, monto into v_pago, v_monto
    from pagos
   where pedido_id = p_pedido and medio = 'transferencia' and estado = 'pendiente'
   order by creado_en limit 1;
  if v_pago is null then
    select coalesce(monto_exacto, total) into v_monto from pedidos where id = p_pedido;
  end if;

  if p_ok then
    v_turno := turno_abierto();
    if v_turno is null then raise exception 'Abre un turno antes de verificar transferencias'; end if;

    if v_pago is not null then
      update pagos set estado='verificado', verificado_por=auth.uid(), verificado_en=now()
        where id = v_pago;
    else
      update pagos set estado='verificado', verificado_por=auth.uid(), verificado_en=now()
        where pedido_id = p_pedido and medio='transferencia';
    end if;

    insert into caja_movimientos (turno_id, tipo, medio, monto, pedido_id, usuario_id)
    values (v_turno, 'ingreso', 'transferencia', coalesce(v_monto,0), p_pedido, auth.uid());

    if v_estado = 'esperando_pago' then
      update pedidos set estado = 'pendiente' where id = p_pedido;
      perform confirmar_pedido(p_pedido);
    elsif not exists (select 1 from pagos where pedido_id = p_pedido and estado = 'pendiente') then
      update pedidos set estado = 'cerrado' where id = p_pedido and estado <> 'anulado';
    end if;
  else
    if v_pago is not null then
      update pagos set estado='rechazado', verificado_por=auth.uid(), verificado_en=now()
        where id = v_pago;
    else
      update pagos set estado='rechazado', verificado_por=auth.uid(), verificado_en=now()
        where pedido_id = p_pedido and medio='transferencia';
    end if;

    if v_estado = 'entregado' then
      update pedidos set nota_entrega = coalesce(p_motivo, 'La transferencia no llegó')
       where id = p_pedido;
    else
      update pedidos set estado='anulado', motivo_anulacion = coalesce(p_motivo,'Transferencia no verificada'),
             anulado_por = auth.uid(), anulado_en = now()
        where id = p_pedido;
    end if;
  end if;
end $$;

revoke all on function verificar_transferencia(uuid, boolean, text) from public, anon;
grant execute on function verificar_transferencia(uuid, boolean, text) to authenticated;
