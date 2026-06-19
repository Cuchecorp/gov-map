---
phase: 08-vote-spike-validaci-n-en-vivo-de-opendata-camara-cl
verified: 2026-06-19T23:35:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: initial verification
---

# Phase 8: VOTE Spike — Verification Report

**Phase Goal:** Confirmar o replanificar el bloque VOTE — validar EN VIVO, detrás del WAF, que `opendata.camara.cl` (`getVotaciones_Boletin` → `getVotacion_Detalle`) entrega el voto individual por diputado utilizable para enlace determinista; registrar una decisión binaria.
**Verified:** 2026-06-19T23:35:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

This is a **confirm-or-replan SPIKE**, not a feature build. The deliverable is a binary decision backed by a LIVE validation, plus a throwaway gate. Verified goal-backward against the 4 ROADMAP success criteria and the 5 spike-scope questions.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | El test asserta los 4 criterios VOTE-01 (DIPID+Opcion no null, reconciliación de totales, mapeo DIPID→id_diputado_camara, decisión binaria) | ✓ VERIFIED | LIVE half `spike.test.ts:110-121` asserts `camposPoblados` (a), `totalesReconcilian` (b), `ratioMapeo>=0.95` (c), error-rate cap (d). Offline half (`:39-88`) asserts the same shape on the real fixture (count si=58, no=81, 139 nominales, DIPID 815 → confirmado/determinista, ratio ≥0.95). |
| 2 | Decisión binaria CONFIRMAR/REPLANIFICAR registrada en 08-SUMMARY.md y STATE.md | ✓ VERIFIED | `08-SUMMARY.md` frontmatter `decision: CONFIRMAR` + sección "DECISIÓN BINARIA" con evidencia por votación. STATE.md line 114 (Decisions) + line 122 (blocker GATE marcado RESUELTO con veredicto CONFIRMAR). |
| 3 | Mitad offline verde sin red (suite verificable) | ✓ VERIFIED | Re-ejecutado por el verificador: `pnpm --filter @obs/votos test` → **4 passed, 1 skipped** (LIVE en skip sin la flag), 0 red. La mitad offline lee `camara-votacion-detalle-real.xml` con readFileSync. |
| 4 | Spike mantenido throwaway (sin @obs/votos/src producción, sin migración, sin ficha, sin edición de allowlist) | ✓ VERIFIED | No existe `packages/votos/src/`. `package.json` `private`, deps `workspace:*`. Sin migración nueva (`0009` es v1.0 CR-02, no Phase 8). `allowlist.ts:20` `camara.cl` es entrada preexistente v1.0, no editada. |
| 5 | VOTE-01 satisfecho para el alcance del SPIKE (no la feature VOTE completa) | ✓ VERIFIED | REQUIREMENTS.md:21 VOTE-01 = "un spike valida en vivo … resultado: confirmar y construir, o replanificar". Mapeado a Phase 8 (línea 80) ✅ Complete. VOTE-02..05 → Phase 10 (correctamente diferidos). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/votos/spike/spike.ts` | Spike desechable: ensambla colaboradores @obs/ingest en orden LOCKED, reconcilia, imprime FINDINGS | ✓ VERIFIED | 253 líneas. `buildCamaraConnector` ensambla Fetcher/HostRateLimiter/RobotsGuard; `runSpike` recorre boletines→detalle→`evaluarVotacion`→`reconciliarVotosCamara`; `imprimirFindings`. No usa `BaseConnector.run` ni `fetch` a pelo. |
| `packages/votos/spike/spike.test.ts` | Gate vitest: mitad offline (verde) + mitad LIVE-gated (4 criterios) | ✓ VERIFIED | 124 líneas. Offline siempre corre; LIVE `(LIVE ? describe : describe.skip)` con `VOTE_SPIKE_LIVE==="1"`. Patrón verbatim de llm/smoke.test.ts. |
| `08-SUMMARY.md` | FINDINGS conciso + decisión binaria | ✓ VERIFIED | Contiene "FINDINGS", tabla por votación (6 votaciones), shape XML confirmado, veredicto por criterio, "DECISIÓN BINARIA: CONFIRMAR". |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `spike.ts` | `@obs/tramitacion CamaraConnector` | import + ensamblaje @obs/ingest | ✓ WIRED | `import { CamaraConnector, ... }` (`:19-26`); `new CamaraConnector({fetcher,rateLimiter,robots,allowlist})` (`:91`). Símbolos exportados confirmados en `tramitacion/src/index.ts`. |
| `spike.ts` | `reconciliarVotosCamara` | cruce DIPID→id_diputado_camara | ✓ WIRED | Importado (`:22`) y usado en `evaluarVotacion` (`:114`); cuenta `confirmados` con `metodo==='determinista'`. |
| `spike.test.ts` | maestra del seed (`parlamentario.seed.json`) | carga de la maestra | ✓ WIRED | `cargarMaestra(ROOT, ...)` (`:21,32`) — wrapper sobre el seed autoritativo (155 diputados con id_diputado_camara). DIPID 815 asertado presente. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Suite offline verde sin red | `pnpm --filter @obs/votos test` | 4 passed, 1 skipped, 0 network | ✓ PASS |
| LIVE en skip por defecto (no quema el WAF) | (sin `VOTE_SPIKE_LIVE`) | bloque LIVE en skip | ✓ PASS |
| Símbolos importados existen | grep en `tramitacion/src/index.ts` | todos exportados | ✓ PASS |

**LIVE half:** environment-dependent (gov WAF, corrida deliberada única). NOT re-run by the verifier — per phase contract, the offline half is the verifiable gate and the SUMMARY documents the live result honestly. The FINDINGS table is internally consistent (per-votación si/no reconcilian; 8 requests / 0 errores; latencia 306–3361ms refleja el delay 2–3s LOCKED).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VOTE-01 | 08-01 | Spike valida en vivo opendata.camara.cl + decisión confirm-or-replan | ✓ SATISFIED | Decisión CONFIRMAR registrada con evidencia LIVE; alcance del spike cubierto íntegramente. VOTE-02..05 son Phase 10. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | Ninguno | — | Sin debt markers (TBD/FIXME/XXX) en archivos de Phase 8. `packages/votos` es throwaway por diseño (declarado en encabezado de spike.ts y SUMMARY). |

### Human Verification Required

Ninguno. La única pieza no re-ejecutable (corrida LIVE contra el WAF) está documentada honestamente y respaldada por la mitad offline verde; el contexto de verificación indica explícitamente NO fallar la fase por no poder alcanzar el WAF.

### Gaps Summary

Sin gaps. Los 5 must-haves verificados contra el codebase (no contra las afirmaciones del SUMMARY): el test asserta los 4 criterios, la suite offline corre verde sin red (re-ejecutada), la decisión binaria CONFIRMAR está en 08-SUMMARY.md y STATE.md, el spike es genuinamente throwaway (sin src de producción, sin migración nueva, sin ficha, sin edición de allowlist), y VOTE-01 está satisfecho para el alcance confirm-or-replan del spike. El objetivo de la fase — confirmar o replanificar el bloque VOTE — se cumple: decisión CONFIRMAR, Phase 10 desbloqueada.

---

_Verified: 2026-06-19T23:35:00Z_
_Verifier: Claude (gsd-verifier)_
