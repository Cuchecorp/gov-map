-- 0015_resolver_identidad_rpc.sql
-- #3 (code-review v1.0): la resolución de un caso en la compuerta humana hacía TRES
-- llamadas PostgREST independientes (resolverRevision + upsertVinculo + appendAudit) sin
-- transacción. Si la primera commiteaba (estado→'confirmado') y luego el upsert del
-- vínculo o el audit fallaban, el caso quedaba resuelto SIN vínculo ni audit — rompía la
-- invariante "audit en cada decisión" (T-04-11) y el reintento abortaba antes (guard
-- estado<>'pendiente'), dejando el huérfano sin reparación por el camino normal.
--
-- RPC transaccional `resolver_identidad`: UPDATE (guardado contra 'pendiente') + UPSERT
-- del vínculo (si promueve) + INSERT del audit, TODO en una transacción. Si el caso ya no
-- está pendiente, RAISE → rollback total (nada se escribe). El UPSERT usa la clave natural
-- (camara, periodo, mencion_normalizada); Postgres infiere el índice parcial correcto por
-- el predicado (0006 para id no-null, 0014 para id null). Los triggers de 0007 sobre
-- vinculo_identidad siguen vigentes (la promoción humano/determinista pasa).
--
-- SEGURIDAD: SECURITY INVOKER (default). Solo el service_role (writer server-side) debe
-- invocarla; se revoca a public/anon y se concede a service_role. `set search_path = ''`
-- (#38): todos los objetos van calificados con `public.` — sin nada shadowable.

create function public.resolver_identidad(
  p_caso_id         bigint,
  p_estado          text,
  p_revisor         text,
  p_motivo          text,
  p_resolved_at     timestamptz,
  p_promover        boolean,
  p_vinculo         jsonb,
  p_decision        text,
  p_modelo_version  text
) returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_afectadas  int;
  v_vinculo_id bigint;
begin
  -- 1. Resolver el caso SOLO si sigue 'pendiente' (atómico). 0 filas → rollback total.
  update public.revision_identidad
     set estado      = p_estado,
         revisor_id  = p_revisor,
         motivo      = nullif(p_motivo, ''),
         resolved_at = p_resolved_at
   where id = p_caso_id and estado = 'pendiente';
  get diagnostics v_afectadas = row_count;
  if v_afectadas = 0 then
    raise exception 'resolver_identidad: caso % ya no estaba pendiente (no se escribió nada)', p_caso_id
      using errcode = 'no_data_found';
  end if;

  -- 2. Promover el vínculo (solo confirm/correct). UPSERT por clave natural.
  if p_promover then
    insert into public.vinculo_identidad
      (mencion_nombre, mencion_normalizada, camara, periodo,
       parlamentario_id, estado, metodo, origen, fecha_captura, enlace)
    values
      (p_vinculo->>'mencion_nombre', p_vinculo->>'mencion_normalizada',
       p_vinculo->>'camara', p_vinculo->>'periodo',
       p_vinculo->>'parlamentario_id', p_vinculo->>'estado', p_vinculo->>'metodo',
       p_vinculo->>'origen',
       coalesce((p_vinculo->>'fecha_captura')::timestamptz, now()),
       coalesce(p_vinculo->>'enlace', ''))
    on conflict (camara, periodo, mencion_normalizada) do update
      set parlamentario_id = excluded.parlamentario_id,
          estado          = excluded.estado,
          metodo          = excluded.metodo,
          mencion_nombre  = excluded.mencion_nombre,
          origen          = excluded.origen,
          enlace          = excluded.enlace
    returning id into v_vinculo_id;
  end if;

  -- 3. Audit append-only de la decisión humana (T-04-11). vinculo_id enlazado (WR-01).
  insert into public.identidad_audit
    (vinculo_id, metodo, decision, confidence, modelo_version, revisor_id, evidence, conflicts)
  values
    (v_vinculo_id, 'humano', p_decision, null, nullif(p_modelo_version, ''),
     p_revisor, '[]'::jsonb,
     case when nullif(p_motivo, '') is null then '[]'::jsonb
          else jsonb_build_array(p_motivo) end);

  return v_vinculo_id;
end;
$$;

-- Deny-by-default de ejecución: solo el service_role la invoca (writer server-side).
revoke execute on function
  public.resolver_identidad(bigint, text, text, text, timestamptz, boolean, jsonb, text, text)
  from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function
      public.resolver_identidad(bigint, text, text, text, timestamptz, boolean, jsonb, text, text)
      from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke execute on function
      public.resolver_identidad(bigint, text, text, text, timestamptz, boolean, jsonb, text, text)
      from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function
      public.resolver_identidad(bigint, text, text, text, timestamptz, boolean, jsonb, text, text)
      to service_role;
  end if;
end;
$$;
