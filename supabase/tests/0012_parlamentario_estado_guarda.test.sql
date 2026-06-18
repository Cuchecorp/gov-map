-- 0012_parlamentario_estado_guarda.test.sql
-- Verifica la guarda anti-regresión de `parlamentario.estado` (migración 0012, #2):
--   (a) un UPDATE que degrada un 'confirmado' a 'no_confirmado'/'probable' NO degrada:
--       la fila conserva 'confirmado' (coerción silenciosa, NO lanza → el lote no aborta).
--   (b) la promoción a 'confirmado' (no_confirmado→confirmado) VIVE.
--   (c) cambios sobre filas no-confirmadas pasan intactos.
-- pgTAP corre como superuser local (peor caso): si el trigger coacciona aquí, coacciona
-- también al service role que BYPASSA RLS.

begin;
select plan(6);

select has_trigger('public', 'parlamentario', 'parlamentario_estado_no_regresa',
  'trigger parlamentario_estado_no_regresa definido');

-- Sembramos un parlamentario YA confirmado.
insert into parlamentario (id, nombre_normalizado, nombres, apellido_paterno, apellido_materno,
                           camara, periodo, estado, origen, enlace)
  values ('P0C001', 'estado guard uno', 'Uno', 'Estado', 'Guard', 'senado', 'guard-2026',
          'confirmado', 'test', 'http://x');

-- (a) El upsert masivo intenta degradar a 'no_confirmado' → se preserva 'confirmado'.
select lives_ok(
  $$ update parlamentario set estado = 'no_confirmado' where id = 'P0C001' $$,
  'UPDATE degradante NO aborta (coerción silenciosa, no RAISE)'
);
select is(
  (select estado from parlamentario where id = 'P0C001'),
  'confirmado',
  'la confirmación previa se PRESERVA frente al upsert masivo (#2)'
);
-- Tampoco a 'probable'.
update parlamentario set estado = 'probable' where id = 'P0C001';
select is(
  (select estado from parlamentario where id = 'P0C001'),
  'confirmado',
  'degradar a probable tampoco pisa la confirmación'
);

-- (b) Promoción legítima: una fila no_confirmada → confirmado VIVE y persiste.
insert into parlamentario (id, nombre_normalizado, nombres, apellido_paterno, apellido_materno,
                           camara, periodo, estado, origen, enlace)
  values ('P0C002', 'estado guard dos', 'Dos', 'Estado', 'Guard', 'senado', 'guard-2026',
          'no_confirmado', 'test', 'http://x');
update parlamentario set estado = 'confirmado' where id = 'P0C002';
select is(
  (select estado from parlamentario where id = 'P0C002'),
  'confirmado',
  'la promoción no_confirmado→confirmado VIVE (promoteToConfirmado)'
);

-- (c) Cambio sobre fila no-confirmada pasa intacto (no_confirmado→probable).
update parlamentario set estado = 'probable' where id = 'P0C002' and false; -- no-op guard
insert into parlamentario (id, nombre_normalizado, nombres, apellido_paterno, apellido_materno,
                           camara, periodo, estado, origen, enlace)
  values ('P0C003', 'estado guard tres', 'Tres', 'Estado', 'Guard', 'senado', 'guard-2026',
          'no_confirmado', 'test', 'http://x');
update parlamentario set estado = 'probable' where id = 'P0C003';
select is(
  (select estado from parlamentario where id = 'P0C003'),
  'probable',
  'cambios sobre filas no-confirmadas pasan intactos'
);

select * from finish();
rollback;
