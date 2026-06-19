---
phase: 14-money-contratos-chilecompra-por-rut-sub-maestra-de-contratis
reviewed: 2026-06-19T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - packages/dinero/src/reconciliar-contrato.ts
  - packages/dinero/src/connector-chilecompra.ts
  - packages/dinero/src/query.ts
  - packages/dinero/src/parse-chilecompra.ts
  - packages/dinero/src/model.ts
  - packages/dinero/src/writer.ts
  - packages/dinero/src/writer-supabase.ts
  - packages/dinero/src/ingest-run.ts
  - packages/dinero/src/ingest-cli.ts
  - packages/dinero/src/live-chilecompra.probe.ts
  - packages/dinero/src/index.ts
  - packages/dinero/src/reconciliar-contrato.test.ts
  - packages/dinero/src/parse-chilecompra.test.ts
  - packages/dinero/src/writer.test.ts
  - supabase/migrations/0023_dinero.sql
  - supabase/tests/0024_dinero.test.sql
  - app/components/contratos-de-parlamentario.tsx
  - app/components/contratos-de-parlamentario.test.tsx
  - app/app/parlamentario/[id]/page.tsx
  - app/lib/types.ts
  - .env.example
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
fixes:
  fixed_at: 2026-06-19
  resolved:
    CR-01: 91de0f4
    CR-02: 5268ca3
    WR-01: 5268ca3
    WR-02: 37f5abe
    WR-03: 5268ca3
    WR-04: 107631e
  remaining_info: [IN-01, IN-02, IN-03]  # IN-02 incidentally addressed by CR-02 fixtures
  note: >-
    Critical + Warning findings resolved via /gsd:code-review --fix. Info findings
    left per scope. SQL changes (WR-02 CHECK, WR-03 order-by, CR-02 nombre_orden
    column/RPC) require an OPERATOR remote re-apply + pgTAP; not applied to remote here.
---

# Phase 14: Code Review Report

**Reviewed:** 2026-06-19
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Phase 14 (MONEY Contratos — ChileCompra por RUT) was reviewed adversarially against its five hard SECURITY + HONESTY rules. Four of the five rules hold up well:

- **Rule 1 (RUT-exact only):** SOUND. `reconciliar-contrato.ts` has zero name/LLM/`correrPipeline` path; the only confirm branch is `res.estado === "confirmado" && res.metodo === "rut"`, and it passes `nombreNormalizado: ""` so the name branch in `matchDeterminista` can never fire. A RUT no-match yields `enlace: null`. Verified.
- **Rule 2 (deny-by-default + revoke):** SOUND. `0023_dinero.sql` enables RLS on `contratista`, creates zero policies, and `revoke all on contratista from anon, authenticated`. `0024_dinero.test.sql` asserts all three (RLS, 0 policies, 0 anon SELECT grant) and the RPC is `security definer` with execute revoked from public + granted to anon. Verified.
- **Rule 3 (exposure gate):** SOUND. `page.tsx` wraps the ENTIRE `<section id="dinero">` including `<h2>` behind `moneyPublicEnabled(process.env)`, with a redundant gate inside `ContratosSection`. Default OFF → heading absent from HTML. No `NEXT_PUBLIC_` leak. Verified.
- **Rule 4 (honesty/redaction):** Mostly SOUND (heading exact, three honest states, jurídica never collapsed, "mención de la fuente"). BUT see CR-02 / WR-01: the "Monto" field is misleading.
- **Rule 5 (ingest safety):** PARTIALLY VIOLATED. SSRF allowlist, serial rate-limit, RUT quarantine, and idempotent writer are all correct — BUT the `MERCADOPUBLICO_TICKET` secret CAN leak into error messages and logs on several HTTP-error paths (CR-01).

Two Critical findings: a ticket-secret leak (Rule 5 violation) and a money-field honesty defect (Rule 4 adjacent). Four Warnings and three Info items follow.

## Critical Issues

### CR-01: `MERCADOPUBLICO_TICKET` secret leaks into error messages and logs on non-403/429/503 HTTP errors

**RESOLVED** (commit `91de0f4`): Added `redactarTicket()` helper in `query.ts` (masks `ticket=<SECRET>` → `ticket=***`). `fetchJson` now wraps the `assertAllowedUrl` SSRF call (which threw `HostNotAllowedError` carrying the raw ticket URL) and ALL HTTP errors — every `FetchError`/`RetryableError` (not just 403/429/503) degrades to a ticket-free `ChileCompraBloqueadaError`; any other error message is run through `redactarTicket`. Defense-in-depth redaction added at the `ingest-run.ts` `mensaje` captures, the `ingest-cli.ts` print loop, and the `live-chilecompra.probe.ts` error log. New unit test asserts a simulated 500 (RetryableError) and 404 (FetchError) surface a message that does NOT contain the secret and that `ticket=***` masking holds.

**File:** `packages/dinero/src/connector-chilecompra.ts:100-109`, `packages/dinero/src/ingest-run.ts:136,158,211`, `packages/dinero/src/ingest-cli.ts:158`, `packages/dinero/src/live-chilecompra.probe.ts:67`

**Issue:** The phase rule is explicit: "the `MERCADOPUBLICO_TICKET` secret must never be interpolated into error messages/logs." The connector builds URLs that carry `&ticket=<SECRET>` in the querystring (`query.ts:16,25`). When the underlying `Fetcher.get` fails, it throws `FetchError`/`RetryableError` whose constructors interpolate the **full URL including the ticket** into the message:

```
// packages/ingest/src/fetcher.ts:47,58
super(`fetch ${url} -> ${status} (retryable)`);   // RetryableError
super(`fetch ${url} -> ${status}`);               // FetchError
```

`ChileCompraConnector.fetchJson` only sanitizes the **403** (FetchError) and **429/503** (RetryableError) cases by wrapping in `ChileCompraBloqueadaError` (which strips the query). Every other failure hits the final `throw err` (connector-chilecompra.ts:108) and re-throws the raw error whose `.message` still contains the ticket. Concretely this leaks for:
- Any 5xx other than 503 (e.g. 500, 502, 504 → `RetryableError`).
- Any 4xx other than 403 (e.g. 400, 401, 404 → `FetchError`).
- `HostNotAllowedError` (allowlist.ts:45 interpolates `rawUrl` with the ticket).
- A `JSON.parse` `SyntaxError` is safe (no URL), but the HTTP errors above are not.

That tainted message is then captured in `ingest-run.ts`:
```
errores.push({ ..., mensaje: err instanceof Error ? err.message : String(err) }); // :136, :158, :211
```
and finally printed to the console by the CLI:
```
for (const e of res.errores) log(`ingest-dinero: ERROR [${e.fuente}/${e.clave}]: ${e.mensaje}`); // ingest-cli.ts:158
```
The LIVE probe leaks it too: `console.error(\`[probe] error:\`, err)` (live-chilecompra.probe.ts:67) logs the full error object/message for any non-bloqueada error.

**Fix:** Sanitize before the message ever carries the URL. Either (a) wrap ALL non-2xx outcomes (not just 403/429/503) in a ticket-free error in `fetchJson`, or (b) strip the querystring from any error message crossing the connector boundary. Example for (a):
```ts
} catch (err) {
  if (err instanceof FetchError) {
    throw new ChileCompraBloqueadaError(urlSinQuery(url), err.status); // any 4xx, not just 403
  }
  if (err instanceof RetryableError) {
    throw new ChileCompraBloqueadaError(urlSinQuery(url), err.status); // any retryable, not just 429/503
  }
  if (err instanceof HostNotAllowedError) {
    throw new Error(`host no permitido: ${urlSinQuery(url)}`); // strip ticket
  }
  throw err; // only ticket-free errors (e.g. SyntaxError) reach here
}
```
Additionally harden the probe (line 67) to log `urlSinQuery`-scrubbed messages, and consider scrubbing in `ingest-run`'s `mensaje` capture as defense-in-depth.

### CR-02: "Monto" column is populated with the order's name/description, not an amount — misleads the citizen under a money label

**RESOLVED** (commit `5268ca3`): The parser no longer maps `orden.Nombre` into `monto`. Added a dedicated `nombreOrden` field end-to-end (model `Contrato` + Zod, parser, `ContratoParaEscribir`, both writers, migration column `nombre_orden`, RPC return + select, `ContratoRpcRow`, component) carrying the order's free-text name VERBATIM. `monto` is now `null` (the `ordenesdecompra.json` listado carries no guaranteed numeric total — RESEARCH A2/OQ1); the UI renders the order name under an honest `Nombre de la orden:` label and shows `Monto:` only honestly ("No publicado" when null) — a non-amount is never presented as money. Component + parser fixtures updated to reflect REAL parser output (`monto: null`, `nombre_orden` populated) instead of the invented `$ 124.500.000` that masked the defect (also resolves IN-02).

**File:** `packages/dinero/src/parse-chilecompra.ts:85`, `app/components/contratos-de-parlamentario.tsx:141-142`

**Issue:** The parser sets the contract's `monto` (amount) field to the order's free-text **name/description**, not any peso figure:
```ts
// parse-chilecompra.ts:83-85
// El "monto" del listado de ChileCompra no es un campo numerico fijo aqui; se preserva el
// estado/nombre crudo de la orden como contenido VERBATIM. No se computa ningun total.
monto: orNull(orden.Nombre),
```
The UI then renders that value under a literal `Monto:` (Amount:) label with `font-mono` (contratos-de-parlamentario.tsx:141-142). The own unit-test fixtures confirm the mismatch: the parser test asserts `a.monto).toBe("Compra de insumos")` (parse-chilecompra.test.ts:35) — a description — while the component test feeds a hand-crafted `monto: "$ 124.500.000"` (contratos-de-parlamentario.test.tsx:24) that the real pipeline never produces. So the component tests pass against a fixture that does not reflect runtime output, masking the defect.

This is a direct honesty-rule violation: the platform's core value is "cada dato mostrado lleva fuente, fecha y enlace original, sin afirmar nunca [...]" with traceability to source. Labeling a description as "Monto" presents data as something it is not, and an empty/odd "Monto" could read as a verdict.

**Fix:** Do not map `orden.Nombre` into `monto`. Either (a) drop the `Monto` row entirely until a real amount field is sourced (the `ordenesdecompra.json` listado does not carry a fixed monetary value — confirm against the live probe), and render `orden.Nombre` under an honest label such as `Nombre de la orden:` / `Descripción:`; or (b) keep `monto: null` and surface the description as a separate literal field. Update the parser, the model field name, `ContratoRpcRow`, and the component label together, and fix the test fixtures to reflect true parser output.

## Warnings

### WR-01: `ContratoRpcRow` types nullable DB columns as non-null `string` → `c.tipo_persona.toLowerCase()` can crash the section

**RESOLVED** (commit `5268ca3`): `ContratoRpcRow` and the component's `ContratoRow` now type `proveedor_nombre`, `tipo_persona`, `organismo`, `nombre_orden`, `monto`, `fecha_oc` as `string | null` to match the nullable DB columns. `ContratoFila` guards the access (`const tipoPersona = (c.tipo_persona ?? "").toLowerCase()`) and renders explicit "no publicado" fallbacks for null `organismo`/`proveedor_nombre`/`monto`/`nombre_orden` instead of blank cells or a crash. New RTL test feeds an all-null row and asserts the fila renders without throwing.

**File:** `app/lib/types.ts:275-287`, `app/components/contratos-de-parlamentario.tsx:110`

**Issue:** `ContratoRpcRow` declares `proveedor_nombre`, `tipo_persona`, `organismo`, `monto`, `fecha_oc` as non-nullable `string`. But the `contrato` table columns are all nullable (`0023_dinero.sql:69-73`), and the RPC projects them verbatim (`0023_dinero.sql:150-151`). At runtime the RPC can therefore return `null` for any of them. `ContratoFila` does `const esJuridica = c.tipo_persona.toLowerCase().includes("jur")` (contratos-de-parlamentario.tsx:110) — if `tipo_persona` is `null`, this throws `TypeError: Cannot read properties of null (reading 'toLowerCase')`. Because the Server Component does not catch it, the whole route error boundary fires for a row that should have rendered. `c.proveedor_nombre`/`c.organismo`/`c.monto` rendered as `null` would silently render nothing (acceptable-ish), but the `.toLowerCase()` call is a hard crash.

**Fix:** Make the RPC-row fields `string | null` to match the schema, and guard the access:
```ts
const tp = (c.tipo_persona ?? "").toLowerCase();
const esJuridica = tp.includes("jur");
```
Render explicit "no publicado" fallbacks for null `organismo`/`proveedor_nombre`/`monto` rather than blank cells (consistent with the honest-state discipline).

### WR-02: `estado_vinculo` written as `"cuarentena"` but column/contract documents only `'confirmado' | 'no_confirmado' | null`

**RESOLVED** (commit `37f5abe`): Picked the model as the single source of truth (`EstadoVinculoContrato = "confirmado" | "no_confirmado" | "cuarentena"`). The `0023_dinero.sql` `estado_vinculo` column comment now documents the canonical domain and a `check (estado_vinculo in ('confirmado','no_confirmado','cuarentena'))` constraint enforces it — a value outside the domain is now an error, not silent data. (SQL-only change; remote re-apply is an OPERATOR action and was NOT performed here. pgTAP runs against the applied schema as an operator checkpoint.)

**File:** `packages/dinero/src/reconciliar-contrato.ts:108,126`, `supabase/migrations/0023_dinero.sql:66`, `packages/dinero/src/writer.ts:81`, `packages/dinero/src/writer-supabase.ts:58`

**Issue:** `reconciliarContrato` can set `estadoVinculo = "cuarentena"` (reconciliar-contrato.ts:108) and `filaParaEscribir` stores it into the row (`:126`), which both writers persist into `estado_vinculo` (writer.ts:81 / writer-supabase.ts:58). But the migration documents that column as `'confirmado' | 'no_confirmado' | null` (0023_dinero.sql:66) and there is no CHECK constraint enforcing the contract either way. The state space is inconsistent across the model, the migration comment, and the writers. In practice this row is hard to reach (ingest-run quarantines an invalid task RUT before reconciliation at ingest-run.ts:93-102, and the contract's `rutProveedor` is the same task RUT), but the divergence is a latent correctness/consistency defect and weakens the "three honest states" contract.

**Fix:** Pick one source of truth. Either add `"cuarentena"` to the documented column domain (and ideally a CHECK constraint listing the allowed values), or have the writer refuse to persist a `"cuarentena"` contract row (quarantine means 0 rows, per the stated invariant). Align the model, migration comment, and writers.

### WR-03: RPC orders by nullable `fecha_oc` with default NULLS FIRST → undated contracts float to the top of the list

**RESOLVED** (commit `5268ca3`): The `contratos_de_parlamentario` RPC now uses `order by c.fecha_oc desc nulls last, c.codigo_orden desc` — undated contracts sink to the bottom and ties are broken deterministically. (SQL-only change in `0023_dinero.sql`; remote re-apply is an OPERATOR action and was NOT performed here.)

**File:** `supabase/migrations/0023_dinero.sql:154`

**Issue:** `order by c.fecha_oc desc` over a nullable `date` column uses Postgres' default `NULLS FIRST` for `DESC`. Contracts whose `fecha_oc` is null (the column is nullable and the parser emits `null` when `FechaEnvio` is absent — parse-chilecompra.ts:85/`orNull(orden.FechaEnvio)`) will sort ABOVE all dated contracts, so the "most recent first" intent is inverted for the undated head of the list, and pagination order becomes non-deterministic among ties.

**Fix:** Make ordering explicit and stable:
```sql
order by c.fecha_oc desc nulls last, c.codigo_orden desc
```

### WR-04: `marcarSinContratos` ignores its `_opts` param and silently re-implements the RUT-exact match instead of reusing the reconciliation logic

**RESOLVED** (commit `107631e`): `marcarSinContratos` now delegates to the canonical `matchDeterminista` (rama RUT) with `nombreNormalizado: ""` and only marks on `estado === "confirmado" && metodo === "rut"` — the same primitive `reconciliarContrato` uses, so the security-sensitive match rule is single-sourced and cannot drift. The previously-unused `opts` (camara/periodo) is now honored to align the blocking with the reconciler. Existing dinero suite (28 tests) stays green.

**File:** `packages/dinero/src/ingest-run.ts:235-245`

**Issue:** `marcarSinContratos` re-derives the RUT-exact unique match inline (`maestra.filter(... normRut(p.rut) === objetivo); if (porRut.length === 1)`) rather than delegating to `matchDeterminista`/`reconciliarContrato`. The `_opts` parameter (camara/periodo) is accepted but unused. This is a second, divergent copy of the same security-sensitive matching rule that Rule 1 requires to be single-sourced. If the canonical reconciliation guard ever tightens (e.g. additional gating on `isRutValido` edge cases or cámara/periodo blocking), this copy will silently drift and could mark a parlamentario as "consultado" under a match the canonical path would reject. It currently agrees with the canonical logic, so this is a maintainability/consistency risk, not an active bug.

**Fix:** Have `marcarSinContratos` reuse the same exact-match primitive the reconciler uses (e.g. call `matchDeterminista` with `nombreNormalizado: ""` and check `estado === "confirmado" && metodo === "rut"`), and either honor `_opts` or remove it from the signature.

## Info

### IN-01: Connector comment claims `ChileCompraBloqueadaError` covers "ticket agotado", but ticket-exhaustion may not arrive as 429/503

**File:** `packages/dinero/src/connector-chilecompra.ts:37-39,101,105`

**Issue:** The class docstring and inline comments assert that 403/503/429 map ticket-exhaustion to honest degradation. ChileCompra ticket-quota exhaustion may instead surface as a 200 with an error body, or a 401/400 — none of which are wrapped, so they would fall through to the raw-error path (relevant to CR-01) and would not degrade honestly. Worth confirming the real exhaustion response against the live probe and widening the mapping accordingly.

**Fix:** Validate the actual exhaustion response shape and map it explicitly; do not rely solely on the HTTP status.

### IN-02: Component test fixtures do not match real parser output (couples to CR-02)

**File:** `app/components/contratos-de-parlamentario.test.tsx:24,29`

**Issue:** The RTL fixtures use `monto: "$ 124.500.000"` and a `www.mercadopublico.cl/.../DetailsAcquisition.aspx` enlace, but the parser emits `monto = orden.Nombre` and `enlace = "https://api.mercadopublico.cl/.../ordenesdecompra.json"` (a generic endpoint, not the per-order record). The pure-view tests are green against data the pipeline never produces, reducing their value as a regression guard. Tie the fixtures to true parser output once CR-02 is resolved.

**Fix:** Build component fixtures from `parseContratos` output (or shared fixtures) so the view test exercises real shapes, including a per-order `enlace`.

### IN-03: Per-row `enlace` is a generic endpoint, not the individual order's source record

**File:** `packages/dinero/src/ingest-run.ts:166`, `packages/dinero/src/parse-chilecompra.ts:54,89`

**Issue:** Every parsed contract gets the same `enlace = "https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json"` (the bulk endpoint), so the `ProvenanceBadge`'s "fuente oficial ↗" link does not point to the specific order. The project's rector principle is "trazabilidad a la fuente [...] enlace original" per row. A generic endpoint weakens that traceability (and would not even resolve without the ticket in a browser).

**Fix:** Construct a per-order public URL (e.g. the `mercadopublico.cl/.../DetailsAcquisition.aspx?idAcquisition=<codigo>` form the test fixture already hints at) so each row links to its own source record.

---

_Reviewed: 2026-06-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
