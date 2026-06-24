-- 0035_vinculo_entidad.sql
-- Subsistema de vinculo + cola humana de TERCEROS (ENT-01/ENT-04).
-- Espejo de 0006_revision_identidad.sql (vinculo + cola) + 0007_identidad_guardas.sql
-- (guardas RAISE + force RLS), con Δ1 (tipo_entidad como clave de blocking) y Δ2
-- (defensa-en-DB juridica-solo-RUT-determinista).
--
-- NOTA: identidad_audit se REUSA (la columna tipo_entidad se anade en 0036). Sus guardas
-- de inmutabilidad (0006/0007: BEFORE UPDATE/DELETE/TRUNCATE + revoke service_role) YA
-- protegen las filas de terceros — NO se recrean aqui (A3, espejo reusado).
--
-- Principios:
--   * `vinculo_entidad` es el producto final mencion→entidad_tercero_id: estado por mencion,
--     default 'no_confirmado' — nada se auto-confirma por DDL; solo 'confirmado' es hecho.
--   * Δ Pitfall 6 — CLAVE NATURAL `(tipo_entidad, mencion_normalizada)` con indice unico
--     TOTAL (NO parcial): PostgREST .upsert(onConflict) no puede targetear un parcial.
--     Esta clave coincide byte-a-byte con el onConflict del writer (Plan 03) y el on
--     conflict del RPC resolver_entidad (0036). De esto depende ENT-05 "2da corrida=0 nuevos".
--   * `revision_entidad` es la cola humana: candidatos del blocking SIN rut (minimizacion),
--     salida del modelo, estado pendiente/resuelto, revisor, timestamps.
--   * Δ Guardas anti-demotion del VINCULO con semantica RAISE (hecho publico individual,
--     OPUESTA a la coercion silenciosa de la maestra 0034). Espejo de 0007.
--   * Δ2 DEFENSA-EN-DB: una entidad 'juridica' NO puede confirmarse por metodo != 'determinista'
--     (RAISE) — coherente con aporte_parlamentario_solo_confirmado (0024). El matcher TS ya
--     lo enforce (Plan 02); esta es la defensa en profundidad LOCKED ("regla verdadera en el esquema").
--   * RLS deny-by-default + force RLS + revoke all from anon,authenticated en ambas tablas.

-- 1. vinculo_entidad — el producto final mencion→entidad_tercero_id.
create table vinculo_entidad (
  id                  bigint generated always as identity primary key,
  mencion_nombre      text not null,                 -- nombre como aparecio en la fuente foranea (display)
  mencion_normalizada text not null,                 -- clave normalizada (fold de acentos/mayusculas)
  -- Δ1: tipo_entidad reemplaza camara/periodo como clave de blocking de terceros.
  tipo_entidad        text not null
                        check (tipo_entidad in ('natural','juridica')),
  entidad_tercero_id  text references entidad_tercero(id),  -- NULLABLE: no_confirmado puede no tener id
  estado              text not null default 'no_confirmado'
                        check (estado in ('confirmado', 'probable', 'no_confirmado')),
  metodo              text not null
                        check (metodo in ('determinista', 'llm', 'humano')),
  -- Provenance inline (FND-08).
  origen              text not null,
  fecha_captura       timestamptz not null default now(),
  enlace              text not null
);

-- Δ Pitfall 6 — clave natural con indice unico TOTAL (NO parcial). PostgREST onConflict
-- no puede targetear un indice parcial; 0006 era parcial y 0014 lo hizo total — aqui se
-- crea TOTAL desde el inicio. Debe coincidir byte-a-byte con el on conflict del RPC (0036).
create unique index vinculo_entidad_clave_natural
  on vinculo_entidad (tipo_entidad, mencion_normalizada);

-- 2. revision_entidad — la cola humana (ENT-04).
create table revision_entidad (
  id                  bigint generated always as identity primary key,
  vinculo_id          bigint references vinculo_entidad(id),  -- NULLABLE hasta resolver
  mencion_nombre      text not null,
  mencion_normalizada text not null,
  tipo_entidad        text not null
                        check (tipo_entidad in ('natural','juridica')),
  candidatos          jsonb not null default '[]'::jsonb,  -- candidatos del blocking; SIN rut (minimizacion)
  salida_modelo       jsonb,                               -- Adjudicacion validada
  modelo_version      text,                                -- p.ej. 'MiniMax-M3'
  estado              text not null default 'pendiente'
                        check (estado in ('pendiente', 'confirmado', 'rechazado', 'corregido')),
  revisor_id          text,                                -- NULL hasta que un humano resuelve
  motivo              text,                                -- razon de rechazo/correccion
  created_at          timestamptz not null default now(),
  resolved_at         timestamptz
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Δ Guarda anti-demotion del vinculo (RAISE, espejo de vinculo_identidad_guarda 0007):
--   una fila `confirmado` es un HECHO publico. Bloquea su demotion silenciosa, la
--   reescritura de su entidad_tercero_id, la promocion por LLM y confirmar sin entidad.
-- Δ2: ademas bloquea confirmar tipo_entidad='juridica' por metodo != 'determinista'
--   (una juridica SOLO se confirma por RUT determinista — defensa en profundidad).
-- pgTAP corre como superuser local (peor caso): si el trigger bloquea aqui, bloquea al
-- service role que BYPASSA RLS. El trigger (no el REVOKE/RLS) es el control vinculante.
-- ─────────────────────────────────────────────────────────────────────────────
create function vinculo_entidad_guarda()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Caso 1: la fila YA era `confirmado` (hecho publico fijado). Casi inmutable:
  --   * NO puede degradarse a `probable`/`no_confirmado`.
  --   * NO puede reapuntar su entidad_tercero_id a otra entidad.
  -- Se permite re-confirmar la MISMA entidad (idempotencia del upsert humano).
  if old.estado = 'confirmado' then
    if new.estado <> 'confirmado' then
      raise exception
        'vinculo_entidad: no se puede degradar una fila confirmado (% -> %) [id=%]',
        old.estado, new.estado, old.id
        using errcode = 'restrict_violation';
    end if;
    if new.entidad_tercero_id is distinct from old.entidad_tercero_id then
      raise exception
        'vinculo_entidad: no se puede reescribir entidad_tercero_id de una fila confirmado [id=%]',
        old.id
        using errcode = 'restrict_violation';
    end if;
  end if;

  -- Caso 2: promocion A `confirmado`. Exclusiva de humano/determinista (el LLM nunca
  -- confirma) y debe apuntar a una entidad (entidad_tercero_id not null).
  if new.estado = 'confirmado' and old.estado <> 'confirmado' then
    if new.metodo not in ('humano', 'determinista') then
      raise exception
        'vinculo_entidad: solo humano/determinista pueden confirmar (metodo=%) [id=%]',
        new.metodo, old.id
        using errcode = 'restrict_violation';
    end if;
    if new.entidad_tercero_id is null then
      raise exception
        'vinculo_entidad: no se puede confirmar sin entidad_tercero_id (hecho publico sin entidad) [id=%]',
        old.id
        using errcode = 'restrict_violation';
    end if;
    -- Δ2: una juridica SOLO se confirma por RUT determinista (nunca por nombre/humano/llm).
    if new.tipo_entidad = 'juridica' and new.metodo <> 'determinista' then
      raise exception
        'vinculo_entidad: una entidad juridica solo se confirma por metodo determinista (RUT exacto) (metodo=%) [id=%]',
        new.metodo, old.id
        using errcode = 'restrict_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger vinculo_entidad_guarda
  before update on vinculo_entidad
  for each row
  execute function vinculo_entidad_guarda();

-- Tambien sobre INSERT: una fila no puede NACER `confirmado` por una via ilegitima,
-- sin entidad, ni una juridica por metodo != determinista. Espeja la guarda de promocion.
create function vinculo_entidad_guarda_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado = 'confirmado' then
    if new.metodo not in ('humano', 'determinista') then
      raise exception
        'vinculo_entidad: INSERT confirmado solo por humano/determinista (metodo=%)',
        new.metodo
        using errcode = 'restrict_violation';
    end if;
    if new.entidad_tercero_id is null then
      raise exception
        'vinculo_entidad: INSERT confirmado requiere entidad_tercero_id (hecho publico sin entidad)'
        using errcode = 'restrict_violation';
    end if;
    -- Δ2: juridica confirmada al nacer SOLO por determinista (RUT exacto).
    if new.tipo_entidad = 'juridica' and new.metodo <> 'determinista' then
      raise exception
        'vinculo_entidad: INSERT confirmado de juridica solo por metodo determinista (RUT exacto) (metodo=%)',
        new.metodo
        using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger vinculo_entidad_guarda_insert
  before insert on vinculo_entidad
  for each row
  execute function vinculo_entidad_guarda_insert();

-- force row level security: la RLS deny-by-default tambien aplica al OWNER (no solo a
-- roles no-privilegiados). Defensa en profundidad para lecturas.
alter table vinculo_entidad force row level security;

-- RLS deny-by-default + revoke explicito (Ley 21.719, leccion Phase 11) en ambas tablas.
alter table vinculo_entidad  enable row level security;
alter table revision_entidad enable row level security;
revoke all on vinculo_entidad  from anon, authenticated;
revoke all on revision_entidad from anon, authenticated;
