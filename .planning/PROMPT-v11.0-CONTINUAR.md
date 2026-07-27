# PROMPT — Continuar v11.0 (finalizar VEREDICTO live + PASADA 2) — pegar tras `/clear`

> Sesión LIMPIA de Claude Code (repo Observatorio). Pasada 1 (105-107) SHIPPED. TODAS las credenciales
> ya están en `.env` y VERIFICADAS funcionando: Workers AI (Granite 200 + tools OK), OpenRouter (phi-4
> 200 + saldo cargado), DeepSeek, MiniMax, Gemini. NO re-descubrir hosts; ya está todo resuelto.
> Fable dirige, delega Sonnet, valida Opus. Ante la duda SIEMPRE calidad. Suite al inicio verde
> (`tsc -b` 0, `@obs/llm` 110, `@obs/llm-bench` 128). Adjudicación (golden-1263) INTOCABLE.

Leer PRIMERO (contexto ya escrito, no re-derivar): `.planning/PROMPT-v11.0-PASADA2.md` (rector de 108-109),
`.planning/phases/107-*/107-VEREDICTO-LIVE-2026-07-27.md` (veredicto real 10-sample),
`.planning/phases/107-*/107-SPIKE-FINDINGS-hosts.md` (host reality), ROADMAP.md §v11.0.

## ETAPA A — Finalizar el VEREDICTO DEFINITIVO (correr lo que falta en OpenRouter/Workers AI)

Estado: el veredicto ya corrió a 10-sample (routing+clasificación APPROVED para Granite, extracción se
queda DeepSeek, juez void por falta de saldo). Ahora hay SALDO OpenRouter → completar la evidencia. Tres
follow-ups LOCKED (del artefacto de veredicto), en orden:

1. **Fix reporte del juez degenerado** en `packages/llm-bench/src/veredicto.ts`: un juez con CERO
   veredictos válidos (todos `sinVeredicto` / `precision_ok` null) debe dar `pending-evidence`, NO
   `incumbent-stays` con escalar 0. Añadir el caso + test. (Ahora con saldo el juez SÍ responde, pero el
   fix es correctitud permanente.)
2. **Permitir el full-40 sin timeout:** en `packages/llm-bench/src/candidatos.live.test.ts` subir
   `TIMEOUT_MS` (p.ej. 1_800_000 = 30 min) O reestructurar para correr POR TAREA (4 sub-its) de modo que
   cada uno quepa bajo su límite. El full-40 con Granite (p95 ~5s) + DeepSeek (repairs) + Phi (32) excede
   los 600s actuales. Mantener LIVE-gated (nunca CI) + skip limpio sin keys.
3. **Correr el VEREDICTO DEFINITIVO full-40 CON juez real:**
   `set -a; source .env; set +a; LLM_BENCH_LIVE=1 LLM_BENCH_LIMIT=0 pnpm --filter @obs/llm-bench exec vitest run src/candidatos.live.test.ts`
   (NUNCA imprimir keys ni URLs con credenciales). Capturar el veredicto por tarea + BENCH-04 (Phi vs
   humano: precision_ok, recall_rechazo, sesgos) en un artefacto committeado
   `107-VEREDICTO-LIVE-FULL-<fecha>.md`. Confirmar (o corregir) routing/clasificación=APPROVED sobre los
   40, extracción=DeepSeek, y REGISTRAR el número real del juez.

Reglas: RUT jamás cruza a un LLM (guards ya por construcción); `response_format json_schema` jamás
asumido (Granite=tool_choice forzado, Phi=prompt-forced+zod ya implementado `structuredMode:"prompt"`);
sin números fabricados; suite verde al cerrar la etapa. Commitear el veredicto definitivo + el fix + el
timeout. Actualizar `107-VEREDICTO-LIVE-2026-07-27.md`/REQUIREMENTS (BENCH-04/05) a evidencia final.

Si el full-40 tumbara la paridad de routing/clasificación (improbable pero posible), ese es el veredicto
REAL y manda: se integra en 109 solo lo que quede APPROVED; si nada queda, 109 cierra honesto. Calidad manda.

## ETAPA B — PASADA 2 autónoma (TIER plomería + INTEG)

Con el veredicto definitivo en mano, ejecutar:

```
/gsd-autonomous --from 108 --to 109
```

Contexto rector COMPLETO en `.planning/PROMPT-v11.0-PASADA2.md` (leerlo). Resumen:
- **108 (TIER):** `TieredProvider` decorador que `implements LLMProvider` (drop-in en el punto de
  construcción de cada CLI; el router `selectProvider` existente es DEAD CODE — NO usarlo). `JudgeProvider`
  ESCALATE-ONLY (escala/rechaza, jamás aprueba). Config declarativa tarea→escalera. Telemetría por llamada
  SIN payload/PII (reusar `onValidationOutcome` de `@obs/llm` + sink payload-free de `llm-bench`).
  Escalación ACOTADA (1 hop/tier, presupuesto por ítem, terminal=revisión humana). Ruteo ENTRE pipelines
  jamás mid-sesión (prompt-cache DeepSeek de fichas intacto, verificable `prompt_cache_hit_tokens`).
  `CompletionRequest.task` aditivo retro-compatible (sin task = byte-idéntico). 100% testeable con
  `MockProvider`, SIN keys nuevas.
- **109 (INTEG):** integrar UNA tarea aprobada por el veredicto — **routing o clasificación** (ambas con
  gate verde; reversibles, no-legales; JAMÁS extracción ni adjudicación) con: provider-guard (zod+PII
  wrapper enumerando TODOS los providers) como **PRIMER COMMIT** (patrón lockdown-guard-first v10.0);
  golden de la tarea como regresión CI PERMANENTE; shadow-eval ON antes de promover; guard estático que
  MUERDE bloqueando `adjudicacion.*` y extracción strict-schema; rollback trivial por config (apagar
  escalera = incumbente, sin migración/deploy especial); canario de drift del endpoint. La escalera usa
  Granite@WorkersAI para la tarea aprobada, DeepSeek incumbente como fallback/escalón.

Gates que un agente JAMÁS cruza: flags `*_PUBLIC_ENABLED`, sign-offs legales, escribir RUT, rotar
credenciales, imprimir/cargar secrets. Reglas LOCKED de siempre. Un resultado honesto (incl. "integración
diferida" si algo no cierra) es VÁLIDO.

## AL CERRAR
`/clear` → PASADA 3 (`--from 110 --to 112`, V7GATES + cierre milestone; el operador participa en
checkpoints). Ver `.planning/PROMPT-v11.0-build-autonomo.md` §PASADA 3.
