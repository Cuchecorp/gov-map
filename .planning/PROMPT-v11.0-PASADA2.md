# PROMPT — v11.0 PASADA 2 (TIER plomería + INTEG) — pegar tras `/clear`

> Sesión LIMPIA de Claude Code (repo Observatorio). Pasada 1 (105-107) ya SHIPPED. El scaffolding
> existe: ROADMAP.md §v11.0, REQUIREMENTS.md (TIER/INTEG), research en `.planning/research/`.
> NO re-descubrir; ejecutar. Al terminar: `/clear` y pasar a la pasada 3 (`--from 110 --to 112`).

```
/gsd-autonomous --from 108 --to 109
```

Corrida autónoma v11.0 "Capa LLM escalonada + cierre de deuda viva" — PASADA 2 (TIER plomería + INTEG).

## Contexto rector (leer ROADMAP.md §v11.0 + research/SUMMARY.md + ARCHITECTURE.md antes de planificar)

- **REGLA LOCKED del operador (rectora de TODO el milestone):** ante la duda, SIEMPRE calidad. El
  escalonamiento optimiza latencia/costo ÚNICAMENTE donde el benchmark demuestra paridad. DeepSeek se
  queda donde luce. **La adjudicación de identidad (MiniMax, golden-1263) NI SE TOCA NI SE OBSERVA**
  este milestone (Phi-juez-sobre-identidad DIFERIDO a v2).
- **Fable es el jefe:** planifica, dirime, controla; delega ejecución a Sonnet, validadores Opus.
  Smart-discuss auto-acepta; las decisiones del operador YA ESTÁN RESUELTAS — no re-preguntar.
  Autónomo salvo los gates diseñados. Suite al inicio DEBE estar verde (ver §Estado).

## Estado heredado de la PASADA 1 (SHIPPED 2026-07-26/27) — NO rehacer

- **105 (BCN)** ✅ parser fail-closed en origen; re-corrida `--from-r2` + DELETE bounded → **cero
  URI-como-partido en PROD**. `partidoLegible()` conservado. Verificación 4/4.
- **106 (BENCH harness)** ✅ `packages/llm-bench` FUERA del runtime; 4 golden es-CL (40 c/u) FROZEN
  sha256 + guards que muerden; métricas SEPARADAS (calidad·p50/p95·costo-por-CASO·`structured_output_fail_rate`
  vs `zod_fail_rate.{repaired,terminal}`). Instrumentación vía el hook `fetchFn` de los adapters.
  Baseline LIVE real capturado. **VALIDADO end-to-end contra endpoints reales.** Verificación 9/9.
- **107 (adapters + veredicto)** ✅ `GraniteProvider` (clon MiniMax, `max_tokens` explícito, baseURL
  host-agnóstico) + `JudgeProvider`/`Verdict` interfaz SEPARADA + `PhiJudge` (temp 0, match tool_call
  POR NOMBRE). `computarVeredicto` PURO con `EPSILON_POR_TAREA` explícito + **es-CL HARD VETO** sobre la
  sub-métrica `negacion.accuracy` (independiente del agregado, fail-closed a pending-evidence si falta
  evidencia). Guards fail-closed IDÉNTICOS (`assertNoRutInLlmInput` user+system+context, `assertSensitivityAllowed`).
  Verificación 8/8. **Contrato aditivo nuevo en `@obs/llm`:** `CompletionRequest.onValidationOutcome` +
  `ValidationOutcome` en `validate.ts` (prod sin cambio) — la escalera de 108 lo puede usar para telemetría.

## ⚠ HALLAZGO CRÍTICO DE HOST (spike 107 validado 2026-07-27) — GATE del veredicto

El VEREDICTO por tarea (BENCH-05) que autoriza integrar en 109 está **PENDING-EVIDENCE** por un gap de
HOST, NO por falta de código (ver `.planning/phases/107-*/107-SPIKE-FINDINGS-hosts.md`):

- **Granite-4.0-H-Micro (responder):** OpenRouter lo lista pero SIN endpoint de tool-use (HTTP 404 con
  `tool_choice` forzado). **Único host viable = Workers AI** (`@cf/ibm-granite/granite-4.0-h-micro`, con
  function calling, catálogo CF confirmado). Requiere `WORKERS_AI_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`
  en `.env` (AUSENTES). `candidatos.live.test.ts` ya elige la rama Workers AI cuando ambas existen — CERO cambio de código.
- **Phi-4-mini (juez, BENCH-04):** NO está en OpenRouter (solo `microsoft/phi-4` sin tools) NI en Workers
  AI (solo Phi-2 deprecado). **Ningún host con function-calling confirmado.** Verificar en esta pasada:
  DeepInfra / Azure AI Foundry (ambos listan Phi-4-mini) → confirmar que tool-calling pasa, agregar
  baseURL/key; O (decisión operador) un juez chico alternativo servido con tools; O variante prompt-forzado+zod
  del juez (sin `tool_choice` forzado) como último recurso sancionado.
- **`OPENROUTER_API_KEY` YA está en `.env`** (válido) pero **NO basta** para ningún candidato.

**Implicación para la pasada 2:** 108 NO depende de esto (se testea con MockProvider). 109 SÍ — solo se
integra la tarea que el veredicto REAL apruebe. Si al momento de 109 el veredicto sigue pending (sin
Workers AI / sin host Phi), **109 cierra HONESTO**: plomería testeada en mock, integración DIFERIDA
documentada. Eso es un resultado VÁLIDO (la regla es calidad, no shippear la escalera). NO fabricar
integración sin evidencia.

## 108 (TIER P2 — plomería) — scope

- **HALLAZGO RECTOR (research HIGH, grounded):** el router existente de `@obs/llm` (`selectProvider`/
  `loadRouterConfigFromEnv`) es DEAD CODE — cada consumidor instancia el provider concreto en su CLI
  (`fichas/src/pipeline-cli.ts`, `cruces/src/clasificar-lobby-cli.ts`). El seam correcto es un
  **`TieredProvider` decorador que `implements LLMProvider`**, drop-in en el punto de construcción; los
  cuerpos de consumidores NO cambian. `CompletionRequest.task` ADITIVO retro-compatible: sin `task` =
  comportamiento actual byte-por-byte.
- **Entregables 108:** `TieredProvider` (cascada respond→validate→escalate, ACOTADA: 1 hop por tier,
  presupuesto por ítem, estado terminal = revisión humana, sin loops) + `JudgeProvider` cableado
  **ESCALATE-ONLY** (escala/rechaza, JAMÁS aprueba ni suaviza compuertas — juez débil que aprueba =
  teatro de validación) + config declarativa tarea→escalera + telemetría por llamada
  (modelo/tarea/latencia/costo/veredicto/escalación) SIN payload ni PII (reusar el `onValidationOutcome`
  aditivo de 107 + el sink payload-free de `llm-bench`). Escalación por veredicto de juez o fallo zod,
  NUNCA por auto-confianza del modelo chico (miscalibrada).
- **Ruteo ENTRE pipelines, jamás mid-sesión** — el prompt-cache DeepSeek de fichas queda intacto
  (verificable: `prompt_cache_hit_tokens` no regresiona). Todo testeable con `MockProvider` antes de
  tocar producción. **No requiere keys nuevas.**

## 109 (INTEG P3 — integrar la tarea de MENOR RIESGO) — scope, GATED por veredicto verde

- Integrar UNA tarea reversible NO-legal (clasificación o routing — la que el veredicto 107 APRUEBE;
  JAMÁS extracción de idea-matriz ni adjudicación) con:
  - **provider-guard (zod+PII wrapper enumerando TODOS los providers) como PRIMER COMMIT** (patrón
    lockdown-guard-first v10.0),
  - golden set de la tarea como regresión CI PERMANENTE,
  - shadow-evaluation ON antes de promover,
  - **guard estático que MUERDE** impidiendo que la escalera toque `adjudicacion.*` y extracción strict-schema,
  - rollback trivial por config (apagar escalera = incumbente, sin migración ni deploy especial),
  - canario de drift del endpoint.
- **Si el veredicto NO aprobó ninguna tarea** (paridad no demostrada, o candidatos sin host): 109 se
  cierra HONESTO — plomería queda testeada con MockProvider, integración diferida documentada. VÁLIDO.

## Gates que un agente JAMÁS cruza
- flags `*_PUBLIC_ENABLED`, sign-offs legales, escribir RUT, rotar credenciales, imprimir secrets,
  cargar valores de secreto en `.env`/GH/dashboard. Si 109 necesita una key/host nuevo (Workers AI / host
  Phi), **pedirlo UNA vez con instrucciones exactas** y seguir con lo no bloqueado (108 + el andamiaje de 109).

## Reglas LOCKED de siempre
- `response_format: json_schema` JAMÁS asumido (tool_choice forzado + zod por proveedor). RUT jamás cruza
  a un LLM (guard por construcción en TODO adapter/escalón nuevo). Identidad fail-closed. Anti-insinuación
  (linter verde). Migraciones por `psql --single-transaction` (NUNCA `db push`). PostgREST cap 1k
  (`.order().range()`). Dos-etapas fuente→R2→Supabase. Secrets nuevos solo en `.env` + placeholder sin
  valor en `.env.example` (guard verde). Adjudicación (golden-1263) INTOCABLE e INOBSERVADA.

## Estado / suite al inicio (cada plan la deja verde)
- `tsc -b` (root) EXIT 0. `@obs/llm` 102 pass / 3 skip. `@obs/llm-bench` 128 pass / 3 skip (LIVE gated).
  app 1428 + resto de packages + 9 guards régimen v10.0. Master limpio (pasada 1 toda commiteada).
- `MockProvider` vive en `@obs/adjudication` (`mock-provider.ts`) y en llm-bench — patrón para testear la escalera sin red.
- `.env`: DeepSeek/MiniMax/Gemini/OpenRouter presentes; Workers AI (`WORKERS_AI_API_TOKEN`+`CLOUDFLARE_ACCOUNT_ID`) AUSENTES.

## Un veredicto "nada aprueba paridad" (o "candidatos sin host servible") es un resultado VÁLIDO del milestone, no un fallo.
