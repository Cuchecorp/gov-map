-- 0045_revoke_public_rpc_gap.test.sql  (POST-APPLY ONLY — corre tras aplicar 0045)
--
-- Verifica el cierre de la asimetría de revoke-from-public (DEBT DB-01/03/07/08):
--   * PUBLIC ya NO tiene EXECUTE sobre los 9 objetos revocados (7 RPCs public + 2
--     materializadores secdef de cruces/grafo). Se inspecciona proacl vía aclexplode
--     (grantee = 0 = PUBLIC) — la única forma de detectar un typo de firma silencioso.
--   * REGRESIÓN: web_reader (grant por nombre en 0043) CONSERVA EXECUTE en los 6 RPCs
--     que la app consume → el revoke-from-public no rompió la ruta pública del sitio.
--
-- POST-APPLY ONLY: vive fuera del glob regular a propósito. Pre-apply los asserts de
-- "PUBLIC sin EXECUTE" FALLARÍAN (estado pre-0045 = PUBLIC con EXECUTE). El operador lo
-- corre A MANO tras aplicar 0045:
--   psql -tA -f supabase/tests/post-apply/0045_revoke_public_rpc_gap.test.sql
-- contra PROD ya aplicado.

begin;
select plan(14);

-- Helper inline: 1 si PUBLIC (grantee=0) tiene EXECUTE en la función, 0 si no.
-- (No se puede `has_function_privilege('public', ...)` — 'public' no es un rol real.)

-- ── PUBLIC sin EXECUTE en los 7 RPCs de public ──
select is((select count(*)::int from pg_proc p, aclexplode(p.proacl) a
  where p.oid = 'public.match_proyectos(vector,int,float8,text)'::regprocedure
    and a.grantee = 0 and a.privilege_type = 'EXECUTE'),
  0, 'PUBLIC sin EXECUTE en match_proyectos');

select is((select count(*)::int from pg_proc p, aclexplode(p.proacl) a
  where p.oid = 'public.votos_de_parlamentario(text,int,int)'::regprocedure
    and a.grantee = 0 and a.privilege_type = 'EXECUTE'),
  0, 'PUBLIC sin EXECUTE en votos_de_parlamentario');

select is((select count(*)::int from pg_proc p, aclexplode(p.proacl) a
  where p.oid = 'public.rebeldias_de_parlamentario(text)'::regprocedure
    and a.grantee = 0 and a.privilege_type = 'EXECUTE'),
  0, 'PUBLIC sin EXECUTE en rebeldias_de_parlamentario (secdef + partido)');

select is((select count(*)::int from pg_proc p, aclexplode(p.proacl) a
  where p.oid = 'public.parlamentario_publico(text)'::regprocedure
    and a.grantee = 0 and a.privilege_type = 'EXECUTE'),
  0, 'PUBLIC sin EXECUTE en parlamentario_publico');

select is((select count(*)::int from pg_proc p, aclexplode(p.proacl) a
  where p.oid = 'public.parlamentarios_publico()'::regprocedure
    and a.grantee = 0 and a.privilege_type = 'EXECUTE'),
  0, 'PUBLIC sin EXECUTE en parlamentarios_publico');

-- (el overload 2-arg de 0032 ya no existe en PROD: 0033 lo reemplazo por el 3-arg)
select is((select count(*)::int from pg_proc p, aclexplode(p.proacl) a
  where p.oid = 'public.buscar_citaciones(text,int,text)'::regprocedure
    and a.grantee = 0 and a.privilege_type = 'EXECUTE'),
  0, 'PUBLIC sin EXECUTE en buscar_citaciones (3-arg, 0033)');

-- ── PUBLIC sin EXECUTE en los 2 materializadores secdef (cruces/grafo) ──
select is((select count(*)::int from pg_proc p, aclexplode(p.proacl) a
  where p.oid = 'cruces.materializar_cruces()'::regprocedure
    and a.grantee = 0 and a.privilege_type = 'EXECUTE'),
  0, 'PUBLIC sin EXECUTE en cruces.materializar_cruces');

select is((select count(*)::int from pg_proc p, aclexplode(p.proacl) a
  where p.oid = 'grafo.materializar_aristas()'::regprocedure
    and a.grantee = 0 and a.privilege_type = 'EXECUTE'),
  0, 'PUBLIC sin EXECUTE en grafo.materializar_aristas');

-- ── REGRESIÓN: web_reader CONSERVA EXECUTE en los 6 RPCs que la app consume ──
select ok(has_function_privilege('web_reader',
  'public.match_proyectos(vector,int,float8,text)'::regprocedure, 'execute'),
  'web_reader CONSERVA execute en match_proyectos');
select ok(has_function_privilege('web_reader',
  'public.votos_de_parlamentario(text,int,int)'::regprocedure, 'execute'),
  'web_reader CONSERVA execute en votos_de_parlamentario');
select ok(has_function_privilege('web_reader',
  'public.rebeldias_de_parlamentario(text)'::regprocedure, 'execute'),
  'web_reader CONSERVA execute en rebeldias_de_parlamentario');
select ok(has_function_privilege('web_reader',
  'public.parlamentario_publico(text)'::regprocedure, 'execute'),
  'web_reader CONSERVA execute en parlamentario_publico');
select ok(has_function_privilege('web_reader',
  'public.parlamentarios_publico()'::regprocedure, 'execute'),
  'web_reader CONSERVA execute en parlamentarios_publico');
select ok(has_function_privilege('web_reader',
  'public.buscar_citaciones(text,int,text)'::regprocedure, 'execute'),
  'web_reader CONSERVA execute en buscar_citaciones (3-arg)');

select * from finish();
rollback;
