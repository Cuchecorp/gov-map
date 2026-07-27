---
phase: 64-voto-p3a-validar-caracterizar-opendata-camara-cl-live-spike
plan: 01
subsystem: tramitacion / parser de votaciones Cámara
tags: [voto, parser, fail-closed, pareo, abstencion, cross-check, offline, spike]
requires:
  - packages/tramitacion/src/parse-camara-votacion.ts (parseCamaraVotoDetalle, opcionDeVoto)
  - packages/tramitacion/test/fixtures/camara-votacion-detalle-real.xml (fixture LIVE-derivado, votación 88813)
provides:
  - "opcionDeVoto: abstención por CÓDIGO (codigo 2), LIVE-confirmado 2026-07-13"
  - "parseCamaraVotoDetalle: pareo derivado del bloque <Pareos> por cruce de DIPID (A1b resuelto)"
  - "cross-check de totales Σ roster == header, con caso negativo que hace THROW ruidoso (SC#3)"
affects:
  - Phases 65-68 (bloque VOTO): consumen esta semántica de mapeo fijada por test
tech-stack:
  added: []
  patterns:
    - "Mapeo de voto code-first / #text-fallback / fail-closed (opción ilegible → null)"
    - "Pareo re-etiquetado SOLO sobre filas ya presentes en el roster (nunca fabrica filas)"
    - "Cross-check por bucket semántico, nunca por string de label del header"
key-files:
  created: []
  modified:
    - packages/tramitacion/src/parse-camara-votacion.ts
    - packages/tramitacion/src/parse-camara-votacion.test.ts
decisions:
  - "codigo 2 → abstención: pasó de sintético (A1) a CONFIRMADO LIVE 2026-07-13 (cross-check de totales, 5 votaciones)"
  - "A1b RESUELTO: el pareo NO es un Opcion Codigo=3 (no observado live) — vive en el bloque hermano <Pareos>; código 3 nunca se promueve a verificado"
  - "TotalDispensados vs 'ausente' queda PENDIENTE de confirmación LIVE en Plan 02 (Open Question 2); no se assert-a ciegamente hoy"
metrics:
  duration: "~10 min"
  completed: "2026-07-14"
  tasks: 3
  files: 2
  tests_after: 145
---

# Phase 64 Plan 01: VOTO P3a — Semántica de voto fijada por test (abstención code-2 + pareo desde `<Pareos>` + cross-check ruidoso) Summary

Fijó por test determinista, 100% offline contra el fixture LIVE-derivado `camara-votacion-detalle-real.xml` (votación 88813, boletín 14309-04), las dos correcciones duras que salen de leer la forma LIVE real del endpoint `getVotacion_Detalle`: (1) abstención por **código 2** (confirmado LIVE 2026-07-13, ya no sintético), y (2) el **pareo derivado del bloque hermano `<Pareos>`** por cruce de DIPID — corrigiendo el bug de atribución que emitía a un diputado pareado como `ausente`. Añadió un cross-check de totales Σ(roster) == `Total*` del header que falla **RUIDOSO** ante cualquier desbalance. Suite `@obs/tramitacion` verde (17 archivos, 145 tests). Ningún paquete instalado, ninguna red tocada.

## What Was Built

### Task 1 — Abstención por código 2 (`f582f9c`)
- `opcionDeVoto`: la rama de abstención pasó de `if (/abstenci/i.test(texto))` a `if (codigo === "2" || /abstenci/i.test(texto))`. El código 2 se mapea a `abstencion` **independientemente del `#text`** (incluso vacío o ilegible); el fallback por texto se conserva por robustez.
- Docstring actualizado: el código 2 dejó de ser sintético (A1) y es CONFIRMADO LIVE (cross-check de totales, 5 votaciones).
- Tests: `<Opcion Codigo="2">` con texto / sin texto / texto raro → `abstencion`; regresión code-1→si, code-0→no, code-4→ausente contra el fixture real; fail-closed (código+texto ilegibles → fila omitida).

### Task 2 — Pareo derivado del bloque `<Pareos>` (`9c45119`)
- `parseCamaraVotoDetalle`: antes del loop de `<Votos>`, recolecta el set de DIPID pareados leyendo `v.Pareos.Pareo` (via `asArray`) y extrayendo `Diputado1.DIPID` / `Diputado2.DIPID` (via `txt`). Al construir cada fila, si el `diputadoId` está en el set, sobrescribe la opción a `"pareo"` (pisando el `ausente` que el código 4 habría dado).
- Solo re-etiqueta filas **ya presentes** en el roster: nunca fabrica una fila (VOTO-04, pareo ≠ ausente). Sin bloque `<Pareos>` (o vacío), nadie se marca pareo espurio.
- Docstrings de `parseCamaraVotoDetalle` y `opcionDeVoto` registran el hallazgo LIVE A1b: el pareo NO es un `Opcion Codigo=3` (no observado live) → **NO se añade rama `codigo === "3"`**.
- Tests: los 10 DIPID de `<Pareos>` (1240/1082/1259/1142/1039/1131/1015/1217/1107/1219) → `pareo`; DIPID 1009 (No Vota, no pareado) → `ausente`; todas las opciones ∈ {si,no,abstencion,pareo,ausente}; sin `<Pareos>` → sin pareo espurio.

### Task 3 — Cross-check ruidoso de totales, SC#3 (`45396a1`)
- Test-only. `describe "cross-check de totales (SC#3)"` con un helper local puro `crossCheck(xml)` que suma el roster por opción y assert-a por **bucket semántico** (si↔TotalAfirmativos, no↔TotalNegativos, abstencion↔TotalAbstenciones), nunca por string de label; lanza `Error` ruidoso ante mismatch.
- Positivo: Σ(si)=58, Σ(no)=81, Σ(abstencion)=0 cuadran exactos con el header del fixture LIVE; pareo se cuenta aparte (=10).
- Negativo: mutar en memoria un `<Opcion Codigo="0">En Contra</Opcion>` a `Codigo="1">Afirmativo` desbalancea la suma → `expect(() => crossCheck(...)).toThrow(/cross-check FALLÓ/)` y `Σ(si) !== 58`.
- Documentado en el test que `TotalDispensados` vs `ausente` queda pendiente de confirmación LIVE en Plan 02 (Open Question 2).

## Verification

- `pnpm --filter @obs/tramitacion test`: 17 archivos, **145 tests** verdes (era 136 baseline → +9 nuevos tests).
- `git grep 'codigo === "2"' parse-camara-votacion.ts` → 1 match (abstención por código).
- `git grep -c Pareos parse-camara-votacion.ts` → 8 matches (bloque leído + docstrings).
- `git grep -E 'codigo\s*===\s*"3"' parse-camara-votacion.ts` → solo 1 match, en un **comentario** que prohíbe la rama; ningún branch ejecutable `codigo === "3"` (A1b no promovido a verificado).

## Success Criteria

- **SC#2 (parcial, offline):** el mapeo `Opcion Codigo → Selección` está fijado por test contra el fixture LIVE-derivado — abstención (code 2, confirmado) y pareo (derivado de `<Pareos>`, no de un código 3 sintético). Dispensado diferido a Plan 02. ✓
- **SC#3:** la suma voto-a-voto cuadra contra los totales del header y un mismatch falla RUIDOSO por test determinista. ✓
- **Ninguna semántica fabricada:** código 3 nunca promovido a verificado; opción ilegible → null (fail-closed). ✓

## Deviations from Plan

None — plan ejecutado exactamente como fue escrito. El fixture `camara-votacion-detalle-real.xml` ya contenía el bloque `<Pareos>` requerido (5 `<Pareo>`, 10 DIPID), por lo que Task 2 no necesitó modificar el fixture (contemplado en el plan: "Verifica que ... ya contiene el bloque `<Pareos>`").

## Threat Surface

Sin superficie nueva. Este plan es 100% offline (no abre red, no toca DB, no instala paquetes). Las mitigaciones del threat register (T-64-01/02/03) quedan reforzadas por test: mapeo fail-closed, cross-check ruidoso, pareo re-etiquetado solo sobre filas presentes. No se detectaron flags de amenaza fuera del `<threat_model>` del plan.

## Known Stubs

Ninguno. No hay valores hardcodeados a UI ni placeholders. La única semántica declarada explícitamente como pendiente (`TotalDispensados` vs `ausente`) está documentada en el test y en el docstring como Open Question 2 a resolver en Plan 02 (corrida LIVE) — no es un stub que impida el objetivo de este plan (fijar el mapeo offline).

## Notes for Next Plan (64-02, corrida LIVE)

- Confirmar LIVE que `No Vota` (código 4) mapea a `TotalDispensados` o si `Dispensado` es una opción distinta (Open Question 2) — el fixture 88813 tiene `TotalDispensados=0`, no permite discriminar.
- Persistir la respuesta LIVE cruda a R2 (STAGE 1, `R2Store.putImmutable`) y extender `run-camara-votos.live.test.ts` (gate `VOTOS_LIVE=1`, delay 2-3s LOCKED).
- Buscar una votación con `TotalDispensados>0` y (idealmente) un pareo observable en el roster para robustecer el fixture.

## Self-Check: PASSED

Archivos verificados (existen): `64-01-SUMMARY.md`, `parse-camara-votacion.ts`, `parse-camara-votacion.test.ts`.
Commits verificados (en git log): `f582f9c` (Task 1), `9c45119` (Task 2), `45396a1` (Task 3).
