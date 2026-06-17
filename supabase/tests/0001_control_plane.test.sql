-- 0001_control_plane.test.sql
-- Verifica el plano de control creado por migraciones 0001/0002.
-- Corre via `supabase test db` (pgTAP).

begin;
select plan(12);

-- 4 extensiones habilitadas por migracion (no por click) — FND-05.
select has_extension('vector',  'extension vector habilitada');
select has_extension('pg_cron', 'extension pg_cron habilitada');
select has_extension('pg_net',  'extension pg_net habilitada');
select has_extension('pgmq',    'extension pgmq habilitada');

-- 3 tablas de control existen.
select has_table('public', 'ingest_run',      'tabla ingest_run existe');
select has_table('public', 'source_snapshot', 'tabla source_snapshot existe');
select has_table('public', 'drift_alert',     'tabla drift_alert existe');

-- Unique key que materializa la cache diaria (FND-03).
select col_is_unique(
  'public', 'source_snapshot',
  ARRAY['source', 'resource', 'date_bucket'],
  'source_snapshot tiene unique (source, resource, date_bucket)'
);

-- Provenance inline en source_snapshot (FND-08).
select has_column('public', 'source_snapshot', 'source_url',  'source_snapshot.source_url presente');
select has_column('public', 'source_snapshot', 'fetched_at',  'source_snapshot.fetched_at presente');

-- RLS deny-by-default (V4/V8): enabled en las 3 tablas.
select is(
  (select count(*)::int from pg_class
     where relname in ('ingest_run', 'source_snapshot', 'drift_alert')
       and relrowsecurity = true),
  3,
  'RLS enabled en ingest_run/source_snapshot/drift_alert'
);

-- Sin policies para anon → deny-by-default efectivo en las 3 tablas.
select is_empty(
  $$ select polname from pg_policy p
     join pg_class c on c.oid = p.polrelid
     where c.relname in ('ingest_run', 'source_snapshot', 'drift_alert') $$,
  'ninguna policy definida en las tablas de control (deny-by-default)'
);

select * from finish();
rollback;
