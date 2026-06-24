-- 0034_entidad_tercero.sql
-- Maestra de identidad de TERCEROS: entidad_tercero + entidad_tercero_alias (ENT-01).
-- Espejo mecanico de 0005_parlamentario.sql (maestra + alias + RLS) con la pieza de
-- logica nueva Δ1 (discriminador tipo_entidad) y el trigger COERCION de 0012.
--
-- Principios (espejo 0005):
--   * `id` interno estable. A diferencia de parlamentario (id derivado en TS, P00001),
--     aqui el id viene de una SEQUENCE en DB (LOCKED): nextval('entidad_id_seq') → 'E00001'.
--     Decision de diseno: id estable por DB, no logica TS fragil (A1).
--   * provenance inline (origen, fecha_captura, enlace): cada fila lleva su fuente (FND-08).
--   * `estado` modela la compuerta de promocion: el backfill carga el lote como
--     'no_confirmado'; la promocion a 'confirmado' es REVISION HUMANA o determinista,
--     nada se auto-marca confirmado por DDL.
--   * Δ1 COLUMNA NUEVA `tipo_entidad` ('natural'|'juridica'): discriminador de toda la
--     fase. Gobierna la rama juridica-solo-RUT del matcher (no existe en 0005).
--   * `rut` NULLABLE: las contrapartes de lobby NO traen RUT; los proveedores SI
--     (mismo patron que parlamentario.rut — uso interno).
--   * Clave natural por RUT: indice unico PARCIAL sobre `rut` (donde no nulo) — un RUT
--     identifica univocamente a una entidad.
--   * Clave natural por NOMBRE: indice unico TOTAL `entidad_tercero_clave_natural` sobre
--     `(tipo_entidad, nombre_normalizado)` — la clave del ON CONFLICT del writer; coexiste con
--     el parcial rut (la unica clave para contrapartes de lobby sin RUT). (Δ CR-01)
--   * RLS deny-by-default (Ley 21.719, V4/V8, leccion Phase 11): RLS habilitada SIN
--     policies + `revoke all from anon, authenticated` en AMBAS tablas. La maestra es PII
--     interna, nunca public-read. (0005 NO incluia el revoke; aqui SI, copiado de 0021/0023.)
--   * Δ1 trigger COERCION silenciosa de estado (espejo 0012, NO RAISE): un upsert masivo
--     de backfill no debe abortar el lote al intentar degradar un 'confirmado'.

-- Sequence para el id estable (LOCKED): 'E' + lpad(nextval, 5).
create sequence entidad_id_seq;

create table entidad_tercero (
  id                  text primary key
                        default ('E' || lpad(nextval('entidad_id_seq')::text, 5, '0')),
  nombre_normalizado  text not null,               -- fold de acentos/mayusculas (clave de blocking)
  -- Δ1 COLUMNA NUEVA: discriminador de toda la fase, no existe en parlamentario.
  tipo_entidad        text not null
                        check (tipo_entidad in ('natural','juridica')),
  rut                 text,                         -- NULLABLE, USO INTERNO: lobby no lo trae, proveedores si
  estado              text not null default 'no_confirmado'
                        check (estado in ('confirmado', 'probable', 'no_confirmado')),
                        -- default 'no_confirmado': la promocion a 'confirmado' es la
                        -- compuerta (humano/determinista), nunca auto-marcada por DDL (espejo 0005).
  -- Provenance inline (FND-08): origen + fecha de captura + enlace de la fuente.
  origen              text not null,
  fecha_captura       timestamptz not null default now(),
  enlace              text not null
);

-- Clave natural por RUT: un RUT identifica univocamente (indice unico PARCIAL, donde no nulo).
create unique index entidad_tercero_rut_key
  on entidad_tercero (rut)
  where rut is not null;

-- Δ CR-01: clave natural por NOMBRE con indice unico TOTAL (NO parcial). El writer
-- (writer-entidad-supabase.ts) hace upsert ON CONFLICT (tipo_entidad, nombre_normalizado);
-- PostgREST .upsert(onConflict) NO puede targetear un indice parcial → sin este indice TOTAL
-- un upsert real lanza SQLSTATE 42P10. Espejo del patron LOCKED de 0035 (vinculo_entidad_clave_natural).
-- Coexiste con el parcial rut: el rut deduplica por RUT exacto; este por nombre normalizado
-- (la unica clave disponible para contrapartes de lobby sin RUT).
create unique index entidad_tercero_clave_natural on entidad_tercero (tipo_entidad, nombre_normalizado);

create table entidad_tercero_alias (
  id                 bigint generated always as identity primary key,
  entidad_tercero_id text not null references entidad_tercero(id) on delete cascade,
  alias              text not null,
  origen             text,
  unique (entidad_tercero_id, alias)
);

-- RLS deny-by-default (Ley 21.719, V4/V8): enable SIN policies en ambas tablas.
alter table entidad_tercero       enable row level security;
alter table entidad_tercero_alias enable row level security;

-- DEFENSA EN PROFUNDIDAD (leccion Phase 11): este proyecto concede por DEFAULT PRIVILEGES
-- todos los privilegios a anon/authenticated sobre CADA tabla nueva en public. La RLS sin
-- policy ya niega las FILAS, pero LEGAL-03 exige que el PRIVILEGIO tampoco exista. REVOCAR
-- explicitamente cierra el hueco (copiado de 0021/0023, NO la omision de 0005). La maestra
-- de terceros es PII interna; el service_role (writer) conserva sus privilegios y bypassa RLS.
revoke all on entidad_tercero       from anon, authenticated;
revoke all on entidad_tercero_alias from anon, authenticated;

-- Δ1 Trigger anti-regresion de estado (COERCION silenciosa, NO RAISE — Pitfall 4).
-- Espejo de parlamentario_estado_no_regresa (0012): el upsert masivo del backfill reescribe
-- a todos como 'no_confirmado'; si una fila YA era 'confirmado', se PRESERVA y el lote
-- continua (un RAISE abortaria el lote entero). Semantica OPUESTA al vinculo (0035, que RAISE).
-- `set search_path = ''`: la funcion solo referencia OLD/NEW y literales (#38).
create function entidad_tercero_estado_no_regresa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.estado = 'confirmado' and new.estado <> 'confirmado' then
    -- Preserva la confirmacion previa: el upsert masivo no degrada una entidad ya
    -- confirmada. Silencioso para no abortar el lote del backfill.
    new.estado := old.estado;
  end if;
  return new;
end;
$$;

create trigger entidad_tercero_estado_no_regresa
  before update on entidad_tercero
  for each row
  execute function entidad_tercero_estado_no_regresa();
