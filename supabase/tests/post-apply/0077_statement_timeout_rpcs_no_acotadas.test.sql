-- 0077_statement_timeout_rpcs_no_acotadas.test.sql  (POST-APPLY ONLY)
--
-- Verifica el cierre de la parte de CONFIGURACION de OFF-4-03 (17 RPCs) y OFF-4-04
-- (subgrafo_red): las 18 tienen statement_timeout=5s en su proconfig.
-- POST-APPLY ONLY: corre DESPUES de aplicar 0077 contra PROD.
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA \
--     -f supabase/tests/post-apply/0077_statement_timeout_rpcs_no_acotadas.test.sql
-- Debe reportar 20 ok, 0 not ok.
--
-- Forma replicada de 0064_bounded_rpc_statement_timeout.test.sql (asercion C).
--
-- ── DENOMINADOR DECLARADO (nota anti-cero-vacuo del audit) ────────────────────────
-- Corpus propio de public = 42 funciones. Reparto tras 0077:
--     13 previas (0064/0066/0067) + 18 de 0077 = 31 con statement_timeout
--   + 11 acotadas por construccion (constante, escalar, 2 admin-write, 7 triggers)
--   = 42.
-- Las 18 se asertan UNA A UNA (assert 1..18): un unico `count = 18` no diria CUALES.
-- Assert 19 = denominador (42, el fix no creo ni destruyo objetos).
-- Assert 20 = no-regresion de firma: `alter ... set` no toca la firma.

begin;
select plan(20);

-- ═══════════════════════════════════════════════════════════════════════════════════
-- (1..18) statement_timeout=5s, funcion por funcion, nombrada en el mensaje
-- ═══════════════════════════════════════════════════════════════════════════════════

-- ── OFF-4-03 · 12 sin LIMIT ni timeout ────────────────────────────────────────────
select ok(
  exists(select 1 from pg_proc p cross join lateral unnest(p.proconfig) as cfg
         where p.oid = 'public.aportes_de_parlamentario(text)'::regprocedure
           and cfg = 'statement_timeout=5s'),
  'aportes_de_parlamentario(text) tiene statement_timeout=5s (OFF-4-03)');

select ok(
  exists(select 1 from pg_proc p cross join lateral unnest(p.proconfig) as cfg
         where p.oid = 'public.bienes_de_parlamentario(text)'::regprocedure
           and cfg = 'statement_timeout=5s'),
  'bienes_de_parlamentario(text) tiene statement_timeout=5s (OFF-4-03)');

select ok(
  exists(select 1 from pg_proc p cross join lateral unnest(p.proconfig) as cfg
         where p.oid = 'public.comparar_declaraciones(text, date[])'::regprocedure
           and cfg = 'statement_timeout=5s'),
  'comparar_declaraciones(text, date[]) tiene statement_timeout=5s (OFF-4-03)');

select ok(
  exists(select 1 from pg_proc p cross join lateral unnest(p.proconfig) as cfg
         where p.oid = 'public.contratos_de_parlamentario(text)'::regprocedure
           and cfg = 'statement_timeout=5s'),
  'contratos_de_parlamentario(text) tiene statement_timeout=5s (OFF-4-03)');

select ok(
  exists(select 1 from pg_proc p cross join lateral unnest(p.proconfig) as cfg
         where p.oid = 'public.cruces_de_parlamentario(text)'::regprocedure
           and cfg = 'statement_timeout=5s'),
  'cruces_de_parlamentario(text) tiene statement_timeout=5s (OFF-4-03)');

select ok(
  exists(select 1 from pg_proc p cross join lateral unnest(p.proconfig) as cfg
         where p.oid = 'public.cruces_de_proyecto(text)'::regprocedure
           and cfg = 'statement_timeout=5s'),
  'cruces_de_proyecto(text) tiene statement_timeout=5s (OFF-4-03)');

select ok(
  exists(select 1 from pg_proc p cross join lateral unnest(p.proconfig) as cfg
         where p.oid = 'public.declaraciones_de_parlamentario(text)'::regprocedure
           and cfg = 'statement_timeout=5s'),
  'declaraciones_de_parlamentario(text) tiene statement_timeout=5s (OFF-4-03)');

select ok(
  exists(select 1 from pg_proc p cross join lateral unnest(p.proconfig) as cfg
         where p.oid = 'public.lobby_de_parlamentario(text)'::regprocedure
           and cfg = 'statement_timeout=5s'),
  'lobby_de_parlamentario(text) tiene statement_timeout=5s (OFF-4-03)');

select ok(
  exists(select 1 from pg_proc p cross join lateral unnest(p.proconfig) as cfg
         where p.oid = 'public.lobby_en_tramitacion(text)'::regprocedure
           and cfg = 'statement_timeout=5s'),
  'lobby_en_tramitacion(text) tiene statement_timeout=5s (OFF-4-03)');

select ok(
  exists(select 1 from pg_proc p cross join lateral unnest(p.proconfig) as cfg
         where p.oid = 'public.parlamentarios_publico()'::regprocedure
           and cfg = 'statement_timeout=5s'),
  'parlamentarios_publico() tiene statement_timeout=5s (OFF-4-03: barria el directorio entero)');

select ok(
  exists(select 1 from pg_proc p cross join lateral unnest(p.proconfig) as cfg
         where p.oid = 'public.rebeldias_de_parlamentario(text)'::regprocedure
           and cfg = 'statement_timeout=5s'),
  'rebeldias_de_parlamentario(text) tiene statement_timeout=5s (OFF-4-03)');

select ok(
  exists(select 1 from pg_proc p cross join lateral unnest(p.proconfig) as cfg
         where p.oid = 'public.tasa_ausencia_comparada(text)'::regprocedure
           and cfg = 'statement_timeout=5s'),
  'tasa_ausencia_comparada(text) tiene statement_timeout=5s (OFF-4-03: cohorte completa sobre voto)');

-- ── OFF-4-03 · 3 con techo duro en el cuerpo, pero sin timeout ────────────────────
select ok(
  exists(select 1 from pg_proc p cross join lateral unnest(p.proconfig) as cfg
         where p.oid = 'public.agregado_por_contraparte(text)'::regprocedure
           and cfg = 'statement_timeout=5s'),
  'agregado_por_contraparte(text) tiene statement_timeout=5s (OFF-4-03: cap 500 sin techo de tiempo)');

select ok(
  exists(select 1 from pg_proc p cross join lateral unnest(p.proconfig) as cfg
         where p.oid = 'public.buscar_citaciones(text, integer, text)'::regprocedure
           and cfg = 'statement_timeout=5s'),
  'buscar_citaciones(text, integer, text) tiene statement_timeout=5s (OFF-4-03: techo 100 sin timeout)');

select ok(
  exists(select 1 from pg_proc p cross join lateral unnest(p.proconfig) as cfg
         where p.oid = 'public.parlamentario_publico(text)'::regprocedure
           and cfg = 'statement_timeout=5s'),
  'parlamentario_publico(text) tiene statement_timeout=5s (OFF-4-03; distinta de parlamentario_publico_v2)');

-- ── OFF-4-03 · 2 con LIMIT de parametro (cardinalidad elegida por el cliente) ─────
select ok(
  exists(select 1 from pg_proc p cross join lateral unnest(p.proconfig) as cfg
         where p.oid = 'public.match_proyectos(vector, integer, double precision, text)'::regprocedure
           and cfg = 'statement_timeout=5s'),
  'match_proyectos(vector, integer, double precision, text) tiene statement_timeout=5s (OFF-4-03: limit match_count)');

select ok(
  exists(select 1 from pg_proc p cross join lateral unnest(p.proconfig) as cfg
         where p.oid = 'public.votos_de_parlamentario(text, integer, integer)'::regprocedure
           and cfg = 'statement_timeout=5s'),
  'votos_de_parlamentario(text, integer, integer) tiene statement_timeout=5s (OFF-4-03: limit p_limit)');

-- ── OFF-4-04 · walk recursivo con fan-out sin cota ────────────────────────────────
select ok(
  exists(select 1 from pg_proc p cross join lateral unnest(p.proconfig) as cfg
         where p.oid = 'public.subgrafo_red(text, integer, text[], timestamp with time zone, timestamp with time zone)'::regprocedure
           and cfg = 'statement_timeout=5s'),
  'subgrafo_red(...) tiene statement_timeout=5s (OFF-4-04; la cota de fan-out va en 124-05)');

-- ═══════════════════════════════════════════════════════════════════════════════════
-- (19) DENOMINADOR: recalibrado por Phase 130 Plan 01 (0082 anadio 1 funcion propia de
--      public con statement_timeout=5s: votos_conteo_de_parlamentario). El corpus propio
--      de public pasa de 42 a 43, y las con-techo de 31 a 32 (13 previas + 18 de 0077 +
--      1 de 0082). Este assert NO valida "0077 no creo ni destruyo objetos" en aislado —
--      valida el estado TOTAL del corpus al momento de la corrida, y por eso se recalibra
--      cada vez que una migracion posterior anade una funcion propia legitima a public.
--      Medido con el predicado de Q-13bis VERBATIM (prosrc O proconfig).
-- ═══════════════════════════════════════════════════════════════════════════════════
select is(
  (select (count(*) filter (
             where lower(p.prosrc) like '%statement_timeout%'
                or array_to_string(coalesce(p.proconfig,'{}'), ',') like '%statement_timeout%'
           ))::text || '/' || count(*)::text
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')),
  '32/43',
  '32 de 43 funciones propias de public con statement_timeout (13 previas + 18 de 0077 + 1 de 0082/votos_conteo_de_parlamentario); las 11 restantes son las acotadas por construccion. Recalibrado por Phase 130-01 (nueva funcion legitima, no una regresion de 0077).'
);

-- ═══════════════════════════════════════════════════════════════════════════════════
-- (20) NO-REGRESION DE FIRMA: `alter function ... set` no toca la firma.
--      Se comparan contra las identity args capturadas ANTES del apply (Q-13bis),
--      sobre las 3 firmas no triviales del conjunto.
-- ═══════════════════════════════════════════════════════════════════════════════════
select is(
  (select string_agg(sig, ' || ' order by sig) from (
     select pg_get_function_identity_arguments(oid) as sig from (values
       ('public.match_proyectos(vector, integer, double precision, text)'::regprocedure),
       ('public.votos_de_parlamentario(text, integer, integer)'::regprocedure),
       ('public.subgrafo_red(text, integer, text[], timestamp with time zone, timestamp with time zone)'::regprocedure)
     ) as t(oid)
   ) s),
  'p_id text, p_depth integer, p_tipos text[], p_desde timestamp with time zone, p_hasta timestamp with time zone'
  || ' || ' || 'p_id text, p_limit integer, p_offset integer'
  || ' || ' || 'query_embedding vector, match_count integer, match_threshold double precision, exclude_boletin text',
  'las identity args de match_proyectos/votos_de_parlamentario/subgrafo_red son identicas a las capturadas PRE-apply: alter ... set no cambio ninguna firma (cero 42P13, cero drop)'
);

select * from finish();
rollback;
