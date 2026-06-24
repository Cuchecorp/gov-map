-- 0039_cruce_senal.test.sql
-- Verifica la migración 0039 (cruce_senal + materializar_cruces + cron) CONTRA UN SCHEMA
-- APLICADO:
--   * `cruce_senal` existe con RLS habilitada y es DENY-BY-DEFAULT (cero policies),
--   * anon NO lee `cruce_senal` directamente (revoke all → 42501),
--   * `cruces.materializar_cruces()` existe y es SECURITY DEFINER,
--   * la materialización (FULL REBUILD, D-11) produce señal lobby_sector para ≥5
--     parlamentarios distintos, con conteo + evidencia jsonb (items con enlace de fuente),
--   * el cuerpo de `materializar_cruces` NO contiene partido ni rut (no-PII, LEGAL-03),
--   * el cron 'cruces-materializar' quedó registrado.
-- Corre vía `psql -tA -f` (vs PROD aplicado) (pgTAP). build/typecheck NO prueban que el DDL se aplicó
-- (falso positivo de CI, Pitfall 5). Espeja 0030_net.test.sql style. Requiere 0038 aplicada
-- (catálogo sector + columna lobby_contraparte.sector_id).

begin;
-- 10 aserciones reales en este archivo (el plan(11) original estaba off-by-one — bug del
-- conteo, no del DDL; corregido en Plan 04 al correr contra el schema aplicado).
select plan(10);

-- ── Semilla (owner, bypassa RLS) ──────────────────────────────────────────────
-- Cinco parlamentarios confirmados, cada uno con una audiencia confirmada cuya contraparte
-- está clasificada en un sector existente del catálogo (0038). El partido/rut se siembran
-- en la maestra para PROBAR que el materializador NO los toca (no aparecen en cruce_senal).
insert into parlamentario
  (id, nombre_normalizado, nombres, apellido_paterno, camara, periodo, origen, enlace, partido, rut)
values
  ('CR1', 'cruce uno',   'Ana',   'Uno',    'diputados', '2022-2026', 'camara', 'http://x', 'Partido Secreto A', '11.111.111-1'),
  ('CR2', 'cruce dos',   'Beto',  'Dos',    'diputados', '2022-2026', 'camara', 'http://x', 'Partido Secreto B', '22.222.222-2'),
  ('CR3', 'cruce tres',  'Carla', 'Tres',   'senado',    '2022-2026', 'senado', 'http://x', 'Partido Secreto C', '33.333.333-3'),
  ('CR4', 'cruce cuatro','Dani',  'Cuatro', 'senado',    '2022-2026', 'senado', 'http://x', 'Partido Secreto D', '44.444.444-4'),
  ('CR5', 'cruce cinco', 'Edu',   'Cinco',  'diputados', '2022-2026', 'camara', 'http://x', 'Partido Secreto E', '55.555.555-5');

-- Audiencias confirmadas (una por parlamentario).
insert into lobby_audiencia
  (identificador, institucion_codigo, parlamentario_id, mencion_sujeto, estado_vinculo, fecha, origen, enlace)
values
  ('AUD-CR1', 'INST', 'CR1', 'Ana Uno',     'confirmado', '2024-01-10', 'lobby', 'http://lobby/1'),
  ('AUD-CR2', 'INST', 'CR2', 'Beto Dos',    'confirmado', '2024-02-20', 'lobby', 'http://lobby/2'),
  ('AUD-CR3', 'INST', 'CR3', 'Carla Tres',  'confirmado', '2024-03-05', 'lobby', 'http://lobby/3'),
  ('AUD-CR4', 'INST', 'CR4', 'Dani Cuatro', 'confirmado', '2024-04-15', 'lobby', 'http://lobby/4'),
  ('AUD-CR5', 'INST', 'CR5', 'Edu Cinco',   'confirmado', '2024-05-25', 'lobby', 'http://lobby/5');

-- Contrapartes con sector_id directo (clasificación que en producción hace Plan 02/03).
-- Cada una usa un código existente del catálogo seed de 0038.
insert into lobby_contraparte (identificador, nombre, rol, origen, enlace, sector_id)
values
  ('AUD-CR1', 'Gestor Salud SpA',      'lobbista', 'lobby', 'http://lobby/1', 'salud'),
  ('AUD-CR2', 'Minera del Norte',      'lobbista', 'lobby', 'http://lobby/2', 'mineria_energia'),
  ('AUD-CR3', 'Banco Central de Lobby','lobbista', 'lobby', 'http://lobby/3', 'banca_finanzas'),
  ('AUD-CR4', 'TransLogística Ltda',   'lobbista', 'lobby', 'http://lobby/4', 'transporte'),
  ('AUD-CR5', 'EduTech Chile',         'lobbista', 'lobby', 'http://lobby/5', 'educacion');

-- Poblar cruce_senal desde los hechos sembrados (FULL REBUILD).
select cruces.materializar_cruces();

-- ── cruce_senal existe + RLS habilitada ───────────────────────────────────────
select has_table('public', 'cruce_senal', 'tabla cruce_senal existe');
select is(
  (select count(*)::int from pg_class where relname = 'cruce_senal' and relrowsecurity = true),
  1, 'RLS enabled en cruce_senal');

-- ── DENY-BY-DEFAULT: cero policies sobre cruce_senal ──────────────────────────
select is(
  (select count(*)::int from pg_policies where tablename = 'cruce_senal'),
  0, 'cruce_senal sin policies (deny-by-default)');

-- ── cruces.materializar_cruces es SECURITY DEFINER ────────────────────────────
select is(
  (select p.prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'cruces' and p.proname = 'materializar_cruces'),
  true,
  'cruces.materializar_cruces es security definer');

-- ── no-PII: el cuerpo de materializar_cruces NO referencia partido ni rut ──────
-- Se STRIPEAN los comentarios `--` antes de buscar y se exige límite de palabra (\y).
select ok(
  (select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'cruces' and p.proname = 'materializar_cruces')
    !~* '\y(partido|rut)\y',
  'el cuerpo de materializar_cruces NO contiene partido ni rut (no-PII, LEGAL-03)');

-- ── happy path: señal materializada para ≥5 parlamentarios distintos ──────────
select cmp_ok(
  (select count(distinct parlamentario_id)::int from cruce_senal where tipo_senal = 'lobby_sector'),
  '>=', 5,
  'materializar_cruces produce señal lobby_sector para >=5 parlamentarios distintos');

-- ── la evidencia jsonb lleva conteo + items con enlace de fuente (D-09) ────────
select is(
  (select (evidencia -> 'items' -> 0 ->> 'enlace_fuente') from cruce_senal
    where parlamentario_id = 'CR1' and sector_id = 'salud' and tipo_senal = 'lobby_sector'),
  'http://lobby/1',
  'la evidencia jsonb expone el enlace de fuente del item (trazabilidad D-09)');

-- ── el item usa el nombre CRUDO de la contraparte (D-10) ──────────────────────
select is(
  (select (evidencia -> 'items' -> 0 ->> 'contraparte_nombre_crudo') from cruce_senal
    where parlamentario_id = 'CR1' and sector_id = 'salud' and tipo_senal = 'lobby_sector'),
  'Gestor Salud SpA',
  'la evidencia usa el nombre CRUDO de la contraparte (D-10)');

-- ── el cron cruces-materializar quedó registrado ──────────────────────────────
select is(
  (select count(*)::int from cron.job where jobname = 'cruces-materializar'),
  1, 'cron job cruces-materializar registrado');

-- ── anon NO lee cruce_senal directamente (deny-by-default → 42501) ────────────
set local role anon;
select throws_ok(
  $$ select id from cruce_senal $$,
  '42501',
  null,
  'anon NO lee cruce_senal directamente (revoke all → insufficient_privilege 42501)');
reset role;

select * from finish();
rollback;
