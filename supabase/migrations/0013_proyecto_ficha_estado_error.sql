-- 0013_proyecto_ficha_estado_error.sql
-- #42 (code-review v1.0): `proyecto_ficha.estado` admitía solo ('pendiente','embebido').
-- Un fallo PERMANENTE de extracción/embedding (texto corrupto, boletín irreparable)
-- dejaba la fila en 'pendiente' y el pipeline la reintentaba indefinidamente en cada
-- corrida, gastando llamadas LLM y enmascarando el error (no hay DLQ para este pipeline,
-- a diferencia del ingest-worker).
--
-- Se amplía el vocabulario con:
--   * 'error'      — fallo registrado; el resume normal (filtra 'pendiente') NO lo reintenta
--                    a ciegas. Visible para diagnóstico; recuperable con `--reembed`.
--   * 'procesando' — marca de trabajo en curso (reservado para futura concurrencia).
-- y una columna `error_msg` para el último mensaje de fallo (sin secretos).

alter table proyecto_ficha
  drop constraint proyecto_ficha_estado_check;

alter table proyecto_ficha
  add constraint proyecto_ficha_estado_check
  check (estado in ('pendiente', 'procesando', 'embebido', 'error'));

alter table proyecto_ficha
  add column if not exists error_msg text;
