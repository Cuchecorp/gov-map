-- 0047_rebeldias_honestas.sql
-- SC5/B5 (Phase 51) — Hace HONESTO el RPC `rebeldias_de_parlamentario`. Hoy una
-- ausencia (`seleccion='ausente'`) cuenta como "votó distinto a su bancada" — una
-- insinuación falsa. La asistencia ya es métrica propia (0022); rebeldías debe medir
-- SOLO disidencia real. Tres cambios de semántica + dos de contrato:
--   (a) la mayoría de la bancada se computa EXCLUYENDO ausencias (una ausencia ajena
--       no debe mover la opción modal);
--   (b) el WHERE final EXCLUYE la ausencia propia (una ausencia PROPIA no es "votó
--       distinto");
--   (c) `distinct on (votacion_id)` deduplica por votación (datos con filas repetidas
--       de un mismo parlamentario en una votación no inflan el conteo);
--   (d) `left join public.proyecto` hidrata el `titulo` (null honesto si no hay
--       proyecto — el consumidor 51-02 muestra el título del proyecto votado);
--   (e) `etapa` se expone desde `votacion.etapa` (misma fuente que votos_de_parlamentario).
--
-- El `returns table` CRECE (añade `titulo`/`etapa`) → Postgres prohíbe `create or
-- replace` al cambiar el tipo de retorno (42P13; espejo de 0028/0041) → DROP + recreate.
-- Tras el recreate, Supabase re-concede EXECUTE por DEFAULT PRIVILEGES sobre CADA función
-- nueva de public → hay que RE-EMITIR el revoke/grant explícito para dejar el ACL
-- determinista. El RPC ES PÚBLICO desde 0019 (ya está en PUBLIC_RPC_ALLOWLIST del
-- lockdown-guard) → `grant execute ... to anon` preserva el STATUS QUO, NO abre
-- superficie nueva; el guard refinado (Task 3) lo exime por estar allowlisted.
--
-- PII-safe intacto (LEGAL-03, Ley 21.719): sigue `security definer set search_path=''`,
-- lee `parlamentario.partido` INTERNAMENTE (CTE `yo`) pero el returns table SOLO emite
-- derivado público (votacion/boletin/titulo/etapa/fecha/selección propia/mayoría). CERO
-- `create policy`, CERO `grant select` sobre `parlamentario`, JAMÁS partido/rut/email.
--
-- La última migración APLICADA en disco es 0046_drop_web_reader.sql. Esta es la 0047.
--
-- APLICACIÓN = CHECKPOINT DE OPERADOR: `tsc`/`pnpm test` NO prueban que Postgres ejecutó
-- este DDL (el RPC vive en Postgres PROD; falso positivo conocido, ver cabecera 0028). La
-- única prueba válida es el pgTAP (0047_*.test.sql) contra el schema APLICADO vía
-- `psql -tA -f`. Aplicar por `psql --db-url --single-transaction`, NUNCA `supabase db
-- push` (drift schema_migrations). PGCLIENTENCODING=UTF8 en Windows.

-- Cambiar el returns table requiere drop previo (firma de parámetro intacta).
drop function if exists rebeldias_de_parlamentario(text);

create or replace function rebeldias_de_parlamentario(p_id text)
returns table (
  votacion_id text, boletin text, titulo text, etapa text,
  fecha timestamptz, seleccion_propia text, mayoria_bancada text
)
language sql stable security definer set search_path = '' as $$
  with yo as (
    select partido from public.parlamentario where id = p_id
  ),
  mayoria as (  -- opción modal de la bancada por votación, EXCLUYENDO ausencias (a)
    select v.votacion_id,
           mode() within group (order by v.seleccion) as mayoria
    from public.voto v
    join public.parlamentario p on p.id = v.parlamentario_id
    where p.partido = (select partido from yo)
      and v.estado_vinculo = 'confirmado'
      and v.seleccion <> 'ausente'
    group by v.votacion_id
  )
  select distinct on (v.votacion_id)     -- (c) dedupe por votación
         v.votacion_id, vo.boletin, pr.titulo, vo.etapa, vo.fecha, v.seleccion, m.mayoria
  from public.voto v
  join mayoria m on m.votacion_id = v.votacion_id
  join public.votacion vo on vo.id = v.votacion_id
  left join public.proyecto pr on pr.boletin = vo.boletin   -- (d) título, null honesto
  where v.parlamentario_id = p_id
    and v.estado_vinculo = 'confirmado'
    and v.seleccion <> 'ausente'         -- (b) una ausencia PROPIA no es "votó distinto"
    and v.seleccion <> m.mayoria         -- difirió de la mayoría de su bancada
  order by v.votacion_id;
$$;

-- ── ACL determinista: lock-down + grant preciso (doble revoke/grant) ──────────
-- El drop+recreate re-concede EXECUTE por DEFAULT PRIVILEGES; `revoke all from public`
-- limpia la concesión implícita y el `grant execute to anon` re-emite EXACTAMENTE el
-- status quo de 0019 (RPC público desde su nacimiento, en PUBLIC_RPC_ALLOWLIST). NO se
-- abre superficie nueva: es el mismo canal PII-safe security-definer que ya existía.
-- CERO grant select sobre `parlamentario` (LEGAL-03).
revoke all on function rebeldias_de_parlamentario(text) from public;
grant execute on function rebeldias_de_parlamentario(text) to anon;
