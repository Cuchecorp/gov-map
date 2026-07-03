---
phase: 51
slug: leg2-legibilidad-profunda
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-02
---

# Phase 51 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^3.2.6 (RTL + jsdom para vistas puras; source-scan estructural) |
| **Config file** | `app/vitest.config.ts` (glob `.test.{ts,tsx}` bajo lib/components/app) |
| **Quick run command** | `pnpm --dir app test -- --run <archivo>` |
| **Full suite command** | `pnpm --dir app test -- --run` + `pnpm --dir app exec tsc -b` |
| **Estimated runtime** | ~60-90 s suite completa |

---

## Sampling Rate

- **After every task commit:** Run quick command sobre los tests del componente tocado
- **After every plan wave:** Run full suite + tsc -b
- **Before `/gsd:verify-work`:** Full suite green + lockdown-guard 7/7 + negative-match banned-vocab
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

> Filled by planner per task. Baseline: suite app/ 406 verde pre-fase.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | — | SC1..SC9 | — | anti-insinuación intacta; RPC deny-by-default intacto | unit/source-scan | `pnpm --dir app test -- --run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Existing infrastructure covers all phase requirements (vitest + RTL + source-scan ya instalados; fixtures existentes por componente).
- [ ] pgTAP nuevo para la migración de rebeldías (`supabase/tests/`) — se corre por psql local/operador, FUERA del glob vitest (convención del proyecto).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Apply remoto de la migración rebeldías + pgTAP contra PROD | SC5 | psql --db-url = checkpoint operador (convención LOCKED) | operador: `psql "$SUPABASE_DB_URL" -f supabase/migrations/00XX_*.sql` + pgTAP; luego verificación en ficha |
| Deploy Cloudflare (build Docker Linux + wrangler) | SC1-SC8 visibles en vivo | deploy = checkpoint operador | `docker-cf-build.sh` → `wrangler deploy` |
