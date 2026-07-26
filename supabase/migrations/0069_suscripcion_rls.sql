-- 0069_suscripcion_rls.sql
--
-- ████ NOTIF-01: PRIMER DATO PROPIO DEL USUARIO — RLS user-owned deny-by-default ████
--
-- Phase 103 — NOTIF P3a. Crea `suscripcion`: la PRIMERA tabla del sistema cuyo dueño
-- es un usuario autenticado (no un dato público del Congreso). La RLS es EL límite
-- de confianza: las verificaciones de la capa de app son bypasseables; el único
-- gate real de aislamiento entre usuarios es `(select auth.uid()) = user_id` en la
-- policy. La prueba de que ese aislamiento funciona es el pgTAP de dos usuarios
-- (supabase/tests/0069_suscripcion_rls.test.sql) — vitest/tsc NO tocan Postgres
-- (Pitfall 6).
--
-- ── DISEÑO LOCKED (103-PATTERNS §0069 + 103-RESEARCH §Pattern 1) ─────────────────
-- Tres policies `to authenticated` con el wrapper `(select auth.uid()) = user_id`
-- (NO `auth.uid()` pelado — la subquery se evalúa UNA vez por statement, init-plan
-- optimization). CRUD completo por el dueño: select/insert/delete propios. NO update
-- (el estado lo mueve el service_role del flujo de confirmación/baja, no el usuario).
-- Los tokens de confirmación/baja se guardan HASHEADOS (sha256 hex); el token crudo
-- viaja SOLO en el enlace del email (ver Plan 04) — nunca se persiste en claro.
--
-- ── DENY-BY-DEFAULT (espejo 0043 L135-137) ──────────────────────────────────────
-- anon / public / web_reader NO reciben policy NI grant → leen 0 filas (deny-by-default
-- de RLS). service_role bypassa RLS (el cron del digest lee la cola con service key).
-- Esta tabla está en la allowlist USER_OWNED_TABLES del lockdown-guard (Plan 01,
-- Block D): un `to authenticated` fuera de esa allowlist muerde el guard.
--
-- ── ORDEN DE APPLY / COMANDO (Plan 05) ──────────────────────────────────────────
-- Última migración = 0068. Ésta es la 0069 y se aplica DESPUÉS:
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f \
--     supabase/migrations/0069_suscripcion_rls.sql
-- NUNCA `supabase db push` (drift de schema_migrations). Windows: PGCLIENTENCODING=UTF8.
-- La ÚNICA prueba válida del DDL es el pgTAP contra el schema APLICADO (Pitfall 6).
--
-- ████████████████████████████████████████████████████████████████████████████████

-- ── Tabla suscripcion (user-owned) ────────────────────────────────────────────────
create table if not exists suscripcion (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  tipo               text not null check (tipo in ('proyecto','parlamentario')),
  objetivo_id        text not null,
  estado             text not null default 'pendiente'
                       check (estado in ('pendiente','confirmada','baja')),
  confirm_token_hash text,          -- sha256 hex; token crudo SOLO en el email (Plan 04)
  baja_token_hash    text,          -- sha256 hex; token crudo SOLO en el email (Plan 04)
  confirm_expira_at  timestamptz,
  created_at         timestamptz not null default now(),
  unique (user_id, tipo, objetivo_id)
);

-- ── RLS deny-by-default + tres policies owner-scoped ──────────────────────────────
alter table suscripcion enable row level security;

-- SELECT propio: el dueño ve SOLO sus filas.
drop policy if exists suscripcion_select_own on suscripcion;
create policy suscripcion_select_own
  on suscripcion for select to authenticated
  using ( (select auth.uid()) = user_id );

-- INSERT propio: el dueño solo puede crear filas a su nombre (with check = backstop RLS).
drop policy if exists suscripcion_insert_own on suscripcion;
create policy suscripcion_insert_own
  on suscripcion for insert to authenticated
  with check ( (select auth.uid()) = user_id );

-- DELETE propio: el dueño solo puede borrar SUS filas (B no borra la fila de A).
drop policy if exists suscripcion_delete_own on suscripcion;
create policy suscripcion_delete_own
  on suscripcion for delete to authenticated
  using ( (select auth.uid()) = user_id );

-- NO grant to anon/public/web_reader. NO policy para esos roles → 0 filas.
-- service_role bypassa RLS (cron del digest).

-- ── FIN NOTIF-01 (suscripcion) ────────────────────────────────────────────────────
-- schema_migrations (insertar tras aplicar a PROD):
-- insert into schema_migrations (version) values ('0069');
