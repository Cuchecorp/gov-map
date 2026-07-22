-- 0055_busqueda_hibrida.sql
-- Phase 87 — BÚSQUEDA P1b (RETR-01/RETR-02/RETR-05):
-- Materializa la decisión LOCKED del SPIKE 86 (RRF domina: 43.8/68.8/53.6).
-- Orden de apply: aplicar DESPUÉS de 0054_leyes_rotacion_estado.sql
-- Aplicar: PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0055_busqueda_hibrida.sql
-- NUNCA supabase db push (drift schema_migrations).
--
-- Migración ADITIVA: extension + config FTS + índice GIN + RPC nueva + ACL doble-revoke.
-- Sin DROP destructivo, sin backfill → NO requiere checkpoint de operador.
--
-- ── ACL (Camino A, post-0044): CERO grant ──
-- El sitio ejecuta la RPC con service_role (bypassa ACL/RLS). anon quedó a cero grants
-- en 0044. El doble-revoke explícito limpia concesiones DEFAULT PRIVILEGES que el rol
-- supabase_admin/aplicación re-concede automáticamente sobre funciones nuevas de public.
-- T-87-01: CERO grant a anon/public/service_role. Doble-revoke al final.
-- T-87-02: returns table (boletin text, rank int) — SOLO 2 columnas, sin PII.
-- T-87-03: q parametrizado; websearch_to_tsquery no interpola; search_path=''.
-- T-87-04: caps de fila desde el día 1 (least(match_count,50), *2 por rama).

-- ── SECCIÓN 1: extension unaccent ──────────────────────────────────────────────────────
create extension if not exists unaccent;

-- ── SECCIÓN 2: wrapper f_unaccent IMMUTABLE + config text-search es_unaccent ───────────
-- El wrapper IMMUTABLE (forma 2-arg) es necesario para índices trgm futuros (fase 88).
-- La config es_unaccent aplica unaccent DENTRO del pipeline tsvector/tsquery para que
-- el mismo normalizador opere en índice Y consulta (simétrico por construcción, LOCKED).
create or replace function public.f_unaccent(text)
  returns text
  language sql immutable parallel safe strict
  as $$ select public.unaccent('public.unaccent', $1) $$;

-- A2 (orchestrator): envolver en DO-exception para idempotencia total (la config no tiene
-- IF NOT EXISTS nativo; si ya existe lanza error benigno que aborta --single-transaction).
do $$ begin
  create text search configuration public.es_unaccent ( copy = spanish );
exception when duplicate_object then
  null;
end $$;

alter text search configuration public.es_unaccent
  alter mapping for hword, hword_part, word
  with public.unaccent, spanish_stem;

-- ── SECCIÓN 3: índice GIN de expresión sobre tsv del título ────────────────────────────
-- Acelera el brazo del título (peso A = el bug estrella RETR-02).
-- El índice es sobre public.proyecto.titulo solamente; el tsv combinado A||B||C cruza
-- tablas (LEFT JOIN proyecto_ficha) → no es indexable como expresión única.
-- La config public.es_unaccent DEBE estar creada ANTES de este CREATE INDEX.
create index if not exists idx_proyecto_titulo_fts
  on public.proyecto using gin (to_tsvector('public.es_unaccent', coalesce(titulo, '')));

-- ── SECCIÓN 4: RPC buscar_proyectos_hibrido ────────────────────────────────────────────
-- La RPC es nueva; drop defensivo previo al create (idiom 42P13, espejo 0049:56).
drop function if exists public.buscar_proyectos_hibrido(text, vector, int);

create or replace function public.buscar_proyectos_hibrido(
  q               text,
  query_embedding vector(768),
  match_count     int default 20
)
returns table (boletin text, rank int)   -- PII-safe: SOLO (boletin, rank)
language sql stable security definer set search_path = '' as $$
  -- ── Short-circuit de boletín (RETR-01) ──────────────────────────────────────────────
  -- Si q tiene formato de boletín (NNNNN o NNNNN-NN), devuelve rank 0 = tope absoluto.
  -- Cubre los formatos: "14309-04", "14309" (número base).
  -- El formato punteado ("14.309-04") se normaliza en buscar.ts ANTES de llamar a la RPC
  -- (detectarBoletin → full form sin punto). boletin_num (0008:20) = base sin sufijo.
  with boletin_hit as (
    select p.boletin, 0 as rank
    from public.proyecto p
    where q ~ '^\d{3,6}(-\d{1,2})?$'
      and (p.boletin = q or p.boletin_num = split_part(q, '-', 1))
    limit 1
  ),
  -- ── Rama FTS ponderada A/B/C (RETR-02/RETR-05) ──────────────────────────────────────
  -- LEFT JOIN a proyecto_ficha (NO INNER): preserva los 559 proyectos sin ficha,
  -- buscables siempre por título (peso A). Ningún proyecto queda inbuscable.
  -- websearch_to_tsquery('public.es_unaccent', q): config schema-qualified obligatoria
  -- bajo search_path='' (Pitfall 1 — 'es_unaccent' sin schema no resuelve con search_path='').
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
  -- ── Rama semántica kNN (HNSW cosine, proyecto_embedding, 0011) ──────────────────────
  -- row_number sobre distancia cruda; el índice HNSW cosine (0011) lo acelera.
  semantic as (
    select e.boletin,
           row_number() over (order by e.embedding <=> query_embedding) as rank_ix
    from public.proyecto_embedding e
    order by e.embedding <=> query_embedding
    limit least(match_count, 50) * 2
  ),
  -- ── Fusión RRF (rrf_k=50, w_fts=w_sem=1, SPIKE 86 LOCKED) ──────────────────────────
  fused as (
    select coalesce(ft.boletin, sm.boletin) as boletin,
           row_number() over (
             order by
               coalesce(1.0 / (50 + ft.rank_ix), 0.0) +   -- w_fts=1
               coalesce(1.0 / (50 + sm.rank_ix), 0.0) desc -- w_sem=1, rrf_k=50
           )::int as rank
    from full_text ft
    full outer join semantic sm on ft.boletin = sm.boletin
  )
  -- ── Salida: short-circuit-o-fused (RETR-01 red de seguridad) ────────────────────────
  select boletin, 0 as rank from boletin_hit
  union all
  select boletin, rank from fused
  where not exists (select 1 from boletin_hit)
  order by rank
  limit least(match_count, 50);
$$;

-- ── SECCIÓN 5: ACL doble-revoke, CERO grant (T-87-01, espejo VERBATIM 0049:114-115) ───
-- Firma EXACTA (text, vector, int) — Pitfall 4: firma incorrecta en regprocedure = error silencioso.
-- service_role ejecuta vía .rpc() sin necesitar grant (Camino A, bypass ACL/RLS).
revoke all on function public.buscar_proyectos_hibrido(text, vector, int) from public;
revoke all on function public.buscar_proyectos_hibrido(text, vector, int) from anon, authenticated;
-- CERO grant: re-emitir uno re-abriría superficie REST no autenticada (guard CI Block-A).
