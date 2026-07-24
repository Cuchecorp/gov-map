-- 0066_actualidad_rpc.sql
-- Phase 99 (SEN-02) — RPC BOUNDED PII-safe de LECTURA del panel de actualidad.
-- `public.actualidad_senales_panel(p_tipo text default null)` lee la tabla precomputada
-- `actualidad_senal` (0065) y devuelve las 9 columnas del panel. Es la superficie que la
-- landing (Phase 100) consumirá con service_role (Camino A, 0044). Aguja completa espejo
-- de 0064_bounded_rpc_statement_timeout.sql: security definer, set search_path='',
-- set statement_timeout='5s', LIMIT explícito, DROP-before-CREATE (idiom 42P13),
-- DOBLE-REVOKE (from public Y from anon, authenticated), CERO grant.
--
-- La última migración APLICADA es 0064; 0065 (tabla+proc+cron) y esta 0066 se aplican en
-- el checkpoint operador de Plan 99-04 — NO por el agente.
-- Aplicar: PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0066_actualidad_rpc.sql
-- NUNCA `supabase db push` (drift schema_migrations). El BOM en `.env` rompe el CLI → pasar
-- `--db-url` explícito. Orden de apply: DESPUÉS de 0065_actualidad_senal.sql (la RPC lee su tabla).
--
-- ── ACL: CERO grant. Doble-revoke al final. ─────────────────────────────────────────────
-- service_role ejecuta vía .rpc() bypass ACL/RLS (Camino A, 0044). anon/authenticated NO.
-- La barrera de superficie del árbol público es el allowlist (lockdown-guard Direction-B),
-- no un grant: `actualidad_senales_panel` DEBE estar en PUBLIC_RPC_ALLOWLIST o el guard muerde.
--
-- ── SEGURIDAD DEL INPUT (ASVS V5) ───────────────────────────────────────────────────────
-- El filtro `p_tipo` es PARAMÉTRICO (`where p_tipo is null or s.tipo_senal = p_tipo`);
-- language sql, sin construcción de SQL por string → sin superficie de inyección.
--
-- ── NO-PII ──────────────────────────────────────────────────────────────────────────────
-- actualidad_senal es no-PII por construcción (solo conteos/labels/fechas/evidencia de
-- fuente); la RPC solo re-emite esas 9 columnas y NO hace join a tablas PII.

drop function if exists public.actualidad_senales_panel(text);

create or replace function public.actualidad_senales_panel(p_tipo text default null)
returns table (
  tipo_senal       text,
  ventana          text,
  conteo           int,
  cobertura_camara text,
  materia          text,
  cluster_id       int,
  fecha_max        timestamptz,
  supresion_causa  text,
  evidencia        jsonb
)
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'
as $$
  select s.tipo_senal, s.ventana, s.conteo, s.cobertura_camara,
         s.materia, s.cluster_id, s.fecha_max, s.supresion_causa, s.evidencia
  from public.actualidad_senal s
  where p_tipo is null or s.tipo_senal = p_tipo
  order by s.tipo_senal, s.cobertura_camara nulls last, s.cluster_id nulls last
  limit 200;
$$;

revoke all on function public.actualidad_senales_panel(text) from public;
revoke all on function public.actualidad_senales_panel(text) from anon, authenticated;
