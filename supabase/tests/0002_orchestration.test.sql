-- 0002_orchestration.test.sql
-- Verifica la orquestacion creada por la migracion 0003 (FND-05):
--   * queues ingest_jobs e ingest_dlq existen (pgmq.list_queues)
--   * la funcion util.process_ingest_jobs existe
--   * el cron job process-ingest-jobs esta registrado en cron.job
--   * los helpers de config (project_url/worker_secret) existen
--   * CR-04: util.worker_secret (no service_key) es el Bearer del worker
--   * CR-04: util.cleanup_net_http existe y el cron de cleanup esta registrado
-- Corre via `supabase test db` (pgTAP).

begin;
select plan(9);

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

-- CR-04: el Bearer del worker es un secreto dedicado, NO el service_role.
select has_function('util', 'worker_secret', 'util.worker_secret() existe (CR-04)');
select hasnt_function(
  'util', 'service_key',
  'util.service_key fue removido (CR-04: no se manda service_role por pg_net)'
);

-- CR-04: cleanup de las tablas internas de pg_net.
select has_function('util', 'cleanup_net_http', 'util.cleanup_net_http() existe (CR-04)');

-- El cron job esta registrado (orquestacion versionada en SQL).
select is(
  (select count(*)::int from cron.job where jobname = 'process-ingest-jobs'),
  1,
  'cron job process-ingest-jobs registrado'
);

-- CR-04: el cron de cleanup de pg_net esta registrado.
select is(
  (select count(*)::int from cron.job where jobname = 'cleanup-net-http'),
  1,
  'cron job cleanup-net-http registrado (CR-04)'
);

select * from finish();
rollback;
