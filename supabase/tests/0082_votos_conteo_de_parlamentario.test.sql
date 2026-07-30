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
-- ── NOTA WR-08 (code-review 130): `limit 1000` SIN `order by` en el agregado ─────
-- La migración 0082 (L74) cierra el `group by v.seleccion` con `limit 1000` y sin
-- `order by`: sobre un agregado, un `limit` sin orden recorta filas ARBITRARIAS.
-- Hoy es inofensivo porque el dominio de `voto.seleccion` está CERRADO por
-- `voto_seleccion_check` (0008 L61 + 0019 L36-37) ⇒ como mucho 5 grupos, muy por
-- debajo del piso LOCKED de 1000. La migración 0082 está APLICADA en PROD y es
-- INTOCABLE (nunca se edita una migración aplicada), así que el `order by
-- v.seleccion` determinista tendrá que entrar por una migración futura si alguna
-- vez se abre el dominio. Mientras tanto el RIESGO REAL —que el día que entre un 6º
-- valor el truncamiento sea silencioso y el total baje sin aviso (clase B-01)— muere
-- por otro lado: el assert 10 de abajo verifica que el CHECK que cierra el dominio
-- sigue vivo, y el 11 cuenta las filas fuera de dominio incluyendo NULL. Si el
-- dominio se abriera, el rojo aparece aquí ANTES de que el limit pueda truncar.
select plan(12);

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
--     WR-03 (code-review 130): el control positivo va ENCADENADO DENTRO del assert, no
--     heredado del 8. Son asserts independientes: si D1165 desapareciera o cambiara de
--     ID, ambos lados de la igualdad darían 0 y el centinela quedaría VERDE Y VACÍO
--     (el mismo falso-verde que el assert 8 sí neutraliza con su propio `> 1000`).
--     Con el `and … > 1000` adentro, la existencia del testigo se prueba ANTES del 0=0.
select ok(
  (select count(*) from public.voto v join public.votacion vo on vo.id = v.votacion_id
    where v.parlamentario_id = 'D1165' and v.estado_vinculo = 'confirmado')
  =
  (select count(*) from public.voto v
    join public.votacion vo on vo.id = v.votacion_id
    left join public.proyecto pr on pr.boletin = vo.boletin
    left join public.proyecto_ficha pf on pf.boletin = vo.boletin
    where v.parlamentario_id = 'D1165' and v.estado_vinculo = 'confirmado')
  and
  (select count(*) from public.voto v join public.votacion vo on vo.id = v.votacion_id
    where v.parlamentario_id = 'D1165' and v.estado_vinculo = 'confirmado') > 1000,
  'centinela: con-left-join a proyecto/proyecto_ficha da el MISMO count(*) que sin ellos (cero fan-out), con el testigo D1165 probado no-vacío (>1000) DENTRO del mismo assert');

-- ── 10-11. CIERRE DE DOMINIO GLOBAL de `seleccion` (Fable blocker 2 + WR-02) ─────────────
--     Si un 6º valor entrara por ingesta, la paridad seguiria verde mientras el chip JS
--     (que suma las 5 claves LOCKED) mostraria MENOS que el listado: divergencia silenciosa
--     clase B-01. Este assert la caza a nivel GLOBAL, no solo sobre el testigo.
--     WR-02 (code-review 130): se mide la GARANTÍA, no su consecuencia. El conteo de
--     filas fuera de dominio era vacuo por construcción (el motor ya lo impide) y,
--     peor, NULL-ciego: `seleccion not in (…)` con `seleccion IS NULL` evalúa a NULL,
--     no a true ⇒ una fila NULL no se contaba. Es decir, el único modo de fallo nuevo
--     que la caída del constraint dejaría entrar era justamente el que el assert no
--     veía. Ahora: (10) el CHECK sigue vivo — PRIMERA LÍNEA de defensa —, y (11) el
--     conteo cierra el hueco NULL explícitamente.
select ok(
  exists(select 1 from pg_constraint
    where conrelid = 'public.voto'::regclass
      and conname = 'voto_seleccion_check'),
  'el CHECK de dominio de voto.seleccion (voto_seleccion_check, 0008/0019) sigue vivo');

select is(
  (select count(*) from public.voto v
    where v.estado_vinculo = 'confirmado'
      and (v.seleccion is null
           or v.seleccion not in ('si','no','abstencion','pareo','ausente'))),
  0::bigint,
  'cierre de dominio GLOBAL: cero filas confirmadas NULL o fuera de si/no/abstencion/pareo/ausente');

select * from finish();
rollback;
