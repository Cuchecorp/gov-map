---
phase: 52
slug: cruce2-cruces-nuevos
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-03
---

# Phase 52 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^3.2.6 (RTL + jsdom; source-scan estructural); vitest de @obs/cruces para el pipeline; pgTAP para 0048 |
| **Config file** | `app/vitest.config.ts`; `packages/cruces` suite propia |
| **Quick run command** | `pnpm --dir app test -- --run <archivo>` / `pnpm --filter @obs/cruces test -- --run` |
| **Full suite command** | `pnpm --dir app test -- --run` + `pnpm --dir app exec tsc -b` + suite cruces |
| **Estimated runtime** | ~60-90 s app + ~30 s cruces |

---

## Sampling Rate

- **After every task commit:** quick command sobre los tests del área tocada
- **After every plan wave:** full suite + tsc -b + lockdown-guard
- **Before verify-work:** todo verde + negative-match banned-vocab
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

> Baseline: suite app/ 497 verde post-F51. El planner detalla task IDs; contrato por SC:

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| CLI filtro confirmadas | TBD | 1 | SC1 | RUT-gate intacto | selección `estado_vinculo='confirmado'` + `sector_id is null` + lote avanza | unit (cruces) | `pnpm --filter @obs/cruces test -- --run` | ✅ | ⬜ |
| Corrida LIVE clasificador | TBD | 2 | SC1 | data-routing (RUT nunca al LLM) | golden LIVE gate ≥0.7/0 errores antes; conteos psql before/after | manual+psql | psql read-only | — | ⬜ |
| 0048 lobby_en_tramitacion | TBD | 1 | SC2 | PII (LEGAL-03), anon deny | pgTAP: security definer, search_path='', anon NO execute, returns sin partido/rut | pgTAP | operador apply | ❌ W0 | ⬜ |
| Carril lobby×tramitación UI | TBD | 1 | SC2 | causal language | RTL: caveat 1×, fuente por fila, degrade PGRST202→null, banned-vocab | tdd (RTL) | `pnpm --dir app test -- --run lobby-en-tramitacion` | ❌ W0 | ⬜ |
| Línea citación estado-actual | TBD | 1 | SC3 | fabricación | omit-when-not-derivable; fecha+comisión literales | unit (RTL) | `pnpm --dir app test -- --run estado-actual-block` | ✅ | ⬜ |
| Home actualidad | TBD | 1 | SC4 | PII fecha_captura | solo tablas no-PII; force-dynamic; 3 empty-states distintos | tdd (RTL) | `pnpm --dir app test -- --run app/page` o componente | ❌ W0 | ⬜ |
| Allowlist + guard | TBD | 1 | SC5 | superficie pública | `lobby_en_tramitacion` en PUBLIC_RPC_ALLOWLIST; migración sin grant | source-scan | `pnpm --dir app test -- --run lib/lockdown-guard` | ✅ | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] pgTAP `supabase/tests/0048_*.test.sql` (se corre por operador al apply, fuera del glob vitest).
- [ ] Tests RTL nuevos para carril lobby×tramitación y módulo home (se crean dentro de sus planes, tdd).
- [ ] Infra existente cubre el resto (vitest app + cruces ya instalados).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Corrida LIVE del clasificador + materializar_cruces | SC1 | escribe DATOS en PROD; golden gate LIVE + psql | dry-run → golden LIVE → lotes → `select cruces.materializar_cruces();` → conteos |
| Apply 0047+0048 + pgTAPs | SC2/SC5 | DDL = operador (psql --db-url, LOCKED) | checkpoint acumulado |
| Deploy Cloudflare | SC2-SC4 visibles | checkpoint operador | docker-cf-build + wrangler |
