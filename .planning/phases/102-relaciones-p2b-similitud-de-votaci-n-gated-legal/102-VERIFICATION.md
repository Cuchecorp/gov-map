---
phase: 102-relaciones-p2b-similitud-de-votaci-n-gated-legal
verified: 2026-07-24T23:45:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
requirements_coverage:
  - id: VSIM-01
    status: satisfied
  - id: VSIM-02
    status: satisfied
  - id: VSIM-03
    status: satisfied
human_verification: []
info_notes:
  - "IN-04 (REVIEW, non-blocking): dossier §1/§8 aún citan 'pgTAP 10/10' mientras §5 dice '14/14'. El pgTAP real pasa 14/14 contra PROD (verificado en vivo). Inconsistencia interna del documento que un humano firma — recomendable corregir §1/§8 a 14/14 antes del sign-off, pero NO bloquea el goal."
  - "IN-02 / IN-05 (REVIEW): Info abiertos por decisión explícita del operador (contrato de props pct===null; dedupe sustantiva/pareo). No bloquean."
  - "Flip VSIM_PUBLIC_ENABLED=true es acto humano fuera de alcance (signoff: pending es el end-state CORRECTO). Deploy/BrowserOS E2E flags-OFF pertenece a Phase 104."
---

# Phase 102: RELACIONES P2b — Similitud de votación (gated legal) Verification Report

**Phase Goal:** Añadir el eje "coinciden en N de M votaciones" que el operador re-pide, con el caveat de base-alta obligatorio y detrás de un flag deny-by-default — el dato está listo, el encendido es acto humano.
**Verified:** 2026-07-24T23:45:00Z
**Status:** passed
**Re-verification:** No — initial verification (post fix-loop b1f69cb..75c402a)

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + PLAN must-haves)

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Métrica factual pairwise "coinciden en N de M" con denominador honesto (solo votaciones sustantivas donde AMBOS votaron) + caveat base-alta OBLIGATORIO; nunca score/ranking/eje/mapa (anti-DW-NOMINATE) | ✓ VERIFIED | RPC 0068 en PROD emite 3 agregados (`n_coinciden/m_compartidas/fecha_captura_max`), filtro `estado_vinculo='confirmado' AND seleccion in ('si','no','abstencion')`, dedupe WR-01 `having count(distinct seleccion)=1`. pgTAP **14/14** vivo (tests 8-13 prueban denominador sustantiva + dedupe). Componente: figura `text-sm` weight-400, cero `font-semibold`/`text-accent-product`/gauge; caveat `LEYENDA_SIMILITUD_VOTO` precede la figura |
| 2 | Similitud en `/comparar` SOLO vía `VSIM_PUBLIC_ENABLED` fail-closed OFF; guard CI impide flip por agente; flip = sign-off legal humano | ✓ VERIFIED | `vsim-gate.ts` = `=== "true"` con `import "server-only"`; page.tsx: `return null` ANTES del `.rpc` con flag OFF (línea 501-537); `.env.example=false`; flag ausente de `.env` (fail-closed). vsim-antiflip-guard V1/V2/V3 + self-check 20 tests verde. Dossier `signoff: pending` |
| 3 | Linter anti-insinuación extendido ANTES del copy: idioms vetados + leyenda en NEGACIONES_LOCKED + mutation self-check | ✓ VERIFIED | `anti-insinuacion-guard.test.ts`: `SUPERFICIES_VSIM` en el scan loop (:616), idioms nuevos ("votan juntos", "tasa de coincidencia", "señal", "aliados"…), `LEYENDA_SIMILITUD_VOTO` importada del componente real y restada de NEGACIONES_LOCKED (:543), mutation self-check por idiom (:860) + no-falso-positivo sobre la leyenda. 32 tests verde |
| 4 | `co_votacion` JAMÁS entra a /red (verificable en el diff) | ✓ VERIFIED | Ramas muertas borradas de red-graph.tsx (TIPO_LABEL) y arista-hecho.tsx (case). Única mención restante = 1 comentario de documentación de la exclusión. `co-votacion-red-guard.test.ts` (14 tests, scan estático permanente strip-comments TS/SQL + prosa-voto WR-03) verde |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/lib/vsim-gate.ts` | chokepoint `=== "true"` server-only | ✓ VERIFIED | `env.VSIM_PUBLIC_ENABLED === "true"`, `import "server-only"` línea 1 |
| `supabase/migrations/0068_coincidencia_votos_par.sql` | DDL RPC secdef 3-col + doble-revoke | ✓ VERIFIED | Escrita + APLICADA a PROD; secdef, search_path='', timeout=5s, doble-revoke, dedupe WR-01, self-pair IN-01 |
| `supabase/tests/0068_*.test.sql` | pgTAP contrato + denominador | ✓ VERIFIED | 14/14 verde contra schema APLICADO (ejecutado por el verificador, no SUMMARY) |
| `app/components/similitud-votacion-comparar.tsx` | LEYENDA + componente NEUTRAL | ✓ VERIFIED | Constante verbatim + componente puro; figura sin acento; M=0 degradado honesto (nunca "0%") |
| `app/app/comparar/page.tsx` | 5ª sección gated, último sibling | ✓ VERIFIED | `vsimPublicEnabled(process.env)` único lector; return null pre-rpc; error THROWS; `{ejeSimilitud}` último sibling |
| `docs/legal/102-LEGAL-DOSSIER-VSIM.md` | signoff: pending + anti-DW-NOMINATE | ✓ VERIFIED | `signoff: pending`, caveat verbatim, base-rate empírica, anti-modelo DW-NOMINATE §3, cobertura 80/20 |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| page.tsx | vsim-gate.ts | `import { vsimPublicEnabled }` (único lector) | ✓ WIRED |
| page.tsx | coincidencia_votos_par (RPC 0068) | `sb.rpc("coincidencia_votos_par")` gated | ✓ WIRED |
| page.tsx | SimilitudVotacionComparar | render con valores server-resueltos | ✓ WIRED |
| anti-insinuacion-guard.test.ts | similitud-votacion-comparar.tsx | `import { LEYENDA_SIMILITUD_VOTO }` en NEGACIONES_LOCKED | ✓ WIRED |
| lockdown-guard.test.ts | 0068 migration | allowlist Direction-B (allowlist ⊆ definidas) | ✓ WIRED |
| 0068 migration | schema PROD aplicado | psql --single-transaction | ✓ WIRED (regprocedure resuelve en PROD) |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Produces Real Data | Status |
| -------- | ---- | ------ | ------------------ | ------ |
| SimilitudVotacionComparar | n/m/pct | `sb.rpc("coincidencia_votos_par")` → `public.voto` (DB query) | ✓ (RPC probada en vivo con par real: n=3655≤m=3672) | ✓ FLOWING (gated OFF en PROD por diseño) |

### Probe / Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| RPC existe en PROD con contrato correcto | `psql … pg_get_function_result(…::regprocedure)` | `TABLE(n_coinciden bigint, m_compartidas bigint, fecha_captura_max timestamp with time zone)`, prosecdef=t, search_path/timeout set | ✓ PASS |
| anon/authenticated SIN execute | `has_function_privilege(...)` | `f\|f` | ✓ PASS |
| pgTAP contra schema aplicado | `psql -tA -f supabase/tests/0068_*.test.sql` | `1..14`, 14 ok, 0 not ok | ✓ PASS |
| Guard/gate/RTL suites | `vitest run` (6 spec files) | 6 files, 115 tests passed | ✓ PASS |
| Flag OFF en PROD | grep `.env` / `.env.example` | ausente en `.env` (fail-closed OFF); `.env.example=false` | ✓ PASS |
| Sin debt markers / flip en código | grep TBD/FIXME/XXX + `=true` | 0 hits | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| VSIM-01 | 102-02, 102-03 | Métrica factual N/M + caveat base-alta anti-DW-NOMINATE | ✓ SATISFIED | RPC 0068 aplicada + pgTAP 14/14; componente neutral + caveat verbatim |
| VSIM-02 | 102-01, 102-03 | Flag deny-by-default + sign-off legal humano | ✓ SATISFIED | vsim-gate `=== "true"` + anti-flip guard + dossier pending; PROD OFF |
| VSIM-03 | 102-01 | Linter anti-insinuación + co_votacion∉/red | ✓ SATISFIED | Linter extendido (32 tests) + co-votacion-red-guard (14 tests) |

REQUIREMENTS.md maps VSIM-01/02/03 to Phase 102 (all marked Complete). No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| docs/legal/102-LEGAL-DOSSIER-VSIM.md | 57, 245 | "pgTAP 10/10" stale (§5 dice 14/14) | ℹ️ Info | Inconsistencia interna del documento firmable; el pgTAP real pasa 14/14 (verificado). No bloquea el goal — corregir antes del sign-off humano |

No blockers, no debt markers, no flag flip in production code.

### Human Verification Required

None for phase-102 goal achievement. The following are explicitly OUT of scope for this phase:
- **Flip `VSIM_PUBLIC_ENABLED=true`** — human act gated on `signoff: approved` in the dossier. `signoff: pending` + PROD OFF + DOM absence is the CORRECT end state, not a gap.
- **Deploy / BrowserOS E2E flags-OFF** — belongs to Phase 104 (E2E flags-off).

### Gaps Summary

No gaps. All 4 ROADMAP success criteria are observably true in the current codebase (post fix-loop):
1. The metric is factual, pairwise, with an honest substantive denominator (proven live by pgTAP 14/14 including dedupe/pareo-exclusion), rendered neutrally with the mandatory base-rate caveat preceding the figure.
2. The surface is gated by a fail-closed `=== "true"` chokepoint, frozen by the anti-flip guard (V1/V2/V3 + self-check), PROD is OFF, and the dossier `signoff: pending` correctly makes the flip a human act.
3. The anti-insinuación linter was extended before the copy with new VSIM idioms, the leyenda subtracted from NEGACIONES_LOCKED, and mutation self-checks.
4. `co_votacion` is absent from /red code (only a documentation comment remains), enforced by a permanent static guard.

One non-blocking Info (IN-04): the dossier's own pgTAP count is internally inconsistent (10/10 vs 14/14). Recommend the operator correct §1/§8 to 14/14 before signing, since the dossier is the human-signed artifact — but this does not affect goal achievement.

---

_Verified: 2026-07-24T23:45:00Z_
_Verifier: Claude (gsd-verifier)_
_Evidence: pgTAP 14/14 vs PROD applied schema (live) · vitest 115/115 (6 phase-102 specs) · RPC contract + ACL verified live · flag OFF in PROD_
