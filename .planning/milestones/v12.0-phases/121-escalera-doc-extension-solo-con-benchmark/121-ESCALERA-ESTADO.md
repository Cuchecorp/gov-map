# 121 — ESCALERA-ESTADO: extensión solo con benchmark

**Fecha:** 2026-07-28
**Requisito:** CRON-04
**Fase:** 121-escalera-doc-extension-solo-con-benchmark

> **Regla LOCKED: ante la duda, siempre calidad.**

Este documento registra, tarea LLM por tarea LLM, el estado de extensión de la escalera
(`tiered:granite→deepseek`) y la evidencia de benchmark que lo respalda. Su propósito es que
nadie extienda la escalera por intuición ni por memoria: cada estado lleva cita a un archivo
de evidencia, y cada estado pendiente declara qué evidencia concreta lo cambiaría.

**Regla de fidelidad de este documento:** toda cifra que aparece aquí existe literalmente en el
archivo de origen citado. No hay números de memoria, ni redondeos nuevos, ni métricas derivadas.
Lo que el veredicto no midió se declara como no medido, no se estima.

---

## Fuentes de evidencia

| Fuente (ruta desde la raíz del repo) | Qué aporta | Fecha / commit |
|---|---|---|
| `.planning/milestones/v11.0-phases/107-bench-p1b-adapters-candidatos-juez-vs-humanos-veredicto-por-/107-VEREDICTO-LIVE-FULL-2026-07-27.md` | Veredicto full-40 por tarea (routing, clasificación, extracción, juez) con Δcalidad, escalares y métricas separadas | 2026-07-27, commit `be0b1b9` |
| `.planning/phases/120-escalera-on-flip-clasificacion-escalera/120-FLIP-RECORD.md` | Justificante del encendido de la escalera en clasificación: drift canary, shadow-eval LIVE, rollback probado, guards post-flip | 2026-07-28 |
| `packages/llm/src/integ-scope-guard.test.ts`, `packages/llm/src/provider-guard.test.ts`, `packages/llm/src/tiered-scope-guard.test.ts` | Congelan en tests el alcance de la escalera (qué NO alcanza) | verdes al cierre de la Phase 120 |

**Cobertura del veredicto (citada de `107-VEREDICTO-LIVE-FULL-2026-07-27.md`):** corrida
`LLM_BENCH_LIVE=1 LLM_BENCH_LIMIT=0` sobre `candidatos.live.test.ts` — **PASSED (996.5s ≈ 16.6 min)**.
Cobertura: **golden es-CL FROZEN COMPLETOS (no la muestra de 10)**. Candidato + incumbente + juez en
UNA sola corrida, apples-to-apples. El juez Phi respondió los 32 casos (0 `sinVeredicto`).

---

## Tabla maestra

| Tarea | Estado | Evidencia (cita) | Qué haría falta |
|---|---|---|---|
| routing | NO EXTENDIDA | `107-VEREDICTO-LIVE-FULL-2026-07-27.md` (`be0b1b9`): `incumbent-stays: DeepSeek`, Δcalidad **−0.1000** (< −0.03); Granite cobertura **0.5** vs DeepSeek **0.6**; FLIP vs el 10-sample (que dio **+0.10**) | Un full-40 (o mayor) con el candidato ganando en TODAS las métricas separadas y sin flip entre muestra y full |
| clasificación | EXTENDIDA | `107-VEREDICTO-LIVE-FULL-2026-07-27.md` (`be0b1b9`): `approved-model: Granite`, Δcalidad **0.0000** (≥ −0.03), ambos cobertura **1.0** (paridad exacta), fail-rates no-peor. Encendido registrado en `120-FLIP-RECORD.md` (canary PASS, `acuerdo=8/8 (100%)`, rollback probado) | Nada — ya extendida; sostener el estado exige que el drift canary siga en PASS (ver §Condición de vigencia) |
| juez | NO EXTENDIDA | `107-VEREDICTO-LIVE-FULL-2026-07-27.md` (`be0b1b9`) BENCH-04, n=32: Phi `recall_rechazo` **0.9167** vs DeepSeek-como-juez incumbente **0.75**; Δcalidad **+0.1667**; `precision_ok` **0.9500** | Benchmark de paridad juez-vs-juez con recall ≥ el actual y falsos ESCALATE no peores; mientras tanto ESCALATE-ONLY |
| extracción | NO EXTENDIDA | `107-VEREDICTO-LIVE-FULL-2026-07-27.md` (`be0b1b9`): veto es-CL por corto-circuito; `negacion.accuracy` Granite **0/3 = 0** vs DeepSeek **1/3 = 0.333**; value P/R Granite **0.098/0.182** vs DeepSeek **1.0/1.0** | Benchmark es-CL con `negacion.accuracy` ≥ el incumbente sobre set congelado + strict-schema validado por zod, manteniendo el veto es-CL como gate |
| adjudicación | INTOCABLE | No es una métrica: decisión de diseño explícita de v11.0 (SEED-001). El RUT jamás cruza a un LLM ajeno al pipeline aprobado; lo crítico/sensible se queda en MiniMax. Congelado además por `integ-scope-guard` / `provider-guard` / `tiered-scope-guard` | N/A por diseño: ninguna cantidad de benchmark la extiende; sólo una decisión de operador con dossier |

---

## Cómo leer los estados

El vocabulario es cerrado. Sólo existen tres valores:

- **EXTENDIDA** — la escalera está encendida para esa tarea, con benchmark de paridad demostrado
  sobre el set congelado completo. Hoy sólo la clasificación.
- **NO EXTENDIDA** — el incumbente se queda. Puede haber evidencia parcial o incluso favorable en
  algún eje, pero no basta para promover. **No significa "sin evaluar":** las cuatro tareas no
  extendidas fueron medidas en el full-40, y tres de ellas perdieron o quedaron cortas con
  evidencia explícita (routing por Δ negativo, extracción por veto es-CL, juez por falta de un
  benchmark de paridad para el rol de decisor).
- **INTOCABLE** — no es candidata a benchmark de extensión en absoluto. No se mide, no se compara,
  no se promueve. Sólo cambia por decisión de operador con dossier. Hoy sólo la adjudicación de
  identidad.

**Nota de vocabulario:** el veredicto full-40 usa la palabra "INTOCABLE" con otro sentido
(«el incumbente no se mueve»). En ESTE documento `INTOCABLE` está reservado a lo que no es
candidato a benchmark. La reconciliación explícita está en la sección de extracción.

---

## Recuadro — la lección: por qué extensión SOLO con benchmark

> El caso **routing** es la razón de existir de este documento.
>
> En la muestra de 10 (pasada 1), routing salió **approved (Granite, +0.10)**. Sobre el set
> completo congelado, el full-40 lo revirtió a **incumbent-stays (−0.10)**. Es el único cambio de
> signo del contraste, y el veredicto lo rotula así: **«SÍ — flip. Manda el full-40.»**
>
> Conclusión operativa: **una muestra chica es direccional, no decisoria.** Ninguna integración se
> flipea sin el set completo congelado. Si el resultado de la muestra y el del set completo
> discrepan, manda el set completo — sin excepción y sin re-corridas selectivas.
>
> **Ante la duda, siempre calidad.**

El registro del veredicto lo deja escrito: «La muestra de 10 era direccional pero NO suficiente para
flipear una integración: routing lo prueba. La regla "antes de flipear producción, confirmar sobre
los 40" queda VINDICADA.»

---

## Clasificación

- **Estado:** EXTENDIDA.
- **Evidencia:** `107-VEREDICTO-LIVE-FULL-2026-07-27.md` (`be0b1b9`) — `approved-model: Granite`,
  Δcalidad **0.0000** (≥ −0.03), ambos modelos cobertura **1.0** (paridad exacta), fail-rates
  no-peor; «Paridad exacta sostenida sobre los 40. Única tarea aprobada para Granite». Métricas
  separadas del mismo archivo: Granite `structured_fail` **0.0000** y zod repaired/terminal
  **0.0000 / 0.0000**, costo/1k casos **$0.0107** frente a **$0.8944** de DeepSeek (~**84×** más
  barato), con p50/p95 **1692 / 7746** ms vs **476 / 514** ms del incumbente.
  Justificante de encendido: `120-FLIP-RECORD.md` (2026-07-28) —
  Gate 2 drift canary **PASS** (modelo servido `@cf/ibm-granite/granite-4.0-h-micro` == pinneado);
  Gate 3 shadow-eval LIVE **PASS** con `acuerdo=8/8 (100%)` sobre los 8 casos de tipo ficha
  comparables del `GOLDEN_SET_GATE` (el gate tiene 10 casos; los de tipo contraparte usan MiniMax y
  se saltan por diseño del test), cero desacuerdos de `sector_codigo`; Gate 4 rollback-by-config
  probado pre-flip con tres ramas aseveradas; Gate 5b ciclo ON → OFF → ON ejercido en vivo.
- **Lectura:** es la única tarea con paridad demostrada sobre el set completo, y la única donde
  optimizar costo no cuesta calidad. El encendido no se apoyó sólo en el veredicto: se exigieron
  canary de modelo servido, observación en sombra y rollback probado antes de flipear. El alcance
  del encendido es estrecho por construcción — cubre `clasificarFicha` vía `clasificar-fichas-cli`
  y nada más.
- **Qué evidencia concreta la extendería:** N/A en el sentido de promoción — ya está extendida. Lo
  que corresponde es **sostenerla**: el drift canary debe seguir en PASS. Si el modelo servido deja
  de coincidir con el pinneado, el estado cae (ver §Condición de vigencia).

## Routing

- **Estado:** NO EXTENDIDA.
- **Evidencia:** `107-VEREDICTO-LIVE-FULL-2026-07-27.md` (`be0b1b9`) —
  `incumbent-stays: DeepSeek`, Δcalidad **−0.1000** (< −0.03), Granite cobertura **0.5** vs DeepSeek
  **0.6**. El mismo archivo registra el contraste: 10-sample `approved (Granite, +0.10)` → full-40
  `incumbent-stays (−0.10)`, «SÍ — flip. Manda el full-40».
- **Lectura:** sobre el set completo Granite queda por debajo de paridad. El resultado favorable de
  la muestra chica no se sostuvo. El veredicto es explícito: «routing NO se integra». No hay aquí
  una duda que resolver con criterio: hay una medición que dice que no.
- **Qué evidencia concreta la extendería:** un nuevo full-40 (o mayor) sobre golden es-CL congelado,
  en corrida apples-to-apples con el incumbente, donde el candidato gane en **todas** las métricas
  separadas y **sin flip** entre la muestra y el set completo. Un resultado favorable sólo en la
  muestra no cuenta.

## Extracción

- **Estado:** NO EXTENDIDA.
- **Evidencia:** `107-VEREDICTO-LIVE-FULL-2026-07-27.md` (`be0b1b9`) — `incumbent-stays: DeepSeek`
  por **veto es-CL (corto-circuito)**: `negacion.accuracy` Granite **0/3 = 0** vs DeepSeek
  **1/3 = 0.333**; value P/R Granite **0.098/0.182** vs DeepSeek **1.0/1.0**. El veredicto lo
  describe como «Veto es-CL DURO disparó directo (ya no perdió sólo en el agregado como en el
  10-sample). Granite fabrica/invierte valores legales.»
- **Lectura:** el veto es-CL se disparó **por corto-circuito**, no por agregado: la métrica que lo
  disparó es `negacion.accuracy` (0 sobre 3 casos de negación). Un modelo que invierte una negación
  en texto legal chileno no es candidato, por más barato que sea.
  **Reconciliación de vocabulario (importante):** el veredicto full-40 escribe para extracción
  «DeepSeek se queda. INTOCABLE», mientras que este documento la registra **NO EXTENDIDA**. No hay
  contradicción: en el veredicto "INTOCABLE" significa «el incumbente no se mueve»; en ESTE
  documento `INTOCABLE` está reservado a lo que no es candidato a benchmark en absoluto (sólo
  adjudicación). Extracción **sí** es candidata — un benchmark es-CL que superara el veto podría
  extenderla — luego le corresponde NO EXTENDIDA. Aparte de eso, su strict-schema queda congelado
  por `integ-scope-guard` y `provider-guard`, que es un eje distinto del estado de extensión.
- **Qué evidencia concreta la extendería:** un benchmark es-CL sobre set congelado donde
  `negacion.accuracy` del candidato sea **≥** la del incumbente, más strict-schema validado por zod,
  manteniendo el veto es-CL como gate de corto-circuito (no como promedio ponderado).

## Juez

- **Estado:** NO EXTENDIDA.
- **Evidencia:** `107-VEREDICTO-LIVE-FULL-2026-07-27.md` (`be0b1b9`), BENCH-04 PhiJudge vs HUMANO,
  n=32 — `recall_rechazo` **0.9167** (11 de 12 malas atrapadas) vs el incumbente
  DeepSeek-como-juez **0.75**; Δcalidad **+0.1667** (≥ −0.05); `precision_ok` **0.9500** (19/20);
  `sinVeredicto` **0**; sin sesgo de auto-preferencia detectable (`porProductor` OK-rate:
  deepseek 6/8, minimax 5/8, granite 5/8, **phi 4/8**).
- **Lectura:** el instrumento está **validado contra humano** y es fuerte — el propio veredicto dice
  «NO es sello-de-goma». Pero un recall alto frente a humano no es un benchmark de paridad para
  **promoverlo a decisor**: el juez permanece **ESCALATE-ONLY**, es decir, puede pedir escalación
  pero no decide por sí mismo. El veredicto además anota que esto «No gatea 109» y que el
  juez-de-identidad sigue DIFERIDO por diseño.
- **Qué evidencia concreta la extendería:** un benchmark de paridad **juez-vs-juez** (no juez-vs-humano)
  con recall ≥ el actual y falsos ESCALATE no peores que el incumbente, sobre set congelado.
  Mientras eso no exista, ESCALATE-ONLY.

## Adjudicación de identidad

- **Estado:** INTOCABLE.
- **Evidencia:** no es una métrica y no debe fabricarse una. Es una **decisión explícita de diseño
  de v11.0 (SEED-001)**: el RUT jamás cruza a un LLM ajeno al pipeline aprobado, y lo
  crítico/sensible se queda en MiniMax. El veredicto full-40 lo recoge al margen de sus tablas:
  «el juez-de-identidad sigue DIFERIDO por diseño, y la adjudicación golden-1263 es INTOCABLE».
  `120-FLIP-RECORD.md` deja constancia de que la fase del flip **no la tocó** —ni su código, ni su
  provider, ni su configuración— y de que eso queda congelado por los tres guards de
  `packages/llm/src/`.
- **Lectura:** el estado es INTOCABLE **por decisión, no por omisión**. No es que falte medirla: es
  que no se mide. Sacarla del pipeline aprobado sería un cambio de régimen de tratamiento de datos
  personales, no una optimización de costo.
- **Qué evidencia concreta la extendería:** **N/A por diseño.** Ninguna cantidad de benchmark
  extiende la adjudicación. Un cambio requeriría una decisión de operador con dossier —
  el mismo régimen de los flips legales del proyecto—, jamás un Δcalidad favorable.

---

## Régimen de guards

El alcance de la escalera no está congelado sólo en prosa: está congelado en tests. Los tres guards
viven en `@obs/llm` (no en `@obs/cruces`):

| Guard | Qué congela |
|---|---|
| `packages/llm/src/integ-scope-guard.test.ts` | Que la integración de la escalera no alcanza tareas fuera de la aprobada (adjudicación de identidad, extracción strict-schema) |
| `packages/llm/src/provider-guard.test.ts` | Que el provider asignado a cada tarea es el sancionado, y que no se sustituye por vía indirecta |
| `packages/llm/src/tiered-scope-guard.test.ts` | Que el `TieredProvider` sólo se resuelve para el alcance autorizado |

Comando:

```
pnpm --filter @obs/llm exec vitest run src/integ-scope-guard.test.ts src/provider-guard.test.ts src/tiered-scope-guard.test.ts
```

**Estado registrado (Gate 6 de `120-FLIP-RECORD.md`, 2026-07-28):** `3 passed (3)` archivos ·
`7 passed (7)` tests, exit 0. Se corrieron **después** del flip, con la escalera ya encendida,
precisamente para probar que encenderla no alcanza a las tareas intocables. Ninguno mordió → sin
regresión.

---

## Condición de vigencia — drift canary

El estado EXTENDIDA de clasificación **no es permanente**. Vale mientras el modelo servido por
Workers AI coincida con el pinneado del veredicto full-40
(`@cf/ibm-granite/granite-4.0-h-micro`, 2026-07-27).

Re-ejecución (env-gated):

```
CLASIFICACION_DRIFT_CHECK=1 pnpm --filter @obs/cruces exec vitest run src/drift-canary.test.ts
```

El test es `packages/cruces/src/drift-canary.test.ts`. En el Gate 2 de la Phase 120 reportó
provenance OK con modelo servido == modelo pinneado, exit 0.

**Regla de invalidación:** si el canary reporta mismatch, el veredicto full-40 queda **invalidado
para esa tarea**, el estado EXTENDIDA **cae** y la clasificación vuelve a **NO EXTENDIDA** hasta que
un benchmark nuevo sobre el set congelado la re-apruebe. No se "asume equivalente" un modelo
sucesor.

**Rollback correspondiente:** quitar la línea `CLASIFICACION_ESCALERA=1` de `.env`. Sin migración,
sin deploy, sin redeploy de Cloudflare, sin cambio de código y sin reinicio de servicio — probado en
vivo en el Gate 5b (ciclo ON → OFF → ON, tres corridas, exit 0 en las tres).

**Aclaración heredada de `120-FLIP-RECORD.md`:** `CLASIFICACION_ESCALERA` **NO pertenece a la
familia `*_PUBLIC_ENABLED`**. No es un flag de exposición pública sino un selector de provider LLM
interno, autorizado por el operador con precondiciones documentadas. El E2E de la Phase 125 no debe
tratarlo como "flag no autorizado que debe estar OFF": su **estado esperado es ON**.

---

## Alcance y límites declarados

1. La escalera encendida cubre **únicamente la clasificación de fichas** (`clasificarFicha` vía
   `clasificar-fichas-cli`). Ninguna otra tarea LLM la usa.
2. La clasificación **no corre en ningún cron de CI**: los workflows sólo ejecutan tests. El flip
   vive en el `.env` **local del operador**. Si algún día se agenda en CI, habrá que provisionar
   `WORKERS_AI_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` como secrets de repositorio.
3. El veredicto se midió sobre **golden sets es-CL congelados**, no sobre tráfico de producción. La
   paridad demostrada es paridad sobre ese set, con ese tamaño, en esa fecha.
4. El shadow-eval comparó **8 casos** (los de tipo ficha del `GOLDEN_SET_GATE`); los de tipo
   contraparte usan MiniMax y quedan fuera por diseño del test.
5. Este documento **no autoriza nada**: registra estados y sus condiciones. Cualquier benchmark
   nuevo para extender tareas es trabajo de un milestone futuro, fuera de v12.0.
6. **Secretos:** cero valores de credencial en este documento. Se nombran variables
   (`WORKERS_AI_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLASIFICACION_ESCALERA`) y la única asignación
   con valor es `CLASIFICACION_ESCALERA=1`, que es un flag interno, no un secreto.
