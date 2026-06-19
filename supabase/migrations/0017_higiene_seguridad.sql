-- 0017_higiene_seguridad.sql
-- Higiene de seguridad de baja severidad del code-review v1.0 (#37, #38, #39).

-- ── #38: triggers de guarda de identidad sin SET search_path='' ──────────────
-- Las funciones de 0006/0007 solo referencian OLD/NEW y literales (sin objetos
-- shadowables → no son bypasseables vía search_path), pero se fija el search_path
-- vacío por consistencia con la postura del proyecto y para silenciar el advisory.
alter function public.vinculo_identidad_guarda() set search_path = '';
alter function public.vinculo_identidad_guarda_insert() set search_path = '';
alter function public.identidad_audit_immutable() set search_path = '';

-- ── #39: cleanup_net_http no purgaba net._http_request ──────────────────────
-- Los headers `Authorization: Bearer <INGEST_WORKER_SECRET>` viven en
-- net._http_request, no en net._http_response. Se purga también esa tabla con el
-- mismo guard best-effort (según la versión de pg_net puede no existir).
create or replace function util.cleanup_net_http(retain_minutes int default 60)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    delete from net._http_response
     where created < now() - make_interval(mins => retain_minutes);
  exception when undefined_table then
    null; -- otra version de pg_net: ignorar.
  end;
  -- #39: los headers Bearer viven en la tabla de REQUEST; purgarlos también.
  begin
    delete from net._http_request
     where created < now() - make_interval(mins => retain_minutes);
  exception
    when undefined_table then null;  -- otra version de pg_net.
    when undefined_column then null; -- algunas versiones no exponen `created`.
  end;
end;
$$;

-- ── #37: util_host_throttle vivía en `public` (su función hermana en `util`) ──
-- Una tabla en `public` con RLS deny-by-default no expone datos a anon, pero su
-- nombre aparece en la introspección OpenAPI de la Data API. Se mueve a `util`
-- (donde ya vive reserve_host_slot) por consistencia y para sacarla del schema
-- expuesto. Se actualiza la función que la referencia.
alter table public.util_host_throttle set schema util;
alter table util.util_host_throttle rename to host_throttle;

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
  insert into util.host_throttle as t (host, last_request_at)
  values (p_host, now())
  on conflict (host) do update
    set last_request_at = now()
    where now() - t.last_request_at >= v_interval
  returning true into v_updated;

  if v_updated then
    return 0;
  end if;

  select last_request_at into v_last
    from util.host_throttle
   where host = p_host;

  if v_last is null then
    return 0;
  end if;

  return greatest(
    0,
    ceil(extract(epoch from (v_last + v_interval - now())) * 1000)::int
  );
end;
$$;
