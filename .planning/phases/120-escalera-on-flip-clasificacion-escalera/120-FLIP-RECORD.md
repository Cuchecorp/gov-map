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

_(pendiente de ejecución en esta corrida)_
