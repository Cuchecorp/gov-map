---
phase: 3
slug: tabla-maestra-parlamentario-identidad-determinista
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-18
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (Node/TS) con fetch inyectable + fixtures XML reales capturados (Senado/Cámara); `deno test` / pgTAP para migración |
| **Config file** | reusa workspace; nuevo paquete o módulo de identidad (p.ej. `@obs/identity` o `packages/ingest/src/seed`) |
| **Quick run command** | `pnpm --filter @obs/identity test --run` |
| **Full suite command** | `pnpm -w test --run && supabase test db` |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** quick run
- **After every plan wave:** full suite
- **Before verify:** full suite green + live seed dry-run produced expected counts (≈155 diputados + senadores vigentes)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure/Correct Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|-------------------------|-----------|-------------------|--------|
| TBD | TBD | 1 | ID-01 | migración crea `parlamentario`+`alias` con RLS deny-by-default + provenance | pgTAP | `supabase test db` | ⬜ |
| TBD | TBD | 1 | ID-01/02 | `normalizarNombre`: NFD strip, ñ→n, "Apellido P., Nombre" ↔ catálogo convergen | unit | `pnpm --filter @obs/identity test --run normaliz` | ⬜ |
| TBD | TBD | 1 | ID-02 | `matchDeterminista` fail-closed: RUT→confirmado; nombre único en (cámara,periodo)→confirmado; homónimo→no_confirmado | unit | `pnpm --filter @obs/identity test --run match` | ⬜ |
| TBD | TBD | 2 | ID-01 | seeder parsea fixtures reales (Senado XML, Cámara XML) → upsert idempotente con estado+provenance | unit | `pnpm --filter @obs/identity test --run seed` | ⬜ |
| TBD | TBD | 2 | ID-09 | export de la maestra a JSON versionado (git) determinista/estable; R2 gated | unit | `pnpm --filter @obs/identity test --run backup` | ⬜ |

*Task IDs los fija el planner.*

---

## Wave 0 Requirements

- [ ] Fixtures: capturar muestra real de `senadores_vigentes.php` (XML) y de `retornarDiputadosPeriodoActual` (XML) como archivos de test
- [ ] Helpers de parsing (fast-xml-parser) + mock fetch
- [ ] Casos golden de normalización (homónimos, ñ, nombres compuestos, formato votación)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Corrida LIVE del seeder contra Cámara+Senado (counts reales) | ID-01 | Requiere red a sitios gov (rate-limited) | Correr el seeder live una vez; confirmar ≈155 diputados + senadores vigentes cargados con provenance, 0 errores 403/429 |
| Revisión humana del lote sembrado (promoción a `confirmado`) | ID-01 | Decisión humana sobre el catastro | Operador revisa el snapshot JSON / conteos y acepta el lote |
| Push de migración + datos al Supabase remoto y respaldo a R2 | ID-01/09 | Falta credencial válida (DB password/PAT; cred R2 S3) | Cuando haya credencial: `supabase db push` + correr backup a R2 |
