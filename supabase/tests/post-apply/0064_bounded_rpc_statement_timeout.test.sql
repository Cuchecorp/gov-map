-- 0064_bounded_rpc_statement_timeout.test.sql  (POST-APPLY ONLY)
--
-- Verifica SC#2: statement_timeout configurado en las 9 RPCs re-emitidas en 0064.
-- POST-APPLY ONLY: corre DESPUÉS de aplicar 0064 contra PROD.
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/post-apply/0064_bounded_rpc_statement_timeout.test.sql
-- Debe reportar 36 ok, 0 not ok.
--
-- Nota: el plan estimaba 10 RPCs (40 asserts) pero las interfaces definen 9 RPCs únicas
-- (4 bio/listado de 0060 + 4 cross-links de 0061 + 1 lobby de 0063 = 9). Se usan 36 asserts
-- (4 × 9): A=has_function, B=no-anon vía aclexplode, C=statement_timeout, D=PII-safe.

begin;
select plan(36);

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- RPC 1: parlamentario_publico_v2(text)
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- (A) función existe tras 0064
select has_function(
  'public',
  'parlamentario_publico_v2',
  array['text'],
  'parlamentario_publico_v2(text) existe tras 0064'
);

-- (B) PUBLIC sin EXECUTE (ACL intacta)
select is(
  (select count(*)::int
   from pg_proc p, aclexplode(p.proacl) a
   where p.oid = 'public.parlamentario_publico_v2(text)'::regprocedure
     and a.grantee = 0
     and a.privilege_type = 'EXECUTE'),
  0,
  'PUBLIC sin EXECUTE en parlamentario_publico_v2 tras 0064 (SC#2 ACL intacta)'
);

-- (C) statement_timeout seteado en proconfig (SC#2 core)
select ok(
  exists(
    select 1
    from pg_proc p
    cross join lateral unnest(p.proconfig) as cfg
    where p.oid = 'public.parlamentario_publico_v2(text)'::regprocedure
      and cfg like 'statement_timeout=%'
  ),
  'statement_timeout configurado en parlamentario_publico_v2 (SC#2 DoS cap)'
);

-- (D) PII-safe: returns table no proyecta rut/email/partido_alias
select ok(
  pg_get_function_result('public.parlamentario_publico_v2(text)'::regprocedure) !~* '\y(rut|email|partido_alias)\y',
  'parlamentario_publico_v2 no proyecta columnas PII (rut/email/partido_alias)'
);

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- RPC 2: parlamentarios_publico_v2() — sin args
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- (A)
select has_function(
  'public',
  'parlamentarios_publico_v2',
  '{}'::text[],
  'parlamentarios_publico_v2() existe tras 0064'
);

-- (B)
select is(
  (select count(*)::int
   from pg_proc p, aclexplode(p.proacl) a
   where p.oid = 'public.parlamentarios_publico_v2()'::regprocedure
     and a.grantee = 0
     and a.privilege_type = 'EXECUTE'),
  0,
  'PUBLIC sin EXECUTE en parlamentarios_publico_v2 tras 0064 (SC#2 ACL intacta)'
);

-- (C)
select ok(
  exists(
    select 1
    from pg_proc p
    cross join lateral unnest(p.proconfig) as cfg
    where p.oid = 'public.parlamentarios_publico_v2()'::regprocedure
      and cfg like 'statement_timeout=%'
  ),
  'statement_timeout configurado en parlamentarios_publico_v2 (SC#2 DoS cap)'
);

-- (D)
select ok(
  pg_get_function_result('public.parlamentarios_publico_v2()'::regprocedure) !~* '\y(rut|email|partido_alias)\y',
  'parlamentarios_publico_v2 no proyecta columnas PII (rut/email/partido_alias)'
);

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- RPC 3: militancias_de_parlamentario(text)
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- (A)
select has_function(
  'public',
  'militancias_de_parlamentario',
  array['text'],
  'militancias_de_parlamentario(text) existe tras 0064'
);

-- (B)
select is(
  (select count(*)::int
   from pg_proc p, aclexplode(p.proacl) a
   where p.oid = 'public.militancias_de_parlamentario(text)'::regprocedure
     and a.grantee = 0
     and a.privilege_type = 'EXECUTE'),
  0,
  'PUBLIC sin EXECUTE en militancias_de_parlamentario tras 0064 (SC#2 ACL intacta)'
);

-- (C)
select ok(
  exists(
    select 1
    from pg_proc p
    cross join lateral unnest(p.proconfig) as cfg
    where p.oid = 'public.militancias_de_parlamentario(text)'::regprocedure
      and cfg like 'statement_timeout=%'
  ),
  'statement_timeout configurado en militancias_de_parlamentario (SC#2 DoS cap)'
);

-- (D)
select ok(
  pg_get_function_result('public.militancias_de_parlamentario(text)'::regprocedure) !~* '\y(rut|email|partido_alias)\y',
  'militancias_de_parlamentario no proyecta columnas PII (rut/email/partido_alias)'
);

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- RPC 4: comisiones_de_parlamentario(text)
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- (A)
select has_function(
  'public',
  'comisiones_de_parlamentario',
  array['text'],
  'comisiones_de_parlamentario(text) existe tras 0064'
);

-- (B)
select is(
  (select count(*)::int
   from pg_proc p, aclexplode(p.proacl) a
   where p.oid = 'public.comisiones_de_parlamentario(text)'::regprocedure
     and a.grantee = 0
     and a.privilege_type = 'EXECUTE'),
  0,
  'PUBLIC sin EXECUTE en comisiones_de_parlamentario tras 0064 (SC#2 ACL intacta)'
);

-- (C)
select ok(
  exists(
    select 1
    from pg_proc p
    cross join lateral unnest(p.proconfig) as cfg
    where p.oid = 'public.comisiones_de_parlamentario(text)'::regprocedure
      and cfg like 'statement_timeout=%'
  ),
  'statement_timeout configurado en comisiones_de_parlamentario (SC#2 DoS cap)'
);

-- (D)
select ok(
  pg_get_function_result('public.comisiones_de_parlamentario(text)'::regprocedure) !~* '\y(rut|email|partido_alias)\y',
  'comisiones_de_parlamentario no proyecta columnas PII (rut/email/partido_alias)'
);

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- RPC 5: copartidarios_de_parlamentario(text)
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- (A)
select has_function(
  'public',
  'copartidarios_de_parlamentario',
  array['text'],
  'copartidarios_de_parlamentario(text) existe tras 0064'
);

-- (B)
select is(
  (select count(*)::int
   from pg_proc p, aclexplode(p.proacl) a
   where p.oid = 'public.copartidarios_de_parlamentario(text)'::regprocedure
     and a.grantee = 0
     and a.privilege_type = 'EXECUTE'),
  0,
  'PUBLIC sin EXECUTE en copartidarios_de_parlamentario tras 0064 (SC#2 ACL intacta)'
);

-- (C)
select ok(
  exists(
    select 1
    from pg_proc p
    cross join lateral unnest(p.proconfig) as cfg
    where p.oid = 'public.copartidarios_de_parlamentario(text)'::regprocedure
      and cfg like 'statement_timeout=%'
  ),
  'statement_timeout configurado en copartidarios_de_parlamentario (SC#2 DoS cap)'
);

-- (D)
select ok(
  pg_get_function_result('public.copartidarios_de_parlamentario(text)'::regprocedure) !~* '\y(rut|email|partido_alias)\y',
  'copartidarios_de_parlamentario no proyecta columnas PII (rut/email/partido_alias)'
);

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- RPC 6: de_la_misma_zona(text)
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- (A)
select has_function(
  'public',
  'de_la_misma_zona',
  array['text'],
  'de_la_misma_zona(text) existe tras 0064'
);

-- (B)
select is(
  (select count(*)::int
   from pg_proc p, aclexplode(p.proacl) a
   where p.oid = 'public.de_la_misma_zona(text)'::regprocedure
     and a.grantee = 0
     and a.privilege_type = 'EXECUTE'),
  0,
  'PUBLIC sin EXECUTE en de_la_misma_zona tras 0064 (SC#2 ACL intacta)'
);

-- (C)
select ok(
  exists(
    select 1
    from pg_proc p
    cross join lateral unnest(p.proconfig) as cfg
    where p.oid = 'public.de_la_misma_zona(text)'::regprocedure
      and cfg like 'statement_timeout=%'
  ),
  'statement_timeout configurado en de_la_misma_zona (SC#2 DoS cap)'
);

-- (D)
select ok(
  pg_get_function_result('public.de_la_misma_zona(text)'::regprocedure) !~* '\y(rut|email|partido_alias)\y',
  'de_la_misma_zona no proyecta columnas PII (rut/email/partido_alias)'
);

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- RPC 7: co_comisionados_de_parlamentario(text)
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- (A)
select has_function(
  'public',
  'co_comisionados_de_parlamentario',
  array['text'],
  'co_comisionados_de_parlamentario(text) existe tras 0064'
);

-- (B)
select is(
  (select count(*)::int
   from pg_proc p, aclexplode(p.proacl) a
   where p.oid = 'public.co_comisionados_de_parlamentario(text)'::regprocedure
     and a.grantee = 0
     and a.privilege_type = 'EXECUTE'),
  0,
  'PUBLIC sin EXECUTE en co_comisionados_de_parlamentario tras 0064 (SC#2 ACL intacta)'
);

-- (C)
select ok(
  exists(
    select 1
    from pg_proc p
    cross join lateral unnest(p.proconfig) as cfg
    where p.oid = 'public.co_comisionados_de_parlamentario(text)'::regprocedure
      and cfg like 'statement_timeout=%'
  ),
  'statement_timeout configurado en co_comisionados_de_parlamentario (SC#2 DoS cap)'
);

-- (D)
select ok(
  pg_get_function_result('public.co_comisionados_de_parlamentario(text)'::regprocedure) !~* '\y(rut|email|partido_alias)\y',
  'co_comisionados_de_parlamentario no proyecta columnas PII (rut/email/partido_alias)'
);

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- RPC 8: coautores_de_parlamentario(text)
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- (A)
select has_function(
  'public',
  'coautores_de_parlamentario',
  array['text'],
  'coautores_de_parlamentario(text) existe tras 0064'
);

-- (B)
select is(
  (select count(*)::int
   from pg_proc p, aclexplode(p.proacl) a
   where p.oid = 'public.coautores_de_parlamentario(text)'::regprocedure
     and a.grantee = 0
     and a.privilege_type = 'EXECUTE'),
  0,
  'PUBLIC sin EXECUTE en coautores_de_parlamentario tras 0064 (SC#2 ACL intacta)'
);

-- (C)
select ok(
  exists(
    select 1
    from pg_proc p
    cross join lateral unnest(p.proconfig) as cfg
    where p.oid = 'public.coautores_de_parlamentario(text)'::regprocedure
      and cfg like 'statement_timeout=%'
  ),
  'statement_timeout configurado en coautores_de_parlamentario (SC#2 DoS cap)'
);

-- (D)
select ok(
  pg_get_function_result('public.coautores_de_parlamentario(text)'::regprocedure) !~* '\y(rut|email|partido_alias)\y',
  'coautores_de_parlamentario no proyecta columnas PII (rut/email/partido_alias)'
);

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- RPC 9: lobby_menciones_de_boletin(text)
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- (A)
select has_function(
  'public',
  'lobby_menciones_de_boletin',
  array['text'],
  'lobby_menciones_de_boletin(text) existe tras 0064'
);

-- (B)
select is(
  (select count(*)::int
   from pg_proc p, aclexplode(p.proacl) a
   where p.oid = 'public.lobby_menciones_de_boletin(text)'::regprocedure
     and a.grantee = 0
     and a.privilege_type = 'EXECUTE'),
  0,
  'PUBLIC sin EXECUTE en lobby_menciones_de_boletin tras 0064 (SC#2 ACL intacta)'
);

-- (C)
select ok(
  exists(
    select 1
    from pg_proc p
    cross join lateral unnest(p.proconfig) as cfg
    where p.oid = 'public.lobby_menciones_de_boletin(text)'::regprocedure
      and cfg like 'statement_timeout=%'
  ),
  'statement_timeout configurado en lobby_menciones_de_boletin (SC#2 DoS cap)'
);

-- (D)
select ok(
  pg_get_function_result('public.lobby_menciones_de_boletin(text)'::regprocedure) !~* '\y(rut|email|partido_alias)\y',
  'lobby_menciones_de_boletin no proyecta columnas PII (rut/email/partido_alias)'
);

select * from finish();
rollback;
