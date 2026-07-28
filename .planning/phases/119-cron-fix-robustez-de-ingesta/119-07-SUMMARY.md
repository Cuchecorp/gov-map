---
phase: 119-cron-fix-robustez-de-ingesta
plan: 07
subsystem: cierre-de-fase
tags: [cron, gaps, cierre, freshness, pg_cron, deuda-operador, g8, g9, g11, g12-119]
requires:
  - "118-CRON-VERDICTS.md §4 y §4.1 (fuente de verdad de los 11 gaps)"
  - "118-OPERATOR-CHECKPOINT.md (deuda G8/G9 ya emitida — no se re-pide)"
  - "los 6 SUMMARYs de la fase 119"
provides:
  - ".planning/phases/119-cron-fix-robustez-de-ingesta/119-GAP-CLOSURES.md (registro auditable por gap)"
  - "atribución declarada de la señal lobby-leylobby en catalog.ts (G12-119) + 3 tests que la congelan"
  - "criterio de cierre y fecha de evaluación para G11 (2026-08-10)"
affects:
  - "Phase 125 (E2E re-verifica pnpm freshness sobre el deploy real)"
  - "cierre del milestone v12.0"
tech-stack:
  added: []
  patterns:
    - "cierre por evidencia re-ejecutable: cada cifra lleva su comando"
    - "divergencia honesta anclada al criterio literal, en vez de reinterpretarlo a conveniencia"
key-files:
  created:
    - .planning/phases/119-cron-fix-robustez-de-ingesta/119-GAP-CLOSURES.md
  modified:
    - packages/freshness/src/catalog.ts
    - packages/freshness/src/evaluate.test.ts
decisions:
  - "G1 cierra el MECANISMO pero NO el criterio literal de 118 (`lobby-leylobby` a stale:false): cumplirlo exigiría marcar `ingestado_hasta = hoy` sin un dato nuevo de un parlamentario, es decir fabricar cobertura. Queda como divergencia honesta anclada, con la causa estructural probada (leylobby barre el EJECUTIVO)."
  - "G11 queda ABIERTO pese a que su premisa resultó FALSA: 2026-07-25 es sábado, no viernes, así que el 'hueco de día hábil' nunca existió. Refutar una sospecha no es acumular evidencia de cadencia ⇒ desenlace (iii), evaluable desde 2026-08-10."
  - "G12-119 se mitiga declarando el CAVEAT en el código con tests, NO reapuntando la señal: cambiar la tabla medida es un cambio de comportamiento del instrumento con dos opciones legítimas que merecen decidirse explícitamente, no de paso."
  - "D-PROB-119 (orden de etapas invertido en probidad) se registra como deuda con pasos y criterio de cierre; NO se reordenó, por instrucción explícita."
metrics:
  tasks: 4
  commits: 3
  duration: ~55min
  completed: 2026-07-28
  tests: "packages/freshness 73 → 76; packages 1616 passed; app 1560 passed; tsc -b exit 0"
requirements: [CRON-02]
---

# Phase 119 Plan 07: Cierre de fase — registro de gaps Summary

Los 11 gaps de la auditoría 118 quedan con estado explícito y evidencia re-ejecutable en
`119-GAP-CLOSURES.md`: **8 cerrados, 2 diferidos como deuda de operador, 1 abierto en observación**,
más 2 gaps nuevos abiertos con sus pasos. Ninguno se cerró por inferencia, ninguna deuda de operador
se volvió a pedir, y el criterio literal de 118 que no se cumple (G1) se declara como divergencia
anclada en vez de reinterpretarse.

## Re-verificacion G8/G9/G11

Las tres cosas que el agente no puede cerrar por sí mismo, re-verificadas y honestamente
etiquetadas.

### G8 — Cloudflare: **deuda de operador ABIERTA**

`gh secret list --repo Cuchecorp/gov-map` (2026-07-28) — NOMBRES y fechas, cero valores:

| Secret | Actualizado |
|---|---|
| DEEPSEEK_API_KEY | 2026-07-09 |
| R2_ACCESS_KEY_ID | 2026-07-09 |
| R2_BUCKET | 2026-07-09 |
| R2_ENDPOINT_URL | 2026-07-09 |
| R2_SECRET_ACCESS_KEY | 2026-07-09 |
| SUPABASE_API_URL | 2026-06-23 |
| SUPABASE_SECRET_KEY | 2026-06-23 |

`CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` **AUSENTES** ⇒ el workflow `deploy-cloudflare` NO
se re-disparó (fallaría por la misma causa, y disparar para ver fallar no es evidencia nueva). La
deuda queda abierta con puntero a `118-OPERATOR-CHECKPOINT.md`. **Cero re-emisión de checkpoint,
cero carga de valores.** No bloquea ninguna ingesta.

### G9-gemini — **deuda de operador ABIERTA**

`GEMINI_API_KEY` sigue **AUSENTE** en la misma salida. La parte YAML del gap ya la cerró el plan 06
(la línea que apuntaba a `secrets.SUPABASE_URL` se eliminó porque `pipeline-cli.ts:150` ya cae a
`SUPABASE_API_URL`). El dispatch de prueba de `fichas-backfill` **NO se disparó**, y así se declara.
Mismo tratamiento que G8: sin re-pedir, sin cargar.

### G11 — PG-5 `actualidad-materializar`: **ABIERTO, con la premisa REFUTADA**

`select jobid, status, start_time from cron.job_run_details where jobid = 5 order by start_time desc
limit 60;` (psql read-only) — **9 filas, todas `succeeded`, cero `failed`**. Conteo crudo por día,
sin interpretarlo de más:

| día | día de la semana | corridas | esperadas |
|---|---|---|---|
| 2026-07-24 | Fri | 2 | 4 (el job se dio de alta ese día: las de 11:07 y 14:07 son anteriores) |
| 2026-07-27 | Mon | 4 | 4 |
| 2026-07-28 | Tue | 3 | 4 (la de 20:07 aún no ocurría; lectura a las 18:59 UTC) |

**La premisa de 118 estaba mal.** 118 §4 registró que PG-5 "no registra corridas el **viernes**
2026-07-25, día hábil". El propio Postgres lo refuta:

```
2026-07-24|Fri|5
2026-07-25|Sat|6
2026-07-26|Sun|7
2026-07-27|Mon|1
```

**2026-07-25 es SÁBADO.** El schedule `7 11,14,17,20 * * 1-5` no espera corrida en fin de semana:
el silencio del 25 y del 26 es el cron **cumpliendo** su restricción, no perdiéndola. El hueco de
día hábil nunca existió. Control anti-poda: jobid 1 conserva 114.733 filas desde 2026-06-18 y jobid
2 conserva 3.829 — no hay retención borrando evidencia.

**Desenlace: el tercero de los tres admisibles — la ventana de esta fase no alcanza las 2 semanas.**
Hay 2 días hábiles de cadencia completa observada. **No se cierra**, ni siquiera con la premisa
refutada a favor: refutar una sospecha elimina la sospecha, no la reemplaza por evidencia de
cadencia sostenida.

- **Criterio de cierre:** `select start_time::date, count(*) from cron.job_run_details where
  jobid=5 group by 1 order by 1` con **4 corridas en cada día hábil** desde 2026-07-27, sin ningún
  día hábil vacío ni incompleto.
- **Evaluable a partir del 2026-08-10.**
- **Si aparece un día hábil vacío antes de esa fecha:** escala a P1 con la hipótesis
  `job startup timeout`. Hoy sin sustento: no hay ningún `failed` en las 9 filas.

## Qué se hizo

### Task 1 — re-verificaciones + fix acotado de `G12-119` (commit `9345547`)

Además de las tres re-verificaciones de arriba, se aplicó como **validar-y-arreglar** el hallazgo
que 119-06 dejó para el cierre: `catalog.ts` afirmaba que `lobby_ingesta_estado.ingestado_hasta`
"solo lo escribe el conector leylobby". Es **falso e invertido** — `marcarIngestado` vive en el
writer **compartido** (`writer-supabase.ts:145`) y lo invocan **los dos** conectores; las 136 filas
vigentes las escribió el de la **Cámara** (`run-camara-lobby.ts:164`).

El fix es acotado y **no reapunta la señal**: el CAVEAT queda declarado en el código con sus dos
escritores citados por archivo:línea, y **3 tests lo congelan** (`describe("G12-119 …")`). La frase
errónea sobrevive **una sola vez**, entrecomillada y seguida de su refutación —borrarla dejaría el
registro sin memoria del error—, y el test prohíbe que vuelva como afirmación. Freshness **73 → 76**
tests.

No se reapuntó la señal porque cambiar la tabla medida es un cambio de comportamiento del
instrumento, con dos opciones legítimas (renombrar + señal propia sobre `source_snapshot`, o retirar
la entrada) que merecen decidirse explícitamente. Registrado como **G12-119** con pasos y criterio.

### Task 2 — batería de régimen

| Check | Resultado |
|---|---|
| `pnpm test` | **packages 1616 passed** (+11 skipped, 18 paquetes) · **app 1560 passed / 107 archivos** · 0 fallos |
| `pnpm typecheck` (`tsc -b`) | **exit 0** |
| 9 guards de `ci.yml`, uno por uno | env-example **16** · lockdown 22 · anti-insinuación 40 · bento-guards 114 · bento-coherencia 8 · name-match-rut 15 · notif/money/vsim-antiflip 20 c/u — todos verdes |
| `STRICT=1 check-crons.sh` | `=== RESULTADO: 0 falta(s) · STRICT=1`, exit 0 |
| `git diff --stat …/118-CRON-VERDICTS.md` | **vacío** (118 no se reescribe) |
| `select source, count(*) from source_snapshot group by 1` | `agenda\|1 · infoprobidad\|3 · leyes\|4380 · lobby-leylobby\|2` ⇒ **4 fuentes**, falta `identity` |
| Replay `--from-r2` | **EJECUTADO** contra objeto real de R2 (probidad, dry-run): 1062 declaraciones / 136 confirmados, `ingestado_hasta=2026-07-23` **del crudo, no del reloj** |
| `pnpm freshness` | tabla completa pegada en el registro; **5 filas stale, todas clasificadas, ninguna es avería real** |

**Sobre el delta de tests:** el suite de la **app** queda en **1560**, idéntico a la base declarada
de la fase, porque **ningún plan de 119 tocó `app/`** (la fase es conectores + instrumento). El
crecimiento vive en `packages/`: freshness 47→76, lobby 71→82, agenda 119→131, identity 114→119,
probidad 49→54. Se declara además que la cifra "1560" que los SUMMARYs de la fase citan como "suite
completa" es la del proyecto **app**, no la suma global — la suma global hoy es **3176**.

**`source_snapshot`: la cifra "2 → 5" NO se declara alcanzada.** Son 4, y la que falta es
**`identity`**: su fila sólo se escribe en la corrida LOCAL del operador con `.env` completo (en
`backup-parlamentario.yml` no hay service key ⇒ writer `null`, declarado en código). Nombrada, no
disimulada.

**Clasificación de cada `stale`** (i avería / ii gating declarado / iii falta de datos honesta):
`lobby-camara` **(ii)** WAF, sin `schedule:`, el `failure` es el guard de 10.240 bytes funcionando ·
`lobby-leylobby` **(iii)** el cron corre y la fuente entregó crudo hoy; lo viejo es la cobertura por
parlamentario, que este conector no produce por diseño · `fichas` **(iii)** + deuda G9, el workflow
existe y jamás corrió · `chilecompra` y `servel` **(ii)** gating legal MONEY/SERVEL.

### Task 3 — `119-GAP-CLOSURES.md` (commit `611a6f9`, 500 líneas)

Tabla maestra con los 11 `Gn` (ninguno omitido, ninguno con estado vacío) + los 2 nuevos; sección
por gap no cerrado con razón, pasos, responsable y criterio verificable; §7 "Lo que NO se tocó y por
qué" re-declarando los estados esperados de §4.1 para que la fase siguiente no los tome como
backlog; §8 "Degradación honesta — evidencia" con 11 renglones por conector (incluida la **mutación**
que hace fallar 3 tests); §9 "Dos etapas y rate-limit intactos" con los `git diff --stat` **vacíos**
de toda la capa de política; y §10 con los 4 success criteria del ROADMAP evaluados uno por uno.

**El anclaje de G1** (§2 del registro): el criterio literal de 118 —«`pnpm freshness` debe pasar
`lobby-leylobby` a `stale:false`»— **NO se cumple**, y el renglón lo dice. Lo que se cerró es el
mecanismo (el cursor avanza con datos y sólo con datos, es monotónico, y una corrida sin confirmados
escribe cero filas). Lo que impide el criterio es que **no hay datos que ingerir por esa vía**: el
alcance LOCKED del cron son instituciones del EJECUTIVO y `leylobby-audiencias` tiene 32 filas todas
`no_confirmado` en toda su historia. Cumplir el criterio exigiría marcar `ingestado_hasta = hoy` sin
un dato nuevo — fabricar cobertura, justo lo que el criterio 2 del ROADMAP prohíbe.

### Task 4 — lectura fría del operador

**AUTO-APROBADO por modo autónomo** (directiva de la corrida). Se registra como tal, **no** como
validación humana. La lectura fría sigue pendiente; su ausencia no invalida ninguna evidencia del
registro, que es re-ejecutable comando por comando.

## Veredicto de los 4 success criteria del ROADMAP §119

| # | Veredicto |
|---|---|
| 1 — gaps cerrados o diferidos con razón y pasos | **PASS** |
| 2 — degradación honesta, jamás filas inventadas | **PASS** |
| 3 — dos etapas + hash-check + rate-limit intactos | **PASS con limitación declarada** — la limitación es el orden invertido de etapas en probidad (`D-PROB-119`), que no se reordenó por instrucción explícita |
| 4 — `pnpm freshness` refleja el estado real | **PASS con limitación declarada** — la limitación es el rótulo de `lobby-leylobby` (`G12-119`), declarado en código con tests pero no reapuntado |

## Deviations from Plan

**1. [Rule 1 - Bug] La premisa de G11 era un error de día de la semana**
- **Found during:** Task 1, al leer `cron.job_run_details` con `to_char(start_time,'Dy')`.
- **Issue:** 118 §4 trató 2026-07-25 como viernes (día hábil) y construyó sobre eso la sospecha de
  "cuatro ventanas perdidas". Es sábado. El schedule `* * 1-5` no espera corrida ese día.
- **Fix:** el registro documenta la refutación con la salida de `generate_series` + `isodow`, y el
  gap **sigue abierto** por la regla de no cerrar por inferencia. `118-CRON-VERDICTS.md` **no se
  tocó** (es inmutable en esta fase); la corrección vive en `119-GAP-CLOSURES.md` §6.
- **Commit:** `611a6f9`

**2. [Rule 2 - Funcionalidad crítica faltante] Atribución invertida en `catalog.ts` (G12-119)**
- **Found during:** Task 1 (hallazgo heredado de 119-06, procesado aquí como validar-y-arreglar).
- **Issue:** el comentario del catálogo afirmaba una exclusividad de escritura que es falsa; un
  lector concluiría que leylobby lleva 36 días caído cuando corrió hace 6 y trajo datos.
- **Fix:** CAVEAT declarado con los dos escritores citados por archivo:línea + 3 tests que congelan
  la corrección. La señal **no** se reapuntó (decisión declarada); gap registrado con pasos.
- **Files:** `packages/freshness/src/catalog.ts`, `packages/freshness/src/evaluate.test.ts`
- **Commit:** `9345547`

**3. [Alcance] La tabla maestra tiene 13 renglones, no los 11 del acceptance criterion**
- Los 11 `Gn` de 118 están todos, ninguno omitido. Los 2 adicionales (`G12-119`, `D-PROB-119`) son
  los hallazgos nuevos que las constraints de la corrida mandaban incorporar al registro. Se numeran
  con sufijo `-119` para no colisionar con la numeración de 118.

## Known Stubs

Ninguno.

## Threat Flags

Ninguno. **T-119-21** (information disclosure): mitigado — sólo NOMBRES y fechas de `gh secret
list`; ninguna URL de DB, ningún token, ningún RUT en el registro (`grep -i 'api_key\|secret_key\|
token='` revela 7 ocurrencias, **todas nombres de variable**, cero valores). **T-119-22**
(repudiation): mitigado — cada cifra lleva su comando y la fecha ancla 2026-07-28; nada se copió de
118 sin re-medir. **T-119-23** (tampering): mitigado — `git diff` sobre `118-CRON-VERDICTS.md`
**vacío** y `STRICT=1 check-crons.sh` en `0 falta(s)`. **T-119-SC**: cero paquetes instalados.

## Self-Check: PASSED

- `.planning/phases/119-cron-fix-robustez-de-ingesta/119-GAP-CLOSURES.md` FOUND (13 renglones `| G`,
  contiene `G11`)
- `packages/freshness/src/catalog.ts` FOUND (contiene `CAVEAT lobby-leylobby`)
- `packages/freshness/src/evaluate.test.ts` FOUND (contiene `G12-119`)
- Commits `9345547`, `611a6f9` FOUND en `git log`
