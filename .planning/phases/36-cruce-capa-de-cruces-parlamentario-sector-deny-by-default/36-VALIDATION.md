---
phase: 36
slug: cruce-capa-de-cruces-parlamentario-sector-deny-by-default
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-24
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pgTAP (DB contracts — única prueba válida del proyecto) + vitest (CLI `@obs/cruces` golden/eval) |
| **Config file** | `supabase/tests/` (pgTAP) ; `packages/cruces/vitest.config.ts` (Wave 0 installs) |
| **Quick run command** | `psql "$DB_URL" -f supabase/tests/00XX_cruce_senal.sql` (single suite) |
| **Full suite command** | pgTAP: `psql "$DB_URL" -f supabase/tests/<all 003X>.sql` + `pnpm --filter @obs/cruces test` |
| **Estimated runtime** | ~30–60 seconds |

> Migraciones se aplican SOLO por `psql --db-url` (NUNCA `supabase db push` — schema_migrations drift). pgTAP corre contra PROD/branch real, no contra mock (los bugs PROD-vs-mock ya mordieron en Phase 35).

---

## Sampling Rate

- **After every task commit:** Run the relevant pgTAP suite for the migration just applied
- **After every plan wave:** Run full pgTAP set (0038+ suites) + `@obs/cruces` golden eval
- **Before `/gsd:verify-work`:** Full pgTAP green + classifier `--dry-run` gate ≥7/10 vs golden
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 36-01-02 | 01 | 1 | CRUCE-01 | T-36-01..05 | sector public-read; cruce_senal deny-by-default; RPC sin grant anon; body sin partido/rut | pgTAP | psql "" -f supabase/tests/0038_sector.test.sql 0039 0040 | ❌ W0 | ⬜ pending |
| 36-02-02 | 02 | 1 | CRUCE-02 | T-36-06..08 | assertNoRutInLlmInput first; sensitivity personal contraparte; zod enum cerrado | vitest | pnpm --filter @obs/cruces test clasificar | ❌ W0 | ⬜ pending |
| 36-03-02 | 03 | 2 | CRUCE-02 | T-36-09..11 | golden top-1/abstención gate ≥7/10; writer sin LLM; degrade-to-dry-run | vitest | pnpm --filter @obs/cruces test golden | ❌ W0 | ⬜ pending |
| 36-04-01 | 04 | 3 | CRUCE-01/02/03 | T-36-12..14 | apply psql --db-url; pgTAP verde PROD; probe anon 42501; ≥5 parlamentarios | pgTAP+LIVE | psql "" -f supabase/tests/0039_cruce_senal.test.sql ; select count(distinct parlamentario_id) from cruce_senal >= 5 | ❌ W0 | ⬜ pending |

*Populated by the planner per task. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/tests/` pgTAP harness reachable via `psql --db-url` (confirm 0037 suite still green as baseline)
- [ ] `packages/cruces/` scaffolding + `vitest` for the classifier golden/eval (new package)
- [ ] `packages/cruces/golden/` JSON golden seed (~40 cases) wired into the `--dry-run` gate

*If existing infra covers a requirement, the planner marks it so.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Confirmación de los ~13 sectores del catálogo (D-03) | CRUCE-02 | Operator sign-off requerido antes de fijar CHECK/seed | Operador revisa la lista propuesta en RESEARCH/seed; aprueba o ajusta antes de aplicar la migración del catálogo |
| Naming de la señal MVP (`lobby_sector` vs `lobby_sector_aporte`) | CRUCE-03 | Decisión de operador (Open Question 1 del research) | Operador confirma el token antes de lockear el CHECK de `tipo_senal` |
| Grant del RPC a anon / encender `crucesPublicEnabled()` | CRUCE-01/03 | needs-legal-signoff (Phase 39) — deny-by-default en Phase 36 | NO se ejecuta en Phase 36; verificado por ausencia de grant (pgTAP) |

---

## Validation Sign-Off

- [ ] All tasks have automated pgTAP/vitest verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
