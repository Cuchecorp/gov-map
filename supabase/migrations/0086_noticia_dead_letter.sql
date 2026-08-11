-- 0086_noticia_dead_letter.sql — dead-letter del pipeline news resolver (Phase 134, NEWS-04).
--
-- CONTRATO (SC3 de la Phase 134, LOCKED): `null` en cualquier eslabón del contrato
-- anti-alucinación (emisión → resolución → validación) descarta el registro AQUÍ, con su
-- `rejection_stage` — nada se fabrica, todo rechazo tiene causa consultable. La tabla es
-- INFRAESTRUCTURA de 134; el escritor llega con 135 (clasificador). El enrutamiento a fichas
-- está fail-closed por 133 (T4/T9 no-medidos) — esta tabla existe igual porque el pipeline
-- de 135 la necesita para ser honesto aunque no publique.
--
-- RÉGIMEN DE PAYLOAD (mismo que el golden, D-133-F2): JAMÁS texto completo del artículo ni
-- PII — solo claves técnicas (emisión rechazada, etapa, conteos). El CHECK de tamaño
-- (4000 bytes) hace estructuralmente incómodo volcar un artículo entero; el schema zod del
-- writer (134-03) es la compuerta fina.
--
-- APLICAR (régimen LOCKED del proyecto, ver 0084:31-38):
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0086_noticia_dead_letter.sql
--   (JAMÁS `supabase db push`; jamás reordenar 0073/0075.)
-- ROLLBACK: drop table public.noticia_dead_letter; (tabla nueva, nace vacía — sin dos tiempos)
--
-- RLS deny-all, patrón 0084: RLS habilitado + CERO policies + CERO grants. El sitio público
-- no la lee (lee con service_role solo lo allowlisted); anon no tiene ningún privilegio. El
-- REVOKE explícito de abajo puede no-opear con WARNING 01006 (gotcha v12.0) — la prueba real
-- de zero-grant es el pgTAP 0086, no el REVOKE.

create table if not exists public.noticia_dead_letter (
  id bigint generated always as identity primary key,
  url_hash text not null,
  rejection_stage text not null check (rejection_stage in (
    'parse_fallido',            -- la salida del LLM no parsea/valida (zod-terminal / structured-output-fail)
    'confianza_bajo_umbral',    -- parsea pero confianza < umbral congelado
    'emision_fuera_de_lista',   -- emitió un boletín/nombre que NO está en la allowlist inyectada
    'boletin_no_resuelto',      -- el resolver determinista devolvió null para el boletín
    'parlamentario_no_resuelto',-- el resolver devolvió null para el nombre (homónimo/parcial/inexistente)
    'lote_invalido'             -- el gate all-or-nothing rechazó el lote completo
  )),
  detalle text,
  payload jsonb not null default '{}'::jsonb
    constraint noticia_dead_letter_payload_acotado check (octet_length(payload::text) <= 4000),
  run_id text,
  created_at timestamptz not null default now()
);

create index if not exists noticia_dead_letter_stage_idx on public.noticia_dead_letter (rejection_stage);
create index if not exists noticia_dead_letter_url_hash_idx on public.noticia_dead_letter (url_hash);

alter table public.noticia_dead_letter enable row level security;

revoke all on table public.noticia_dead_letter from anon, authenticated;
