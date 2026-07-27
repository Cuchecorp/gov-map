# Phase 106: BENCH P1a — Harness llm-bench + golden sets es-CL POR TAREA (SPIKE, gate duro) - Context

**Gathered:** 2026-07-26
**Status:** Ready for planning
**Mode:** Smart-discuss (autónomo) — frame operador-LOCKED, auto-aceptado; resto = discreción de Claude dentro del frame

<domain>
## Phase Boundary

Construir el INSTRUMENTO DE MEDICIÓN que gobierna toda decisión de escalonamiento del milestone:
un paquete `packages/llm-bench` (FUERA de la lib de runtime `@obs/llm`) + golden sets es-CL NUEVOS
POR TAREA (routing, clasificación, juez/validación, paridad-extracción), estratificados del corpus
REAL, sin leakage, CONGELADOS antes de integrar. El harness mide y reporta como métricas de PRIMERA
CLASE SEPARADAS: calidad (por tarea), latencia p50/p95, costo/1k, y tasa de fallo zod/structured-
output. En 106 se BASELINEAN los incumbentes de hoy (DeepSeek V4, MiniMax) que ya tienen keys.

FUERA de alcance (va en 107): los adapters candidatos Granite/Phi, el benchmark contra el endpoint
Workers AI/OpenRouter REAL, el juez Phi vs etiquetas humanas, y el VEREDICTO por tarea. 106 = el
instrumento + los sets + el baseline; 107 = correr los candidatos por el instrumento y dictaminar.
La adjudicación de identidad (MiniMax, golden-1263) NI SE TOCA NI SE OBSERVA (LOCKED operador).
</domain>

<decisions>
## Implementation Decisions

### Frame LOCKED del operador (rectora, NO re-preguntar)
- Ante la duda, SIEMPRE calidad. El escalonamiento optimiza latencia/costo SOLO donde el benchmark
  demuestra paridad. DeepSeek se queda donde luce.
- Harness VIVE FUERA del runtime (`packages/llm-bench`, nunca dentro de `@obs/llm`) — el código de
  medición jamás se enlaza al camino de producción.
- Golden sets NUEVOS por tarea, es-CL, estratificados del corpus REAL, SIN leakage al prompt (pools
  de ejemplo/eval disjuntos), CONGELADOS antes de cualquier integración (precedente golden 32/1263:
  el set se congela ANTES del schema).
- Métricas de PRIMERA CLASE, SEPARADAS: calidad (por tarea) + latencia p50/p95 + costo/1k + tasa de
  fallo zod/structured-output. Omitir la de zod sobre-recomienda modelos chicos → es obligatoria.
- BENCH-03: medir contra el endpoint/cuantización EXACTOS de producción. En 106 el baseline corre
  contra DeepSeek/MiniMax reales (sus keys existen); la medición de latencia/costo de candidatos en
  su host servido es de 107. Ollama-local (si está) = spike de CALIDAD; jamás transfiere latencia/
  costo del host servido (Pitfall 9).

### Arquitectura del harness (discreción dentro del frame)
- Espejar la ESTRUCTURA del golden existente (`packages/cruces/src/golden/golden-set.ts`,
  `packages/fichas/src/golden/`): `CasoGolden[]` cargado de `casos.json` validado por zod al leer,
  `evaluar(set, ejecutar)` → `Metricas`, `gatePasa()`. GENERALIZAR a multi-tarea + multi-métrica.
- Patrón CI vs LIVE (LOCKED precedente): en CI el `ejecutar` usa `MockProvider` (sin red, determinista);
  el bloque LIVE cambia el mock por el provider real y NO corre en CI (evita gasto/flakiness/no-determinismo).
  El harness produce un REPORTE (JSON + tabla legible) — no un veredicto automático de merge en 106.
- Scoring POR TAREA (el modo de fallo difiere por tarea — precedente cruces vs fichas):
  - **routing**: single-label top-1 (¿qué tarea/tier es este input?) — cobertura + errores, abstención first-class.
  - **clasificación**: single-label top-1 + abstención (idéntico a cruces sector).
  - **juez/validación**: en 106 se DEFINE el set y el scoring (accuracy condicional vs etiqueta) — la
    medición Phi-vs-humano y sesgos (self-preference/posición/verbosidad) es de 107; 106 deja el
    instrumento y las etiquetas humanas listas y CONGELADAS.
  - **paridad-extracción**: separar schema-parse-rate (¿parseó?) de field-value accuracy (¿el valor
    es correcto?) — NUNCA colapsarlas (Cleanlab/Pitfall: son cosas distintas). Métrica de fidelidad
    literal + negación es-CL (el modo de fallo de extracción es fabricar/alucinar texto).
- Métricas separadas en el tipo de reporte: `{ calidad_por_tarea, latencia_p50, latencia_p95,
  costo_por_1k, zod_fail_rate, structured_output_fail_rate }`. Latencia se muestrea por-llamada; p50/p95
  de la distribución de la corrida. Costo/1k derivado de tokens_in/out × tarifa declarada por modelo
  (tabla de tarifas versionada en el repo, con fecha — pricing MEDIUM-confidence, se re-verifica en 107).

### Golden sets es-CL (discreción dentro del frame)
- Fuente = corpus REAL ya en el proyecto (idea_matriz de fichas, sectores de cruces, tramitaciones,
  citaciones) — NO texto inventado. Estratificar por eje que expone el modo de fallo: formato de doc
  (XML limpio vs PDF escaneado), registro legal (fórmula arcaica vs moderna), largo, cámara.
- Etiquetas por el patrón D-06 del proyecto: LLM-propone + HUMANO-valida es el golden. Donde ya existe
  etiqueta de oro (cruces sector, adjudicación), reusarla como semilla SIN volver a exponerla al prompt
  del modelo bajo prueba (anti-leakage: pool de ejemplos ≠ pool de eval, guard de disjunción).
- Tamaño: seguir la escala del precedente (~40 casos/tarea con muestra de gate curada); priorizar
  cobertura de estratos sobre volumen. Cada set congelado = archivo `casos.json` inmutable + hash/marcador.
- Guard CI de disjunción de pools (ejemplos vs eval) — Pitfall 3 (contaminación/leakage).

### Reglas LOCKED de siempre (aplican al harness)
- `response_format: json_schema` JAMÁS asumido: el harness mide structured-output vía el mismo patrón
  tool_choice-forzado + zod del proyecto; la tasa de fallo zod ES una métrica, no un crash.
- RUT jamás cruza a un LLM: los golden sets son datos NO-PII (idea_matriz/sector/tramitación son
  públicos; el juez usa datos no-PII). Guard por construcción — ningún caso de golden lleva RUT.
- Adjudicación intocable e inobservada este milestone: NINGÚN golden nuevo toca golden-1263 ni corre
  el pipeline de identidad. Phi-juez-sobre-identidad DIFERIDO a v2.
- Secrets nuevos solo en `.env` con placeholder SIN valor en `.env.example` (guard verde). En 106 no
  se necesita key nueva (baseline usa DeepSeek/MiniMax existentes); el token Workers AI/OpenRouter es
  checkpoint de 107 — si el planner detecta que 106 lo necesita, se pide UNA vez y se sigue lo no-bloqueado.

### Claude's Discretion
- Nombre exacto de tipos/funciones del harness, forma del reporte JSON, estructura de `casos.json` por
  tarea, ejes de estratificación finos, tamaño exacto por set (dentro de la escala del precedente),
  y si el juez-set se modela como pares (respuesta, etiqueta_humana) o como rúbrica — todo dentro del frame.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (el patrón a generalizar)
- `packages/cruces/src/golden/golden-set.ts` — `CasoGolden`/`GOLDEN_SET`/`evaluarGolden`/`MetricasGolden`/
  `gatePasa` + `casos.json` zod-validado; scoring single-label top-1 + abstención. PRECEDENTE de clasificación.
- `packages/fichas/src/golden/` — golden de extracción literal (precision/recall/F1 por substring) —
  PRECEDENTE de paridad-extracción (schema vs value).
- `packages/adjudication/src/golden/golden-set.ts` — golden-1263 (INTOCABLE este milestone; solo referencia de escala/estructura).
- `packages/llm/src/types.ts` — `LLMProvider` (`complete<T>(req, schema)`, `trainsOnInputs`),
  `CompletionRequest` (criticality/sensitivity), `MockProvider` (buscar en tests) — el contrato que el harness invoca.
- `packages/llm/src/providers/{deepseek,minimax}.ts` — incumbentes a baselinear; `minimax.ts` = template
  tool_choice-forzado + zod + repair loop (los adapters candidatos de 107 lo clonan).
- `packages/llm/src/validate.ts` (`parseAndValidate`) + `json-schema.ts` (`zodToToolSchema`) — la compuerta zod externa.

### Established Patterns
- Golden LLM-propone + humano-valida (D-06); mock-en-CI / real-en-LIVE (no red en CI); zod como compuerta al cargar.
- Monorepo pnpm workspaces (`packages/*`, `@obs/<pkg>`), vitest por paquete, `tsc -b` con `references` (NO `paths`).
- Provenance/versionado por fila (modelo/dims/version en embeddings) — el reporte del harness versiona modelo+tarifa+fecha.

### Integration Points
- Nuevo paquete `packages/llm-bench` (`@obs/llm-bench`), depende de `@obs/llm` (contratos + providers) — NUNCA al revés.
- Golden sets leen corpus real vía los paquetes de dominio (fichas/cruces/tramitacion) o fixtures derivados de R2.
- Suite raíz: app 1428 + packages (~1310) verdes + tsc 0 + 9 guards v10.0 (268 tests) — el paquete nuevo suma tests verdes.
</code_context>

<specifics>
## Specific Ideas

- El SUMMARY de research marca 106 como la fase LOAD-BEARING con research pendiente: metodología de
  métricas (p50/p95, cost/1k, zod-fail-rate), calibración del juez (isotónica/Platt sobre held-out es-CL),
  y guards de disjunción de pools. El plan debe incorporar esa metodología.
- ADDENDUM Workers AI (STACK.md): candidato PRIMARIO Granite = `@cf/ibm-granite/granite-4.0-h-micro`,
  baseURL `https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1`. Relevante para 107; el
  harness debe ser agnóstico al host (baseURL-swap) para que 107 solo enchufe el adapter.
- Un veredicto "nada aprueba paridad" es un resultado VÁLIDO del milestone — el harness debe poder
  expresarlo (no fuerza una aprobación).
</specifics>

<deferred>
## Deferred Ideas

- Adapters Granite/Phi + benchmark contra endpoint REAL + juez vs humano + VEREDICTO → Phase 107.
- Router aprendido/semántico, fine-tuning de modelos chicos → v2+ (contradice la tesis plug-in).
- Phi-juez-sobre-identidad → DIFERIDO a v2 (adjudicación intocable).
</deferred>
