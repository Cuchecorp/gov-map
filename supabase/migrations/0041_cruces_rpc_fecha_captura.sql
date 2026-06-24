-- 0041_cruces_rpc_fecha_captura.sql
-- CRUCEN-01 (Phase 41) — Proyecta `cruce_senal.fecha_captura` en el RPC
-- `cruces_de_parlamentario` (fix WR-02: frescura honesta). Cambia el `returns
-- table` (añade columna `fecha_captura timestamptz` AL FINAL) → requiere DROP +
-- recreate (Postgres prohíbe `create or replace` al cambiar el tipo de retorno,
-- 42P13; espejo de 0028_votos_instructivos.sql:24,32). Tras el recreate, re-emitir
-- AMBOS revokes: Supabase re-concede EXECUTE a anon/authenticated por DEFAULT
-- PRIVILEGES sobre CADA función nueva en public (lección Phase 36, cazada por
-- pgTAP-vs-PROD; ver 0040:56-61). El RPC sigue deny-by-default (SIN grant a anon —
-- eso es CRUCEN-02/0042). Proyección PII-safe: sin rut/partido/donante_id.
--
-- La última migración APLICADA es 0040. Esta es la 0041.
--
-- APLICACIÓN = CHECKPOINT DE OPERADOR: build/typecheck NO prueban que Postgres
-- ejecutó este DDL. La única prueba válida es el pgTAP (0041_*.test.sql) corriendo
-- contra el schema APLICADO vía `psql -tA -f`. Aplicar por `psql --db-url
-- --single-transaction`, NUNCA `supabase db push` (drift schema_migrations).
-- PGCLIENTENCODING=UTF8 en Windows.

-- Cambiar el returns table requiere drop previo (firma de parámetro intacta).
drop function if exists public.cruces_de_parlamentario(text);

create or replace function public.cruces_de_parlamentario(p_id text)
returns table (
  sector_id        text,
  sector_etiqueta  text,
  tipo_senal       text,
  conteo           int,
  evidencia        jsonb,
  fecha_captura    timestamptz   -- frescura real del cruce (cuándo materializó materializar_cruces())
)
language sql stable security definer set search_path = '' as $$
  select
    cs.sector_id,
    s.etiqueta,           -- etiqueta del catálogo público (dato no-PII)
    cs.tipo_senal,
    cs.conteo,
    cs.evidencia,         -- jsonb PII-safe (nombre crudo + enlace_fuente; sin rut, sin donante_id)
    cs.fecha_captura      -- nivel SEÑAL: todos los items de una señal comparten esta fecha
  from public.cruce_senal cs
  join public.sector s on s.codigo = cs.sector_id
  where cs.parlamentario_id = p_id
  order by cs.conteo desc, cs.sector_id asc;
$$;

-- DEFENSA EN PROFUNDIDAD (verbatim mirror de 0040:55-61). El `revoke from public`
-- NO toca los grants explícitos de rol que DEFAULT PRIVILEGES re-concede a la
-- función NUEVA; hay que revocarlos directamente. El pgTAP que asserta el deny de
-- anon es lo único que caza una omisión de la segunda línea.
revoke execute on function public.cruces_de_parlamentario(text) from public;
revoke execute on function public.cruces_de_parlamentario(text) from anon, authenticated;
-- INTENCIONALMENTE NO HAY `grant execute ... to anon` (deny-by-default hasta
-- sign-off legal + apply de 0042 — Candado A del doble candado).
