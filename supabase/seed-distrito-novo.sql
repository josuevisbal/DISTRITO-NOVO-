-- ============================================================
-- SEED · DISTRITO NOVO
-- Estaciones, categorias y los 84 productos de la carta real
-- ============================================================

do $$
declare v_rest uuid;
begin

insert into restaurantes (nombre, slug, whatsapp, llave_pago, cuenta_pago)
values ('Distrito Novo','distrito-novo','+57 300 000 0000','@distritonovo','Bancolombia Ahorros 000-000000-00')
on conflict (slug) do update set nombre = excluded.nombre
returning id into v_rest;

-- estaciones
insert into estaciones (restaurante_id, slug, nombre, color, orden) values (v_rest, 'rapida', 'Comida rápida', '#E0872B', 1) on conflict (restaurante_id, slug) do nothing;
insert into estaciones (restaurante_id, slug, nombre, color, orden) values (v_rest, 'asados', 'Asados', '#C2452F', 2) on conflict (restaurante_id, slug) do nothing;
insert into estaciones (restaurante_id, slug, nombre, color, orden) values (v_rest, 'bebidas', 'Bebidas', '#2E9E8F', 3) on conflict (restaurante_id, slug) do nothing;

-- categorias
insert into categorias (restaurante_id, slug, nombre, orden) values (v_rest, 'entrada', 'Entradas', 1) on conflict (restaurante_id, slug) do nothing;
insert into categorias (restaurante_id, slug, nombre, orden) values (v_rest, 'hambur', 'Hamburguesas', 2) on conflict (restaurante_id, slug) do nothing;
insert into categorias (restaurante_id, slug, nombre, orden) values (v_rest, 'salchi', 'Salchipapas', 3) on conflict (restaurante_id, slug) do nothing;
insert into categorias (restaurante_id, slug, nombre, orden) values (v_rest, 'salvaj', 'Salvajadas', 4) on conflict (restaurante_id, slug) do nothing;
insert into categorias (restaurante_id, slug, nombre, orden) values (v_rest, 'perros', 'Perros', 5) on conflict (restaurante_id, slug) do nothing;
insert into categorias (restaurante_id, slug, nombre, orden) values (v_rest, 'desgra', 'Desgranados', 6) on conflict (restaurante_id, slug) do nothing;
insert into categorias (restaurante_id, slug, nombre, orden) values (v_rest, 'patacon', 'Patacón', 7) on conflict (restaurante_id, slug) do nothing;
insert into categorias (restaurante_id, slug, nombre, orden) values (v_rest, 'arepas', 'Arepas', 8) on conflict (restaurante_id, slug) do nothing;
insert into categorias (restaurante_id, slug, nombre, orden) values (v_rest, 'especial', 'Especiales', 9) on conflict (restaurante_id, slug) do nothing;
insert into categorias (restaurante_id, slug, nombre, orden) values (v_rest, 'bebidas', 'Bebidas', 10) on conflict (restaurante_id, slug) do nothing;
insert into categorias (restaurante_id, slug, nombre, orden) values (v_rest, 'jugos', 'Jugos naturales', 11) on conflict (restaurante_id, slug) do nothing;
insert into categorias (restaurante_id, slug, nombre, orden) values (v_rest, 'michel', 'Micheladas', 12) on conflict (restaurante_id, slug) do nothing;

-- productos
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='entrada'),
  (select id from estaciones where restaurante_id=v_rest and slug='asados'),
  'Picada de chorizo', 'Con bollo', 10000, 8, 1);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='entrada'),
  (select id from estaciones where restaurante_id=v_rest and slug='asados'),
  'Picada de chicharrón 330g', 'Al barril y bollo', 15000, 10, 2);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='entrada'),
  (select id from estaciones where restaurante_id=v_rest and slug='asados'),
  'Picada mixta 330g', 'Chicharrón y chorizo', 22000, 12, 3);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='entrada'),
  (select id from estaciones where restaurante_id=v_rest and slug='asados'),
  'Chicharronada al barril 660g', 'Chorizo, papa y bollo', 40000, 18, 4);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='salchi'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Salchipapa sencilla', 'Papa, salchicha, queso, salsa de la casa, jamón y aderezos', 14000, 10, 5);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='salchi'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Salchipollo', 'Papa, pollo, salchicha, queso, salsa de la casa y aderezos', 20000, 11, 6);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='salchi'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Salchipapa mixta', 'Papa, pollo, salchicha, queso, salsa de la casa y aderezos', 20000, 11, 7);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='salchi'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Salchipapa combinada', 'Papa, chorizo, butifarra, salchicha, queso, salsa de la casa', 20000, 12, 8);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='salchi'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Salchipapa suiza', 'Papa, suiza, queso, salsa de la casa, jamón y aderezos', 20000, 11, 9);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='salchi'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Salchipapa 4 carnes', 'Papa, salchicha, carne, pollo, chorizo, queso y aderezos', 24000, 13, 10);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='salchi'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  '4 Carnes especial', '4 carnes, gratinado, aderezos, salsa de la casa, alitas o costilla', 30000, 15, 11);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='patacon'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Patacón mixto', 'Carne mechada, pollo mechado, lechuga, salsa de la casa y queso', 17000, 10, 12);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='patacon'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Patacón 4 carnes', 'Carne mechada, pollo mechado, chorizo, butifarra, lechuga y queso', 20000, 12, 13);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='patacon'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Patacón especial', '4 carnes, tocineta y mozzarella', 24000, 13, 14);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='patacon'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Pataconada', 'Carne mechada, pollo mechado, chorizo, butifarra, gratinada', 45000, 18, 15);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='arepas'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Arepa de queso', 'Mozzarella, queso costeño, salsa de la casa', 8000, 6, 16);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='arepas'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Arepa mechada', 'Carne mechada, queso, salsa de la casa', 12000, 7, 17);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='arepas'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Arepa chicken', 'Pollo mechado, queso, salsa de la casa', 12000, 7, 18);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='arepas'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Arepa chicharrona', 'Chicharrón, queso, salsa de la casa', 12000, 7, 19);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='arepas'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Arepa chori', 'Chorizo, queso, salsa de la casa', 12000, 7, 20);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='arepas'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Arepa butty', 'Butifarra, queso, salsa de la casa', 12000, 7, 21);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='arepas'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Arepa ranchera', 'Ranchera, queso, salsa de la casa', 14000, 8, 22);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='arepas'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Arepa suiza', 'Salchicha suiza, queso, salsa de la casa', 14000, 8, 23);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='arepas'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Arepa mixta', 'Dos toppings, queso, salsa de la casa', 15000, 9, 24);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='arepas'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Arepa trifásica', 'Tres toppings, queso, salsa de la casa', 17000, 10, 25);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='arepas'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Arepa especial (2 arepas)', 'Carne y pollo mechado, chorizo, butifarra, mozzarella, maíz', 22000, 12, 26);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='especial'),
  (select id from estaciones where restaurante_id=v_rest and slug='asados'),
  'Carne asada', 'Lomo ancho 250g, papa francesa o bollo, ensalada chimichurri', 25000, 18, 27);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='especial'),
  (select id from estaciones where restaurante_id=v_rest and slug='asados'),
  'Punta gorda', 'Punta gorda 250g, papa francesa o bollo, ensalada chimichurri', 30000, 20, 28);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='especial'),
  (select id from estaciones where restaurante_id=v_rest and slug='asados'),
  'Chuleta', 'Chuleta 250g, papa francesa o bollo, ensalada chimichurri', 22000, 16, 29);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='especial'),
  (select id from estaciones where restaurante_id=v_rest and slug='asados'),
  'Asado Distro', 'Chuleta, carne, chorizo, bollo, ensalada chimichurri', 40000, 25, 30);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='salvaj'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Salvajada especial (2 personas)', 'Papa, salchicha, chorizo, butifarra, carne, pollo, salsa de la casa, jamón, mozzarella y aderezos', 35000, 16, 31);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='salvaj'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Distrita (3 personas)', 'Papa, salchicha, chorizo, butifarra, carne, pollo, salsa de la casa, jamón, mozzarella y aderezos', 45000, 19, 32);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='salvaj'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Tcherassi (5 personas)', 'Papa, salchicha, chorizo, butifarra, carne, pollo, salsa de la casa, jamón, mozzarella, tocineta, alitas, gratinada, maíz y aderezos', 80000, 23, 33);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='perros'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Perro sencillo', null, 7000, 5, 34);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='perros'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Perro a la plancha', null, 8000, 6, 35);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='perros'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Perro sencillo mozzarella', null, 8000, 6, 36);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='perros'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Perro gemelo', null, 10000, 7, 37);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='perros'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Choriperro', null, 11000, 8, 38);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='perros'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Butiperro', null, 11000, 8, 39);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='perros'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Perro ranchero', null, 11000, 8, 40);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='perros'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Perro suizo', null, 16000, 8, 41);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='desgra'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Desgranado especial', 'Pollo, chorizo, butifarra, carne, salsa de la casa, queso, maíz, tocineta, mozzarella y aderezos', 24000, 14, 42);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='desgra'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Desgranado combinado', 'Pollo, chorizo, butifarra, tocineta, maíz, salsa de la casa, queso, mozzarella y aderezos', 22000, 13, 43);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='desgra'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Desgranado mixto', 'Pollo, carne, salsa de la casa, queso, tocineta, maíz, mozzarella y aderezos', 22000, 13, 44);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='hambur'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Hamburguesa sencilla', 'Pan brioche, carne angus, salsa de la casa, mozzarella, lechuga, tomate, cebolla, tocineta, papa francesa', 18000, 10, 45);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='hambur'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Hamburguesa costeña', 'Pan brioche, carne angus, salsa de la casa, mozzarella, queso frito, madurito, tocineta, cebolla caramelizada', 22000, 11, 46);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='hambur'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Hamburguesa doble carne', 'Pan brioche, doble carne angus, salsa de la casa, cebolla caramelizada, papas a la francesa', 24000, 12, 47);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='hambur'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Hamburguesa mixta', 'Pan brioche, carne angus, pollo, tocineta, cebolla caramelizada, mozzarella, salsa de la casa, lechuga, papas a la francesa', 24000, 12, 48);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='hambur'),
  (select id from estaciones where restaurante_id=v_rest and slug='rapida'),
  'Mega especial Distrita', 'Pan brioche, carne angus, pollo, cebolla caramelizada, mozzarella, salsa de la casa, tocineta, queso frito, chorizo en salsa, papa a la francesa', 32000, 15, 49);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Agua', null, 2500, 1, 50);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Águila negra', null, 4500, 1, 51);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Águila light', null, 4500, 1, 52);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Canada Dry', null, 5500, 1, 53);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Coca-Cola pequeña', null, 3000, 1, 54);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Coca-Cola personal', null, 4500, 1, 55);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Coca-Cola litro', null, 5500, 1, 56);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Coca-Cola 1.5', null, 8500, 1, 57);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Coronita', null, 5000, 1, 58);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Costeña verde', null, 4500, 1, 59);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Costeñita', null, 4500, 1, 60);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Costeña roja', null, 4500, 1, 61);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Poker', null, 4500, 1, 62);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Smirnoff', null, 12000, 1, 63);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Ginger', null, 5500, 1, 64);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Cuate', null, 6500, 1, 65);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Cuatro', null, 3500, 1, 66);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Jugo del Valle', null, 6500, 1, 67);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Jugo Hit', null, 7500, 1, 68);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Jugo Hit personal', null, 4500, 1, 69);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Kola', null, 3500, 1, 70);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Postobón 1.5', null, 8500, 1, 71);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Postobón personal', null, 4500, 1, 72);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Soda', null, 5500, 1, 73);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='bebidas'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Soda cerezada', null, 8500, 1, 74);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='jugos'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Jugo de fresa', null, 8000, 3, 75);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='jugos'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Maracuyá', null, 8000, 3, 76);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='jugos'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Mora', null, 8000, 3, 77);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='jugos'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Limonada', null, 8000, 3, 78);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='jugos'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Limonada de cereza', null, 8000, 3, 79);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='jugos'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Limonada de coco', null, 8000, 3, 80);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='jugos'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Limonada condensada', null, 8000, 3, 81);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='michel'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Michelada frutos rojos', null, 8000, 3, 82);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='michel'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Michelada frutos verdes', null, 8000, 3, 83);
insert into productos (restaurante_id, categoria_id, estacion_id, nombre, descripcion, precio, minutos_prep, orden) values (v_rest,
  (select id from categorias where restaurante_id=v_rest and slug='michel'),
  (select id from estaciones where restaurante_id=v_rest and slug='bebidas'),
  'Vaso michelado', null, 2500, 2, 84);

-- zonas de domicilio
insert into zonas_domicilio (restaurante_id, nombre, valor) values (v_rest, 'El Prado', 5000);
insert into zonas_domicilio (restaurante_id, nombre, valor) values (v_rest, 'Boston', 5000);
insert into zonas_domicilio (restaurante_id, nombre, valor) values (v_rest, 'Alto Prado', 6000);
insert into zonas_domicilio (restaurante_id, nombre, valor) values (v_rest, 'Villa Country', 6000);
insert into zonas_domicilio (restaurante_id, nombre, valor) values (v_rest, 'Centro', 7000);
insert into zonas_domicilio (restaurante_id, nombre, valor) values (v_rest, 'Riomar', 8000);

-- mesas 1 a 12
insert into mesas (restaurante_id, numero) select v_rest, g from generate_series(1,12) g;

-- promociones de arranque
insert into promociones (restaurante_id, tipo, etiqueta, titulo, descripcion, activa, monto_minimo) values
  (v_rest,'envio','Solo por hoy','Domicilio GRATIS','En pedidos desde $70.000 en toda nuestra zona de cobertura.',true,70000);
insert into promociones (restaurante_id, tipo, etiqueta, titulo, descripcion, activa) values
  (v_rest,'aviso','Jueves','2x1 en salchipapa sencilla','Válido solo para consumo en el local, de 6 a 9 pm.',false);

end $$;
