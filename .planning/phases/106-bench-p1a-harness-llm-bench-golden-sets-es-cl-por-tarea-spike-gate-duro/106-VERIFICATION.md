---
phase: 106-bench-p1a-harness-llm-bench-golden-sets-es-cl-por-tarea-spike-gate-duro
verified: 2026-07-26T22:05:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
---

# Phase 106: BENCH P1a — Harness llm-bench + golden sets es-CL POR TAREA Verification Report

**Phase Goal:** Construir el INSTRUMENTO DE MEDICIÓN (packages/llm-bench FUERA de @obs/llm + golden sets es-CL POR TAREA) que gobierna toda decisión de escalonamiento; calidad + latencia p50/p95 + costo/1k + tasa de fallo zod/structured-output como métricas SEPARADAS de primera clase; golden sets estratificados y congelados; baseline de los incumbentes de hoy.
**Verified:** 2026-07-26T22:05:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `@obs/llm-bench` existe FUERA de `@obs/llm`, depende de él (no al revés), `tsc -b` limpio | ✓ VERIFIED | `packages/llm-bench/package.json` deps `@obs/llm workspace:*`; `packages/llm/package.json` NO menciona llm-bench (grep vacío); tsconfig `references: [{ "../llm" }]`; root tsconfig incluye `./packages/llm-bench`. Corrí `tsc -b` en el paquete → exit 0 Y en el root → exit 0 yo mismo. |
| 2 | Los CUATRO golden sets por tarea existen (routing/clasificación/juez/extracción), es-CL, congelados (sha256), zod-validados al cargar, NON-PII | ✓ VERIFIED | 40 casos c/u (verificado por node script); freeze markers `2057b00c…/b1825391…/f7636de2…/0dc7bd5b…` = sha256 vivo de casos.json (hashMatch=true los 4); cada scorer hace `z.array(...).parse(casosRaw)` al importar; guard no-RUT `contieneRut` con meta-test que MUERDE (detecta RUT sembrado). |
| 3 | Las dos fail-rate metrics (structured_output_fail_rate vs zod_fail_rate.{repaired,terminal}) son campos SEPARADOS de primera clase en el Reporte | ✓ VERIFIED | `report.ts` MetricasModelo: `structured_output_fail_rate` es campo aparte de `zod_fail_rate`; `metrics.ts` `TasasDeFallo` los mantiene disjuntos; `metrics.test.ts:102-136` asierta 3 tasas distintas + anti-Pitfall-B (30% structure-fail reporta rate alto separado). |
| 4 | Extracción: schema-parse-rate SEPARADO de field-value accuracy (no colapsado) | ✓ VERIFIED | `extraccion/scorer.ts` MetricasExtraccion: `schema_parse_rate` + `value.{precision,recall}` como campos separados; caso null baja parse-rate SIN sumar tp/fp/fn; `scorer.test.ts` prueba 100%-parse/valor-fabricado → parse-rate alto + precisión hundida; gate usa solo value, no parse-rate. Baseline artifact MiniMax lo muestra vivo: parse_rate=1.0, precision=0.167. |
| 5 | Juez: pares (answer, human_label), accuracy condicional vs etiqueta HUMANA, bias hooks presentes, split calibración disjunto; adjudicación golden-1263 INTOCADA | ✓ VERIFIED | `juez/scorer.ts` CasoJuez = {answer, human_label, producer, answerLen, orderings, split}; `evaluarJuez` computa precision_ok + recall_rechazo vs `human_label` (nunca vs responder); hooks porProductor/porLongitud; SPLITS scoring/calibracion disjuntos (guard test asierta ∩=∅); slot curva confiabilidad vacío `[]` (fit=107); NINGÚN import de `@obs/adjudication` (grep confirma solo `@obs/llm`). |
| 6 | Guard anti-leakage de disjunción (exemplars ∩ eval = ∅) es un test CI real que muerde | ✓ VERIFIED | 4× `disjuncion.test.ts` (routing/clasif/juez/extraccion) corren `exemplarIds.filter(id => evalIds.has(id))===[]` + meta-test que demuestra que la assertion detectaría el solape; corrí la suite → los 4 pasan verde. |
| 7 | CI mock/sin-red; baseline LIVE env-gated NO en CI; artefacto LIVE existe | ✓ VERIFIED | `baseline.live.test.ts`: `(LLM_BENCH_LIVE==="1" ? describe : describe.skip)` + `it.skipIf(!DEEPSEEK_API_KEY||!MINIMAX_API_KEY)`; MockProvider sin fetch/http; corrí la suite → 99 passed, 1 skipped (baseline.live). `baseline.artifact.json` + `.md` presentes, provenance real (endpoints, tarifaFecha), SIN secrets (grep de keys/tokens vacío). |
| 8 | NO 107 scope (no Granite/Phi adapters, no Workers AI/OpenRouter, no secret nuevo) | ✓ VERIFIED | No hay provider/adapter Granite/Phi (solo aparecen como `producer` labels en golden juez = bias hook legítimo, y en comentarios que difieren a 107); no hay código Workers AI/Cloudflare/OpenRouter (solo comentarios de deferral); `.env.example` último tocado por commits de Phase 103 (d2ffebc/b4331db), NINGÚN commit 106 lo modificó; env nuevas = LLM_BENCH_LIVE/LLM_BENCH_LIMIT (no-secret). |
| 9 | `pnpm --filter @obs/llm-bench test` + `tsc -b` verdes (corridos por el verificador) | ✓ VERIFIED | Corrí `pnpm --filter @obs/llm-bench test` → 99 passed / 1 skipped (11 test files). Corrí `tsc -b` en paquete → exit 0 y en root → exit 0. |

**Score:** 9/9 truths verified

### Roadmap Success Criteria Coverage

| SC | Criterio | Status | Evidence |
|----|----------|--------|----------|
| 1 | Operador corre llm-bench POR TAREA reportando calidad/latencia p50-p95/costo-1k/zod-fail-rate como métricas SEPARADAS | ✓ VERIFIED | harness.ts `correrHarness` → MetricasModelo con los 6 campos separados; README runbook operador; baseline artifact demuestra la corrida real. |
| 2 | Golden sets es-CL estratificados del corpus REAL, sin leakage, CONGELADOS antes de integrar; guard CI de disjunción exemplar/eval | ✓ VERIFIED | 4 sets 40-casos estratificados (doc-format/register/length/chamber/negacion); freeze markers sha256; 4 disjuncion.test.ts que muerden. |
| 3 | Benchmark corre contra endpoint EXACTO de producción (host pinned) | ✓ VERIFIED | baseline.live.test.ts inyecta `instrumentedFetch` como `fetchFn` del adapter real (camino REAL); estampa endpoint (api.deepseek.com / api.minimax.io/v1) por modelo; artifact registra endpoint+tarifaFecha. |
| 4 | Postura DPA/no-train + cuantización registrada como dato del spike | ⚠ PARCIAL/DEFERRED | El harness invoca `LLMProvider` que porta `trainsOnInputs`/sensitivity (contrato heredado de @obs/llm); la POSTURA de cuantización+DPA del host servido de candidatos es explícitamente alcance de 107 (host servido). En 106 los incumbentes ya tienen su postura conocida. No bloquea el goal de 106 (instrumento + baseline). Cubierto en Phase 107 (host servido de candidatos). |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/llm-bench/package.json` | @obs/llm-bench dep @obs/llm | ✓ VERIFIED | workspace:* + zod; sin dep de dominio |
| `src/report.ts` | Reporte con 2 fail-rates separadas | ✓ VERIFIED | MetricasModelo, campos disjuntos |
| `src/metrics.ts` | percentile/costoUsd/agregarFallos/clasificarOutcome | ✓ VERIFIED | puros, 15 tests |
| `src/guards/{freeze,no-rut}.ts` | sha256 freeze + no-RUT scanner | ✓ VERIFIED | ambos muerden en meta-tests |
| `src/tasks/{routing,clasificacion,juez,extraccion}/` | 4 golden 40-casos + scorer + freeze + guard | ✓ VERIFIED | congelados, zod-validados, guards muerden |
| `src/harness.ts` + `mock-provider.ts` | driver host-agnóstico + mock CI | ✓ VERIFIED | drive 4 tareas, 8 tests |
| `baseline.artifact.json/.md` | baseline LIVE real, sin secrets | ✓ VERIFIED | provenance real, grep secrets vacío |
| `README.md` | runbook operador | ✓ VERIFIED | presente |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| harness.ts | 4 scorers | import + drive en correrTareas | ✓ WIRED | evaluarRouting/Clasificacion/Extraccion/Juez todos invocados |
| harness.ts | metrics/pricing/instrument | percentile/costoUsd/agregarFallos/tarifaDe | ✓ WIRED | ensambla MetricasModelo |
| baseline.live.test.ts | @obs/llm adapters | instrumentedFetch como fetchFn | ✓ WIRED | mide camino REAL de producción |
| llm-bench | @obs/adjudication | (ninguno) | ✓ CORRECTAMENTE AUSENTE | golden-1263 intocado — no hay import |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Suite completa CI (mock, sin red) | `pnpm --filter @obs/llm-bench test` | 99 passed, 1 skipped, 11 files | ✓ PASS |
| Typecheck del paquete | `tsc -b` (packages/llm-bench) | exit 0 | ✓ PASS |
| Typecheck root (references graph) | `tsc -b` (root) | exit 0 | ✓ PASS |
| Golden counts + freeze hash match | node script sobre los 4 casos.json | 40 c/u, hashMatch=true×4 | ✓ PASS |
| Sin secrets en baseline artifact | grep keys/tokens en baseline.artifact.json | sin coincidencias | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BENCH-01 | 106-04 | harness que evalúa candidatos por tarea con métricas de primera clase separadas | ✓ SATISFIED | harness driver + MetricasModelo + README |
| BENCH-02 | 106-02/03 | golden sets es-CL nuevos por tarea, estratificados, sin leakage, congelados | ✓ SATISFIED | 4 sets 40-casos, freeze, disjuncion guards |
| BENCH-03 | 106-04 | benchmark contra endpoint EXACTO de producción | ✓ SATISFIED | instrumentedFetch en adapter real, endpoint estampado |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/tasks/juez/scorer.ts | 207-209 | `return []` (slotCurvaConfiabilidadJuez) | ℹ Info | Contrato de dato intencional — el fit isotónica/Platt es 107 (T-106-10). NO es stub que bloquee el goal; documentado y coherente con el frame. |

Ningún debt marker (TBD/FIXME/XXX) sin referencia. Ningún placeholder residual (los 6 `export {}` de 106-01 fueron todos llenados por 106-02/03). Ningún dato hardcodeado que fluya a rendering.

### Human Verification Required

Ninguno. El instrumento se verifica programáticamente (tests + tsc + hashes + grep). El baseline LIVE se corrió de verdad y quedó capturado como artefacto trazable; el veredicto por tarea (juicio humano de paridad) es explícitamente alcance de 107.

### Gaps Summary

Sin gaps que bloqueen el goal. El único ítem parcial (SC4 — postura DPA/cuantización del host SERVIDO) es por diseño alcance de 107 (candidatos en su host servido); en 106 los incumbentes ya portan su postura vía el contrato `trainsOnInputs`/sensitivity de @obs/llm, y el goal de 106 (instrumento + sets + baseline) está completo. No es actionable en 106.

**Veredicto:** el instrumento de medición LOAD-BEARING está construido, es host-agnóstico, mantiene las cuatro clases de métrica SEPARADAS (verificado en tipo, en test que muerde, y en el baseline LIVE real donde DeepSeek muestra structured_output_fail_rate=0.25 y MiniMax muestra extracción precision=0.167 con parse_rate=1.0 — la separación es observable, no reclamada). Los cuatro golden sets es-CL están congelados con marcadores sha256 que coinciden con los bytes vivos, zod-validados al cargar, non-PII con guard que muerde, y anti-leakage con guard de disjunción que muerde. No hay scope-creep de 107 (sin adapters candidatos, sin Workers AI/OpenRouter, sin secret nuevo, .env.example intocado). Adjudicación golden-1263 no se toca ni se importa. Gate duro que gobierna 107-109: PASSED.

---

_Verified: 2026-07-26T22:05:00Z_
_Verifier: Claude (gsd-verifier)_
