-- 0063_lobby_menciones_una_fila_por_audiencia.sql
-- Phase 92 — REVIEW-FIX (CR-01 BLOCKER + WR-02/WR-03 + IN-01):
-- Corrige la RPC `lobby_menciones_de_boletin(text)` de 0062 (INMUTABLE, ya aplicada a
-- PROD) SIN tocar 0062. El fan-out del `left join public.lobby_contraparte` emitía UNA
-- FILA POR (audiencia × contraparte) — una audiencia con ≥2 contrapartes producía filas
-- duplicadas, keys React colisionadas, y un `total_n = count(*) over ()` DESHONESTO
-- (contaba contraparte-filas, no audiencias). Fix: UNA FILA POR AUDIENCIA (agrega las
-- contrapartes por audiencia) y `total_n` sobre el conjunto de AUDIENCIAS distintas.
--
-- ── ORDEN DE APPLY / COMANDO ────────────────────────────────────────────────────────────
-- La última migración APLICADA es 0062. Esta es la 0063 y se aplica DESPUÉS. La RPC NO
-- cambia su returns table (mismas columnas y tipos, mismos NOMBRES — ver nota de compat
-- del deploy vivo abajo) → un `create or replace` bastaría; aun así llevamos el
-- DROP+recreate+doble-revoke VERBATIM (precedente 0061) por robustez idempotente y para
-- re-limpiar los DEFAULT PRIVILEGES de `public`. Migración ADITIVA sobre función (sin
-- DROP de tabla, sin backfill) → dentro de la autoridad del agente para ESCRIBIR.
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f \
--     supabase/migrations/0063_lobby_menciones_una_fila_por_audiencia.sql
-- NUNCA `supabase db push` (drift de schema_migrations). Aplicar UNA vez. La única prueba
-- válida del DDL es el pgTAP (0062_lobby_menciones_de_boletin.test.sql, extendido con el
-- caso multi-contraparte de WR-03) contra el schema APLICADO.
--
-- ── COMPAT CON EL DEPLOY VIVO (fa4d4369) ────────────────────────────────────────────────
-- El deploy en PROD (fa4d4369) tiene la VISTA VIEJA de 0062 que renderiza una <li> por
-- fila y compone la contraparte con [contraparte_nombre · contraparte_rol · representado].
-- El fix de UI (una fila por audiencia en la vista) viaja en el PRÓXIMO deploy (Plan 93/94).
-- Para NO romper el deploy vivo cuando 0063 se aplica ANTES de ese deploy, se PRESERVAN los
-- NOMBRES y tipos de las columnas EXACTOS de 0062. La agregación de contrapartes se
-- MATERIALIZA en `contraparte_nombre` (la línea completa "nombre · rol · representado" de
-- cada contraparte, unida por " / " entre contrapartes de la misma audiencia); las columnas
-- `contraparte_rol` y `representado` se emiten NULL → la vista vieja (que filtra NULLs y
-- las une con " · ") muestra exactamente la línea compuesta, sin duplicar audiencias.
--
-- ── ACL (Camino A, post-0044): CERO grant ──────────────────────────────────────────────
-- doble-revoke VERBATIM (from public; + from anon, authenticated;). security definer
-- set search_path = '' con nombres schema-qualified; p_boletin parametrizado + guard de
-- formato interno (IN-01); LIMIT bounded. Cero rut/email/contraparte_id.
--
-- ── FAIL-CLOSED (idéntico a 0062, sin cambios de semántica de MATCH) ─────────────────────
--   (1) MENCIÓN EXPLÍCITA context-gated (espejo del extractor TS) — branches (a)/(b) VERBATIM.
--   (2) EXISTENCIA en `public.proyecto`.
--   IDENTIDAD: estado_vinculo='confirmado' + parlamentario_id not null.
--   PII-SAFE: sin contraparte_id ni RUT.
--
-- ── IN-01 (defense-in-depth) ────────────────────────────────────────────────────────────
-- La RPC está en PUBLIC_RPC_ALLOWLIST (invocable desde cualquier lado). Un `p_boletin`
-- malformado (metacaracteres regex, o base vacía → `base_dot = (|)` que matchea en todos
-- lados) causaría falsos positivos. Guard interno: si `p_boletin` no es `^\d{3,6}(-\d{1,2})?$`
-- ni su forma punteada canónica, el `req` produce base='' y el WHERE `req.ok` corta a 0 filas
-- ANTES de construir el patrón — el fail-closed no depende de que cada caller valide.

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
language sql stable security definer set search_path = '' as $$
  with req as (
    -- IN-01: valida p_boletin ANTES de derivar la base. Acepta la forma canónica del
    -- extractor TS ("14309" | "14309-04", base PLANA de 3-6 dígitos — espejo de BOLETIN_RE
    -- `^\d{3,6}(-\d{1,2})?$`) Y la punteada ("14.309" | "14.309-04"). Si NO calza,
    -- `ok=false` → el WHERE corta a 0 filas (fail-closed defensa-en-profundidad).
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
  -- CR-01: total_n = count(*) over () sobre el conjunto de AUDIENCIAS distintas (ya
  -- agregadas), NO sobre contraparte-filas → conteo HONESTO de audiencias.
  select g.identificador, g.fecha, g.materia, g.parlamentario_id,
         g.parlamentario_nombre, g.contraparte_nombre, g.contraparte_rol,
         g.representado, g.enlace_detalle, g.origen, g.fecha_captura, g.enlace,
         count(*) over () as total_n
  from (
    -- CR-01: UNA FILA POR AUDIENCIA. Se agregan las contrapartes por audiencia en la
    -- subquery lateral `cp` (línea "nombre · rol · representado" por contraparte, unida
    -- por " / " entre contrapartes, distinct + ordenada para salida determinista). Las
    -- columnas contraparte_rol/representado quedan NULL para compat con la vista vieja del
    -- deploy vivo (ver nota de COMPAT arriba): la vista filtra NULLs y muestra la línea
    -- compuesta de contraparte_nombre.
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
    -- Agregación de contrapartes POR AUDIENCIA (una sola fila por identificador).
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
    where pat.ok                              -- IN-01: p_boletin bien formado
      and a.estado_vinculo = 'confirmado'
      and a.parlamentario_id is not null      -- FAIL-CLOSED identidad (espejo 0048)
      and a.materia is not null
      -- FAIL-CLOSED #2 (existencia): el boletín debe existir en `proyecto`. Se usa EXISTS
      -- (no join) para que un `boletin_num` que calce >1 fila de proyecto (distintos
      -- sufijos) NO fanee la audiencia a múltiples filas (CR-01: una fila/audiencia).
      and exists (
        select 1 from public.proyecto pr
        where pr.boletin = p_boletin
           or pr.boletin_num = pat.base
      )
      and (
        -- (a) MENCIÓN CON sufijo -NN (VERBATIM de 0062 branch a).
        (pat.sufijo is not null
         and a.materia ~ ('\m' || pat.base_dot || '-' || pat.sufijo || '\M'))
        -- (b) MENCIÓN de la BASE pelada tras gatillo (VERBATIM de 0062 branch b).
        or a.materia ~* ('(bolet[ií]n|bol\.)(\s+[^[:space:][:digit:]]+){0,2}\s+' || pat.base_dot || '\M(?!-[[:digit:]])')
      )
  ) g
  order by g.fecha desc nulls last
  limit 50;
$$;

revoke all on function public.lobby_menciones_de_boletin(text) from public;
revoke all on function public.lobby_menciones_de_boletin(text) from anon, authenticated;
