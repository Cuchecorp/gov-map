-- 0080_actualidad_evidencia.test.sql
-- Verifica la migración 0080 (evidencia jsonb + actualidad.grafia_camara) CONTRA UN SCHEMA
-- APLICADO. Espeja el patrón de 0065_actualidad_senal.test.sql (begin → plan(N) → siembra owner
-- → select actualidad.materializar_senales() → asserts → finish → rollback).
--
-- Corre vía (NO hay runner de pgTAP en el repo, se corre a mano):
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0080_actualidad_evidencia.test.sql | tr -d '\r'
--
-- Este archivo asume que 0080 YA fue aplicada (apply + corrida real = plan 127-03). El plan
-- 127-02 SOLO escribe este archivo — no lo ejecuta.
--
-- Qué verifica:
--   * actualidad.grafia_camara(text) existe y unifica las grafías a la grafía CIUDADANA
--     ('Cámara de Diputados' / 'Senado' / '(sin cámara)'), incluyendo NULL.
--   * materializar_senales() sigue security definer con search_path fijado (D-09b).
--   * no-PII ampliado: el cuerpo del proc tampoco referencia `autores` (nombres de parlamentarios).
--   * cada fila POSITIVA (supresion_causa is null, no agrupacion_materia) trae evidencia con
--     'total'/'items'/'consultado_al'/'fuente', 'items' es un array real (Pitfall 3: jsonb_agg
--     vacío da NULL, no '[]'), paridad D-06 (conteo == total == jsonb_array_length(items)),
--     consultado_al == current_date, y fuente.dataset == la columna `dataset` de la MISMA fila
--     (anti-drift jsonb↔fila).
--   * guard 404 (D-05): un boletín fantasma sembrado (sin fila en `proyecto`) aparece anidado con
--     en_corpus:false y titulo/enlace null, apareado con un control positivo (boletín real,
--     en_corpus:true, titulo not null) — sin el par, el negativo sería un cero vacuo.
--   * supresión DETERMINISTA (Fable blocker 1 / checker B-4): el estado vivo de PROD cambia
--     4×/día y la siembra misma puede flipear señales a positivas, así que el count de filas
--     suprimidas a secas NO es determinista. En vez de eso: se corren TODOS los asserts
--     positivos (9-14, 17-20) PRIMERO, contra el estado que sea; DESPUÉS, dentro de la MISMA
--     transacción, se borran las sesion_sala futuras (cascadea a sesion_tabla_item, todo se
--     rollbackea) y se re-materializa — recién ahí la ausencia de sesiones futuras es
--     GARANTIZADA y agenda_sala DEBE emitir su fila de supresión con evidencia='{}' (D-09).
--   * agenda_sala conserva la unidad-sesión: sus ítems anidan `tabla` como array (D-02b).
--
-- Prohibido asertar cifras vivas de PROD (95 urgencias, 10/49, 39,7 KB): son datos que cambian a
-- diario (Assumption A1 del research). Los asserts de este archivo son ESTRUCTURALES.

begin;
select plan(20);

-- ── Semilla (owner, bypassa RLS; todo se rollbackea) ──────────────────────────
-- Proyecto testigo EN corpus (control positivo apareado del guard 404).
insert into proyecto
  (boletin, boletin_num, titulo, iniciativa, camara_origen, materia, estado, origen, enlace)
values
  ('99101-99', '99101', 'Proyecto testigo evidencia', 'Moción', 'diputados',
   'Salud', 'En tramitación', 'test', 'http://x/99101');

-- Eventos de tramitación: una urgencia (fechada) y un trámite con grafía cruda a normalizar
-- (alimenta velocity con 'C. Diputados' → debe emitir 'Cámara de Diputados').
insert into tramitacion_evento
  (boletin, fecha, camara, tipo, descripcion, origen)
values
  ('99101-99', current_date - 1, 'diputados', 'urgencia', 'Hace presente la urgencia', 'test'),
  ('99101-99', current_date - 2, 'C. Diputados', 'tramite', 'Cuenta de la moción', 'test');

-- Citación futura con dos puntos: uno en corpus (99101-99), uno fantasma (88888-88, SIN fila en
-- `proyecto` — citacion_punto.boletin es nullable y SIN foreign key, 0010:46-56).
insert into citacion
  (id, camara, comision, fecha, horario, sala, materia, semana_iso, origen, fecha_captura, enlace)
values
  ('test:cit:1', 'senado', 'Comisión de Prueba', current_date + 1, '10:00 a 12:00', null, null,
   to_char(current_date + 1, 'IYYY-"W"IW'), 'test', now(), 'http://x/cit');

insert into citacion_punto (citacion_id, posicion, boletin, materia)
values
  ('test:cit:1', 0, '99101-99', 'Salud'),
  ('test:cit:1', 1, '88888-88', 'Materia fantasma');  -- boletín fantasma, NO existe en proyecto

-- Sesión de sala futura con el mismo patrón (boletín en corpus + fantasma).
insert into sesion_sala (id, camara, fecha, numero, hora_inicio, tipo, origen, fecha_captura, enlace)
values
  ('test:ses:1', 'camara', current_date + 1, '1', '10:00', 'Ordinaria', 'test', now(), 'http://x/ses');

insert into sesion_tabla_item (sesion_id, posicion, parte_sesion, boletin, materia)
values
  ('test:ses:1', 0, 'ORDEN DEL DÍA', '99101-99', 'Salud'),
  ('test:ses:1', 1, 'ORDEN DEL DÍA', '88888-88', 'Materia fantasma');  -- boletín fantasma

-- Poblar actualidad_senal desde los hechos sembrados (FULL REBUILD acotado, 0065:108-112).
select actualidad.materializar_senales();

-- ── (1) grafia_camara existe ───────────────────────────────────────────────────
select has_function('actualidad', 'grafia_camara', array['text'], 'actualidad.grafia_camara(text) existe');

-- ── (2-5) grafia_camara unifica a la grafía ciudadana, incluyendo NULL (D-08) ──
select is(actualidad.grafia_camara('C. Diputados'), 'Cámara de Diputados',
  'grafia_camara(''C. Diputados'') → grafía ciudadana');
select is(actualidad.grafia_camara('camara'), 'Cámara de Diputados',
  'grafia_camara(''camara'') → grafía ciudadana');
select is(actualidad.grafia_camara('senado'), 'Senado',
  'grafia_camara(''senado'') → Senado');
select is(actualidad.grafia_camara(null), '(sin cámara)',
  'grafia_camara(null) → (sin cámara) (D-08)');

-- ── (6) materializar_senales sigue security definer tras el REPLACE de 0080 ───
select is(
  (select p.prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'actualidad' and p.proname = 'materializar_senales'),
  true,
  'actualidad.materializar_senales sigue security definer tras 0080');

-- ── (7) D-09b: el REPLACE restatea el search_path vacío (no lo pierde) ────────
select ok(
  (select coalesce(array_to_string(p.proconfig, ','), '') from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'actualidad' and p.proname = 'materializar_senales')
    like '%search_path=%',
  'D-09b: materializar_senales conserva su search_path fijado tras el create or replace');

-- ── (8) no-PII ampliado: tampoco referencia `autores` (nombres de parlamentarios) ─
-- Espeja 0065:77-83 (partido/rut); 0080 añade `autores` porque el bloque de evidencia ahora
-- expone `proyecto.*` y podría, por error futuro, colar autores al jsonb.
select ok(
  (select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'actualidad' and p.proname = 'materializar_senales')
    !~* '\y(partido|rut|autores)\y',
  'el cuerpo de materializar_senales NO contiene partido, rut ni autores (no-PII ampliado)');

-- ── (9) Control positivo apareado: existen filas positivas (sin este par, los ceros de
--        abajo serían vacuos — gotcha "cero fuerte vs cero vacuo" de v12.0) ───────────
select cmp_ok(
  (select count(*)::int from actualidad_senal
     where supresion_causa is null and tipo_senal <> 'agrupacion_materia'),
  '>=', 1,
  'control positivo: existe al menos una fila positiva (no-agrupacion_materia)');

-- ── (10) Toda positiva trae las 4 claves de evidencia (D-09) ───────────────────
select is(
  (select count(*)::int from actualidad_senal
     where supresion_causa is null and tipo_senal <> 'agrupacion_materia'
       and not (evidencia ? 'total' and evidencia ? 'items'
                and evidencia ? 'consultado_al' and evidencia ? 'fuente')),
  0,
  'toda señal positiva trae evidencia con total/items/consultado_al/fuente');

-- ── (11) 'items' es un array real, nunca NULL (Pitfall 3: jsonb_agg vacío da NULL) ─
select is(
  (select count(*)::int from actualidad_senal
     where supresion_causa is null and tipo_senal <> 'agrupacion_materia'
       and jsonb_typeof(evidencia->'items') is distinct from 'array'),
  0,
  'evidencia->items es siempre un array jsonb en toda señal positiva (jamás NULL)');

-- ── (12) Paridad D-06 / anti-cap D-03: conteo == total == jsonb_array_length(items) ─
select is(
  (select count(*)::int from actualidad_senal
     where supresion_causa is null and tipo_senal <> 'agrupacion_materia'
       and (conteo <> (evidencia->>'total')::int
            or (evidencia->>'total')::int <> jsonb_array_length(evidencia->'items'))),
  0,
  'D-06/anti-cap D-03: conteo == evidencia.total == jsonb_array_length(evidencia.items)');

-- ── (13) D-04: consultado_al == current_date en toda positiva ──────────────────
select is(
  (select count(*)::int from actualidad_senal
     where supresion_causa is null and tipo_senal <> 'agrupacion_materia'
       and (evidencia->>'consultado_al')::date is distinct from current_date),
  0,
  'D-04: evidencia.consultado_al == current_date en toda señal positiva');

-- ── (14) D-04b + Fable M2 (anti-drift jsonb↔fila): fuente.dataset == columna dataset ─
select is(
  (select count(*)::int from actualidad_senal
     where supresion_causa is null and tipo_senal <> 'agrupacion_materia'
       and (evidencia->'fuente'->>'dataset' is null
            or evidencia->'fuente'->>'dataset' is distinct from dataset)),
  0,
  'evidencia.fuente.dataset no es null y coincide con la columna dataset de la MISMA fila');

-- ── (17) Guard 404 negativo: el boletín fantasma 88888-88 aparece anidado con
--        en_corpus:false y titulo/enlace null (corre ANTES del delete de 15-16: usa la
--        citación futura sembrada, que sigue viva en este punto) ────────────────────
select is(
  (select count(*)::int
     from actualidad_senal s,
          jsonb_array_elements(s.evidencia->'items') item,
          jsonb_array_elements(item->'puntos') punto
    where s.tipo_senal = 'agenda_citacion'
      and punto->>'boletin' = '88888-88'
      and punto->>'titulo' is null
      and punto->>'enlace' is null
      and (punto->>'en_corpus')::boolean = false),
  1,
  'guard 404: el boletín fantasma 88888-88 aparece anidado con en_corpus:false, titulo y enlace null');

-- ── (18) Guard 404 control positivo apareado: el boletín real 99101-99 aparece con
--        en_corpus:true y titulo NOT null (sin este par, el assert 17 sería un cero vacuo) ─
select cmp_ok(
  (select count(*)::int
     from actualidad_senal s,
          jsonb_array_elements(s.evidencia->'items') item,
          jsonb_array_elements(item->'puntos') punto
    where s.tipo_senal = 'agenda_citacion'
      and punto->>'boletin' = '99101-99'
      and punto->>'titulo' is not null
      and (punto->>'en_corpus')::boolean = true),
  '>=', 1,
  'control positivo apareado: el boletín real 99101-99 aparece con en_corpus:true y titulo not null');

-- ── (19) Grafía PANEL-06: toda cobertura_camara temporal está en el vocabulario ciudadano,
--        apareado con el control 9 ────────────────────────────────────────────────────
select is(
  (select count(*)::int from actualidad_senal
     where cobertura_camara is not null
       and cobertura_camara not in
           ('Cámara de Diputados', 'Senado', '(sin cámara)', '2022-2026 (piso de corpus)')),
  0,
  'PANEL-06: toda cobertura_camara usa el vocabulario de grafía ciudadana (o el literal de piso de corpus)');

-- ── (20) agenda_sala: sus ítems traen `tabla` como array (D-02b, unidad = sesión) ──
select is(
  (select count(*)::int
     from actualidad_senal s, jsonb_array_elements(s.evidencia->'items') item
    where s.tipo_senal = 'agenda_sala'
      and jsonb_typeof(item->'tabla') is distinct from 'array'),
  0,
  'D-02b: cada ítem de agenda_sala trae tabla como array (la unidad es la sesión)');

-- ── Supresión DETERMINISTA (Fable blocker 1 / checker B-4) — DESPUÉS de los asserts
--    positivos de arriba (9-14, 17-20): se borran las sesion_sala futuras (cascadea a
--    sesion_tabla_item; todo se rollbackea al final) y se re-materializa. Recién entonces la
--    ausencia de sesiones futuras es GARANTIZADA (no depende del estado vivo de PROD) y
--    agenda_sala DEBE producir su fila de supresión.
delete from public.sesion_sala where fecha::date >= current_date;
select actualidad.materializar_senales();

-- ── (15) agenda_sala sin futuras → fila de supresión (supresion_causa NOT NULL) ────
-- Control positivo apareado: la rama de supresión de agenda_sala es incondicional cuando no
-- hay sesiones futuras (0080:380-388) ⇒ determinista tras el delete de arriba.
select cmp_ok(
  (select count(*)::int from actualidad_senal
     where tipo_senal = 'agenda_sala' and supresion_causa is not null),
  '>=', 1,
  'supresión determinista: sin sesiones futuras, agenda_sala emite fila con supresion_causa NOT NULL');

-- ── (16) esa misma fila conserva evidencia = '{}' (D-09: la supresión no lista evidencia) ─
select is(
  (select count(*)::int from actualidad_senal
     where tipo_senal = 'agenda_sala' and supresion_causa is not null
       and evidencia is distinct from '{}'::jsonb),
  0,
  'D-09: toda fila suprimida de agenda_sala conserva evidencia = {} (la supresión no lista evidencia)');

select * from finish();
rollback;
