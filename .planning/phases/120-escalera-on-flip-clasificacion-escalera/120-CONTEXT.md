# Phase 120: ESCALERA-ON — Flip `CLASIFICACION_ESCALERA=1` - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — orden DURO del prompt v12.0; flip AUTORIZADO por el operador 2026-07-27 (verbatim: "Flip autorizado… tras shadow-eval verde y con rollback-by-config")

<domain>
## Phase Boundary

Encender la escalera LLM (Granite→DeepSeek) SOLO en clasificación — la única tarea APPROVED por el veredicto full-40 (be0b1b9) — cumpliendo el orden DURO: (1) checkpoint operador keys Workers AI, (2) drift canary confirma modelo servido == pinneado, (3) shadow-eval LIVE verde, (4) rollback-by-config probado, (5) recién entonces el flip. Sin keys válidas o shadow no-verde → NO hay flip y el cierre honesto documentado es resultado VÁLIDO. Adjudicación de identidad y extracción strict-schema INTOCABLES (integ-scope-guard + provider-guard verdes siempre).

</domain>

<decisions>
## Implementation Decisions

### Estado de partida (scouting 2026-07-28, nombres verificados — valores JAMÁS leídos)
- `.env` YA contiene `WORKERS_AI_API_TOKEN` (no-vacío), `CLOUDFLARE_ACCOUNT_ID`, `DEEPSEEK_API_KEY`. `CLASIFICACION_ESCALERA` vacío/ausente = default incumbente.
- Toda la maquinaria existe desde 109-03: `resolverProvider` en `packages/cruces/src/clasificar-fichas-cli.ts:202` (rama 3 = tiered con `CLASIFICACION_ESCALERA=1` + keys), `drift-canary.test.ts` (gate `CLASIFICACION_DRIFT_CHECK=1`, modelo pinneado `@cf/ibm-granite/granite-4.0-h-micro`, veredicto 2026-07-27), `shadow-eval.test.ts` (bloque OFFLINE siempre + bloque LIVE gate `CLASIFICACION_SHADOW_LIVE=1`, 10 casos GOLDEN_SET_GATE, secuencial delay 2-3s).
- Clasificación NO corre en ningún cron CI (grep workflows: solo tests en ci.yml) → el flip vive en `.env` local del operador; NO se necesita GH secret. Esta fase NO crea cron nuevo.

### Orden DURO (LOCKED — cada paso gate del siguiente)
1. **Checkpoint operador (UNA vez, blocking-human)**: presentar al operador — token ya presente en `.env`; pedir confirmación de que ese token es el provisionado con permiso Workers AI y autorización para proceder con la secuencia de gates. El agente JAMÁS lee/imprime/carga valores. Si el operador no confirma o el token da 401 → cierre honesto sin flip (VÁLIDO).
2. **Drift canary**: `CLASIFICACION_DRIFT_CHECK=1 pnpm --filter @obs/cruces exec vitest run src/drift-canary.test.ts` — mismatch de modelo INVALIDA el veredicto full-40 y ABORTA el flip (cierre honesto).
3. **Shadow-eval LIVE**: `CLASIFICACION_SHADOW_LIVE=1 … vitest run src/shadow-eval.test.ts` — verde = acuerdo suficiente Granite vs DeepSeek en los 10 casos gate. No-verde → NO flip, documentar.
4. **Rollback probado**: bloque OFFLINE de shadow-eval + `clasificar-fichas-cli.test.ts` (sin la env var → DeepSeekProvider byte-idéntico). Correr y registrar ANTES del flip.
5. **Flip**: escribir `CLASIFICACION_ESCALERA=1` en `.env` (config local del operador — la autorización verbatim del 2026-07-27 cubre este acto tras gates verdes) + corrida de humo acotada de `clasificar-fichas-cli` (pocas fichas, dry-run si existe) verificando log `provider=tiered:granite→deepseek`. Registrar rollback inverso re-probado (quitar la var → log incumbente).

### Guards INTOCABLES
- integ-scope-guard + provider-guard verdes SIEMPRE (adjudicación de identidad y extracción strict-schema jamás tocadas por la escalera).
- `.env.example` ya tiene los placeholders (167/170/193) — guard env-example verde sin cambios.
- Telemetría payload-free como está (109); RUT jamás cruza a un LLM.

### Documento de fase
- `120-FLIP-RECORD.md`: cada gate con comando + salida (sin secretos), decisión, hora; o el cierre honesto sin flip con la causa exacta. Consumido por 121 (ESCALERA-DOC) y el E2E 125.

### Claude's Discretion
- Estructura de planes/waves; tamaño de la corrida de humo; formato del registro.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/cruces/src/clasificar-fichas-cli.ts` (resolverProvider, ramas 2/3, mensaje de error keys ausentes en :226).
- `packages/cruces/src/drift-canary.test.ts` + `shadow-eval.test.ts` (109-03, gates LIVE documentados en sus headers con comandos exactos).
- `packages/cruces/src/golden/golden-set.ts` (GOLDEN_SET_GATE 10 casos).
- Workers AI baseURL `https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1`, `max_tokens` 2048 explícito (default 256 trunca — gotcha v11).

### Established Patterns
- Cierre honesto documentado = resultado VÁLIDO (patrón v10 VSIM/NOTIF).
- Checkpoint blocking-human solo para secretos/flips — este ES el caso previsto de la pasada.

### Integration Points
- Salida → Phase 121 (doc por tarea) y 125 (E2E: flags no autorizados OFF; CLASIFICACION_ESCALERA NO es de la familia *_PUBLIC_ENABLED y SÍ está autorizado).

</code_context>

<specifics>
## Specific Ideas

- El flip NO es de la familia `*_PUBLIC_ENABLED` — autorizado explícitamente con precondiciones; las precondiciones son el producto de esta fase.
- Si el drift canary detecta otro modelo servido: ABORT total, el veredicto full-40 queda inválido — eso también invalida extender la escalera en 121 (documentarlo allí).

</specifics>

<deferred>
## Deferred Ideas

- Extensión de la escalera a otras tareas → Phase 121 documenta por qué NO (evidencia full-40).
- Cron CI para clasificación (hoy local) → fuera de alcance; si algún día existe, ahí sí GH secret.

</deferred>
