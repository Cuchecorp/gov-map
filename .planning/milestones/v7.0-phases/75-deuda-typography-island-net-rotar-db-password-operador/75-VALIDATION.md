---
phase: 75
slug: deuda-typography-island-net-rotar-db-password-operador
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-14
---

# Phase 75 — Validation Strategy

> Pixel-preserving typography-utility swap (no layout math changes) + an operator-only password-rotation runbook. The true anti-regression is the real-deploy /red visual check (jsdom can't see it).

---

## Resolved facts (from research)

- No literal `15px/13px` exist — the actual debt is `.net-*` in `app/app/globals.css` hard-coding raw `font-size` (16/14/12/11px) instead of the system's Tailwind utilities (`text-base`/`text-sm`/`text-xs`) that the same component already uses (`red-graph.tsx:428–434`).
- The swap MUST be PIXEL-PRESERVING: `drawConn()` computes SVG connector geometry from measured heights (`getBoundingClientRect()`), seed fan-out unclamped → any px delta risks a `/red` regression. PRESERVE `.net-chip` `0.6875rem` (11px, off-step by design — do NOT round).
- jsdom returns 0 for all rects → unit tests CANNOT catch a layout regression. The real anti-regression is the ui-review + the operator's real-deploy `getComputedStyle`/visual check on `/red` (the documented cascade gotcha).
- DEBT-06: the password lives ONLY in `SUPABASE_DB_URL`; zero GH workflows reference it (CI/site use `SUPABASE_SECRET_KEY` + REST). Rotation breaks only local DDL/bulk CLIs. Operator-only; the note instructs checking Cuchecorp/gov-map Actions secrets for any `*_DB_URL`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (+ RTL, limited by jsdom-0-rects) |
| **Quick run** | `pnpm --filter ./app test` |
| **Typecheck** | `tsc -b` |
| **True anti-regression** | real-deploy `/red` visual/`getComputedStyle` (ui-review + operator) |

---

## Per-Task Verification Map

| Assertion | Requirement | Test Type | Command | Status |
|-----------|-------------|-----------|---------|--------|
| `.net-*` raw `font-size` swapped to the system Tailwind utilities (`text-base`/`text-sm`/`text-xs`) matching the same component's honest-state block; PIXEL-PRESERVING (16→base, 14→sm, 12→xs); `.net-chip` 0.6875rem preserved | DEBT-05 | source/RTL | `pnpm --filter ./app test` | ⬜ pending |
| `/red` radial layout (F18 LOCKED) + layout-B seed→columna not regressed — no px delta; `drawConn()` geometry untouched | DEBT-05 | ui-review + operator | ui-review + real-deploy | ⬜ pending (operator) |
| DB password rotation runbook written (`75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md`, zero credential values, model 74-DEBT-03); agent does NOT rotate | DEBT-06 | doc | grep no-secret | ⬜ pending |
| Operator rotates `SUPABASE_DB_URL` password in the Supabase dashboard + re-loads the new credential in .env + GH secrets (Cuchecorp/gov-map) | DEBT-06 | operator | manual | ⬜ pending (operator) |

*Status: ⬜ pending · ✅ green · ❌ red*

---

## Wave 0 Requirements

- [ ] A source-level test asserting no raw `font-size` remains in the `.net-*` block (all mapped to utilities, except the intentional `.net-chip`), so the debt can't silently return.

*Existing: the `.net-*` block, the Tailwind default type scale, `red-graph.tsx` honest-state utilities, the 74-DEBT-03 operator-note pattern.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/red` visual non-regression | DEBT-05 | jsdom can't measure layout; only a real deploy shows the SVG connector geometry | ui-review (static) + operator opens `/red` on the deploy, confirms radial F18 + layout-B seed→columna unchanged (BrowserOS/`getComputedStyle`). |
| Rotate the DB password | DEBT-06 | Supabase dashboard act; live rotation breaks active connections; agent has no dashboard access | Operator rotates in the dashboard, re-loads the credential in `.env` + Cuchecorp/gov-map GH secrets, per the runbook. |

---

## Validation Sign-Off

- [ ] `.net-*` swapped to utilities, pixel-preserving; `.net-chip` preserved; no raw font-size remains (except intentional)
- [ ] `/red` non-regression confirmed (ui-review + operator)
- [ ] Password rotation runbook written (no secret values); rotation deferred to operator
- [ ] `pnpm --filter ./app test` + tsc green
- [ ] `nyquist_compliant: true` when green

**Approval:** pending
