-- 0089_noticia_boletines_detectados.sql — Phase 137 (NEWS-07): vínculo DETERMINISTA
-- noticia→proyecto por boletín EXPLÍCITO en el texto.
--
-- Salida honesta pre-registrada C2.4(a) de D-133-C2: con T4/T9 no-medidos (fail-closed
-- 133-b) el enrutamiento por CLASIFICADOR está OFF; lo que sí puede publicarse es el vínculo
-- determinista — noticias cuyo titular/bajada contienen un boletín textual reconocido por
-- `extraerBoletines` (regla LOCKED) y que EXISTE en `proyecto` (el join de lectura es el
-- fail-closed #2). SIN etiqueta, SIN LLM, SIN fichas de persona.
--
-- APLICAR:
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0089_noticia_boletines_detectados.sql
-- ROLLBACK: drop index noticia_boletines_detectados_gin; alter table noticia drop column boletines_detectados;

alter table public.noticia
  add column if not exists boletines_detectados text[] not null default '{}';

create index if not exists noticia_boletines_detectados_gin
  on public.noticia using gin (boletines_detectados);
