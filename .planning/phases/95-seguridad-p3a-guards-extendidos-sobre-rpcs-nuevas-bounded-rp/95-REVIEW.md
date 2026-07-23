---
status: findings_found
critical_count: 0
warning_count: 2
info_count: 3
---

# Phase 95 — Code Review Report

**Reviewed:** 2026-07-23
**Depth:** thorough (per-file + cross-file vs 0060/0061/0063 sources)
**Files Reviewed:** 4
**Status:** findings_found (0 Critical / 2 Warning / 3 Info)

## Summary

Phase 95 delivers two plans: (P1) migration `0064` that re-emits 9 v9.0 RPCs with
`set statement_timeout = '5s'` for DoS bounding, plus its post-apply pgTAP; (P2) two CI
guard test files (`lockdown-guard` Direction-B + crossLinkReader coverage;
`anti-insinuacion-guard` DEEPLINK surface).

The security-critical work is **solid**. I verified programmatically that all 9 RPC
bodies, argument lists, and RETURNS TABLE signatures in `0064` are byte-identical
(modulo comments/whitespace) to their source migrations `0060`/`0061`/`0063` — **zero
logic drift, zero silent repo-vs-PROD divergence**. The doble-revoke is complete (9×2 =
18 revokes), there is **no accidental GRANT** (the single `grant` token is the word
"grant" in a comment), and `security definer` + `set search_path = ''` +
`statement_timeout` are present on all 9 functions. The pgTAP `plan(36)` matches exactly
36 asserts (9 has_function + 9 aclexplode + 18 ok), and the migration and pgTAP cover the
**identical set of 9 RPC names**, all of which are in `PUBLIC_RPC_ALLOWLIST`. The
`crossLinkReader` (A3) guard and the anti-insinuación DEEPLINK self-check both exercise
the **real detector** against in-memory fixtures and genuinely bite.

No blockers. The findings below are a stale doc header, one weak self-check that tests a
reimplemented expression instead of the real detector, and minor robustness nits.

## Warnings

### WR-01: `0064` header comment says "10 RPCs" but only 9 exist (stale from plan)

**File:** `supabase/migrations/0064_bounded_rpc_statement_timeout.sql:2-3`
**Issue:** The file header states *"añade statement_timeout = '5s' a las **10 RPCs** de
0060/0061/0063"*. The migration actually — and correctly — re-emits **9** unique RPCs
(4 bio/listado + 4 cross-links + 1 lobby). The `95-01-SUMMARY.md` already documents that
the "10" was a planner miscount and 9 is right; the pgTAP header and comment were fixed to
9 but the migration header was not. For a security migration whose whole point is exact
accounting of the bounded surface, a header that overstates the count by one is a
maintainability trap — a future reader auditing "did we bound all of them?" will chase a
non-existent 10th RPC.
**Why it matters:** Documentation drift on a security boundary invites a future editor to
"restore" a phantom RPC or doubt the completeness of the set. The count is load-bearing.
**Fix:** Change line 2 to read `9 RPCs` and, for clarity, mirror the pgTAP note (line 8 of
the test file) explaining the 9-vs-10 reconciliation:
```sql
-- Phase 95 — SC#2 DoS bounding: añade statement_timeout = '5s' a las 9 RPCs de
-- 0060/0061/0063 (4 bio/listado + 4 cross-links + 1 lobby) que tienen LIMIT pero
-- cero statement_timeout. (El plan estimaba 10; las interfaces definen 9 únicas.)
```

### WR-02: Direction-B self-check is a tautology — it reimplements the filter instead of exercising `definedRpcNames`

**File:** `app/lib/lockdown-guard.test.ts:399-407`
**Issue:** The Direction-B mutation self-check builds `ghostAllowlist` + `emptyDefined`
and then runs `[...ghostAllowlist].filter((n) => !emptyDefined.has(n))` **inline**,
asserting the result has length 1. It never calls the real detector `definedRpcNames()`.
It therefore only proves that `Set.prototype.has` + `Array.prototype.filter` behave as
JS specifies — a tautology. If someone broke the parser regex in `definedRpcNames`
(line 377, e.g. dropped the `(?:public\.)?` group or mistyped `\w`), this self-check would
still pass green, defeating its stated purpose ("prueba que el guard MUERDE"). Contrast
with the crossLinkReader self-check (lines 461-468), which correctly calls the real
`crossLinkRpcNames(fixture)` detector — that is the right pattern.
**Why it matters:** The threat model is "the guard IS the wall." A self-check that cannot
detect a broken detector gives false confidence that Direction-B is protected. The real
assertion (line 390) and the `> 20` sanity (line 386) provide partial cover, so this is a
Warning, not a Blocker — but the self-check as written does not do what its comment claims.
**Fix:** Exercise the real detector against an in-memory migration string. Since
`definedRpcNames` reads from a directory, either (a) refactor it to accept SQL text (a pure
`parseDefinedRpcNames(sql: string)` helper) and self-check that, or (b) point it at a temp
dir with a synthetic `.sql`. Minimal refactor:
```ts
function parseDefinedRpcNames(sql: string): Set<string> {
  const out = new Set<string>();
  for (const m of stripSqlComments(sql).matchAll(
    /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(\w+)/gi)) out.add(m[1]);
  return out;
}
// self-check:
const defined = parseDefinedRpcNames(
  "create or replace function public.solo_esta(text) returns table(x int) ...");
const orphans = [...new Set(["funcion_fantasma_typo"])].filter((n) => !defined.has(n));
expect(orphans).toEqual(["funcion_fantasma_typo"]);   // now real detector参与
```

## Info

### IN-01: `stripSqlComments` only strips full-line comments — a trailing `-- create function ...` can inject a phantom "defined" RPC

**File:** `app/lib/lockdown-guard.test.ts:56-61` (used by `definedRpcNames`, line 373)
**Issue:** `stripSqlComments` filters lines whose *trimmed start* is `--`, so it does not
remove trailing comments on a code line. If a migration ever contained a trailing comment
like `foo(); -- create function public.ghost(text)`, `definedRpcNames` would parse `ghost`
as a defined function, masking a real orphan in Direction-B. No current migration triggers
this (verified), so it is latent.
**Why it matters:** A false "defined" name weakens the orphan check silently.
**Fix:** Strip trailing `--` comments too (reuse the `(?<!:)//`-style guard but for `--`),
or accept the residual risk explicitly in the JSDoc. Low priority.

### IN-02: DEEPLINK self-check reuses `"influencia"`, already covered by MONEY/LOBBY carriers

**File:** `app/lib/anti-insinuacion-guard.test.ts:630-641`
**Issue:** The DEEPLINK mutation self-check injects `"influencia"`, a term already present
in `TERMINOS_PROHIBIDOS` for the MONEY/LOBBY carriers. It proves the *loop* covers the
DEEPLINK surface (which is the intent, and is fine) but does not exercise a DEEPLINK-unique
term. Since the phase deliberately adds **no new** prohibited terms or negations for
DEEPLINK (documented at lines 277-278), this is acceptable and correctly bites the real
detector `detectarInsinuaciones`. Noted only for completeness.
**Why it matters:** None functionally — the self-check does bite. Purely a note that the
DEEPLINK carrier shares vocabulary with existing carriers by design.
**Fix:** None required.

### IN-03: `SUPERFICIES_DEEPLINK` files confirmed to exist; no `existsSync` guard (matches project pattern)

**File:** `app/lib/anti-insinuacion-guard.test.ts:279-282`
**Issue:** Both `components/validacion-fuente.tsx` and `components/provenance-badge.tsx`
were verified to exist on disk, are scanned by the real loop (line 472 spread), and contain
**no prohibited terms** (verified by grep). The loop's `try/catch` (lines 475-480) already
tolerates a missing file gracefully, consistent with every other `SUPERFICIES_*` array — so
the plan decision to include `provenance-badge.tsx` "sin existsSync condicional" is sound.
**Why it matters:** None — confirms the surface enumeration is correct and integrated.
**Fix:** None required.

---

## Verification performed (evidence)

- **Byte-identity of 9 RPC bodies** vs 0060/0061/0063: all 9 `body-equal=True` (comments/ws
  stripped) — no logic colada.
- **Signatures + RETURNS TABLE** vs sources: all 9 `args=True returns=True` — no 42P13 drift.
- **ACL:** 9 `create or replace`, 9 `drop`, 9 `revoke … from public`, 9 `revoke … from anon,
  authenticated`, **0 real GRANT** (the 1 `grant` hit is the word in a comment), 9 `security
  definer`, 9 `set search_path = ''`, 9 `set statement_timeout = '5s'`.
- **pgTAP:** `plan(36)` == 36 asserts (9 has_function + 9 is + 18 ok).
- **Cross-file:** migration RPC set == pgTAP RPC set (9/9 identical); all 9 ∈ allowlist.
- **crossLinkReader call site** (page.tsx:196-199) matches the (A3) regex; the definition
  `crossLinkReader(rpc: string)` (unquoted arg) does not → no false positive/negative.
- **DEEPLINK surfaces** exist and are clean of prohibited terms.

_Reviewed: 2026-07-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: thorough_
