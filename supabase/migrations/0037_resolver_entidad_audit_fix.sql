-- 0037_resolver_entidad_audit_fix.sql — forward-fix: adds identidad_audit.vinculo_entidad_id (FK → vinculo_entidad) + CHECK defense-in-depth (num_nonnulls <= 1) + CREATE OR REPLACE resolver_entidad to write the correct column. Bug closure: corrected INSERT + vinculo_entidad_id FK. 0036 immutable (applied to PROD). ENT-03/ENT-04.
--
-- Issue 1 (35-05-SUMMARY.md, BLOCKER ENT-03/ENT-04): migracion 0036 inserta en
-- identidad_audit con vinculo_id = v_vinculo_id, donde v_vinculo_id proviene de
-- vinculo_entidad (la tabla de TERCEROS). Pero identidad_audit.vinculo_id tiene FK →
-- vinculo_identidad (la tabla PARLAMENTARIA). Contra PROD donde vinculo_identidad esta
-- vacia, el primer confirm-with-promote lanza identidad_audit_vinculo_id_fkey (23503).
-- 0036 ya esta aplicada a PROD y es INMUTABLE.
--
-- Cierre del bug (Option A, operator-locked):
--   (a) El INSERT corregido escribe vinculo_entidad_id (valor v_vinculo_id) — el id de
--       terceros ya no aterriza en la columna del FK parlamentario.
--   (b) El FK sobre identidad_audit.vinculo_entidad_id → vinculo_entidad — guarda
--       estructural sobre la columna correcta. ESTE es el guard de la clase FK-violation.
--   El CHECK (num_nonnulls <= 1) es defensa-en-profundidad contra ambas columnas seteadas
--   simultaneamente; NO es el guard de la clase FK-violation.

-- ── Seccion 1: DDL sobre identidad_audit ────────────────────────────────────────
alter table identidad_audit
  add column vinculo_entidad_id bigint references vinculo_entidad(id);

alter table identidad_audit
  add constraint identidad_audit_un_solo_vinculo
  check (num_nonnulls(vinculo_id, vinculo_entidad_id) <= 1);
-- Note: <= 1, not = 1. The reject/no-promote path writes audit rows with both columns null
-- (num_nonnulls=0), which must remain legal.

-- ── Seccion 2: CREATE OR REPLACE resolver_entidad (espejo 0036; SOLO cambia la columna del audit) ──
create or replace function public.resolver_entidad(
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
  --    FORWARD-FIX 0037: el id de vinculo_entidad va a vinculo_entidad_id (FK → vinculo_entidad),
  --    NO a vinculo_id (FK → vinculo_identidad). Este es el cambio que cierra Issue 1.
  insert into public.identidad_audit
    (vinculo_entidad_id, metodo, decision, confidence, modelo_version, revisor_id, evidence, conflicts, tipo_entidad)
  values
    (v_vinculo_id, 'humano', p_decision, null, nullif(p_modelo_version, ''),
     p_revisor, '[]'::jsonb,
     case when nullif(p_motivo, '') is null then '[]'::jsonb
          else jsonb_build_array(p_motivo) end,
     p_tipo_entidad);

  return v_vinculo_id;
end;
$$;

-- ── Seccion 3: Deny-by-default de ejecucion (re-asercion defensiva, copiada de 0036) ──
-- IMPORTANTE: este bloque va DESPUES de la definicion de la funcion (seccion 2). Otorgar
-- sobre una funcion antes del CREATE OR REPLACE otorga sobre un objeto rancio/ausente.
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
