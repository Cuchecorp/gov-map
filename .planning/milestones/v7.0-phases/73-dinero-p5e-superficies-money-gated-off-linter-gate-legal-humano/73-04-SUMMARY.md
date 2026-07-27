---
phase: 73
plan: 04
subsystem: legal-gate
tags: [money, legal, dossier, 21719, signoff-pending, operator-checkpoint, gated-off]
requires:
  - docs/legal/13-LEGAL-DOSSIER.md (existing 10-section dossier, signoff: pending)
  - app/lib/money-gate.ts (chokepoint, read-only — the flip depends on signoff)
  - 73-01/02/03 SUMMARY (anti-flip guard, mounted legend, extended linter — the mitigations reflected)
provides:
  - dossier 13 completed/reaffirmed for human 21.719 review (signoff: pending CONSERVED)
  - section 9.1 (executed state, all gated OFF) + 9.2 (operator-exclusive acts before the flip)
  - PENDING blocking operator checkpoint recorded (BrowserOS cold-read + sign-off + flip)
affects:
  - operator debt: legal sign-off 21.719 + RUT-01 write + MONEY flip to prod (all human-exclusive)
tech-stack:
  added: []
  patterns:
    - dossier is preparation-for-counsel, not a legal opinion; agent writes, human signs
    - flip conditioned on signoff: approved verifiable by YAML inspection (single source of truth)
key-files:
  created:
    - .planning/phases/73-dinero-p5e-superficies-money-gated-off-linter-gate-legal-humano/73-04-SUMMARY.md
  modified:
    - docs/legal/13-LEGAL-DOSSIER.md
decisions:
  - "Kept the dossier's nature as PREPARATION (not a dictamen): completed only agent-writable material (references to executed Phases 70-72, shipped Phase 73 mitigations, the flip condition); left every [POR VERIFICAR]/Assumption A1-A8 marked for the external asesor."
  - "Task 2 (checkpoint:human-verify, gate=blocking-human) is NOT auto-approved — it is an operator-exclusive act (BrowserOS cold-read + sign-off + flip). Recorded as a PENDING blocking checkpoint, not executed."
  - "signoff stays pending; asesor/fecha_signoff stay empty; money-gate.ts and .env.example not touched — the agent never signs nor flips."
metrics:
  duration: ~15m
  completed: 2026-07-14
  tasks: 1 auto (+1 operator checkpoint, not executed)
  files: 2
---

# Phase 73 Plan 04: Legal Dossier 13 Completed for Human Review — Sign-off + Flip DEFERRED to Operator Summary

Completed and reaffirmed `docs/legal/13-LEGAL-DOSSIER.md` (Ley 21.719 MONEY) as
**preparation material for external counsel** — reflecting the executed Phases 70-72 (all
gated OFF) and the Phase 73 anti-insinuation mitigations (single-source legend, extended
linter, anti-flip guard) — while **conserving `signoff: pending`**. The agent did NOT
approve, did NOT flip `MONEY_PUBLIC_ENABLED`, and did NOT run BrowserOS. The legal sign-off,
the MONEY flip to prod, and the BrowserOS gated-preview "comprensible" cold-read are recorded
as **PENDING blocking operator checkpoints** (operator debt, outside the autonomous run).

## What Was Built

### Task 1 — Complete/reaffirm dossier 13 (commit `ec59ea6`)

Bounded edits to `docs/legal/13-LEGAL-DOSSIER.md` that add only **agent-writable** material
(no legal decisions), keeping the document a preparation dossier, not a dictamen:

- **§3 (Terceros privados):** replaced the forward-looking "Phases 14-16 nacen deny-by-default"
  framing with the **executed** state — Phase 70 (contratos ChileCompra por **RUT exacto**),
  Phase 71 (aportes SERVEL por **nombre confirmado**, sin RUT), Phase 72 (senal
  `lobby_sector_aporte` como conteo factual, empty-honest) — all built with the gate OFF.
- **§4 (Minimizacion):** updated the DATA lock to cite Phases 70-72; added the **anti-flip
  guard (73-01)** as a third lock (freezes `=== "true"`, `.env.example=false`, no-raw-env);
  added a new subsection documenting the **Phase 73 plan 02/03 surface mitigations** as
  IMPLEMENTED — the single-source `LEYENDA_ANTI_INSINUACION_MONEY` mounted 1x/state on the 4
  surfaces, RUT-vs-name not conflated (contratos "por RUT" / aportes "por nombre confirmado",
  never conflated), provenance + verbatim monto per row, and the extended anti-insinuation
  linter with mutation self-check. Explicit conclusion: the remaining blocker to enable MONEY
  is **purely the human 21.719 sign-off**.
- **§9 (Trazabilidad y gate):** reaffirmed the flip of `MONEY_PUBLIC_ENABLED` **depends on
  `signoff: approved`** (verifiable by YAML inspection). Added **§9.1** (a table of the
  executed items, all gated OFF, incl. RUT-01 write remoto as operator debt) and **§9.2** (the
  three operator-exclusive acts before the flip: BrowserOS gated-preview cold-read, legal
  sign-off, prod flip — none executed by the agent).

**Preserved verbatim (untouched):** the front-matter `signoff: pending`, empty `asesor` /
`fecha_signoff` / `observaciones`, all `[POR VERIFICAR]` markers and Assumptions A1-A8 (left
for the external asesor to answer), the §0 descargo, §7 base-de-licitud borrador, and §8
per-dataset license table (ChileCompra = mencion de fuente; SERVEL = por verificar;
InfoProbidad = CC BY 4.0).

### Task 2 — Operator checkpoint (NOT executed — recorded as PENDING blocking)

`checkpoint:human-verify` with `gate="blocking-human"`. This is an **operator-exclusive** act
(requires local preview + operator backfill data) and is **not auto-approved / not
auto-run**. It is recorded below as pending operator debt. The agent flipped nothing.

## Operator Checkpoint (PENDING — blocking-human, not executed)

The following are human/operator-exclusive acts, deferred out of the autonomous run. MONEY
stays OFF until all three complete in order:

| # | Act | Owner | Status |
|---|-----|-------|--------|
| 1 | **BrowserOS "comprensible" cold-read** on the 4 MONEY surfaces in **gated-preview** (flag ON only in local/operator preview, NEVER prod), per 68-BROWSEROS-GATE.md, verifying the 6 UI-SPEC §Gate-de-comprension points; then **turn the flag back OFF** | operator | PENDING |
| 2 | **Legal sign-off 21.719** with external counsel; operator sets `signoff: approved` + `asesor` + `fecha_signoff` + `observaciones` in the dossier front-matter | operator + asesor | PENDING |
| 3 | **Flip to prod:** ONLY after `signoff: approved`, operator sets `MONEY_PUBLIC_ENABLED=true` in the **prod** `.env` | operator | PENDING |

Resume signal (from the plan): the operator writes "comprensible" (with the BrowserOS verdict)
or lists the failing points; the legal sign-off and the prod flip remain independent operator debt.

## Verification

- `node -e "...signoff match..."` → `OK signoff=pending, flip condicionado` (signoff is
  `pending`, dossier references `MONEY_PUBLIC_ENABLED` and cites `signoff: approved` as the
  flip condition).
- `git status --short app/lib/money-gate.ts .env.example` → empty (both untouched).
- `git status --short` → only `docs/legal/13-LEGAL-DOSSIER.md` modified.
- `pnpm vitest run lib/money-antiflip-guard.test.ts` → 12/12 pass (the 73-01 guard stays green
  after this edit — gate still `=== "true"`, `.env.example` still `=false`).

## Deviations from Plan

None — plan executed exactly as written. Task 1 (auto) completed; Task 2 (operator
checkpoint) correctly NOT executed and recorded as pending blocking operator debt.

## Anti-flip invariants confirmed (NOT flipped)

- `MONEY_PUBLIC_ENABLED` still OFF/default; `money-gate.ts` untouched (`=== "true"`).
- `.env.example` still `MONEY_PUBLIC_ENABLED=false`.
- Dossier `signoff: pending` CONSERVED; `asesor` / `fecha_signoff` still empty.
- The agent did NOT sign, did NOT flip, did NOT run BrowserOS.

## Known Stubs

None. The dossier is complete for human review; the `[POR VERIFICAR]` markers and Assumptions
A1-A8 are intentional open questions for the external asesor (legal decisions, not agent
stubs).

## Self-Check: PASSED
- FOUND: docs/legal/13-LEGAL-DOSSIER.md (modified; signoff: pending)
- FOUND: .planning/phases/73-dinero-p5e-superficies-money-gated-off-linter-gate-legal-humano/73-04-SUMMARY.md
- FOUND commit: ec59ea6
