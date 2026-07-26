-- 0071_consentimiento.sql
--
-- ████ NOTIF-04 (Ley 21.719): REGISTRO DE CONSENTIMIENTO — RLS user-owned ████
--
-- Phase 103 — NOTIF P3a. Registra el consentimiento del usuario para el envío del
-- digest por email (base de licitud del tratamiento, Ley 21.719 de protección de
-- datos personales). Guarda QUÉ versión del texto aceptó, POR QUÉ método y CUÁNDO
-- (fecha = created_at). El método por defecto es el doble opt-in por email
-- (el usuario confirma vía el enlace del email antes de que empiece a recibir el
-- digest — ver Plan 04).
--
-- ── DISEÑO LOCKED (103-PATTERNS §0071, sibling de 0069) ──────────────────────────
-- Dos policies `to authenticated` con el wrapper `(select auth.uid()) = user_id`:
-- insert propio (el usuario registra su propio consentimiento) y select propio
-- (el usuario puede leer su historial). NO delete/update: el consentimiento es un
-- registro-append (la baja es un evento NUEVO, no un borrado — trazabilidad legal).
-- service_role lee vía bypass de RLS (el cron confirma licitud antes de enviar).
--
-- ── DENY-BY-DEFAULT (espejo 0043 L135-137 / 0069) ───────────────────────────────
-- anon / public / web_reader NO reciben policy NI grant → 0 filas. Esta tabla está
-- en la allowlist USER_OWNED_TABLES del lockdown-guard (Plan 01, Block D).
--
-- ── ORDEN DE APPLY / COMANDO (Plan 05) ──────────────────────────────────────────
-- Se aplica DESPUÉS de 0069/0070:
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f \
--     supabase/migrations/0071_consentimiento.sql
-- NUNCA `supabase db push`. pgTAP contra el schema APLICADO = única prueba (Pitfall 6).
--
-- ████████████████████████████████████████████████████████████████████████████████

-- ── Tabla consentimiento (user-owned, append-only registro legal) ─────────────────
create table if not exists consentimiento (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  version_texto text not null,     -- QUÉ versión del texto de consentimiento aceptó
  metodo        text not null default 'doble_opt_in_email',  -- POR QUÉ método
  created_at    timestamptz not null default now()           -- CUÁNDO (fecha)
);

-- ── RLS deny-by-default + policies owner-scoped ───────────────────────────────────
alter table consentimiento enable row level security;

-- INSERT propio: el usuario registra su propio consentimiento (with check = backstop).
drop policy if exists consentimiento_insert_own on consentimiento;
create policy consentimiento_insert_own
  on consentimiento for insert to authenticated
  with check ( (select auth.uid()) = user_id );

-- SELECT propio: el usuario ve SOLO su historial (B NO ve el consentimiento de A).
drop policy if exists consentimiento_select_own on consentimiento;
create policy consentimiento_select_own
  on consentimiento for select to authenticated
  using ( (select auth.uid()) = user_id );

-- NO grant to anon/public/web_reader. service_role lee vía RLS bypass (cron licitud).

-- ── Base GRANT a authenticated (obligatorio post-0044) ────────────────────────────
-- Igual que 0069: post-0044 una tabla net-new no le da a authenticated privilegio base,
-- así que sin este grant las policies owner-scoped quedan muertas (permission denied
-- antes de RLS). SOLO insert+select (registro append-only: sin delete/update — la baja
-- es un evento nuevo, trazabilidad legal 21.719). La RLS aísla las filas por dueño.
-- Este grant ES el `to authenticated` que el lockdown-guard (Block D) espera sobre una
-- tabla de USER_OWNED_TABLES.
grant select, insert on consentimiento to authenticated;

-- ── FIN NOTIF-04 (consentimiento) ─────────────────────────────────────────────────
-- schema_migrations (insertar tras aplicar a PROD):
-- insert into schema_migrations (version) values ('0071');
