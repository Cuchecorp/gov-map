---
phase: 1
slug: framework-de-conectores-almacenamiento-orquestaci-n
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-17
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (Node/TS, `/packages/*` y `/app`); `deno test` para Edge Functions |
| **Config file** | none — Wave 0 installs (`vitest.config.ts`, `deno.json`) |
| **Quick run command** | `pnpm -w test --run` |
| **Full suite command** | `pnpm -w test --run && supabase db lint` |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm -w test --run`
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | FND-01 | — | rate-limiter respeta ≥2s/origen; respeta robots.txt | unit | `pnpm -w test --run rate-limit` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | FND-02 | — | crudo content-addressed sha256; PUT idempotente; Postgres solo ref | unit | `pnpm -w test --run r2-store` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | FND-03 | — | misma llave (fuente,endpoint,params,día) → cache hit, no re-fetch | unit | `pnpm -w test --run cache` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | FND-04 | — | cambio de forma → fila drift_alert | unit | `pnpm -w test --run drift` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | FND-05 | — | backoff exponencial ante 429; chunking; DLQ vía pgmq.archive | unit/integration | `pnpm -w test --run queue` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | FND-08 | — | provenance (origen, fecha, enlace) presente en cada registro normalizado | unit | `pnpm -w test --run provenance` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Task IDs los fija el planner.*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` + `package.json` test scripts — framework install
- [ ] `supabase/functions/deno.json` — Deno test config para Edge Functions
- [ ] Fixtures: muestras JSON/XML/HTML para tests de fingerprint/drift y parsing
- [ ] Mock de R2 (S3-compatible) para tests de almacenamiento sin red

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Backfill real sin 403/429 por ráfaga contra una fuente gubernamental | FND-01 | Requiere red + WAF real; no determinista en CI | Correr un backfill acotado contra un endpoint público (p.ej. doGet.asmx) y verificar 0 respuestas 403/429 |
| Creación del bucket R2 + credenciales válidas | FND-02 | aws4fetch escribe objetos, no crea buckets; requiere consola Cloudflare | Crear bucket, poblar `.env`, verificar PUT/GET de un objeto de prueba |
| Soporte de PUT condicional (`If-None-Match: *`) en R2 | FND-02 | Depende del comportamiento del servicio | Probar PUT condicional; fallback = content-addressing (siempre seguro) |
