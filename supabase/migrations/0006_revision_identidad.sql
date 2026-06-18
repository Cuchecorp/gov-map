-- 0006_revision_identidad.sql
-- Estado durable del subsistema de identidad asistida (Fase 4):
--   vinculo_identidad (ID-06) + revision_identidad (ID-05) + identidad_audit (ID-08).
--
-- Principios:
--   * `vinculo_identidad` es el producto final mencion→id: el estado por mencion
--     (confirmado/probable/no_confirmado), default 'no_confirmado' — nada se
--     auto-confirma por DDL (espejo 0005); solo `confirmado` es hecho publico (ID-06).
--   * `revision_identidad` es la cola humana (ID-05): registro foraneo + candidatos
--     del blocking + salida del modelo + estado pendiente/resuelto + revisor + timestamps.
--   * `identidad_audit` es APPEND-ONLY (ID-08): la garantia de procedencia no-repudiable.
--     Confiar en que la app "nunca actualiza" es insuficiente (Pitfall 4): el writer usa
--     service role, que BYPASSA RLS. La inmutabilidad vive en la DB con AMBOS mecanismos:
--       (1) trigger BEFORE UPDATE OR DELETE que hace RAISE EXCEPTION — unica defensa que
--           aplica al service role;
--       (2) REVOKE update, delete, truncate FROM public — defensa en profundidad.
--   * provenance / minimizacion: `candidatos` jsonb SIN rut (minimizacion aguas arriba).
--   * RLS deny-by-default (Ley 21.719, V4/V8): RLS habilitada SIN policies en las TRES
--     tablas → anon NUNCA lee identidad/cola/auditoria; solo service role (espejo 0005).

-- 1. vinculo_identidad — el producto final mencion→id (ID-06).
create table vinculo_identidad (
  id                  bigint generated always as identity primary key,
  mencion_nombre      text not null,                 -- nombre como aparecio en la fuente foranea (display)
  mencion_normalizada text not null,                 -- clave normalizada (fold de acentos/mayusculas)
  camara              text not null
                        check (camara in ('diputados', 'senado')),
  periodo             text not null,
  parlamentario_id    text references parlamentario(id),  -- NULLABLE: no_confirmado puede no tener id
  estado              text not null default 'no_confirmado'
                        check (estado in ('confirmado', 'probable', 'no_confirmado')),
                        -- default 'no_confirmado': nada se auto-confirma por DDL (espejo 0005, ID-06).
  metodo              text not null
                        check (metodo in ('determinista', 'llm', 'humano')),
  -- Provenance inline (FND-08): origen + fecha de captura + enlace de la fuente.
  origen              text not null,
  fecha_captura       timestamptz not null default now(),
  enlace              text not null
);

-- Idempotencia del vinculo resuelto: unico parcial sobre (camara, periodo, mencion_normalizada)
-- donde hay id asignado (no_confirmado sin id no compite por la unicidad).
create unique index vinculo_identidad_mencion_key
  on vinculo_identidad (camara, periodo, mencion_normalizada)
  where parlamentario_id is not null;

-- 2. revision_identidad — la cola humana (ID-05).
create table revision_identidad (
  id                  bigint generated always as identity primary key,
  vinculo_id          bigint references vinculo_identidad(id),  -- NULLABLE hasta resolver
  mencion_nombre      text not null,
  mencion_normalizada text not null,
  camara              text not null,
  periodo             text not null,
  region              text,
  candidatos          jsonb not null default '[]'::jsonb,  -- candidatos del blocking; SIN rut (minimizacion)
  salida_modelo       jsonb,                               -- Adjudicacion validada (decision/chosen_id/confidence/evidence/conflicts)
  modelo_version      text,                                -- p.ej. 'MiniMax-M3'
  estado              text not null default 'pendiente'
                        check (estado in ('pendiente', 'confirmado', 'rechazado', 'corregido')),
  revisor_id          text,                                -- NULL hasta que un humano resuelve
  motivo              text,                                -- razon de rechazo/correccion
  created_at          timestamptz not null default now(),
  resolved_at         timestamptz
);

-- 3. identidad_audit — APPEND-ONLY (ID-08), procedencia no-repudiable de cada decision.
create table identidad_audit (
  id                  bigint generated always as identity primary key,
  vinculo_id          bigint references vinculo_identidad(id),
  metodo              text not null
                        check (metodo in ('determinista', 'llm', 'humano')),
  decision            text not null,                       -- vocabulario CERRADO por CHECK en 0007 (WR-04): confirmado|no_confirmado|probable|revision|rechazado|corregido
  confidence          numeric,                             -- NULL para determinista/humano
  modelo_version      text,                                -- NULL si no-LLM
  revisor_id          text,                                -- NULL salvo metodo='humano'
  evidence            jsonb not null default '[]'::jsonb,
  conflicts           jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now()
);

-- Inmutabilidad de identidad_audit (AMBOS mecanismos):
--   (1) Trigger BEFORE UPDATE OR DELETE → RAISE EXCEPTION. Aplica a TODOS los roles,
--       incluido el service role que BYPASSA RLS. Es la barrera efectiva (Pitfall 4).
create function identidad_audit_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'identidad_audit es append-only: % no permitido', tg_op
    using errcode = 'restrict_violation';
end;
$$;

create trigger identidad_audit_immutable
  before update or delete on identidad_audit
  for each row
  execute function identidad_audit_immutable();

--   (2) REVOKE update, delete, truncate FROM public — defensa en profundidad.
revoke update, delete, truncate on identidad_audit from public;

-- RLS deny-by-default (Ley 21.719, V4/V8): enable SIN policies en las TRES tablas.
-- anon NUNCA lee identidad/cola/auditoria; solo service role (espejo 0005).
alter table vinculo_identidad enable row level security;
alter table revision_identidad enable row level security;
alter table identidad_audit   enable row level security;
