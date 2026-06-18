-- 0014_vinculo_no_confirmado_dedup.sql
-- #19 (code-review v1.0): el índice único parcial de 0006
-- (`vinculo_identidad_mencion_key ... where parlamentario_id is not null`) deja FUERA
-- a las filas 'no_confirmado' (parlamentario_id NULL). Como `upsertVinculo` no usaba
-- onConflict para esas filas, cada re-proceso de una misma mención huérfana INSERTABA
-- una fila nueva → crecimiento O(días) al cablear la ingesta diaria.
--
-- Índice único parcial COMPLEMENTARIO sobre la misma clave natural pero el predicado
-- opuesto (`where parlamentario_id is null`). Juntos cubren todas las filas con
-- predicados mutuamente excluyentes, de modo que `ON CONFLICT (camara, periodo,
-- mencion_normalizada)` infiere SIEMPRE el índice correcto por el predicado que la
-- fila propuesta satisface (id null → este índice; id no-null → el de 0006).

create unique index vinculo_identidad_mencion_no_id_key
  on vinculo_identidad (camara, periodo, mencion_normalizada)
  where parlamentario_id is null;
