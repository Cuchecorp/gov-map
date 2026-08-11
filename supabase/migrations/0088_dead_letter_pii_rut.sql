-- 0088_dead_letter_pii_rut.sql — Phase 136: causa nueva `pii_rut_en_texto` en el dead-letter.
--
-- HALLAZGO DE LA PRIMERA CORRIDA REAL DE news-daily (run 31460485324, 2026-08-11): una
-- noticia nueva contiene un patrón de RUT en titular/descripción y el guard fail-closed de
-- @obs/llm (`assertNoRutInLlmInput`, deliberadamente AMPLIO: sobre-bloquear es la dirección
-- segura) abortó la corrida completa. El diseño correcto: RUT-en-texto es un RECHAZO
-- PERMANENTE con causa propia y CERO llamadas LLM para ese ítem — jamás un bloqueo de toda
-- la cola, jamás enviar el texto al proveedor "para ver si pasa".
--
-- Patrón 0085: ampliar un CHECK es drop + re-add con el valor nuevo. El check original de
-- 0086 era inline (nombre auto `noticia_dead_letter_rejection_stage_check`).
--
-- APLICAR:
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0088_dead_letter_pii_rut.sql
-- ROLLBACK: revertir al check de 6 valores (solo si ninguna fila usa el 7mo).

alter table public.noticia_dead_letter
  drop constraint noticia_dead_letter_rejection_stage_check;

alter table public.noticia_dead_letter
  add constraint noticia_dead_letter_rejection_stage_check check (rejection_stage in (
    'parse_fallido',
    'confianza_bajo_umbral',
    'emision_fuera_de_lista',
    'boletin_no_resuelto',
    'parlamentario_no_resuelto',
    'lote_invalido',
    'pii_rut_en_texto'            -- el texto contiene un patrón de RUT: jamás viaja al LLM
  ));
