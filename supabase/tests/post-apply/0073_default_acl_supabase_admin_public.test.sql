-- 0073_default_acl_supabase_admin_public.test.sql   (POST-APPLY ONLY)
--
-- Verifica OFF-01 (Phase 123, eje 3, query de origen Q-10) contra el SCHEMA APLICADO,
-- nunca contra el archivo de migracion.
--
-- POST-APPLY ONLY: vive fuera del glob de la suite regular (`supabase/tests/*.test.sql`)
-- a proposito — pre-apply sus aserciones son las OPUESTAS al estado real y darian rojo.
-- Se corre A MANO, DESPUES de aplicar 0073:
--
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA \
--     -f supabase/tests/post-apply/0073_default_acl_supabase_admin_public.test.sql
--
-- (`$SUPABASE_DB_URL` se usa por NOMBRE; su valor jamas se ecoa ni se transcribe.)
--
-- Debe reportar 4 ok, 0 not ok.
--
-- plan(4):
--   (A) 0 entradas con grantee `anon`           en el default ACL supabase_admin/public
--   (B) 0 entradas con grantee `authenticated`  en el mismo default ACL
--   (C) DENOMINADOR EXPLICITO (anti-cero-vacuo, regla dura de 123): la fila de
--       `pg_default_acl` SIGUE existiendo con `postgres` y `service_role` como grantees.
--       Un cero por desaparicion de la fila NO es el mismo cero que un cero por revoke.
--   (D) NO-REGRESION DEL VECINO: el default ACL de `postgres` sobre `public` (huella viva
--       de 0044) sigue sin `anon` ni `authenticated`.
--
-- Fuente autoritativa en las 4: `aclexplode(d.defaclacl)` + `grantee::regrole::text`.
-- NO se usa `like` sobre el texto del ACL (confunde subcadenas y no distingue grantee).
--
-- Read-only: envuelto en begin/rollback, no muta nada.

begin;
select plan(4);


-- ═══════════════════════════════════════════════════════════════════════════════
-- (A) El defecto exacto de Q-10, lado `anon` → 0
-- ═══════════════════════════════════════════════════════════════════════════════
select is(
  (select count(*)::int
   from pg_default_acl d,
        aclexplode(d.defaclacl) a
   where d.defaclrole      = (select oid from pg_roles     where rolname = 'supabase_admin')
     and d.defaclnamespace = (select oid from pg_namespace where nspname = 'public')
     and a.grantee::regrole::text = 'anon'),
  0,
  '(A) OFF-01: cero entradas con grantee anon en el default ACL de supabase_admin sobre public'
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- (B) El defecto exacto de Q-10, lado `authenticated` → 0
-- ═══════════════════════════════════════════════════════════════════════════════
select is(
  (select count(*)::int
   from pg_default_acl d,
        aclexplode(d.defaclacl) a
   where d.defaclrole      = (select oid from pg_roles     where rolname = 'supabase_admin')
     and d.defaclnamespace = (select oid from pg_namespace where nspname = 'public')
     and a.grantee::regrole::text = 'authenticated'),
  0,
  '(B) OFF-01: cero entradas con grantee authenticated en el default ACL de supabase_admin sobre public'
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- (C) Denominador explicito: la fila sigue viva con los grantees legitimos.
--     Sin esto, (A) y (B) serian satisfechos por la DESAPARICION de la fila.
-- ═══════════════════════════════════════════════════════════════════════════════
select ok(
  (select count(distinct a.grantee::regrole::text)::int
   from pg_default_acl d,
        aclexplode(d.defaclacl) a
   where d.defaclrole      = (select oid from pg_roles     where rolname = 'supabase_admin')
     and d.defaclnamespace = (select oid from pg_namespace where nspname = 'public')
     and a.grantee::regrole::text in ('postgres', 'service_role')) = 2,
  '(C) denominador vivo: el default ACL de supabase_admin sobre public sigue existiendo con postgres y service_role como grantees (el cero de A/B es por revoke, no por desaparicion de la fila)'
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- (D) No-regresion del vecino: el default ACL de `postgres` sobre `public`
--     (huella viva de 0044) sigue cerrado a los roles publicos.
-- ═══════════════════════════════════════════════════════════════════════════════
select is(
  (select count(*)::int
   from pg_default_acl d,
        aclexplode(d.defaclacl) a
   where d.defaclrole      = (select oid from pg_roles     where rolname = 'postgres')
     and d.defaclnamespace = (select oid from pg_namespace where nspname = 'public')
     and a.grantee::regrole::text in ('anon', 'authenticated')),
  0,
  '(D) no-regresion: el default ACL de postgres sobre public (huella de 0044) sigue sin anon ni authenticated'
);


select * from finish();
rollback;
