---
phase: 65-voto-p3b-golden-set-dipid-maestra-gate-fail-closed-pre-backf
plan: 01
subsystem: votos
tags: [voto, golden-set, identidad, fail-closed, gate, ci, dipid]
requires:
  - "@obs/tramitacion: reconciliarVotosCamara, cargarMaestra, findWorkspaceRoot, aplanarVoto, VotoParaEscribir, CamaraVotoDetalle"
  - "@obs/identity: EnlaceConfirmado (branded FK, transitivo)"
  - "@obs/core: Parlamentario"
  - "supabase/seeds/parlamentario.seed.json (155 diputados, DIPID único, periodo 2026-2030, confirmado)"
provides:
  - "@obs/votos: derivarGoldenDipid, validarGoldenDipid, PERIODO_VIGENTE, N_MIN, N_MAX, GoldenDipidRow"
  - "Gate CI fail-closed del cruce DIPID->id_maestra (invariantes + fail-closed + anti-name-match + branded-FK)"
affects:
  - "Phase 66 (backfill masivo de votos): el golden gate DEBE estar verde antes del backfill; el backfill pasa opts.periodo coherente"
tech-stack:
  added: []
  patterns:
    - "Golden set DERIVADO del seed (no hardcodeado) + validador que gatea (espejo de @obs/adjudication/golden-set.ts)"
    - "Fail-closed test contra el reconciliador REAL (no stub)"
    - "grep-gate anti-name-match diff-checkable, comment-stripped (código, no comentarios)"
    - "type-level branded-FK assertion vía *.test-d.ts (tsc-only gate, no runtime)"
key-files:
  created:
    - packages/votos/src/golden-dipid.ts
    - packages/votos/src/golden-dipid.test.ts
    - packages/votos/src/golden-dipid.test-d.ts
  modified:
    - packages/votos/src/index.ts
decisions:
  - "A1: estado==='confirmado' es INVARIANTE del golden gate, no del reconciliador (que linkea por presencia en índice, no por estado). Hoy no-op benigno; un futuro diputado dudoso rompe el gate ruidoso."
  - "Banda de conteo [150, 160] en vez de ===155 exacto: tolera rotación legítima (renuncia/subrogancia) pero detecta degradación real del seed."
  - "grep-gate escanea CÓDIGO strippeando comentarios: `reconciliar-camara.ts` documenta 'NO requiere LLM ni correrPipeline' — la negación en comentario NO es una fuga."
  - "validarGoldenDipid recibe la maestra (decisión (i) del plan): GoldenDipidRow se mantiene mínimo {dipid, idMaestra}; los checks de estado/periodo leen la maestra original."
metrics:
  duration: "~15 min"
  completed: "2026-07-14"
  tasks: 2
  files: 4
---

# Phase 65 Plan 01: VOTO P3b — Golden set DIPID→id_maestra (gate fail-closed) Summary

Golden set DIPID→id_maestra derivado del seed autoritativo (155 diputados) y blindado con un gate CI fail-closed de 4 aristas: invariantes duros, cruce fail-closed contra el reconciliador REAL, grep-gate anti-name-match, y aserción de tipo del FK branded — sin recrear el reconciliador ni el branded type.

## What Was Built

- **`packages/votos/src/golden-dipid.ts`** — `derivarGoldenDipid(maestra)` filtra `camara==='diputados' && periodo==='2026-2030' && id_diputado_camara` no-vacío y mapea a `{dipid, idMaestra}` (155 filas del seed real, NUNCA hardcodeadas). `validarGoldenDipid(golden, maestra)` gatea 5 invariantes que lanzan ruidoso: conteo en banda `[150,160]`, DIPIDs únicos, un solo periodo (recycle-trap), todo `idMaestra` no-vacío, y todos `estado==='confirmado'` (A1). Cabecera documenta A1 y la trampa del DIPID reciclado.
- **`packages/votos/src/golden-dipid.test.ts`** — 13 tests: invariantes del golden (SC#1), positivo+fail-closed+recycle-trap contra el reconciliador REAL `reconciliarVotosCamara` importado de `@obs/tramitacion` (SC#3), y grep-gate anti-name-match sobre `reconciliar-camara.ts` + `votos/src/*.ts` no-test (SC#2, comment-stripped).
- **`packages/votos/src/golden-dipid.test-d.ts`** — gate tsc-only: `@ts-expect-error` prueba que un string crudo NO es asignable a `VotoParaEscribir["enlace"]` (branded `EnlaceConfirmado | null`); `null` sí compila (SC#4).
- **`packages/votos/src/index.ts`** — barrel re-exporta la derivación + validación + constantes.

## Verification

- `pnpm --filter @obs/votos test` — 16/16 verde (13 golden-dipid + 3 run-camara-votos).
- `pnpm --filter @obs/votos typecheck` — verde con `golden-dipid.test-d.ts` compilado (el `@ts-expect-error` del FK se consume).
- `pnpm --filter @obs/tramitacion test reconciliar-camara` — 8/8 verde (sin regresión; no se tocó el reconciliador).
- `git diff --name-only` de los task commits: SOLO `golden-dipid.ts`, `golden-dipid.test.ts`, `golden-dipid.test-d.ts`, `index.ts` (reconciliador y branded type intactos).

## Success Criteria

- SC#1 (golden derivado+validado, ~155, DIPID único, periodo único 2026-2030, todos confirmado, recycle-trap cubierta): VERIFICADO — invariantes + test de periodo mismatcheado.
- SC#2 (DIPID-determinista PUNTO, sin name-match/LLM en el path): VERIFICADO — grep-gate diff-checkable.
- SC#3 (DIPID desconocido → no_confirmado/parlamentario_id=null contra el reconciliador REAL): VERIFICADO — "999999" fail-closed.
- SC#4 (FK branded `EnlaceConfirmado | null`, string crudo no compila): VERIFICADO — `test-d.ts` @ts-expect-error consumido bajo `tsc -b`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] grep-gate false-positive sobre comentario-negación**
- **Found during:** Task 2 (primer run de tests, 12/13 verde con 1 fallo).
- **Issue:** El grep-gate `/correrPipeline/` matcheó la cabecera de `reconciliar-camara.ts` que documenta "NO requiere LLM ni `correrPipeline`" — un comentario que NIEGA el símbolo, no una fuga de código.
- **Fix:** El test strippea comentarios de bloque y de línea (`soloCodigo()`) antes de asertar, escaneando solo CÓDIGO ejecutable. Un import/uso real seguiría atrapado; la mención negada en documentación no.
- **Files modified:** packages/votos/src/golden-dipid.test.ts
- **Commit:** 6641b43

## Threat Surface

Sin nueva superficie de amenaza. Esta fase es el mitigante de T-65-01..04 (atribución errónea de voto, golden stale, FK fabricado, name-match como fallback). 100% offline, lee solo `camara/periodo/id_diputado_camara/id/estado` del seed, nunca `rut` (T-65-05 accept: sin PII). Sin instalaciones de paquetes (T-65-SC accept).

## Commits

- `66ad193` feat(65-01): derive + validate golden set DIPID→id_maestra from seed
- `6641b43` test(65-01): gate golden set — invariants + fail-closed + anti-name-match + branded-FK

## Self-Check: PASSED
