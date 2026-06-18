-- 0007_identidad_guardas.sql
-- Endurecimiento del subsistema de identidad (riesgo existencial #1), fija las
-- brechas de CR-01 del code-review de Fase 4:
--
--   (A) `vinculo_identidad` (la tabla de HECHOS publicos) carecia de toda guarda de
--       escritura. RLS no detiene al service role (lo BYPASSA), y no habia trigger ni
--       REVOKE. Cualquier portador de la service key podia, en silencio, promover una
--       fila `probable`→`confirmado` o reescribir el `parlamentario_id` de una fila ya
--       `confirmado` (apuntar el hecho publico a OTRA persona) sin rastro ni barrera.
--       => Trigger BEFORE UPDATE que prohibe mutar una fila YA `confirmado` salvo la
--          transicion legitima, y bloquea la reescritura del `parlamentario_id`.
--
--   (B) La inmutabilidad de `identidad_audit` (0006) era evadible:
--         * el trigger BEFORE UPDATE OR DELETE NO cubre TRUNCATE (TRUNCATE no dispara
--           triggers de fila) → un `TRUNCATE identidad_audit` del service role borraba
--           el log no-repudiable completo sin tocar el trigger.
--         * el `REVOKE ... FROM public` NO toca al `service_role` (rol distinto que el
--           writer realmente usa y que BYPASSA RLS) → no aportaba defensa contra el
--           escritor real.
--       => Trigger BEFORE TRUNCATE FOR EACH STATEMENT que tambien hace RAISE EXCEPTION,
--          y REVOKE explicito al `service_role` (ademas de `public`).
--
-- CONTROL VINCULANTE: el binding contra el service role (que BYPASSA RLS y suele tener
-- grants directos) es EL TRIGGER, no el REVOKE ni la RLS. pgTAP corre como superuser
-- local (peor caso) y prueba que el trigger lanza igual → si bloquea ahi, bloquea al
-- service role. El REVOKE es defensa en profundidad.

-- ─────────────────────────────────────────────────────────────────────────────
-- (A) Guarda de inmutabilidad parcial de vinculo_identidad: una fila `confirmado`
--     es un HECHO publico (ID-06). Bloquea su demotion silenciosa y la reescritura
--     de su `parlamentario_id`. Permite la transicion legitima de confirmacion humana
--     (no_confirmado/probable → confirmado por metodo='humano'|'determinista').
-- ─────────────────────────────────────────────────────────────────────────────
create function vinculo_identidad_guarda()
returns trigger
language plpgsql
as $$
begin
  -- Caso 1: la fila YA era `confirmado` (hecho publico fijado). Es casi inmutable:
  --   * NO puede degradarse a `probable`/`no_confirmado` (borrar un hecho publico en silencio).
  --   * NO puede reapuntar su `parlamentario_id` a otra persona (afirmacion falsa creible).
  -- Se permite re-confirmar la MISMA persona (idempotencia del upsert humano: estado
  -- sigue 'confirmado' y el id no cambia) — p.ej. re-correr `confirm` sobre la misma fila.
  if old.estado = 'confirmado' then
    if new.estado <> 'confirmado' then
      raise exception
        'vinculo_identidad: no se puede degradar una fila confirmado (% -> %) [id=%]',
        old.estado, new.estado, old.id
        using errcode = 'restrict_violation';
    end if;
    if new.parlamentario_id is distinct from old.parlamentario_id then
      raise exception
        'vinculo_identidad: no se puede reescribir parlamentario_id de una fila confirmado [id=%]',
        old.id
        using errcode = 'restrict_violation';
    end if;
  end if;

  -- Caso 2: promocion A `confirmado`. La promocion es EXCLUSIVA del humano/determinista
  -- (A4/ID-06): el LLM nunca confirma. Bloquea promover por metodo='llm', y bloquea
  -- confirmar a NADIE (parlamentario_id null) — un hecho publico debe apuntar a una persona.
  if new.estado = 'confirmado' and old.estado <> 'confirmado' then
    if new.metodo not in ('humano', 'determinista') then
      raise exception
        'vinculo_identidad: solo humano/determinista pueden confirmar (metodo=%) [id=%]',
        new.metodo, old.id
        using errcode = 'restrict_violation';
    end if;
    if new.parlamentario_id is null then
      raise exception
        'vinculo_identidad: no se puede confirmar sin parlamentario_id (hecho publico sin persona) [id=%]',
        old.id
        using errcode = 'restrict_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger vinculo_identidad_guarda
  before update on vinculo_identidad
  for each row
  execute function vinculo_identidad_guarda();

-- Tambien sobre INSERT: una fila no puede NACER `confirmado` por una via que no sea
-- humano/determinista, ni `confirmado` sin persona. Espeja la guarda de promocion.
create function vinculo_identidad_guarda_insert()
returns trigger
language plpgsql
as $$
begin
  if new.estado = 'confirmado' then
    if new.metodo not in ('humano', 'determinista') then
      raise exception
        'vinculo_identidad: INSERT confirmado solo por humano/determinista (metodo=%)',
        new.metodo
        using errcode = 'restrict_violation';
    end if;
    if new.parlamentario_id is null then
      raise exception
        'vinculo_identidad: INSERT confirmado requiere parlamentario_id (hecho publico sin persona)'
        using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger vinculo_identidad_guarda_insert
  before insert on vinculo_identidad
  for each row
  execute function vinculo_identidad_guarda_insert();

-- force row level security: la RLS deny-by-default tambien aplica al OWNER de la tabla
-- (no solo a roles no-privilegiados). Defensa en profundidad para lecturas.
alter table vinculo_identidad force row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- (B) Cierre del evasion de inmutabilidad de identidad_audit.
-- ─────────────────────────────────────────────────────────────────────────────

-- (B.1) TRUNCATE no dispara triggers de fila → el trigger BEFORE UPDATE OR DELETE de
--       0006 NO lo cubria. Trigger statement-level que reusa la misma funcion: lanza.
create trigger identidad_audit_no_truncate
  before truncate on identidad_audit
  for each statement
  execute function identidad_audit_immutable();

-- (B.2) REVOKE al rol que el writer REALMENTE usa (service_role), no solo a public.
--       El service_role BYPASSA RLS pero NO al trigger: el REVOKE es defensa en
--       profundidad; el control vinculante es el trigger (probado por pgTAP). El
--       `service_role` existe en toda instancia Supabase; si faltara, este REVOKE
--       seria un no-op inofensivo, por eso se envuelve en un DO con guard.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    revoke update, delete, truncate on identidad_audit from service_role;
  end if;
end;
$$;

-- force RLS en audit tambien (defensa en profundidad de lecturas, espeja vinculo).
alter table identidad_audit force row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- (C) WR-04: vocabulario CERRADO de identidad_audit.decision. En 0006 la columna era
--     free-text y el comentario enumeraba 'match|no_match|uncertain|confirmado|...',
--     pero el pipeline escribe 'no_confirmado'|'probable'|'revision' (+ el revisor
--     'confirmado'|'rechazado'|'corregido'). Un consumidor filtrando por `decision`
--     perdia filas. Este CHECK fija el vocabulario real (espejo de DECISIONES_AUDIT
--     en writer-revision.ts) y rechaza valores fuera de el.
alter table identidad_audit
  add constraint identidad_audit_decision_check
  check (decision in (
    'confirmado', 'no_confirmado', 'probable', 'revision', 'rechazado', 'corregido'
  ));
