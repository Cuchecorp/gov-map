-- 0049_cruces_de_proyecto.test.sql
-- Verifica 0049 (SURF-02: cruces de proyecto) CONTRA SCHEMA APLICADO.
-- Corre vía `psql -tA -f` contra PROD aplicado (Phase 23 pattern), begin;…;rollback;.
-- NO vive en el glob de vitest (la suite globea solo .test.{ts,tsx}); lo corre el
-- OPERADOR a mano el día del apply (checkpoint Plan 03, patrón 52-06). `tsc`/`pnpm test`
-- NO prueban que Postgres ejecutó el DDL — esta es la única prueba válida. Idiom del
-- proyecto (0041/0047/0048): `array_to_string(proargnames, ',')` para el orden posicional;
-- el idiom basado en el texto del resultado de la función está PROHIBIDO por convención.
-- Siembra datos mínimos en la transacción de test (rollback), NUNCA depende de datos PROD.
begin;
select plan(10);

-- ── (1) la función existe con la firma de parámetros (text) ────────────────────
select has_function(
  'public', 'cruces_de_proyecto', array['text'],
  'cruces_de_proyecto(text) existe con la firma de parámetro esperada');

-- ── (2) el returns table declara las columnas EXACTAS en ORDEN posicional ──────
-- El cliente (Plan 02) mapea por posición/nombre; reorder/columna faltante = bug silente.
-- Contrato pineado a 9 nombres (p_boletin + 8 columnas del returns table).
select is(
  (select array_to_string(proargnames, ',')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'cruces_de_proyecto'),
  'p_boletin,parlamentario_id,nombre_normalizado,sector_id,sector_etiqueta,tipo_senal,conteo,evidencia,fecha_captura',
  'cruces_de_proyecto emite las 8 columnas en el orden pineado del contrato');

-- ── (3) es security definer (lee parlamentario/cruce_senal interno, emite derivado público) ─
select is(
  (select prosecdef
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'cruces_de_proyecto'),
  true,
  'cruces_de_proyecto es security definer');

-- ── (4) proconfig fija search_path='' (V8: nombres calificados con schema) ──────
select ok(
  (select array_to_string(proconfig, ',')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'cruces_de_proyecto')
    like '%search_path=%',
  'cruces_de_proyecto fija set search_path= en proconfig');

-- ── (5) anon NO tiene EXECUTE (Camino A post-0044: deny; el sitio lee con
--        service_role que bypassa ACL). El doble revoke explícito de 0049 hace
--        esto determinista ante los DEFAULT PRIVILEGES del rol de aplicación. ──
select ok(
  not has_function_privilege('anon', 'public.cruces_de_proyecto(text)', 'execute'),
  'anon NO tiene EXECUTE sobre cruces_de_proyecto (Camino A post-0044: deny)');

-- ── (6) no-PII: el returns table NUNCA declara partido/rut/email (LEGAL-03) ─────
-- (parlamentario/cruce_senal se LEEN internamente vía security definer, pero jamás se
-- devuelve partido/rut/email al cliente — solo parlamentario_id + nombre_normalizado + sector).
select is(
  (select array_to_string(proargnames, ',')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'cruces_de_proyecto')
    !~* '\y(partido|rut|email)\y',
  true,
  'el returns table de cruces_de_proyecto NO expone partido/rut/email (no-PII)');

-- ── Fixture mínimo para los asserts de DATOS (7)(8)(9)(10) ─────────────────────
-- Sembrado ÍNTEGRO en la transacción (rollback), NUNCA datos PROD. Dos parlamentarios
-- (con partido NO-null para probar que el returns table NO lo filtra), un sector de
-- prueba, un boletín CON ficha/sector (BTEST-38) y otro SIN ficha (BTEST-NOSEC), una
-- votación con voto 'si' confirmado (PTEST_SURF entra en "a favor") y un voto 'no'
-- (PTEST_NO queda fuera), y cruces de lobby en el sector para AMBOS parlamentarios.
insert into public.parlamentario (id, nombre_normalizado, camara, periodo, partido, origen, enlace)
values
  ('PTEST_SURF', 'test surf', 'diputados', '2022-2026', 'PART_TEST', 'test', 'http://x'),
  ('PTEST_NO',   'test no',   'diputados', '2022-2026', 'PART_TEST', 'test', 'http://x');

-- sector de prueba (codigo fuera del seed de 0038 → sin colisión de PK en el rollback).
insert into public.sector (codigo, etiqueta)
values ('sec_test', 'Sector de prueba');

-- boletín CON sector (BTEST-38) y boletín SIN ficha (BTEST-NOSEC).
insert into public.proyecto (boletin, boletin_num, titulo, origen, enlace)
values
  ('BTEST-38',    'BTEST', 'Proyecto de prueba cruce de proyecto', 'test', 'http://x'),
  ('BTEST-NOSEC', 'BTNOS', 'Proyecto de prueba SIN sector',        'test', 'http://x');

-- ficha SOLO para BTEST-38, con sector clasificado (Alt B). BTEST-NOSEC NO tiene ficha →
-- el CTE `sec` queda vacío → 0 filas (empty honesto, sin fabricar sector).
insert into public.proyecto_ficha (boletin, sector_id, origen)
values ('BTEST-38', 'sec_test', 'test');

-- votaciones: una por boletín. camara/origen/enlace NOT NULL.
insert into public.votacion (id, boletin, camara, origen, enlace)
values
  ('vtest:38',    'BTEST-38',    'diputados', 'test', 'http://x'),
  ('vtest:nosec', 'BTEST-NOSEC', 'diputados', 'test', 'http://x');

-- votos: PTEST_SURF 'si' confirmado (entra en afavor de ambos boletines);
--        PTEST_NO 'no' confirmado en BTEST-38 (queda EXCLUIDO de afavor).
insert into public.voto (votacion_id, mencion_nombre, parlamentario_id, seleccion, metodo, estado_vinculo)
values
  ('vtest:38',    'test surf', 'PTEST_SURF', 'si', 'determinista', 'confirmado'),
  ('vtest:38',    'test no',   'PTEST_NO',   'no', 'determinista', 'confirmado'),
  -- PTEST_SURF vota 'si' confirmado en BTEST-NOSEC: el set "a favor" NO está vacío, así
  -- que el 0 del assert (10) proviene ÚNICAMENTE del CTE `sec` vacío (sin ficha/sector),
  -- aislando la ruta de sector (NUNCA se fabrica el sector).
  ('vtest:nosec', 'test surf', 'PTEST_SURF', 'si', 'determinista', 'confirmado');

-- cruces de lobby en el sector de prueba para AMBOS parlamentarios (conteo neutro).
-- PTEST_NO tiene cruce en el sector pero votó 'no' → el join afavor lo excluye igual.
insert into public.cruce_senal
  (parlamentario_id, sector_id, tipo_senal, conteo, evidencia, dataset, origen, enlace)
values
  ('PTEST_SURF', 'sec_test', 'lobby_sector', 3,
   jsonb_build_object('conteo', 3, 'items', jsonb_build_array(
     jsonb_build_object('tipo','reunion','fecha',null,
       'contraparte_nombre_crudo','Gestor de prueba','audiencia_id','ATEST-1','enlace_fuente','http://x'))),
   'lobby', 'test', 'http://x'),
  ('PTEST_NO', 'sec_test', 'lobby_sector', 1,
   jsonb_build_object('conteo', 1, 'items', jsonb_build_array(
     jsonb_build_object('tipo','reunion','fecha',null,
       'contraparte_nombre_crudo','Gestor de prueba','audiencia_id','ATEST-2','enlace_fuente','http://x'))),
   'lobby', 'test', 'http://x');

-- ── (7) POSITIVO: el parlamentario que votó 'si' confirmado Y tiene cruce en el
--        sector del proyecto aparece UNA vez (una fila por parlamentario). ───────
select is(
  (select count(*)::int from public.cruces_de_proyecto('BTEST-38')
     where parlamentario_id = 'PTEST_SURF'),
  1,
  'cruces_de_proyecto devuelve al parlamentario a-favor con cruce en el sector (una fila)');

-- ── (8) la fila trae el derivado público esperado (nombre + etiqueta de sector) ─
select is(
  (select nombre_normalizado || '|' || sector_etiqueta
     from public.cruces_de_proyecto('BTEST-38')
    where parlamentario_id = 'PTEST_SURF' limit 1),
  'test surf|Sector de prueba',
  'cruces_de_proyecto emite nombre_normalizado + sector_etiqueta correctos (sin partido)');

-- ── (9) CASO NEGATIVO (voto): PTEST_NO votó 'no' → NO está en "a favor", pese a
--        tener un cruce en el MISMO sector. La intersección es con votos 'si'. ──
select is(
  (select count(*)::int from public.cruces_de_proyecto('BTEST-38')
     where parlamentario_id = 'PTEST_NO'),
  0,
  'cruces_de_proyecto EXCLUYE al parlamentario que votó no (solo si-confirmado entra)');

-- ── (10) CASO NEGATIVO (sector): un boletín SIN fila en proyecto_ficha devuelve 0
--         filas (empty honesto) aunque haya votos 'si' confirmados — NUNCA fabrica
--         el sector vía comisión ni catch-all. ────────────────────────────────
select is(
  (select count(*)::int from public.cruces_de_proyecto('BTEST-NOSEC')),
  0,
  'cruces_de_proyecto devuelve 0 filas para un boletín sin sector (empty honesto, sin fabricar)');

select * from finish();
rollback;
