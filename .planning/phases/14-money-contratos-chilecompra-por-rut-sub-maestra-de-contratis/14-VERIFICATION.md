---
phase: 14-money-contratos-chilecompra-por-rut-sub-maestra-de-contratis
verified: 2026-06-19T15:05:00Z
status: human_needed
score: 4/4 success criteria verified in code (3 operator/human checkpoints pending, intentionally deferred)
overrides_applied: 0
mode: mvp
human_verification:
  - test: "Apply migration 0023_dinero.sql to remote Postgres + run pgTAP 0024_dinero.test.sql against the applied schema"
    expected: "supabase db push --db-url + supabase test db --db-url pass 17/17 asserts, in particular the 3 contratista deny-by-default asserts (RLS enabled + 0 policies + anon 0 SELECT grant) and the RPC asserts (security definer + anon EXECUTE + public revoked). Migration was edited post-code-review (nombre_orden column, CHECK constraint, NULLS LAST ordering) so the remote apply is required for the schema to match the file."
    why_human: "CI/build does not apply DDL (false positive, Pitfall 3); the only valid proof is pgTAP against an applied schema. Requires SUPABASE_DB_URL operator secret + remote write. Checkpoint 14-01."
  - test: "LIVE ChileCompra probe: pnpm --filter @obs/dinero exec tsx src/live-chilecompra.probe.ts <RUT-empresa> [DDMMAAAA]"
    expected: "The real api.mercadopublico.cl response shape matches the Zod schemas in model.ts (BuscarProveedor -> CodigoEmpresa/NombreEmpresa; ordenesdecompra -> Cantidad/Listado). If it differs, adjust schema/parser and report the delta. Confirms Assumption A2: schemas are derived from docs, not a captured response."
    why_human: "Requires MERCADOPUBLICO_TICKET operator secret + a real rate-limited (2-3s) network call to a government endpoint. Cannot be exercised in CI without the secret. Checkpoint 14-02."
  - test: "Populate parlamentario.rut (IDENT-10) and run a bounded CLI sweep for one or two RUTs to confirm real attribution coverage + idempotency (re-run -> same counts)"
    expected: "With internal RUT populated, RUT-exact unique matches mint confirmed links; re-running yields identical upsert counts. Until then every parlamentario honestly shows 'no consultado todavia' (coverage ~0 by design)."
    why_human: "parlamentario.rut is unpopulated operator debt (IDENT-10, no official cross-walkable source). The connector is built correctly; real coverage is an operator data-population action, not a phase defect."
---

# Phase 14: MONEY Contratos — ChileCompra por RUT + sub-maestra de contratistas Verification Report

**Phase Goal:** El ciudadano ve los contratos del Estado asociados al RUT de un parlamentario, redactados estrictamente como tales, con la regla RUT-exacto como unico camino de enlace y una sub-maestra de contratistas para agregacion futura.
**Mode:** mvp (User-story-narrowed: verify the citizen-facing outcome is observably true in the codebase, gated OFF by design).
**Verified:** 2026-06-19T15:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

This phase deliberately ships GATED OFF (`MONEY_PUBLIC_ENABLED` default false, operator decision F13). The buildable/code criteria verify PASS via the test suites and code reads. The remote-schema proof, LIVE response-shape confirmation, and internal-RUT population are operator/human items → overall `human_needed`. The two known operator checkpoints (14-01 remote apply, 14-02 LIVE probe) and the IDENT-10 RUT-population debt are intentionally deferred and are NOT counted as gaps.

### User Flow Coverage (MVP)

| Step (success criterion) | Expected | Evidence in codebase | Status |
| --- | --- | --- | --- |
| SC1: `@obs/dinero` ingests contracts by RUT from ChileCompra, validates DV mod-11, labels natural/juridica, builds contratista sub-maestra; serial-per-RUT sweep respects 2–3s delay | Connector in LOCKED order, 2-step flow, DV quarantine, natural/juridica label, contratista keyed by RUT, serial loop with rate-limiter | `connector-chilecompra.ts` LOCKED order (assertAllowedUrl→robots→rateLimiter.wait→fetcher.get, lines 92-130); 2-step `buscarProveedor`/`ordenesDeCompra`; `ingest-run.ts:94` serial `for (const tarea of opts.tareas)` + `isRutValido` quarantine (`:98`); `tipoPersona()` umbral (`parse-chilecompra.ts:27`); `contratista` upsert keyed by rut_proveedor; comment line 2 documents rate-limiter serializes per host. **28/28 dinero unit tests green.** | ✓ VERIFIED (code) — pgmq/GH-Actions orchestration wiring is operator-deferred (same pattern as 0021/0022; no cron in migration by design) |
| SC2: ficha shows contracts "asociados al RUT" (never "del parlamentario"), provenance + fecha de corte per row | Heading exact, intro honest, ProvenanceBadge + fecha de corte per row | `contratos-de-parlamentario.tsx` heading via `page.tsx:99` "Contratos del Estado asociados al RUT"; `Intro()` "no implica que el contrato sea del parlamentario"; per-row `<ProvenanceBadge>` (line 178) + "Consultado por RUT, corte al {fecha}" (line 169-173). **14/14 RTL tests green.** | ✓ VERIFIED |
| SC3: link contract→parlamentario ONLY by RUT-exact (never by name); no exact match → no attribution; "consultado sin contratos" ≠ "no consultado todavia" | RUT-only matcher, name path impossible, three distinct honest states | `reconciliar-contrato.ts:118` confirms ONLY `estado==="confirmado" && metodo==="rut"`; passes `nombreNormalizado: ""` so name branch cannot fire; invalid RUT → cuarentena (`:109`); no `correrPipeline`/`@obs/adjudication`/`normalizarNombre` in src (grep: only documentary comments); three server-derived states (`tsx:348-356`) with textually distinct copy. | ✓ VERIFIED |
| SC4: contract to persona juridica never collapsed into personal attribution; subject is the provider entity | Subject = entidad proveedora; parlamentario link on separate line; never possessive | `ContratoFila` (`tsx:113-186`): `Proveedor: {nombre}` as `text-base` subject + `(persona juridica)` muted; "Enlazado por RUT al parlamentario." on a SEPARATE muted line (no possessive). RPC/DB keep contratista sub-maestra distinct from the FK. | ✓ VERIFIED |

**Score:** 4/4 success criteria verified in code.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `supabase/migrations/0023_dinero.sql` | contrato public-read + contratista deny-by-default+revoke + marcador + RPC | ✓ VERIFIED | All four objects present; `revoke all on contratista from anon, authenticated` (line 127); RPC security definer revoke-from-public+grant-anon (166-167); licencia default 'mencion de la fuente' (NO CC BY 4.0); CR-02 `nombre_orden` column + WR-02 CHECK (71) + WR-03 `nulls last` (162). No `cron.schedule` statement. |
| `supabase/tests/0024_dinero.test.sql` | pgTAP: 3 tables, RLS, deny-by-default×3, RPC×4 | ✓ VERIFIED (structure) | `plan(17)` matches 17 asserts; the 3 contratista deny-by-default asserts + 4 RPC asserts present. Execution against applied schema = operator checkpoint 14-01. |
| `packages/dinero/src/reconciliar-contrato.ts` | RUT-exact deterministic link; no correrPipeline | ✓ VERIFIED | RUT-only; cuarentena/no_confirmado/confirmado domain; no LLM/name path. |
| `packages/dinero/src/connector-chilecompra.ts` | ContratoConnector REST + ChileCompraBloqueadaError + ticket never leaked | ✓ VERIFIED | LOCKED order; CR-01 fix: all HTTP errors + HostNotAllowedError sanitized via urlSinQuery/redactarTicket; ticket never interpolated. |
| `packages/dinero/src/parse-chilecompra.ts` | VERBATIM parse, monto null (CR-02), tipoPersona | ✓ VERIFIED | `monto: null`; `nombreOrden` verbatim; Zod drift → THROW (quarantine), never silent 0 rows. |
| `packages/dinero/src/writer-supabase.ts` | idempotent upsert + marcarIngestado | ✓ VERIFIED | onConflict (fuente_id,fecha_corte) / rut_proveedor / parlamentario_id; service key env-only. 9 writer tests green. |
| `app/components/contratos-de-parlamentario.tsx` | ContratosView pure + ContratosSection gated | ✓ VERIFIED | Gate before any Supabase read (`:297`); throw on rpcError (#34); WR-01 null guards; CR-02 honest "Monto: No publicado" + "Nombre de la orden". |
| `app/app/parlamentario/[id]/page.tsx` | section #dinero gated, heading inside wrapper | ✓ VERIFIED | Entire `<section id="dinero">` incl. `<h2>` wrapped in `moneyPublicEnabled(process.env)` (`:96-105`); OFF → heading absent. |
| `app/lib/types.ts` | sourceLabel ChileCompra branch + ContratoRpcRow | ✓ VERIFIED | `:378` returns "ChileCompra" for chilecompra/mercado; `ContratoRpcRow` (`:275`) with nullable fields (WR-01) + `nombre_orden`. |
| `.env.example` | MERCADOPUBLICO_TICKET + MONEY_PUBLIC_ENABLED=false | ✓ VERIFIED | Both present (lines 50, 58). |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| 0023_dinero.sql | parlamentario(id) | FK on delete set null | ✓ WIRED | `contrato.parlamentario_id references parlamentario(id) on delete set null` (line 64). |
| contratos_de_parlamentario | contrato | where c.parlamentario_id = p_id | ✓ WIRED | RPC body line 159 — only confirmed rows. |
| reconciliar-contrato.ts | @obs/identity | matchDeterminista (rama rut) + confirmar | ✓ WIRED | Imports + accepts ONLY confirmado+rut (`:118`). |
| connector-chilecompra.ts | @obs/ingest assertAllowedUrl | SSRF before each fetch | ✓ WIRED | `assertAllowedUrl(url, allowlist)` first in fetchJson (`:97`); mercadopublico.cl in DEFAULT_ALLOWED_SUFFIXES. |
| page.tsx | ContratosSection | `<section id="dinero">` + Suspense + ContratosSkeleton | ✓ WIRED | Mounted + gated (`:96-105`). |
| contratos-de-parlamentario.tsx | contratos_de_parlamentario RPC | sb.rpc after moneyPublicEnabled gate | ✓ WIRED | `sb.rpc("contratos_de_parlamentario", { p_id: id })` (`:309`) after gate. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| dinero unit suite (parse, reconciliar, connector, writer) | `pnpm exec vitest run packages/dinero` | 28 passed (4 files) | ✓ PASS |
| ficha RTL suite (gate, 3 states, persona juridica, CR-02 honest monto) | `cd app && pnpm test contratos` | 14 passed (1 file) | ✓ PASS |
| No name/LLM/correrPipeline path in connector | grep correrPipeline/@obs/adjudication/normalizarNombre in src | only documentary comments; package.json has no adjudication dep | ✓ PASS |
| No debt markers in shipped code | grep TODO/FIXME/XXX/TBD/HACK/PLACEHOLDER | only "TODO error HTTP" (Spanish "every HTTP error") in a comment — not a debt marker | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| --- | --- | --- | --- |
| `packages/dinero/src/live-chilecompra.probe.ts` | `tsx src/live-chilecompra.probe.ts <RUT> [DDMMAAAA]` | NOT RUN — requires MERCADOPUBLICO_TICKET operator secret + live network call | MISSING_PROBE (operator checkpoint 14-02, intentionally deferred — NOT a gap) |

Note: the live probe is an operator-only LIVE probe by design (not a CI/migration probe). It cannot run without the operator secret; it is surfaced as a human-verification item, not a failure.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| MONEY-01 | 14-02 | Conector @obs/dinero ingiere contratos por RUT desde ChileCompra (DV, natural/juridica, sub-maestra) | ✓ SATISFIED (code) | SC1 evidence; LIVE shape confirmation is operator checkpoint 14-02. |
| MONEY-02 | 14-01/02/03 | Enlace RUT-exacto + ficha "asociados al RUT" + 3 estados + persona juridica + deny-by-default | ✓ SATISFIED | SC2/SC3/SC4 evidence + migration deny-by-default + gate. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| connector-chilecompra.ts | 113 | "CR-01: TODO error HTTP ..." | ℹ️ Info | False positive — "TODO" is Spanish "todo" (= "every"), not a debt marker. No action. |

No blocker anti-patterns. No unreferenced debt markers. `monto: null` and the various `?? "No publicado"` / `?? null` fallbacks are honest empty-state handling (CR-02/WR-01 fixes), not stubs — data flows from the RPC and the null is an intentional honest "no publicado" presentation.

### Code-Review Fix Verification (14-REVIEW.md)

| Finding | Claimed fix | Verified in shipped code |
| --- | --- | --- |
| CR-01 (ticket leak) | redactarTicket + wrap all HTTP errors | ✓ connector-chilecompra.ts:99-128, ingest-run.ts:142,164 use redactarTicket/urlSinQuery |
| CR-02 (Monto = description) | monto null + nombre_orden + honest "No publicado" | ✓ parse-chilecompra.ts:85-89, component:156-161, migration:77-78, RPC:152 |
| WR-01 (nullable RPC fields) | string\|null + null guards | ✓ types.ts ContratoRpcRow nullable; component:116 `(c.tipo_persona ?? "")` |
| WR-02 (estado_vinculo domain) | CHECK constraint | ✓ migration:71 `check (estado_vinculo in ('confirmado','no_confirmado','cuarentena'))` |
| WR-03 (NULLS FIRST ordering) | nulls last + tiebreak | ✓ migration:162 `order by c.fecha_oc desc nulls last, c.codigo_orden desc` |
| WR-04 (marcarSinContratos drift) | delegate to matchDeterminista | ✓ ingest-run.ts:247-254 uses matchDeterminista |

Note: WR-02/WR-03/CR-02 SQL changes require a remote re-apply (operator checkpoint 14-01) for the deployed schema to match the file.

### Human Verification Required

1. **Apply migration 0023 to remote + run pgTAP 0024** (checkpoint 14-01)
   - Test: `supabase db push --db-url "$SUPABASE_DB_URL"` then `supabase test db --db-url "$SUPABASE_DB_URL"`
   - Expected: 17/17 pgTAP green, in particular the 3 contratista deny-by-default asserts and the RPC asserts. The migration was edited during code-review (nombre_orden column, CHECK, NULLS LAST), so a fresh remote apply is required.

2. **LIVE ChileCompra probe** (checkpoint 14-02)
   - Test: `MERCADOPUBLICO_TICKET=... pnpm --filter @obs/dinero exec tsx src/live-chilecompra.probe.ts "<RUT-empresa>" [DDMMAAAA]`
   - Expected: real response shape matches the Zod schemas (BuscarProveedor → CodigoEmpresa; ordenesdecompra → Cantidad/Listado). Confirm or report the delta.

3. **Populate internal RUT (IDENT-10) + bounded CLI sweep**
   - Test: populate `parlamentario.rut`, then a bounded CLI run for one/two RUTs with a real writer.
   - Expected: RUT-exact unique matches mint confirmed links; re-run yields identical counts. Until then every parlamentario honestly shows "no consultado todavia" — by design, not a defect.

### Gaps Summary

No gaps. All four success criteria are observably satisfied in the codebase, all six code-review findings (CR-01/CR-02 + WR-01..04) are verified fixed in the shipped files, both test suites are green (28 dinero + 14 ficha = 42 tests), no debt markers, and the deny-by-default + revoke + gate double-lock is present in both the migration and the UI.

The phase is `human_needed` solely because three checks cannot be exercised programmatically in this environment and are intentionally deferred to the operator: (1) the remote DDL apply + pgTAP-against-applied-schema (14-01), (2) the LIVE ChileCompra response-shape confirmation needing the MERCADOPUBLICO_TICKET secret (14-02), and (3) internal-RUT population (IDENT-10). None of these are phase failures; they are the standing operator/legal-gate debts that this phase was explicitly scoped to ship around (gated OFF until F13 sign-off).

---

_Verified: 2026-06-19T15:05:00Z_
_Verifier: Claude (gsd-verifier)_
