# 43-validation-packages — Adversarial Validation of `packages/*` Tech-Debt Findings

Validator: Opus, 1-by-1, every claim re-read at file:line. Date: 2026-06-24.
Source under review: `43-discovery-packages.md` (PKG-01 … PKG-13).

**Gates honored:** no PROD apply, no deploy, migrations 0001–0044 immutable, no
shipped-behavior change without a covering test. Verdicts only; no edits applied in this pass.

---

## PKG-01 — `onConflict` mismatch on `citacion_invitado` upsert

- **REAL or FALSE-POSITIVE:** **FALSE-POSITIVE** (re-read `writer-supabase.ts:84–105`,
  `0010_agenda.sql:36–43`, `0016_citacion_invitado_calidad.sql:1–24`).
- **Root cause of the false alarm:** The discovery agent diffed the writer against
  `0010_agenda.sql` ONLY and never opened `0016_citacion_invitado_calidad.sql`.
  Migration 0016 (titled exactly for this, "#43 code-review v1.0") does three things:
  1. `update citacion_invitado set calidad='' where calidad is null;`
  2. `alter column calidad set default '' , set not null;`
  3. `drop constraint citacion_invitado_citacion_id_nombre_key;`
     `add constraint citacion_invitado_citacion_id_nombre_calidad_key unique (citacion_id, nombre, calidad);`
  So the LIVE unique key is the 3-column `(citacion_id, nombre, calidad)`. The writer's
  `onConflict: "citacion_id,nombre,calidad"` (line 102) and its dedup key
  `${citacion_id} ${nombre} ${calidad}` (line 96) MATCH the live schema exactly. The
  writer even normalizes `calidad ?? ""` (line 91) to satisfy the NOT NULL DEFAULT ''.
  No later migration (checked 0017–0044 via grep) reverts it.
- **What breaks if "fixed" per discovery:** Changing `onConflict` to `"citacion_id,nombre"`
  would point at a constraint that NO LONGER EXISTS (dropped in 0016) → it would
  *introduce* the 42P10 crash the discovery imagined. The proposed fix is actively harmful.
- **Protecting test:** the agenda writer suite exercises the 3-col upsert; the
  in-code comment block (line 84) documents the 0016 rationale.
- **VERDICT: WON'T-FIX (no debt in the code).** The only real residue is the stale
  *top-of-file* comment — tracked separately as PKG-08.

## PKG-02 — Bare `catch{}` swallows `enqueueRevision` failure (RUT audit path)

- **REAL or FALSE-POSITIVE:** **REAL but severity overstated** (re-read
  `reconciliar-contrato.ts:404–406, 452–479`).
- **Root cause:** `encolarRevisionRut` wraps `await writer.enqueueRevision(caso)` in a
  bare `catch {}` (line 476). A Supabase flap loses the *queue* row with no log.
- **Discovery's claim is partly WRONG:** it says "the candidate does NOT automatically
  land in `revisionesRut`". False — line 404 `revisionesRut.push(candidato)` runs
  *before* the enqueue (line 405), and `revisionesRut` IS returned to the caller
  (line 429). So the audit RECORD survives in the returned channel; only the human-review
  *queue insert* is lost. The "audit trail disappears with zero trace" framing is
  overstated. Real loss = the queue entry + zero observability of that loss.
- **What breaks if left:** a queue insert can be silently dropped during a DB flap → a
  name-only RUT candidate is not surfaced for human review (but is still in the returned
  audit array, so a caller that persists `revisionesRut` retains it).
- **What breaks if touched:** adding `console.error(...)` is observability-only, NO
  control-flow change — safe. Re-throwing (discovery's "ideal") DOES change behavior:
  it would abort the per-contrato loop or bubble up, contradicting the documented
  best-effort contract — forbidden without a covering test.
- **Protecting test:** none today. The mock `enqueueRevision` (test line 44) always
  succeeds; the throw path is uncovered. A FIX-NOW must add a test where the mock throws
  and assert (a) the run completes, (b) the candidate is still in `revisionesRut`,
  (c) `console.error` was called.
- **VERDICT: FIX-NOW** (console.error only) **+ mandatory covering test.** Re-throw =
  WON'T-FIX (behavior change).
- **Exact minimal change:**
  ```ts
  // reconciliar-contrato.ts:474-478  BEFORE
  try {
    await writer.enqueueRevision(caso);
  } catch {
    /* best-effort: el candidato ya quedo en revisionesRut para auditoria; no abortar la corrida. */
  }
  // AFTER
  try {
    await writer.enqueueRevision(caso);
  } catch (err) {
    // best-effort: el candidato YA esta en revisionesRut (canal de auditoria devuelto); no se
    // aborta la corrida, pero el fallo se OBSERVA (antes se perdia sin rastro).
    console.error(
      `[dinero] enqueueRevision (RUT candidato ${candidato.parlamentarioId}) falló; ` +
        `el candidato sigue en revisionesRut:`,
      err instanceof Error ? err.message : err,
    );
  }
  ```
  Test (mirror `reconciliar-contrato.test.ts` mock): a `ThrowingWriter` whose
  `enqueueRevision` rejects → assert the returned `revisionesRut.length === 1` and the run
  resolves (no throw), and spy on `console.error`.

## PKG-03 — `LEGISLATURA_VIGENTE = 58` hardcoded, silently stale at 2030 boundary

- **REAL or FALSE-POSITIVE:** **REAL** (re-read `run-camara-votos.ts:35, 46–47, 130`).
- **Root cause:** `export const LEGISLATURA_VIGENTE = 58;` is the default for
  `legislaturaId` when no explicit `boletines`. Correct TODAY (Leg-58 = 2026–2030).
- **What breaks if left:** after the 2030 renewal (Leg-59) the discovery's failure mode
  is plausible — discovery by sessions of Leg-58 returns empty, `ingestadas: 0` is a
  valid success → votes silently stop. ~4-year fuse, not a live bug.
- **What breaks if touched:** discovery's fix (query Camara `doGet.asmx` for the current
  legislatura at runtime) adds a network call + new failure mode + changes the default
  path's behavior → behavior change needing live-connector tests. Out of scope for pure
  hygiene; it is also a value/operations decision (which legislatura to scan).
- **Protecting test:** `run-camara-votos.test.ts` pins behavior with injected
  `legislaturaId`; no test asserts auto-discovery of the current legislatura.
- **VERDICT: WON'T-FIX** as a code change in this phase (re-architecture of the default;
  4-year horizon). Acceptable lightweight hygiene IF desired: keep the constant but add a
  doc-comment with the boundary date and an operator note — that is a comment edit, not
  the discovery's runtime-query fix. Defer the runtime fix to a dedicated phase.

## PKG-04 — `reconciliar-contrato.ts` catch degrades to `no_confirmado` with live provider

- **REAL or FALSE-POSITIVE:** **FALSE-POSITIVE (confirmed, not rubber-stamped)** (re-read
  `reconciliar-contrato.ts:266, 329–340`).
- **Independent check:** `proveedorAusente = opts.provider === undefined` (line 266). The
  catch degrades to `no_confirmado` ONLY when `proveedorAusente` is true (no provider
  injected). With a real provider injected, `proveedorAusente` is `false` → `throw err`
  (line 339) propagates. An expired key / 429 from a real provider therefore PROPAGATES,
  not masked. The fail-closed contract is intact.
- **VERDICT: WON'T-FIX (no debt).** Discovery's own conclusion confirmed.

## PKG-05 — `reconciliar-aporte.ts` copy-paste of the catch pattern (PKG-02 sibling)

- **REAL or FALSE-POSITIVE:** **REAL as a fragility, NOT a bug** (re-read
  `reconciliar-aporte.ts:122, 145–157`).
- **Root cause:** the aporte catch is symmetric and correct, and crucially does NOT call
  `enqueueRevision` in the catch (no RUT-candidate path for aportes). So it has no PKG-02
  defect. The only issue is structural: the `proveedorAusente`/try-pipeline/catch shape is
  duplicated from `reconciliar-contrato.ts`.
- **What breaks if touched:** discovery proposes extracting a shared
  `reconciliarProveedorConPipeline(...)` helper. That is a refactor across two
  audit-sensitive files with subtly different bodies (contrato has the RUT-harvest switch;
  aporte does not). Extracting risks coupling two paths that are *intentionally* divergent
  → scope-creep re-architecture (gate 6), high blast radius on the compliance core.
- **Protecting test:** both `reconciliar-contrato.test.ts` and `reconciliar-aporte.test.ts`
  exist and pin current behavior; a shared helper would force re-shaping both.
- **VERDICT: WON'T-FIX** (re-architecture, risk > benefit). The duplication is shallow and
  the bodies legitimately differ.

## PKG-06 — DeepSeek/MiniMax providers lack app-level retry on 429/5xx

- **REAL or FALSE-POSITIVE:** **PARTIALLY REAL, claim over-specified** (re-read
  `deepseek.ts:50–84`, `minimax.ts:54–102`).
- **Root cause:** both clients are `new OpenAI({ apiKey, baseURL, fetch })` with NO
  explicit `maxRetries` → they inherit the SDK default (2 retries, exp backoff). There is
  no *application-level* retry loop, true. But the discovery's specific justification —
  "MiniMax 429 returns non-standard shapes the SDK doesn't recognize as retryable" — is
  cited as "undocumented" / "field reports show", i.e. UNVERIFIED. Severity is speculative.
- **What breaks if left:** if MiniMax's 429 is genuinely non-retryable-shaped, a weekly
  free-tier limit aborts a `clasificar-lobby-cli` batch with no partial save. Unproven.
- **What breaks if touched:** adding a 3-attempt backoff (or setting `maxRetries`) changes
  the network-call behavior of the compliance-critical LLM path and needs deterministic
  retry tests (injected fetch returning 429 then 200, assert single success; assert
  attempt count; assert no double-charge on success). That is behavior change.
- **Protecting test:** `minimax.test.ts` / `deepseek.test.ts` exist but pin happy-path +
  repair-loop, not retry-on-429.
- **VERDICT: WON'T-FIX in this phase** (behavior change on the sensitive LLM path,
  justification unverified). If pursued later, prefer the minimal `maxRetries: 3`
  constructor option (SDK-native, well-tested) over a hand-rolled loop, gated behind
  retry tests — a dedicated task, not hygiene.

## PKG-07 — `drift.ts` swallows insert errors with only `console.warn`

- **REAL or FALSE-POSITIVE:** **FALSE-POSITIVE (already remediated)** (re-read
  `drift.ts:70–91`).
- **Root cause:** the catch ALREADY logs `console.warn(...)` with source/resource/message
  (lines 86–89), and the inline comment cites "#13" — this exact observability gap was
  already closed. The empty-catch the discovery worried about does not exist anymore.
- **What breaks if touched:** discovery proposes R2-fallback persistence or
  `process.exitCode = 1`. Both are behavior changes that contradict the documented FND-04
  contract ("el drift NO bloquea la ingesta; el crudo ya se capturó"). Setting exitCode
  would fail CI runs on a non-fatal drift-log miss.
- **VERDICT: WON'T-FIX.** Current state is the intended design; discovery's proposal
  regresses the FND-04 contract.

## PKG-08 — Stale top-of-file comment documents wrong `onConflict`

- **REAL or FALSE-POSITIVE:** **REAL** (re-read `writer-supabase.ts:8` vs `:102`).
- **Root cause:** the header comment (line 8) still says
  `citacion_invitado → onConflict 'citacion_id,nombre' (unique)` — the pre-0016 key —
  while the live code (line 102) and the inline comment (line 84, which correctly cites
  "#43 ... NOT NULL DEFAULT '' desde 0016") use the 3-col key. Pure documentation drift;
  it is what misled the PKG-01 discovery.
- **What breaks if left:** future maintainers trust the header over the code (exactly what
  happened in PKG-01 discovery).
- **What breaks if touched:** none — comment-only edit, zero runtime/behavior impact,
  cannot affect tsc or tests.
- **Protecting test:** N/A (comment). tsc -b + agenda suite remain green by construction.
- **VERDICT: FIX-NOW** (pure hygiene, no behavior, no test needed).
- **Exact minimal change:**
  ```ts
  // writer-supabase.ts:8  BEFORE
  //   * citacion_invitado  → onConflict 'citacion_id,nombre' (unique)
  // AFTER
  //   * citacion_invitado  → onConflict 'citacion_id,nombre,calidad' (unique; calidad NOT NULL
  //                          DEFAULT '' desde 0016 — discrimina homónimos de distinta organización)
  ```

## PKG-09 — `writer-revision*.ts` `.insert().select()` result "ignored"

- **REAL or FALSE-POSITIVE:** **FALSE-POSITIVE (confirmed both files)** (re-read
  `writer-revision.ts:139–147`, `writer-revision-entidad.ts:124–132`).
- **Independent check:** both `enqueueRevision` destructure `const { error } = await
  ...insert([caso]).select()` and `if (error) throw new Error(...)`. The result is NOT
  ignored — the error is checked and thrown. `.select()` forces PostgREST to execute and
  surface the error. The seed's "result ignored" claim is wrong.
- **VERDICT: WON'T-FIX (no debt).** Confirmed clean.

## PKG-10 — cruces `actualizarSectorFicha` UPDATE without row-count check

- **REAL or FALSE-POSITIVE:** **REAL, LOW** (re-read `writer-supabase.ts:90–99`).
- **Root cause:** `.update({ sector_id }).eq("boletin", boletin)` checks `error` but not
  rows-affected. A non-existent/typo'd boletin → `error: null`, 0 rows → silent no-op;
  CLI reports success but `sector_id` stays NULL.
- **What breaks if touched:** to read rows-affected, PostgREST requires appending
  `.select()` to the update (returns the representation) — that itself changes the request
  shape (adds a `Prefer: return=representation` round-trip and a SELECT privilege need on
  the service role; service key bypasses RLS so privilege is fine). Then `if ((data ?? []).length === 0)`
  warn/throw. Adding a *throw* changes behavior (a stale boletin would now abort instead
  of no-op) → needs a test. A *warn-only* variant is observability-ish but still adds the
  `.select()` request change.
- **Protecting test:** none asserts zero-row handling today.
- **VERDICT: FIX-NOW (warn-only) IS DEFENSIBLE but borderline** — it changes the query
  (adds `.select()`) which is a behavior change to the wire request even if the observable
  contract is "still succeeds + now logs". Given gate strictness (no shipped-behavior
  change without a covering test) and LOW severity, classify **WON'T-FIX for an
  autonomous pass**; promote to a small tracked task with a test
  (`actualizarSectorFicha` on a non-existent boletin → asserts a warn, run still resolves).
  Not harmful to leave; the frontend already treats NULL sector as "sin clasificar".

## PKG-11 — `SECTOR_CODIGOS` duplicated from `SECTOR_CATALOGO` (not derived)

- **REAL or FALSE-POSITIVE:** **REAL, LOW** (re-read `sector.ts:23–60`; usage in
  `model.ts:27`, `prompt.ts:23`, `prompt-lobby.ts:18`, `golden-set.ts:38`).
- **Root cause:** `SECTOR_CODIGOS` (line 43) is a hand-written literal tuple. Its doc
  comment (line 40–41) *claims* it is "Derivada del catálogo … nunca puedan divergir" —
  which is FALSE; it is manually mirrored. The prompts feed the LLM from
  `SECTOR_CATALOGO`, but the zod gate (`z.enum(SECTOR_CODIGOS)`) validates against the
  twin. Add a sector to one and not the other → the LLM is offered a code that zod then
  nulls silently. Today they match (13/13, byte-for-byte per discovery's own non-finding).
- **CAUTION on the proposed fix (discovery understated TS risk):** `z.enum` requires a
  non-empty literal tuple `[string, ...string[]]`. `SECTOR_CATALOGO.map(s => s.codigo)`
  returns widened `string[]`, which `z.enum` REJECTS at the type level. Discovery's cast
  `as typeof SECTOR_CATALOGO[number]["codigo"][]` is still an array type, NOT a tuple →
  it will NOT satisfy `z.enum`'s signature and may not be tsc-clean. A correct derivation
  needs either a tuple-preserving cast
  (`SECTOR_CATALOGO.map(s => s.codigo) as unknown as [SectorCodigo, ...SectorCodigo[]]`)
  plus a runtime guard, or keeping the literal tuple and adding a TEST that asserts
  `SECTOR_CODIGOS` equals `SECTOR_CATALOGO.map(s=>s.codigo)`. The latter is the LOWER-RISK
  hygiene: it preserves the literal types (zod stays happy) and locks the invariant.
- **What breaks if touched (map-derive):** if the cast is wrong, `z.enum` type narrows to
  `string` → loses exhaustiveness on `SectorCodigo` consumers; potential tsc breakage.
- **Protecting test:** none guards the catalog/codigos sync today (no `sector.test.ts`).
- **VERDICT: FIX-NOW — but as a DRIFT-GUARD TEST, not the map-derive refactor.** Keep both
  arrays; add a unit test that fails if they diverge. This is provably green, zero runtime
  change, locks the invariant, and sidesteps the `z.enum` literal-tuple trap. Also fix the
  misleading "Derivada del catálogo" comment to "Mirror del catálogo — sincronía
  asegurada por test (sector drift-guard)".
- **Exact minimal change (test, new file `packages/cruces/src/sector.test.ts`):**
  ```ts
  import { describe, it, expect } from "vitest";
  import { SECTOR_CATALOGO, SECTOR_CODIGOS } from "./sector";

  describe("sector taxonomy drift-guard", () => {
    it("SECTOR_CODIGOS espeja exactamente los códigos de SECTOR_CATALOGO (orden incluido)", () => {
      expect([...SECTOR_CODIGOS]).toEqual(SECTOR_CATALOGO.map((s) => s.codigo));
    });
  });
  ```
  Plus the one-line comment correction at `sector.ts:40–41`.

## PKG-12 — `base-connector.ts:decodeJson` returns raw text on parse failure

- **REAL or FALSE-POSITIVE:** **REAL, LOW** (re-read `base-connector.ts:189–198`).
- **Root cause:** `decodeJson` falls back to returning the raw `string` when `JSON.parse`
  throws (XML/HTML). Return type is `unknown`; the soft fallback is intentional (the base
  class serves XML/HTML connectors too). A JSON-expecting subclass that casts before Zod
  could mis-handle an HTML error page.
- **What breaks if touched:** discovery proposes returning `{ __raw: text }` or throwing a
  `ParseError`. Both change the contract for EVERY subclass (Senado/BCN XML connectors
  legitimately rely on getting the text back) → broad behavior change, high blast radius,
  needs per-connector tests. The `unknown` return already forces callers to validate; the
  real safety net is the caller's Zod parse (the project's contract gate).
- **Protecting test:** connector tests assert Zod-validated outputs; no test pins
  decodeJson's text-fallback shape.
- **VERDICT: WON'T-FIX.** Intentional polymorphic contract; the Zod gate at the call sites
  is the correct guard. Changing the return shape is re-architecture.

## PKG-13 — `validate.ts:safeJsonParse` returns `undefined` on parse failure

- **REAL or FALSE-POSITIVE:** **REAL, LOW** (re-read `validate.ts:62–69`).
- **Root cause:** malformed-JSON and genuinely-undefined collapse to the same `undefined`
  → the repair loop still functions, but the reprompt message derives from a Zod
  "Required/Invalid type" issue rather than naming the parse failure. The original LLM
  text (e.g. a refusal) is lost from logs. Convergence/observability nit, not a bug — the
  repair loop is the correct control flow.
- **What breaks if touched:** adding a `console.warn` (with first ~50 chars of `raw`) is
  observability-only, NO control-flow change. Passing the parse error as extra reprompt
  context (discovery's "optional") WOULD change the prompt sent to the model = behavior
  change on the LLM path → needs convergence tests; out of scope.
- **CAUTION:** `raw` may contain model output; logging a 50-char prefix is acceptable
  (RUT/PII never reaches output here — inputs are RUT-gated, and this is the response), but
  keep the prefix short and do not log full content.
- **Protecting test:** `validate` tests pin repair-loop convergence; none asserts the
  log on non-JSON.
- **VERDICT: FIX-NOW (console.warn observability only).** No behavior change, no test
  strictly required (log is not a contract); optionally add a spy test. Do NOT add the
  parse error to the reprompt (that is the behavior-changing variant — defer).
- **Exact minimal change:**
  ```ts
  // validate.ts:62-69  BEFORE
  function safeJsonParse(raw: string | undefined): unknown {
    if (raw === undefined) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  // AFTER
  function safeJsonParse(raw: string | undefined): unknown {
    if (raw === undefined) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      // Observabilidad: JSON inválido se trata como undefined (el repair loop lo maneja),
      // pero antes se perdía sin rastro la respuesta no-JSON del modelo (p.ej. un rechazo).
      console.warn(
        `[validate] JSON.parse falló; se trata como undefined. raw[0..50]=${JSON.stringify(raw.slice(0, 50))}`,
      );
      return undefined;
    }
  }
  ```

---

## SUMMARY TABLE

| Finding | Title (short) | Verdict | One-line reason |
|---|---|---|---|
| PKG-01 | agenda onConflict 3-col mismatch | **WON'T-FIX** | FALSE-POSITIVE: 0016 added the 3-col unique; writer matches live schema. Discovery skipped 0016; its fix would *introduce* the crash. |
| PKG-02 | bare catch on enqueueRevision | **FIX-NOW** (console.error only) + test | REAL but overstated; candidate still in returned `revisionesRut`. Add log + a throwing-writer test. Re-throw = WON'T-FIX. |
| PKG-03 | LEGISLATURA_VIGENTE=58 stale | **WON'T-FIX** | REAL but 4-yr fuse; runtime-query fix = behavior change + network dep, needs its own phase. |
| PKG-04 | catch degrades with live provider | **WON'T-FIX** | FALSE-POSITIVE confirmed: `proveedorAusente` guard re-throws with a real provider. |
| PKG-05 | aporte catch copy-paste | **WON'T-FIX** | REAL fragility only; extracting a shared helper couples intentionally-divergent compliance paths (scope creep). |
| PKG-06 | no app-level retry on 429/5xx | **WON'T-FIX** (this phase) | Partially real; SDK default=2 retries; MiniMax justification unverified; retry = behavior change needing tests. |
| PKG-07 | drift.ts swallows insert error | **WON'T-FIX** | FALSE-POSITIVE: already logs console.warn (#13 fixed); proposed exitCode/R2 regresses FND-04. |
| PKG-08 | stale header comment | **FIX-NOW** | REAL pure-doc hygiene; comment-only, zero behavior/test impact. |
| PKG-09 | writer-revision result ignored | **WON'T-FIX** | FALSE-POSITIVE confirmed both files: `{error}` checked + thrown; `.select()` forces execution. |
| PKG-10 | UPDATE no row-count check | **WON'T-FIX** (autonomous) | REAL LOW; warn requires adding `.select()` = wire change; promote to tracked task w/ test. |
| PKG-11 | SECTOR_CODIGOS duplicated | **FIX-NOW** (drift-guard test, NOT map-derive) | REAL LOW; map-derive trips `z.enum` literal-tuple typing; lock with a sync test instead + fix comment. |
| PKG-12 | decodeJson returns raw text | **WON'T-FIX** | REAL LOW but intentional polymorphic contract; Zod gate at callers is the guard; reshaping = re-architecture. |
| PKG-13 | safeJsonParse undefined-collapse | **FIX-NOW** (console.warn only) | REAL LOW; observability-only log; do NOT feed parse error to reprompt (behavior change). |

**FIX-NOW (autonomous, provably green, gated):** PKG-02 (log + covering test),
PKG-08 (comment), PKG-11 (drift-guard test + comment), PKG-13 (log).
**WON'T-FIX:** PKG-01, PKG-03, PKG-04, PKG-05, PKG-06, PKG-07, PKG-09, PKG-10, PKG-12.
**CHECKPOINT-OPERADOR:** none — no finding requires a PROD migration/deploy/secret/flag.
(PKG-01 would have, had it been real; it is not.)

**Severity corrections vs discovery:** PKG-01 critical→none (false positive, fix harmful);
PKG-02 high→medium (audit record survives in returned array; only queue insert + log lost);
PKG-06 medium→low/unproven (justification unverified); PKG-11 fix-path is riskier than
discovery stated (z.enum literal-tuple) → use a test, not the refactor.
