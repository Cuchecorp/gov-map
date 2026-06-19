-- 0003_host_throttle.test.sql
-- Verifica el gate de rate-limit DURABLE por host (CR-02, migracion 0004):
--   * la tabla util_host_throttle existe con RLS
--   * util.reserve_host_slot existe
--   * primer request a un host => wait 0 (reserva inmediata)
--   * request inmediato siguiente => wait > 0 (slot ocupado, debe esperar)
--   * tras avanzar el reloj (last_request_at viejo) => wait 0 de nuevo
-- Corre via `supabase test db` (pgTAP).

begin;
select plan(6);

-- #37: la tabla vive en el schema `util` (movida de `public` en 0017).
select has_table('util', 'host_throttle', 'tabla util.host_throttle existe (CR-02)');
select has_function('util', 'reserve_host_slot', 'util.reserve_host_slot existe (CR-02)');

-- RLS habilitado (deny-by-default; solo service role).
select is(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where c.relname = 'host_throttle' and n.nspname = 'util'),
  true,
  'util.host_throttle tiene RLS habilitado'
);

-- Primer request al host: reserva inmediata (wait = 0).
select is(
  util.reserve_host_slot('test.camara.cl', 2000),
  0,
  'primer request al host => wait 0 (reserva)'
);

-- Segundo request inmediato: el slot acaba de reservarse => debe esperar (>0).
select ok(
  util.reserve_host_slot('test.camara.cl', 2000) > 0,
  'request inmediato siguiente => wait > 0 (gate durable activo)'
);

-- Envejecer el reloj del host mas alla del intervalo => slot disponible (wait 0).
update util.host_throttle
   set last_request_at = now() - interval '10 seconds'
 where host = 'test.camara.cl';

select is(
  util.reserve_host_slot('test.camara.cl', 2000),
  0,
  'tras pasar el intervalo => wait 0 (slot libre de nuevo)'
);

select * from finish();
rollback;
