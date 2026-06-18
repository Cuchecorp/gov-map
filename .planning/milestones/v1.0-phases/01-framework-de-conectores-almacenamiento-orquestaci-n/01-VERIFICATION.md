---
phase: 01-framework-de-conectores-almacenamiento-orquestaci-n
verified: 2026-06-17T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (code-level); 1 live-infra checkpoint pending human
overrides_applied: 0
human_verification:
  - test: "Bucket R2 existe y credenciales son validas"
    expected: "PUT de un objeto de prueba a R2 responde 200; GET recupera el mismo objeto"
    why_human: "aws4fetch escribe objetos pero no crea el bucket; Cloudflare R2 es infraestructura externa que el agente no puede provisionar ni verificar en CI"
  - test: "PUT condicional If-None-Match honrado por R2"
    expected: "Un segundo PUT del mismo contenido (misma sha256 key) retorna 412 (idempotente) — el objeto no se sobrescribe; si R2 no honra If-None-Match, el content-addressing (key=sha) garantiza igual la no-sobrescritura"
    why_human: "El comportamiento de If-None-Match depende del servicio R2 real; los tests unitarios lo verifican con mock"
  - test: "source_snapshot con provenance aparece en Postgres tras una corrida del DummyConnector contra el worker"
    expected: "Fila en source_snapshot con r2_path, content_hash, source_url, fetched_at NO nulas; sin columnas de crudo en la fila (solo referencia)"
    why_human: "Requiere que supabase functions serve corra con secrets R2/Supabase reales, una queue activa y Docker con las migraciones aplicadas"
  - test: "Job ackeado en exito, reaparece tras vt en fallo simulado"
    expected: "pgmq.read('ingest_jobs') retorna 0 filas tras un job exitoso; tras un fallo simulado el mensaje reaparece al expirar el visibility timeout"
    why_human: "Requiere stack Supabase completo activo (pg_cron + pgmq + Edge Function) con una corrida real de ingesta"
  - test: "0 errores 403/429 en corrida acotada del DummyConnector contra un endpoint publico real"
    expected: "El rate-limiter 2-3s + UA identificatorio + robots.txt evita que el WAF del servidor devuelva 403/429 por rafaga"
    why_human: "Requiere red real hacia un endpoint publico; no determinista en CI; el VALIDATION.md lo clasifica explicitamente como manual-only"
---

# Phase 1 — Verification Report

**Phase Goal:** El sistema puede ingestar cualquier fuente gubernamental de forma respetuosa, guardar el crudo inmutable con procedencia, detectar drift y orquestar trabajo pesado por cola — la base que todo conector posterior hereda sin reescribir politica.

**Verified:** 2026-06-17

**Status:** human_needed

**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Un backfill completo respeta 2-3s entre requests con UA identificatorio y robots.txt — no aparece 403/429 por rafaga | VERIFIED (code) / HUMAN (live) | `HostRateLimiter.wait()` encadena promesas por host con `minDelayMs=2000 + jitter 0-1000ms` (serial, NUNCA opcional en `BaseConnector.run()` linea 116). `RobotsGuard` con `IDENTIFIED_UA` LOCKED. `Fetcher` usa el mismo UA. La prueba live contra red real es checkpoint humano (VALIDATION.md lo clasifica explicitamente como manual-only). |
| 2 | Todo crudo queda en R2 append-only con hash; Postgres guarda solo r2_path/hash + source_snapshot/ingest_run, nunca el crudo | VERIFIED | `R2Store.putImmutable` produce key `{source}/{resource}/{date}/{sha256}.{ext}` con `If-None-Match: *`. `0002_control_tables.sql`: `source_snapshot` tiene `r2_path text`, `content_hash text`; cero columnas `bytea`/`raw_body`/`jsonb`-de-crudo. `SnapshotWriter.write()` persiste solo la referencia. |
| 3 | Una misma fuente cacheada en el dia no se re-pide; snapshot versionado permite re-procesar sin re-scrapear | VERIFIED | `DailyCache.hasToday()` consulta `source_snapshot` por `(source, resource, date_bucket)`. `BaseConnector.run()` hace `continue` en cache hit (linea 107) antes de llamar robots/rate-limiter/fetcher. `unique (source, resource, date_bucket)` definida en DDL (0002, linea 35). |
| 4 | Un cambio de esquema en una fuente dispara una alerta de drift en lugar de corromper en silencio | VERIFIED | `DriftDetector.check()` compara fingerprint estructural; `drift.alert()` inserta `drift_alert` y traga excepciones (no lanza). `BaseConnector.run()` llama `alert` si `changed=true` y continua la ingesta (lineas 130-133). Tests de drift verifican `changed=true` con fixtures `shape-changed.json`. |
| 5 | La ingesta pesada corre dirigida por pgmq + pg_cron con chunking y backoff exponencial ante 429, y cada dato normalizado conserva su procedencia | VERIFIED | `0003_orchestration.sql`: `pgmq.create('ingest_jobs')` + `pgmq.create('ingest_dlq')`, `util.process_ingest_jobs()` con `pgmq.read(vt)`, `cron.schedule('30 seconds')`, DLQ por `read_ct > 5`. `RetryableError` ante 429/5xx => no-ack => vt expira => backoff. `makeProvenance()` capturado en `BaseConnector.run()` linea 122 antes del fetch y escrito en `source_snapshot` via `SnapshotWriter`. |

**Score:** 5/5 truths verified at code level. 1 live-infra checkpoint (SC-1 + SC-2 partial) pendiente de verificacion humana.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/provenance.ts` | Tipo Provenance + makeProvenance (FND-08) | VERIFIED | 29 lineas; interface Provenance + helper puro makeProvenance; no deps de runtime |
| `packages/core/src/domain.ts` | IngestRun / SourceSnapshot / DriftAlert / isIngestStatus | VERIFIED | Existe; re-exportado por index.ts |
| `packages/core/src/index.ts` | Re-exporta provenance + domain | VERIFIED | `export * from "./provenance"` + `export * from "./domain"` |
| `supabase/migrations/0001_extensions.sql` | vector / pg_cron / pg_net / pgmq | VERIFIED | Las 4 extensiones presentes con `create extension if not exists` |
| `supabase/migrations/0002_control_tables.sql` | DDL de control + RLS deny-by-default | VERIFIED | ingest_run / source_snapshot / drift_alert; unique diaria; RLS enable en las 3 tablas; cero columnas de crudo |
| `packages/ingest/src/base-connector.ts` | Template Method run() flujo invariante | VERIFIED | 175 lineas; flujo completo cache->robots->rateLimiter.wait->fetcher.get->drift->R2->snapshot; rateLimiter.wait NO opcional |
| `packages/ingest/src/rate-limiter.ts` | Rate-limiter serial por host, 2-3s + jitter | VERIFIED | 57 lineas; Map host->Promise cola encadenada; minDelayMs=2000, jitterMs=1000 |
| `packages/ingest/src/r2-store.ts` | Writer R2 content-addressed con If-None-Match | VERIFIED | 80 lineas; aws4fetch; `If-None-Match: *` en PUT; 412 = idempotente OK; sha256Hex via Web Crypto |
| `packages/ingest/src/drift.ts` | Fingerprint estructural + compare + alert | VERIFIED | 87 lineas; structuralPaths + fingerprint sha256; DriftDetector.alert() no lanza |
| `packages/ingest/src/dummy-connector.ts` | Connector E2E del framework | VERIFIED | Existe; subclase de BaseConnector; no fuente gubernamental real |
| `supabase/migrations/0003_orchestration.sql` | pgmq queues + util.process_ingest_jobs + cron.schedule | VERIFIED | pgmq.create x2; dispatcher con vt-backoff y DLQ por read_ct; cron.schedule 30s; service_key via util.service_key() (no hardcoded) |
| `supabase/functions/ingest-worker/index.ts` | Worker Deno que consume el batch y corre DummyConnector | VERIFIED | Delega a worker.ts; Deno.serve bajo import.meta.main |
| `supabase/functions/deno.json` | Import map @obs/* a packages/*/src | VERIFIED | Aliasa @obs/core y @obs/ingest a rutas relativas; unstable sloppy-imports |
| `.github/workflows/backfill.yml` | Escape hatch CI para backfill masivo | VERIFIED | workflow_dispatch; deno run backfill.ts; repo secrets; sin valores en claro |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/core/src/index.ts` | `provenance.ts` | re-export | VERIFIED | `export * from "./provenance"` presente |
| `base-connector.ts` | `rate-limiter.ts` | `rateLimiter.wait(spec.host)` | VERIFIED | Linea 116; parte del flujo invariante no sobreescribible |
| `r2-store.ts` | aws4fetch AwsClient | PUT con If-None-Match | VERIFIED | `headers: { "If-None-Match": "*" }` en linea 70 |
| `snapshot.ts` | `@obs/core Provenance` | escribe provenance en source_snapshot | VERIFIED | `import type { Provenance } from "@obs/core"`; `source_url` y `fetched_at` mapeados del objeto Provenance |
| `base-connector.ts` | `@obs/core` | import de makeProvenance/Provenance | VERIFIED | `import { type Provenance, makeProvenance } from "@obs/core"` linea 16 |
| `0003_orchestration.sql` | `ingest-worker` Edge Function | `net.http_post a /functions/v1/ingest-worker` | VERIFIED | `util.project_url() || '/functions/v1/ingest-worker'` en linea 144 |
| `ingest-worker/index.ts` | `@obs/ingest DummyConnector` | import via deno.json import map | VERIFIED | Delega a worker.ts que importa DummyConnector via @obs/ingest |
| `ingest-worker/index.ts` | pgmq | ack via pgmq.delete en exito | VERIFIED | makeQueueAck exportado de worker.ts |

---

### Data-Flow Trace (Level 4)

No aplica en esta fase: no hay componentes que rendericen datos dinamicos (es backend puro, sin UI — UI es Phase 5). Los flujos de datos de ingesta estan verificados por los key links y los tests unitarios con fixtures.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `pnpm -w typecheck` corre limpio | `pnpm -w typecheck` | Confirmado verde en SUMMARY 01-01 y 01-02 (typecheck como gate de acceptance criteria de cada tarea) | PASS (SUMMARY evidence) |
| 35 tests unitarios vitest verdes | `pnpm -w test --run` | 3 @obs/core + 32 @obs/ingest = 35 verde (orchestrator-confirmed) | PASS |
| pgTAP 18/18 | `supabase test db` | 12 de 0001_control_plane + 6 de 0002_orchestration = 18 (SUMMARY 01-03) | PASS |
| deno test 3/3 | `deno task test` desde supabase/functions | 3 tests ack/no-ack/mixto verdes (SUMMARY 01-03) | PASS |
| `supabase db lint` limpio | `supabase db lint` | "No schema errors found" (SUMMARY 01-03) | PASS |

---

### Probe Execution

No hay probes convencionales `scripts/*/tests/probe-*.sh` en este proyecto. El plan 03 declara un checkpoint human-verify (Task 3, `gate=blocking-human`) como el equivalente funcional — ver seccion Human Verification Required.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| FND-01 | Plan 02 | Rate-limit 2-3s serial por host, robots.txt, UA identificatorio | SATISFIED | `HostRateLimiter` + `RobotsGuard` + `Fetcher` con IDENTIFIED_UA LOCKED; flujo invariante en BaseConnector |
| FND-02 | Plan 01 + 02 | Crudo en R2 append-only content-addressed; Postgres solo referencia | SATISFIED | `R2Store.putImmutable` sha256 key + If-None-Match; DDL sin columnas de crudo; SnapshotWriter |
| FND-03 | Plan 02 | Cache diaria: misma fuente en el dia no se re-pide | SATISFIED | `DailyCache.hasToday()` + `unique (source, resource, date_bucket)` DDL; BaseConnector skip en cache hit |
| FND-04 | Plan 02 | Drift de esquema dispara alerta, no corrompe en silencio | SATISFIED | `DriftDetector` con fingerprint estructural sha256; `drift_alert` insertado sin bloquear la ingesta |
| FND-05 | Plan 03 | Ingesta dirigida por pgmq + pg_cron; chunking; backoff exponencial ante 429 | SATISFIED | 0003_orchestration.sql con queues + dispatcher vt-backoff + cron; RetryableError => no-ack => vt |
| FND-08 | Plan 01 + 02 | Provenance (origen, fecha, enlace) capturada al ingestar | SATISFIED | `makeProvenance()` capturado en BaseConnector antes del R2 write; `SnapshotWriter` persiste source_url/fetched_at |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `supabase/functions/deno.json` | — | `--no-check` en deno task test | Info | Quirk de tipos CJS de robots-parser@3 bajo Deno (documentado en SUMMARY 01-03); runtime correcto, solo typecheck Deno disconforme; no afecta tests Node/vitest ni el runtime del worker |
| `supabase/functions/deno.json` | — | `"unstable": ["sloppy-imports"]` | Info | Requerido por imports extensionless de @obs/* escritos para Node/tsc; documentado; no crea riesgo de seguridad |
| `supabase/migrations/0003_orchestration.sql` | 55 | `util.service_key()` retorna string vacio si no esta configurado | Warning | En produccion requiere setear el GUC/vault (`alter database postgres set app.settings.service_key`); documentado en el header de la migracion como config de despliegue, no codigo faltante |

No se encontraron marcadores `TBD`, `FIXME`, `XXX` no referenciados en los archivos modificados por la fase.

---

### Human Verification Required

#### 1. Bucket R2 + Credenciales

**Test:** Confirmar que el bucket nombrado en `.env` (`R2_BUCKET`, actualmente `observatorio`) EXISTE en el dashboard de Cloudflare R2 y que `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_ENDPOINT_URL` son validas. Prueba minima: hacer un PUT y un GET de un objeto de prueba con las credenciales del `.env`.

**Expected:** PUT retorna 200; GET recupera el mismo objeto; el bucket aparece en el dashboard de Cloudflare.

**Why human:** aws4fetch escribe objetos pero no crea el bucket. El agente no puede provisionar infraestructura de Cloudflare. Es un prerequisito para las corridas de integracion reales (Plan 01 y Plan 02 SUMMARYs lo documentan como "blocker menor" heredado).

---

#### 2. PUT Condicional (If-None-Match) + Inmutabilidad en R2 Real

**Test:** Correr `supabase functions serve ingest-worker` (o el workflow backfill con `iterations=1`) encolando un job del DummyConnector. Hacer un segundo PUT del mismo contenido. Verificar que el segundo PUT retorna 412.

**Expected:** Primer PUT crea el objeto content-addressed (`dummy/echo/<fecha>/<sha>.json`). Segundo PUT del mismo contenido retorna 412 (idempotente — no sobrescribe). Si R2 no honra `If-None-Match: *`, el content-addressing (key=sha) garantiza igual la no-sobrescritura (fallback seguro).

**Why human:** El comportamiento de `If-None-Match: *` depende del servicio R2 real. Los tests unitarios lo verifican con mockFetch pero no con el servicio vivo.

---

#### 3. source_snapshot con Provenance en Postgres

**Test:** Tras una corrida del DummyConnector via el worker, consultar `select r2_path, content_hash, source_url, fetched_at from source_snapshot limit 5`.

**Expected:** Al menos una fila con `r2_path`, `content_hash`, `source_url` y `fetched_at` NO nulas. Sin columna de crudo (solo la referencia). El `r2_path` debe coincidir con el objeto visible en el dashboard de R2.

**Why human:** Requiere stack Supabase completo activo (pg_cron + pgmq + Edge Function desplegada o en modo serve) con secrets R2/Supabase reales configurados.

---

#### 4. Ack de Cola + Backoff por VT

**Test:** Encolar un job en `ingest_jobs`; esperar que el worker lo procese exitosamente; verificar con `select * from pgmq.read('ingest_jobs', 1, 10)` que retorna 0 filas. Luego simular un fallo (p.ej. R2 no disponible) y verificar que el mensaje reaparece tras expirar el visibility timeout.

**Expected:** Jobs exitosos desaparecen de la cola (pgmq.delete). Jobs fallidos reaparecen tras vt (backoff natural). Poison messages (read_ct > 5) van a `ingest_dlq`.

**Why human:** Requiere el stack de orquestacion activo (pg_cron disparando util.process_ingest_jobs) con Docker y supabase local o remoto.

---

#### 5. 0 Errores 403/429 en Corrida Acotada contra Endpoint Real

**Test:** Correr el workflow de backfill (`workflow_dispatch`, `iterations=1`) apuntando el DummyConnector a un endpoint publico real (o correr `supabase functions serve ingest-worker` encolando un job manual). Revisar los logs de la Edge Function.

**Expected:** 0 respuestas 403 o 429 por rafaga. El rate-limiter de 2-3s + UA identificatorio + robots.txt evitan baneos por WAF.

**Why human:** Requiere red real hacia un endpoint publico externo. No determinista en CI. Clasificado explicitamente como `Manual-Only` en el `01-VALIDATION.md` de la fase.

---

## Gaps Summary

No hay gaps bloqueantes de codigo. Los 5 success criteria de la fase tienen implementacion completa y testeada con mocks/fixtures. El unico pendiente es el checkpoint de infraestructura externa (Cloudflare R2 + stack Supabase en modo serve/deployed) que fue documentado como verificacion humana desde el plan 01 y es el Task 3 del Plan 03 (`checkpoint:human-verify, gate=blocking-human`).

El `--no-check` en los tests Deno es una limitacion de interop CJS de `robots-parser@3`, no un fallo de implementacion. El runtime es correcto (3/3 tests deno pasan).

**Senal de cierre:** El operador debe escribir "approved" en el Task 3 del Plan 03 si el objeto R2 inmutable, el `source_snapshot` con provenance, el ack de la cola y 0 errores 403/429 se confirman; o describir el fallo observado.

---

_Verified: 2026-06-17_
_Verifier: Claude (gsd-verifier)_
