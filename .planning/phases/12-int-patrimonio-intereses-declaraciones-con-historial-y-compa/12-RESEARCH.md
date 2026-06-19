# Phase 12: INT Patrimonio/Intereses — Declaraciones con historial y comparación - Research

**Researched:** 2026-06-19
**Domain:** Civic-data ingestion — InfoProbidad (CPLT/Contraloría) declaraciones de patrimonio e intereses via CSV catalogs / SPARQL (`datos.cplt.cl`), versioned declaration model, patrimonio section of `/parlamentario/[id]` with version history + side-by-side comparison
**Confidence:** HIGH on access method (re-validated LIVE 2026-06-19 — SPARQL endpoint queried successfully, structure confirmed), HIGH on connector/writer/identity/RLS patterns (Phase 11 shipped the exact mirror + Phase 9 conventions), HIGH on "no LLM needed" verdict (content is fully structured RDF/CSV, not free-text PDF)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**INT Patrimonio/Intereses:**
- **Acceso a InfoProbidad:** CSV catalogs preferente + SPARQL (`datos.cplt.cl/sparql`) para estructura; reusa `@obs/ingest` en el orden LOCKED (research v2.0: InfoProbidad accesible, CC BY 4.0). La atribución CC BY 4.0 debe ser VISIBLE, incluso en vistas derivadas (comparación).
- **Extracción del contenido:** si la declaración viene estructurada (CSV/SPARQL) → parsear literal con zod, SIN LLM. Si requiere LLM (PDF/texto libre) → pasar OBLIGATORIO por la compuerta `data-routing` de `@obs/llm` (tier sin entrenamiento, `assertNoRutInLlmInput`/`assertSensitivityAllowed`; ningún RUT/PII al LLM). Extracción LITERAL, nunca interpreta ni concluye.
- **Modelo historial de versiones:** cada versión = fila fechada por fecha de presentación; la fecha se muestra prominente con badge de frescura (ámbar si está vieja). NUNCA una declaración vieja se presenta como estado actual. Drift de esta fuente PII es BLOQUEANTE (cuarentena la corrida, no degrada en silencio).
- **Comparación lado-a-lado:** solo datos, lado a lado en el tiempo; CERO campo de veredicto "enriquecimiento"/"conflicto de interés"/delta calculado-con-juicio. Carril propio (patrón anti-insinuación Phase 11); el gate de contenido cubre TAMBIÉN la vista derivada de comparación (lección `representado`/prosa no gobernada de Phase 11 UI-review).

### Claude's Discretion
- Exact table/column names of the new migration (≥0022), as long as they follow the 0018 deny-by-default convention and the keying rules.
- Whether `@obs/probidad` is a brand-new package or mirrors `@obs/lobby` file-for-file (recommendation below: new package, mirror `@obs/lobby`).
- The shape of the read RPC(s) / query for the ficha section + comparison view, as long as they respect RLS public-read and honest empty states.
- Whether the version history and comparison are one RPC or two.

### Deferred Ideas (OUT OF SCOPE)
- Dinero (SERVEL/ChileCompra) → Phases 14-16.
- Grafo NET → Phase 18.
- Cruces inter-bloque (patrimonio junto a voto/dinero) → diferido por regla anti-insinuación + legal.
- Compuerta legal de exposición pública del bloque → Phase 13 (siguiente; fuera de este rango --to 12).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INT-03 | El conector `@obs/probidad` ingiere las declaraciones de patrimonio e intereses (InfoProbidad, CSV/SPARQL) de forma literal, con fecha de presentación y atribución CC BY 4.0 visible. | §"InfoProbidad Access (re-validated LIVE)" maps the SPARQL endpoint + the `Declaracion`/`Persona` model + `fechaDeclaracion` (the fecha de presentación); §"Connector reuse" gives the `@obs/lobby` mirror; §"Data Model" gives the versioned tables; content is **structured RDF → literal zod parse, NO LLM** (verdict in Summary). CC BY 4.0 confirmed on the source. |
| INT-04 | El ciudadano ve las declaraciones de patrimonio e intereses de un parlamentario con su historial de versiones (qué declaró y cuándo). | §"Versioning is native" (one Persona → many Declaracion, each with distinct `fechaDeclaracion`); §"Data Model" (`declaracion` versioned by `fecha_presentacion`, never overwrite); §"Read RPCs" (history RPC ordered by date DESC); §"UI section" (prominent date + amber freshness badge; old never shown as current). |
| INT-05 | El ciudadano puede comparar las declaraciones de patrimonio de un parlamentario en el tiempo (lado a lado), sin ningún veredicto de "enriquecimiento" — solo muestra los datos. | §"Comparison view" (two/N declaration versions side-by-side, data only, ZERO verdict/delta field); §"Content gate extended to comparison" (mirror Phase 11 §9.1 gate, applied to the derived comparison view). |
</phase_requirements>

## Summary

**Phase 12 is the fifth ingestion connector cloned from `@obs/lobby` (itself an `@obs/agenda` clone), one new deny-by-default migration (≥0022), and one new stacked `<section id="patrimonio">` on the existing `/parlamentario/[id]` shell — with a comparison sub-view.** No new libraries, no new infra. Everything rides shipped machinery: `@obs/ingest` (allowlist **already contains `cplt.cl` and `infoprobidad.cl`** — `[VERIFIED: allowlist.ts]`), `correrPipeline` + `EnlaceConfirmado` for the declarante→parlamentario cross, the 0018/0021 deny-by-default RLS convention (RLS-on + zero policies + **explicit `revoke all from anon, authenticated`** — the Phase-11 lesson), the `ProvenanceBadge` amber-freshness pattern, and the security-definer-RPC read path.

**The research-gated access question is fully resolved and the answer is decisive: the declaration content is STRUCTURED — parse it literally with zod, NO LLM is needed.** The CPLT SPARQL endpoint `https://datos.cplt.cl/sparql` is live (HTTP 200, queried successfully 2026-06-19) and exposes a complete RDF/OWL model: `Declaracion` (170,562 instances) linked to a `Persona` declarante (234,041) with `fechaDeclaracion` (= the fecha de presentación), `tipoDeclaracion`, `poseeCargo`, `organismoFuente`, and typed asset sub-entities (`BienInmueble` 302K, `Actividad` 283K, `Pasivo` 244K, `AccionDerecho`, `BienMueble`, `Valores`). **Versioning is native:** one declarante has many `Declaracion`s each with a distinct `fechaDeclaracion` (a single sample showed declarations dated 2020, 2021, 2022, 2023, 2024) — that IS the version history (INT-04) and the side-by-side comparison-over-time data (INT-05). **No RUT/RUN/cédula predicate exists anywhere in the dataset** (verified by a CONTAINS filter over all predicates → zero results), so the declarante cross to the master is **by normalized name only** (exactly the Phase-11 sujeto-pasivo path), there is no third-party RUT to store, and minimization (Ley 21.719) is satisfied by the source itself. Family members appear as `Persona` with relationship predicates (`esConyugeDe`, `esHijoDe`, …) — third-party PII to keep deny-by-default.

The CSV catalogs (`datos.cplt.cl/catalogos/infoprobidad/csv*` — `csvdeclaraciones`, `csvbienInmueble`, `csvbienMueble`, `csvactividades`, `csvaccionDerecho`, `csvvalor`, `csvpasivo`) exist and are the documented "preferente" path, but they are **large full-dataset exports that timed out on bounded fetches** (40-90s, zero bytes returned). For a per-parlamentario civic view over ~186 legislators, **targeted SPARQL queries by normalized name are the practical primary path**; the CSV bulk path is the fallback / full-backfill path (run via the GitHub Actions escape hatch, never inside an Edge Function time limit).

**Primary recommendation:** Build `@obs/probidad` as an `@obs/lobby`-shaped package that fetches declarations through `@obs/ingest` in the LOCKED order (SPARQL GET against `datos.cplt.cl/sparql`, targeted per-declarante by normalized name), parses the SPARQL JSON literally with `zod` into a versioned `Declaracion` model keyed by the source declaration URI/`identificadorFuente` + `fechaDeclaracion`, reconciles the declarante name against the parlamentario master via `correrPipeline` (FK set only on `determinista`/`confirmado` through `EnlaceConfirmado`; everything else → NULL + raw mención), persists into a versioned `declaracion` table (public-read non-sensitive) + a deny-by-default `declaracion_familiar` (third-party PII) + asset sub-tables under the 0021 deny-by-default convention (with explicit revoke), and renders a self-contained `<section id="patrimonio">` with a **version history** (each version a dated row, `fechaDeclaracion` prominent, amber freshness badge, old NEVER labeled current) and a **side-by-side comparison view (data only, ZERO verdict/delta field)**. Use **blocking-drift** for this PII source (quarantine, never silent degradation). Use a **bounded LIVE run that degrades to a fixture (never fabricates)** if the SPARQL endpoint is unreachable. **No LLM in this phase** — but if a future free-text field ever needs extraction, it MUST route through `assertPiiDocumentSafeForLlm` (no RUT/PII to LLM, no-training tier).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch InfoProbidad declarations (SPARQL/CSV, rate-limited, robots, SSRF) | API/Ingest (`@obs/ingest` policy, Deno) | — | Server-only; gov source + minimization posture forbid browser fetch. Reuses LOCKED order. `cplt.cl`/`infoprobidad.cl` already allowlisted. |
| Parse SPARQL JSON / CSV → `Declaracion[]` (literal, zod) | API/Ingest (`@obs/probidad` parser, `zod`) | — | Pure parsing of STRUCTURED data; **no LLM**. Mirrors `parse-leylobby`. |
| Reconcile declarante name → `parlamentario_id` | Identity (`@obs/adjudication` `correrPipeline`, `@obs/identity` `EnlaceConfirmado`) | — | Single reconciliation choke point; only `determinista`/`confirmado` mints a FK. Name-only (no RUT in source). |
| Persist versioned declarations + asset sub-entities + family | Database/Storage (`SupabaseProbidadWriter`, service role) | — | Idempotent upsert by natural key (declaration id + fecha); **never overwrite** an old version; family deny-by-default; raw to R2. |
| Version history read (ficha) | Frontend Server (Next.js Server Component) | Database (public-read RPC) | anon reads only non-sensitive published fields via security-definer RPC; family/sensitive columns never reach client. |
| Side-by-side comparison (data only) | Frontend Server | Database (RPC) | Returns N dated versions; UI lays them side-by-side; ZERO verdict/delta field computed. |
| Anti-insinuation lane + content gate (incl. comparison) | Frontend Server | — | Own `<section id="patrimonio">`; gate extends to the comparison view (Phase-11 §9.1 lesson). |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@obs/ingest` | workspace (locked) | Rate-limit 2-3s + robots + SSRF allowlist + R2 raw + drift | `[VERIFIED: packages/ingest/src/allowlist.ts]` `cplt.cl` + `infoprobidad.cl` already in `DEFAULT_ALLOWED_SUFFIXES`. Reuse in LOCKED order (`assertAllowedUrl → robots.isAllowed → rateLimiter.wait → fetcher.get`), NOT `BaseConnector.run`. |
| `zod` | 3.x/4.x (locked) | Validate parsed SPARQL-JSON / CSV declaration rows before write | `[CITED: CLAUDE.md]` Contract-validation gate, same as `LobbyAudienciaSchema`. The structured content is parsed literally and validated — the LITERAL-fidelity guard for free text (golden gate) is **not needed** because there is no free-text extraction. |
| `@obs/adjudication` `correrPipeline` | workspace (locked) | Reconcile the declarante name → parlamentario master | `[VERIFIED: packages/lobby/src/reconciliar-sujeto.ts]` Single reconciliation entry; deterministic resolution short-circuits before the LLM (0 calls). Name-only (no RUT in source). |
| `@obs/identity` `confirmar` / `EnlaceConfirmado` / `normalizarNombre` | workspace (locked) | Typed writer invariant + name normalization | `[VERIFIED: 09-01-SUMMARY; affects list names phase-12-probidad]` A raw-string FK is a compile error. Names in the source carry leading tabs / double spaces (`"\tSANDRA MARCELA CHACON  SALAZAR"`) → `normalizarNombre` MUST be applied; golden set extended with InfoProbidad name forms. |
| `@supabase/supabase-js` v2 | locked | `SupabaseProbidadWriter` (service role, bypass RLS, server-only) | `[VERIFIED: writer-supabase.ts]` Mirror `SupabaseLobbyWriter`: `upsert(..., { onConflict })` by natural key, dedupe-before-batch. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `jsr:@std/csv` | latest (Deno std) | Parse the InfoProbidad CSV catalogs IF the bulk/backfill path is used | `[CITED: STACK.md]` Only for the CSV fallback / full backfill. Zero-dep, Deno-native. The SPARQL JSON path needs no CSV parser at all. Prefer this over a Node-heavy CSV framework. |
| `@obs/llm` `assertPiiDocumentSafeForLlm` | workspace (locked) | Gate IF any future task adds LLM extraction of a free-text field | `[VERIFIED: packages/llm/src/data-routing.ts]` **Phase 12 needs NO LLM** (content is structured RDF/CSV). This is documented as the mandatory path only for a hypothetical future free-text/PDF field; it is NOT wired in this phase. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Targeted SPARQL by name (primary) | CSV bulk catalogs (`csvdeclaraciones` etc.) | **CSV is the documented "preferente" but impractical for the per-parlamentario view:** the full-dataset CSV exports timed out on bounded fetches (40-90s, 0 bytes). Use CSV only for a full backfill via GitHub Actions (no Edge time limit). For ~186 legislators, per-name SPARQL is far cheaper and respects the 2-3s discipline. Keep the parser isolated so a CSV path can be added. |
| Literal zod parse (no LLM) | LLM literal-extraction via `@obs/fichas` pattern | **REJECTED:** the source is fully structured RDF/CSV (confirmed via SPARQL — `Declaracion`/`Persona` with typed properties + asset sub-classes). An LLM would add cost, a training-data risk, and the golden-fidelity gate for **zero benefit**. The CONTEXT decision explicitly says "si viene estructurada → zod, SIN LLM" — and it does. |
| New `@obs/probidad` package | fold into `@obs/lobby` | **REJECTED:** different source, different (versioned) model, different RLS posture. A separate package keeps boundaries clean (mirror `@obs/lobby` file-for-file). |
| `correrPipeline` name cross | RUT join | **N/A — the source has no RUT.** Verified zero RUT/RUN/cédula predicates. Name-only cross via `correrPipeline` is the only path (and the safe one). |

**Installation:** None. No new external dependencies. (`zod`, `@supabase/supabase-js`, all `@obs/*` packages present; `jsr:@std/csv` is a Deno std import if the CSV fallback is built.)

**Version verification:** Phase 12 adds **zero npm packages**. The only potential new import is `jsr:@std/csv` (Deno standard library — no registry slop risk; ships with Deno). No `npm view` needed.

## Package Legitimacy Audit

> Phase 12 installs **no external packages.** Every dependency is a locked v1.0 library already in the lockfile, a workspace `@obs/*` package, or the Deno standard library (`jsr:@std/csv`, only if the CSV fallback is built).

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | — | — | — | — | — | No external installs in this phase |
| `jsr:@std/csv` | JSR (Deno std) | mature | — | github.com/denoland/std | n/a (first-party) | Optional, only for CSV fallback |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## InfoProbidad Access (re-validated LIVE 2026-06-19)

> This is the research-gated deliverable. All probes used a 2-3s-discipline single request with an identifying UA, from the execution environment.

### Verdict: content is STRUCTURED (RDF/CSV) → literal zod parse, NO LLM. SPARQL is the practical primary path; CSV is the bulk/backfill fallback.

| Endpoint | Result (2026-06-19) | Disposition |
|----------|---------------------|-------------|
| `https://datos.cplt.cl/sparql` | **HTTP 200**, returns `application/sparql-results+json`, answered queries (Virtuoso-style endpoint) | `[VERIFIED: curl SPARQL queries]` **The practical primary path.** GET with `?query=` URL-encoded; `Accept: application/sparql-results+json`. |
| `https://www.infoprobidad.cl/DatosAbiertos/Catalogos` | HTTP 200; lists 7 CSV catalogs | `[VERIFIED: WebFetch]` Documents the CSV download URLs + weekly update cadence (martes/viernes). |
| `https://datos.cplt.cl/catalogos/infoprobidad/csvdeclaraciones` | HTTP request **timed out** (40-90s, 0 bytes on bounded fetch) | `[VERIFIED: curl, exit 28]` Full-dataset export — too large for a bounded Edge fetch. **Backfill-only path (GitHub Actions).** |
| `https://www.infoprobidad.cl/DatosAbiertos/Ontologia` | HTTP 200; RDF/OWL ontology | `[VERIFIED: WebFetch]` Confirms structured model (classes + typed properties), not free text. |
| `https://www.infoprobidad.cl/Home/Listado` | HTTP 200 (per-declaration UI listing) | `[VERIFIED: curl 200]` Human listing; the machine path is SPARQL/CSV, not scraping this. |
| `https://www.infoprobidad.cl/` | HTTP 200 | `[VERIFIED: curl]` Live. |

**License:** **CC BY 4.0** — "Creative Commons Atribución 4.0 International (CC BY 4.0)", link `https://creativecommons.org/licenses/by/4.0/`, shown on the Datos Abiertos page. `[VERIFIED: WebFetch]` Attribution MUST be visible on every view, including the derived comparison view (CONTEXT decision; PITFALLS D4).

**Allowlist:** `cplt.cl` and `infoprobidad.cl` are **already in `DEFAULT_ALLOWED_SUFFIXES`** `[VERIFIED: packages/ingest/src/allowlist.ts lines 25-26]`. `datos.cplt.cl` matches the `cplt.cl` suffix. No allowlist change needed.

### The data model (verified via live SPARQL — this is what to parse)

**Class instance counts (live):** `Money` 1.1M, `BienInmueble` 302K, `Actividad` 283K, `Pasivo` 244K, **`Persona` 234K**, **`Declaracion` 170,562**, `Gravamenes` 126K, `AccionDerecho` 97K, `BienMueble` 74K, `Prohibiciones` 50K, `Entidad` 43K. `[VERIFIED: SPARQL class-count query]`

**`Declaracion` predicates (the version):** `[VERIFIED: SPARQL DISTINCT predicates]`
| Predicate | Maps to |
|-----------|---------|
| `ip:fechaDeclaracion` | **`fecha_presentacion`** — THE fecha de presentación; the version key + freshness anchor (INT-04). Sample values: `2020-12-31`, `2021-07-28`, `2022-03-30`, `2023-04-14`, `2024-03-13`, `2024-07-28` for one declarante. |
| `ip:tipoDeclaracion` | `tipo` (URI like `tipoDeclaracion_1..5` — initial/update/cese/etc.; resolve to a label) |
| `ip:declaracionDe` | declarante `Persona` (the cross-to-master subject) |
| `ip:poseeCargo` / `ip:organismoFuente` / `ip:comunaDesempenio` / `ip:paisDesempenio` | cargo / institución / location (published context) |
| `ip:fechaAsuncion` / `ip:fechaCeseCargo` | office dates |
| `ip:identificadorFuente` | source id (candidate natural key component) |
| `ip:tieneActividad` / `ip:tieneBien` / `ip:tieneValor` / `ip:tienePasivo` / `ip:tieneAccionDerecho` / `ip:tieneConcesion` / `ip:tieneAgua` / `ip:tieneOtraFuente` | links to the typed asset sub-entities |
| `ip:montoPasivoGlobal` / `ip:regimenPatrimonial` / `ip:estadoCivil` | declared scalar fields |

**`Persona` predicates (declarante + family):** `[VERIFIED: SPARQL DISTINCT predicates]`
| Predicate | Maps to |
|-----------|---------|
| `rdfs:label` | full name (carries leading `\t` + double-spaces → MUST `normalizarNombre`) |
| `ip:nombre` / `ip:apellidoPaterno` / `ip:apellidoMaterno` | name components (better cross than the noisy label) |
| `ip:declara` / `ip:declaradoEn` / `ip:URIDeclarante` | links Persona ↔ Declaracion |
| `ip:esConyugeDe` / `ip:esHijoDe` / `ip:esMadreDe` / `ip:esPadreDe` / `ip:esHermanoDe` / … | **family relationships → third-party PII** (deny-by-default; minimization) |
| `ip:fechaNacimiento` | DOB (third party — never public) |
| `ip:esCandidato` | candidate flag |

**CRITICAL FINDING — no RUT in the source:** A SPARQL `CONTAINS(LCASE(STR(?p)), 'rut'|'run'|'cedula'|'identif')` filter over ALL predicates returned **zero results**. `[VERIFIED: SPARQL filter query]` The dataset exposes NO national ID. Consequences:
1. The declarante cross to the parlamentario master is **by normalized name only**, via `correrPipeline` (exactly the Phase-11 sujeto-pasivo path) — `determinista` mints the FK, everything else → NULL + raw mención + IdentityMarker.
2. There is **no third-party RUT to store** — minimization (Ley 21.719) is satisfied by the source itself; the `assertNoRutInLlmInput` concern is moot for ingestion (no LLM anyway).
3. Homonym risk is real (PITFALLS A3): the golden set MUST be extended with InfoProbidad name forms before the connector ships (the ≥0.95 gate is the acceptance test).

### Versioning is native (INT-04 / INT-05 are mostly schema + read, not computation)

A single declarante (`Persona`) `ip:declara` many `Declaracion`s, each with a distinct `ip:fechaDeclaracion`. A live sample for one declarante returned declarations dated across 2020-2024. `[VERIFIED: SPARQL declarante→declaraciones query]` Therefore:
- **INT-04 (version history)** = store every `Declaracion` as its own dated row keyed by (declaration id, `fechaDeclaracion`); read ordered by date DESC; show `fechaDeclaracion` prominently with an amber freshness badge. **Never overwrite.**
- **INT-05 (side-by-side comparison)** = select N dated versions for one parlamentario and lay them side-by-side. **No delta is computed** — the UI shows version A's declared fields next to version B's declared fields; the citizen reads the difference. ZERO "enriquecimiento"/"conflicto" verdict, ZERO computed-with-judgment delta field.

## Architecture Patterns

### System Architecture Diagram

```
                 pg_cron (schedule, existing lane)
                        │  encola tareas (un declarante/lote por mensaje)
                        ▼
                 pgmq  ──read(vis=backoff)──►  Edge Fn worker (Deno)  [or GitHub Actions for CSV backfill]
                                                      │ ensambla @obs/probidad con colaboradores reales
                                                      ▼
   ┌──────────────────── @obs/probidad connector ──────────────────────┐
   │ for each declarante (by normalized name / lote):                   │
   │   assertAllowedUrl(sparqlUrl) → robots.isAllowed → rateLimiter.wait │   LOCKED order
   │     → fetcher.get(SPARQL GET ?query=…)  → R2 raw (immutable)        │   (NOT BaseConnector.run)
   │     → DriftDetector (BLOCKING for this PII source)                  │
   │     → parseDeclaraciones(sparqlJson)  (zod, LITERAL, no LLM)        │
   └───────────────┬────────────────────────────────────────────────────┘
                   │  Declaracion[] (sourceId, fechaPresentacion, tipo, cargo, bienes[], familia[])
                   ▼
        reconciliarDeclarante(declaraciones, maestra, provider, writer)
           │  declarante name → correrPipeline → ResultadoPipeline
           │     determinista → confirmar(id) : EnlaceConfirmado          ── identidad_audit row
           │     probable/revision/no_confirmado → null + raw mención
                   ▼
        SupabaseProbidadWriter (service role, idempotent upsert, NEVER overwrite a version)
           │  declaracion           onConflict 'fuente_id,fecha_presentacion'  (versioned)
           │  declaracion_bien/...   onConflict natural key (asset sub-rows)
           │  declaracion_familiar   deny-by-default (third-party PII)
                   ▼
        Supabase Postgres  (declaracion public-read RPC; familiar deny-by-default)
                   ▲
                   │  anon reads via RPC declaraciones_de_parlamentario(p_id) + comparar_declaraciones(p_id, fechas[])
        Next.js Server Component  →  <section id="patrimonio">
                                       ├─ historial de versiones (fecha prominente + amber)
                                       └─ comparación lado-a-lado (datos, CERO veredicto)
```

### Recommended Project Structure (mirror `@obs/lobby`)
```
packages/probidad/src/
├── model.ts                  # Declaracion + DeclaracionBien/Actividad/... + DeclaracionFamiliar + zod schemas + ProvenanceInline
├── connector-infoprobidad.ts # SPARQL GET in LOCKED order (mirror connector-leylobby.ts); + optional CSV path
├── sparql.ts                 # query builders (per-declarante by name) + SPARQL-JSON → rows (pure)
├── parse-infoprobidad.ts     # SPARQL-JSON/CSV → Declaracion[] (zod, LITERAL, no LLM) (mirror parse-leylobby.ts)
├── reconciliar-declarante.ts # declarante name → correrPipeline → EnlaceConfirmado (mirror reconciliar-sujeto.ts)
├── writer.ts                 # ProbidadWriter interface + InMemoryProbidadWriter
├── writer-supabase.ts        # SupabaseProbidadWriter (mirror writer-supabase.ts; NEVER overwrite a version)
├── ingest-run.ts             # orchestration; BLOCKING drift; honest degrade; no fabrication (mirror ingest-run.ts)
├── ingest-cli.ts             # bounded LIVE run / fixture fallback (mirror ingest-cli.ts)
├── live-infoprobidad.probe.ts# bounded live SPARQL probe (mirror live-leylobby.probe.ts)
└── index.ts                  # barrel
```

### Pattern 1: Reuse `@obs/ingest` policy in the LOCKED order (NOT `BaseConnector.run`)
**What:** Fetch each SPARQL request through `assertAllowedUrl → robots.isAllowed → rateLimiter.wait(host) → fetcher.get`, exactly as `connector-leylobby.ts` does.
**When to use:** Every fetch in this phase.
**Example:**
```typescript
// Source: packages/lobby/src/connector-leylobby.ts (VERIFIED — mirror it)
private async fetch(url: string): Promise<string> {
  const parsed = assertAllowedUrl(url, this.deps.allowlist);     // SSRF + allowlist (cplt.cl ✓)
  if (!(await this.deps.robots.isAllowed(url))) throw new RobotsDisallowError(url);
  await this.deps.rateLimiter.wait(parsed.host);                 // 2-3s serial per host
  const body = await this.deps.fetcher.get({ url, headers: { Accept: "application/sparql-results+json" } });
  return new TextDecoder().decode(body);
}
// SPARQL GET: `${BASE}/sparql?query=${encodeURIComponent(q)}` (the endpoint answered GET 2026-06-19)
```

### Pattern 2: Single reconciliation choke point mints the typed FK (name-only)
**What:** Only `reconciliar-declarante.ts` calls `confirmar()`. `determinista` → `confirmar(id, "determinista")` + `estado_vinculo: "confirmado"`; everything else → `enlace: null` + raw `mencion_declarante`.
**When to use:** The declarante cross.
**Example:** Mirror `reconciliar-sujeto.ts` `[VERIFIED]` — the no-RUT source makes this identical to the lobby sujeto-pasivo path (name → `normalizarNombre` → `correrPipeline`; deterministas short-circuit before the LLM with 0 calls; absent provider degrades a homonym to `no_confirmado`, never fabricates).

### Pattern 3: Versioned idempotent writer — NEVER overwrite a version
**What:** `declaracion` is keyed by `(fuente_id, fecha_presentacion)` (or the declaration URI). Re-running ingest upserts the SAME version row (idempotent); a NEW `fechaDeclaracion` is a NEW row. An old version row is never updated to look current and never deleted.
**When to use:** All declaration writes.
**Example:** Mirror `SupabaseLobbyWriter` (`dedupePorClave` + `chunk` + `upsert({ onConflict })`) `[VERIFIED]`, but the conflict key includes `fecha_presentacion` so versions accumulate rather than collapse.

### Anti-Patterns to Avoid
- **Overwriting / upserting a declaration on the declarante key alone** (collapsing versions) — destroys the history (INT-04) and risks showing an old declaration as current. Version key MUST include `fecha_presentacion`. `[VERIFIED: versioning is native]`
- **Computing a delta/"enriquecimiento"/"conflicto" field** in the comparison — LOCKED prohibition; PITFALLS B3 / E2; the content gate (§9.1) extends to the comparison view.
- **Composing a declaration next to a vote/lobby/contract as one UI unit** — anti-insinuation rule; own lane only.
- **Setting `parlamentario_id` from a raw name string** — compile error by the Phase-9 invariant; route through `confirmar()` only on determinista.
- **Storing or exposing family-member data publicly** — third-party PII; deny-by-default table + never in the public RPC projection (Ley 21.719; PITFALLS D2).
- **Non-blocking drift** — PITFALLS C4: a silent SPARQL/parse break on a PII source emits empty/garbage that reads as "no declara". Use blocking drift here (mirror `@obs/lobby` `ingest-run.ts`).
- **Using an LLM** — content is structured; an LLM adds cost + a training-data PII risk for zero benefit. If a future free-text field appears, route through `assertPiiDocumentSafeForLlm` first.
- **`BaseConnector.run`** — its daily cache would skip re-runs; forbidden for these connectors. `[VERIFIED: connector-leylobby.ts header]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate-limit / robots / SSRF / R2 / drift | A bespoke fetch loop | `@obs/ingest` collaborators in LOCKED order | Policy applied once, verified; `cplt.cl`/`infoprobidad.cl` already allowlisted. |
| Name reconciliation | A `JOIN ON nombre` | `correrPipeline` + `EnlaceConfirmado` | A naive name join silently fabricates attributions (PITFALLS A1/A3); the guard is the spine. No RUT in source → name-only is the only path. |
| PII RLS posture (family, sensitive) | A new RLS scheme | Copy 0021/0018 deny-by-default **+ explicit `revoke all from anon, authenticated`** | `[VERIFIED: 11-01-SUMMARY]` The Phase-11 lesson: RLS-on alone leaves the inherited default-privilege grant; you MUST revoke it. pgTAP template exists. |
| Idempotent versioned upsert | Insert + manual existence check | `upsert({ onConflict: 'fuente_id,fecha_presentacion' })` | Mirror `SupabaseLobbyWriter`; conflict key includes the date so versions accumulate. |
| Typed FK guard | A runtime `if (confirmado)` check only | `EnlaceConfirmado` branded type | `[VERIFIED: 09-01-SUMMARY]` A raw-string FK is a compile error. |
| Name normalization | A new normalizer | `normalizarNombre` (extend golden set) | InfoProbidad names carry `\t` + double-spaces; reuse + extend goldens; the ≥0.95 gate is the acceptance test. |
| SPARQL-JSON parsing | A custom RDF lib | Native `JSON.parse` + zod over `results.bindings` | The endpoint returns plain `application/sparql-results+json`; no RDF library needed. |
| CSV parsing (fallback only) | A Node-heavy CSV framework | `jsr:@std/csv` | Zero-dep, Deno-native; only for the backfill path. |

**Key insight:** Phase 12 is overwhelmingly *assembly* of shipped parts plus a versioned schema. The genuinely new code is: the SPARQL query builders + JSON→rows parser (one structured shape), the versioned table DDLs + asset sub-tables, two RPCs (history + comparison), and one React section with a comparison sub-view. **No LLM, no new dependency.**

## Data Model (migration ≥0022)

> Last applied migration is **0021** `[VERIFIED: migrations dir — 0021_lobby.sql present]`. New migration ≥ 0022. Follows the 0021/0018 deny-by-default convention **including the explicit `revoke all from anon, authenticated`** on every PII table. **Authoring the DDL and applying it + pgTAP are SEPARATE tasks** (Pitfall 5 / 09-03 convention); the remote sa-east-1 pooler applied 0018/0019/0020/0021 successfully, so a remote apply is feasible. Exact column names are Claude's Discretion; the keying + RLS rules below are not.

### `declaracion` — public-read, VERSIONED (the published declaration fact)
```sql
create table declaracion (
  -- Natural key includes the date → VERSIONS ACCUMULATE (never overwrite). Mirror: the
  -- source declaration URI / identificadorFuente + fechaDeclaracion identify one version.
  fuente_id          text not null,            -- ip:identificadorFuente / declaration URI
  fecha_presentacion date not null,            -- ip:fechaDeclaracion — THE fecha de presentación (INT-03/04)
  -- declarante (the official): FK SOLO si enlace confirmado/determinista (IDENT-12)
  parlamentario_id   text references parlamentario(id) on delete set null,  -- nullable
  mencion_declarante text not null,            -- raw declarante name as published
  estado_vinculo     text,                     -- 'confirmado' | 'no_confirmado' | null
  tipo               text,                     -- ip:tipoDeclaracion (resolved label)
  cargo              text,                     -- ip:poseeCargo (raw, published)
  organismo          text,                     -- ip:organismoFuente (raw, published)
  -- provenance inline NOT NULL (FND-08) + CC BY 4.0 attribution carried per row (PITFALLS D4)
  origen             text not null,            -- "infoprobidad-sparql"
  licencia           text not null default 'CC BY 4.0',  -- attribution travels with the data
  fecha_captura      timestamptz not null default now(),
  enlace             text not null,            -- the source URL / declaration link
  primary key (fuente_id, fecha_presentacion)  -- the version key
);
alter table declaracion enable row level security;
create policy declaracion_public_read on declaracion for select to anon using (true);
grant select on declaracion to anon;
create index declaracion_parlamentario_idx on declaracion (parlamentario_id);
```
> **Why public-read:** the declaration fact (date, type, cargo, organismo, the declared scalar fields the source already publishes) is open data (CC BY 4.0). anon must read it or the ficha is blank. **Asset sub-tables** (`declaracion_bien_inmueble`, `_bien_mueble`, `_actividad`, `_pasivo`, `_accion_derecho`, …) hang off `(fuente_id, fecha_presentacion)` and are also public-read (they are the published declaration content). Keep each asset row literal (no computed values).

### `declaracion_familiar` — deny-by-default (third-party PII)
```sql
-- Family members declared (cónyuge, hijos, …). THIRD-PARTY PRIVATE persons (Ley 21.719).
-- Copies 0021's deny-by-default VERBATIM: RLS on, ZERO policies, + explicit REVOKE.
create table declaracion_familiar (
  id                 bigint generated always as identity primary key,
  fuente_id          text not null,
  fecha_presentacion date not null,
  relacion           text,                     -- esConyugeDe / esHijoDe / … (raw)
  nombre             text,                     -- raw (third party) — internal use
  origen             text not null,
  fecha_captura      timestamptz not null default now(),
  enlace             text not null,
  foreign key (fuente_id, fecha_presentacion) references declaracion(fuente_id, fecha_presentacion) on delete cascade
);
alter table declaracion_familiar enable row level security;
-- (intentionally NO policy; intentionally NO grant) + the Phase-11 lesson:
revoke all on declaracion_familiar from anon, authenticated;   -- closes the inherited default-privilege grant (LEGAL-03)
```
> **Why deny-by-default + revoke:** family members are private third parties with no public-function justification (PITFALLS D2). The source has no RUT, so no third-party RUT is stored — but the family table is still PII and must never reach anon. The Phase-11 pgTAP caught that RLS-on alone leaves the inherited grant; the explicit `revoke` is mandatory.

**Keying summary:**

| Entity | Natural/PK key | Cross to parlamentario | FK set when |
|--------|----------------|------------------------|-------------|
| `declaracion` | `(fuente_id, fecha_presentacion)` — VERSIONED | declarante name → `correrPipeline` (name-only) | only `determinista`/`confirmado` (else NULL + `mencion_declarante` raw) |
| `declaracion_bien_*` / `_actividad` / `_pasivo` / … | `(fuente_id, fecha_presentacion, <row natural key>)` | via the parent declaration | inherits parent |
| `declaracion_familiar` | surrogate + FK to version | **none** (third party) | never to `parlamentario` |

### Read RPCs (public, security definer over the deny-by-default surface)
Mirror `lobby_de_parlamentario` `[VERIFIED: 0021_lobby.sql]` (`language sql stable security definer set search_path = ''`, `revoke execute from public` + `grant execute to anon`, returns ONLY source-published fields, only for `parlamentario_id = p_id`).

1. **`declaraciones_de_parlamentario(p_id)`** — version history: every `declaracion` row for the confirmed-linked parlamentario, **ordered by `fecha_presentacion` DESC**, joined to its asset sub-rows. Returns NO family data, NO internal ids. This feeds the history list (INT-04).
2. **`comparar_declaraciones(p_id, fechas[])`** (or the UI selects two from the history RPC) — returns the declared fields of the requested versions side-by-side. **Returns raw declared values only — NO delta, NO verdict column.** This feeds the comparison view (INT-05).
3. **`probidad_ingesta_estado`** marker (mirror `lobby_ingesta_estado`) — public-read `(parlamentario_id, ingestado_hasta)` so the ficha distinguishes "not ingested" (row absent) from "ingested, zero declarations" (row present). Resolves the same honest-empty gap.

## Comparison View (INT-05) — data only, ZERO verdict

- The comparison is a **layout**, not a computation. Two (or N) dated versions are placed side-by-side; each shows the values the source published at that `fecha_presentacion`. The citizen reads any change.
- **NO computed field:** no `delta_patrimonio`, no `variacion`, no `enriquecimiento`, no `conflicto`, no highlight that asserts "increased". A neutral count (e.g. "3 versiones declaradas") is the only aggregate permitted.
- **The content gate extends to the comparison view.** Phase 11's UI review flagged that ungoverned prose (`representado`/free text) can leak insinuation; the comparison view is a *derived* view and is exactly where a delta verdict would sneak in. The §9.1 gate (no causal/affinity/score/verdict language; no "aumentó/enriqueció/conflicto") applies to the comparison view as a RELEASE GATE, identical to the lobby section.
- **CC BY 4.0 attribution is visible on the comparison view too** (PITFALLS D4 / CONTEXT: "incluso en vistas derivadas").
- **Freshness on every version:** each column shows its `fecha_presentacion` prominently with the amber freshness badge; the most recent is NOT labeled "current/actual" as a verdict — it is labeled with its date. An old version is never rendered as the present state (PITFALLS E2).

## Common Pitfalls

### Pitfall 1: Collapsing versions (overwrite on declarante key)
**What goes wrong:** Keying `declaracion` on the declarante alone → a new declaration overwrites the old → the history (INT-04) is destroyed and an old declaration can be shown as current.
**How to avoid:** Version key = `(fuente_id, fecha_presentacion)`. Upsert is idempotent per version; a new date is a new row. Never delete/overwrite an old version. `[VERIFIED: versioning is native in source]`
**Warning signs:** One row per declarante; the history shows only the latest; row counts don't grow when a new declaration is filed.

### Pitfall 2: A computed "enriquecimiento"/"conflicto"/delta field (PITFALLS B3/E2)
**What goes wrong:** The comparison view computes or labels a patrimony change → converts a transparency record into an accusation; inverts the legal posture; violates the rector rule.
**How to avoid:** Comparison is layout-only; ZERO verdict/delta column. Content gate (§9.1) extends to the comparison view. Ban "aumentó/enriqueció/conflicto/varió" copy.
**Warning signs:** A `delta`/`variacion`/`enriquecimiento` column; a highlight asserting an increase; "conflicto de interés" anywhere.

### Pitfall 3: Stale declaration presented as current (PITFALLS E2)
**What goes wrong:** An old declaration rendered without a prominent date reads as today's patrimony.
**How to avoid:** `fecha_presentacion` prominent on every version + amber freshness badge (reuse `ProvenanceBadge`). Never aggregate across periods into one "patrimonio" figure without the as-of date. The most-recent is labeled by its date, not asserted as "actual".
**Warning signs:** A declaration with no visible filing date; a single patrimony number with no as-of; missing freshness badge.

### Pitfall 4: Family / third-party PII leaking to anon (PITFALLS D2)
**What goes wrong:** Family members (cónyuge, hijos) exposed publicly, or reachable because RLS-on left the inherited default-privilege grant (the Phase-11 bug).
**How to avoid:** `declaracion_familiar` deny-by-default **+ explicit `revoke all from anon, authenticated`**; never in the public RPC projection; pgTAP asserts zero policies AND no anon grant. `[VERIFIED: 11-01-SUMMARY deviation]`
**Warning signs:** Family rows readable by `set role anon`; a public RPC returning a `nombre` of a relative.

### Pitfall 5: Silent SPARQL/parse break on a PII source (PITFALLS C4)
**What goes wrong:** CPLT changes the ontology/endpoint; the parser emits zero/garbage; non-blocking drift lets the run "succeed" with empty data → reads as "no declara".
**How to avoid:** **Blocking drift** for `@obs/probidad` (mirror `@obs/lobby` `ingest-run.ts`); pin the parser to a captured SPARQL-JSON fixture + golden-test it; quarantine on structural drift (0 rows + degradación), never fabricate.
**Warning signs:** Row counts collapse to zero after a CPLT change; drift alerts repeating.

### Pitfall 6: Migration authored but not applied; `.env` BOM (Pitfall 5 carried)
**What goes wrong:** DDL passes typecheck but Postgres never ran it; or a BOM in `.env` breaks the remote pooler connection used to apply + pgTAP.
**How to avoid:** Separate "author DDL" from "apply + pgTAP" tasks; extract `SUPABASE_DB_URL` with node (skipping the BOM) and apply via `psql --single-transaction --db-url`, then run pgTAP against the APPLIED schema (the 0018-0021 path, all applied successfully to remote sa-east-1). `[VERIFIED: 09-03 + 11-01 SUMMARYs]`

## Code Examples

### Targeted SPARQL by declarante name (the practical primary path)
```sparql
# Source: VERIFIED live against https://datos.cplt.cl/sparql (2026-06-19)
PREFIX ip:   <http://datos.cplt.cl/ontologias/infoprobidad/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?decl ?fecha ?tipo ?cargo ?organismo WHERE {
  ?p   a ip:Persona ; rdfs:label ?label ; ip:declara ?decl .
  ?decl ip:fechaDeclaracion ?fecha .
  OPTIONAL { ?decl ip:tipoDeclaracion ?tipo }
  OPTIONAL { ?decl ip:poseeCargo ?cargo }
  OPTIONAL { ?decl ip:organismoFuente ?organismo }
  FILTER( CONTAINS(LCASE(STR(?label)), "<apellido normalizado>") )
}
ORDER BY DESC(?fecha)
```
Fetch via `@obs/ingest` LOCKED order: `${BASE}/sparql?query=${encodeURIComponent(q)}`, `Accept: application/sparql-results+json`. Parse `results.bindings` with zod. The name FILTER is a coarse candidate fetch; the AUTHORITATIVE cross is `correrPipeline` over the full master (deterministic-only mints the FK).

### Reconcile only the declarante; family passes through deny-by-default
```typescript
// Source: mirror of packages/lobby/src/reconciliar-sujeto.ts (VERIFIED)
for (const decl of declaraciones) {
  const mencion = toMencion(decl.declaranteNombre, "infoprobidad", PERIODO);   // normalizarNombre inside
  const res = await correrPipeline(mencion, maestra, provider, writer);
  const enlace = res.tipo === "determinista" ? confirmar(res.parlamentarioId, "determinista") : null;
  // family → deny-by-default rows, NO reconciliation, NO link to a person
  out.push({ fuenteId: decl.fuenteId, fechaPresentacion: decl.fecha, enlace,
             mencionDeclarante: decl.declaranteNombre, /* assets…, familia… */ });
}
```

## Runtime State Inventory

> Phase 12 is **greenfield ingestion + additive schema** — it creates new tables and a new package; it does not rename or migrate existing runtime state. Categories verified as not-applicable.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — new tables only (`declaracion`, `declaracion_*`, `declaracion_familiar`, `probidad_ingesta_estado`); no existing keys renamed. | none |
| Live service config | None — reuses existing pg_cron/pgmq lane; a new job kind is *added* to the dispatch (additive), not a rename. | add dispatch arm (additive) |
| OS-registered state | None. | none |
| Secrets/env vars | None new — reuses `SUPABASE_DB_URL` / service key / R2 already in `.env`. No InfoProbidad API key (SPARQL is open). | none |
| Build artifacts | New `packages/probidad` workspace package → a `pnpm install`/build registers it; no stale artifact from a rename. | `pnpm install` after package scaffold |

**Nothing found requiring a data migration of existing rows** — all writes are to brand-new tables.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v2.0 STACK assumed "CSV catalogs preferente; SPARQL optional; route LLM extraction through gates" | **SPARQL is the practical primary (CSV too large for bounded fetch); content is STRUCTURED → literal zod, NO LLM** | re-validated LIVE 2026-06-19 | Connector parses SPARQL JSON literally; no LLM, no golden-fidelity gate; CSV is backfill-only. |
| PII RLS = RLS-on + zero policies | RLS-on + zero policies **+ explicit `revoke all from anon, authenticated`** | Phase 11 (11-01 deviation) | `declaracion_familiar` copies the corrected pattern; pgTAP asserts no anon grant. |
| Identity guard as runtime convention | Typed `EnlaceConfirmado` invariant (IDENT-12) | Phase 9 | `@obs/probidad` reuses it; raw-string FK is a compile error. |

**Deprecated/outdated:**
- Assuming an LLM extraction step for declarations: **not needed** — content is structured RDF/CSV.
- Treating the CSV bulk catalogs as the per-parlamentario path: **impractical** (full-dataset exports time out); SPARQL per-name is the path, CSV is backfill via GitHub Actions.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ip:identificadorFuente` (or the declaration URI) + `ip:fechaDeclaracion` form a stable, unique version key. | Data Model | LOW-MEDIUM — if `identificadorFuente` is not unique per version, key on the declaration node URI instead (also available). Confirm by a one-line SPARQL at plan time. |
| A2 | A coarse SPARQL name FILTER returns a manageable candidate set per parlamentario within the 2-3s discipline (the endpoint answered sub-second on count/sample queries). | InfoProbidad Access | LOW — if a name FILTER is too slow over 234K Personas, query by `ip:apellidoPaterno`/`ip:nombre` (indexed-ish literal match) or fall back to the CSV backfill. Endpoint responsiveness verified on count/sample queries. |
| A3 | Asset sub-entities (`BienInmueble`, `Actividad`, `Pasivo`, …) link to the `Declaracion` via the `ip:tieneBien`/`ip:tieneActividad`/… predicates and carry literal published fields (no computed values). | Data Model | MEDIUM — exact sub-entity property names not enumerated this session (only the linking predicates verified). Plan task: enumerate one `BienInmueble`/`Actividad` instance's predicates before finalizing the asset sub-table columns. |
| A4 | The remote sa-east-1 pooler is reachable to apply migration ≥0022 + pgTAP (as for 0018-0021). | Data Model | LOW — if not, the apply becomes a deferred operator checkpoint (the 09-03/11-01 split handles this). |
| A5 | A bounded LIVE SPARQL run can reach `datos.cplt.cl` from the execution environment within the 2-3s discipline. | Validation Architecture | LOW — verified reachable 2026-06-19; if unreachable at run time, degrade to a fixture + `human_verification` marker; never fabricate. |
| A6 | `tipoDeclaracion_1..5` resolve to human labels (inicial/actualización/cese/…) somewhere in the dataset. | Data Model | LOW — store the raw tipo URI verbatim if no label is found (never fabricate a label); resolve at plan time via a `tipoDeclaracion ?label` query. |

## Open Questions

1. **Exact stable version key (`identificadorFuente` vs declaration URI).**
   - What we know: both `ip:identificadorFuente` and the declaration node URI exist; `ip:fechaDeclaracion` is the date. `[VERIFIED]`
   - What's unclear: whether `identificadorFuente` is unique per version (a declarante can file two declarations close in time — the sample showed two 2024 declarations weeks apart).
   - Recommendation: a one-line SPARQL at plan time confirms uniqueness; default to keying on the declaration URI + `fechaDeclaracion` if `identificadorFuente` collides.

2. **Asset sub-entity property layout.**
   - What we know: the linking predicates (`tieneBien`, `tieneActividad`, `tienePasivo`, …) and the asset classes + counts. `[VERIFIED]`
   - What's unclear: the literal property names inside `BienInmueble`/`Actividad`/`Pasivo`/… (e.g. avalúo, dirección, tipo de actividad).
   - Recommendation: a plan task enumerates one instance per asset class via SPARQL and pins the asset sub-table columns + a fixture. Keep them literal (no computed values).

3. **`tipoDeclaracion` label resolution.**
   - What we know: `tipoDeclaracion` is a URI (`tipoDeclaracion_1..5`).
   - What's unclear: the human label per type.
   - Recommendation: resolve via SPARQL (`?tipo rdfs:label ?l`) at plan time; store the raw URI if no label exists (never fabricate).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `datos.cplt.cl/sparql` (SPARQL) | INT-03 ingest (primary) | ✓ (HTTP 200, queried live 2026-06-19) | Virtuoso-style | CSV catalogs (backfill via GitHub Actions); else fixture + `human_verification` (never fabricate) |
| `datos.cplt.cl/catalogos/infoprobidad/csv*` (CSV) | full backfill (fallback) | ✓ exists but **times out on bounded fetch** | — | SPARQL per-name (the practical path) |
| `infoprobidad.cl` (license/ontology pages) | CC BY 4.0 attribution + ontology reference | ✓ (HTTP 200) | — | — |
| Supabase remote sa-east-1 pooler | apply migration ≥0022 + pgTAP | ✓ (0018-0021 applied there) | PG15 | Defer apply to operator checkpoint |
| `zod`, `@supabase/supabase-js`, `@obs/*` | connector/parser/writer | ✓ (in lockfile) | — | — |
| `jsr:@std/csv` | CSV fallback only | ✓ (Deno std) | — | not needed for SPARQL path |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** CSV bulk (too large) → SPARQL per-name; SPARQL unreachable at run time → fixture + human_verification (never fabricate).

## Validation Architecture

> `workflow.nyquist_validation` not set to false → section included. Test framework is **vitest** (mirror `packages/lobby/vitest.config.ts` `[VERIFIED: glob]`), plus **pgTAP** for schema (mirror `supabase/tests/0021_lobby.test.sql`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (per-package) + pgTAP (schema) |
| Config file | `packages/probidad/vitest.config.ts` (Wave 0 — mirror lobby) |
| Quick run command | `pnpm --filter @obs/probidad test` |
| Full suite command | `pnpm -r test && pnpm -r typecheck` |

### Phase Requirements → Test Map (observable checks proving INT-03/04/05)
| Req | Behavior | Test type | Automated command | File |
|-----|----------|-----------|-------------------|------|
| INT-03 | Parser maps a captured SPARQL-JSON fixture → `Declaracion[]` LITERALLY (no LLM); `fecha_presentacion` = `fechaDeclaracion`; zod validates | unit | `pnpm --filter @obs/probidad test -t parse-infoprobidad` | ❌ Wave 0 |
| INT-03 | CC BY 4.0 attribution is carried per row (`licencia` non-null) and surfaced | unit + RTL | `pnpm --filter @obs/probidad test -t licencia` + `pnpm --filter @obs/app test -t patrimonio-attribution` | ❌ Wave 0 |
| INT-03 | NO LLM is invoked anywhere in the ingest path (no `@obs/llm` import in the connector/parser) | unit/lint | `pnpm --filter @obs/probidad test -t no-llm` | ❌ Wave 0 |
| INT-03/04 | Declarante cross: determinista → `EnlaceConfirmado` + FK + `identidad_audit` row; probable/revision/no_confirmado → NULL + raw mención | unit | `pnpm --filter @obs/probidad test -t reconciliar-declarante` | ❌ Wave 0 |
| INT-04 | Writer is VERSIONED: two declarations with different `fechaDeclaracion` → two rows; re-run with same input → identical counts (no overwrite, no dup) | unit | `pnpm --filter @obs/probidad test -t writer-versioned` | ❌ Wave 0 |
| INT-04 | `declaracion` public-read; `declaracion_familiar` RLS-on + ZERO policies + NO anon grant (deny-by-default + revoke) | pgTAP | `psql -f supabase/tests/0022_probidad.test.sql` (apply first) | ❌ Wave 0 |
| INT-04 | History RPC returns versions ordered `fecha_presentacion` DESC; old never flagged "current"; amber freshness on each; family NOT in projection | RTL | `pnpm --filter @obs/app test -t patrimonio-history` | ❌ Wave 0 |
| INT-05 | Comparison view lays N dated versions side-by-side; has ZERO delta/verdict/enriquecimiento field; CC BY 4.0 visible; content gate (no causal/judgment copy) | RTL + content-gate | `pnpm --filter @obs/app test -t patrimonio-compare` | ❌ Wave 0 |
| INT-04 | Three honest empty states (not-ingested / ingested-zero / has-versions); empty never reads as "no patrimonio" | RTL | `pnpm --filter @obs/app test -t patrimonio-empty` | ❌ Wave 0 |
| INT-03 | Bounded LIVE SPARQL run reachable OR honest degrade to fixture (never fabricates rows) | probe (manual/CI-gated) | `pnpm --filter @obs/probidad test -t live-infoprobidad.probe` | ❌ Wave 0 |
| INT-03 | Blocking drift: a mutated SPARQL-JSON fixture (structural change) quarantines the run, emits 0 rows | unit | `pnpm --filter @obs/probidad test -t drift-blocking` | ❌ Wave 0 |
| INT-03/04 | Section is its own lane (`<section id="patrimonio">`); no UI unit composes a declaration with a vote/lobby; no causal/affinity/score copy | RTL + content-gate | `pnpm --filter @obs/app test -t patrimonio-section` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @obs/probidad test` (+ `pnpm --filter @obs/app test` for UI tasks)
- **Per wave merge:** `pnpm -r test && pnpm -r typecheck`
- **Phase gate:** full suite green + pgTAP green against an APPLIED schema before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/probidad/vitest.config.ts` — mirror `packages/lobby`
- [ ] Captured InfoProbidad **SPARQL-JSON fixture** (a real declarante with ≥2 dated declarations) — pins the parser golden AND proves versioning
- [ ] Captured asset-class fixtures (one `BienInmueble`/`Actividad`/`Pasivo` instance) — Open Question 2
- [ ] `supabase/tests/0022_probidad.test.sql` — pgTAP: `declaracion_familiar` RLS-on + zero policies + **no anon grant**; `declaracion` public-read; provenance + `licencia` NOT NULL; version key includes `fecha_presentacion` (mirror 0021 test)
- [ ] Golden-set extension with real InfoProbidad declarante name strings (leading `\t` + double-spaces; PITFALLS A3; the ≥0.95 gate is the acceptance test)
- [ ] `probidad_ingesta_estado` marker so the three honest empty states are real (mirror `lobby_ingesta_estado`)

## Security Domain

> `security_enforcement` absent = enabled. Section included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth; anon read + service-role write (existing). |
| V3 Session Management | no | — |
| V4 Access Control | **yes** | RLS: `declaracion` + asset sub-tables public-read; `declaracion_familiar` deny-by-default + explicit `revoke all from anon, authenticated` (0021 convention). RPCs revoked from public, granted to anon, return only source-published fields, only for confirmed-linked declarations. |
| V5 Input Validation | **yes** | `zod` validates parsed SPARQL-JSON/CSV rows before write; `assertAllowedUrl` validates every fetch URL (SSRF). SPARQL is server-built (no user-injected query). |
| V6 Cryptography | no | No new secrets; reuse R2/Supabase creds; SPARQL is open (no API key). |
| V8 Data Protection / Privacy | **yes** | Ley 21.719 minimization: family third-party data deny-by-default; **no RUT in source → none stored**; no family→person link; no LLM on PII (no LLM used at all). CC BY 4.0 attribution carried per row + surfaced (incl. derived comparison). |

### Known Threat Patterns for {Deno connector + Postgres + Next.js}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via connector URL | Tampering/Info-disclosure | `assertAllowedUrl` deny-by-default allowlist (`cplt.cl`/`infoprobidad.cl` already listed); never fetch user-supplied hosts. `[VERIFIED: allowlist.ts]` |
| SPARQL injection | Tampering | Queries are server-built from a normalized name (escaped/encoded); no raw user input flows into the query string. |
| PII leak to anon (family third parties) | Info disclosure | `declaracion_familiar` RLS deny-by-default + explicit revoke; only curated RPC projections (no family) reach anon. |
| False attribution (wrong declarante link) | Spoofing/Repudiation | `EnlaceConfirmado` typed invariant; determinista-only FK; `identidad_audit` row per decision; name-only cross with golden ≥0.95. |
| Stale-as-current declaration | Tampering (integrity/misrepresentation) | Versioned model (never overwrite); prominent `fecha_presentacion` + amber freshness; old never labeled "current". |
| Insinuation via comparison delta | (product/legal risk) | ZERO verdict/delta field; content gate extends to the comparison view; own lane; no composed cross-dataset unit. |
| Silent partial/empty PII scrape | Tampering (integrity) | Blocking drift; fixture-pinned golden parser; never fabricate; honest degradation. |

## Sources

### Primary (HIGH confidence)
- Live SPARQL probes of `https://datos.cplt.cl/sparql` (curl, 2026-06-19): class counts (`Declaracion` 170,562; `Persona` 234,041; asset classes), `Declaracion` predicates (incl. `fechaDeclaracion`/`tipoDeclaracion`/`declaracionDe`/`poseeCargo`/`organismoFuente`/`tieneBien`…), `Persona` predicates (name + family relationships), one declarante → many dated declarations (2020-2024), and a CONTAINS filter proving **zero RUT/RUN/cédula predicates** — `[VERIFIED: curl SPARQL]`
- `packages/lobby/src/{connector-leylobby,reconciliar-sujeto,writer-supabase,ingest-run,model,index}.ts` — the connector pattern to mirror file-for-file — `[VERIFIED: codebase]`
- `supabase/migrations/0021_lobby.sql` + `11-01-SUMMARY.md` — deny-by-default + **explicit `revoke all from anon, authenticated`** + security-definer RPC + ingesta-estado marker — `[VERIFIED: codebase + summary]`
- `supabase/migrations/0018_piso_pii.sql` + `09-03-SUMMARY.md` — deny-by-default convention + pgTAP template + `assertPiiDocumentSafeForLlm` (only if a future LLM path) — `[VERIFIED: codebase + summary]`
- `packages/ingest/src/allowlist.ts` — `cplt.cl` + `infoprobidad.cl` already allowlisted (lines 25-26); SSRF posture — `[VERIFIED: codebase]`
- `packages/llm/src/data-routing.ts` — `assertPiiDocumentSafeForLlm` (mandatory IF any future LLM extraction; not wired this phase) — `[VERIFIED: codebase]`
- `app/components/lobby-de-parlamentario.tsx` + `app/app/parlamentario/[id]/page.tsx` — section shell (already reserves `<section id="patrimonio">`), §9.1 content gate, honest empty states, security-definer RPC read — `[VERIFIED: codebase]`
- `packages/fichas/src/extraer.ts` — the literal-extraction + golden-gate pattern (REFERENCE ONLY — not used; content is structured) — `[VERIFIED: codebase]`
- `.planning/research/{STACK,PITFALLS}.md` (v2.0) — InfoProbidad access, CC BY 4.0, PII/causality/legal guardrails — `[CITED]`

### Secondary (MEDIUM confidence)
- WebFetch of `infoprobidad.cl/DatosAbiertos/{Catalogos,Ontologia}` — 7 CSV catalog URLs, RDF/OWL ontology classes/properties, CC BY 4.0 text, weekly update cadence — `[CITED: infoprobidad.cl]`

### Tertiary (LOW confidence)
- Exact asset sub-entity property names + `tipoDeclaracion` labels (Open Questions 2-3) — linking predicates verified, leaf properties not yet enumerated.

## Metadata

**Confidence breakdown:**
- InfoProbidad access + structure: HIGH — SPARQL endpoint queried live; model (classes, predicates, versioning, no-RUT) confirmed directly.
- "No LLM needed" verdict: HIGH — content is structured RDF/CSV; CONTEXT decision maps exactly to the structured branch.
- Connector/writer/identity/RLS patterns: HIGH — directly mirrored from shipped Phase-11 code + Phase-9 conventions.
- Asset sub-table column layout + tipo labels: MEDIUM — linking predicates verified, leaf properties to enumerate at plan time (Open Questions 2-3).

**Research date:** 2026-06-19
**Valid until:** 2026-07-19 for stable items (patterns, conventions, allowlist); **14 days** for the InfoProbidad SPARQL structure (re-probe before the connector wave — CPLT updates the data twice weekly and could evolve the ontology).
