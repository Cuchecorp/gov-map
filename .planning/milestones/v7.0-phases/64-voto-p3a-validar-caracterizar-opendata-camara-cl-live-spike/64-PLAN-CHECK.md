# Phase 64 - Plan Check Verdict

**Phase:** 64 - VOTO P3a - Validar/caracterizar opendata.camara.cl LIVE (SPIKE)
**Checked:** 2026-07-13
**Plans:** 64-01 (offline semantics, Wave 1), 64-02 (LIVE probe + R2 + fallback, Wave 2)
**Verdict:** PASS WITH CONCERNS

---

## Summary

Both plans will achieve the phase goal. Every load-bearing claim was verified against the actual codebase - the fixture, DIPIDs, header totals, connector methods, R2Store API, live-test pattern, and current parser state all exist as the plans assert. The two hard corrections (abstencion-by-code-2, pareo-from-<Pareos>) are real and testable, and the plans explicitly forbid fabricating code 3. Concerns are WARNINGs only; none block execution.

---

## Goal-Backward Coverage (4 success criteria)

| SC | Requirement | Covered by | Status |
|----|-------------|-----------|--------|
| SC#1 | Raw LIVE getVotacion_Detalle to R2, content-addressed (two namespaces) | 64-02 Task 1 (STAGE 1 putImmutable) + Task 2 doc (aggregate namespace as fallback) | COVERED |
| SC#2 | Valor to Seleccion fixed; Abstencion/Pareo/Dispensado verified not assumed | 64-01 Task 1 (code-2) + Task 2 (pareo from <Pareos>) offline; 64-02 Task 1 HUNT LIVE | COVERED |
| SC#3 | Sum voto-a-voto == Total*; mismatch fails LOUD | 64-01 Task 3 (bucket-semantic + noisy negative case) offline; 64-02 Task 1 step 4 LIVE | COVERED |
| SC#4 | Honest fallback (getVotaciones_Boletin) + VOTO re-plan | 64-02 Task 2 (.md fallback decision, marked contingency) | COVERED |

Requirement VOTO-05 present in both plans requirements field. Roadmap maps Phase 64 to VOTO-05 (enabler). MATCH.

---

## Verified Against Codebase (not taken on faith)

- Fixture camara-votacion-detalle-real.xml EXISTS (46 KB) with a real <Pareos> block. The 10 distinct DIPIDs cited in 64-01 Task 2 (1240/1082/1259/1142/1039/1131/1015/1217/1107/1219) match the fixture EXACTLY.
- Header totals in fixture = 58/81/0/0 - exactly the assertions in 64-01 Task 3.
- opcionDeVoto (line 258) currently has NO codigo === 2 branch - the correction is genuine, not a phantom. Branches si/no/ausente confirmed at 276/277/282. parseCamaraVotoDetalle at line 207 as cited.
- leer test helper exists (test line 11).
- connector-camara.ts: fetchVotacionDetalle (184) + fetchVotacionesBoletin (173) exist.
- r2-store.ts: putImmutable (56) + sha256Hex (12) exist with the cited signature.
- run-camara-votos.live.test.ts exists with the exact VOTOS_LIVE=1 / describe.skip gate the 64-02 plan mirrors.

---

## Directed Checks (from the check request)

- read_first + acceptance_criteria on every task: PRESENT on all 5 tasks. read_first cites concrete files with line ranges; acceptance_criteria are assertable.
- Actions concrete: YES. Bucket-semantic cross-check, Pareos set build, serial fetch, putImmutable call all spelled out with symbols, not prose.
- Pareo-from-<Pareos> is a hard deliverable, not fabricated code 3: YES. 64-01 Task 2 acceptance criterion explicitly requires git diff to show NO codigo === 3 branch, and the plan-level verification re-asserts it. Enforced, not merely intended.
- LIVE probe gated (VOTOS_LIVE=1) + persists to R2: YES. 64-02 Task 1 gates with describe.skip, and STAGE 1 putImmutable runs BEFORE parse (two-stage LOCKED rule honored).
- Totals cross-check fails loud: YES. 64-01 Task 3 negative case mutates a vote in memory and asserts toThrow()/explicit expect-fail; 64-02 repeats it LIVE.

---

## Concerns (WARNING - do not block execution)

**W-1 [scope_reduction - cleared].** Plan 01 SC#2 is explicitly parcial/offline and defers Dispensado to Plan 02 LIVE hunt. This is NOT a silent reduction - CONTEXT.md places all impl decisions under Claude Discretion, and RESEARCH A1c flags Dispensado as genuinely unobserved-live. The split is honest (fail-closed, documented residual). No action required.

**W-2 [verify portability].** Both 64-02 verify commands use POSIX shell syntax: VOTOS_LIVE=1 pnpm (Task 1) and test -f && grep -qi (Task 2). Environment is Windows/PowerShell where these are not valid. Executor must run these via the Bash tool (available) or translate to PowerShell (:VOTOS_LIVE=1). Recommend the executor use the Bash tool for these two verifies so the step is not falsely reported red.

**W-3 [manual gate - inherent to a SPIKE].** SC#1/SC#3-LIVE/SC#4 depend on ONE deliberate VOTOS_LIVE=1 run hitting the government WS. If the WAF blocks Node fetch (RESEARCH Pitfall 4), Task 1 cannot persist to R2. The curl->file escape hatch is in RESEARCH but NOT wired into 64-02 Task 1 action. Recommend a one-line note to Task 1: if Node fetch 403/503s, use the curl->file escape hatch per RESEARCH Pitfall 4. Non-blocking (endpoint was 200 this session).

**W-4 [observation coverage - honestly bounded].** SC#2 Pareo/Dispensado LIVE confirmation depends on the 5-votacion sample actually CONTAINING a <Pareos> and a TotalDispensados>0. RESEARCH says these are rare and were NOT seen. 64-02 Task 1 correctly records no observado en la muestra without fabricating - so the plan is honest, but the SPIKE may exit WITHOUT live-confirming these two codes, leaving A1b/A1c for Phase 66. Acceptable per the goal. Offline Pareo IS proven via the fixture, so the core defamation risk (pareo != ausente) is closed regardless.

---

## Dimension Results

| Dimension | Result |
|-----------|--------|
| 1 Requirement Coverage | PASS (VOTO-05 in both plans; roadmap match) |
| 2 Task Completeness | PASS (all 5 tasks: files/read_first/action/verify/acceptance/done) |
| 3 Dependency Correctness | PASS (64-02 depends_on 64-01; waves 1 to 2 consistent; no cycles) |
| 4 Key Links Planned | PASS (Pareos to opcion override; putImmutable STAGE 1; cross-check wired) |
| 5 Scope Sanity | PASS (3 + 2 tasks; <=3 files each) |
| 6 must_haves Derivation | PASS (truths observable, artifacts map, key_links concrete) |
| 7 Context Compliance | PASS (all decisions under Claude Discretion; no deferred ideas included) |
| 7b Scope Reduction | PASS (offline/LIVE split is honest, not silent v1/v2) |
| 7c Architectural Tier | PASS (probe to connector, crudo to R2, parse to parser, gate to zod/test per map) |
| 8 Nyquist | PASS (VALIDATION.md exists; every task has automated verify or Wave 0; no watch mode) |
| 9 Cross-Plan Data Contracts | PASS (Plan 02 reuses Plan 01 corrected parser + cross-check helper) |
| 10 CLAUDE.md Compliance | PASS (two-stage R2-first, 2-3s LOCKED, zod noisy gate, DIPID-not-name honored) |
| 11 Research Resolution | WARNING - Open Questions (3) not marked RESOLVED; by design these ARE the SPIKE deliverables (heading-hygiene only) |
| 12 Pattern Compliance | SKIPPED (no PATTERNS.md) |

---

## Blockers

None.

---

## Recommendation

Proceed to execution. Address W-2 (run 64-02 verifies via the Bash tool, not PowerShell) and optionally W-3 (add curl escape-hatch note to 64-02 Task 1) at execution time. W-1/W-4 are honest, goal-aligned bounds of a SPIKE - no change needed.
