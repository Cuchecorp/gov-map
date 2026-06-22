---
phase: 26-pat-patrimonio-intereses-live-en-la-nube-ficha-poblada
plan: 01
subsystem: probidad
tags: [probidad, infoprobidad, patrimonio, intereses, live, identidad, superset, versionado, cplt, ficha-poblada]

# Dependency graph
requires:
  - phase: 12
    provides: "@obs/probidad connector SPARQL + parse + writer versionado (0022) + reconciliarDeclarante"
  - phase: 23
    provides: "esquema 0022 probidad aplicado al remoto"
provides:
  - "1.060 declaraciones VERSIONADAS confirmadas en prod (136 parlamentarios) — sección patrimonio poblada (era 0)"
  - "reconciliar-objetivo (match targeted token-superset) + run-probidad-todos + CLI operador"
affects: [Phase 32 (verificación prod)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Match de identidad TARGETED token-superset: consulta por (paterno+materno) del parlamentario conocido y confirma SOLO declaraciones cuyo nombre del declarante CONTIENE todos los tokens del objetivo (nombres+paterno+materno) → tolera segundos nombres, apellidos compuestos, distingue hermanos por primer nombre. Determinista, fail-closed, sin LLM"
    - "InfoProbidad devuelve nombres COMPLETOS con segundos nombres (BORIS ANTHONY BARRERA MORENO) y hermanos comparten paterno+materno (JORGE/FELIPE ALESSANDRI) → ni materno-less ni full-equality sirven; el superset targeted sí"
    - "datos.cplt.cl SPARQL responde a Node fetch (sin WAF, a diferencia de www.camara.cl)"

key-files:
  created:
    - packages/probidad/src/reconciliar-objetivo.ts
    - packages/probidad/src/reconciliar-objetivo.test.ts
    - packages/probidad/src/run-probidad-todos.ts
    - packages/probidad/src/run-probidad-todos-cli.ts
    - .planning/phases/26-pat-patrimonio-intereses-live-en-la-nube-ficha-poblada/26-CONTEXT.md
    - .planning/phases/26-pat-patrimonio-intereses-live-en-la-nube-ficha-poblada/26-SUMMARY.md
  modified:
    - packages/probidad/src/index.ts
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "Match TARGETED token-superset (no fuzzy pipeline): se conoce el parlamentario objetivo (se consulta por su nombre) → confirmar las declaraciones cuyo declarante es superset de los tokens del objetivo es determinista y más robusto que la adjudicación difusa. Resuelve la causa raíz (InfoProbidad con segundos nombres; hermanos homónimos por apellidos)"
  - "deterministic-only: sin provider LLM (la consulta es por persona conocida)"
  - "bienes/familiares=0: la query SPARQL de Phase 12 trae metadata de declaración (tipo/cargo/organismo/fecha de presentación) — versiones+fecha es el núcleo del goal; los bienes detallados se difieren (ampliar la query)"

# Metrics
metrics:
  duration: ~40min
  completed: 2026-06-22
---

# Phase 26 Plan 01: PAT — Patrimonio/intereses LIVE + ficha poblada Summary

La sección patrimonio/intereses pasó de VACÍA a **1.060 declaraciones versionadas confirmadas en
136 parlamentarios**, con historial de versiones y fecha de presentación reales.

## What was built / run

- **`reconciliar-objetivo.ts`** — `reconciliarDeclaracionesObjetivo(declaraciones, objetivo)`:
  confirma SOLO las declaraciones cuyo nombre del declarante es **superset** de los tokens del
  objetivo (nombres+paterno+materno). Mintea `confirmar(id,"determinista")`. Maneja segundos
  nombres, apellidos compuestos y distingue hermanos (Jorge vs Felipe Alessandri).
- **`run-probidad-todos.ts`** — itera los 186: consulta InfoProbidad por (paterno+materno),
  parsea, reconcilia-objetivo, upsert versionado, marca confirmados. Tolerante (errores no abortan).
- **`run-probidad-todos-cli.ts`** — runner operador (env BOM-safe, seed, SPARQL real, `--dry-run`,
  `--limit N`).
- **Corrida LIVE a prod:** 186 consultados → 1.060 versiones confirmadas / 136 parlamentarios / 0 errores.

## Verificación (remoto)

- `declaracion`: 1.060 total / **1.060 confirmadas** / **136 parlamentarios distintos**.
- `probidad_ingesta_estado`: 136.
- Fichas muestra: Claudia Mora 20 versiones (última 2026-03-26), Loreto Carvajal 20 (2026-03-30),
  Luciano Cruz-Coke 19, Alfonso De Urresti 18, Irací Hassler 18.
- `pnpm --filter @obs/probidad test` → 34 passed; typecheck limpio.

## Deviations from Plan

- **Match TARGETED token-superset** (no la `reconciliarDeclarante` difusa existente): InfoProbidad
  trae segundos nombres + hermanos homónimos → el superset targeted es la solución determinista correcta.
- **bienes/familiares=0:** la query SPARQL de Phase 12 no trae el detalle de bienes (solo metadata de
  declaración). El goal (versiones + fecha de presentación) se cumple; bienes detallados diferidos.

## Hand-off

- Phase 32: verificación en prod de la sección patrimonio poblada.
- Re-corridas: `tsx run-probidad-todos-cli.ts` (idempotente, versionado por clave de versión).
- Futuro: ampliar la query SPARQL para traer bienes/familiares detallados.

## Self-Check: PASSED
