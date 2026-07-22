-- 0058_proyecto_prm_id_camara.sql
-- Phase 89 — TRACE-01: columna aditiva para el ID interno de Cámara (prmID del deep-link).
--
-- El `<Id>` en el XML de WSLegislativo (p.ej. <Id>17140</Id> para boletín 16572-06) es el
-- identificador interno que arma el deep-link de tramitación:
--   https://www.camara.cl/legislacion/ProyectosDeLey/tramitacion.aspx?prmID=17140&prmBOLETIN=16572-06
--
-- Esta columna es ADITIVA (nullable, sin grant nuevo) — el read público la hereda del
-- `grant select on proyecto to anon` emitido en 0008. Un grant nuevo aquí haría morder al
-- lockdown-guard Block A (migraciones >0044 con `grant … to anon` están prohibidas en CI).
--
-- Orden de apply: después de 0057. Solo corrida ÚNICA (no re-ejecutable — ALTER COLUMN).
-- Aplicar: PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0058_proyecto_prm_id_camara.sql
-- NUNCA supabase db push (drift schema_migrations).
--
-- Sin backfill aquí — el backfill se hace LOCAL vía run-backfill-prmid-cli.ts (Plan 89-01).

alter table public.proyecto
  add column if not exists prm_id_camara text;

comment on column public.proyecto.prm_id_camara is
  'ID interno de la Cámara (campo <Id> de WSLegislativo.asmx). '
  'Permite construir el deep-link de tramitación: '
  'https://www.camara.cl/legislacion/ProyectosDeLey/tramitacion.aspx?prmID={prm_id_camara}&prmBOLETIN={boletin}. '
  'NULL mientras no se haya corrido el backfill para este boletín. '
  'Fuente: opendata.camara.cl/camaradiputados/WServices/WSLegislativo.asmx '
  '(retornarMocionesXAnno / retornarMensajesXAnno). Poblado por run-backfill-prmid-cli.ts.';
