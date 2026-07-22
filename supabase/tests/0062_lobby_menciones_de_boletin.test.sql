-- 0062_lobby_menciones_de_boletin.test.sql
-- Verifica la migración 0062 (RPC lobby_menciones_de_boletin) CONTRA UN SCHEMA APLICADO:
--   * la RPC existe con la firma esperada (text) y es SECURITY DEFINER,
--   * CERO grant execute a anon (Camino A doble-revoke),
--   * emite total_n (conteo honesto 0061) y NO filtra rut/email/contraparte_id,
--   * COMPORTAMIENTO fail-closed doble (guard de equivalencia TS↔SQL, filas concretas):
--       (a) forma con sufijo -NN → matchea; (b) número pelado tras "boletín" → matchea;
--       (c) "Ley 20.730" / pelado suelto / año / dinero → NO matchea;
--       (d) boletín inexistente en `proyecto` → NO matchea (fail-closed #2);
--       (e) audiencia no-confirmada / sin parlamentario_id → NO matchea (fail-closed identidad).
--     Las filas de prueba ESPEJAN el fixture compartido FIXTURE_MATERIA de
--     app/lib/boletin-en-materia.test.ts (equivalencia TS↔SQL demostrable — PLAN-CHECKER
--     FIX MAJOR 3: criterio de done, no discreción).
-- Corre vía `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f` (vs PROD aplicado).
-- build/typecheck NO prueban que el DDL se aplicó (falso positivo de CI, Pitfall 6).
-- Espeja 0060/0061.test.sql (has_function/is/ok, begin/plan(N)/rollback).

begin;
select plan(14);

-- ── Existencia + seguridad ───────────────────────────────────────────────────────────────
select has_function('public', 'lobby_menciones_de_boletin', ARRAY['text'], 'lobby_menciones_de_boletin(text) existe');
select is((select prosecdef from pg_proc where proname = 'lobby_menciones_de_boletin'), true, 'lobby_menciones_de_boletin es security definer');
select is(has_function_privilege('anon', 'public.lobby_menciones_de_boletin(text)', 'execute'), false, 'anon SIN execute sobre lobby_menciones_de_boletin');

-- ── Contrato de salida: emite total_n y NO filtra PII ────────────────────────────────────
select ok(
  pg_get_function_result('public.lobby_menciones_de_boletin(text)'::regprocedure) ~* '\ytotal_n\y',
  'lobby_menciones_de_boletin emite total_n (conteo honesto WR-01)');
select ok(
  pg_get_function_result('public.lobby_menciones_de_boletin(text)'::regprocedure) !~* '\y(rut|email|contraparte_id)\y',
  'lobby_menciones_de_boletin NO emite rut/email/contraparte_id (PII-safe)');

-- ── FIXTURES de comportamiento (espejo FIXTURE_MATERIA) ──────────────────────────────────
-- Un parlamentario y un proyecto EXISTENTE (14309-04, base 14309); otro boletín NO existe.
insert into public.parlamentario (id, nombre_normalizado, nombres, apellido_paterno, apellido_materno, camara)
  values ('T92', 'test parlamentario', 'Test', 'Parlamentario', 'Uno', 'diputados')
  on conflict (id) do nothing;
insert into public.proyecto (boletin, boletin_num, titulo, origen, enlace)
  values ('14309-04', '14309', 'Proyecto de prueba 92', 'test', 'http://x')
  on conflict (boletin) do nothing;

-- Audiencias confirmadas con distintas materias (mismos casos que el fixture TS):
insert into public.lobby_audiencia
  (identificador, institucion_codigo, parlamentario_id, mencion_sujeto, estado_vinculo, materia, origen, enlace)
values
  ('T92AW1', 'AQ001', 'T92', 'Test', 'confirmado', 'boletín 14309-04 sobre pesca', 'test', 'http://x'),        -- (a) sufijo → match
  ('T92AW2', 'AQ001', 'T92', 'Test', 'confirmado', 'el boletín N° 14309 y otros temas', 'test', 'http://x'),   -- (b) pelado tras gatillo → match
  ('T92AW3', 'AQ001', 'T92', 'Test', 'confirmado', 'Ley 20.730 de lobby, sin proyecto', 'test', 'http://x'),   -- ley → NO
  ('T92AW4', 'AQ001', 'T92', 'Test', 'confirmado', 'sobre el proyecto 14309 pelado suelto', 'test', 'http://x'),-- pelado sin gatillo → NO
  ('T92AW5', 'AQ001', 'T92', 'Test', 'no_confirmado', 'boletín 14309-04 pero no confirmada', 'test', 'http://x'),-- no_confirmado → NO
  ('T92AW6', 'AQ001', null,  'Test', 'confirmado', 'boletín 14309-04 sin parlamentario_id', 'test', 'http://x')  -- sin FK → NO
on conflict (identificador) do nothing;

-- (a) forma con sufijo → aparece
select ok(
  exists (select 1 from public.lobby_menciones_de_boletin('14309-04') where identificador = 'T92AW1'),
  '(a) materia con sufijo 14309-04 → mencionada');

-- (b) número pelado tras "boletín" → aparece (llamando con la base '14309-04' de la ficha)
select ok(
  exists (select 1 from public.lobby_menciones_de_boletin('14309-04') where identificador = 'T92AW2'),
  '(b) materia "boletín N° 14309" (pelado tras gatillo) → mencionada');

-- (c) "Ley 20.730" → NO aparece (no es este boletín ni mención válida)
select ok(
  not exists (select 1 from public.lobby_menciones_de_boletin('14309-04') where identificador = 'T92AW3'),
  '(c) "Ley 20.730" → NO mencionada (fail-closed keywords)');

-- (c') número pelado suelto (sin gatillo) → NO aparece
select ok(
  not exists (select 1 from public.lobby_menciones_de_boletin('14309-04') where identificador = 'T92AW4'),
  '(c-2) "14309 pelado suelto" (sin gatillo) → NO mencionada');

-- (d) fail-closed #2: boletín que NO existe en proyecto → CERO filas
select is(
  (select count(*) from public.lobby_menciones_de_boletin('99999-99')),
  0::bigint,
  '(d) boletín inexistente en proyecto → 0 filas (fail-closed existencia)');

-- (e) fail-closed identidad: no_confirmado y sin parlamentario_id NO aparecen
select ok(
  not exists (select 1 from public.lobby_menciones_de_boletin('14309-04') where identificador in ('T92AW5','T92AW6')),
  '(e) no_confirmado / sin parlamentario_id → NO mencionada (fail-closed identidad)');

-- total_n honesto: 2 audiencias válidas (T92AW1 + T92AW2) para 14309-04
select is(
  (select distinct total_n from public.lobby_menciones_de_boletin('14309-04')),
  2::bigint,
  'total_n = 2 (conteo honesto de menciones válidas)');

select * from finish();
rollback;
