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
--   * WR-02: el `ventana` de nuevos_ingresos declara la VENTANA REAL ('7d'), NUNCA el piso de
--     corpus ('2022-2026') — el label no confunde un conteo de 7 días con un total 4-años.
--   * WR-01: con la fuente de tramitación STALE (max(fecha) > umbral), las señales
--     temporales-pasadas (velocity/nuevos_ingresos/urgencias/archivados) emiten FILA de
--     supresión (supresion_causa NOT NULL), NUNCA una fila conteo=0 con causa NULL
--     (0-como-hecho prohibido, ausencia ≠ hecho).
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
select plan(17);

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

-- ── (D1) ninguna señal TEMPORAL-PASADA alimenta una fecha futura ──────────────
-- El typo 2626-05-25 NO debe aparecer en fecha_max de ninguna señal anclada a
-- eventos pasados (velocity/nuevos_ingresos/urgencias/archivados). Las señales de
-- AGENDA (agenda_citacion/agenda_sala) son futuras POR DISEÑO (citaciones/sesiones
-- próximas) → se excluyen del assert; su futuridad es un hecho, no el typo.
select is(
  (select count(*)::int from actualidad_senal
     where fecha_max > current_date
       and tipo_senal not in ('agenda_citacion','agenda_sala')),
  0, 'D1: ninguna señal temporal-pasada tiene fecha_max futura (typo 2626 filtrado por fecha <= current_date; agenda excluida por ser futura por diseño)');

-- ── (D2) camara normalizada: las dos grafías colapsan a un solo bucket ────────
-- Sembramos C.Diputados y C. Diputados; velocity DEBE agruparlas en una sola
-- cobertura_camara. Nunca dos buckets separados por espacio.
select is(
  (select count(distinct cobertura_camara)::int from actualidad_senal
     where tipo_senal = 'velocity'
       and cobertura_camara ~ '[Dd]iputados'),
  1, 'D2: las dos grafías de camara colapsan a un solo bucket tras regexp_replace');
-- El régimen viejo pedía "sin espacios" (grafía cruda tipo `C.Diputados`); desde 0080 la
-- grafía es CIUDADANA y SÍ tiene espacios ('Cámara de Diputados') — el assert de abajo es
-- más fuerte que el anterior, no más débil: exige la grafía exacta, no solo "sin \s".
select is(
  (select bool_and(cobertura_camara = 'Cámara de Diputados')
     from actualidad_senal
    where tipo_senal = 'velocity' and cobertura_camara ~ '[Dd]iputados'),
  true, 'D2: la cobertura_camara de velocity es la grafía ciudadana única "Cámara de Diputados" (PANEL-06/4-15, fijada por actualidad.grafia_camara)');

-- ── (D3) supresión-como-fila cuando la fuente está stale ──────────────────────
-- WR-01 (code-review 127) — ESTE ASSERT ERA NO DETERMINISTA Y ESTABA ROJO EN PROD.
-- El test sembraba CERO sesiones de sala y asumía que PROD tampoco tenía ninguna FUTURA. Falso:
-- PROD tiene agenda de sala futura (agenda_sala|Cámara de Diputados|1, agenda_sala|Senado|2) ⇒ el
-- `if exists (select 1 from public.sesion_sala where fecha::date >= current_date)` del proc tomaba
-- la rama POSITIVA ⇒ jamás se emitía fila con supresion_causa ⇒ `count = 0 >= 1` fallaba. Era
-- determinísticamente ROJO mientras PROD tuviera sala agendada y determinísticamente VERDE el fin
-- de semana legislativo — peor que un rojo estable.
-- FIX (misma medicina que 0080_actualidad_evidencia.test.sql): hacer la ausencia GARANTIZADA
-- DENTRO de la transacción. El delete cascadea a sesion_tabla_item y se rollbackea al final, así
-- que PROD no se toca. Va DESPUÉS de D1/D2 (que no dependen de sala) y ANTES del bloque WR-01 de
-- tramitación de más abajo.
delete from public.sesion_sala where fecha::date >= current_date;
select actualidad.materializar_senales();

-- Recién ahora la ausencia de sesiones futuras es un HECHO de la transacción: el proc DEBE
-- emitir una FILA de supresión (agenda_sala) con supresion_causa NOT NULL, nunca ausencia.
select cmp_ok(
  (select count(*)::int from actualidad_senal
     where tipo_senal = 'agenda_sala' and supresion_causa is not null),
  '>=', 1,
  'D3: agenda_sala sin futuras emite fila con supresion_causa (supresión-como-fila, no ausencia)');
-- y esa fila NUNCA afirma un conteo positivo como hecho (0-como-hecho prohibido).
-- WR-02 (code-review 127) — este assert PASABA VACUAMENTE: `coalesce(sum(conteo), 0) = 0` da 0
-- cuando NO EXISTE NINGUNA fila de supresión, que era justamente el estado en que el assert de
-- arriba fallaba. Salía `ok` con CERO filas evaluadas — el gotcha "cero fuerte vs cero vacuo" de
-- v12.0 — y su verde amortiguaba la lectura del rojo de arriba. `bool_and` devuelve NULL sobre
-- cero filas, y `is(NULL, true)` FALLA ⇒ el assert ya no puede pasar sin denominador.
select is(
  (select bool_and(conteo = 0) from actualidad_senal
     where tipo_senal = 'agenda_sala' and supresion_causa is not null),
  true, 'D3: la fila de supresión no afirma conteo positivo (0-como-hecho prohibido; bool_and mata el cero vacuo)');

-- ── (WR-02) nuevos_ingresos declara la VENTANA REAL, no el piso de corpus ─────
-- La fuente está fresca (eventos recientes sembrados arriba) → nuevos_ingresos emite fila(s)
-- positiva(s). El `ventana` DEBE ser '7d' (la ventana de conteo real), NUNCA '2022-2026'
-- (que es el piso de corpus, no la ventana). Confundir un conteo de 7 días con un total
-- 4-años es la mentira de label que WR-02 prohíbe.
select is(
  (select count(*)::int from actualidad_senal
     where tipo_senal = 'nuevos_ingresos' and ventana = '2022-2026'),
  0, 'WR-02: nuevos_ingresos NUNCA etiqueta ventana=2022-2026 (el piso de corpus no es la ventana)');
select cmp_ok(
  (select count(*)::int from actualidad_senal
     where tipo_senal = 'nuevos_ingresos' and ventana = '7d'),
  '>=', 1,
  'WR-02: nuevos_ingresos etiqueta ventana=7d (la ventana de conteo real)');

-- ── (WR-01) fuente de tramitación STALE → supresión-como-fila, NUNCA 0-como-hecho ─
-- Reescenario: la frescura la decide el max(fecha) SANEADO (fecha <= current_date) de
-- tramitacion_evento, así que para simular una fuente stale hay que sacar de en medio los eventos
-- RECIENTES (no basta el boletín seed — PROD tiene eventos frescos que dejarían la fuente fresca).
-- Esta transacción se ROLLBACKea al final (finish), por lo que el borrado NUNCA toca PROD.
--
-- WR-07 (code-review 127) — el borrado está ACOTADO A LA VENTANA DE FRESCURA. La versión anterior
-- hacía `delete from tramitacion_evento;` a secas: 48.409 filas en la corrida de 127-03. Se
-- rollbackeaba, sí, pero mientras la transacción vivía la tabla quedaba con RowExclusiveLock sobre
-- 48k filas — un upsert del ingestor o del cron de novedades corriendo en paralelo (11/14/17/20
-- UTC) SE BLOQUEABA hasta el rollback, y cada corrida dejaba ~48k tuplas muertas para el
-- autovacuum. Borrando sólo `fecha >= current_date - 7 days` (y <= current_date) se consigue
-- EXACTAMENTE el mismo escenario —max(fecha saneada) queda por debajo del umbral— tocando dos
-- órdenes de magnitud menos filas. Las filas FUTURAS (typo 2626) no se tocan: el cálculo de
-- frescura ya las filtra con `fecha <= current_date`, y así el assert D1 de más arriba conserva
-- su sujeto.
delete from tramitacion_evento
 where fecha >= current_date - interval '7 days'   -- `>=`: si quedara un evento EXACTAMENTE en el
   and fecha <= current_date;                      -- umbral, `max >= current_date - 7` daría FRESCA
insert into tramitacion_evento
  (boletin, fecha, camara, tipo, descripcion, origen)
values
  -- evento único, VIEJO (30 días atrás > umbral 7d) → max(fecha) de la fuente es stale
  ('99001-99', current_date - interval '30 days', 'C.Diputados', 'urgencia',
   'Hace presente la urgencia', 'test');
-- Re-materializar con la fuente ahora stale.
select actualidad.materializar_senales();

-- Cada señal temporal-pasada emite EXACTAMENTE una fila de supresión (causa NOT NULL).
select is(
  (select count(*)::int from actualidad_senal
     where tipo_senal in ('velocity','nuevos_ingresos','urgencias','archivados')
       and supresion_causa is not null),
  4,
  'WR-01: fuente stale → las 4 señales temporales-pasadas emiten fila de supresión (causa NOT NULL)');

-- Y NINGUNA de esas señales emite la fila prohibida conteo=0 con supresion_causa NULL.
select is(
  (select count(*)::int from actualidad_senal
     where tipo_senal in ('velocity','nuevos_ingresos','urgencias','archivados')
       and supresion_causa is null),
  0,
  'WR-01: ninguna señal temporal-pasada emite conteo=0 con causa NULL (0-como-hecho prohibido)');

-- Ninguna de esas filas de supresión afirma un conteo positivo como hecho.
select is(
  (select coalesce(sum(conteo), 0)::int from actualidad_senal
     where tipo_senal in ('velocity','nuevos_ingresos','urgencias','archivados')
       and supresion_causa is not null),
  0,
  'WR-01: las filas de supresión no afirman conteo positivo (0-como-hecho prohibido)');

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
