---
phase: 49-acomp-comparativo-de-ausencias-vs-c-mara
plan: 01
subsystem: cruces / superficie de ausencia comparada
tags: [rpc, security-definer, viz-03, pgtap, camino-a, legal-03]
requires:
  - "public.parlamentario (0005) + public.voto (0008/0009) aplicadas en PROD"
  - "Camino A (0044) aplicado: anon a cero grants"
provides:
  - "RPC public.tasa_ausencia_comparada(text) — ESCRITA, NO aplicada (apply = Plan 03)"
  - "pgTAP 0050 del contrato + datos con cohorte determinista (rollback)"
  - "AusenciaContextoRow (app/lib/types.ts) — shape plano PII-safe para el Server Component (Plan 02)"
  - "tasa_ausencia_comparada en PUBLIC_RPC_ALLOWLIST (guard B)"
affects:
  - "Plan 49-02 (UI): consumirá la RPC vía service_role y AusenciaContextoRow"
  - "Plan 49-03 (operador): apply de 0050 + pgTAP contra schema aplicado"
tech-stack:
  added: []
  patterns:
    - "RPC security definer PII-safe espejo VERBATIM de 0049 (doble revoke, CERO grant, search_path='')"
    - "guard div/0 estructural via having count(*)>=1 (M=0 => 0 filas, empty honesto)"
    - "pgTAP con delete-en-tx para aislar cohorte de la mediana (rollback restaura PROD)"
key-files:
  created:
    - supabase/migrations/0050_tasa_ausencia_comparada.sql
    - supabase/tests/0050_tasa_ausencia_comparada.test.sql
  modified:
    - app/lib/types.ts
    - app/lib/lockdown-guard.test.ts
decisions:
  - "Universo = estado_vinculo='confirmado' + parlamentario_id not null (espejo IDENT-12 de 0049), verificado contra PROD"
  - "Ausencia = voto.seleccion='ausente' (verificado: 546 filas en PROD); NO fila faltante"
  - "mediana_camara y tasa_propia emitidas como RATIO [0,1]; el % 1-decimal es-CL vive en Plan 02"
  - "mediana_camara nullable en TS por honestidad (Plan 02 omite la línea si null), aunque en la práctica viene poblada cuando hay fila"
  - "pgTAP aísla la cohorte con delete from public.voto dentro de la tx (rollback): sin él la mediana/K se contaminan con los ~21k votos PROD reales"
metrics:
  duration: ~35min
  tasks: 3
  files: 4
  completed: 2026-07-07
---

# Phase 49 Plan 01: RPC tasa_ausencia_comparada Summary

RPC `tasa_ausencia_comparada(text)` PII-safe (security definer, doble revoke, CERO grant) que entrega la tasa de ausencia propia de un parlamentario más la mediana de su cámara como contexto factual neutro — escrita y pineada por pgTAP, NO aplicada (apply = checkpoint operador Plan 03) — más el tipo `AusenciaContextoRow` y la entrada de allowlist que el frontend (Plan 02) consumirá.

## Qué se construyó

- **`0050_tasa_ausencia_comparada.sql`** (escrita, NO aplicada): RPC `language sql stable security definer set search_path=''`, espejo VERBATIM del idiom ACL Camino A de 0049 (doble revoke `from public` + `from anon, authenticated`, CERO grant). Contrato de 6 columnas en orden posicional pineado: `n_ausencias, m_votaciones, tasa_propia, mediana_camara, k_parlamentarios, camara`. Lógica: `subj` resuelve la cámara del sujeto; `per_parl` cuenta ausencias/votaciones por parlamentario de esa cámara (confirmados + `parlamentario_id not null`, `having count(*) >= 1`); `propio` = fila del sujeto; `cohorte` = `percentile_cont(0.5)` de la tasa + `count(*)`. Guard div/0 estructural (M≥1 garantizado por el `having` → si el sujeto no vota, `propio` vacío → 0 filas, empty honesto).
- **`0050_tasa_ausencia_comparada.test.sql`**: pgTAP `plan(10)` — contrato (has_function, orden de columnas, `prosecdef`, `search_path=`, anon-no-execute, no-PII `partido|rut|email`) + datos con cohorte determinista `{0.25, 0.50, 0.75}` → mediana 0.50, K=3, más el caso M=0 (0 filas). Aísla la cohorte con `delete from public.voto` dentro de la tx (rollback restaura PROD).
- **`AusenciaContextoRow`** (types.ts): forma plana PII-safe, `mediana_camara: number | null`, `camara: "diputados" | "senado"`, JSDoc que aclara ratio [0,1] y la regla de omisión honesta.
- **allowlist** (lockdown-guard.test.ts): `"tasa_ausencia_comparada"` en orden alfabético (entre `subgrafo_red` y `votos_de_parlamentario`) para el guard B.

## Números PROD verificados (evidencia del pgTAP y del contrato)

Verificado por `psql` READ-ONLY contra PROD (`PGCLIENTENCODING=UTF8`), SOLO SELECT — CERO DDL/DML.

| Hecho | Valor verificado |
|-------|------------------|
| Fuente de la ausencia | `voto.seleccion='ausente'` — distribución PROD: `si\|12636  no\|7972  ausente\|546  abstencion\|425  pareo\|23` |
| Cámara del parlamentario | `public.parlamentario.camara`: `diputados\|155  senado\|31` (CHECK a `('diputados','senado')`) |
| D1012 — cámara | `diputados` |
| D1012 — M (votos confirmados) | **141** |
| D1012 — N (ausencias confirmadas) | **1** |
| D1012 — tasa_propia (N/M) | **0.007092** (≈ 0,71%) |
| Mediana de la cámara (diputados) | **0.007353** (≈ 0,74%) |
| K (diputados con ≥1 voto confirmado) | **155** |

**Universo LOCKED**: `estado_vinculo='confirmado'` + `parlamentario_id is not null` (espejo IDENT-12 de 0049). D1012 tiene M=141 > 0, así que la RPC devuelve fila (la UI muestra el bloque). El cuerpo de la RPC fue simulado inline contra PROD (read-only) y devolvió exactamente `1 | 141 | 0.007092 | 0.007353 | 155 | diputados`, confirmando la lógica antes de escribir el DDL.

Nota factual: D1012 queda casi sobre la mediana de su cámara (0,71% vs 0,74%) — el bloque comparativo se lee como "en línea con la referencia", exactamente el tipo de contexto neutro que VIZ-03 busca (un 0,7% aislado no dice nada).

## Desviaciones del plan

**Ninguna que altere el contrato.** Hallazgos técnicos aplicados dentro del alcance:

1. **[Rule 3 - Blocking] `voto.fuente_voter_id` NOT NULL sin default en el fixture.** El fixture del pgTAP debe proveer `fuente_voter_id` (NOT NULL desde 0009, más unique `(votacion_id, fuente_voter_id)`) — el test de 0049 lo omite (bug latente de 0049, FUERA de alcance, no tocado). El fixture de 0050 lo suministra explícito (= id del parlamentario, único por votación). Verificado contra PROD que `id` es `GENERATED ALWAYS AS IDENTITY` (no se provee).
2. **[Rule 2 - Correctness] Aislamiento de la cohorte en el pgTAP.** La mediana se computa sobre TODA la cámara; contra PROD-aplicado los ~21k votos reales contaminarían los asserts de datos. El fixture hace `delete from public.voto` dentro de la transacción (rollback → PROD intacto). Verificado que nada referencia `public.voto` (0 FKs entrantes, 0 triggers), así que el delete-en-tx es limpio. La cámara no admite un valor de prueba aislante (CHECK a diputados/senado).

## Autenticación / gates

Ninguno. `psql` READ-ONLY disponible con `SUPABASE_DB_URL` del `.env`.

## Verificación

- Guard `node` de Task 2: **OK** (RPC + security definer + search_path='' + doble revoke + CERO grant; pgTAP con contrato + no-PII + rollback).
- `npx tsc --noEmit`: **limpio** (exit 0).
- `npx vitest run lib/lockdown-guard.test.ts`: **8/8 verde** (allowlist nueva sin romper el guard).
- Cuerpo de la RPC simulado contra PROD (read-only) = números de D1012 documentados.
- **NINGUNA migración aplicada** (apply = checkpoint operador, Plan 03).

## Known Stubs

Ninguno. La RPC es funcional-completa; su apply es un checkpoint de operador (Plan 03), no un stub.

## Self-Check: PASSED

- Archivos creados/modificados: 5/5 FOUND (0050 .sql, 0050 .test.sql, types.ts, lockdown-guard.test.ts, 49-01-SUMMARY.md).
- Commits: 2/2 FOUND (2e04dd4 Task 2, 301f366 Task 3).
