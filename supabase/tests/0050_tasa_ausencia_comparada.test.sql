-- 0050_tasa_ausencia_comparada.test.sql
-- Verifica 0050 (VIZ-03: tasa de ausencia comparada) CONTRA SCHEMA APLICADO.
-- Corre vía `psql -tA -f` contra PROD aplicado (Phase 23 pattern), begin;…;rollback;.
-- NO vive en el glob de vitest (la suite globea solo .test.{ts,tsx}); lo corre el
-- OPERADOR a mano el día del apply (checkpoint Plan 03, patrón 52-06). `tsc`/`pnpm test`
-- NO prueban que Postgres ejecutó el DDL — esta es la única prueba válida. Idiom del
-- proyecto (0041/0047/0048/0049): `array_to_string(proargnames, ',')` para el orden
-- posicional; el idiom basado en el texto del resultado de la función está PROHIBIDO.
--
-- AISLAMIENTO DE LA COHORTE: la RPC computa la mediana sobre TODA la cámara del sujeto.
-- Contra PROD-aplicado los ~21k votos reales contaminarían la mediana/K → los asserts de
-- DATOS no serían deterministas. Por eso el fixture `delete from public.voto;` DENTRO de
-- la transacción (rollback: PROD intacto al terminar) y siembra una cohorte conocida.
-- Nada referencia `public.voto` (0 FKs entrantes, 0 triggers — VERIFIED psql PROD), así
-- que el delete-en-tx es limpio; `parlamentario`/`votacion` reales quedan sin votos →
-- excluidos por `having count(*) >= 1`. Los asserts de CONTRATO (1-6) no dependen de datos.
begin;
select plan(10);

-- ── (1) la función existe con la firma de parámetros (text) ────────────────────
select has_function(
  'public', 'tasa_ausencia_comparada', array['text'],
  'tasa_ausencia_comparada(text) existe con la firma de parámetro esperada');

-- ── (2) el returns table declara las columnas EXACTAS en ORDEN posicional ──────
-- El cliente (Plan 02) mapea por posición/nombre; reorder/columna faltante = bug silente.
-- Contrato pineado a 7 nombres (p_parlamentario_id + 6 columnas del returns table).
select is(
  (select array_to_string(proargnames, ',')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'tasa_ausencia_comparada'),
  'p_parlamentario_id,n_ausencias,m_votaciones,tasa_propia,mediana_camara,k_parlamentarios,camara',
  'tasa_ausencia_comparada emite las 6 columnas en el orden pineado del contrato');

-- ── (3) es security definer (lee parlamentario/voto interno, emite derivado público) ─
select is(
  (select prosecdef
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'tasa_ausencia_comparada'),
  true,
  'tasa_ausencia_comparada es security definer');

-- ── (4) proconfig fija search_path='' (V8: nombres calificados con schema) ──────
select ok(
  (select array_to_string(proconfig, ',')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'tasa_ausencia_comparada')
    like '%search_path=%',
  'tasa_ausencia_comparada fija set search_path= en proconfig');

-- ── (5) anon NO tiene EXECUTE (Camino A post-0044: deny; el sitio lee con
--        service_role que bypassa ACL). El doble revoke explícito de 0050 hace
--        esto determinista ante los DEFAULT PRIVILEGES del rol de aplicación. ──
select ok(
  not has_function_privilege('anon', 'public.tasa_ausencia_comparada(text)', 'execute'),
  'anon NO tiene EXECUTE sobre tasa_ausencia_comparada (Camino A post-0044: deny)');

-- ── (6) no-PII: el returns table NUNCA declara partido/rut/email (LEGAL-03) ─────
-- (parlamentario/voto se LEEN internamente vía security definer, pero jamás se devuelve
-- partido/rut/email/nombre al cliente — solo conteos, ratios neutros y camara).
select is(
  (select array_to_string(proargnames, ',')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'tasa_ausencia_comparada')
    !~* '\y(partido|rut|email)\y',
  true,
  'el returns table de tasa_ausencia_comparada NO expone partido/rut/email (no-PII)');

-- ── Fixture mínimo para los asserts de DATOS (7)(8)(9)(10) ─────────────────────
-- Aísla la cohorte: borra los votos PROD (rollback los restaura) y siembra una cohorte
-- determinista de 3 diputados con ratios conocidos {0.25, 0.50, 0.75} → mediana = 0.50,
-- K = 3. `partido` NOT null para probar que el returns table NO lo filtra. Un 4º diputado
-- (PTEST_D) SIN votos ejercita el caso M=0 (empty honesto). fuente_voter_id explícito:
-- es NOT NULL sin default (0009) y unique (votacion_id, fuente_voter_id).
delete from public.voto;

insert into public.parlamentario (id, nombre_normalizado, camara, periodo, partido, origen, enlace)
values
  ('PTEST_A', 'test a', 'diputados', '2022-2026', 'PART_TEST', 'test', 'http://x'),
  ('PTEST_B', 'test b', 'diputados', '2022-2026', 'PART_TEST', 'test', 'http://x'),
  ('PTEST_C', 'test c', 'diputados', '2022-2026', 'PART_TEST', 'test', 'http://x'),
  ('PTEST_D', 'test d', 'diputados', '2022-2026', 'PART_TEST', 'test', 'http://x');

-- 4 votaciones de diputados. total_* default 0, fecha_captura default now().
insert into public.votacion (id, boletin, camara, origen, enlace)
values
  ('vtest:1', 'BTEST-1', 'diputados', 'test', 'http://x'),
  ('vtest:2', 'BTEST-1', 'diputados', 'test', 'http://x'),
  ('vtest:3', 'BTEST-1', 'diputados', 'test', 'http://x'),
  ('vtest:4', 'BTEST-1', 'diputados', 'test', 'http://x');

-- Votos confirmados con ratios de ausencia deterministas (m=4 c/u):
--   PTEST_A: 1 ausente / 4  → 0.25
--   PTEST_B: 2 ausente / 4  → 0.50  (SUJETO del smoke)
--   PTEST_C: 3 ausente / 4  → 0.75
-- fuente_voter_id = id del parlamentario (único por votacion).
insert into public.voto (votacion_id, mencion_nombre, parlamentario_id, seleccion, metodo, estado_vinculo, fuente_voter_id)
values
  -- PTEST_A → ausente en v1; si en v2,v3,v4
  ('vtest:1', 'test a', 'PTEST_A', 'ausente', 'determinista', 'confirmado', 'PTEST_A'),
  ('vtest:2', 'test a', 'PTEST_A', 'si',      'determinista', 'confirmado', 'PTEST_A'),
  ('vtest:3', 'test a', 'PTEST_A', 'si',      'determinista', 'confirmado', 'PTEST_A'),
  ('vtest:4', 'test a', 'PTEST_A', 'si',      'determinista', 'confirmado', 'PTEST_A'),
  -- PTEST_B → ausente en v1,v2; si en v3,v4
  ('vtest:1', 'test b', 'PTEST_B', 'ausente', 'determinista', 'confirmado', 'PTEST_B'),
  ('vtest:2', 'test b', 'PTEST_B', 'ausente', 'determinista', 'confirmado', 'PTEST_B'),
  ('vtest:3', 'test b', 'PTEST_B', 'si',      'determinista', 'confirmado', 'PTEST_B'),
  ('vtest:4', 'test b', 'PTEST_B', 'si',      'determinista', 'confirmado', 'PTEST_B'),
  -- PTEST_C → ausente en v1,v2,v3; si en v4
  ('vtest:1', 'test c', 'PTEST_C', 'ausente', 'determinista', 'confirmado', 'PTEST_C'),
  ('vtest:2', 'test c', 'PTEST_C', 'ausente', 'determinista', 'confirmado', 'PTEST_C'),
  ('vtest:3', 'test c', 'PTEST_C', 'ausente', 'determinista', 'confirmado', 'PTEST_C'),
  ('vtest:4', 'test c', 'PTEST_C', 'si',      'determinista', 'confirmado', 'PTEST_C');
-- PTEST_D: SIN votos → caso M=0 (empty honesto).

-- ── (7) tasa_propia del SUJETO (PTEST_B) = 2/4 = 0.50 (ratio [0,1]) ────────────
select is(
  (select round(tasa_propia, 4) from public.tasa_ausencia_comparada('PTEST_B')),
  0.5000::numeric,
  'tasa_propia del sujeto = n/m = 2/4 = 0.50 (ratio, sin div/0)');

-- ── (8) mediana_camara de la cohorte {0.25, 0.50, 0.75} = 0.50 ────────────────
select is(
  (select round(mediana_camara, 4) from public.tasa_ausencia_comparada('PTEST_B')),
  0.5000::numeric,
  'mediana_camara = percentile_cont(0.5) de {0.25,0.50,0.75} = 0.50');

-- ── (9) k_parlamentarios = 3 (A,B,C con >=1 voto; D excluido por M=0) + n/m/camara ─
select is(
  (select k_parlamentarios || '|' || n_ausencias || '|' || m_votaciones || '|' || camara
     from public.tasa_ausencia_comparada('PTEST_B')),
  '3|2|4|diputados',
  'k_parlamentarios=3 (D sin votos excluido); n=2, m=4, camara=diputados del sujeto');

-- ── (10) CASO M=0: PTEST_D no tiene votos confirmados → 0 filas (empty honesto,
--         nunca NaN/Inf ni fila fabricada). ──────────────────────────────────────
select is(
  (select count(*)::int from public.tasa_ausencia_comparada('PTEST_D')),
  0,
  'tasa_ausencia_comparada devuelve 0 filas para un parlamentario sin votos (M=0, empty honesto)');

select * from finish();
rollback;
