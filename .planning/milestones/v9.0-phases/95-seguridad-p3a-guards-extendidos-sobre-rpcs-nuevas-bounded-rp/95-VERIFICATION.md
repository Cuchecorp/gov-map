---
phase: 95-seguridad-p3a-guards-extendidos-sobre-rpcs-nuevas-bounded-rp
verified: 2026-07-23T14:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
requirements:
  - id: SEC-01
    status: satisfied
---

# Phase 95: SEGURIDAD P3a — Guards extendidos sobre RPCs nuevas + bounded RPCs — Verification Report

**Phase Goal:** Cada RPC/superficie nueva de P1/P2 amplió la superficie de ataque bajo service_role — los guards existentes deben cubrirla y las RPCs caras deben quedar acotadas.
**Verified:** 2026-07-23
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Guards existentes (lockdown/allowlist, PII, anti-insinuación, pgTAP) re-corridos y EXTENDIDOS sobre RPCs/superficies nuevas P1/P2 | ✓ VERIFIED | Guard tests run green (lockdown-guard 14/14, anti-insinuacion-guard 27/27 = 41 passed). lockdown-guard tiene bloques (A) anon-regresion, (A2) Direction-B, (A3) crossLinkReader, (B) PII-directo. anti-insinuacion tiene `SUPERFICIES_DEEPLINK` (validacion-fuente.tsx + provenance-badge.tsx) en el spread del loop principal (línea 472). pgTAP 0064 (36 asserts) cubre las 9 RPCs de bio/cross-links/lobby. |
| 2 | Toda RPC nueva acotada contra DoS: LIMIT, statement_timeout, cap de match_count | ✓ VERIFIED | 0064: exactamente 9 `create or replace function`, cada una con `set statement_timeout = '5s'` (grep verificado, 9 matches sobre 9 funciones). Híbrida 0057: `set statement_timeout = '5s'` + cap interno `limit least(match_count, 50)` (líneas 87/97/116). LIMITs pre-existentes: 0060 (8), 0061 (5), 0063 (1). match_proyectos excluida documentadamente (security INVOKER, pre-v9.0, ya acotada). |
| 3 | Allowlist sin drift bidireccional (Dir A: served ⊆ allowlist incl. crossLinkReader; Dir B: allowlist ⊆ definidas) | ✓ VERIFIED | Direction-A: Block B `rpcPattern` (línea 510) + A3 `crossLinkReader` literal-extraction (línea 428-434) cubren el blind-spot de variable-arg. Direction-B: `definedRpcNames` con regex `create ... function (?:public\.)?(\w+)` — `public.` OPCIONAL para no producir 3 falsos orphans (match_proyectos/parlamentario_publico/parlamentarios_publico); scope repo-wide. Las 9 RPCs nuevas están todas en `PUBLIC_RPC_ALLOWLIST` (líneas 165-192). Test "toda entrada de allowlist ↔ función definida" verde. |
| 4 | Mutation self-checks muerden sobre lo NUEVO (Dir-B ghost, crossLinkReader rpc_no_listada, DEEPLINK "influencia", pgTAP statement_timeout por RPC) | ✓ VERIFIED | lockdown-guard: "Direction-B self-check: detecta entrada fantasma" (línea 399, in-memory `ghostAllowlist`); "crossLinkReader self-check: literal no-listado en fixture EN MEMORIA" (línea 461, fixture string, cero disco). anti-insinuacion: "DEEPLINK (95-02): caza insinuación inyectada en fixture de validacion-fuente" (línea 630, fixture JSX inline, 'influencia'). pgTAP 0064: assert (C) `statement_timeout=%` × 9 RPCs (9 asserts). Todos in-memory / post-apply — cero mutación de archivo real. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0064_bounded_rpc_statement_timeout.sql` | 9 RPCs re-emitidas con statement_timeout + doble-revoke | ✓ VERIFIED | 9 funciones, 9 `set statement_timeout = '5s'`, 18 `revoke all` (doble-revoke por RPC: from public + from anon,authenticated). Returns tables byte-consistentes con 0061 (total_n bigint × 4 cross-links) y 0063 (13 cols, contraparte_rol/representado NULL, total_n). |
| `supabase/tests/post-apply/0064_bounded_rpc_statement_timeout.test.sql` | pgTAP plan(36) con statement_timeout asserts | ✓ VERIFIED | `plan(36)` = 4 asserts × 9 RPCs. Assert (C) verifica `proconfig cfg like 'statement_timeout=%'` en las 9. Asserts (A) has_function, (B) PUBLIC sin EXECUTE vía aclexplode, (D) PII-safe (rut/email/partido_alias). |
| `app/lib/lockdown-guard.test.ts` | Direction-B + crossLinkReader + self-checks | ✓ VERIFIED | Bloques A/A2/A3/B presentes; `(?:public\.)?` en definedRpcNames; `crossLinkRpcNames` detector puro; 2 mutation self-checks in-memory. 14/14 verde. |
| `app/lib/anti-insinuacion-guard.test.ts` | SUPERFICIES_DEEPLINK + self-check | ✓ VERIFIED | `SUPERFICIES_DEEPLINK` (línea 279) con validacion-fuente + provenance-badge; incluida en el spread del loop (línea 472); DEEPLINK self-check (línea 630). 27/27 verde. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| PUBLIC_RPC_ALLOWLIST | migrations (definedRpcNames) | Direction-B regex public.-opcional | ✓ WIRED | 0 orphans; test verde. |
| crossLinkReader("...") call site | PUBLIC_RPC_ALLOWLIST | A3 literal extraction | ✓ WIRED | ≥4 literales, todos allowlisted. |
| SUPERFICIES_DEEPLINK | loop principal anti-insinuación | spread `[...,...SUPERFICIES_DEEPLINK]` | ✓ WIRED | Línea 472 verificada. |
| 0064 RPCs | pgTAP proconfig assert | `statement_timeout=%` × 9 | ✓ WIRED | plan(36), assert C por RPC. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Guards muerden sobre superficies nuevas | `pnpm exec vitest run lib/lockdown-guard.test.ts lib/anti-insinuacion-guard.test.ts` | 41 passed (14+27) | ✓ PASS |
| 0064 = 9 RPCs con statement_timeout | grep `set statement_timeout` 0064 | 9 | ✓ PASS |
| 0064 doble-revoke | grep `revoke all` 0064 | 18 (2×9) | ✓ PASS |
| pgTAP statement_timeout asserts | grep assert (C) en test 0064 | 9 (plan 36) | ✓ PASS |
| 0020 untouched | git log 0020 | último commit 2026-06-19 (pre-fase) | ✓ PASS |

### Probe Execution

No project-convention `scripts/*/tests/probe-*.sh` declared for this phase. Verification runs the vitest guard suites and pgTAP inspection directly (above). The PROD pgTAP apply (36 ok) is a live-DB claim from 95-01-SUMMARY.md — accepted per verification method (no DB access required); the migration + test files are internally consistent with that claim (36 asserts, 9 RPCs, statement_timeout per RPC).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SEC-01 | 95-01, 95-02 | Guards extendidos sobre RPCs/superficies nuevas + toda RPC nueva acotada (LIMIT/statement_timeout/match_count) contra DoS | ✓ SATISFIED | Truths 1-4 verified; REQUIREMENTS.md línea 114 marca SEC-01 → Phase 95 Complete. |

### Anti-Patterns Found

None. Migration 0064 re-emite funciones existentes con atributo adicional (no superficie nueva). Guard test files son detectores puros + fixtures in-memory (cero mutación de archivo real, cero contacto con DB viva). Verified: no `TBD`/`FIXME`/`XXX` unreferenced markers in phase-modified files.

### Human Verification Required

None. All success criteria are verifiable programmatically (guard test execution, migration grep, pgTAP structural inspection, git history). The live PROD apply of 0064 is a documented SUMMARY claim accepted per the verification method — noted but not blocking (the file artifacts are consistent with the 36-ok claim).

### Notes

- **PROD apply (0064):** 95-01-SUMMARY.md claims 36/36 pgTAP ok in PROD (DDL via psql --single-transaction, no `supabase db push`). Verifier did not access the live DB; accepted per verification method. Migration + test files are self-consistent (9 RPCs × 4 asserts = 36, statement_timeout per RPC).
- **10-vs-9 RPC deviation:** Plan text said "10 RPCs"; interfaces defined 9 unique. Executor correctly implemented 9 and used plan(36) not plan(40). Documented deviation, no security impact — match_proyectos deliberately excluded (security INVOKER, pre-v9.0, already bounded).
- **Full suite:** Orchestrator reports app 1228/1228 green + tsc clean. The isolated guard run here (41/41) is a subset confirming the new describes are present and green. The pre-existing money-antiflip-guard timeout noted in 95-02-SUMMARY is unrelated to this phase.

### Gaps Summary

No gaps. All 4 success criteria verified against the codebase: (1) guards extended and re-run green over new P1/P2 surfaces, (2) all 9 new RPCs bounded with statement_timeout=5s plus pre-existing LIMITs and the híbrida match_count cap, (3) bidirectional allowlist drift = 0 with the crossLinkReader blind-spot covered, (4) mutation self-checks bite in-memory over the new surfaces. SEC-01 satisfied.

---

_Verified: 2026-07-23T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
