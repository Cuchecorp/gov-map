---
phase: 105-bcn-parser-senadores-en-origen-re-corrida-de-militancias
reviewed: 2026-07-26T20:30:00Z
depth: deep
files_reviewed: 3
files_reviewed_list:
  - packages/bio/src/parse-bcn-senadores.ts
  - packages/bio/src/parse-bcn-senadores.test.ts
  - packages/bio/src/index.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: findings
---

# Phase 105: Code Review Report

**Reviewed:** 2026-07-26T20:30:00Z
**Depth:** deep (cross-file: caller retro-compat traced into `run-bio.ts`)
**Files Reviewed:** 3
**Status:** findings (1 warning, 2 info — no blockers)

## Summary

Reviewed the URI→label fail-closed resolution added in commits `f21b66b`/`7fb6f7f`/`4ec3bcf`:
`resolverPartido`, the `PARTIDO_URI_A_LABEL` map, `parseBcnSenadoresConReporte`, and the barrel
exports. The change closes the "URI-as-partido" fabrication bug (caso testigo S1344) at origin.

**The core fail-closed contract holds.** I traced every path in `resolverPartido` and
`parseBcnSenadoresConReporte`: `partido` is only ever assigned `resuelto.label`, which is either
(a) the verbatim source `rdfs:label` or (b) a value from the frozen map. There is **no path** where
a raw party URI, or a slug-derived value, reaches the stored `partido`. Unknown URIs are skipped and
accumulated in `partidosDesconocidos`. Test D (anti-URI regression) enforces this over all output.

**Retro-compat verified.** `parseBcnSenadores(json)` still returns `SenadorMilitancia[]` and delegates
to `parseBcnSenadoresConReporte(...).militancias`. The sole non-test caller (`run-bio.ts:212`) consumes
the array shape unchanged — no regression. `run-bio.ts` does not yet surface `partidosDesconocidos`,
but per the 105-01 commit message that reporting is consumed by 105-02, not this phase.

**Map accuracy verified** against the 105-01-SUMMARY evidence table: all 7 SIN_LABEL entries (the only
load-bearing ones) match the official SERVEL name; the 20 labeled entries are defense-in-depth and are
never used on the happy path (label present short-circuits before the map). No wrong/misleading label,
no duplicate keys. Alias for the testigo resolves to "PD" (distinct from "PDC" of Demócrata Cristiano),
matching the 105-02 SUMMARY.

**No injection, no PII leak.** Query is built via `URLSearchParams`; allowlist is party + dates + name;
no RUT/nacimiento touched. Two-stage discipline intact (parser reads the R2 envelope JSON, not the source).

## Warnings

### WR-01: Map lookup via bracket access can return an inherited `Object.prototype` member (latent fail-closed gap)

**File:** `packages/bio/src/parse-bcn-senadores.ts:167-168`
**Issue:** `PARTIDO_URI_A_LABEL` is a plain (frozen) object, and resolution uses
`const mapeado = PARTIDO_URI_A_LABEL[uri]; if (mapeado) return { label: mapeado };`. Bracket access
walks the prototype chain, so if `uri` ever equaled `"constructor"`, `"toString"`, `"valueOf"`,
`"hasOwnProperty"`, etc., `mapeado` is a truthy inherited **function** — `resolverPartido` would then
return `{ label: <function> }` instead of the fail-closed `{ label: null, uriDesconocida: uri }`. That
is a silent contract violation: an unmapped "URI" would NOT be reported and would produce a non-string
`partido`. In practice this is **unreachable with real data** (a BCN `party.value` is always a full
`http://datos.bcn.cl/...` URI and can never equal a prototype key), so it is not a blocker — but the
whole point of this code is fail-closed integrity, and the guard is one line.
**Fix:** use own-property check or a prototype-less container:
```ts
const mapeado = Object.hasOwn(PARTIDO_URI_A_LABEL, uri) ? PARTIDO_URI_A_LABEL[uri] : undefined;
if (mapeado) return { label: mapeado };
// or: const PARTIDO_URI_A_LABEL = Object.freeze(Object.assign(Object.create(null), { ... }));
```

## Info

### IN-01: Cosmetic URI variance (trailing slash / case) falls to fail-closed, not to match

**File:** `packages/bio/src/parse-bcn-senadores.ts:167`
**Issue:** URI matching is exact (`===` semantics via bracket lookup) after `.trim()`. If BCN ever
emits the same party with a trailing slash or different casing, it will miss the map and be reported as
unknown (skipped). This is the **safe** direction (it can never fabricate), and is consistent with the
LOCKED "ante la duda, calidad" rule — noting only so the operator expects possible over-reporting in
`partidosDesconocidos` on cosmetic URI drift rather than a silent mismatch. No code change required.

### IN-02: `resolverPartido` return type could use a discriminated union for caller clarity

**File:** `packages/bio/src/parse-bcn-senadores.ts:160-170`
**Issue:** The return type `{ label: string; uriDesconocida?: undefined } | { label: null; uriDesconocida: string | null }`
is correct and narrows fine at the call site (`if (resuelto.label == null)`), but a named discriminated
union (e.g. `{ ok: true; label } | { ok: false; uri: string | null }`) would read more clearly and make
the "URI present but empty → don't report" branch (`uriDesconocida: null`) more self-documenting. Style
only; current form is sound and fully tested.

---

_Reviewed: 2026-07-26T20:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
