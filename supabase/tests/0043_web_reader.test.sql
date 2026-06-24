-- 0043_web_reader.test.sql
-- Verifica LOCKDOWN-01 (migración 0043) CONTRA UN SCHEMA APLICADO:
--   * el rol web_reader existe, es NOLOGIN y es miembro de authenticator,
--   * web_reader tiene SELECT sobre tablas public-read representativas,
--   * web_reader tiene EXECUTE sobre los RPCs curados (secdef=t y secdef=f),
--   * las 26 policies *_public_read_wr existen (verificación por conteo y muestra),
--   * web_reader NO tiene EXECUTE sobre resolver_entidad (nunca concedido: enumeración),
--   * web_reader NO tiene SELECT sobre tabla PII (parlamentario — gate 3),
--   * web_reader NO tiene SELECT sobre vista pgTAP (pg_all_foreign_keys — RLS-bypass),
--   * anon SIGUE teniendo sus grants (este script no revocó nada).
-- Corre vía: psql -tA -f supabase/tests/0043_web_reader.test.sql
-- Espeja 0040_cruces_rpc.test.sql y post-apply/0042_cruces_grant_anon.test.sql en estilo.
-- IMPORTANTE: no aplica a PROD solo; es checkpoint del operador (Task 3 del plan 42-01).

begin;
select plan(17);

-- ── 1. El rol web_reader existe ───────────────────────────────────────────────
select has_role('web_reader',
  'rol web_reader existe en pg_roles');

-- ── 2. web_reader es NOLOGIN ──────────────────────────────────────────────────
select ok(
  (select not rolcanlogin from pg_roles where rolname = 'web_reader'),
  'web_reader es NOLOGIN (no puede conectarse directamente)');

-- ── 3. authenticator es miembro de web_reader ─────────────────────────────────
-- Necesario para que PostgREST haga SET ROLE web_reader con JWT role=web_reader.
select ok(
  (select pg_has_role('authenticator', 'web_reader', 'member')),
  'authenticator es miembro de web_reader (PostgREST puede SET ROLE web_reader)');

-- ── 4. web_reader tiene SELECT sobre proyecto (tabla public-read) ─────────────
select ok(
  has_table_privilege('web_reader', 'public.proyecto', 'select'),
  'web_reader tiene SELECT sobre proyecto');

-- ── 5. web_reader tiene SELECT sobre votacion (tabla public-read) ─────────────
select ok(
  has_table_privilege('web_reader', 'public.votacion', 'select'),
  'web_reader tiene SELECT sobre votacion');

-- ── 6. web_reader tiene SELECT sobre declaracion (tabla public-read) ──────────
select ok(
  has_table_privilege('web_reader', 'public.declaracion', 'select'),
  'web_reader tiene SELECT sobre declaracion');

-- ── 7. web_reader tiene SELECT sobre proyecto_embedding (pgvector) ────────────
select ok(
  has_table_privilege('web_reader', 'public.proyecto_embedding', 'select'),
  'web_reader tiene SELECT sobre proyecto_embedding (necesario para match_proyectos secdef=f)');

-- ── 8. web_reader tiene EXECUTE sobre parlamentario_publico (secdef=t) ─────────
select ok(
  has_function_privilege('web_reader', 'public.parlamentario_publico(text)', 'execute'),
  'web_reader tiene EXECUTE sobre parlamentario_publico(text) (secdef=t)');

-- ── 9. web_reader tiene EXECUTE sobre match_proyectos 4 args (secdef=f) ────────
-- Firma exacta de 4 argumentos (RESEARCH §1). secdef=f: corre como caller
-- (web_reader) → necesita SELECT en proyecto_embedding (concedido en §4 arriba)
-- y EXECUTE en operadores pgvector (<=>, cosine_distance) — cubiertos por PUBLIC
-- (acl =X/supabase_admin en PROD → cualquier rol puede ejecutarlos).
select ok(
  has_function_privilege('web_reader', 'public.match_proyectos(vector, integer, double precision, text)', 'execute'),
  'web_reader tiene EXECUTE sobre match_proyectos(vector,integer,double precision,text) (secdef=f, 4 args)');

-- ── 10. web_reader tiene EXECUTE sobre cruces_de_parlamentario (secdef=t) ──────
select ok(
  has_function_privilege('web_reader', 'public.cruces_de_parlamentario(text)', 'execute'),
  'web_reader tiene EXECUTE sobre cruces_de_parlamentario(text) (secdef=t)');

-- ── 11. NEGATIVO: web_reader NO tiene EXECUTE sobre resolver_entidad ────────────
-- Con grants enumerados, resolver_entidad nunca se concede (no es necesario revocar).
-- FACTS: anon=false para resolver_entidad (admin-only via service_role).
-- Verifica que el set enumerado es subconjunto estricto de anon.
select ok(
  not has_function_privilege('web_reader', 'public.resolver_entidad(text)', 'execute'),
  'web_reader NO tiene EXECUTE sobre resolver_entidad(text) (nunca concedido, espejo anon=false)');

-- ── 12. NEGATIVO: web_reader NO tiene SELECT sobre parlamentario (tabla PII) ────
-- parlamentario tiene rut y datos raw; NO tiene policy public_read → 0 filas para anon.
-- El set enumerado de web_reader excluye explícitamente esta tabla (gate 3).
select ok(
  not has_table_privilege('web_reader', 'public.parlamentario', 'select'),
  'web_reader NO tiene SELECT sobre public.parlamentario (tabla PII, gate 3)');

-- ── 13. NEGATIVO: web_reader NO tiene SELECT sobre pg_all_foreign_keys (vista) ──
-- pg_all_foreign_keys es una vista pgTAP (relkind=v). Vistas no tienen RLS →
-- SELECT sobre ellas bypassea el piso PII. ON ALL TABLES habría concedido esto;
-- el set enumerado no lo incluye (viola gate 3).
select ok(
  not has_table_privilege('web_reader', 'public.pg_all_foreign_keys', 'select'),
  'web_reader NO tiene SELECT sobre public.pg_all_foreign_keys (vista pgTAP, RLS-bypass)');

-- ── 14. policy proyecto_public_read_wr existe ─────────────────────────────────
select ok(
  exists (
    select 1 from pg_policy pol
      join pg_class c on c.oid = pol.polrelid
      join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'proyecto'
      and pol.polname = 'proyecto_public_read_wr'
  ),
  'policy proyecto_public_read_wr existe en tabla proyecto');

-- ── 15. policy voto_public_read_wr existe ────────────────────────────────────
select ok(
  exists (
    select 1 from pg_policy pol
      join pg_class c on c.oid = pol.polrelid
      join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'voto'
      and pol.polname = 'voto_public_read_wr'
  ),
  'policy voto_public_read_wr existe en tabla voto');

-- ── 16. Conteo: exactamente 26 policies *_public_read_wr en schema public ──────
-- El 26 es el inventario auditado de _FACTS-live-prod.md (2026-06-24).
select is(
  (select count(*)::int from pg_policy pol
     join pg_class c on c.oid = pol.polrelid
     join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and pol.polname like '%_public_read_wr'),
  26,
  'hay exactamente 26 policies *_public_read_wr (espejo de las 26 _public_read de anon)');

-- ── 17. REGRESIÓN ANON: anon SIGUE con EXECUTE sobre parlamentario_publico ──────
-- 0043 no revoca nada de anon. Ventana segura: ambos roles leen idéntico.
select ok(
  has_function_privilege('anon', 'public.parlamentario_publico(text)', 'execute'),
  'anon SIGUE con EXECUTE sobre parlamentario_publico(text) (0043 no revocó nada de anon)');

select * from finish();
rollback;
