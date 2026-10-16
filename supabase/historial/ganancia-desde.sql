alter table restaurantes add column if not exists ganancia_desde date;
update restaurantes set ganancia_desde = dia_jornada(now(), 'America/Bogota', hora_corte) where ganancia_desde is null;
