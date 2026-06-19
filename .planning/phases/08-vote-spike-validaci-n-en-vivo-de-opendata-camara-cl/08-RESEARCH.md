# Phase 8: VOTE Spike — Validación en vivo de `opendata.camara.cl` - Research

**Researched:** 2026-06-18
**Domain:** Live validation of a government SOAP/HTTP-GET XML web service (`opendata.camara.cl/wscamaradiputados.asmx`) behind the gov WAF, reusing the LOCKED `@obs/ingest` network policy; deterministic vote→identity mapping by `DIPID → id_diputado_camara`.
**Confidence:** HIGH (the endpoint, its real XML shape, the parse path, and the deterministic cross are ALREADY implemented and verified live in the v1.0 codebase). The spike is a *re-confirmation under current-legislature data + a recorded binary decision*, not a discovery.

## Summary

This is the lowest-risk spike in the milestone because **the work it validates already exists and was already hit live once.** During v1.0 Phase 5, the team built `packages/tramitacion/src/connector-camara.ts` + `parse-camara-votacion.ts` + `reconciliar-camara.ts`, ran `getVotacion_Detalle` LIVE on 2026-06-18, captured the real response as a fixture (`packages/tramitacion/test/fixtures/camara-votacion-detalle-real.xml`), and wrote passing tests against it. That fixture shows `Votos > Voto > Diputado/DIPID` + `Opcion Codigo` populated NON-NULL for ~139 deputies — exactly what the spike is meant to prove (vs `doGet.asmx` where `Votos=null`). [VERIFIED: codebase grep — parse-camara-votacion.ts:190-193, parse-camara-votacion.test.ts:68-93]

What is genuinely UNCONFIRMED and is the spike's real job: (1) that the endpoint still answers TODAY for **current-legislature (Leg 58)** boletines (the captured fixture is a single vote, ID 88813 / boletín 14309-04); (2) coverage/rate behavior across a small live sample (the 2 cross-cámara boletines 14309/18296 + 2-3 recent votes); (3) that totals reconcile against the per-deputy options on a fresh pull; and (4) that DIPIDs from a fresh pull still map into the current 155-row master. The spike re-runs the existing connector against a tiny live sample and records confirm/replan.

**Primary recommendation:** Write a throwaway CLI script (`packages/votos/spike/` or a temp script) that **imports and reuses the existing `CamaraConnector` + `parseCamaraVotoDetalle` + `reconciliarVotosCamara` verbatim** — do NOT re-implement fetch, parse, or cross. Assemble the LOCKED collaborators (`Fetcher`, `HostRateLimiter`, `RobotsGuard`) in the LOCKED order, pull the sample, and assert the 4 success criteria against the live response and the master seed. Expected outcome: CONFIRM. The allowlist already permits `opendata.camara.cl` (no edit needed).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch behind gov WAF (rate-limit, robots, UA, SSRF) | Connector / `@obs/ingest` (Deno/Node script tier) | — | All external gov calls are server-only; policy lives ONCE in `@obs/ingest`. The spike script is server-side, never browser. |
| XML parse of `getVotacion_Detalle` | Connector parse (`@obs/tramitacion`) | — | `fast-xml-parser@5` + existing `parseCamaraVotoDetalle` owns the shape. |
| Deterministic vote→person cross (`DIPID → id_diputado_camara`) | Reconciliation (`@obs/tramitacion` `reconciliarVotosCamara`) | Identity master (read) | Official-id cross, no LLM, no `correrPipeline`. Reads the master, writes nothing during the spike. |
| Identity master lookup | Data / master (`parlamentario` seed or DB read) | — | The spike READS `id_diputado_camara` only; it is read-only (no DDL, no R2 — per project memory). |
| Binary decision record | Docs (`08-*-SUMMARY.md`) + `STATE.md` | — | The deliverable is a recorded confirm/replan, not code shipped to prod. |

## User Constraints (from CONTEXT.md)

<user_constraints>
### Locked Decisions
- **Muestra:** los 2 boletines cross-cámara ya usados en v1.0 (**14309 / 18296**) + 2-3 votaciones recientes de la legislatura vigente (Leg 58), para reusar fixtures conocidos y a la vez probar cobertura actual.
- **Código desechable:** script de spike aislado (`packages/votos/spike/` o un script CLI temporal), **sin tocar el modelo común ni crear el `@obs/votos` de producción**. El conector real es Phase 10.
- **Registro del hallazgo:** documentar en el `08-*-SUMMARY.md` (FINDINGS conciso: shape XML, campos poblados, mapeo `Diputado/Id → id_diputado_camara`, cobertura histórica, comportamiento de rate) y registrar la **decisión binaria** en STATE.md (Accumulated Context → Decisions).
- **Política de red:** reusar `@obs/ingest` (allowlist + robots + UA identificatorio + delay 2–3s LOCKED) **incluso para el spike** — nunca golpear el WAF con `fetch` a pelo.
- **Criterio CONFIRMAR:** el detalle devuelve el contenedor de votos por diputado con `Diputado` y `Opcion` poblados (no null), reconciliables contra totales (`TotalAfirmativos/Negativos/Abstenciones/Dispensados` + `Pareos`), y `Diputado/Id` mapea al `id_diputado_camara` oficial de la maestra v1.0 (enlace determinista sin LLM).
- **Criterio REPLANIFICAR (solo bloque VOTE, sin bloquear INT/MONEY):** si el voto individual no viene, viene null, o el id no mapea determinísticamente.

### Claude's Discretion
- Ubicación exacta del script desechable (`packages/votos/spike/` vs script CLI temporal).
- Cómo registrar el comportamiento de rate (latencias, 429s) en el FINDINGS.
- Cuáles 2-3 votaciones recientes elegir como muestra de cobertura actual.

### Deferred Ideas (OUT OF SCOPE)
- Construcción del conector `@obs/votos` de producción, modelo de datos del voto individual, y la ficha → **Phase 10**.
- Agregar `opendata.camara.cl` a la allowlist como cambio permanente → Phase 10 (NOTA: no se requiere — ver hallazgo de allowlist abajo).
</user_constraints>

## Phase Requirements

<phase_requirements>
| ID | Description | Research Support |
|----|-------------|------------------|
| VOTE-01 | Un spike valida en vivo `opendata.camara.cl` (`getVotaciones_Boletin`/`getVotacion_Detalle`): alcanzabilidad tras el WAF, que `Diputado/Id` y `Opcion` vengan poblados (no null), cobertura histórica y comportamiento de rate. Resultado: confirmar y construir, o replanificar el bloque VOTE. | Endpoint + real XML shape + parse path + deterministic cross all already implemented and verified live (parse-camara-votacion.ts, connector-camara.ts, reconciliar-camara.ts, fixture `camara-votacion-detalle-real.xml`). Spike re-confirms against fresh Leg-58 sample + records binary decision. |
</phase_requirements>

## Standard Stack

No new packages. Everything the spike needs is already in the repo and LOCKED.

### Core (reused, already installed)
| Symbol | From | Purpose | Why standard |
|--------|------|---------|--------------|
| `CamaraConnector` | `@obs/tramitacion` (`connector-camara.ts`) | `fetchVotacionesBoletin(boletinBase)` + `fetchVotacionDetalle(votacionId)` reusing the LOCKED policy in the LOCKED order | The exact connector the spike validates; reuse verbatim, don't fork. [VERIFIED: codebase] |
| `parseCamaraVotacion` / `parseCamaraVotoDetalle` | `@obs/tramitacion` (`parse-camara-votacion.ts`) | XML → `Votacion[]` (totals) / `CamaraVotoDetalle[]` (per-deputy `{diputadoId, opcion, nombreCrudo}`) | Already parses BOTH the v1 fixture shape and the REAL `tempuri.org` shape (DIPID + `Opcion Codigo`). [VERIFIED: codebase] |
| `reconciliarVotosCamara` | `@obs/tramitacion` (`reconciliar-camara.ts`) | Deterministic cross `DIPID → id_diputado_camara`, fail-closed; `confirmado` only on exact id match | The spike's mapping check; pure function over the loaded master. [VERIFIED: codebase] |
| `Fetcher`, `HostRateLimiter`, `RobotsGuard`, `assertAllowedUrl`, `IDENTIFIED_UA` | `@obs/ingest` (`index.ts`) | LOCKED network policy collaborators | The spike assembles these — see Pattern 1. [VERIFIED: codebase — packages/ingest/src/index.ts] |
| `XMLParser` | `fast-xml-parser@5` | XML parse | Locked; used as `new XMLParser({ ignoreAttributes: false, parseTagValue: false })`. [VERIFIED: parse-camara-votacion.ts:24] |
| `Parlamentario` type + seed | `@obs/core` + `supabase/seeds/parlamentario.seed.json` | The master to map DIPIDs against (155 diputados with `id_diputado_camara`) | Read-only source for the mapping check. [VERIFIED: seed has 155 rows with `id_diputado_camara`] |

### Supporting
| Item | Purpose | When to use |
|------|---------|-------------|
| `vitest` | Run the spike's assertions as a `*.test.ts` so the binary decision is an automated pass/fail | If implementing the spike as a test (recommended for the Nyquist gate). [VERIFIED: vitest.config.ts] |
| `TextDecoder` | `fetcher.get()` returns `Uint8Array`; decode to string before parse | Always (connector already does this internally via `.fetch()`). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing `CamaraConnector` | Raw `fetch` to the `.asmx` | FORBIDDEN by CONTEXT (never hit the WAF bare) and pointless — the connector already wraps the LOCKED policy. |
| HTTP GET (`?prmVotacionId=`) | SOAP 1.1/1.2 POST envelope to same `.asmx` | GET is what the existing connector uses and what was verified live; only fall back to SOAP if GET is firewalled (it was NOT, 2026-06-18). [CITED: connector-camara.ts:132-135] |

**Installation:** None. No `npm install` / `pnpm add`. The spike imports existing workspace packages.

## Package Legitimacy Audit

> Not applicable — this phase installs **zero** external packages. All symbols are imported from existing in-repo workspace packages (`@obs/ingest`, `@obs/tramitacion`, `@obs/core`) and already-locked dependencies (`fast-xml-parser@5`, `vitest`). No registry fetch occurs, so there is no slopcheck/registry surface to audit.

## Architecture Patterns

### System Data Flow (the spike)

```
[spike script / test]
   │
   │ sample = ["14309-04", "18296-XX", <2-3 recent Leg-58 vote IDs>]
   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ CamaraConnector (REUSED — @obs/tramitacion)                          │
│   .fetch(url) applies the LOCKED ORDER:                              │
│     assertAllowedUrl(url)  → SSRF + allowlist (camara.cl suffix ✓)   │
│     robots.isAllowed(url)  → robots.txt gate                         │
│     rateLimiter.wait(host) → 2–3s serial-per-host (LOCKED)           │
│     fetcher.get({url})     → UA-identified GET, 200→Uint8Array       │
└───────────────┬─────────────────────────────────────────────────────┘
                │ (A) getVotaciones_Boletin?prmBoletin=14309   → XML list of Votacion + totals
                │ (B) getVotacion_Detalle?prmVotacionId=88813  → XML with Votos>Voto>Diputado/DIPID + Opcion
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ parseCamaraVotacion(xmlA)        → Votacion[] (TotalAfirmativos…)    │
│ parseCamaraVotoDetalle(xmlB)     → CamaraVotoDetalle[] {DIPID,opcion}│
└───────────────┬─────────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ reconciliarVotosCamara(detalle, votacionId, MAESTRA)                 │
│   index master by id_diputado_camara (camara='diputados')           │
│   DIPID match → parlamentario_id, estado_vinculo='confirmado'       │
│   DIPID miss  → null, 'no_confirmado' (fail-closed)                  │
└───────────────┬─────────────────────────────────────────────────────┘
                ▼
   ASSERT 4 criteria (see Validation Architecture) → CONFIRM | REPLAN
                ▼
   record decision in 08-*-SUMMARY.md + STATE.md   (NO DB write, NO R2)
```

### Recommended Project Structure
```
packages/votos/spike/          # throwaway; OR a temp scripts/ file — Claude's discretion
├── spike.ts                   # assembles collaborators, pulls sample, asserts, prints FINDINGS
└── spike.test.ts (optional)   # same logic as a vitest gate (recommended for Nyquist)
```
Do NOT create `packages/votos/src/` production code, a `@obs/votos` package manifest meant for prod, a new `voto` model, or any migration. That is Phase 10.

### Pattern 1: Reuse the LOCKED order (NOT `BaseConnector.run`)
**What:** Assemble `Fetcher` + `HostRateLimiter` + `RobotsGuard` and let `CamaraConnector` apply them in order. `BaseConnector.run`'s daily cache would suppress same-day re-runs — anti-pattern for a LIVE spike.
**When to use:** Always for this spike (and any ad-hoc live pull).
**Example:**
```typescript
// Source: packages/tramitacion/src/connector-camara.ts (verbatim assembly pattern)
import { Fetcher, HostRateLimiter, RobotsGuard } from "@obs/ingest";
import { CamaraConnector } from "@obs/tramitacion/connector-camara"; // adjust to package export

const allowlist = {}; // default suffixes already include camara.cl
const camara = new CamaraConnector({
  fetcher: new Fetcher({ allowlist }),
  rateLimiter: new HostRateLimiter(),            // 2–3s serial per host (LOCKED default)
  robots: new RobotsGuard({ allowlist }),        // pass allowlist → gates robots.txt fetch too
  allowlist,
});

const boletinXml = await camara.fetchVotacionesBoletin("14309");   // (A)
const votaciones = parseCamaraVotacion(boletinXml);                // → Votacion[] with totals
for (const v of votaciones) {
  const wsId = v.id.replace(/^camara:/, "");
  const detXml = await camara.fetchVotacionDetalle(wsId);          // (B)
  const crudos = parseCamaraVotoDetalle(detXml);                   // → {diputadoId, opcion, nombreCrudo}[]
  const votos = reconciliarVotosCamara(crudos, v.id, maestra);     // deterministic cross
  // assert non-null, totals reconcile, mapping rate …
}
```
[VERIFIED: codebase — this mirrors `ingest-run.ts:170-200` and `connector-camara.ts:59-65`]

### Anti-Patterns to Avoid
- **Bare `fetch` to the `.asmx`:** bypasses rate-limit/robots/UA/SSRF → WAF ban risk + FORBIDDEN by CONTEXT.
- **`BaseConnector.run` for the live pull:** its daily cache hides same-day re-runs; the spike needs a fresh LIVE pull. [CITED: connector-camara.ts:4-8]
- **Forking the `voto`/`votacion` model or creating a prod `@obs/votos`:** that's Phase 10; the spike is throwaway.
- **Writing to Supabase or R2:** project memory says remote R2 is 401 and the spike is read-only; the mapping check reads the master seed/DB, writes nothing.
- **Treating "No Vota/Abstención/dispensado" as a yes/no vote:** `parseCamaraVotoDetalle` deliberately omits non-nominal options (`Opcion Codigo` 4/etc.) — do not "fix" this; it's correct fail-closed behavior. [VERIFIED: parse-camara-votacion.ts:241-262]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate-limit / robots / UA / SSRF | A custom delay + header in the spike | `@obs/ingest` collaborators via `CamaraConnector` | The policy is LOCKED in one place; copy-paste diverges and risks WAF bans. [CITED: rate-limiter.ts:1-12] |
| XML parsing of the detail | A new `XMLParser` + path walking | `parseCamaraVotoDetalle` | Already handles both the v1 and the REAL `tempuri.org` shapes (DIPID vs Id, `Opcion Codigo` vs `OpcionVoto Valor`). [VERIFIED: parse-camara-votacion.ts:197-263] |
| DIPID → person mapping | A hand-rolled `Map` in the spike | `reconciliarVotosCamara` | Encodes the fail-closed guard (camara='diputados' index, period scoping, no fabricated links). [VERIFIED: reconciliar-camara.ts] |
| Choosing the URL/param shape | Guessing SOAP envelopes | The connector's GET URLs | `getVotaciones_Boletin?prmBoletin=` and `getVotacion_Detalle?prmVotacionId=` verified live. [VERIFIED: connector-camara.ts:120-135] |

**Key insight:** The entire VOTE pipeline already exists and passed tests against a captured live response. The spike's value is *operational re-confirmation against today's Leg-58 data + a recorded decision*, not new engineering.

## Runtime State Inventory

> Not a rename/refactor/migration phase. The spike is read-only and writes no runtime state. **Stored data: None written.** **Live service config: None changed.** **OS-registered state: None.** **Secrets/env vars: reads existing `.env` LLM/R2/Supabase creds only for the gov fetch UA path — none modified.** **Build artifacts: None.** Verified: the deliverable is a doc decision, not code in prod.

## Common Pitfalls

### Pitfall 1: The endpoint method name / namespace differs from older RESEARCH
**What goes wrong:** Earlier research (STACK.md, ARCHITECTURE.md) described `getVotacion_Detalle` returning `Voto[]` with `Diputado{DIPID,...}` + `Opcion` and used `prmVotacionID`. The LIVE-verified reality (2026-06-18) is: method is `getVotacion_Detalle` with param **`prmVotacionId`** (note casing), namespace **`http://tempuri.org/`**, and `retornarVotacionDetalle` does NOT exist (500 "nombre de método no válido"). Also `retornarVotacionesXAnno` does NOT exist.
**Why it happens:** WSDL docs vs actual deployed `.asmx` drift.
**How to avoid:** Use the existing `CamaraConnector` URLs verbatim — they already encode the live-verified shape. [VERIFIED: connector-camara.ts:73-76, 126-135]
**Warning signs:** HTTP 500 with "nombre de método no válido" → wrong method name.

### Pitfall 2: Boletín discovery by year/session is unreliable
**What goes wrong:** There is no working "enumerate votes by year" method; `descubrirBoletines` is best-effort and may return `[]`.
**How to avoid:** Drive the spike with **explicit boletines/vote IDs** (14309, 18296, plus 2-3 recent vote IDs you locate manually via the boletín lookup). CONTEXT already locks an explicit sample. [VERIFIED: ingest-run.ts:118-123, connector-camara.ts:73-76]

### Pitfall 3: Totals reconciliation must account for non-nominal options
**What goes wrong:** `parseCamaraVotoDetalle` returns only nominal `si`/`no` votes (it omits No Vota/Abstención/dispensado). So `count(si) + count(no)` will NOT equal the deputy count, and won't match `TotalAfirmativos + TotalNegativos + TotalAbstenciones + TotalDispensados`.
**How to avoid:** Reconcile **`count(opcion='si') === TotalAfirmativos`** and **`count(opcion='no') === TotalNegativos`** specifically (not the full roster). For full-roster reconciliation, count raw `<Voto>` nodes before the nominal filter. [VERIFIED: parse-camara-votacion.ts:221, fixture totals 58/81/0/0]

### Pitfall 4: Master must be scoped to current diputados for the mapping check
**What goes wrong:** A DIPID from an old period could falsely map if the master held historical rows.
**How to avoid:** The master seed is already scoped to the vigente period (155 diputados, all `camara='diputados'`); `reconciliarVotosCamara` indexes only `camara='diputados'` and (optionally) by `periodo`. Load the seed (or DB) as-is. [VERIFIED: reconciliar-camara.ts:60-66, seed 155 rows]

### Pitfall 5: `.env` UTF-8 BOM breaks the `supabase` CLI (only if the master is read via DB)
**What goes wrong:** The `.env` has a UTF-8 BOM that makes the `supabase` CLI error out.
**How to avoid:** The spike does not need the DB at all — read `supabase/seeds/parlamentario.seed.json` for the master. If a DB read is wanted, pass `--db-url` explicitly or temporarily rename `.env`. [CITED: project memory env-credentials-reality]

## Code Examples

### Load the master for the mapping check (no DB needed)
```typescript
// Source: supabase/seeds/parlamentario.seed.json (155 diputados with id_diputado_camara)
import { readFileSync } from "node:fs";
import type { Parlamentario } from "@obs/core";
const maestra: Parlamentario[] = JSON.parse(
  readFileSync("supabase/seeds/parlamentario.seed.json", "utf8"),
);
// e.g. DIPID 815 (Bobadilla) is present → expected to map deterministically.
```
[VERIFIED: seed inspected — 186 rows total, 155 with `id_diputado_camara`, includes DIPID 815]

### The deterministic cross + guard (already implemented)
```typescript
// Source: packages/tramitacion/src/reconciliar-camara.ts:51-100
const votos = reconciliarVotosCamara(crudos, "camara:88813", maestra);
// match  → { parlamentario_id, metodo:'determinista', estado_vinculo:'confirmado' }
// miss   → { parlamentario_id:null, metodo:null, estado_vinculo:'no_confirmado' }  (fail-closed)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `doGet.asmx` (`www.camara.cl/sala/`) → `Votos=null` | `opendata.camara.cl/wscamaradiputados.asmx/getVotacion_Detalle` → `Votos>Voto>Diputado/DIPID`+`Opcion` populated | v1.0 Phase 5 (verified live 2026-06-18) | This is the entire reason VOTE is buildable; the spike confirms it still holds for Leg 58. |
| RESEARCH-assumed `retornarVotacionDetalle` / `retornarVotacionesXAnno` / `prmVotacionID` | REAL: `getVotacion_Detalle?prmVotacionId=`, no year-enumeration method | live probe 2026-06-18 | Drive the spike by explicit IDs; use the connector's verified URLs. |

**Deprecated/outdated:**
- The `reactflow` / SERVEL / ChileCompra material in STACK.md/ARCHITECTURE.md is for later phases — irrelevant to this spike.
- ARCHITECTURE.md TL;DR claim "SERVEL is the one host NOT in the allowlist" implicitly confirms `camara.cl` (and thus `opendata.camara.cl`) IS allowlisted.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `opendata.camara.cl` still answers `getVotaciones_Boletin`/`getVotacion_Detalle` TODAY for current Leg-58 boletines (the captured fixture is from 2026-05-11). | Summary / Validation | If down or shape-changed, the spike's job is exactly to detect this → REPLAN. Low risk: same host/method verified ~5 weeks before research. |
| A2 | The 2-3 "recent" sample vote IDs can be located via `getVotaciones_Boletin` for recent boletines (no year-enumeration method exists). | Validation | If discovery fails, fall back to the 2 known cross-cámara boletines only; coverage signal weaker but criteria still testable. |
| A3 | Reading the master from `supabase/seeds/parlamentario.seed.json` is an acceptable stand-in for the DB master for the mapping check. | Code Examples | If the planner requires a live DB read, swap to a `supabase` query (mind the BOM gotcha). Seed and DB were seeded from the same source in Phase 3. |

## Open Questions

1. **Are the 2 cross-cámara boletines (14309, 18296) still queryable, and do they have Cámara votes with detail?**
   - What we know: 14309-04 has vote 88813 (captured, 58/81/0/0). 18296 is referenced in tests (vote 89178).
   - What's unclear: whether a fresh pull today still returns them.
   - Recommendation: include both in the sample; a 404/empty on a known-good boletín is itself a signal to record.

2. **Spike as a test vs a script?**
   - Recommendation: implement as a `*.test.ts` (vitest) so the binary decision is an automated, re-runnable pass/fail and integrates with the Nyquist gate; have it print a FINDINGS block for the SUMMARY. (Claude's discretion per CONTEXT.)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `opendata.camara.cl` reachable behind WAF | The whole spike | Likely ✓ (verified live 2026-06-18) | — | If down → that IS the spike result (REPLAN), record it. |
| `@obs/ingest`, `@obs/tramitacion`, `@obs/core` (workspace) | Connector/parse/cross reuse | ✓ | in-repo | — |
| `fast-xml-parser` | XML parse | ✓ | 5.x (locked) | — |
| `vitest` | Run spike assertions | ✓ | repo dev dep | Run as plain `node`/`tsx` script if preferred. |
| `parlamentario.seed.json` (master) | Mapping check | ✓ | 155 diputados w/ DIPID | DB read via `--db-url` (BOM gotcha) |
| Supabase remote / R2 | — | N/A | — | NOT needed — spike is read-only, writes nothing. |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** Live DB master read (fallback: seed JSON).

## Allowlist Finding (resolves a CONTEXT/ARCHITECTURE contradiction)

CONTEXT.md says "`opendata.camara.cl` aún NO está en la allowlist SSRF … hay que verificar/agregar." **This is incorrect.** The allowlist (`packages/ingest/src/allowlist.ts:19-28`) lists `camara.cl` as an allowed **suffix**, and `assertAllowedUrl` matches by suffix (`host === s || host.endsWith('.'+s)`), so `opendata.camara.cl` is **already allowed**. [VERIFIED: allowlist.ts:19-28, 83-87] No allowlist edit is required for the spike (the Phase-10 deferral on this point is moot). If the planner still wants belt-and-suspenders, no change is needed — a test asserting `assertAllowedUrl("https://opendata.camara.cl/...")` does not throw will pass today.

## Validation Architecture

> nyquist_validation: enabled (no `.planning/config.json` key forcing it off). The spike's binary decision IS its validation; implement assertions as automated checks.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `vitest` (node env) [VERIFIED: packages/tramitacion/vitest.config.ts] |
| Config file | per-package `vitest.config.ts` (include `src/**/*.test.ts`) |
| Quick run command | `pnpm --filter @obs/votos test` (if spike lives in `packages/votos`) — or run the spike script directly |
| Full suite command | `pnpm -r --filter "./packages/*" test` (root `package.json` `test` script) |

> Note: existing fixture-based tests already prove the *parse + cross* logic offline (`parse-camara-votacion.test.ts`). The spike adds the **LIVE network** dimension, which must be opt-in (gated by a credential/flag) so it does not hit the WAF on every CI run — mirror the v1.0 LIVE-gated test pattern.

### Phase Requirements → Test Map (the 4 success criteria)
| Req | Behavior (observable check) | Test Type | Automated check | File Exists? |
|-----|------------------------------|-----------|-----------------|-------------|
| VOTE-01 (a) Non-null per-deputy vote | Live `getVotacion_Detalle` → `parseCamaraVotoDetalle(xml).length > 0` AND every item has non-empty `diputadoId` and `opcion ∈ {si,no}` | live smoke | assert `detalle.length >= 1 && detalle.every(d => d.diputadoId && (d.opcion==='si'||d.opcion==='no'))` | ❌ Wave 0 (live spike) |
| VOTE-01 (b) Totals reconcile | `count(opcion='si') === Votacion.total_si` and `count(opcion='no') === Votacion.total_no` (per Pitfall 3) | live smoke | compare nominal counts vs `parseCamaraVotacion` totals | ❌ Wave 0 |
| VOTE-01 (c) DIPID → id_diputado_camara maps | `reconciliarVotosCamara(detalle, id, maestra)` yields a high share with `estado_vinculo==='confirmado'`; misses are old-period DIPIDs only | live smoke | assert `confirmados / nominales >= THRESHOLD` (recommend ≥0.95 for current-legislature votes) and `metodo==='determinista'` on matches | ❌ Wave 0 |
| VOTE-01 (d) Coverage + rate behavior | Sample of 2 known + 2-3 recent boletines all return detail; observed per-request latency reflects the 2–3s serial delay; no sustained 429 | live smoke | record per-request timing + status; assert no `RetryableError` storm; log coverage table | ❌ Wave 0 |

### Binary decision recording (the deliverable)
- **CONFIRM** iff (a)∧(b)∧(c)∧(d) all pass on the sample → record in `08-*-SUMMARY.md` FINDINGS + add a Decision line to `STATE.md` (Accumulated Context → Decisions): "Phase 8 VOTE spike CONFIRMÓ: `getVotacion_Detalle` entrega DIPID+Opcion no-null, totales reconcilian, DIPID mapea a id_diputado_camara — construir Phase 10 tal cual."
- **REPLAN** if any fails → record which criterion failed + the observed evidence (HTTP status, null fields, unmatched DIPIDs) and a "replanificar SOLO el bloque VOTE (no bloquea INT/MONEY)" decision line.

### Sampling Rate
- **Per task commit:** offline fixture tests `pnpm --filter @obs/tramitacion test` (proves parse/cross unchanged).
- **Spike execution (once):** the LIVE-gated smoke against the locked sample, run deliberately with the 2–3s delay (≈ a dozen requests total — keep it minimal per CONTEXT).
- **Phase gate:** FINDINGS + binary decision recorded; offline suite green.

### Wave 0 Gaps
- [ ] `packages/votos/spike/spike.test.ts` (or temp script) — covers VOTE-01 (a)-(d), LIVE-gated.
- [ ] Locate 2-3 recent Leg-58 vote IDs to include in the sample (via `getVotaciones_Boletin` on recent boletines).
- [ ] Load master from `supabase/seeds/parlamentario.seed.json` for the mapping assertion.
- Framework install: none — `vitest` already present.

## Security Domain

> `security_enforcement` not explicitly disabled → included, but scope is tiny (read-only outbound HTTP to a public gov endpoint; no auth, no user input, no DB write).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in the spike path. |
| V3 Session Management | no | Stateless GETs. |
| V4 Access Control | no | Read-only public data. |
| V5 Input Validation | yes | XML validated via `fast-xml-parser` + zod (`VotacionSchema`/`VotoSchema`) in existing parsers; spike inputs (boletín/ID) are literals. [VERIFIED: parse-camara-votacion.ts:148, reconciliar-camara.ts:98] |
| V6 Cryptography | no | None hand-rolled. |
| (SSRF — V5/V12) | yes | `assertAllowedUrl` deny-by-default allowlist + internal-IP blocking applied before every fetch. [VERIFIED: allowlist.ts] |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via attacker-influenced URL | Tampering/Info-disclosure | `assertAllowedUrl` (suffix allowlist + RFC1918/loopback/metadata block) — already enforced in `Fetcher.get` and `RobotsGuard`. |
| WAF ban from request bursts | DoS (self-inflicted) | LOCKED 2–3s serial-per-host `HostRateLimiter`; identified UA; robots respected. |
| XML entity expansion / malformed XML | DoS/Tampering | `fast-xml-parser` (no external entity resolution) + zod schema validation on output. |
| Leaking secrets in error messages | Info-disclosure | `Fetcher`/error classes deliberately exclude auth headers/credentials from messages. [VERIFIED: fetcher.ts:43-49, allowlist.ts:43-44] |

## Sources

### Primary (HIGH confidence — codebase, verified this session)
- `packages/tramitacion/src/connector-camara.ts` — LOCKED-order fetch, verified-live URLs (`getVotaciones_Boletin?prmBoletin=`, `getVotacion_Detalle?prmVotacionId=`), LIVE notes 2026-06-18.
- `packages/tramitacion/src/parse-camara-votacion.ts` — real `tempuri.org` shape (DIPID + `Opcion Codigo`), `fast-xml-parser` config, nominal-only filter.
- `packages/tramitacion/src/reconciliar-camara.ts` — deterministic `DIPID → id_diputado_camara` cross + fail-closed guard.
- `packages/tramitacion/test/fixtures/camara-votacion-detalle-real.xml` — captured LIVE response (vote 88813, populated `Votos`).
- `packages/tramitacion/src/parse-camara-votacion.test.ts` — assertions over the real fixture (~139 nominal votes, DIPID 815/803).
- `packages/ingest/src/{index,allowlist,fetcher,rate-limiter,robots}.ts` — exported symbols + LOCKED policy; `camara.cl` suffix in allowlist.
- `packages/core/src/parlamentario.ts` + `supabase/seeds/parlamentario.seed.json` — `id_diputado_camara` field; 155 diputados present (DIPID 815 confirmed).
- `supabase/migrations/0005_parlamentario.sql` — `id_diputado_camara` column + unique partial index.

### Secondary (MEDIUM-HIGH)
- `.planning/research/STACK.md` / `ARCHITECTURE.md` (v2.0) — VOTE source description (note: contains the now-corrected method-name/param/allowlist assumptions; codebase is authoritative).
- Project memory `env-credentials-reality.md` — live-probe results (gov reads OK; R2 401; Supabase remote DDL OK via `--db-url`; `.env` BOM gotcha).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all symbols read from source; zero new packages.
- Architecture/flow: HIGH — mirrors existing `ingest-run.ts`/`connector-camara.ts`.
- Endpoint shape: HIGH (documented + captured fixture); live-today behavior: MEDIUM-HIGH (verified 2026-06-18, ~5 weeks before this research) — that residual is precisely what the spike confirms.
- Mapping data: HIGH — seed inspected, 155 DIPIDs present.

**Research date:** 2026-06-18
**Valid until:** ~2026-07-18 (stable in-repo code; the live endpoint should be re-confirmed by the spike itself, which is the whole point).
