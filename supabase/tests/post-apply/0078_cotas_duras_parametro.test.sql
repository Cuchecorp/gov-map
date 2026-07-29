-- 0078_cotas_duras_parametro.test.sql
-- POST-APPLY ONLY — correr DESPUES de aplicar supabase/migrations/0078_cotas_duras_parametro.sql
--
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA \
--     -f supabase/tests/post-apply/0078_cotas_duras_parametro.test.sql
--
-- Prueba las cotas de OFF-4-03 (match_proyectos, votos_de_parlamentario) y OFF-4-04
-- (subgrafo_red) POR INVOCACION, no leyendo prosrc: leer el cuerpo no demuestra la cota.
--
-- Techo adjudicado por el operador: 4000 para las dos funciones de parametro
-- (>= 4x el argumento maximo del llamador vivo: 1001 y 1000). Ver cabecera de 0078.
--
-- PII: cero. Todas las aserciones son sobre CONTEOS y METADATOS de firma. Nunca se
-- transcribe una fila de datos. Los hashes de conjunto de (5) son md5 de la
-- representacion jsonb ya PII-safe que la propia RPC expone (id/nombre publico/camara).
--
-- Las 3 funciones son de LECTURA (STABLE), por eso aqui SI se invocan. Jamas se invoca
-- una RPC de escritura desde un test.

begin;
select plan(11);

-- ═══════════════════════════════════════════════════════════════════════════════════
-- (1)(2) match_proyectos — techo 4000 y default 20 via coalesce
-- ═══════════════════════════════════════════════════════════════════════════════════
select ok(
  (select count(*) from public.match_proyectos(
     (select embedding from public.proyecto_embedding order by boletin limit 1),
     100000, 0.0, null)) <= 4000,
  'match_proyectos con match_count=100000 (absurdo) devuelve <= 4000 filas: el LIMIT ya no lo elige el llamador (OFF-4-03)'
);

select ok(
  (select count(*) from public.match_proyectos(
     (select embedding from public.proyecto_embedding order by boletin limit 1),
     null, 0.0, null)) <= 20,
  'match_proyectos con match_count=null devuelve <= 20 (coalesce): un LIMIT NULL ya no significa "sin limite"'
);

-- ═══════════════════════════════════════════════════════════════════════════════════
-- (3)(4) votos_de_parlamentario — techo 4000 y default 20 via coalesce
-- ═══════════════════════════════════════════════════════════════════════════════════
select ok(
  (select count(*) from public.votos_de_parlamentario('D1165', 100000, 0)) <= 4000,
  'votos_de_parlamentario con p_limit=100000 (absurdo) devuelve <= 4000 filas (OFF-4-03)'
);

select ok(
  (select count(*) from public.votos_de_parlamentario('D1165', null, 0)) <= 20,
  'votos_de_parlamentario con p_limit=null devuelve <= 20 (coalesce)'
);

-- ═══════════════════════════════════════════════════════════════════════════════════
-- (5) subgrafo_red — la cota opera Y no recorta el grafo real
-- ═══════════════════════════════════════════════════════════════════════════════════
-- Doble condicion, porque solo la segunda tiene poder de caza: "<= la cota implementada"
-- no puede fallar por construccion. La comparacion contra el pre-apply es POR CONJUNTO
-- (elementos ordenados), no por md5 del texto crudo: el orden de jsonb_agg pre-apply era
-- NO DETERMINISTA (D1009 y D1075 a profundidad 2 daban hashes de texto distintos del
-- MISMO conjunto), asi que comparar el texto crudo mediria el bug, no el fix.
-- Semilla D1009 = la de fan-out maximo medido (grado 391), profundidad maxima (2).
select ok(
      jsonb_array_length(public.subgrafo_red('D1009', 2) -> 'nodos')   <= 1000
  and jsonb_array_length(public.subgrafo_red('D1009', 2) -> 'aristas') <= 40000
  and md5((select string_agg(x::text, '|' order by x::text)
           from jsonb_array_elements(public.subgrafo_red('D1009', 2) -> 'nodos') x))
      = '5326c102dde0f973ee5a02f1fead7365'
  and md5((select string_agg(x::text, '|' order by x::text)
           from jsonb_array_elements(public.subgrafo_red('D1009', 2) -> 'aristas') x))
      = '01822994d3b135615221b04c3e1f9953',
  'subgrafo_red(D1009,2): nodos <= 1000 y aristas <= 40000 (la cota opera) Y el conjunto es IDENTICO al capturado pre-apply (la cota NO recorto el grafo real) — OFF-4-04'
);

-- ═══════════════════════════════════════════════════════════════════════════════════
-- (6)(7)(8) no-regresion de contrato: firma identity + tipo de retorno sin cambios
-- Las cadenas son las capturadas del pg_get_functiondef VIVO antes del apply.
-- ═══════════════════════════════════════════════════════════════════════════════════
select is(
  (select pg_get_function_identity_arguments(p.oid) || ' -> ' || pg_get_function_result(p.oid)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'match_proyectos'),
  'query_embedding vector, match_count integer, match_threshold double precision, exclude_boletin text -> TABLE(boletin text, similarity double precision)',
  'match_proyectos conserva firma identity y tipo de retorno identicos al pre-apply (cero 42P13, cero cambio de contrato)'
);

select is(
  (select pg_get_function_identity_arguments(p.oid) || ' -> ' || pg_get_function_result(p.oid)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'votos_de_parlamentario'),
  'p_id text, p_limit integer, p_offset integer -> TABLE(votacion_id text, boletin text, fecha timestamp with time zone, seleccion text, etapa text, camara text, origen text, fecha_captura timestamp with time zone, enlace text, titulo text, idea_matriz text, resultado text, total_si integer, total_no integer, total_abstencion integer, total_pareo integer, quorum text)',
  'votos_de_parlamentario conserva firma identity y tipo de retorno identicos al pre-apply'
);

select is(
  (select pg_get_function_identity_arguments(p.oid) || ' -> ' || pg_get_function_result(p.oid)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'subgrafo_red'),
  'p_id text, p_depth integer, p_tipos text[], p_desde timestamp with time zone, p_hasta timestamp with time zone -> jsonb',
  'subgrafo_red conserva firma identity y tipo de retorno identicos al pre-apply'
);

-- ═══════════════════════════════════════════════════════════════════════════════════
-- (9)(10)(11) no-regresion de exposicion: el create or replace no re-abrio nada,
-- y el doble-revoke no le quito EXECUTE a service_role (la ruta viva del sitio)
-- ═══════════════════════════════════════════════════════════════════════════════════
select is(
  (select count(*)::int from (values
     ('public.match_proyectos(vector, integer, double precision, text)'),
     ('public.votos_de_parlamentario(text, integer, integer)'),
     ('public.subgrafo_red(text, integer, text[], timestamp with time zone, timestamp with time zone)')
   ) t(f)
   where has_function_privilege('anon', to_regprocedure(t.f)::oid, 'EXECUTE')),
  0,
  'ninguna de las 3 es ejecutable por anon: el create or replace no re-abrio EXECUTE por default ACL'
);

select is(
  (select count(*)::int from (values
     ('public.match_proyectos(vector, integer, double precision, text)'),
     ('public.votos_de_parlamentario(text, integer, integer)'),
     ('public.subgrafo_red(text, integer, text[], timestamp with time zone, timestamp with time zone)')
   ) t(f)
   where has_function_privilege('authenticated', to_regprocedure(t.f)::oid, 'EXECUTE')),
  0,
  'ninguna de las 3 es ejecutable por authenticated'
);

select is(
  (select count(*)::int from (values
     ('public.match_proyectos(vector, integer, double precision, text)'),
     ('public.votos_de_parlamentario(text, integer, integer)'),
     ('public.subgrafo_red(text, integer, text[], timestamp with time zone, timestamp with time zone)')
   ) t(f)
   where has_function_privilege('service_role', to_regprocedure(t.f)::oid, 'EXECUTE')),
  3,
  'service_role CONSERVA EXECUTE sobre las 3: el doble-revoke toca public/anon/authenticated, no la ruta viva del sitio (Camino A)'
);

select * from finish();
rollback;
