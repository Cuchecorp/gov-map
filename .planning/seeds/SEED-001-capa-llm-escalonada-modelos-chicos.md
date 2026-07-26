---
id: SEED-001
status: dormant
planted: 2026-07-26
planted_during: v10.0 pasada 3 (entre Phase 103 y 104)
trigger_when: próximo milestone que toque la capa LLM (extracción, adjudicación, clasificación, agenda DeepSeek) o cuando latencia/costo LLM se vuelva prioridad
scope: medium
---

# SEED-001: Capa LLM escalonada con modelos chicos (Granite + Phi + selector) — spike con benchmark

## Why This Matters

Pedido explícito del operador (2026-07-26): hoy la capa LLM usa DeepSeek para volumen y MiniMax para lo crítico, sin escalonamiento fino. Modelos chicos modernos permiten mejor latencia y granularidad SIN sacrificar calidad si cada tarea usa el modelo mínimo suficiente y hay validación:

- **Granite-4.0-H-Micro**: candidato para routing, preguntas simples y clasificaciones (tareas de bajo riesgo, alto volumen).
- **Familia Phi (Phi-4-mini-instruct)**: candidato especialmente como **juez/validador** de salidas de otros modelos.
- **Arquitectura agéntica escalonada** (diseño propuesto por el operador): modelo chico responde → un segundo modelo valida → si no fue suficiente, un tercer **selector** elige un modelo mayor para responder. Escalera por producto: lo más simple usa los modelos más pequeños; **DeepSeek SOLO donde luce** (extracción de fichas con prompt-cache).
- **Regla LOCKED del operador: ante la duda, SIEMPRE calidad.** El escalonamiento optimiza latencia/costo únicamente donde el benchmark demuestra paridad de calidad.

## When to Surface

**Trigger:** próximo milestone que toque la capa LLM (pipeline de fichas/idea matriz, adjudicación de identidad, clasificación de señales/temas, tabla de agenda vía DeepSeek), o cuando el operador priorice latencia/costo de inferencia.

## Scope Estimate

**Medium** — un spike + fase de integración:
1. Spike de benchmark: golden set POR TAREA (routing, clasificación, juez, extracción) contra Granite-4.0-H-Micro, Phi-4-mini-instruct, DeepSeek actual; medir calidad/latencia/costo.
2. Diseño del escalonamiento (respond→validate→escalate) sobre la capa `LLMProvider` enchufable existente (openai SDK multi-provider por baseURL — encaja sin re-arquitectura).
3. Integración gradual por producto empezando por la tarea de menor riesgo; DeepSeek se mantiene donde el benchmark lo confirme.

Ser creativo en el diseño del spike, pero TODO con base empírica (principio del proyecto: modelo final elegido por benchmark sobre golden set).

## Breadcrumbs

- `CLAUDE.md` §Cómputo LLM — capa enchufable, DeepSeek volumen / MiniMax crítico / Gemini embeddings; "modelo final elegido por benchmark sobre golden set".
- `packages/llm/` — capa LLMProvider existente (openai SDK, baseURL por proveedor).
- `packages/fichas/` — pipeline de extracción (mayor consumidor DeepSeek, prompt-cache).
- `packages/adjudication/` + `packages/identity/` — adjudicación de identidad (hoy MiniMax, tarea crítica: candidata a juez Phi como segunda opinión, jamás degradar).
- Memoria `minimax-m3-api.md` — tool-calling structured output validado.
- Golden sets existentes: golden 32 (búsqueda), golden gates identidad 1263 — precedente de benchmark como gate CI.

## Notes

Capturado durante la corrida autónoma v10.0 (pasada 3) por mensaje del operador. La validación estructurada sigue la regla del stack: NO asumir `response_format json_schema` universal — tool calling o prompt-forzado + zod por proveedor (aplica también a Granite/Phi vía endpoints OpenAI-compat).
