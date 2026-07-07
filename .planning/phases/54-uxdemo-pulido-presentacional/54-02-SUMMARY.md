---
phase: 54
plan: 02
subsystem: frontend-microcopy
tags: [ux, microcopy, anti-causal, ficha-parlamentario]
requires: [54-01]
provides:
  - "Cruces intro con frase anti-causal integrada"
  - "Patrimonio intro con frase de múltiples versiones"
  - "Nota de método de rebeldías reubicada bajo el h3 (render único)"
affects:
  - app/components/cruces-de-parlamentario.tsx
  - app/components/patrimonio-de-parlamentario.tsx
  - app/components/votos-por-parlamentario.tsx
tech-stack:
  added: []
  patterns:
    - "integrate-or-omit: nunca duplicar un caveat anti-causal existente"
    - "microcopy 1 línea factual apendida al <p> intro (mismo párrafo)"
key-files:
  created: []
  modified:
    - app/components/cruces-de-parlamentario.tsx
    - app/components/patrimonio-de-parlamentario.tsx
    - app/components/votos-por-parlamentario.tsx
decisions:
  - "Nota de rebeldías colocada como primer elemento del fragmento no-vacío (bajo h3, antes del conteo) para mantener rama vacía sin línea y render único"
metrics:
  duration: ~10min
  completed: 2026-07-07
---

# Phase 54 Plan 02: Microcopy "cómo leer esto" (Contract 3) Summary

Contract 3 del UI-SPEC ejecutado: 1 frase anti-causal integrada en Cruces, 1 frase factual agregada en Patrimonio, y la nota de método de rebeldías reubicada de debajo de la lista a directamente bajo su h3 (string byte-identical, render único). /red se dejó intacto (OMIT — ya tiene su línea anti-causal).

## What Was Built

### Task 1 — Cruces + Patrimonio (commit 5a8d4fa)
- **Cruces** (`cruces-de-parlamentario.tsx`): apendida al MISMO `<p>` intro existente (tras "…apunta al registro original.") la frase exacta `Un cruce solo agrupa reuniones registradas por sector; no afirma intención ni causa.` El wrap `formatNombre` de 54-01 y el empty-state quedaron byte-identical.
- **Patrimonio** (`patrimonio-de-parlamentario.tsx`): apendida al primer párrafo intro (tras "…con su fecha de presentación.") la frase exacta `Un mismo parlamentario puede registrar varias versiones; cada una es una presentación distinta ante la fuente.` La línea CC BY y el caveat de montos del chart quedaron intactos.
- Tests: 62 verdes (13 cruces + 49 patrimonio).

### Task 2 — Reubicar nota de rebeldías (commit b98ad2e)
- **Rebeldías** (`votos-por-parlamentario.tsx`): la nota de método `Se compara el voto del parlamentario con la opción mayoritaria de su bancada en esa misma votación.` se MOVIÓ de debajo de la lista (`</ul>`) a ser el primer elemento del fragmento no-vacío — directamente bajo el `h3`, antes del conteo. String byte-identical, `mt-2` preservado. La rama vacía quedó intacta (sin línea). Verificado: aparece exactamente 1 vez en el archivo (grep -c = 1) → nunca render doble.
- Tests: 49 verdes (los `getByText` RTL siguen pasando).

## Verification
- `npx vitest run` de los 3 componentes: **111 tests verdes** (13+49 Task 1, 49 Task 2).
- `npx tsc --noEmit`: exit 0 (sin regresión de tipos).
- `/red` (`app/app/red/page.tsx`): sin diff (OMIT confirmado, git status limpio).
- Nota de rebeldías: `grep -c` = 1 (render único, no ×2).
- Banned-vocab: las 2 frases nuevas evitan `correlaci|af[ií]n|influy|cercano|rebeld|score|porque` — tono factual anti-causal.

## Deviations from Plan
None - plan executed exactly as written.

## Threat Model Compliance
- **T-54-05 (insinuación causal):** mitigado — strings prescritos verbatim, pasan banned-vocab negative-match, regla integrate-or-omit respetada (ningún caveat duplicado).
- **T-54-SC (installs):** CERO paquetes nuevos.

## Self-Check: PASSED
- app/components/cruces-de-parlamentario.tsx — FOUND (contiene "no afirma intención ni causa")
- app/components/patrimonio-de-parlamentario.tsx — FOUND (contiene "presentación distinta")
- app/components/votos-por-parlamentario.tsx — FOUND (nota reubicada, 1×)
- commit 5a8d4fa — FOUND
- commit b98ad2e — FOUND
