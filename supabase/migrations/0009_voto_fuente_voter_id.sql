-- 0009_voto_fuente_voter_id.sql
-- CR-02: corrige la clave natural de `voto` para que NO pueda colapsar dos votantes distintos.
--
-- Problema (review 05-REVIEW.md CR-02): la unique `(votacion_id, mencion_nombre)` de 0008 usaba
-- el NOMBRE crudo como discriminador. Ese nombre NO identifica al votante de forma fiable:
--   * Cámara: `mencion_nombre` se arma de partes opcionales → puede quedar "" o repetido aunque
--     cada voto traiga un `Diputado/Id` (DIPID) distinto y válido.
--   * Senado: homónimos cuyo `PARLAMENTARIO` crudo coincide.
-- Dos filas con la misma clave en un mismo lote de upsert abortan el boletín
-- (`ON CONFLICT DO UPDATE command cannot affect row a second time`); entre corridas, un voto
-- real pisa a otro (sub-conteo del roll-call).
--
-- Fix: discriminador NO colisionante por votante, NUNCA derivado del nombre:
--   * Cámara → el DIPID oficial (identificador estable de la fuente).
--   * Senado → el índice posicional del voto en la fuente (`seq:<n>`), estable e idempotente.
-- La unique pasa a `(votacion_id, fuente_voter_id)`. Re-ingerir el mismo detalle produce las
-- MISMAS filas (idempotencia); dos votantes distintos jamás colapsan.

-- 1) Nueva columna del discriminador del votante (NOT NULL con default temporal para backfill).
alter table voto add column fuente_voter_id text not null default '';

-- 2) Backfill de filas preexistentes: sin la fuente original, derivamos un valor único por fila
--    a partir del id de la fila (estable, no colisionante) para poder imponer la unique.
--    (En un entorno fresco `voto` está vacío y este UPDATE no toca nada.)
update voto set fuente_voter_id = 'legacy:' || id::text where fuente_voter_id = '';

-- 3) Quitar el default temporal (de aquí en más el writer SIEMPRE provee el valor).
alter table voto alter column fuente_voter_id drop default;

-- 4) Reemplazar la unique colisionante por la clave natural correcta.
alter table voto drop constraint voto_votacion_id_mencion_nombre_key;
alter table voto add constraint voto_votacion_id_fuente_voter_id_key
  unique (votacion_id, fuente_voter_id);
