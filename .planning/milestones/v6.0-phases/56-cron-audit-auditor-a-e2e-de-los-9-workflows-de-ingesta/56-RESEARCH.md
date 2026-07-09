# Phase 56: CRON-AUDIT — Auditoría E2E de los 9 workflows de ingesta - Research

**Researched:** 2026-07-08
**Domain:** GitHub Actions ingesta pipeline / ingesta architecture compliance
**Confidence:** HIGH (all findings verified from source files and live GH API)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Método: análisis estático + probes read-only (gh run list, gh secret list, R2 list, SELECTs Supabase).
- PROHIBIDO: disparar ingestas, tocar fuentes gubernamentales, workflow_dispatch de crons de datos, escribir a R2/Supabase.
- Billing GH: verificar estado real (gh api / última corrida programada ejecutada vs saltada).
- Entregable único: `56-CRON-AUDIT.md` con tabla 9 filas, secciones por workflow, gap-list numerada.
- Veredictos cerrados: `VERDE`, `CORRE-CON-GAPS`, `NO-CORRE`, `NO-APLICA-CRON`.

### Claude's Discretion
- Estructura interna del documento, orden del barrido, qué CLIs leer en profundidad.
- Si `gh` CLI no está autenticado para el repo remoto, degradar honesto.

### Deferred Ideas (OUT OF SCOPE)
- Arreglos de los gaps encontrados → Phase 57 (CRON-FIX).
- Reporte de frescura como herramienta permanente → Phase 58 (CRON-FRESH).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CRON-01 | Inventario auditado de los 9 workflows con veredicto (corre/no corre/por qué) y gap-list accionable archivo:línea | Research provides: run history, secret inventory, failure root causes, full ingestion chain per workflow with file+line seams, compliance analysis against LOCKED rules |
</phase_requirements>

---

## Summary

All nine GitHub Actions workflows exist in `.github/workflows/`. The remote repository is confirmed as `Cuchecorp/gov-map` (verified via `git remote -v`). The `gh` CLI is authenticated (`xenaquis` account, scopes include `repo`, `workflow`) and can reach the remote repo — run history and secret list are live-readable.

**Critical discovery on secrets:** Only `SUPABASE_API_URL` and `SUPABASE_SECRET_KEY` are present in the repo secrets (confirmed via `gh secret list`). All other secrets referenced in workflows — `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SUPABASE_URL` — are **absent from Actions secrets**. This is the single most impactful finding: it means R2 Etapa-1 is silently degraded to no-op in every scheduled cron that requires it (lobby-camara, probidad, fichas-backfill, backfill), and three workflows that require secrets beyond SUPABASE_* will fail or run degraded.

**Run history summary (last ~5 weeks from live `gh run list`):**
- `agenda-weekly`: VERDE (last 2 runs success, 2026-06-29 and 2026-07-06)
- `leyes-weekly`: NO-CORRE (2 consecutive failures: 2026-06-26, 2026-07-03 — `ON CONFLICT DO UPDATE command cannot affect row a second time` on `tramitacion_evento`)
- `lobby-camara-weekly`: NO-CORRE (2 consecutive failures: 2026-06-30, 2026-07-07 — WAF returned 5463 bytes < 10 KB gate, curl blocked by camara.cl from GH Actions IPs)
- `lobby-leylobby-weekly`: CORRE-CON-GAPS (2 successes: 2026-07-01, 2026-07-08 — but NO R2 Etapa-1 since secret absent)
- `probidad-weekly`: NO-CORRE (1 failure: 2026-07-02 — assertion `sin declaraciones/confirmados` fired; assert requires `declaraciones>0 OR confirmados>0`, ran ~20s suggesting zero results from SPARQL or identity mismatch)
- `backup-parlamentario`: CORRE-CON-GAPS (scheduled runs succeed, 2026-06-29 and 2026-07-06; 2026-07-08 failed with "workflow file issue" triggered by a push event, not schedule; R2 step gated and skipped because `R2_ACCESS_KEY_ID` is empty in repo secrets)
- `fichas-backfill`: NO-APLICA-CRON (manual only — no run history visible, never triggered)
- `backfill`: NO-APLICA-CRON (manual only — uses Deno, no run history visible)
- `deploy-cloudflare`: NO-APLICA-CRON (manual only — no run history visible)

**Primary recommendation:** Phase 57 must (1) load the missing 7+ secrets into Cuchecorp/gov-map repo secrets, (2) fix the `tramitacion_evento` upsert conflict bug, and (3) investigate WAF bypass failure for lobby-camara from GH Actions IPs.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Etapa 1: fuente → R2 crudo | Edge/CI connector | — | `R2Store.putImmutable` in each connector, content-addressed |
| Etapa 2: R2 crudo → Supabase parse | CI connector | — | Writers read from in-memory fetch result, NOT from R2 (gap — see below) |
| Hash-check / cache daily | `@obs/ingest` BaseConnector | per-connector cache | `cache.hasToday()` in `base-connector.ts:124` for BaseConnector-based flows |
| Rate-limit | `HostRateLimiter` (`@obs/ingest`) | `hostThrottle` (Postgres durable) | All CLIs inject HostRateLimiter; `hostThrottle` only in BaseConnector |
| Scheduling | GitHub Actions cron | pg_cron (not yet wired to these CLIs) | All 5 recurring workflows use `schedule:` |
| Observability | `source_snapshot`, `ingest_run`, `drift_alert` tables | `lobby_ingesta_estado`, `probidad_ingesta_estado` | Written by connectors that use R2Store + SnapshotWriter |

---

## Detailed Findings: Per-Workflow Ingestion Chain

### Secrets Matrix

| Secret Name | agenda-weekly | leyes-weekly | lobby-camara-weekly | lobby-leylobby-weekly | probidad-weekly | fichas-backfill | backup-parlamentario | backfill | deploy-cloudflare | Present in repo? |
|-------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `SUPABASE_API_URL` | Y | Y | Y | Y (as SUPABASE_URL) | Y | Y | — | Y | — | **YES** |
| `SUPABASE_SECRET_KEY` | Y | Y | Y | Y (as SUPABASE_SERVICE_KEY) | Y | Y | — | Y | — | **YES** |
| `SUPABASE_URL` | — | — | — | — | — | Y | — | — | — | **NO** |
| `R2_ENDPOINT_URL` | Y | — | Y | — | Y (optional) | Y | Y (job env) | Y | — | **NO** |
| `R2_ACCESS_KEY_ID` | Y | — | Y | — | Y (optional) | Y | Y (job env) | Y | — | **NO** |
| `R2_SECRET_ACCESS_KEY` | Y | — | Y | — | Y (optional) | Y | Y (job env) | Y | — | **NO** |
| `R2_BUCKET` | Y | — | Y | — | Y (optional) | Y | Y (job env) | Y | — | **NO** |
| `DEEPSEEK_API_KEY` | Y | — | — | — | — | Y | — | — | — | **NO** |
| `GEMINI_API_KEY` | — | — | — | — | — | Y | — | — | — | **NO** |
| `CLOUDFLARE_API_TOKEN` | — | — | — | — | — | — | — | — | Y | **NO** |
| `CLOUDFLARE_ACCOUNT_ID` | — | — | — | — | — | — | — | — | Y | **NO** |

**Source:** YAML `env:` blocks verified directly. Registry: `gh secret list --repo Cuchecorp/gov-map` (2026-07-08).

---

### 1. agenda-weekly

**YAML:** `.github/workflows/agenda-weekly.yml`
**Schedule:** `0 11 * * 1` (Monday 11:00 UTC)
**CLI:** `packages/agenda/src/run-agenda-prod-cli.ts` → `runIngest()` in `packages/agenda/src/ingest-run.ts`
**Ingestion chain:**
- Cámara: `curl` (anti-WAF) → HTML crudo to `/tmp` → `CitacionesCamaraConnector` reads via `--html-file` equivalent; `createCurlTransport` in `packages/agenda/src/transport-curl.ts`
- Senado: `SenadoActividadConnector` with `Fetcher` (fetch native)
- Etapa 1 (R2): present in `ingest-run.ts:218` — PDF crudo goes to R2 via `TablaR2Target.putImmutable`; gated by R2 credentials. **With missing R2 secrets, this is a no-op.**
- Etapa 2 (Supabase): `SupabaseAgendaWriter` writes citaciones/sesiones. Happens even if Etapa 1 skipped (PDF in memory).
- `source_snapshot`: written via `SnapshotWriter` (gated by R2 creds)
- Hash-check: not via `BaseConnector` (custom flow); cache check per semana ISO key

**Etapa-2-from-R2 re-ingest path:** ABSENT. Etapa 2 reads from in-memory fetch result, not from stored R2 crudo. [VERIFIED: source read]

**Rate-limit:** `HostRateLimiter` injected in `run-agenda-prod-cli.ts`; 2-3s enforced.
**robots.txt:** `RobotsGuard` injected.
**DEEPSEEK_API_KEY:** Required for DeepSeek tabla-sala extraction; absent in repo secrets → `DeepSeekProvider` will fail or be silently skipped (degrades to PDF link per YAML comment). File: `run-agenda-prod-cli.ts`, DeepSeekProvider instantiation.

**Veredicto:** CORRE-CON-GAPS
**Gaps:**
- G1: `DEEPSEEK_API_KEY` absent → tabla de sala (paso 4) degrada a enlace PDF sin extracción. `agenda-weekly.yml:58`
- G2: R2 secrets absent → Etapa-1 es no-op, no hay crudo versionado ni `source_snapshot`. `agenda-weekly.yml:60-61`
- G3: Etapa-2-from-R2 re-ingest path no implementada — re-ingesta a Supabase vuelve a la fuente (viola LOCKED rule). `packages/agenda/src/ingest-run.ts` (no R2-read path exists)

---

### 2. leyes-weekly

**YAML:** `.github/workflows/leyes-weekly.yml`
**Schedule:** `0 20 * * 5` (Friday 20:00 UTC)
**CLI:** `packages/tramitacion/src/run-tramitacion-prod-cli.ts` → `main()` in `packages/tramitacion/src/ingest-cli.ts` → `runIngest()` in `packages/tramitacion/src/ingest-run.ts`
**Ingestion chain:**
- `CamaraConnector` (WS JSON `opendata.camara.cl`) + `SenadoConnector` (XML `wspublico/tramitacion.php`)
- **No R2 integration at all.** `ingest-cli.ts:16` comment: "R2/remoto diferidos." `ingest-cli.ts` does not import or use `R2Store`. No R2 secrets in the YAML.
- Etapa 1: **MISSING** — raw data is never persisted to R2.
- Etapa 2: `SupabaseTramitacionWriter` upserts via `writer-supabase.ts`.
- Hash-check: none per-endpoint; idempotent upsert only. No early-exit when no changes.

**Known failure root cause:** `ON CONFLICT DO UPDATE command cannot affect row a second time` on `tramitacion_evento`. The unique key on `tramitacion_evento` is `(boletin, fecha, camara, tipo, descripcion)` (per `packages/tramitacion/src/writer.ts:8`). Multiple XML events for the same boletín can share the same composite key within a single upsert batch, triggering the Postgres constraint. This is a bug in the writer/parser, not a secrets or billing issue.

**Secrets required:** `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY` — both present.
**Veredicto:** NO-CORRE
**Gaps:**
- G4: `tramitacion_evento` upsert `ON CONFLICT DO UPDATE command cannot affect row a second time` — duplicate key within same batch. `packages/tramitacion/src/writer-supabase.ts` (upsert logic), `packages/tramitacion/src/ingest-run.ts`. Bug reproducible every weekly run (2 consecutive failures: 2026-06-26, 2026-07-03).
- G5: Etapa-1 completely absent — no R2 crudo for any tramitacion data. `packages/tramitacion/src/ingest-cli.ts:16` ("R2/remoto diferidos").
- G6: No hash-check before download — no early exit when no changes (violates LOCKED rule 3). No `cache.hasToday()` call in `run-tramitacion-prod-cli.ts` or `ingest-cli.ts`.

---

### 3. lobby-camara-weekly

**YAML:** `.github/workflows/lobby-camara-weekly.yml`
**Schedule:** `0 11 * * 2` (Tuesday 11:00 UTC)
**CLI:** `packages/lobby/src/run-camara-lobby-cli.ts` → `runCamaraLobby()` in `packages/lobby/src/run-camara-lobby.ts`
**Ingestion chain:**
- `curl -sS -A 'Bot-Ciudadano/1.0'` download step in YAML → `/tmp/lobby.html` → `CamaraLobbyConnector` reads from file
- Etapa 1 (R2): in `run-camara-lobby.ts:85-103` — `opts.r2Store.putImmutable(...)` best-effort. Gated by R2 creds. **R2 secrets absent → no-op.**
- Etapa 2 (Supabase): `SupabaseLobbyWriter` via `writer-supabase.ts`. Runs from in-memory HTML, not from R2.
- Rate-limit/robots: `HostRateLimiter` + `RobotsGuard` injected in `run-camara-lobby-cli.ts:83-85`.

**Failure root cause (confirmed):** `lobby.html = 5463 bytes` < 10240 byte gate in YAML `lobby-camara-weekly.yml:54`. The curl step (`lobby-camara-weekly.yml:49-54`) downloads 5 KB which is a WAF/error response, not the real HTML. This is a WAF change at `camara.cl` that now blocks GH Actions IP ranges even via curl. The step exits 1 before the CLI runs.

**Re-ingest path from R2:** ABSENT — `run-camara-lobby.ts` writes to R2 but cannot read back from it to re-populate Supabase. [VERIFIED: source read]

**Veredicto:** NO-CORRE
**Gaps:**
- G7: WAF `camara.cl` now blocks GH Actions IPs even via curl — `lobby.html` = 5 KB (WAF page). `.github/workflows/lobby-camara-weekly.yml:49-54`. Both 2026-06-30 and 2026-07-07 runs failed identically.
- G8: R2 secrets absent → Etapa-1 would be no-op even if WAF resolved. `lobby-camara-weekly.yml:61-64`
- G9: Etapa-2-from-R2 re-ingest path absent — `packages/lobby/src/run-camara-lobby.ts` (no R2-read path).

---

### 4. lobby-leylobby-weekly

**YAML:** `.github/workflows/lobby-leylobby-weekly.yml`
**Schedule:** `0 11 * * 3` (Wednesday 11:00 UTC)
**CLI:** `packages/lobby/src/ingest-cli.ts` → `runIngestLobby()` in `packages/lobby/src/ingest-run.ts`
**ENV name divergence (CRITICAL):** The workflow maps `SUPABASE_URL: ${{ secrets.SUPABASE_API_URL }}` and `SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}`. The CLI reads `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`. This mapping is **correct and intentional** (documented in YAML comments at `lobby-leylobby-weekly.yml:56-61`). The CLI reads different env var names than the other workflows.
**No R2 secrets in this workflow.** `ingest-cli.ts` does not import R2Store.
- Etapa 1 (R2): **MISSING** — no R2 integration in leylobby ingest.
- Etapa 2 (Supabase): `SupabaseLobbyWriter`. Success: `audiencias>0 OR degradaciones>0` assert.
- Rate-limit/robots: `HostRateLimiter` + `RobotsGuard` + `Fetcher` injected. No WAF on leylobby.gob.cl.
- Hash-check: not implemented (no `cache.hasToday()`).

**Veredicto:** CORRE-CON-GAPS (runs green — 2026-07-01 and 2026-07-08 success)
**Gaps:**
- G10: Etapa-1 completely absent — no R2 crudo for leylobby data. `packages/lobby/src/ingest-cli.ts` (no R2Store import).
- G11: No hash-check before download — no early exit. `packages/lobby/src/ingest-run.ts` (no cache check).

---

### 5. probidad-weekly

**YAML:** `.github/workflows/probidad-weekly.yml`
**Schedule:** `0 11 * * 4` (Thursday 11:00 UTC)
**CLI:** `packages/probidad/src/run-probidad-todos-cli.ts` → `runProbidadTodos()` in `packages/probidad/src/run-probidad-todos.ts`
**Ingestion chain:**
- `InfoProbidadConnector` — SPARQL queries against `datos.cplt.cl/sparql`; uses `Fetcher` + `HostRateLimiter` + `RobotsGuard` (all injected, rate-limit 2-3s).
- Etapa 1 (R2): uses `R2Store` + `SnapshotWriter` from `@obs/ingest`. Present in `run-probidad-todos.ts:143-147`. Gated by R2 creds. **R2 secrets absent → no-op (best-effort per YAML comment).**
- Etapa 2 (Supabase): `SupabaseProbidadWriter`. Writes to `declaracion` table.
- `source_snapshot` / `SnapshotWriter`: present. Also writes to `probidad_ingesta_estado`.

**Failure root cause:** Assert `declaraciones=[1-9][0-9]*|confirmados=[1-9][0-9]*` failed. The CLI ran ~20 seconds, indicating SPARQL was reached but returned 0 results or identity reconciliation produced 0 `confirmados`. Likely cause: SPARQL endpoint returned data but identity match returned 0 `confirmados` with the deterministic matcher, and `declaraciones=0` too (no rows written). Alternatively, a transient SPARQL 503 produced empty results silently without throwing.

**Veredicto:** NO-CORRE (last run 2026-07-02 failed; prior runs not visible in 40-run history)
**Gaps:**
- G12: Assert `declaraciones>0 OR confirmados>0` fired — root cause ambiguous (zero SPARQL results vs zero identity matches). `packages/probidad/src/run-probidad-todos-cli.ts` (assert at end). Needs investigation: check `probidad_ingesta_estado` table or add explicit SPARQL probe logging.
- G13: R2 secrets absent → Etapa-1 silently no-op though code is present. `probidad-weekly.yml:58-63`

---

### 6. fichas-backfill

**YAML:** `.github/workflows/fichas-backfill.yml`
**Trigger:** `workflow_dispatch` only — manual
**CLI:** `packages/fichas/src/pipeline-cli.ts`
**Ingestion chain:**
- Reads `proyecto_ficha` pending rows from Supabase
- Fetches BCN/LeyChile text (`packages/fichas/src/texto-fuente.ts`) using `Fetcher` + `HostRateLimiter` + `RobotsGuard`
- Etapa 1 (R2): `texto-fuente.ts:7` — `TextoR2Target.putImmutable` best-effort; gated by R2 creds. `pipeline-cli.ts:174-188` assembles `R2Store` when creds present.
- LLM extraction: `DeepSeekProvider` (for ficha text), `Gemini` (for embeddings) — both require absent secrets.
- Etapa 2 (Supabase): writes `proyecto_ficha` enriched rows. `SUPABASE_URL` (not `SUPABASE_API_URL`) also referenced at `fichas-backfill.yml:63`.

**Note:** `SUPABASE_URL` secret is absent even though `fichas-backfill.yml:63` references it separately from `SUPABASE_API_URL`. The CLI in `pipeline-cli.ts` likely reads from both.

**Veredicto:** NO-APLICA-CRON (manual; last manually triggered — no run visible in history. Would fail if triggered: `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_URL`, all R2 secrets are absent.)
**Gaps:**
- G14: `DEEPSEEK_API_KEY` absent — LLM ficha extraction would fail or skip. `fichas-backfill.yml:66`
- G15: `GEMINI_API_KEY` absent — embedding generation would fail. `fichas-backfill.yml:67`
- G16: `SUPABASE_URL` absent — secondary Supabase client init may fail. `fichas-backfill.yml:63`
- G17: All R2 secrets absent → Etapa-1 no-op. `fichas-backfill.yml:69-72`

---

### 7. backup-parlamentario

**YAML:** `.github/workflows/backup-parlamentario.yml`
**Schedule:** `0 6 * * 1` (Monday 06:00 UTC, same day as agenda-weekly)
**CLI:** `packages/identity/src/seed-cli.ts` via `pnpm --filter @obs/identity run seed:live`
**Ingestion chain:**
- `seeder.ts` fetches from Cámara XML + Senado XML catalogs; `HostRateLimiter` + `RobotsGuard` via `@obs/ingest`.
- Commits diff to `supabase/seeds/parlamentario.seed.json` via git (`contents: write` permission).
- R2 step (`backup-parlamentario.yml:77-86`): gated by `env.R2_ACCESS_KEY_ID != ''`. Since R2 secrets are absent from repo secrets, `env.R2_ACCESS_KEY_ID` is empty string → **R2 step is skipped by `if:` condition**.
- No Supabase write (comment: "SIN service key local en CI → la carga a DB se omite").

**2026-07-08 failure:** "This run likely failed because of a workflow file issue" — triggered by a push event (not schedule). The scheduled run on 2026-07-06 succeeded. Push-triggered failure is likely a YAML validation/linting error from a recent commit, not a runtime failure. Needs verification by checking the exact push commit.

**Veredicto:** CORRE-CON-GAPS (scheduled runs succeed; R2 step legitimately skipped; not a data ingest workflow)
**Gaps:**
- G18: R2 step skipped (ID-09 cadencia — second destination) because all R2 secrets absent. `backup-parlamentario.yml:85`
- G19: 2026-07-08 push-triggered `startup_failure 0s` — investigate YAML validity after recent push. This was push-triggered, not schedule; distinct from recurring health.

---

### 8. backfill (Deno legacy)

**YAML:** `.github/workflows/backfill.yml`
**Trigger:** `workflow_dispatch` only — manual
**Runtime:** Deno 2.x (only Deno workflow in the repo)
**CLI:** `supabase/functions/ingest-worker/backfill.ts` — runs `DummyConnector` from `@obs/ingest`, not a real source connector.
**Ingestion chain:**
- Uses Deno + `DummyConnector` (test/placeholder connector) against `dummy.local` host.
- Per YAML comment: "En M1 corre el DummyConnector (NO fuentes reales — Camara/Senado/BCN son Fases 5-7)."
- R2 secrets in YAML but all absent from repo secrets → R2 would be no-op even if triggered.

**Purpose:** This is a leftover Milestone 1 escape hatch for testing the BaseConnector flow. It is NOT a production data ingestion workflow. No real source data flows through it.

**Veredicto:** NO-APLICA-CRON (manual + uses DummyConnector, not production-ready)
**Gaps:**
- G20: This workflow references `DummyConnector` only — it cannot backfill real production data. Needs reassessment: either repurpose for a real connector or retire. `.github/workflows/backfill.yml:7-9`

---

### 9. deploy-cloudflare

**YAML:** `.github/workflows/deploy-cloudflare.yml`
**Trigger:** `workflow_dispatch` only — manual
**Purpose:** Frontend Next.js deployment to Cloudflare Workers via `@opennextjs/cloudflare`. NOT a data ingestion workflow.
**Required secrets:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` — both absent from repo secrets.
**Runtime worker secrets** (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `CRUCES_PUBLIC_ENABLED`) set via `wrangler secret put` one-time, not via this workflow.

**Veredicto:** NO-APLICA-CRON (manual deploy; would fail if triggered because `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` absent)
**Gaps:**
- G21: `CLOUDFLARE_API_TOKEN` absent → deploy would fail. `deploy-cloudflare.yml:59`
- G22: `CLOUDFLARE_ACCOUNT_ID` absent → deploy would fail. `deploy-cloudflare.yml:60`

---

## Summary Table (9 workflows)

| # | Workflow | Schedule | Trigger | Secrets Required | Secrets Present | Last Run | Veredicto |
|---|----------|----------|---------|-----------------|-----------------|----------|-----------|
| 1 | agenda-weekly | Mon 11:00 UTC | schedule + dispatch | SUPABASE_API_URL, SUPABASE_SECRET_KEY, DEEPSEEK_API_KEY, R2_* (4) | 2/7 | 2026-07-06 ✓ | CORRE-CON-GAPS |
| 2 | leyes-weekly | Fri 20:00 UTC | schedule + dispatch | SUPABASE_API_URL, SUPABASE_SECRET_KEY | 2/2 | 2026-07-03 ✗ | NO-CORRE (bug upsert) |
| 3 | lobby-camara-weekly | Tue 11:00 UTC | schedule + dispatch | SUPABASE_API_URL, SUPABASE_SECRET_KEY, R2_* (4) | 2/6 | 2026-07-07 ✗ | NO-CORRE (WAF) |
| 4 | lobby-leylobby-weekly | Wed 11:00 UTC | schedule + dispatch | SUPABASE_API_URL→SUPABASE_URL, SUPABASE_SECRET_KEY→SUPABASE_SERVICE_KEY | 2/2 | 2026-07-08 ✓ | CORRE-CON-GAPS |
| 5 | probidad-weekly | Thu 11:00 UTC | schedule + dispatch | SUPABASE_API_URL, SUPABASE_SECRET_KEY, R2_* (4, optional) | 2/6 | 2026-07-02 ✗ | NO-CORRE (0 results) |
| 6 | fichas-backfill | — | manual only | SUPABASE_URL, SUPABASE_API_URL, SUPABASE_SECRET_KEY, DEEPSEEK_API_KEY, GEMINI_API_KEY, R2_* (4) | 2/9 | never | NO-APLICA-CRON |
| 7 | backup-parlamentario | Mon 06:00 UTC | schedule + dispatch | R2_* (4, optional gated) | 0/4 opt | 2026-07-06 ✓ sched | CORRE-CON-GAPS |
| 8 | backfill | — | manual only | SUPABASE_API_URL, SUPABASE_SECRET_KEY, R2_* (4) | 2/6 | never | NO-APLICA-CRON |
| 9 | deploy-cloudflare | — | manual only | CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID | 0/2 | never | NO-APLICA-CRON |

---

## DOS ETAPAS Compliance Map

| Workflow / Connector | Etapa-1 fuente→R2 | Etapa-2 reads from R2? | Hash-check antes de descargar | Re-ingest R2→Supabase path exists? |
|---------------------|-------------------|----------------------|------------------------------|-------------------------------------|
| agenda-weekly (`run-agenda-prod-cli`) | Present, best-effort, **no-op today** (R2 secrets absent) | NO — reads from in-memory | Partial (per-semana ISO key, not sha256 ETag) | NO |
| leyes-weekly (`run-tramitacion-prod-cli`) | **ABSENT** — never implemented | NO | NO | NO |
| lobby-camara-weekly (`run-camara-lobby-cli`) | Present, best-effort, **no-op today** (R2 absent; WAF blocks even getting HTML) | NO — reads from in-memory curl file | NO (curl step not hash-gated) | NO |
| lobby-leylobby-weekly (`ingest-cli`) | **ABSENT** | NO | NO | NO |
| probidad-weekly (`run-probidad-todos-cli`) | Present (R2Store + SnapshotWriter), **no-op today** (R2 secrets absent) | NO — reads from SPARQL results in memory | Per `HostRateLimiter` (rate) but no sha256/ETag gate | NO |
| fichas-backfill (`pipeline-cli`) | Present (texto-fuente R2Target), **no-op today** (R2 secrets absent + CLI secrets absent) | NO | Partial (allowlist check only) | NO |
| backup-parlamentario (`seed-cli`) | Present in code (WR-02 fixed per YAML comment), **skipped** (R2 secrets absent) | N/A (seed, not ingest) | N/A | N/A |
| backfill (`DummyConnector`) | Present in BaseConnector, no real source | BaseConnector: yes reads from in-memory raw | BaseConnector: `cache.hasToday()` present | BaseConnector has snapshot, but no read-back path |

**Key finding:** No connector in this codebase implements an R2→Supabase read-back path. All Etapa-2 implementations read from in-memory fetch results, not from stored R2 crudo. Re-ingesting to Supabase (e.g., on schema change) would require re-fetching from the government source, violating the LOCKED rule. This is a systematic architectural gap across all 5 active connectors. [VERIFIED: source grep — no `GetObject` or R2-read pattern found in any `packages/**` connector]

---

## Rate-limit / UA / Robots Compliance

| Connector | HostRateLimiter | UA identificatorio | robots.txt | Rate confirmed |
|-----------|:-:|:-:|:-:|:--|
| agenda (Cámara via curl) | YES (injected) | YES (`Bot-Ciudadano/1.0` in curl step) | YES (RobotsGuard injected) | 2-3s via HostRateLimiter |
| agenda (Senado, fetch) | YES | YES (Fetcher default UA) | YES | 2-3s |
| tramitacion (Cámara WS) | YES | YES | YES | 2-3s |
| tramitacion (Senado XML) | YES | YES | YES | 2-3s |
| lobby-camara (curl) | YES in CLI, **curl step has no rate-limit** | YES curl step | YES in CLI | curl step = single request; CLI not reached (WAF) |
| lobby-leylobby | YES | YES | YES | 2-3s |
| probidad (SPARQL) | YES | YES | YES | 2-3s |
| fichas (BCN fetch) | YES | YES | YES | 2-3s |

---

## Observability Tables

| Table | Defined in | Written by | Notes |
|-------|------------|------------|-------|
| `ingest_run` | `0002_control_tables.sql:11` | Not yet wired in active CLIs (BaseConnector has `IngestRun` param but active CLIs don't pass a run ID) | Available schema, not actively written by Node CLIs |
| `source_snapshot` | `0002_control_tables.sql:22` | `SnapshotWriter` in `@obs/ingest` — used by probidad and BaseConnector only | Written when R2 secrets present; currently no-op |
| `drift_alert` | `0002_control_tables.sql:40` | BaseConnector `drift.alert()` | Not used by active Node CLIs |
| `lobby_ingesta_estado` | `0021_lobby.sql:133` | `SupabaseLobbyWriter` | Written per-parlamentario per run |
| `probidad_ingesta_estado` | `0022_probidad.sql:361` | `SupabaseProbidadWriter` | Written per-parlamentario per run |

**Freshness baseline queries (for audit document):**
```sql
-- Last Supabase write per domain (read-only):
SELECT max(created_at) FROM citacion;
SELECT max(created_at) FROM lobby_audiencia;
SELECT max(updated_at) FROM declaracion;
SELECT max(updated_at) FROM proyecto;
SELECT max(date_bucket) FROM source_snapshot;
SELECT max(ultima_ingesta) FROM lobby_ingesta_estado;
SELECT max(ultima_ingesta) FROM probidad_ingesta_estado;
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Notes |
|------------|------------|-----------|---------|-------|
| `gh` CLI | Run history, secret list | YES | authenticated as `xenaquis` | `repo`, `workflow` scopes; remote = `Cuchecorp/gov-map` |
| `SUPABASE_DB_URL` | Supabase read-only SELECTs | YES (in `.env`) | — | Use `PGCLIENTENCODING=UTF8` on Windows; BOM-strip the .env value |
| `psql` | Supabase probes | CHECK | — | Must verify with `psql --version` before plan tasks |
| R2 credentials | R2 read probe | YES (in `.env`) | — | `.env` has `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — absent from repo secrets |
| `aws` CLI or `aws4fetch` | R2 list objects | PARTIAL | — | `aws s3 ls` with `--endpoint-url` from `.env`; or use existing `R2Store` class in a probe script |

**R2 probe command (read-only, using `.env` creds locally):**
```bash
# Load from .env (BOM-safe):
source <(sed 's/\r//;/^[A-Z]/s/=\(.*\)/="\1"/' .env | grep "^R2_")
aws s3 ls "s3://$R2_BUCKET/" --endpoint-url "$R2_ENDPOINT_URL" --recursive --human-readable 2>&1 | head -20
```

**Supabase probe (Windows — PGCLIENTENCODING required):**
```bash
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -c "SELECT source, max(date_bucket) FROM source_snapshot GROUP BY source;"
```

---

## Gap List (Master)

| # | Gap | Severity | Workflow | File:Line | Fix Type |
|---|-----|----------|----------|-----------|----------|
| G1 | `DEEPSEEK_API_KEY` absent from repo secrets → tabla sala degrada | HIGH | agenda-weekly | `.github/workflows/agenda-weekly.yml:58` | Load secret in repo |
| G2 | R2_* secrets absent → Etapa-1 no-op in agenda | HIGH | agenda-weekly | `agenda-weekly.yml:60-61` | Load 4 R2 secrets |
| G3 | Etapa-2-from-R2 re-ingest path absent in agenda | MEDIUM | agenda-weekly | `packages/agenda/src/ingest-run.ts` | Implement in Phase 57 |
| G4 | `tramitacion_evento` upsert ON CONFLICT within batch — hard failure | CRITICAL | leyes-weekly | `packages/tramitacion/src/writer-supabase.ts` (upsert batch logic); `packages/tramitacion/src/writer.ts:8` | Fix upsert to use INSERT ... ON CONFLICT DO UPDATE with dedup before batch |
| G5 | Etapa-1 completely absent in tramitacion | HIGH | leyes-weekly | `packages/tramitacion/src/ingest-cli.ts:16` | Implement R2 write |
| G6 | No hash-check/early-exit in tramitacion | MEDIUM | leyes-weekly | `packages/tramitacion/src/run-tramitacion-prod-cli.ts` | Add sha256/ETag check |
| G7 | WAF `camara.cl` now blocks GH Actions IPs via curl | CRITICAL | lobby-camara-weekly | `.github/workflows/lobby-camara-weekly.yml:49-54` | Investigate alternative (residential proxy, Cloudflare IP allowlist, or different endpoint) |
| G8 | R2_* secrets absent → Etapa-1 no-op in lobby-camara | HIGH | lobby-camara-weekly | `lobby-camara-weekly.yml:61-64` | Load 4 R2 secrets |
| G9 | Etapa-2-from-R2 re-ingest path absent in lobby-camara | MEDIUM | lobby-camara-weekly | `packages/lobby/src/run-camara-lobby.ts` | Implement |
| G10 | Etapa-1 completely absent in leylobby | HIGH | lobby-leylobby-weekly | `packages/lobby/src/ingest-cli.ts` (no R2Store import) | Implement R2 write |
| G11 | No hash-check/early-exit in leylobby | MEDIUM | lobby-leylobby-weekly | `packages/lobby/src/ingest-run.ts` | Add cache check |
| G12 | probidad assert `declaraciones>0 OR confirmados>0` fired — root cause unclear | HIGH | probidad-weekly | `packages/probidad/src/run-probidad-todos-cli.ts` (end of run) | Investigate: check `probidad_ingesta_estado` for last known state; add explicit SPARQL result count log |
| G13 | R2_* secrets absent → Etapa-1 no-op in probidad | HIGH | probidad-weekly | `probidad-weekly.yml:58-63` | Load 4 R2 secrets (code already implemented) |
| G14 | `DEEPSEEK_API_KEY` absent → fichas extraction fails | HIGH | fichas-backfill | `fichas-backfill.yml:66` | Load secret |
| G15 | `GEMINI_API_KEY` absent → embedding fails | HIGH | fichas-backfill | `fichas-backfill.yml:67` | Load secret |
| G16 | `SUPABASE_URL` absent (separate from `SUPABASE_API_URL`) | HIGH | fichas-backfill | `fichas-backfill.yml:63` | Load secret or verify CLI uses SUPABASE_API_URL as fallback |
| G17 | R2_* absent → Etapa-1 no-op in fichas | HIGH | fichas-backfill | `fichas-backfill.yml:69-72` | Load 4 R2 secrets |
| G18 | backup-parlamentario R2 step skipped (ID-09 cadencia) | MEDIUM | backup-parlamentario | `backup-parlamentario.yml:85` | Load R2 secrets |
| G19 | backup-parlamentario push-triggered `startup_failure` 2026-07-08 | MEDIUM | backup-parlamentario | `.github/workflows/backup-parlamentario.yml` (YAML validity) | Investigate with `gh run view 28980585955` |
| G20 | `backfill` workflow uses DummyConnector — cannot backfill real data | LOW | backfill | `.github/workflows/backfill.yml:7-9` | Repurpose or retire |
| G21 | `CLOUDFLARE_API_TOKEN` absent → deploy-cloudflare fails | HIGH | deploy-cloudflare | `deploy-cloudflare.yml:59` | Load secret when deploy needed |
| G22 | `CLOUDFLARE_ACCOUNT_ID` absent → deploy-cloudflare fails | HIGH | deploy-cloudflare | `deploy-cloudflare.yml:60` | Load secret when deploy needed |
| G23 | Systematic: no connector implements R2→Supabase read-back path (Etapa-2 re-ingest from R2) | HIGH | ALL active connectors | All `run-*-cli.ts` files | Phase 57 systematic fix |

---

## Architecture Patterns

### Billing / Scheduling Status

**GitHub Actions billing is NOT blocked.** All scheduled workflows ran recently (up to 2026-07-08). The 2026-06-23 memory "billing GH bloqueado" was a transient state that is resolved. Scheduled runs have been executing consistently since late June. [VERIFIED: live `gh run list` output]

### Project Structure (Relevant to Audit)

```
.github/workflows/         ← 9 YAMLs to audit
packages/
  @obs/ingest/src/
    base-connector.ts      ← BaseConnector (hash-check + R2 + snapshot) — used by DummyConnector ONLY
    r2-store.ts            ← R2Store.putImmutable (content-addressed)
    snapshot.ts            ← SnapshotWriter → source_snapshot table
    cache.ts               ← cache.hasToday() — daily hash-check
    rate-limiter.ts        ← HostRateLimiter (2-3s)
  @obs/agenda/src/
    run-agenda-prod-cli.ts ← agenda-weekly entry point
    ingest-run.ts          ← Etapa-1 R2 (best-effort, line 218)
  @obs/tramitacion/src/
    run-tramitacion-prod-cli.ts ← leyes-weekly entry point
    ingest-cli.ts          ← NO R2 (comment line 16)
    writer-supabase.ts     ← tramitacion_evento upsert (bug G4)
  @obs/lobby/src/
    run-camara-lobby-cli.ts ← lobby-camara-weekly entry point
    run-camara-lobby.ts    ← Etapa-1 R2 best-effort (line 85-103)
    ingest-cli.ts          ← lobby-leylobby-weekly entry point (NO R2)
  @obs/probidad/src/
    run-probidad-todos-cli.ts ← probidad-weekly entry point
    run-probidad-todos.ts  ← Etapa-1 R2 + SnapshotWriter (line 143-147)
  @obs/fichas/src/
    pipeline-cli.ts        ← fichas-backfill entry point
    texto-fuente.ts        ← Etapa-1 R2 best-effort
  @obs/identity/src/
    seed-cli.ts            ← backup-parlamentario entry point
supabase/functions/ingest-worker/
    backfill.ts            ← backfill workflow (Deno, DummyConnector)
```

---

## Validation Architecture

### Phase 56 is a pure audit phase — no code changes, only document production.

| Success Criterion | Validation Method | Command |
|------------------|-------------------|---------|
| Veredicto per workflow correct | Reproducible via `gh run list` | `gh run list --repo Cuchecorp/gov-map --limit 40` |
| Secrets inventory accurate | Reproducible via `gh secret list` | `gh secret list --repo Cuchecorp/gov-map` |
| Failure root causes verified | Reproducible via `gh run view --log-failed` | `gh run view <ID> --repo Cuchecorp/gov-map --log-failed` |
| R2 Etapa-1 code presence verified | Grep source files | `grep -rn "putImmutable\|R2Store" packages/ --include="*.ts"` |
| Etapa-2-from-R2 absence verified | Grep source files | `grep -rn "GetObject\|getObject\|readFromR2\|from_r2" packages/ --include="*.ts"` |
| tramitacion_evento conflict bug | Check migration + writer | `packages/tramitacion/src/writer.ts:8` + run log |
| R2 freshness (local probe) | `aws s3 ls` with `.env` creds | See R2 probe command above |
| Supabase freshness | psql read-only SELECTs | See freshness queries above |

**The deliverable (`56-CRON-AUDIT.md`) is self-validating:** each gap claim references a file:line or `gh run view` command that reproduces the evidence.

### Wave 0 Gaps
- None — no test infrastructure changes needed for a read-only audit phase.

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V5 Input Validation | partial | Audit checks that secrets are never printed in logs (YAML uses `secrets.*`; verified) |
| V6 Cryptography | no | — |

**Security note:** The audit document must never print secret values. All `gh secret list` output returns only names + timestamps, not values. [VERIFIED: gh CLI behavior]

---

## Common Pitfalls (for the audit executor)

### Pitfall 1: Inferring secret presence from `.env` local file
**What goes wrong:** `.env` has R2 creds locally but they are absent from GitHub Actions repo secrets. A run that degrades silently locally (because `.env` provides creds) will fail differently in CI.
**Prevention:** Always verify against `gh secret list --repo Cuchecorp/gov-map`, not local `.env`.

### Pitfall 2: Confusing "best-effort" R2 with "R2 Etapa-1 implemented"
**What goes wrong:** Several connectors have R2 write code present but gated as `best-effort` (won't throw if R2 fails). This means Etapa-1 exists in code but is silently skipped when secrets absent, giving a false impression of compliance.
**Prevention:** Check both code presence AND secret availability AND actual R2 objects written.

### Pitfall 3: backup-parlamentario is not a data ingestion workflow
**What goes wrong:** Treating backup-parlamentario like the other 5 crons and expecting it to comply with DOS ETAPAS. It is an identity seed refresh that commits to git — a different category.
**Prevention:** Apply `NO-APLICA-CRON` for its data classification but still audit its R2 secondary step (G18) as an ID-09 cadence gap.

### Pitfall 4: lobby-leylobby env var naming divergence
**What goes wrong:** Assuming the workflow uses `SUPABASE_API_URL`/`SUPABASE_SECRET_KEY` like all other workflows. It maps to `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` for the CLI.
**Prevention:** Cross-reference YAML `env:` blocks against CLI source `loadEnv()` calls.

### Pitfall 5: psql BOM on Windows
**What goes wrong:** `SUPABASE_DB_URL` from `.env` starts with BOM (U+FEFF) on Windows → psql connection string invalid.
**Prevention:** `PGCLIENTENCODING=UTF8` and BOM-strip: `$(sed 's/\r//;s/^\xEF\xBB\xBF//' <<< "$SUPABASE_DB_URL")`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | probidad failure (2026-07-02) caused by 0 results from SPARQL or 0 identity matches — not a code crash | Findings §5 | If it's a code crash (import error, unhandled exception), the fix is different (not a data issue) |
| A2 | backup-parlamentario 2026-07-08 `startup_failure` is a YAML syntax error from a push commit, not a recurring issue | Findings §7 | If it's a recurring issue it affects the Monday schedule too |
| A3 | `SUPABASE_URL` in fichas-backfill is a distinct secret (not a duplicate of `SUPABASE_API_URL`) | Findings §6 | If the CLI treats them as identical, G16 is not a gap |

---

## Sources

### Primary (HIGH confidence)
- Live `gh run list --repo Cuchecorp/gov-map` output (2026-07-08) — run history and verdicts
- Live `gh secret list --repo Cuchecorp/gov-map` output (2026-07-08) — exactly 2 secrets present
- `.github/workflows/*.yml` — all 9 YAMLs read directly
- `packages/@obs/*/src/*.ts` — connector source files read directly (base-connector, r2-store, snapshot, run-*-cli files)
- `supabase/migrations/0002_control_tables.sql`, `0008_tramitacion.sql`, `0021_lobby.sql`, `0022_probidad.sql` — observability table schemas
- `gh run view <ID> --log-failed` — failure logs for leyes-weekly (G4), lobby-camara (G7), probidad (G12)

### Secondary (MEDIUM confidence)
- `git remote -v` — confirmed Cuchecorp/gov-map as remote
- MEMORY.md entries re: billing state, R2 401, secrets gotchas

---

## Metadata

**Confidence breakdown:**
- Workflow inventory & secrets: HIGH — live `gh` API
- Run history & verdicts: HIGH — live `gh run list` + `gh run view --log-failed`
- Code seams (file:line): HIGH — direct source read
- probidad failure root cause: MEDIUM — log shows assertion fired but SPARQL response content not in log
- backup 2026-07-08 push failure: MEDIUM — startup_failure message without log access

**Research date:** 2026-07-08
**Valid until:** 2026-07-22 (run history evolves weekly; re-run `gh run list` before planning if > 2 weeks)
