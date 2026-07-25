-- 0068_coincidencia_votos_par.test.sql
-- Verifica la migración 0068 (RPC coincidencia de votos entre dos parlamentarios, VSIM-01)
-- CONTRA UN SCHEMA APLICADO:
--   * la RPC existe con la firma de entrada 2-arg (text, text),
--   * es SECURITY DEFINER (secdef scoped por regprocedure — WR-05: un `proname` a secas
--     erroraría ante un overload),
--   * anon Y authenticated NO recuperaron grant execute (DOBLE-revoke completo re-emitido
--     tras el DROP — WR-05: el leg authenticated debe testearse),
--   * proconfig fija search_path='' y statement_timeout=5s (molde 0064/0067, cota DoS),
--   * el returns table es EXACTAMENTE 3 columnas AGREGADAS
--     (n_coinciden bigint, m_compartidas bigint, fecha_captura_max timestamptz) —
--     NUNCA una lista per-votación (máquina de sospechas, fuera de alcance),
--   * DENOMINADOR SUSTANTIVA (VSIM-01, RESEARCH Test Map): sobre un par fixture, las filas
--     `pareo` y `no_confirmado` NO cuentan en m_compartidas — solo `si/no/abstencion` sobre
--     `estado_vinculo='confirmado'`; y n_coinciden ≤ m_compartidas,
--   * DEDUPE (WR-01): el unique real de `voto` es (votacion_id, fuente_voter_id), NO
--     (votacion_id, parlamentario_id) — una fila confirmada duplicada para la misma persona
--     en la misma votación NO infla N ni M; selecciones en conflicto EXCLUYEN la votación.
-- Corre vía `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f` (vs PROD aplicado).
-- Espeja 0067_militancia_historica_compartida.test.sql (has_function/is/ok, begin/plan(N)/rollback).
-- pgTAP es la ÚNICA prueba válida del DDL (Pitfall 6): typecheck no prueba que Postgres corrió el DDL.

begin;
select plan(14);

-- ── La RPC existe con su firma de entrada 2-arg (text, text) ─────────────────────────────
select has_function('public', 'coincidencia_votos_par', ARRAY['text','text'], 'coincidencia_votos_par(text,text) existe');

-- ── Es SECURITY DEFINER (scoped por regprocedure, WR-05) ─────────────────────────────────
select is(
  (select prosecdef from pg_proc where oid = 'public.coincidencia_votos_par(text,text)'::regprocedure),
  true,
  'coincidencia_votos_par es security definer');

-- ── CERO grant execute a anon (doble-revoke re-emitido tras el DROP) ─────────────────────
select is(has_function_privilege('anon', 'public.coincidencia_votos_par(text,text)', 'execute'), false, 'anon SIN execute sobre coincidencia_votos_par');

-- ── CERO grant execute a authenticated (2º leg del doble-revoke, WR-05) ──────────────────
select is(has_function_privilege('authenticated', 'public.coincidencia_votos_par(text,text)', 'execute'), false, 'authenticated SIN execute sobre coincidencia_votos_par');

-- ── proconfig: search_path fijado ('' schema-qualified, molde secdef) ────────────────────
select ok(
  (select array_to_string(proconfig, ',') from pg_proc
    where oid = 'public.coincidencia_votos_par(text,text)'::regprocedure) ~ 'search_path=',
  'search_path fijado en la función (secdef con nombres schema-qualified)');

-- ── proconfig: statement_timeout='5s' (molde 0064, cota DoS día-1) ───────────────────────
select ok(
  (select array_to_string(proconfig, ',') from pg_proc
    where oid = 'public.coincidencia_votos_par(text,text)'::regprocedure) ~ 'statement_timeout=5s',
  'statement_timeout=5s fijado en la función (RPC bounded, molde 0064)');

-- ── El returns table es EXACTAMENTE 3 columnas AGREGADAS (nunca lista per-votación) ──────
select is(
  pg_get_function_result('public.coincidencia_votos_par(text,text)'::regprocedure),
  'TABLE(n_coinciden bigint, m_compartidas bigint, fecha_captura_max timestamp with time zone)',
  'coincidencia_votos_par emite SOLO n_coinciden/m_compartidas/fecha_captura_max (3 agregados)');

-- ── FIXTURE (dentro de la transacción, se hace rollback): un par PA/PB con votaciones ────
--    sustantivas y NO-sustantivas para probar el denominador.
insert into parlamentario (id, nombre_normalizado, camara, periodo, origen, enlace)
values
  ('T68A', 'test parl a', 'diputados', '2022-2026', 'test:0068', 'https://test/0068'),
  ('T68B', 'test parl b', 'diputados', '2022-2026', 'test:0068', 'https://test/0068');

insert into proyecto (boletin, boletin_num, titulo, origen, enlace)
values ('68000-01', '68000', 'test proyecto 0068', 'test:0068', 'https://test/0068');

insert into votacion (id, boletin, camara, origen, enlace, fecha_captura)
values
  ('test:v68-1', '68000-01', 'diputados', 'test:0068', 'https://test/0068', '2024-01-01T00:00:00Z'),
  ('test:v68-2', '68000-01', 'diputados', 'test:0068', 'https://test/0068', '2024-02-01T00:00:00Z'),
  ('test:v68-3', '68000-01', 'diputados', 'test:0068', 'https://test/0068', '2024-03-01T00:00:00Z'),
  ('test:v68-4', '68000-01', 'diputados', 'test:0068', 'https://test/0068', '2024-04-01T00:00:00Z');

-- V1: ambos 'si' confirmado → cuenta y COINCIDE
-- V2: PA 'no' / PB 'si' confirmado → cuenta pero NO coincide
-- V3: ambos 'pareo' confirmado → NO cuenta (no sustantiva)
-- V4: ambos 'si' pero no_confirmado → NO cuenta (estado_vinculo != confirmado)
-- `fuente_voter_id` es NOT NULL con unique (votacion_id, fuente_voter_id) desde 0009 →
-- cada fila del fixture provee un discriminador distinto por votante (no derivar del nombre).
insert into voto (votacion_id, mencion_nombre, parlamentario_id, seleccion, estado_vinculo, fuente_voter_id)
values
  ('test:v68-1', 'mA1', 'T68A', 'si',    'confirmado',    'T68A'),
  ('test:v68-1', 'mB1', 'T68B', 'si',    'confirmado',    'T68B'),
  ('test:v68-2', 'mA2', 'T68A', 'no',    'confirmado',    'T68A'),
  ('test:v68-2', 'mB2', 'T68B', 'si',    'confirmado',    'T68B'),
  ('test:v68-3', 'mA3', 'T68A', 'pareo', 'confirmado',    'T68A'),
  ('test:v68-3', 'mB3', 'T68B', 'pareo', 'confirmado',    'T68B'),
  ('test:v68-4', 'mA4', 'T68A', 'si',    'no_confirmado', 'T68A'),
  ('test:v68-4', 'mB4', 'T68B', 'si',    'no_confirmado', 'T68B');

-- ── DENOMINADOR: m_compartidas cuenta SOLO las 2 sustantivas (V1,V2); pareo/no_confirmado NO
select is(
  (select m_compartidas from public.coincidencia_votos_par('T68A','T68B')),
  2::bigint,
  'm_compartidas=2 (pareo y no_confirmado excluidos del denominador)');

-- ── n_coinciden = 1 (solo V1) y n_coinciden ≤ m_compartidas ──────────────────────────────
select is(
  (select n_coinciden from public.coincidencia_votos_par('T68A','T68B')),
  1::bigint,
  'n_coinciden=1 (solo V1 coincide) y ≤ m_compartidas');

-- ── fecha_captura_max = la mayor de las votaciones sustantivas compartidas (V2, 2024-02) ──
select is(
  (select fecha_captura_max from public.coincidencia_votos_par('T68A','T68B')),
  '2024-02-01T00:00:00Z'::timestamptz,
  'fecha_captura_max = max de las votaciones sustantivas compartidas (no null, excluye pareo/no_confirmado)');

-- ── DEDUPE (WR-01): duplicado CONCORDANTE — segunda fila confirmada de T68A en V1 con la
--    MISMA seleccion bajo otro fuente_voter_id (legal: unique es votacion_id+fuente_voter_id).
--    Sin dedupe, el join 2×1 inflaría m_compartidas a 3 y n_coinciden a 2.
insert into voto (votacion_id, mencion_nombre, parlamentario_id, seleccion, estado_vinculo, fuente_voter_id)
values ('test:v68-1', 'mA1dup', 'T68A', 'si', 'confirmado', 'T68A-dup');

select is(
  (select m_compartidas from public.coincidencia_votos_par('T68A','T68B')),
  2::bigint,
  'WR-01: fila duplicada confirmada (mismo parlamentario+votacion, otro fuente_voter_id) NO infla m_compartidas');

select is(
  (select n_coinciden from public.coincidencia_votos_par('T68A','T68B')),
  1::bigint,
  'WR-01: fila duplicada confirmada NO infla n_coinciden');

-- ── DEDUPE (WR-01): duplicado CONTRADICTORIO — en V5 T68A tiene "si" Y "no" confirmados
--    (dato no confiable) y T68B "si". La votación entera queda FUERA de N y M (jamás
--    elegir una fila al azar bajo cifra pública gated).
insert into votacion (id, boletin, camara, origen, enlace, fecha_captura)
values ('test:v68-5', '68000-01', 'diputados', 'test:0068', 'https://test/0068', '2024-05-01T00:00:00Z');

insert into voto (votacion_id, mencion_nombre, parlamentario_id, seleccion, estado_vinculo, fuente_voter_id)
values
  ('test:v68-5', 'mA5a', 'T68A', 'si', 'confirmado', 'T68A'),
  ('test:v68-5', 'mA5b', 'T68A', 'no', 'confirmado', 'T68A-dup'),
  ('test:v68-5', 'mB5',  'T68B', 'si', 'confirmado', 'T68B');

select is(
  (select row(n_coinciden, m_compartidas, fecha_captura_max)::text from public.coincidencia_votos_par('T68A','T68B')),
  row(1::bigint, 2::bigint, '2024-02-01T00:00:00Z'::timestamptz)::text,
  'WR-01: seleccion en conflicto para la misma persona excluye la votación de N, M y fecha_captura_max');

-- ── SELF-PAIR (IN-01): el contrato de la RPC (no solo la UI) rechaza p_a = p_b —
--    devuelve (0, 0, null), jamás el 100% trivial de comparar a alguien consigo mismo.
select is(
  (select row(n_coinciden, m_compartidas, fecha_captura_max)::text from public.coincidencia_votos_par('T68A','T68A')),
  row(0::bigint, 0::bigint, null::timestamptz)::text,
  'IN-01: self-pair (p_a = p_b) devuelve 0/0/null, nunca 100% trivial');

select * from finish();
rollback;
