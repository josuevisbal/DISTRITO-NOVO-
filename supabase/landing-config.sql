-- =====================================================================
-- PÁGINA DE INICIO EDITABLE · fotos y frases de la landing
-- Correr UNA VEZ en el SQL Editor del proyecto del restaurante.
-- Seguro de re-correr (idempotente).
--
-- El admin edita desde el panel ("Página de inicio"): la foto del héroe
-- (portada_url, ya existía), la foto del local, dirección y horario de la
-- franja de contacto, y las frases de la landing (columna jsonb `landing`:
-- script, titulo_blanco, titulo_naranja, bienvenida, nosotros_titulo,
-- nosotros_texto, dato, dato_texto). Sin valor, la página usa sus textos
-- por defecto — nada se rompe.
-- =====================================================================

alter table restaurantes add column if not exists foto_local_url text;
alter table restaurantes add column if not exists direccion text;
alter table restaurantes add column if not exists horario text;
alter table restaurantes add column if not exists landing jsonb not null default '{}'::jsonb;

-- Video de fondo del héroe (opcional). Si no hay video, manda la foto (portada_url).
alter table restaurantes add column if not exists hero_video_url text;

-- WhatsApp al que llega el aviso de cada pedido nuevo del menú digital.
alter table restaurantes add column if not exists whatsapp_pedidos text;

-- El cliente puede modificar su pedido mientras no lo haya pagado (esperando_pago):
-- se anula limpio y se le devuelven los productos para rearmar el carrito.
create or replace function modificar_pedido_cliente(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_estado estado_pedido; v_items jsonb;
begin
  select id, estado into v_id, v_estado from pedidos where token = p_token;
  if v_id is null then raise exception 'Pedido no encontrado'; end if;

  if v_estado <> 'esperando_pago' then
    raise exception 'Este pedido ya no se puede modificar: escríbenos por WhatsApp';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'producto_id', producto_id,
           'cantidad', cantidad,
           'notas', coalesce(notas, '')
         )), '[]'::jsonb)
    into v_items
  from pedido_items
  where pedido_id = v_id
    and promocion_id is null;

  update pedidos
     set estado = 'anulado',
         motivo_anulacion = 'El cliente lo modificó antes de pagar'
   where id = v_id;

  update pagos set estado = 'rechazado' where pedido_id = v_id and estado = 'pendiente';

  return v_items;
end $$;

revoke all on function modificar_pedido_cliente(uuid) from public;
grant execute on function modificar_pedido_cliente(uuid) to anon, authenticated;
