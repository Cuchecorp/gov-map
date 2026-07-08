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
  'tasa_ausencia_comparada declara p_parlamentario_id + las 6 columnas del returns table en el orden pineado del contrato');

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
-- determinista de 4 diputados con ratios conocidos {0.10, 0.20, 0.60, 0.90}. Esta cohorte
-- es PAR y con GAP en el centro a propósito (WR-01): percentile_cont(0.5) INTERPOLA →
-- 0.40, mientras percentile_disc(0.5) daría 0.20 y avg daría 0.45. Así el assert (8)
-- distingue de verdad la mediana interpolada del contrato — una regresión a _disc o a
-- avg FALLARÍA (con la vieja cohorte simétrica {0.25,0.50,0.75}, _cont y _disc coincidían
-- en 0.50 y el test no discriminaba). `partido` NOT null para probar que el returns table
-- NO lo filtra. Un 5º diputado (PTEST_E) SIN votos ejercita el caso M=0 (empty honesto).
-- m=10 por parlamentario para poder expresar 0.10/0.20/0.60/0.90 con ausencias enteras.
-- fuente_voter_id explícito: es NOT NULL sin default (0009) y unique (votacion_id, fuente_voter_id).
delete from public.voto;

insert into public.parlamentario (id, nombre_normalizado, camara, periodo, partido, origen, enlace)
values
  ('PTEST_A', 'test a', 'diputados', '2022-2026', 'PART_TEST', 'test', 'http://x'),
  ('PTEST_B', 'test b', 'diputados', '2022-2026', 'PART_TEST', 'test', 'http://x'),
  ('PTEST_C', 'test c', 'diputados', '2022-2026', 'PART_TEST', 'test', 'http://x'),
  ('PTEST_D', 'test d', 'diputados', '2022-2026', 'PART_TEST', 'test', 'http://x'),
  ('PTEST_E', 'test e', 'diputados', '2022-2026', 'PART_TEST', 'test', 'http://x');

-- proyecto padre del boletín de prueba: votacion.boletin tiene FK a proyecto (fix post-apply:
-- el primer run en PROD falló con votacion_boletin_fkey — el fixture no creaba el proyecto).
insert into public.proyecto (boletin, boletin_num, titulo, origen, enlace)
values ('BTEST-1', 'BTEST-1', 'proyecto de prueba pgTAP 0050', 'test', 'http://x');

-- 10 votaciones de diputados (m=10 por parlamentario). total_* default 0, fecha_captura default now().
insert into public.votacion (id, boletin, camara, origen, enlace)
select 'vtest:' || g, 'BTEST-1', 'diputados', 'test', 'http://x'
from generate_series(1, 10) g;

-- Votos confirmados con ratios de ausencia deterministas (m=10 c/u):
--   PTEST_A: 1 ausente / 10 → 0.10
--   PTEST_B: 2 ausente / 10 → 0.20  (SUJETO del smoke)
--   PTEST_C: 6 ausente / 10 → 0.60
--   PTEST_D: 9 ausente / 10 → 0.90
-- Cohorte PAR con gap central → cont(0.5)=0.40 ≠ disc(0.5)=0.20 ≠ avg=0.45.
-- fuente_voter_id = id del parlamentario (único por votacion).
-- Las primeras `k` votaciones (por número de ausencias) son 'ausente'; el resto 'si'.
insert into public.voto (votacion_id, mencion_nombre, parlamentario_id, seleccion, metodo, estado_vinculo, fuente_voter_id)
select
  'vtest:' || g,
  c.nombre,
  c.pid,
  case when g <= c.ausencias then 'ausente' else 'si' end,
  'determinista',
  'confirmado',
  c.pid
from (values
  ('PTEST_A', 'test a', 1),
  ('PTEST_B', 'test b', 2),
  ('PTEST_C', 'test c', 6),
  ('PTEST_D', 'test d', 9)
) as c(pid, nombre, ausencias)
cross join generate_series(1, 10) g;
-- PTEST_E: SIN votos → caso M=0 (empty honesto).

-- ── (7) tasa_propia del SUJETO (PTEST_B) = 2/10 = 0.20 (ratio [0,1]) ───────────
select is(
  (select round(tasa_propia, 4) from public.tasa_ausencia_comparada('PTEST_B')),
  0.2000::numeric,
  'tasa_propia del sujeto = n/m = 2/10 = 0.20 (ratio, sin div/0)');

-- ── (8) mediana_camara de la cohorte {0.10, 0.20, 0.60, 0.90} = 0.40 ──────────
-- percentile_cont(0.5) INTERPOLA entre 0.20 y 0.60 → 0.40. Esto DISTINGUE _cont de
-- _disc (daría 0.20) y de avg (daría 0.45): una regresión a cualquiera fallaría aquí.
select is(
  (select round(mediana_camara, 4) from public.tasa_ausencia_comparada('PTEST_B')),
  0.4000::numeric,
  'mediana_camara = percentile_cont(0.5) INTERPOLADO de {0.10,0.20,0.60,0.90} = 0.40 (≠ _disc=0.20, ≠ avg=0.45)');

-- ── (9) k_parlamentarios = 4 (A,B,C,D con >=1 voto; E excluido por M=0) + n/m/camara ─
select is(
  (select k_parlamentarios || '|' || n_ausencias || '|' || m_votaciones || '|' || camara
     from public.tasa_ausencia_comparada('PTEST_B')),
  '4|2|10|diputados',
  'k_parlamentarios=4 (E sin votos excluido); n=2, m=10, camara=diputados del sujeto');

-- ── (10) CASO M=0: PTEST_E no tiene votos confirmados → 0 filas (empty honesto,
--         nunca NaN/Inf ni fila fabricada). ──────────────────────────────────────
select is(
  (select count(*)::int from public.tasa_ausencia_comparada('PTEST_E')),
  0,
  'tasa_ausencia_comparada devuelve 0 filas para un parlamentario sin votos (M=0, empty honesto)');

select * from finish();
rollback;
