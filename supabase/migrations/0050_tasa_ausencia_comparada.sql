-- 0050_tasa_ausencia_comparada.sql
-- VIZ-03 (Phase 49 — acomp-comparativo-de-ausencias-vs-camara) — RPC
-- `tasa_ausencia_comparada(p_parlamentario_id text)`: la única vía pública PII-safe que
-- entrega el CONTEXTO FACTUAL de asistencia de un parlamentario junto con la referencia
-- de su cámara, para que un "0,7% de ausencia" no se lea en el vacío:
--   (1) la tasa de ausencia PROPIA del sujeto — `n_ausencias / m_votaciones` sobre sus
--       votos confirmados (`voto.seleccion='ausente'` / total de sus votos confirmados), y
--   (2) la MEDIANA de la misma tasa entre los parlamentarios de SU MISMA cámara con ≥1
--       voto confirmado (`percentile_cont(0.5)`), más `k_parlamentarios` = tamaño de esa
--       cohorte y `camara` = la del sujeto.
-- Es contexto NEUTRO: la RPC solo devuelve conteos y ratios; NO emite adjetivo, color,
-- ranking ni veredicto. El % con 1 decimal es-CL y el caveat anti-veredicto viven en la
-- UI (Plan 02). NO hay flag nuevo (`*_PUBLIC_ENABLED`): esta ruta se sirve por
-- service_role como el resto de las superficies factuales; este DDL NO toca ningún flag.
--
-- POR QUÉ security definer (LEGAL-03, Ley 21.719): la RPC LEE INTERNAMENTE
-- `public.parlamentario` (deny-by-default: RLS on, cero policies, anon sin grant) para
-- resolver la cámara del sujeto y delimitar la cohorte, y `public.voto` (deny-by-default)
-- para contar ausencias/votaciones. Pero el returns table SOLO emite derivado público:
-- conteos (`n_ausencias`, `m_votaciones`, `k_parlamentarios`), ratios neutros
-- (`tasa_propia`, `mediana_camara` en [0,1]) y `camara` (catálogo público). JAMÁS
-- partido/rut/email/nombre. CERO `create policy`, CERO `grant select` sobre
-- `parlamentario`/`voto`.
--
-- FUENTE DE LA AUSENCIA = `voto.seleccion = 'ausente'` (VERIFIED psql PROD 2026-07-07:
-- distribución seleccion → si|12636 no|7972 ausente|546 abstencion|425 pareo|23; la
-- ausencia se registra como una selección más del roll-call, NO como fila faltante).
-- CÁMARA = `public.parlamentario.camara` (VERIFIED: diputados|155 senado|31; CHECK
-- constraint a ('diputados','senado')).
--
-- UNIVERSO = `estado_vinculo='confirmado'` + `parlamentario_id is not null` (espejo
-- IDENT-12 de 0049): un voto Senado por-nombre no confirmado NUNCA entra en el conteo
-- (estado honesto — no se atribuye una ausencia por adivinanza). Números reales de D1012
-- bajo este universo (VERIFIED PROD): M=141 votos confirmados, N=1 ausente,
-- tasa_propia=0.007092 (0,71%); mediana diputados=0.007353 (0,74%) sobre K=155.
--
-- GUARD división por cero: la cohorte `per_parl` exige `having count(*) >= 1`, así que
-- `m_votaciones >= 1` SIEMPRE para toda fila del set → `n/m` nunca es NaN/Inf. Si el
-- sujeto no tiene votos confirmados (M=0) NO aparece en `per_parl` → el CTE `propio`
-- queda vacío → la RPC devuelve 0 filas (empty honesto; la UI omite el bloque). Idéntico
-- si `p_parlamentario_id` no existe → `subj` vacío → 0 filas.
--
-- La última migración en disco es 0049_cruces_de_proyecto.sql. Esta es la 0050.
-- La RPC es NUEVA; `drop function if exists` previo es idiom defensivo (gotcha 42P13).
--
-- ── ACL determinista (Camino A, espejo VERBATIM de 0049:38-46) ──
-- Bajo Camino A (0044 APLICADA a PROD: `revoke all on all routines from anon,
-- authenticated`; anon REST muerta 401/42501) el sitio lee con service_role (bypassa
-- ACL) y anon quedó a CERO grants. El DOBLE revoke explícito (`from public` +
-- `from anon, authenticated`) limpia la concesión que los DEFAULT PRIVILEGES del rol de
-- aplicación re-conceden sobre cada función NUEVA de public → deja el ACL determinista
-- SEA CUAL SEA ese rol. CERO grant: re-emitir uno re-abriría superficie REST no
-- autenticada y rompería el pgTAP post-apply de 0044 y el guard CI Block-A
-- (lockdown-guard.test.ts, sin excepciones).
--
-- APLICACIÓN = CHECKPOINT DE OPERADOR (Plan 03, patrón 52-06): `tsc`/`pnpm test` NO
-- prueban que Postgres ejecutó este DDL (falso positivo conocido, ver 0028/0047/0048/0049).
-- La única prueba válida es el pgTAP (0050_*.test.sql) contra el schema APLICADO vía
-- `psql -tA -f`. Aplicar por `psql --db-url --single-transaction`, NUNCA `supabase db
-- push` (drift schema_migrations). PGCLIENTENCODING=UTF8 en Windows. La UI (Plan 02)
-- degrada honesta pre-apply (la RPC aún no existe en PROD → PGRST202 → null).

-- La RPC es nueva; drop defensivo previo al create (idiom 42P13, re-armar revokes después).
drop function if exists public.tasa_ausencia_comparada(text);

create or replace function public.tasa_ausencia_comparada(p_parlamentario_id text)
returns table (
  n_ausencias      int,        -- ausencias del sujeto (voto.seleccion='ausente' confirmadas)
  m_votaciones     int,        -- total de votos confirmados del sujeto (>=1 si hay fila)
  tasa_propia      numeric,    -- n/m en [0,1] (el % 1-decimal es-CL lo hace la UI)
  mediana_camara   numeric,    -- percentile_cont(0.5) de la tasa en la cohorte, en [0,1]
  k_parlamentarios int,        -- tamaño de la cohorte (misma cámara, >=1 voto confirmado)
  camara           text        -- 'diputados' | 'senado' (catálogo público del sujeto)
)
language sql stable security definer set search_path = '' as $$
  -- Cámara del sujeto (deny-by-default: se lee INTERNAMENTE, jamás se emite el resto de
  -- la fila). Sujeto inexistente → CTE vacío → 0 filas (empty honesto).
  with subj as (
    select p.camara
    from public.parlamentario p
    where p.id = p_parlamentario_id
  ),
  -- Cohorte: una fila por parlamentario de la MISMA cámara del sujeto, con su conteo de
  -- ausencias y de votaciones. SOLO confirmados + parlamentario_id not null (IDENT-12:
  -- no se arrastran votos Senado por-nombre no confirmados). `having count(*) >= 1`
  -- garantiza m_votaciones >= 1 → n/m nunca divide por cero (empty honesto si M=0).
  per_parl as (
    select v.parlamentario_id,
           count(*)::int                                        as m,
           count(*) filter (where v.seleccion = 'ausente')::int as n
    from public.voto v
    join public.parlamentario p on p.id = v.parlamentario_id
    join subj on subj.camara = p.camara
    where v.estado_vinculo = 'confirmado'
      and v.parlamentario_id is not null
    group by v.parlamentario_id
    having count(*) >= 1
  ),
  -- Propio: la fila del sujeto dentro de la cohorte (0 filas si M=0 → empty honesto).
  propio as (
    select n, m
    from per_parl
    where parlamentario_id = p_parlamentario_id
  ),
  -- Referencia de la cámara: mediana de la tasa (ratio [0,1]) y tamaño de la cohorte.
  -- IMPORTANTE (IN-03): `mediana_camara` es la mediana de las TASAS INDIVIDUALES
  -- (n/m por parlamentario), NO la tasa agregada/pooled (Σn/Σm). Es la tasa del
  -- colega mediano — lo que un lector intuye por "mediana de su cámara". NO cambiar a
  -- pooled: alteraría silenciosamente toda mediana publicada cuando los m difieren.
  cohorte as (
    select
      percentile_cont(0.5) within group (order by n::numeric / m) as mediana,
      count(*)::int                                              as k
    from per_parl
  )
  select
    propio.n                       as n_ausencias,
    propio.m                       as m_votaciones,
    (propio.n::numeric / propio.m) as tasa_propia,     -- m >= 1 por el having → sin div/0
    cohorte.mediana                as mediana_camara,
    cohorte.k                      as k_parlamentarios,
    subj.camara                    as camara
  from propio
  cross join cohorte
  cross join subj;
$$;

-- ── ACL determinista: lock-down sin grants (Camino A, espejo de 0049) ──
-- Función NUEVA → los DEFAULT PRIVILEGES pueden conceder EXECUTE por defecto; el DOBLE
-- revoke explícito lo limpia. CERO grant a anon/public: el sitio lee con service_role.
revoke all on function public.tasa_ausencia_comparada(text) from public;
revoke all on function public.tasa_ausencia_comparada(text) from anon, authenticated;
