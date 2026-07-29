-- 0075_revoke_net_roles_publicos.test.sql   (POST-APPLY ONLY)
--
-- Verifica OFF-6-03 (Phase 123, eje 6, queries de origen Q-22 / Q-22b / Q-24b) contra
-- el SCHEMA APLICADO, nunca contra el archivo de migracion.
--
-- POST-APPLY ONLY: vive fuera del glob de la suite regular (`supabase/tests/*.test.sql`)
-- a proposito — pre-apply sus aserciones son las OPUESTAS al estado real y darian rojo.
-- Se corre A MANO, DESPUES de aplicar 0075:
--
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA \
--     -f supabase/tests/post-apply/0075_revoke_net_roles_publicos.test.sql
--
-- (`$SUPABASE_DB_URL` se usa por NOMBRE; su valor jamas se ecoa ni se transcribe.)
--
-- Debe reportar 6 ok, 0 not ok.
--
-- plan(6):
--   (A) has_schema_privilege('anon','net','USAGE')          = false
--   (B) has_schema_privilege('authenticated','net','USAGE') = false
--   (C) CERO FUERTE CON DENOMINADOR: 0 funciones de `net` con EXECUTE para `anon`
--       **y** el total de funciones de `net` sigue siendo 12 (enumeracion viva
--       2026-07-29, coincide con el audit). Un cero sobre cero objetos seria vacuo.
--   (D) idem para `authenticated` = 0, con el mismo denominador.
--   (E) LAS DOS QUE EL GATE VERIFICO, nombradas con su firma exacta:
--       net.http_get(text,jsonb,jsonb,integer) y
--       net.http_post(text,jsonb,jsonb,jsonb,integer) -> EXECUTE false para `anon`.
--   (F) NO-REGRESION DE LA INGESTA: `service_role` CONSERVA EXECUTE sobre
--       net.http_post. Un revoke que rompiera pg_cron no seria un fix.
--
-- Read-only: envuelto en begin/rollback, no muta nada.

begin;
select plan(6);


-- ═══════════════════════════════════════════════════════════════════════════════
-- (A) Q-22, lado anon -> false
-- ═══════════════════════════════════════════════════════════════════════════════
select ok(
  has_schema_privilege('anon', 'net', 'USAGE') = false,
  '(A) OFF-6-03: anon NO tiene USAGE sobre el esquema net (Q-22 lo hallo en true)'
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- (B) Q-22, lado authenticated -> false
-- ═══════════════════════════════════════════════════════════════════════════════
select ok(
  has_schema_privilege('authenticated', 'net', 'USAGE') = false,
  '(B) OFF-6-03: authenticated NO tiene USAGE sobre el esquema net'
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- (C) Cero FUERTE con denominador: 0 de 12 para anon
-- ═══════════════════════════════════════════════════════════════════════════════
select ok(
  (select count(*) filter (where has_function_privilege('anon', p.oid, 'EXECUTE')) = 0
      and count(*) = 12
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'net'),
  '(C) OFF-6-03: 0 funciones de net con EXECUTE para anon, sobre un denominador vivo de 12 funciones (cero fuerte, no vacuo)'
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- (D) Cero FUERTE con denominador: 0 de 12 para authenticated
-- ═══════════════════════════════════════════════════════════════════════════════
select ok(
  (select count(*) filter (where has_function_privilege('authenticated', p.oid, 'EXECUTE')) = 0
      and count(*) = 12
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'net'),
  '(D) OFF-6-03: 0 funciones de net con EXECUTE para authenticated, sobre un denominador vivo de 12 funciones'
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- (E) Las dos que el gate verifico, por nombre y firma exacta.
--     Esta es la cadena SSRF: lives_ok('select net.http_post(...)') via Data API.
-- ═══════════════════════════════════════════════════════════════════════════════
select ok(
  has_function_privilege('anon', 'net.http_get(text,jsonb,jsonb,integer)', 'EXECUTE') = false
  and has_function_privilege('anon', 'net.http_post(text,jsonb,jsonb,jsonb,integer)', 'EXECUTE') = false,
  '(E) OFF-6-03: anon NO puede ejecutar net.http_get ni net.http_post (las dos que el gate verifico) — cadena SSRF cortada en su origen'
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- (F) No-regresion de la ingesta: service_role conserva EXECUTE sobre net.http_post.
-- ═══════════════════════════════════════════════════════════════════════════════
select ok(
  has_function_privilege('service_role', 'net.http_post(text,jsonb,jsonb,jsonb,integer)', 'EXECUTE') = true,
  '(F) no-regresion: service_role CONSERVA EXECUTE sobre net.http_post (pg_cron/pg_net siguen operativos)'
);


select * from finish();
rollback;
