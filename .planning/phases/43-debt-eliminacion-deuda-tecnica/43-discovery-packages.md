# 43-discovery-packages — Premortem Tech-Debt Discovery: `packages/*`

Scanned: all 13 packages (`adjudication`, `agenda`, `core`, `cruces`, `dinero`, `fichas`,
`identity`, `ingest`, `llm`, `lobby`, `probidad`, `tramitacion`, `votos`).
Date: 2026-06-24. Verified every claim against file:line.

---

## CRITICAL

### PKG-01: `onConflict` mismatch — `citacion_invitado` upsert references non-existent unique index
- **Package:** agenda
- **File:** `packages/agenda/src/writer-supabase.ts:102`
- **Evidence:**
  ```ts
  .upsert(lote, {
    onConflict: "citacion_id,nombre,calidad",   // line 102
    ignoreDuplicates: false,
  });
  ```
  Migration `supabase/migrations/0010_agenda.sql:42` defines:
  ```sql
  unique (citacion_id, nombre)
  ```
  There is no unique constraint on `(citacion_id, nombre, calidad)`. The top-of-file comment at
  `writer-supabase.ts:8` also documents the wrong constraint (`citacion_id,nombre` vs the actual
  3-column string used in code).
- **Repro:** PostgREST responds with `42P10` ("there is no unique constraint matching the ON
  CONFLICT specification") on any `upsertCitaciones` call that has at least one invitado. Every
  agenda ingest run that writes a citacion with invitados silently aborts that lote with an error
  (the `if (error) throw` on line 105 surfaces it), crashing the run.
- **Severity:** critical
- **Blast radius:** Weekly agenda ingest fails on weeks with committee invitees. `citacion_invitado`
  table stays empty. Frontend `/agenda` shows citaciones without participants.
- **Proposed fix:** Change `onConflict` to `"citacion_id,nombre"` to match the actual migration
  constraint. Alternatively, add `unique (citacion_id, nombre, calidad)` to the migration and drop
  the old constraint — but that is a schema change requiring a new migration and the 2-column
  constraint is semantically correct (a person can appear once per citacion regardless of calidad).
  Simplest: fix the `onConflict` string and update the dedup key on line 96 to match.

---

## HIGH

### PKG-02: Bare `catch{}` swallows enqueue failure on a sensitive audit path
- **Package:** dinero
- **File:** `packages/dinero/src/reconciliar-contrato.ts:474-478`
- **Evidence:**
  ```ts
  try {
    await writer.enqueueRevision(caso);
  } catch {
    /* best-effort: el candidato ya quedo en revisionesRut para auditoria; no abortar la corrida. */
  }
  ```
  This `enqueueRevision` call pushes a RUT-candidacy case to the human-review queue (`caso`
  contains `motivo` naming the unverified provider-parliamentarian binding). The comment is
  misleading: the candidate does NOT automatically land in `revisionesRut` at this point — that is
  an in-memory list populated earlier in the same function, not a DB write. If Supabase is
  degraded, the audit trail for the RUT-candidate disappears with zero trace.
- **Repro:** Supabase connection flap during a ChileCompra ingest run → `enqueueRevision` throws
  → swallowed → no log, no record in `revision_entidad` queue → name-only RUT bindings proceed
  unaudited.
- **Severity:** high
- **Blast radius:** Silent loss of human-review queue entries for unconfirmed RUT-ownership links.
  Violates the design contract that every "RUT candidate by name" gets queued for review before
  any master-RUT write.
- **Proposed fix:** Log the error at minimum (`console.error`) so ops can detect the loss. Ideally
  re-throw and let the outer per-contrato catch degrade the single contract to `no_confirmado`,
  preserving the audit expectation.

### PKG-03: `LEGISLATURA_VIGENTE = 58` is a hardcoded constant that silently becomes stale
- **Package:** votos
- **File:** `packages/votos/src/run-camara-votos.ts:35`
- **Evidence:**
  ```ts
  export const LEGISLATURA_VIGENTE = 58;
  ```
  Used on line 130 as the default for `legislaturaId` when `opts.boletines` is omitted. The
  2026–2030 legislature IS 58; when the 2030–2034 legislature begins (Leg-59) and the new cohort
  of deputies starts voting, the cron job will query the wrong period and return zero new
  boletines silently (Camara API returns empty for wrong legislaturaId).
- **Repro:** After the 2030 congressional renewal, `runCamaraVotos({limite: 100})` scans Leg-58
  sessions → finds no new sessions → exits with `ingestadas: 0`. Votes stop flowing into the DB
  without any alarm.
- **Severity:** high
- **Blast radius:** Vote ingestion silently stops at the legislature boundary. `votos` table goes
  stale from 2030. No alert fires because `ingestadas: 0` is a valid success code.
- **Proposed fix:** Query the Camara API for the current legislature id at runtime (`doGet.asmx`
  returns legislaturas) and use it as the default. Keep the constant as a fallback but log a
  warning when it is used without cross-checking.

### PKG-04: `reconciliar-contrato.ts` bare catch silently degrades match to `no_confirmado` when LLM call fails with a LIVE provider
- **Package:** dinero
- **File:** `packages/dinero/src/reconciliar-contrato.ts:329-340`
- **Evidence:**
  ```ts
  try {
    pres = await correrPipeline(mencion, maestra, provider, writer);
  } catch (err) {
    if (proveedorAusente) {
      out.push(filaParaEscribir(c, null, "no_confirmado", entidadId));
      continue;
    }
    // Con un provider real inyectado, un error del LLM SI propaga (no se enmascara).
    throw err;
  }
  ```
  The re-throw path IS correct. However `proveedorAusente = opts.provider === undefined`. If the
  caller passes a provider whose API key is expired or rate-limited (throwing `FetchError`), the
  `proveedorAusente` guard is `false` so it re-throws — that is actually correct behavior here.
  This finding is a FALSE POSITIVE: the code is correct. Documenting here as "no debt" for
  completeness.
- **Repro:** N/A — correct behavior confirmed.
- **Severity:** low (false positive, no action needed)
- **Blast radius:** None.
- **Proposed fix:** No action.

---

## MEDIUM

### PKG-05: `reconciliar-aporte.ts` parallel bare-catch mirrors reconciliar-contrato (PKG-02 sibling)
- **Package:** dinero
- **File:** `packages/dinero/src/reconciliar-aporte.ts:148`
- **Evidence:**
  ```ts
  } catch (err) {
    if (proveedorAusente) {
      out.push(filaParaEscribir(aporte, null, "no_confirmado"));
      continue;
    }
    throw err;
  }
  ```
  Unlike PKG-02, the sibling `reconciliarAporte` does NOT call `enqueueRevision` in a bare catch.
  The catch here is symmetric and correct (same proveedorAusente guard). Minor: the pattern is
  copy-pasted from `reconciliar-contrato.ts` — any future modification to one must be applied to
  the other or divergence silently changes behavior. Not a bug today; a copy-paste coupling risk.
- **Repro:** No immediate bug. Risk: future change to one without the other.
- **Severity:** medium
- **Blast radius:** Logic divergence if one file is updated without the other.
- **Proposed fix:** Extract a shared `reconciliarProveedorConPipeline(mencion, maestra, provider,
  writer, proveedorAusente)` helper reused by both. Eliminates the copy-paste coupling.

### PKG-06: `DeepSeek` and `MiniMax` providers have no application-level retry on 429 / 5xx
- **Package:** llm
- **File:** `packages/llm/src/providers/deepseek.ts:78-83`,
  `packages/llm/src/providers/minimax.ts:82-102`
- **Evidence:**
  ```ts
  const callModel = async (): Promise<string | undefined> => {
    const res = await this.client.chat.completions.create({ ... });
    return res.choices[0]?.message?.content ?? undefined;
  };
  const first = await callModel();
  ```
  Neither provider wraps `callModel()` in a retry loop for `429`/`5xx`. The OpenAI SDK v5
  defaults to 2 retries with exponential backoff; DeepSeek's OpenAI-compat endpoint honors this.
  But MiniMax's endpoint behavior with the OpenAI SDK retry is undocumented; field reports show
  its `429` sometimes returns non-standard error shapes that the SDK does not recognize as
  retryable, causing a hard throw on the first 429.
- **Repro:** MiniMax `429` (weekly free-tier limit hit) → SDK throws unrecognized error → caught
  as `LLMValidationError` or re-thrown as-is → `clasificarContraparte` fails → the whole
  clasificar-lobby-cli batch fails with no partial progress saved.
- **Severity:** medium
- **Blast radius:** Batch lobby classification fails entirely when MiniMax hits rate limits. No
  partial save → must restart from scratch.
- **Proposed fix:** Wrap `callModel()` in a 3-attempt exponential backoff that catches any error
  with `status === 429` or `isRetryable` (the SDK exports a helper). Or use the `maxRetries`
  constructor option on the OpenAI client for MiniMax.

### PKG-07: `ingest/src/drift.ts` swallows drift-alert insert errors with only a `console.warn`
- **Package:** ingest
- **File:** `packages/ingest/src/drift.ts:75-90`
- **Evidence:**
  ```ts
  } catch (e) {
    console.warn(
      `[drift] no se pudo registrar drift_alert (${source}/${resource}):`,
      e instanceof Error ? e.message : e,
    );
  }
  ```
  When the drift-alert insert fails (Supabase degraded), the warn is emitted to stdout. In Edge
  Function / CI context the log goes to the function log and may not reach an alerting system.
  The ingested raw bytes are safe in R2, but the drift event is lost.
- **Repro:** Supabase write outage during a tramitacion ingest → drift alert lost → structural
  changes in source data go undetected until the next successful alert insert.
- **Severity:** medium
- **Blast radius:** Silent loss of schema-drift events. Operators may miss source format changes
  that require parser updates.
- **Proposed fix:** Persist drift alerts to R2 as a fallback (e.g., `r2.put(driftKey, payload)`)
  when Supabase insert fails. Or at minimum, add an explicit `process.exitCode = 1` to signal the
  CI runner that something important was lost.

### PKG-08: `agenda/src/writer-supabase.ts` top-of-file comment documents wrong `onConflict` for `citacion_invitado`
- **Package:** agenda
- **File:** `packages/agenda/src/writer-supabase.ts:8`
- **Evidence:**
  ```ts
  //   * citacion_invitado  → onConflict 'citacion_id,nombre' (unique)
  ```
  The comment says `citacion_id,nombre` (the correct migration constraint) while the actual code
  on line 102 uses `"citacion_id,nombre,calidad"`. This is the same root cause as PKG-01 but
  worth calling out separately as a documentation debt that masked the bug.
- **Repro:** See PKG-01.
- **Severity:** medium (documentation; root bug is PKG-01)
- **Blast radius:** Misleads future maintainers into trusting the comment over the code.
- **Proposed fix:** Fix together with PKG-01.

---

## LOW

### PKG-09: Seed signal FALSE — `writer-revision.ts` `.insert().select()` return IS checked
- **Package:** adjudication
- **File:** `packages/adjudication/src/writer-revision.ts:140-146`,
  `packages/adjudication/src/writer-revision-entidad.ts:125-131`
- **Evidence:**
  ```ts
  const { error } = await this.client
    .from(TABLA_REVISION)
    .insert([caso])
    .select();
  if (error) {
    throw new Error(`enqueueRevision falló: ${error.message}`);
  }
  ```
  Both `enqueueRevision` implementations destructure `{ error }` and throw. The `.select()` is
  intentional: it forces PostgREST to execute the insert and surface errors (without `.select()`
  PostgREST silently swallows insert errors on some versions). The seed claim that the result is
  "ignored" is incorrect.
- **Repro:** No bug.
- **Severity:** low (false positive)
- **Blast radius:** None.
- **Proposed fix:** No action.

### PKG-10: `cruces/src/writer-supabase.ts` — UPDATE without row-count check; silent no-op on stale boletin
- **Package:** cruces
- **File:** `packages/cruces/src/writer-supabase.ts:94-98`
- **Evidence:**
  ```ts
  const { error } = await this.client
    .from("proyecto_ficha")
    .update({ sector_id })
    .eq("boletin", boletin);
  if (error) throw new Error(`actualizarSectorFicha falló: ${error.message}`);
  ```
  PostgREST returns `error: null, data: []` (0 rows updated) when `boletin` does not exist. The
  caller does not check `data?.length`. A typo in boletin or a deleted row causes the sector
  assignment to silently drop.
- **Repro:** `clasificarFicha` returns a sector for boletín `"18296-08"` but the DB row has
  `"18296"` (suffix trimmed). `actualizarSectorFicha` returns 0 rows, no error. The sector_id
  never gets written. `clasificar-fichas-cli` reports success.
- **Severity:** low
- **Blast radius:** Sector classification appears successful but sector_id stays NULL. Sector
  filter on the frontend silently drops items.
- **Proposed fix:** Check `(data ?? []).length === 0` and log a warning (or throw) on zero-row
  update. Normalize boletin format before calling.

### PKG-11: `SECTOR_CODIGOS` is defined redundantly (duplicated from `SECTOR_CATALOGO`)
- **Package:** cruces
- **File:** `packages/cruces/src/sector.ts:43-57`
- **Evidence:**
  ```ts
  export const SECTOR_CATALOGO = [
    { codigo: "salud", ... },
    ...
  ] as const;

  export const SECTOR_CODIGOS = [
    "salud",
    ...
  ] as const;
  ```
  The two arrays are manually kept in sync. If a new sector is added to `SECTOR_CATALOGO` but not
  to `SECTOR_CODIGOS` (or vice-versa), the zod enum becomes inconsistent with the seed.
- **Repro:** Developer adds `{ codigo: "defensa", etiqueta: "Defensa" }` to SECTOR_CATALOGO but
  forgets SECTOR_CODIGOS → the LLM is allowed to return `"defensa"` in the prompt but zod
  rejects it → all `"defensa"` classifications become `null` silently.
- **Severity:** low
- **Blast radius:** Silent classification null for any new sector not mirrored in SECTOR_CODIGOS.
- **Proposed fix:** Derive `SECTOR_CODIGOS` from `SECTOR_CATALOGO`:
  ```ts
  export const SECTOR_CODIGOS = SECTOR_CATALOGO.map(s => s.codigo) as
    typeof SECTOR_CATALOGO[number]["codigo"][];
  ```
  Or use `as const` + `satisfies` to enforce the array is derived.

### PKG-12: `ingest/src/base-connector.ts:decodeJson` catches parse errors and returns raw text, silently changing the return type
- **Package:** ingest
- **File:** `packages/ingest/src/base-connector.ts:190-198`
- **Evidence:**
  ```ts
  protected decodeJson(body: Uint8Array): unknown {
    const text = new TextDecoder().decode(body);
    try {
      return JSON.parse(text);
    } catch {
      // Shape-guard suave: si no es JSON, devolver el texto (XML/HTML crudo).
      return text;
    }
  }
  ```
  The return type is `unknown` but callers that subclass `BaseConnector` and call `decodeJson`
  may expect an object. If the source returns HTML (e.g., a 200 with an error page) the caller
  gets a `string`, not an object, and Zod validation will catch it — but only if the caller uses
  Zod. Subclasses that cast the result before validation may miss this.
- **Repro:** Camara doGet.asmx returns an HTML captcha page instead of JSON on WAF challenge →
  `decodeJson` returns the HTML string → caller casts as `DoGetResponse` → runtime error when
  accessing `.result` or `.data`.
- **Severity:** low
- **Blast radius:** Connector silently parses error pages as data. Downstream Zod parse will
  catch it if used; otherwise malformed data is passed along.
- **Proposed fix:** Return `{ __raw: text }` or throw a `ParseError` when the body is not JSON
  and the connector expected JSON. Do not silently change type.

### PKG-13: `llm/src/validate.ts:safeJsonParse` silently returns `undefined` on parse failure, masking upstream LLM errors
- **Package:** llm
- **File:** `packages/llm/src/validate.ts:62-68`
- **Evidence:**
  ```ts
  function safeJsonParse(raw: string | undefined): unknown {
    if (raw === undefined) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  ```
  A malformed JSON response from the LLM is treated identically to an undefined response. The
  repair loop will try to fix it via reprompt, which is the correct behavior — but the error
  message sent to the model (`formatIssues`) will say "path: Invalid type" (a Zod issue from
  trying to parse `undefined`) rather than "JSON parse failed: unexpected token". The repair
  message gives the model no hint about what went wrong.
- **Repro:** DeepSeek returns `"Sorry, I can't do that"` (content policy refusal in Chinese)
  instead of JSON → `safeJsonParse` returns `undefined` → Zod issues say "Required" → reprompt
  says "Required" → model re-refuses → `LLMValidationError` after 3 attempts. No log of the
  original refusal.
- **Severity:** low
- **Blast radius:** Poor repair-loop convergence when LLM returns non-JSON. Wasted API calls.
  Original refusal text is lost.
- **Proposed fix:** Log `"[validate] JSON.parse failed, treating as undefined"` with the first
  50 chars of `raw`. Optionally pass the parse error as additional context to `reprompt`.

---

## SEED SIGNAL VERIFICATION SUMMARY

| Seed claim | Verdict |
|---|---|
| `reconciliar-contrato.ts:474` bare `catch{}` on enqueue | CONFIRMED (PKG-02) |
| `writer-revision-entidad` ignores `.insert().select()` result | FALSE POSITIVE (PKG-09) |

---

## NON-FINDINGS (explicitly confirmed clean)

- **PII / RUT in LLM paths**: `assertNoRutInLlmInput` is called at both the provider level
  (inside `DeepSeekProvider.complete`, `MiniMaxProvider.complete`, `GeminiEmbeddings.embed`) AND
  in the caller (`clasificar.ts`, `pipeline.ts`, `pipeline-entidad.ts`). Double-gate is correct.
  No path where a RUT reaches an LLM prompt was found.
- **Sector catalog drift**: `cruces/sector.ts` 13 codes match `0038_sector.sql` 13 INSERT values
  byte-for-byte. No drift (PKG-11 is a structural fragility, not a current drift).
- **`any` / `@ts-ignore` abuse**: No `as any`, `@ts-ignore`, or unsafe casts found in non-test
  source files.
- **Writer idempotency** (other packages): tramitacion, lobby, probidad, dinero, fichas, identity
  `onConflict` targets all match their respective migrations.
- **Dead code**: No orphan files or unreachable exports found that affect runtime behavior.
