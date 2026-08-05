-- 0084_noticia.sql
--
-- ████ NEWS-01: SCHEMA DE ETAPA 2 (R2 → Supabase) — deny-all total, sin lectores ████
--
-- Phase 132 — NEWS-RSS. Crea `noticia` (ítems que PASAN el pre-filtro léxico de la Etapa 2:
-- titular, outlet, fecha_pub, url original/canónica, referencia al crudo en R2, estado del
-- pipeline) y `noticia_url_vista` (seen-ledger: idempotencia por url_hash + conteo de descartes
-- del pre-filtro por causa). D-11: nombres en español, singular, siguiendo la convención del
-- schema existente (`proyecto`, `citacion`).
--
-- ADITIVA: crea dos tablas que no existen; nada en el sitio ni en ningún job las consulta hasta
-- la Phase 137 (D-12) — el sitio NO lee noticias en 132. Sin schema aplicado la Etapa 2 no se
-- puede verificar contra nada real.
--
-- ── DENY-BY-DEFAULT TOTAL (patrón 0070) ─────────────────────────────────────────
-- RLS habilitada SIN policy alguna (ni para anon ni para authenticated). NO grant. NO RPC
-- pública. service_role bypassa RLS. Un `to authenticated`/`to anon` aquí caería en Block D Y
-- en Block E del lockdown-guard (Plan 01).
--
-- ── REVOKE explícito (premortem F-10) ───────────────────────────────────────────
-- El deny-all NO puede depender del rol de conexión. Con la conexión actual (rol `postgres`,
-- cuyo pg_default_acl no otorga nada a anon/authenticated en public) el REVOKE de abajo es un
-- no-op idempotente; su razón de ser es que el pg_default_acl de `supabase_admin` en `public`
-- SÍ otorga `arwdDxtm` a anon/authenticated, y `0073` (que lo cierra globalmente) está escrita
-- y NO aplicada. Gotcha v12.0: un REVOKE ajeno no falla — no-opea con `WARNING 01006` — así que
-- este REVOKE no prueba nada por sí solo; la prueba de que el deny-all es real es el pgTAP
-- (has_table_privilege).
--
-- ── fecha_pub es timestamptz, SIEMPRE (Pitfall 6) ───────────────────────────────
-- Cooperativa emite offsets -0400, el resto +0000. NUNCA normalizar a una tz global — la parte
-- de calendario debe conservarse tal como la emite la fuente, sin reinterpretar zona horaria.
--
-- ── ORDEN DE APPLY / COMANDO (régimen LOCKED) ───────────────────────────────────
-- La última migración APLICADA antes de esta es 0083. `0073`/`0075` están ESCRITAS y NO
-- aplicadas — JAMÁS se editan ni se reordenan; esta migración es puramente aditiva.
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f \
--     supabase/migrations/0084_noticia.sql
-- NUNCA `supabase db push` (drift del ledger). pgTAP contra el schema APLICADO =
-- única prueba (Pitfall 6).
--
-- ████████████████████████████████████████████████████████████████████████████████

-- ── Tabla noticia (ítems que pasan el pre-filtro léxico) ──────────────────────────
create table if not exists noticia (
  url_hash      text primary key,        -- sha256(url_canonica), D-13
  url           text not null,           -- <link> original del ítem
  url_canonica  text not null,           -- strip utm_*/fbclid/gclid
  titular       text not null,
  outlet        text not null,           -- slug del feed (biobiochile|cooperativa|latercera|lacuarta|exante)
  fecha_pub     timestamptz,             -- timestamptz: Cooperativa -0400, resto +0000 (Pitfall 6). NUNCA normalizar a una tz global.
  descripcion   text,                    -- texto despojado de HTML y truncado
  r2_path       text not null,           -- referencia al crudo en R2 (etapa 1)
  contenido_hash text,                   -- sha256 del crudo del que salió
  estado        text not null default 'pendiente'
                  check (estado in ('pendiente','clasificada','descartada')),
  created_at    timestamptz not null default now()
);

create index if not exists noticia_fecha_pub_idx on noticia (fecha_pub desc);
create index if not exists noticia_outlet_idx on noticia (outlet);

-- ── Tabla noticia_url_vista (seen-ledger: idempotencia + conteo de descartes) ─────
create table if not exists noticia_url_vista (
  url_hash       text primary key,
  url_canonica   text not null,
  outlet         text not null,
  estado         text not null check (estado in ('pasa','descarta')),
  causa          text check (causa is null or causa in ('prefiltro_lexico','duplicado')),
  primera_vista  timestamptz not null default now()
);

create index if not exists noticia_url_vista_causa_idx on noticia_url_vista (causa);

-- ── RLS deny-by-default TOTAL: SIN policy, SIN grant, cero lectores ────────────────
-- El sitio no lee noticias hasta la Phase 137 (D-12). service_role bypassa RLS.
alter table noticia enable row level security;
alter table noticia_url_vista enable row level security;
-- SIN policy para anon/authenticated, SIN grant alguno (Block D/E del lockdown-guard). Si
-- alguna vez se agrega un `to authenticated` aquí, eso cae directamente en ambos bloques.

-- REVOKE explícito: el deny-all NO depende del rol de conexión (premortem F-10). No-op
-- idempotente contra el rol actual; cierra el hueco del pg_default_acl de supabase_admin
-- mientras 0073 (que lo cierra globalmente) siga sin aplicar. El REVOKE ajeno no falla — la
-- prueba real de que el deny-all funciona es el pgTAP de abajo.
revoke all on table public.noticia, public.noticia_url_vista from anon, authenticated;

-- ── FIN NEWS-01 (noticia, noticia_url_vista) ──────────────────────────────────────
-- ledger: insert into supabase_migrations.schema_migrations (version) values ('0084');
-- (esquema calificado — en esta base el ledger vive en supabase_migrations, NO en public)
