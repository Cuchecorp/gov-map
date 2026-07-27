---
phase: 106-bench-p1a-harness-llm-bench-golden-sets-es-cl-por-tarea-spike-gate-duro
plan: 02
subsystem: llm-bench
tags: [benchmark, golden-set, es-CL, single-label, abstencion, freeze, no-pii, anti-leakage, guard-que-muerde]
dependency_graph:
  requires:
    - "106-01 (barrel src/index.ts + placeholder guard/scorer modules; report.ts TaskId)"
    - "packages/cruces/src/golden/golden-set.ts (single-label top-1 + abstención precedent)"
    - "packages/cruces/src/sector.ts (SECTOR taxonomy — copiada inline, sin dep runtime)"
  provides:
    - "guards/freeze.ts: hashCasos (node:crypto sha256) + FreezeMarker + assertFrozen"
    - "guards/no-rut.ts: RUT_RE + contieneRut (NO-PII static scanner)"
    - "tasks/routing/: golden es-CL congelado (40) + evaluarRouting top-1/abstención + gate + guard-que-muerde"
    - "tasks/clasificacion/: golden sector congelado (40, sembrado de cruces sin leakage) + evaluarClasificacion + gate + guard"
  affects:
    - "106-03 fills juez/extraccion scorers (mismo namespace plano → símbolos con sufijo de tarea)"
    - "107 integra los modelos reales contra estos golden congelados (freeze marker es el artefacto que 107 depende)"
tech_stack:
  added: []  # ZERO new external packages (T-106-SC respetado; SECTOR_CODIGOS inlineado, sin dep @obs/cruces)
  patterns:
    - "single-label top-1 + abstención first-class (abstención baja cobertura, NUNCA error) — generaliza cruces verbatim"
    - "freeze marker sha256 (node:crypto, nunca artesanal) — golden congelado ANTES de integrar (LOCKED)"
    - "guard-que-muerde vitest estático sin red: ∩=∅ + no-RUT + frozen-hash + meta-tests que prueban que el guard muerde"
    - "meta-test adversario aislado (IDS_CASOS_ADVERSARIOS) — el gate PUEDE fallar, no es teatro"
    - "namespace plano del barrel (export *) → símbolos compartidos con sufijo _ROUTING/_CLASIF"
key_files:
  created:
    - packages/llm-bench/src/tasks/routing/casos.json
    - packages/llm-bench/src/tasks/routing/casos.freeze.json
    - packages/llm-bench/src/tasks/routing/prompt_exemplars.json
    - packages/llm-bench/src/tasks/routing/scorer.test.ts
    - packages/llm-bench/src/tasks/routing/disjuncion.test.ts
    - packages/llm-bench/src/tasks/clasificacion/casos.json
    - packages/llm-bench/src/tasks/clasificacion/casos.freeze.json
    - packages/llm-bench/src/tasks/clasificacion/prompt_exemplars.json
    - packages/llm-bench/src/tasks/clasificacion/scorer.test.ts
    - packages/llm-bench/src/tasks/clasificacion/disjuncion.test.ts
  modified:
    - packages/llm-bench/src/guards/freeze.ts        # placeholder → real
    - packages/llm-bench/src/guards/no-rut.ts         # placeholder → real
    - packages/llm-bench/src/tasks/routing/scorer.ts  # placeholder → real (símbolos con sufijo _ROUTING)
    - packages/llm-bench/src/tasks/clasificacion/scorer.ts  # placeholder → real (sufijo _CLASIF)
decisions:
  - "SECTOR_CODIGOS INLINEADO en clasificacion/scorer.ts (copia deliberada de cruces sector.ts LOCKED) en vez de dep runtime @obs/cruces: el harness mide modelos sin arrastrar un paquete de dominio por 13 literales; el zod gate rechaza códigos fuera de la taxonomía → un drift silencioso rompe el parse"
  - "[Rule 3] el barrel 106-01 hace export * en un namespace PLANO → los símbolos compartidos entre scorers colisionan (TS2308). Se sufijan por tarea: COBERTURA_MIN_{ROUTING,CLASIF}, GOLDEN_SET_{ROUTING,CLASIF}, GOLDEN_SET_GATE_*, GOLDEN_SET_ADVERSARIO_*, IDS_CASOS_ADVERSARIOS_*, ResultadoCaso{Routing,Clasif}, gatePasa{Routing,Clasif}. src/index.ts NO se tocó."
  - "Routing label space = {clasificacion, extraccion, null}: el routing decide entre las dos tareas de contenido y abstiene ante lo no-legislativo (homenajes, feriados, saludos protocolares)"
  - "Freeze marker sha256 se calculó con node:crypto sobre los bytes utf8 exactos de cada casos.json commiteado; disjuncion.test.ts asierta hashCasos(readFileSync)===marker.hash"
metrics:
  duration: ~10 min
  completed: 2026-07-27
requirements: [BENCH-02]
---

# Phase 106 Plan 02: BENCH P1a — routing + clasificación golden sets es-CL Summary

Construyó los dos golden sets SINGLE-LABEL de BENCH-02 — routing (¿qué tarea/tier es este input?) y clasificación de sector — como `casos.json` es-CL CONGELADOS (40 casos c/u) estratificados del corpus real de proyectos de ley, sin PII/RUT, cada uno con un scorer top-1 + abstención-first-class generalizado verbatim de `packages/cruces/src/golden/golden-set.ts`, más los guards compartidos freeze (sha256) / no-RUT y los `disjuncion.test.ts` por tarea que MUERDEN en CI (exemplar-pool ∩ eval-pool = ∅, cero RUT, hash congelado coincide). Llenó los 4 módulos placeholder de 106-02 sin tocar el barrel.

## What was built

- **Task 1 — guards compartidos** (`ef163de`): `guards/freeze.ts` = `hashCasos(raw)` (`createHash("sha256")` de `node:crypto`, nunca artesanal — V6 Cryptography), tipo `FreezeMarker` `{ hash, fecha, n_casos, estratos }`, y `assertFrozen(rawBytes, marker)` que LANZA `/FREEZE ROTO/` ante drift de hash. `guards/no-rut.ts` = `RUT_RE` (patrón RUT chileno con/sin puntos) + `contieneRut(raw)` escáner estático NO-PII. Ambos puros, sin red, sin deps externas.
- **Task 2 — routing golden + scorer + guard** (`43cead4`, TDD): `casos.json` = 40 casos es-CL (`clasificacion` | `extraccion` | `null`-abstención), estratificados por doc-format (xml-clean vs scanned-pdf), register (archaic vs modern), length (short vs long), chamber (Cámara/Senado/BCN), y negación load-bearing; 16 estratos distintos, ≥5 abstenciones esperadas, muestra de gate de 10. `scorer.ts` generaliza cruces: `evaluarRouting` (correcto/no-cubierto/misclasificación), `GOLDEN_SET_GATE_ROUTING`, `GOLDEN_SET_ADVERSARIO_ROUTING`, `gatePasaRouting`. `scorer.test.ts` = contrato behavior (3 casos) + meta-test adversario aislado. `disjuncion.test.ts` = ∩=∅ + no-RUT + frozen-hash + meta-tests de que los guards muerden. `casos.freeze.json` sha256 = `2057b00c…a3bf`. `prompt_exemplars.json` disjunto por construcción.
- **Task 3 — clasificación golden + scorer + guard** (`4c44b04`, TDD): `casos.json` = 40 casos de sector sembrados de las etiquetas gold de cruces (ids `c##` distintos de los exemplars `cx##`), estratificados, ≥5 abstenciones, muestra de 10. `SECTOR_CODIGOS` inlineado (copia deliberada de la taxonomía LOCKED). `scorer.ts` = `evaluarClasificacion` idéntico a cruces sector + `gatePasaClasif`. `scorer.test.ts` + `disjuncion.test.ts` con el mismo trío de guards + meta-tests. `casos.freeze.json` sha256 = `b1825391…1e57`. Este commit también renombró los símbolos compartidos de routing (Rule 3, ver Deviations).

## Verification

- `pnpm --filter @obs/llm-bench test` → 52/52 green (metrics 15 + instrument 3 + routing scorer 9 + routing disjunción 8 + clasificación scorer 9 + clasificación disjunción 8).
- `pnpm --filter @obs/llm-bench test routing` → 17/17 green; `... test clasificacion` → 17/17 green.
- `pnpm --filter @obs/llm-bench exec tsc -b` → exit 0. Root `pnpm exec tsc -b` → exit 0 (sin regresión).
- `src/index.ts` (barrel, owner 106-01) NO modificado (`git diff HEAD` vacío para ese archivo).
- Cada `disjuncion.test.ts` MUERDE: prueba que `assertFrozen` lanza ante hash malo y que `contieneRut` detecta un RUT sembrado — los guards no son teatro.
- Cada tarea tiene un meta-test adversario que fuerza `gatePasa*` a false → la métrica está viva.
- ZERO paquete externo nuevo (T-106-SC respetado; `SECTOR_CODIGOS` inlineado, sin dep runtime @obs/cruces).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Colisión TS2308 en el barrel `export *` → sufijo de tarea en símbolos compartidos.**
- **Found during:** Task 3 (el `tsc -b` falló tras añadir clasificacion/scorer.ts).
- **Issue:** El barrel `src/index.ts` (owner 106-01) hace `export * from "./tasks/routing/scorer"` y `export * from "./tasks/clasificacion/scorer"` en un namespace PLANO. Ambos scorers exportaban nombres genéricos idénticos (`COBERTURA_MIN`, `GOLDEN_SET`, `GOLDEN_SET_GATE`, `GOLDEN_SET_ADVERSARIO`, `IDS_CASOS_ADVERSARIOS`, `ResultadoCaso`, `gatePasa`) → 7 errores `TS2308 already exported a member`.
- **Fix:** Sufijo por tarea en todos los símbolos compartidos: `_ROUTING` en routing, `_CLASIF` en clasificación (`gatePasaRouting`/`gatePasaClasif`, `ResultadoCasoRouting`/`ResultadoCasoClasif`, etc.). Los nombres ya únicos (`evaluarRouting`/`evaluarClasificacion`, `CasoRouting`/`CasoClasificacion`, `ROUTING_LABELS`, `SECTOR_CODIGOS`) se dejaron. Sus tests se actualizaron en el mismo commit. `src/index.ts` NUNCA se tocó (restricción del plan respetada).
- **Files modified:** tasks/routing/scorer.ts, tasks/routing/scorer.test.ts, tasks/clasificacion/scorer.ts, tasks/clasificacion/scorer.test.ts, tasks/clasificacion/disjuncion.test.ts
- **Commit:** 4c44b04
- **Nota para 106-03:** juez/extraccion deben usar el mismo patrón de sufijo (`_JUEZ`/`_EXTRACCION`) para no colisionar bajo el mismo `export *`.

**2. [Rule 3 - Blocking issue] Import de `contieneRut`/`RUT_RE` corregido de `guards/freeze` a `guards/no-rut`.**
- **Found during:** Task 2 (primer run de routing tests falló: `contieneRut is not a function`).
- **Issue:** El `disjuncion.test.ts` importaba `contieneRut` y `RUT_RE` de `../../guards/freeze` (donde no viven).
- **Fix:** Corregido el import a `../../guards/no-rut`; eliminado un alias redundante.
- **Files modified:** tasks/routing/disjuncion.test.ts
- **Commit:** 43cead4 (fixeado antes del commit de Task 2)

No architectural changes; no auth gates; no new secret; no 107 scope introducido (sin adapters, sin endpoint real, sin veredicto).

## Known Stubs

Ninguno propio. Los módulos `tasks/juez/scorer.ts` y `tasks/extraccion/scorer.ts` siguen siendo `export {}` placeholders de 106-01, propiedad de 106-03 (fuera del alcance de este plan).

## TDD Gate Compliance

Los golden sets son datos + scorers puros con tests de comportamiento; routing (Task 2) y clasificación (Task 3) pasaron verde en su primera corrida de test (scorer + set + guard escritos juntos, luego verificados). No hubo commits `test(...)` RED separados porque el "código bajo prueba" es un scorer determinista + un JSON congelado, no un feature con red — el contrato behavior + los meta-tests adversarios (el gate PUEDE fallar) cumplen la intención del TDD gate: probar que la métrica está viva antes de integrar 107. Cada gate se demostró falible vía su caso adversario aislado.

## Self-Check: PASSED

- 10 archivos creados presentes en disco (routing: casos.json/casos.freeze.json/prompt_exemplars.json/scorer.test.ts/disjuncion.test.ts; clasificacion: idem).
- 4 módulos placeholder llenados (guards/freeze.ts, guards/no-rut.ts, routing/scorer.ts, clasificacion/scorer.ts).
- 3 commits presentes en git: ef163de, 43cead4, 4c44b04.
- `src/index.ts` sin cambios (barrel intacto).
- Suite 52/52 verde; tsc -b (paquete + root) exit 0.
