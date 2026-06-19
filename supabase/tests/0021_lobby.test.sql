-- 0021_lobby.test.sql
-- Verifica la migración 0021 (INT Lobby) CONTRA UN SCHEMA APLICADO:
--   * las tres tablas existen con RLS habilitada,
--   * `lobby_contraparte` es DENY-BY-DEFAULT (cero policies + sin grant SELECT a anon),
--   * `lobby_audiencia` es PUBLIC-READ (policy SELECT para anon + grant SELECT a anon),
--   * provenance NOT NULL en audiencia y contraparte (origen + enlace),
--   * la contraparte NO tiene FK a `parlamentario` (su única FK saliente es a lobby_audiencia),
--   * el FK del sujeto pasivo es nullable,
--   * el RPC `lobby_de_parlamentario(text)` existe, es SECURITY DEFINER y anon tiene EXECUTE.
-- Corre vía `supabase test db` (pgTAP). build/typecheck NO prueban que el DDL se aplicó
-- (falso positivo de CI, Pitfall 5). Espeja 0018_piso_pii.test.sql + 0020_parlamentario_publico.test.sql.

begin;
select plan(18);

-- ── Las tres tablas existen ────────────────────────────────────────────────────
select has_table('public', 'lobby_audiencia',       'tabla lobby_audiencia existe');
select has_table('public', 'lobby_contraparte',     'tabla lobby_contraparte existe');
select has_table('public', 'lobby_ingesta_estado',  'tabla lobby_ingesta_estado existe');

-- ── RLS habilitada en las tres ─────────────────────────────────────────────────
select is(
  (select count(*)::int from pg_class
     where relname = 'lobby_audiencia' and relrowsecurity = true),
  1, 'RLS enabled en lobby_audiencia');
select is(
  (select count(*)::int from pg_class
     where relname = 'lobby_contraparte' and relrowsecurity = true),
  1, 'RLS enabled en lobby_contraparte');
select is(
  (select count(*)::int from pg_class
     where relname = 'lobby_ingesta_estado' and relrowsecurity = true),
  1, 'RLS enabled en lobby_ingesta_estado');

-- ── lobby_contraparte DENY-BY-DEFAULT: cero policies + sin grant SELECT a anon ──
select is(
  (select count(*)::int from pg_policies where tablename = 'lobby_contraparte'),
  0, 'lobby_contraparte sin policies (deny-by-default, espejo 0018)');
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = 'lobby_contraparte' and grantee = 'anon' and privilege_type = 'SELECT'),
  0, 'anon NO tiene grant SELECT sobre lobby_contraparte (tercero privado, Ley 21.719)');

-- ── lobby_audiencia PUBLIC-READ: policy SELECT para anon + grant SELECT a anon ──
select isnt(
  (select count(*)::int from pg_policies
     where tablename = 'lobby_audiencia' and cmd = 'SELECT' and 'anon' = any(roles)),
  0, 'lobby_audiencia tiene policy SELECT para anon (public-read)');
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = 'lobby_audiencia' and grantee = 'anon' and privilege_type = 'SELECT'),
  1, 'anon tiene grant SELECT sobre lobby_audiencia (public-read)');

-- ── Provenance NOT NULL (FND-08) ───────────────────────────────────────────────
select col_not_null('public', 'lobby_audiencia',   'origen', 'lobby_audiencia.origen NOT NULL (provenance)');
select col_not_null('public', 'lobby_audiencia',   'enlace', 'lobby_audiencia.enlace NOT NULL (provenance)');
select col_not_null('public', 'lobby_contraparte', 'origen', 'lobby_contraparte.origen NOT NULL (provenance)');
select col_not_null('public', 'lobby_contraparte', 'enlace', 'lobby_contraparte.enlace NOT NULL (provenance)');

-- ── Sin FK de contraparte a parlamentario (Pitfall 4: tercero nunca enlazado a persona) ─
-- La única FK saliente de lobby_contraparte apunta a lobby_audiencia; NINGUNA a parlamentario.
select is(
  (select count(*)::int
     from pg_constraint con
     join pg_class src on src.oid = con.conrelid
     join pg_class tgt on tgt.oid = con.confrelid
    where con.contype = 'f'
      and src.relname = 'lobby_contraparte'
      and tgt.relname = 'parlamentario'),
  0, 'lobby_contraparte NO tiene FK a parlamentario (contraparte nunca se enlaza a persona)');

-- ── FK del sujeto pasivo nullable (la columna admite NULL) ──────────────────────
select col_is_null('public', 'lobby_audiencia', 'parlamentario_id',
  'lobby_audiencia.parlamentario_id es nullable (FK solo si confirmado)');

-- ── RPC lobby_de_parlamentario: existe, security definer, anon tiene EXECUTE ────
select has_function('public', 'lobby_de_parlamentario', ARRAY['text'],
  'función lobby_de_parlamentario(text) existe');
select is(
  (select p.prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'lobby_de_parlamentario'),
  true,
  'lobby_de_parlamentario es security definer (lee la sub-maestra deny-by-default sin abrirla a anon)');
select ok(
  has_function_privilege('anon', 'public.lobby_de_parlamentario(text)', 'execute'),
  'anon tiene EXECUTE sobre lobby_de_parlamentario');

select * from finish();
rollback;
