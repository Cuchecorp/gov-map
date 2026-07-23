---
phase: 96-seguridad-p3b-audit-final-sitio-supabase-net-new-no-duplicat
reviewed: 2026-07-23T00:00:00Z
fixed: 2026-07-23T00:00:00Z
depth: deep
files_reviewed: 5
files_reviewed_list:
  - app/next.config.ts
  - app/lib/env-example-guard.test.ts
  - .gitleaks.toml
  - pnpm-workspace.yaml
  - app/package.json
findings:
  critical: 0
  blocker: 0
  warning: 3
  info: 2
  total: 5
status: resolved
resolutions:
  WR-01: FIXED + LIVE (commit 0220be5, deploy 09f1d5c2) — CSP enforced en ambas superficies
  WR-02: FIXED (commit 46a9908)
  WR-03: FIXED (commit f6b61e4)
  IN-01a: WONT-FIX (preload omitido intencionalmente — documentado en _headers)
  IN-01b: FIXED como parte de WR-01 (comentario cross-ref actualizado en _headers)
  IN-02: FIXED (commit ef64d56) — minimumReleaseAgeExclude eliminado
---

# Phase 96: Code Review Report

**Reviewed:** 2026-07-23
**Depth:** deep (cross-file: CSP surfaces, env-guard heuristics vs `.env.example`, gitleaks allowlist scope, pnpm override drift)
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 96 flips the CSP from Report-Only to enforced, adds a placeholder-only guard for the
public `.env.example`, allowlists 6 gitleaks false positives, and closes 14 dependency
advisories via a Next bump + pnpm overrides. The reviewed work is largely sound and the
threat model (public repo + hostile subjects) is respected — no secrets leak, the guard is a
real detector (mutation self-check present), and the enforced SSR CSP has no obvious hole
(`default-src 'self'` correctly covers `font-src`/`frame-src`/`worker-src`, self-hosted
`next/font/google` fonts stay same-origin, `/red` and `/agenda` render inline SVG/Recharts
covered by `style-src 'unsafe-inline'`).

The material finding is a **CSP surface drift**: the phase enforced the CSP in
`next.config.ts` (SSR/API routes) but left `app/public/_headers` (static-asset path served by
Cloudflare Assets) on `Content-Security-Policy-Report-Only` with the OLD, narrower directive
set — so the "CSP enforced" claim is only half true and the two surfaces have diverged. The
remaining findings are heuristic gaps in the env-guard (false negatives on base64/short
secrets) and a coarse gitleaks allowlist (whole-path, could mask a future real secret in
those files).

## Warnings

### WR-01: CSP enforced only on SSR surface — `public/_headers` still Report-Only and directive-drifted

**File:** `app/public/_headers:14` (and cross-ref `app/next.config.ts:31-44`)
**Issue:** Plan 96-03 flipped `next.config.ts` to an enforced `Content-Security-Policy` and
added two NET-NEW directives (`connect-src 'self'`, `object-src 'none'`). But the parallel CSP
surface — `app/public/_headers`, which the file's own header comment says covers the static
asset path (`/_next/static/*`, `/icon-*.png`, svgs) served by Cloudflare Assets — was NOT
touched in this phase (last commit `3cb8fd0`, phase 85). It still emits:

```
Content-Security-Policy-Report-Only: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

Two concrete gaps vs the enforced SSR policy:
1. It is `-Report-Only` → **not enforced** on static-asset responses. The phase's own
   summary and the BrowserOS gate validated 0 CSP errors on SSR pages, not on the
   static-asset path, so the "enforced LIVE" evidence does not cover this surface.
2. It is missing `object-src 'none'` and `connect-src 'self'` that were added to the SSR
   policy — the two policies have drifted.

Static assets are a lower injection surface than SSR HTML (they are the JS/CSS/images
themselves), so this is not a Critical hole — but it directly contradicts the phase's stated
outcome ("CSP enforced") and leaves a maintainer believing both surfaces are enforced when
one is not.
**Fix:** Bring `app/public/_headers` in line with `next.config.ts`: rename the key to
`Content-Security-Policy` (drop `-Report-Only`) and add the two new directives so both
surfaces are byte-consistent:
```
  Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```
Then re-verify the static path (`curl -sI .../_next/static/... `) shows the enforced header,
mirroring the SSR curl evidence.

### WR-02: env-example guard has false-negative gaps for base64 and short secrets

**File:** `app/lib/env-example-guard.test.ts:99-110` (and `:81`, `:88`)
**Issue:** The generic-token heuristic only matches `^[A-Za-z0-9_\-\.]{20,}$` — it excludes
`/`, `+`, `=`. A standard-alphabet base64 secret (e.g. an R2 secret, an HMAC/JWT-secret blob,
`abc/def+ghij==...`) that does NOT also start with `eyJ`/`sb_secret_` and is not pure hex
would slip through as a false negative. Likewise, a real credential shorter than 20 chars
that is not hex-32 (e.g. a short API ticket like `MERCADOPUBLICO_TICKET=a1b2-c3d4-e5f6`, or a
password committed as `SUPABASE_JWT_SECRET=hunter2hunter2`) is not caught by any rule. The
guard is a useful defense-in-depth net, but its "0 offenders" green is weaker than it reads:
it proves the *known* secret shapes are absent, not that all secrets are.
**Fix:** Broaden the alphabet to include base64 chars and lower the length floor with an
entropy/non-placeholder check, e.g. also flag values ≥12 chars that are not in the config
allowlist and not a bare URL/hostname:
```ts
// base64-ish secret (standard + url-safe alphabet)
if (value.length >= 20 && /^[A-Za-z0-9_\-.+/=]{20,}$/.test(value) && !value.includes("://")) {
  offenders.push(trimmed); continue;
}
```
Add a self-check fixture that MUERDE on a base64 value with `/` and `+` so the gap stays
closed (the current §2 self-check does not exercise base64).

### WR-03: gitleaks allowlist is whole-path — will mask a future real secret in those files

**File:** `.gitleaks.toml:10-21`
**Issue:** The allowlist uses `paths = [...]` (whole-file suppression) rather than
`regexes`/`stopwords` scoped to the specific FP token or a `[[rules.allowlist]]` bound to the
offending rule. That means gitleaks will no longer scan those 6 files *at all* — including
the three `packages/dinero/src/*.test.ts` and the `camara-citaciones-semana.html` fixture. If
a future edit accidentally commits a real secret into any of those paths (e.g. a developer
pastes a live `MERCADOPUBLICO_TICKET` into an existing test fixture), the scan stays green.
For a public-repo threat model this is a latent blind spot.
**Fix:** Prefer surgical allowlisting bound to the fixture value or the rule, e.g.:
```toml
[allowlist]
  regexes = [
    '''S3CR3T-TICKET-[A-Za-z0-9]+''',   # fixture ticket constant, not a real secret
  ]
```
Scope by `rules`/`regexTarget` where possible so a *different* secret shape in the same file
is still caught. If path-level suppression must stay, keep the list as narrow as it is and add
a note that any edit to these files re-triggers manual review.

## Info

### IN-01: HSTS lacks `preload` and comment/directive drift between the two CSP surfaces

**File:** `app/next.config.ts:20-22` (and `app/public/_headers:12`)
**Issue:** `Strict-Transport-Security: max-age=31536000; includeSubDomains` omits `preload`.
This is a deliberate-conservative choice (preload is hard to reverse and needs apex-domain
control), so it is not a defect — but worth an explicit note in the handoff so it is a
decision, not an oversight. Separately, `next.config.ts:5` comments "para assets estáticos
... ver public/_headers" — that pointer is now stale relative to WR-01's drift.
**Fix:** No code change required; document the `preload` omission as intentional and, once
WR-01 is fixed, the cross-reference comment is accurate again.

### IN-02: `minimumReleaseAgeExclude` is documented-inert dead config

**File:** `pnpm-workspace.yaml:40-41`
**Issue:** The file itself documents (lines 36-39) that `minimumReleaseAgeExclude: openai@6.44.0`
is INERT — there is no `minimumReleaseAge` base setting in the repo, so the exclusion excludes
nothing. It is self-labeled dead config kept as a reminder.
**Fix:** Either remove it (the comment already flags it as a delete candidate) or leave it with
its self-documenting note; no correctness impact. The pnpm overrides themselves
(`postcss`/`esbuild`/`uuid`/`protobufjs`/`sharp`) are justified with CVE rationale and the
`brace-expansion` override was correctly removed in 96-03 (`ff16361`) after it broke
`minimatch@10` ESM — `pnpm audit --prod` remaining at 0 confirms the per-consumer resolution
is safe.

---

_Reviewed: 2026-07-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
