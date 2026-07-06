-- 0048_lobby_en_tramitacion.test.sql
-- Verifica 0048 (SC2/SC5: lobby en tramitación) CONTRA SCHEMA APLICADO.
-- Corre vía `psql -tA -f` contra PROD aplicado (Phase 23 pattern), begin;…;rollback;.
-- NO vive en el glob de vitest (la suite globea solo .test.{ts,tsx}); lo corre el
-- OPERADOR a mano el día del apply (checkpoint 52-06). Idiom del proyecto (0041/0047):
-- `array_to_string(proargnames, ',')` para el orden posicional; el idiom basado en el
-- texto del resultado de la función está PROHIBIDO por convención. Siembra datos mínimos
-- en la transacción de test (rollback), NUNCA depende de datos PROD.
begin;
select plan(9);

-- ── (1) la función existe con la firma de parámetros (text) ────────────────────
select has_function(
  'public', 'lobby_en_tramitacion', array['text'],
  'lobby_en_tramitacion(text) existe con la firma de parámetro esperada');

-- ── (2) el returns table declara las columnas EXACTAS en ORDEN posicional ──────
-- El cliente (52-03) mapea por posición; reorder/columna faltante = bug silente.
-- El contrato está LOCKED (52-03 lo consume verbatim).
select is(
  (select array_to_string(proargnames, ',')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'lobby_en_tramitacion'),
  'p_boletin,parlamentario_nombre,camara,materia,fecha_reunion,semana_iso,comision,enlace_detalle',
  'lobby_en_tramitacion emite las 7 columnas en el orden pineado del contrato LOCKED');

-- ── (3) es security definer (lee parlamentario interno, emite solo derivado público) ─
select is(
  (select prosecdef
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'lobby_en_tramitacion'),
  true,
  'lobby_en_tramitacion es security definer');

-- ── (4) proconfig fija search_path='' (V8: nombres calificados con schema) ──────
select ok(
  (select array_to_string(proconfig, ',')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'lobby_en_tramitacion')
    like '%search_path=%',
  'lobby_en_tramitacion fija set search_path= en proconfig');

-- ── (5) anon NO tiene EXECUTE (Camino A post-0044: deny; el sitio lee con
--        service_role que bypassa ACL). El doble revoke explícito de 0048 hace
--        esto determinista ante los DEFAULT PRIVILEGES del rol de aplicación. ──
select ok(
  not has_function_privilege('anon', 'public.lobby_en_tramitacion(text)', 'execute'),
  'anon NO tiene EXECUTE sobre lobby_en_tramitacion (Camino A post-0044: deny)');

-- ── (6) no-PII: el returns table NUNCA declara partido/rut/email (LEGAL-03) ─────
-- (parlamentario se LEE internamente vía security definer, pero jamás se devuelve
-- partido/rut/email al cliente — solo nombre_normalizado + camara).
select is(
  (select array_to_string(proargnames, ',')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'lobby_en_tramitacion')
    !~* '\y(partido|rut|email)\y',
  true,
  'el returns table de lobby_en_tramitacion NO expone partido/rut/email (no-PII)');

-- ── Fixture mínimo para los asserts de DATOS (7)(8)(9) ─────────────────────────
-- Un parlamentario confirmado + un boletín de prueba + una citación de comisión en la
-- semana ISO '2024-W10' + un punto con ese boletín + una audiencia de lobby cuya fecha
-- (2024-03-06, ISO week 10 bajo America/Santiago) cae en ESA misma semana. Además una
-- audiencia en OTRA semana ('2024-04-10', ISO week 15) que NO debe aparecer.
insert into public.parlamentario (id, nombre_normalizado, camara, periodo, partido, origen, enlace)
values ('PTEST_LOB', 'test lobby', 'diputados', '2022-2026', 'PART_TEST', 'test', 'http://x');

insert into public.proyecto (boletin, boletin_num, titulo, origen, enlace)
values ('BTEST-01', 'BTEST', 'Proyecto de prueba cruce lobby', 'test', 'http://x');

-- citación de comisión en la semana ISO 2024-W10 (semana_iso es "IYYY-Www").
insert into public.citacion (id, camara, comision, fecha, semana_iso, origen, enlace)
values ('ctest:1', 'camara', 'Comisión de Prueba', timestamptz '2024-03-05 10:00:00-03',
        '2024-W10', 'test', 'http://x');

insert into public.citacion_punto (citacion_id, posicion, boletin)
values ('ctest:1', 0, 'BTEST-01');

-- audiencia de lobby CONFIRMADA en la MISMA semana ISO (2024-03-06 = ISO week 10).
insert into public.lobby_audiencia
  (identificador, institucion_codigo, parlamentario_id, mencion_sujeto, estado_vinculo,
   fecha, materia, enlace_detalle, origen, enlace)
values
  ('ATEST-MATCH', 'INST01', 'PTEST_LOB', 'test lobby', 'confirmado',
   timestamptz '2024-03-06 15:00:00-03', 'Materia de la audiencia', 'http://detalle', 'test', 'http://x'),
  -- audiencia en OTRA semana ISO (2024-04-10 ≈ ISO week 15): NO debe aparecer.
  ('ATEST-OTHER', 'INST01', 'PTEST_LOB', 'test lobby', 'confirmado',
   timestamptz '2024-04-10 15:00:00-03', 'Materia otra semana', 'http://detalle2', 'test', 'http://x');

-- ── (7) COINCIDENCIA POR SEMANA: la audiencia de la misma semana ISO aparece
--        (count = 1); la de otra semana queda EXCLUIDA (no se cuela). ───────────
select is(
  (select count(*)::int from public.lobby_en_tramitacion('BTEST-01')),
  1,
  'lobby_en_tramitacion devuelve exactamente 1 fila (la audiencia de la misma semana ISO; la de otra semana NO)');

-- ── (8) la fila trae el derivado público esperado (nombre/semana/comisión) ─────
select is(
  (select parlamentario_nombre || '|' || semana_iso || '|' || comision
     from public.lobby_en_tramitacion('BTEST-01') limit 1),
  'test lobby|2024-W10|Comisión de Prueba',
  'lobby_en_tramitacion emite nombre_normalizado + semana_iso + comisión correctos');

-- ── (9) CASO NEGATIVO explícito: la audiencia de otra semana (ATEST-OTHER) NO
--        está en el resultado (la coincidencia es por SEMANA, no por parlamentario). ─
select is(
  (select count(*)::int from public.lobby_en_tramitacion('BTEST-01')
     where enlace_detalle = 'http://detalle2'),
  0,
  'lobby_en_tramitacion NO incluye la audiencia de otra semana ISO (yuxtaposición temporal real)');

select * from finish();
rollback;
