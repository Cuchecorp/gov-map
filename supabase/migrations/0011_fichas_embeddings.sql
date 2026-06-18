-- 0011_fichas_embeddings.sql
-- Fichas estructuradas + búsqueda semántica (SEM-01/02/03).
--
-- Dos tablas 1:1 con `proyecto(boletin)`:
--   * proyecto_ficha      — idea matriz literal + cuerpos legales (jsonb) + estado de extracción.
--   * proyecto_embedding  — vector(768) versionado (model/dims/version) + índice HNSW cosine.
-- Más el RPC `match_proyectos` (kNN cosine con self-exclusion y threshold) para /buscar y similares.
--
-- Principios:
--   * provenance inline en proyecto_ficha (origen/fecha_captura): cada ficha lleva su fuente (FND-08).
--   * NINGÚN dato personal: estas tablas no llevan rut/email; `parlamentario` queda intacta
--     (deny-by-default). El RPC solo retorna (boletin, similarity) — nunca columnas no públicas (T-07-03).
--   * RLS PÚBLICO-READ EXPLÍCITO (Pitfall 2 / mismo patrón que 0008/0010): policy + grant select.
--   * GRANT EXECUTE del RPC a anon (adición crítica vs 0008/0010): sin él, el frontend (rol anon)
--     no podría invocar la búsqueda (Pitfall 2 / T-07-04). Grant sobre la firma EXACTA.
--   * HNSW + order by distancia CRUDA `<=>` ASC (Pitfall 3): el orden por distancia usa el índice;
--     similarity = 1 - distance se computa solo en el SELECT/WHERE, nunca en el ORDER BY.

-- ── proyecto_ficha (PK = boletín; 1:1 con proyecto) ──────────────────────────
create table proyecto_ficha (
  boletin         text primary key references proyecto(boletin),
  -- idea matriz = cita TEXTUAL del texto fuente, o NULL (degradación honesta first-class).
  idea_matriz     text,
  -- cuerpos legales citados textualmente (norma + artículos), serializados como jsonb.
  cuerpos_legales jsonb not null default '[]',
  -- ruta del texto íntegro crudo en R2 (el crudo nunca vive en Postgres, FND-02).
  texto_r2_path   text,
  -- estado del pipeline de extracción/embedding.
  estado          text not null default 'pendiente'
                    check (estado in ('pendiente', 'embebido')),
  -- provenance inline (FND-08).
  origen          text not null,
  fecha_captura   timestamptz not null default now()
);

-- ── proyecto_embedding (PK = boletín; 1:1 con proyecto) ──────────────────────
create table proyecto_embedding (
  boletin           text primary key references proyecto(boletin),
  -- vector truncado MRL a 768 dims (gemini-embedding-001).
  embedding         vector(768) not null,
  -- versionado SIEMPRE: ningún vector anónimo (FND-07) — habilita re-embedding incremental.
  embedding_model   text not null,
  embedding_dims    int  not null,
  embedding_version text not null
);

-- ── Índice HNSW cosine (Pitfall 3: el RPC ordena por la distancia cruda que usa este índice) ──
create index proyecto_embedding_hnsw
  on proyecto_embedding using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- ── RPC match_proyectos: kNN cosine con self-exclusion + threshold ───────────
-- security-invoker (default de `language sql`): lee solo tablas públicas; no escala privilegios.
-- Retorna SOLO (boletin, similarity) — jamás columnas no públicas (T-07-03).
create or replace function match_proyectos(
  query_embedding vector(768),
  match_count     int     default 20,
  match_threshold float8  default 0.0,     -- mínima SIMILARITY (1 - distancia) admitida
  exclude_boletin text    default null      -- self-exclusion para "proyectos similares"
)
returns table (boletin text, similarity float8)
language sql stable
as $$
  select e.boletin,
         1 - (e.embedding <=> query_embedding) as similarity
  from proyecto_embedding e
  where (exclude_boletin is null or e.boletin <> exclude_boletin)
    and 1 - (e.embedding <=> query_embedding) >= match_threshold
  order by e.embedding <=> query_embedding   -- distancia cruda ASC = mejor primero; usa HNSW
  limit match_count;
$$;

-- ── RLS público-read EXPLÍCITO (Pitfall 2) ───────────────────────────────────
-- Ambas tablas son DATOS PÚBLICOS (no llevan datos personales) → anon DEBE poder SELECT.
-- Sin estas policies, el deny-by-default heredado dejaría /buscar y la ficha sin datos.
-- NO hay policies de insert/update/delete: el writer usa service key (bypassa RLS).
alter table proyecto_ficha      enable row level security;
alter table proyecto_embedding  enable row level security;

create policy proyecto_ficha_public_read      on proyecto_ficha      for select to anon using (true);
create policy proyecto_embedding_public_read  on proyecto_embedding  for select to anon using (true);

-- GRANT explícito de SELECT a anon: la policy sin el privilegio de tabla no expone nada
-- (defensa en profundidad — el privilegio Y la policy deben coincidir).
grant select on proyecto_ficha      to anon;
grant select on proyecto_embedding  to anon;

-- GRANT EXECUTE del RPC a anon sobre la firma EXACTA (adición crítica vs 0008/0010, Pitfall 2).
-- Sin esto, el frontend (rol anon) no podría correr la búsqueda semántica.
grant execute on function match_proyectos(vector, int, float8, text) to anon;
