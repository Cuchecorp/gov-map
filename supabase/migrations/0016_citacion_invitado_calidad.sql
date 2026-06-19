-- 0016_citacion_invitado_calidad.sql
-- #43 (code-review v1.0): la clave natural `unique (citacion_id, nombre)` colapsaba dos
-- invitados HOMÓNIMOS de distinta organización (last-write-wins en el writer y en la DB),
-- porque excluía `calidad` (el discriminador). Es texto display-only sin reconciliación de
-- identidad, pero perdía filas legítimas.
--
-- Se incluye `calidad` en la clave. Para que `ON CONFLICT (cols)` de PostgREST funcione
-- (no puede targetear un índice sobre la EXPRESIÓN coalesce, igual que en #19), `calidad`
-- pasa a NOT NULL DEFAULT '' y entra como columna plana en el unique. El writer envía
-- `calidad ?? ''`. Corpus vacío → sin filas que migrar.

update citacion_invitado set calidad = '' where calidad is null;

alter table citacion_invitado
  alter column calidad set default '',
  alter column calidad set not null;

alter table citacion_invitado
  drop constraint citacion_invitado_citacion_id_nombre_key;

alter table citacion_invitado
  add constraint citacion_invitado_citacion_id_nombre_calidad_key
  unique (citacion_id, nombre, calidad);
