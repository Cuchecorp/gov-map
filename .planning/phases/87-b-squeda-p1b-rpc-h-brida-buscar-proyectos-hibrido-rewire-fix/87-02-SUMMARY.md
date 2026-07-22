---
phase: 87-b-squeda-p1b-rpc-h-brida-buscar-proyectos-hibrido-rewire-fix
plan: "02"
subsystem: busqueda
tags: [retrieval, hybrid-rpc, flag, boletin-detector, allowlist, tdd]
dependency_graph:
  requires: [87-01]
  provides: [busqueda-hibrida-gate, boletin-detector, buscar-rewire, allowlist-entry]
  affects: [app/lib/buscar.ts, app/lib/lockdown-guard.test.ts]
tech_stack:
  added: []
  patterns: [fail-closed-flag, detectarBoletin-pure-fn, rpc-rewire-by-flag, PUBLIC_RPC_ALLOWLIST]
key_files:
  created:
    - app/lib/busqueda-hibrida-gate.ts
    - app/lib/busqueda-hibrida-gate.test.ts
    - app/lib/boletin-detector.ts
    - app/lib/boletin-detector.test.ts
  modified:
    - app/lib/buscar.ts
    - app/lib/buscar.test.ts
    - app/lib/lockdown-guard.test.ts
decisions:
  - "BOLETIN_RE conservado exportado (consumidores: /buscar, /proyecto/[boletin], agenda-buscar — #36)"
  - "detectarBoletin reemplaza el guard BOLETIN_RE en buscarProyectos (cubre formato punteado)"
  - "Flag default OFF — no flipear hasta gate de dominancia (Plan 87-03)"
metrics:
  duration: "~20 min"
  completed: "2026-07-22"
  tasks: 2
  files: 7
---

# Phase 87 Plan 02: Rewire buscar.ts → RPC híbrida + detector boletín punteado

Flag fail-closed `BUSQUEDA_HIBRIDA_ENABLED` + `detectarBoletin` (3 formatos incl. punteado) + rewire `buscar.ts` → `buscar_proyectos_hibrido` cuando el flag está ON + entrada en `PUBLIC_RPC_ALLOWLIST`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Flag busqueda-hibrida-gate + boletin-detector | 26e42f1 | busqueda-hibrida-gate.ts, busqueda-hibrida-gate.test.ts, boletin-detector.ts, boletin-detector.test.ts |
| 2 | Rewire buscar.ts + allowlist entry | 05a8df5 | buscar.ts, buscar.test.ts, lockdown-guard.test.ts |

## What Was Built

**`busqueda-hibrida-gate.ts`** — Flag server-only fail-closed (espejo de cruces-gate.ts). Solo el literal `"true"` enciende la RPC híbrida; `undefined`, `"false"`, `"1"`, `"TRUE"` → false. `import "server-only"` + var sin prefijo `NEXT_PUBLIC_` (T-87-05).

**`boletin-detector.ts`** — `detectarBoletin` puro portado de `packages/fichas/src/spike/boletin.ts`. Maneja 3 formatos: `14309-04`, `14309`, `14.309-04` (punteado — Pitfall 5, RETR-01). Distingue decimal (`3.14` → null) y texto libre → null.

**`buscar.ts` recableado** — Dos cambios:
1. Redirect extendido: `detectarBoletin(q)` reemplaza `BOLETIN_RE.test(q)` como guard de atajo (cubre formato punteado antes de embeber). `BOLETIN_RE` se conserva exportado para los demás consumidores (#36).
2. Rama híbrida: tras embed, si `busquedaHibridaEnabled()` → `sb.rpc("buscar_proyectos_hibrido", {q, query_embedding, match_count})`. Camino `match_proyectos` (OFF + similares/excludeBoletin) intacto.

**`lockdown-guard.test.ts`** — `"buscar_proyectos_hibrido"` agregado al `PUBLIC_RPC_ALLOWLIST` en orden alfabético (entre `buscar_citaciones` y `comparar_declaraciones`). Guard CI de lockdown pasa.

## Verification

- Suite `app/`: 1009 tests verdes (82 test files)
- `tsc --noEmit`: limpio
- lockdown-guard: guard A (grant-a-anon) + guard B (allowlist) pasan

## Deviations from Plan

None — plan ejecutado exactamente como escrito.

## Known Stubs

Ninguno. El default OFF es intencional (flag `BUSQUEDA_HIBRIDA_ENABLED !== "true"`); se flipea en Plan 87-03 tras el gate de dominancia.

## Threat Flags

Ninguno. Las mitigaciones T-87-05..T-87-08 están implementadas:
- T-87-05: `import "server-only"` + var sin `NEXT_PUBLIC_` ✓
- T-87-06: `.rpc()` parametriza `q` y `query_embedding`; cap MAX_QUERY_CHARS conservado ✓
- T-87-07: `buscar_proyectos_hibrido` en `PUBLIC_RPC_ALLOWLIST`; guard CI pasa ✓
- T-87-08: boletín/punteado redirige ANTES de embeber ✓

## Self-Check: PASSED

- app/lib/busqueda-hibrida-gate.ts: FOUND
- app/lib/boletin-detector.ts: FOUND
- app/lib/buscar.ts: FOUND (modificado)
- app/lib/lockdown-guard.test.ts: FOUND (modificado)
- Commit 26e42f1: FOUND
- Commit 05a8df5: FOUND
