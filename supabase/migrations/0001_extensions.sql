-- 0001_extensions.sql
-- Habilita por migracion (no por click) las extensiones del plano de control.
-- vector se habilita ya aunque su uso real sea Fase 7 — es barato y evita churn.

create extension if not exists vector;   -- pgvector 0.8.x
create extension if not exists pg_cron;  -- scheduler en Postgres (orquestacion, Plan 03)
create extension if not exists pg_net;   -- HTTP async desde SQL (invoca Edge Functions)
create extension if not exists pgmq;     -- Supabase Queues (cola durable de ingesta)
