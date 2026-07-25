-- 0068_coincidencia_votos_par.sql
-- Phase 102 — RELACIONES P2b — RPC de similitud de votación (VSIM-02/VSIM-03).
-- Coincidencia de votos entre dos parlamentarios: cuántas de las votaciones
-- SUSTANTIVAS que ambos votaron coincidieron. GATED LEGAL (anti-DW-NOMINATE): la
-- exposición pública de esta cifra requiere `signoff: approved` en
-- docs/legal/102-LEGAL-DOSSIER-VSIM.md + el flip humano de VSIM_PUBLIC_ENABLED.
-- ESCRITA en Plan 01 (Wave 0) para que la entrada `coincidencia_votos_par` del
-- PUBLIC_RPC_ALLOWLIST no quede huérfana en el guard Direction-B (allowlist ⊆
-- definidas). Se APLICA a PROD (Plan 02) y se CONSUME (5º eje de /comparar) en Plan
-- 03, con su pgTAP `supabase/tests/0068_*.test.sql` contra el schema aplicado.
--
-- ── DISEÑO LOCKED (102-RESEARCH §Pattern 2 + Discretion) ─────────────────────────
-- returns table = EXACTAMENTE 3 columnas AGREGADAS (n_coinciden, m_compartidas,
-- fecha_captura_max) — NUNCA una lista per-votación (fuera de alcance, diferido: una
-- lista voto-a-voto es máquina de sospechas). El caveat de base-alta (la coincidencia
-- alta es la NORMA, no una señal) pesa MÁS que la cifra; el % lo redondea el server.
-- Filtro SUSTANTIVA: `seleccion in ('si','no','abstencion')` sobre
-- `estado_vinculo = 'confirmado'` — pareo/ausente/no_confirmado NO cuentan en el
-- denominador. `votacion.boletin` es NOT NULL con FK→proyecto, así que toda votación
-- ya es "de un proyecto de ley" (no hace falta join extra a proyecto).
--
-- ── DEDUPE POR (votacion, parlamentario) (WR-01, re-apply) ───────────────────────
-- El unique real de `voto` es (votacion_id, fuente_voter_id) — NO
-- (votacion_id, parlamentario_id) (0009). La resolución de identidad puede producir
-- DOS filas confirmadas para la misma persona en la misma votación (p.ej. canal
-- Cámara-id + canal Senado nombre-probable flipeado a confirmado). Un join crudo
-- multiplicaría filas e inflaría N y M en silencio. Cada CTE agrupa por votacion_id
-- y EXCLUYE del numerador Y del denominador toda votación donde la misma persona
-- tenga selecciones en conflicto (`having count(distinct seleccion) = 1`): duplicado
-- concordante colapsa a 1 fila; duplicado contradictorio = dato no confiable → fuera
-- (honesto y determinista; jamás elegir una fila al azar bajo cifra pública gated).
--
-- ── ORDEN DE APPLY / COMANDO (Plan 02) ───────────────────────────────────────────
-- Última migración = 0067. Ésta es la 0068 y se aplica DESPUÉS:
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f \
--     supabase/migrations/0068_coincidencia_votos_par.sql
-- NUNCA `supabase db push` (drift de schema_migrations). La ÚNICA prueba válida del
-- DDL es el pgTAP contra el schema APLICADO (Pitfall 6, precedente 0060/0061/0067).
--
-- ── ACL (Camino A, post-0044): CERO grant ────────────────────────────────────────
-- El sitio ejecuta con service_role (bypassa ACL/RLS). Doble-revoke explícito VERBATIM
-- de 0067 para limpiar los DEFAULT PRIVILEGES que Postgres re-concede sobre funciones
-- nuevas de `public`. NUNCA re-emitir grant. Molde 0067 COMPLETO: security definer,
-- search_path = '' con nombres schema-qualified, statement_timeout = '5s' (cota DoS;
-- benchmark 28ms), parámetros parametrizados. Cero rut/email/seleccion crudo en el
-- returns table (solo agregados).

drop function if exists public.coincidencia_votos_par(text, text);

create or replace function public.coincidencia_votos_par(p_a text, p_b text)
returns table (n_coinciden bigint, m_compartidas bigint, fecha_captura_max timestamptz)
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'
as $$
  with a as (
    select v.votacion_id, min(v.seleccion) as seleccion
    from public.voto v
    where v.parlamentario_id = p_a
      and p_a <> p_b                                -- IN-01: self-pair → (0, 0, null), nunca un 100% trivial
      and v.estado_vinculo = 'confirmado'
      and v.seleccion in ('si','no','abstencion')   -- SUSTANTIVA: pareo/ausente excluidos
    group by v.votacion_id
    having count(distinct v.seleccion) = 1          -- WR-01: dedupe; conflicto → fuera de N y M
  ),
  b as (
    select v.votacion_id, min(v.seleccion) as seleccion
    from public.voto v
    where v.parlamentario_id = p_b
      and v.estado_vinculo = 'confirmado'
      and v.seleccion in ('si','no','abstencion')   -- SUSTANTIVA: pareo/ausente excluidos
    group by v.votacion_id
    having count(distinct v.seleccion) = 1          -- WR-01: dedupe; conflicto → fuera de N y M
  )
  select
    count(*) filter (where a.seleccion = b.seleccion) as n_coinciden,
    count(*)                                          as m_compartidas,
    (select max(vt.fecha_captura)
       from public.votacion vt
       where vt.id in (select votacion_id from a intersect select votacion_id from b)) as fecha_captura_max
  from a join b using (votacion_id);
$$;

revoke all on function public.coincidencia_votos_par(text, text) from public;
revoke all on function public.coincidencia_votos_par(text, text) from anon, authenticated;
