---
phase: 57-cron-fix-hardening-dos-etapas-hash-check-crons-verdes
reviewed: 2026-07-08T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - packages/ingest/src/r2-store.ts
  - packages/ingest/src/r2-store.test.ts
  - packages/ingest/src/base-connector.ts
  - packages/ingest/src/base-connector.test.ts
  - packages/tramitacion/src/writer-supabase.ts
  - packages/tramitacion/src/writer-supabase.test.ts
  - packages/tramitacion/src/ingest-cli.ts
  - packages/tramitacion/src/ingest-cli.test.ts
  - packages/tramitacion/src/ingest-run.ts
  - packages/lobby/src/ingest-cli.ts
  - packages/lobby/src/ingest-cli.test.ts
  - packages/lobby/src/ingest-run.ts
  - packages/lobby/src/run-camara-lobby.ts
  - packages/agenda/src/ingest-run.ts
  - packages/agenda/src/run-agenda-prod-cli.ts
  - packages/probidad/src/run-probidad-todos.ts
  - packages/probidad/src/run-probidad-todos.ts
  - packages/probidad/src/run-probidad-todos-cli.ts
  - packages/probidad/src/run-probidad-todos.test.ts
  - packages/fichas/src/texto-fuente.ts
  - packages/fichas/src/texto-fuente.test.ts
  - packages/identity/src/seed-cli.ts
  - .github/workflows/lobby-camara-weekly.yml
  - .github/workflows/probidad-weekly.yml
  - docs/runbooks/cron-local-fallback.md
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 57: Code Review Report

**Reviewed:** 2026-07-08
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Phase 57 introduced (a) `R2Store.getObject` + `putImmutable` returning `{r2Path, existed}`, (b) `dedupePorClave` in `upsertEventos` fixing G4, and (c) hash-check / Etapa-1 R2 wiring across tramitacion, lobby/leylobby connectors. The core logic in `r2-store.ts`, `writer-supabase.ts`, and `tramitacion/ingest-run.ts` is sound. Three issues stand out: one CRITICAL silent env-var mismatch that makes `lobby/ingest-cli.ts` always degrade to dry-run in CI, one WARNING where `run-camara-lobby.ts` never checks `existed` (skips the hash-check optimization), and one WARNING command-injection risk in the probidad workflow.

---

## Critical Issues

### CR-01: `lobby/ingest-cli.ts` reads `SUPABASE_DB_URL` / `SUPABASE_SERVICE_KEY` but `lobby-camara-weekly.yml` injects `SUPABASE_API_URL` / `SUPABASE_SECRET_KEY` — CLI silently degrades to dry-run in CI

**File:** `packages/lobby/src/ingest-cli.ts:127-131`

**Issue:** The `main()` function resolves the Supabase URL and key as:

```ts
const url = opts.url ?? process.env.SUPABASE_DB_URL ?? process.env.SUPABASE_URL ?? "";
const serviceKey =
  opts.serviceKey ??
  process.env.SUPABASE_SERVICE_KEY ??
  process.env.SUPABASE_LOCAL_SERVICE_KEY ??
  "";
```

The GitHub Actions workflow `lobby-camara-weekly.yml` (lines 60-61) injects:

```yaml
SUPABASE_API_URL: ${{ secrets.SUPABASE_API_URL }}
SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}
```

Neither `SUPABASE_API_URL` nor `SUPABASE_SECRET_KEY` is read by `ingest-cli.ts`. As a result, in CI both resolve to `""` and `dryRun` silently becomes `true` (line 140: `const dryRun = opts.dryRun === true || serviceKey.length === 0 || url.length === 0`). The workflow prints a log line about DRY-RUN and exits 0 even though no data was written. The `lobby-leylobby-weekly.yml` already works around this by mapping `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` explicitly (see its comment lines 57-61), but `lobby-camara-weekly.yml` does not.

Note: `lobby-camara-weekly.yml` is currently dispatch-only (WAF gate), so this does not affect production today — but it will when the schedule is re-enabled, and it affects any manual dispatch.

**Fix:** Either update `lobby-camara-weekly.yml` to inject the names the CLI actually reads:

```yaml
env:
  SUPABASE_URL: ${{ secrets.SUPABASE_API_URL }}
  SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}
```

Or, preferably, align `ingest-cli.ts` to also fall back to `SUPABASE_API_URL` / `SUPABASE_SECRET_KEY` for consistency with the other CLIs:

```ts
const url =
  opts.url ??
  process.env.SUPABASE_DB_URL ??
  process.env.SUPABASE_URL ??
  process.env.SUPABASE_API_URL ??  // add this
  "";
const serviceKey =
  opts.serviceKey ??
  process.env.SUPABASE_SERVICE_KEY ??
  process.env.SUPABASE_SECRET_KEY ??       // add this
  process.env.SUPABASE_LOCAL_SERVICE_KEY ??
  "";
```

---

## Warnings

### WR-01: `run-camara-lobby.ts` ignores `existed` from `putImmutable` — hash-check optimization never fires for Cámara lobby

**File:** `packages/lobby/src/run-camara-lobby.ts:92`

**Issue:** The call at line 92 destructures only `r2Path`, discarding `existed`:

```ts
({ r2Path } = await opts.r2Store.putImmutable(...));
```

When R2 returns 412 (content unchanged), `existed` is `true` but is silently dropped. The function never emits `[skip] sin novedades` and always proceeds to Etapa 2 (Supabase upsert). This is inconsistent with `lobby/ingest-run.ts` (line 138-148) and `tramitacion/ingest-run.ts` (lines 271-282), both of which check `existed` and skip Supabase when content is unchanged.

The result is not a data-correctness bug (the upsert is idempotent), but it defeats the hash-check idempotency goal of Phase 57 for this connector: on every run, Supabase is always called even when there are no changes. The skip signal is also needed by Phase 58's freshness bookkeeping.

**Fix:**

```ts
const { r2Path: newPath, existed } = await opts.r2Store.putImmutable(
  "camara-lobby",
  "listadodeaudiencias",
  date,
  sha,
  "html",
  bytes,
);
r2Path = newPath;
if (existed) {
  log("[skip] sin novedades — camara-lobby listadodeaudiencias");
  // Return early: content unchanged, no need to call Supabase.
  return { audiencias: 0, contrapartes: 0, parlamentariosMarcados: 0, confirmados: 0, r2Path };
}
log(`camara-lobby: crudo en R2 → ${r2Path}`);
```

Note: returning early from `runCamaraLobby` requires the caller (`run-camara-lobby-cli.ts`) to handle `audiencias=0` as a valid "no-op" response rather than a failure.

---

### WR-02: `probidad-weekly.yml` line 67 — unquoted `$ARGS` is vulnerable to shell word-splitting from user-controlled workflow input

**File:** `.github/workflows/probidad-weekly.yml:67`

**Issue:**

```yaml
LIMITE: ${{ github.event.inputs.limite }}
...
ARGS=""
if [ -n "$LIMITE" ]; then ARGS="$ARGS --limit $LIMITE"; fi
OUT=$(pnpm ... $ARGS)
```

`LIMITE` is a user-supplied `workflow_dispatch` input. It is passed via the environment (not directly interpolated into the YAML shell command, which is good), but it is then appended to `$ARGS` unquoted and expanded unquoted into the `pnpm` command. If an attacker (or accident) sets `LIMITE` to a value like `1 && curl ... | sh`, the shell splits on spaces and the injected tokens are executed. This is a low-probability path (only repo admins can trigger `workflow_dispatch`) but the pattern is still incorrect.

**Fix:** Quote the variable expansion and validate the input before use:

```bash
ARGS=""
if [ -n "$LIMITE" ]; then
  # Validate: must be a positive integer
  if ! echo "$LIMITE" | grep -qE '^[0-9]+$'; then
    echo "LIMITE inválido: debe ser entero positivo"
    exit 1
  fi
  ARGS="--limit $LIMITE"
fi
OUT=$(pnpm --filter @obs/probidad exec tsx src/run-probidad-todos-cli.ts $ARGS)
```

Or use an array to prevent word splitting:

```bash
PNPM_ARGS=()
if [ -n "$LIMITE" ]; then PNPM_ARGS+=(--limit "$LIMITE"); fi
OUT=$(pnpm --filter @obs/probidad exec tsx src/run-probidad-todos-cli.ts "${PNPM_ARGS[@]}")
```

---

## Info

### IN-01: `r2-store.test.ts` test 1d does not assert `existed=true` for the 412 case

**File:** `packages/ingest/src/r2-store.test.ts:51-60`

**Issue:** The test labeled "Test 1d: status 412 (ya existia) se trata como exito idempotente" only asserts `r2Path` is returned correctly. It does not verify that `existed` is `true`. The `existed=true` semantic is the entire mechanism that enables the hash-check early-exit across five connectors. A later refactor that sets `existed` incorrectly would pass this test undetected. The `existed=true` case is covered in a later test (line 87), but the "idempotent success" test description at line 51 is misleading because it does not test the documented side effect.

**Fix:** Add `existed` assertion to the 1d test, or rename it to make clear it only tests `r2Path`:

```ts
it("Test 1d: status 412 (ya existia) devuelve r2Path correcto y existed=true", async () => {
  // ...
  const { r2Path, existed } = await store.putImmutable(...);
  expect(r2Path).toBe(`s/r/2026-06-17/${sha}.json`);
  expect(existed).toBe(true); // add this
});
```

---

_Reviewed: 2026-07-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
