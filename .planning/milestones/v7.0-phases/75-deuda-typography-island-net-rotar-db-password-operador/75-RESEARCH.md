# Phase 75: DEUDA — Typography island `.net-*` + rotar DB password (operador) — Research

**Researched:** 2026-07-14
**Domain:** Frontend design-system alignment (CSS typography tokens) + operator credential rotation runbook
**Confidence:** HIGH (both items are fully verified against the live codebase; zero net-new dependencies)

## Summary

Phase 75 closes the last two debts of milestone v7.0, both narrow:

1. **DEBT-05 (typography `.net-*`)** — The `/red` relation-diagram island (`app/components/red/red-graph.tsx` + the `.net-*` block in `app/app/globals.css`, lines 129–520) hard-codes raw `font-size` values in CSS (`0.875rem`, `0.75rem`, `1rem`, `0.6875rem`) instead of consuming the design system's canonical type steps the way the rest of the app does (Tailwind `text-base`/`text-sm`/`text-xs` utilities — see the honest-state block at `red-graph.tsx:428–434` which already uses `text-base`/`text-sm`). **The roadmap's "nombre 15px, banda 13px" is approximate memory language — there are NO literal 15px/13px values in the current code.** `[VERIFIED: grep — 0 matches for `15px`|`13px`|`0.9375rem`|`0.8125rem` under app/**/red/**]`. The actual, current off-grid state is that the island expresses type as ad-hoc CSS `font-size` rather than through the system's role/utility layer. The minimal, safe change is a **token/utility swap** that preserves the current rendered pixel sizes (14px name, 12px band) so the layout does not move.

2. **DEBT-06 (rotar DB password, B26)** — The Supabase Postgres password is embedded **only** in the `SUPABASE_DB_URL` connection string (`postgresql://postgres:<password>@host:5432/postgres`, `.env.example:26–29`). It is consumed **only by local DDL/bulk CLIs and psql runbooks** — `[VERIFIED: grep — 0 GitHub workflows reference SUPABASE_DB_URL]`. The CI crons and the deployed frontend authenticate with the **service_role key** (`SUPABASE_SECRET_KEY`) + REST API URL (`SUPABASE_API_URL`), which are **independent credentials unaffected by a DB-password rotation**. Rotation is an OPERATOR act in the Supabase dashboard (the agent has no dashboard access, and rotating live would break active psql/CLI connections). The agent writes the runbook; it does NOT rotate.

**Primary recommendation:** Ship DEBT-05 as a **pixel-preserving token swap** of the `.net-*` `font-size` declarations to the system's canonical type utilities/steps, guarded by an existing-behavior unit assertion plus a mandatory real-deploy `getComputedStyle` visual check (jsdom cannot see the regression). Ship DEBT-06 as an **operator runbook** (`75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md`) modeled on `74-DEBT-03-CF-TOKEN-OPERATOR-NOTE.md`, ending in an operator checkpoint. **No agent executes the rotation.**

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Typography al contrato:** El island `.net-*` (nombre, banda) se alinea a los roles/tokens tipográficos existentes del design system (Phase 19/21 crema/petróleo). No inventar nuevos tamaños; usar los roles ya definidos.
- El cambio NO debe regresionar el layout radial de `/red` (F18 LOCKED) ni el layout B seed→columna (quick 260713-izo). Verificable en `/red`.
- **DB password = acto operador:** La rotación del DB password de Supabase (B26) la ejecuta el OPERADOR en el dashboard de Supabase. El agente NO rota la credencial (no tiene acceso al dashboard; rotar rompería conexiones activas). El agente DOCUMENTA la acción (runbook/checkpoint) para el operador. Tras rotar, el operador re-carga la nueva credencial en `.env` local + GH secrets (Cuchecorp/gov-map).

### Claude's Discretion
- Detalles de la alineación tipográfica dentro del design system; reusar tokens/roles existentes.

### Deferred Ideas (OUT OF SCOPE)
- Ninguna — última fase de v7.0, deuda acotada.
- La rotación real del password = acto operador (checkpoint), no esta corrida.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEBT-05 | La typography del island `.net-*` queda alineada al design system (fuera de contrato hoy: nombre 15px, banda 13px). | Off-grid `font-size` map located (Standard Stack + Code Examples below); pixel-preserving utility/token swap; anti-regression check via real-deploy `getComputedStyle`. |
| DEBT-06 | DB password de Supabase rotado (B26) — acción de operador en el dashboard, documentada. | Password lives ONLY in `SUPABASE_DB_URL`; 0 crons use it; operator-note template (`74-DEBT-03`) + checkpoint pattern documented. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `.net-*` typography alignment | Frontend / Client (CSS + React component) | — | Pure presentation in `globals.css` + `red-graph.tsx`; no server/data involvement. |
| `/red` connector geometry (regression surface) | Browser / Client (runtime layout measurement) | — | `drawConn()` reads `getBoundingClientRect()` at render time; font metrics feed measured heights → only observable in a real browser, never jsdom. |
| DB password rotation | Operator (Supabase dashboard) | — | Credential act; no agent access; would break live connections. Agent tier = documentation only. |
| Post-rotation credential reload | Operator (`.env` local + GH secrets) | — | Secret VALUE lives only in `.env` / GH settings, never in git. |

## Standard Stack

No new dependencies. Both items use only what is already installed.

### Core (already present — verified in codebase)
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Tailwind CSS | v4 (`@import "tailwindcss"`, `globals.css:1`) | Canonical type scale via `text-*` utilities | `[VERIFIED: app/app/globals.css:1–2, app/tailwind.config.ts]` — the design system's type steps ARE the Tailwind default rem scale; the app already uses `text-base`/`text-sm`/`text-xs` elsewhere in the same component. |
| Vitest + Testing Library (jsdom) | `vitest run` (`app/package.json` scripts) | Behavior/DOM unit tests for `/red` | `[VERIFIED: app/vitest.config.ts, app/components/red/red-graph.test.tsx]` — 40+ existing tests; **jsdom does NOT evaluate layout** (documented in the test file header). |
| `psql` + `dotenv` (Node) | (local operator toolchain) | DB connection via `SUPABASE_DB_URL` | `[VERIFIED: docs/RUNBOOK-lockdown-cutover.md:96–110]` — established `DB_URL=$(node -e "require('dotenv').config()…")` + `PGCLIENTENCODING=UTF8 psql "$DB_URL"` idiom. |

### The design-system "type roles" — what `.net-*` SHOULD map to

`[VERIFIED: app/tailwind.config.ts]` — the Tailwind config extends `fontFamily`, `colors`, `borderRadius` but **defines NO custom `fontSize` scale**. Therefore the canonical type steps ARE Tailwind's defaults, addressed via utilities. The rest of the `red-graph.tsx` component already speaks this language:

| System step | Tailwind utility | rem / px | Where already used in `/red` |
|-------------|------------------|----------|------------------------------|
| Body / lead | `text-base` | 1rem / 16px | `red-graph.tsx:428` (honest-state lead) |
| Secondary | `text-sm` | 0.875rem / 14px | `red-graph.tsx:434` (honest-state link) |
| Caption / meta | `text-xs` | 0.75rem / 12px | (band/meta lines) |

### Current off-grid `.net-*` `font-size` declarations (the debt) — `[VERIFIED: app/app/globals.css]`

| Class | Current CSS value | px | Maps to system step | Role |
|-------|-------------------|----|--------------------|------|
| `.net-b-seed__nombre` | `font-size: 1rem` (`:337`) | 16px | `text-base` | Seed name ("nombre") |
| `.net-b-row__nombre` | `font-size: 0.875rem` (`:407`) | 14px | `text-sm` | Neighbor row name ("nombre") |
| `.net-b-hecho__label` | `font-size: 0.875rem` (`:448`) | 14px | `text-sm` | Fact label |
| `.net-b-hecho__ventana` | `font-size: 0.75rem` (`:454`) | 12px | `text-xs` | Time window ("banda"/meta) |
| `.net-b-row__nhechos` | `font-size: 0.75rem` (`:414`) | 12px | `text-xs` | Fact count |
| `.net-chip` | `font-size: 0.6875rem` (`:268`) | 11px | (off-step — 11px is NOT a Tailwind default step) | Cámara chip ("banda") |
| `.net-filtros__legend`, `.net-filtros__tipo` | `font-size: 0.875rem` | 14px | `text-sm` | Filter labels |
| `.net-leyenda`, `.net-microcopy`, `.net-b-seednote`, `.net-b-nota-movil`, `.net-leyenda__fuente` | `font-size: 0.75rem` | 12px | `text-xs` | Legend / microcopy |

**Interpretation of "nombre 15px, banda 13px" (roadmap):** No literal 15px/13px exists today `[VERIFIED: grep]`. The two most plausible readings — either (a) an earlier off-grid state already partially corrected, or (b) approximate description of "the name and the chip/band are on ad-hoc CSS sizes rather than system utilities." **The one genuinely off-step value today is `.net-chip` at `0.6875rem`/11px** (not a Tailwind default step). The planner should treat the debt as: *align every `.net-*` `font-size` to a canonical Tailwind step/utility, WITHOUT changing rendered pixels except where a value is off-step (11px chip) — and there, get an explicit human decision on whether 11px is intentional (chips are often intentionally sub-12px) before "rounding" it.* `[ASSUMED — needs user confirmation: A1]`

**Installation:** None.

## Package Legitimacy Audit

Not applicable — this phase installs **zero external packages**. Both items operate entirely on existing code (`globals.css`, `red-graph.tsx`) and existing operator tooling (`psql`, dashboard). No registry interaction.

## Architecture Patterns

### System Architecture Diagram — regression surface of the typography change

```
                          DEBT-05 change site
                                 │
                                 ▼
   [ globals.css .net-* font-size ]───► rendered text metrics (name/band)
                                 │
                                 ▼
                       browser layout engine
                                 │
              ┌──────────────────┴───────────────────┐
              ▼                                        ▼
   .net-b-seed height (sr.height)          .net-b-row height (rr.height)
              │                                        │
              ▼                                        ▼
   drawConn(): fan-out span = sr.height-36     ey = rr.top + min(rr.height,40)/2
              │                                        │
              └──────────────► SVG connector paths ◄───┘
                                 │
                                 ▼
                    /red radial layout B (F18 LOCKED)
                                 │
              jsdom = all rects 0 → NOT observable in unit tests
              real deploy = getComputedStyle / visual → ONLY place it shows
```

`[VERIFIED: app/components/red/red-graph.tsx:345–394]` — `drawConn()` reads `seedEl.getBoundingClientRect()` (`sr`) and each `.net-b-row` `getBoundingClientRect()` (`rr`) to compute connector anchor points. The seed fan-out span is `Math.max(sr.height - 36, 1)` (**unclamped** — grows with seed text height), while the row anchor is clamped: `ey = rr.top - cr.top + Math.min(rr.height, 40)/2 + 2`.

### Pattern 1: Pixel-preserving token/utility swap
**What:** Replace each raw `font-size: <rem>` in `.net-*` with the equivalent Tailwind utility on the JSX element (preferred — matches the honest-state block idiom) OR keep the CSS class but reference the system step, choosing the value that renders the **same px** as today.
**When to use:** All `.net-*` type declarations where the current value is already on a Tailwind step (14px→`text-sm`, 12px→`text-xs`, 16px→`text-base`).
**Example:**
```tsx
// Source: red-graph.tsx:428-434 (existing in-file idiom — the honest-state block
// ALREADY uses design-system utilities, not raw CSS font-size)
<p className="text-base leading-relaxed text-muted-foreground">…</p>
<p className="text-sm mt-2">…</p>
```
**Why it prevents regression:** identical rendered px ⇒ identical measured `sr.height`/`rr.height` ⇒ identical connector geometry. The F18 radial layout does not move.

### Anti-Patterns to Avoid
- **Changing rendered pixel sizes "to be tidy."** Any px delta on `.net-b-seed__nombre` changes the (unclamped) fan-out span → connector origins shift. Preserve px.
- **Introducing a new `--text-*` token or a new fontSize step in tailwind.config.** CONTEXT locks "no inventar nuevos tamaños; usar los roles ya definidos." Use existing utilities only.
- **Trusting the unit suite to catch a layout regression.** jsdom returns 0 for all rects (`red-graph.test.tsx:16–21` header). The unit tests assert DOM/behavior, never geometry. A green suite is necessary but NOT sufficient.
- **Touching `civic-tokens.css` or any petróleo/crema color token.** DEBT-05 is font-size only; the color/border/petróleo contract (RED-02, F18, anti-insinuación) is LOCKED and out of scope.
- **The double-`hsl()` gotcha** (`globals.css:59–72`) — irrelevant to font-size, but a reminder not to touch the token layer.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type scale for the island | A new set of `.net-*` px sizes or a custom `--text-*` token | Existing Tailwind `text-base`/`text-sm`/`text-xs` utilities | The design system's steps ARE the Tailwind defaults; the same component already uses them (`:428–434`). |
| Detecting the layout regression | A jsdom geometry assertion | Real-deploy `getComputedStyle` / visual check on `/red` | jsdom never computes layout; the cascade regression is only catchable on a real browser (memory: "cascade only catchable on real deploy"; bit twice per `globals.css:138`). |
| Rotating the DB credential | Any agent-run rotation script | Operator dashboard action + runbook | Agent has no dashboard access; live rotation breaks active connections (CONTEXT LOCKED). |

**Key insight:** Both items are "align to what already exists / document what only a human can do." Any net-new construct (new token, new script, new dependency) is a smell.

## Runtime State Inventory

> Applies because DEBT-06 is a credential rotation (a runtime-state change) and DEBT-05 is a cosmetic edit with a runtime-measurement side effect.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | None — no datastore keys or records embed the `.net-*` class names or the DB password as data. `[VERIFIED: the password is a credential, not stored data]` | None. |
| **Live service config** | **DB password** embedded in `SUPABASE_DB_URL` (`.env.example:26–29`). It is a **live Supabase credential** whose authoritative value lives in the Supabase dashboard (Settings → Database), NOT in git. Rotating it in the dashboard invalidates every copy of the old `SUPABASE_DB_URL`. | **Operator:** rotate in dashboard, then re-load the new `SUPABASE_DB_URL` value into local `.env` (and any GH secret named `SUPABASE_DB_URL` — see below; currently **none** consume it in CI). |
| **OS-registered state** | None — no Task Scheduler / systemd / pm2 entry embeds the DB password or `.net-*` names. `[VERIFIED: crons run in GitHub Actions, not OS schedulers — .github/workflows/]` | None. |
| **Secrets / env vars** | `SUPABASE_DB_URL` (carries the password). **Independent** credentials NOT affected by DB-password rotation: `SUPABASE_SECRET_KEY` (service_role key), `SUPABASE_API_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`. `[VERIFIED: .env.example:16–33; distinct credentials]` | **Operator:** update `SUPABASE_DB_URL` only. Confirm whether Cuchecorp/gov-map GH secrets include a `SUPABASE_DB_URL` value that must be refreshed (backfill.yml may run DDL via psql — see Open Questions Q1). |
| **Build artifacts** | `packages/**/dist/*.js` reference `SUPABASE_DB_URL` by **name** (env read), not by value — a rotation needs no rebuild. `.net-*` change requires the Next.js build to pick up new CSS (normal `pnpm run deploy` / OpenNext build). `[VERIFIED: grep dist/]` | Rebuild frontend for DEBT-05 (standard deploy); no rebuild for DEBT-06. |

**The canonical question — after every repo file is updated, what runtime systems still hold the old string?**
For DEBT-06: the **Supabase server itself** (until the operator rotates) and **any local `.env` / GH secret copy of `SUPABASE_DB_URL`** (until the operator re-loads). Neither is a git artifact — hence operator-only.

## Common Pitfalls

### Pitfall 1: "Green unit suite ⇒ no regression" (false)
**What goes wrong:** The `/red` connectors visibly detach from the seed/rows after a font-size tweak, but `pnpm test` stayed green.
**Why it happens:** jsdom returns `getBoundingClientRect() = 0`; the test file explicitly asserts behavior only, never coordinates (`red-graph.test.tsx:16–21`).
**How to avoid:** Keep rendered px identical (Pattern 1), AND require a real-deploy `getComputedStyle` visual check on `/red` before marking DEBT-05 done.
**Warning signs:** any diff that changes a `.net-*` `font-size` numeric value (not just its expression form).

### Pitfall 2: Rotating the DB password breaks CI / the site (assumed, but false here)
**What goes wrong:** Fear that rotation takes down the crons or the frontend.
**Why it happens:** Conflating "DB password" with "the credential the app uses." The app + crons use the **service_role key** (`SUPABASE_SECRET_KEY`) over REST, NOT the Postgres password.
**How to avoid:** Runbook must state clearly: rotation invalidates ONLY `SUPABASE_DB_URL` (local DDL/bulk CLIs + psql runbooks). `[VERIFIED: 0 workflows reference SUPABASE_DB_URL]`. Crons keep running.
**Warning signs:** a runbook step that says "re-load SUPABASE_SECRET_KEY / SUPABASE_API_URL after DB rotation" — that would be wrong; those are separate credentials.

### Pitfall 3: The `.net-chip` 11px "correction" changes the chip band silently
**What goes wrong:** Rounding `0.6875rem` (11px) up to `text-xs` (12px) to "align to a step" enlarges every cámara chip, shifting row wrap and heights.
**Why it happens:** 11px is genuinely off the Tailwind default scale; a naive "align to nearest step" enlarges it.
**How to avoid:** Treat 11px as an intentional sub-caption size unless a human says otherwise (Assumption A1). If it must be tokenized, add an explicit arbitrary utility (`text-[0.6875rem]`) that preserves px — do NOT round.
**Warning signs:** chip visual size changes; `.net-b-row__fila` wraps differently.

## Code Examples

### DEBT-05 — pixel-preserving swap (representative)
```tsx
// BEFORE (globals.css): .net-b-row__nombre { font-size: 0.875rem; font-weight: 600; }
// AFTER (option A — JSX utility, matches red-graph.tsx:428-434 idiom; 0.875rem === text-sm, same px):
<span className="net-b-row__nombre text-sm font-semibold">{displayNombre(v)}</span>
// (and drop font-size/font-weight from the .net-b-row__nombre CSS rule)
```
```css
/* AFTER (option B — keep class-based, but 11px chip stays explicit to preserve px): */
.net-chip { font-size: 0.6875rem; /* 11px — intentional sub-caption; NOT rounded to text-xs */ }
```

### DEBT-06 — operator reload of the rotated credential (runbook snippet)
```bash
# Source pattern: docs/RUNBOOK-lockdown-cutover.md:96-110 (existing idiom)
# After the operator rotates the password in the Supabase dashboard and updates .env:
DB_URL=$(node -e "require('dotenv').config(); console.log(process.env.SUPABASE_DB_URL)")
PGCLIENTENCODING=UTF8 psql "$DB_URL" -c "select 1;"   # smoke: new credential works
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.net-*` ad-hoc CSS `font-size` | Design-system Tailwind utilities (`text-*`) | This phase (DEBT-05) | Consistency; no rendered change if px preserved. |
| `@xyflow/react` radial canvas | DOM "seed → columna" layout B (`globals.css:129–133`) | quick 260713-izo (F18) | xyflow ELIMINATED; typography now plain DOM/CSS — simpler to align, but connector geometry depends on measured text heights. |

**Deprecated/outdated:** `@xyflow/react` is gone from `/red` — do not reintroduce it or reason about it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "nombre 15px / banda 13px" describes the ad-hoc-CSS state (no literal 15/13px exist); the one truly off-step value is `.net-chip` 11px, which should be preserved (not rounded) absent a human decision. | Standard Stack / Pitfall 3 | If the operator actually intends specific 15/16px name + 13/12px band targets, the swap targets differ. Confirm intended px per role before editing. |
| A2 | Rotating the DB password requires re-loading ONLY `SUPABASE_DB_URL` (not the service_role/API secrets). | Runtime State Inventory / Pitfall 2 | If some Cuchecorp/gov-map cron secretly runs psql with a `SUPABASE_DB_URL` GH secret, that secret also needs refreshing (see Q1). Verified 0 in local `.github/workflows/`, but the deployed repo `Cuchecorp/gov-map` is not inspectable from here. |

## Open Questions

1. **Does `Cuchecorp/gov-map` (the deployed repo) hold a `SUPABASE_DB_URL` GH secret used by any DDL cron?**
   - What we know: In THIS repo's `.github/workflows/`, **0** workflows reference `SUPABASE_DB_URL`; crons use `SUPABASE_API_URL` + `SUPABASE_SECRET_KEY`. `backfill.yml` exists but was not confirmed to psql.
   - What's unclear: the deployed `Cuchecorp/gov-map` mirror is not inspectable from this workspace.
   - Recommendation: The runbook must instruct the operator to **grep `Cuchecorp/gov-map` Actions secrets for any `*_DB_URL`** and refresh it if present. Safe default: assume none; verify at rotation time.

2. **Is `.net-chip` 11px intentional?** (drives A1)
   - Recommendation: default to preserving 11px; surface as a one-line human confirmation in the plan checkpoint.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Tailwind v4 build | DEBT-05 CSS/utility swap | ✓ | v4 (`globals.css:1`) | — |
| Vitest / jsdom | DEBT-05 behavior regression guard | ✓ | `vitest run` (`app/package.json`) | — |
| OpenNext + wrangler (deploy) | DEBT-05 real-deploy visual check | ✓ (operator; CI or local) | `@opennextjs/cloudflare ^1.19.11` | wrangler local (memory: deploy done locally) |
| Supabase dashboard access | DEBT-06 rotation | ✗ (agent) / ✓ (operator) | — | none — operator-only by design |
| `psql` + Node `dotenv` | DEBT-06 post-rotation smoke | ✓ (operator local) | — | — |

**Missing dependencies with no fallback:** Supabase dashboard access for the agent — **by design**; DEBT-06 is an operator checkpoint, not an agent task.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react (jsdom) |
| Config file | `app/vitest.config.ts` |
| Quick run command | `pnpm --dir app test` (`vitest run`) |
| Full suite command | `pnpm --dir app test` (full) + `pnpm --dir app typecheck` (`tsc --noEmit`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEBT-05 | `/red` island still renders name + cámara + rows + pager + provenance (behavior unchanged by the type swap) | unit (jsdom) | `pnpm --dir app test -- red-graph` | ✅ `app/components/red/red-graph.test.tsx` (40+ tests) |
| DEBT-05 | Rendered px per role unchanged (name=14px row / 16px seed, band/meta=12px) | **manual — real deploy** | `getComputedStyle` on `/red` in a real browser | ❌ **not automatable in jsdom** (Wave 0: add an assertion of the EXPECTED utility class on the name/band elements as a proxy) |
| DEBT-05 | Connectors still anchor to seed/rows (no detachment) | **manual — real deploy** visual | Load deployed `/red?seed=<id>`, verify fan-out intact | ❌ jsdom rects = 0 |
| DEBT-06 | Runbook is complete + operator checkpoint present | doc review | (plan/verifier read of `75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md`) | ❌ Wave 0: agent authors the note |

### Sampling Rate
- **Per task commit:** `pnpm --dir app test -- red-graph` (fast; behavior guard).
- **Per wave merge:** full `pnpm --dir app test` + `pnpm --dir app typecheck`.
- **Phase gate:** full suite green + **operator real-deploy `getComputedStyle`/visual check on `/red`** (DEBT-05) + **operator confirms runbook** (DEBT-06) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `app/components/red/red-graph.test.tsx` — add a **class-presence proxy assertion**: the name element carries the design-system utility (e.g. `text-sm`/`text-base`) and the band element carries `text-xs` (or the explicit chip size). This is the closest automatable guard for a "no px change" invariant given jsdom's blindness to layout.
- [ ] `75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md` — agent-authored runbook (see Security Domain).
- Framework install: none — Vitest already configured.

*(No new test framework needed.)*

## Security Domain

`security_enforcement: true`, ASVS level 1 (`.planning/config.json`).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth logic touched. |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | Cosmetic CSS + doc only; no user input. |
| V6 Cryptography / Secrets | **yes** | **DEBT-06 is a secret-rotation runbook.** The runbook MUST NOT contain any credential value; it documents the operator flow only (mirrors `74-DEBT-03-CF-TOKEN-OPERATOR-NOTE.md:56–57`: "no contiene ningún valor de secret"). Old password must be invalidated post-rotation. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret value leaked into a committed runbook | Information Disclosure | Runbook contains flow + var NAMES only; never the password. Grep the new note for `postgresql://` / any value before commit. `[VERIFIED pattern: 74-DEBT-03 note]` |
| Old DB password remains valid after "rotation" | Elevation / Spoofing | Operator confirms the old `SUPABASE_DB_URL` fails (`psql` → auth error) after rotation. |
| `.env` with new password accidentally committed | Information Disclosure | `.env` is gitignored (`.env.example:2` "NUNCA commitear `.env`"); runbook reminds operator. |

## Sources

### Primary (HIGH confidence — direct codebase verification)
- `app/app/globals.css` — `.net-*` block (lines 129–520); all `font-size` declarations; token layer (lines 9–73).
- `app/components/red/red-graph.tsx` — `drawConn()` geometry (345–394), seed/row render (563–638), honest-state utility idiom (428–434).
- `app/components/red/red-graph.test.tsx` — jsdom-cannot-measure-layout header (16–21); 40+ behavior tests.
- `app/tailwind.config.ts` — no custom `fontSize` scale ⇒ type steps = Tailwind defaults.
- `.env.example` — `SUPABASE_DB_URL` carries the password (26–29); distinct from service_role/API/JWT secrets (16–33).
- `.github/workflows/*` — 0 references to `SUPABASE_DB_URL`; crons use `SUPABASE_API_URL` + `SUPABASE_SECRET_KEY`.
- `.planning/phases/74-.../74-DEBT-03-CF-TOKEN-OPERATOR-NOTE.md` — operator-note + checkpoint template.
- `docs/RUNBOOK-lockdown-cutover.md` (96–142) — `psql "$DB_URL"` operator idiom.

### Secondary (MEDIUM)
- `.planning/STATE.md`, `.planning/REQUIREMENTS.md` (DEBT-05/06), `75-CONTEXT.md` — scope + LOCKED decisions.

### Tertiary (LOW)
- None. No web sources required (self-contained debt on existing code).

## Metadata

**Confidence breakdown:**
- Typography debt (DEBT-05): HIGH — exact off-grid map located; regression surface traced to `drawConn()`; only ambiguity is intended px (A1), flagged.
- Regression detection: HIGH — jsdom blindness confirmed in the test file itself; real-deploy check is the known control (matches memory gotcha).
- DB rotation (DEBT-06): HIGH — password isolation to `SUPABASE_DB_URL` verified; 0 CI consumers; operator-note template exists. One residual unknown = the deployed `Cuchecorp/gov-map` secret set (Q1), flagged.

**Research date:** 2026-07-14
**Valid until:** 2026-08-13 (30 days — stable; no fast-moving dependencies).

## RESEARCH COMPLETE

**Phase:** 75 - DEUDA — Typography island `.net-*` + rotar DB password (operador)
**Confidence:** HIGH

### Key Findings
- **No literal 15px/13px exist** in the code today; the roadmap language is approximate. The real DEBT-05 debt is `.net-*` classes using ad-hoc CSS `font-size` (16/14/12/11px) instead of the design-system's Tailwind utilities (`text-base`/`text-sm`/`text-xs`) — the same component already uses those utilities in its honest-state block (`red-graph.tsx:428–434`). Minimal fix = **pixel-preserving** utility/token swap.
- **The one genuinely off-step value is `.net-chip` at 0.6875rem (11px)** — preserve it, do not round to 12px, absent a human decision (Assumption A1).
- **Regression surface = `drawConn()`** (`red-graph.tsx:345–394`): connector geometry is computed from measured seed/row heights via `getBoundingClientRect()`. A px change shifts the fan-out. **jsdom returns 0 for all rects → unit tests CANNOT catch this**; only a real-deploy `getComputedStyle`/visual check on `/red` can (the documented memory gotcha).
- **DEBT-06 is cleanly operator-scoped:** the DB password lives ONLY in `SUPABASE_DB_URL`; **0 GH workflows reference it**; crons + frontend use the independent service_role key. Rotation breaks only local DDL/bulk CLIs — CI and the site keep running. Agent writes `75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md` (template: `74-DEBT-03`), never rotates.

### File Created
`.planning/phases/75-deuda-typography-island-net-rotar-db-password-operador/75-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Zero new deps; exact off-grid map verified in globals.css. |
| Architecture | HIGH | Regression surface traced to `drawConn()`; jsdom blindness confirmed in the test file. |
| Pitfalls | HIGH | All three verified against code + memory gotchas. |

### Open Questions
1. Does `Cuchecorp/gov-map` hold a `SUPABASE_DB_URL` GH secret used by a DDL cron? (0 in this repo; deployed mirror not inspectable — runbook must instruct operator to check.)
2. Is `.net-chip` 11px intentional? (Default: preserve; one-line human confirm.)

### Ready for Planning
Research complete. Planner can create PLAN.md: (1) a pixel-preserving `.net-*` type-utility swap + class-presence proxy test + real-deploy `getComputedStyle` gate; (2) an operator runbook `75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md` ending in an operator checkpoint (agent documents, does not rotate).
