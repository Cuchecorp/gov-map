---
phase: 15-money-financiamiento-servel-verbatim-sub-maestra-de-donantes
reviewed: 2026-06-19T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - packages/dinero/src/model-servel.ts
  - packages/dinero/src/parse-servel.ts
  - packages/dinero/src/reconciliar-aporte.ts
  - packages/dinero/src/reconciliar-completitud.ts
  - packages/dinero/src/connector-servel.ts
  - packages/dinero/src/storage-supabase.ts
  - packages/dinero/src/writer-servel.ts
  - packages/dinero/src/writer-supabase-servel.ts
  - packages/dinero/src/ingest-run-servel.ts
  - packages/dinero/src/ingest-cli-servel.ts
  - supabase/migrations/0024_servel.sql
  - supabase/tests/0025_servel.test.sql
  - app/components/financiamiento-de-parlamentario.tsx
  - app/components/financiamiento-de-parlamentario.test.tsx
  - app/app/parlamentario/[id]/page.tsx
  - app/lib/types.ts
  - .env.example
  - packages/dinero/package.json
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: warnings_resolved
warnings_resolved_at: 2026-06-19
warnings_resolution:
  WR-01: "fixed — 373178f"
  WR-02: "fixed — 354c732"
  WR-03: "fixed — e3fae68 (+ tsc cast 4c6cba4)"
  WR-04: "fixed — d3e1941 (remote re-apply pending: OPERATOR action)"
  WR-05: "fixed — e173c76"
test_gate: "PASSED — pnpm exec vitest run packages/dinero (73/73) + tsc -b @obs/dinero clean"
---

# Phase 15: Code Review Report

**Reviewed:** 2026-06-19
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Phase 15 implements the SERVEL campaign-financing slice inside `@obs/dinero`: a fragile xlsx connector with run-level blocking quarantine, a name-based candidate→parlamentario link via the identity pipeline, a deny-by-default donor sub-master, and a gated ficha section. I reviewed all six hard SECURITY + HONESTY rules and traced each end-to-end.

**The six hard rules all hold:**

1. **Data-routing gate — VERIFIED REAL.** `reconciliar-aporte.ts` constructs the `MencionForanea` (the only payload reaching `correrPipeline`/LLM) exclusively from `candidatoNombreVerbatim` (lines 129–144). No donor field (`donanteNombre`, `tipoPersona`, `rutDonante`) is ever referenced in the pipeline path. `MencionForanea`/`Mention` structurally have no donor field, and `pipeline.ts` builds the LLM `Mention` only from name/cámara/periodo. The dedicated test (`reconciliar-aporte.test.ts` lines 191–240) asserts the donor string never appears in vínculo writes, revision queue, or any LLM prompt. Gate is structural, not a comment.
2. **Identity link integrity (IDENT-12) — VERIFIED.** Only `res.tipo === "determinista"` mints `confirmar()`/`EnlaceConfirmado` and populates the FK; `probable`/`revision`/`no_confirmado` → null + `no_confirmado` (lines 159–173). Fail-closed default provider throws on ambiguity rather than guessing. Mirrors `reconciliar-sujeto.ts` exactly.
3. **Donor protection — VERIFIED.** `0024_servel.sql` `donante` table: RLS enabled (line 138), zero policies, `revoke all ... from anon, authenticated` (line 146). RPC `aportes_de_parlamentario` is `security definer` and projects no donor RUT/`donante_id`. `0025_servel.test.sql` triple-asserts deny-by-default (lines 82–92) and asserts the RPC body `not ilike '%rut_donante%'` (lines 124–126).
4. **Blocking run-level quarantine — VERIFIED.** `ingest-run-servel.ts` quarantines the whole run on header drift (lines 144–153) or completeness mismatch (lines 162–171) with `continue` before any upsert. `reconciliar-completitud.ts` is fail-closed (no anchor → `{ok:false}`). Tests assert 0 upserts on each quarantine path.
5. **SSRF — VERIFIED.** `SERVEL_HOST` is added via `extraHosts`, which `assertAllowedUrl` matches by EXACT hostname equality (`allowlist.ts:117`, `===`), never as a `windows.net` suffix; https is re-asserted in the connector (line 158). Error messages strip the querystring (`urlSinQuery`).
6. **Honesty/UI — VERIFIED.** Heading non-possessive and gated in `page.tsx`; link line reads "Asociado por nombre confirmado al candidato." (not "por RUT"); donor RUT never rendered (no field in `AporteRow`); 3 honest states textually distinct; attribution "términos por verificar" not CC BY 4.0. Component tests assert each.

No blocker-tier defects found. The warnings below are correctness/robustness gaps that do not breach the six locked rules but should be addressed.

## Warnings

### WR-01: `eleccion` drift guard is silently defeated whenever `--anio` is provided

**RESOLVED** (commit `373178f`): `componerEleccion` now derives `eleccion` only from row-level components (`ELECCION`/`TERRITORIO`); `--anio` is appended only when a row component is present and never substitutes a missing row period. A row missing both columns now THROWS (run-level quarantine) even with `--anio` set. Tests added for the `--anio`-passed + missing-columns path (throws) and the anio-appended path.

**File:** `packages/dinero/src/parse-servel.ts:107-117, 193-200`
**Issue:** `componerEleccion` builds the (NON-NULL, load-bearing) `eleccion` from `[eleccionCol, territorio, anio]` with `.filter(non-empty)` and returns non-null if ANY part is present. Because `anio` is a per-run constant supplied by the operator (`--anio YYYY`), every row gets a non-null `eleccion` equal to just the year even when the row's own `ELECCION` and `TERRITORIO` cells are both blank. The "fila sin eleccion construible → THROW" drift guard (lines 194–200) therefore only fires when `anio` is also null. CONTEXT/PATTERNS mark a row without a per-row period as drift that must quarantine the run; with `--anio` set (the normal LIVE path) a row missing its real election columns is emitted with a bare year as its "period", silently mis-grouping it on the ficha. The test at `parse-servel.test.ts:89-95` only exercises the `anio: null` case, so this gap is untested.
**Fix:** Require at least one row-level period component before falling back to the run-level year. e.g. derive `eleccion` only from `[eleccionCol, territorio]`; if both are empty → drift/THROW regardless of `anio`. If a composite with the year is still desired, gate it: `if (eleccionCol == null && territorio == null) return null;` then append `anio` to the non-empty row parts.

### WR-02: Silently dropped rows when only non-key columns are populated

**RESOLVED** (commit `354c732`): the empty-row guard now inspects all 11 mapped cells. A row with content only in non-key columns is no longer dropped silently; it reaches `componerEleccion` and — lacking `ELECCION`/`TERRITORIO` — THROWS (run-level quarantine). Truly blank rows (all 11 cells null) are still omitted. Tests added for both paths.

**File:** `packages/dinero/src/parse-servel.ts:184-191`
**Issue:** The empty-row skip checks only 6 of 11 columns (`tipoAporte || donanteNombre || candidatoNombre || eleccionCol || territorio || monto`). A row where ALL of those are blank but `fechaTransferencia`, `tipoAportante`, `tipoDonatario`, `pacto`, or `partido` carry data is treated as "fully empty" and `continue`d — dropped with no quarantine and no count. For a connector whose stated posture is "una fila silenciosa es peor que ninguna fila," a row with real source content being silently discarded contradicts the blocking-drift contract.
**Fix:** Either base `algunDato` on whether ANY of the 11 mapped cells is non-null (drop only truly blank rows), or treat a row with partial-but-non-key data as drift → THROW. Keeping the skip narrow risks dropping a real aporte.

### WR-03: Storage idempotency regex can mask genuine upload failures

**RESOLVED** (commit `e3fae68`, tsc cast `4c6cba4`): replaced the loose `/exists|duplicate|409/i` regex with a structured check (`statusCode`/`status` 409, the canonical `error: "Duplicate"`, or an anchored `the resource already exists` message). Only the real duplicate is swallowed; `Bucket not found`/`does not exist` and any substring-`exist` non-duplicate now THROW. Tests added for the 404/not-found and substring-`exist` paths.

**File:** `packages/dinero/src/storage-supabase.ts:86-92`
**Issue:** On any upload error, `if (/exists|duplicate|409/i.test(error.message)) return key;` swallows the error as "expected idempotency." This substring match is too broad: Supabase Storage surfaces a missing-bucket / not-found condition with messages that can contain the substring "exist" (e.g. "Bucket not found" variants, "does not exist", localized strings), and any future provider error containing "exists" would be silently treated as a successful upload. The function would then return a `key` for an object that was never stored, and the run would report the raw as captured when it is not — a recoverability gap for the very raw-archive this helper exists to guarantee.
**Fix:** Match the idempotency case precisely. Prefer the structured error (Supabase storage errors expose `statusCode`/`status` — check `=== 409` or the canonical "Duplicate"/"already exists" code) rather than a loose regex over the human message; on anything else, THROW.

### WR-04: No DB-level guard against `parlamentario_id` set with `estado_vinculo = 'no_confirmado'`

**RESOLVED** (commit `d3e1941`): added a table CHECK `aporte_parlamentario_solo_confirmado check (parlamentario_id is null or estado_vinculo = 'confirmado')` to `0024_servel.sql`, enforcing IDENT-12 at the data layer even if the (RLS-bypassing) writer regresses. Matching pgTAP assertion (`col_has_check`) added and `plan(23)`→`plan(24)`. NOTE: remote re-apply (`supabase db push --db-url`) is an OPERATOR action and was NOT performed here.

**File:** `supabase/migrations/0024_servel.sql:76-81`
**Issue:** The fail-closed invariant "a `no_confirmado` aporte NEVER hangs off a parlamentario" is enforced only in application code (`reconciliar-aporte.ts`). The schema's CHECK constrains `estado_vinculo IN ('confirmado','no_confirmado')` but does not couple it to `parlamentario_id`. Since `aporte` is written with the bypass-RLS service key, a future writer bug (or a manual/batch insert) could populate `parlamentario_id` while `estado_vinculo` is `no_confirmado` or null, and the public RPC filters purely on `parlamentario_id = p_id` — so a non-confirmed link would surface on the ficha as a confirmed attribution. This is the highest-impact honesty surface (a mis-attributed aporte) and currently has no defense-in-depth at the data layer.
**Fix:** Add a table CHECK enforcing the coupling, e.g. `check (parlamentario_id is null or estado_vinculo = 'confirmado')`. This makes the "only confirmed links hang off a parlamentario" rule true even if the writer regresses.

### WR-05: Run-level `eleccion` is not validated as non-empty before a live run

**RESOLVED** (commit `e173c76`): added a per-task boundary guard at the top of the loop in `runIngestServel` — an empty/whitespace `eleccion` or `url` yields 0 rows for that task and never reaches `subirCrudo`/`marcarIngestado`, recorded as an error + degradation. This enforces rule #4 on the injected-connector and direct-call paths, not just the CLI's `conector === undefined` branch. Tests added for the empty-`eleccion` and empty-`url` paths.

**File:** `packages/dinero/src/ingest-cli-servel.ts:114-124`, `packages/dinero/src/ingest-run-servel.ts:107-108`
**Issue:** Hard rule #4 states "invalid/missing `eleccion` → throw." The CLI only throws on empty `eleccion`/`url` when `opts.conector === undefined` (line 117); when a connector is injected (or the run function is called directly) an empty `eleccion: ""` flows through. `runIngestServel` then builds `clave = "eleccion:"`, the storage `slug("")` falls back to `"sin-eleccion"`, and the marcador/key are built around an empty election slug — a silent mislabeling rather than a throw. The orchestrator never validates `tarea.eleccion`.
**Fix:** Validate at the run boundary: at the top of the per-task loop in `runIngestServel`, `if (!tarea.eleccion?.trim() || !tarea.url?.trim()) throw new Error(...)` (or push a quarantine degradation). Do not let an empty election slug reach storage/marcador.

## Info

### IN-01: `tipo_persona` null defaults to "persona natural" in the UI

**File:** `app/components/financiamiento-de-parlamentario.tsx:132-133, 150-151`
**Issue:** When `tipo_persona` is null, `esJuridica` is false and the row renders "(persona natural)" — an asserted classification the source did not publish. This is a (small) fabrication of a published attribute in a section whose whole contract is verbatim honesty. The null-tolerance test (lines 346–369) even locks this default in.
**Fix:** Render a neutral fallback when `tipo_persona` is null (e.g. omit the parenthetical, or show "(tipo de aportante no publicado)"), reserving "persona natural"/"persona jurídica" for when the source actually labels it.

### IN-02: Test plan count is hand-maintained and can drift

**File:** `supabase/tests/0025_servel.test.sql:23`
**Issue:** `select plan(23);` is a hard-coded count; the file contains 23 assertions today, but any added/removed assertion silently desyncs the plan, turning a real coverage change into a confusing pgTAP failure or false pass. Minor, but worth a note since the migration apply + pgTAP is the operator's only real verification checkpoint.
**Fix:** Consider `select * from no_plan();` ... `select * from finish();` if the harness allows, or keep a comment tying the count to the assertion list.

### IN-03: Connector `HeadFn` failures degrade completeness silently to "no anchor"

**File:** `packages/dinero/src/connector-servel.ts:83-96, 169-174`
**Issue:** A failing or non-OK HEAD returns all-null anchors. Combined with `reconciliar-completitud`'s fail-closed "no anchor → quarantine," this is safe (it quarantines rather than emits), but the run surfaces the quarantine as a generic "sin ancla de completitud" rather than "HEAD failed." Operationally that masks a transient blob-HEAD outage as a structural-completeness problem. Informational; the safety posture is correct.
**Fix:** Distinguish "HEAD failed/blocked" from "HEAD succeeded but exposed no Content-MD5/Length" in the degradation `motivo` for operator clarity.

### IN-04: `.env.example` retains R2 keys while the raw path is Supabase Storage

**File:** `.env.example:9-14, 60-68`
**Issue:** R2 vars remain populated as the "crudo inmutable" destination while the Phase 15 raw path is Supabase Storage (R2 is documented operator debt, 401). The SERVEL block does note this, but the stale R2 header ("crudo inmutable") can mislead an operator into thinking R2 is the live raw sink. Documentation hygiene only.
**Fix:** Annotate the R2 block as operator-debt/unused-for-SERVEL, or move the "raw goes to Supabase Storage" note adjacent to it.

---

_Reviewed: 2026-06-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
