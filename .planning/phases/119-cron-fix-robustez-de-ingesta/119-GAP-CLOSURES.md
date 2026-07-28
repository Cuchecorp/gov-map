---
documento: 119-GAP-CLOSURES
fase: 119-cron-fix-robustez-de-ingesta
fuente_de_verdad_de_los_gaps: "118-CRON-VERDICTS.md §4 (índice compacto + detalle) y §4.1"
fecha_ancla_observaciones: 2026-07-28
cifras: vivas — re-medidas en esta fase, NO heredadas de 118
regla_de_evidencia: "cada cifra lleva el comando que la produjo; lo que no se pudo verificar se declara como PASS con limitación (precedente 114-03), jamás como PASS pelado"
secretos: "sólo NOMBRES y fechas; cero valores, cero URLs de DB"
inmutabilidad_de_118: "118-CRON-VERDICTS.md NO se reescribe — `git diff` sobre él sale vacío (verificado)"
---

# Phase 119 — Registro de cierre por gap

Los 11 gaps que `118-CRON-VERDICTS.md` §4 dejó como backlog, con su estado, quién lo cerró y con
qué evidencia. Los ids `Gn` son los de 118 y se citan tal cual. Un gap nuevo detectado durante la
fase se numera `G12-119` para no colisionar con la numeración de 118.

**Resumen: 8 cerrados · 2 diferidos como deuda de operador · 1 abierto en observación · 1 gap nuevo
abierto (`G12-119`, mitigado parcialmente) · 1 deuda declarada nueva (`D-PROB-119`).**

---

## 1. Tabla maestra

| Gn | prio original | estado | plan que lo cerró | evidencia | nota |
|---|---|---|---|---|---|
| G1 | P1 | **cerrado (mecanismo) · criterio original NO cumplido — divergencia honesta anclada, ver §2** | 119-06 | `packages/lobby/src/ingest-run.ts:322` (`marcados: Map<id,hasta>` desde la fecha máxima de las audiencias) + `packages/lobby/src/writer-supabase.ts:125,145` (guarda monotónica) + 5 tests de `<behavior>`, mutación en memoria ⇒ 3 fallan; corrida LOCAL acotada: `count,max(ingestado_hasta)` = `136\|2026-06-22` ANTES y DESPUÉS | El cursor avanza **con datos y sólo con datos**. `pnpm freshness` sigue `stale:true` y ESO ES LO CORRECTO — ver §2 |
| G2 | P2 | **cerrado** | 119-01 | `catalog.ts` con `workflowYml: null` ×2 (`grep -c` = 2 exacto); `pnpm freshness 2>&1 \| grep -c 'HTTP 404'` pasó de `2` a `0`; `ls .github/workflows/{chilecompra,servel}-weekly.yml` sigue fallando (cero YAML creados) | Se eligió la vía (a) recomendada por 118: crear YAML vacíos para callar un 404 habría sido fabricar cobertura |
| G3 | P2 | **cerrado** | 119-02 | entrada `actualidad-refresh` viva (`actualidad_senal`, umbral 2 d) — hoy `2026-07-28 18:20 · 0 días · OK`; bloque `pg_cron` con los 5 jobs y umbral DERIVADO del schedule (`umbralDesdeSchedule`, función pura); `HUECOS DECLARADOS DE COBERTURA` en el JSDoc de `catalog.ts` para W-3 y W-7; freshness 47 → 73 tests | Los 5 jobs entran al exit code: mostrarlos sin contarlos dejaría exit 0 ante una avería |
| G4 | P1 | **cerrado** | 119-01 | `lobby-camara`: `lobby_audiencia` → `lobby_contraparte`; `fichas`: `proyecto` → `proyecto_ficha`; `ghRunEsAveria()` entra al `stale` como OR. Diff en vivo: `lobby-camara` false→**TRUE** (`dias>umbral`), `fichas` false→**TRUE** (`gh-failure`); `REGRESION stale->fresh: []` | El fix **muerde en producción**: dos verdes prestados cayeron a STALE honesto. Ver `G12-119` por la dirección espejo (rojo prestado) |
| G5 | P1 | **cerrado en código · verificación de cierre PASS con limitación declarada** | 119-04 | `SnapshotWriter` montado en agenda / identity / lobby-leylobby (`grep -c SnapshotWriter` = 3 / 8 / 4). `select source, count(*) from source_snapshot group by 1` (psql read-only, **2026-07-28**): `agenda\|1 · infoprobidad\|3 · leyes\|4380 · lobby-leylobby\|2` ⇒ **4 fuentes distintas, no 5** | Falta `identity`: su fila sólo se escribe en la corrida LOCAL del operador con `.env` completo (en `backup-parlamentario.yml` no hay service key ⇒ writer `null`, declarado en código). Ver §3 |
| G6 | P1 | **cerrado** | 119-03 | `existed` consumido en los 3 llamadores (`grep -c existed` agenda/probidad/identity = 7/4/5); guard `[skip] sin novedades` ×2 en agenda; tests RED commiteados fallando (3/3/4) antes de cada fix. Observado en vivo: `[skip] sin novedades — camara tabla-sala 2026-W31` y `[skip] sin novedades — leylobby AA001/2024/p1` | En probidad el `existed` queda **visible pero sin ahorro**, por el orden de etapas — deuda `D-PROB-119`, §3 |
| G7 | P1 | **cerrado** | 119-05 | `--from-r2` en agenda / probidad / lobby-camara con la firma dorada. Replay **RE-EJECUTADO en este plan (2026-07-28)** contra un objeto real de R2 — salida en §4 | El replay verifica el sha contra la key y NUNCA degrada a re-fetch |
| G8 | P2 | **diferido — deuda de operador ABIERTA** | — | `gh secret list --repo Cuchecorp/gov-map` (2026-07-28): `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` **AUSENTES** (salida completa en §5) | Acto de operador. Pasos ya emitidos en `118-OPERATOR-CHECKPOINT.md` — **no se re-piden**. No bloquea ninguna ingesta |
| G9 | P2 | **parte YAML cerrada · `GEMINI_API_KEY` diferido — deuda de operador ABIERTA** | 119-06 (YAML) | `! grep -q 'secrets.SUPABASE_URL' .github/workflows/fichas-backfill.yml` OK (count 0) — `pipeline-cli.ts:150` ya cae a `SUPABASE_API_URL`, así que la línea se ELIMINÓ en vez de remapearse. `GEMINI_API_KEY` sigue AUSENTE en `gh secret list` | El dispatch de prueba (paso 3 del fix de 118) **NO se disparó**, y así se declara: sin la key fallaría |
| G10 | P2 | **cerrado** | 119-01 | `tsx ^4.22.4` en `devDependencies` de la raíz (lockfile: 3 líneas, cero paquetes nuevos). `pnpm freshness --json` desde la raíz emite JSON (primer carácter `{`); `--help` exit 0 sin `command not found: tsx` | La vía (b) (`pnpm --filter exec`) se descartó EMPÍRICAMENTE: mueve el cwd y rompe `loadEnv` — el gotcha v8.1 exacto |
| G11 | P2 | **ABIERTO en observación · premisa REFUTADA por evidencia nueva** | — (re-observado en 119-07) | `select jobid,status,start_time from cron.job_run_details where jobid=5 …` y conteo por día — §6 | **2026-07-25 es SÁBADO, no viernes**: el schedule `* * 1-5` no espera corrida ese día. Detalle y criterio de cierre en §6 |
| G12-119 | **nuevo (P2, instrumentación)** | **abierto · mitigado parcialmente en 119-07** | 119-07 (declaración) | `catalog.ts` CAVEAT + 3 tests que congelan la corrección (freshness 73 → 76) | La señal `lobby-leylobby` mide cobertura de lobby POR PARLAMENTARIO, no la frescura de leylobby. Ver §3 |
| D-PROB-119 | **nuevo (P2, ingesta)** | **abierto — deuda declarada, NO tocada por instrucción** | — | `packages/probidad/src/run-probidad-todos.ts` (comentario que declara la divergencia) | Orden de etapas invertido en probidad. Ver §3 |

---

## 2. G1 — anclaje obligatorio del criterio original

118 §4 fijó para G1 un criterio de cierre **literal**:

> «4) Verificación de cierre: `pnpm freshness` debe pasar `lobby-leylobby` a `stale:false`
> (hoy 36 d / umbral 7, `catalog.ts:273`)»

**Ese criterio NO se cumple.** Al 2026-07-28, `pnpm freshness` dice:

```
lobby-leylobby   | 2026-06-22        | 36    | 7       | success @ 2026-07-22   | 2026-07-28 18:49:24.22 | STALE (dias>umbral)
```

**Qué SÍ se cerró (el mecanismo).** El cursor `lobby_ingesta_estado.ingestado_hasta` ahora avanza
**desde los datos** —la fecha máxima de las audiencias ingeridas de cada parlamentario, nunca el
reloj— y es **monotónico** (`writer-supabase.ts:125,145`: lee la cobertura vigente y descarta los
ids que no avanzarían). Una corrida que no confirma a nadie escribe **cero filas**, y el Test 3 lo
asevera explícitamente. Mutación en memoria (añadir un `marcarIngestado` incondicional al cierre de
la corrida): 3 de los 5 tests fallan ⇒ los tests muerden.

**Por qué el criterio original no se cumple.** No es que el mecanismo falle: es que **no hay datos
de parlamentarios que ingerir por esta vía**, y por dos razones que se suman:

1. **Estructural (la de fondo).** El alcance LOCKED del cron son instituciones del **EJECUTIVO**
   (`lobby-leylobby-weekly.yml:3-5`: "la Cámara y el Senado NO publican en leylobby.gob.cl"). Sus
   sujetos pasivos son autoridades de gobierno, no parlamentarios; y `lobby_ingesta_estado` está
   claveada por `parlamentario_id`. **Este cron no puede, por diseño, avanzar ese marcador.**
   Evidencia: `select origen, estado_vinculo, count(*) from lobby_audiencia group by 1,2` ⇒
   `leylobby-audiencias\|no_confirmado\|32` — **32 filas, todas `no_confirmado`, cero confirmadas en
   toda su historia**.
2. **Defecto real, corregido en 119-06.** La CLI corría siempre con `maestra: []`, así que
   `reconciliarSujeto` no podía confirmar a nadie ni en principio. Corregido (`cargarMaestraSeed()`,
   186 parlamentarios verificados). **Con la maestra CARGADA la corrida sigue confirmando a cero**
   — lo que prueba que la causa de fondo es la 1, no la 2. Decirlo al revés habría sido inventar un
   cierre.

**Nota — la fuente NO está degradando.** El criterio original suponía implícitamente que un
`stale:true` acusaba una avería. Las tres señales juntas dicen otra cosa: `ghRun: success @
2026-07-22`, `r2Snapshot: 2026-07-28` (la fuente entregó crudo fresco **hoy**), y la cobertura por
parlamentario genuinamente vieja. No hubo 403/503: el log de la corrida `29920799120` cierra con
`degradaciones: 0` sobre 25 audiencias reales.

**Divergencia honesta, no criterio reinterpretado.** Ponerse el criterio original a favor exigiría
marcar `ingestado_hasta = hoy` sin un solo dato nuevo de un parlamentario — es decir, **fabricar
cobertura**, exactamente lo que el criterio 2 del ROADMAP §119 prohíbe. Se rechazó. Lo que sí
corresponde arreglar es el **rótulo**, y de ahí sale `G12-119`.

---

## 3. Gaps NO cerrados — razón, pasos y criterio de cierre

### G5 — `source_snapshot` en 4 fuentes, no 5 (PASS con limitación declarada)

- **Razón:** `identity` tiene el writer montado y probado, pero su fila sólo se escribe en la
  corrida **LOCAL** del operador con `.env` completo. En `backup-parlamentario.yml:38-42` sólo se
  mapean los cuatro `R2_*`, sin service key ⇒ `buildSnapshotWriter` devuelve `null` y se emite
  `sin credenciales Supabase -> NO se registra fila en source_snapshot (esperado en GitHub
  Actions…)`. No se fabricó credencial ni se asumió que el cron lo cubriría.
- **Quién:** operador (una corrida) o el agente en una fase futura si se autoriza.
- **Pasos:** correr `packages/identity/src/seed-cli.ts` con `--r2` y `.env` completo desde la raíz.
- **Criterio de cierre verificable:** `select source, count(*) from source_snapshot group by 1`
  incluye la fila `identity\|>=1`.

### G8 — Cloudflare (deuda de operador abierta)

- **Razón:** `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` ausentes del repo remoto (verificado
  hoy, §5). El agente **jamás** carga valores de secrets.
- **Quién:** operador. **Pasos exactos y permiso mínimo: `118-OPERATOR-CHECKPOINT.md`** — ya
  emitidos una vez, **no se re-piden aquí**.
- **Criterio de cierre:** los dos nombres aparecen en `gh secret list --repo Cuchecorp/gov-map` **y**
  una corrida de `deploy-cloudflare` concluye `success`.
- **Impacto:** ninguno sobre la ingesta; el deploy real de PROD se hace localmente con wrangler
  OAuth. Es la deuda 110-02, confirmada abierta al 2026-07-28.

### G9 (parte `GEMINI_API_KEY`) — deuda de operador abierta

- **Razón:** `GEMINI_API_KEY` ausente (§5). La parte YAML del gap sí quedó cerrada en 119-06.
- **Quién:** operador. Pasos en `118-OPERATOR-CHECKPOINT.md` — no se re-piden.
- **Criterio de cierre:** el nombre aparece en `gh secret list` **y** un `workflow_dispatch`
  acotado de `fichas-backfill` concluye `success`. Hoy ese dispatch **no se disparó** y así se
  declara: sin la key fallaría, y disparar para ver fallar no aporta evidencia nueva.

### G12-119 (NUEVO) — la señal `lobby-leylobby` no es atribuible a su cron

- **Hallazgo (de 119-06, procesado aquí):** `catalog.ts` afirmaba que
  `lobby_ingesta_estado.ingestado_hasta` "solo lo escribe el conector leylobby". Es **falso e
  invertido**: `marcarIngestado` vive en el writer **compartido**
  (`packages/lobby/src/writer-supabase.ts:145`) y lo invocan **los dos** conectores — el de la
  Cámara (`packages/lobby/src/run-camara-lobby.ts:164`) y, desde 119-06, el de leylobby
  (`packages/lobby/src/ingest-run.ts:322`). Empíricamente las **136 filas** vigentes
  (`max = 2026-06-22`) las escribió el conector de la **CÁMARA**.
- **Consecuencia:** la señal rotulada `lobby-leylobby` mide la **cobertura de lobby por
  parlamentario**, no la frescura de leylobby. Es la dirección **espejo** del verde prestado que G4
  erradicó: acá el **rojo** es prestado. Hoy un lector concluiría que leylobby lleva 36 días caído
  cuando corrió hace 6 y trajo datos.
- **Mitigación aplicada en 119-07 (acotada, sin reapuntar la señal):** el CAVEAT quedó **declarado
  en el código** con sus dos escritores citados por archivo:línea, y **3 tests lo congelan**
  (`evaluate.test.ts`, describe `G12-119`): la afirmación invertida no puede volver como
  afirmación, y la frase original sobrevive una sola vez, entrecomillada y seguida de su
  refutación. Freshness 73 → **76** tests.
- **Por qué NO se reapuntó la señal aquí:** cambiar la tabla medida es un cambio de comportamiento
  del instrumento fuera del alcance de un plan de cierre, y con dos opciones legítimas que merecen
  decidirse explícitamente, no de paso.
- **Quién:** agente, en una fase futura.
- **Pasos / opciones (elegir UNA):**
  1. **Renombrar** la entrada a `lobby-cobertura-parlamentario` (que es lo que mide) y **añadir**
     una entrada propia de leylobby sobre su huella en `source_snapshot`
     (`where source = 'lobby-leylobby'`, existente desde 2026-07-28, hoy `2026-07-28 18:49`); o
  2. **retirar** la entrada `lobby-leylobby` declarando que este conector no produce señal de
     cobertura por parlamentario.
- **Criterio de cierre verificable:** ninguna entrada de `CATALOG` mide una tabla cuyo escritor no
  sea exclusivamente el cron que la entrada nombra — asertado por test, como ya lo está el hueco de
  W-3/W-7.

### D-PROB-119 (NUEVO) — probidad tiene el orden de etapas invertido

- **Hallazgo declarado en 119-03 (no tocado allí ni aquí, por instrucción explícita).**
  `run-probidad-todos.ts` hace la **carga a Supabase** (upserts + `marcarIngestado`) **ANTES** de
  persistir el crudo agregado en R2. Mientras siga así, el `existed` del 412 queda visible pero **no
  puede ahorrar trabajo**: las consultas SPARQL y todos los upserts ya se gastaron cuando llega.
- **Relación con la regla LOCKED:** la regla de `CLAUDE.md` es "el crudo se persiste PRIMERO". Este
  conector cumple ambas etapas pero en orden invertido — el crudo **sí** queda en R2 y el replay
  `--from-r2` **sí** funciona (§4), de modo que no hay pérdida de trazabilidad; lo que se pierde es
  el ahorro del hash-check.
- **Prioridad sugerida:** P2 (eficiencia y cumplimiento del orden, no corrección del dato).
- **Quién:** agente.
- **Pasos:** el crudo ya se acumula en `crudos[]` ⇒ mover el `putImmutable` + la escritura de
  `source_snapshot` **antes** del primer upsert y del `marcarIngestado`.
- **Criterio de cierre verificable:** un test que, con el store devolviendo `existed:true`, aserte
  que `upsertDeclaraciones` **no** se invoca.

### G11 — ver §6 (abierto en observación, con premisa refutada)

---

## 4. Batería de régimen — resultados

Todo con la salida pegada; ninguna URL ni credencial impresa.

| Check | Comando | Resultado |
|---|---|---|
| Suite completa | `pnpm test` | **packages 1616 passed** (+11 skipped, 18 paquetes) · **app 1560 passed / 107 archivos** · 0 fallos |
| Typecheck | `pnpm typecheck` (`tsc -b`) | **exit 0** |
| `check-crons.sh` de 118 | `STRICT=1 bash .planning/phases/118-…/check-crons.sh` | **`=== RESULTADO: 0 falta(s) · STRICT=1`, exit 0** |
| Inmutabilidad de 118 | `git diff --stat …/118-CRON-VERDICTS.md` | **vacío** |

**Delta de tests.** El suite de la **app** queda en **1560**, idéntico a la base declarada de la
fase: **ningún plan de 119 tocó `app/`** (la fase es conectores + instrumento de frescura). El
crecimiento vive en `packages/`: freshness 47 → 57 → 73 → **76** (G10/G2/G4, luego G3, luego los 3
tests de `G12-119` de este plan), lobby 71 → 75 → **82**, agenda 119 → 123 → **131**, identity 114 →
**119**, probidad 49 → **54**. Declaro que la cifra "1560" que los SUMMARYs de la fase citan como
"suite completa" es la del proyecto **app**, no la suma global; la suma global hoy es **3176**
(1616 + 1560).

### Guards de régimen de `ci.yml`, uno por uno

```
env-example       -> Tests  16 passed (16)     <-- nombrado explícitamente: cero variables nuevas
lockdown          -> Tests  22 passed (22)
anti-insinuacion  -> Tests  40 passed (40)
bento-guards      -> Tests 114 passed (114)
bento-coherencia  -> Tests   8 passed (8)
name-match-rut    -> Tests  15 passed (15)
notif-antiflip    -> Tests  20 passed (20)
money-antiflip    -> Tests  20 passed (20)
vsim-antiflip     -> Tests  20 passed (20)
```

### Verificación delegada por 119-04 (G5) — `source_snapshot`

`select source, count(*) from source_snapshot group by 1 order by 1;` (psql read-only, URL nunca
impresa), **2026-07-28**:

```
agenda|1
infoprobidad|3
leyes|4380
lobby-leylobby|2
```

**Fuentes distintas: 4.** La cifra "2 → 5" **NO se declara alcanzada**. La que falta es **`identity`**
(razón y criterio de cierre en §3). Sí se alcanzaron `agenda` y `lobby-leylobby`, ambas net-new de
esta fase.

### Verificación delegada por 119-05 (G7) — replay `--from-r2` **EJECUTADO**

Re-ejecutado en este plan (2026-07-28) contra un objeto real de R2, `--dry-run`, sin escribir PROD y
sin tocar ninguna fuente:

```
$ pnpm --filter @obs/probidad exec tsx src/run-probidad-todos-cli.ts \
    --from-r2 infoprobidad/declaraciones/2026-07-23/1383f924…f0c2.json --dry-run

probidad-replay: leyendo crudo desde R2 (infoprobidad/declaraciones/2026-07-23/1383f924….json)
                 — CERO consultas al CPLT
probidad-replay: 1062 versiones / 136 confirmados (ingestado_hasta=2026-07-23, del crudo — NO del reloj)
probidad-todos REPLAY DRY-RUN: declaraciones=1062 bienes=0 familiares=0 confirmados=136
                 ingestado_hasta=2026-07-23 (del crudo)
```

El camino negativo también quedó ejercitado en vivo — el replay **falla loud** ante una key sin sha
completo, en vez de adivinar:

```
probidad-todos FALLÓ: --from-r2: r2Path no reconocido (infoprobidad/declaraciones/2026-07-23/1383f924);
se espera infoprobidad/declaraciones/<YYYY-MM-DD>/<sha256>.json
```

`ingestado_hasta` sale **de la key del crudo, nunca de `new Date()`** (T-119-15): un replay del
pasado no puede fingir frescura.

Los otros dos replays (agenda `2026-W30` → 37 citaciones; lobby-camara → 17.730 audiencias / 136
confirmados, CERO fetch a camara.cl) quedaron ejecutados y registrados en `119-05-SUMMARY.md`; no se
repitieron aquí porque uno de ellos consumiría un objeto de 17k filas sin aportar evidencia nueva.

### `pnpm freshness` — tabla completa y clasificación de cada `stale`

```
Fuente           | Último upsert     | Días  | Umbral  | GH última corrida      | R2 snapshot            | Estado
-----------------------------------------------------------------------------------------------------------------
leyes            | 2026-07-27 21:38  | 0     | 7       | success @ 2026-07-27   | 2026-07-27 21:38:22.83 | OK
leyes-min-edad   | 2026-07-09 04:34  | 19    | 45      | success @ 2026-07-27   | n/d (sin snapshots)    | OK
agenda           | 2026-07-28 18:15  | 0     | 7       | success @ 2026-07-27   | 2026-07-28 18:15:06.04 | OK
lobby-camara     | 2026-06-22 19:17  | 35    | 14      | failure @ 2026-07-07   | n/d (sin snapshots)    | STALE (dias>umbral)
lobby-leylobby   | 2026-06-22        | 36    | 7       | success @ 2026-07-22   | 2026-07-28 18:49:24.22 | STALE (dias>umbral)
probidad         | 2026-07-23 12:37  | 5     | 30      | success @ 2026-07-23   | n/d (sin snapshots)    | OK
fichas           | 2026-07-10 21:21  | 17    | 30      | n/d (sin corridas)     | n/d (sin snapshots)    | STALE (gh-failure)
chilecompra      | —                 | ?     | 30      | n/d (sin workflow)     | n/d (sin snapshots)    | STALE (sin dato)
servel           | —                 | ?     | 365     | n/d (sin workflow)     | n/d (sin snapshots)    | STALE (sin dato)
actualidad-refre | 2026-07-28 18:20  | 0     | 2       | success @ 2026-07-28   | n/d (sin snapshots)    | OK

Job (pg_cron)              | Schedule                 | Última corrida    | Horas   | Umbral h | Estado
-------------------------------------------------------------------------------------------------------
process-ingest-jobs        | 30 seconds               | 2026-07-28 19:07  | 0.0     | 0.25     | OK
cleanup-net-http           | */15 * * * *             | 2026-07-28 19:00  | 0.1     | 0.5      | OK
net-materializar-aristas   | 17 3 * * *               | 2026-07-28 03:17  | 15.9    | 48       | OK
cruces-materializar        | 23 3 * * *               | 2026-07-28 03:23  | 15.8    | 48       | OK
actualidad-materializar    | 7 11,14,17,20 * * 1-5    | 2026-07-28 17:07  | 2.0     | 66       | OK
```

**Cada fila `stale:true`, con su causa clasificada** en (i) avería real · (ii) gating declarado ·
(iii) falta de datos honesta:

| fuente | causa | por qué |
|---|---|---|
| `lobby-camara` | **(ii) gating declarado** | `lobby-camara-weekly.yml:14-17` no tiene `schedule:` por el WAF de camara.cl (§4.1 de 118). El `failure @ 2026-07-07` es el **guard de 10.240 bytes funcionando**, no el cron rompiéndose. La vía viva es la corrida LOCAL (`docs/runbooks/cron-local-fallback.md`) |
| `lobby-leylobby` | **(iii) falta de datos honesta** | El cron corre (`success @ 2026-07-22`) y la fuente entregó crudo fresco hoy (`r2Snapshot 2026-07-28`); lo viejo es la cobertura POR PARLAMENTARIO, que este conector no produce por diseño. Ver §2 y `G12-119` |
| `fichas` | **(iii) falta de datos honesta + deuda de operador** | `n/d (sin corridas)`: el workflow existe y jamás corrió. No puede correr mientras `GEMINI_API_KEY` esté ausente ⇒ ligado a **G9**. Antes de 119-01 esta señal estaba **verde prestada** midiendo `proyecto` |
| `chilecompra` | **(ii) gating declarado** | MONEY gated legalmente (`0023_dinero.sql:46`); cursor con 0 filas. §4.1 de 118 lo registra como estado esperado |
| `servel` | **(ii) gating declarado** | SERVEL gated legalmente (`0025_agregacion.sql:46`). Ídem |

**Cero filas `stale` sin explicación. Cero (i) avería real.** El exit code 1 de `pnpm freshness` es
legítimo (hay stale), no un fallo del instrumento — G10.

---

## 5. Re-verificación de las deudas de operador (nombres y fechas, cero valores)

`gh secret list --repo Cuchecorp/gov-map`, **2026-07-28**:

| Secret | Actualizado |
|---|---|
| DEEPSEEK_API_KEY | 2026-07-09 |
| R2_ACCESS_KEY_ID | 2026-07-09 |
| R2_BUCKET | 2026-07-09 |
| R2_ENDPOINT_URL | 2026-07-09 |
| R2_SECRET_ACCESS_KEY | 2026-07-09 |
| SUPABASE_API_URL | 2026-06-23 |
| SUPABASE_SECRET_KEY | 2026-06-23 |

**Ausentes:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (G8) y `GEMINI_API_KEY` (G9).
Sin cambios respecto de la lectura de 118. **Cero re-emisión de checkpoint** (los pasos ya están en
`118-OPERATOR-CHECKPOINT.md`, pedidos una vez) y **cero carga de valores** por el agente.

---

## 6. G11 — re-observación de `pg_cron` jobid=5

`select jobid, status, start_time from cron.job_run_details where jobid = 5 order by start_time desc
limit 60;` (psql read-only) — **9 filas, todas `succeeded`, cero `failed`:**

```
5|succeeded|2026-07-28 17:07:00.020479+00
5|succeeded|2026-07-28 14:07:00.016294+00
5|succeeded|2026-07-28 11:07:00.136315+00
5|succeeded|2026-07-27 20:07:00.016007+00
5|succeeded|2026-07-27 17:07:00.072486+00
5|succeeded|2026-07-27 14:07:00.018638+00
5|succeeded|2026-07-27 11:07:00.016424+00
5|succeeded|2026-07-24 20:07:00.017603+00
5|succeeded|2026-07-24 17:07:00.134404+00
```

**Conteo crudo por día** (`group by start_time::date`), sin interpretarlo de más:

| día | día de la semana | corridas | esperadas |
|---|---|---|---|
| 2026-07-24 | **Fri** | 2 | 4 (el job se creó ese día: 11:07 y 14:07 son anteriores a su alta) |
| 2026-07-27 | **Mon** | 4 | 4 |
| 2026-07-28 | **Tue** | 3 | 4 (la de las 20:07 aún no ocurría al momento de la lectura, 18:59 UTC) |

### La premisa de G11 estaba mal: 2026-07-25 es SÁBADO

118 §4 registró que «PG-5 no registra corridas el **viernes 2026-07-25**, día hábil». La lectura del
propio Postgres lo refuta:

```
select d::date, to_char(d,'Dy'), extract(isodow from d) from generate_series('2026-07-23','2026-07-29','1 day') d;
2026-07-23|Thu|4
2026-07-24|Fri|5
2026-07-25|Sat|6
2026-07-26|Sun|7
2026-07-27|Mon|1
2026-07-28|Tue|2
```

**2026-07-24 es el viernes; 2026-07-25 es sábado.** El schedule `7 11,14,17,20 * * 1-5` **no espera
ninguna corrida** en sábado ni domingo, de modo que el "hueco de día hábil" que G11 describía **no
existe**: el silencio del 25 y del 26 es el cron cumpliendo su restricción, no perdiéndola. Lo del
viernes 24 (2 de 4) es el arranque: el job se dio de alta ese día.

**Control anti-poda** (que el silencio no sea retención borrando filas):
`select jobid, count(*), min(start_time), max(start_time) from cron.job_run_details group by 1` ⇒
jobid 1 conserva **114.733** filas desde `2026-06-18`, jobid 2 conserva **3.829**. No hay poda.

### Desenlace: **ABIERTO**, con criterio de cierre y fecha

De los tres desenlaces admisibles se aplica el tercero — **la ventana de esta fase no alcanza las 2
semanas**. Al 2026-07-28 hay **2 días hábiles** de cadencia completa observada (lun 27: 4/4; mar 28:
3/3 con la cuarta ventana aún por ocurrir). No se cierra por inferencia, ni siquiera con la premisa
refutada a favor: refutar la lectura del día de la semana **elimina la sospecha**, no la reemplaza
por evidencia de cadencia sostenida.

- **No hay huecos nuevos** en días hábiles desde el 2026-07-27.
- **Hipótesis de escalada a P1 descartada por ahora:** no hay ningún `failed` en las 9 filas, así
  que la hipótesis `job startup timeout` (el único fallo observado, en PG-1) no tiene sustento aquí.
- **Criterio de cierre verificable:** `select start_time::date, count(*) from cron.job_run_details
  where jobid=5 group by 1 order by 1` debe mostrar **4 corridas en cada día hábil** desde
  2026-07-27, sin ningún día hábil vacío ni incompleto.
- **Evaluable a partir del: 2026-08-10** (dos semanas completas de días hábiles desde el 2026-07-27).
- **Si aparece un día hábil vacío antes de esa fecha**, escala a P1 con la hipótesis
  `job startup timeout` y se investiga.

---

## 7. Lo que NO se tocó y por qué (§4.1 de 118, re-declarado)

Para que la fase siguiente **no** lo tome como backlog. Cada uno tiene una decisión declarada en el
código o en el YAML — esa es la diferencia entre un gap y un estado esperado:

- **MONEY / SERVEL sin scheduler.** `0023_dinero.sql:46` y `0025_agregacion.sql:46`. Sus cursores
  tienen 0 filas y `freshness` las marca `stale:true`: **esas dos señales stale NO son averías**.
  Gating legal. **119 no creó sus YAML** — habría sido fabricar cobertura (G2, vía (a)).
- **`lobby-camara-weekly` sin `schedule:`.** `lobby-camara-weekly.yml:14-17` — WAF de camara.cl. El
  `failure` es el guard de 10.240 bytes funcionando. `grep -c 'schedule:'` = **0** y
  `grep -c '10240'` = **1**: 119-05 lo dejó exactamente como estaba mientras le añadía `--from-r2`.
- **`digest-daily` con `schedule:` comentado.** `digest-daily.yml:17,24-25` — estreno gated, NOTIF
  parked. Declarado como hueco de cobertura en `catalog.ts` (G3).
- **`roster-weekly` con `schedule:` comentado.** `roster-weekly.yml:16,29-30` — `workflow_dispatch`
  SOLO.
- **`backfill` y `fichas-backfill` sin `schedule:`.** `CLAUDE.md` manda backfill masivo **LOCAL**:
  la ausencia de schedule es cumplimiento, no omisión.
- **`ci` y `deploy-cloudflare` no son ingesta.** No se auditan como tal.
- **`backup-parlamentario` (W-3) fuera del catálogo de frescura.** No escribe en Supabase; su señal
  autoritativa es el commit del bot. Declarado en `catalog.ts` y congelado por test (G3).
- **`Dependabot Updates` y `CodeQL` platform-managed.** Inventariados para cerrar el universo, no
  para auditarlos como ingesta.

---

## 8. Degradación honesta — evidencia por conector tocado

Criterio 2 del ROADMAP §119: *un cron que no puede obtener datos deja señal honesta y JAMÁS escribe
filas inventadas.* Por conector, el test o la corrida que lo demuestra:

| conector | qué demuestra | evidencia |
|---|---|---|
| **lobby-leylobby** | cero confirmados ⇒ **no se marca nada** (no se fabrica cobertura) | Test 3 de `ingest-run.test.ts` lo asevera explícitamente; **mutación**: añadir un `marcarIngestado` incondicional hace fallar los Tests 2, 3 y 5. Corrida LOCAL real: `count,max(ingestado_hasta)` = `136\|2026-06-22` **antes y después** |
| **lobby-leylobby** | una degradación (403/503) **no mueve ningún cursor** | Test 2 (T-74-02 preservada) + test de `ingest-cli` que asevera que **ninguno de los dos** cursores avanza |
| **lobby-leylobby** | el cursor **nunca retrocede** ni sale del reloj | Test 1 (`hasta` = fecha máxima de las audiencias) y Test 5 (monotonía), con la guarda en `writer-supabase.ts:125` |
| **agenda** | sin novedades ⇒ **no se parsea ni se gasta DeepSeek** | 6 tests de `ingest-run.test.ts`, con control positivo (`existed:false` ⇒ la extracción SÍ se alcanza). En vivo: `[skip] sin novedades — camara tabla-sala 2026-W31`, **y esa corrida no escribió snapshot** |
| **agenda** | sin extracción ⇒ **degradación declarada, no filas inventadas** | reporte `tabla no disponible como dato estructurado esta corrida (solo PDF)` |
| **probidad** | el 412 queda **visible** (`sinNovedades`) y no se re-registra el snapshot | 3 tests nuevos; log `[skip] sin novedades — infoprobidad declaraciones <hasta>` |
| **identity** | el skip salta **la carga a DB**, nunca el snapshot git autoritativo | 4 tests sobre `main()` con seams inyectados; `FsSeedFileWriter` deliberadamente **fuera** del skip |
| **identity** | sin service key ⇒ **NO se inventa fila** en `source_snapshot` | 5 tests (incl. `buildSnapshotWriter` → `null` con cada combinación de credencial faltante y ausencia de log fantasma) |
| **todos (replay)** | el replay **falla loud**, jamás degrada a re-fetch | sha re-verificado contra la key en los 3 conectores; salida real del fallo en §4; key legacy de agenda **exige** `--semana` declarada en vez de deducirla |
| **freshness** | el instrumento **sólo puede añadir stale**, nunca quitarlo | `stale = staleTemporal \|\| ghRunEsAveria(ghRun)` es un OR; diff en vivo `REGRESION stale->fresh: []`; un job sin corridas sale `n/d` + `stale:true`, jamás `0` |
| **freshness** | un fallo del **instrumento** no se afirma como avería del **cron** | `ghRunEsAveria("n/d")` ⇒ `false` (gh caído ≠ cron averiado), distinguido de `"n/d (sin corridas)"` ⇒ `true` |

---

## 9. Dos etapas y rate-limit intactos

Criterio 3 del ROADMAP §119. La capa de política de la ingesta quedó **byte-idéntica** en toda la
fase — `git diff --stat` desde el commit inicial de 119 (`da1e1c7`) hasta HEAD:

```
$ git diff --stat da1e1c7..HEAD -- packages/ingest/src/rate-limiter.ts \
    packages/ingest/src/base-connector.ts packages/ingest/src/robots.ts packages/ingest/src/r2-store.ts
(vacío)

$ git diff --stat da1e1c7..HEAD -- packages/agenda/src/connector-camara.ts \
    packages/agenda/src/connector-senado.ts packages/lobby/src/connector-camara-lobby.ts \
    packages/lobby/src/connector-leylobby.ts
(vacío)
```

Es decir: el `HostRateLimiter` (2-3 s serial por host, `connector-leylobby.ts:108`), el contrato de
robots.txt, el User-Agent identificatorio y el `putImmutable` con `If-None-Match: *` (el hash-check)
**no fueron tocados por ningún plan de la fase**. Lo que la fase hizo fue **consumir** ese contrato
donde se descartaba (G6) y **registrar** su resultado donde no se registraba (G5).

Los dos archivos de conector que sí cambiaron lo hicieron sólo para añadir el guard de skip, el
snapshot y el replay:

```
packages/agenda/src/ingest-run.ts      | 257 +++++++++++++++++++++++-
packages/lobby/src/run-camara-lobby.ts |  14 ++
```

Por conector tocado:

| conector | fuente→R2 (Etapa 1) | hash-check antes de gastar | R2→Supabase (Etapa 2) | rate-limit 2-3 s |
|---|---|---|---|---|
| **agenda** | sí, content-addressed, con `source_snapshot` desde 119-04 | sí, `existed` ⇒ `[skip]` antes de parsear y antes de DeepSeek (119-03) | sí, `--from-r2` (119-05) | intacto (`connector-camara.ts` sin diff) |
| **probidad** | sí — **pero después de la carga**: deuda `D-PROB-119` (§3) | `existed` visible, sin ahorro por el orden | sí, `--from-r2` (119-05), **ejecutado hoy** (§4) | intacto |
| **identity** | sí, y 119-03 la movió **antes** de la carga; contenido = maestra CRUDA | sí, el skip salta la carga | n/a (el artefacto autoritativo es el snapshot git) | n/a (no scrapea con rate-limit propio) |
| **lobby-leylobby** | sí, con `source_snapshot` desde 119-04 (2 filas en PROD) | sí — observado en vivo: `[skip] sin novedades — leylobby AA001/2024/p1` | vía `--from-r2` del CLI de lobby | intacto (`connector-leylobby.ts:108` sin diff) |
| **lobby-camara** | sí — `--html-file` ya pasaba por `putImmutable` antes de parsear (ahora cubierto por test de orden `put → upsert`) | sí | sí, `--from-r2` + `[WARN]` de Etapa 1 omitida (119-05) | intacto; `curl`, guard de 10.240 bytes y ausencia de `schedule:` sin tocar |

---

## 10. Los 4 success criteria del ROADMAP §119, uno por uno

| # | Criterio | Veredicto |
|---|---|---|
| **1** | Cada gap accionable de 118 está cerrado en código, o explícitamente diferido como deuda de operador con su razón y sus pasos | **PASS.** 8 de 11 cerrados (G1 con divergencia anclada, §2); G8 y G9-gemini diferidos con razón, pasos y criterio de cierre (§3, §5); G11 abierto en observación con criterio y fecha (§6). Ninguno sin estado. Se abrieron además 2 gaps nuevos con pasos (`G12-119`, `D-PROB-119`) |
| **2** | Un cron que no puede obtener datos deja señal honesta y JAMÁS escribe filas inventadas | **PASS.** Evidencia por conector en §8, incluida la **mutación** que demuestra que los tests muerden y la corrida LOCAL donde la marca **no se movió** — y eso era el resultado correcto |
| **3** | Las dos etapas LOCKED y el hash-check siguen respetados en cada conector tocado; rate-limit 2-3 s intacto | **PASS con limitación declarada.** La capa de política quedó byte-idéntica (§9, `git diff --stat` vacío) y los 5 conectores cumplen ambas etapas. **La limitación:** en **probidad** el orden está invertido (crudo DESPUÉS de la carga) — el crudo llega a R2 y el replay funciona, pero el hash-check no ahorra trabajo. Registrado como `D-PROB-119` con su criterio de cierre; **no se reordenó por instrucción explícita** |
| **4** | `pnpm freshness` refleja el estado real por fuente tras los fixes | **PASS con limitación declarada.** La herramienta arranca (G10), no fabrica 404 (G2), cubre `actualidad-refresh` y los 5 jobs de `pg_cron` (G3), y **dos verdes prestados cayeron a STALE honesto** (G4). Las 5 filas stale están clasificadas y **ninguna es una avería real** (§4). **La limitación:** el rótulo de `lobby-leylobby` sigue atribuyendo a leylobby una señal que mide otra cosa — declarado en el código con tests que lo congelan, pero no reapuntado (`G12-119`, §3) |

---

## 11. Constancia de método

- **Cero cierres por inferencia.** G11 se re-observó con datos crudos; la premisa de 118 resultó
  errónea (día de la semana) y **aun así el gap queda abierto**, porque refutar una sospecha no es
  lo mismo que acumular evidencia de cadencia.
- **Cero deudas de operador re-pedidas.** G8 y G9-gemini se re-verificaron con `gh secret list` y
  se apuntaron a `118-OPERATOR-CHECKPOINT.md`. El agente no cargó ningún valor.
- **Cero secretos.** Sólo nombres y fechas. Ninguna URL de DB impresa en ninguna de las ~12
  consultas psql read-only de esta fase.
- **`118-CRON-VERDICTS.md` intacto.** 119 produjo su propio registro; `git diff` sobre el documento
  de 118 sale vacío y `STRICT=1 check-crons.sh` sigue en `0 falta(s)`.
- **Checkpoint de lectura fría (Task 4 del plan):** **auto-aprobado por modo autónomo** (directiva
  de la corrida). Se registra como tal — **no** como validación humana. La lectura fría del operador
  sigue pendiente y su ausencia no invalida ninguna de las evidencias de arriba, que son
  re-ejecutables comando por comando.

---

## 12. Post-scriptum de la pasada de code-review (2026-07-28)

Se agrega DESPUES del cierre, sin reescribir nada de arriba (mismo trato que 119 le dio a 118).
La disposicion completa de los 20 hallazgos vive en `119-REVIEW.md`, seccion "Disposicion de los
hallazgos". Aqui solo lo que **corrige o completa** lo declarado en este documento.

### G1 (seccion 2) - la afirmacion era cierta en intencion, no en codigo

La seccion 2 declara que el cursor avanza "con datos y SOLO con datos, la fecha maxima de las
audiencias ingeridas, nunca el reloj". El review encontro que `ingest-run.ts` conservaba **dos
escapes al reloj** que la contradecian:

* `const fechaDato = f.fecha != null ? f.fecha.slice(0,10) : hasta;` - una audiencia con fecha no
  parseable (el campo `fechaRaw` existe precisamente porque la fuente entrega fechas sucias)
  marcaba `ingestado_hasta = HOY` sin un dato de esa fecha.
* `for (const id of confirmados) if (!marcados.has(id)) marcados.set(id, hasta);` - el relleno
  llevaba al corte de la corrida a todo confirmado sin fila fechada.

Ambos eliminados en **`20f3b03`** (CR-02), con dos tests que los congelan. **La afirmacion de la
seccion 2 pasa a ser literalmente verdadera.** Su conclusion no cambia: que `lobby-leylobby` siga
`stale:true` sigue siendo el resultado CORRECTO, y por las mismas dos razones (estructural +
defecto ya corregido).

### G12-119 (seccion 3) - la consecuencia operativa que faltaba sacar

La seccion 3 identifico que `marcarIngestado` vive en el writer **compartido** y que las 136 filas
vigentes las escribio el conector de la **Camara**. Lo que no se saco de ahi es que **ese
escritor marcaba con `fechaCaptura`, es decir con el reloj de la corrida**: `ingestado_hasta`
afirmaba cobertura hasta hoy aunque el listado solo llegara a junio, y la guarda monotonica de
`writer-supabase.ts` no lo podia frenar porque el reloj siempre avanza - el mecanismo nuevo lo
sellaba en vez de detenerlo.

Corregido en **`fd43906`** (CR-03): **los DOS escritores** del marcador derivan ahora la cobertura
de la fecha de las audiencias. `fechaCaptura` queda como provenance de fila y particion de la key
de R2.

**`G12-119` NO se cierra con esto.** Su hallazgo es de *rotulo* (la senal `lobby-leylobby` mide
cobertura de lobby por parlamentario, no frescura de leylobby) y sigue ABIERTO con sus dos
opciones intactas. Lo que cambia es que la tabla que mide ya no la contamina el reloj.

### G7 - `--from-r2` no estaba en los cinco conectores que la seccion 4 sugiere

La seccion 4 registra G7 como **cerrado** con "`--from-r2` en agenda / probidad / lobby-camara con
la firma dorada", y eso es exacto. Lo que no se noto es que el CLI de **lobby-leylobby**
`parseaba` el flag y lo guardaba en `opts.fromR2` **sin usarlo nunca**: `main()` construia el
conector real y corria LIVE. El operador que usaba el flag producia exactamente el fetch que
queria evitar (regla LOCKED 2). Implementado en **`030bb61`** (CR-01) con la misma firma dorada.
La tabla de la seccion 9 (`lobby-leylobby` / "via `--from-r2` del CLI de lobby") pasa a ser cierta.

### D-PROB-119 y WR-03 - sin cambios, y por que

* **D-PROB-119** (orden de etapas invertido en probidad) sigue abierto, no tocado.
* El review levanto ademas que la key de R2 particionada por **fecha de corrida** hace inutil el
  hash-check fuera del mismo dia en 4 de los 5 conectores (agenda es la excepcion: particiona por
  semana ISO). Se registra como **limitacion aceptada**, no como gap: la fecha en la key es parte
  del contrato LOCKED de `CLAUDE.md` (`fuente/recurso/fecha/sha256.ext`) y cambiarla es una
  decision de arquitectura. Detalle y camino alternativo (HEAD por prefijo) en `119-REVIEW.md`.
* **WR-02** (el skip de agenda apaga la senal que la propia agenda mide) queda **diferido con
  pasos**, y con una correccion al diagnostico del review: la via "que la senal mida
  `source_snapshot`" NO funciona, porque esa fila tampoco se escribe en el camino de skip.

### Bateria de regimen re-corrida tras los fixes

| Check | Resultado |
|---|---|
| Suite completa | **packages 1649 passed** (+11 skipped) - **app 1560 passed** - 0 fallos |
| Typecheck (`tsc -b`) | **exit 0** |
| `STRICT=1 check-crons.sh` de 118 | **`0 falta(s)`, exit 0** |
| Inmutabilidad de 118 | `git diff` sobre `118-CRON-VERDICTS.md` sigue **vacio** |

El delta de packages (1616 -> 1649) es todo tests nuevos que congelan los fixes: lobby 82 -> 106,
freshness 76 -> 83, identity 119 -> 121. **El suite de `app` queda en 1560, sin tocar**: esta
pasada, como la fase, es conectores + instrumento de frescura.
