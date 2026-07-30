-- 0080_actualidad_evidencia.sql
-- ADITIVA (D-09): `create or replace` de `actualidad.materializar_senales()` (0065:88-310) que
-- añade una columna `evidencia` jsonb por INSERT POSITIVO (los sujetos del hecho: boletín,
-- título, fecha, enlace, en_corpus) más la función `actualidad.grafia_camara(text)` que unifica
-- la grafía de cámara en un único punto (PANEL-06/D-07). Purpose: PANEL-01 — la UI de la Phase
-- 128 necesita nombrar los sujetos del hecho, no solo un conteo.
--
-- La última migración APLICADA es 0079. Esta es la 0080. `0073`/`0075` están ESCRITAS y NO
-- aplicadas — JAMÁS se editan ni se reordenan; 0080 es puramente aditiva sobre 0065.
--
-- Arquitectura Opción A adjudicada por spike, NO se re-abre: esta migración NO cambia la firma
-- de la RPC `0066`, cero allowlist nueva, cero DDL de tabla nueva, cero grant/revoke.
--
-- Anti-B-01 (D-03): CERO cap por recencia. `evidencia->>'total'` == número de ítems, siempre.
-- Si algún día hiciera falta cappear la lista de items por tamaño de payload, se hace **por
-- grado** y con el `total` real declarado aparte (umbral documentado, NO implementado aquí).
-- Motivo: `order by fecha desc` + cap silencioso fue exactamente el defecto B-01 de v12.0 (un
-- número mostrado que no correspondía a la composición real de los datos).
--
-- Guard 404 (D-05): todo bloque que emita boletines usa `left join public.proyecto`; el ítem
-- se emite SIEMPRE con `en_corpus` (boolean, calculado por el left join); JAMÁS inner join
-- (un inner join divergiría el conteo del bloque respecto al `count(*)` ya materializado).
--
-- Unidad de la evidencia = unidad del conteo (D-02/D-06): eventos de tramitación en
-- velocity/nuevos_ingresos/urgencias/archivados; **citaciones** en `agenda_citacion` (con
-- `puntos` anidados por sub-select correlacionado); **sesiones** en `agenda_sala` (con `tabla`
-- anidada, porque 0065:260-265 cuenta `sesion_sala`, NO `sesion_tabla_item`).
--
-- Supresión conserva `'{}'` (D-09): ningún INSERT de supresión de 0065 lista la columna
-- `evidencia` en esta migración — el default `'{}'::jsonb` de la tabla se mantiene intacto.
--
-- D-09b (riesgo de `create or replace`): REPLACE preserva `proowner` y `proacl` del proc
-- secdef, pero **NO preserva los `SET` de la definición** (search_path). Por eso este archivo
-- restatea LITERALMENTE `security definer set search_path = ''` al re-declarar el proc —
-- omitirlo reabriría el vector de inyección de search_path (V8) contra un proc security
-- definer. Cero grants/revokes en este archivo: la ACL ya existente se conserva por el propio
-- REPLACE, y declarar grants/revokes aquí SERÍA el cambio de ACL que D-09 prohíbe.
--
-- D-12: el bloque `cron.schedule` de `0065:312-342` NO se re-emite en 0080. `cron.schedule`
-- guarda el TEXTO SQL `select actualidad.materializar_senales();`, resuelto por NOMBRE en cada
-- corrida — el REPLACE del proc es transparente para el job ya programado.
--
-- Aplicación (D-10) — igual que 0065, NUNCA `supabase db push` (drift de schema_migrations):
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0080_actualidad_evidencia.sql
-- Este plan (127-01) NO aplica nada a PROD — eso vive en el plan 127-03.
--
-- Notas del gate Fable (2026-07-30), para que queden escritas junto al código que gatearon:
--   M3: `consultado_al = current_date` es correcto a las horas del cron (11/14/17/20 UTC = ya
--   es día chileno en Postgres al momento de correr). Una materialización MANUAL corrida entre
--   00:00-04:00 UTC estamparía el día chileno SIGUIENTE en `consultado_al` — NO correr el proc
--   a mano en esa franja horaria.
--   M5: `grafia_camara` nace con EXECUTE-to-PUBLIC por default (comportamiento estándar de
--   Postgres para funciones nuevas). Riesgo ≈ 0: el schema `actualidad` no tiene USAGE
--   concedido a `anon`/`authenticated`, y la función es pura (sin side effects, sin acceso a
--   datos). Se deja anotado, sin revoke — añadir un revoke aquí SERÍA el cambio de ACL que D-09
--   prohíbe.
--   M4 (convención): en los comentarios de este archivo la función se nombra `grafia_camara` a
--   secas (sin el prefijo `actualidad.`); el literal calificado `actualidad.grafia_camara`
--   solo aparece en código ejecutable (definición + llamadas), nunca en prosa de comentario.

-- ── grafia_camara (PANEL-06/D-07) — single-source de la grafía ciudadana de cámara ──
-- Unifica en un único punto la normalización que antes vivía repetida (regexp_replace inline)
-- en cada bloque del proc. `immutable`: solo referencia funciones de pg_catalog (siempre
-- resolubles) y no toca ninguna tabla — indexable/inlineable por el planner. NO se le pone
-- `set search_path`: eso bloquearía el inlining y aquí no hace falta (sin nombres calificables
-- de otros schemas dentro del cuerpo).
create or replace function actualidad.grafia_camara(p_camara text)
returns text language sql immutable as $$
  select case
    when p_camara is null or btrim(p_camara) = '' then '(sin cámara)'              -- D-08
    when lower(regexp_replace(p_camara, '\s+', '', 'g')) in
         ('c.diputados', 'camara', 'cámara', 'diputados', 'camaradediputados')
      then 'Cámara de Diputados'
    when lower(regexp_replace(p_camara, '\s+', '', 'g')) in ('senado')
      then 'Senado'
    else regexp_replace(p_camara, '\s+', ' ', 'g')                                 -- nunca descartar
  end;
$$;
