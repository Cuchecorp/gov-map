-- 0061_cross_links_conteo_honesto_orden.sql
-- Phase 91 — PERSONAS P2b — REVIEW-FIX (WR-01, WR-03, WR-06):
-- Endurece los CUATRO cross-links factuales de 0060 sin tocar 0060 (inmutable, ya
-- aplicada a PROD). Cambios, TODOS anti-insinuación-safe (orden NEUTRAL preservado):
--
--   WR-01 (conteo honesto): cada cross-link cap-eaba silenciosamente en `limit 20`
--     y la ficha presentaba ese 20 como el total REAL de quienes comparten el eje.
--     Fix: proyectar `total_n = count(*) over ()` (el conteo COMPLETO, computado
--     ANTES del limit) como columna extra. La UI muestra el total verdadero y, si
--     está truncado, declara "mostrando los primeros N" (nunca miente el conteo).
--
--   WR-03 (orden alfabético REAL en co-comisionados): el `distinct on (p2.id) …
--     order by p2.id, c.nombre` de 0060 forzaba el orden por id INTERNO (D####/S####),
--     NO por nombre como documentaba el comentario. Fix: envolver el DISTINCT ON en
--     subconsulta y re-ordenar por nombre en la consulta externa → el orden emitido
--     coincide con el contrato neutral alfabético.
--
--   WR-06 (dedupe copartidarios): `copartidarios_de_parlamentario` auto-joinea
--     militancia→militancia por `partido_alias` sin DISTINCT. La UNIQUE de
--     `parlamentario_militancia` es (parlamentario_id, partido_alias, desde) → un
--     mismo parlamentario puede tener >1 fila `es_actual` para el mismo alias con
--     `desde` distinto, fan-out → filas duplicadas + conteo inflado. Fix: `distinct on
--     (p2.id)` envuelto y re-ordenado por nombre (misma técnica que WR-03).
--
-- ── ORDEN DE APPLY / COMANDO ────────────────────────────────────────────────────────────
-- La última migración APLICADA es 0060. Esta es la 0061 y se aplica DESPUÉS.
-- Estos cuatro RPCs CAMBIAN su returns table (añaden `total_n`) → un `create or replace`
-- con distinta firma de salida dispara 42P13. Por eso: DROP + recreate + doble-revoke
-- VERBATIM (precedente 0055/0060). Migración ADITIVA sobre funciones (sin DROP de tabla,
-- sin backfill) → dentro de la autoridad del agente.
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f \
--     supabase/migrations/0061_cross_links_conteo_honesto_orden.sql
-- NUNCA `supabase db push` (drift de schema_migrations). La única prueba válida del DDL
-- es el pgTAP (0060_bio_partido_publico.test.sql + 0061_*.test.sql) contra el schema APLICADO.
--
-- ── ACL (Camino A, post-0044): CERO grant ──────────────────────────────────────────────
-- El sitio ejecuta con service_role (bypassa ACL/RLS). Cada RPC lleva el doble-revoke
-- explícito VERBATIM de 0060 (revoke all … from public; + from anon, authenticated;)
-- para limpiar los DEFAULT PRIVILEGES que Postgres re-concede sobre funciones nuevas de
-- `public`. NUNCA re-emitir grant. security definer set search_path = '' con nombres
-- schema-qualified; p_id parametrizado; LIMIT bounded. Cero rut/email/partido_alias.

-- ── E.1 copartidarios (WR-06 dedupe + WR-01 total_n) ──────────────────────────────────────
drop function if exists public.copartidarios_de_parlamentario(text);

create or replace function public.copartidarios_de_parlamentario(p_id text)
returns table (id text, nombre text, camara text, total_n bigint)
language sql stable security definer set search_path = '' as $$
  -- WR-06: distinct on (p2.id) envuelto + re-ordenado por nombre → un copartidario
  -- aparece EXACTAMENTE una vez aunque m1/m2 tengan varias filas es_actual del mismo
  -- alias. WR-01: total_n = conteo COMPLETO (sobre el conjunto deduplicado, antes del
  -- limit) — el conteo honesto que la ficha muestra, no el cap visual.
  select d.id, d.nombre, d.camara, count(*) over () as total_n
  from (
    select distinct on (p2.id)
           p2.id,
           coalesce(
             nullif(trim(concat_ws(' ', p2.nombres, p2.apellido_paterno, p2.apellido_materno)), ''),
             p2.nombre_normalizado
           ) as nombre,
           p2.camara
    from public.parlamentario_militancia m1
    join public.parlamentario_militancia m2
      on m2.partido_alias = m1.partido_alias
     and m2.es_actual = true
    join public.parlamentario p2 on p2.id = m2.parlamentario_id
    where m1.parlamentario_id = p_id
      and m1.es_actual = true
      and p2.id <> p_id
    order by p2.id
  ) d
  order by d.nombre
  limit 20;
$$;

revoke all on function public.copartidarios_de_parlamentario(text) from public;
revoke all on function public.copartidarios_de_parlamentario(text) from anon, authenticated;

-- ── E.2 misma zona (WR-01 total_n) ────────────────────────────────────────────────────────
drop function if exists public.de_la_misma_zona(text);

create or replace function public.de_la_misma_zona(p_id text)
returns table (id text, nombre text, camara text, total_n bigint)
language sql stable security definer set search_path = '' as $$
  -- Zona = distrito coincidente O circunscripción coincidente; NULL nunca hace match.
  -- Sin fan-out (single p2) → sin distinct. WR-01: total_n = conteo COMPLETO antes del limit.
  select p2.id,
         coalesce(
           nullif(trim(concat_ws(' ', p2.nombres, p2.apellido_paterno, p2.apellido_materno)), ''),
           p2.nombre_normalizado
         ) as nombre,
         p2.camara,
         count(*) over () as total_n
  from public.parlamentario p1
  join public.parlamentario p2
    on p2.id <> p1.id
   and (
        (p1.distrito is not null and p2.distrito = p1.distrito)
     or (p1.circunscripcion is not null and p2.circunscripcion = p1.circunscripcion)
   )
  where p1.id = p_id
  order by nombre
  limit 20;
$$;

revoke all on function public.de_la_misma_zona(text) from public;
revoke all on function public.de_la_misma_zona(text) from anon, authenticated;

-- ── E.3 co-comisionados (WR-03 orden alfabético REAL + WR-01 total_n) ──────────────────────
drop function if exists public.co_comisionados_de_parlamentario(text);

create or replace function public.co_comisionados_de_parlamentario(p_id text)
returns table (id text, nombre text, camara text, comision_nombre text, total_n bigint)
language sql stable security definer set search_path = '' as $$
  -- WR-03: el distinct on (p2.id) obliga a Postgres a ordenar por p2.id en el interno;
  -- se re-ordena por nombre en el externo → el orden EMITIDO es alfabético por nombre
  -- (contrato neutral), no por id interno. La comisión compartida mostrada es la
  -- alfabéticamente primera (distinct on desempata por c.nombre). WR-01: total_n =
  -- conteo COMPLETO de co-comisionados distintos (sobre el conjunto deduplicado).
  select d.id, d.nombre, d.camara, d.comision_nombre,
         count(*) over () as total_n
  from (
    select distinct on (p2.id)
           p2.id,
           coalesce(
             nullif(trim(concat_ws(' ', p2.nombres, p2.apellido_paterno, p2.apellido_materno)), ''),
             p2.nombre_normalizado
           ) as nombre,
           p2.camara,
           c.nombre as comision_nombre
    from public.comision_membresia cm1
    join public.comision_membresia cm2 on cm2.comision_id = cm1.comision_id
    join public.comision c on c.id = cm1.comision_id
    join public.parlamentario p2 on p2.id = cm2.parlamentario_id
    where cm1.parlamentario_id = p_id
      and cm2.parlamentario_id <> p_id
    order by p2.id, c.nombre
  ) d
  order by d.nombre
  limit 20;
$$;

revoke all on function public.co_comisionados_de_parlamentario(text) from public;
revoke all on function public.co_comisionados_de_parlamentario(text) from anon, authenticated;

-- ── E.4 co-autores (WR-01 total_n) ─────────────────────────────────────────────────────────
drop function if exists public.coautores_de_parlamentario(text);

create or replace function public.coautores_de_parlamentario(p_id text)
returns table (id text, nombre text, camara text, n_proyectos int, total_n bigint)
language sql stable security definer set search_path = '' as $$
  -- n_proyectos = conteo de boletines co-firmados (dato HONESTO por fila). El orden es
  -- por NOMBRE, NUNCA por n_proyectos (sería ranking de afinidad, prohibido). WR-01:
  -- total_n = conteo COMPLETO de co-autores distintos (window sobre el grupo, antes del limit).
  select p2.id,
         coalesce(
           nullif(trim(concat_ws(' ', p2.nombres, p2.apellido_paterno, p2.apellido_materno)), ''),
           p2.nombre_normalizado
         ) as nombre,
         p2.camara,
         count(distinct a2.boletin)::int as n_proyectos,
         count(*) over () as total_n
  from public.proyecto_autor a1
  join public.proyecto_autor a2
    on a2.boletin = a1.boletin
   and a2.estado_vinculo = 'confirmado'
   and a2.parlamentario_id is not null
   and a2.parlamentario_id <> p_id
  join public.parlamentario p2 on p2.id = a2.parlamentario_id
  where a1.parlamentario_id = p_id
    and a1.estado_vinculo = 'confirmado'
  group by p2.id, p2.nombres, p2.apellido_paterno, p2.apellido_materno,
           p2.nombre_normalizado, p2.camara
  order by nombre
  limit 20;
$$;

revoke all on function public.coautores_de_parlamentario(text) from public;
revoke all on function public.coautores_de_parlamentario(text) from anon, authenticated;
