-- 0006_identidad_guardas.test.sql
-- Verifica las guardas de DB-tier que agrega la migracion 0007 (CR-01 del review F4):
--   (a) identidad_audit: UPDATE/DELETE/TRUNCATE TODOS lanzan (append-only real).
--   (b) vinculo_identidad: demotion silenciosa de un `confirmado` y reescritura de su
--       `parlamentario_id` lanzan; promocion por LLM y confirmacion sin persona lanzan.
--   (c) la transicion legitima de confirmacion humana (probable→confirmado, metodo
--       humano, con id) VIVE.
-- pgTAP corre como superuser local (peor caso): si el trigger bloquea aqui, bloquea al
-- service role que BYPASSA RLS. El trigger (no el REVOKE/RLS) es el control vinculante.

begin;
select plan(15);

-- Necesitamos un parlamentario real para las FKs de vinculo_identidad.
insert into parlamentario (id, nombre_normalizado, nombres, apellido_paterno, apellido_materno,
                           camara, periodo, origen, enlace)
  values ('P09001', 'guarda test uno', 'Uno', 'Guarda', 'Test', 'senado', 'guarda-2026', 'test', 'http://x'),
         ('P09002', 'guarda test dos', 'Dos', 'Guarda', 'Test', 'senado', 'guarda-2026', 'test', 'http://x');

-- ── (a) identidad_audit append-only: UPDATE / DELETE / TRUNCATE TODOS lanzan ──
select lives_ok(
  $$ insert into identidad_audit (id, metodo, decision)
     overriding system value values (888001, 'humano', 'confirmado') $$,
  'fila de audit sembrada'
);
select throws_ok(
  $$ update identidad_audit set decision = 'rechazado' where id = 888001 $$,
  '23001', null,
  'UPDATE sobre identidad_audit LANZA (trigger append-only)'
);
select throws_ok(
  $$ delete from identidad_audit where id = 888001 $$,
  '23001', null,
  'DELETE sobre identidad_audit LANZA (trigger append-only)'
);
-- NUEVO (CR-01.b): TRUNCATE tambien lanza (antes evadia el trigger de fila).
select throws_ok(
  $$ truncate identidad_audit $$,
  '23001', null,
  'TRUNCATE sobre identidad_audit LANZA (trigger statement-level)'
);
select has_trigger('public', 'identidad_audit', 'identidad_audit_no_truncate',
  'trigger identidad_audit_no_truncate definido (cubre TRUNCATE)');

-- ── (b) vinculo_identidad: guardas de la fila confirmado (CR-01.a) ──
-- Sembramos una fila YA confirmado, apuntando a P09001, por metodo humano.
select lives_ok(
  $$ insert into vinculo_identidad
       (id, mencion_nombre, mencion_normalizada, camara, periodo, parlamentario_id,
        estado, metodo, origen, enlace)
     overriding system value
     values (777001, 'Guarda Uno', 'guarda uno', 'senado', 'guarda-2026', 'P09001',
             'confirmado', 'humano', 'test', 'http://x') $$,
  'fila vinculo confirmado sembrada (humano, con persona)'
);

-- Demotion silenciosa confirmado→probable LANZA.
select throws_ok(
  $$ update vinculo_identidad set estado = 'probable' where id = 777001 $$,
  '23001', null,
  'demotion de un vinculo confirmado (confirmado->probable) LANZA'
);
-- Reescritura del parlamentario_id de un confirmado LANZA (reapuntar el hecho a otra persona).
select throws_ok(
  $$ update vinculo_identidad set parlamentario_id = 'P09002' where id = 777001 $$,
  '23001', null,
  'reescribir parlamentario_id de un vinculo confirmado LANZA'
);
-- Re-confirmar la MISMA persona (idempotencia del upsert humano) VIVE.
select lives_ok(
  $$ update vinculo_identidad set enlace = 'http://x/v2' where id = 777001 $$,
  'tocar columnas no-criticas de un confirmado (misma persona, mismo estado) VIVE (idempotencia)'
);

-- Promocion a confirmado por metodo='llm' LANZA (A4: el LLM nunca confirma).
select throws_ok(
  $$ insert into vinculo_identidad
       (mencion_nombre, mencion_normalizada, camara, periodo, parlamentario_id,
        estado, metodo, origen, enlace)
     values ('LLM Promueve', 'llm promueve', 'senado', 'guarda-2026', 'P09002',
             'confirmado', 'llm', 'test', 'http://x') $$,
  '23001', null,
  'INSERT confirmado por metodo=llm LANZA (solo humano/determinista confirman, A4)'
);
-- Confirmar sin persona (parlamentario_id null) LANZA (hecho publico sin persona).
select throws_ok(
  $$ insert into vinculo_identidad
       (mencion_nombre, mencion_normalizada, camara, periodo, parlamentario_id,
        estado, metodo, origen, enlace)
     values ('Sin Persona', 'sin persona', 'senado', 'guarda-2026', null,
             'confirmado', 'humano', 'test', 'http://x') $$,
  '23001', null,
  'INSERT confirmado sin parlamentario_id LANZA (hecho publico sin persona)'
);

-- ── (c) la transicion legitima de confirmacion humana VIVE ──
-- Sembramos un probable y lo promovemos a confirmado por humano con id real.
insert into vinculo_identidad
  (id, mencion_nombre, mencion_normalizada, camara, periodo, parlamentario_id,
   estado, metodo, origen, enlace)
  overriding system value
  values (777002, 'Promovible', 'promovible', 'senado', 'guarda-2026', 'P09001',
          'probable', 'llm', 'test', 'http://x');
select lives_ok(
  $$ update vinculo_identidad
       set estado = 'confirmado', metodo = 'humano'
     where id = 777002 $$,
  'transicion legitima probable->confirmado (humano, con persona) VIVE'
);

-- force RLS aplicado en vinculo_identidad (defensa en profundidad de lecturas).
select is(
  (select relforcerowsecurity from pg_class where relname = 'vinculo_identidad'),
  true,
  'vinculo_identidad tiene force row level security'
);

-- ── (d) WR-04: vocabulario cerrado de identidad_audit.decision ──
-- Un valor del vocabulario real VIVE; uno fuera de el (p.ej. 'match', el viejo doc) LANZA.
select lives_ok(
  $$ insert into identidad_audit (metodo, decision) values ('llm', 'revision') $$,
  'decision dentro del vocabulario (revision) VIVE'
);
select throws_ok(
  $$ insert into identidad_audit (metodo, decision) values ('llm', 'match') $$,
  '23514', null,
  'decision fuera del vocabulario (match) viola el CHECK de WR-04'
);

select * from finish();
rollback;
