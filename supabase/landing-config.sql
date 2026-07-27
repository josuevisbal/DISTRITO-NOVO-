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
