-- 0014_vinculo_no_confirmado_dedup.sql
-- #19 (code-review v1.0): el índice único PARCIAL de 0006
-- (`vinculo_identidad_mencion_key ... where parlamentario_id is not null`) dejaba FUERA
-- a las filas 'no_confirmado' (parlamentario_id NULL). Como `upsertVinculo` no podía
-- targetear esas filas, cada re-proceso de una misma mención huérfana INSERTABA una fila
-- nueva → crecimiento O(días) al cablear la ingesta diaria.
--
-- Además, PostgREST (y `ON CONFLICT (cols)` sin predicado en general) NO puede inferir un
-- índice PARCIAL: requiere `ON CONFLICT (cols) WHERE <predicado>`, que el cliente no
-- expresa. Por eso el upsert del vínculo confirmado era latentemente inoperante contra la
-- DB real (verificado: "no unique or exclusion constraint matching the ON CONFLICT").
--
-- MODELO CORRECTO: hay UN vínculo por mención `(camara, periodo, mencion_normalizada)`; su
-- estado (no_confirmado → probable → confirmado) evoluciona EN la misma fila. Se reemplaza
-- el índice parcial por un índice único TOTAL sobre la clave natural:
--   * dedup para TODOS los estados (cierra #19, también las filas sin id),
--   * `ON CONFLICT (camara, periodo, mencion_normalizada)` funciona por inferencia simple
--     (sin predicado), tanto desde PostgREST como desde el RPC resolver_identidad (0015).

drop index if exists vinculo_identidad_mencion_key;       -- parcial de 0006 (id not null)
drop index if exists vinculo_identidad_mencion_no_id_key;  -- parcial complementario (descartado)

create unique index vinculo_identidad_mencion_key
  on vinculo_identidad (camara, periodo, mencion_normalizada);
