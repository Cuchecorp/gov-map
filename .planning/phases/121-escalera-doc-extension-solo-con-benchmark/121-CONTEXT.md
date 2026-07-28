# Phase 121: ESCALERA-DOC — Extensión solo con benchmark - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — fase DOC pura; evidencia = veredicto full-40 v11.0 (be0b1b9) + 120-FLIP-RECORD.md

<domain>
## Phase Boundary

Un documento único que registra, tarea LLM por tarea LLM (routing, clasificación, juez, extracción, adjudicación), el estado extendida/no-extendida de la escalera con la evidencia de benchmark que lo respalda — de modo que nadie la extienda por intuición. Cero código: solo el documento + su verificación de cierre. Regla LOCKED: ante la duda, SIEMPRE calidad.

</domain>

<decisions>
## Implementation Decisions

### Estados por tarea (evidencia del veredicto full-40 2026-07-27, be0b1b9, + Phase 120)
- **Clasificación: EXTENDIDA (ON desde 2026-07-28)** — única APPROVED en full-40; encendida en 120 tras orden DURO (canary PASS modelo pinneado, shadow 8/8 sobre los 8 casos ficha comparables, rollback probado en vivo). Justificante: `120-FLIP-RECORD.md`.
- **Routing: NO extendida** — full-40 FLIPEÓ a incumbent-stays (la muestra de 10 daba approved; el full-40 lo revirtió — ejemplo canónico de por qué muestra chica no basta).
- **Extracción: NO extendida** — VETADA por es-CL (veto de negación.accuracy sobre el veredicto; strict-schema INTOCABLE además por integ-scope/provider-guard).
- **Juez: NO extendida** — Phi juez BENCH-04 recall 0.917: prometedor pero ESCALATE-ONLY como está; sin benchmark de paridad para promover.
- **Adjudicación de identidad: INTOCABLE por decisión explícita** — no por omisión: decisión de diseño v11.0 (SEED-001), RUT jamás cruza a un LLM ajeno al pipeline aprobado, MiniMax para lo crítico/sensible. No es candidata a benchmark de extensión.

### Qué evidencia haría falta para extender cada pendiente (sección obligatoria por tarea)
- Routing: nuevo full-40 (o mayor) con routing ganando en TODAS las métricas separadas, sin flip entre muestra y full.
- Extracción: benchmark es-CL con negación.accuracy ≥ incumbente en set congelado + strict-schema validado (zod), manteniendo el veto es-CL como gate.
- Juez: benchmark de paridad juez-vs-juez con recall ≥ actual y falsos ESCALATE no peores; mientras tanto ESCALATE-ONLY.
- Adjudicación: N/A — INTOCABLE; cualquier cambio requeriría decisión de operador + dossier, no benchmark.

### Formato
- `121-ESCALERA-ESTADO.md` en el phase dir: tabla maestra (tarea × estado × evidencia con cita a archivo/commit × qué-haría-falta), secciones por tarea, régimen de guards (integ-scope, provider, tiered-scope), y el drift-canary como condición de vigencia CONTINUA del estado de clasificación (si el modelo servido cambia, el veredicto se invalida y el estado vuelve a evaluarse).
- Citas verificables: 107-VEREDICTO-LIVE-FULL-2026-07-27.md (milestones v11.0), be0b1b9, 120-FLIP-RECORD.md, recall 0.917 BENCH-04.
- Verificación de cierre por grep (patrón 118): 5 tareas × estado explícito, 0 secretos, cada estado con ≥1 cita.

### Claude's Discretion
- Estructura fina del documento; si agrega un cuadro de riesgos (drift, es-CL) o lo integra por sección.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `milestones/v11.0-phases/107-*/107-VEREDICTO-LIVE-FULL-2026-07-27.md` (veredicto full-40 — buscar ruta real), `109-*` (integración ESCALATE-ONLY, telemetría payload-free), `120-FLIP-RECORD.md`.
- Guards en `packages/llm/src/`: integ-scope-guard, provider-guard, tiered-scope-guard (7 tests).

### Established Patterns
- Documento auditable con verificación por grep (118/119); honestidad: divergencias y límites declarados.

### Integration Points
- Consumido por E2E 125 y por cualquier milestone futuro que quiera extender la escalera.

</code_context>

<specifics>
## Specific Ideas

- El flip de routing entre muestra-10 y full-40 merece su propio recuadro: es LA lección de por qué "extensión solo con benchmark".
- Registrar también la condición de vigencia: drift canary re-ejecutable; mismatch de modelo servido invalida el estado EXTENDIDA de clasificación.

</specifics>

<deferred>
## Deferred Ideas

- Cualquier benchmark nuevo para extender tareas → milestone futuro.

</deferred>
