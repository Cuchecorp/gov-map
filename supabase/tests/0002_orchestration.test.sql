-- 0002_orchestration.test.sql
-- Verifica la orquestacion creada por la migracion 0003 (FND-05):
--   * queues ingest_jobs e ingest_dlq existen (pgmq.list_queues)
--   * la funcion util.process_ingest_jobs existe
--   * el cron job process-ingest-jobs esta registrado en cron.job
--   * los helpers de config (project_url/service_key) existen
-- Corre via `supabase test db` (pgTAP).

begin;
select plan(6);

-- Las dos queues pgmq existen (definidas por migracion, no por click).
select is(
  (select count(*)::int from pgmq.list_queues()
     where queue_name = 'ingest_jobs'),
  1,
  'queue pgmq ingest_jobs existe'
);
select is(
  (select count(*)::int from pgmq.list_queues()
     where queue_name = 'ingest_dlq'),
  1,
  'queue pgmq ingest_dlq (DLQ) existe'
);

-- El schema util y el dispatcher existen.
select has_function(
  'util', 'process_ingest_jobs',
  'util.process_ingest_jobs (dispatcher) existe'
);

-- Helpers de configuracion (no hardcodean el secret).
select has_function('util', 'project_url', 'util.project_url() existe');
select has_function('util', 'service_key', 'util.service_key() existe');

-- El cron job esta registrado (orquestacion versionada en SQL).
select is(
  (select count(*)::int from cron.job where jobname = 'process-ingest-jobs'),
  1,
  'cron job process-ingest-jobs registrado'
);

select * from finish();
rollback;
