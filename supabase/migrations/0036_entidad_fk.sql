-- 0036_entidad_fk.sql
-- Cablea los FK que hoy quedan NULL (Δ3) + el RPC transaccional resolver_entidad (ENT-03/ENT-04).
-- Espejo de 0015_resolver_identidad_rpc.sql (RPC + grants firma-exacta).
--
-- Δ3 — FK y columnas que conectan los reconciliadores a la maestra de terceros:
--   * lobby_contraparte.contraparte_id (0021: text nullable SIN FK) → formalizar FK a entidad_tercero.
--   * contratista.entidad_id (0023: NO existe; PK rut_proveedor) → columna nueva FK a entidad_tercero.
--   * identidad_audit.tipo_entidad (Δ1, A3): columna nueva en el audit REUSADO (no se crea entidad_audit).
--   NOTA: donante.entidad_id se DIFIERE a Phase 36 (A2) — NO se anade aqui.
--
-- RPC resolver_entidad: espejo casi total de resolver_identidad (0015) con un 10mo
-- parametro p_tipo_entidad (para poblar identidad_audit.tipo_entidad). UPDATE guardado
-- contra 'pendiente' + UPSERT del vinculo por la clave natural de terceros + INSERT del
-- audit, TODO atomico. El on conflict coincide byte-a-byte con vinculo_entidad_clave_natural
-- (0035). SECURITY INVOKER (default); revoke a public/anon/authenticated, grant a service_role
-- con la FIRMA EXACTA de 10 tipos (Pitfall 5 — olvidar un tipo deja la funcion grantable).

-- ── Δ3 FK / columnas ──────────────────────────────────────────────────────────
alter table lobby_contraparte
  add constraint lobby_contraparte_contraparte_id_fkey
  foreign key (contraparte_id) references entidad_tercero(id);

alter table contratista
  add column entidad_id text references entidad_tercero(id);

alter table identidad_audit
  add column tipo_entidad text;

-- ── RPC transaccional resolver_entidad (espejo 0015 + p_tipo_entidad) ───────────
create function public.resolver_entidad(
  p_caso_id         bigint,
  p_estado          text,
  p_revisor         text,
  p_motivo          text,
  p_resolved_at     timestamptz,
  p_promover        boolean,
  p_vinculo         jsonb,
  p_decision        text,
  p_modelo_version  text,
  p_tipo_entidad    text
) returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_afectadas  int;
  v_vinculo_id bigint;
begin
  -- 1. Resolver el caso SOLO si sigue 'pendiente' (atomico). 0 filas → rollback total.
  update public.revision_entidad
     set estado      = p_estado,
         revisor_id  = p_revisor,
         motivo      = nullif(p_motivo, ''),
         resolved_at = p_resolved_at
   where id = p_caso_id and estado = 'pendiente';
  get diagnostics v_afectadas = row_count;
  if v_afectadas = 0 then
    raise exception 'resolver_entidad: caso % ya no estaba pendiente (no se escribio nada)', p_caso_id
      using errcode = 'no_data_found';
  end if;

  -- 2. Promover el vinculo (solo confirm/correct). UPSERT por la clave natural de terceros.
  --    on conflict (tipo_entidad, mencion_normalizada) COINCIDE con vinculo_entidad_clave_natural (0035).
  if p_promover then
    insert into public.vinculo_entidad
      (mencion_nombre, mencion_normalizada, tipo_entidad,
       entidad_tercero_id, estado, metodo, origen, fecha_captura, enlace)
    values
      (p_vinculo->>'mencion_nombre', p_vinculo->>'mencion_normalizada',
       p_vinculo->>'tipo_entidad',
       p_vinculo->>'entidad_tercero_id', p_vinculo->>'estado', p_vinculo->>'metodo',
       p_vinculo->>'origen',
       coalesce((p_vinculo->>'fecha_captura')::timestamptz, now()),
       coalesce(p_vinculo->>'enlace', ''))
    on conflict (tipo_entidad, mencion_normalizada) do update
      set entidad_tercero_id = excluded.entidad_tercero_id,
          estado            = excluded.estado,
          metodo            = excluded.metodo,
          mencion_nombre    = excluded.mencion_nombre,
          origen            = excluded.origen,
          enlace            = excluded.enlace
    returning id into v_vinculo_id;
  end if;

  -- 3. Audit append-only de la decision humana (reusa identidad_audit + Δ1 tipo_entidad).
  insert into public.identidad_audit
    (vinculo_id, metodo, decision, confidence, modelo_version, revisor_id, evidence, conflicts, tipo_entidad)
  values
    (v_vinculo_id, 'humano', p_decision, null, nullif(p_modelo_version, ''),
     p_revisor, '[]'::jsonb,
     case when nullif(p_motivo, '') is null then '[]'::jsonb
          else jsonb_build_array(p_motivo) end,
     p_tipo_entidad);

  return v_vinculo_id;
end;
$$;

-- Deny-by-default de ejecucion: solo el service_role la invoca (writer server-side).
-- Pitfall 5: los revoke/grant deben listar la FIRMA EXACTA de los 10 tipos o el grant
-- apunta a otra sobrecarga y la funcion queda grantable a public.
revoke execute on function public.resolver_entidad(bigint,text,text,text,timestamptz,boolean,jsonb,text,text,text)
  from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.resolver_entidad(bigint,text,text,text,timestamptz,boolean,jsonb,text,text,text)
      from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke execute on function public.resolver_entidad(bigint,text,text,text,timestamptz,boolean,jsonb,text,text,text)
      from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.resolver_entidad(bigint,text,text,text,timestamptz,boolean,jsonb,text,text,text)
      to service_role;
  end if;
end;
$$;
