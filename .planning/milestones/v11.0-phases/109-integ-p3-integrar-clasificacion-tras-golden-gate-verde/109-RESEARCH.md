# Phase 109: INTEG P3 — Integrar CLASIFICACIÓN tras golden gate verde - Research

**Researched:** 2026-07-27
**Domain:** LLM provider integration — TieredProvider drop-in swap + safety net (provider-guard, golden CI gate, shadow-eval, drift canary, rollback-by-config)
**Confidence:** HIGH — grounded against actual file:line. No speculative claims.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- La ÚNICA tarea aprobada (full-40) es **clasificación** (Δ 0.0000). routing NO se integra. extracción VETADA es-CL.
- Target = `packages/cruces/src/clasificar-fichas-cli.ts:200` — swap `new DeepSeekProvider(...)` → `new TieredProvider(...)` drop-in. Cuerpo del CLI NO cambia.
- NO tocar `clasificar-lobby-cli.ts` (MiniMax/adjudicación). NO tocar `fichas/src/pipeline-cli.ts` (extracción, prompt-cache intacto).
- **Default de ruteo = INCUMBENTE (DeepSeek).** El agente NO promueve a routing-vivo Granite. Shadow-eval ON primero.
- PRIMER COMMIT = provider-guard (patrón lockdown-guard-first v10.0).
- Guard estático que MUERDE bloqueando escalera en `adjudicacion.*` y `pipeline-cli.ts`.
- Rollback por config (env var o LadderConfig), sin migración ni deploy.
- Canario de drift del endpoint.
- RUT JAMÁS cruza a un LLM. `response_format: json_schema` JAMÁS asumido. Adjudicación (golden-1263) INTOCABLE e INOBSERVADA.
- Migraciones por `psql --single-transaction`. Secrets nuevos solo en `.env` + placeholder en `.env.example`.

### Claude's Discretion
- Ninguna área de discreción: todas las decisiones de diseño están LOCKED por evidencia del veredicto DEFINITIVO full-40 y el CONTEXT.md.

### Deferred Ideas (OUT OF SCOPE)
- "Promover" escalera a routing-vivo Granite (config-flip posterior, gated por shadow-eval verde).
- routing (no aprobado) y extracción (vetada).
- Phi-juez-sobre-identidad y observación de adjudicación → DIFERIDO a v2.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTEG-01 | Clasificación corre con la escalera integrada en producción de pipeline, gated por golden set verde en CI como regresión permanente | Sección "Swap exacto", "Golden CI gate", "Validation Architecture" |
| INTEG-02 | Extracción/adjudicación intactas + guard estático/CI que impide que la escalera toque adjudicacion.* y extracción strict-schema | Sección "Guard estático (TIER-05 extendido)", "Landmines" |
| INTEG-03 | Rollback trivial: apagar escalera = incumbente por config, sin migración ni deploy | Sección "Rollback por config" |
</phase_requirements>

---

## Summary

Phase 109 integra `TieredProvider` (construido en 108) como drop-in en el único punto de construcción del CLI de clasificación de fichas (`clasificar-fichas-cli.ts:200`). La escalera de `clasificacion` pone a **Granite@WorkersAI como tier candidato** y a **DeepSeek como incumbente/fallback**. El default de ruteo ES el incumbente, de modo que el comportamiento en producción es byte-idéntico hasta que el operador flipe el config. La red de seguridad (provider-guard + golden CI permanente + guard estático + shadow-eval + canario de drift) se entrega en ese orden, con el provider-guard como PRIMER commit.

El CI actual (`ci.yml`) corre `pnpm --filter ./app test -- --run` y `tsc --noEmit` sobre el directorio `app/`. Los tests de `packages/llm` y `packages/cruces` corren por separado (no están en el scope del CI actual). Para que el golden de clasificación y el provider-guard sean un gate CI PERMANENTE QUE MUERDE, deben agregarse al scope del CI o crear un job adicional que cubra los packages relevantes.

**Primary recommendation:** El swap es una construcción de 5 líneas; el grueso del trabajo es la red de seguridad (guards, CI, shadow-eval, canario). Hacer el provider-guard y el guard estático PRIMERO, validar que CI muerde, luego hacer el swap.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Clasificación de sector (clasificar-fichas-cli) | packages/cruces CLI | packages/llm TieredProvider | El CLI es el punto de construcción; TieredProvider es el decorador drop-in |
| Provider-guard (zod+PII wrapper) | packages/llm vitest + CI | — | Guard estructural en el paquete que define los providers |
| Guard estático anti-adjudicación | packages/llm vitest | packages/cruces vitest | Source-scan que lee archivos del repo; puede vivir en llm como extensión del TIER-05 existente |
| Golden CI permanente clasificación | packages/cruces vitest | CI job | golden-set.test.ts ya existe; se amplía el scope del CI o se añade job |
| Shadow-eval (LIVE-gated) | packages/cruces / llm-bench | — | Nunca CI; usa WORKERS_AI_API_TOKEN + DEEPSEEK_API_KEY del .env |
| Drift canary | packages/llm-bench o script ad-hoc | — | Probe HTTP que captura endpoint/model served vs el pinned del veredicto |
| Rollback por config | clasificar-fichas-cli.ts | — | Env var leída en el punto de construcción; si ausente → DeepSeek directo |

---

## Standard Stack

No hay librerías nuevas. Todo reutiliza lo entregado en 108. [VERIFIED: lectura directa del código]

### Core (ya instalado)
| Asset | Módulo | Rol en 109 |
|-------|--------|-----------|
| `TieredProvider` | `packages/llm/src/tiered.ts` | Decorador drop-in para `clasificar-fichas-cli.ts:200` |
| `buildTieredProvider` | `packages/llm/src/task-ladder.ts` | Fábrica declarativa `LadderConfig → TieredProvider` |
| `LadderConfig` | `packages/llm/src/task-ladder.ts` | Config de la escalera `clasificacion` |
| `GraniteProvider` | `packages/llm/src/providers/granite.ts` | Tier candidato (Granite@WorkersAI) |
| `DeepSeekProvider` | `packages/llm/src/providers/deepseek.ts` | Tier incumbente/fallback |
| `MockProvider` | `packages/llm/src/test-mock.ts` | Tests offline del wiring |
| `evaluarGolden` / `gatePasa` | `packages/cruces/src/golden/golden-set.ts` | Golden gate CI de clasificación |

### Verificación de versiones
No aplica: no se instalan paquetes nuevos. Todo es código propio del monorepo ya compilando con `tsc -b` en exit 0 (verificado en 108-02-SUMMARY.md).

---

## Package Legitimacy Audit

No se instalan paquetes externos en esta fase. N/A.

---

## Architecture Patterns

### 1. El swap exacto en clasificar-fichas-cli.ts:200

**Archivo:** `packages/cruces/src/clasificar-fichas-cli.ts`, líneas 198-200.

**Código hoy (línea 199-200):**
```
const provider =
  opts.provider ?? new DeepSeekProvider({ apiKey: process.env.DEEPSEEK_API_KEY ?? "" });
```

**Signature de `FichasCliOptions`:** Ya tiene `provider?: LLMProvider` (línea 199 usa `opts.provider`). El tipo `LLMProvider` admite `TieredProvider` sin cast porque `TieredProvider implements LLMProvider` (confirmado en `tiered.ts:82`).

**Swap drop-in propuesto (lógica, no código):**

La construcción debe:
1. Leer una env var de control (propuesta: `CLASIFICACION_ESCALERA` o `ESCALERA_CLASIFICACION_ENABLED`). Si está ausente o no es `"1"`: construir `new DeepSeekProvider(...)` — comportamiento actual byte-idéntico.
2. Si está `"1"`: construir la escalera `clasificacion` via `buildTieredProvider(ladderConfig)` donde `ladderConfig` declara:
   - `primary`: `GraniteProvider` con `baseURL` construido desde `CLOUDFLARE_ACCOUNT_ID` + `WORKERS_AI_API_TOKEN`
   - `escalation`: `DeepSeekProvider` (el incumbente, rollback automático si Granite falla zod)
3. El resultado es un `TieredProvider` que es drop-in (`LLMProvider`). El resto del cuerpo del CLI NO cambia.

**Por qué `buildTieredProvider` y no `new TieredProvider(...)` directamente:** `buildTieredProvider` es la fábrica declarativa diseñada para este propósito (task-ladder.ts:96-116). Acepta `LadderConfig` y devuelve `TieredProvider` configurado. Es el patrón canónico de 108.

**Default de ruteo = incumbente:** Con `CLASIFICACION_ESCALERA` ausente o no `"1"`, se construye `DeepSeekProvider` directo. La `TieredProvider` no se instancia. Cero cambio de comportamiento en producción hasta que el operador setee la env var.

**GraniteProvider — construcción del baseURL en runtime:**
El `DEFAULT_BASE_URL` de `granite.ts` contiene el literal `{ACCOUNT_ID}` como template (línea 47). En la construcción del tier candidato, el baseURL debe interpolarse con `CLOUDFLARE_ACCOUNT_ID` del entorno:
```
baseURL: `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`
```
Esto es lo que hacen los tests LIVE de llm-bench. No hardcodear el account ID.

**Imports que se agregan a clasificar-fichas-cli.ts:**
- `TieredProvider` (o `buildTieredProvider`) de `@obs/llm`
- `GraniteProvider` de `@obs/llm`
- Ningún cambio al resto del archivo.

### 2. LadderConfig para `clasificacion`

```
{
  primary: {
    provider: new GraniteProvider({
      apiKey: process.env.WORKERS_AI_API_TOKEN ?? "",
      baseURL: `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
    }),
    costPerToken: 0.00000000125,  // estimado Workers AI (informativo; sin impacto en lógica)
  },
  escalation: {
    provider: new DeepSeekProvider({ apiKey: process.env.DEEPSEEK_API_KEY ?? "" }),
    costPerToken: 0.00000014,
  },
  // Sin judge: clasificación es simple (el veredicto full-40 la aprobó sin juez).
  // maxBudgetUsd: undefined → sin límite de presupuesto (escalación automática ante LLMValidationError).
}
```

Si `CLASIFICACION_ESCALERA !== "1"`, el `LadderConfig` ni se construye (guard de env var antes).

### 3. Provider-guard (PRIMER COMMIT — patrón lockdown-guard-first)

**Precedentes directos en el repo:**
- `packages/llm/src/tiered-scope-guard.test.ts` — guard estructural TIER-05: source-scan que lee `packages/fichas/src/pipeline-cli.ts` con `readFileSync` y asevera que no contiene `TieredProvider`. 34 líneas. Usa `import.meta.dirname` (NO `new URL(import.meta.url)` — falla en vitest).
- `app/lib/lockdown-guard.test.ts` — escanea árbol de `app/` con `readdirSync` recursivo, filtra comentarios, busca patrones prohibidos. Más elaborado pero mismo molde.

**Provider-guard de 109 — forma:**

Un test vitest en `packages/llm/src/provider-guard.test.ts` (o `packages/cruces/src/`) que:

1. **Enumera todos los providers del repo** — source-scan de `packages/llm/src/providers/*.ts`, lista los archivos.
2. **Por cada provider, asevera que contiene el wrapper zod+PII:** `assertNoRutInLlmInput` está llamado en `complete<T>`. Verificable con `readFileSync` + `source.includes("assertNoRutInLlmInput")`. También verificar `assertSensitivityAllowed`.
3. **Falla fail-loud si algún provider carece del wrapper.** Un nuevo provider sin los guards haría fallar este test en CI.

**Archivos de providers que ya existen** (confirmado vía Glob):
- `deepseek.ts`, `minimax.ts`, `granite.ts`, `gemini-embeddings.ts`, `phi-judge.ts`
- Todos ya tienen `assertNoRutInLlmInput` y `assertSensitivityAllowed` por construcción (107/108).

**El guard en 109 no encontrará violaciones actuales; su valor es prospectivo:** cualquier provider futuro sin los guards falla CI antes de mergear.

**Scope del guard:** `packages/llm/src/providers/` — solo providers LLM (no el gemini-embeddings que no maneja datos de usuario con el mismo patrón).

### 4. Guard estático que MUERDE en adjudicacion.* y pipeline-cli.ts

**Precedente:** `packages/llm/src/tiered-scope-guard.test.ts` (TIER-05) ya asevera que `pipeline-cli.ts` NO contiene `TieredProvider`. Este guard existe y pasa.

**109 amplía o añade un guard paralelo** que asevera:

1. `packages/cruces/src/clasificar-lobby-cli.ts` NO contiene `TieredProvider` — la ruta de adjudicación (MiniMax) queda intacta.
2. `packages/fichas/src/pipeline-cli.ts` NO contiene `TieredProvider` — ya cubierto por TIER-05, pero verificar que sigue verde tras el swap.
3. (Opcional de extensión) Ningún archivo en `packages/*/src/` que contenga la cadena `adjudicacion` como nombre de función o ruta de importación contiene `TieredProvider`.

**Ubicación canónica:** El guard TIER-05 existente vive en `packages/llm/src/tiered-scope-guard.test.ts`. La extensión de 109 puede añadirse al mismo archivo (bloque `describe` adicional) o crear `packages/llm/src/integ-scope-guard.test.ts`. El planner decide.

**Mecanismo:**
```
const source = readFileSync(<path-to-clasificar-lobby-cli>, "utf-8");
expect(source).not.toContain("TieredProvider");
```
Mismo idiom que TIER-05. Sin regex complejos.

### 5. Golden CI permanente — cómo se añade al scope de CI

**Estado actual del CI** (`ci.yml`):
- Solo corre `pnpm --filter ./app test -- --run` (scope: `app/` — lockdown-guard, anti-insinuación, bento-guards).
- No incluye `packages/llm` ni `packages/cruces`.

**El golden de clasificación** (`packages/cruces/src/golden/golden-set.test.ts`) ya existe y pasa con MockProvider en CI (sin red). El mock-oro da 10/10, cobertura 1.0, 0 errores → `gatePasa` = true. Los 3 casos de behavior (correcto/abstención/misclasificación) son offline.

**Para que sea un gate CI permanente QUE MUERDE:** agregar al `ci.yml` un step adicional:
```
- name: Test packages/cruces (golden clasificación + guards)
  run: pnpm --filter @obs/cruces exec vitest run --run
```

Y análogamente para `@obs/llm`:
```
- name: Test packages/llm (TieredProvider + guards)
  run: pnpm --filter @obs/llm exec vitest run --run
```

Ambos son offline (sin red, sin keys), corren en el runner ubuntu-latest sin secrets adicionales. El bloque LIVE (`CRUCES_GOLDEN_LIVE=1`) se saltea por defecto.

**Alternativa más simple:** un único step `pnpm -r test -- --run` si todos los packages tienen vitest configurado. Verificar que no hay side effects con packages que requieran keys.

### 6. Shadow-eval (LIVE-gated, nunca CI)

**Objetivo:** correr Granite en paralelo contra DeepSeek sobre la distribución real (fichas en PROD), comparar outputs, sin afectar la salida de producción.

**Harness existente:** `packages/llm-bench/src/tasks/clasificacion/` tiene scorer + casos congelados. El patrón LIVE-gated ya existe en `golden-set.test.ts:122-147` (`CRUCES_GOLDEN_LIVE === "1"`).

**Shadow-eval para 109** — extensión de ese patrón:
1. Un script o test gated por `CLASIFICACION_SHADOW_LIVE === "1"`.
2. Carga fichas de PROD (o del golden set congelado de llm-bench como proxy).
3. Corre `clasificarFicha(input, deepseekProvider)` (incumbente) y `clasificarFicha(input, graniteProvider)` en paralelo (o secuencial con rate-limit 2-3s si PROD).
4. Compara `sector_codigo` salida-a-salida: registra acuerdo/desacuerdo.
5. Log a stdout (o jsonl via `jsonlSink` de telemetry.ts) — sin persistir en DB.
6. Skip limpio si faltan `WORKERS_AI_API_TOKEN` o `CLOUDFLARE_ACCOUNT_ID`.

**El output productivo NO se altera** porque el shadow-eval es un paso adicional de observación, no modifica el provider usado por el CLI en su modo normal.

**Rate-limit:** 2-3s entre llamadas al mismo host (regla locked del proyecto). Con `CLASIFICACION_ESCALERA` en OFF, el CLI sigue usando DeepSeek; el shadow-eval es un script separado, no el CLI.

### 7. Drift canary del endpoint

**Problema a detectar:** si Cloudflare cambia el modelo servido en `@cf/ibm-granite/granite-4.0-h-micro`, los números del veredicto (paridad Δ 0.0000) ya no son válidos.

**Provenance del veredicto full-40** (`107-VEREDICTO-LIVE-FULL-2026-07-27.md`):
- endpoint: `…/accounts/{ACCOUNT_ID}/ai/v1`
- modelo pinneado: `@cf/ibm-granite/granite-4.0-h-micro`
- fecha: 2026-07-27

**Canario propuesto:**
Un script/test gated por `CLASIFICACION_DRIFT_CHECK === "1"` que:
1. Hace una llamada de probe mínima al endpoint (1 caso del golden) y captura el campo `model` de la respuesta (Workers AI lo devuelve en el body de la completion).
2. Compara contra el modelo pinneado (`@cf/ibm-granite/granite-4.0-h-micro`).
3. Si difiere: imprime `[DRIFT DETECTADO] modelo servido: X ≠ pinneado: Y — veredicto full-40 INVALIDADO. Re-correr benchmark antes de promover.` y sale con error.
4. Skip limpio sin keys.

**Los campos de provenance** ya están capturados en `llm-bench` (`MetricasModelo` tiene `endpoint`/`tarifaFecha`). El canario no necesita depender de llm-bench; puede ser un script standalone en `packages/cruces/scripts/` o en `packages/llm-bench/`.

### 8. Rollback por config

**Superficie:** env var `CLASIFICACION_ESCALERA` (o nombre equivalente).

**Semántica:**
- Ausente o `!== "1"` → el punto de construcción de `clasificar-fichas-cli.ts:200` construye `new DeepSeekProvider(...)` — incumbente directo. `TieredProvider` no se instancia. Sin runtime cost.
- `=== "1"` → construye `buildTieredProvider(ladderConfig)` con Granite como primario y DeepSeek como escalación.

**Rollback sin deploy:** setear/borrar la env var en `.env` local o en el runner de GH Actions. No requiere cambio de código, migración, ni redeploy.

**Verificabilidad:** los logs del CLI deben reportar qué provider está activo (`log("cruces-fichas: provider=tiered:granite→deepseek")` vs `log("cruces-fichas: provider=deepseek")`). Misma disciplina que el comentario existente en línea 198: `// Provider público (DeepSeek por el router)`.

---

## Don't Hand-Roll

| Problema | No construir | Usar | Por qué |
|----------|-------------|------|---------|
| Cascada con fallback | Custom retry loop | `TieredProvider` (tiered.ts) | Ya implementado, testeado con 21 tests offline, guards por construcción |
| Config declarativa escalera | Objeto literal ad-hoc en el CLI | `buildTieredProvider(LadderConfig)` (task-ladder.ts) | Desacopla config de construcción, permite tests offline |
| Tests offline del wiring | Mock manual | `MockProvider` / `MockJudgeProvider` (test-mock.ts) | Ya disponible en `@obs/llm`, sin dependencia circular |
| Scoring del golden | Lógica custom | `evaluarGolden` / `gatePasa` (golden-set.ts) | Ya implementado con los umbrales correctos (cobertura ≥ 0.7, errores = 0) |

---

## Common Pitfalls

### Pitfall 1: Construir GraniteProvider con DEFAULT_BASE_URL sin interpolar ACCOUNT_ID
**Qué va mal:** `granite.ts` line 47 tiene el literal `{ACCOUNT_ID}` como template en la constante `DEFAULT_BASE_URL`. Si se construye `new GraniteProvider({ apiKey, baseURL: undefined })`, el request va a una URL inválida.
**Cómo evitar:** Siempre pasar `baseURL` explícito con `CLOUDFLARE_ACCOUNT_ID` interpolado en la construcción de la escalera de clasificación.
**Warning sign:** HTTP 404 o error de parsing de URL en el primer call LIVE.

### Pitfall 2: Instanciar TieredProvider cuando las keys de Granite están ausentes
**Qué va mal:** Si `WORKERS_AI_API_TOKEN` está vacío, `GraniteProvider` construye el cliente OpenAI con apiKey vacío. La primera llamada LIVE fallará con 401 (sin escalar, porque un error no-`LLMValidationError` se re-lanza — FLAG-2 de `tiered.ts:175-181`).
**Cómo evitar:** El guard de env var `CLASIFICACION_ESCALERA !== "1"` ya protege: la escalera solo se construye si la env var está presente. En el plan, añadir validación explícita de que `WORKERS_AI_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` no están vacíos antes de construir `GraniteProvider`.
**Warning sign:** `EscalationExhaustedError: all-tiers-failed` en los primeros items — no es un fallo de calidad sino de auth.

### Pitfall 3: Asumir que el CI actual cubre los packages
**Qué va mal:** El `ci.yml` actual solo corre `pnpm --filter ./app test`. Los tests de `packages/llm` y `packages/cruces` no corren en CI. El golden gate y el provider-guard NO muerden en CI hasta que se amplíe el scope.
**Cómo evitar:** Agregar steps de CI para `@obs/llm` y `@obs/cruces` como parte de 109.

### Pitfall 4: Usar `new URL(import.meta.url)` en lugar de `import.meta.dirname` en tests vitest
**Qué va mal:** Los guards source-scan que usan `new URL(import.meta.url)` fallan en vitest (gotcha documentado en TIER-05).
**Cómo evitar:** Usar `import.meta.dirname` como hace `tiered-scope-guard.test.ts`.

### Pitfall 5: Promover la escalera a routing-vivo antes del shadow-eval
**Qué va mal:** Setear `CLASIFICACION_ESCALERA=1` en producción sin shadow-eval viola el contrato de "shadow-evaluation ON antes de promover".
**Cómo evitar:** El agente deja `CLASIFICACION_ESCALERA` sin setear. El operador es quien flipea tras shadow-eval verde. Documentar esto en el handoff.

### Pitfall 6: Tocar clasificar-lobby-cli.ts creyendo que también clasifica fichas
**Qué va mal:** `clasificar-lobby-cli.ts:190` construye `MiniMaxProvider` para la adjudicación de identidad (contraparte lobby). Es sensible. No es el target de 109.
**Cómo evitar:** El guard estático asevera que este archivo no contiene `TieredProvider`. Si accidentalmente se toca, el guard muerde.

---

## Runtime State Inventory

Esta es una fase de integración de código (drop-in swap + guards + tests). No hay renombrados ni migraciones de datos.

| Categoría | Hallazgo | Acción |
|-----------|----------|--------|
| Stored data | Ninguno — clasificación lee `proyecto_ficha` ya poblada; el swap no cambia qué se lee ni qué se escribe (`sector_id`). | Ninguna |
| Live service config | `CLASIFICACION_ESCALERA` nueva env var — ausente hasta que el operador la setee. | Solo documentar en `.env.example` con valor vacío y comentario. |
| OS-registered state | Ninguno. | — |
| Secrets/env vars | `WORKERS_AI_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` ya están en `.env` (verificado por PROMPT-v11.0-PASADA2.md línea 114: "Workers AI... YA en `.env`, funcionando"). | Agregar placeholder en `.env.example` si no existe. `CLASIFICACION_ESCALERA` también como placeholder. |
| Build artifacts | Ninguno. `tsc -b` en exit 0 post-108. | — |

---

## Validation Architecture

> `workflow.nyquist_validation` no está explícitamente `false` en config — sección incluida.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (packages/llm y packages/cruces tienen vitest configurado) |
| Config | `packages/llm/vitest.config.ts`, `packages/cruces/vitest.config.ts` |
| Quick run (llm) | `pnpm --filter @obs/llm exec vitest run` |
| Quick run (cruces) | `pnpm --filter @obs/cruces exec vitest run` |
| Full suite | `pnpm -r exec vitest run --run` (cuidado: evitar packages con side effects de red) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Archivo existe? |
|--------|----------|-----------|-------------------|-----------------|
| INTEG-01 | Clasificación usa TieredProvider (wiring correcto) | unit offline | `pnpm --filter @obs/cruces exec vitest run src/clasificar-fichas-cli.test.ts` | ❌ Wave 0 — crear |
| INTEG-01 | Golden gate clasificación pasa con mock | unit offline | `pnpm --filter @obs/cruces exec vitest run src/golden/golden-set.test.ts` | ✅ existe |
| INTEG-01 | Golden gate CI permanente (CI muerde) | CI gate | Step CI en ci.yml | ❌ Wave 0 — ampliar ci.yml |
| INTEG-01 | Shadow-eval Granite vs DeepSeek (LIVE) | LIVE-gated | `CLASIFICACION_SHADOW_LIVE=1 pnpm --filter @obs/cruces exec vitest run src/shadow-eval.test.ts` | ❌ Wave 0 — crear |
| INTEG-02 | Guard: clasificar-lobby-cli no tiene TieredProvider | unit offline | `pnpm --filter @obs/llm exec vitest run src/integ-scope-guard.test.ts` (o extensión de TIER-05) | ❌ Wave 0 — crear/ampliar |
| INTEG-02 | Provider-guard: todos los providers tienen zod+PII | unit offline | `pnpm --filter @obs/llm exec vitest run src/provider-guard.test.ts` | ❌ Wave 0 — crear |
| INTEG-03 | Rollback: sin env var → DeepSeek directo (wiring) | unit offline | cubierto por test de wiring INTEG-01 | via INTEG-01 test |
| INTEG-03 | Drift canary detecta cambio de modelo | LIVE-gated | `CLASIFICACION_DRIFT_CHECK=1 pnpm --filter @obs/cruces exec vitest run src/drift-canary.test.ts` | ❌ Wave 0 — crear |

### Sampling Rate
- **Por task commit:** `pnpm --filter @obs/llm exec vitest run --run && pnpm --filter @obs/cruces exec vitest run --run`
- **Por wave merge:** Suite completa `@obs/llm` + `@obs/cruces` + `app` verde
- **Phase gate:** Todos los tests offline verdes + CI ampliado verde + shadow-eval LIVE corrido (reportado, no gate automático)

### Wave 0 Gaps
- [ ] `packages/cruces/src/clasificar-fichas-cli.test.ts` — test offline del wiring con MockProvider (cubre INTEG-01 + rollback INTEG-03)
- [ ] `packages/llm/src/provider-guard.test.ts` — enumera providers, asevera assertNoRutInLlmInput (cubre INTEG-02 provider-guard)
- [ ] `packages/llm/src/integ-scope-guard.test.ts` (o extensión de `tiered-scope-guard.test.ts`) — asevera que `clasificar-lobby-cli.ts` no tiene TieredProvider (cubre INTEG-02 guard estático)
- [ ] `packages/cruces/src/shadow-eval.test.ts` — shadow Granite vs DeepSeek, LIVE-gated (cubre INTEG-01 shadow-eval)
- [ ] `packages/cruces/src/drift-canary.test.ts` — probe endpoint, compara modelo servido vs pinneado (cubre INTEG-03 drift)
- [ ] Ampliar `.github/workflows/ci.yml` — steps para `@obs/llm` y `@obs/cruces` (ci.yml actual solo corre `app/`)

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | Sí | `assertNoRutInLlmInput` en TieredProvider (tiered.ts:116-118) + en GraniteProvider (granite.ts:99-100) — defensa en profundidad |
| V2 Authentication | Parcial | `WORKERS_AI_API_TOKEN` leída de env, nunca hardcodeada ni logueada (patrón existente) |
| V4 Access Control | Sí | `assertSensitivityAllowed` en GraniteProvider (granite.ts:102) — dato personal NUNCA a provider que entrena |
| V6 Cryptography | No aplica | No hay crypto nueva |

**Threat patterns específicos de 109:**

| Pattern | STRIDE | Mitigación estándar |
|---------|--------|---------------------|
| RUT en prompt de clasificación | Information Disclosure | `assertNoRutInLlmInput` (user + system) en TieredProvider Y en GraniteProvider — doble defensa |
| Escalera cableada en adjudicación | Tampering | Guard estático (vitest) que falla CI si `clasificar-lobby-cli.ts` contiene `TieredProvider` |
| Provider nuevo sin guards | Elevation of Privilege | Provider-guard (vitest) que enumera providers y asevera presencia de assertNoRutInLlmInput |
| Promote sin evidence | Repudiation | Default = incumbente; `CLASIFICACION_ESCALERA` documentado como "solo setear tras shadow-eval verde" |

---

## Landmines Explícitos

1. **NO tocar `clasificar-lobby-cli.ts`** — construye `MiniMaxProvider` para adjudicación. Su incumbente NO es DeepSeek; no fue lo medido. El guard estático lo asevera.
2. **NO tocar `fichas/src/pipeline-cli.ts`** — extracción strict-schema, vetada es-CL, prompt-cache DeepSeek vivo. TIER-05 ya lo protege y debe seguir verde.
3. **NO revivir `selectProvider`** — dead code confirmado en research 108. El seam correcto es el punto de construcción del CLI.
4. **NO setear `CLASIFICACION_ESCALERA=1` en producción** como parte de este plan — el agente deja default = incumbente. El config-flip es acto posterior del operador tras shadow-eval verde.
5. **NO usar `response_format: json_schema`** con GraniteProvider — usa `tool_choice` forzado (`emit_result`) como MiniMax/Granite@WorkersAI (documentado en `granite.ts:1-30`).
6. **NO hacer el swap antes de que los guards existan** — el PRIMER COMMIT es el provider-guard, no el swap.

---

## Open Questions

1. **Nombre de la env var de control**
   - Lo que sabemos: debe ser un string que el CLI lee en el punto de construcción.
   - Lo que no está fijado: `CLASIFICACION_ESCALERA` vs `ESCALERA_CLASIFICACION_ENABLED` vs otro nombre.
   - Recomendación: `CLASIFICACION_ESCALERA` (corto, específico por tarea, no genérico). El planner puede elegir.

2. **Scope del CI ampliado**
   - Lo que sabemos: el CI actual no cubre packages/llm ni packages/cruces.
   - Lo que no está fijado: si se usa `pnpm --filter @obs/llm test` y `pnpm --filter @obs/cruces test` separados, o un `pnpm -r test` filtrado.
   - Recomendación: steps separados (más granular, más fácil de depurar en CI). Verificar que los packages sin vitest.config no rompen el `-r`.

3. **Ubicación del shadow-eval y drift canary**
   - Lo que sabemos: deben ser LIVE-gated (skip si no hay keys). El scorer de llm-bench es referencia.
   - Lo que no está fijado: si viven como tests vitest en `packages/cruces/src/` o como scripts en `packages/cruces/scripts/`.
   - Recomendación: tests vitest gated por env var (espejo exacto del patrón `CRUCES_GOLDEN_LIVE` de `golden-set.test.ts:122`).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `WORKERS_AI_API_TOKEN` | GraniteProvider (LIVE) | ✓ | — | Sin esta key, no se activa la escalera (`CLASIFICACION_ESCALERA !== "1"`) |
| `CLOUDFLARE_ACCOUNT_ID` | GraniteProvider baseURL | ✓ | — | Idem |
| `DEEPSEEK_API_KEY` | DeepSeekProvider (incumbente + escalación) | ✓ | — | — |
| vitest | Tests offline | ✓ | Configurado en @obs/llm y @obs/cruces | — |
| `tsc -b` exit 0 | Compilación | ✓ | Post-108 confirmado | — |

**Missing dependencies con no fallback:** Ninguna — todos los deps necesarios para la fase offline ya están disponibles. La parte LIVE (shadow-eval + drift) requiere keys que ya están en `.env`.

---

## Sources

### PRIMARY (HIGH — lectura directa del código)
- `packages/cruces/src/clasificar-fichas-cli.ts:198-200` — punto de construcción exacto del provider [VERIFIED: lectura directa]
- `packages/llm/src/tiered.ts:82-116` — `TieredProvider implements LLMProvider`, constructor, `complete<T>`, catch narrowed a `LLMValidationError` [VERIFIED: lectura directa]
- `packages/llm/src/task-ladder.ts:54-116` — `LadderConfig`, `TierSpec`, `buildTieredProvider` [VERIFIED: lectura directa]
- `packages/llm/src/providers/granite.ts:47,61-93` — `GraniteProviderOptions`, `DEFAULT_BASE_URL` con template `{ACCOUNT_ID}`, `DEFAULT_MAX_TOKENS=2048` [VERIFIED: lectura directa]
- `packages/cruces/src/golden/golden-set.ts` — `evaluarGolden`, `gatePasa`, `COBERTURA_MIN=0.7`, `GOLDEN_SET_GATE` (10 casos no-null) [VERIFIED: lectura directa]
- `packages/cruces/src/golden/golden-set.test.ts:122-147` — patrón LIVE-gated (`CRUCES_GOLDEN_LIVE === "1"`, skip sin keys) [VERIFIED: lectura directa]
- `packages/llm/src/tiered-scope-guard.test.ts` — guard TIER-05: `readFileSync` + `expect(source).not.toContain("TieredProvider")`, usa `import.meta.dirname` [VERIFIED: lectura directa]
- `app/lib/lockdown-guard.test.ts:1-80` — patrón readdirSync recursivo, strip de comentarios, fail-loud [VERIFIED: lectura directa]
- `.github/workflows/ci.yml` — scope actual: solo `pnpm --filter ./app test` + tsc --noEmit [VERIFIED: lectura directa]
- `.planning/phases/108-*/108-02-SUMMARY.md` — estado post-108: tsc -b exit 0, suite @obs/llm 144 pass / 3 skip [VERIFIED: lectura directa]
- `.planning/phases/107-*/107-VEREDICTO-LIVE-FULL-2026-07-27.md` — veredicto DEFINITIVO: clasificación Δ 0.0000, Granite ~84× más barato [VERIFIED: lectura directa]

### SECONDARY (HIGH — CONTEXT.md y PROMPT)
- `109-CONTEXT.md` — decisiones LOCKED, scope exacto, orden de la red de seguridad [VERIFIED: lectura directa]
- `.planning/PROMPT-v11.0-PASADA2.md §109` — rector del diseño [VERIFIED: lectura directa]

---

## Metadata

**Confidence breakdown:**
- Swap exacto (construcción): HIGH — leído en el archivo, signatures verificadas, `TieredProvider implements LLMProvider` confirmado
- Guard patterns: HIGH — TIER-05 y lockdown-guard leídos completamente
- Golden CI gate: HIGH — golden-set.test.ts y ci.yml leídos; el gap (CI no cubre packages) es un hecho concreto
- Shadow-eval y drift canary: HIGH (patrón) / MEDIUM (implementación exacta) — el patrón LIVE-gated está verificado; los detalles de implementación son extrapolación del patrón
- Rollback por config: HIGH — env var como switch es el patrón natural y el más simple

**Research date:** 2026-07-27
**Valid until:** Estable mientras no cambien las interfaces de `@obs/llm` (TieredProvider, LadderConfig). Si se modifica `task-ladder.ts` o `tiered.ts` post-108, re-verificar.

---

## RESEARCH COMPLETE

Phase 109 está completamente groundeada: swap de una línea en `clasificar-fichas-cli.ts:200` vía `buildTieredProvider(LadderConfig)` con `GraniteProvider` como primario y `DeepSeekProvider` como fallback, controlado por env var `CLASIFICACION_ESCALERA`, con red de seguridad en el orden LOCKED (provider-guard → guard estático → golden CI → shadow-eval → drift canary).
