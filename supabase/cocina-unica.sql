-- =====================================================================
-- COCINA ÚNICA · una sola pantalla de cocina con selector de estación
-- Correr UNA VEZ en el SQL Editor del proyecto del restaurante.
-- Seguro de re-correr (idempotente).
--
-- Qué cambia:
--  1) El rol 'cocina' deja de estar amarrado a una estación. Ve y opera las
--     comandas de CUALQUIER estación de SU restaurante (ya disparadas). La
--     estación que ve la decide el filtro de la interfaz, no el usuario.
--  2) Sigue sin ver precios ni datos del cliente (la tabla comandas no los
--     expone) y jamás ve nada de otro restaurante (filtro por restaurante_id).
--  3) Se consolidan las cuentas de cocina en UNA sola, sin estación amarrada.
-- =====================================================================

-- --- 1 · RLS: cocina ve cualquier estación de su restaurante (ya disparadas).
drop policy if exists cocina_comandas on comandas;
create policy cocina_comandas on comandas for select to authenticated using (
  exists (select 1 from pedidos p where p.id = pedido_id and p.restaurante_id = mi_restaurante())
  and (mi_rol() <> 'cocina' or disparo_en <= now())
);

-- --- 2 · RLS: cocina opera cualquier estación de su restaurante.
drop policy if exists cocina_comandas_upd on comandas;
create policy cocina_comandas_upd on comandas for update to authenticated using (
  exists (select 1 from pedidos p where p.id = pedido_id and p.restaurante_id = mi_restaurante())
  and mi_rol() in ('admin','dueno','pase','cocina')
);

-- --- 3 · Consolidación de datos.
-- La estación deja de aplicar al rol cocina: se libera en todas sus cuentas.
update usuarios set estacion_id = null where rol = 'cocina';

-- Deja UNA sola cuenta de cocina activa y desactiva las demás. Se conserva la
-- más antigua; si prefieres conservar otra (o crear una nueva "Cocina" desde el
-- panel de Equipo y desactivar estas), ajusta este bloque a tu caso.
with orden as (
  select id, row_number() over (order by creado_en, id) as rn
  from usuarios
  where rol = 'cocina' and activo
)
update usuarios u set activo = false
from orden o
where u.id = o.id and o.rn > 1;
