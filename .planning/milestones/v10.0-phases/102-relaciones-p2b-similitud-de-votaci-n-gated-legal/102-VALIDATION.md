---
phase: 102
slug: relaciones-p2b-similitud-de-votaci-n-gated-legal
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-24
---

# Phase 102 — Validation Strategy

> Per-phase validation contract. Source: 102-RESEARCH.md § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (app) + pgTAP (supabase/tests) + static scans (guards) |
| **Config file** | app/vitest.config.ts |
| **Quick run command** | `pnpm --filter app test -- --run <changed spec>` |
| **Full suite command** | `pnpm --filter app test -- --run` + `pnpm --filter app exec tsc -b` |
| **Estimated runtime** | ~100 seconds (suite ~1303 tests) |

---

## Sampling Rate

- **After every task commit:** touched specs con `--run`
- **After every plan wave:** full suite + tsc -b
- **Before verify:** suite + guards (anti-insinuación, lockdown, vsim-antiflip, money-antiflip) verdes
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | W0 | 1 | VSIM-03 | anti-insinuación | Idioms vetados + leyenda caveat en NEGACIONES_LOCKED + mutation self-check MUERDE | vitest | `pnpm --filter app test -- --run anti-insinuacion-guard` | pending | pending |
| TBD | W0 | 1 | VSIM-03 | insinuación espacial | co_votacion ∉ /red: test estático + ramas muertas red-graph/arista-hecho resueltas | vitest static | spec estático /red | pending | pending |
| TBD | W0 | 1 | VSIM-02 | anti-flip | vsim-gate chokepoint + vsim-antiflip-guard 3 vectores + .env.example VSIM_PUBLIC_ENABLED=false | vitest | `pnpm --filter app test -- --run vsim` | pending | pending |
| TBD | RPC | 1-2 | VSIM-01 | doble-revoke, bounded | 0068 coincidencia_votos_par agregado-only, statement_timeout 5s, pgTAP vs schema aplicado | pgTAP | `psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0068_*.test.sql` | pending | pending |
| TBD | UI | 2 | VSIM-01/02 | anti-DW-NOMINATE | Eje 5º sibling mt-12, flag OFF → ausente del DOM, caveat VERBATIM adyacente, sin accent en cifra | vitest RTL | spec /comparar | pending | pending |
| TBD | dossier | 2 | VSIM-02 | acto humano | 102-LEGAL-DOSSIER-VSIM con signoff: pending + evidencia preview ON local | doc | grep signoff | pending | pending |

---

## Wave 0 Gates (7 ítems del research)

1. Idioms VSIM en linter + leyenda caveat en NEGACIONES_LOCKED (mutation self-check).
2. Test estático co_votacion ∉ /red (resolver ramas muertas red-graph.tsx:81 / arista-hecho.tsx:32-33 primero).
3. `vsim-gate.ts` + `vsim-antiflip-guard.test.ts` (espejo money).
4. `.env.example` gana `VSIM_PUBLIC_ENABLED=false` (gap real — sin esto el guard V2 falla).
5. Migración 0068 ESCRITA antes del allowlist (Direction-B, lección 101-02).
6. `coincidencia_votos_par` en PUBLIC_RPC_ALLOWLIST.
7. SUPERFICIES del componente nuevo registradas antes del copy.

## Verification Basis

- VERIFICATION.md goal-backward: VSIM-01..03 contra evidencia (pgTAP, DOM-absence con flag OFF, linter verde con idioms, dossier pending, evidencia preview ON local).
