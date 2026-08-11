-- 0087_noticia_etiqueta_llm_ledger.sql — Phase 135 (NEWS-05): la etiqueta interna del
-- clasificador vive en COLUMNAS de `noticia` (decisión 135, reservada por
-- 133-READJUDICACION "no decide" §3: historial fino sin consumidor = YAGNI declarado), y el
-- presupuesto de llamadas LLM queda consultable por corrida en `llm_ledger`.
--
-- D-133-G sigue vigente: la etiqueta JAMÁS se renderiza — es enrutamiento interno, y además
-- T4/T9 quedaron no-medidos (fail-closed 133-b): NINGUNA clase enruta a fichas. Estas
-- columnas alimentan el pipeline y el eval, no una superficie.
--
-- APLICAR:
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0087_noticia_etiqueta_llm_ledger.sql
-- ROLLBACK: alter table noticia drop column etiqueta, etiqueta_confianza, etiqueta_modelo,
--   clasificada_en; drop table llm_ledger; (columnas nuevas nullable + tabla nueva vacía)

alter table public.noticia
  add column if not exists etiqueta text
    constraint noticia_etiqueta_valida check (etiqueta is null or etiqueta in (
      'tramitacion_legislativa','actividad_parlamentaria','ley_vigente',
      'politica_no_legislativa','no_legislativa','ambiguo'
    )),
  add column if not exists etiqueta_confianza numeric
    constraint noticia_etiqueta_confianza_rango check (
      etiqueta_confianza is null or (etiqueta_confianza >= 0 and etiqueta_confianza <= 1)
    ),
  add column if not exists etiqueta_modelo text,
  add column if not exists clasificada_en timestamptz;

-- Coherencia estado↔etiqueta: una noticia 'clasificada' SIN etiqueta sería un verde vacuo
-- (el estado afirma un trabajo cuyo resultado no existe).
alter table public.noticia
  add constraint noticia_clasificada_con_etiqueta
    check (estado <> 'clasificada' or etiqueta is not null);

-- ── llm_ledger: presupuesto observable por corrida (SC3 de 135) ─────────────────────────
create table if not exists public.llm_ledger (
  id bigint generated always as identity primary key,
  run_id text not null,
  task text not null,
  modelo text not null,
  llamadas integer not null default 0 check (llamadas >= 0),
  tokens_entrada bigint check (tokens_entrada is null or tokens_entrada >= 0),
  tokens_salida bigint check (tokens_salida is null or tokens_salida >= 0),
  costo_usd_estimado numeric check (costo_usd_estimado is null or costo_usd_estimado >= 0),
  created_at timestamptz not null default now()
);

create index if not exists llm_ledger_run_idx on public.llm_ledger (run_id);

alter table public.llm_ledger enable row level security;
revoke all on table public.llm_ledger from anon, authenticated;
