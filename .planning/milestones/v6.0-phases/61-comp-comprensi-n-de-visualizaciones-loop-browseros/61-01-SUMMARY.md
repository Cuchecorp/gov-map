---
phase: 61
plan: "01"
subsystem: frontend/components
tags: [comprehension, leyenda, charts, COMP-01, COMP-03]
dependency_graph:
  requires: []
  provides: [COMP-01-leyenda-cruces, COMP-03-triple-requisito]
  affects: [cruces-de-parlamentario, cruces-de-proyecto, patrimonio-chart, votos-chart, ausencias-contexto, red-graph]
tech_stack:
  added: []
  patterns: [always-visible-legend, question-title-h3, source-footer]
key_files:
  created: []
  modified:
    - app/components/cruces-de-parlamentario.tsx
    - app/components/cruces-de-parlamentario.test.tsx
    - app/components/cruces-de-proyecto.tsx
    - app/components/cruces-de-proyecto.test.tsx
    - app/components/patrimonio-de-parlamentario.tsx
    - app/components/votos-por-parlamentario.tsx
    - app/components/ausencias-contexto.tsx
    - app/components/red/red-graph.tsx
    - app/components/ausencias-contexto.test.tsx
    - app/components/votos-por-parlamentario.test.tsx
decisions:
  - "Bloque 'Cómo leer esto' implementado como componente puro ComoLeerCruces renderizado en ambas secciones de cruces (parlamentario y proyecto), siempre visible"
  - "Redacción anti-causal usa 'no establece relación' en vez de términos del banned-vocab, logrando que el linter inline quede verde"
  - "Títulos pregunta en h3 semántico (no h2) para mantener jerarquía de página"
  - "Fuente al pie de VotosChart y AusenciasContexto como <p> de texto plano; RedGraph usa bloque integrado con la leyenda"
metrics:
  duration_minutes: 25
  completed_date: "2026-07-09"
  tasks_completed: 3
  files_modified: 10
---

# Phase 61 Plan 01: Leyenda cruces + triple-requisito charts — Summary

**One-liner:** Bloque "Cómo leer esto" anti-causal siempre visible en ambas secciones de cruces, y triple-requisito título-pregunta/leyenda-unidad/fuente-fecha completado en los 4 charts auditados.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Leyenda cruces parlamentario (COMP-01) | 539e0fd | cruces-de-parlamentario.tsx + test |
| 2 | Leyenda cruces proyecto (COMP-01) | 680cba8 | cruces-de-proyecto.tsx + test |
| 3 | Triple-requisito charts (COMP-03) | 683d246 | patrimonio-de-parlamentario, votos-por-parlamentario, ausencias-contexto, red-graph + tests |

## COMP-03: Auditoría antes/después

| Chart | Shell file | (a) Título-pregunta | (b) Leyenda+unidad | (c) Fuente+fecha |
|-------|-----------|---------------------|-------------------|------------------|
| PatrimonioChart | patrimonio-de-parlamentario.tsx | FALTA → `<h3>¿Cuántos bienes declaró por año?</h3>` | Recharts Legend + caveat unidad ya presentes | AtribucionCcBy ya presente |
| VotosChart | votos-por-parlamentario.tsx | "Cuándo votó" → `¿Cuándo votó?` | Recharts Legend ya presente | FALTA → `<p>Fuente: Cámara/Senado…</p>` |
| AusenciasContexto | ausencias-contexto.tsx | "Ausencias en contexto" → `¿Falta más o menos que la mediana de su cámara?` | texto con % + mediana ya presente | FALTA → `<p>Fuente: Cámara/Senado…</p>` |
| RedGraph leyenda | red/red-graph.tsx | Faltaba visible title | FALTA → bloque leyenda nodo/arista/layout | FALTA → incorporado en bloque leyenda |

**Estado final:** 0 gaps restantes en los 4 charts.

## COMP-01: Contenido del bloque "Cómo leer esto"

Tres puntos en ambas secciones de cruces (parlamentario y proyecto):
1. Qué es una señal: conteo factual de reuniones de lobby registradas bajo Ley 20.730, agrupadas por sector.
2. Cómo leer el conteo: más registros = más actividad documentada, nada más.
3. Qué no establece: la sección solo muestra hechos públicos coincidentes, cada uno con su fuente; no establece relación entre la reunión y ninguna otra actuación.

Vocabulario verificado: ningún término del regex PROHIBIDO en el DOM del bloque.

## Deviations from Plan

None - plan executed exactly as written.

## Suite

- Tests: 738 passed (0 failed), incluyendo 8 nuevos tests para COMP-01 (4 por sección de cruces).
- `pnpm tsc -b`: sin errores.
- Linter inline (PROHIBIDO regex en tests): verde en todas las suites.

## Self-Check: PASSED

- `539e0fd` existe en git log: FOUND
- `680cba8` existe: FOUND
- `683d246` existe: FOUND
- app/components/cruces-de-parlamentario.tsx modificado: FOUND
- app/components/red/red-graph.tsx modificado: FOUND
