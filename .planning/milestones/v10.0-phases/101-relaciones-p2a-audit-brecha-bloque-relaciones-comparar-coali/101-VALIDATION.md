---
phase: 101
slug: relaciones-p2a-audit-brecha-bloque-relaciones-comparar-coali
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-24
---

# Phase 101 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 101-RESEARCH.md § Validation Architecture (Nyquist).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (app workspace) + pgTAP (supabase/tests) |
| **Config file** | app/vitest.config.ts |
| **Quick run command** | `pnpm --filter app test -- --run <changed spec>` |
| **Full suite command** | `pnpm --filter app test -- --run` + `tsc -b` |
| **Estimated runtime** | ~90 seconds (app suite ~1263 tests) |

---

## Sampling Rate

- **After every task commit:** Run the touched spec(s) with vitest `--run`
- **After every plan wave:** Run full app suite + `tsc -b`
- **Before `/gsd:verify-work`:** Full suite green + guards (anti-insinuación, lockdown, bento) green
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 1 | REL-01 | anti-ranking T-52-13 | Audit N/M con queries psql verbatim reproducibles | doc + SQL evidence | queries verbatim en 101-AUDIT-RELACIONES.md contra PROD | pending | pending |
| TBD | 02 | 1 | REL-02 | anti-insinuación | Linter SUPERFICIES nuevas ANTES del copy + mutation self-check | vitest | `pnpm --filter app test -- --run anti-insinuacion-guard` | pending | pending |
| TBD | 02 | 2 | REL-02 | anti-ranking | Bloque relaciones above-the-fold, orden RPC preservado, total_n honesto | vitest (estructura) | spec del page + componentes | pending | pending |
| TBD | 03 | 2 | REL-03 | PII-safe RPC | /comparar force-dynamic, searchParams antes de notFound, ejes con fuente+fecha | vitest + tsc | spec de /comparar | pending | pending |
| TBD | 03 | 1-2 | REL-04 | doble-revoke CERO grant | RPC 0067 militancia histórica por partido_alias, pgTAP contra schema aplicado | pgTAP | `psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0067_*.test.sql` | pending | pending |
| TBD | 01/03 | 1 | REL-04 (lobby) | provenance | DIFERIDA documentada (contraparte_id 100% NULL) o decisión operador | doc | audit §lobby | pending | pending |
| TBD | 01 | 1 | REL-05 | dos-etapas LOCKED | Probe empírico Servel/comités con evidencia; viable→R2 primero, no→DIFERIDA | doc + curl evidence | audit §coalición | pending | pending |

*(Task IDs se llenan cuando el planner emita los PLAN.md.)*

---

## Wave 0 Gates

- Linter anti-insinuación extendido (SUPERFICIES para /comparar + sección relaciones) ANTES de cualquier copy nuevo — mutation self-check debe morder.
- `PUBLIC_RPC_ALLOWLIST` actualizado ANTES de montar RPC nueva (guard Direction-B).

## Verification Basis

- `VERIFICATION.md` goal-backward: cada REL-0x contra evidencia (SQL counts, DOM del deploy, pgTAP output, suite verde).
