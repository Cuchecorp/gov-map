---
phase: 93-agenda-p2d-auditor-a-de-cobertura-de-citaciones-gate-duro-
verified: 2026-07-22T00:00:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: "Initial verification. 93-REVIEW.md (code review, status: fixed) preceded but is not a VERIFICATION.md; no gaps carried."
---

# Phase 93: AGENDA P2d — AUDITORÍA de cobertura de citaciones (GATE duro de 94) Verification Report

**Phase Goal:** Medir qué se scrapea hoy vs qué publica cada fuente ANTES de tocar UI — un calendario parcial mostrado como completo engaña a la prensa; la auditoría es discovery, no se asume.
**Verified:** 2026-07-22
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP §Phase 93 SC 1-4 + verification-context 1-6)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Matriz N/M declarada con queries psql verbatim reproducibles (4 celdas {sala,comisiones}×{Cámara,Senado}) | ✓ VERIFIED | 93-AUDITORIA §1.1-1.5: 5 bloques `sql` verbatim. Re-corrí 3 queries LIVE contra PROD: `citacion_camara=164` (min 2026-05-11, max 07-07, **6 semanas ISO**), `citacion_senado=114`, `sesion_sala_camara=2 sesiones/41 items`, `sesion_sala_senado=14`. Concuerda con el reporte post-backfill (§5/§8). |
| 2 | Hallazgos previos CONFIRMADOS/REFUTADOS con medición citada | ✓ VERIFIED | §3: (a) Senado comisiones forward-only CONFIRMADO (Probe 1 días 22/07→05/08, cero pasadas); (b) Cámara sala thin CONFIRMADO (`sesion_sala_camara`, PDF `prmId=0`); (c) comisiones unidas/especiales CONFIRMADO; (NUEVO) Cámara-histórico REFUTADO forward-only (Probe 4b `prmSemana=2026-20` → 200 con "11 DE MAYO"). Live: min(fecha) Cámara = 2026-05-11 corrobora el histórico de mayo. |
| 3 | Gaps de wiring declarados con evidencia DOM + causa raíz archivo:línea (insumo de 94) | ✓ VERIFIED | 93-WIRING-EVIDENCIA.md (22 markers): gap #1 `citacionVigente` forward-only (`estado-actual-block.tsx:122-129`), gap #2 `sesion_tabla_item` no leído (`:290-315`), ambos CONFIRMADOS con DOM PROD `fa4d4369` + control positivo. Subjects reproducen LIVE: `18193-06` (max 07-21, 0 futuras), `13665-07` (en sesion_tabla_item). |
| 4 | Backfill acotado dos-etapas (Etapa 1 R2 cableada) + counts antes/después + runbook LOCAL + `--from-r2` declarado inexistente | ✓ VERIFIED | §5: 34→164 citaciones, 2→6 semanas ISO (LIVE confirma 164/6). Etapa 1 R2 real en código: `ingest-run.ts:144-172` `putImmutable("camara","citaciones-semana",clave,sha,"html",bytes)` gateado `r2Enabled`, best-effort, ANTES del parse (mismo `bytes` decode:173). `connector-camara.ts:117` `fetchSemanaBytes`. Runbook 93-BACKFILL con flags reales + §7 declara `--from-r2` NO existe hoy (confirmado: sin flag en CLI). |
| 5 | Cobertura parcial DECLARADA por celda, ninguna presentada como completa | ✓ VERIFIED | §7: cada celda THIN o "al día en su ventana" con naturaleza del límite (sub-ingesta recuperable vs límite de FUENTE forward-only vs límite estructural); regla "estado ausente ≠ vigente confirmado" (§1.4: Cámara ~9%, Senado ~6%). Ninguna celda "completa". |
| 6 | Suite agenda verde + must_haves de los 3 planes | ✓ VERIFIED | `pnpm --filter @obs/agenda test` → **113 passed (13 files)**. Incluye tests R2 (f)/(g)/(h) content-addressed/gated/best-effort (`ingest-run.test.ts:181-283`). Todos los must_haves de 93-01/02/03 satisfechos. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `93-AUDITORIA-CITACIONES.md` | Reporte 7 secciones (matriz, endpoints, hallazgos, frescura, backfill, gaps wiring, DECLARACIÓN) + §8 addendum | ✓ VERIFIED | 327 líneas, §1-8 pobladas; "Matriz N/M", "DECLARACIÓN de cobertura", "estado ausente" presentes; §8 documenta reparación W20→W30 (2 sesiones/41 items). |
| `93-WIRING-EVIDENCIA.md` | Gaps DOM BrowserOS con causa raíz | ✓ VERIFIED | Contiene `citacionVigente`, `sesion_tabla_item`, "Gaps declarados"; sujetos concretos reproducibles. |
| `93-BACKFILL-CITACIONES-RUNBOOK.md` | Runbook operador-LOCAL con `run-agenda-prod-cli` + dos-etapas | ✓ VERIFIED | Flags reales, gotcha cwd, hash-check, rate-limit 2-3s, §7 extensión pendiente (`--from-r2` inexistente declarado). |
| `packages/agenda/src/ingest-run.ts` | Etapa 1 R2 en step 1 (MAJOR-1 LOCKED) | ✓ VERIFIED | Step 1 (:144-172) persiste HTML crudo a R2 ANTES de parse/write; step 4 sala-PDF (:283-306) idéntico patrón; key por semana ISO (WR-01 fix). |
| `packages/agenda/src/connector-camara.ts` | `fetchSemanaBytes` (bytes crudos) | ✓ VERIFIED | :117 `fetchSemanaBytes`; :122 `fetchSemana` delega (retrocompat cron). |
| `packages/agenda/src/run-agenda-prod-cli.ts` | `semanaTablaCamara=isoWeekOf(now)` (§8 fix) | ✓ VERIFIED | :164 `semanaTablaCamara: isoWeekOf(now)`; sin `--from-r2` (declarado). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| §Matriz N/M | PROD (citacion/sesion_sala) | psql -tA verbatim | ✓ WIRED | Re-corrí 3 queries LIVE: números concuerdan con el reporte post-backfill. |
| backfill acotado | citacion (Cámara) PROD | run-agenda-prod-cli upsert clave natural | ✓ WIRED | 34→164 confirmado LIVE (count 164, 6 semanas). |
| §DECLARACIÓN cobertura | 94 (banner/leyenda) | rango por celda | ✓ WIRED | §7 provee rango real + regla honesta por celda. |
| ficha (citacionVigente) | citacion PASADA misma boletín | filtro forward-only oculta pasadas | ✓ WIRED | gap #1 confirmado DOM + `18193-06` reproduce LIVE (0 futuras). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| §5 backfill counts | camaraCitaciones 34→164 | run-agenda-prod-cli → SupabaseAgendaWriter upsert PROD | Yes — LIVE psql = 164/6 semanas | ✓ FLOWING |
| Etapa 1 R2 | `bytes` crudos | `fetchSemanaBytes` → `putImmutable` (same bytes decode:173) | Yes — content-addressed sha256, best-effort | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Agenda suite green | `pnpm --filter @obs/agenda test` | 113 passed (13 files) | ✓ PASS |
| Matrix reproducible | psql citacion/sesion_sala group by | camara 164/6, senado 114, sala camara 2/41 | ✓ PASS |
| Wiring subjects reproduce | psql 18193-06 / 13665-07 | past-only (0 futuras) / in sesion_tabla_item | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CIT-01 | 93-01/02/03 | Auditoría de cobertura ANTES de UI, N/M declarado, hallazgos previos confirmados | ✓ SATISFIED | Reporte 7 secciones + wiring + backfill acotado + DECLARACIÓN por celda; N/M live-reproducible. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No debt markers (TBD/FIXME/XXX) in modified code | ℹ️ Info | Clean. Review-era `19/22`/`min 2026-06-22` inconsistencies (WR-02/WR-03) already FIXED (commits 7ada448/28a6791) and confirmed LIVE (min=2026-05-11, sala=41 items). |

### Human Verification Required

None. This is a discovery/audit phase — every claim is code- or psql-reproducible and was re-verified against PROD read-only in this session. The BrowserOS DOM captures (gaps #1/#2) were performed in Plan 02 and their subjects reproduce in the live DB. No UI was shipped (LOCKED: "esta fase NO toca UI" — that is 94).

### Gaps Summary

No gaps. All 4 ROADMAP success criteria and all 6 verification-context truths are achieved:
- The N/M matrix is declared with reproducible psql (3 cells re-run LIVE: matched).
- The 3 prior findings are confirmed + the new Cámara-histórico is refuted, all with cited measurement.
- Wiring gaps carry DOM evidence + root cause (archivo:línea), subjects reproduce LIVE.
- The bounded backfill ran two-stage with Etapa 1 R2 genuinely wired in code (ingest-run.ts:144-172, before parse/write), counts before/after are live-reproducible (34→164), the LOCAL runbook exists, and `--from-r2`'s non-existence is honestly declared (satisfied by future runbook, not this phase).
- Partial coverage is declared per cell; none presented as complete.
- Agenda suite green (113/113).

The audit is a coherent, honest input to the Phase 94 gate. GATE PASSED.

---

_Verified: 2026-07-22_
_Verifier: Claude (gsd-verifier)_
