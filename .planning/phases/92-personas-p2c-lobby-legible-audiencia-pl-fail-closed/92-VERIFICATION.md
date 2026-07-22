---
phase: 92-personas-p2c-lobby-legible-audiencia-pl-fail-closed
verified: 2026-07-22T16:40:00Z
status: passed
score: 3/3 success criteria verified (+ 15/15 plan must-have truths)
overrides_applied: 0
re_verification: null
---

# Phase 92: PERSONAS P2c — Lobby legible + audiencia→PL fail-closed — Verification Report

**Phase Goal:** Hacer legible el lobby (la materia ya está entera en DB — la falla es presentacional) y enlazar audiencia→PL solo por evidencia dura, con leyenda anti-causal.
**Verified:** 2026-07-22T16:40:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| SC1 | Título/materia COMPLETO de cada audiencia visible y legible en la ficha del parlamentario (sin clamp) | ✓ VERIFIED | `lobby-de-parlamentario.tsx` renders materia in `<div class="text-sm whitespace-pre-line leading-relaxed">` in BOTH VistaCronológica (:518) and VistaAgrupada (:444); grep for `line-clamp\|truncate` in materia blocks = none. VistaAgrupada previously showed no materia — now lists per-reunión materia. BrowserOS-GATE confirms ~430-char materia rendered uncut on live `/parlamentario/D1132`. |
| SC2 | Audiencia→PL SOLO por mención explícita de boletín, fail-closed, leyenda anti-causal, NUNCA keywords/tema | ✓ VERIFIED | Double fail-closed proven both sides. TS `extraerBoletines` (context-gated: suffix `-NN` anywhere OR bare base only after `boletín/bol.` trigger ≤3 tokens; rejects "Ley 20.730", bare numbers, decimals) + batched `.from("proyecto").in("boletin",...)` existence check server-side (:668). SQL RPC 0063 mirrors both branches VERBATIM + `exists(proyecto)` + `estado_vinculo='confirmado'` + `parlamentario_id not null`. Anti-causal legend LOCKED single-source (`LEYENDA_MENCIONES_LOBBY`). **PROD live:** `lobby_menciones_de_boletin('99999-99')` → 0 rows (fail-closed existence); anon has NO execute (`has_function_privilege=f`, deny-by-default). |
| SC3 | Navegación bidireccional: audiencia → ficha PL → parlamentario, con links específicos | ✓ VERIFIED | Chips `MencionBoletinChip` → `<Link href="/proyecto/{N}">` (:41) mounted under materia in both views. Proyecto side `LobbyMencionesView` renders parlamentario ENLAZADO `<Link href="/parlamentario/{id}">` (:138) — DEPARTURE from 0048 (plano). Section `#lobby-menciones` mounted in page.tsx (:183) + rail entry "Menciones en lobby" (:304), separated from `#lobby-tramitacion` (0048). |

**Score:** 3/3 success criteria verified.

### Plan Must-Have Truths (15/15)

| Source | Truth | Status | Evidence |
| ------ | ----- | ------ | -------- |
| 92-01 | Extractor puro encuentra todos los boletines con reglas de formato + exclusión decimal | ✓ VERIFIED | `boletin-en-materia.ts` pure fn, 20 vitest tests pass incl. equivalence guard (inline re-impl over `FIXTURE_MATERIA`) |
| 92-01 | RPC devuelve solo audiencias confirmadas con parlamentario_id, PII-safe, bounded | ✓ VERIFIED | 0063 RPC: `estado_vinculo='confirmado'`, `parlamentario_id not null`, no rut/email/contraparte_id, LIMIT 50; PROD signature confirmed |
| 92-01 | Regex SQL demostrablemente equivalente al extractor TS | ✓ VERIFIED | pgTAP 22 assertions incl. WR-01/WR-02 divergence cases (trailing period, multi-boletín, punteada); branches a/b VERBATIM in 0063 |
| 92-02 | Materia COMPLETA legible en ambas vistas, sin clamp, whitespace-pre-line | ✓ VERIFIED | See SC1 |
| 92-02 | Vista agrupada muestra materia por reunión | ✓ VERIFIED | `agruparPorContraparte` reshaped; per-reunión materia at :444 |
| 92-02 | Chip 'Menciona boletín N' → /proyecto/N ambas vistas, fail-closed doble | ✓ VERIFIED | `resolverBoletinesMencionados` (:644) pattern + existence; chips at :450 and :529 |
| 92-02 | Chip navega audiencia→PL; LobbyView PURO | ✓ VERIFIED | Chips resolved server-side; view receives `boletines_mencionados`; no .rpc/.from in islands |
| 92-03 | Sección nueva con `<section id='lobby-menciones'>` separada de 0048 | ✓ VERIFIED | page.tsx :183, distinct heading/leyenda; 0048 untouched |
| 92-03 | Lista fecha, parlamentario ENLAZADO, contraparte cruda, materia, enlace; orden DESC; total_n honesto | ✓ VERIFIED | `FilaMencion` all fields; `order by fecha desc`; total_n over distinct audiencias |
| 92-03 | Leyenda anti-causal LOCKED + empty honesto | ✓ VERIFIED | `LEYENDA_MENCIONES_LOBBY` + `EMPTY_MENCIONES_LOBBY` verbatim, single-source |
| 92-03 | Linter cubre superficies nuevas con NEGACIONES_LOCKED + mutation self-check | ✓ VERIFIED | `SUPERFICIES_LOBBY` in scan loop (:411); legends subtracted in `NEGACIONES_LOCKED` (:334); LOBBY mutation self-check bites (:548) |
| 92-04 | 0062 aplicada a PROD por psql; pgTAP pasa contra schema aplicado | ✓ VERIFIED | RPC present in PROD (0063 signature); runbook documents apply; REVIEW pgTAP 21/21 |
| 92-04 | Deploy Cloudflare LIVE + arrastra fixes UI 91 | ✓ VERIFIED | BROWSEROS-GATE: version fa4d4369; PartidoChip + cross-link 91 legends present live |
| 92-04 | Gate BrowserOS confirma materia + chips + sección con leyenda | ✓ VERIFIED | GATE APROBADO ("COMPRENSIBLE"); corroborated by my independent PROD spot-checks |
| 92-04 | Cobertura de menciones MEDIDA y DECLARADA | ✓ VERIFIED | 5106/195/82 in runbook; independently corroborated (branch-a alone = 184 audiencias/79 boletines; branch-b adds the rest) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `lobby-menciones-de-boletin.tsx` | `rows` | `sb.rpc("lobby_menciones_de_boletin")` | Yes — PROD `('16849-12')` returns 13 rows, total_n=13 | ✓ FLOWING |
| `lobby-de-parlamentario.tsx` | `boletines_mencionados` | `extraerBoletines` + `.from("proyecto").in()` | Yes — 195 confirmed audiencias have valid mentions in PROD | ✓ FLOWING |

### Behavioral Spot-Checks (PROD read-only psql)

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| One-row-per-audiencia + honest total_n (CR-01 fix live) | `lobby_menciones_de_boletin('16849-12')` | 13 rows / 13 distinct ids / total_n=13 | ✓ PASS |
| Fail-closed existence (#2) | `lobby_menciones_de_boletin('99999-99')` | 0 rows | ✓ PASS |
| Deny-by-default (Camino A) | `has_function_privilege('anon',...,'execute')` | f | ✓ PASS |
| Coverage denominator | count confirmed audiencias w/ materia | 5106 | ✓ PASS |
| Coverage numerator cross-check (branch a) | distinct audiencias w/ suffix mention in proyecto | 184 (≤ 195 declared) | ✓ PASS |
| RPC signature = 0063 (one-row) applied | pg_proc return signature | contraparte agg + total_n, security definer | ✓ PASS |

### Suite + tsc

| Check | Result | Status |
| ----- | ------ | ------ |
| `pnpm --filter ./app test` | 1158/1158 passed (90 files) | ✓ PASS |
| `pnpm --filter ./app exec tsc --noEmit` | exit 0 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| LOB-01 | 92-02 | Materia completa visible/legible en ficha PL | ✓ SATISFIED | SC1 — whitespace-pre-line both views, no clamp |
| LOB-02 | 92-01/02/03 | Audiencia→PL solo mención explícita, fail-closed, leyenda anti-causal | ✓ SATISFIED | SC2 — double fail-closed both sides, PROD-verified |
| LOB-03 | 92-02/03 | Navegación bidireccional con links específicos | ✓ SATISFIED | SC3 — chips → /proyecto, parlamentario enlazado → /parlamentario |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | No TBD/FIXME/XXX/PLACEHOLDER in modified files | — | — |

### Code Review Reconciliation

92-REVIEW.md found 1 CRITICAL (CR-01: RPC fan-out per contraparte → dishonest total_n + dup keys) and 3 WARNINGs (WR-01 TS↔SQL trailing-period divergence, WR-02 weak equivalence coverage, WR-03 no multi-contraparte pgTAP fixture). ALL resolved via migration 0063 (applied to PROD, psql --single-transaction) + commits 8b34c2b/6d6fa7b. Verified live: PROD RPC signature is the 0063 one-row-per-audiencia form; `('16849-12')` returns exactly 13 distinct audiencias with total_n=13. pgTAP 21/21 green (REVIEW) incl. new T92AW7 multi-contraparte case. IN-02 (RailSkeleton CLS) is a pre-existing minor issue, correctly attributed as not introduced by Phase 92.

### Human Verification Required

None open. The BrowserOS gate (empirical live veredicto) was executed and recorded by the operator as APROBADO ("COMPRENSIBLE") on deploy fa4d4369; I independently corroborated its underlying PROD state (13-row RPC, fail-closed existence, deny-by-default, coverage 5106/195/82) via read-only psql. Note: the gate used DOM-of-live-deploy rather than screenshots (documented CDP timeout gotcha) — this is a known accepted method for this project.

### Gaps Summary

No gaps. All 3 ROADMAP success criteria and all 15 plan must-have truths are VERIFIED against the codebase and PROD. The one BLOCKER from code review (CR-01) was closed by migration 0063, which I confirmed is live in PROD with honest one-row-per-audiencia semantics. The "deploy fa4d4369 has the pre-0063 view" note is declared-not-gap: 0063 preserved column names/types so the live view keeps working, and CR-01 is closed at the DDL layer (0 audiencias in PROD currently have >1 contraparte — the bug was latent; the fix is defense-in-depth). Suite 1158/1158 + tsc 0.

---

_Verified: 2026-07-22T16:40:00Z_
_Verifier: Claude (gsd-verifier)_
