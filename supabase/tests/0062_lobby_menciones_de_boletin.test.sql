-- 0062_lobby_menciones_de_boletin.test.sql
-- Verifica la RPC lobby_menciones_de_boletin CONTRA UN SCHEMA APLICADO. Cubre 0062 Y su
-- FIX 0063 (CR-01/WR-01/WR-02/WR-03/IN-01 — una fila por audiencia + trailing period +
-- cobertura ampliada de FIXTURE_MATERIA + multi-contraparte + guard de p_boletin):
--   * la RPC existe con la firma esperada (text) y es SECURITY DEFINER,
--   * CERO grant execute a anon (Camino A doble-revoke),
--   * emite total_n (conteo honesto 0061) y NO filtra rut/email/contraparte_id,
--   * COMPORTAMIENTO fail-closed doble (guard de equivalencia TS↔SQL, filas concretas):
--       (a) forma con sufijo -NN → matchea; (b) número pelado tras "boletín" → matchea;
--       (b') WR-01: base pelada + PUNTO de fin de oración → matchea (espejo TS);
--       (b'') WR-02: base PUNTEADA tras gatillo ("boletín 14.309") + multi-boletín → matchea;
--       (c) "Ley 20.730" / pelado suelto / año / dinero → NO matchea;
--       (d) boletín inexistente en `proyecto` → NO matchea (fail-closed #2);
--       (e) audiencia no-confirmada / sin parlamentario_id → NO matchea (fail-closed identidad);
--       (f) CR-01/WR-03: audiencia con ≥2 contrapartes → aparece EXACTAMENTE 1 vez (una fila
--           por audiencia, NO por contraparte) con las contrapartes AGREGADAS y total_n honesto;
--       (g) IN-01: p_boletin malformado (metacaracteres / base vacía) → 0 filas (guard interno).
--     Las filas de prueba ESPEJAN el fixture compartido FIXTURE_MATERIA de
--     app/lib/boletin-en-materia.test.ts (equivalencia TS↔SQL demostrable — PLAN-CHECKER
--     FIX MAJOR 3: criterio de done, no discreción).
-- Corre vía `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f` (vs PROD aplicado).
-- build/typecheck NO prueban que el DDL se aplicó (falso positivo de CI, Pitfall 6).
-- Espeja 0060/0061.test.sql (has_function/is/ok, begin/plan(N)/rollback).

begin;
select plan(21);

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
-- NOT NULL sin default en el schema PROD aplicado: periodo, origen, enlace (además de id,
-- nombre_normalizado, camara) → se suministran para no violar constraints al correr vs PROD.
insert into public.parlamentario (id, nombre_normalizado, nombres, apellido_paterno, apellido_materno, camara, periodo, origen, enlace)
  values ('T92', 'test parlamentario', 'Test', 'Parlamentario', 'Uno', 'diputados', '2022-2026', 'test', 'http://x')
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
  ('T92AW6', 'AQ001', null,  'Test', 'confirmado', 'boletín 14309-04 sin parlamentario_id', 'test', 'http://x'), -- sin FK → NO
  -- (f) CR-01/WR-03: audiencia con ≥2 contrapartes (abajo) → debe aparecer EXACTAMENTE 1 vez.
  ('T92AW7', 'AQ001', 'T92', 'Test', 'confirmado', 'boletín 14309-04 multi-contraparte', 'test', 'http://x'),
  -- (b') WR-01: base pelada tras gatillo + PUNTO de fin de oración → match (espejo TS).
  ('T92AW8', 'AQ001', 'T92', 'Test', 'confirmado', 'reunión sobre boletín 14309.', 'test', 'http://x'),
  -- (b'') WR-02: base pelada + gatillo, con OTRO boletín multi en la misma materia → match.
  ('T92AW9', 'AQ001', 'T92', 'Test', 'confirmado', 'boletines 14309-04 y 15000-07', 'test', 'http://x'),
  -- (b'') WR-02: base PUNTEADA tras gatillo ("boletín 14.309") → match (colapsa a 14309).
  ('T92AWA', 'AQ001', 'T92', 'Test', 'confirmado', 'sobre el boletín 14.309 de pesca', 'test', 'http://x')
on conflict (identificador) do nothing;

-- (f) CR-01/WR-03: DOS contrapartes para UNA audiencia (T92AW7). Antes del fix 0063 el
-- left join fanea a 2 filas → total_n y el count por identificador mienten. Después del
-- fix la audiencia aparece 1 sola vez con las contrapartes agregadas.
insert into public.lobby_contraparte (identificador, nombre, rol, representado_text, origen, enlace)
values
  ('T92AW7', 'Contraparte Uno', 'lobbista', 'Firma A', 'test', 'http://x'),
  ('T92AW7', 'Contraparte Dos', 'gestor',   'Firma B', 'test', 'http://x')
on conflict (identificador, nombre, rol) do nothing;

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

-- total_n honesto: los 2 fixtures válidos del test (T92AW1 + T92AW2) aparecen y son contados.
-- NOTA: 14309-04 es un boletín REAL de PROD y puede tener audiencias reales que también
-- mencionen el número → el total_n absoluto NO es isolation-safe. La aserción honesta es que
-- (i) los 2 fixtures del test SÍ están en el resultado, y (ii) total_n es constante y ≥ 2
-- (count(*) over () honesto — cada fila reporta el mismo conteo global de menciones válidas).
select is(
  (select count(*) from public.lobby_menciones_de_boletin('14309-04') where identificador in ('T92AW1','T92AW2')),
  2::bigint,
  'los 2 fixtures válidos del test (T92AW1+T92AW2) son emitidos como menciones');
select ok(
  (select count(distinct total_n) from public.lobby_menciones_de_boletin('14309-04')) = 1
    and (select max(total_n) from public.lobby_menciones_de_boletin('14309-04')) >= 2,
  'total_n constante (count(*) over ()) y ≥ 2 (conteo honesto de menciones válidas)');

-- ── (b') WR-01: base pelada tras gatillo + PUNTO de fin de oración → mencionada ───────────
select ok(
  exists (select 1 from public.lobby_menciones_de_boletin('14309-04') where identificador = 'T92AW8'),
  '(b-1) "boletín 14309." (punto de fin de oración) → mencionada (WR-01, espejo TS)');

-- ── (b'') WR-02: multi-boletín en una materia → la base objetivo aparece ─────────────────
select ok(
  exists (select 1 from public.lobby_menciones_de_boletin('14309-04') where identificador = 'T92AW9'),
  '(b-2) "boletines 14309-04 y 15000-07" (multi) → 14309-04 mencionada (WR-02)');

-- ── (b'') WR-02: base PUNTEADA tras gatillo ("boletín 14.309") → aparece ─────────────────
select ok(
  exists (select 1 from public.lobby_menciones_de_boletin('14309-04') where identificador = 'T92AWA'),
  '(b-3) "boletín 14.309" (base punteada tras gatillo) → mencionada (WR-02)');

-- ── (f) CR-01/WR-03: audiencia con ≥2 contrapartes → EXACTAMENTE 1 fila (no fan-out) ──────
select is(
  (select count(*) from public.lobby_menciones_de_boletin('14309-04') where identificador = 'T92AW7'),
  1::bigint,
  '(f-1) CR-01: audiencia con 2 contrapartes aparece 1 SOLA vez (una fila por audiencia)');

-- ── (f) las contrapartes se AGREGAN en la fila (ambas presentes, no perdidas) ─────────────
select ok(
  (select contraparte_nombre
     from public.lobby_menciones_de_boletin('14309-04')
    where identificador = 'T92AW7')
    ~ 'Contraparte Uno'
  and (select contraparte_nombre
         from public.lobby_menciones_de_boletin('14309-04')
        where identificador = 'T92AW7')
    ~ 'Contraparte Dos',
  '(f-2) CR-01: las 2 contrapartes se AGREGAN en contraparte_nombre (ninguna se pierde)');

-- ── (f) total_n cuenta la audiencia multi-contraparte UNA vez (no por contraparte) ────────
-- total_n honesto = # de AUDIENCIAS distintas. T92AW7 (2 contrapartes) debe sumar 1, no 2.
-- Aserción isolation-safe: el total_n emitido == # de identificadores DISTINTOS del resultado
-- (si contara contraparte-filas, total_n > # de identificadores distintos por el fan-out).
select is(
  (select max(total_n) from public.lobby_menciones_de_boletin('14309-04')),
  (select count(distinct identificador) from public.lobby_menciones_de_boletin('14309-04')),
  '(f-3) CR-01: total_n == # de audiencias DISTINTAS (multi-contraparte contada 1 vez)');

-- ── (g) IN-01: p_boletin malformado → 0 filas (guard interno de formato) ──────────────────
select is(
  (select count(*) from public.lobby_menciones_de_boletin('(|)')),
  0::bigint,
  '(g-1) IN-01: p_boletin con metacaracteres regex → 0 filas (guard interno)');
select is(
  (select count(*) from public.lobby_menciones_de_boletin('')),
  0::bigint,
  '(g-2) IN-01: p_boletin vacío → 0 filas (no base vacía que matchee en todos lados)');

select * from finish();
rollback;
