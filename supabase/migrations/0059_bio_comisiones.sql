-- 0059_bio_comisiones.sql
-- Destino de datos de la Fase 90 (PERSONAS P2a — bio oficial + membresía de comisiones):
-- la bio 1:1 del parlamentario (`parlamentario_bio`), su militancia partidaria histórica
-- (`parlamentario_militancia`), el catálogo de comisiones (`comision`) y la membresía
-- comisión × parlamentario (`comision_membresia`). Es la base sobre la que escribe el
-- conector @obs/bio (Plan 02) y lee la ficha del parlamentario (Phase 91).
--
-- La última migración APLICADA es 0058 (proyecto_prm_id_camara). Esta es la 0059.
--
-- APLICACIÓN = CHECKPOINT DE OPERADOR (Pitfall 6): build/typecheck NO prueban que Postgres
-- ejecutó este DDL (falso positivo de CI). La única prueba válida es el pgTAP
-- (0059_bio_comisiones.test.sql) corriendo CONTRA UN SCHEMA APLICADO. Por el BOM en `.env`,
-- aplicar con `--db-url` explícito:
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f \
--     supabase/migrations/0059_bio_comisiones.sql
-- NUNCA `supabase db push` (drift de schema_migrations). NO se aplica en 90-01 (eso es 90-03).
--
-- MINIMIZACIÓN (Ley 21.719, allowlist): estas tablas NO tienen columnas PII
-- (fecha de nacimiento, RUT, sexo). El modelo tipado (packages/bio/src/model.ts) ya las
-- excluye por construcción; el DDL las omite igualmente. Si un futuro campo sensible se
-- agregara, la RLS deny-by-default lo protege por construcción.
--
-- CONVENCIONES ESPEJADAS (copia VERBATIM de `lobby_contraparte`/0021 en su forma
-- deny-by-default):
--   * Provenance INLINE NOT NULL en cada hecho (FND-08): origen, fecha_captura, enlace.
--   * Clave natural `unique(...)` para upsert idempotente (un 2× run → conteos idénticos).
--   * RLS habilitada SIN policies + `revoke all from anon, authenticated` (defensa contra
--     los default privileges de Supabase). CERO `grant … to anon` — el lockdown-guard
--     Block A prohíbe grants a anon en migraciones >0044. Las RPCs públicas de lectura
--     nacen en Phase 91, NO aquí.
--   * NUNCA fabricar identidad: el FK a `parlamentario` se puebla SOLO con un enlace
--     confirmado/determinista (DIPID exacto o nombre único fail-closed).

-- ── parlamentario_bio (1:1 con parlamentario, deny-by-default) ─────────────────
-- La bio oficial no-sensible. `unique(parlamentario_id)` → relación 1:1. Las columnas
-- region/distrito/circunscripcion quedan poblables después (research Open Q2/Q3): NULL
-- honesto hoy, NO fabricado. `parlamentario.partido` se ACTUALIZA por el writer (no aquí).
create table parlamentario_bio (
  id                bigint generated always as identity primary key,
  -- FK 1:1 al parlamentario (on delete cascade: la bio no sobrevive a la maestra).
  parlamentario_id  text not null references parlamentario(id) on delete cascade,
  profesion         text,                        -- profesión declarada por la fuente, o NULL (no fabricar)
  region            text,                        -- poblable después (Open Q2/Q3); NULL honesto hoy
  distrito          text,                        -- NULLABLE
  circunscripcion   text,                        -- NULLABLE (solo Senado)
  -- provenance inline NOT NULL (FND-08).
  origen            text not null,
  fecha_captura     timestamptz not null default now(),
  enlace            text not null,
  -- clave natural 1:1 para upsert idempotente.
  unique (parlamentario_id)
);
-- DENY-BY-DEFAULT: RLS habilitada SIN policies + revoke de anon/authenticated (cierra el
-- hueco de los default privileges de Supabase). Sin PII hoy, pero deny-by-default por defecto.
alter table parlamentario_bio enable row level security;
revoke all on parlamentario_bio from anon, authenticated;

-- ── parlamentario_militancia (militancia partidaria histórica, deny-by-default) ─
-- Cada militancia con su rango `[desde, hasta-nil=vigente]`. `es_actual` marca la vigente
-- (research WR-04: la de FechaInicio más reciente que cubre el corte). Clave natural
-- `(parlamentario_id, partido_alias, desde)`.
create table parlamentario_militancia (
  id                bigint generated always as identity primary key,
  parlamentario_id  text not null references parlamentario(id) on delete cascade,
  partido           text not null,               -- nombre del partido (raw)
  partido_alias     text not null,               -- forma normalizada (parte de la clave natural)
  desde             date not null,               -- inicio de la militancia (fail-loud si malformada)
  hasta             date,                         -- término, o NULL si vigente (FechaTermino xsi:nil)
  es_actual         boolean not null default false,
  -- provenance inline NOT NULL (FND-08).
  origen            text not null,
  fecha_captura     timestamptz not null default now(),
  enlace            text not null,
  -- clave natural para upsert idempotente.
  unique (parlamentario_id, partido_alias, desde)
);
alter table parlamentario_militancia enable row level security;
revoke all on parlamentario_militancia from anon, authenticated;

-- ── comision (catálogo de comisiones, deny-by-default) ─────────────────────────
-- El catálogo por cámara. `camara` restringido por check. Clave natural `(nombre, camara)`.
-- Puede existir un catálogo SIN membresía (estado honesto — nunca inventar integrantes).
create table comision (
  id                bigint generated always as identity primary key,
  nombre            text not null,               -- nombre crudo de la comisión
  camara            text not null
                      check (camara in ('diputados', 'senadores')),
  tipo              text not null default '',    -- permanente/especial/investigadora/...; '' si ausente
  -- provenance inline NOT NULL (FND-08).
  origen            text not null,
  fecha_captura     timestamptz not null default now(),
  enlace            text not null,
  -- clave natural para upsert idempotente.
  unique (nombre, camara)
);
alter table comision enable row level security;
revoke all on comision from anon, authenticated;

-- ── comision_membresia (comisión × parlamentario, deny-by-default) ─────────────
-- La membresía SOLO se enlaza por identidad confirmada (fail-closed): el `parlamentario_id`
-- nunca se inventa por adivinanza de nombre. `on delete cascade` en ambas FKs: la membresía
-- no sobrevive ni a la comisión ni al parlamentario. Clave natural `(comision_id,
-- parlamentario_id)`.
create table comision_membresia (
  id                bigint generated always as identity primary key,
  comision_id       bigint not null references comision(id) on delete cascade,
  parlamentario_id  text not null references parlamentario(id) on delete cascade,
  cargo             text,                        -- presidente/integrante/...; NULL si ausente
  -- provenance inline NOT NULL (FND-08).
  origen            text not null,
  fecha_captura     timestamptz not null default now(),
  enlace            text not null,
  -- clave natural para upsert idempotente.
  unique (comision_id, parlamentario_id)
);
alter table comision_membresia enable row level security;
revoke all on comision_membresia from anon, authenticated;
