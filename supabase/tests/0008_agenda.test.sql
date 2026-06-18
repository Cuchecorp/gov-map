-- 0008_agenda.test.sql
-- Verifica el modelo común de Agenda creado por la migración 0010:
-- citacion / citacion_invitado / citacion_punto / sesion_sala / sesion_tabla_item
-- + RLS PÚBLICO-READ para anon + guarda de identidad (anon NO lee parlamentario.rut).
-- Corre via `supabase test db` (pgTAP).

begin;
select plan(22);

-- ── Existencia de las 5 tablas ───────────────────────────────────────────────
select has_table('public', 'citacion',          'tabla citacion existe');
select has_table('public', 'citacion_invitado', 'tabla citacion_invitado existe');
select has_table('public', 'citacion_punto',    'tabla citacion_punto existe');
select has_table('public', 'sesion_sala',        'tabla sesion_sala existe');
select has_table('public', 'sesion_tabla_item',  'tabla sesion_tabla_item existe');

-- ── Columnas clave + provenance inline (TRAM-09) ─────────────────────────────
select has_column('public', 'citacion', 'semana_iso',    'citacion.semana_iso presente (clave /agenda)');
select has_column('public', 'citacion', 'origen',        'citacion.origen presente (provenance)');
select has_column('public', 'citacion', 'fecha_captura', 'citacion.fecha_captura presente (provenance)');
select has_column('public', 'citacion', 'enlace',        'citacion.enlace presente (provenance)');
select has_column('public', 'sesion_sala', 'enlace',     'sesion_sala.enlace presente (provenance)');
select has_column('public', 'citacion_punto', 'boletin', 'citacion_punto.boletin presente (cruce con la ficha)');

-- GUARDA T-06-02: citacion_invitado NO tiene parlamentario_id (terceros, no parlamentarios).
select hasnt_column('public', 'citacion_invitado', 'parlamentario_id',
  'citacion_invitado NO tiene parlamentario_id (T-06-02: invitados son terceros)');

-- ── FK de los hijos hacia la raíz ────────────────────────────────────────────
select fk_ok('public', 'citacion_punto', 'citacion_id', 'public', 'citacion', 'id',
  'citacion_punto.citacion_id es FK a citacion(id)');
select fk_ok('public', 'sesion_tabla_item', 'sesion_id', 'public', 'sesion_sala', 'id',
  'sesion_tabla_item.sesion_id es FK a sesion_sala(id)');

-- ── Check constraint del dominio ─────────────────────────────────────────────
select throws_ok(
  $$ insert into citacion (id, camara, comision, semana_iso, origen, enlace)
     values ('x:1', 'congreso', 'X', '2026-W25', 't', 'http://x') $$,
  '23514',
  null,
  'citacion.camara fuera de {camara,senado} viola el check'
);

-- ── RLS habilitada en las 5 tablas ───────────────────────────────────────────
select is(
  (select count(*)::int from pg_class
     where relname in ('citacion', 'citacion_invitado', 'citacion_punto', 'sesion_sala', 'sesion_tabla_item')
       and relrowsecurity = true),
  5,
  'RLS enabled en las 5 tablas de agenda'
);

-- ── Semilla mínima como owner (postgres bypassa RLS) ─────────────────────────
insert into citacion (id, camara, comision, fecha, horario, sala, materia, estado, semana_iso, origen, enlace)
  values ('camara:seed', 'camara', 'Economía', now(), '10:00 a 12:00', 'Sala 1', 'Materia', null, '2026-W25', 'test', 'http://x');
insert into citacion_invitado (citacion_id, nombre, calidad)
  values ('camara:seed', 'Sra. Semilla', 'Subsecretaria');
insert into citacion_punto (citacion_id, posicion, boletin, materia)
  values ('camara:seed', 1, '18296-05', 'Modernización');
insert into sesion_sala (id, camara, fecha, numero, hora_inicio, tipo, origen, enlace)
  values ('senado:seed', 'senado', now(), '12', '16:00', 'Ordinaria', 'test', 'http://x');
insert into sesion_tabla_item (sesion_id, posicion, parte_sesion, materia, boletin)
  values ('senado:seed', 1, 'ORDEN DEL DÍA', 'Proyecto', '2734-14');

-- ── RLS público-read EFECTIVA: como rol anon, las 5 tablas SE LEEN ───────────
set local role anon;

select isnt_empty(
  $$ select 1 from citacion where id = 'camara:seed' $$,
  'anon SÍ lee citacion (policy public_read)');
select isnt_empty(
  $$ select 1 from citacion_invitado where citacion_id = 'camara:seed' $$,
  'anon SÍ lee citacion_invitado (policy public_read)');
select isnt_empty(
  $$ select 1 from citacion_punto where citacion_id = 'camara:seed' $$,
  'anon SÍ lee citacion_punto (policy public_read)');
select isnt_empty(
  $$ select 1 from sesion_sala where id = 'senado:seed' $$,
  'anon SÍ lee sesion_sala (policy public_read)');
select isnt_empty(
  $$ select 1 from sesion_tabla_item where sesion_id = 'senado:seed' $$,
  'anon SÍ lee sesion_tabla_item (policy public_read)');

-- ── Guarda de identidad: anon NO lee la maestra (rut nunca al público) ───────
select is_empty(
  $$ select rut from parlamentario $$,
  'anon NO lee parlamentario.rut (deny-by-default intacto, T-06-01)');

reset role;

select * from finish();
rollback;
