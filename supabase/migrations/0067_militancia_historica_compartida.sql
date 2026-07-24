-- 0067_militancia_historica_compartida.sql
-- Phase 101 — RELACIONES P2a — RPC del 5º bloque cross-link "Compartieron
-- militancia en un partido" (REL-04). ESCRITA en Plan 02 (Wave 0) para que la
-- entrada `militancia_historica_compartida` del PUBLIC_RPC_ALLOWLIST no quede
-- huérfana en el guard Direction-B (allowlist ⊆ definidas). Se APLICA a PROD y se
-- CONSUME (ficha 5º bloque + eje de /comparar) en Plan 03, con su pgTAP
-- `supabase/tests/0067_*.test.sql` (mirror 0061) contra el schema aplicado.
--
-- ── DECISIÓN LOCKED (101-01 audit §4): NET-NEW-ONLY (696), no shared-ever (1966) ──
-- El bloque debe AÑADIR información que "Del mismo partido" (copartidarios vigentes)
-- NO da. Por eso se EXCLUYEN los pares que YA comparten el partido de la militancia
-- VIGENTE (m1.es_actual ∧ m2.es_actual mismo alias) — esos ya salen en
-- `copartidarios_de_parlamentario` (0061). Lo que este RPC muestra es EXCLUSIVAMENTE
-- militancia compartida HISTÓRICA que no se solapa con el vínculo vigente:
--   compartieron un partido (por partido_alias) en ALGÚN momento
--   Y NO comparten hoy el partido de la militancia vigente.
--
-- ── Pitfall 1 (101, LOCKED): cruzar por partido_alias, NUNCA por display ──────────
-- DC/Liberal/PPD mapean un mismo display a DOS `partido_alias` → un match por el
-- string de display sobre/sub-cuenta. El join va SIEMPRE por `m2.partido_alias =
-- m1.partido_alias`. `partido_alias` es INTERNO → jamás se proyecta (solo id/nombre/
-- camara/total_n, como los cross-links de 0061).
--
-- ── ORDEN DE APPLY / COMANDO (Plan 03) ───────────────────────────────────────────
-- Última migración aplicada = 0066. Ésta es la 0067 y se aplica DESPUÉS:
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f \
--     supabase/migrations/0067_militancia_historica_compartida.sql
-- NUNCA `supabase db push` (drift de schema_migrations). La ÚNICA prueba válida del
-- DDL es el pgTAP contra el schema APLICADO (Pitfall 6, precedente 0060/0061).
--
-- ── ACL (Camino A, post-0044): CERO grant ────────────────────────────────────────
-- El sitio ejecuta con service_role (bypassa ACL/RLS). Doble-revoke explícito
-- VERBATIM de 0061 para limpiar los DEFAULT PRIVILEGES que Postgres re-concede sobre
-- funciones nuevas de `public`. NUNCA re-emitir grant. security definer set
-- search_path = '' con nombres schema-qualified; p_id parametrizado; LIMIT bounded.
-- Cero rut/email/partido_alias en el returns table.

drop function if exists public.militancia_historica_compartida(text);

create or replace function public.militancia_historica_compartida(p_id text)
returns table (id text, nombre text, camara text, total_n bigint)
language sql stable security definer set search_path = '' as $$
  -- NET-NEW-ONLY: distinct on (p2.id) envuelto + re-ordenado por nombre → cada
  -- parlamentario aparece EXACTAMENTE una vez. total_n = conteo COMPLETO (sobre el
  -- conjunto deduplicado, antes del limit) = el conteo honesto que la ficha muestra.
  select d.id, d.nombre, d.camara, count(*) over () as total_n
  from (
    select distinct on (p2.id)
           p2.id,
           coalesce(
             nullif(trim(concat_ws(' ', p2.nombres, p2.apellido_paterno, p2.apellido_materno)), ''),
             p2.nombre_normalizado
           ) as nombre,
           p2.camara
    from public.parlamentario_militancia m1
    join public.parlamentario_militancia m2
      on m2.partido_alias = m1.partido_alias          -- KEY on ALIAS not display (Pitfall 1)
     and m2.parlamentario_id <> m1.parlamentario_id
    join public.parlamentario p2 on p2.id = m2.parlamentario_id
    where m1.parlamentario_id = p_id
      and p2.id <> p_id
      -- NET-NEW (101-01 §4): EXCLUIR los pares que ya comparten el partido de la
      -- militancia VIGENTE de ambos — esos ya salen en copartidarios (0061). Un par
      -- cuenta como histórico-neto si NO existe un alias que ambos tengan es_actual.
      and not exists (
        select 1
        from public.parlamentario_militancia mv1
        join public.parlamentario_militancia mv2
          on mv2.partido_alias = mv1.partido_alias
         and mv2.parlamentario_id = m2.parlamentario_id
         and mv2.es_actual = true
        where mv1.parlamentario_id = p_id
          and mv1.es_actual = true
      )
    order by p2.id
  ) d
  order by d.nombre
  limit 20;
$$;

revoke all on function public.militancia_historica_compartida(text) from public;
revoke all on function public.militancia_historica_compartida(text) from anon, authenticated;
