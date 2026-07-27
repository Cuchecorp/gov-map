# Phase 107: BENCH P1b — Adapters candidatos + juez vs humanos + VEREDICTO por tarea - Context

**Gathered:** 2026-07-26
**Status:** Ready for planning
**Mode:** Smart-discuss (autónomo) — frame operador-LOCKED; checkpoint de credenciales SURFACEADO (ver §credentials)

<domain>
## Phase Boundary

Producir el VEREDICTO empírico POR TAREA que autoriza (o veta) cada integración de la capa
escalonada. Entrega: (1) adapters `GraniteProvider` + `PhiJudge` que implementan las interfaces
enchufables clonando el patrón `MiniMaxProvider` (tool_choice forzado + match POR NOMBRE + zod +
repair loop + guards fail-closed IDÉNTICOS), host-agnósticos por baseURL; (2) medición del juez Phi
contra etiquetas HUMANAS (golden juez de 106) con métricas de sesgo; (3) el VEREDICTO por tarea con
ε explícito — qué modelo aprueba qué tarea, cuáles quedan en su incumbente. NADA se autoriza a
integrar sin su gate verde. Un "nada aprueba paridad" es un resultado VÁLIDO.

FUERA de alcance: la plomería `TieredProvider`/config/telemetría (108), la integración de una tarea
real (109). La adjudicación de identidad (MiniMax, golden-1263) NI SE TOCA NI SE OBSERVA (LOCKED).
</domain>

<credentials>
## Checkpoint de credenciales (SURFACEADO al operador 2026-07-26 — asked once)

El benchmark LIVE de los CANDIDATOS requiere credenciales AUSENTES del `.env` (verificado: solo
existen DEEPSEEK_API_KEY nativa `sk-…`, MINIMAX_API_KEY nativa, GEMINI_API_KEY; NO hay token
OpenRouter `sk-or-…`, NO hay WORKERS_AI_API_TOKEN, NO hay CLOUDFLARE_ACCOUNT_ID). El operador creyó
tener una key OpenRouter en el env; la búsqueda exhaustiva (todos los .env + prefijos de cada key)
la desmiente.

DECISIÓN LOCKED de esta fase: se construye TODO lo no-bloqueado (adapters + guards + máquina de
VEREDICTO + tests verdes con MockProvider), y el VEREDICTO LIVE queda PENDIENTE de provisión. Para
correrlo el operador agrega a `.env` (NUNCA a `.env.example`, que lleva placeholder sin valor):
- `WORKERS_AI_API_TOKEN` = Cloudflare API token con permiso Workers AI (candidato PRIMARIO Granite),
- `CLOUDFLARE_ACCOUNT_ID` = id de cuenta CF (baseURL `https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1`, modelo `@cf/ibm-granite/granite-4.0-h-micro`),
- `OPENROUTER_API_KEY` = key `sk-or-…` (Phi-4-mini `microsoft/phi-4-mini-instruct`; y fallback baseURL-swap de Granite).
El agente JAMÁS carga valores de secreto. Checkpoint sin provisión = handoff documentado, la corrida CIERRA igual (patrón v7/v9/v10).
</credentials>

<decisions>
## Implementation Decisions

### Adapters (TIER-01) — LOCKED
- `GraniteProvider implements LLMProvider`: clona `MiniMaxProvider` EXACTO — openai@5 + baseURL (cero
  SDK nuevo), `fetchFn` inyectable (para instrumentedFetch de 106), tool_choice FORZADO sobre una
  function única, match del tool_call POR NOMBRE (jamás posición), validación EXTERNA vía
  `parseAndValidate` (repair loop). `max_tokens` EXPLÍCITO (default Workers AI = 256 → se fija alto
  explícito; Pitfall). `trainsOnInputs` = registrado según postura no-train/DPA del host (Workers AI
  DPA para el gate; hasta confirmar = conservador). Guards fail-closed por construcción IDÉNTICOS:
  `assertNoRutInLlmInput(user/system)` + `assertSensitivityAllowed`.
- `PhiJudge` en interfaz `JudgeProvider` SEPARADA (no es un responder): recibe (pregunta/respuesta a
  juzgar) y devuelve un `Verdict{ok, reason?, confidence?}` validado por zod. Phi ALUCINA nombres de
  función → match tool_call POR NOMBRE obligatorio. Mismos guards fail-closed. Determinista (temp≈0).
  El juez es ESCALATE-ONLY conceptualmente (108 lo cablea); en 107 solo se MIDE su capacidad.
- Host-agnóstico: baseURL configurable → Workers AI primario, OpenRouter fallback (baseURL-swap), Phi
  por OpenRouter. Ambos adapters testeables con MockProvider/fetch fake SIN red (CI verde sin keys).

### Juez vs humanos (BENCH-04) — LOCKED
- Phi se mide contra las etiquetas HUMANAS del golden juez de 106 (pares answer/human_label), NUNCA
  contra el responder. Accuracy condicional (precision_ok + recall_de_rechazo) + los hooks de sesgo
  ya presentes (self-preference/posición/verbosidad) se EJERCEN en la corrida LIVE. Datos NO-PII.
- La corrida Phi-vs-humano es LIVE (necesita el endpoint Phi). En CI se prueba el ADAPTER (mock) y la
  MÁQUINA de scoring (ya en 106); los NÚMEROS de Phi son del bloque LIVE gated (nunca en CI).

### VEREDICTO por tarea (BENCH-05) — LOCKED
- Máquina de veredicto: por cada tarea (routing, clasificación, juez, paridad-extracción) compara el
  Reporte del CANDIDATO vs el INCUMBENTE con un ε de paridad DECLARADO explícito por métrica (calidad
  Δ ≤ ε, y no-peor en zod-fail-rate / structured-output-fail-rate). Salida: {tarea → modelo aprobado
  | incumbente-se-queda | pending-evidence}. DEBE poder expresar "nada aprueba paridad".
- VETO DURO: cualquier déficit en es-CL (fidelidad/negación legal) veta esa tarea para el candidato,
  sin importar métricas agregadas; los benchmarks en inglés son IRRELEVANTES y no influyen.
- La máquina es PURA y testeable (fixtures de Reporte sintéticos) — el veredicto se computa sin red.
  Con credenciales, una corrida LIVE llena los Reportes reales y emite el veredicto definitivo.
- Extracción (strict-schema) se espera que NO apruebe a 3B (se queda DeepSeek) — el veredicto lo
  DEMUESTRA, no lo asume. Adjudicación intocable: ningún veredicto la contempla.

### Reglas LOCKED de siempre
- `response_format: json_schema` JAMÁS asumido (tool_choice forzado + zod por proveedor).
- RUT jamás cruza a un LLM: guard por construcción en Granite/Phi (mismos asserts que MiniMax) — test que MUERDE.
- Secrets nuevos solo en `.env`; `.env.example` lleva placeholder SIN valor (guard env-example verde).
- Suite verde al cierre: app 1428 + packages + tsc 0 + guards. Los adapters/veredicto suman tests verdes (mock).

### Claude's Discretion
- Nombres/forma de `JudgeProvider`/`Verdict`, estructura de la máquina de veredicto y su tipo de salida,
  el valor exacto de ε por métrica (declarado y justificado), y la forma del artefacto de veredicto — dentro del frame.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/llm/src/providers/minimax.ts` — TEMPLATE EXACTO del adapter (tool_choice forzado, match por
  nombre, guards, repair loop, fetchFn). Granite/Phi lo clonan.
- `packages/llm/src/{validate.ts,json-schema.ts,data-routing.ts,types.ts}` — parseAndValidate (+ el
  `onValidationOutcome` aditivo de 106), zodToToolSchema, assertNoRutInLlmInput/assertSensitivityAllowed, LLMProvider.
- `packages/llm-bench/` — el instrumento de 106: instrumentedFetch, Reporte (métricas separadas), los
  cuatro scorers (routing/clasificación/juez/extracción), el driver `correrHarness`, el golden juez con
  hooks de sesgo. La máquina de veredicto se AÑADE aquí (fuera del runtime). Baseline LIVE DeepSeek/MiniMax ya existe.
- `packages/adjudication/` — INTOCABLE (referencia de escala solamente).

### Established Patterns
- CI mock/no-red; LIVE env-gated non-CI (`(LIVE ? describe : describe.skip)` + `it.skipIf(!KEY)`).
- Guards que MUERDEN como tests estáticos. Monorepo pnpm, tsc -b references.

### Integration Points
- Los adapters candidatos viven en `packages/llm/src/providers/` (Granite responder) — pero PhiJudge
  puede vivir donde la interfaz JudgeProvider se defina (llm o llm-bench según acoplamiento; 108 la usa).
- La máquina de veredicto + la corrida LIVE de candidatos viven en `packages/llm-bench/`.
- `.env` nuevas keys → checkpoint operador (arriba). El adapter lee la key por opción de constructor, jamás la imprime.
</code_context>

<specifics>
## Specific Ideas

- Números Ollama-local NO transfieren al host servido (Pitfall 9) — el veredicto SOLO vale contra el
  endpoint servido real (Workers AI/OpenRouter). Hasta que corra LIVE, el veredicto es "pending-evidence".
- Registrar la postura no-train/DPA del host para el gate `trainsOnInputs` (Workers AI DPA) — dato de provisión.
- `max_tokens` explícito en Granite (default 256 truncaría salidas).
</specifics>

<deferred>
## Deferred Ideas

- `TieredProvider` + config escalera + telemetría → Phase 108.
- Integrar una tarea real tras gate verde → Phase 109.
- Phi-juez-sobre-identidad → v2 (adjudicación intocable/inobservada).
- Corrida LIVE del veredicto de candidatos → PENDIENTE provisión de credenciales (handoff documentado).
</deferred>
