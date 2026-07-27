# Phase 109: INTEG P3 — Integrar CLASIFICACIÓN tras golden gate verde - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning
**Mode:** Integration phase. Decisiones LOCKED por el rector `.planning/PROMPT-v11.0-PASADA2.md` §109 + derivadas por EVIDENCIA del veredicto DEFINITIVO full-40 (`107-VEREDICTO-LIVE-FULL-2026-07-27.md`) y del scout de código. Sin grey-areas nuevas — el operador ya resolvió el diseño ("no re-preguntar").

<domain>
## Phase Boundary

Probar el patrón completo de la escalera (Fase 108) en producción de pipeline sobre UNA tarea reversible y no-legal — **CLASIFICACIÓN** — con la red de seguridad (provider-guard + golden gate CI + rollback por config + shadow-eval + canario de drift) como primer commit. Reversible por config: apagar la escalera = incumbente DeepSeek, sin migración ni deploy especial.

**ENTRA:** swap del punto de construcción del provider en el CLI de clasificación de fichas (`packages/cruces/src/clasificar-fichas-cli.ts:200`) de `new DeepSeekProvider(...)` → `new TieredProvider(...)` con la escalera de la tarea `clasificacion`; provider-guard (zod+PII, enumera TODOS los providers) como PRIMER COMMIT; golden de clasificación como regresión CI PERMANENTE; shadow-eval ON; guard estático que MUERDE bloqueando `adjudicacion.*` y la extracción strict-schema; rollback por config; canario de drift del endpoint.

**NO ENTRA:** routing (NO aprobado — flipeó a incumbent-stays en el full-40); extracción de idea-matriz (`fichas/src/pipeline-cli.ts`, VETADA es-CL — se queda DeepSeek); adjudicación de identidad (`clasificar-lobby-cli.ts` usa MiniMax; golden-1263 INTOCABLE e INOBSERVADA); flip productivo de "promover" la escalera a routing-vivo Granite (eso es un config-flip posterior, gated por shadow-eval — el agente NO promueve a live, deja default=incumbente).
</domain>

<decisions>
## Implementation Decisions (LOCKED / evidence-derived)

### Tarea y punto de integración (derivado por EVIDENCIA)
- La ÚNICA tarea aprobada por el veredicto DEFINITIVO full-40 es **clasificación** (paridad EXACTA Δ0.0000 Granite vs DeepSeek). routing quedó FUERA (flipeó a incumbent-stays Δ−0.10). extracción VETADA (es-CL).
- Target = `packages/cruces/src/clasificar-fichas-cli.ts:200` — su incumbente HOY es `new DeepSeekProvider(...)`, que es EXACTAMENTE el incumbente contra el que el veredicto midió Granite. Match apples-to-apples.
- **NO** tocar `clasificar-lobby-cli.ts:190** (construye `MiniMaxProvider` — el modelo de adjudicación, sensible; su incumbente NO es DeepSeek, no fue lo medido). **NO** tocar `fichas/src/pipeline-cli.ts` (extracción strict-schema, VETADA; su prompt-cache DeepSeek vive ahí).

### Escalera y default de ruteo
- La escalera de `clasificacion` usa **Granite@WorkersAI** como tier candidato y **DeepSeek incumbente** como fallback/escalón (config declarativa de 108, `task-ladder.ts`).
- **Default de ruteo = INCUMBENTE (DeepSeek).** El agente integra la escalera WIRED pero NO la "promueve" a routing-vivo Granite: shadow-eval ON primero. Encender la escalera es un config-flip reversible posterior (documentado), no un acto del agente. Esto respeta "shadow-evaluation ON antes de promover" + "rollback trivial: apagar la escalera vuelve al incumbente por config".

### Red de seguridad (orden LOCKED)
1. **PRIMER COMMIT = provider-guard** (patrón lockdown-guard-first v10.0): wrapper zod+PII que ENUMERA TODOS los providers y FALLA (CI) si alguno carece del wrapper zod+PII. RUT jamás cruza a un LLM.
2. **Golden de clasificación como regresión CI PERMANENTE** — el golden set de la tarea corre en CI como gate que muerde (no solo el congelado; medido también sobre la distribución viva vía shadow-eval).
3. **Guard estático que MUERDE** — bloquea que la escalera toque `adjudicacion.*` y la extracción strict-schema (`pipeline-cli.ts`). Enumera proveedores; falla si la escalera se cablea en un sitio prohibido.
4. **Shadow-eval ON** antes de promover — corre candidato en sombra, compara contra incumbente, sin afectar la salida productiva.
5. **Rollback por config** — apagar la escalera = incumbente, sin migración/deploy.
6. **Canario de drift del endpoint** — detecta si el endpoint servido cambia (Granite@WorkersAI) para no confiar en números viejos.

### Reglas LOCKED de siempre
- RUT jamás cruza a un LLM (`assertNoRutInLlmInput` user+system+context). `response_format json_schema` JAMÁS asumido (Granite=tool_choice forzado). Adjudicación (golden-1263) INTOCABLE e INOBSERVADA. Migraciones (si hubiera) por `psql --single-transaction`, NUNCA `db push`. Secrets nuevos solo en `.env` + placeholder en `.env.example`. Ante la duda SIEMPRE calidad.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (de 108)
- `packages/llm/src/tiered.ts` — `TieredProvider` (decorador drop-in, cascada acotada, telemetría payload-free, RUT-guard en el hop del juez, budget enforced).
- `packages/llm/src/task-ladder.ts` — `TierSpec`/`LadderConfig`/`buildTieredProvider` (config declarativa tarea→escalera).
- `packages/llm/src/telemetry.ts` — sink payload-free (noop + jsonl).
- `packages/llm/src/providers/` — `DeepSeekProvider`, `GraniteProvider` (los dos tiers de la escalera de clasificación).
- `packages/llm/src/test-mock.ts` — MockProvider/MockJudgeProvider para tests offline del wiring.

### Integration Points
- `packages/cruces/src/clasificar-fichas-cli.ts:200` — el swap `new DeepSeekProvider(...)` → `new TieredProvider(...)` (drop-in; el cuerpo del CLI NO cambia).
- `packages/cruces/src/golden/golden-set.ts` + `golden-set.test.ts` + `casos.json` — el golden de cruces (base del gate CI de regresión de clasificación).
- `packages/llm-bench/src/tasks/clasificacion/` — el golden es-CL congelado + scorer (fuente del veredicto; referencia para shadow-eval).

### Guard patterns (precedente)
- Patrón lockdown-guard-first v10.0 + guards CI que muerden (memoria: PII gate escanea `app/` por `.from` PII / `.rpc` no-allowlist). El provider-guard de 109 sigue ese molde: source-scan que enumera providers y falla fail-loud.
</code_context>

<specifics>
## Specific Ideas

- Componentes: NET-NEW (provider-guard test/CI + golden-regresión CI de clasificación + shadow-eval harness + canario de drift) + MODIFICADO (una línea de construcción en `clasificar-fichas-cli.ts`).
- Integración testeable OFFLINE con MockProvider donde sea posible; la parte LIVE (shadow-eval real contra Granite@WorkersAI) usa las keys de `.env` YA presentes y funcionando (Workers AI + DeepSeek), LIVE-gated (nunca CI), skip-limpio sin keys.
- INTEG-01/02/03 los cubren estos entregables. Requisitos: INTEG-01 (clasificación con escalera + golden CI + shadow-eval), INTEG-02 (extracción/adjudicación intactas + guard que muerde), INTEG-03 (rollback por config + drift canary).
</specifics>

<deferred>
## Deferred Ideas

- "Promover" la escalera a routing-vivo Granite en producción (config-flip) → gated por shadow-eval verde; acto posterior, documentado; el agente deja default=incumbente.
- routing (no aprobado) y cualquier re-evaluación de extracción → fuera; DeepSeek se queda por evidencia.
- Phi-juez-sobre-identidad y observación de adjudicación → DIFERIDO a v2.
</deferred>
