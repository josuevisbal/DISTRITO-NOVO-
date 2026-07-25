-- =====================================================================
-- ACTUALIZAR PRODUCCIÓN · Equipo y reportes por mes
-- Correr UNA VEZ en el SQL Editor del proyecto del restaurante, después
-- de roles-dueno.sql. Seguro de re-correr.
-- =====================================================================

-- Correo visible en el panel de Equipo (auth.users no es consultable por el cliente).
alter table usuarios add column if not exists correo text;
update usuarios u set correo = a.email from auth.users a where a.id = u.id and u.correo is null;

-- Crear un usuario del equipo: cuenta de acceso + fila en usuarios, en una sola operación.
-- admin crea roles de operación; SOLO el dueño crea admins (o otro dueño).
create or replace function crear_usuario(
  p_nombre text, p_correo text, p_clave text, p_rol rol_usuario, p_estacion uuid default null
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid; v_rest uuid; v_correo text;
begin
  if mi_rol() not in ('admin','dueno') then raise exception 'Solo administración'; end if;
  if p_rol in ('admin','dueno') and mi_rol() <> 'dueno' then
    raise exception 'Solo el dueño puede crear administradores';
  end if;
  v_rest := mi_restaurante();
  v_correo := lower(trim(p_correo));
  if coalesce(trim(p_nombre),'') = '' then raise exception 'El nombre es obligatorio'; end if;
  if v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'El correo no es válido'; end if;
  if length(coalesce(p_clave,'')) < 8 then raise exception 'La contraseña necesita al menos 8 caracteres'; end if;
  if exists (select 1 from auth.users where email = v_correo) then
    raise exception 'Ya existe un usuario con ese correo';
  end if;
  if p_rol = 'cocina' and p_estacion is not null and not exists (
    select 1 from estaciones e where e.id = p_estacion and e.restaurante_id = v_rest
  ) then raise exception 'Estación no válida'; end if;

  v_uid := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    v_correo, extensions.crypt(p_clave, extensions.gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_uid, v_correo,
    jsonb_build_object('sub', v_uid::text, 'email', v_correo, 'email_verified', true),
    'email', now(), now(), now()
  );

  insert into usuarios (id, restaurante_id, nombre, rol, estacion_id, correo)
  values (v_uid, v_rest, trim(p_nombre), p_rol,
          case when p_rol = 'cocina' then p_estacion else null end, v_correo);

  return v_uid;
end $$;

-- Eliminar un usuario del equipo (borra el acceso; usuarios cae en cascada).
create or replace function eliminar_usuario(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_rol rol_usuario; v_rest uuid;
begin
  if mi_rol() not in ('admin','dueno') then raise exception 'Solo administración'; end if;
  if p_id = auth.uid() then raise exception 'No puedes eliminarte a ti mismo'; end if;

  select rol, restaurante_id into v_rol, v_rest from usuarios where id = p_id;
  if v_rol is null or v_rest <> mi_restaurante() then raise exception 'Usuario no encontrado'; end if;
  if v_rol = 'dueno' then raise exception 'La cuenta del dueño no se puede eliminar'; end if;
  if v_rol = 'admin' and mi_rol() <> 'dueno' then
    raise exception 'Solo el dueño puede eliminar administradores';
  end if;

  delete from auth.users where id = p_id;
end $$;

-- Reporte por rango [desde, hasta): métricas del mes para el panel de Reportes.
create or replace function reporte_rango(p_desde timestamptz, p_hasta timestamptz, p_zona text default 'America/Bogota')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rest uuid; v_res jsonb; v_total bigint; v_n int;
begin
  if mi_rol() not in ('admin','dueno') then raise exception 'Solo administración'; end if;
  v_rest := mi_restaurante();

  select coalesce(sum(total),0), count(*) into v_total, v_n
    from pedidos
    where restaurante_id = v_rest and estado <> 'anulado'
      and creado_en >= p_desde and creado_en < p_hasta;

  select jsonb_build_object(
    'total_ventas', v_total,
    'num_pedidos', v_n,
    'ticket_promedio', case when v_n > 0 then v_total / v_n else 0 end,
    'por_dia', coalesce((select jsonb_agg(x order by (x->>'dia')::int) from (
        select jsonb_build_object('dia', extract(day from creado_en at time zone p_zona)::int,
                                  'total', sum(total)) x
        from pedidos
        where restaurante_id = v_rest and estado <> 'anulado'
          and creado_en >= p_desde and creado_en < p_hasta
        group by extract(day from creado_en at time zone p_zona)) s), '[]'::jsonb),
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

-- Permisos
revoke all on function crear_usuario(text, text, text, rol_usuario, uuid) from public, anon;
revoke all on function eliminar_usuario(uuid) from public, anon;
revoke all on function reporte_rango(timestamptz, timestamptz, text) from public, anon;
grant execute on function crear_usuario(text, text, text, rol_usuario, uuid) to authenticated;
grant execute on function eliminar_usuario(uuid) to authenticated;
grant execute on function reporte_rango(timestamptz, timestamptz, text) to authenticated;
