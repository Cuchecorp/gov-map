-- 0080_actualidad_evidencia.test.sql
-- Verifica las migraciones 0080 + 0081 (evidencia jsonb + actualidad.grafia_camara) CONTRA UN
-- SCHEMA APLICADO. Espeja el patrón de 0065_actualidad_senal.test.sql (begin → plan(N) → siembra
-- owner → select actualidad.materializar_senales() → asserts → finish → rollback).
--
-- ACTUALIZADO por el code-review de la Phase 127 (0081_actualidad_evidencia_fix.sql). Los asserts
-- añadidos cubren exactamente los ejes que ningún assert cubría y por los que 0080 pudo entrar
-- rota a PROD:
--   * CR-01 — la RAMA `else` de grafia_camara y las variantes DECORADAS/acentuadas/con caja alta:
--     0080 las mandaba al `else` ⇒ cada una fabricaba un bucket propio de `cobertura_camara` ⇒ la
--     misma cámara se partía en DOS filas de actualidad_senal (defecto clase B-01). Se asertan
--     directamente sobre la FUNCIÓN (deterministas), no sobre el dato vivo.
--   * CR-02 — los sub-selects anidados `puntos`/`tabla` recortaban en silencio los ítems SIN
--     boletín (columna nullable por diseño). Se siembra un punto y un ítem de tabla sin boletín y
--     se exige que APAREZCAN, más la paridad `puntos_total`/`tabla_total` == length del array.
--   * WR-03/WR-04 — el proc fija `timezone=UTC` en su definición y toma el advisory lock.
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
--     positivos PRIMERO, contra el estado que sea; DESPUÉS, dentro de la MISMA
--     transacción, se borran las sesion_sala futuras (cascadea a sesion_tabla_item, todo se
--     rollbackea) y se re-materializa — recién ahí la ausencia de sesiones futuras es
--     GARANTIZADA y agenda_sala DEBE emitir su fila de supresión con evidencia='{}' (D-09).
--   * agenda_sala conserva la unidad-sesión: sus ítems anidan `tabla` como array (D-02b).
--
-- Prohibido asertar cifras vivas de PROD (95 urgencias, 10/49, 39,7 KB): son datos que cambian a
-- diario (Assumption A1 del research). Los asserts de este archivo son ESTRUCTURALES.

begin;
select plan(31);

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
  ('test:cit:1', 1, '88888-88', 'Materia fantasma'),  -- boletín fantasma, NO existe en proyecto
  -- CR-02: punto SIN boletín (nombramiento/cuenta/materia no boletinada). `citacion_punto.boletin`
  -- es nullable por diseño (0010_agenda.sql:45-56). 0080 lo BORRABA del jsonb con su
  -- `where cp.boletin is not null`; 0081 lo emite con boletin/titulo/enlace null y en_corpus:false.
  ('test:cit:1', 2, null, 'Nombramiento sin boletin');

-- Sesión de sala futura con el mismo patrón (boletín en corpus + fantasma).
insert into sesion_sala (id, camara, fecha, numero, hora_inicio, tipo, origen, fecha_captura, enlace)
values
  ('test:ses:1', 'camara', current_date + 1, '1', '10:00', 'Ordinaria', 'test', now(), 'http://x/ses');

insert into sesion_tabla_item (sesion_id, posicion, parte_sesion, boletin, materia)
values
  ('test:ses:1', 0, 'ORDEN DEL DÍA', '99101-99', 'Salud'),
  ('test:ses:1', 1, 'ORDEN DEL DÍA', '88888-88', 'Materia fantasma'),  -- boletín fantasma
  -- CR-02: ítem de tabla SIN boletín (mismo defecto que el punto de citación, en el otro anidado).
  ('test:ses:1', 2, 'CUENTA', null, 'Cuenta sin boletin');

-- Poblar actualidad_senal desde los hechos sembrados (FULL REBUILD acotado, 0065:108-112).
select actualidad.materializar_senales();

-- ── grafia_camara existe ───────────────────────────────────────────────────
select has_function('actualidad', 'grafia_camara', array['text'], 'actualidad.grafia_camara(text) existe');

-- ── grafia_camara unifica a la grafía ciudadana, incluyendo NULL (D-08) ──
select is(actualidad.grafia_camara('C. Diputados'), 'Cámara de Diputados',
  'grafia_camara(''C. Diputados'') → grafía ciudadana');
select is(actualidad.grafia_camara('camara'), 'Cámara de Diputados',
  'grafia_camara(''camara'') → grafía ciudadana');
select is(actualidad.grafia_camara('senado'), 'Senado',
  'grafia_camara(''senado'') → Senado');
select is(actualidad.grafia_camara(null), '(sin cámara)',
  'grafia_camara(null) → (sin cámara) (D-08)');

-- ── CR-01: variantes DECORADAS / acentuadas / con caja alta NO fabrican bucket propio ──
-- Este es el bloque que 0080 no tenía y por el que el defecto entró: su whitelist era CERRADA y
-- sin la forma acentuada completa ('cámaradediputados'), así que toda variante caía al `else` y
-- se convertía en una `cobertura_camara` distinta ⇒ dos filas de actualidad_senal para la MISMA
-- cámara ⇒ el panel de 128 mostrando un N menor que la realidad (defecto clase B-01 de v12.0).
-- Son asserts sobre la FUNCIÓN (deterministas), no sobre el dato vivo de PROD.
select is(actualidad.grafia_camara('CÁMARA DE DIPUTADOS'), 'Cámara de Diputados',
  'CR-01: caja alta acentuada colapsa a la grafía ciudadana (no crea bucket propio)');
select is(actualidad.grafia_camara('H. Cámara de Diputados'), 'Cámara de Diputados',
  'CR-01: prefijo honorífico colapsa a la grafía ciudadana');
select is(actualidad.grafia_camara('C. de Diputados'), 'Cámara de Diputados',
  'CR-01: variante "C. de Diputados" colapsa a la grafía ciudadana');
select is(actualidad.grafia_camara('  Senado  '), 'Senado',
  'CR-01: espacios líder/final no crean bucket nuevo para Senado');
-- ── CR-01 (agravante): la rama `else` conserva el valor de fuente pero SIEMPRE trimmeado y con
--    espacios colapsados — en 0080 el `else` no hacía btrim, así que ' X ' y 'X ' eran buckets
--    distintos entre sí. Control apareado del anterior: prueba que el `else` SÍ se ejecuta (el
--    valor no está en el vocabulario ciudadano) y aun así no fabrica variantes por whitespace.
select is(actualidad.grafia_camara('  Comisión   Mixta  '), 'Comisión Mixta',
  'CR-01: la rama else no descarta el valor de fuente, pero lo devuelve trimmeado y sin espacios dobles');

-- ── materializar_senales sigue security definer tras el REPLACE de 0080 ───
select is(
  (select p.prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'actualidad' and p.proname = 'materializar_senales'),
  true,
  'actualidad.materializar_senales sigue security definer tras 0080');

-- ── D-09b: el REPLACE restatea el search_path vacío (no lo pierde) ────────
select ok(
  (select coalesce(array_to_string(p.proconfig, ','), '') from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'actualidad' and p.proname = 'materializar_senales')
    like '%search_path=%',
  'D-09b: materializar_senales conserva su search_path fijado tras el create or replace');

-- ── WR-03: el proc fija su PROPIA zona horaria (no hereda la de la sesión que lo invoca) ──
-- `citacion.fecha`/`sesion_sala.fecha` son timestamptz date-only-midnight-UTC (regla LOCKED: la
-- parte fecha UTC ES el día chileno). Sin `set timezone` en la definición, `fecha::date` y
-- `current_date` se resolvían con el TimeZone del CALLER: bajo un psql de operador con
-- America/Santiago, una citación de mañana 00:00Z se leía como HOY y el 'fecha' de cada ítem
-- salía con un día menos. 0081 lo hornea en la definición.
select ok(
  (select coalesce(array_to_string(p.proconfig, ','), '') from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'actualidad' and p.proname = 'materializar_senales')
    ilike '%timezone=UTC%',
  'WR-03: materializar_senales fija timezone=UTC en su definición (no depende del TimeZone del caller)');

-- ── WR-04: el proc toma un advisory lock antes del delete+insert (corridas solapadas) ──
-- El full-rebuild es delete+insert sin lock: bajo READ COMMITTED, el DELETE de la corrida B no ve
-- las filas que A insertó tras su snapshot y el INSERT de B choca contra la unique key (23505),
-- perdiendo la corrida entera. El cron dispara 4×/día y el régimen incluye corridas manuales.
select ok(
  (select pg_get_functiondef(p.oid) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'actualidad' and p.proname = 'materializar_senales')
    ~ 'pg_advisory_xact_lock',
  'WR-04: materializar_senales serializa sus corridas con un advisory lock de transacción');

-- ── no-PII ampliado: tampoco referencia `autores` (nombres de parlamentarios) ─
-- Espeja 0065:77-83 (partido/rut); 0080 añade `autores` porque el bloque de evidencia ahora
-- expone `proyecto.*` y podría, por error futuro, colar autores al jsonb.
select ok(
  (select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'actualidad' and p.proname = 'materializar_senales')
    !~* '\y(partido|rut|autores)\y',
  'el cuerpo de materializar_senales NO contiene partido, rut ni autores (no-PII ampliado)');

-- ── Control positivo apareado: existen filas positivas (sin este par, los ceros de
--        abajo serían vacuos — gotcha "cero fuerte vs cero vacuo" de v12.0) ───────────
select cmp_ok(
  (select count(*)::int from actualidad_senal
     where supresion_causa is null and tipo_senal <> 'agrupacion_materia'),
  '>=', 1,
  'control positivo: existe al menos una fila positiva (no-agrupacion_materia)');

-- ── Toda positiva trae las 4 claves de evidencia (D-09) ───────────────────
select is(
  (select count(*)::int from actualidad_senal
     where supresion_causa is null and tipo_senal <> 'agrupacion_materia'
       and not (evidencia ? 'total' and evidencia ? 'items'
                and evidencia ? 'consultado_al' and evidencia ? 'fuente')),
  0,
  'toda señal positiva trae evidencia con total/items/consultado_al/fuente');

-- ── 'items' es un array real, nunca NULL (Pitfall 3: jsonb_agg vacío da NULL) ─
select is(
  (select count(*)::int from actualidad_senal
     where supresion_causa is null and tipo_senal <> 'agrupacion_materia'
       and jsonb_typeof(evidencia->'items') is distinct from 'array'),
  0,
  'evidencia->items es siempre un array jsonb en toda señal positiva (jamás NULL)');

-- ── Paridad D-06 / anti-cap D-03: conteo == total == jsonb_array_length(items) ─
select is(
  (select count(*)::int from actualidad_senal
     where supresion_causa is null and tipo_senal <> 'agrupacion_materia'
       and (conteo <> (evidencia->>'total')::int
            or (evidencia->>'total')::int <> jsonb_array_length(evidencia->'items'))),
  0,
  'D-06/anti-cap D-03: conteo == evidencia.total == jsonb_array_length(evidencia.items)');

-- ── D-04: consultado_al == current_date en toda positiva ──────────────────
select is(
  (select count(*)::int from actualidad_senal
     where supresion_causa is null and tipo_senal <> 'agrupacion_materia'
       and (evidencia->>'consultado_al')::date is distinct from current_date),
  0,
  'D-04: evidencia.consultado_al == current_date en toda señal positiva');

-- ── D-04b + Fable M2 (anti-drift jsonb↔fila): fuente.dataset == columna dataset ─
select is(
  (select count(*)::int from actualidad_senal
     where supresion_causa is null and tipo_senal <> 'agrupacion_materia'
       and (evidencia->'fuente'->>'dataset' is null
            or evidencia->'fuente'->>'dataset' is distinct from dataset)),
  0,
  'evidencia.fuente.dataset no es null y coincide con la columna dataset de la MISMA fila');

-- ── Guard 404 negativo: el boletín fantasma 88888-88 aparece anidado con
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

-- ── Guard 404 control positivo apareado: el boletín real 99101-99 aparece con
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

-- ── CR-02: el punto SIN boletín NO se recorta en silencio ──────────────────────
-- `citacion_punto.boletin` es nullable POR DISEÑO: los puntos que son materia sin boletinar
-- (nombramientos, cuentas) desaparecían del jsonb por el `where cp.boletin is not null` de 0080
-- — un inner join disfrazado a nivel anidado, prohibido por D-05 — dejando a 128 renderizando
-- "el orden del día de la citación" INCOMPLETO presentado como completo. 0081 lo emite con
-- boletin/titulo/enlace null y en_corpus:false (misma forma que el ítem fuera-de-corpus).
select is(
  (select count(*)::int
     from actualidad_senal s,
          jsonb_array_elements(s.evidencia->'items') item,
          jsonb_array_elements(item->'puntos') punto
    where s.tipo_senal = 'agenda_citacion'
      and punto->>'materia' = 'Nombramiento sin boletin'
      and punto->>'boletin' is null
      and punto->>'titulo' is null
      and punto->>'enlace' is null
      and (punto->>'en_corpus')::boolean = false),
  1,
  'CR-02: el punto SIN boletín se emite (boletin/titulo/enlace null, en_corpus:false), no se recorta');

-- ── CR-02: paridad del anidado — puntos_total declara el denominador REAL ──────
-- Hoy es redundante (ya no hay recorte) pero lo hace VERIFICABLE: si alguien re-introduce un
-- filtro en el sub-select, este assert lo caza. Es la honestidad "N de M" que 128 necesita.
select is(
  (select count(*)::int
     from actualidad_senal s, jsonb_array_elements(s.evidencia->'items') item
    where s.tipo_senal = 'agenda_citacion' and s.supresion_causa is null
      and (item->>'puntos_total')::int is distinct from jsonb_array_length(item->'puntos')),
  0,
  'CR-02: en agenda_citacion, puntos_total == jsonb_array_length(puntos) en todo ítem (sin recorte silencioso)');

-- ── CR-02: mismo control en el otro anidado (sesion_tabla_item) ────────────────
select is(
  (select count(*)::int
     from actualidad_senal s,
          jsonb_array_elements(s.evidencia->'items') item,
          jsonb_array_elements(item->'tabla') ti
    where s.tipo_senal = 'agenda_sala'
      and ti->>'materia' = 'Cuenta sin boletin'
      and ti->>'boletin' is null
      and ti->>'titulo' is null
      and (ti->>'en_corpus')::boolean = false),
  1,
  'CR-02: el ítem de tabla SIN boletín se emite (boletin/titulo null, en_corpus:false), no se recorta');

select is(
  (select count(*)::int
     from actualidad_senal s, jsonb_array_elements(s.evidencia->'items') item
    where s.tipo_senal = 'agenda_sala' and s.supresion_causa is null
      and (item->>'tabla_total')::int is distinct from jsonb_array_length(item->'tabla')),
  0,
  'CR-02: en agenda_sala, tabla_total == jsonb_array_length(tabla) en todo ítem (sin recorte silencioso)');

-- ── Grafía PANEL-06: toda cobertura_camara temporal está en el vocabulario ciudadano,
--    apareado con el control positivo de más arriba ──────────────────────────────────
-- WR-06: se añade `tipo_senal <> 'agrupacion_materia'` (como en todos los demás asserts del
-- archivo). Sin ese filtro, el día que el CLI k-means poblara `cobertura_camara` este test se
-- pondría rojo por un tipo que el proc NI TOCA. Nota honesta: este assert sigue siendo un canario
-- del DATO VIVO, no una garantía estructural — la rama `else` de grafia_camara deja pasar
-- cualquier valor de fuente por diseño (nunca descartar). La garantía estructural de la grafía
-- vive en los asserts CR-01 de más arriba, que muerden la FUNCIÓN directamente.
select is(
  (select count(*)::int from actualidad_senal
     where cobertura_camara is not null
       and tipo_senal <> 'agrupacion_materia'
       and cobertura_camara not in
           ('Cámara de Diputados', 'Senado', '(sin cámara)', '2022-2026 (piso de corpus)')),
  0,
  'PANEL-06: toda cobertura_camara usa el vocabulario de grafía ciudadana (o el literal de piso de corpus)');

-- ── agenda_sala: sus ítems traen `tabla` como array (D-02b, unidad = sesión) ──
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

-- ── agenda_sala sin futuras → fila de supresión (supresion_causa NOT NULL) ────
-- Control positivo apareado: la rama de supresión de agenda_sala es incondicional cuando no
-- hay sesiones futuras (0080:380-388) ⇒ determinista tras el delete de arriba.
select cmp_ok(
  (select count(*)::int from actualidad_senal
     where tipo_senal = 'agenda_sala' and supresion_causa is not null),
  '>=', 1,
  'supresión determinista: sin sesiones futuras, agenda_sala emite fila con supresion_causa NOT NULL');

-- ── esa misma fila conserva evidencia = '{}' (D-09: la supresión no lista evidencia) ─
select is(
  (select count(*)::int from actualidad_senal
     where tipo_senal = 'agenda_sala' and supresion_causa is not null
       and evidencia is distinct from '{}'::jsonb),
  0,
  'D-09: toda fila suprimida de agenda_sala conserva evidencia = {} (la supresión no lista evidencia)');

select * from finish();
rollback;
