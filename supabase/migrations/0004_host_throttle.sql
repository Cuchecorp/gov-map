-- 0004_host_throttle.sql
-- Gate de rate-limit DURABLE por host (CR-02).
--
-- El HostRateLimiter en proceso (packages/ingest) solo serializa requests
-- DENTRO de un mismo isolate/batch. Cada invocacion de la Edge Function es un
-- isolate fresco con su Map vacio, y pg_net puede fanout-ear invocaciones
-- concurrentes => varios isolates podian pegarle al MISMO host gubernamental
-- sin delay (riesgo de ban WAF, justo lo que FND-01 previene).
--
-- Este gate vive en Postgres (estado compartido y durable) y materializa el
-- "2-3s entre requests al MISMO origen" de forma autoritativa cross-invocacion.
-- El worker llama util.reserve_host_slot(host, min_interval) ANTES de cada
-- fetch: la funcion reserva el slot de forma atomica (INSERT ... ON CONFLICT
-- con guarda temporal) y devuelve cuantos ms hay que esperar antes de poder
-- pedir. Si devuelve > 0, el worker espera (o difiere via no-ack).

-- ---------------------------------------------------------------------------
-- Tabla: ultimo request reservado por host.
-- ---------------------------------------------------------------------------
create table if not exists util_host_throttle (
  host            text primary key,
  last_request_at timestamptz not null default now()
);

-- RLS deny-by-default: solo service role (Edge Functions/CI) la toca.
alter table util_host_throttle enable row level security;

-- ---------------------------------------------------------------------------
-- reserve_host_slot(host, min_interval_ms)
--   Reserva atomicamente el slot del host. Devuelve los milisegundos que el
--   caller debe esperar ANTES de pedir (0 = puede pedir ya).
--
--   Semantica:
--     - Primer request al host (sin fila) => inserta now(), wait = 0.
--     - now() - last_request_at >= min_interval => avanza last_request_at a
--       now(), wait = 0 (slot disponible, reservado para este caller).
--     - now() - last_request_at <  min_interval => NO avanza el reloj; devuelve
--       el remanente en ms para que el caller espere y reintente/difiera.
--
--   El INSERT ... ON CONFLICT ... DO UPDATE con la guarda en WHERE hace la
--   reserva atomica: dos invocaciones concurrentes no pueden ambas reservar el
--   mismo slot (la segunda no matchea la guarda y cae al branch de espera).
-- ---------------------------------------------------------------------------
create or replace function util.reserve_host_slot(
  p_host           text,
  p_min_interval_ms int default 2000
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_interval interval := make_interval(secs => p_min_interval_ms / 1000.0);
  v_updated  boolean := false;
  v_last     timestamptz;
begin
  -- Intento de reserva atomica: inserta si no existe, o avanza el reloj SOLO si
  -- ya paso el intervalo. RETURNING nos dice si quedo reservado para nosotros.
  insert into public.util_host_throttle as t (host, last_request_at)
  values (p_host, now())
  on conflict (host) do update
    set last_request_at = now()
    where now() - t.last_request_at >= v_interval
  returning true into v_updated;

  if v_updated then
    -- Slot reservado para este caller: puede pedir ya.
    return 0;
  end if;

  -- No reservo: otro caller tiene el slot reciente. Calcular el remanente.
  select last_request_at into v_last
    from public.util_host_throttle
   where host = p_host;

  if v_last is null then
    -- Carrera extrema: la fila desaparecio; permitir (se reintenta arriba).
    return 0;
  end if;

  return greatest(
    0,
    ceil(extract(epoch from (v_last + v_interval - now())) * 1000)::int
  );
end;
$$;

comment on function util.reserve_host_slot(text, int) is
  'CR-02: reserva atomica del slot de rate-limit por host. Devuelve ms a esperar (0 = ya).';
