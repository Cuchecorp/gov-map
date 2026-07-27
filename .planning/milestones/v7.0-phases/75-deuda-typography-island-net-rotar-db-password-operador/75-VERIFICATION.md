---
phase: 75-deuda-typography-island-net-rotar-db-password-operador
verified: 2026-07-15T00:20:00Z
status: human_needed
score: 3/3 must-haves verified (source-level); 2 criteria carry operator-exclusive human checkpoints
overrides_applied: 0
human_verification:
  - test: "Operador rota el DB password de Supabase (B26): Dashboard → Settings → Database → Reset database password; re-carga el nuevo SUPABASE_DB_URL en .env local; revisa Cuchecorp/gov-map Actions secrets por cualquier *_DB_URL; confirma url-vieja FALLA psql auth + url-nueva funciona; confirma CI crons + sitio verdes."
    expected: "Password viejo inválido (psql auth error con url vieja), password nuevo funciona (psql select 1 → 1), CI + sitio siguen verdes (usan SUPABASE_SECRET_KEY independiente). Operador escribe 'rotado' con confirmación."
    why_human: "El agente no tiene acceso al dashboard de Supabase y rotar en vivo rompe conexiones activas — acto exclusivo de operador (autonomous:false, CONTEXT LOCKED). DEBT-06 SC#2."
  - test: "Cargar /red?seed=<id> en el deploy real y confirmar que el layout B (seed → columna + conectores SVG fan-out) es pixel-idéntico al estado previo. Opcional: getComputedStyle(el).fontSize == 16px (seed) / 14px (row) / 12px (band)."
    expected: "Layout radial /red intacto (F18 LOCKED); geometría de conectores drawConn() sin desplazamiento; font sizes computados 16/14/12."
    why_human: "jsdom devuelve getBoundingClientRect()=0 → la no-regresión de geometría real es invisible al unit suite. El guard source-scan solo prueba el nivel-fuente. DEBT-05 SC#3 residual T-75-01."
---

# Phase 75: DEUDA — Typography island `.net-*` + rotar DB password Verification Report

**Phase Goal:** Cerrar la deuda cosmética/operacional restante — alinear la typography fuera de contrato y rotar la credencial expuesta.
**Verified:** 2026-07-15T00:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Every `.net-*` `font-size` consumes a design-system token (`var(--text-base\|sm\|xs)`) except the intentional `.net-chip` 0.6875rem, pixel-preserving | ✓ VERIFIED | `git show 300958c` diff is **font-size-only** + the `.net-chip` comment; 14 swaps: `1rem→var(--text-base)` ×1 (L341), `0.875rem→var(--text-sm)` ×7 (157,172,217,411,452,487,506), `0.75rem→var(--text-xs)` ×6 (257,294,350,418,458,465). `.net-chip` `0.6875rem` PRESERVED (L272) with explanatory comment. No `font-weight`/color(`hsl()`)/spacing value changed. |
| 2 | Swap is pixel-preserving → `drawConn()` connector geometry untouched | ✓ VERIFIED | Tailwind v4 defaults: `--text-base`=1rem, `--text-sm`=0.875rem, `--text-xs`=0.75rem (NO `fontSize` override in `tailwind.config.ts`). Each token == the old rem exactly → zero rendered px delta. `red-graph.tsx` last touched by pre-phase commit `8e2a5fe`; `tailwind.config.ts` by `21-01` — neither in any phase-75 commit. Git diff stat empty. |
| 3 | Source-level guard test fails if a raw-rem `font-size` reappears in `.net-*` (except `.net-chip`) | ✓ VERIFIED | `red-graph.test.tsx` `describe("DEBT-05…")` reads `globals.css`, isolates the `.net-*` region between stable markers (both present: L129 open, L560 close), scans every `font-size`, asserts each is `var(--text-*)` or `0.6875rem`. **Mutation confirmed:** reverting L341 to `1rem` → test FAILED with `Infractores: ["1rem"]`; restored (tree clean). |
| 4 | DB password rotation flow documented (zero credential values, blast radius scoped) | ✓ VERIFIED | `75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md` exists; only credential-shaped string is the `<password>`/`<host>` **placeholder** (L24); grep for populated `postgresql://…:secret@` / `password=<value>` → none. Blast radius scoped to `SUPABASE_DB_URL`; `grep SUPABASE_DB_URL .github/workflows/` → **0** (verified independently). |

**Score:** 3/3 must-have truths verified at source level (the guard, the swap, the note). SC#2 (rotation act) + SC#3 (visual non-regression) carry operator-exclusive human checkpoints — see below.

### ROADMAP Success Criteria Mapping

| SC | Text | Status | Note |
| -- | ---- | ------ | ---- |
| 1 | Typography `.net-*` alineada al design system | ✓ VERIFIED | Roadmap's "nombre 15px, banda 13px" is a loose description of the off-contract grievance; actual code was 16/14/12 (raw rem), now mapped pixel-identically to `--text-*` (which ARE 16/14/12). Contract-consumption achieved. |
| 2 | DB password rotado por operador, documentado | ⏳ HUMAN | Documented (verifiable now, VERIFIED). Rotation act is operator-exclusive → PENDING blocking checkpoint. Correctly NOT falsely closed as "rotado" in the note (Estado L98 unchecked). |
| 3 | Typography no regresiona `/red` (F18 LOCKED) | ⏳ HUMAN | Pixel-preservation VERIFIED at source (font-size-only, identical rem, protected files untouched). True visual non-regression jsdom-blind → operator real-deploy check. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/app/globals.css` | `.net-*` font-size → `--text-*` tokens, `.net-chip` preserved | ✓ VERIFIED | 14 `var(--text-*)` + 1 `0.6875rem`; contains `var(--text-` ✓; diff scoped to font-size + comment. |
| `app/components/red/red-graph.test.tsx` | source guard, no raw-rem in `.net-*` except `.net-chip` | ✓ VERIFIED | Contains `.net-chip` / `0.6875rem` whitelist ✓; region-isolation + regex + named-infractor assertion; mutation-confirmed biting. |
| `75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md` | zero-credential runbook, blast radius scoped | ✓ VERIFIED | 6-section note; zero populated secrets; `SUPABASE_DB_URL`-only scope; verbatim "no contiene ningún valor de secret" guarantee. |
| `app/components/red/red-graph.tsx` | UNCHANGED (drawConn geometry) | ✓ VERIFIED | Last commit `8e2a5fe` (pre-75); not in any phase-75 commit. |
| `app/tailwind.config.ts` | UNCHANGED | ✓ VERIFIED | Last commit `21-01`; not in any phase-75 commit. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `globals.css .net-*` | Tailwind v4 `--text-*` scale | `font-size: var(--text-*)` | ✓ WIRED | 14 declarations reference `var(--text-…)`; no `fontSize` override in config → tokens resolve to defaults. |
| `red-graph.test.tsx` guard | `globals.css .net-*` region | `readFileSync` + region markers + regex | ✓ WIRED | Both region markers present (L129/L560); test ran and passed; mutation makes it fail. |
| operator note | `SUPABASE_DB_URL` blast radius | grep workflows = 0 consumers | ✓ WIRED | Independent grep confirms 0 workflow references; CI uses `SUPABASE_SECRET_KEY` over REST. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full red-graph + app suite passes with guard | `pnpm test -- red-graph` | 820 passed / 74 files | ✓ PASS |
| Guard bites on reintroduced raw rem | sed L341 `var(--text-base)`→`1rem`, run DEBT-05 | 1 failed: `Infractores: ["1rem"]`; restored | ✓ PASS |
| No populated credential in operator note | grep `postgresql://…:secret@` / `password=<value>` | only `<password>`/`<host>` placeholder | ✓ PASS |
| 0 workflows reference DB password | `grep -rl SUPABASE_DB_URL .github/workflows/` | 0 | ✓ PASS |
| Working tree clean after mutation test | `git status --porcelain` | empty | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| DEBT-05 | 75-01 | `.net-*` typography alineada al design system | ✓ SATISFIED | Truths 1-3 verified; guard biting; protected files untouched. |
| DEBT-06 | 75-02 | DB password rotado (B26), acción de operador documentada | ⏳ HUMAN (documented) | Note verified (zero creds, scoped); rotation is a PENDING blocking operator checkpoint — correctly NOT falsely closed. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No TBD/FIXME/XXX in phase-75 modified files; no stub; no hardcoded-empty render path | none | Clean. The unchecked operator checkbox (note L98) is a by-design blocking checkpoint, not a debt marker. |

### Human Verification Required

**1. DB password rotation (DEBT-06 SC#2) — operator-exclusive, blocking**
- **Test:** Supabase Dashboard → Settings → Database → Reset database password; re-load new `SUPABASE_DB_URL` in local `.env`; check Cuchecorp/gov-map Actions secrets for any `*_DB_URL`; confirm old url FAILS `psql` auth + new url works; confirm CI crons + site stay green.
- **Expected:** Old credential invalidated, new works, CI + site unaffected (independent `SUPABASE_SECRET_KEY`). Operator writes "rotado".
- **Why human:** No dashboard access; live rotation breaks active connections (`autonomous:false`, CONTEXT LOCKED).

**2. `/red` visual non-regression (DEBT-05 SC#3) — jsdom-blind**
- **Test:** Load deployed `/red?seed=<id>`; confirm layout B (seed → columna + SVG fan-out) is pixel-identical. Optional: `getComputedStyle(...).fontSize` = 16/14/12.
- **Expected:** Radial layout intact (F18 LOCKED); `drawConn()` geometry unshifted.
- **Why human:** jsdom `getBoundingClientRect()=0` → real pixel geometry unverifiable in unit tests (residual T-75-01).

### Gaps Summary

No gaps. All three phase-75 must-have truths are verified in the codebase: the 14-declaration pixel-preserving token swap is font-size-only (color/weight/spacing untouched), the `.net-chip` 11px off-step is preserved with a comment, the source-scan guard genuinely bites (mutation-confirmed: `Infractores: ["1rem"]`), the protected files (`red-graph.tsx`, `tailwind.config.ts`) are provably untouched by any phase-75 commit, and the operator note contains zero credential values with a correctly-scoped blast radius (0 workflow consumers). The full app suite is green (820/820).

DEBT-06 is honestly NOT falsely closed as "rotated" — the note tracks the rotation as a PENDING blocking operator checkpoint (Estado L98 unchecked). Two success criteria (SC#2 rotation act, SC#3 real-deploy visual) are operator-exclusive/jsdom-blind and correctly routed to human verification. Per the decision tree, non-empty human-verification section → **status: human_needed**. No re-plan is needed; the phase is ready for the operator checkpoints.

---

_Verified: 2026-07-15T00:20:00Z_
_Verifier: Claude (gsd-verifier)_
