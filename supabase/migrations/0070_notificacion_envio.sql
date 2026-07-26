-- 0070_notificacion_envio.sql
--
-- ████ NOTIF-02: COLA/LOG DEL DIGEST — service_role-only, cursor idempotente ████
--
-- Phase 103 — NOTIF P3a. `notificacion_envio` es la cola/log del envío del digest por
-- email: qué usuario, qué suscripción, hasta qué evento se le resumió, y si el envío
-- salió bien. A DIFERENCIA de suscripcion/consentimiento (user-owned), esta tabla es
-- del CRON (patrón EGRESO): SOLO el service_role la escribe/lee. `authenticated`
-- JAMÁS la toca — ni lectura. No hay policy para authenticated ni grant alguno;
-- Block E del lockdown-guard (Plan 01) enforcea el CERO grant a authenticated y el
-- pgTAP (supabase/tests/0070_notificacion_envio.test.sql) prueba
-- `has_table_privilege('authenticated', ..., 'select') = false`.
--
-- ── CURSOR IDEMPOTENTE (103-PATTERNS §0070 + precedente 0053) ────────────────────
-- `ultimo_evento_visto` es el watermark idempotente: la clave del último evento
-- (tramitacion_evento / actualidad_senal) incluido en el último digest enviado a este
-- usuario/suscripción. El cron avanza ese cursor ATÓMICAMENTE SOLO en un envío
-- exitoso — si el envío falla, el cursor NO avanza y el próximo run re-intenta el
-- mismo tramo (entrega al-menos-una-vez sin duplicar contenido ya resumido). Mismo
-- espíritu que el marcador `*_ingesta_estado` (0053): un watermark por-clave que solo
-- avanza con datos confirmados.
--
-- ── DENY-BY-DEFAULT TOTAL (más estricto que 0069) ───────────────────────────────
-- RLS habilitada SIN policy alguna (ni para authenticated ni para anon). NO grant.
-- service_role bypassa RLS. NO está en USER_OWNED_TABLES (es cola del cron, no dato
-- del usuario) → un `to authenticated` aquí cae en Block D Y en Block E del guard.
--
-- ── ORDEN DE APPLY / COMANDO (Plan 05) ──────────────────────────────────────────
-- Se aplica DESPUÉS de 0069 (FK → suscripcion), ANTES de 0071:
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f \
--     supabase/migrations/0070_notificacion_envio.sql
-- NUNCA `supabase db push`. pgTAP contra el schema APLICADO = única prueba (Pitfall 6).
--
-- ████████████████████████████████████████████████████████████████████████████████

-- ── Tabla notificacion_envio (cola/log del digest, service_role-only) ─────────────
create table if not exists notificacion_envio (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  suscripcion_id     uuid references suscripcion(id) on delete cascade,
  ultimo_evento_visto text,          -- cursor idempotente: avanza SOLO en envío exitoso
  enviado_at         timestamptz,
  estado             text not null default 'pendiente'
                       check (estado in ('pendiente','enviado','error')),
  created_at         timestamptz not null default now()
);

-- ── RLS deny-by-default TOTAL: SIN policy, service_role-only ───────────────────────
-- cola/log del digest; service_role-only (cron EGRESO); authenticated JAMÁS la toca
-- (ni lectura). Cursor ultimo_evento_visto avanza atómicamente solo en envío exitoso.
alter table notificacion_envio enable row level security;
-- SIN policy para authenticated, SIN grant a authenticated (queue service_role-only,
-- Block E del lockdown-guard). service_role bypassa RLS.

-- ── FIN NOTIF-02 (notificacion_envio) ─────────────────────────────────────────────
-- schema_migrations (insertar tras aplicar a PROD):
-- insert into schema_migrations (version) values ('0070');
