-- 0035_vinculo_entidad.test.sql
-- Verifica el subsistema de vinculo + cola de terceros (migracion 0035, ENT-01/ENT-04):
--   (a) deny-by-default en vinculo_entidad y revision_entidad (anon sin SELECT).
--   (b) indice unico TOTAL vinculo_entidad_clave_natural (tipo_entidad, mencion_normalizada),
--       NO parcial (PostgREST onConflict lo necesita total — Pitfall 6).
--   (c) guarda RAISE: degradar un confirmado, reapuntar su entidad, promover por LLM,
--       confirmar sin entidad → LANZAN.
--   (d) Δ2: confirmar una juridica por metodo != determinista LANZA.
--   (e) transicion legitima (probable→confirmado, humano/determinista, con entidad) VIVE.
-- pgTAP corre como superuser local (peor caso): el trigger es el control vinculante.

begin;
select plan(18);

-- Entidades reales para las FKs.
insert into entidad_tercero (id, nombre_normalizado, tipo_entidad, origen, enlace)
  values ('E08001', 'guarda natural', 'natural',  'test', 'http://x'),
         ('E08002', 'guarda natural dos', 'natural', 'test', 'http://x'),
         ('E08003', 'guarda juridica', 'juridica', 'test', 'http://x');

-- ── (a) deny-by-default ──
select is(
  (select count(*)::int from pg_class
     where relname in ('vinculo_entidad', 'revision_entidad') and relrowsecurity = true),
  2, 'RLS enabled en vinculo_entidad/revision_entidad');
select is(
  (select count(*)::int from pg_policies
     where tablename in ('vinculo_entidad', 'revision_entidad')),
  0, 'sin policies en vinculo/revision (deny-by-default)');
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = 'vinculo_entidad' and grantee = 'anon' and privilege_type = 'SELECT'),
  0, 'anon NO tiene grant SELECT sobre vinculo_entidad');
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = 'revision_entidad' and grantee = 'anon' and privilege_type = 'SELECT'),
  0, 'anon NO tiene grant SELECT sobre revision_entidad');
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = 'vinculo_entidad' and grantee = 'anon' and privilege_type = 'INSERT'),
  0, 'anon NO tiene grant INSERT sobre vinculo_entidad');
select is(
  (select relforcerowsecurity from pg_class where relname = 'vinculo_entidad'),
  true, 'vinculo_entidad tiene force row level security');
select is(
  (select relforcerowsecurity from pg_class where relname = 'revision_entidad'),
  false, 'revision_entidad NAO tiene force row level security (asimetria intencional con vinculo_entidad)');

-- ── (b) indice unico TOTAL (no parcial) sobre la clave natural ──
select has_index('public', 'vinculo_entidad', 'vinculo_entidad_clave_natural',
  ARRAY['tipo_entidad', 'mencion_normalizada'],
  'indice vinculo_entidad_clave_natural sobre (tipo_entidad, mencion_normalizada)');
select is_empty(
  $$ select 1 from pg_index i
       join pg_class c on c.oid = i.indexrelid
      where c.relname = 'vinculo_entidad_clave_natural' and i.indpred is not null $$,
  'el indice de la clave natural es TOTAL (indpred null, NO parcial — Pitfall 6)');

-- ── (c) guardas RAISE del vinculo confirmado ──
insert into vinculo_entidad
  (id, mencion_nombre, mencion_normalizada, tipo_entidad, entidad_tercero_id,
   estado, metodo, origen, enlace)
  overriding system value
  values (700001, 'Guarda Uno', 'guarda uno', 'natural', 'E08001',
          'confirmado', 'humano', 'test', 'http://x');

select throws_ok(
  $$ update vinculo_entidad set estado = 'probable' where id = 700001 $$,
  '23001', null,
  'demotion de un vinculo confirmado (confirmado->probable) LANZA');
select throws_ok(
  $$ update vinculo_entidad set entidad_tercero_id = 'E08002' where id = 700001 $$,
  '23001', null,
  'reescribir entidad_tercero_id de un vinculo confirmado LANZA');
select lives_ok(
  $$ update vinculo_entidad set enlace = 'http://x/v2' where id = 700001 $$,
  'tocar columnas no-criticas de un confirmado (misma entidad) VIVE (idempotencia)');
select throws_ok(
  $$ insert into vinculo_entidad
       (mencion_nombre, mencion_normalizada, tipo_entidad, entidad_tercero_id,
        estado, metodo, origen, enlace)
     values ('LLM Promueve', 'llm promueve', 'natural', 'E08002',
             'confirmado', 'llm', 'test', 'http://x') $$,
  '23001', null,
  'INSERT confirmado por metodo=llm LANZA (solo humano/determinista confirman)');
select throws_ok(
  $$ insert into vinculo_entidad
       (mencion_nombre, mencion_normalizada, tipo_entidad, entidad_tercero_id,
        estado, metodo, origen, enlace)
     values ('Sin Entidad', 'sin entidad', 'natural', null,
             'confirmado', 'humano', 'test', 'http://x') $$,
  '23001', null,
  'INSERT confirmado sin entidad_tercero_id LANZA (hecho publico sin entidad)');

-- ── (d) Δ2: juridica solo se confirma por determinista ──
select throws_ok(
  $$ insert into vinculo_entidad
       (mencion_nombre, mencion_normalizada, tipo_entidad, entidad_tercero_id,
        estado, metodo, origen, enlace)
     values ('Empresa SA', 'empresa sa', 'juridica', 'E08003',
             'confirmado', 'humano', 'test', 'http://x') $$,
  '23001', null,
  'INSERT confirmado de juridica por metodo=humano LANZA (Δ2: juridica solo por RUT determinista)');
select lives_ok(
  $$ insert into vinculo_entidad
       (mencion_nombre, mencion_normalizada, tipo_entidad, entidad_tercero_id,
        estado, metodo, origen, enlace)
     values ('Empresa SA', 'empresa sa det', 'juridica', 'E08003',
             'confirmado', 'determinista', 'test', 'http://x') $$,
  'INSERT confirmado de juridica por metodo=determinista (RUT exacto) VIVE');

-- ── (e) transicion legitima probable→confirmado (humano, con entidad) VIVE ──
insert into vinculo_entidad
  (id, mencion_nombre, mencion_normalizada, tipo_entidad, entidad_tercero_id,
   estado, metodo, origen, enlace)
  overriding system value
  values (700002, 'Promovible', 'promovible', 'natural', 'E08001',
          'probable', 'llm', 'test', 'http://x');
select lives_ok(
  $$ update vinculo_entidad set estado = 'confirmado', metodo = 'humano' where id = 700002 $$,
  'transicion legitima probable->confirmado (humano, con entidad) VIVE');

-- ── defaults de la cola ──
insert into revision_entidad (id, mencion_nombre, mencion_normalizada, tipo_entidad)
  overriding system value
  values (700101, 'Cola Uno', 'cola uno', 'natural');
select is(
  (select estado from revision_entidad where id = 700101),
  'pendiente', 'revision_entidad.estado default pendiente');

select * from finish();
rollback;
