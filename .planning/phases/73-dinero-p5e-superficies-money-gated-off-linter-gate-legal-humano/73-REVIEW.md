---
phase: 73-dinero-p5e-superficies-money-gated-off-linter-gate-legal-humano
reviewed: 2026-07-14T00:00:00Z
depth: deep
files_reviewed: 3
files_reviewed_list:
  - app/lib/money-antiflip-guard.test.ts
  - app/lib/anti-insinuacion-guard.test.ts
  - app/lib/money-presentacion.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 73: Code Review Report

**Reviewed:** 2026-07-14
**Depth:** deep (cross-file: money-gate.ts, contraparte page, parlamentario-resumen, packages/)
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Adversarial review of the legal-critical MONEY anti-flip guard (`money-antiflip-guard.test.ts`) and the anti-insinuación linter's MONEY extension (`anti-insinuacion-guard.test.ts`, `money-presentacion.ts`). Stakes: a guard with silent false-negatives gives false confidence and risks premature exposure of unproven financial links (Ley 21.719 / defamation).

The guards are well-constructed for the vectors they explicitly model, and the current tree is genuinely clean: `money-gate.ts` uses strict `=== "true"`, `.env.example` is `=false`, and no non-chokepoint file reads the raw env (verified). The mutation self-checks do bite. **However, the anti-flip guard's Vector-1 strictness check has a real additive-bypass hole** (a second lax enabling path passes all three assertions), and the linter's blocklist + surface scope have gaps that let insinuating phrasings and one money-render surface through. These are false-negatives on exactly the axis the phase flagged as highest-value.

Structural note: no `<structural_findings>` block was provided; all findings below are narrative.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Vector-1 anti-flip check asserts PRESENCE of `=== "true"`, not that it is the SOLE enabling path — additive bypass passes green

**File:** `app/lib/money-antiflip-guard.test.ts:143-163` (and the mirror assertion at `197-202`)
**Issue:**
`detectarRelajacionGate` V1a only fails if the strict literal `MONEY_PUBLIC_ENABLED === "true"` is *absent*. V1b/V1c only fail on the specific lax forms `Boolean(...)` and `!== "false"`. A mutation that **keeps** the strict comparison but **adds a second OR branch** satisfies all three checks and stays green. Verified empirically:

```
gateSrc = 'return env.MONEY_PUBLIC_ENABLED === "true"
           || env.MONEY_PUBLIC_ENABLED === "1"
           || env.NODE_ENV === "preview";'
V1a match: true (=== "true" still present) → not an offender
V1b: false, V1c: false
=> detectarRelajacionGate returns []  (GUARD STAYS GREEN)
```

This is the precise failure the phase brief calls out ("can the gate be relaxed in a way the check misses"). An agent could turn MONEY on in preview/CI/staging, or accept `"1"`, and the anti-flip guard — the load-bearing legal safeguard — would not fire. Because the gate is server-only and its only *positive* test (`money-gate.test.ts`) checks a handful of literals, nothing else catches this either. The guard's own JSDoc promises "money-gate.ts enciende SOLO con el literal 'true'" — the check does not enforce the word SOLO.

Secondary fragility on the same check: the strictness regex requires token adjacency, so a legitimate future hardening like `MONEY_PUBLIC_ENABLED?.trim() === "true"` would make V1a MISS the literal and produce a false *positive* (guard reddens on a stricter gate). Both directions stem from regex-presence being the wrong instrument for "this is the only way it turns on."

**Fix:** Assert on the structure of the return/enable expression, not mere substring presence. Minimally, add a check that the gate body contains **no additional** `MONEY_PUBLIC_ENABLED` comparison beyond the single canonical one, and no `||` on the enabling line. For example, after confirming the canonical literal is present, count comparisons and reject extras:

```ts
// after V1a passes, forbid any SECOND enabling path
const enableLine = gateSrc.match(/return[^;]*MONEY_PUBLIC_ENABLED[^;]*;/)?.[0] ?? gateSrc;
const comparisons = (enableLine.match(/MONEY_PUBLIC_ENABLED/g) ?? []).length;
if (comparisons > 1 || /\|\|/.test(enableLine)) {
  offenders.push(
    "V1: money-gate.ts tiene MÁS DE UN camino de encendido (|| o segunda comparación) — " +
    "el gate debe encender SOLO con `=== \"true\"`, sin ramas OR (preview/CI/'1').",
  );
}
```

Add a mutation self-check fixture in §4 for `... === "true" || ... === "1"` asserting a V1 offender. (A more robust long-term fix normalizes the gate to a one-liner and asserts it equals the canonical string byte-for-byte.)

## Warnings

### WR-01: Anti-insinuación blocklist is an exact-idiom denylist — misses the paraphrase space (synonyms, English, split phrasings)

**File:** `app/lib/anti-insinuacion-guard.test.ts:119-167`
**Issue:** The MONEY blocklist catches only the exact literal idioms enumerated. Adversarial paraphrases that carry the same insinuation pass. Verified missed (all returned zero hits):

- `vinculado a irregularidades`
- `beneficiado por el contrato`
- `cliente del Estado gracias a su voto`
- `recibió aportes y luego votó a favor` (temporal juxtaposition = insinuation)
- `su empresa ganó el contrato tras la votación`
- `tráfico de influencias` — note the blocklist has singular `influencia`; `influencias` fails the word-boundary and does NOT match
- `puertas giratorias`, `presuntos favores`, `nexo entre el aporte y la ley`
- `empresa vinculada al parlamentario`
- English: `kickback`, `quid pro quo`

This is inherent to a denylist and cannot be made complete, but two concrete gaps are cheap to close: (a) `influencia` should also cover `influencias`/`tráfico de influencias`; (b) `vinculado a`/`ligado a` (not only `empresa ligada a`) covers the common insinuating construction. The guard should be documented as a *tripwire for known idioms*, not a completeness guarantee — otherwise reviewers will trust it to catch editorializing it structurally cannot.
**Fix:** Add high-frequency synonyms (`influencias`, `tráfico de influencias`, `vinculado a`, `ligado a`, `beneficiado`, `favores`, `puerta giratoria`, `direccionamiento`) and add a JSDoc line stating the blocklist is non-exhaustive and copy is gated by human legal sign-off, not by this linter. Do NOT claim the linter prevents insinuation — it reduces the surface.

### WR-02: `parlamentario-resumen.tsx` renders MONEY-gated labels but is NOT in `SUPERFICIES_MONEY` — money-render surface outside linter scope

**File:** `app/lib/anti-insinuacion-guard.test.ts:102-108`
**Issue:** `components/parlamentario-resumen.tsx` (via `construirChips`, lines 142-161) emits money-specific rendered copy behind `moneyPublicEnabled(env)` — labels `"Contratos del Estado"`, `"Aportes de campaña"`, `"Financiamiento y contratos"`. It is a money-rendering component but appears in neither `SUPERFICIES_VOTO` nor `SUPERFICIES_MONEY`, so the linter never scans it. Today's labels are benign, but the phase question 2 asks explicitly "are there money-rendering components NOT in the list" — yes. Any future insinuating chip label added here ships unlinted. The comment at lines 96-100 claims the scope is "las 4 superficies de dinero + la página /contraparte" and that `parlamentario/[id]/page.tsx` covers the mounted sections — but the *chip labels* live in `parlamentario-resumen.tsx`, not the page.
**Fix:** Add `"components/parlamentario-resumen.tsx"` to `SUPERFICIES_MONEY` (its money copy is gated and citizen-facing). Consider also `lib/parlamentario-resumen-conteos.ts` if any human-readable money string can originate there.

### WR-03: Anti-flip walk root is hardcoded to `app/` — a future money-render path outside `app/` (a package) is unscanned by design

**File:** `app/lib/money-antiflip-guard.test.ts:37,220`
**Issue:** `walkSourceFiles(APP_ROOT)` only walks `app/`. Verified today that no money render or flag read lives in `packages/` (render is entirely in `app/`), so the invariant currently holds. But the guard silently assumes MONEY exposure will forever originate only inside `app/`. If a future phase moves a money component or a flag-reading helper into `packages/` (the repo already has `packages/dinero`), it escapes the raw-env scan entirely with no failing test to signal the blind spot.
**Fix:** Either (a) walk `REPO_ROOT` (already computed at line 38) instead of `APP_ROOT` for the raw-env scan, keeping the same `SKIP_DIRS`/`*.test.*` exclusions, or (b) add an explicit assertion/comment that `grep MONEY_PUBLIC_ENABLED packages/` returns only test files, so the blind spot is at least monitored. Prefer (a).

### WR-04: `walkSourceFiles` only scans `.ts`/`.tsx` — a `.mjs`/`.js`/`.cjs` file that reads the raw flag would slip the raw-env scan

**File:** `app/lib/money-antiflip-guard.test.ts:99`
**Issue:** The extension filter is `/\.(ts|tsx)$/`. Config/build files under `app/` are `.mjs` (`eslint.config.mjs`, `postcss.config.mjs` confirmed present). A future `.mjs`/`.js`/`.cjs` module (e.g. a Next config, an instrumentation hook, a middleware compiled artifact, or a hand-authored `.mjs` helper) that reads `process.env.MONEY_PUBLIC_ENABLED` would not be caught. Low likelihood today, but the guard advertises "NINGÚN archivo fuente de app/" (line 13) while only covering two extensions.
**Fix:** Extend the extension test to `/\.(ts|tsx|mjs|cjs|js)$/` for the raw-env scan (still excluding `*.test.*` and `SKIP_DIRS`), or scope the JSDoc claim to `.ts/.tsx` explicitly so it does not overpromise.

## Info

### IN-01: `estaEnAllowlist` uses exact-string relPath match — a path-casing/separator drift silently un-allowlists the chokepoint

**File:** `app/lib/money-antiflip-guard.test.ts:120-122,229`
**Issue:** The allowlist compares `rel === "lib/money-gate.ts"`. `rel` is built with `path.relative(...).split(path.sep).join("/")`, which is correct on Windows and POSIX today. But if `money-gate.ts` were ever moved or the relPath normalization changed, the chokepoint would drop out of the allowlist and the guard would fail *closed* (false positive) — the safe direction, but it would block CI on a legitimate tree. Non-blocking; noted because the allowlist is the single hinge of Vector 3.
**Fix:** No action required; optionally assert `existsSync(MONEY_GATE)` in the allowlist test so a rename produces a clear "chokepoint moved" message rather than a generic offender list.

### IN-02: Legend subtraction is safe against the substring-hole concern — documented as verified, not a defect

**File:** `app/lib/anti-insinuacion-guard.test.ts:175-182,216-219`; `app/lib/money-presentacion.ts:23-24`
**Issue (phase question 3, verified NEGATIVE):** The MONEY legend contains the blocklisted token `influencia` ("No medimos influencia ni intención"). Subtraction is done by exact-literal removal (`texto.split(neg).join(" ")`), so only the exact legend string is stripped; a standalone insinuating `influencia` elsewhere still trips. Confirmed no real insinuating phrase becomes a hidden substring of the subtracted legend. So adding the legend to `NEGACIONES_LOCKED` does NOT open a hole. One caveat worth a comment: because subtraction is exact-literal, if the rendered copy ever interpolates the legend (line breaks, JSX splitting, template concatenation) the literal won't match and the legend's own `influencia`/`compre` would self-trip — a false positive, not a false negative. Keep the legend a single unbroken string literal (it currently is).
**Fix:** None required. Optionally add a comment that the legend must remain an unbroken literal for subtraction to work.

---

_Reviewed: 2026-07-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
