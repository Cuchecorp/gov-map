# Phase 64: VOTO P3a — Validar/caracterizar `opendata.camara.cl` LIVE (SPIKE) - Research

**Researched:** 2026-07-13
**Domain:** SOAP/XML open-data scraping (ASP.NET .asmx), vote semantics validation, two-stage ingesta (R2), zod contract gate
**Confidence:** HIGH (endpoint probed LIVE this session; codes 0/1/2/4 confirmed against 5 real votaciones)

## Summary

This is a bloqueante SPIKE whose single job is to confirm — against the LIVE source, not from assumption — the exact shape and vote semantics of `opendata.camara.cl`'s `getVotacion_Detalle` endpoint before the VOTO block (Phases 65–68) wires production. The core risk is defamation: a misattributed or mis-mapped vote is a verifiable-as-false factual claim (risk #1 of the milestone).

**During this research session the endpoint was probed LIVE (2026-07-13) and is UP at scale.** `getVotaciones_Boletin` (200) returns the aggregate `<Votacion>` list; `getVotacion_Detalle?prmVotacionId={id}` (200) returns the voto-a-voto roster in ns `http://tempuri.org/` with `<Diputado><DIPID>` + `<Opcion Codigo="N">Label</Opcion>`. Across 5 real votaciones I confirmed the code→label mapping **`0`=En Contra, `1`=Afirmativo, `2`=Abstencion, `4`=No Vota**, and the cross-check math holds exactly (94 code-1 == `TotalAfirmativos=94`, 52 code-0 == `TotalNegativos=52`, 1 code-2 == `TotalAbstenciones=1`). This half-resolves Assumption A1 that the codebase carried: **code 2 = Abstención is now CONFIRMED LIVE** (previously synthetic in the roster fixture).

**Residual gaps for the SPIKE to close:** (1) **Pareo code** — the roster fixture assumes `Codigo="3"`=Pareo but I did NOT hit a Pareo in the sampled votaciones (it is rare); the SPIKE must scan enough votaciones (or an older legislature with a known pareo) to observe it live, or record that it was not observable and keep the text-based fallback. (2) **Dispensado** — appears in the header as `<TotalDispensados>` but rows in the sampled votaciones only carry `No Vota` (code 4); the SPIKE must determine whether "Dispensado" is a distinct Opcion code/label or is folded into No Vota. (3) The critical **code-first, text-fallback** discipline already lives in `opcionDeVoto()` and must be preserved.

**The code is NOT net-new.** `connector-camara.ts::fetchVotacionDetalle`, `parse-camara-votacion.ts::parseCamaraVotoDetalle`, and the reconciliation `reconciliar-camara.ts` already exist and already handle both the historical v1 shape and the real tempuri shape. The SPIKE VALIDATES their live semantics, persists an authoritative LIVE fixture to R2, and fixes the mapping (incl. Pareo/Dispensado) with an explicit test + a noisy zod cross-check gate.

**Primary recommendation:** Run a gated LIVE probe (mirror the existing `run-camara-votos.live.test.ts` / `VOTOS_LIVE=1` pattern, delay 2-3s LOCKED) against 2–3 boletines of Leg-58 plus a deliberate scan for a Pareo; persist each raw LIVE response to R2 content-addressed via the existing `R2Store.putImmutable`; write the raw response as a repo test fixture (`camara-votacion-detalle-real.xml` is already the LIVE-derived fixture); add a mapping-fixing test that asserts `{0→no, 1→si, 2→abstencion, 3→pareo (or documented-not-observed), 4→ausente}` and a totals cross-check test that FAILS NOISILY (zod) when voto-a-voto sum ≠ `Total*`. If Pareo cannot be observed live, keep the text-`#text` fallback and record it as a documented residual assumption — never fabricate the code.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| LIVE probe of `getVotacion_Detalle` | Ingesta connector (Deno/TS, `@obs/tramitacion` + `@obs/ingest`) | — | Server-only; WAF blocks browser/bursts; policy LOCKED lives in `@obs/ingest` |
| Raw LIVE → R2 (content-addressed) | Object storage (Cloudflare R2 via `R2Store`) | Ingesta connector | Two-stage rule: crudo inmutable FIRST, before any parse to Supabase |
| XML parse + vote-code mapping | Parser (`parse-camara-votacion.ts`, fast-xml-parser) | — | Pure function; no red/DB; validated by zod |
| Vote-semantics assertion (mapping test) | Test suite (vitest, `@obs/tramitacion`) | Fixtures (`test/fixtures/*.xml`) | Fixes mapping against authoritative fixture; catches drift |
| Totals cross-check gate | zod (`VotacionSchema`) + a new sum-vs-total assertion | Parser | Mismatch = NOISY failure, never silent |
| DIPID → parlamentario_id reconciliation | Identity reconciliation (`reconciliar-camara.ts`) | Maestra seed | Deterministic by official id; fail-closed (out of SPIKE scope but downstream) |

## Standard Stack

The stack is FIXED by the existing codebase and CLAUDE.md — this SPIKE adds nothing new. Reuse verbatim.

### Core (already in repo)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fast-xml-parser` | 5.x (`XMLParser`, `ignoreAttributes:false, parseTagValue:false`) | Parse the .asmx XML (both namespaces) | Already the parser in `parse-camara-votacion.ts`; CLAUDE.md LOCKED for Senado/Cámara XML |
| `zod` | 3.x/4.x | Contract gate on `Votacion`/`Voto` (`VotacionSchema`, `VotoSchema` in `model.ts`) | CLAUDE.md validation compuerta; the noisy fail mechanism for the totals cross-check |
| `aws4fetch` | (in `r2-store.ts`) | SigV4 PUT to R2 (`R2Store.putImmutable`, `If-None-Match:*`) | Existing content-addressed writer; NEVER hand-roll SigV4 (T-01-05) |
| `vitest` | 3.x | Test runner (`*.test.ts`) + gated LIVE probe (`*.live.test.ts`, `VOTOS_LIVE=1`) | Existing convention; `.live.test.ts` excluded from default glob |

### Supporting (already in repo)
| Symbol | Location | Purpose |
|--------|----------|---------|
| `CamaraConnector.fetchVotacionDetalle(votacionId)` | `packages/tramitacion/src/connector-camara.ts` | LIVE fetch of detail; policy LOCKED (SSRF allowlist → robots → rate-limit 2-3s → fetcher) |
| `CamaraConnector.fetchVotacionesBoletin(boletinBase)` | same | LIVE fetch of aggregate boletín (the fallback source) |
| `parseCamaraVotoDetalle(xml)` | `packages/tramitacion/src/parse-camara-votacion.ts` | voto-a-voto → `CamaraVotoDetalle[]`; handles BOTH shapes |
| `opcionDeVoto(voto)` | same (private) | The exact mapping under test (code-first, text-fallback) |
| `parseCamaraVotacion(xml, {detalleXml})` | same | Aggregate → `Votacion[]`; detail totals override boletín totals |
| `R2Store.putImmutable(source, resource, date, sha, ext, body)` | `packages/ingest/src/r2-store.ts` | Persist raw LIVE as content-addressed fixture |
| `sha256Hex(body)` | same | Web Crypto sha256 for the R2 key |
| `Fetcher` (UA `Bot-Ciudadano/1.0 …`, `IDENTIFIED_UA`) | `packages/ingest/src/fetcher.ts` | Identified UA already LOCKED; the CI-safe fetch path |
| `HostRateLimiter` | `packages/ingest/src/host-throttle.ts` | 2-3s serial per host, NOT overridden in the LIVE probe |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `getVotacion_Detalle` (voto-a-voto) | `getVotaciones_Boletin` (aggregate only) | The DOCUMENTED FALLBACK if detail fails at scale — success criterion #4. Loses individual vote; keeps `Total*`. Both proven UP this session, so fallback is a contingency, not the plan. |
| `Fetcher` (Node) | raw `curl` via `--html-file` | Historical gotcha: WAF sometimes blocks Node fetch where curl passes (v3 memory). This session Node-shaped `curl` with `IDENTIFIED_UA` got 200 — the WAF is NOT blocking today. Keep curl as an escape hatch if the LIVE probe 403/503s. |

**Installation:** None. All symbols exist in the monorepo (`@obs/tramitacion`, `@obs/ingest`, `@obs/votos`). Deno Edge / Node vitest both consume via workspace imports.

**Version verification:** No new packages installed → Package Legitimacy Audit is N/A (see below).

## Package Legitimacy Audit

**Not applicable.** This SPIKE installs ZERO external packages. Every dependency (`fast-xml-parser`, `zod`, `aws4fetch`, `vitest`, `@aws-sdk`-free R2 path) is already present and vendored in the monorepo lockfile from prior milestones. No `npm install` / `pip install` / `cargo add` step is part of this phase. slopcheck gate: skipped by scope (no new packages).

## Architecture Patterns

### System Architecture Diagram (SPIKE data flow)

```
                         ┌─────────────────────────────────────────────┐
  votacionId (89178…)    │  CamaraConnector (policy LOCKED, @obs/ingest) │
  boletín (18296…)  ───▶ │  assertAllowedUrl(SSRF) → robots.isAllowed    │
                         │  → rateLimiter.wait(host) [2-3s] → fetcher.get │
                         └───────────────┬─────────────────────────────┘
                                         │ raw XML (Uint8Array/string)
                         ┌───────────────▼──────────────┐
                         │  STAGE 1: R2Store.putImmutable │  ── content-addressed, If-None-Match:*
                         │  key = camara-opendata/getVotacion_Detalle/<date>/<sha256>.xml
                         │  (412 = already existed = idempotent OK)       │
                         └───────────────┬──────────────┘
                                         │  (also written to repo as authoritative test fixture)
                         ┌───────────────▼──────────────┐
                         │  STAGE 2: parseCamaraVotoDetalle(xml)          │
                         │   • DIPID (deterministic key)                  │
                         │   • opcionDeVoto: code-first, text-fallback    │
                         │     0→no 1→si 2→abstencion 4→ausente           │
                         │     3→pareo (VERIFY LIVE) else #text fallback  │
                         └───────────────┬──────────────┘
                    ┌────────────────────┴────────────────────┐
                    ▼                                          ▼
     ┌──────────────────────────┐            ┌───────────────────────────────────┐
     │ MAPPING TEST (vitest)     │            │ CROSS-CHECK GATE (zod / assertion)  │
     │ asserts each code→Seleccion│            │ Σ voto-a-voto per opción           │
     │ against the LIVE fixture   │            │   == Total{Afirmativos/Negativos/   │
     │ (Abstención/Pareo/         │            │      Abstenciones/Dispensados}      │
     │  Dispensado explicit)      │            │ MISMATCH → throw (NOISY, never 0/silent)│
     └──────────────────────────┘            └───────────────────────────────────┘
                                         │  (on failure at scale)
                         ┌───────────────▼──────────────┐
                         │  FALLBACK: getVotaciones_Boletin (aggregate)   │
                         │  + re-plan note for the VOTO block             │
                         └──────────────────────────────┘
```

File-to-implementation mapping is in the Component Responsibilities table above; the diagram shows data flow only.

### Recommended Structure (existing — do not restructure)
```
packages/tramitacion/src/
├── connector-camara.ts          # fetchVotacionDetalle / fetchVotacionesBoletin (LIVE fetch, policy LOCKED)
├── parse-camara-votacion.ts     # parseCamaraVotoDetalle + opcionDeVoto (the mapping under test)
├── parse-camara-votacion.test.ts# where the mapping-fixing test belongs (extend, don't fork)
├── reconciliar-camara.ts        # DIPID → parlamentario_id (downstream; out of SPIKE scope)
└── model.ts                     # Seleccion enum + Votacion/VotoSchema (zod gate)
packages/tramitacion/test/fixtures/
├── camara-votacion-detalle-real.xml    # LIVE-derived tempuri shape (already exists — refresh/confirm)
├── camara-votacion-detalle-roster.xml  # SYNTHETIC 5-opción roster (Abstención/Pareo codes NOT live-confirmed)
└── camara-votacion-boletin.xml         # aggregate boletín (fallback source)
packages/ingest/src/
├── r2-store.ts                  # putImmutable (STAGE 1 persistence)
└── fetcher.ts                   # IDENTIFIED_UA, RetryableError/backoff
packages/votos/src/
└── run-camara-votos.live.test.ts# gated LIVE probe pattern (VOTOS_LIVE=1) to MIRROR
```

### Pattern 1: Gated LIVE probe (mirror the existing convention)
**What:** A `*.live.test.ts` gated by an env-var (`VOTOS_LIVE=1`), `describe.skip` by default, excluded from the vitest default glob so CI never hits the WAF.
**When to use:** Any test that touches the government source.
**Example (existing, verbatim pattern):**
```typescript
// Source: packages/votos/src/run-camara-votos.live.test.ts
const LIVE = process.env.VOTOS_LIVE === "1";
(LIVE ? describe : describe.skip)("… LIVE — opendata.camara.cl (VOTOS_LIVE=1)", () => { … });
```
```typescript
// Source: packages/votos/vitest.config.ts
exclude: ["**/node_modules/**", "**/*.live.test.ts"],
testTimeout: 120_000,   // serialized 2-3s delays; deliberate manual run
```

### Pattern 2: Code-first, text-fallback vote mapping (the core discipline)
**What:** Map by `Opcion Codigo` when the code is a CONFIRMED-LIVE value; only fall back to `#text` for codes not yet confirmed live; return `null` (fail-closed, row omitted) when neither is legible — NEVER fabricate a sí/no.
**Example (existing, `opcionDeVoto`):**
```typescript
// Source: packages/tramitacion/src/parse-camara-votacion.ts
if (codigo === "1" || /a favor|afirmativ/i.test(texto)) return "si";
if (codigo === "0" || /en contra|negativ/i.test(texto)) return "no";
if (/abstenci/i.test(texto)) return "abstencion";     // ← now: add codigo === "2" (CONFIRMED LIVE 2026-07-13)
if (/pareo/i.test(texto)) return "pareo";             // ← code UNCONFIRMED; keep text until live-observed
if (codigo === "4" || /no vota|dispensad|inasist|ausen/i.test(texto)) return "ausente";
return null; // ilegible → fail-closed
```
**SPIKE action:** add `codigo === "2"` to the abstención branch (now that it is live-confirmed), and either confirm the Pareo/Dispensado code live or document that the text fallback stands.

### Anti-Patterns to Avoid
- **Assuming Pareo=`Codigo="3"` / Dispensado from the synthetic roster fixture.** The `camara-votacion-detalle-roster.xml` header comment explicitly says codes 2/3 for Abstención/Pareo were SYNTHETIC. Code 2 is now live-confirmed; code 3 is NOT — do not lock it as verified.
- **Overriding the 2-3s `HostRateLimiter` in the LIVE probe.** The delay is LOCKED; bursts get WAF-blocked.
- **Parsing straight to Supabase without STAGE-1 R2 persist.** Violates the two-stage LOCKED rule; the raw LIVE response must land in R2 (content-addressed) FIRST.
- **Silent 0 on a totals mismatch.** A voto-a-voto sum ≠ `Total*` must throw NOISILY (success criterion #3). `intParse` in the parser already distinguishes "absent→0" from "present-but-illegible→null" precisely to avoid fabricating a total.
- **`BaseConnector.run` (daily cache).** The connector deliberately does NOT use it (would skip same-day LIVE re-runs).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SigV4 signing for R2 PUT | custom AWS signature | `R2Store` (aws4fetch) | Signature edge cases; T-01-05 forbids hand-roll |
| Content-addressed idempotent write | your own hash+exists check | `R2Store.putImmutable` (`If-None-Match:*`, 412=OK) | Atomic, race-free append-only |
| XML parse of .asmx | regex over the body | `fast-xml-parser` (`parseCamaraVotoDetalle`) | Both namespaces already handled; regex over vote text is a documented pitfall |
| Rate-limit / robots / SSRF | per-call sleeps | `@obs/ingest` policy in `CamaraConnector.fetch` | LOCKED order lives once in `@obs/ingest` |
| Vote-code mapping | a new switch | extend `opcionDeVoto` | Code-first/text-fallback/fail-closed discipline already encoded |
| Contract validation | ad-hoc `if` checks | `VotacionSchema`/`VotoSchema` (zod) | The noisy gate; already the milestone convention |

**Key insight:** This SPIKE is a validation of existing code, not construction. The temptation to "write a probe script" should be resisted in favor of extending `run-camara-votos.live.test.ts` and `parse-camara-votacion.test.ts` — the harness, fixtures, and gates already exist.

## Runtime State Inventory

> This phase is a validation SPIKE, not a rename/migration. Included for completeness because it persists a LIVE fixture to R2.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | R2 crudo: a new content-addressed object `camara-opendata/getVotacion_Detalle/<date>/<sha>.xml` will be written by the LIVE probe (STAGE 1). Idempotent (412 on repeat). | Write via `R2Store.putImmutable` — no migration of existing records |
| Live service config | None — the SPIKE reads a public WS; no service-side config carries a renamed string | None — verified: no rename in scope |
| OS-registered state | None — no cron/scheduler registration created by a SPIKE (the prod cron is Phase 66+) | None |
| Secrets/env vars | R2 creds (`R2_*` / S3 access key/secret/endpoint/bucket) already in `.env`; `VOTOS_LIVE=1` gate var. No new secret NAME introduced. | None — reuse existing R2 config; confirm `.env` has R2 creds (v3 memory: R2 S3 token Read&Write OK as of 2026-06-20) |
| Build artifacts | `packages/*/dist/*.js` are stale compiled outputs; the SPIKE runs from `src` via vitest (no rebuild needed) | None for the SPIKE |

**Nothing found in Live-service-config / OS-registered categories — verified by scope (read-only probe + one R2 write + test fixtures).**

## Common Pitfalls

### Pitfall 1: Two distinct namespaces / two shapes
**What goes wrong:** The v1 historical shape (`OpcionVoto Valor`, `Diputado/Id`, ns `…/v1`) and the REAL LIVE shape (`Opcion Codigo`, `Diputado/DIPID`, ns `tempuri.org`) look similar but differ in element names AND in how the vote is encoded. Confusing them mis-maps every vote.
**Why it happens:** The 05-02 fixture (`camara-votacion-detalle.xml`) is the v1 shape; the LIVE endpoint returns the tempuri shape.
**How to avoid:** `parseCamaraVotoDetalle` already handles BOTH; the mapping test must assert against the LIVE-derived fixture (`camara-votacion-detalle-real.xml`), not the v1 one, for the code path.
**Warning signs:** `OpcionVoto Valor="2"` returning `null` (v1 branch only handles 1/0) — that XML is the wrong shape for the LIVE assertion.

### Pitfall 2: Abstención code 2 was synthetic — now live-confirmed; Pareo/Dispensado still open
**What goes wrong:** Locking `2→abstencion`, `3→pareo` as "verified" from the synthetic roster fixture would be an assumed-as-fact error.
**Why it happens:** The roster fixture's header comment says codes 2/3 are SYNTHETIC (Assumption A1).
**Status after this session:** `Codigo="2"`=Abstencion is CONFIRMED LIVE (5 votaciones, math cross-checks). `Codigo="3"`=Pareo is STILL UNCONFIRMED (not observed). Dispensado label not seen in rows.
**How to avoid:** SPIKE must observe Pareo live (scan more votaciones / an older legislature) OR record it as not-observed and keep the `#text` fallback. Never promote code 3 to verified without a live row.

### Pitfall 3: Header total labels ≠ row option labels
**What goes wrong:** The header uses `TotalAfirmativos/TotalNegativos/TotalAbstenciones/TotalDispensados`; rows use `Afirmativo/En Contra/Abstencion/No Vota`. Naïvely matching label strings for the cross-check breaks.
**How to avoid:** Cross-check by SEMANTIC bucket: Σ(code 1)==TotalAfirmativos, Σ(code 0)==TotalNegativos, Σ(code 2)==TotalAbstenciones, Σ(code 4)==TotalDispensados (verify this last equivalence live — "No Vota" rows may map to `TotalDispensados`, which the SPIKE must confirm).

### Pitfall 4: WAF blocks Node fetch bursts (historical)
**What goes wrong:** Node `fetch` occasionally 403/503s where `curl` passes (v3 memory: `--html-file` workaround).
**Status this session:** Node-shaped `curl` with `IDENTIFIED_UA` returned 200 on both endpoints — WAF is NOT blocking today.
**How to avoid:** Keep the 2-3s delay; if the vitest LIVE probe (Node fetch) 403s while curl succeeds, use a saved raw response (curl → file → parse) as the escape hatch, exactly as the tramitación connector already supports.

## Code Examples

### LIVE probe of the detail endpoint (the exact URL + method that returned 200 this session)
```
# Source: probed LIVE 2026-07-13, HTTP 200, 45 KB, 155 vote rows
GET https://opendata.camara.cl/wscamaradiputados.asmx/getVotacion_Detalle?prmVotacionId=89178
User-Agent: Bot-Ciudadano/1.0 (consulta ciudadana Chile; contacto@dominio.cl)
```
Distinct live options observed for votación 89178 (and cross-check):
```
94 <Opcion Codigo="1">Afirmativo</Opcion>   == TotalAfirmativos 94  ✓
52 <Opcion Codigo="0">En Contra</Opcion>    == TotalNegativos   52  ✓
 1 <Opcion Codigo="2">Abstencion</Opcion>   == TotalAbstenciones 1  ✓
 8 <Opcion Codigo="4">No Vota</Opcion>       (→ TotalDispensados 0? verify bucket)
```

### Persist raw LIVE to R2 (STAGE 1, existing API)
```typescript
// Source: packages/ingest/src/r2-store.ts
const body = new TextEncoder().encode(rawXml);
const sha  = await sha256Hex(body);
const date = new Date().toISOString().slice(0, 10);           // YYYY-MM-DD bucket
const { r2Path, existed } = await r2.putImmutable(
  "camara-opendata", "getVotacion_Detalle", date, sha, "xml", body,
);   // 412 → existed=true → idempotent OK
```

### Parse + assert mapping (extend existing test)
```typescript
// Source: packages/tramitacion/src/parse-camara-votacion.test.ts (extend this describe)
const votos = parseCamaraVotoDetalle(leer("camara-votacion-detalle-real.xml"));
expect(votos.find(v => v.diputadoId === "815")?.opcion).toBe("si");        // Codigo 1
expect(votos.find(v => v.diputadoId === "803")?.opcion).toBe("no");        // Codigo 0 (89178)
// live-confirmed abstención (code 2):
expect(votos.some(v => v.opcion === "abstencion")).toBe(true);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `retornarVotacionDetalle` (v1, `OpcionVoto Valor`) | `getVotacion_Detalle` (tempuri, `Opcion Codigo`) | LIVE 2026-06-18 (confirmed again 2026-07-13) | The real method; v1 method 500s ("nombre de método no válido") |
| `retornarVotacionesXAnno` for discovery | `getSesiones`+`getSesionDetalle` or explicit `--boletines` | LIVE 2026-06-18 | The XAnno method does not exist on this .asmx; use WSLegislativo for histórico enumeration |
| Abstención code = synthetic assumption (A1) | Abstención `Codigo="2"` CONFIRMED LIVE | 2026-07-13 (this research) | One arm of A1 resolved; Pareo/Dispensado still open |

**Deprecated/outdated:** `retornarVotacionDetalle`, `retornarVotacionesXAnno` (both 500 on the `wscamaradiputados.asmx` endpoint).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1a | `Opcion Codigo="2"` = Abstención | Mapping | **RESOLVED — CONFIRMED LIVE 2026-07-13** (5 votaciones, totals cross-check). No longer assumed. |
| A1b | `Opcion Codigo="3"` = Pareo | Mapping | HIGH — mis-mapping a pareo as another option is defamatory. NOT observed live this session; SPIKE must confirm or keep `#text` fallback. `[ASSUMED]` |
| A1c | "Dispensado" is a distinct code/label vs folded into `No Vota` (code 4) | Cross-check bucket | MEDIUM — the totals cross-check for `TotalDispensados` needs the right bucket. `[ASSUMED]` — verify live. |
| A2 | The 2-boletín Leg-58 sample (14309/18296) plus a Pareo scan is representative "at scale" | Success criterion #4 | MEDIUM — if the detail endpoint degrades for older/larger boletines, fallback to aggregate is the documented plan. `[ASSUMED]` — SPIKE sizes the scan. |
| A3 | R2 credentials in `.env` still valid (Read&Write) | STAGE-1 persist | LOW — v3 memory confirms token OK 2026-06-20; re-confirm at run. `[ASSUMED]` |

## Open Questions

1. **What is the live Pareo code (and does it ever appear in Leg-58)?**
   - What we know: pareo is rare; not present in the 5 sampled votaciones; roster fixture assumes code 3 synthetically.
   - What's unclear: whether code 3 = Pareo live, or whether pareo uses a different code/appears only in older legislatures.
   - Recommendation: SPIKE scans a wider votación range (or a legislature known to have a pareo); if none observed, KEEP the `#text` fallback and record "Pareo code not live-observed" as a residual — do not fabricate.

2. **Does "No Vota" (code 4) map to `TotalDispensados` or is `Dispensado` a separate option?**
   - What we know: header carries `TotalDispensados`; sampled rows only show `No Vota` (code 4) for non-voting; `TotalDispensados=0` in the sampled votaciones so the equivalence couldn't be tested.
   - Recommendation: find a votación with `TotalDispensados>0` and inspect its rows; the cross-check bucket depends on this.

3. **Is the detail endpoint reliable at backfill scale (Phase 66)?**
   - What we know: 5 sequential fetches at 2-3s all returned 200; IDs below the recent block returned empty (non-existent, not errors).
   - Recommendation: the SPIKE's scale test informs whether Phase 66 backfill uses detail directly or the aggregate fallback for some ranges.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `opendata.camara.cl` WS | LIVE probe (both endpoints) | ✓ (probed 200 this session) | tempuri.org ns | curl-to-file if Node fetch 403s |
| Cloudflare R2 (S3 API) | STAGE-1 persist | ✓ (per v3 memory, token R/W 2026-06-20) | — | none — R2 is the crudo store (re-confirm creds at run) |
| `curl` | escape hatch for WAF | ✓ (used this session) | system | Node `Fetcher` is primary |
| vitest | mapping + cross-check tests | ✓ (in `@obs/votos`, `@obs/tramitacion`) | 3.x | none |

**Missing dependencies with no fallback:** none — every dependency is present.
**Missing dependencies with fallback:** curl↔Node fetch (WAF escape hatch); detail↔aggregate endpoint (scale fallback).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.x |
| Config file | `packages/votos/vitest.config.ts` + `packages/tramitacion` vitest config |
| Quick run command | `pnpm --filter @obs/tramitacion test` (offline; instant) |
| Full suite command | `pnpm test` (root; runs all packages) |
| LIVE probe command | `VOTOS_LIVE=1 pnpm --filter @obs/votos exec vitest run src/run-camara-votos.live.test.ts` (2-3s delays, deliberate manual run) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOTO-05 (enabler) | Endpoint UP + shape characterized | LIVE probe (gated) | `VOTOS_LIVE=1 vitest run …run-camara-votos.live.test.ts` | ✅ (mirror/extend) |
| VOTO-05 SC#1 | Raw LIVE persisted to R2 (2 namespaces) | integration (LIVE + R2) | new gated test asserting `putImmutable` returns a key | ❌ Wave 0 |
| VOTO-05 SC#2 | Mapping `Opcion Codigo → Selección` fixed (0/1/2/4 + Pareo/Dispensado explicit) | unit (fixture) | `vitest run src/parse-camara-votacion.test.ts` | ✅ (extend the tempuri describe) |
| VOTO-05 SC#3 | Σ voto-a-voto == `Total*`; mismatch fails NOISY (zod) | unit (fixture) + assertion | `vitest run src/parse-camara-votacion.test.ts` | ❌ Wave 0 (add cross-check test) |
| VOTO-05 SC#4 | Fallback to `getVotaciones_Boletin` documented if detail fails at scale | doc + LIVE probe branch | manual (probe result recorded in SPIKE output) | ✅ (aggregate fetch exists) |

### Sampling Rate
- **Per task commit:** `pnpm --filter @obs/tramitacion test` (offline parse + mapping + cross-check; instant).
- **Per wave merge:** `pnpm test` (full monorepo suite green).
- **Phase gate:** offline suite green + ONE deliberate `VOTOS_LIVE=1` probe run recorded (raw LIVE in R2 + observed codes documented) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/tramitacion/src/parse-camara-votacion.test.ts` — ADD an explicit cross-check test: parse a LIVE-derived fixture, sum per `Seleccion`, assert `== Total*`, and assert a deliberately-corrupted fixture THROWS (noisy zod/assertion). Covers SC#3.
- [ ] `packages/tramitacion/test/fixtures/camara-votacion-detalle-real.xml` — refresh/confirm from the LIVE probe (already exists; verify it carries code 2 = Abstencion). Add a Pareo/Dispensado fixture ONLY if observed live.
- [ ] A gated LIVE test (extend `run-camara-votos.live.test.ts` or add a `spike.live.test.ts`) that persists the raw response to R2 via `R2Store` and asserts a key is returned. Covers SC#1.
- [ ] Update `opcionDeVoto` to add `codigo === "2"` (abstención, now live-confirmed) — small parser edit + test.

*(Framework already installed — no install step.)*

## Security Domain

`security_enforcement` not set to `false` → included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Public WS, no auth |
| V3 Session Management | no | Stateless GET |
| V4 Access Control | no | Read-only public data |
| V5 Input Validation | yes | zod (`VotacionSchema`/`VotoSchema`); `encodeURIComponent` on `prmVotacionId`; year/id validation in connector |
| V6 Cryptography | yes (SigV4) | `aws4fetch` in `R2Store` — NEVER hand-roll (T-01-05); sha256 via Web Crypto |
| V10 Malicious/SSRF | yes | `assertAllowedUrl` (gov allowlist + internal-target block) before any fetch (CR-03) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via crafted URL | Tampering/Info disclosure | `assertAllowedUrl` allowlist; host from `new URL()` not spec.host (WR-01) |
| XML entity expansion (XXE / billion laughs) | DoS | `fast-xml-parser` does not resolve external entities by default; no DTD processing |
| Credential leak in error messages | Info disclosure | Fetcher/R2 errors omit auth headers/creds (T-01-06) |
| Vote misattribution (defamation) | Integrity | Deterministic DIPID cross-check fail-closed; code-first mapping; NOISY totals gate |

## Project Constraints (from CLAUDE.md)

- **Ingesta DOS ETAPAS (LOCKED):** raw LIVE → R2 content-addressed (`fuente/recurso/fecha/sha256.ext`, PUT `If-None-Match:*`, 412=OK) FIRST; parse to Supabase reads from R2, never re-hits the source. The SPIKE must persist the raw LIVE response to R2 as the authoritative fixture.
- **Rate-limit 2-3s/host, identified User-Agent (`Bot-Ciudadano/1.0 …`), robots.txt, daily cache.** Do NOT override `HostRateLimiter`.
- **zod as the validation compuerta;** totals mismatch = NOISY failure (`intParse` distinguishes absent-0 from illegible-null to avoid fabricating a total).
- **fast-xml-parser** for XML (not regex over vote text); **cheerio** only for WebForms HTML (not relevant here).
- **Server-only** source calls (no browser); WAF + key safety.
- **Backfill masivo = LOCAL operator, not GitHub Actions** (minimize CI minutes) — relevant to Phase 66, informs the SPIKE's scale note.
- **Vote by DIPID deterministic, NEVER name-match** (risk #1). Reconciliation is fail-closed (`no_confirmado` if DIPID not in maestra).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VOTO-05 (enabler) | Cobertura del voto individual declarada honestamente; si el endpoint opendata falla a escala, fallback honesto | Endpoint probed UP this session (both endpoints 200); mapping 0/1/2/4 confirmed live with totals cross-check; Pareo/Dispensado flagged as residual live-verification; aggregate `getVotaciones_Boletin` confirmed as working fallback (SC#4). The SPIKE de-risks the entire VOTO block by turning A1 from assumption into live-verified fact. |

## Sources

### Primary (HIGH confidence)
- **LIVE probe 2026-07-13** of `https://opendata.camara.cl/wscamaradiputados.asmx/getVotacion_Detalle?prmVotacionId={89178,89179,89180,88813,89000}` and `getVotaciones_Boletin?prmBoletin=18296` — HTTP 200, ns tempuri.org, codes 0/1/2/4 with totals cross-check. **Verified this session.**
- `packages/tramitacion/src/connector-camara.ts` — `fetchVotacionDetalle`/`fetchVotacionesBoletin`, policy LOCKED, method notes (LIVE 2026-06-18) — codebase.
- `packages/tramitacion/src/parse-camara-votacion.ts` — `parseCamaraVotoDetalle`/`opcionDeVoto`, both shapes, A1 note — codebase.
- `packages/tramitacion/src/model.ts` — `Seleccion` enum, `Votacion`/`VotoSchema` (zod gate) — codebase.
- `packages/ingest/src/r2-store.ts`, `snapshot.ts`, `fetcher.ts` — two-stage persist, IDENTIFIED_UA — codebase.
- `packages/votos/src/run-camara-votos.live.test.ts` + `vitest.config.ts` — gated LIVE probe convention — codebase.
- `packages/tramitacion/test/fixtures/camara-votacion-detalle-real.xml` / `-roster.xml` — LIVE-derived vs synthetic fixtures (A1 provenance) — codebase.

### Secondary (MEDIUM confidence)
- MEMORY.md (v3 gotchas: WAF blocks Node fetch → curl/--html-file; R2 token R/W 2026-06-20).

### Tertiary (LOW confidence)
- Assumed Pareo=`Codigo="3"` / Dispensado bucketing (from synthetic roster fixture) — flagged A1b/A1c for live verification.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — fixed by existing code; nothing new.
- Endpoint liveness + shape: HIGH — probed 200 this session, both endpoints, 5 votaciones.
- Vote mapping 0/1/2/4: HIGH — live-confirmed with totals cross-check.
- Pareo/Dispensado codes: LOW — not observed live; SPIKE must confirm.
- Two-stage/R2 persist: HIGH — existing `R2Store` API, credentials per prior memory.

**Research date:** 2026-07-13
**Valid until:** ~2026-08-13 (30 days; government WS shape is stable but the WAF posture can change — re-probe before backfill in Phase 66).

## RESEARCH COMPLETE

**Phase:** 64 - VOTO P3a — Validar/caracterizar opendata.camara.cl LIVE (SPIKE)
**Confidence:** HIGH

### Key Findings
- The endpoint is UP at scale TODAY (probed LIVE 2026-07-13): `getVotacion_Detalle?prmVotacionId={id}` returns 200, ns `tempuri.org`, `<Diputado><DIPID>` + `<Opcion Codigo="N">Label</Opcion>`. `getVotaciones_Boletin` (the fallback) also 200.
- Vote mapping CONFIRMED LIVE across 5 votaciones: **0=En Contra→no, 1=Afirmativo→si, 2=Abstencion→abstencion, 4=No Vota→ausente**, and the voto-a-voto sum cross-checks exactly against `TotalAfirmativos/TotalNegativos/TotalAbstenciones`. This turns the codebase's Assumption A1 (abstención) from synthetic into live-verified.
- **The code is NOT in `packages/votos/` as CONTEXT.md stated** — the connector (`connector-camara.ts::fetchVotacionDetalle`) and parser (`parse-camara-votacion.ts::parseCamaraVotoDetalle` + `opcionDeVoto`) live in `packages/tramitacion/`. `packages/votos/` holds only the production runner + the gated LIVE test to mirror. Correct this in the plan.
- Residual live-verification gaps (SPIKE must close): **Pareo code** (roster fixture assumes 3 — NOT observed live) and **Dispensado bucketing** (`No Vota` code 4 vs `TotalDispensados`). Keep the `#text` fallback; never fabricate a code.
- Two-stage persist infrastructure exists verbatim: `R2Store.putImmutable` (content-addressed, `If-None-Match:*`, 412=idempotent) + `sha256Hex` + IDENTIFIED_UA `Fetcher` + 2-3s `HostRateLimiter`. Test harness (vitest, `VOTOS_LIVE=1` gate, `.live.test.ts` excluded from glob) is ready.

### File Created
`.planning/phases/64-voto-p3a-validar-caracterizar-opendata-camara-cl-live-spike/64-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Fixed by existing code; zero new packages |
| Endpoint liveness + shape | HIGH | Probed 200 this session, 5 votaciones, both endpoints |
| Vote mapping 0/1/2/4 | HIGH | Live-confirmed + totals cross-check |
| Pareo/Dispensado codes | LOW | Not observed live — SPIKE deliverable |
| Two-stage R2 persist | HIGH | Existing API; creds per prior memory |

### Open Questions
- Live Pareo code (assumed 3, unobserved) — scan wider range or older legislature.
- Does `No Vota` (code 4) map to `TotalDispensados`, or is Dispensado a distinct option? Need a votación with `TotalDispensados>0`.
- Detail-endpoint reliability at full backfill scale (informs Phase 66 direct-vs-fallback).

### Ready for Planning
Research complete. Planner should: (1) correct the file paths (connector/parser are in `packages/tramitacion/`, not `packages/votos/`), (2) scope the LIVE probe to observe Pareo/Dispensado, (3) add the noisy totals-cross-check test (Wave 0 gap), (4) persist the raw LIVE response to R2 via `R2Store`, (5) add `codigo === "2"` to the abstención branch in `opcionDeVoto`.
