-- 0018_piso_pii.test.sql
-- Verifica el PISO de RLS deny-by-default para PII nueva creado por 0018 (LEGAL-03).
-- Corre via `psql -tA -f` (vs PROD aplicado) (pgTAP) CONTRA UNA MIGRACION APLICADA — build/typecheck
-- NO prueban que el DDL se aplico (falso positivo de CI, RESEARCH Pitfall 4).
-- Espeja el patron de 0004_parlamentario.test.sql.

begin;
select plan(11);

-- ── La tabla-exemplar de PII existe con su forma esperada ──────────────────────
select has_table('public', 'pii_contraparte_declaracion', 'tabla pii_contraparte_declaracion existe');
select has_column('public', 'pii_contraparte_declaracion', 'parlamentario_id', 'FK parlamentario_id presente (solo confirmado)');
select has_column('public', 'pii_contraparte_declaracion', 'rut_contraparte', 'rut_contraparte presente (uso interno)');
select has_column('public', 'pii_contraparte_declaracion', 'origen',          'origen presente (provenance)');
select has_column('public', 'pii_contraparte_declaracion', 'fecha_captura',   'fecha_captura presente (provenance)');
select has_column('public', 'pii_contraparte_declaracion', 'enlace',          'enlace presente (provenance)');

-- ── Provenance NOT NULL: una insercion sin `origen` revienta (NOT NULL) ────────
select throws_ok(
  $$ insert into pii_contraparte_declaracion (nombre_contraparte, tipo_dato, enlace)
     values ('Tercero X', 'patrimonio', 'http://x') $$,
  '23502',
  null,
  'origen NOT NULL: provenance obligatoria (no se admite PII sin fuente)'
);

-- ── RLS deny-by-default: RLS habilitada en la tabla PII nueva ──────────────────
select is(
  (select count(*)::int from pg_class
     where relname = 'pii_contraparte_declaracion'
       and relrowsecurity = true),
  1,
  'RLS enabled en pii_contraparte_declaracion'
);

-- ── Sin policies => deny-by-default efectivo (anon nunca lee la PII nueva) ──────
select is_empty(
  $$ select polname from pg_policy p
     join pg_class c on c.oid = p.polrelid
     where c.relname = 'pii_contraparte_declaracion' $$,
  'ninguna policy en pii_contraparte_declaracion (deny-by-default)'
);

-- ── Re-asercion del piso heredado: parlamentario sigue anon-denied tras 09-02 ──
-- Tras el backfill de RUT (09-02), parlamentario.rut DEBE seguir oculto a anon:
-- RLS habilitada + cero policies (deny-by-default), igual que en 0004/0005.
select is(
  (select count(*)::int from pg_class
     where relname = 'parlamentario' and relrowsecurity = true),
  1,
  'parlamentario sigue RLS-enabled tras el backfill de RUT (09-02)'
);
select is_empty(
  $$ select polname from pg_policy p
     join pg_class c on c.oid = p.polrelid
     where c.relname = 'parlamentario' $$,
  'parlamentario sin policies (rut sigue anon-denied, deny-by-default)'
);

select * from finish();
rollback;
