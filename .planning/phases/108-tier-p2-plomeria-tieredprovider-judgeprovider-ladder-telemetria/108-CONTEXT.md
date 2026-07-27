# Phase 108: TIER P2 — Plomería `TieredProvider` + `JudgeProvider` + ladder config + telemetría - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning
**Mode:** Infrastructure phase (plomería) — grey areas skipped; decisiones LOCKED en el rector `.planning/PROMPT-v11.0-PASADA2.md` §108 y ROADMAP §108. Toda elección de implementación es discreción de Claude DENTRO de esas invariantes.

<domain>
## Phase Boundary

Cablear la cascada **respond→validate→escalate** como composición sobre la capa enchufable `@obs/llm`, testeable determinísticamente con `MockProvider` ANTES de tocar cualquier tarea viva (eso es 109). SOLO plomería + tests con mock — NO integrar ninguna tarea de producción, NO llamadas de red nuevas, NO keys nuevas.

**ENTRA:** `TieredProvider` (decorador que `implements LLMProvider`), `JudgeProvider` (interfaz SEPARADA, ESCALATE-ONLY), config declarativa tarea→escalera (`task-ladder.ts`), telemetría por llamada sin payload/PII (`telemetry.ts` sink noop + JSONL), campo `CompletionRequest.task` ADITIVO retro-compatible.

**NO ENTRA:** swap de ningún CLI a `TieredProvider` (109), integración productiva, provider-guard que muerde en CI (109), red real, medición live.
</domain>

<decisions>
## Implementation Decisions (LOCKED por el rector — no re-preguntar)

### TieredProvider (decorador drop-in)
- `TieredProvider implements LLMProvider` — decorador en el PUNTO DE CONSTRUCCIÓN del CLI; los cuerpos de consumidores NO cambian. El router existente `selectProvider`/`loadRouterConfigFromEnv` es DEAD CODE — NO usarlo, NO revivirlo.
- `CompletionRequest.task` es ADITIVO y OPCIONAL: **ausencia de `task` reproduce el comportamiento actual BYTE-POR-BYTE** (test de regresión que lo pruebe). Retro-compatibilidad es criterio de aceptación #1.
- Cascada ACOTADA: respond (tier base) → validate (zod/juez) → escalate (siguiente tier). **1 hop por tier, presupuesto máximo por ítem, estado terminal = revisión humana. SIN loops.** Escalación disparada por veredicto de juez o fallo zod — NUNCA por auto-confianza del modelo chico (miscalibrada).
- Ruteo ENTRE pipelines, JAMÁS mid-sesión: el prompt-cache DeepSeek de fichas queda intacto (verificable: `prompt_cache_hit_tokens` no regresiona). La escalera se fija al construir el pipeline, no cambia de modelo a mitad de una corrida.

### JudgeProvider (interfaz SEPARADA, ESCALATE-ONLY)
- Interfaz SEPARADA de `LLMProvider` (ya existe `judge.ts` con `JudgeProvider`/`Verdict` de 107 — componer sobre ella, no duplicar).
- **ESCALATE-ONLY: el juez puede escalar/rechazar, JAMÁS aprobar ni suavizar una compuerta.** Un juez débil que aprueba = teatro de validación. Sus veredictos quedan registrados ESTRUCTURADOS para auditabilidad.

### Telemetría (sin payload / sin PII)
- Por llamada: modelo, tarea, latencia, costo, veredicto, escalación. **NUNCA payload ni PII en logs.** Reusar el `onValidationOutcome`/`ValidationOutcome` ADITIVO de 107 (`validate.ts`) + el patrón del sink payload-free de `llm-bench`.
- Sink por defecto NOOP (no escribe nada salvo que se configure); variante JSONL opcional payload-free.

### Reglas LOCKED de siempre (aplican a TODO escalón/adapter nuevo)
- RUT jamás cruza a un LLM (`assertNoRutInLlmInput` sobre user+system+context — patrón 107 idéntico). `response_format json_schema` JAMÁS asumido (tool_choice forzado O prompt-forced+zod por proveedor). Identidad fail-closed. **Adjudicación (golden-1263) INTOCABLE e INOBSERVADA este milestone.**
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/llm/src/judge.ts` — `JudgeProvider`/`Verdict` interfaz de 107 (base para el cableado ESCALATE-ONLY).
- `packages/llm/src/validate.ts` — `parseAndValidate` + contrato aditivo `CompletionRequest.onValidationOutcome`/`ValidationOutcome` (107) → gancho de telemetría sin payload.
- `packages/llm/src/types.ts` — `LLMProvider`/`CompletionRequest` (aquí va el campo `task` aditivo).
- `packages/llm/src/providers/` — `DeepSeekProvider`, `MiniMaxProvider`, `GraniteProvider`, `PhiJudge` (los tiers concretos que la escalera compone).
- `packages/llm-bench/src/mock-provider.ts` + `packages/adjudication/src/…/mock-provider.ts` — `MockProvider` para testear la escalera SIN red (patrón de aceptación).

### Established Patterns
- Router `selectProvider`/`loadRouterConfigFromEnv` (`router.ts`) = DEAD CODE; el seam real es el decorador en el sitio de construcción.
- Guards fail-closed idénticos entre adapters (`assertNoRutInLlmInput`, `assertSensitivityAllowed`).
- Instrumentación vía hook `fetchFn` (llm-bench) + `onValidationOutcome` (llm) — telemetría sin tocar el cuerpo del provider.

### Integration Points (para 109, NO tocar en 108)
- `packages/cruces/src/clasificar-lobby-cli.ts` + `clasificar-fichas-cli.ts` — sitios de construcción de la tarea CLASIFICACIÓN (la única aprobada por el veredicto full-40); 109 hace el swap `new DeepSeekProvider(...)` → `new TieredProvider(...)` ahí.
- `packages/fichas/src/pipeline-cli.ts` — extracción, SE QUEDA DeepSeek (NO tocar; el prompt-cache vive aquí).
</code_context>

<specifics>
## Specific Ideas

- Componentes NET-NEW: `tiered.ts` (decorador), `task-ladder.ts` (config declarativa), `telemetry.ts` (sink noop+JSONL). MODIFICADO aditivo: `CompletionRequest.task` en `types.ts`.
- Insumo del veredicto DEFINITIVO full-40 (`107-VEREDICTO-LIVE-FULL-2026-07-27.md`): la escalera de la tarea CLASIFICACIÓN usará Granite@WorkersAI como tier candidato con DeepSeek incumbente como fallback/escalón — pero eso se CONFIGURA/INTEGRA en 109; 108 solo prueba el mecanismo con `MockProvider`.
- 100% testeable con `MockProvider`, SIN keys nuevas (criterio de aceptación).
</specifics>

<deferred>
## Deferred Ideas

- Swap productivo de un CLI a `TieredProvider` + provider-guard que muerde en CI + shadow-eval + canario de drift → **Phase 109**.
- Phi-juez-sobre-identidad y cualquier observación de la adjudicación → DIFERIDO a v2 (fuera del milestone).
</deferred>
