---
phase: 121
plan: 01
subsystem: planning-docs
tags: [escalera, llm, benchmark, gate, doc]
requires:
  - "107-VEREDICTO-LIVE-FULL-2026-07-27.md (be0b1b9) — veredicto full-40"
  - "120-FLIP-RECORD.md — justificante del encendido de clasificación"
  - "packages/llm/src/{integ-scope,provider,tiered-scope}-guard.test.ts"
  - "packages/cruces/src/drift-canary.test.ts"
provides:
  - "121-ESCALERA-ESTADO.md — estado por tarea LLM con evidencia citada y condición de vigencia"
  - "check-escalera-doc.sh — gate re-ejecutable por grep con self-check anti-secreto"
  - "121-VERIFICATION.md — registro reproducible del cierre con mapeo SC#1–SC#4"
affects:
  - "Phase 125 (E2E de flags): CLASIFICACION_ESCALERA estado esperado ON, no es *_PUBLIC_ENABLED"
  - "cualquier milestone futuro que quiera extender la escalera"
tech-stack:
  added: []
  patterns:
    - "documento auditable + gate por grep (patrón 118/119)"
    - "self-check que prueba que el detector muerde (dos ramas + control negativo)"
key-files:
  created:
    - .planning/phases/121-escalera-doc-extension-solo-con-benchmark/121-ESCALERA-ESTADO.md
    - .planning/phases/121-escalera-doc-extension-solo-con-benchmark/check-escalera-doc.sh
    - .planning/phases/121-escalera-doc-extension-solo-con-benchmark/121-VERIFICATION.md
  modified: []
decisions:
  - "Vocabulario CERRADO de tres valores; INTOCABLE reservado a lo que NO es candidato a benchmark (sólo adjudicación) — divergencia deliberada y reconciliada respecto del uso de la palabra en el veredicto full-40, donde 'INTOCABLE' significa 'el incumbente no se mueve'"
  - "Extracción se registra NO EXTENDIDA (no INTOCABLE) porque SÍ es candidata: un benchmark es-CL que superara el veto podría extenderla"
  - "El estado EXTENDIDA de clasificación es CONDICIONAL a la vigencia del drift canary: mismatch de modelo servido ⇒ veredicto invalidado ⇒ el estado cae a NO EXTENDIDA"
  - "Los gates de conteo del script son locale-independientes: `[eé]` en bracket-expression multibyte NO casa bajo LC_ALL=C y produciría un falso FAIL"
metrics:
  duration: ~25 min
  tasks: 3
  files: 3
  completed: 2026-07-28
---

# Phase 121 Plan 01: ESCALERA-DOC — Extensión solo con benchmark Summary

Registro auditable, tarea LLM por tarea LLM, del estado de extensión de la escalera
`tiered:granite→deepseek` — con la cifra de benchmark que respalda cada estado, la condición de
vigencia que puede tumbarlo, y qué evidencia concreta extendería cada pendiente — cerrado por un
gate de grep cuyo detector anti-secreto se auto-prueba.

## Qué se construyó

**`121-ESCALERA-ESTADO.md`** — el artefacto rector de CRON-04:

| Tarea | Estado | Sustento |
|---|---|---|
| clasificación | EXTENDIDA | Δ **0.0000**, cobertura **1.0** ambos, ~84× más barata; encendida en 120 con canary PASS + `acuerdo=8/8` + rollback probado |
| routing | NO EXTENDIDA | Δ **−0.1000**; cobertura **0.5** vs **0.6**; **flip** vs el 10-sample (`+0.10`) |
| extracción | NO EXTENDIDA | veto es-CL por corto-circuito: `negacion.accuracy` **0/3 = 0** vs **1/3 = 0.333**; value P/R **0.098/0.182** vs **1.0/1.0** |
| juez | NO EXTENDIDA | `recall_rechazo` **0.9167** vs **0.75** (Δ **+0.1667**): instrumento validado, pero ESCALATE-ONLY — recall alto ≠ paridad para decidir |
| adjudicación | INTOCABLE | decisión de diseño v11.0 (SEED-001), no una métrica; N/A por diseño |

Más el recuadro de la lección (routing: approved en la muestra de 10 → incumbent-stays en el
full-40), el régimen de guards (`integ-scope-guard`, `provider-guard`, `tiered-scope-guard`, `7 passed`
al cierre de 120 con la escalera YA encendida), la condición de vigencia por drift canary con su
regla de invalidación, y seis límites declarados.

**`check-escalera-doc.sh`** — gate re-ejecutable: C1 existencia, C2 las 5 tareas nombradas, C3 el
reparto exacto de celdas del vocabulario cerrado (1/3/1), C4 citas verificables (`be0b1b9`,
`120-FLIP-RECORD`, `SEED-001`), C5 la subparte "qué evidencia la extendería" ≥5, C6 anti-secreto con
filtro declarado, C7 self-check de dos fixtures **inventados** + control negativo.

**`121-VERIFICATION.md`** — comando, exit 0, salida íntegra, mapeo SC#1–SC#4 a comprobación y
sección, muestreo de fidelidad de 7 cifras contra el veredicto, y límites de la verificación.

## Decisiones clave

**Reconciliación de vocabulario, explícita en el documento.** El veredicto full-40 escribe para
extracción «DeepSeek se queda. INTOCABLE». Este documento la registra NO EXTENDIDA. Sin la
reconciliación un lector futuro lo leería como contradicción; con ella queda claro que son dos
sentidos distintos de la misma palabra, y que `INTOCABLE` aquí significa «no es candidata a
benchmark en absoluto» — sólo la adjudicación.

**El estado EXTENDIDA es condicional, no permanente.** Si el drift canary reporta mismatch entre el
modelo servido y el pinneado, el veredicto queda invalidado para esa tarea y el estado cae a NO
EXTENDIDA. El rollback es quitar una línea de `.env` — sin migración, sin deploy, sin código.

**El self-check prueba DOS ramas, no una.** Una asignación de credencial y un blob hex suelto son
detecciones distintas: un token pegado en una salida transcrita no siempre viene como asignación. Se
añadió además un control negativo que verifica que la excepción `CLASIFICACION_ESCALERA=1` no abre
un agujero general.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Los patrones de conteo con vocal acentuada en bracket-expression daban falso FAIL**

- **Found during:** Task 2 (verificación `<automated>` del plan)
- **Issue:** el `<automated>` del plan usa `grep -ci 'qu[eé] evidencia'`. Bajo el locale por defecto
  del entorno (efectivamente `C`), `é` son **dos bytes** y la bracket-expression `[eé]` casa un solo
  byte → el patrón nunca casa "Qué". Resultado: **0** ocurrencias sobre un documento que tiene 6.
  El contenido era correcto; el gate mentía.
- **Fix:** confirmado el diagnóstico (`LC_ALL=en_US.UTF-8` da 6, `LC_ALL=C` da 0). La verificación
  del plan se corrió bajo locale UTF-8 → `OK-T2`. Y el gate propio de la fase
  (`check-escalera-doc.sh`) se escribió **locale-independiente**: fuerza `LC_ALL=C` y usa
  `qu.\{1,2\} evidencia`, que casa igual con y sin acento. La cabecera del script documenta el
  gotcha para que nadie lo "arregle" reintroduciendo la bracket-expression.
- **Files modified:** `check-escalera-doc.sh` (prevención); ninguno del contenido.
- **Commit:** `69abf1b`

Ninguna otra desviación. No hubo checkpoints ni gates de autenticación.

## Threat Flags

Ninguno. La fase es DOC pura: cero código de producto, cero migraciones, cero paquetes nuevos
(T-121-SC N/A por construcción), y las cinco mitigaciones del registro STRIDE quedaron aplicadas —
T-121-01 por la comprobación C6 + el self-check C7, T-121-02 por la regla de fidelidad y su
muestreo, T-121-03 por las citas exigidas en C4, T-121-04 por la §Régimen de guards y T-121-05 por
la §Condición de vigencia.

## Verificación

1. `sh .planning/phases/121-escalera-doc-extension-solo-con-benchmark/check-escalera-doc.sh` → **exit 0**,
   `GATE VERDE`, 0 faltas, self-check mordiendo en las dos ramas.
2. `git status --porcelain` → sólo los tres archivos de `files_modified` como nuevos. Cero cambios en
   `packages/`, `app/`, `supabase/`, `.env`, `.env.example`, `package.json`.
   (`pnpm-workspace.yaml` y `119-REVIEW.md` figuran modificados **antes** de esta fase; esta plan no
   los tocó.)
3. Muestreo de fidelidad: 7 cifras verificadas presentes literalmente en el veredicto — tabla en
   `121-VERIFICATION.md` §3.

## Known Stubs

Ninguno.
