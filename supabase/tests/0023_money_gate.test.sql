-- 0023_money_gate.test.sql
-- RE-AFIRMA el PISO de RLS deny-by-default (candado A del gate de exposición MONEY,
-- LEGAL-01) sobre `lobby_contraparte` — la tabla-exemplar que GENUINAMENTE lleva el
-- `revoke all ... from anon, authenticated` (creada en 0021_lobby.sql:90-98). Phase 13
-- NO introduce DDL MONEY ni altera el contrato de tablas de 0018 (eso es Phase 14,
-- packages/dinero): este test NO codifica un contrato nuevo — re-afirma el piso heredado
-- (RLS habilitada + cero policies + revoke explícito del default privilege) sobre una
-- tabla que YA lo satisface. El contrato que toda tabla `money_*` de Phases 14-16 debe
-- heredar (nacer revocada) se ENFORZARÁ en los tests de migración de 14-16, no aquí.
-- El `revoke` se eligió como exemplar porque cierra el hueco de DEFAULT PRIVILEGES
-- (lección Phase 11: este proyecto Supabase concede SELECT a `anon` por default
-- privileges en cada tabla nueva de public; la RLS sin policy niega las FILAS, pero el
-- PRIVILEGIO sigue existiendo hasta que un `revoke` explícito lo quita).
-- Corre vía `supabase test db` (pgTAP) CONTRA UNA MIGRACION APLICADA — build/typecheck
-- NO prueban que el DDL se aplicó (falso positivo de CI, RESEARCH Pitfall 4).
-- Espeja el patrón de 0018_piso_pii.test.sql + el refuerzo de revoke de 0022_probidad.test.sql.

begin;
select plan(3);

-- ── Candado A.1: RLS habilitada en la tabla-exemplar deny-by-default ────────────
select is(
  (select count(*)::int from pg_class
     where relname = 'lobby_contraparte'
       and relrowsecurity = true),
  1,
  'RLS enabled en lobby_contraparte (candado A — piso deny-by-default que money_* hereda)'
);

-- ── Candado A.2: sin policies => deny-by-default efectivo (anon nunca lee) ──────
select is_empty(
  $$ select polname from pg_policy p
     join pg_class c on c.oid = p.polrelid
     where c.relname = 'lobby_contraparte' $$,
  'ninguna policy en lobby_contraparte (deny-by-default — piso que money_* hereda)'
);

-- ── Candado A.3: anon SIN grant SELECT (revoke de default privileges) ──────────
-- lobby_contraparte SÍ lleva el `revoke all ... from anon, authenticated`
-- (0021_lobby.sql:98): la RLS sin policy niega las FILAS, pero el PRIVILEGIO también
-- se revoca explícitamente (lección Phase 11: Supabase concede SELECT a anon por
-- default privileges en tablas nuevas de public). Toda tabla money_* de 14-16 debe
-- nacer así — revocada al crearse.
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = 'lobby_contraparte'
       and grantee = 'anon'
       and privilege_type = 'SELECT'),
  0,
  'anon SIN grant SELECT sobre lobby_contraparte (revoke explícito 0021:98 — piso que money_* hereda)'
);

select * from finish();
rollback;
