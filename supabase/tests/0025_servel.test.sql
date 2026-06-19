-- 0025_servel.test.sql
-- Verifica la migracion 0024_servel (MONEY Financiamiento -- aportes de campana SERVEL)
-- CONTRA UN SCHEMA APLICADO:
--   * las tablas (aporte + donante + aportes_ingesta_estado) existen con RLS habilitada,
--   * `aporte` es VERSIONADO: su PK son (fuente_id, fecha_corte) (las versiones acumulan),
--   * `aporte.eleccion` es NOT NULL (campo load-bearing del agrupamiento por periodo),
--   * `aporte` tiene la columna `candidato_nombre_verbatim` (llave del enlace por NOMBRE),
--   * `aporte.parlamentario_id` es FK a parlamentario(id) y es NULLABLE (un no_confirmado
--     lo deja null; solo un enlace confirmado lo puebla),
--   * `aporte` es PUBLIC-READ (policy SELECT para anon + grant SELECT a anon),
--   * `donante` es DENY-BY-DEFAULT (el candado de la fase, leccion Phase 11 + CR-01 Phase 13):
--     RLS enabled + CERO policies + anon SIN grant SELECT (tres asserts distintos),
--   * `aportes_ingesta_estado` es PUBLIC-READ (policy SELECT para anon + grant SELECT a anon),
--   * el RPC `aportes_de_parlamentario(text)` existe, es SECURITY DEFINER, anon tiene EXECUTE,
--     y public NO tiene EXECUTE (revocado),
--   * el cuerpo del RPC ordena por `eleccion` y NO proyecta el RUT del donante (Ley 21.719).
-- Corre via `supabase test db` (pgTAP). build/typecheck NO prueban que el DDL se aplico
-- (falso positivo de CI, RESEARCH Pitfall 4). El apply remoto + esta corrida contra el schema
-- APLICADO es el checkpoint de operador. Espeja 0024_dinero.test.sql.
-- (El numero 0025 evita colision con `0023_money_gate.test.sql` y `0024_dinero.test.sql`.)

begin;
select plan(23);

-- == Las tablas existen ==========================================================
select has_table('public', 'aporte',                  'tabla aporte existe');
select has_table('public', 'donante',                 'tabla donante existe');
select has_table('public', 'aportes_ingesta_estado',  'tabla aportes_ingesta_estado existe');

-- == RLS habilitada (en la publica versionada y en el marcador) ===================
select is(
  (select count(*)::int from pg_class
     where relname = 'aporte' and relrowsecurity = true),
  1, 'RLS enabled en aporte');
select is(
  (select count(*)::int from pg_class
     where relname = 'aportes_ingesta_estado' and relrowsecurity = true),
  1, 'RLS enabled en aportes_ingesta_estado');

-- == aporte VERSIONADO: la PK son EXACTAMENTE (fuente_id, fecha_corte) =============
-- Codifica "las versiones acumulan, nunca se sobreescriben". La PK DEBE incluir fecha_corte;
-- si la PK fuera solo fuente_id, un re-run colapsaria distintas consultas SERVEL.
select is(
  (select string_agg(a.attname, ',' order by array_position(con.conkey, a.attnum))
     from pg_constraint con
     join pg_class c on c.oid = con.conrelid
     join pg_attribute a on a.attrelid = c.oid and a.attnum = any(con.conkey)
    where c.relname = 'aporte' and con.contype = 'p'),
  'fuente_id,fecha_corte',
  'la PK de aporte es (fuente_id, fecha_corte) -- versionada (Pitfall: nunca por parlamentario)');

-- == aporte.eleccion es NOT NULL (campo load-bearing del agrupamiento por periodo) =
select col_not_null('aporte', 'eleccion',
  'aporte.eleccion es NOT NULL (load-bearing: la ficha agrupa por periodo electoral)');

-- == aporte tiene la columna candidato_nombre_verbatim (llave del enlace por NOMBRE) =
select has_column('aporte', 'candidato_nombre_verbatim',
  'aporte tiene candidato_nombre_verbatim (llave del enlace por NOMBRE via pipeline)');

-- == aporte.parlamentario_id: FK a parlamentario(id) y NULLABLE =====================
-- Un enlace confirmado lo puebla; un no_confirmado lo deja null (fail-closed).
select col_is_fk('aporte', 'parlamentario_id',
  'aporte.parlamentario_id es FK (al maestro parlamentario)');
select col_is_null('aporte', 'parlamentario_id',
  'aporte.parlamentario_id es NULLABLE (un no_confirmado no cuelga de un parlamentario)');

-- == aporte PUBLIC-READ: policy SELECT para anon + grant SELECT a anon ==============
select isnt(
  (select count(*)::int from pg_policies
     where tablename = 'aporte' and cmd = 'SELECT' and 'anon' = any(roles)),
  0, 'aporte tiene policy SELECT para anon (public-read)');
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = 'aporte' and grantee = 'anon' and privilege_type = 'SELECT'),
  1, 'anon tiene grant SELECT sobre aporte (public-read)');

-- == donante DENY-BY-DEFAULT (el candado de la fase, leccion Phase 11 + CR-01) ======
-- TRES asserts distintos: RLS enabled + CERO policies + anon SIN grant SELECT. La RLS sin
-- policy niega las FILAS, pero el revoke explicito tambien quita el PRIVILEGIO (default
-- privileges de Supabase concede SELECT a anon en tablas nuevas de public hasta el revoke).
-- Dato sensible: un aporte puede revelar afiliacion politica (Ley 21.719).
select is(
  (select count(*)::int from pg_class
     where relname = 'donante' and relrowsecurity = true),
  1, 'RLS enabled en donante (deny-by-default -- candado de la fase)');
select is(
  (select count(*)::int from pg_policies where tablename = 'donante'),
  0, 'donante sin policies (deny-by-default, espejo 0023)');
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = 'donante' and grantee = 'anon' and privilege_type = 'SELECT'),
  0, 'anon NO tiene grant SELECT sobre donante (revoke explicito -- PII sensible, Ley 21.719 + leccion Phase 11)');

-- == aportes_ingesta_estado PUBLIC-READ: policy SELECT para anon + grant SELECT =====
select isnt(
  (select count(*)::int from pg_policies
     where tablename = 'aportes_ingesta_estado' and cmd = 'SELECT' and 'anon' = any(roles)),
  0, 'aportes_ingesta_estado tiene policy SELECT para anon (public-read)');
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = 'aportes_ingesta_estado' and grantee = 'anon' and privilege_type = 'SELECT'),
  1, 'anon tiene grant SELECT sobre aportes_ingesta_estado (public-read)');

-- == RPC: existe, security definer, anon tiene EXECUTE, public NO tiene EXECUTE =====
select has_function('public', 'aportes_de_parlamentario', ARRAY['text'],
  'funcion aportes_de_parlamentario(text) existe');
select is(
  (select p.prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'aportes_de_parlamentario'),
  true,
  'aportes_de_parlamentario es security definer');
select ok(
  has_function_privilege('anon', 'public.aportes_de_parlamentario(text)', 'execute'),
  'anon tiene EXECUTE sobre aportes_de_parlamentario');
select ok(
  not has_function_privilege('public', 'public.aportes_de_parlamentario(text)', 'execute'),
  'public NO tiene EXECUTE sobre aportes_de_parlamentario (revocado de public)');

-- == RPC body: ordena por eleccion + NUNCA proyecta el RUT del donante (Ley 21.719) =
select ok(
  pg_get_functiondef('public.aportes_de_parlamentario(text)'::regprocedure) ilike '%order by%eleccion%',
  'el cuerpo del RPC ordena por eleccion (agrupamiento por periodo de la ficha)');
select ok(
  pg_get_functiondef('public.aportes_de_parlamentario(text)'::regprocedure) not ilike '%rut_donante%',
  'el cuerpo del RPC NO proyecta rut_donante (Ley 21.719: el RUT del donante jamas sale al publico)');

select * from finish();
rollback;
