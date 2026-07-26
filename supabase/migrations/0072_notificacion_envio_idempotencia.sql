-- 0072_notificacion_envio_idempotencia.sql
--
-- ████ WR-04: IDEMPOTENCIA DEL LOG DE ENVÍO — un 'enviado'/día por (user, suscripción) ████
--
-- Phase 103 — NOTIF P3a (code-review fix WR-04). `notificacion_envio` (0070) NO tenía
-- clave de unicidad: si el cron se re-despacha el mismo día (workflow_dispatch +
-- concurrency cancel-in-progress:false permite un rerun encolado), un grupo ya avanzado
-- podía re-procesarse tras un fallo parcial y los grupos exitosos acumulaban una SEGUNDA
-- fila 'enviado'. `leerCursor` tolera duplicados (toma el max enviado_at), así que NO hay
-- pérdida de datos, pero el log acumula filas 'enviado' duplicadas y la idempotencia del
-- cursor era solo por-lectura, no por-construcción.
--
-- ── DISEÑO: índice único PARCIAL sobre el DÍA de envío (UTC) ─────────────────────
-- Un índice único parcial garantiza a lo más UNA fila 'enviado' por (user_id,
-- suscripcion_id, día-UTC-de-enviado_at). Se castea a la fecha en UTC para casar con el
-- `fecha`/`enviado_at` que el CLI computa en UTC (new Date().toISOString().slice(0,10)).
-- Solo cubre estado='enviado' con enviado_at no nulo → las filas 'pendiente'/'error'
-- (sin enviado_at o reintentables) NO entran en la restricción y pueden repetirse.
--   El CLI hace UPSERT con onConflict sobre estas columnas → un re-run del mismo día
--   ACTUALIZA la fila del día (ultimo_evento_visto/enviado_at) en vez de insertar otra.
--
-- ── IDEMPOTENTE / RE-EJECUTABLE ─────────────────────────────────────────────────
-- `create unique index if not exists` → re-aplicar es no-op. NO altera RLS/grants de 0070
-- (sigue service_role-only, deny-by-default, sin policy ni grant a authenticated).
--
-- ── ORDEN DE APPLY / COMANDO (Plan 05) ──────────────────────────────────────────
-- 0070 YA está aplicada a PROD; esta es la 0072 (NO se edita 0070). Se aplica DESPUÉS
-- de 0071. PENDIENTE DE APLICAR A PROD (no es tarea del fixer — lo hace el operador):
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f \
--     supabase/migrations/0072_notificacion_envio_idempotencia.sql
-- NUNCA `supabase db push`. Windows: PGCLIENTENCODING=UTF8.
--
-- ⚠ PRE-APLICACIÓN: si PROD ya tuviera filas 'enviado' DUPLICADAS del bug, el índice
--   único fallará al crearse. De-duplicar primero (conservar el max enviado_at por clave)
--   antes de correr esta migración. Con el cron aún gated (NOTIF_PUBLIC_ENABLED=false) no
--   debería haber envíos reales todavía → creación limpia esperada.
--
-- ████████████████████████████████████████████████████████████████████████████████

-- ── Índice único parcial: a lo más un 'enviado'/día por (user, suscripción) ────────
create unique index if not exists notificacion_envio_enviado_dia_uk
  on notificacion_envio (
    user_id,
    suscripcion_id,
    ((enviado_at at time zone 'UTC')::date)
  )
  where estado = 'enviado' and enviado_at is not null;

-- ── FIN WR-04 (idempotencia notificacion_envio) ───────────────────────────────────
-- schema_migrations (insertar tras aplicar a PROD):
-- insert into schema_migrations (version) values ('0072');
