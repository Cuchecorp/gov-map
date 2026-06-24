-- 0043_web_reader.test.sql
-- Verifica LOCKDOWN-01 (migración 0043) CONTRA UN SCHEMA APLICADO:
--   * el rol web_reader existe, es NOLOGIN y es miembro de authenticator,
--   * web_reader tiene SELECT sobre tablas public-read representativas,
--   * web_reader tiene EXECUTE sobre los RPCs curados (secdef=t y secdef=f),
--   * las 26 policies *_public_read_wr existen (verificación por conteo y muestra),
--   * web_reader NO tiene EXECUTE sobre resolver_entidad (deny explícito, espejo anon),
--   * anon SIGUE teniendo sus grants (este script no revocó nada).
-- Corre vía: psql -tA -f 0043_web_reader.test.sql
-- Espeja 0040_cruces_rpc.test.sql y 0020_parlamentario_publico.test.sql en estilo.
-- IMPORTANTE: no aplica a PROD solo; es checkpoint del operador (CLAUDE.md).

begin;
select plan(14);

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

-- ── 6. web_reader tiene SELECT sobre proyecto_embedding (pgvector) ────────────
select ok(
  has_table_privilege('web_reader', 'public.proyecto_embedding', 'select'),
  'web_reader tiene SELECT sobre proyecto_embedding (necesario para match_proyectos secdef=f)');

-- ── 7. web_reader tiene EXECUTE sobre parlamentario_publico (secdef=t) ─────────
select ok(
  has_function_privilege('web_reader', 'public.parlamentario_publico(text)', 'execute'),
  'web_reader tiene EXECUTE sobre parlamentario_publico (secdef=t)');

-- ── 8. web_reader tiene EXECUTE sobre match_proyectos (secdef=f, pgvector) ─────
-- secdef=f: corre como caller (web_reader) → necesita SELECT en proyecto_embedding
-- y EXECUTE en operadores pgvector (<=>, cosine_distance, etc.) — cubiertos por
-- GRANT EXECUTE ON ALL ROUTINES.
select ok(
  has_function_privilege('web_reader', 'public.match_proyectos(vector, double precision, integer)', 'execute'),
  'web_reader tiene EXECUTE sobre match_proyectos (secdef=f, invoca pgvector como caller)');

-- ── 9. web_reader tiene EXECUTE sobre cruces_de_parlamentario (secdef=t) ───────
select ok(
  has_function_privilege('web_reader', 'public.cruces_de_parlamentario(text)', 'execute'),
  'web_reader tiene EXECUTE sobre cruces_de_parlamentario (secdef=t; anon también desde 0042)');

-- ── 10. web_reader NO tiene EXECUTE sobre resolver_entidad (espejo anon=false) ──
-- FACTS: anon NO tiene EXECUTE sobre resolver_entidad (admin-only via service_role).
-- La revocación explícita en 0043 preserva exactamente ese set.
select ok(
  not has_function_privilege('web_reader', 'public.resolver_entidad(text)', 'execute'),
  'web_reader NO tiene EXECUTE sobre resolver_entidad (deny explícito, espejo de anon=false)');

-- ── 11. policy proyecto_public_read_wr existe para web_reader ────────────────
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

-- ── 12. policy voto_public_read_wr existe para web_reader ────────────────────
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

-- ── 13. Conteo: exactamente 26 policies *_public_read_wr en schema public ──────
-- ⚠ VALIDADORES OPUS: si se añaden tablas al set público antes de aplicar 0043,
-- este número debe ajustarse. El 26 es el inventario de _FACTS-live-prod.md.
select is(
  (select count(*)::int from pg_policy pol
     join pg_class c on c.oid = pol.polrelid
     join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and pol.polname like '%_public_read_wr'),
  26,
  'hay exactamente 26 policies *_public_read_wr (espejo de las 26 _public_read de anon)');

-- ── 14. anon SIGUE teniendo EXECUTE sobre parlamentario_publico (0043 no revocó) ─
-- Guard de regresión: LOCKDOWN-01 no debe tocar los grants de anon.
select ok(
  has_function_privilege('anon', 'public.parlamentario_publico(text)', 'execute'),
  'anon SIGUE con EXECUTE sobre parlamentario_publico (0043 no revocó nada de anon)');

select * from finish();
rollback;
