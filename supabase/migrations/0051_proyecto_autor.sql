-- 0051_proyecto_autor.sql
-- Autoría de proyectos de ley (AUTOR-01).
-- Tabla relacional separada (NOT jsonb en proyecto): trazabilidad por fila,
-- reconciliación fail-closed nullable (espejo de voto.parlamentario_id).
-- Clave natural (boletin, autor_crudo_norm) para upsert idempotente.
--
-- LOCKDOWN (Camino A, migración > 0044):
--   Sin GRANT a anon ni CREATE POLICY to anon (guard CI LOCKDOWN-04).
--   El sitio lee con service_role (bypassa RLS); anon tiene cero grants sobre
--   esta tabla (deny-by-default). La RLS habilitada sin policy = deny total para anon.
--   Lectura pública vía la app: service_role la expone segura por la capa de UI.
--
-- APPLY vía psql --db-url --single-transaction (NUNCA db push).

create table proyecto_autor (
  id               bigint generated always as identity primary key,
  boletin          text not null references proyecto(boletin),
  autor_crudo      text not null,
  autor_crudo_norm text not null,
  parlamentario_id text references parlamentario(id),
  metodo           text check (metodo in ('determinista', 'humano')),
  estado_vinculo   text check (estado_vinculo in ('confirmado', 'no_confirmado')),
  origen           text not null,
  fecha_captura    timestamptz not null default now(),
  enlace           text not null,
  unique (boletin, autor_crudo_norm)
);

create index proyecto_autor_boletin_idx on proyecto_autor (boletin);
create index proyecto_autor_parlamentario_idx on proyecto_autor (parlamentario_id)
  where parlamentario_id is not null;

-- RLS enabled, deny-by-default for anon (Camino A: reads via service_role).
-- CERO GRANT a anon, CERO CREATE POLICY to anon (LOCKDOWN-04 guard).
alter table proyecto_autor enable row level security;
