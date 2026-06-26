-- 0045_revoke_public_rpc_gap.sql
--
-- ████ FORWARD-FIX DE HIGIENE — ESCRITA, NO APLICADA POR EL AGENTE ████
--
-- Cierra la ASIMETRÍA de deny-by-default detectada en Phase 43 (DEBT DB-01/03/07/08):
-- 6 RPCs de `public` recibieron `grant execute ... to anon` SIN el `revoke execute
-- ... from public` que sus pares sí tienen (0021/0023/0024/0025/0030/0031/0040), y 2
-- materializadores secdef en esquemas no-public (`cruces`, `grafo`) nunca revocaron el
-- EXECUTE-a-PUBLIC que Postgres concede por defecto al crear una función.
--
-- POR QUÉ ES SEGURO (NO-OP en PROD actual): 0044 ya revocó anon/authenticated y su
-- `ALTER DEFAULT PRIVILEGES FOR ROLE postgres ... REVOKE` cubre el esquema `public`.
-- `revoke ... from PUBLIC` NO toca los grants explícitos: el owner `postgres`, los jobs
-- de pg_cron (corren como postgres), `service_role` y `web_reader` (grant por nombre en
-- 0043) CONSERVAN execute. No hay caller vivo que dependa del grant a PUBLIC.
--
-- POR QUÉ IGUAL VALE LA PENA: endurece (a) entornos dev/staging que reproducen
-- 0001→0043 sin 0044, (b) un reverse-0044 parcial, y (c) los esquemas `cruces`/`grafo`
-- que el ADP-revoke de 0044 (scope `IN SCHEMA public`) NO cubre.
--
-- ⚠ GUARDARRAÍL: hoy anon NO tiene `usage` sobre los esquemas `cruces`/`grafo` (grep=0),
-- por eso los materializadores son inalcanzables por el rol de la API. Si una migración
-- futura hiciera `grant usage on schema cruces|grafo to anon`, DEBE venir acompañada de
-- estos revokes (o el EXECUTE-a-PUBLIC de los destructores quedaría vivo).
--
-- NO APLICAR EN AUTÓNOMO. Apply = checkpoint de operador (como todo DDL del repo):
--   psql "$DATABASE_URL" --single-transaction -f supabase/migrations/0045_revoke_public_rpc_gap.sql
--   + fila en schema_migrations ('0045_revoke_public_rpc_gap')
--   + verificar: supabase/tests/post-apply/0045_revoke_public_rpc_gap.test.sql
-- Un error de firma aquí NO es silencioso: `revoke ... on function f(types)` sobre una
-- firma inexistente LANZA "function ... does not exist" → la transacción hace rollback.
-- ████████████████████████████████████████████████████████████████████████████████

-- RPCs de public con grant-a-anon pero sin revoke-from-public (DB-01).
revoke execute on function public.match_proyectos(vector, int, float8, text) from public;
revoke execute on function public.votos_de_parlamentario(text, int, int)     from public;
-- secdef que lee parlamentario.partido (LEGAL-03) — el más sensible (DB-03).
revoke execute on function public.rebeldias_de_parlamentario(text)           from public;
revoke execute on function public.parlamentario_publico(text)                from public;
revoke execute on function public.parlamentarios_publico()                   from public;
-- buscar_citaciones: en PROD solo existe el overload 3-arg (0033 reemplazo al 2-arg
-- de 0032 via drop+recreate). Verificado contra pg_proc 2026-06-26: la unica firma es
-- (q text, limite integer, p_camara text). El revoke del 2-arg inexistente se elimino
-- (lanzaba "function ... does not exist" -> rollback).
revoke execute on function public.buscar_citaciones(text, int, text)         from public;

-- Materializadores secdef destructivos en esquemas no-public (DB-07/08). Defense-in-depth:
-- inalcanzables hoy (sin `usage` a anon) pero el ADP-revoke de 0044 no cubre estos esquemas.
revoke execute on function cruces.materializar_cruces()  from public;
revoke execute on function grafo.materializar_aristas()  from public;
