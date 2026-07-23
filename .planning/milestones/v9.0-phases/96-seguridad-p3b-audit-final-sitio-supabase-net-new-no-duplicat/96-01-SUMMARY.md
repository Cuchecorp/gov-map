---
phase: 96-seguridad-p3b-audit-final-sitio-supabase-net-new-no-duplicat
plan: "01"
subsystem: security/repo-public
tags: [security, secrets, gitleaks, vitest-guard, pnpm-audit, SEC-02, SEC-03]
dependency_graph:
  requires: []
  provides:
    - .gitleaks.toml (allowlist 6 FP para scan futuro limpio)
    - app/lib/env-example-guard.test.ts (guard CI placeholder-only .env.example)
    - pnpm-workspace.yaml#overrides (brace-expansion/protobufjs/sharp)
    - 96-AUDIT-REPO.md (reporte redactado gitleaks + audit antes/después)
  affects:
    - CI app suite (nuevo test guard agrega 15 tests = 1243 total)
    - pnpm-lock.yaml (re-lock con Next 16.2.11 y 3 overrides nuevos)
tech_stack:
  added: []
  patterns:
    - gitleaks 8.30.1 full-history --redact + .gitleaks.toml allowlist
    - vitest guard puro exportado + mutation self-check (espejo money-antiflip)
    - pnpm overrides en pnpm-workspace.yaml (precedente 260715-bvd)
key_files:
  created:
    - .gitleaks.toml
    - app/lib/env-example-guard.test.ts
    - .planning/phases/96-seguridad-p3b-audit-final-sitio-supabase-net-new-no-duplicat/96-AUDIT-REPO.md
  modified:
    - pnpm-workspace.yaml (overrides brace-expansion/protobufjs/sharp + remoción allowBuilds espurio)
    - app/package.json (next 16.2.9 -> 16.2.11)
    - pnpm-lock.yaml (re-lock)
decisions:
  - "gitleaks encontró 6 findings (research decía 4): los 2 adicionales son docs de planificación de fase 96 que citan las constantes S3CR3T-TICKET-* como ejemplos; todos igualmente FP. .gitleaks.toml extiende allowlist a 6 paths."
  - "pnpm install post-overrides inyectó allowBuilds: placeholder espurio para protobufjs y sharp (ya en onlyBuiltDependencies); removido antes de commit (gotcha 260715-bvd confirmado)."
metrics:
  duration: "~45 min"
  completed_date: "2026-07-23"
  tasks: 3
  files_created: 3
  files_modified: 3
---

# Phase 96 Plan 01: Audit Repo Público — gitleaks + guard .env.example + pnpm audit fix Summary

Historial git escaneado con gitleaks (6 FP triados, cero secretos reales), guard CI vitest para `.env.example` solo-placeholders creado, y `pnpm audit --prod` cerrado de 14 advisories a 0 mediante bump Next 16.2.11 y overrides transitivos — suite+tsc verdes.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | gitleaks full-history scan + triage + .gitleaks.toml | 951bd14 | `.gitleaks.toml`, `96-AUDIT-REPO.md` |
| 2 | Guard vitest .env.example solo-placeholders (TDD) | a37091b | `app/lib/env-example-guard.test.ts` |
| 3 | pnpm audit fix — bump Next + overrides + re-lock | 1b449bc | `pnpm-workspace.yaml`, `app/package.json`, `pnpm-lock.yaml` |

## Verification Results

| Check | Result |
|-------|--------|
| `gitleaks git --redact --config .gitleaks.toml` | exit 0 / 0 findings |
| `pnpm --filter ./app test env-example-guard` | 15/15 verdes |
| `pnpm audit --prod` | 0 advisories |
| `pnpm test` (app/ completa) | 94 archivos / 1243 tests verdes |
| `npx tsc --noEmit` | 0 errores |

## Gitleaks Triage Summary

**1.709 commits escaneados, 6 findings, TODOS falsos positivos:**

| # | Archivo | Commit | Veredicto |
|---|---------|--------|-----------|
| 1-3 | `packages/dinero/src/*.test.ts` (3 archivos) | 18f1dcae / 16ffe62c / 91de0f47 | FP — constantes de test `S3CR3T-TICKET-*` |
| 4 | `packages/agenda/test/fixtures/camara-citaciones-semana.html` | 9798a057 | FP — fixture HTML WebForms |
| 5-6 | `.planning/phases/96-.../*.md` (PLAN + PATTERNS) | df0b5f34 / 8b58342d | FP — docs de planificación que citan las constantes de test |

Cero secretos reales en el historial. B26 (DB password) sigue siendo el único secreto real ya-expuesto conocido (runbook: `phases/75-*/75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md`).

## pnpm Audit: Antes / Después

| Estado | Advisories |
|--------|-----------|
| Antes (Next 16.2.9) | 14 (8 high + 6 moderate) |
| Después (Next 16.2.11 + overrides) | **0** |

## Deviations from Plan

### Auto-observed Issues

**1. [Deviation - Observation] gitleaks encontró 6 findings, no 4**
- **Found during:** Task 1
- **Issue:** Research documentó 4 FP. Al correr el scan, aparecieron 6: los docs de planificación de la fase 96 (96-01-PLAN.md y 96-PATTERNS.md) citan las constantes de test `S3CR3T-TICKET-*` como ejemplos de código.
- **Fix:** Allowlist en `.gitleaks.toml` ampliada a 6 paths (4 originales + 2 docs). Son igualmente FP.
- **Commit:** 951bd14

**2. [Rule 3 - Blocking] pnpm install inyectó allowBuilds: placeholder espurio (dos veces)**
- **Found during:** Task 3
- **Issue:** pnpm 11 inyecta automáticamente un bloque `allowBuilds:` con `set this to true or false` al detectar un nuevo dep con build-script en `onlyBuiltDependencies`. Ocurrió dos veces: primero para `sharp` al bump Next, luego para `protobufjs` al correr `pnpm install` con los overrides.
- **Fix:** Removido en ambas ocasiones antes del commit. `protobufjs` y `sharp` ya están en `onlyBuiltDependencies`; el placeholder es un artefacto de pnpm 11 que no debe commitearse (gotcha documentado en PATTERNS.md y 260715-bvd).
- **Commit:** 1b449bc

## Known Stubs

Ninguno. Todas las verificaciones corren sobre el repo y la suite viva.

## Threat Flags

Ninguna nueva superficie introducida. Esta fase reduce superficie (cierra 14 CVEs de deps, agrega guard CI, allowlist scan futuro).

## Self-Check: PASSED

- `.gitleaks.toml` existe en repo root: FOUND
- `app/lib/env-example-guard.test.ts` existe: FOUND
- `96-AUDIT-REPO.md` existe: FOUND
- Commits 951bd14, a37091b, 1b449bc: FOUND (git log)
- `pnpm audit --prod`: 0 advisories confirmado
- `pnpm test` app/: 1243 tests verdes confirmado
- `tsc --noEmit`: 0 errores confirmado
