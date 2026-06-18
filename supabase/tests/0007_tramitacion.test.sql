-- 0007_tramitacion.test.sql
-- Verifica el modelo común de Tramitación creado por la migración 0008:
-- proyecto/votacion/voto/tramitacion_evento + RLS PÚBLICO-READ para anon + guarda de
-- identidad (anon NO lee parlamentario.rut). Corre via `supabase test db` (pgTAP).

begin;
select plan(21);

-- ── Existencia de las 4 tablas ───────────────────────────────────────────────
select has_table('public', 'proyecto',           'tabla proyecto existe');
select has_table('public', 'votacion',           'tabla votacion existe');
select has_table('public', 'voto',               'tabla voto existe');
select has_table('public', 'tramitacion_evento', 'tabla tramitacion_evento existe');

-- ── Columnas clave + provenance ──────────────────────────────────────────────
select has_column('public', 'proyecto', 'boletin',       'proyecto.boletin presente (PK/llave de cruce)');
select has_column('public', 'proyecto', 'boletin_num',   'proyecto.boletin_num presente (base sin sufijo)');
select has_column('public', 'proyecto', 'origen',        'proyecto.origen presente (provenance)');
select has_column('public', 'proyecto', 'fecha_captura', 'proyecto.fecha_captura presente (provenance)');
select has_column('public', 'proyecto', 'enlace',        'proyecto.enlace presente (provenance)');
select has_column('public', 'voto',     'parlamentario_id', 'voto.parlamentario_id presente');

-- voto.parlamentario_id es NULLABLE (solo se puebla si determinista/confirmado).
select col_is_null('public', 'voto', 'parlamentario_id',
  'voto.parlamentario_id es nullable (NULL salvo vínculo confirmado)');

-- voto.parlamentario_id es FK a parlamentario(id).
select fk_ok('public', 'voto', 'parlamentario_id', 'public', 'parlamentario', 'id',
  'voto.parlamentario_id es FK a parlamentario(id)');

-- ── Check constraints del dominio ────────────────────────────────────────────
-- selección inválida revienta.
select throws_ok(
  $$ insert into voto (votacion_id, mencion_nombre, seleccion)
     values ('camara:no-existe', 'x', 'blanco') $$,
  '23514',
  null,
  'voto.seleccion fuera de {si,no,abstencion,pareo} viola el check'
);
-- cámara inválida en votacion revienta.
select throws_ok(
  $$ insert into votacion (id, boletin, camara, origen, enlace)
     values ('x:1', 'NO-EXISTE', 'congreso', 't', 'http://x') $$,
  '23514',
  null,
  'votacion.camara fuera de {diputados,senado} viola el check'
);
-- tipo de evento inválido revienta.
select throws_ok(
  $$ insert into tramitacion_evento (boletin, tipo, origen)
     values ('NO-EXISTE', 'comida', 't') $$,
  '23514',
  null,
  'tramitacion_evento.tipo fuera del enum viola el check'
);

-- ── RLS habilitada en las 4 tablas ───────────────────────────────────────────
select is(
  (select count(*)::int from pg_class
     where relname in ('proyecto', 'votacion', 'voto', 'tramitacion_evento')
       and relrowsecurity = true),
  4,
  'RLS enabled en las 4 tablas de tramitación'
);

-- ── Semilla mínima como owner (postgres bypassa RLS) ─────────────────────────
insert into proyecto (boletin, boletin_num, titulo, origen, enlace)
  values ('99999-99', '99999', 'Proyecto semilla', 'test', 'http://x');
insert into votacion (id, boletin, camara, origen, enlace)
  values ('camara:seed', '99999-99', 'diputados', 'test', 'http://x');
insert into voto (votacion_id, mencion_nombre, seleccion)
  values ('camara:seed', 'Mención Semilla', 'si');
insert into tramitacion_evento (boletin, tipo, origen)
  values ('99999-99', 'tramite', 'test');

-- ── RLS público-read EFECTIVA: como rol anon, las 4 tablas SE LEEN ───────────
set local role anon;

select isnt_empty(
  $$ select 1 from proyecto where boletin = '99999-99' $$,
  'anon SÍ lee proyecto (policy public_read)');
select isnt_empty(
  $$ select 1 from votacion where id = 'camara:seed' $$,
  'anon SÍ lee votacion (policy public_read)');
select isnt_empty(
  $$ select 1 from voto where votacion_id = 'camara:seed' $$,
  'anon SÍ lee voto (policy public_read)');
select isnt_empty(
  $$ select 1 from tramitacion_evento where boletin = '99999-99' $$,
  'anon SÍ lee tramitacion_evento (policy public_read)');

-- ── Guarda de identidad: anon NO lee la maestra (rut/email nunca al público) ─
select is_empty(
  $$ select rut from parlamentario $$,
  'anon NO lee parlamentario.rut (deny-by-default intacto, T-05-01)');

reset role;

select * from finish();
rollback;
