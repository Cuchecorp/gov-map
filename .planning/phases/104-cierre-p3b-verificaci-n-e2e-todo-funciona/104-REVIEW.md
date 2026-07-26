---
phase: 104-cierre-p3b-verificaci-n-e2e-todo-funciona
reviewed: 2026-07-26T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - app/app/cuenta/actions.ts
  - app/app/cuenta/constants.ts
  - app/app/cuenta/page.tsx
  - app/components/militancias-de-parlamentario.tsx
  - app/components/parlamentarios-filtro.tsx
  - app/components/partido-chip.tsx
  - app/lib/format.test.ts
  - app/lib/format.ts
  - docs/legal/102-LEGAL-DOSSIER-VSIM.md
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: fixed
fixed:
  at: 2026-07-26T00:00:00Z
  fixer: gsd-code-fixer
  in_scope: 4
  fixed: 4
  skipped: 2
  skipped_ids: [IN-01, IN-02]
  tests_passed: true
  test_command: "vitest run (app) + tsc --noEmit"
  commits:
    WR-01: 8fbe951
    WR-02: f3fb0be
    WR-03: cac1ffa
    WR-04: a83d875
---

# Phase 104: Code Review Report

**Reviewed:** 2026-07-26T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 104 is an E2E-closure surface: (1) `/cuenta` gate-first refactor so the user
Supabase client is never instantiated with the flag OFF; (2) `CONSENT_VERSION` moved out
of the `"use server"` module into `constants.ts`; (3) a new `partidoLegible()` display-only
sanitizer for BCN RDF party URIs, wired into three render sites; (4) a VSIM legal-dossier
frontmatter sign-off change.

No BLOCKER-tier defects found. The deployed code (b467d41a) does **not** require another
redeploy on the basis of anything found here — all four warnings are edge cases or
consistency issues that do not break the live happy path (real BCN party data is
lowercase-scheme, so `partidoLegible` sanitizes it correctly today).

Positive verifications performed:
- **Gate-first fix (104-02) is correct.** With `NOTIF_PUBLIC_ENABLED` OFF, `page.tsx`
  returns BEFORE `clienteRender()` (line 107), so `createUserClient` (fail-loud without
  `SUPABASE_PUBLISHABLE_KEY`) is never reached — the "no disponible" state can no longer
  become a 500. No auth regression: `getClaims()`/session logic is unchanged and only runs
  when the gate is ON.
- **`CONSENT_VERSION` move is clean.** The only runtime consumer (`actions.ts:12`) imports
  from `./constants`. The old `export { CONSENT_VERSION }` re-export from `page.tsx` was
  removed, but a repo-wide search found **no** consumer importing it from `./page`, so
  nothing is broken. `actions.ts` now exports 100% async functions (the OpenNext build fix).
- **`partidoLegible` happy path verified against real PROD data** (`format.test.ts` cases
  S1344 / republicano / social-cristiano) — derives readable names from the slug, emits zero
  URIs, passes legible names verbatim, and returns `null` on null/empty. It does NOT invent
  party names or add accents (honest fallback preserved).
- **Anti-flip invariant holds:** `.env.example` still has `VSIM_PUBLIC_ENABLED=false` and
  `NOTIF_PUBLIC_ENABLED=false` — the dossier sign-off flip does not touch the guarded default.

## Warnings

### WR-01: `partidoLegible` leaks a raw URI verbatim when the BCN scheme/host is uppercased

**Status:** FIXED (commit `8fbe951`) — regex `/i` flag añadida (scheme/host case-insensitive, RFC 3986); slug capturado intacto. Test de host en mayúscula añadido a la invariante anti-URI. Suite verde.

**File:** `app/lib/format.ts:154`
**Issue:** The detection regex is
`/^https?:\/\/datos\.bcn\.cl\/.*\/partido-politico\/(.+?)\/?$/` — case-SENSITIVE on the host.
A URI whose scheme/host is uppercased or mixed-case (`HTTP://DATOS.BCN.CL/.../partido-politico/x`)
fails to match, falls through rule 2 (passthrough verbatim), and the **raw URI is rendered
into the DOM** as the party label — exactly the "URI-como-partido" defect this function
exists to prevent. URIs are case-insensitive in scheme+host per RFC 3986, so an upstream
source variation would silently defeat the sanitizer. The context explicitly asked to verify
uppercase handling; today's PROD data is lowercase so this is latent, not live.
**Fix:** Make the scheme/host match case-insensitive without affecting the captured slug:
```ts
const m = /^https?:\/\/datos\.bcn\.cl\/.*\/partido-politico\/(.+?)\/?$/i.exec(s);
```
(Or lowercase only the host portion before testing.) Add a test case with an uppercase host
to `format.test.ts` so the invariant "never leaks `http`/`datos.bcn.cl`" also covers casing.

### WR-02: Degenerate BCN URI (empty slug) renders the raw URI instead of an honest fallback

**Status:** FIXED (commit `f3fb0be`) — se reconoce PRIMERO que es un URI BCN de partido y LUEGO se extrae el slug; sin palabras utilizables → `null` (omisión honesta), jamás el raw URI. Tests para slug vacío, whitespace-solo y solo-guiones. Suite verde.

**File:** `app/lib/format.ts:154-161`
**Issue:** A BCN party URI with an empty/trailing-only slug
(`http://datos.bcn.cl/recurso/cl/organismo/partido-politico/` or `.../partido-politico/  `)
does NOT match the `(.+?)` capture, so the function returns the raw URI verbatim (rule 2
passthrough). The intent (comment + tests) is "CERO URI en el DOM", but this edge path emits
a URL to the citizen. It is not a crash and not an invented name, but it is a display defect
that contradicts the function's stated invariant.
**Fix:** When the string is recognizably a BCN `partido-politico` URI but yields no usable
slug, return `null` (honest omission) rather than passing the URI through:
```ts
if (/^https?:\/\/datos\.bcn\.cl\/.*\/partido-politico\//i.test(s)) {
  const m = /\/partido-politico\/(.+?)\/?$/i.exec(s);
  const slug = m?.[1] ?? "";
  const words = slug.split("-").filter((p) => p.length > 0);
  return words.length ? words.map((p) => p[0].toUpperCase() + p.slice(1)).join(" ") : null;
}
return s;
```

### WR-03: VSIM dossier body contradicts its own (now `approved`) frontmatter

**Status:** FIXED (commit `cac1ffa`) — prosa de secciones 0 y 9 actualizada a "estado actual (2026-07-26): `approved`", registrando la autorización verbatim del operador ("Sí — firmar y flip ON", pre-autorización de esta corrida) y que el agente solo DOCUMENTA. `depende_de`/`nota` del YAML reconciliados. Análisis empírico/legal (secciones 1-8, 10) SIN alterar. anti-flip guard verde (20/20).

**File:** `docs/legal/102-LEGAL-DOSSIER-VSIM.md:7` vs `:25`, `:258`
**Issue:** The frontmatter was flipped to `signoff: approved`, but the body prose still
asserts the opposite in two load-bearing places: section 0 line 25 says
"(`signoff: pending`)" and "El agente NO firma, NO pone `approved`", and section 9 line 258
says "su front-matter YAML (`signoff: pending`)". In a legally/editorially load-bearing
sign-off document that gates a public flag, a self-contradiction between the machine-read
frontmatter (`approved`) and the human-read prose (`pending`, "agent must not approve")
undermines the auditability the document is designed to provide — a later reader cannot tell
which statement is authoritative.
**Fix:** Update the prose in sections 0 and 9 to reflect the current state (approved by
operator on 2026-07-26) or add a dated "estado actual" note at the top, so the narrative and
the YAML agree. Since the `depende_de`/`nota` fields still say sign-off is operator debt, at
minimum reconcile those with `signoff: approved`.

### WR-04: `SesionBlock` interpolates raw DB error messages into thrown errors — inconsistent with the WR-02 no-leak posture used everywhere else in this feature

**Status:** FIXED (commit `a83d875`) — espeja el patrón de `actions.ts` WR-02: `console.error` server-side con solo `{ code }` (no-PII) y `throw` de un mensaje fijo genérico, en las dos lecturas RLS (suscripción + consentimiento). tsc --noEmit limpio; suite verde.

**File:** `app/app/cuenta/page.tsx:221,224`
**Issue:** `throw new Error(\`cuenta: no se pudieron leer las suscripciones: ${suscErr.message}\`)`
(and the consent equivalent) embeds the upstream Postgres/PostgREST error message into the
error that bubbles to the Next error boundary. This directly contradicts the security posture
enforced in the sibling `actions.ts`, whose comments and code (WR-02) explicitly forbid
interpolating upstream error messages ("NO interpolar el mensaje upstream … puede revelar
estado") and instead log only `{ code, name }` and throw a fixed generic message. Postgres
error text can carry schema/column/constraint detail. This is a user-client (RLS) read path
so exposure is limited, but the inconsistency is a real defect: the same feature applies two
opposite rules to the same class of error.
**Fix:** Mirror the `actions.ts` pattern — log the diagnostic server-side with non-PII fields
and throw a fixed message:
```ts
if (suscErr) {
  console.error("cuenta: leer suscripciones falló", { code: (suscErr as { code?: string }).code });
  throw new Error("cuenta: no se pudieron leer las suscripciones");
}
```

## Info

### IN-01: `getPartidoKey` groups by raw partido value — casing/URI variants would form separate buckets

**Status:** NOT CHANGED (by reviewer scoping) — el propio finding indica "None required for phase 104"; es una preocupación de normalización de datos en la ingesta, no un bug del código de esta fase. Sin cambio de código.

**File:** `app/components/parlamentarios-filtro.tsx:42-46`
**Issue:** The filter key is the RAW `row.partido` (correctly kept raw for filter identity, as
the comment notes). But because `partidoLegible` only sanitizes the visible *label*, two rows
whose source emitted the same party as a raw URI vs a legible name (or differing scheme case)
would appear as two distinct chips with the same visible label. This is a data-normalization
concern upstream of the display layer, not a bug in this phase's code, and is out of scope for
correctness review — noted for awareness only.
**Fix:** None required for phase 104. If duplicate-label chips are observed in PROD, normalize
`partido` at ingest, not in the display layer.

### IN-02: `partidoLegible` and `formatNombre` duplicate the "Title-Case a token" logic

**Status:** NOT CHANGED (by reviewer scoping) — el finding es explícitamente opcional ("full unification is not warranted"; las dos funciones tienen reglas distintas de partículas/sub-tokens). Extraer un helper compartido añadiría indirección sin beneficio mientras el patrón no se extienda. Sin cambio de código.

**File:** `app/lib/format.ts:157-161` and `:217-224`
**Issue:** The per-token capitalization (`p.charAt(0).toUpperCase() + p.slice(1)`) is
duplicated. Minor; the two functions have different rules (particles, sub-token delimiters) so
full unification is not warranted.
**Fix:** Optional — extract a tiny `capitalizeToken` helper if this pattern spreads further.

---

_Reviewed: 2026-07-26T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
