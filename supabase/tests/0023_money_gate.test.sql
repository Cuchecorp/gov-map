-- 0023_money_gate.test.sql
-- Re-afirma el PISO de RLS deny-by-default (candado A del gate de exposición MONEY,
-- LEGAL-01) sobre la tabla-exemplar de PII existente `pii_contraparte_declaracion`
-- (creada en 0018). Phase 13 NO introduce DDL MONEY (eso es Phase 14, packages/dinero):
-- este test CODIFICA EL CONTRATO que toda tabla `money_*` de Phases 14-16 debe
-- satisfacer al nacer — RLS habilitada + cero policies + `anon` SIN grant SELECT
-- (revoke de default privileges, lección Phase 11) — per RESEARCH Pattern 1.
-- Corre vía `supabase test db` (pgTAP) CONTRA UNA MIGRACION APLICADA — build/typecheck
-- NO prueban que el DDL se aplicó (falso positivo de CI, RESEARCH Pitfall 4).
-- Espeja el patrón de 0018_piso_pii.test.sql + el refuerzo de revoke de 0022_probidad.test.sql.

begin;
select plan(3);

-- ── Candado A.1: RLS habilitada en la tabla-exemplar de tercero privado ────────
select is(
  (select count(*)::int from pg_class
     where relname = 'pii_contraparte_declaracion'
       and relrowsecurity = true),
  1,
  'RLS enabled en pii_contraparte_declaracion (candado A — contrato que money_* hereda)'
);

-- ── Candado A.2: sin policies => deny-by-default efectivo (anon nunca lee) ──────
select is_empty(
  $$ select polname from pg_policy p
     join pg_class c on c.oid = p.polrelid
     where c.relname = 'pii_contraparte_declaracion' $$,
  'ninguna policy en pii_contraparte_declaracion (deny-by-default — contrato MONEY)'
);

-- ── Candado A.3: anon SIN grant SELECT (revoke de default privileges) ──────────
-- Refuerzo de 0022_probidad.test.sql:59-62: el privilegio TAMPOCO existe (lección
-- Phase 11: Supabase concede SELECT a anon por default privileges en tablas nuevas
-- de public; el revoke lo cierra). Toda tabla money_* de 14-16 debe nacer así.
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = 'pii_contraparte_declaracion'
       and grantee = 'anon'
       and privilege_type = 'SELECT'),
  0,
  'anon SIN grant SELECT sobre pii_contraparte_declaracion (tercero privado, Ley 21.719 + revoke Phase 11)'
);

select * from finish();
rollback;
