-- 0015_resolver_identidad.test.sql
-- Verifica el RPC transaccional `resolver_identidad` (migración 0015, #3):
--   (a) confirm: resuelve el caso a 'confirmado', PROMUEVE el vínculo (humano, a la
--       persona) y escribe el audit ENLAZADO al vínculo (WR-01) — todo atómico.
--   (b) atomicidad: re-resolver un caso que ya NO está pendiente LANZA (no_data_found)
--       y NO deja colaterales (rollback total de la transacción del RPC).
--   (c) reject: resuelve 'rechazado' SIN promover vínculo, con su audit.

begin;
select plan(12);

insert into parlamentario (id, nombre_normalizado, nombres, apellido_paterno, apellido_materno,
                           camara, periodo, origen, enlace)
  values ('P0R001', 'rpc resolver uno', 'Uno', 'Rpc', 'Resolver', 'senado', 'rpc-2026', 'test', 'http://x');

-- Caso pendiente para confirm.
insert into revision_identidad (id, mencion_nombre, mencion_normalizada, camara, periodo, estado, modelo_version)
  overriding system value
  values (900001, 'Rpc Uno', 'rpc uno', 'senado', 'rpc-2026', 'pendiente', 'minimax-mock');

-- (a) confirm → devuelve el id del vínculo (no null).
select isnt(
  (select resolver_identidad(900001, 'confirmado', 'ana', null, now(), true,
    jsonb_build_object('mencion_nombre', 'Rpc Uno', 'mencion_normalizada', 'rpc uno',
      'camara', 'senado', 'periodo', 'rpc-2026', 'parlamentario_id', 'P0R001',
      'estado', 'confirmado', 'metodo', 'humano', 'origen', 'senado', 'enlace', ''),
    'confirmado', 'minimax-mock')),
  null,
  'confirm devuelve el id del vínculo promovido'
);
select is((select estado from revision_identidad where id = 900001), 'confirmado',
  'el caso quedó resuelto a confirmado');
select is((select revisor_id from revision_identidad where id = 900001), 'ana',
  'revisor_id registrado en el caso');
select is(
  (select estado from vinculo_identidad where mencion_normalizada = 'rpc uno' and periodo = 'rpc-2026'),
  'confirmado', 'vínculo creado en estado confirmado (humano)');
select is(
  (select parlamentario_id from vinculo_identidad where mencion_normalizada = 'rpc uno' and periodo = 'rpc-2026'),
  'P0R001', 'el vínculo apunta a la persona del chosen_id');
select is(
  (select count(*)::int from identidad_audit where decision = 'confirmado' and revisor_id = 'ana'),
  1, 'audit humano confirmado escrito');
select is(
  (select a.vinculo_id from identidad_audit a where a.decision = 'confirmado' and a.revisor_id = 'ana'),
  (select id from vinculo_identidad where mencion_normalizada = 'rpc uno' and periodo = 'rpc-2026'),
  'el audit se enlaza al vínculo recién upserteado (WR-01)');

-- (b) atomicidad: re-resolver el MISMO caso (ya 'confirmado') LANZA y no deja colaterales.
select throws_ok(
  $$ select resolver_identidad(900001, 'rechazado', 'beto', 'x', now(), false, null, 'rechazado', null) $$,
  'P0002', null,
  're-resolver un caso ya resuelto LANZA (no_data_found, atómico)');
select is(
  (select count(*)::int from identidad_audit where revisor_id = 'beto'),
  0, 'el intento fallido no dejó audit colateral (rollback total)');

-- (c) reject: resuelve sin promover vínculo.
insert into revision_identidad (id, mencion_nombre, mencion_normalizada, camara, periodo, estado)
  overriding system value
  values (900002, 'Rpc Dos', 'rpc dos', 'senado', 'rpc-2026', 'pendiente');
select is(
  (select resolver_identidad(900002, 'rechazado', 'ana', 'homónimo', now(), false, null, 'rechazado', null)),
  null, 'reject no devuelve vínculo (null)');
select is((select estado from revision_identidad where id = 900002), 'rechazado',
  'el caso quedó resuelto a rechazado');
select is(
  (select count(*)::int from identidad_audit where decision = 'rechazado' and revisor_id = 'ana'),
  1, 'audit humano rechazado escrito (sin vínculo)');

select * from finish();
rollback;
