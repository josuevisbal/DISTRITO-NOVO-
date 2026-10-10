-- ACTUALIZAR PRODUCCIÓN · caja puede tomar domicilios en efectivo otra vez
-- Correr UNA VEZ en el SQL Editor del restaurante. Seguro de re-correr.
--
-- Desde que el domicilio en efectivo entra derecho a cocina, `crear_pedido` ya lo
-- confirma. `crear_pedido_interno` lo volvía a confirmar y fallaba con "No hay nada nuevo
-- por confirmar en esta cuenta". Ahora solo confirma lo que no salió ya a cocina.

create or replace function crear_pedido_interno(p_payload jsonb, p_confirmar boolean default true)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_slug text; v_res jsonb; v_id uuid;
begin
  if mi_rol() not in ('mesero','cajero','admin') then
    raise exception 'Solo mesero, caja o administración';
  end if;

  select slug into v_slug from restaurantes where id = mi_restaurante() and activo;
  if v_slug is null then raise exception 'Restaurante no encontrado'; end if;

  v_res := crear_pedido(v_slug, p_payload);
  v_id := (v_res->>'id')::uuid;

  -- El domicilio en efectivo ya sale de `crear_pedido` derecho a cocina: confirmarlo otra
  -- vez fallaría con "no hay nada nuevo por confirmar".
  if p_confirmar and coalesce(v_res->>'estado', '') <> 'en_cocina' then
    perform confirmar_pedido(v_id);
    v_res := jsonb_set(v_res, '{estado}', '"en_cocina"'::jsonb);
  end if;

  return v_res;
end $$;
