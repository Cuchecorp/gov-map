---
phase: 126
slug: panel-guards-wave-0-de-guards
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-30
---

# Phase 126 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derivada de `126-RESEARCH.md` §Validation Architecture (baseline medido 2026-07-30).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.6 (jsdom, globals) |
| **Config file** | `app/vitest.config.ts` (include `lib/**/*.test.ts` — el archivo nuevo entra sin tocar config) |
| **Quick run command** | `cd app && npx vitest run lib/anti-insinuacion-guard.test.ts lib/create-view-guard.test.ts` |
| **Full suite command** | `pnpm --filter ./app test` |
| **Estimated runtime** | quick ~6 s · full ~58 s (107 archivos / 1.590 tests baseline) |

**Gotcha LOCKED:** `passWithNoTests: true` está en la config ⇒ un glob que no matchea sale 0 SIN correr nada. Todos los comandos de verificación usan nombres explícitos.

---

## Sampling Rate

- **After every task commit:** correr el/los guard(s) tocados POR NOMBRE (`npx vitest run lib/<archivo>.test.ts`, ~5 s)
- **After every plan wave:** `pnpm --filter ./app guards` (script nuevo D-13, 11 archivos por nombre explícito)
- **Before `/gsd:verify-work`:** `pnpm --filter ./app test` completo VERDE con ≥1.590 tests reportados (no menos que el baseline — un conteo menor = archivos que dejaron de correr)
- **Max feedback latency:** 60 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (por asignar) | — | — | PANEL-08 c1 | — | SUPERFICIES_PANEL extendida + carril verde | unit | `npx vitest run lib/anti-insinuacion-guard.test.ts` | ✅ archivo existe | ⬜ pending |
| (por asignar) | — | — | PANEL-08 c1 | — | mutación señal/exprés/los más produce FAIL | unit | ídem (describe (2)) | ✅ describe existe | ⬜ pending |
| (por asignar) | — | — | PANEL-08 c1 | — | anti-drift `panel-*.tsx` ⊆ SUPERFICIES_PANEL (excluye `*.test.tsx`) | unit | ídem | ❌ assert nuevo | ⬜ pending |
| (por asignar) | — | — | PANEL-08 c2 | — | NEGACIONES_LOCKED + IDIOMS_APROBADOS + self-check no-hueco | unit | ídem | ❌ nuevo | ⬜ pending |
| (por asignar) | — | — | DEBT-02 c3 | V4 access-control | detector views: fixture SIN security_invoker FALLA / CON pasa + escaneo real 77 migraciones | unit | `npx vitest run lib/create-view-guard.test.ts` | ❌ archivo nuevo | ⬜ pending |
| (por asignar) | — | — | criterio 4 | — | suite completa + guards por nombre explícito | suite | `pnpm --filter ./app test` && `pnpm --filter ./app guards` | ✅ baseline verde | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Ninguno de infraestructura: framework, config e include-globs ya cubren el archivo nuevo. Los "gaps" son exactamente los entregables de la fase (los guards SON el Wave-0 del milestone).

## Security Domain (ASVS aplicable)

- **V4 Access Control — SÍ:** B-03 es un control preventivo: una view en `public` sin `security_invoker` corre con privilegios del OWNER (bypass de RLS del caller). El guard estático es la mitigación. Las demás categorías no aplican (la fase no toca auth/sesión/cripto; los guards leen el repo, no input de usuario).
