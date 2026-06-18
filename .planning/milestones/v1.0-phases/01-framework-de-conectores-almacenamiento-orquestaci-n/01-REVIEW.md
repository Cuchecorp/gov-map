---
phase: 01-framework-de-conectores-almacenamiento-orquestaci-n
reviewed: 2026-06-17T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - packages/core/src/provenance.ts
  - packages/core/src/domain.ts
  - packages/core/src/index.ts
  - packages/ingest/src/rate-limiter.ts
  - packages/ingest/src/robots.ts
  - packages/ingest/src/fetcher.ts
  - packages/ingest/src/cache.ts
  - packages/ingest/src/r2-store.ts
  - packages/ingest/src/drift.ts
  - packages/ingest/src/snapshot.ts
  - packages/ingest/src/base-connector.ts
  - packages/ingest/src/dummy-connector.ts
  - packages/ingest/src/index.ts
  - supabase/migrations/0001_extensions.sql
  - supabase/migrations/0002_control_tables.sql
  - supabase/migrations/0003_orchestration.sql
  - supabase/functions/ingest-worker/index.ts
  - supabase/functions/ingest-worker/worker.ts
  - supabase/functions/ingest-worker/backfill.ts
  - .github/workflows/backfill.yml
findings:
  critical: 4
  warning: 7
  info: 5
  total: 16
status: fixes_applied
fix_summary:
  fixed_at: 2026-06-17
  scope: critical_warning
  critical_fixed: 4
  warning_fixed: 7
  info_fixed: 1   # IN-01 (trivial, adjacent to CR-01 worker change)
  info_deferred: 4 # IN-02, IN-03 (partially addressed via .env.example), IN-04, IN-05
  tests: "vitest 59 / deno 8 / pgTAP 27 — all green; tsc -b clean"
  commits:
    - "CR-03 -> fa5b3d0"
    - "CR-02 + WR-01 -> d136fd8"
    - "CR-04 + WR-07 -> bca6dfc"
    - "CR-01 + WR-02/WR-04/WR-06/IN-01 -> 3c1a8ad"
    - "WR-03 -> f42c932"
    - "WR-05 + WR-06(backfill) + IN-03(env) -> ded2f56"
---

# Phase 1: Code Review Report

**Reviewed:** 2026-06-17
**Depth:** standard
**Files Reviewed:** 20
**Status:** fixes_applied (all Critical + Warning resolved; see fix_summary)

## Summary

This phase implements the connector framework: a Template-Method `BaseConnector`, policy collaborators (rate-limiter, robots, fetcher, R2 writer, drift, snapshot), the control-plane migrations (pgmq/pg_cron/pg_net), and the Deno Edge Function worker plus a GitHub Actions backfill path. The pure-helper layer (`@obs/core`), the R2 content-addressed writer, and the RLS deny-by-default migration are solid and match their stated intent.

However, the review surfaced one structural security gap that undermines several of the phase's own guarantees: **the Edge Function `handler` performs no authentication and trusts caller-supplied `msg_id` values**, which converts the worker into both an unauthenticated ingestion trigger and a queue-deletion primitive (data loss). Separately, the **rate-limiter cannot enforce the LOCKED 2-3s policy across Edge Function invocations** because a fresh `HostRateLimiter` is constructed per request and holds state only in process memory — defeating the WAF-avoidance goal. The fetcher has **no origin allowlist (SSRF surface)**, and the **service-role key is passed through `pg_net`, which persists request headers in queryable Postgres tables**.

The cache/R2/drift correctness is mostly good, but there is a genuine race in the daily-cache gate and a fail-open robots path that can throw on malformed URLs.

## Critical Issues

### CR-01: Edge Function handler is unauthenticated and ACKs caller-controlled msg_ids (data loss) — RESOLVED (3c1a8ad)

**File:** `supabase/functions/ingest-worker/worker.ts:174-194` (and `processBatch` 150-171)
**Issue:** `handler` parses the request body and immediately calls `processBatch`. It never validates the `Authorization: Bearer <service_key>` header that the SQL dispatcher (`0003_orchestration.sql:143-151`) sends. Any party that can reach `<project_url>/functions/v1/ingest-worker` can:
1. Trigger arbitrary ingestion runs (resource abuse / WAF exposure on real sources in later phases).
2. Supply arbitrary `msg_id` values in `batch`; on a successful (or no-op) run, `processBatch` calls `ack.ack("ingest_jobs", job.msg_id)` → `pgmq.delete`, **deleting legitimate queued jobs the attacker never owned.** `BatchItem` only validates `msg_id` is a number — it does not bind the caller's identity to those ids.

Note that Supabase Edge Functions enforce a platform-level JWT by default, but this code explicitly relies on the service key for authorization and performs no in-handler check; if `verify_jwt` is disabled (common for pg_net-invoked workers because the bearer is the service key, not a user JWT), the function is fully open. The code must not depend on an unstated platform setting for a data-loss-grade control.

**Fix:** Verify the bearer against the service key before processing, using a constant-time compare:
```ts
function authorized(req: Request): boolean {
  const expected = `Bearer ${requireEnv("SUPABASE_SECRET_KEY")}`;
  const got = req.headers.get("Authorization") ?? "";
  // constant-time-ish: lengths first, then timingSafeEqual on bytes
  if (got.length !== expected.length) return false;
  return crypto.subtle ? timingSafeEqual(got, expected) : got === expected;
}

export async function handler(req: Request): Promise<Response> {
  if (!authorized(req)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  // ...existing parse + processBatch
}
```
Additionally, the worker should re-read the message from pgmq by id (or have the dispatcher pass a signed token) rather than trusting `msg_id` straight from the request body, so a caller cannot delete arbitrary queue entries.

### CR-02: Rate-limiter state does not survive across Edge Function invocations — 2-3s policy not enforced — RESOLVED (d136fd8)

**Resolution:** Added DB-backed `util_host_throttle` + `util.reserve_host_slot()` (migration 0004) as the authoritative cross-invocation gate, consulted via `PgHostThrottle` before the in-process limiter. The in-process `HostRateLimiter` is retained as a fast-path within a batch.

**File:** `packages/ingest/src/rate-limiter.ts:27-52`; instantiated at `supabase/functions/ingest-worker/worker.ts:129`
**Issue:** `HostRateLimiter` keeps per-host timing entirely in an in-process `Map`. `buildConnector` constructs a **new** `HostRateLimiter` (and `RobotsGuard`, `Fetcher`) on every `handler` call. Each Edge Function invocation is a fresh isolate, so the `Map` starts empty every time. The dispatcher fires every 30s with `batch_size 5`, and pg_net can fan out concurrent invocations — meaning the "first request to a host resolves immediately" branch (`isFirst`, line 45) fires on every invocation, so multiple isolates can hit the same government host with **zero delay between them**. The LOCKED 2-3s serial-per-host guarantee (the whole point of FND-01 / WAF avoidance) holds only within a single batch inside a single isolate, not across the system. This is the WAF-ban risk the design claims to prevent.

**Fix:** Enforce the inter-request delay against durable shared state, not process memory. Options: (a) gate dispatch so only one job per host is in flight at a time via a Postgres advisory lock / a `last_fetched_at` per host row checked in `process_ingest_jobs`; or (b) set `batch_size = 1` and serialize per host at the queue level so a single isolate handles one host at a time and the vt prevents overlap. Document and test the cross-invocation guarantee, not just the in-process one.

### CR-03: Fetcher has no origin allowlist (SSRF / abuse surface) — RESOLVED (fa5b3d0)

**File:** `packages/ingest/src/fetcher.ts:70-83` (and `RobotsGuard.isAllowed`, `robots.ts:41-46`)
**Issue:** `Fetcher.get` issues a GET to whatever `spec.url` contains, with no validation that the host is an approved government origin and no protection against internal targets (`http://169.254.169.254/...` cloud metadata, `http://localhost`, `http://kong:8000`, RFC1918 ranges). The framework is explicitly designed so future connectors and the orchestration layer feed URLs into this fetcher; combined with CR-01 (unauthenticated handler) and the fact that `RequestSpec.url`/`host` are connector-supplied, there is no defense-in-depth boundary. The phase brief calls out "origin allowlist for government sources" as a requirement and it is absent.

**Fix:** Add an allowlist check before any fetch (in `Fetcher.get` and ideally enforced again in `BaseConnector.run`):
```ts
const ALLOWED_HOSTS = new Set([
  "www.camara.cl", "opendata.camara.cl", "tramitacion.senado.cl",
  "www.bcn.cl", "nuevo.leychile.cl", /* dummy.local only in non-prod */
]);
function assertAllowed(rawUrl: string): URL {
  const u = new URL(rawUrl);
  if (u.protocol !== "https:") throw new FetchError(0, rawUrl);
  if (!ALLOWED_HOSTS.has(u.hostname)) throw new FetchError(0, rawUrl);
  return u;
}
```
Reject non-https, IP-literal hosts, and anything not on the list. Validate `spec.host === new URL(spec.url).host` so the host used for rate-limiting cannot be spoofed apart from the host actually fetched (see WR-01).

### CR-04: Service-role key is persisted in queryable pg_net tables — RESOLVED (bca6dfc)

**Resolution:** Replaced `util.service_key()` Bearer with a dedicated least-privilege `util.worker_secret()` (`INGEST_WORKER_SECRET`), validated by the worker. Added `util.cleanup_net_http()` scheduled every 15 min to purge pg_net response rows. Residual platform behavior (pg_net storing the invocation secret) is now bounded to a non-DB-privileged secret + periodic cleanup.

**File:** `supabase/migrations/0003_orchestration.sql:143-151`
**Issue:** `net.http_post` is called with `'Authorization', 'Bearer ' || util.service_key()`. `pg_net` records outgoing requests (including headers) in its internal tables (`net.http_request_queue` / response bookkeeping). The full service-role key therefore lands in a Postgres table where it can be read by any role with access to the `net` schema and may survive in backups/logs — exactly the "service_role key must never be exposed" constraint this phase is supposed to honor. The function comment claims "nunca al cliente, nunca al log," but pg_net's own storage contradicts that.

**Fix:** Do not send the service key through pg_net. Prefer one of: (a) invoke the worker with a short-lived signed token (e.g., a Vault-stored HMAC the worker verifies) instead of the raw service key; (b) rely on Supabase's internal function-invocation auth and pass no long-lived secret; (c) if the key must be used, schedule a periodic `delete from net.<request tables>` cleanup and restrict `net` schema grants. At minimum, document the residual exposure and lock down the `net` schema.

## Warnings

### WR-01: rate-limit/robots host can be spoofed independently of the fetched URL — RESOLVED (d136fd8 / fa5b3d0)

**File:** `packages/ingest/src/base-connector.ts:110-119`; `rate-limiter.ts:42`
**Issue:** `BaseConnector.run` calls `robots.isAllowed(spec.url)` and `rateLimiter.wait(spec.host)` using two separately-supplied fields. Nothing enforces `spec.host === new URL(spec.url).host`. A connector (or a future caller) can set `host` to a throwaway value so each request looks like a "first request" to a unique host and skips the delay, while `url` points at the real target — silently bypassing the rate limiter.
**Fix:** Derive the host from the URL inside the framework (`const host = new URL(spec.url).host;`) and stop trusting `spec.host`; remove `host` from `RequestSpec` or assert equality.

### WR-02: Daily-cache gate is racy — concurrent runs both miss and double-fetch — RESOLVED (3c1a8ad)

**Resolution:** `insertSnapshot` now catches the unique-violation (`23505`) and returns the existing row as an idempotent success, so a concurrent double-fetch no longer surfaces as a retried job failure. The count gate remains an advisory fast-path.

**File:** `packages/ingest/src/base-connector.ts:107`; `cache.ts:55-57`; `worker.ts:84-92`
**Issue:** `hasToday` does a `select count` on `source_snapshot`; the unique constraint `(source, resource, date_bucket)` is only enforced at `snapshot.write`. Two concurrent invocations for the same (source, resource, today) both see count 0, both fetch the source (extra hits on the government WAF), and the second `insertSnapshot` throws on the unique violation — surfacing as a job failure that gets retried via vt even though the data was already captured. The cache check is advisory, not authoritative.
**Fix:** Treat the unique-violation on insert as an idempotent success (catch `23505` and return the existing row), and/or take a per-(source,resource,day) advisory lock before fetch. Do not rely on the count gate alone.

### WR-03: robots/fetch throws on malformed URL; robots fail-open masks real errors — RESOLVED (f42c932)

**File:** `packages/ingest/src/robots.ts:42`, `57-72`
**Issue:** `new URL(url).origin` (line 42) throws for malformed input, and that throw propagates out of `isAllowed` as a generic error (not the controlled skip path). Separately, `loadRobots` catches *all* errors and returns an empty (allow-all) parser — so a transient network failure or a DNS error against the host is treated as "robots allows everything," weakening the respectful-ingestion guarantee for the very request that just failed.
**Fix:** Validate the URL up front and return a controlled `false`/skip on parse failure. Narrow the fail-open to genuine 404/empty-robots cases; on network errors, fail *closed* (skip) rather than open, or at least log distinctly.

### WR-04: processBatch swallows all errors with no logging or classification — RESOLVED (3c1a8ad)

**File:** `supabase/functions/ingest-worker/worker.ts:165-168`
**Issue:** `catch (_err) { failed++; }` discards the error entirely. A `FetchError` (permanent 4xx), a malformed-payload bug, an R2 misconfiguration, and a transient 429 are all treated identically as "no-ack, retry via vt." Permanent failures will loop until they hit `max_read_ct` and get dead-lettered, with zero diagnostic trail. This makes the poison-message path the only signal and blinds operators to the cause.
**Fix:** Log the error (without secrets) with the `msg_id`; distinguish `RetryableError` (no-ack) from `FetchError`/validation errors (ack + record to a failures table or DLQ immediately) so non-retryable failures don't waste 5 vt cycles.

### WR-05: BACKFILL_ITERATIONS is unbounded and unvalidated — RESOLVED (ded2f56)

**File:** `supabase/functions/ingest-worker/backfill.ts:26, 35-41`
**Issue:** `Number(Deno.env.get("BACKFILL_ITERATIONS") ?? "1")` accepts any value. A negative number yields 0 iterations (silent no-op), a non-numeric yields `NaN` (loop never runs — silent no-op), and a very large number runs an unbounded crawl loop with no upper cap — the opposite of the "acotado para no martillar la fuente" intent. The workflow input is a free-text string passed straight through.
**Fix:** Parse with validation and clamp: `const n = Math.trunc(Number(raw)); if (!Number.isFinite(n) || n < 1 || n > MAX_ITER) throw new Error("invalid BACKFILL_ITERATIONS");`.

### WR-06: Connector run is not wrapped in an ingest_run lifecycle; ctx is a fabricated cast — RESOLVED (3c1a8ad / ded2f56)

**File:** `supabase/functions/ingest-worker/worker.ts:159-161`; `backfill.ts:37-39`
**Issue:** Both call sites pass `{ source: "dummy", status: "running" } as unknown as IngestRun` — a fabricated object missing `id`, `startedAt`, `stats`. `SnapshotWriter` then writes `ingest_run_id: null` (snapshot.ts:42 via `?? null`), so no row in `ingest_run` is ever created/updated and snapshots are orphaned from any run record. The `ingest_run` table and `IngestStatus` machinery exist but are never exercised, so there is no run-level status/error tracking despite the schema providing for it. The double `as unknown as` cast also disables all type checking at the most important boundary.
**Fix:** Create an `ingest_run` row (status `running`) before the connector runs, thread its real `id` into the connector deps, and finalize the row to `ok`/`error` with `stats` afterward. Remove the `as unknown as` casts.

### WR-07: pg_cron sub-minute schedule string may be silently rejected — RESOLVED (bca6dfc)

**File:** `supabase/migrations/0003_orchestration.sql:159-163`
**Issue:** `cron.schedule('process-ingest-jobs', '30 seconds', ...)` uses the interval-string form. This is only supported on pg_cron 1.5+ (Supabase enables it, but the migration encodes a hard dependency on that version with no guard). On an older pg_cron the call errors or is ignored, and the entire orchestration loop silently never fires — a failure mode invisible until someone notices nothing is being ingested.
**Fix:** Confirm the deployed pg_cron version supports sub-minute schedules and pin/document it; or fall back to a standard 5-field expression. Add a verification query that asserts the job exists in `cron.job` after migration.

## Info

### IN-01: drift `lastFingerprint` ordered by `fetched_at` is tie-ambiguous — RESOLVED (3c1a8ad)

**File:** `supabase/functions/ingest-worker/worker.ts:97-105`
**Issue:** `order("fetched_at", { ascending: false }).limit(1)` picks the latest by timestamp. `fetched_at` is `timestamptz` and two snapshots in the same run could tie; the "previous fingerprint" would then be non-deterministic. Ordering by the monotonic `id` is safer for "most recent snapshot."
**Fix:** `.order("id", { ascending: false })`.

### IN-02: structuralPaths treats single-element and N-element arrays identically but empty arrays specially — DEFERRED

Deferred: documented-intentional behavior for M1 (form, not values). Heterogeneous-array union belongs with the real connectors (Fases 5+) where actual source shapes are known.

**File:** `packages/ingest/src/drift.ts:14-18`
**Issue:** Non-empty arrays fingerprint only `obj[0]`'s shape; a heterogeneous array (different shapes per element after index 0) won't trigger drift. Documented as intentional ("forma, no valores"), but worth noting it can miss real structural drift in later real connectors.
**Fix:** If heterogeneous arrays are expected, union the shapes of all elements (dedup of per-element paths) rather than sampling index 0.

### IN-03: env var names diverge between worker and migration comments — PARTIALLY ADDRESSED (ded2f56)

A canonical secret mapping table was added to `.env.example`. Full single-source-of-truth secrets doc remains deferred.

**File:** `supabase/functions/ingest-worker/worker.ts:67-68` vs `0003_orchestration.sql:26-27, 59-86`
**Issue:** The worker reads `SUPABASE_API_URL` / `SUPABASE_SECRET_KEY`; the migration talks about `app.settings.project_url` / `app.settings.service_key` and `util.service_key()`. Two naming schemes for the same secrets invite misconfiguration during deploy.
**Fix:** Document the canonical mapping in one place (a `.env.example` / secrets table) so operators set the right names.

### IN-04: R2 `ext` and `resource`/`source` are interpolated into the key without sanitization — DEFERRED

Deferred: dummy values are static in M1; key sanitization is best added alongside the first real connector that supplies dynamic resource/ext (Fases 5+).

**File:** `packages/ingest/src/r2-store.ts:63-64`; `base-connector.ts:138-145`
**Issue:** `key = ${source}/${resource}/${date}/${sha}.${ext}` interpolates connector-supplied `source`/`resource`/`ext` directly. For the dummy connector these are static, but a future connector with `resource` containing `../` or slashes could craft unexpected keys. The sha and date segments are safe; the others are not validated.
**Fix:** Constrain `source`/`resource`/`ext` to `[a-z0-9_-]+` (and a small ext whitelist) before building the key.

### IN-05: `max_requests` parameter is dead (only `perform`ed) — DEFERRED

Deferred: harmless signature artifact; fan-out limiting is only meaningful once concurrent multi-host dispatch exists (post-M1).

**File:** `supabase/migrations/0003_orchestration.sql:96-115`
**Issue:** `max_requests` is accepted, documented as "conservado de la firma del patron," and only consumed via `perform max_requests;` (a no-op to suppress the unused-variable). It is dead configuration that suggests a knob exists when it does nothing.
**Fix:** Either implement fan-out limiting with it or drop the parameter to avoid a misleading API surface.

---

_Reviewed: 2026-06-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
