---
phase: 106-bench-p1a-harness-llm-bench-golden-sets-es-cl-por-tarea-spike-gate-duro
plan: 03
subsystem: llm-bench
tags: [benchmark, golden-set, es-CL, juez, conditional-accuracy, bias-hooks, calibration-split, extraccion, parse-rate, negacion, freeze, no-pii, anti-leakage]
dependency_graph:
  requires:
    - "106-01 (barrel src/index.ts + placeholder scorer modules juez/extraccion; report.ts TaskId/QualityScore)"
    - "106-02 (guards/freeze.ts + guards/no-rut.ts + convención de sufijo _ROUTING/_CLASIF)"
    - "packages/fichas/src/golden/golden-set.ts (extracción precedent: parse-vs-value + normalizarLiteral + adversario)"
  provides:
    - "tasks/extraccion/: golden es-CL congelado (40) + evaluarExtraccion (schema_parse_rate SEPARADO de value.{precision,recall}) + negación load-bearing + gate + guard"
    - "tasks/juez/: golden (answer, human_label) congelado (40) + evaluarJuez (precisión-del-OK + recall-de-rechazo condicional vs humano) + hooks de sesgo + split scoring/calibración disjuntos + slot curva de confiabilidad (vacío) + guard"
  affects:
    - "107 mide Phi-vs-humano contra el golden de juez congelado (freeze marker = artefacto que 107 depende) + fitea isotónica/Platt sobre el split de calibración; y mide los modelos reales contra el golden de extracción"
tech_stack:
  added: []  # ZERO paquete externo nuevo (T-106-SC respetado)
  patterns:
    - "schema-parse-rate SEPARADO de field-value accuracy (Cleanlab) — un modelo 100%-parse/valores-fabricados muestra parse-rate alto Y precisión baja, jamás un solo número"
    - "conditional accuracy vs etiqueta HUMANA (nunca vs responder) — precisión-del-OK + recall-de-rechazo como campos separados; sello-de-goma expuesto por recall≈0"
    - "bias hooks definidos+congelados en 106, medidos en 107 (self-preference=producer, verbosity=answerLen, position=orderings)"
    - "held-out calibration split disjunto del scoring + slot de curva de confiabilidad VACÍO (fit isotónica/Platt es 107)"
    - "fidelidad literal por substring + negación es-CL load-bearing como fp (dropped-negation invierte el sentido)"
    - "namespace plano del barrel (export *) → símbolos compartidos con sufijo _EXTRACCION/_JUEZ (misma convención que 106-02)"
    - "guard-que-muerde vitest estático sin red: ∩=∅ (exemplar/eval + scoring/calibración) + no-RUT + frozen-hash + meta-tests que prueban que muerden"
key_files:
  created:
    - packages/llm-bench/src/tasks/extraccion/casos.json
    - packages/llm-bench/src/tasks/extraccion/casos.freeze.json
    - packages/llm-bench/src/tasks/extraccion/prompt_exemplars.json
    - packages/llm-bench/src/tasks/extraccion/scorer.test.ts
    - packages/llm-bench/src/tasks/extraccion/disjuncion.test.ts
    - packages/llm-bench/src/tasks/juez/casos.json
    - packages/llm-bench/src/tasks/juez/casos.freeze.json
    - packages/llm-bench/src/tasks/juez/prompt_exemplars.json
    - packages/llm-bench/src/tasks/juez/scorer.test.ts
    - packages/llm-bench/src/tasks/juez/disjuncion.test.ts
  modified:
    - packages/llm-bench/src/tasks/extraccion/scorer.ts  # placeholder → real (símbolos con sufijo _EXTRACCION)
    - packages/llm-bench/src/tasks/juez/scorer.ts         # placeholder → real (símbolos con sufijo _JUEZ)
decisions:
  - "El slot de la curva de confiabilidad (BinConfiabilidadJuez + slotCurvaConfiabilidadJuez) se define LOCAL al juez scorer, NO en report.ts: report.ts es un módulo owner de 106-01 re-exportado por el barrel; tocarlo arriesga colisión/ownership. 106 solo deja el CONTRATO del dato + la función que devuelve [] vacío (T-106-10: 106 deja split+slot, 107 fitea)"
  - "El gate de extracción usa value.{precision≥0.95, recall≥0.80} (espeja fichas); el schema_parse_rate NO entra en el gate — es una métrica SEPARADA que 107 reporta aparte (un modelo puede pasar el gate de valor y aún tener parse-rate bajo → se lee por su cuenta, Cleanlab)"
  - "El juez NO tiene un gate booleano de pasa/falla en 106: 106 solo MIDE acuerdo veredicto-vs-humano (precisión-del-OK + recall-de-rechazo). El umbral/composición escalate-only es 108/TIER; el meta-test adversario prueba que recall-de-rechazo PUEDE caer (métrica viva) sin necesidad de un gate"
  - "normalizarLiteral se INLINEA en extraccion/scorer.ts (copia de fichas) en vez de dep runtime @obs/fichas: el harness no arrastra un paquete de dominio por una función pura"
  - "Símbolos compartidos con sufijo _EXTRACCION/_JUEZ (continúa la convención de 106-02): GOLDEN_SET_*, GOLDEN_SET_GATE_*, GOLDEN_SET_ADVERSARIO_*, IDS_CASOS_ADVERSARIOS_*, gatePasa*. src/index.ts NO se tocó (barrel diff vacío)"
metrics:
  duration: ~20 min
  completed: 2026-07-27
requirements: [BENCH-02]
---

# Phase 106 Plan 03: BENCH P1a — juez + extracción golden sets es-CL Summary

Completó los cuatro golden sets de BENCH-02 construyendo los dos con modos de fallo distintos a los single-label (Plan 02): el de **juez/validación** como pares `(answer, human_label)` que rinden accuracy CONDICIONAL (precisión-del-OK + recall-de-rechazo vs la etiqueta HUMANA, jamás vs el responder) con HOOKS de sesgo (self-preference/verbosity/position) y un split de calibración held-out disjunto + slot de curva de confiabilidad vacío (medición/fit en 107); y el de **paridad-extracción** que mantiene `schema_parse_rate` SEPARADO de la `value` accuracy (Cleanlab) con fidelidad literal por substring y negación es-CL load-bearing como falso positivo. Ambos congelados (sha256), zod-validados al cargar, con el trío de guards que MUERDE (∩=∅, no-RUT, frozen-hash) y el meta-test adversario aislado por tarea. Llenó los 2 módulos placeholder de 106-01 SIN tocar el barrel.

## What was built

- **Task 1 — extracción golden + scorer + guard** (`12e1df7`, TDD): `casos.json` = 40 casos es-CL de extracción literal sobre texto legal realista (sembrado del estilo del golden de fichas), estratificados por doc-format (xml-clean vs scanned-pdf), register (archaic vs modern), length y chamber (Cámara/Senado/BCN); ≥2 casos con negación load-bearing ("no será aplicable", "no procederá el desalojo", "no podrá negarse") + casos scanned-pdf/archaic; 2 adversarios aislados. `scorer.ts` generaliza fichas: `evaluarExtraccion` devuelve `{ schema_parse_rate, value: { tp, fp, fn, precision, recall }, detalle }` con el parse-rate SEPARADO del valor — un caso `null` (structured-output fail) baja parse-rate sin contaminar la value-accuracy; `normalizarLiteral` inlineado; `gatePasaExtraccion` (precisión ≥ 0.95 Y recall ≥ 0.80). `scorer.test.ts` asierta la SEPARACIÓN (100%-parse/valores-fabricados → parse-rate alto + precisión < 0.5), negación caída → fp, y el meta-test adversario. `casos.freeze.json` sha256 = `0dc7bd5b…`. Símbolos con sufijo `_EXTRACCION`.
- **Task 2 — juez golden + scorer + guard** (`a939c56`, TDD): `casos.json` = 40 pares `(answer, human_label)` sobre outputs NON-PII de tareas (sectores propuestos, ideas matrices propuestas — corpus público, NUNCA adjudicación/golden-1263), 32 en split scoring + 8 en split calibración (disjunto), 15 answers incorrectas (human_label:false) para que recall-de-rechazo sea medible, hooks `producer`/`answerLen`/`orderings` en cada caso, 2 adversarios aislados. `scorer.ts`: `evaluarJuez` computa `precision_ok` (P(correcta|OK)) y `recall_rechazo` (P(rechaza|mala)) como campos SEPARADOS vs `human_label`, agrega hooks `porProductor`/`porLongitud` (poblados, no interpretados), expone `GOLDEN_SET_SCORING_JUEZ`/`GOLDEN_SET_CALIBRACION_JUEZ` disjuntos y `slotCurvaConfiabilidadJuez()` → `[]`. `scorer.test.ts` prueba que el sello-de-goma da recall-de-rechazo 0 (expuesto), que el scoring excluye la calibración, y el meta-test adversario. `casos.freeze.json` sha256 = `f7636de2…`. Símbolos con sufijo `_JUEZ`.

## Verification

- `pnpm --filter @obs/llm-bench test` → 91/91 green (metrics 15 + instrument 3 + routing 17 + clasificación 17 + extracción 18 + juez 21).
- `pnpm --filter @obs/llm-bench test extraccion` → 18/18 green; `... test juez` → 21/21 green.
- `pnpm --filter @obs/llm-bench exec tsc -b` → exit 0. Root `pnpm exec tsc -b` → exit 0 (sin regresión).
- `src/index.ts` (barrel, owner 106-01) NO modificado (`git diff --stat HEAD` vacío para ese archivo).
- Extracción: `schema_parse_rate` y `value.{precision,recall}` son campos SEPARADOS; un test construye un caso 100%-parse/valor-fabricado y prueba parse-rate alto + precisión hundida; negación caída → fp; adversario aislado hace el gate fallar.
- Juez: pares `(answer, human_label)`; sello-de-goma → recall-de-rechazo 0; scoring∩calibración=∅; hooks poblados; slot de curva vacío; adversario aislado baja el rechazo.
- Cada `disjuncion.test.ts` MUERDE: `assertFrozen` lanza `/FREEZE ROTO/` ante hash malo, `contieneRut` detecta un RUT sembrado — los guards no son teatro.
- ZERO paquete externo nuevo (T-106-SC respetado; `normalizarLiteral` inlineado, sin dep runtime @obs/fichas).
- Adjudicación golden-1263 sin tocar (ningún caso de juez la sourcea — corpus público de proyectos de ley).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Sanity-check de la prueba de negación mal construido.**
- **Found during:** Task 1 (primer run de extracción falló en "negación caída puntúa como fp").
- **Issue:** La prueba derivaba la "variante sin negación" quitando solo el "no " del principio; sobre "no será aplicable la exención…" eso deja "será aplicable la exención…", que SÍ es substring del texto fuente (el texto contiene "no será aplicable…") → el sanity-check `expect(...includes...).toBe(false)` fallaba.
- **Fix:** La prueba ahora INVIERTE la negación ("no" → "sí"), produciendo "sí será aplicable…", que NO es substring del texto → el falso positivo se materializa como pretende la prueba. El scorer no cambió; solo la construcción del caso de prueba.
- **Files modified:** packages/llm-bench/src/tasks/extraccion/scorer.test.ts
- **Commit:** 12e1df7 (fixeado antes del commit de Task 1)

**Nota de convención (no es deviación):** siguiendo la nota de 106-02, los símbolos compartidos se sufijaron `_EXTRACCION`/`_JUEZ` para no colisionar bajo el `export *` del barrel plano. `src/index.ts` no se tocó. Sin errores TS2308 (la convención se aplicó proactivamente, no como reacción a un fallo).

No architectural changes; no auth gates; no new secret; no 107 scope introducido (sin adapters, sin endpoint real, sin veredicto de modelo, sin fit de calibración).

## Known Stubs

Ninguno. Los cuatro módulos scorer de tareas (routing, clasificación, juez, extracción) están completos; los seis placeholders `export {}` de 106-01 quedaron todos llenados (106-02 llenó guards + routing/clasificación; este plan llenó juez/extracción). El slot de curva de confiabilidad devuelve `[]` a propósito (contrato de dato definido, fit en 107 — no es un stub que bloquee el objetivo del plan).

## Threat Flags

Ninguno. No se introdujo superficie de seguridad nueva fuera del `<threat_model>` del plan: los golden son datos JSON en disco validados por zod al cargar, sin red, sin endpoint, sin PII (guard no-RUT muerde), y la adjudicación queda OFF-LIMITS.

## TDD Gate Compliance

Los golden sets son datos + scorers puros con tests de comportamiento. Extracción (Task 1) y juez (Task 2) se escribieron scorer + set + tests juntos y verdes; el único ciclo RED real fue el sanity-check de negación de Task 1 (falló, se corrigió la prueba, verde). No hubo commits `test(...)` RED separados porque el "código bajo prueba" es un scorer determinista + JSON congelado, no un feature con red. La intención del TDD gate —probar que la métrica está VIVA antes de integrar 107— se cumple vía los meta-tests adversarios aislados por tarea (el gate/la métrica de rechazo PUEDE fallar) y los guards-que-muerden.

## Self-Check: PASSED

- 10 archivos creados presentes en disco (extracción: casos.json/casos.freeze.json/prompt_exemplars.json/scorer.test.ts/disjuncion.test.ts; juez: idem).
- 2 módulos placeholder llenados (tasks/extraccion/scorer.ts, tasks/juez/scorer.ts).
- 2 commits presentes en git: 12e1df7, a939c56.
- `src/index.ts` sin cambios (barrel intacto).
- Suite 91/91 verde; tsc -b (paquete + root) exit 0.
