-- 0047_rebeldias_honestas.test.sql
-- Verifica 0047 (SC5/B5: rebeldías honestas) CONTRA SCHEMA APLICADO.
-- Corre vía `psql -tA -f` contra PROD aplicado (Phase 23 pattern), begin;…;rollback;.
-- NO vive en el glob de vitest (la suite globea solo .test.{ts,tsx}); lo corre el
-- OPERADOR a mano el día del apply (checkpoint Task 4). Idiom del proyecto (0041):
-- `array_to_string(proargnames, ',')` para el orden posicional; el idiom basado en
-- el texto del resultado de la función está prohibido por convención. Siembra datos mínimos en la
-- transacción de test (rollback), NUNCA depende de datos PROD.
begin;
select plan(11);

-- ── (1) la función existe con la firma de parámetros (text) ────────────────────
select has_function(
  'public', 'rebeldias_de_parlamentario', array['text'],
  'rebeldias_de_parlamentario(text) existe con la firma de parámetro esperada');

-- ── (2) el returns table declara las columnas EXACTAS en ORDEN posicional ──────
-- El cliente (51-02) mapea por posición; reorder/columna faltante = bug silente.
select is(
  (select array_to_string(proargnames, ',')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rebeldias_de_parlamentario'),
  'p_id,votacion_id,boletin,titulo,etapa,fecha,seleccion_propia,mayoria_bancada',
  'rebeldias_de_parlamentario emite las 7 columnas en el orden pineado (titulo/etapa hidratados)');

-- ── (3) es security definer (lee partido interno, emite solo derivado público) ─
select is(
  (select prosecdef
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rebeldias_de_parlamentario'),
  true,
  'rebeldias_de_parlamentario sigue siendo security definer');

-- ── (4) proconfig fija search_path='' (V8: nombres calificados con schema) ──────
select ok(
  (select array_to_string(proconfig, ',')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rebeldias_de_parlamentario')
    like '%search_path=%',
  'rebeldias_de_parlamentario conserva set search_path= en proconfig');

-- ── (5) anon NO tiene EXECUTE (espejo de post-apply/0044_revoke_anon.test.sql:
--        Camino A = anon a cero grants; el sitio lee con service_role, que bypassa
--        ACL). El drop+recreate podría re-conceder por DEFAULT PRIVILEGES según el
--        rol de aplicación → el revoke explícito de 0047 hace esto determinista. ─
select ok(
  not has_function_privilege('anon', 'public.rebeldias_de_parlamentario(text)', 'execute'),
  'anon NO tiene EXECUTE sobre rebeldias_de_parlamentario (Camino A post-0044: deny)');

-- ── (6) no-PII: el cuerpo NUNCA emite partido/rut/email en el returns (LEGAL-03)
-- (partido se LEE internamente en la CTE `yo`, pero jamás se devuelve al cliente).
-- Assert acotado a la lista SELECT final: el cuerpo referencia `partido` para el
-- cómputo, así que verificamos que el returns table NO declara esas columnas.
select is(
  (select array_to_string(proargnames, ',')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rebeldias_de_parlamentario')
    !~* '\y(partido|rut|email)\y',
  true,
  'el returns table de rebeldias_de_parlamentario NO expone partido/rut/email (no-PII)');

-- ── Fixture mínimo para los asserts de DATOS (7)(8)(9)(10)(11) ─────────────────
-- Un partido de prueba con bancada que vota 'si'; un disidente real ('no', con fila
-- DUPLICADA para probar dedupe) y un ausente-puro (todas sus filas 'ausente').
-- Además un partido EMPATADO (2 'si' / 2 'no') para el caso sin-mayoría-única (10)
-- y un partido EMPATADO-CON-DUPLICADO (2 'si' / 2 'no' donde UNA fila 'si' viene
-- duplicada) para el caso CR-04 (11): la mayoría cuenta parlamentarios DISTINTOS,
-- no filas — el duplicado (3 filas 'si' / 2 'no' crudas) NO rompe el empate real.
insert into public.parlamentario (id, nombre_normalizado, camara, periodo, partido, origen, enlace)
values
  ('PTEST_A',   'test a',   'diputados', '2022-2026', 'PART_TEST', 'test', 'http://x'),
  ('PTEST_B',   'test b',   'diputados', '2022-2026', 'PART_TEST', 'test', 'http://x'),
  ('PTEST_C',   'test c',   'diputados', '2022-2026', 'PART_TEST', 'test', 'http://x'),
  ('PTEST_REB', 'test reb', 'diputados', '2022-2026', 'PART_TEST', 'test', 'http://x'),
  ('PTEST_AUS', 'test aus', 'diputados', '2022-2026', 'PART_TEST', 'test', 'http://x'),
  ('PTEST_E1',  'test e1',  'diputados', '2022-2026', 'PART_EMPATE', 'test', 'http://x'),
  ('PTEST_E2',  'test e2',  'diputados', '2022-2026', 'PART_EMPATE', 'test', 'http://x'),
  ('PTEST_E3',  'test e3',  'diputados', '2022-2026', 'PART_EMPATE', 'test', 'http://x'),
  ('PTEST_E4',  'test e4',  'diputados', '2022-2026', 'PART_EMPATE', 'test', 'http://x'),
  ('PTEST_D1',  'test d1',  'diputados', '2022-2026', 'PART_EMPDUP', 'test', 'http://x'),
  ('PTEST_D2',  'test d2',  'diputados', '2022-2026', 'PART_EMPDUP', 'test', 'http://x'),
  ('PTEST_D3',  'test d3',  'diputados', '2022-2026', 'PART_EMPDUP', 'test', 'http://x'),
  ('PTEST_D4',  'test d4',  'diputados', '2022-2026', 'PART_EMPDUP', 'test', 'http://x');

insert into public.proyecto (boletin, boletin_num, titulo, origen, enlace)
values ('BTEST-01', 'BTEST', 'Proyecto de prueba honestidad', 'test', 'http://x');

insert into public.votacion (id, boletin, fecha, etapa, camara, origen, enlace)
values ('vtest:1', 'BTEST-01', now(), 'Primer trámite', 'diputados', 'test', 'http://x');

insert into public.voto (votacion_id, mencion_nombre, parlamentario_id, seleccion, metodo, estado_vinculo)
values
  -- bancada: mayoría 'si'
  ('vtest:1', 'a',       'PTEST_A',   'si',      'determinista', 'confirmado'),
  ('vtest:1', 'b',       'PTEST_B',   'si',      'determinista', 'confirmado'),
  ('vtest:1', 'c',       'PTEST_C',   'si',      'determinista', 'confirmado'),
  -- disidente real: 'no' distinto de la mayoría 'si', con fila DUPLICADA (dedupe)
  ('vtest:1', 'reb 1',   'PTEST_REB', 'no',      'determinista', 'confirmado'),
  ('vtest:1', 'reb 2',   'PTEST_REB', 'no',      'determinista', 'confirmado'),
  -- ausente puro: bajo la vieja lógica ausente<>'si' habría contado como rebeldía
  ('vtest:1', 'aus',     'PTEST_AUS', 'ausente', 'determinista', 'confirmado'),
  -- bancada EMPATADA (2 'si' / 2 'no'): NO existe mayoría única → nadie es "rebelde"
  ('vtest:1', 'e1',      'PTEST_E1',  'si',      'determinista', 'confirmado'),
  ('vtest:1', 'e2',      'PTEST_E2',  'si',      'determinista', 'confirmado'),
  ('vtest:1', 'e3',      'PTEST_E3',  'no',      'determinista', 'confirmado'),
  ('vtest:1', 'e4',      'PTEST_E4',  'no',      'determinista', 'confirmado'),
  -- bancada EMPATADA con fila DUPLICADA (CR-04): 2 'si' / 2 'no' reales, pero D1
  -- trae su 'si' repetido → 3 filas 'si' / 2 filas 'no' crudas. Contando FILAS la
  -- mayoría 'si' se fabricaría y D3/D4 se publicarían como rebeldes de una bancada
  -- EMPATADA; contando parlamentarios DISTINTOS el empate 2/2 se preserva → 0 filas.
  ('vtest:1', 'd1 a',    'PTEST_D1',  'si',      'determinista', 'confirmado'),
  ('vtest:1', 'd1 b',    'PTEST_D1',  'si',      'determinista', 'confirmado'),
  ('vtest:1', 'd2',      'PTEST_D2',  'si',      'determinista', 'confirmado'),
  ('vtest:1', 'd3',      'PTEST_D3',  'no',      'determinista', 'confirmado'),
  ('vtest:1', 'd4',      'PTEST_D4',  'no',      'determinista', 'confirmado');

-- ── (7) EXCLUSIÓN DE AUSENCIAS: un parlamentario cuya única "disidencia" es una
--        ausencia devuelve 0 filas (una ausencia PROPIA no es "votó distinto"). ──
select is(
  (select count(*)::int from public.rebeldias_de_parlamentario('PTEST_AUS')),
  0,
  'rebeldias_de_parlamentario devuelve 0 filas cuando todas las disidencias son ausencias');

-- ── (8) DEDUPE: el disidente con fila duplicada aparece UNA sola vez por votación
select is(
  (select count(*)::int from public.rebeldias_de_parlamentario('PTEST_REB')),
  1,
  'rebeldias_de_parlamentario deduplica por votacion_id (una fila pese al voto duplicado)');

-- ── (9) TÍTULO hidratado: la fila de disidencia real trae el título del proyecto ─
select is(
  (select titulo from public.rebeldias_de_parlamentario('PTEST_REB') limit 1),
  'Proyecto de prueba honestidad',
  'rebeldias_de_parlamentario hidrata el título del proyecto vía left join a proyecto');

-- ── (10) EMPATE DE BANCADA: con 2 'si' / 2 'no' NO existe opción mayoritaria única
--         → 0 filas para CUALQUIER miembro (mode() habría elegido un valor arbitrario
--         y fabricado una "mayoría de bancada" inexistente — insinuación falsa). ──
select is(
  (select count(*)::int from public.rebeldias_de_parlamentario('PTEST_E1')),
  0,
  'rebeldias_de_parlamentario devuelve 0 filas cuando la bancada está empatada (sin mayoría única no hay disidencia afirmable)');

-- ── (11) EMPATE + FILA DUPLICADA (CR-04): la mayoría cuenta parlamentarios
--         DISTINTOS, no filas crudas — un 'si' duplicado (3 filas / 2 personas)
--         NO rompe el empate real 2/2 → 0 filas para cualquier miembro (contar
--         filas habría fabricado mayoría 'si' y publicado a los 'no' como
--         "votó distinto a la mayoría de su bancada" — insinuación falsa). ──────
select is(
  (select count(*)::int from public.rebeldias_de_parlamentario('PTEST_D3')),
  0,
  'rebeldias_de_parlamentario ignora filas duplicadas de bancada al computar la mayoría (empate real 2/2 se preserva → 0 filas)');

select * from finish();
rollback;
