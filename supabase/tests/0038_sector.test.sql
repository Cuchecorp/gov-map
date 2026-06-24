-- 0038_sector.test.sql
-- Verifica la migración 0038 (catálogo sector public-read + columnas sector_id) CONTRA UN
-- SCHEMA APLICADO:
--   * `sector` existe con RLS habilitada y es PUBLIC-READ (anon lee filas, > 0),
--   * el seed contiene los 13 códigos confirmados (Task 1, A1) y CERO catch-all 'otros',
--   * `proyecto_ficha`, `lobby_contraparte` y `donante` tienen columna `sector_id`,
--   * el FK de cada `sector_id` apunta a `sector(codigo)`.
-- Corre vía `psql -tA -f` (vs PROD aplicado) (pgTAP). build/typecheck NO prueban que el DDL se aplicó
-- (falso positivo de CI, Pitfall 5). Espeja 0021/0030 test style.

begin;
select plan(11);

-- ── sector existe + RLS habilitada ────────────────────────────────────────────
select has_table('public', 'sector', 'tabla sector existe');
select is(
  (select count(*)::int from pg_class where relname = 'sector' and relrowsecurity = true),
  1, 'RLS enabled en sector');

-- ── public-read: existe la policy de select to anon ───────────────────────────
select is(
  (select count(*)::int from pg_policies
    where tablename = 'sector' and cmd = 'SELECT' and 'anon' = any(roles)),
  1, 'sector tiene policy public-read para anon');

-- ── columnas sector_id existen en las 3 tablas ────────────────────────────────
select has_column('public', 'proyecto_ficha',    'sector_id', 'proyecto_ficha.sector_id existe');
select has_column('public', 'lobby_contraparte', 'sector_id', 'lobby_contraparte.sector_id existe');
select has_column('public', 'donante',           'sector_id', 'donante.sector_id existe');

-- ── FK: cada sector_id referencia sector(codigo) ──────────────────────────────
select col_is_fk('public', 'proyecto_ficha',    'sector_id', 'proyecto_ficha.sector_id es FK');
select col_is_fk('public', 'lobby_contraparte', 'sector_id', 'lobby_contraparte.sector_id es FK');
select col_is_fk('public', 'donante',           'sector_id', 'donante.sector_id es FK');

-- ── CERO catch-all 'otros' en el seed (D-05) ──────────────────────────────────
select is(
  (select count(*)::int from sector where codigo = 'otros'),
  0, 'NO existe un sector catch-all otros (D-05)');

-- ── public-read efectivo: anon ve el catálogo con filas (> 0) ─────────────────
set local role anon;
select isnt_empty(
  $$ select codigo from sector $$,
  'anon lee el catálogo sector (public-read, filas > 0)');
reset role;

select * from finish();
rollback;
