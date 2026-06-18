-- 0005_revision_identidad.test.sql
-- Verifica el estado durable de identidad creado por la migracion 0006:
--   vinculo_identidad (ID-06) + revision_identidad (ID-05) + identidad_audit (ID-08).
-- Corre via `supabase test db` (pgTAP). Espeja el patron de 0004_parlamentario.test.sql.
-- El corazon: la INMUTABILIDAD de identidad_audit (Pitfall 4) probada con throws_ok
-- sobre UPDATE y DELETE — pgTAP corre como superuser local (peor caso): si el trigger
-- bloquea aqui, bloquea al service role.

begin;
select plan(33);

-- == Las tres tablas existen ==
select has_table('public', 'vinculo_identidad',  'tabla vinculo_identidad existe');
select has_table('public', 'revision_identidad', 'tabla revision_identidad existe');
select has_table('public', 'identidad_audit',    'tabla identidad_audit existe');

-- == Columnas criticas de vinculo_identidad ==
select has_column('public', 'vinculo_identidad', 'mencion_normalizada', 'vinculo_identidad.mencion_normalizada presente');
select has_column('public', 'vinculo_identidad', 'parlamentario_id',    'vinculo_identidad.parlamentario_id presente');
select has_column('public', 'vinculo_identidad', 'estado',              'vinculo_identidad.estado presente');
select has_column('public', 'vinculo_identidad', 'metodo',              'vinculo_identidad.metodo presente');

-- == Columnas criticas de revision_identidad ==
select has_column('public', 'revision_identidad', 'candidatos',     'revision_identidad.candidatos presente');
select has_column('public', 'revision_identidad', 'salida_modelo',  'revision_identidad.salida_modelo presente');
select has_column('public', 'revision_identidad', 'estado',         'revision_identidad.estado presente');
select has_column('public', 'revision_identidad', 'revisor_id',     'revision_identidad.revisor_id presente');
select has_column('public', 'revision_identidad', 'created_at',     'revision_identidad.created_at presente');
select has_column('public', 'revision_identidad', 'resolved_at',    'revision_identidad.resolved_at presente');

-- == Columnas criticas de identidad_audit ==
select has_column('public', 'identidad_audit', 'metodo',         'identidad_audit.metodo presente');
select has_column('public', 'identidad_audit', 'decision',       'identidad_audit.decision presente');
select has_column('public', 'identidad_audit', 'confidence',     'identidad_audit.confidence presente');
select has_column('public', 'identidad_audit', 'modelo_version', 'identidad_audit.modelo_version presente');
select has_column('public', 'identidad_audit', 'revisor_id',     'identidad_audit.revisor_id presente');
select has_column('public', 'identidad_audit', 'evidence',       'identidad_audit.evidence presente');
select has_column('public', 'identidad_audit', 'conflicts',      'identidad_audit.conflicts presente');
select has_column('public', 'identidad_audit', 'created_at',     'identidad_audit.created_at presente');

-- == Defaults: estado de vinculo (no_confirmado, ID-06) y de revision (pendiente, ID-05) ==
select col_default_is('public', 'vinculo_identidad', 'estado', 'no_confirmado',
  'vinculo_identidad.estado default no_confirmado (nada auto-confirmado)');
select col_default_is('public', 'revision_identidad', 'estado', 'pendiente',
  'revision_identidad.estado default pendiente (cola arranca sin resolver)');

-- == Checks de dominio (T-04-07): estado de vinculo y metodo de audit invalidos revientan ==
select throws_ok(
  $$ insert into vinculo_identidad
       (mencion_nombre, mencion_normalizada, camara, periodo, estado, metodo, origen, enlace)
     values ('Walker', 'walker', 'senado', '2022-2026', 'xxx', 'llm', 'test', 'http://x') $$,
  '23514',
  null,
  'estado invalido en vinculo_identidad viola el check constraint'
);
select throws_ok(
  $$ insert into identidad_audit (metodo, decision)
     values ('telepatia', 'match') $$,
  '23514',
  null,
  'metodo invalido en identidad_audit viola el check constraint'
);

-- == Append es legal: un INSERT valido en identidad_audit vive ==
select lives_ok(
  $$ insert into identidad_audit (metodo, decision, confidence, modelo_version)
     values ('llm', 'match', 0.95, 'MiniMax-M3') $$,
  'INSERT valido en identidad_audit (append es legal)'
);

-- == INMUTABILIDAD (ID-08, Pitfall 4): el trigger hace fallar UPDATE y DELETE ==
-- Sembramos una fila conocida para atacarla.
select lives_ok(
  $$ insert into identidad_audit (id, metodo, decision)
     overriding system value values (999001, 'humano', 'confirmado') $$,
  'fila de audit sembrada para probar inmutabilidad'
);
select throws_ok(
  $$ update identidad_audit set decision = 'rechazado' where id = 999001 $$,
  '23001',
  null,
  'UPDATE sobre identidad_audit LANZA (trigger append-only)'
);
select throws_ok(
  $$ delete from identidad_audit where id = 999001 $$,
  '23001',
  null,
  'DELETE sobre identidad_audit LANZA (trigger append-only)'
);

-- El trigger de inmutabilidad existe.
select has_trigger('public', 'identidad_audit', 'identidad_audit_immutable',
  'trigger identidad_audit_immutable definido');

-- REVOKE (defensa en profundidad): update/delete NO estan en los grants de PUBLIC.
select is_empty(
  $$ select privilege_type from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'identidad_audit'
       and grantee = 'PUBLIC' and privilege_type in ('UPDATE', 'DELETE') $$,
  'PUBLIC no tiene UPDATE/DELETE sobre identidad_audit (REVOKE aplicado)'
);

-- == RLS deny-by-default en las TRES tablas (T-04-06) ==
select is(
  (select count(*)::int from pg_class
     where relname in ('vinculo_identidad', 'revision_identidad', 'identidad_audit')
       and relrowsecurity = true),
  3,
  'RLS enabled en vinculo_identidad/revision_identidad/identidad_audit'
);
select is_empty(
  $$ select polname from pg_policy p
     join pg_class c on c.oid = p.polrelid
     where c.relname in ('vinculo_identidad', 'revision_identidad', 'identidad_audit') $$,
  'ninguna policy definida en las tres tablas (deny-by-default)'
);

select * from finish();
rollback;
