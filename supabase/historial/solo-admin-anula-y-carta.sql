alter table pedidos add column if not exists anulado_en timestamptz;

alter table categorias add column if not exists titulo text;
alter table categorias add column if not exists subtitulo text;
alter table categorias add column if not exists estilo text
  check (estilo in ('lista','mosaico','carrusel','compacta'));

create or replace function anular_pedido(p_pedido uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare v_rest uuid; v_estado estado_pedido; v_canal canal_pedido;
begin
  if mi_rol() is distinct from 'admin' then
    raise exception 'Solo administración anula pedidos';
  end if;
  if coalesce(trim(p_motivo),'') = '' then raise exception 'La anulación necesita un motivo'; end if;

  select restaurante_id, estado, canal into v_rest, v_estado, v_canal from pedidos where id = p_pedido;
  if v_rest is null or v_rest <> mi_restaurante() then raise exception 'Pedido no encontrado'; end if;
  if v_estado = 'cerrado' then raise exception 'Un pedido cerrado no se anula'; end if;
  if v_estado = 'anulado' then return; end if;

  update pedidos set estado = 'anulado', motivo_anulacion = p_motivo, anulado_por = auth.uid(),
         anulado_en = now()
   where id = p_pedido;

  update pagos set estado = 'rechazado', verificado_por = auth.uid(), verificado_en = now()
   where pedido_id = p_pedido and estado = 'pendiente';

  update comandas set estado = 'cancelada'
   where pedido_id = p_pedido and estado in ('pendiente','preparando');
end $$;

drop policy if exists staff_ped on pedidos;
create policy staff_ped on pedidos for select to authenticated
  using (restaurante_id = mi_restaurante() and (estado <> 'anulado' or mi_rol() = 'admin'));

drop policy if exists staff_ped_upd on pedidos;
create policy staff_ped_upd on pedidos for update to authenticated
  using (restaurante_id = mi_restaurante() and mi_rol() in ('admin','cajero','mesero'))
  with check (estado <> 'anulado' or mi_rol() = 'admin');

revoke all on function anular_pedido(uuid, text) from public, anon;
grant execute on function anular_pedido(uuid, text) to authenticated;
