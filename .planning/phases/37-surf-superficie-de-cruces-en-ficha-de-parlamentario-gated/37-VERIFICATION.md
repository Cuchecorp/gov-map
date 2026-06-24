---
phase: 37-surf-superficie-de-cruces-en-ficha-de-parlamentario-gated
verified: 2026-06-24T13:02:00Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
---

# Phase 37: SURF — Superficie de cruces en ficha de parlamentario (gated) Verification Report

**Phase Goal:** Dejar construida (pero NO encendida) la `CrucesSection` de la ficha del parlamentario: un Server Component (Next.js 16 App Router) que llama al RPC `cruces_de_parlamentario` y renderiza señales factuales con provenance inline, sibling de `#lobby`/`#patrimonio` (nunca anidado — §9.1), detrás del gate `crucesPublicEnabled()` (default OFF). Consume `cruce_senal` de Phase 36; visible solo tras el gate legal (Phase 39).
**Verified:** 2026-06-24T13:02:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

#### ROADMAP Success Criteria (the goal-backward contract)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| SC1 | `CrucesSection` (Server Component) renders factual signals with provenance inline, sibling of `#lobby`/`#patrimonio`, behind `crucesPublicEnabled()` default OFF (mirror of money/net-gate) | ✓ VERIFIED | `cruces-de-parlamentario.tsx:156` `export async function CrucesSection` (no `"use client"`); renders `ProvenanceBadge` per evidencia item (line 140); page.tsx:103-110 wraps `<section id="cruces" className="mt-12">` (sibling, mt-12) in `crucesPublicEnabled(process.env)`; gate is byte-mirror of money-gate.ts returning `=== "true"` |
| SC2 | Gate ON renders without hydration error; gate OFF ⇒ section node ABSENT from HTML (not CSS-hidden) | ✓ VERIFIED | page.test.tsx:138-139 asserts `html.not.toContain('id="cruces"')` AND not `"Cruces con sectores"` with gate OFF; line 142-145 asserts RPC `cruces_de_parlamentario` invoked 0 times OFF; line 154-156 (ON) asserts present; line 178 asserts `ParlamentarioPage(...).resolves.toBeTruthy()` (no throw). 4/4 page tests pass |
| SC3 | Empty honesto if zero cruces; no causal verb (negative-match); each evidence traceable to original link (FND-08) | ✓ VERIFIED | `CrucesView` empty path lines 96-106 ("No se registran cruces…", no "limpio/transparente"); test:133-143 negative-asserts those words; `PROHIBIDO`/`PATRON_RUT` negative-match (test:12-15, 105-107); `ProvenanceBadge sourceUrl={item.enlace_fuente}` (line 143) → traceable per item; test:186-207 asserts 1 badge per item |

#### PLAN frontmatter must-haves (plan-specific detail)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | `crucesPublicEnabled` nace OFF (fail-closed): solo el literal "true" enciende | ✓ VERIFIED | cruces-gate.ts:40 `return env.CRUCES_PUBLIC_ENABLED === "true";`; truth-table test 5/5 pass ({}, "false", "1", "TRUE" → false; "true" → true) |
| 2 | Flag server-only, var sin prefijo NEXT_PUBLIC_ | ✓ VERIFIED | cruces-gate.ts:1 `import "server-only";`; no `NEXT_PUBLIC_` substring in file |
| 3 | Ausencia de la var ES el default seguro (OFF), no un error que se lance | ✓ VERIFIED | `crucesPublicEnabled({})` returns false (test:6-8); no throw on missing env |
| 4 | CrucesView renderiza señales factuales sin verbo causal/afinidad/score/ranking | ✓ VERIFIED | `encabezadoSenal` (lines 70-80) emits only conteo neutro + etiqueta; negative-match test passes |
| 5 | Cada item de evidencia trae ProvenanceBadge con enlace a item.enlace_fuente | ✓ VERIFIED | line 140-144; test:205-206 `getAllByText(/fuente oficial ↗/i).length === items.length` |
| 6 | Contraparte = nombre CRUDO + IdentityMarker, NUNCA enlazada, NUNCA un RUT | ✓ VERIFIED | `ContraparteCruda` (lines 51-63) text + `<IdentityMarker/>`, no `<a>`; test:112-128 asserts no link contains name, no `PATRON_RUT` |
| 7 | Cero cruces → empty honesto; NUNCA limpio/impecable/transparente | ✓ VERIFIED | lines 96-106; test:133-143 |
| 8 | CrucesSection lee RPC; error real de DB/red lanza (no degrada a "sin cruces") | ✓ VERIFIED | lines 159-166 `if (error) throw new Error(...)` |
| 9 | Tipos CruceSenalRpcRow/CruceEvidencia/CruceEvidenciaItem (forma del RPC 0040); item NO trae fecha_captura/origen | ✓ VERIFIED | types.ts:305-339; item has only tipo/fecha/contraparte_nombre_crudo/audiencia_id/enlace_fuente (no fecha_captura/origen) — Pitfall 1 honored |
| 10 | Con gate OFF la `<section id="cruces">` AUSENTE del HTML y createServerSupabase NO se llama por cruces | ✓ VERIFIED | page.test.tsx OFF case (lines 133-147) |
| 11 | `<section id="cruces" className="mt-12">` sibling, NUNCA anidado | ✓ VERIFIED | page.tsx:103-110 — sibling of `#patrimonio`, not nested in another `<section>` |
| 12 | Página importa crucesPublicEnabled de @/lib/cruces-gate (NUNCA lee CRUCES_PUBLIC_ENABLED crudo) | ✓ VERIFIED | page.tsx:14 import; uses `crucesPublicEnabled(process.env)`; raw `CRUCES_PUBLIC_ENABLED` appears ONLY in cruces-gate.ts |

**Score:** 12/12 must-haves verified (3 ROADMAP SCs + 9 distinct PLAN truths; deduplicated)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/lib/cruces-gate.ts` | `crucesPublicEnabled` fail-closed server-only | ✓ VERIFIED | 41 lines; `import "server-only"` L1; `=== "true"`; imported by page.tsx (WIRED) |
| `app/lib/cruces-gate.test.ts` | Truth-table mirror | ✓ VERIFIED | 5 cases, all pass |
| `app/components/cruces-de-parlamentario.tsx` | CrucesView puro + CrucesSection Server Component | ✓ VERIFIED | 171 lines; both exports present; no `"use client"`; imported by page.tsx (WIRED) |
| `app/components/cruces-de-parlamentario.test.tsx` | RTL: empty/provenance/identity/PROHIBIDO/PATRON_RUT/conteo | ✓ VERIFIED | 9 tests pass; PROHIBIDO + PATRON_RUT inline |
| `app/lib/types.ts` | 3 RPC tipos | ✓ VERIFIED | CruceSenalRpcRow/CruceEvidencia/CruceEvidenciaItem (305-339); used by component (WIRED) |
| `app/app/parlamentario/[id]/page.tsx` | Carril gated + skeleton + import gate | ✓ VERIFIED | section gated 103-110; CrucesSkeleton 299-308 |
| `app/app/parlamentario/[id]/page.test.tsx` | Section-gate test (ausente OFF / presente ON) | ✓ VERIFIED | 4 tests pass; renderToStaticMarkup |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| cruces-gate.ts | process.env.CRUCES_PUBLIC_ENABLED | `=== "true"` | ✓ WIRED | line 40 |
| cruces-de-parlamentario.tsx | cruces_de_parlamentario RPC | `sb.rpc(...)` in CrucesSection | ✓ WIRED | line 159 |
| cruces-de-parlamentario.tsx | ProvenanceBadge | `sourceUrl = item.enlace_fuente` | ✓ WIRED | line 143 |
| page.tsx | @/lib/cruces-gate | `crucesPublicEnabled(process.env)` wraps section | ✓ WIRED | line 14 + 103 |
| page.tsx | CrucesSection | Suspense fallback CrucesSkeleton | ✓ WIRED | lines 106-107 |

### LOCKED Gate Compliance (verified NOT violated)

| Gate | Status | Evidence |
| ---- | ------ | -------- |
| CERO DDL (no supabase/migrations changes) | ✓ HONORED | Phase 37 commits touch only app/ files; last migration 0040 from Phase 36, untouched |
| CERO grant to anon on the RPC | ✓ HONORED | 0040 (Phase 36) has `revoke execute ... from anon, authenticated` + intentional NO grant; Phase 37 added nothing |
| CERO flag flip (ships OFF, fail-closed `=== "true"`, server-only) | ✓ HONORED | gate returns `=== "true"`; no `.env` set; `import "server-only"` |
| Chokepoint: CRUCES_PUBLIC_ENABLED never read raw outside cruces-gate.ts | ✓ HONORED | raw env access appears ONLY in cruces-gate.ts:40; page.tsx uses the function |
| Pitfall 1: component never references `.fecha_captura`/`.origen` on a cruces item | ✓ HONORED | grep finds 0 such references in component; types exclude both fields |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Gate + component + page suites | `npx vitest run cruces parlamentario` | 134 passed (9 files) | ✓ PASS |
| TypeScript build | `npx tsc -b` | exit 0 | ✓ PASS |
| Full regression suite | `npx vitest run` | 294 passed (30 files) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| SURF-01 | 37-01/02/03 | `CrucesSection` Server Component, sibling, gated default OFF, empty honesto, no causal verb, provenance FND-08 | ✓ SATISFIED | All 3 ROADMAP SCs verified; REQUIREMENTS.md:53 marked `[x]`, traceability table line 102 "Complete" |

### Anti-Patterns Found

None. No TODO/FIXME/XXX/HACK/PLACEHOLDER in modified files. The `(data ...) ?? []` in CrucesSection (line 168) is the documented honest-empty path, not a stub (error path throws first, line 162).

### Human Verification Required

None for this phase. A live ON-path render against PROD is intentionally deferred to Phase 39 (RPC has no anon grant + flag OFF) — this is the LOCKED phase boundary, not a gap. The ON path is fully exercised by mock-based tests (page.test.tsx + component RTL).

### Gaps Summary

No gaps. The phase goal — a built-but-OFF `CrucesSection` (Server Component) rendering factual cruce signals with inline provenance, as a sibling rail behind a fail-closed server-only gate, consuming the Phase 36 RPC — is genuinely achieved in code. All three ROADMAP Success Criteria are verified by reading the actual source (not SUMMARY claims), corroborated by 294 passing tests and a clean typecheck. The double-lock is intact: Candado A (RPC deny-by-default, no anon grant — migration 0040 untouched) and Candado B (gate ships OFF, chokepoint-isolated). Pitfall 1 is honored (no `.fecha_captura`/`.origen` on cruces items).

---

_Verified: 2026-06-24T13:02:00Z_
_Verifier: Claude (gsd-verifier)_
