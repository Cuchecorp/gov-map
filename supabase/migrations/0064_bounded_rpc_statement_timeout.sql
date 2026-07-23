-- 0064_bounded_rpc_statement_timeout.sql
-- Phase 95 — SC#2 DoS bounding: añade statement_timeout = '5s' a las 9 RPCs de
-- 0060/0061/0063 (4 bio/listado + 4 cross-links + 1 lobby) que tienen LIMIT pero
-- cero statement_timeout. (El plan estimaba 10; las interfaces definen 9 únicas.)
-- Orden de apply: DESPUÉS de 0063_lobby_menciones_una_fila_por_audiencia.sql
-- Aplicar: PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0064_bounded_rpc_statement_timeout.sql
-- NUNCA supabase db push (drift schema_migrations).
--
-- Migración ADITIVA: create or replace function (idiom 42P13 — drop explícito previo).
-- Sin backfill, sin DDL destructivo → dentro de la autoridad del agente (precedente 0055-0063).
--
-- ── ACL: CERO grant. Doble-revoke al final de cada RPC. ──────────────────────────────────
-- service_role ejecuta vía .rpc() bypass ACL/RLS (Camino A, 0044).
--
-- ── EXCLUSIÓN DE match_proyectos ─────────────────────────────────────────────────────────
-- match_proyectos (0011, re-emitida en 0045) se EXCLUYE deliberadamente de este 0064.
-- Razones: (1) está definida SIN el qualifier `public.` (security INVOKER, secdef=f),
-- fue revocada de public en 0045; re-emitirla con timeout exigiría un re-emit
-- byte-idéntico de una función security-INVOKER con más riesgo de 42P13 por
-- ganancia marginal; (2) es pre-v9.0 (fuera del set "RPC nueva" de la fase);
-- (3) su LIMIT/threshold ya la acotan suficientemente.
-- El híbrido (0057) ya la reemplaza tras flag. Exclusión documentada aquí y en 95-01-SUMMARY.md.

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- SECCIÓN A — CABECERA v2 (parlamentario_publico_v2)
-- ═══════════════════════════════════════════════════════════════════════════════════════
drop function if exists public.parlamentario_publico_v2(text);

create or replace function public.parlamentario_publico_v2(p_id text)
returns table (
  id text, nombre text, camara text,
  region text, distrito text, circunscripcion text, periodo text,
  origen text, fecha_captura timestamptz, enlace text,
  partido text, partido_fecha_captura timestamptz, partido_origen text
)
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'
as $$
  select p.id,
         coalesce(
           nullif(trim(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno)), ''),
           p.nombre_normalizado
         ) as nombre,
         p.camara,
         p.region, p.distrito, p.circunscripcion, p.periodo,
         p.origen, p.fecha_captura, p.enlace,
         m.partido, m.fecha_captura as partido_fecha_captura, m.origen as partido_origen
  from public.parlamentario p
  left join lateral (
    select mm.partido, mm.fecha_captura, mm.origen
    from public.parlamentario_militancia mm
    where mm.parlamentario_id = p.id
      and mm.es_actual = true
    order by mm.desde desc
    limit 1
  ) m on true
  where p.id = p_id;
$$;

revoke all on function public.parlamentario_publico_v2(text) from public;
revoke all on function public.parlamentario_publico_v2(text) from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- SECCIÓN B — MILITANCIAS del parlamentario
-- ═══════════════════════════════════════════════════════════════════════════════════════
drop function if exists public.militancias_de_parlamentario(text);

create or replace function public.militancias_de_parlamentario(p_id text)
returns table (
  partido text, desde date, hasta date, es_actual boolean,
  origen text, fecha_captura timestamptz, enlace text
)
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'
as $$
  select mm.partido, mm.desde, mm.hasta, mm.es_actual,
         mm.origen, mm.fecha_captura, mm.enlace
  from public.parlamentario_militancia mm
  where mm.parlamentario_id = p_id
  order by mm.es_actual desc, mm.desde desc
  limit 50;
$$;

revoke all on function public.militancias_de_parlamentario(text) from public;
revoke all on function public.militancias_de_parlamentario(text) from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- SECCIÓN C — COMISIONES del parlamentario
-- ═══════════════════════════════════════════════════════════════════════════════════════
drop function if exists public.comisiones_de_parlamentario(text);

create or replace function public.comisiones_de_parlamentario(p_id text)
returns table (
  nombre text, camara text, tipo text, cargo text,
  origen text, fecha_captura timestamptz, enlace text
)
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'
as $$
  select c.nombre, c.camara, c.tipo, cm.cargo,
         cm.origen, cm.fecha_captura, cm.enlace
  from public.comision_membresia cm
  join public.comision c on c.id = cm.comision_id
  where cm.parlamentario_id = p_id
  order by c.nombre
  limit 50;
$$;

revoke all on function public.comisiones_de_parlamentario(text) from public;
revoke all on function public.comisiones_de_parlamentario(text) from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- SECCIÓN D — LISTADO v2 (parlamentarios_publico_v2 — sin args)
-- ═══════════════════════════════════════════════════════════════════════════════════════
drop function if exists public.parlamentarios_publico_v2();

create or replace function public.parlamentarios_publico_v2()
returns table (
  id text, nombre text, camara text,
  region text, distrito text, circunscripcion text, periodo text,
  partido text, partido_fecha_captura timestamptz, partido_origen text
)
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'
as $$
  select p.id,
         coalesce(
           nullif(trim(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno)), ''),
           p.nombre_normalizado
         ) as nombre,
         p.camara,
         p.region, p.distrito, p.circunscripcion, p.periodo,
         m.partido, m.fecha_captura as partido_fecha_captura, m.origen as partido_origen
  from public.parlamentario p
  left join lateral (
    select mm.partido, mm.fecha_captura, mm.origen
    from public.parlamentario_militancia mm
    where mm.parlamentario_id = p.id
      and mm.es_actual = true
    order by mm.desde desc
    limit 1
  ) m on true
  order by p.apellido_paterno nulls last, p.nombre_normalizado;
$$;

revoke all on function public.parlamentarios_publico_v2() from public;
revoke all on function public.parlamentarios_publico_v2() from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- SECCIÓN E — CROSS-LINKS (0061 FINAL def con total_n bigint)
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ── E.1 copartidarios ─────────────────────────────────────────────────────────────────
drop function if exists public.copartidarios_de_parlamentario(text);

create or replace function public.copartidarios_de_parlamentario(p_id text)
returns table (id text, nombre text, camara text, total_n bigint)
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'
as $$
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

-- ── E.2 misma zona ────────────────────────────────────────────────────────────────────
drop function if exists public.de_la_misma_zona(text);

create or replace function public.de_la_misma_zona(p_id text)
returns table (id text, nombre text, camara text, total_n bigint)
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'
as $$
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

-- ── E.3 co-comisionados ───────────────────────────────────────────────────────────────
drop function if exists public.co_comisionados_de_parlamentario(text);

create or replace function public.co_comisionados_de_parlamentario(p_id text)
returns table (id text, nombre text, camara text, comision_nombre text, total_n bigint)
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'
as $$
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

-- ── E.4 co-autores ────────────────────────────────────────────────────────────────────
drop function if exists public.coautores_de_parlamentario(text);

create or replace function public.coautores_de_parlamentario(p_id text)
returns table (id text, nombre text, camara text, n_proyectos int, total_n bigint)
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'
as $$
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

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- SECCIÓN F — LOBBY menciones (0063 FINAL def — 13 cols + total_n)
-- ═══════════════════════════════════════════════════════════════════════════════════════
drop function if exists public.lobby_menciones_de_boletin(text);

create or replace function public.lobby_menciones_de_boletin(p_boletin text)
returns table (
  identificador text,
  fecha timestamptz,
  materia text,
  parlamentario_id text,
  parlamentario_nombre text,
  contraparte_nombre text,
  contraparte_rol text,
  representado text,
  enlace_detalle text,
  origen text,
  fecha_captura timestamptz,
  enlace text,
  total_n bigint
)
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'
as $$
  with req as (
    select
      (p_boletin ~ '^(\d{3,6}|\d{1,3}(\.\d{3})+)(-\d{1,2})?$')  as ok,
      replace(split_part(p_boletin, '-', 1), '.', '')           as base,
      nullif(split_part(p_boletin, '-', 2), '')                 as sufijo
  ),
  pat as (
    select
      r.ok, r.base, r.sufijo,
      '(' || r.base || '|' ||
        regexp_replace(r.base, '(\d{1,3})(\d{3})$', '\1.\2') || ')' as base_dot
    from req r
  )
  select g.identificador, g.fecha, g.materia, g.parlamentario_id,
         g.parlamentario_nombre, g.contraparte_nombre, g.contraparte_rol,
         g.representado, g.enlace_detalle, g.origen, g.fecha_captura, g.enlace,
         count(*) over () as total_n
  from (
    select a.identificador, a.fecha, a.materia, a.parlamentario_id,
           coalesce(
             nullif(trim(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno)), ''),
             p.nombre_normalizado
           ) as parlamentario_nombre,
           cp.contrapartes as contraparte_nombre,
           null::text      as contraparte_rol,
           null::text      as representado,
           a.enlace_detalle, a.origen, a.fecha_captura, a.enlace
    from public.lobby_audiencia a
    join public.parlamentario p on p.id = a.parlamentario_id
    cross join pat
    left join lateral (
      select string_agg(distinct t.linea, ' / ' order by t.linea) as contrapartes
      from (
        select nullif(
                 trim(both ' ·' from concat_ws(
                   ' · ',
                   nullif(trim(c.nombre), ''),
                   nullif(trim(c.rol), ''),
                   nullif(trim(c.representado_text), '')
                 )),
                 ''
               ) as linea
        from public.lobby_contraparte c
        where c.identificador = a.identificador
      ) t
      where t.linea is not null
    ) cp on true
    where pat.ok
      and a.estado_vinculo = 'confirmado'
      and a.parlamentario_id is not null
      and a.materia is not null
      and exists (
        select 1 from public.proyecto pr
        where pr.boletin = p_boletin
           or pr.boletin_num = pat.base
      )
      and (
        (pat.sufijo is not null
         and a.materia ~ ('\m' || pat.base_dot || '-' || pat.sufijo || '\M'))
        or a.materia ~* ('(bolet[ií]n|bol\.)(\s+[^[:space:][:digit:]]+){0,2}\s+' || pat.base_dot || '\M(?!-[[:digit:]])')
      )
  ) g
  order by g.fecha desc nulls last
  limit 50;
$$;

revoke all on function public.lobby_menciones_de_boletin(text) from public;
revoke all on function public.lobby_menciones_de_boletin(text) from anon, authenticated;
