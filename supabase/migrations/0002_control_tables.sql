-- 0002_control_tables.sql
-- Plano de control de ingesta: ingest_run / source_snapshot / drift_alert.
--
-- Principios (FND-02/03/04/08):
--   * El crudo (XML/JSON/HTML) vive en R2; Postgres guarda SOLO la referencia
--     (r2_path/content_hash) + metadatos + provenance. NUNCA columnas de crudo.
--   * La unique key (source, resource, date_bucket) materializa la cache diaria.
--   * Provenance (source_url, fetched_at) se captura al ingestar.
--   * RLS deny-by-default: las 3 tablas no son legibles por anon (solo service role).

create table ingest_run (
  id            bigint generated always as identity primary key,
  source        text not null,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null default 'running'
                  check (status in ('running', 'ok', 'error')),
  stats         jsonb not null default '{}'::jsonb,
  error         text
);

create table source_snapshot (
  id            bigint generated always as identity primary key,
  ingest_run_id bigint references ingest_run(id),
  source        text not null,
  resource      text not null,                  -- endpoint/recurso logico
  cache_key     text not null,                  -- hash(source,endpoint,params,date-bucket)
  r2_path       text not null,                  -- {source}/{resource}/{date}/{sha}.{ext}
  content_hash  text not null,                  -- sha256 del crudo
  fingerprint   text not null,                  -- fingerprint estructural (FND-04)
  -- Provenance (FND-08) capturada al ingestar:
  source_url    text not null,
  fetched_at    timestamptz not null default now(),
  date_bucket   date not null,
  unique (source, resource, date_bucket)        -- cache diaria: 1 snapshot por dia
);
create index source_snapshot_cache_key_idx on source_snapshot (cache_key);
create index source_snapshot_content_hash_idx on source_snapshot (content_hash);

create table drift_alert (
  id               bigint generated always as identity primary key,
  source           text not null,
  resource         text not null,
  prev_fingerprint text,
  new_fingerprint  text not null,
  detected_at      timestamptz not null default now(),
  snapshot_id      bigint references source_snapshot(id),
  acknowledged     boolean not null default false
);

-- RLS deny-by-default (FND security V4/V8): enable sin policies para anon.
-- Las tablas de control solo se acceden via service role (Edge Functions/CI).
-- El frontend (anon) nunca las lee.
alter table ingest_run enable row level security;
alter table source_snapshot enable row level security;
alter table drift_alert enable row level security;
