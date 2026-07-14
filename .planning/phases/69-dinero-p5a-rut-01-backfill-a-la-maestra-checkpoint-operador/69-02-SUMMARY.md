---
phase: 69-dinero-p5a-rut-01-backfill-a-la-maestra-checkpoint-operador
plan: 02
subsystem: freshness / cobertura
tags: [RUT-01, cobertura, pnpm-freshness, techo-honesto, minimizacion]
requires:
  - "@obs/freshness evaluateCobertura (Phase 68 VOTO-05, reusado tal cual)"
  - "psql read-only de query-runner (nunca imprime dbUrl/password)"
provides:
  - "COBERTURA_RUT_PARLAMENTARIO_SENALES + COBERTURA_RUT_ENTIDAD_SENALES (arrays SEPARADOS, denominador propio por maestra)"
  - "queryCoberturaRut(dbUrl) → { parlamentario, entidad } (counts read-only, nunca rut)"
  - "renderCoberturaRut + append a pnpm freshness (stdout/stderr + JSON coberturaRut)"
affects:
  - "salida de pnpm freshness (append; corpus y voto intactos)"
tech-stack:
  added: []
  patterns:
    - "señal de cobertura SEPARADA por denominador (dos arrays evaluados por separado)"
    - "techo honesto por causa: no-data→n/d, cero real→0%, sin universo (M=0)→n/d"
    - "minimización: counts agregados, jamás SELECT rut"
key-files:
  created: []
  modified:
    - packages/freshness/src/catalog.ts
    - packages/freshness/src/query-runner.ts
    - packages/freshness/src/cli.ts
    - packages/freshness/src/evaluate.test.ts
decisions:
  - "Dos maestras con denominadores distintos → DOS arrays SEPARADOS (no un array evaluado dos veces): respeta el contrato de evaluateCobertura (un esDenominador por evaluación) sin tocar evaluate.ts."
  - "El numerador cuenta presencia de RUT no vacío (rut IS NOT NULL AND rut <> ''); la DV-validez la resuelve la capa de identidad (isRutValido), NO SQL. El CLI declara ese sub-techo explícitamente."
  - "entidad_tercero mide solo tipo_entidad='juridica' (cruzables por RUT exacto); las naturales de lobby no traen RUT y no son el universo cruzable."
metrics:
  duration: ~14 min
  completed: 2026-07-14
---

# Phase 69 Plan 02: Cobertura de RUT DV-válido en `pnpm freshness` Summary

Señal N/M de cobertura de RUT DV-válido para AMBAS maestras (`parlamentario` cruzable + `entidad_tercero` jurídica) como techo honesto en `pnpm freshness`, espejo exacto del patrón COBERTURA_VOTO de Phase 68, degradando por causa sin fingir 0% ni 100% y sin exponer nunca el RUT crudo.

## What Was Built

- **`COBERTURA_RUT_PARLAMENTARIO_SENALES` + `COBERTURA_RUT_ENTIDAD_SENALES`** (catalog.ts): dos arrays SEPARADOS, cada uno con su propio denominador. Parlamentario: universo = `count(*) WHERE estado='confirmado'`, numerador = mismos + `rut IS NOT NULL AND rut <> ''`. Entidad: universo = `count(*) WHERE tipo_entidad='juridica'`, numerador análogo. SQL 100% estática (T-69-04).
- **`queryCoberturaRut(dbUrl)`** (query-runner.ts): corre ambos bloques vía el mismo `psql` read-only (T-69-05, nunca imprime dbUrl/password); devuelve `{ parlamentario, entidad }` con `count` null (NO 0) cuando psql degrada (T-69-07). Helper `runCoberturaSenales` compartido. Jamás `SELECT rut` (T-69-06).
- **`renderCoberturaRut`** (cli.ts): encabezado RUT-01 con la leyenda del techo honesto ("sin dato de RUT" ≠ "sin vínculos"; RUT interno) + dos sub-tablas de maestra (`n/d` para pct null). Wired en `main()`: `queryCoberturaRut` + `evaluateCobertura` por maestra, append a stdout/stderr y `coberturaRut` al JSON. Corpus (BUSQ-03) y voto (VOTO-05) sin cambios.
- **Test** (evaluate.test.ts): 6 casos RUT — arrays separados con denominador propio, SQL estática + sin `SELECT rut`, feliz por maestra, y techo por causa (no-data null→n/d, seed vacío N=0/M>0→0%, sin universo M=0→n/d).

## Live behavior verified

`pnpm freshness` reporta HOY (seed sin RUT):
- Parlamentarios: universo 186 (confirmados), con RUT **0/186 = 0%** (cero REAL declarado honestamente, no n/d).
- Entidades jurídicas: universo 0 → **n/d** (sin universo, no 0% fingido).

Corpus y voto siguen imprimiéndose arriba intactos. Exit 1 proviene de la staleness pre-existente (no de la cobertura) — comportamiento esperado por el plan.

## Deviations from Plan

None - plan executed exactly as written. (El plan anticipó la disyuntiva "dos arrays vs un array evaluado dos veces" en `<behavior>`; se eligió dos arrays separados, que es la opción que no rompe el contrato de `evaluateCobertura`.)

## Threat Register Compliance

| Threat | Disposition | Applied |
|--------|-------------|---------|
| T-69-04 Tampering (SQL) | mitigate | SQL 100% estática, test asserta ausencia de `${` |
| T-69-05 InfoDisclosure (dbUrl) | mitigate | reusa `psql` existente (solo err.code) |
| T-69-06 InfoDisclosure (RUT crudo) | mitigate | counts agregados; test asserta ausencia de `SELECT rut` |
| T-69-07 Spoofing (falso 100%) | mitigate | degrada por causa: null→n/d, M=0→n/d, N=0→0% |

## Known Stubs

None. La cobertura ≈ 0/M HOY NO es un stub: es el techo verídico del seed vacío, declarado correctamente. El operador puebla el dato en el checkpoint (Plan 03) y esta señal reportará el nuevo techo.

## Commits

- `f154c3b` feat(69-02): COBERTURA_RUT_SENALES + queryCoberturaRut, both maestras
- `75bb9c3` feat(69-02): renderCoberturaRut + wire into pnpm freshness

## Self-Check: PASSED
