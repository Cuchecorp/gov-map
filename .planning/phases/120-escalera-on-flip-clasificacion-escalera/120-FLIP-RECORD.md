# 120 — FLIP RECORD: `CLASIFICACION_ESCALERA=1`

**Fase:** 120-escalera-on-flip-clasificacion-escalera
**Fecha de ejecución:** 2026-07-28
**Plan:** 120-01 (gates 2–4, orden DURO)

**Autorización del operador (verbatim, citada desde `120-CONTEXT.md`):**

> "Flip autorizado… tras shadow-eval verde y con rollback-by-config" (2026-07-27)
>
> "Sí — proceder con gates y flip" (2026-07-28, AskUserQuestion, cierre del paso 1 del orden DURO)

**Nota de secretos (LOCKED):** ningún valor de secreto aparece en este documento. Los
comandos LIVE consumen `.env` mediante `set -a; source .env; set +a`; el registro documenta
NOMBRES de variables (`WORKERS_AI_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DEEPSEEK_API_KEY`),
jamás valores. El `CLOUDFLARE_ACCOUNT_ID` aparece redactado (`***` / `<ACCOUNT_ID>`) en toda
salida transcrita.

---

## Gate 1 — Checkpoint operador (keys Workers AI)

**Estado: CERRADO** (2026-07-28, por el operador en sesión).

El operador confirmó que el `WORKERS_AI_API_TOKEN` presente en `.env` es el provisionado con
permiso Workers AI, y autorizó la secuencia completa gates → flip. Respuesta verbatim:

> "Sí — proceder con gates y flip"

Por decisión de fase, este checkpoint NO se re-pregunta en sesión. Si pese a la confirmación
el token hubiera devuelto 401 en el canary, la salida correcta habría sido cierre honesto sin
flip + re-checkpoint documentado (no ocurrió — ver Gate 2).

---

## Gate 2 — Drift canary

**Comando:**

```
set -a; source .env; set +a
CLASIFICACION_DRIFT_CHECK=1 pnpm --filter @obs/cruces exec vitest run src/drift-canary.test.ts
```

**Hora:** 2026-07-28 16:26 (America/Santiago) — 2026-07-28T20:26:49Z
**Exit code:** 0

**Salida relevante (recortada; `CLOUDFLARE_ACCOUNT_ID` redactado por el propio test):**

```
stdout | src/drift-canary.test.ts > drift canary Workers AI — compara modelo servido vs pinneado (CLASIFICACION_DRIFT_CHECK=1)
[drift-canary] provenance OK:
  modelo servido : @cf/ibm-granite/granite-4.0-h-micro
  modelo pinneado: @cf/ibm-granite/granite-4.0-h-micro
  endpoint       : https://api.cloudflare.com/client/v4/accounts/***/ai/v1
  fecha veredicto: 2026-07-27
  → El veredicto full-40 sigue siendo válido.

 ✓ src/drift-canary.test.ts (1 test) 3587ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
```

**Conteo de vitest:** `1 passed`, `skipped` = 0 (vitest no reportó línea de skipped; el gate fue
efectivamente ejercido — la probe HTTP real corrió 3.59s y emitió el log de provenance).

**Modelo servido confirmado:** `@cf/ibm-granite/granite-4.0-h-micro` — idéntico al pinneado del
veredicto full-40 (2026-07-27). El veredicto full-40 sigue siendo válido.

**VEREDICTO: PASS**

---

## Gate 3 — Shadow-eval LIVE (Granite vs DeepSeek)

**Precondición:** Gate 2 = `VEREDICTO: PASS` — cumplida.

**Comando:**

```
set -a; source .env; set +a
CLASIFICACION_SHADOW_LIVE=1 pnpm --filter @obs/cruces exec vitest run src/shadow-eval.test.ts
```

**Hora:** 2026-07-28 16:27–16:28 (America/Santiago) — 2026-07-28T20:27:47Z → T20:28:56Z
**Exit code:** 0 · **Duración:** 67.09s (66.09s en el bloque LIVE)

**Nota de ejecución (desviación de harness, no de resultado):** la primera invocación con el
comando tal cual falló por el `testTimeout` default de vitest (5000 ms) mientras el bloque LIVE
necesita ~66 s (8 casos × 2 llamadas × delay 2.5 s LOCKED). Se re-invocó el MISMO comando
añadiendo `--testTimeout=600000` — sin tocar código, sin reducir el delay, sin paralelizar y sin
reintentos en ráfaga (el plan pide explícitamente "dar timeout holgado a la invocación"). El
comando efectivo fue:

```
CLASIFICACION_SHADOW_LIVE=1 pnpm --filter @obs/cruces exec vitest run src/shadow-eval.test.ts --testTimeout=600000
```

**Salida relevante (recortada; sin secretos):**

```
stdout | src/shadow-eval.test.ts > shadow-eval Granite vs DeepSeek LIVE — observación pura, NO promueve (CLASIFICACION_SHADOW_LIVE=1)
[shadow-eval] acuerdo=8/8 (100%)
[shadow-eval] cero desacuerdos — paridad perfecta sobre la muestra.

 ✓ src/shadow-eval.test.ts (5 tests) 66091ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

**Conteo de vitest:** `5 passed` (4 del bloque OFFLINE + 1 del bloque LIVE), `skipped` = 0. El
bloque LIVE fue efectivamente ejercido (66 s de llamadas reales a Workers AI y DeepSeek).

**Acuerdo sobre `GOLDEN_SET_GATE`:** `acuerdo=8/8 (100%)`, cero desacuerdos de `sector_codigo`
Granite vs DeepSeek. El `GOLDEN_SET_GATE` tiene 10 casos; el shadow-eval compara únicamente la
ruta pública `clasificarFicha`, por lo que los casos de tipo contraparte (que usan MiniMax) se
saltan por diseño del test — los 8 casos de tipo `ficha` son el universo comparable y todos
acordaron. Esto es consistente con el Δ0.0000 del veredicto full-40.

**VEREDICTO: PASS**

---

## Gate 4 — Rollback-by-config probado (pre-flip)

**Precondición:** Gates 2 y 3 en `PASS` — cumplida. Este gate se corre **antes** del flip por
diseño: la red de seguridad se prueba antes de necesitarla.

**Comando (offline puro, sin `source .env`, sin ningún env-gate LIVE):**

```
pnpm --filter @obs/cruces exec vitest run src/shadow-eval.test.ts src/clasificar-fichas-cli.test.ts
```

**Hora:** 2026-07-28 16:29 (America/Santiago) — 2026-07-28T20:29:26Z
**Exit code:** 0

**Salida:**

```
 ✓ src/clasificar-fichas-cli.test.ts (5 tests) 6ms
 ✓ src/shadow-eval.test.ts (5 tests | 1 skipped) 7ms

 Test Files  2 passed (2)
      Tests  9 passed | 1 skipped (10)
```

El único `skipped` es el bloque LIVE de shadow-eval (correcto y esperado en modo offline: sin
`CLASIFICACION_SHADOW_LIVE=1` no debe correr). Ese bloque ya fue ejercido y aprobado en el Gate 3.

**Ramas de `resolverProvider` cubiertas por aserción (`clasificar-fichas-cli.ts:202-245`):**

1. **Sin `CLASIFICACION_ESCALERA`** → `DeepSeekProvider`, y explícitamente NO `TieredProvider`
   → incumbente **byte-idéntico**. Es la rama del rollback.
2. **`CLASIFICACION_ESCALERA=1` + keys válidas** → `TieredProvider` (escalera Granite→DeepSeek).
3. **`CLASIFICACION_ESCALERA=1` con key vacía** → fallback a `DeepSeekProvider` (Pitfall 2),
   verificado para `WORKERS_AI_API_TOKEN` vacío y para `CLOUDFLARE_ACCOUNT_ID` vacío.

**Naturaleza del rollback (SC#3):** revertir la escalera es **quitar una línea de `.env`**
(`CLASIFICACION_ESCALERA=1`). NO requiere migración de base de datos, NO requiere deploy, NO
requiere cambio de código ni redeploy de Cloudflare — la clasificación corre como CLI local y el
provider se resuelve en tiempo de ejecución desde el entorno. Además, la rama 3 garantiza que
incluso con la variable encendida pero las keys ausentes/vacías el sistema degrada solo al
incumbente en vez de fallar.

**VEREDICTO: PASS**

---

## Veredicto de gates

GATES 2-4 VERDES — EL FLIP PROCEDE (Plan 02)

- Gate 1 (checkpoint operador keys Workers AI): CERRADO
- Gate 2 (drift canary, modelo servido == `@cf/ibm-granite/granite-4.0-h-micro`): PASS
- Gate 3 (shadow-eval LIVE, acuerdo 8/8 sobre los casos ficha del `GOLDEN_SET_GATE`): PASS
- Gate 4 (rollback-by-config probado pre-flip, tres ramas aseveradas): PASS

El veredicto full-40 (2026-07-27) permanece válido y las tres precondiciones del orden DURO
(SC#1 shadow-eval documentada, SC#2 drift canary, SC#3 rollback probado) quedan evidenciadas.

---

## Gate 5 — Flip + humo

**Precondición verificada:** `## Veredicto de gates` contiene `GATES 2-4 VERDES — EL FLIP PROCEDE`.

**Autorizaciones del operador (dos actos previos, ambos citados):**

> "Flip autorizado… tras shadow-eval verde y con rollback-by-config" — **2026-07-27** (autorización del flip)
>
> "Sí — proceder con gates y flip" — **2026-07-28** (checkpoint de provisión de keys Workers AI, CERRADO; ver `## Gate 1`)

**Acto de flip:** APPEND de una sola línea a `.env` (config local del operador; `.env` NO se
commitea). La línea añadida es un nombre de variable y el literal `1` — no es un secreto:

```
CLASIFICACION_ESCALERA=1
```

`.env.example` NO se tocó (ya trae el placeholder desde 109; `git diff --exit-code .env.example` == 0).
El append es idempotente: `grep -c "^CLASIFICACION_ESCALERA=1" .env` == 1.

**Comando de humo (verbatim):**

```
set -a; source .env; set +a
pnpm --filter @obs/cruces exec tsx src/clasificar-fichas-cli.ts --limite 3 --dry-run
```

**Hora:** 2026-07-28 16:32 (America/Santiago) — 2026-07-28T20:32:07Z
**Exit code:** 0

**Salida (íntegra, sin secretos):**

```
cruces-fichas: provider=tiered:granite→deepseek (CLASIFICACION_ESCALERA=1)
cruces-fichas: DRY-RUN → 3 procesados / 2 con sector / 1 sin sector (abstención). Cobertura muestra (3): 67% (gate CRUCE-02 ≥70%)

cruces-fichas DRY-RUN: procesados=3 asignados=2 abstenidos=1 coberturaMuestra=67% dbLoaded=false
```

**Lectura del humo:**

- Línea de provider observada: `provider=tiered:granite→deepseek (CLASIFICACION_ESCALERA=1)` →
  la escalera está realmente encendida (rama 3 de `resolverProvider`).
- NO aparece `fallback a DeepSeek (Pitfall 2)` → las keys Workers AI están efectivas.
- NO aparece la advertencia de URL de Supabase faltante (la que degradaría el dry-run a "sin
  lectura DB") → hubo lectura real de
  `proyecto_ficha` y **`procesados=3` (N > 0)**: el provider no solo se resolvió, se ejerció con
  llamadas LLM reales. El humo es **concluyente**.
- `--dry-run`: se leyó la DB para reportar cobertura, no se escribió nada (`dbLoaded=false`).
- La cobertura 67% de la muestra es informativa de un lote de 3 fichas (1 abstención basta para
  bajar del 70%); el gate CRUCE-02 se evalúa sobre la muestra de corrida completa, no sobre un
  humo de `--limite 3`. No es un hallazgo del flip.

**VEREDICTO: PASS**

---

## Gate 5b — Rollback inverso re-probado

Ciclo **ON → OFF → ON** ejercido en vivo sobre el sistema ya flipeado (SC#3). Las tres corridas
usan el mismo comando acotado; lo único que cambia entre ellas es una línea de `.env`.

**Cautela de shell aplicada:** antes de cada `source .env` se corrió `unset CLASIFICACION_ESCALERA`.
Sin ese `unset`, la variable exportada por la corrida anterior sobreviviría en el shell y la prueba
del rollback sería un **falso negativo** (el CLI vería la var aunque `.env` ya no la tuviera). En la
corrida OFF se verificó explícitamente que la var quedó vacía en el entorno antes de invocar el CLI.

| # | Estado de `.env` | Hora (UTC) | Comando | Línea de provider observada | Exit |
|---|------------------|-----------|---------|------------------------------|------|
| 1 | `CLASIFICACION_ESCALERA=1` presente | 2026-07-28T20:32:07Z | `set -a; source .env; set +a` + `pnpm --filter @obs/cruces exec tsx src/clasificar-fichas-cli.ts --limite 3 --dry-run` | `cruces-fichas: provider=tiered:granite→deepseek (CLASIFICACION_ESCALERA=1)` | 0 |
| 2 | línea **quitada** (rollback) | 2026-07-28T20:33:14Z | `unset CLASIFICACION_ESCALERA` + `set -a; source .env; set +a` + mismo CLI | `cruces-fichas: provider=deepseek (default incumbente)` | 0 |
| 3 | línea **restaurada** (estado final) | 2026-07-28T20:33:28Z | `unset CLASIFICACION_ESCALERA` + `set -a; source .env; set +a` + mismo CLI | `cruces-fichas: provider=tiered:granite→deepseek (CLASIFICACION_ESCALERA=1)` | 0 |

**Salida de la corrida 2 (OFF, rollback):**

```
cruces-fichas: provider=deepseek (default incumbente)
cruces-fichas: DRY-RUN → 3 procesados / 1 con sector / 2 sin sector (abstención). Cobertura muestra (3): 33% (gate CRUCE-02 ≥70%)

cruces-fichas DRY-RUN: procesados=3 asignados=1 abstenidos=2 coberturaMuestra=33% dbLoaded=false
```

En la corrida 2 la línea `provider=tiered` está **ausente** — el incumbente DeepSeek volvió sin
ninguna otra intervención.

**Salida de la corrida 3 (ON restaurado, estado final de la fase):**

```
cruces-fichas: provider=tiered:granite→deepseek (CLASIFICACION_ESCALERA=1)
cruces-fichas: DRY-RUN → 3 procesados / 2 con sector / 1 sin sector (abstención). Cobertura muestra (3): 67% (gate CRUCE-02 ≥70%)

cruces-fichas DRY-RUN: procesados=3 asignados=2 abstenidos=1 coberturaMuestra=67% dbLoaded=false
```

**Naturaleza del rollback (declaración SC#3):** revertir la escalera es **quitar una sola línea de
`.env`**. SIN migración de base de datos, SIN deploy, SIN redeploy de Cloudflare, SIN cambio de
código y sin reinicio de servicio — la clasificación corre como CLI local y `resolverProvider`
resuelve el provider en tiempo de ejecución desde el entorno.

**Nota de lectura (no es un hallazgo del flip):** las corridas ON y OFF difieren en el reparto
asignados/abstenidos (2/1 vs 1/2) sobre 3 fichas. Es una muestra de tamaño 3 comparando dos
modelos distintos; el juicio de paridad Granite vs DeepSeek **no** se hace aquí sino en el Gate 3
(shadow-eval LIVE sobre el `GOLDEN_SET_GATE`, `acuerdo=8/8`) y en el veredicto full-40 (Δ0.0000).
Este gate prueba únicamente el **mecanismo** de encendido/apagado, no la calidad.

**Estado final:** `grep -c "^CLASIFICACION_ESCALERA=1" .env` == 1 → **escalera ENCENDIDA**.

**VEREDICTO: PASS**

---

## Gate 6 — Guards y suite

CERO cambio de código en esta fase. Los guards se corrieron **después** del flip, con la escalera
encendida, precisamente para probar que encenderla no alcanza a las tareas intocables.

**Guards de régimen (offline, sin env-gates LIVE):**

| # | Comando | Resultado | Exit |
|---|---------|-----------|------|
| 1 | `pnpm --filter @obs/llm exec vitest run src/integ-scope-guard.test.ts src/provider-guard.test.ts src/tiered-scope-guard.test.ts` | `3 passed (3)` archivos · `7 passed (7)` tests | 0 |
| 2 | `pnpm --filter app exec vitest run lib/env-example-guard.test.ts` | `1 passed (1)` archivo · `16 passed (16)` tests | 0 |

Los tres guards de alcance viven en `@obs/llm` (no en `@obs/cruces`) y congelan que la escalera
NO alcanza adjudicación de identidad ni extracción strict-schema. Ninguno mordió → sin regresión.

**Cierre general:**

| # | Comando | Resultado | Exit |
|---|---------|-----------|------|
| 3 | `pnpm --filter @obs/cruces exec vitest run` | `7 passed \| 1 skipped (8)` archivos · `42 passed \| 3 skipped (45)` tests | 0 |
| 4 | `pnpm --filter @obs/llm exec vitest run` | `17 passed \| 1 skipped (18)` archivos · `158 passed \| 3 skipped (161)` tests | 0 |
| 5 | `npx tsc -b` | sin salida (typecheck limpio de paquetes y raíz) | 0 |

Los `skipped` son los bloques env-gated LIVE (shadow-eval LIVE, drift canary, smoke de `@obs/llm`),
correctos y esperados en modo offline — ya fueron ejercidos y aprobados en los Gates 2 y 3.

**Hora:** 2026-07-28 16:34 (America/Santiago) — 2026-07-28T20:34Z

**VEREDICTO: PASS**

---

## Estado final CRON-03

**ESCALERA ENCENDIDA EN CLASIFICACIÓN**

- `.env` del operador contiene `CLASIFICACION_ESCALERA=1` (exactamente una línea).
- La escalera activa es `tiered:granite→deepseek`: Granite `@cf/ibm-granite/granite-4.0-h-micro`
  como primario, DeepSeek como escalación — probado en vivo en el Gate 5 y restaurado en el 5b.
- El encendido cubre **únicamente la clasificación de fichas** (`clasificarFicha` vía
  `clasificar-fichas-cli`), la única tarea APPROVED por el veredicto full-40 (be0b1b9, 2026-07-27).

**Tareas INTOCADAS (constancia explícita, SC#5):** la **adjudicación de identidad** y la
**extracción strict-schema** NO fueron tocadas por esta fase — ni su código, ni su provider, ni su
configuración. La escalera no las alcanza, y eso queda congelado por `integ-scope-guard`,
`provider-guard` y `tiered-scope-guard`, los tres verdes al cierre (Gate 6) con la escalera ya
encendida.

**Nota para Phase 121 (ESCALERA-DOC) y Phase 125 (E2E de flags):**
`CLASIFICACION_ESCALERA` **NO pertenece a la familia `*_PUBLIC_ENABLED`**. No es un flag de
exposición pública: es un selector de provider LLM interno. Su encendido está **autorizado por el
operador** (2026-07-27) con precondiciones cumplidas y documentadas en este mismo archivo (Gates
1–6). El E2E de 125 no debe tratarlo como "flag no autorizado que debe estar OFF"; el estado
esperado es **ON**, con este registro como su justificante.

**Nota de alcance operativo:** la clasificación **no corre en ningún cron de CI** (los workflows
solo ejecutan tests). El flip vive en el `.env` **local del operador**. Esta fase NO creó cron nuevo
ni GH secret; si algún día la clasificación se agenda en CI, ahí sí habrá que provisionar
`WORKERS_AI_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` como secrets de repositorio.

**Rollback disponible en todo momento:** quitar la línea `CLASIFICACION_ESCALERA=1` de `.env`
devuelve el incumbente DeepSeek byte-idéntico. Sin migración, sin deploy, sin cambio de código
(probado en vivo, Gate 5b).

**Secretos:** cero valores de secreto en este documento. Solo nombres de variables; el
`CLOUDFLARE_ACCOUNT_ID` aparece redactado (`***`) en toda salida transcrita.
