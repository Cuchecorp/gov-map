-- 0051_proyecto_autor.sql
-- Autoría de proyectos de ley (AUTOR-01).
-- Tabla relacional separada (NOT jsonb en proyecto): trazabilidad por fila,
-- reconciliación fail-closed nullable (espejo de voto.parlamentario_id).
-- Clave natural (boletin, autor_crudo_norm) para upsert idempotente.
-- RLS public-read (espejo exacto de 0008 tramitacion_evento).
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

alter table proyecto_autor enable row level security;
create policy proyecto_autor_public_read on proyecto_autor for select to anon using (true);
grant select on proyecto_autor to anon;
