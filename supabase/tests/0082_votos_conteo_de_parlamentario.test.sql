-- 0082_votos_conteo_de_parlamentario.test.sql
-- Verifica la migración 0082 (RPC de conteo agregado por selección, DEBT-01/B-01)
-- CONTRA UN SCHEMA APLICADO:
--   * la RPC existe con la firma de entrada 1-arg (text),
--   * es SECURITY DEFINER (secdef scoped por regprocedure — WR-05),
--   * anon Y authenticated NO recuperaron grant execute (doble-revoke completo),
--   * proconfig fija search_path='' y statement_timeout=5s,
--   * el returns table es EXACTAMENTE 2 columnas (seleccion text, n bigint) —
--     assert explícito de ausencia de columnas de identidad (gate LEGAL-03/PII),
--   * PARIDAD (SC3, control fuerte apareado) contra el testigo D1165: sum(n) ==
--     count(*) del universo, y ese universo es > 1000 (control positivo — impide
--     que la paridad pase vacía si el testigo quedara sin filas),
--   * EQUIVALENCIA con-left-join vs sin-left-join sobre el testigo (centinela de
--     robustez: si `proyecto`/`proyecto_ficha` alguna vez admiten boletines
--     duplicados por `boletin`, este assert se pone rojo antes de que listado y
--     conteo diverjan en silencio),
--   * CIERRE DE DOMINIO GLOBAL de `seleccion` (Fable blocker 2): cero filas
--     confirmadas fuera de {si,no,abstencion,pareo,ausente} en TODO `public.voto`,
--     no solo sobre el testigo.
-- Corre vía `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f` (vs PROD aplicado).
-- Espeja 0068_coincidencia_votos_par.test.sql (has_function/is/ok, begin/plan(N)/rollback).
-- pgTAP es la ÚNICA prueba válida del DDL (Pitfall 6): typecheck no prueba que Postgres corrió el DDL.

begin;
select plan(11);

-- ── 1. La RPC existe con su firma de entrada 1-arg (text) ────────────────────────────────
select has_function('public', 'votos_conteo_de_parlamentario', ARRAY['text'], 'votos_conteo_de_parlamentario(text) existe');

-- ── 2. Es SECURITY DEFINER (scoped por regprocedure, WR-05) ──────────────────────────────
select is(
  (select prosecdef from pg_proc where oid = 'public.votos_conteo_de_parlamentario(text)'::regprocedure),
  true,
  'votos_conteo_de_parlamentario es security definer');

-- ── 3. CERO grant execute a anon (doble-revoke re-emitido tras el DROP) ──────────────────
select is(has_function_privilege('anon', 'public.votos_conteo_de_parlamentario(text)', 'execute'), false, 'anon SIN execute sobre votos_conteo_de_parlamentario');

-- ── 4. CERO grant execute a authenticated (2º leg del doble-revoke, WR-05) ───────────────
select is(has_function_privilege('authenticated', 'public.votos_conteo_de_parlamentario(text)', 'execute'), false, 'authenticated SIN execute sobre votos_conteo_de_parlamentario');

-- ── 5. proconfig: search_path fijado ('' schema-qualified) ───────────────────────────────
select ok(
  (select array_to_string(proconfig, ',') from pg_proc
    where oid = 'public.votos_conteo_de_parlamentario(text)'::regprocedure) ~ 'search_path=',
  'search_path fijado en la función (secdef con nombres schema-qualified)');

-- ── 6. proconfig: statement_timeout='5s' (cota DoS) ──────────────────────────────────────
select ok(
  (select array_to_string(proconfig, ',') from pg_proc
    where oid = 'public.votos_conteo_de_parlamentario(text)'::regprocedure) ~ 'statement_timeout=5s',
  'statement_timeout=5s fijado en la función (RPC bounded)');

-- ── 7. Shape LOCKED: exactamente (seleccion text, n bigint) — gate LEGAL-03/PII ──────────
select is(
  pg_get_function_result('public.votos_conteo_de_parlamentario(text)'::regprocedure),
  'TABLE(seleccion text, n bigint)',
  'votos_conteo_de_parlamentario emite SOLO seleccion/n (cero identidad: rut/nombre/parlamentario_id/partido ausentes)');

-- ── 8. PARIDAD (SC3) contra el testigo D1165, con control positivo apareado ──────────────
--    (D1165 se midió en PROD 2026-07-30 con 3.752 votos confirmados, >1000: el listado
--    paginado por defecto NUNCA lo mostraría completo — ese es exactamente B-01)
select ok(
  (select coalesce(sum(n), 0) from public.votos_conteo_de_parlamentario('D1165'))
  =
  (select count(*) from public.voto v join public.votacion vo on vo.id = v.votacion_id
    where v.parlamentario_id = 'D1165' and v.estado_vinculo = 'confirmado'),
  'paridad: sum(n) de la RPC == count(*) del universo confirmado para D1165');

select ok(
  (select count(*) from public.voto v join public.votacion vo on vo.id = v.votacion_id
    where v.parlamentario_id = 'D1165' and v.estado_vinculo = 'confirmado') > 1000,
  'control positivo: el universo confirmado de D1165 es > 1000 (la paridad no es vacua)');

-- ── 9. EQUIVALENCIA con-left-join vs sin-left-join (centinela de no-fan-out) ─────────────
select is(
  (select count(*) from public.voto v join public.votacion vo on vo.id = v.votacion_id
    where v.parlamentario_id = 'D1165' and v.estado_vinculo = 'confirmado'),
  (select count(*) from public.voto v
    join public.votacion vo on vo.id = v.votacion_id
    left join public.proyecto pr on pr.boletin = vo.boletin
    left join public.proyecto_ficha pf on pf.boletin = vo.boletin
    where v.parlamentario_id = 'D1165' and v.estado_vinculo = 'confirmado'),
  'centinela: con-left-join a proyecto/proyecto_ficha da el MISMO count(*) que sin ellos (cero fan-out)');

-- ── 10. CIERRE DE DOMINIO GLOBAL de `seleccion` (Fable blocker 2) ────────────────────────
--     Si un 6º valor entrara por ingesta, la paridad seguiria verde mientras el chip JS
--     (que suma las 5 claves LOCKED) mostraria MENOS que el listado: divergencia silenciosa
--     clase B-01. Este assert la caza a nivel GLOBAL, no solo sobre el testigo.
select is(
  (select count(*) from public.voto v
    where v.estado_vinculo = 'confirmado'
      and v.seleccion not in ('si','no','abstencion','pareo','ausente')),
  0::bigint,
  'cierre de dominio GLOBAL: cero filas confirmadas fuera de si/no/abstencion/pareo/ausente');

select * from finish();
rollback;
