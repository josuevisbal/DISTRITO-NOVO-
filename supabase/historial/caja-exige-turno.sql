-- ACTUALIZAR PRODUCCIÓN · la caja manda: sin turno abierto no entra plata ni pedidos
-- Correr UNA VEZ en el SQL Editor del restaurante. Seguro de re-correr.
--
-- Dos huecos del mismo origen (encontrados en Caribbean Rooftop; esta base los tiene igual):
--
-- 1) verificar_transferencia aprobaba SIN turno abierto y solo anotaba el ingreso
--    "si había turno": la plata entraba a cocina pero no quedaba en ningún arqueo.
--    Un cobro invisible que la caja jamás mostraría. Ahora aprobar EXIGE turno;
--    rechazar sigue libre porque no mueve plata.
--
-- 2) Los pedidos entraban con la caja cerrada: sin turno no hay quién los confirme
--    ni dónde anotar su plata. Ahora un trigger sobre pedidos los rechaza con un
--    mensaje amable. En cuanto el cajero abre turno, todo vuelve solo.
--
-- OJO OPERATIVO: después de correr esto, el restaurante DEBE abrir turno antes de
-- recibir pedidos. Si el cliente entra al menú con la caja cerrada, al confirmar verá:
-- "Todavía no estamos recibiendo pedidos. ¡Vuelve a intentarlo en unos minutos!"

-- ── 1. Sin turno no entran pedidos ───────────────────────────────────────────
-- Va como trigger (y no dentro de crear_pedido) para cubrir cualquier camino de
-- inserción y sobrevivir a futuras versiones de la función.
create or replace function _pedido_exige_turno() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from caja_turnos where restaurante_id = new.restaurante_id and cerrado_en is null
  ) then
    raise exception 'Todavía no estamos recibiendo pedidos. ¡Vuelve a intentarlo en unos minutos!';
  end if;
  return new;
end $$;

drop trigger if exists tr_pedido_exige_turno on pedidos;
create trigger tr_pedido_exige_turno before insert on pedidos
for each row execute function _pedido_exige_turno();

-- ── 2. Aprobar transferencias exige turno ────────────────────────────────────
create or replace function verificar_transferencia(p_pedido uuid, p_ok boolean, p_motivo text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_turno uuid; v_monto bigint; v_rest uuid;
begin
  if mi_rol() not in ('cajero','admin','dueno') then raise exception 'Solo caja o administración'; end if;

  select restaurante_id, monto_exacto into v_rest, v_monto from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;

  if p_ok then
    v_turno := turno_abierto();
    if v_turno is null then raise exception 'Abre un turno antes de verificar transferencias'; end if;

    update pagos set estado='verificado', verificado_por=auth.uid(), verificado_en=now()
      where pedido_id = p_pedido and medio='transferencia';
    update pedidos set estado='pendiente' where id = p_pedido and estado='esperando_pago';
    perform confirmar_pedido(p_pedido);

    insert into caja_movimientos (turno_id, tipo, medio, monto, pedido_id, usuario_id)
    values (v_turno, 'ingreso', 'transferencia', coalesce(v_monto,0), p_pedido, auth.uid());
  else
    update pagos set estado='rechazado', verificado_por=auth.uid(), verificado_en=now()
      where pedido_id = p_pedido and medio='transferencia';
    update pedidos set estado='anulado', motivo_anulacion = coalesce(p_motivo,'Transferencia no verificada'),
           anulado_por = auth.uid()
      where id = p_pedido;
  end if;
end $$;

-- ── CHEQUEO ──────────────────────────────────────────────────────────────────
-- Debe devolver una fila con trigger_puesto = true.
select exists (
  select 1 from pg_trigger where tgname = 'tr_pedido_exige_turno'
) as trigger_puesto;

-- ¿Cuánta plata de transferencias ya se aprobó SIN quedar en ningún arqueo?
-- (Cobros de antes de este arreglo; es plata real que la caja nunca mostró.)
select p.numero, p.total, p.creado_en::date
from pedidos p
where p.medio_pago = 'transferencia'
  and exists (select 1 from pagos g where g.pedido_id = p.id and g.estado = 'verificado')
  and not exists (select 1 from caja_movimientos m where m.pedido_id = p.id)
order by p.creado_en;
