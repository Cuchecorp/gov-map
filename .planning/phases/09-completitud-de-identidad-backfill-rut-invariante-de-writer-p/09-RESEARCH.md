# Phase 9: Completitud de Identidad — Backfill RUT + Invariante de Writer + Piso PII - Research

**Researched:** 2026-06-18
**Domain:** Identity reconciliation infrastructure (RUT backfill, branded-type writer invariant, RLS/PII floor) on the shipped v1.0 Observatorio identity guard
**Confidence:** HIGH (codebase integration + live source probes); MEDIUM (RUT external source viability — both official congress catalogs verified to NOT expose RUT)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Completitud de identidad**
- **Fuente del RUT (research-gated):** investigar fuentes oficiales que expongan el RUT de los parlamentarios — Senado `senadores_vigentes.php` (¿incluye RUT?), BCN/Congreso open data, perfiles de `opendata.camara.cl`. Si ninguna fuente estructurada lo entrega, usar una lista curada server-side con provenance por fila. El research de la fase DEBE resolver la fuente concreta antes de planear el conector de backfill. Hallazgo confirmado: la maestra (`supabase/seeds/parlamentario.seed.json`, 186 filas) tiene el campo `rut` pero 0 poblados.
- **Invariante de writer tipado:** un tipo branded (p.ej. `EnlaceConfirmado`) producido SOLO por una factory única que la reconciliación invoca tras un resultado `determinista`/`confirmado`. Los `*Writer` aceptan ese tipo (no un `string`/`number` crudo) para fijar `parlamentario_id`. Resultado: es estructuralmente imposible fijar el FK sin pasar por la reconciliación — `probable`/`revision`/`no_confirmado` dejan NULL + mención cruda + marca de identidad no verificada. Reusa/espeja la guarda LOCKED de v1.0 (TRAM-06) pero la sube de convención a tipo.
- **Extensión del golden set:** agregar validador de DV del RUT (módulo-11), tag persona natural vs jurídica, y casos de homónimos + colisión de RUT propios de SERVEL/ChileCompra. El gate CI ≥0.95 sigue bloqueando (sin tocar el umbral de v1.0).
- **Piso RLS/PII:** una convención + helper de migración para que toda columna PII nueva nazca oculta a `anon` (deny-by-default / sin GRANT SELECT a anon, espejo exacto de `parlamentario.rut` en v1.0). Extender la compuerta `data-routing` del LLM (`assertNoRutInLlmInput` / `assertSensitivityAllowed`) para que ningún RUT/PII nuevo pueda llegar al LLM.

**Aplicación del DDL (operativo)**
- El archivo de migración se crea en `supabase/migrations/` como parte de la fase. La APLICACIÓN al Supabase (local/nube) puede ser un paso de operador separado: memoria del proyecto dice que el push remoto de DDL está bloqueado (service key ≠ management PAT, probado 2026-06-18), y v1.0 dejó un blocker de aplicar 0011 al local. El plan debe degradar honestamente: build/typecheck no prueban que el DDL esté aplicado (falso-positivo) → marcar la aplicación como verificación humana/operador si no se puede aplicar en el entorno.

### Claude's Discretion
- Where the branded type lives (`@obs/identity` vs `@obs/adjudication`) — recommend below.
- How existing writers adopt the type without breaking — recommend below.
- The exact shape of the RLS/PII migration helper convention.

### Deferred Ideas (OUT OF SCOPE)
- Conectores de fuentes nuevas (lobby/probidad/dinero) y sus sub-maestras → Phases 11/12/14/15.
- Fichas/UI de parlamentario → Phases 10+.
- La compuerta legal de exposición → Phases 13/17.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IDENT-10 | Backfill `parlamentario.rut` server-side, internal-only (never exposed to `anon`), to enable RUT-cross of money/probidad sources | §RUT Source Resolution (both official catalogs verified to NOT carry RUT → SERVEL spike OR curated list with provenance); reuse seeder fetch policy + `SupabaseMaestraWriter` upsert by `id` |
| IDENT-11 | Extend golden set with homonym + RUT-collision cases (persona natural vs jurídica, DV inválido); CI gate ≥0.95 keeps blocking | §Golden Set Extension (`isRutValido` módulo-11 already exists in `@obs/identity`; add RUT-keyed golden cases; keep `GOLDEN_SET_GATE` threshold) |
| IDENT-12 | Generalize the confirmed-link guard into a TYPED writer-level invariant: no `*Writer` may set FK `parlamentario_id` except on `determinista`/`confirmado`; else NULL + raw mention + unverified marker | §Typed Writer Invariant (branded `EnlaceConfirmado` + single factory in `@obs/identity`; writer FK param typed `EnlaceConfirmado \| null`) |
| LEGAL-03 | Every new PII column hidden from `anon` by RLS (like `parlamentario.rut`); LLM `data-routing` gate extended to new sensitive data (no RUT/PII reaches LLM) | §RLS/PII Floor (deny-by-default migration convention mirroring 0005; pgTAP "no policy / RLS enabled" assertions; extend `assertSensitivityAllowed`/`assertNoRutInLlmInput`) |
</phase_requirements>

## Summary

This phase ships pure **identity/security infrastructure** that every later attribution dataset (votes, lobby, probidad, money, graph) reuses. It writes no new connectors and no UI. Three deliverables plus an operational DDL-application caveat.

The **single most important research finding** is decisive and verified live: **neither official congress catalog exposes the RUT.** The Senado `tramitacion.senado.cl/wspublico/senadores_vigentes.php` XML returns `PARLID, PARLAPELLIDOPATERNO, PARLAPELLIDOMATERNO, PARLNOMBRE, REGION, CIRCUNSCRIPCION, PARTIDO, FONO, EMAIL, CURRICULUM` — **no RUT element** `[VERIFIED: live probe 2026-06-18]`. The Cámara `opendata.camara.cl/.../WSDiputado.asmx/retornarDiputado` *does* have `<RUT>`/`<RUTDV>` elements, **but they are empty for every deputy probed** (`<RUT />`) `[VERIFIED: live probe of ids 1009/1012/1013/800]`. Therefore the locked fallback applies: the RUT source is **either** a SERVEL/electoral dataset (research-gated to a small spike, treat as fragile) **or** a curated server-side list with per-row provenance. **Never fabricate a RUT.** The backfill must reuse the v1.0 seeder fetch policy and the `SupabaseMaestraWriter` upsert-by-`id` path; it only updates the `rut` column on existing rows.

The **typed writer invariant** (IDENT-12) is the structural upgrade of the existing convention. Today `reconciliar-senado.ts` maps a `ResultadoPipeline` to a `Voto.parlamentario_id: string | null` *by hand* — a new writer could just pass any string. The fix is a **branded type `EnlaceConfirmado`** minted by a single factory that only the reconciliation can call after a `determinista`/`confirmado` result; every `*Writer` types its FK parameter as `EnlaceConfirmado | null`, making a raw-string FK a compile error.

**Primary recommendation:** Land the branded `EnlaceConfirmado` + factory in `@obs/identity` (every package already depends on it transitively); resolve RUT via a SERVEL/electoral spike with a curated-list fallback (both official catalogs are RUT-less — verified); reuse the existing `isRutValido` módulo-11 validator for the golden DV cases; ship one deny-by-default migration helper convention mirroring `0005` + pgTAP "RLS enabled / zero policies" assertions; and gate DDL *application* behind an explicit operator/human-verify step because build/typecheck cannot prove a migration was applied.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| RUT backfill fetch (external source) | Connector/CI (Deno, GitHub Actions or seed-cli) | — | Server-only, reuses `@obs/ingest` policy; RUT must never touch browser/anon |
| RUT write to master | Writer (service role) | Database (RLS deny-by-default) | `SupabaseMaestraWriter` updates `parlamentario.rut`; RLS guarantees anon can't read it |
| Branded confirmed-link type + factory | Domain library (`@obs/identity`) | `@obs/adjudication` (consumes pipeline result) | Pure type+factory; lowest package every writer already depends on |
| FK guard at write time | Writer (each `*Writer`) | TypeScript compiler | Invariant is enforced by the type signature, checked at compile time |
| Golden set + DV validator | Domain library (`@obs/adjudication` golden + `@obs/identity` `isRutValido`) | CI gate | Pure logic; gate runs in CI ≥0.95 |
| RLS/PII deny-by-default | Database (migration + RLS) | pgTAP (verification) | Schema is the floor; pgTAP proves anon can't read |
| LLM data-routing gate | Domain library (`@obs/llm`) | every connector/extractor | `assertNoRutInLlmInput` / `assertSensitivityAllowed` run before any LLM call |

## Standard Stack

This phase introduces **no new external packages**. It reuses the locked v1.0 stack verbatim. Confirmed by reading every relevant `package.json`.

### Core (all already installed — workspace + existing deps)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@obs/identity` | workspace | Home of branded `EnlaceConfirmado`, `matchDeterminista`, `isRutValido`, seeder, `SupabaseMaestraWriter` | Lowest identity layer; `@obs/adjudication` and all writers depend on it `[VERIFIED: package.json]` |
| `@obs/adjudication` | workspace | `correrPipeline`, `ResultadoPipeline`, golden set + gate | The single reconciliation entry; depends on `@obs/identity` `[VERIFIED: package.json]` |
| `@obs/llm` | workspace | `assertNoRutInLlmInput`, `assertSensitivityAllowed`, `SensitiveRoutingError`, `Sensitivity` type | The data-routing gate to extend `[VERIFIED: data-routing.ts]` |
| `@obs/ingest` | workspace | `Fetcher`, `HostRateLimiter`, `RobotsGuard`, `assertAllowedUrl` (SSRF allowlist) | Backfill fetch reuses this policy (rate-limit 2-3s, robots, UA) `[VERIFIED: seeder.ts]` |
| `@supabase/supabase-js` | ^2.108.2 | `SupabaseMaestraWriter` upsert/update of `parlamentario.rut` | Already the master writer `[VERIFIED: writer-supabase.ts]` |
| `zod` | ^4.4.3 | Schema validation of any new fetched source rows + RUT shape | Project standard `[VERIFIED: package.json]` |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fast-xml-parser` | ^5.9.2 | Parse Senado/Cámara XML (already used by seeder) | If RUT source is XML |
| `tsx` | ^4.22.4 | Run backfill CLI / pgTAP harness scripts | dev/CLI only |
| `vitest` | ^3.0.0 | Unit/golden tests | Test gate |
| pgTAP | (Supabase test db) | RLS deny-by-default assertions | `supabase test db` mirrors `0004_parlamentario.test.sql` |

**Installation:** None. `git grep` confirmed no new dependency is required; all symbols exist in the workspace.

## Package Legitimacy Audit

**N/A — this phase installs zero external packages.** Every capability reuses existing workspace packages (`@obs/*`) and already-locked dependencies (`@supabase/supabase-js`, `zod`, `fast-xml-parser`). No registry install, no `npm:`/`jsr:` import beyond what v1.0 already vendored. slopcheck not required.

## RUT Source Resolution (the key open question — RESOLVED)

> CONTEXT.md required this research to resolve the concrete RUT source before planning the backfill connector. **Resolved below.**

### What was probed (live, 2026-06-18)

| Candidate source | Method | RUT present? | Evidence |
|------------------|--------|--------------|----------|
| Senado `tramitacion.senado.cl/wspublico/senadores_vigentes.php` | XML GET | **NO** | Fields are `PARLID, PARLAPELLIDOPATERNO, PARLAPELLIDOMATERNO, PARLNOMBRE, REGION, CIRCUNSCRIPCION, PARTIDO, FONO, EMAIL, CURRICULUM` — no RUT element `[VERIFIED: live curl]` |
| Cámara `opendata.camara.cl/.../WSDiputado.asmx/retornarDiputado?prmDiputadoId=N` | XML GET (detail) | **Field exists, EMPTY** | `<RUT />` and `<RUTDV />` present in schema but blank for ids 1009/1012/1013/800 `[VERIFIED: live curl]` |
| Cámara `retornarDiputadosPeriodoActual` (the seed source) | XML GET (list) | **NO** | Seed file (186 rows) has `rut: null` for all `[VERIFIED: parlamentario.seed.json]` |
| SERVEL electoral open data / candidaturas | CSV/portal | **PARTIAL/UNVERIFIED** | SERVEL publishes elected-candidate datasets and a per-RUT candidate lookup; bulk RUT for elected parliamentarians is not confirmed to be cleanly downloadable `[CITED: servel.cl/estadisticas-candidatos-electos-por-partido]` `[ASSUMED: bulk RUT availability]` |
| BCN / Congreso open data | — | **UNVERIFIED** | Not probed live; BCN publishes norma XML, not roster RUT — low expectation `[ASSUMED]` |

### Conclusion (HIGH confidence on the negative; the fallback is the locked path)

**No official congress catalog exposes the RUT.** The two authoritative roster sources the master is built from are RUT-less by design (the field exists in the Cámara WS schema but is redacted/empty — consistent with the project's own minimization posture being mirrored by the source). This means the deterministic RUT-cross that money/probidad phases depend on **cannot be seeded from the congress catalogs**.

**Recommended approach (two-track, honest degradation):**

1. **Track A — SERVEL/electoral spike (attempt first, scope tightly).** Plan a small spike (mirror the VOTE-01 confirm-or-replan pattern) that checks whether a SERVEL elected-candidate dataset (or `consulta-candidato.servel.cl`) yields RUTs that can be crossed to the 186-row master by `(nombre_normalizado, periodo)` + region. Add `servel.cl` to the SSRF allowlist if pursued (already flagged for Phase 15 in STATE.md). Treat as **fragile** (artisanal, per PITFALLS C2): blocking drift, completeness check, R2 raw snapshot. Cross only `determinista` matches; never auto-confirm a RUT by name alone.

2. **Track B — curated server-side list with per-row provenance (the locked fallback, and the safe default).** If Track A doesn't reliably yield clean RUTs in this environment, maintain a curated `supabase/seeds/parlamentario-rut.seed.json` (or a column-augment of the existing seed) where each row carries `id`, `rut`, and provenance (`origen`, `fecha_captura`, `enlace` to the source where the RUT was read — e.g., an InfoProbidad declaration, an official gazette). The backfill reads this list, **validates each RUT with `isRutValido` (módulo-11) before writing**, and rejects invalid ones to a review log — never writes a guessed RUT.

**Hard rules for either track (from CONTEXT + PITFALLS A2/E1):**
- Validate the DV (módulo-11) with the existing `isRutValido` before writing.
- A RUT only counts as `determinista` against the master row's own RUT (internal field); a SERVEL/candidate RUT is a *candidate to match*, not a fact.
- RUT is written to `parlamentario.rut` only (internal, RLS deny-by-default). It is never written to any public table and never crosses to an LLM.
- Provenance per RUT row is mandatory (the master already enforces `origen/fecha_captura/enlace` NOT NULL — `0005`).

### Backfill plumbing (reuse, don't rebuild)

- **Fetch (if Track A):** reuse `runSeeder`'s pattern — `assertAllowedUrl` (SSRF) → `robots.isAllowed` → `rateLimiter.wait(host)` (2-3s) → `fetcher.get` `[VERIFIED: seeder.ts:60-66]`. Do NOT use `BaseConnector.run` (its daily cache would skip a same-day re-run — the seeder deliberately avoids it `[VERIFIED: seeder.ts:8-10]`).
- **Write:** `SupabaseMaestraWriter` already upserts by PK `id` (stable, derived from natural key) `[VERIFIED: writer-supabase.ts:65-75]`. The backfill is an **UPDATE of `rut` on existing rows by `id`** — extend the writer with a focused `updateRut(rows: {id, rut, ...prov}[])` method (mirror `promoteToConfirmado`'s chunked `.update().in("id", lote)` pattern `[VERIFIED: writer-supabase.ts:90-105]`), or pass full rows through `upsert` with `rut` populated.
- **Idempotency:** writing the same RUT twice for the same `id` is a no-op (upsert/update by `id`). Keep this property.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌──────────────────── RUT SOURCE (research-gated) ────────────────────┐
                         │  Track A: SERVEL/electoral (spike, fragile)  OR                      │
                         │  Track B: curated server-side list + per-row provenance (fallback)   │
                         └───────────────────────────────┬─────────────────────────────────────┘
                                                          │ fetch via @obs/ingest policy (2-3s, robots, UA, SSRF)
                                                          │ OR read curated JSON (no fetch)
                                                          ▼
                                          ┌──────── isRutValido (módulo-11) ────────┐
                                          │  invalid → review log (NEVER write)      │
                                          │  valid   → proceed                       │
                                          └───────────────────┬──────────────────────┘
                                                              ▼
                                        SupabaseMaestraWriter.updateRut({id, rut, prov})  (service role)
                                                              ▼
                                   ┌─────────────────── parlamentario.rut ───────────────────┐
                                   │  RLS deny-by-default (no policy, no GRANT) → anon CANNOT  │
                                   │  read. Internal-only key for future RUT-cross.           │
                                   └──────────────────────────────────────────────────────────┘

  ── TYPED WRITER INVARIANT (IDENT-12), independent of backfill ──
   foreign mention → correrPipeline() → ResultadoPipeline
        determinista/confirmado ─► confirmar(parlamentarioId) ─► EnlaceConfirmado (branded)
        probable/revision/no_confirmado ─► (no factory call) ─► null
                                          │
                                          ▼
                  *Writer.write({ parlamentario_id: EnlaceConfirmado | null, mencion_nombre, ... })
                          (raw string in this slot = COMPILE ERROR)
                                          ▼
                  public row: FK set ONLY when EnlaceConfirmado; else NULL + raw mention + IdentityMarker

  ── LLM DATA-ROUTING GATE (LEGAL-03) ──
   any prompt → assertNoRutInLlmInput(text) [throws on RUT] → assertSensitivityAllowed(task, provider) → complete()
```

### Pattern 1: Branded confirmed-link type minted by a single factory
**What:** A nominal (branded) TypeScript type `EnlaceConfirmado` that wraps a `parlamentario_id` and can only be constructed by one factory function. Writers accept `EnlaceConfirmado | null` for the FK, never a bare `string`.
**When to use:** Every `*Writer` that sets `parlamentario_id` on a public attribution row (votes today; lobby/probidad/money in Phases 11/12/14/15).
**Where it lives:** `@obs/identity` — it is the lowest package; `@obs/adjudication` already depends on it, and every connector package depends on `@obs/adjudication`/`@obs/identity` transitively. Putting it here avoids a dependency cycle and makes it importable everywhere.
**Example:**
```typescript
// Source: recommended design, grounded in @obs/identity + @obs/adjudication patterns
// packages/identity/src/enlace-confirmado.ts

declare const ENLACE_CONFIRMADO: unique symbol;

/**
 * Prueba estructural de que un parlamentario_id provino de un match
 * determinista/confirmado. NO se puede construir un valor de este tipo fuera de
 * `confirmar()` (el `unique symbol` lo hace nominal). Un writer que tipa su FK
 * como `EnlaceConfirmado | null` NO puede aceptar un string crudo.
 */
export interface EnlaceConfirmado {
  readonly parlamentarioId: string;
  readonly metodo: "determinista" | "humano"; // confirmado por máquina o humano
  readonly [ENLACE_CONFIRMADO]: true;
}

/**
 * ÚNICA factory. La invoca la reconciliación SOLO tras un resultado
 * `determinista`/`confirmado` (o una promoción humana vía revisor-cli). Mantiene
 * la guarda LOCKED de v1.0 (TRAM-06) pero como TIPO, no convención.
 */
export function confirmar(
  parlamentarioId: string,
  metodo: "determinista" | "humano" = "determinista",
): EnlaceConfirmado {
  return { parlamentarioId, metodo, [ENLACE_CONFIRMADO]: true } as EnlaceConfirmado;
}
```

### Pattern 2: Reconciliation maps the discriminated result THROUGH the factory
**What:** The existing `ResultadoPipeline` switch in `reconciliar-senado.ts` is the single choke point that decides whether to mint an `EnlaceConfirmado`. Only the `determinista` branch calls `confirmar()`.
**Example:**
```typescript
// Source: refactor of packages/tramitacion/src/reconciliar-senado.ts:139-156 [VERIFIED]
import { confirmar, type EnlaceConfirmado } from "@obs/identity";

let enlace: EnlaceConfirmado | null;
switch (res.tipo) {
  case "determinista":
    enlace = confirmar(res.parlamentarioId, "determinista"); // ONLY place a link is minted
    break;
  case "probable":      // LLM auto-accept → NEVER links the public row
  case "revision":
  case "no_confirmado":
  default:
    enlace = null;      // null + raw mention + IdentityMarker (LOCKED guard)
    break;
}
// writer receives `enlace` (EnlaceConfirmado | null) — not a raw string
```

### Pattern 3: Writer signature makes the invariant unbypassable
**What:** `*Writer` methods that persist a public attribution row type the FK as `EnlaceConfirmado | null`. The writer reads `enlace?.parlamentarioId ?? null` internally. A future Phase-11 writer that tries `parlamentario_id: someString` fails to compile.
**Example:**
```typescript
// Source: recommended adoption for packages/tramitacion/src/writer.ts and all future writers
interface VotoPublico {
  votacion_id: string;
  fuente_voter_id: string;
  mencion_nombre: string;            // always present (raw)
  enlace: EnlaceConfirmado | null;   // FK source — branded, not string
  seleccion: Seleccion;
}
// inside the writer: parlamentario_id = row.enlace?.parlamentarioId ?? null
```

### Anti-Patterns to Avoid
- **A bare `parlamentario_id: string | null` on a writer/model facing input** — this is exactly the convention IDENT-12 replaces. The `Voto` model may keep `parlamentario_id: string | null` as the *persisted DB shape*, but the **writer input** and the reconciliation output must carry `EnlaceConfirmado | null` so the FK cannot be set without minting.
- **A `confirmar()`-equivalent escape hatch** (a second factory, an `as EnlaceConfirmado` cast in connector code) — defeats the invariant. The factory must be the ONLY constructor; lint/review forbids casting.
- **Writing a RUT to any public table** — RUT lives on `parlamentario.rut` only (internal). New public rows store `parlamentario_id`, never RUT.
- **Auto-confirming a backfilled RUT by name** — a SERVEL/candidate RUT matched by name is a candidate, not a fact (PITFALL A2).
- **Trusting build/typecheck as proof a migration applied** — see DDL caveat below.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RUT DV (módulo-11) validation | A new validator | `isRutValido` from `@obs/identity` | Already implemented + tested `[VERIFIED: deterministic.ts:63-78]` |
| RUT normalization for compare | Custom strip | `normRut` from `@obs/identity` | Already exported `[VERIFIED: index.ts:3]` |
| RUT-in-prompt detection | New regex | `assertNoRutInLlmInput` | Deliberately broad fail-closed regex `[VERIFIED: data-routing.ts:46-56]` |
| Sensitivity gate to LLM | New check | `assertSensitivityAllowed` + `SensitiveRoutingError` | Shared fail-closed `[VERIFIED: data-routing.ts:63-72]` |
| Master fetch policy (rate-limit/robots/SSRF) | New connector | `runSeeder` plumbing / `@obs/ingest` | Reused verbatim `[VERIFIED: seeder.ts]` |
| Idempotent master write | New upsert | `SupabaseMaestraWriter` (upsert/update by `id`) | Stable derived PK `[VERIFIED: writer-supabase.ts]` |
| Confirmed-link decision | New rule in each writer | `correrPipeline` result → `confirmar()` factory | One choke point; reuse `matchDeterminista` |
| RLS deny-by-default | New RLS recipe per table | Copy `0005` pattern (RLS enabled, zero policies, no GRANT) | The locked PII floor `[VERIFIED: 0005_parlamentario.sql:60-64]` |
| pgTAP RLS assertion | New harness | Mirror `0004_parlamentario.test.sql` | "RLS enabled + zero policy" already asserted `[VERIFIED]` |

**Key insight:** This phase is ~80% wiring of existing, tested v1.0 symbols into a structural type and a reusable migration convention. The only genuinely new code is the branded type + factory, the `updateRut` writer method, the RUT-source ingestion (Track A) or curated list (Track B), and the new golden/RLS test cases. Resist re-implementing any identity primitive — `isRutValido`, `normRut`, `matchDeterminista`, the data-routing asserts, and the master writer already exist.

## Runtime State Inventory

> This is a refactor/infrastructure phase (it changes how FKs are set and adds a column-population step). The grep audit finds files; this finds runtime state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `parlamentario.rut` is currently NULL for all 186 rows in **both** the git seed (`parlamentario.seed.json`) **and** any seeded Supabase instance (local/remote). The seed snapshot is the git-authoritative source of truth (ID-09). | Data migration: populate `rut` on existing rows by `id` (backfill), then re-export the seed snapshot (`exportMaestra`/`serializeMaestra`) so git stays authoritative. Both the DB AND the seed file must be updated. |
| Live service config | None. No external service stores the v1.0 identity convention. | None — verified by reading `@obs/ingest` allowlist + orchestration; no external registration of identity logic. |
| OS-registered state | None — no scheduled task/process embeds the identity guard string. | None. |
| Secrets/env vars | RUT backfill (Track A) needs no new secret. Master write uses the existing local `SUPABASE_*` service key. RUT source URL (if SERVEL) needs the `servel.cl` SSRF allowlist entry, not a secret. | None for secrets; allowlist edit only if Track A pursued. |
| Build artifacts / installed packages | The branded type is a new export of `@obs/identity`; consumers (`@obs/tramitacion` and future writers) recompile via `tsc -b`. No stale egg-info/global install. | Rebuild workspace (`tsc -b`) after adding the export — covered by normal typecheck. |

**Critical dual-write reminder:** The backfill is a *data migration* (populate existing rows) AND requires a *seed re-export* (git snapshot). These are two distinct tasks — the plan must include both, or the next `runSeeder`/restore would wipe the backfilled RUTs back to null.

## Common Pitfalls

### Pitfall 1: Both official catalogs are RUT-less — planning a "RUT connector" against them wastes the phase
**What goes wrong:** Assuming `senadores_vigentes.php` or `retornarDiputado` will yield RUT and building a connector around them.
**Why it happens:** The Cámara WS *has* a `<RUT>` element in its schema, which looks promising.
**How to avoid:** It is verified empty/absent (live probe). Go straight to the SERVEL spike (Track A) or curated list (Track B). Do not budget connector work against the congress catalogs for RUT.
**Warning signs:** A task titled "fetch RUT from Senado/Cámara" — it cannot succeed.

### Pitfall 2: The branded type leaks if any code can cast or re-mint
**What goes wrong:** A second factory, a re-export of the symbol, or an `as EnlaceConfirmado` cast in a connector lets a writer set the FK without a confirmed match — silently re-opening risk existencial #1.
**Why it happens:** TypeScript branding is convention-enforced at the module boundary; a cast bypasses it.
**How to avoid:** Keep the `unique symbol` private to the module (do not export it). Export only `EnlaceConfirmado` (the type) and `confirmar` (the factory). Add a test/lint check that the only call site of `confirmar` is the reconciliation choke point. Code review forbids `as EnlaceConfirmado`.
**Warning signs:** Grep finds `confirmar(` in a connector/writer file rather than only in reconciliation; any `as EnlaceConfirmado`.

### Pitfall 3: Backfilling the DB but not re-exporting the seed (or vice versa)
**What goes wrong:** RUTs are populated in Supabase but the git seed still has `rut: null`; a later restore/re-seed wipes them. Or the seed is hand-edited but the live DB never gets the values.
**How to avoid:** Make "backfill DB" and "re-export seed snapshot" a single atomic plan unit; assert post-condition: seed file row count for non-null `rut` == DB count.
**Warning signs:** `grep '"rut": null' parlamentario.seed.json` still matches after the backfill task claims done.

### Pitfall 4: DDL "applied" is a false positive from build/typecheck
**What goes wrong:** CI passes (typecheck + vitest green), the team assumes the new RLS migration is live, but no one ran `supabase db push` / `migration up` against the target DB. Build proves the *file* is valid TypeScript-adjacent SQL, not that Postgres ran it.
**Why it happens:** Green CI conflates "code compiles" with "schema changed."
**How to avoid:** Treat migration **authoring** and migration **application** as separate tasks. Application is a `checkpoint:human-verify` (operator runs the migration and confirms) UNLESS the environment can apply it programmatically. **Nuance from project memory (2026-06-18):** remote DDL via `npx supabase db push --db-url "$SUPABASE_DB_URL" --include-all` (the sa-east-1 pooler string in `.env`) *did* apply migrations 0012–0015 to remote successfully — so remote application may be possible; the *Management API* PAT is what's missing, not DB-password push. Local application is the carried-over v1.0 blocker (0011 not applied to local). The plan must (a) author the migration, (b) verify it via pgTAP **only after** application, and (c) explicitly mark application + pgTAP run as the proof step, not the build.
**Warning signs:** A "verify RLS" task whose only evidence is `tsc`/`vitest` output; pgTAP never run against the DB.

### Pitfall 5: Golden RUT cases without keeping the existing threshold meaningful
**What goes wrong:** Adding RUT/persona-jurídica cases that are too easy inflates precision and hides regressions; or adding them to `GOLDEN_SET` without respecting the adversarial-exclusion split breaks the gate's "can fail" meta-test.
**How to avoid:** Add new cases to `GOLDEN_SET`; the gate runs on `GOLDEN_SET_GATE` (adversaries excluded) `[VERIFIED: golden-set.ts:465-481]`. Include at least one *hard* RUT-collision case (homonym whose RUT digit-validates but belongs to a company / another person) labeled to the correct outcome so the gate stays honest. Keep the ≥0.95 threshold; do not lower it.
**Warning signs:** Precision jumps well above prior runs after adding cases (cases too easy); the `gate puede fallar` meta-test breaks.

## Code Examples

### RUT DV validation before writing a backfilled RUT (reuse existing)
```typescript
// Source: packages/identity/src/deterministic.ts:63-78 [VERIFIED]
import { isRutValido, normRut } from "@obs/identity";

function aceptarRutBackfill(rutCrudo: string): string | null {
  if (!isRutValido(rutCrudo)) return null; // invalid DV → review log, NEVER write
  return normRut(rutCrudo);                // normalized form for storage/compare
}
```

### Extending the data-routing gate to a new PII document (LEGAL-03)
```typescript
// Source: packages/llm/src/data-routing.ts:52-72 [VERIFIED] — reuse, do not duplicate
import { assertNoRutInLlmInput, assertSensitivityAllowed } from "@obs/llm";

// Before ANY LLM call on a new PII-bearing document (declaration text, etc.):
const prompt = `${SYSTEM}\n${userPayload}`;
assertNoRutInLlmInput(prompt);                                   // throws if a RUT slipped in
assertSensitivityAllowed({ sensitivity: "personal" }, provider); // throws if provider trains on inputs
// only then: provider.complete(...)
```

### RLS deny-by-default migration convention for a new PII column/table (LEGAL-03)
```sql
-- Source: pattern from supabase/migrations/0005_parlamentario.sql:60-64 [VERIFIED]
-- Convention: any table carrying PII is RLS-enabled with ZERO policies + NO GRANT to anon.
-- This is the exact mirror of parlamentario (anon can never read it).
alter table <pii_table> enable row level security;
-- (intentionally NO `create policy ... to anon`; intentionally NO `grant select to anon`)

-- For a PII COLUMN added to an otherwise-public table (avoid if possible — prefer a
-- separate internal table), use column-level privilege denial:
revoke select (<pii_column>) on <table> from anon;
-- but the project's posture (and 0005) is: keep PII on a deny-by-default TABLE, not a column
-- on a public table. Recommendation: new PII lives on internal tables, public rows carry only FK.
```

### pgTAP assertion mirroring the master RLS test (verification of LEGAL-03)
```sql
-- Source: pattern from supabase/tests/0004_parlamentario.test.sql:70-85 [VERIFIED]
select is(
  (select count(*)::int from pg_class
     where relname = '<pii_table>' and relrowsecurity = true),
  1, 'RLS enabled en <pii_table>');
select is_empty(
  $$ select polname from pg_policy p
     join pg_class c on c.oid = p.polrelid
     where c.relname = '<pii_table>' $$,
  'ninguna policy (deny-by-default) en <pii_table>');
```

## State of the Art

| Old Approach (v1.0) | Current Approach (this phase) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Confirmed-link guard as CONVENTION (`reconciliar-senado.ts` maps `res.tipo` to `string \| null` by hand) | TYPED invariant: branded `EnlaceConfirmado` minted by one factory; writer FK typed `EnlaceConfirmado \| null` | Phase 9 (IDENT-12) | A new writer cannot set the FK without a confirmed match — compile error, not a review catch |
| RUT field present but NULL; deterministic RUT-cross dormant | RUT backfilled (server-side, internal) → RUT-cross live for money/probidad | Phase 9 (IDENT-10) | Phases 12/14/15 can cross by RUT deterministically |
| `isRutValido` exists but "NOT wired" (catalogs have no RUT) `[VERIFIED: deterministic.ts:95-97]` | `isRutValido` wired into backfill + golden DV cases | Phase 9 (IDENT-11) | Module-11 gate becomes active where real RUTs arrive |
| RLS deny-by-default applied ad hoc per table | Reusable migration convention + pgTAP template for all future PII | Phase 9 (LEGAL-03) | Phases 11/12/14/15 inherit a copy-paste-safe PII floor |

**Deprecated/outdated:**
- The CONTEXT.md note "remote DDL push está bloqueado (service key ≠ management PAT)" is **partially outdated** per project memory: `db push --db-url` via the sa-east-1 pooler string in `.env` DID apply 0012–0015 to remote (2026-06-18). The blocked path is the *Management API* (PAT `sbp_` absent), not DB-password push. The plan should reflect this nuance rather than assuming all remote DDL is impossible.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SERVEL publishes elected-parliamentarian RUTs in a bulk-downloadable form | RUT Source Resolution (Track A) | If false, Track A spike fails → fall back to curated list (Track B) — no phase blockage, just more manual curation |
| A2 | BCN/Congreso open data does not carry roster RUT | RUT Source Resolution | Low risk; BCN publishes norma XML, not roster RUT. Not probed live — if a roster RUT source exists there, it's a bonus Track A |
| A3 | Remote `db push --db-url` (pooler) still works at execution time | DDL caveat / Pitfall 4 | If the DB password rotated (carried v1.0 debt #1), remote application reverts to operator step — plan already gates application as human-verify |
| A4 | The `Voto` persisted DB shape can keep `parlamentario_id: string \| null` while only the writer *input* uses the branded type | Typed Writer Invariant | If a stricter end-to-end branding is wanted, more surface changes; the recommended boundary (input branded, storage plain) is the minimal correct cut |

## Open Questions

1. **Does a SERVEL/electoral dataset give clean elected-parliamentarian RUTs?**
   - What we know: SERVEL publishes elected-candidate stats and a per-RUT candidate lookup; both official congress catalogs are RUT-less (verified).
   - What's unclear: whether a bulk RUT-bearing dataset for the 186 sitting members is cleanly downloadable in this environment.
   - Recommendation: a tightly-scoped Track A spike (confirm-or-fallback), then Track B (curated list) as the guaranteed path. Do not block the phase on Track A.

2. **Should the branded type also wrap the `humano`-promoted (revisor-cli) path?**
   - What we know: human promotion to `confirmado` is a legitimate confirmed link (`metodo='humano'`).
   - Recommendation: yes — `confirmar(id, "humano")` is the only other legitimate mint, invoked from `revisor-cli`. Keep the factory single, with the method as a parameter (shown in Pattern 1).

3. **Local DDL application (carried v1.0 blocker: 0011 not applied to local).**
   - Recommendation: the plan's RLS migration application + pgTAP run must be an explicit operator/human-verify task for local; remote may be programmatic via the pooler.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Senado `senadores_vigentes.php` | (probed for RUT — negative) | ✓ (XML 200) | — | n/a (no RUT) |
| Cámara `WSDiputado.asmx/retornarDiputado` | (probed for RUT — empty) | ✓ (XML 200) | — | n/a (RUT empty) |
| SERVEL open data (`servel.cl`) | RUT backfill Track A | ✓ (reachable) but RUT bulk **unverified** | — | Curated list (Track B) |
| Supabase LOCAL (docker) | apply migration + pgTAP | ✓ (per memory: db 54422 / kong 54421) | PG15 | — |
| Supabase REMOTE (pooler `db push`) | apply migration to cloud | ✓ via `SUPABASE_DB_URL` (per memory) | PG15 | Operator step if DB pwd rotated |
| `.env` SUPABASE service key (local) | master write (`updateRut`) | ✓ | — | — |
| R2 S3 (`@aws-sdk/client-s3`) | raw snapshot (Track A only) | ✗ (401, carried v1.0 blocker) | — | Skip raw snapshot OR git seed snapshot covers provenance |

**Missing dependencies with no fallback:** None that block the phase. RUT bulk source is the only soft gap, with a guaranteed Track B fallback.
**Missing dependencies with fallback:** R2 S3 still 401 → for Track A, raw snapshot to R2 is unavailable; the git seed snapshot (ID-09) is the provenance record meanwhile.

## Validation Architecture

> nyquist_validation is treated as enabled (no `workflow.nyquist_validation: false` found in config). This section lets the planner derive observable checks proving the 4 success criteria.

### Test Framework
| Property | Value |
|----------|-------|
| Framework (TS) | Vitest 3.x (`vitest run`) `[VERIFIED: package.json]` |
| Framework (DB) | pgTAP via `supabase test db` `[VERIFIED: supabase/tests/*.test.sql]` |
| TS typecheck | `tsc -b` per package (`pnpm -r typecheck` / per-package `typecheck` script) |
| Quick run command | `pnpm --filter @obs/identity test && pnpm --filter @obs/adjudication test` |
| Full suite command | `pnpm -r test && pnpm -r typecheck && supabase test db` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IDENT-10 | RUT backfilled on existing master rows (by `id`), DV-valid only, provenance present | unit + integration | `pnpm --filter @obs/identity test` (backfill unit) | ❌ Wave 0 (`backfill-rut.test.ts`) |
| IDENT-10 | `parlamentario.rut` anon-hidden (still deny-by-default after backfill) | pgTAP | `supabase test db` (extend `0004_parlamentario.test.sql` or new) | ✅ pattern exists `[VERIFIED]` |
| IDENT-10 | Seed snapshot re-exported matches DB (no `rut: null` regression) | integration | unit asserting non-null count parity | ❌ Wave 0 |
| IDENT-11 | Golden set extended with RUT/persona-jurídica/homonym; gate ≥0.95 still blocks | golden (vitest) | `pnpm --filter @obs/adjudication test` (golden-set.test.ts) | ✅ extend existing `[VERIFIED]` |
| IDENT-11 | `isRutValido` rejects invalid DV / persona-jurídica edge cases | unit | `pnpm --filter @obs/identity test` (deterministic.test.ts) | ✅ extend existing |
| IDENT-12 | A writer CANNOT set FK from a raw string (compile-time proof) | type test | `tsc -b` + `// @ts-expect-error` negative test in `*.test-d.ts` or a `tsc --noEmit` fixture | ❌ Wave 0 (type test) |
| IDENT-12 | Only `determinista`/`confirmado` mints `EnlaceConfirmado`; probable/revision/no_confirmado → null | unit | `pnpm --filter @obs/tramitacion test` (reconciliar-senado.test.ts) | ✅ extend existing |
| LEGAL-03 | New PII table/column RLS-enabled, zero policies, no GRANT to anon | pgTAP | `supabase test db` (new `0018_*` test) | ❌ Wave 0 (new test, pattern exists) |
| LEGAL-03 | `assertNoRutInLlmInput` / `assertSensitivityAllowed` reject RUT/PII to LLM | unit | `pnpm --filter @obs/llm test` (data-routing.test.ts) | ✅ extend existing `[VERIFIED]` |

**The compile-time invariant proof (IDENT-12) is the trickiest observable.** Recommended: a `vitest` type-level test or a dedicated `tsc --noEmit` fixture file containing `// @ts-expect-error` lines asserting that `writer.write({ enlace: "P00042" })` (raw string) does NOT compile, while `writer.write({ enlace: confirmar("P00042") })` does. This proves the structural impossibility, not just runtime behavior.

### Sampling Rate
- **Per task commit:** `pnpm --filter <pkg> test && pnpm --filter <pkg> typecheck` for the touched package.
- **Per wave merge:** `pnpm -r test && pnpm -r typecheck`.
- **Phase gate:** Full suite + `supabase test db` green AND the RLS pgTAP must run **against an applied migration** (not just authored) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/identity/src/backfill-rut.test.ts` — covers IDENT-10 (DV-valid only, provenance, idempotent update by `id`)
- [ ] `packages/identity/src/enlace-confirmado.ts` + `.test.ts` + type-level negative test — covers IDENT-12 structural proof
- [ ] `supabase/tests/0018_pii_floor.test.sql` (or extend `0004`) — covers LEGAL-03 RLS deny-by-default for new PII + re-asserts `parlamentario.rut` hidden
- [ ] Golden RUT/persona-jurídica/homonym cases appended to `packages/adjudication/src/golden/golden-set.ts` — covers IDENT-11
- [ ] (Track A only) `servel.cl` SSRF allowlist entry + connector fixture; (Track B) curated `parlamentario-rut.seed.json` with provenance

## Security Domain

> `security_enforcement` treated as enabled (not `false` in config). This phase IS the security floor for v2.0 PII.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a (service-role backfill; no end-user auth change) |
| V3 Session Management | no | n/a |
| V4 Access Control | **yes** | RLS deny-by-default on PII (mirror `0005`); anon role cannot read RUT/new PII; pgTAP proves zero policies |
| V5 Input Validation | **yes** | `isRutValido` (módulo-11) on every backfilled RUT; zod on any fetched source row; reject invalid to review log |
| V6 Cryptography | no | n/a (no new crypto; never hand-roll) |
| V8 Data Protection / Privacy | **yes** | RUT internal-only (Ley 21.719 minimization); `assertNoRutInLlmInput` prevents RUT egress to third-party LLM; provenance per row |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| RUT/PII leak to anon via missing RLS | Information Disclosure | Deny-by-default RLS table + pgTAP "RLS enabled / zero policy" gate (mirror `0004`/`0005`) |
| RUT egress to an LLM that trains on inputs | Information Disclosure | `assertNoRutInLlmInput` (fail-closed regex) + `assertSensitivityAllowed` before every `complete()` |
| Wrong-person FK (false attribution) bypassing the guard | Tampering / Spoofing | Branded `EnlaceConfirmado` minted only after `determinista`/`confirmado`; raw-string FK = compile error |
| Fabricated/guessed RUT | Tampering | `isRutValido` gate; never write a RUT failing módulo-11; SERVEL/candidate RUT is a candidate, not a fact |
| Silent partial backfill presented as complete | Repudiation / integrity | Provenance per RUT row; seed re-export parity check; (Track A) blocking drift + completeness check |

## Sources

### Primary (HIGH confidence)
- v1.0 codebase (read directly): `packages/identity/src/{deterministic.ts,seeder.ts,writer-supabase.ts,index.ts}`, `packages/adjudication/src/{pipeline.ts,tipos.ts,golden/golden-set.ts}`, `packages/tramitacion/src/{reconciliar-senado.ts,writer.ts,model.ts}`, `packages/llm/src/{data-routing.ts,types.ts}`, `supabase/migrations/{0005_parlamentario.sql,0017_higiene_seguridad.sql}`, `supabase/tests/0004_parlamentario.test.sql`, `supabase/seeds/parlamentario.seed.json` — branded-type home, FK convention, RLS pattern, `isRutValido`, master writer, golden gate.
- Live source probes (2026-06-18, identifying UA, 2-3s spacing): Senado `tramitacion.senado.cl/wspublico/senadores_vigentes.php` (XML 200, **no RUT element**); Cámara `opendata.camara.cl/.../WSDiputado.asmx/retornarDiputado` (RUT element present but **empty** for ids 1009/1012/1013/800).
- `.planning/research/ARCHITECTURE.md` (v2.0), `.planning/research/PITFALLS.md` (v2.0), `.planning/STATE.md`, `CLAUDE.md` — identity guard spine, RUT-internal rule, A2/E1 RUT pitfalls, DDL blockers.
- Project memory `env-credentials-reality.md` — remote `db push --db-url` pooler applied 0012–0015; Management API PAT missing; R2 S3 401; `.env` BOM gotcha.

### Secondary (MEDIUM confidence)
- [WSDiputado operations](https://opendata.camara.cl/camaradiputados/WServices/WSDiputado.asmx) — `retornarDiputado` exposes `RUT`/`RUTDV` (empty in practice).
- [Senado Datos Abiertos Legislativos](https://tramitacion.senado.cl/datos-abiertos-legislativos) — open-data endpoints index.

### Tertiary (LOW confidence — flagged for validation)
- [SERVEL candidatos electos por partido](https://www.servel.cl/estadisticas-candidatos-electos-por-partido/) / [SERVEL datos abiertos](https://www.servel.cl/2017/11/24/estadisticas-de-datos-abiertos/) / [consulta-candidato.servel.cl](https://consulta-candidato.servel.cl/) — RUT bulk availability for elected parliamentarians NOT confirmed (A1 assumption; drives the Track A spike).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all symbols verified in workspace.
- Typed writer invariant (IDENT-12): HIGH — branding is a standard TS pattern; the choke point already exists in `reconciliar-senado.ts`.
- RUT source (IDENT-10): MEDIUM — the *negative* (catalogs RUT-less) is HIGH (verified live); the *positive* source (SERVEL bulk) is unverified, but the curated-list fallback is locked and guaranteed.
- Golden + DV (IDENT-11): HIGH — `isRutValido` exists and is tested; golden split is well-understood.
- RLS/PII floor (LEGAL-03): HIGH — exact mirror of `0005`/`0004` patterns; DDL-application caveat documented.

**Research date:** 2026-06-18
**Valid until:** 2026-07-18 (stable infra; re-verify SERVEL RUT availability and `db push` viability at execution time — both are environment-dependent)
