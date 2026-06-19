-- 0024_dinero.test.sql
-- Verifica la migracion 0023_dinero (MONEY Contratos del Estado por RUT) CONTRA UN SCHEMA
-- APLICADO:
--   * las tablas (contrato + contratista + contratos_ingesta_estado) existen con RLS habilitada,
--   * `contrato` es VERSIONADO: su PK son (fuente_id, fecha_corte) (las versiones acumulan),
--   * `contrato` es PUBLIC-READ (policy SELECT para anon + grant SELECT a anon),
--   * `contratista` es DENY-BY-DEFAULT (el candado de la fase, leccion Phase 11): RLS enabled
--     + CERO policies + anon SIN grant SELECT (tres asserts distintos),
--   * `contratos_ingesta_estado` es PUBLIC-READ (policy SELECT para anon + grant SELECT a anon),
--   * el RPC `contratos_de_parlamentario(text)` existe, es SECURITY DEFINER, anon tiene EXECUTE,
--     y public NO tiene EXECUTE (revocado).
-- Corre via `supabase test db` (pgTAP). build/typecheck NO prueban que el DDL se aplico
-- (falso positivo de CI, RESEARCH Pitfall 3). El apply remoto + esta corrida contra el schema
-- APLICADO es el checkpoint de operador. Espeja 0022_probidad.test.sql + 0023_money_gate.test.sql.
-- (El numero 0024 evita la colision con el `0023_money_gate.test.sql` ya existente.)

begin;
select plan(17);

-- == Las tablas existen ==========================================================
select has_table('public', 'contrato',                  'tabla contrato existe');
select has_table('public', 'contratista',               'tabla contratista existe');
select has_table('public', 'contratos_ingesta_estado',  'tabla contratos_ingesta_estado existe');

-- == RLS habilitada (en la publica versionada, en la PII y en el marcador) ========
select is(
  (select count(*)::int from pg_class
     where relname = 'contrato' and relrowsecurity = true),
  1, 'RLS enabled en contrato');
select is(
  (select count(*)::int from pg_class
     where relname = 'contratos_ingesta_estado' and relrowsecurity = true),
  1, 'RLS enabled en contratos_ingesta_estado');

-- == contrato VERSIONADO: la PK son EXACTAMENTE (fuente_id, fecha_corte) ===========
-- Codifica "las versiones acumulan, nunca se sobreescriben". La PK DEBE incluir fecha_corte;
-- si la PK fuera solo fuente_id, un re-run colapsaria distintas consultas por RUT.
select is(
  (select string_agg(a.attname, ',' order by array_position(con.conkey, a.attnum))
     from pg_constraint con
     join pg_class c on c.oid = con.conrelid
     join pg_attribute a on a.attrelid = c.oid and a.attnum = any(con.conkey)
    where c.relname = 'contrato' and con.contype = 'p'),
  'fuente_id,fecha_corte',
  'la PK de contrato es (fuente_id, fecha_corte) — versionada (Pitfall: nunca por parlamentario solo)');

-- == contrato PUBLIC-READ: policy SELECT para anon + grant SELECT a anon ===========
select isnt(
  (select count(*)::int from pg_policies
     where tablename = 'contrato' and cmd = 'SELECT' and 'anon' = any(roles)),
  0, 'contrato tiene policy SELECT para anon (public-read)');
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = 'contrato' and grantee = 'anon' and privilege_type = 'SELECT'),
  1, 'anon tiene grant SELECT sobre contrato (public-read)');

-- == contratista DENY-BY-DEFAULT (el candado de la fase, leccion Phase 11) =========
-- TRES asserts distintos: RLS enabled + CERO policies + anon SIN grant SELECT. La RLS sin
-- policy niega las FILAS, pero el revoke explicito tambien quita el PRIVILEGIO (default
-- privileges de Supabase concede SELECT a anon en tablas nuevas de public hasta el revoke).
select is(
  (select count(*)::int from pg_class
     where relname = 'contratista' and relrowsecurity = true),
  1, 'RLS enabled en contratista (deny-by-default — candado de la fase)');
select is(
  (select count(*)::int from pg_policies where tablename = 'contratista'),
  0, 'contratista sin policies (deny-by-default, espejo 0021/0022)');
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = 'contratista' and grantee = 'anon' and privilege_type = 'SELECT'),
  0, 'anon NO tiene grant SELECT sobre contratista (revoke explicito — RUT PII, Ley 21.719 + leccion Phase 11)');

-- == contratos_ingesta_estado PUBLIC-READ: policy SELECT para anon + grant SELECT ==
select isnt(
  (select count(*)::int from pg_policies
     where tablename = 'contratos_ingesta_estado' and cmd = 'SELECT' and 'anon' = any(roles)),
  0, 'contratos_ingesta_estado tiene policy SELECT para anon (public-read)');
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = 'contratos_ingesta_estado' and grantee = 'anon' and privilege_type = 'SELECT'),
  1, 'anon tiene grant SELECT sobre contratos_ingesta_estado (public-read)');

-- == RPC: existe, security definer, anon tiene EXECUTE, public NO tiene EXECUTE ====
select has_function('public', 'contratos_de_parlamentario', ARRAY['text'],
  'funcion contratos_de_parlamentario(text) existe');
select is(
  (select p.prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'contratos_de_parlamentario'),
  true,
  'contratos_de_parlamentario es security definer');
select ok(
  has_function_privilege('anon', 'public.contratos_de_parlamentario(text)', 'execute'),
  'anon tiene EXECUTE sobre contratos_de_parlamentario');
select ok(
  not has_function_privilege('public', 'public.contratos_de_parlamentario(text)', 'execute'),
  'public NO tiene EXECUTE sobre contratos_de_parlamentario (revocado de public)');

select * from finish();
rollback;
