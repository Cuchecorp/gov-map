-- 0065_actualidad_senal.test.sql
-- Verifica la migración 0065 (actualidad_senal + actualidad.materializar_senales + cron)
-- CONTRA UN SCHEMA APLICADO:
--   * `actualidad_senal` existe con RLS habilitada y es DENY-BY-DEFAULT (cero policies),
--   * anon NO lee `actualidad_senal` directamente (revoke all → 42501),
--   * `actualidad.materializar_senales()` existe y es SECURITY DEFINER,
--   * el cuerpo del proc NO contiene partido ni rut (no-PII, LEGAL-03),
--   * el cron 'actualidad-materializar' quedó registrado,
--   * DEFECTOS LOCKED del SPIKE (98-SPIKE §2) aplicados en el materializador:
--       (D1) ninguna fila `fecha > current_date` alimenta una señal (mata typo 2626-05-25),
--       (D2) `camara` se normaliza colapsando las dos grafías (`C.Diputados`/`C. Diputados`),
--       (D3) supresión = FILA con `supresion_causa` cuando la fuente está stale
--            (nunca ausencia-como-hecho, nunca 0-como-hecho).
--
-- Corre vía `psql -tA -f` (vs PROD APLICADO) (pgTAP). build/typecheck NO prueban que el DDL
-- se aplicó (falso positivo de CI, Pitfall 5). Espeja 0039_cruce_senal.test.sql style.
-- El proc lo crea 0065_actualidad_senal.sql; este test asume que 0065 ya fue aplicada
-- (apply + corrida = Plan 99-04, checkpoint operador).
--
-- NOTA sobre el umbral stale: el proc hardcodea 7 días (origen: packages/freshness/src/catalog.ts,
-- fuentes `leyes`/`agenda` umbralDias:7). El test siembra una fuente cuyo max(fecha saneada)
-- supera ese umbral y verifica que se emite la fila de supresión.

begin;
select plan(12);

-- ── Semilla (owner, bypassa RLS) ──────────────────────────────────────────────
-- Un proyecto de cobertura para las FK de tramitacion_evento/citacion/sesion_sala.
insert into proyecto
  (boletin, boletin_num, titulo, iniciativa, camara_origen, materia, estado, origen, enlace)
values
  ('99001-99', '99001', 'Proyecto de prueba actualidad', 'Moción', 'diputados',
   'Salud', 'En tramitación', 'test', 'http://x/99001');

-- (D1) fila FUTURA (typo 2626): NO debe alimentar ninguna señal.
-- (D2) dos grafías de cámara sobre eventos RECIENTES (dentro de la ventana 7d):
--      C.Diputados / C. Diputados deben colapsar a un solo bucket tras regexp_replace.
-- Anclamos a `fecha` reciente (movimiento velocity) y `fecha_captura` FRESCO (default now()).
insert into tramitacion_evento
  (boletin, fecha, camara, tipo, descripcion, origen)
values
  -- typo 2626: futuro → debe caer por el filtro fecha <= current_date (D1)
  ('99001-99', '2626-05-25', 'C.Diputados', 'oficio', 'Oficio de ley al Ejecutivo', 'test'),
  -- dos grafías, ambas dentro de la ventana de 7 días (D2 — colapsan a un bucket)
  ('99001-99', current_date - interval '1 day', 'C.Diputados',  'tramite', 'Cuenta de la moción', 'test'),
  ('99001-99', current_date - interval '2 day', 'C. Diputados', 'tramite', 'Primer trámite constitucional', 'test');

-- Poblar actualidad_senal desde los hechos sembrados (FULL REBUILD acotado).
select actualidad.materializar_senales();

-- ── actualidad_senal existe + RLS habilitada (espejo 0039 L57-60) ─────────────
select has_table('public', 'actualidad_senal', 'tabla actualidad_senal existe');
select is(
  (select count(*)::int from pg_class where relname = 'actualidad_senal' and relrowsecurity = true),
  1, 'RLS enabled en actualidad_senal');

-- ── DENY-BY-DEFAULT: cero policies sobre actualidad_senal (espejo 0039 L63-65) ─
select is(
  (select count(*)::int from pg_policies where tablename = 'actualidad_senal'),
  0, 'actualidad_senal sin policies (deny-by-default)');

-- ── actualidad.materializar_senales es SECURITY DEFINER (espejo 0039 L68-73) ──
select is(
  (select p.prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'actualidad' and p.proname = 'materializar_senales'),
  true,
  'actualidad.materializar_senales es security definer');

-- ── no-PII: el cuerpo NO referencia partido ni rut (espejo 0039 L77-82) ───────
-- Se STRIPEAN los comentarios `--` antes de buscar y se exige límite de palabra (\y).
select ok(
  (select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'actualidad' and p.proname = 'materializar_senales')
    !~* '\y(partido|rut)\y',
  'el cuerpo de materializar_senales NO contiene partido ni rut (no-PII, LEGAL-03)');

-- ── el cron actualidad-materializar quedó registrado (espejo 0039 L105-107) ───
select is(
  (select count(*)::int from cron.job where jobname = 'actualidad-materializar'),
  1, 'cron job actualidad-materializar registrado');

-- ── (D1) ninguna fila fecha > current_date alimenta una señal ─────────────────
-- El typo 2626-05-25 NO debe aparecer en fecha_max de NINGUNA señal materializada.
select is(
  (select count(*)::int from actualidad_senal where fecha_max > current_date),
  0, 'D1: ninguna señal tiene fecha_max futura (typo 2626 filtrado por fecha <= current_date)');

-- ── (D2) camara normalizada: las dos grafías colapsan a un solo bucket ────────
-- Sembramos C.Diputados y C. Diputados; velocity DEBE agruparlas en una sola
-- cobertura_camara. Nunca dos buckets separados por espacio.
select is(
  (select count(distinct cobertura_camara)::int from actualidad_senal
     where tipo_senal = 'velocity'
       and cobertura_camara ~ '[Dd]iputados'),
  1, 'D2: las dos grafías de camara colapsan a un solo bucket tras regexp_replace');
-- y el bucket normalizado NO contiene espacios internos (grafía saneada).
select is(
  (select bool_and(cobertura_camara !~ '\s')
     from actualidad_senal
    where tipo_senal = 'velocity' and cobertura_camara ~ '[Dd]iputados'),
  true, 'D2: la cobertura_camara de velocity no contiene espacios internos (normalizada)');

-- ── (D3) supresión-como-fila cuando la fuente está stale ──────────────────────
-- La fuente de sala (sesion_sala) NO tiene filas futuras (0 sembradas) → el proc DEBE
-- emitir una FILA de supresión (agenda_sala) con supresion_causa NOT NULL, nunca ausencia.
select cmp_ok(
  (select count(*)::int from actualidad_senal
     where tipo_senal = 'agenda_sala' and supresion_causa is not null),
  '>=', 1,
  'D3: agenda_sala sin futuras emite fila con supresion_causa (supresión-como-fila, no ausencia)');
-- y esa fila NUNCA afirma un conteo positivo como hecho (0-como-hecho prohibido).
select is(
  (select coalesce(sum(conteo), 0)::int from actualidad_senal
     where tipo_senal = 'agenda_sala' and supresion_causa is not null),
  0, 'D3: la fila de supresión no afirma conteo positivo (0-como-hecho prohibido)');

-- ── anon NO lee actualidad_senal directamente (deny-by-default → 42501) ───────
set local role anon;
select throws_ok(
  $$ select id from actualidad_senal $$,
  '42501',
  null,
  'anon NO lee actualidad_senal directamente (revoke all → insufficient_privilege 42501)');
reset role;

select * from finish();
rollback;
