-- 0040_cruces_rpc.sql
-- CRUCE (CRUCE-03) — el RPC `cruces_de_parlamentario` es el único canal de lectura curado
-- a la señal `cruce_senal` (deny-by-default, 0039). Espejo de `subgrafo_red` (0030_net.sql)
-- y `lobby_de_parlamentario` (0021) en disciplina de proyección named-column PII-safe, con
-- UNA DEPARTURE deliberada: se KEEP el `revoke execute ... from public` pero se DROP el
-- `grant execute ... to anon` — el RPC queda SIN canal público hasta el sign-off legal
-- (Phase 39, firma humana exclusiva). Deny-by-default también en el canal de lectura.
--
-- La última migración APLICADA es 0037. 0038 (sector) y 0039 (cruce_senal) la preceden en
-- este mismo plan. Esta es la 0040.
--
-- APLICACIÓN = CHECKPOINT DE OPERADOR (Pitfall 5): build/typecheck NO prueban que
-- Postgres ejecutó este DDL. La única prueba válida es el pgTAP (0040_cruces_rpc.test.sql)
-- corriendo contra un schema APLICADO. Aplicar por `psql --db-url` DIRECTO, NUNCA
-- `supabase db push` (drift schema_migrations). La aplicación al remoto vive en Plan 04.
--
-- DOBLE CANDADO: Candado A = RLS deny-by-default sobre cruce_senal (0039) + ESTE RPC sin
-- grant a anon. Candado B = gate de presentación `crucesPublicEnabled()` (default OFF).
-- El sign-off legal (Phase 39) habilita ambos; un agente NUNCA flipea un flag *_PUBLIC.
--
-- PROYECCIÓN PII-SAFE (espejo subgrafo_red/0030:224-247 + lobby_de_parlamentario/0021):
--   El RPC lee `cruce_senal` (deny-by-default) y SOLO une a `sector` (catálogo público) por
--   el código para resolver la etiqueta legible. NUNCA une a parlamentario/donante de modo
--   que filtre rut/partido/email/donante_id. Devuelve columnas NOMBRADAS (NO select *):
--   sector_id, sector_etiqueta, tipo_senal, conteo, evidencia (jsonb con items[].enlace_fuente).
--   La evidencia ya nace PII-safe en el materializador (0039): nombre CRUDO de contraparte,
--   sin rut. set search_path = '' (V8): nombres calificados con schema.

create or replace function public.cruces_de_parlamentario(p_id text)
returns table (
  sector_id        text,
  sector_etiqueta  text,
  tipo_senal       text,
  conteo           int,
  evidencia        jsonb
)
language sql stable security definer set search_path = '' as $$
  select
    cs.sector_id,
    s.etiqueta,           -- etiqueta del catálogo público (dato no-PII)
    cs.tipo_senal,
    cs.conteo,
    cs.evidencia          -- jsonb PII-safe (nombre crudo + enlace_fuente; sin rut, sin donante_id)
  from public.cruce_senal cs
  join public.sector s on s.codigo = cs.sector_id
  where cs.parlamentario_id = p_id
  order by cs.conteo desc, cs.sector_id asc;
$$;

-- DEPARTURE (la ONE de este plan): se KEEP el revoke from public pero NO se emite el
-- `grant execute ... to anon` (distinto de subgrafo_red/lobby_de_parlamentario, que SÍ
-- conceden a anon). El RPC queda deny-by-default en ejecución: nadie no-privilegiado lo
-- invoca hasta el sign-off legal de Phase 39. No se añade ninguna policy ni grant select
-- sobre cruce_senal (sigue deny-by-default).
revoke execute on function public.cruces_de_parlamentario(text) from public;
-- INTENCIONALMENTE NO HAY `grant execute on function public.cruces_de_parlamentario(text) to anon;`
-- (deny-by-default hasta firma Phase 39 — Candado A del doble candado de cruces).
