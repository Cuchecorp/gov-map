-- 0003_orchestration.sql
-- Orquestacion de ingesta dirigida por cola (FND-05) — clon del patron
-- "automatic embeddings" de Supabase, parametrizado para ingest jobs:
--
--   pg_cron (cada 30s) -> util.process_ingest_jobs()
--     -> pgmq.read('ingest_jobs', vt, qty)  (vt = backoff natural ante 429/5xx)
--     -> net.http_post a <project_url>/functions/v1/ingest-worker
--        con Authorization: Bearer <service_key>  (NUNCA hardcodeado)
--   read_ct > umbral -> pgmq.archive a la DLQ (poison message, no loop infinito)
--
-- Toda la orquestacion vive en esta migracion versionada (Pitfall 5: nada
-- clickeado en el dashboard; reproducible desde git con `supabase db reset`).

-- ---------------------------------------------------------------------------
-- 1. Queues durables (pgmq). ingest_jobs = trabajo; ingest_dlq = dead-letter.
-- ---------------------------------------------------------------------------
select pgmq.create('ingest_jobs');
select pgmq.create('ingest_dlq');

-- ---------------------------------------------------------------------------
-- 2. Schema util + helpers de configuracion.
--    El project_url y el service_key se leen de settings/vault — NO se
--    hardcodean como literal en la migracion (T-01-09 / T-01-10).
--    En local, `supabase db reset` deja estos GUC sin setear; los helpers
--    devuelven el fallback local. En produccion se setean via:
--      alter database postgres set app.settings.project_url = 'https://<ref>.supabase.co';
--      alter database postgres set app.settings.service_key = '<service_role_key>';  -- o vault
-- ---------------------------------------------------------------------------
create schema if not exists util;

-- URL base del proyecto (para construir /functions/v1/ingest-worker).
create or replace function util.project_url()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v text;
begin
  -- Preferir el valor de vault si existe; si no, el GUC; fallback = kong local.
  begin
    select decrypted_secret into v
      from vault.decrypted_secrets
     where name = 'project_url'
     limit 1;
  exception when others then
    v := null;
  end;
  if v is null or v = '' then
    v := current_setting('app.settings.project_url', true);
  end if;
  -- Fallback local: el gateway interno de Supabase para invocar Edge Functions.
  return coalesce(nullif(v, ''), 'http://kong:8000');
end;
$$;

-- Service role key (Bearer del worker). Solo se usa server-side, nunca al cliente.
create or replace function util.service_key()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v text;
begin
  begin
    select decrypted_secret into v
      from vault.decrypted_secrets
     where name = 'service_key'
     limit 1;
  exception when others then
    v := null;
  end;
  if v is null or v = '' then
    v := current_setting('app.settings.service_key', true);
  end if;
  -- Sin literal hardcodeado: si no esta configurado, devuelve cadena vacia
  -- (la invocacion fallara con 401 y el mensaje reaparecera via vt — visible,
  -- no un secreto filtrado).
  return coalesce(nullif(v, ''), '');
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Dispatcher: lee un lote de ingest_jobs e invoca al worker Edge Function.
--    - vt (visibility timeout) = backoff natural: el mensaje no-ackeado
--      reaparece al expirar el vt (reintento diferido ante 429/5xx).
--    - read_ct alto (> max_read_ct) => pgmq.archive a la DLQ: el mensaje
--      veneno deja de loopear (T-01-11 DoS interno).
--    - Procesa SOLO el lote leido (Pitfall 1: nunca todo de una; chunking).
-- ---------------------------------------------------------------------------
create or replace function util.process_ingest_jobs(
  batch_size   int default 5,
  max_requests int default 4,        -- conservado de la firma del patron
  timeout_ms   int default 300000,   -- vt en ms (backoff); 5 min por defecto
  max_read_ct  int default 5         -- umbral de poison-message -> DLQ
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  vt_seconds int := greatest(1, (timeout_ms / 1000));
  msg        record;
  batch      jsonb := '[]'::jsonb;
begin
  -- max_requests se conserva en la firma por paridad con el patron "automatic
  -- embeddings" (limita el numero de invocaciones concurrentes en variantes con
  -- fan-out); en M1 el dispatcher hace una sola invocacion por tick.
  perform max_requests;
  -- Leer un lote con visibility timeout: los mensajes leidos quedan invisibles
  -- vt_seconds; si NO se ackean (pgmq.delete) reaparecen => backoff diferido.
  for msg in
    select * from pgmq.read('ingest_jobs', vt_seconds, batch_size)
  loop
    -- Poison message: demasiados reintentos. Lo movemos a la cola dead-letter
    -- (ingest_dlq) para inspeccion humana y lo archivamos en ingest_jobs para
    -- que deje de loopear (T-01-11). El crudo del payload no se pierde: queda
    -- en ingest_dlq + en el archivo de ingest_jobs.
    if msg.read_ct > max_read_ct then
      perform pgmq.send('ingest_dlq', msg.message);
      perform pgmq.archive('ingest_jobs', msg.msg_id);
      continue;
    end if;

    -- El worker ackea (pgmq.delete) cada msg_id en exito; por eso el batch
    -- lleva el msg_id ademas del payload.
    batch := batch || jsonb_build_object('msg_id', msg.msg_id, 'message', msg.message);
  end loop;

  -- Nada que despachar este tick.
  if jsonb_array_length(batch) = 0 then
    return;
  end if;

  -- Invocar el worker via pg_net (HTTP async). El service_key viaja como
  -- Bearer SOLO en este request server-side (nunca al cliente, nunca al log).
  perform net.http_post(
    url     := util.project_url() || '/functions/v1/ingest-worker',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || util.service_key()
               ),
    body    := jsonb_build_object('batch', batch),
    timeout_milliseconds := timeout_ms
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Cron schedule: dispara el dispatcher cada 30 segundos.
--    Definido en SQL (versionado), no clickeado en el dashboard (Pitfall 5).
-- ---------------------------------------------------------------------------
select cron.schedule(
  'process-ingest-jobs',
  '30 seconds',
  $$ select util.process_ingest_jobs(); $$
);
