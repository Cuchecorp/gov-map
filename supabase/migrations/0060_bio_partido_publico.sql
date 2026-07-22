-- 0060_bio_partido_publico.sql
-- Phase 91 — PERSONAS P2b (BIO-02/BIO-03/BIO-04):
-- El CANAL público de la ficha 360. RPCs security-definer PII-safe que sirven:
--   (1) cabecera con PARTIDO DIRECTO (militancia vigente + su fecha de fuente + origen),
--   (2) militancias históricas, (3) comisiones del parlamentario,
--   (4) el listado /parlamentarios ampliado con partido,
--   (5) cuatro cross-links factuales bounded (mismo partido / misma zona / misma comisión /
--       co-autoría), orden NEUTRAL, NUNCA ranking por afinidad.
--
-- ── DECISIÓN RECTORA DEL OPERADOR (2026-07-21) — REVIERTE la retención de 0020 ──────────
-- 0020_parlamentario_publico.sql OMITÍA deliberadamente `partido` de la cabecera pública
-- (comentarios "LEGAL-03": afiliación política tratada como PII sensible Ley 21.719).
-- El OPERADOR decidió el 2026-07-21 (decisión registrada, ver PROJECT.md §Constraints y el
-- CONTEXT de esta fase) REVERTIR esa retención: el PARTIDO POLÍTICO del CARGO ELECTO es
-- dato público ESENCIAL para accountability ciudadana (qué presenta, cómo vota, de qué
-- partido es), siempre rotulado "según fuente al [fecha_captura]". La minimización PLENA de
-- Ley 21.719 se reserva para TERCEROS / FAMILIARES / RUT / EMAIL — nunca para el partido del
-- electo. Esta migración por tanto NO altera 0020 in-place (evita 42P13 + re-arma default
-- privileges); crea firmas NUEVAS paralelas (`*_v2`) que SÍ emiten partido. El guard histórico
-- de LEGAL-03 no queda violado: 0020 sigue intacto; el partido lo emite una RPC nueva y
-- documentada, no una regresión silenciosa.
--
-- ── ORDEN DE APPLY / COMANDO ────────────────────────────────────────────────────────────
-- La última migración APLICADA es 0059 (bio + comisiones). Esta es la 0060 y se aplica DESPUÉS.
-- Migración ADITIVA (solo create-or-replace de funciones + revokes; sin DROP de tabla, sin
-- backfill) → dentro de la autoridad del agente (precedente 0055-0059).
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f \
--     supabase/migrations/0060_bio_partido_publico.sql
-- NUNCA `supabase db push` (drift de schema_migrations). Por el BOM en `.env`, pasar
-- `--db-url` explícito. build/typecheck NO prueban que Postgres ejecutó el DDL (Pitfall 6):
-- la única prueba válida es el pgTAP (0060_bio_partido_publico.test.sql) contra el schema APLICADO.
--
-- ── ACL (Camino A, post-0044): CERO grant ──────────────────────────────────────────────
-- El sitio ejecuta las RPCs con service_role (bypassa ACL/RLS). anon quedó a cero grants en
-- 0044. Cada RPC lleva el doble-revoke explícito VERBATIM de 0055 (revoke all … from public;
-- + from anon, authenticated;) para limpiar los DEFAULT PRIVILEGES que Postgres re-concede
-- sobre funciones nuevas de `public`. NUNCA re-emitir grant (re-abriría superficie REST no
-- autenticada; guard CI Block-A). Cada RPC además: `security definer set search_path = ''`
-- con nombres schema-qualified; p_id parametrizado (nunca interpolación de string); LIMIT
-- bounded en todo lo listable. Cero rut/email/partido_alias/datos de terceros.

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- SECCIÓN A — CABECERA v2 (partido DIRECTO desde militancia vigente)
-- ═══════════════════════════════════════════════════════════════════════════════════════
-- Firma NUEVA paralela a 0020 (no altera 0020: cambiar su returns table dispararía 42P13 y
-- re-armaría default privileges). Emite las MISMAS columnas que ParlamentarioPublicoRow MÁS
-- partido/partido_fecha_captura/partido_origen derivados de la militancia vigente.
drop function if exists public.parlamentario_publico_v2(text);

create or replace function public.parlamentario_publico_v2(p_id text)
returns table (
  id text, nombre text, camara text,
  region text, distrito text, circunscripcion text, periodo text,
  origen text, fecha_captura timestamptz, enlace text,
  -- Partido DIRECTO (decisión operador 2026-07-21): militancia vigente + su fuente.
  partido text, partido_fecha_captura timestamptz, partido_origen text
)
language sql stable security definer set search_path = '' as $$
  select p.id,
         coalesce(
           nullif(trim(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno)), ''),
           p.nombre_normalizado
         ) as nombre,
         p.camara,
         p.region, p.distrito, p.circunscripcion, p.periodo,
         p.origen, p.fecha_captura, p.enlace,
         -- Partido vigente derivado de parlamentario_militancia (es_actual). Tie-break por
         -- `desde` más reciente. Si no hay militancia vigente → NULLs honestos (no fabricar).
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
-- SECCIÓN B — MILITANCIAS del parlamentario (vigente primero, luego histórico)
-- ═══════════════════════════════════════════════════════════════════════════════════════
drop function if exists public.militancias_de_parlamentario(text);

create or replace function public.militancias_de_parlamentario(p_id text)
returns table (
  partido text, desde date, hasta date, es_actual boolean,
  origen text, fecha_captura timestamptz, enlace text
)
language sql stable security definer set search_path = '' as $$
  -- NUNCA partido_alias (forma normalizada interna). Orden: vigente primero, luego histórico
  -- cronológico descendente. LIMIT bounded.
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
language sql stable security definer set search_path = '' as $$
  -- JOIN comision_membresia → comision. Orden neutral alfabético por nombre. LIMIT bounded.
  -- provenance de la MEMBRESÍA (cm) — es el hecho "este parlamentario está en esta comisión".
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
-- SECCIÓN D — LISTADO v2 (/parlamentarios ampliado con partido)
-- ═══════════════════════════════════════════════════════════════════════════════════════
-- Firma NUEVA paralela a 0026 (mismo motivo que la cabecera v2). MISMAS 7 columnas del
-- listado MÁS partido/partido_fecha_captura/partido_origen (mismo LEFT JOIN lateral de
-- militancia vigente). Orden neutral (§10.5) igual que 0026. Sin cap (186 filas fijas): el
-- island de /parlamentarios filtra client-side sobre lo ya obtenido (jamás re-query a Supabase).
drop function if exists public.parlamentarios_publico_v2();

create or replace function public.parlamentarios_publico_v2()
returns table (
  id text, nombre text, camara text,
  region text, distrito text, circunscripcion text, periodo text,
  partido text, partido_fecha_captura timestamptz, partido_origen text
)
language sql stable security definer set search_path = '' as $$
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
  order by p.apellido_paterno nulls last, p.nombre_normalizado;  -- orden NEUTRAL (§10.5)
$$;

revoke all on function public.parlamentarios_publico_v2() from public;
revoke all on function public.parlamentarios_publico_v2() from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- SECCIÓN E — CROSS-LINKS FACTUALES bounded (Task 2)
-- ═══════════════════════════════════════════════════════════════════════════════════════
-- Relaciones DECLARADAS u OBSERVABLES por fuente oficial (militancia / zona electoral /
-- comisión / co-autoría). NUNCA ranking por afinidad: el orden es NEUTRAL (alfabético por
-- nombre) y los conteos son dato honesto, JAMÁS criterio de orden. Auto-exclusión del propio
-- parlamentario. LIMIT bounded en TODAS (T-91-03 DoS). Cero PII.

-- ── E.1 copartidarios: otros con la MISMA militancia vigente (por partido_alias normalizado) ──
drop function if exists public.copartidarios_de_parlamentario(text);

create or replace function public.copartidarios_de_parlamentario(p_id text)
returns table (id text, nombre text, camara text)
language sql stable security definer set search_path = '' as $$
  -- El match usa partido_alias (forma normalizada, la clave de agrupación correcta) pero NO
  -- se emite; se emiten solo id/nombre/camara públicos. Orden neutral alfabético.
  select p2.id,
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
  order by nombre
  limit 20;
$$;

revoke all on function public.copartidarios_de_parlamentario(text) from public;
revoke all on function public.copartidarios_de_parlamentario(text) from anon, authenticated;

-- ── E.2 misma zona: mismo distrito (Cámara) o misma circunscripción (Senado) ──────────────
drop function if exists public.de_la_misma_zona(text);

create or replace function public.de_la_misma_zona(p_id text)
returns table (id text, nombre text, camara text)
language sql stable security definer set search_path = '' as $$
  -- Zona = distrito (no null) coincidente O circunscripción (no null) coincidente. Los NULL
  -- NUNCA hacen match entre sí (dos parlamentarios sin distrito no son "de la misma zona").
  select p2.id,
         coalesce(
           nullif(trim(concat_ws(' ', p2.nombres, p2.apellido_paterno, p2.apellido_materno)), ''),
           p2.nombre_normalizado
         ) as nombre,
         p2.camara
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

-- ── E.3 co-comisionados: otros que comparten AL MENOS una comisión ────────────────────────
drop function if exists public.co_comisionados_de_parlamentario(text);

create or replace function public.co_comisionados_de_parlamentario(p_id text)
returns table (id text, nombre text, camara text, comision_nombre text)
language sql stable security definer set search_path = '' as $$
  -- distinct on por parlamentario (una fila por co-comisionado; la comisión compartida
  -- alfabéticamente primera como muestra). Orden neutral alfabético por nombre. LIMIT bounded.
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
  limit 20;
$$;

revoke all on function public.co_comisionados_de_parlamentario(text) from public;
revoke all on function public.co_comisionados_de_parlamentario(text) from anon, authenticated;

-- ── E.4 co-autores: otros con proyecto_autor confirmado en un boletín donde p_id también ──
--        es autor confirmado (co-autoría F48) ──────────────────────────────────────────────
drop function if exists public.coautores_de_parlamentario(text);

create or replace function public.coautores_de_parlamentario(p_id text)
returns table (id text, nombre text, camara text, n_proyectos int)
language sql stable security definer set search_path = '' as $$
  -- n_proyectos = conteo de boletines co-firmados (dato HONESTO). El orden es por NOMBRE,
  -- NUNCA por n_proyectos: ordenar por el conteo sería un ranking de afinidad (prohibido).
  select p2.id,
         coalesce(
           nullif(trim(concat_ws(' ', p2.nombres, p2.apellido_paterno, p2.apellido_materno)), ''),
           p2.nombre_normalizado
         ) as nombre,
         p2.camara,
         count(distinct a2.boletin)::int as n_proyectos
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
