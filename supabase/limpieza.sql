-- =====================================================================
-- LIMPIEZA PARA ARRANCAR EN PRODUCCIÓN
-- Correr UNA vez en el SQL Editor cuando quieras dejar el sistema en ceros:
-- quita las fotos de relleno de los productos y borra todos los pedidos y
-- movimientos de caja de prueba. La carta, las zonas, las promociones y los
-- usuarios NO se tocan. La portada y la imagen de la promo se conservan.
--
-- OJO: esto borra TODOS los pedidos e historial de caja. Hazlo antes de
-- empezar a operar de verdad, no después.
-- =====================================================================

-- 1) Fotos de relleno por producto (las que cargó la plantilla, nombre cat-*).
--    Donde no haya foto, la carta muestra la inicial del plato sobre el color
--    de su estación; el admin sube la foto real desde Carta.
update productos set foto_url = null where foto_url like '%/cat-%';

-- 2) Pedidos y caja en ceros
delete from caja_movimientos;
delete from pagos;
delete from comandas;
delete from pedido_items;
delete from pedidos;
delete from caja_turnos;

-- 3) La numeración de pedidos empieza en 1000
alter sequence pedido_numero_seq restart with 1000;

-- Nota: los archivos cat-*.jpg del bucket 'productos' quedan huérfanos y no
-- estorban. Si quieres borrarlos: Storage → productos → carpeta del
-- restaurante → seleccionar los cat-*.jpg → Delete. (Storage no permite
-- borrarlos por SQL.)
