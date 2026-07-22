-- 0056_busqueda_hibrida_boletin_norm.sql
-- Phase 87 — Bugfix RETR-01 bo-03: short-circuit no resolvía boletín punteado ("14.309-04").
-- Causa raíz: regex '^\d{3,6}(-\d{1,2})?$' requiere q sin puntos, pero runRpcHibrida
-- pasa q crudo desde el golden-set (no llama detectarBoletin antes).
-- Fix: normalización determinista DENTRO de la función. Si q_trim luce como boletín
-- punteado (^\d{1,3}(\.\d{3})*(-\d{1,2})?$), se quitan los puntos de millar → q_norm.
-- El regex punteado cubre "14.309-04", "14.309", "1.234.567-08" pero NO "12.34" ni "hola".
-- Orden de apply: DESPUÉS de 0055_busqueda_hibrida.sql
-- Aplicar: PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0056_busqueda_hibrida_boletin_norm.sql
-- NUNCA supabase db push (drift schema_migrations).
--
-- Migración ADITIVA: create or replace function (idiom 42P13 — drop explícito previo para
-- cambio de idioma/volatility; firma idéntica, solo body cambia).
-- Sin backfill, sin DDL destructivo → no requiere checkpoint de operador.
--
-- ── ACL: idéntica a 0055 ──
-- T-87-01: CERO grant. Doble-revoke al final (DEFAULT PRIVILEGES cleanup).
-- service_role ejecuta vía .rpc() bypass ACL/RLS (Camino A, 0044).

-- Drop previo para allow create-or-replace sin error de tipo (idiom 42P13, espejo 0055:54)
drop function if exists public.buscar_proyectos_hibrido(text, vector, int);

create or replace function public.buscar_proyectos_hibrido(
  q               text,
  query_embedding vector(768),
  match_count     int default 20
)
returns table (boletin text, rank int)   -- PII-safe: SOLO (boletin, rank)
language plpgsql stable security definer set search_path = '' as $$
declare
  q_trim  text;
  q_norm  text;
begin
  -- ── Normalización determinista del input ───────────────────────────────────
  -- Quitar espacios extremos primero.
  q_trim := btrim(q);

  -- Si q_trim luce como boletín punteado (formato "14.309-04" o "14.309"),
  -- quitar los puntos de millar → q_norm = "14309-04" o "14309".
  -- Patrón punteado (A3 — pin bo-03):
  --   ^\d{1,3}(\.\d{3})*(-\d{1,2})?$   cubre "14.309-04", "1.234", "14.309"
  --   NO cubre "12.34" (grupo después del punto tiene 2 dígitos, no 3).
  if q_trim ~ '^\d{1,3}(\.\d{3})*(-\d{1,2})?$' then
    q_norm := replace(q_trim, '.', '');
  else
    q_norm := q_trim;
  end if;

  return query
  with boletin_hit as (
    -- ── Short-circuit de boletín (RETR-01) ────────────────────────────────────
    -- Cubre: "14309-04" (canónico), "14309" (base), "14.309-04" → normalizado a "14309-04".
    -- boletin_num (0008:20) = parte base sin sufijo ("-04").
    select p.boletin, 0 as rank
    from public.proyecto p
    where q_norm ~ '^\d{3,6}(-\d{1,2})?$'
      and (p.boletin = q_norm or p.boletin_num = split_part(q_norm, '-', 1))
    limit 1
  ),
  -- ── Rama FTS ponderada A/B/C (RETR-02/RETR-05) ────────────────────────────
  -- LEFT JOIN a proyecto_ficha (NO INNER): preserva los 559 proyectos sin ficha,
  -- buscables siempre por título (peso A). Ningún proyecto queda inbuscable.
  -- websearch_to_tsquery('public.es_unaccent', q): config schema-qualified obligatoria
  -- bajo search_path='' (Pitfall 1 — 'es_unaccent' sin schema no resuelve).
  -- Usa q (crudo) para FTS — websearch_to_tsquery tolera puntos/texto libre.
  full_text as (
    select p.boletin,
           row_number() over (
             order by ts_rank_cd(
               setweight(to_tsvector('public.es_unaccent', coalesce(p.titulo, '')),       'A') ||
               setweight(to_tsvector('public.es_unaccent', coalesce(f.idea_matriz, '')),  'B') ||
               setweight(to_tsvector('public.es_unaccent', coalesce(
                 (select string_agg(c->>'norma', ' ')
                  from jsonb_array_elements(f.cuerpos_legales) c), '')),                  'C'),
               websearch_to_tsquery('public.es_unaccent', q)
             ) desc
           ) as rank_ix
    from public.proyecto p
    left join public.proyecto_ficha f on f.boletin = p.boletin
    where (
      setweight(to_tsvector('public.es_unaccent', coalesce(p.titulo, '')),       'A') ||
      setweight(to_tsvector('public.es_unaccent', coalesce(f.idea_matriz, '')),  'B') ||
      setweight(to_tsvector('public.es_unaccent', coalesce(
        (select string_agg(c->>'norma', ' ')
         from jsonb_array_elements(f.cuerpos_legales) c), '')),                  'C')
    ) @@ websearch_to_tsquery('public.es_unaccent', q)
    limit least(match_count, 50) * 2
  ),
  -- ── Rama semántica kNN (HNSW cosine, proyecto_embedding, 0011) ────────────
  -- row_number sobre distancia cruda; el índice HNSW cosine (0011) lo acelera.
  -- operator(public.<=>) calificado (search_path='', Rule 1).
  semantic as (
    select e.boletin,
           row_number() over (order by e.embedding operator(public.<=>) query_embedding) as rank_ix
    from public.proyecto_embedding e
    order by e.embedding operator(public.<=>) query_embedding
    limit least(match_count, 50) * 2
  ),
  -- ── Fusión RRF (rrf_k=50, w_fts=w_sem=1, SPIKE 86 LOCKED) ───────────────
  fused as (
    select coalesce(ft.boletin, sm.boletin) as boletin,
           row_number() over (
             order by
               coalesce(1.0 / (50 + ft.rank_ix), 0.0) +
               coalesce(1.0 / (50 + sm.rank_ix), 0.0) desc
           )::int as rank
    from full_text ft
    full outer join semantic sm on ft.boletin = sm.boletin
  )
  -- ── Salida: short-circuit-o-fused (RETR-01) ──────────────────────────────
  select bh.boletin, 0 as rank from boletin_hit bh
  union all
  select fu.boletin, fu.rank from fused fu
  where not exists (select 1 from boletin_hit)
  order by rank
  limit least(match_count, 50);
end;
$$;

-- ── ACL doble-revoke, CERO grant (T-87-01, espejo VERBATIM 0055:137-138) ─────
-- Firma EXACTA (text, vector, int) — Pitfall 4.
revoke all on function public.buscar_proyectos_hibrido(text, vector, int) from public;
revoke all on function public.buscar_proyectos_hibrido(text, vector, int) from anon, authenticated;
-- CERO grant: re-emitir uno re-abriría superficie REST no autenticada (guard CI Block-A).
