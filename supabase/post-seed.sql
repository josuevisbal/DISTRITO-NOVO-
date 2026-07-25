-- =====================================================================
-- POST-SEED · lo que va DESPUÉS de schema.sql y seed-distrito-novo.sql
-- Crea el bucket de fotos, sus políticas, y los usuarios del equipo.
-- Correr una sola vez en el SQL Editor del proyecto nuevo.
-- Todo busca los ids por slug: no hay ids quemados.
-- =====================================================================

-- ---------- Storage: bucket público de fotos de productos ----------
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do nothing;

drop policy if exists productos_admin_insert on storage.objects;
create policy productos_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'productos'
    and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin' and u.activo));

drop policy if exists productos_admin_update on storage.objects;
create policy productos_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'productos'
    and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin' and u.activo));

drop policy if exists productos_admin_delete on storage.objects;
create policy productos_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'productos'
    and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin' and u.activo));

drop policy if exists productos_lectura_publica on storage.objects;
create policy productos_lectura_publica on storage.objects for select to public
  using (bucket_id = 'productos');

-- ---------- Usuarios del equipo (contraseña: distrito2026) ----------
-- Crea las cuentas de auth y su fila en 'usuarios'. Cambia la contraseña luego desde
-- Authentication si quieres. Las de cocina quedan atadas a su estación por slug.
do $$
declare
  v_rest uuid;
  r record;
  v_uid uuid;
  v_est uuid;
begin
  select id into v_rest from restaurantes where slug = 'distrito-novo';
  if v_rest is null then raise exception 'Corre primero schema.sql y el seed'; end if;

  for r in
    select email, nombre, rol, est_slug from (
      values
        ('admin@distrito.test',    'Admin',         'admin',        null::text),
        ('cajero@distrito.test',   'Cajero',        'cajero',       null::text),
        ('mesero@distrito.test',   'Mesero',        'mesero',       null::text),
        ('pase@distrito.test',     'Pase',          'pase',         null::text),
        ('domi@distrito.test',     'Domiciliario',  'domiciliario', null::text),
        ('rapida@distrito.test',   'Cocina Rápida', 'cocina',       'rapida'),
        ('asados@distrito.test',   'Cocina Asados', 'cocina',       'asados'),
        ('bebidas@distrito.test',  'Cocina Bebidas','cocina',       'bebidas')
    ) as t(email, nombre, rol, est_slug)
  loop
    if exists (select 1 from auth.users where email = r.email) then continue; end if;

    v_uid := gen_random_uuid();
    v_est := null;
    if r.est_slug is not null then
      select id into v_est from estaciones where restaurante_id = v_rest and slug = r.est_slug;
    end if;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      r.email, crypt('distrito2026', gen_salt('bf')),
      now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', '', '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_uid, r.email,
      jsonb_build_object('sub', v_uid::text, 'email', r.email, 'email_verified', true),
      'email', now(), now(), now()
    );

    insert into usuarios (id, restaurante_id, nombre, rol, estacion_id)
    values (v_uid, v_rest, r.nombre, r.rol::rol_usuario, v_est);
  end loop;
end $$;
