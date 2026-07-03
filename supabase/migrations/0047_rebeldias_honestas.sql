-- 0047_rebeldias_honestas.sql
-- SC5/B5 (Phase 51) — Hace HONESTO el RPC `rebeldias_de_parlamentario`. Hoy una
-- ausencia (`seleccion='ausente'`) cuenta como "votó distinto a su bancada" — una
-- insinuación falsa. La asistencia ya es métrica propia (0022); rebeldías debe medir
-- SOLO disidencia real. Tres cambios de semántica + dos de contrato:
--   (a) la mayoría de la bancada se computa EXCLUYENDO ausencias (una ausencia ajena
--       no debe mover la opción modal) y SOLO cuando la opción mayoritaria es ÚNICA
--       (empate de frecuencias = NO hay mayoría = la votación se excluye; jamás se
--       fabrica una "mayoría de bancada" inexistente);
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
-- Tras el recreate, los DEFAULT PRIVILEGES del rol que aplica el DDL pueden re-conceder
-- EXECUTE sobre la función nueva → hay que RE-EMITIR el revoke explícito para dejar el
-- ACL determinista. Bajo Camino A (0044 APLICADA a PROD: `revoke all on all routines
-- from anon, authenticated`; anon REST muerta 401/42501) el sitio lee con service_role
-- (bypassa ACL) y el status quo real pre-0047 es anon SIN execute — CERO grant a anon:
-- re-emitir uno re-abriría superficie REST no autenticada y rompería el pgTAP post-apply
-- (post-apply/0044_revoke_anon.test.sql afirma NOT has_function_privilege('anon', …)).
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
  mayoria as (  -- opción MAYORITARIA ÚNICA de la bancada por votación, EXCLUYENDO
                -- ausencias (a). NO se usa mode(): ante empate de frecuencias mode()
                -- devuelve un valor arbitrario y fabricaría una "mayoría de bancada"
                -- inexistente (insinuación falsa). Sin mayoría única → la votación
                -- se EXCLUYE (having count(*) = 1: exactamente UNA opción con rank 1).
    select votacion_id, min(seleccion) as mayoria
    from (
      select v.votacion_id, v.seleccion,
             rank() over (partition by v.votacion_id order by count(*) desc) as rk
      from public.voto v
      join public.parlamentario p on p.id = v.parlamentario_id
      where p.partido = (select partido from yo)
        and v.estado_vinculo = 'confirmado'
        and v.seleccion <> 'ausente'
      group by v.votacion_id, v.seleccion
    ) conteos
    where rk = 1
    group by votacion_id
    having count(*) = 1
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

-- ── ACL determinista: lock-down sin grants (Camino A, espejo de 0044) ─────────
-- El drop+recreate puede re-conceder EXECUTE por DEFAULT PRIVILEGES según el rol que
-- aplica; el DOBLE revoke explícito (idiom 0041) limpia la concesión implícita SEA
-- CUAL SEA ese rol (los default privileges de `supabase_admin` — p.ej. SQL editor del
-- dashboard — auto-conceden a anon/authenticated y el `from public` solo no los
-- limpiaría). CERO grant a anon: el sitio lee con service_role (bypassa ACL) y anon
-- quedó a cero grants desde 0044 — este RPC debe quedar igual que el resto de las
-- rutinas de public (deny). CERO grant select sobre `parlamentario` (LEGAL-03).
revoke all on function rebeldias_de_parlamentario(text) from public;
revoke all on function rebeldias_de_parlamentario(text) from anon, authenticated;
