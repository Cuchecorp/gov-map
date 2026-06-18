-- 0005_parlamentario.sql
-- Tabla maestra de identidad: parlamentario + parlamentario_alias (ID-01).
--
-- Principios:
--   * `id` interno estable (p.ej. P00001) — clave de cruce para votos/proyectos.
--   * provenance inline (origen, fecha_captura, enlace): cada fila lleva su fuente (FND-08).
--   * `estado` modela la compuerta de promocion: el seeder carga el lote como
--     'no_confirmado'; la promocion a 'confirmado' es REVISION HUMANA (ID-01),
--     nada se auto-marca confirmado por DDL.
--   * Claves naturales (parlid_senado / id_diputado_camara) via indices unicos
--     PARCIALES → upsert idempotente de la siembra sin duplicados, sin obligar NOT NULL.
--   * `rut`, `distrito`, `circunscripcion` NULLABLE: los catalogos de Camara/Senado
--     no traen todos los campos para todos (Pitfall 4); NOT NULL reventaria la siembra.
--   * RLS deny-by-default (Ley 21.719, V4/V8): RLS habilitada SIN policies en ambas
--     tablas → anon NUNCA lee `rut`/`email` ni nada; solo service role (espejo 0002).

create table parlamentario (
  id                  text primary key,            -- interno estable (P00001)
  nombre_normalizado  text not null,               -- fold de acentos/mayusculas (clave de blocking)
  nombres             text,
  apellido_paterno    text,
  apellido_materno    text,
  camara              text not null
                        check (camara in ('diputados', 'senado')),
  periodo             text not null,
  region              text,
  distrito            text,                         -- NULLABLE: la Camara/Senado no lo trae para todos (Pitfall 4)
  circunscripcion     text,                         -- NULLABLE: solo Senado
  partido             text,
  rut                 text,                         -- NULLABLE, USO INTERNO: catalogos no lo traen (Pitfall 4)
  parlid_senado       text,                         -- clave natural Senado (nullable)
  id_diputado_camara  text,                         -- clave natural Camara (nullable)
  estado              text not null default 'no_confirmado'
                        check (estado in ('confirmado', 'probable', 'no_confirmado')),
                        -- default 'no_confirmado': la promocion a 'confirmado' es la
                        -- compuerta de revision humana (ID-01), nunca auto-marcada por DDL.
  email               text,
  -- Provenance inline (FND-08): origen + fecha de captura + enlace de la fuente.
  origen              text not null,
  fecha_captura       timestamptz not null default now(),
  enlace              text not null
);

-- Claves naturales para upsert idempotente (indices unicos PARCIALES, no columnas NOT NULL).
create unique index parlamentario_parlid_senado_key
  on parlamentario (parlid_senado)
  where parlid_senado is not null;
create unique index parlamentario_id_diputado_camara_key
  on parlamentario (id_diputado_camara)
  where id_diputado_camara is not null;

create table parlamentario_alias (
  id              bigint generated always as identity primary key,
  parlamentario_id text not null references parlamentario(id) on delete cascade,
  alias           text not null,
  origen          text,
  unique (parlamentario_id, alias)
);

-- RLS deny-by-default (Ley 21.719, V4/V8): enable SIN policies en ambas tablas.
-- anon nunca lee la maestra (ni `rut` ni `email`); solo service role (Edge Functions/CI).
-- Espejo exacto del patron de 0002_control_tables.sql.
alter table parlamentario enable row level security;
alter table parlamentario_alias enable row level security;
