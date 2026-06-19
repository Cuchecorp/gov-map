-- 0026_agregacion.test.sql
-- Verifica la migracion 0025_agregacion (MONEY Agregacion -- contratos/aportes por contraparte,
-- MONEY-05) CONTRA UN SCHEMA APLICADO:
--   * el RPC `agregado_por_contraparte(text)` existe, es SECURITY DEFINER, anon tiene EXECUTE,
--     y public NO tiene EXECUTE (revocado),
--   * el cuerpo del RPC FILTRA a persona juridica (nunca proyecta a una persona natural por nombre),
--   * el cuerpo del RPC NO proyecta `rut_donante` ni `donante_id` (Ley 21.719: el RUT/llave
--     sintetica del donante jamas sale al publico),
--   * el cuerpo del RPC NO referencia las columnas de nombre PII de las sub-maestras deny-by-default
--     (contratista.nombre / donante.nombre),
--   * `contrato` tiene ahora la columna `rut_proveedor` (reconciliacion O1 con el writer ya
--     desplegado en writer-supabase.ts:54),
--   * las sub-maestras `contratista` y `donante` SIGUEN deny-by-default tras 0025 (el candado de
--     la fase, leccion Phase 11 + CR-01 Phase 13): RLS enabled + CERO policies + anon SIN grant
--     SELECT (tres asserts por tabla).
-- Corre via `supabase test db` (pgTAP). build/typecheck NO prueban que el DDL se aplico
-- (falso positivo de CI, RESEARCH Pitfall 2). El apply remoto + esta corrida contra el schema
-- APLICADO es el checkpoint de operador. Espeja 0025_servel.test.sql + 0024_dinero.test.sql.
-- (El numero 0026 es el siguiente libre; 0025_servel.test.sql es el test mas alto existente.)

begin;
select plan(19);

-- == RPC: existe, security definer, anon tiene EXECUTE, public NO tiene EXECUTE =====
select has_function('public', 'agregado_por_contraparte', ARRAY['text'],
  'funcion agregado_por_contraparte(text) existe');
select is(
  (select p.prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'agregado_por_contraparte'),
  true,
  'agregado_por_contraparte es security definer');
select ok(
  has_function_privilege('anon', 'public.agregado_por_contraparte(text)', 'execute'),
  'anon tiene EXECUTE sobre agregado_por_contraparte');
select ok(
  not has_function_privilege('public', 'public.agregado_por_contraparte(text)', 'execute'),
  'public NO tiene EXECUTE sobre agregado_por_contraparte (revocado de public)');

-- == RPC body: FILTRA a juridica + NUNCA proyecta PII (Ley 21.719) ==================
-- El cuerpo filtra a tipo_persona juridica (solo empresas se exponen por nombre; una persona
-- natural privada jamas aparece por nombre). Y NO proyecta el RUT del donante, la llave
-- sintetica del donante, ni las columnas de nombre interno de las sub-maestras deny-by-default.
select ok(
  pg_get_functiondef('public.agregado_por_contraparte(text)'::regprocedure) ilike '%juridica%',
  'el cuerpo del RPC filtra a persona juridica (nunca a una persona natural por nombre)');
select ok(
  pg_get_functiondef('public.agregado_por_contraparte(text)'::regprocedure) not ilike '%rut_donante%',
  'el cuerpo del RPC NO proyecta rut_donante (Ley 21.719: el RUT del donante jamas sale al publico)');
select ok(
  pg_get_functiondef('public.agregado_por_contraparte(text)'::regprocedure) not ilike '%donante_id%',
  'el cuerpo del RPC NO proyecta donante_id (la llave sintetica del donante jamas sale al publico)');
select ok(
  pg_get_functiondef('public.agregado_por_contraparte(text)'::regprocedure) not ilike '%contratista.nombre%',
  'el cuerpo del RPC NO lee contratista.nombre (sub-maestra deny-by-default, PII potencial)');
select ok(
  pg_get_functiondef('public.agregado_por_contraparte(text)'::regprocedure) not ilike '%donante.nombre%',
  'el cuerpo del RPC NO lee donante.nombre (sub-maestra deny-by-default, PII sensible)');

-- == contrato tiene la columna rut_proveedor (reconciliacion O1 con el writer) ======
-- El writer ya desplegado (writer-supabase.ts:54) persiste contrato.rut_proveedor pero la
-- migracion 0023 omitio la columna; 0025 la reconcilia (sin tabla nueva) para que el RPC pueda
-- agrupar contratos por RUT del proveedor.
select is(
  (select count(*)::int from information_schema.columns
     where table_schema = 'public' and table_name = 'contrato' and column_name = 'rut_proveedor'),
  1, 'contrato tiene la columna rut_proveedor (reconciliacion O1 con el writer ya desplegado)');

-- == contratista SIGUE deny-by-default tras 0025 (el candado de la fase) ============
-- TRES asserts: RLS enabled + CERO policies + anon SIN grant SELECT. 0025 no debe haber aflojado
-- la sub-maestra (no agrega policy ni grant); espeja 0024_dinero.test.sql.
select is(
  (select count(*)::int from pg_class
     where relname = 'contratista' and relrowsecurity = true),
  1, 'RLS enabled en contratista (sigue deny-by-default tras 0025)');
select is(
  (select count(*)::int from pg_policies where tablename = 'contratista'),
  0, 'contratista sin policies (sigue deny-by-default tras 0025)');
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = 'contratista' and grantee = 'anon' and privilege_type = 'SELECT'),
  0, 'anon NO tiene grant SELECT sobre contratista (sigue deny-by-default tras 0025 -- RUT PII, Ley 21.719)');

-- == donante SIGUE deny-by-default tras 0025 (el candado de la fase) ================
-- TRES asserts: RLS enabled + CERO policies + anon SIN grant SELECT. Espeja 0025_servel.test.sql.
select is(
  (select count(*)::int from pg_class
     where relname = 'donante' and relrowsecurity = true),
  1, 'RLS enabled en donante (sigue deny-by-default tras 0025)');
select is(
  (select count(*)::int from pg_policies where tablename = 'donante'),
  0, 'donante sin policies (sigue deny-by-default tras 0025)');
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = 'donante' and grantee = 'anon' and privilege_type = 'SELECT'),
  0, 'anon NO tiene grant SELECT sobre donante (sigue deny-by-default tras 0025 -- PII sensible, Ley 21.719)');

-- == CR-01: garantia PII a NIVEL DE DATOS (no solo del cuerpo del RPC) ===============
-- El cuerpo filtra `tipo_persona = 'juridica'`; el writer SERVEL ahora NORMALIZA
-- "TIPO APORTANTE" al enum canonico 'juridica'|'natural' (parse-servel, CR-01). Sin esa
-- normalizacion el filtro NUNCA matchea labels como "Persona Juridica" y el carril muere.
-- Estos asserts insertan filas REALES y prueban el comportamiento, no la presencia del
-- literal en el texto SQL: una empresa juridica SE proyecta; una persona natural NO.
insert into public.aporte (fuente_id, fecha_corte, eleccion, donante_nombre, tipo_persona, origen, enlace)
values
  ('cr01-jur', current_date, 'DIPUTADO - DISTRITO 1 - 2025', 'Empresa Juridica SpA', 'juridica', 'servel', 'https://x'),
  ('cr01-nat', current_date, 'DIPUTADO - DISTRITO 1 - 2025', 'Perez P., Juan',        'natural',  'servel', 'https://x');

-- La empresa JURIDICA aparece (1 fila de faceta aporte para su donante_nombre).
select is(
  (select count(*)::int from public.agregado_por_contraparte('d:Empresa Juridica SpA') where facet = 'aporte'),
  1, 'CR-01: una contraparte juridica (tipo_persona = ''juridica'') SI se proyecta por el RPC');

-- La persona NATURAL NUNCA aparece (0 filas) -- garantia PII Ley 21.719, fail-closed.
select is(
  (select count(*)::int from public.agregado_por_contraparte('d:Perez P., Juan')),
  0, 'CR-01: una persona natural (tipo_persona = ''natural'') JAMAS se proyecta por el RPC');

-- El nombre de la persona natural NUNCA aparece en ningun payload del RPC (defensa data-level).
select ok(
  (select coalesce(string_agg(contraparte_nombre, '|'), '') from public.agregado_por_contraparte('d:Empresa Juridica SpA'))
    not like '%Perez P., Juan%',
  'CR-01: el nombre de la persona natural no se filtra a ningun payload del RPC');

select * from finish();
rollback;
