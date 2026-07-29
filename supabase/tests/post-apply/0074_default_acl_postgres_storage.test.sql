-- 0074_default_acl_postgres_storage.test.sql   (POST-APPLY ONLY)
--
-- Verifica OFF-6-04 (Phase 123, eje 6, query de origen Q-10 + contexto Q-20/Q-21)
-- contra el SCHEMA APLICADO, nunca contra el archivo de migracion.
--
-- POST-APPLY ONLY: vive fuera del glob de la suite regular (`supabase/tests/*.test.sql`)
-- a proposito — pre-apply sus aserciones son las OPUESTAS al estado real y darian rojo.
-- Se corre A MANO, DESPUES de aplicar 0074:
--
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA \
--     -f supabase/tests/post-apply/0074_default_acl_postgres_storage.test.sql
--
-- (`$SUPABASE_DB_URL` se usa por NOMBRE; su valor jamas se ecoa ni se transcribe.)
--
-- Debe reportar 4 ok, 0 not ok.
--
-- plan(4):
--   (A) 0 entradas con grantee `anon`          en el default ACL postgres/storage
--   (B) 0 entradas con grantee `authenticated` en el mismo default ACL
--   (C) DENOMINADOR EXPLICITO (anti-cero-vacuo): la fila de `pg_default_acl` SIGUE
--       existiendo con `postgres` y `service_role` como grantees. Un cero por
--       desaparicion de la fila NO es el mismo cero que un cero por revoke.
--   (D) NO-REGRESION DEL CONTEXTO: `storage.buckets` sigue en 0 (Q-20). Esta
--       migracion no crea buckets; si alguien creo uno, el hecho sale a la luz aqui.
--
-- Fuente autoritativa en A/B/C: `aclexplode(d.defaclacl)` + `grantee::regrole::text`.
-- NO se usa `like` sobre el texto del ACL.
--
-- Read-only: envuelto en begin/rollback, no muta nada.

begin;
select plan(4);


-- ═══════════════════════════════════════════════════════════════════════════════
-- (A) El defecto exacto de Q-10 (fila postgres|storage), lado `anon` → 0
-- ═══════════════════════════════════════════════════════════════════════════════
select is(
  (select count(*)::int
   from pg_default_acl d,
        aclexplode(d.defaclacl) a
   where d.defaclrole      = (select oid from pg_roles     where rolname = 'postgres')
     and d.defaclnamespace = (select oid from pg_namespace where nspname = 'storage')
     and a.grantee::regrole::text = 'anon'),
  0,
  '(A) OFF-6-04: cero entradas con grantee anon en el default ACL de postgres sobre storage'
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- (B) El defecto exacto de Q-10, lado `authenticated` → 0
-- ═══════════════════════════════════════════════════════════════════════════════
select is(
  (select count(*)::int
   from pg_default_acl d,
        aclexplode(d.defaclacl) a
   where d.defaclrole      = (select oid from pg_roles     where rolname = 'postgres')
     and d.defaclnamespace = (select oid from pg_namespace where nspname = 'storage')
     and a.grantee::regrole::text = 'authenticated'),
  0,
  '(B) OFF-6-04: cero entradas con grantee authenticated en el default ACL de postgres sobre storage'
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- (C) Denominador explicito: la fila sigue viva con los grantees legitimos.
--     Sin esto, (A) y (B) serian satisfechos por la DESAPARICION de la fila.
-- ═══════════════════════════════════════════════════════════════════════════════
select ok(
  (select count(distinct a.grantee::regrole::text)::int
   from pg_default_acl d,
        aclexplode(d.defaclacl) a
   where d.defaclrole      = (select oid from pg_roles     where rolname = 'postgres')
     and d.defaclnamespace = (select oid from pg_namespace where nspname = 'storage')
     and a.grantee::regrole::text in ('postgres', 'service_role')) = 2,
  '(C) denominador vivo: el default ACL de postgres sobre storage sigue existiendo con postgres y service_role como grantees (el cero de A/B es por revoke, no por desaparicion de la fila)'
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- (D) No-regresion del contexto (Q-20): 0 buckets. Esta migracion no crea ninguno;
--     crear uno es OP-3, acto de operador, y debe ocurrir DESPUES de este revoke.
-- ═══════════════════════════════════════════════════════════════════════════════
select is(
  (select count(*)::int from storage.buckets),
  0,
  '(D) no-regresion del contexto: storage.buckets sigue en 0 (Q-20); esta migracion no crea buckets'
);


select * from finish();
rollback;
