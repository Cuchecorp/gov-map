---
phase: 119-cron-fix-robustez-de-ingesta
reviewed: 2026-07-28T00:00:00Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - .github/workflows/fichas-backfill.yml
  - .github/workflows/lobby-camara-weekly.yml
  - docs/runbooks/cron-local-fallback.md
  - package.json
  - packages/agenda/src/index.ts
  - packages/agenda/src/ingest-run.test.ts
  - packages/agenda/src/ingest-run.ts
  - packages/agenda/src/run-agenda-prod-cli.ts
  - packages/freshness/src/catalog.ts
  - packages/freshness/src/cli.ts
  - packages/freshness/src/evaluate.test.ts
  - packages/freshness/src/evaluate.ts
  - packages/freshness/src/query-runner.ts
  - packages/identity/src/backup.ts
  - packages/identity/src/seed-cli.test.ts
  - packages/identity/src/seed-cli.ts
  - packages/lobby/src/cursor-leylobby.ts
  - packages/lobby/src/ingest-cli.test.ts
  - packages/lobby/src/ingest-cli.ts
  - packages/lobby/src/ingest-run.test.ts
  - packages/lobby/src/ingest-run.ts
  - packages/lobby/src/run-camara-lobby-cli.ts
  - packages/lobby/src/run-camara-lobby.test.ts
  - packages/lobby/src/run-camara-lobby.ts
  - packages/lobby/src/writer-supabase.ts
  - packages/lobby/src/writer.test.ts
  - packages/lobby/src/writer.ts
  - packages/probidad/src/index.ts
  - packages/probidad/src/run-probidad-todos-cli.ts
  - packages/probidad/src/run-probidad-todos.test.ts
  - packages/probidad/src/run-probidad-todos.ts
findings:
  critical: 3
  warning: 11
  info: 6
  total: 20
status: clean
fix_pass:
  fecha: 2026-07-28
  nota: "los hallazgos de arriba NO se reescribieron; la disposicion se agrega al final"
  fixed: 14
  accepted_limitation: 1
  deferred: 4
  suite_post_fix: "packages 1649 passed (+11 skipped) - app 1560 passed - tsc exit 0 - STRICT=1 check-crons 0 falta(s)"
verify_pass:
  fecha: 2026-07-28
  modo: "re-verificacion --auto de los fixes (no re-review completo)"
  veredicto: "todos los fixes VERIFICADOS en codigo; cero regresiones"
  suite_verificada: "lobby 106 tests (9 archivos) - agenda 13 archivos - identity 14 - probidad 8 - freshness 2 - todos passed; pnpm typecheck exit 0"
  cr_01: "VERIFICADO - replay cableado (ingest-cli.ts:289-360): key anclada R2_KEY_LEYLOBBY_RE = la particion que escribe la propia Etapa 1, getObject, sha re-verificado contra la key, conector real NO se instancia y r2Store NO se pasa al run (evita el 412 que saltaria la Etapa 2), cursor ni se consulta ni avanza, fetchDetalle falla LOUD. Test con conector que LANZA 'FETCH A LA FUENTE EN MODO REPLAY' + 5 keys rechazadas (traversal, absoluta, sha truncado, otra fuente, y la key laxa que el test viejo congelaba)."
  cr_02: "VERIFICADO - ingest-run.ts:305 `if (f.fecha == null) continue` y el bucle de relleno con `hasta` ELIMINADO. `hasta` queda solo como particion de la key de R2. Tests 6 y 7 congelan ambos caminos."
  cr_03: "VERIFICADO - run-camara-lobby.ts:198-218 deriva la fecha MAXIMA por parlamentario y agrupa por `hasta`; fechaCaptura queda como provenance/particion. El otro llamador del writer COMPARTIDO (leylobby) sigue correcto: misma firma (ids, hasta), solo cambia de donde sale el valor. Los DOS escritores del marcador derivan ya del dato."
  wr_01: "VERIFICADO - runCamaraLobby expone `sinNovedades`, el CLI lo imprime en la linea-resumen y el guard del YAML distingue skip sano (exit 0 con motivo en el log) de audiencias=0 sin skip declarado (sigue exit 1). Se cierra el camino que fabricaba rojo."
  spot_check: "WR-04 (`!sinNovedades || opts.promote===true`), WR-05 (`sourceSnapshot?: string` en FuenteConfig + `cfg.sourceSnapshot ?? cfg.fuente` en query-runner:190), WR-06 (`corridaExitosa` en cursor-leylobby + test 403-no-avanza), WR-07 (`status` in_progress/queued/requested -> GH_EN_CURSO -> no averia), WR-08 (fail-closed GITHUB_ACTIONS en run-camara-lobby-cli:193), WR-09 (try/catch que anota en `errores` con fuente lobby_ingesta_estado), WR-10 (array + comillas + if/fi), WR-11 (Number.isInteger && >0, fail-loud), IN-01 (comentario alineado a `7 11,14,17,20`), IN-03 (log movido despues del `existed`), IN-04 (SOURCES_SNAPSHOT_CONOCIDOS, lista cerrada) - todos VERIFICADOS."
  disposiciones_registradas: "WR-02 deferred y WR-03 accepted-limitation, ambos con pasos y CRITERIO DE CIERRE verificable; IN-02/IN-05/IN-06 deferred con razon declarada. Registrados en la seccion DISPOSICION de este documento y cruzados con G1/G12-119 de 119-GAP-CLOSURES.md."
  correccion_al_review: "El fixer tiene RAZON en dos puntos contra este review, y se aceptan: (a) el snippet WR-10 `[ cond ] && ARGS+=(...)` ABORTA el job bajo `bash -e` (un AND-list de nivel superior cuya condicion es falsa devuelve 1 y `set -e` sale) - el `if...fi` aplicado es el correcto y NO debe revertirse; (b) la opcion (b) de WR-02 (apuntar la senal a `source_snapshot`) NO resuelve nada, porque esa fila tampoco se escribe en el camino de skip (guarda T-119-12) - el diagnostico de WR-02 sigue en pie, la receta no."
---

# Phase 119: Code Review Report

**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

## Summary

La fase no filtra secretos (sólo nombres en YAML y runbook; `psql` usa `execFileSync` sin shell y
nunca imprime la `dbUrl`), y la capa de política de ingesta (rate-limiter/robots/UA/`putImmutable`)
quedó efectivamente intacta. Lo que **no** resiste el escrutinio son tres cosas: (1) un flag de
replay que se parsea y se ignora, con lo cual `--from-r2` en leylobby vuelve a la fuente; (2) dos
rutas que marcan cobertura con el **reloj** —justamente lo que §2 del registro de cierre declara
haber rechazado—, una de ellas en el conector que escribe las 136 filas reales; y (3) un
acoplamiento no resuelto entre el skip nuevo (G6) y la señal nueva (G4), que convierte "sin
novedades" en rojo fabricado (workflow `exit 1`) o en STALE fabricado (tabla sin refrescar).
Además el hash-check que G6 dice consumir no puede ahorrar nada fuera del mismo día en 4 de 5
conectores, porque la key de R2 sigue particionada por fecha de corrida.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `--from-r2` de leylobby se parsea y NUNCA se usa → la "re-ingesta desde R2" fetchea la fuente

**File:** `packages/lobby/src/ingest-cli.ts:118,178-183` (y toda `main()`, 197-350)
**Issue:** `parseArgs` acepta `--from-r2 <path>` y lo guarda en `opts.fromR2`, con test que lo
asevera (`ingest-cli.test.ts:66`). `main()` **jamás lee `opts.fromR2`**: construye el
`LeylobbyConnector` real y corre `runIngestLobby` en LIVE. El operador que ejecuta el flag
documentado para "re-ingestar sin molestar al servidor" produce exactamente el fetch que quería
evitar — violación silenciosa de la regla LOCKED 2 de `CLAUDE.md` contra una fuente volátil
(Laravel/Azure, 403/503) . `grep -rn fromR2 packages/lobby/src` confirma que sólo el conector de
Cámara implementa el replay.
**Fix:** o bien implementar el replay (espejo de `run-camara-lobby-cli.ts:132-158`: regex anclada,
`getObject`, re-verificación de sha, cero conector), o bien **rechazar el flag**:

```ts
case "--from-r2":
  throw new LobbyCliArgsError(
    "--from-r2 no está implementado en el conector leylobby (usa run-camara-lobby-cli.ts)",
  );
```

### CR-02: el cursor de leylobby cae al RELOJ cuando la audiencia no trae fecha

**File:** `packages/lobby/src/ingest-run.ts:305,309`
**Issue:** el comentario declara «la fecha MÁXIMA de sus audiencias ingeridas — dato, no reloj
(T-119-17)», pero el código tiene dos escapes al reloj: `const fechaDato = f.fecha != null ?
f.fecha.slice(0,10) : hasta;` y `for (const id of confirmados) if (!marcados.has(id))
marcados.set(id, hasta);`, donde `hasta = opts.ingestadoHasta ?? new Date()...` (línea 116). Una
audiencia con `fecha` no parseable (campo `fecha_raw` existe precisamente porque la fuente entrega
fechas sucias) marca `ingestado_hasta = HOY` sin un dato de esa fecha. Es la fabricación de
cobertura que §2 del registro de cierre dice haber rechazado, sólo que por la puerta del fallback.
**Fix:** no marcar cuando no hay fecha del dato.

```ts
const fechaDato = f.fecha != null ? f.fecha.slice(0, 10) : null;
if (fechaDato == null) continue;             // sin dato de fecha ⇒ no se marca cobertura
// … y eliminar el bucle de relleno con `hasta` (línea 309)
```

### CR-03: el conector de Cámara —el que realmente escribe las 136 filas— sigue marcando con el reloj

**File:** `packages/lobby/src/run-camara-lobby.ts:88-89,164`
**Issue:** `date = fechaCaptura.slice(0,10)` con `fechaCaptura = opts.fechaCaptura ?? new
Date().toISOString()`, y `marcarIngestado(parlamentariosConfirmados, date)`. G1 arregló el reloj en
`ingest-run.ts` (leylobby, que confirma a cero personas) y dejó intacto el escritor que, según el
propio `catalog.ts:34-35`, escribió **las 136 filas vigentes** de `lobby_ingesta_estado`. La señal
de frescura que la fase reapuntó y explicó se sigue alimentando de un timestamp de corrida, no de
la fecha de las audiencias: `ingestado_hasta` afirma cobertura hasta hoy aunque el listado sólo
llegue a junio. La guarda monotónica de `writer-supabase.ts:136-139` no lo detecta —el reloj siempre
avanza—, así que el mecanismo nuevo lo sella en vez de frenarlo.
**Fix:** derivar `date` del máximo de `aud[].fecha` por parlamentario (mismo tratamiento que
CR-02 pide para leylobby) y pasar ese valor a `marcarIngestado`; `fechaCaptura` se queda sólo como
provenance de fila.

## Warnings

### WR-01: `[skip] sin novedades` de Cámara-lobby se registra como workflow FAILURE

**File:** `.github/workflows/lobby-camara-weekly.yml:75` + `packages/lobby/src/run-camara-lobby.ts:107-110`
**Issue:** con G6, un crudo ya presente en R2 devuelve `{audiencias: 0, …}` y sale temprano. El
guard del YAML (`grep -qE 'audiencias=[1-9][0-9]*' || exit 1`) convierte esa corrida sana en
`failure`. Y G4 hizo que un `failure` produzca `stale:true` **por sí solo**
(`evaluate.ts:105`). Resultado: la fase creó un camino que fabrica rojo — la dirección espejo del
verde prestado que decía erradicar.
**Fix:** distinguir los dos casos en el guard, p.ej. imprimir `sinNovedades=true` en la línea
resumen del CLI y `grep -qE 'audiencias=[1-9][0-9]*|sinNovedades=true'`.

### WR-02: el skip de agenda apaga la señal de frescura que mide la propia agenda

**File:** `packages/agenda/src/ingest-run.ts:348-351`; `packages/freshness/src/catalog.ts:369-376`
**Issue:** `existed ⇒ break` omite el `upsertCitaciones`, así que `citacion.fecha_captura` no se
refresca. La entrada `agenda` mide `MAX(citacion.fecha_captura)` con umbral 7 d: siete días con el
HTML de Cámara sin cambios ponen la fuente en `STALE (dias>umbral)` con el cron perfectamente sano.
G6 y G4 se contradicen y no se reconcilió.
**Fix:** o refrescar `fecha_captura` (touch idempotente) también en el camino skip, o que la
entrada `agenda` mida `source_snapshot` (que sí se escribe por corrida) en vez de la tabla derivada.

### WR-03: la key de R2 particionada por FECHA DE CORRIDA hace inútil el hash-check fuera del mismo día

**File:** `packages/lobby/src/ingest-run.ts:161` (`date = hasta.slice(0,10)`),
`packages/identity/src/seed-cli.ts:224`, `packages/probidad/src/run-probidad-todos.ts:313` (`hasta`),
`packages/lobby/src/run-camara-lobby.ts:89`
**Issue:** `putImmutable` compone `source/resource/<date>/<sha>.<ext>` y devuelve `existed` sólo
ante 412 de la **misma key** (`packages/ingest/src/r2-store.ts:64-79`). Con `date` = día de la
corrida, dos corridas semanales con contenido byte-idéntico producen keys distintas ⇒ `existed`
nunca es `true` ⇒ el `[skip]` sólo dispara en re-corridas del mismo día, y R2 acumula un duplicado
por corrida. Agenda resolvió esto (partición por semana ISO, WR-01); los otros cuatro conectores
no. El "hash-check antes de gastar" que la tabla §9 del registro declara para leylobby/identity/
camara-lobby no se sostiene entre corridas.
**Fix:** particionar por el ciclo del recurso, no por el reloj (semana/año/`institucion/anio/pagina`),
o hacer un `HEAD` por prefijo antes del PUT.

### WR-04: `sinNovedades` en identity anula también `--promote`

**File:** `packages/identity/src/seed-cli.ts:316-323,368`
**Issue:** `if (serviceKey.length > 0 && !sinNovedades)` envuelve la carga a DB **y** el bloque
`--promote`. Un operador que corre `--r2 --promote` tras el visto bueno humano, con el catálogo sin
cambios (el caso normal), obtiene `promoted: null` y un log de skip: la compuerta humana no se
aplica y nada lo denuncia como fallo.
**Fix:** sacar la promoción del skip — es un acto explícito del operador, no trabajo derivado del
crudo:

```ts
if (serviceKey.length > 0 && (!sinNovedades || opts.promote)) { … }
```

### WR-05: la señal `r2Snapshot` de probidad nunca encuentra sus filas (mismatch de `source`)

**File:** `packages/probidad/src/run-probidad-todos.ts:337` (`source: "infoprobidad"`) vs
`packages/freshness/src/catalog.ts:400` (`fuente: "probidad"`) y `query-runner.ts:132`
**Issue:** `r2SnapshotSignal` consulta `where source = '<fuente del catálogo>'`, es decir
`'probidad'`, mientras el conector escribe `'infoprobidad'`. El propio registro de cierre lo
evidencia sin notarlo: `source_snapshot` tiene `infoprobidad|3` y la tabla de freshness muestra
`probidad … n/d (sin snapshots)`. El instrumento reporta "sin crudo" habiendo crudo.
**Fix:** unificar el rótulo (usar `"probidad"` en el writer, como agenda usa `"agenda"` y no
`"camara"`), o mapear explícitamente `sourceSnapshot?: string` en `FuenteConfig`.

### WR-06: el cursor de leylobby se atasca para siempre en la primera página vacía

**File:** `packages/lobby/src/ingest-cli.ts:328-342`; `packages/lobby/src/cursor-leylobby.ts:91-108`
**Issue:** el avance exige `res.audiencias > 0`. Una página legítimamente vacía (institución con 3
páginas y `PAGINA_MAX_DEFAULT = 10`) devuelve 0 audiencias ⇒ el cursor no avanza ⇒ la corrida
semanal siguiente pide **la misma página vacía**, indefinidamente: el barrido histórico nunca llega
a `anio-1`. El mismo bloqueo ocurre tras un `[skip]` de R2 (audiencias 0). La regla T-74-02 ("no
avanzar ante degradación") está confundiendo "bloqueado" con "vacío", distinción que el propio
código de agenda sí hace (`semanasBloqueadas` vs vacío).
**Fix:** avanzar cuando la corrida fue **exitosa** (sin degradaciones/errores para esa clave),
aunque traiga 0 filas; no avanzar sólo ante degradación real:

```ts
const huboDegradacion = res.degradaciones.length > 0 || res.errores.length > 0;
const siguiente = avanzarCursorPuro(cursorPrevio, { huboDatos: !huboDegradacion });
```

### WR-07: un workflow EN CURSO se clasifica como avería

**File:** `packages/freshness/src/evaluate.ts:46-52`; `packages/freshness/src/query-runner.ts:116-123`
**Issue:** `gh run list --json conclusion` devuelve `conclusion: ""` (o null) para un run
`in_progress`. `ghRunSignal` produce `" @ 2026-07-28"` y `ghRunEsAveria` calcula
`conclusion = ""`, que no es `success` ni `skipped` ⇒ `true` ⇒ `stale (gh-failure)` mientras el
cron está corriendo con normalidad. Falso positivo recurrente, justo el ruido que el diseño dice
querer evitar.
**Fix:** pedir también `status` y tratar `in_progress`/`queued` como desconocido (no avería):

```ts
if (conclusion === "" || conclusion === "?") return false; // run en curso ⇒ no se afirma avería
```

### WR-08: el CLI de lobby-Cámara degrada a dry-run silencioso sin credenciales (a diferencia del de leylobby)

**File:** `packages/lobby/src/run-camara-lobby-cli.ts:188-197` vs `packages/lobby/src/ingest-cli.ts:218-228`
**Issue:** `ingest-cli` falla duro si `GITHUB_ACTIONS=true` y faltan credenciales, precisamente para
que el workflow no salga 0 sin escribir. `run-camara-lobby-cli` —el que corre en
`lobby-camara-weekly.yml`— no tiene esa guarda: un secret perdido produce `InMemoryLobbyWriter`,
"DRY-RUN" en el log y exit 0. El guard de `audiencias` lo tapa parcialmente por accidente, no por
diseño.
**Fix:** replicar el fail-closed de `ingest-cli.ts:221-225` en este CLI.

### WR-09: `marcarIngestado` final fuera de todo manejo de error tira la corrida completa

**File:** `packages/lobby/src/ingest-run.ts:332-334`
**Issue:** cada upsert del loop está dentro de un `try` que anota en `errores` y continúa; el
`marcarIngestado` del cierre no. Un error de PostgREST allí lanza y `runIngestLobby` no devuelve
nada: se pierden `errores`, `degradaciones` y los conteos de audiencias ya escritas, y el CLI
reporta un fallo genérico en vez del reporte honesto que la fase promete.
**Fix:** envolver el bucle `for (const [h, ids] of porHasta)` en `try/catch` que empuje a
`errores` con `fuente: "lobby_ingesta_estado"`.

### WR-10: expansión sin comillas de un input de usuario en un step con secrets

**File:** `.github/workflows/fichas-backfill.yml:82-85`
**Issue:** `ARGS="$ARGS --boletines $BOLETINES"` y `tsx src/pipeline-cli.ts $ARGS` dejan el input
`boletines` sujeto a word-splitting y **globbing** dentro de un step que exporta
`SUPABASE_SECRET_KEY`, `DEEPSEEK_API_KEY`, `GEMINI_API_KEY` y las cuatro `R2_*`. El comentario dice
"evita inyección de comandos", pero la mitigación (pasar por env) se anula al re-expandir sin
comillas.
**Fix:** usar un array y comillas.

```bash
ARGS=(--limite "${LIMITE:-50}")
[ "$REEMBED" = "true" ] && ARGS+=(--reembed)
[ -n "$BOLETINES" ] && ARGS+=(--boletines "$BOLETINES")
pnpm --filter @obs/fichas exec tsx src/pipeline-cli.ts "${ARGS[@]}"
```

### WR-11: `--limit 0` / negativo en probidad recorta en silencio

**File:** `packages/probidad/src/run-probidad-todos-cli.ts:117-118,211`
**Issue:** sólo se filtra `NaN`. `--limit 0` pasa `limite: 0` ⇒ `maestra.slice(0,0)` ⇒ cero
parlamentarios consultados y `[ok] consultados=0` con exit 0. `--limit -5` ⇒ `slice(0,-5)`, que
descarta los últimos 5 sin decirlo. Una corrida que no consultó a nadie se ve igual que una sana.
**Fix:** validar `Number.isInteger(limite) && limite > 0`, y lanzar si no.

## Info

### IN-01: drift documental en el schedule de `actualidad-materializar`
**File:** `packages/freshness/src/catalog.ts:330` vs `:479`
El catálogo declara `"7 11,14,17,20 * * 1-5"` y el comentario de la entrada `actualidad-refresh` cita
`0 11,14,17,20 * * 1-5`. Uno de los dos miente; el propio chequeo de `schedule-drift` existe para
esto. Alinear el comentario al valor verificado.

### IN-02: el `--help` de freshness quedó desactualizado
**File:** `packages/freshness/src/cli.ts:337-347`
No menciona `chilecompra`, `servel`, `actualidad-refresh` ni `leyes-min-edad`, ni el bloque de
pg_cron en "Salida". El operador que se guía por el help no sabe qué está mirando.

### IN-03: log optimista antes de comprobar `existed`
**File:** `packages/agenda/src/ingest-run.ts:341`
`log("… HTML crudo en R2 (key)")` se emite también cuando el objeto ya existía (412), y sólo después
aparece `[skip]`. Mover el log al `else`.

### IN-04: `r2SnapshotSignal` interpola la fuente en la SQL
**File:** `packages/freshness/src/query-runner.ts:132`
Hoy los valores vienen del catálogo estático (sin riesgo real), pero rompe la invariante "SQL 100%
estática" que el resto del módulo declara. Preferir un `WHERE source = ANY(...)` con lista fija o
`psql -v`.

### IN-05: `motivoStale` colapsa causas simultáneas
**File:** `packages/freshness/src/evaluate.ts:107-110`
Con `dias>umbral` **y** `gh-failure` a la vez sólo se reporta el primero; el operador no ve que el
cron además está caído. Considerar un array de motivos.

### IN-06: la fila `source_snapshot` se escribe antes de la cuarentena por drift
**File:** `packages/lobby/src/ingest-run.ts:178-200` vs `:250-277`
Una tarea que luego entra en cuarentena (0 filas) ya dejó provenance fresca. No es incorrecto
(el crudo sí se descargó), pero deja `r2Snapshot` verde para un recurso del que deliberadamente no
se escribió nada; conviene declararlo en el comentario.

---

_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Disposicion de los hallazgos (pasada de fix, 2026-07-28)

Cada hallazgo con su estado y el commit que lo cierra. **Los hallazgos de arriba NO se
reescribieron**: esta seccion se agrega al final, igual que 119 hizo con 118.

Convenciones de estado:

* **fixed** - corregido en codigo, con test que lo congela.
* **accepted-limitation** - el diagnostico se acepta como correcto, pero corregirlo cambiaria un
  contrato LOCKED o una decision de diseno que no corresponde tomar de paso.
* **deferred** - real y accionable, pero fuera del alcance de una pasada de fix; con razon y pasos.

| id | estado | commit | nota |
|---|---|---|---|
| CR-01 | **fixed** | `030bb61` | Replay implementado (no rechazado): key anclada, `getObject`, sha re-verificado, cero conector real. `fetchDetalle` falla loud en replay. |
| CR-02 | **fixed** | `20f3b03` | Eliminados los DOS escapes al reloj. Sin fecha del dato, la fila no empuja el cursor. |
| CR-03 | **fixed** | `fd43906` | La marca sale del maximo de `aud[].fecha` por parlamentario. El writer compartido NO cambia de firma; ambos conectores cubiertos por tests. |
| WR-01 | **fixed** | `1db721f` | `sinNovedades` en el resultado + linea-resumen del CLI + guard del YAML que distingue skip sano de corrida vacia. |
| WR-02 | **deferred** | - | Ver "WR-02 - por que no se cerro" abajo: la opcion (b) del review NO funciona como esta escrita. |
| WR-03 | **accepted-limitation** | - | Ver "WR-03 - limitacion aceptada" abajo. |
| WR-04 | **fixed** | `bf4dc6b` | `--promote` sale del skip: es un acto del operador, no trabajo derivado del crudo. |
| WR-05 | **fixed** | `2713ad4` | `sourceSnapshot?: string` explicito en `FuenteConfig` (`probidad` -> `infoprobidad`). |
| WR-06 | **fixed** | `f15034c` | El cursor avanza ante EXITO (cero degradaciones/errores), no ante "trajo filas". `huboDatos` renombrado a `corridaExitosa`. |
| WR-07 | **fixed** | `e877975` | Se pide `status` a `gh`; `in_progress`/`queued` -> rotulo `en curso`, tercer estado. |
| WR-08 | **fixed** | `35ae513` | Fail-closed en CI replicado desde `ingest-cli.ts`. |
| WR-09 | **fixed** | `550e4fb` | `marcarIngestado` de cierre envuelto; el error se anota con `fuente: "lobby_ingesta_estado"`. |
| WR-10 | **fixed** | `72ca051` | Array + comillas. **Se desvia del snippet del review**: ver nota de `bash -e` abajo. |
| WR-11 | **fixed** | `72ca051` | `Number.isInteger(limite) && limite > 0`, fail-loud antes de red/DB. |
| IN-01 | **fixed** | `b5e9c67` | Comentario alineado al valor verificado (`7 11,14,17,20 * * 1-5`). |
| IN-02 | **deferred** | - | `--help` de freshness desactualizado. Documentacion pura, sin riesgo de dato; se agrupa con el proximo cambio del CLI. |
| IN-03 | **fixed** | `b5e9c67` | El log de "crudo en R2" pasa despues de comprobar `existed`. |
| IN-04 | **fixed** | `2713ad4` | El rotulo se resuelve contra una lista cerrada antes de tocar la SQL; invariante "SQL 100% estatica" restaurada. |
| IN-05 | **deferred** | - | `motivoStale` colapsa causas simultaneas. Cambia la forma de `FuenteResult` (array de motivos) y con ella la tabla del operador; merece decidirse aparte, no de paso. |
| IN-06 | **deferred** | - | Declaracion en comentario del orden `source_snapshot` vs cuarentena. Se agrupa con la resolucion de `D-PROB-119`, que toca el mismo orden de etapas. |

### WR-02 - por que NO se cerro (y una correccion al diagnostico)

El diagnostico es **correcto**: `existed` seguido de `break` omite `upsertCitaciones`, la entrada
`agenda` mide `MAX(citacion.fecha_captura)` con umbral 7 d, y siete dias con el HTML de Camara sin
cambios ponen la fuente en `STALE` con el cron perfectamente sano. G6 y G4 se contradicen.

Pero **ninguna de las dos vias que el review propone funciona tal como esta escrita**, y eso hay
que decirlo antes de que la proxima fase la tome como receta:

1. *"Que la entrada `agenda` mida `source_snapshot` (que si se escribe por corrida)"* -
   **falso**. La fila de `source_snapshot` de agenda se escribe SOLO tras un put con
   `existed:false` (la guarda que G5 introdujo a proposito con T-119-12). En el camino de skip
   tampoco se escribe. Reapuntar la senal moveria el problema, no lo resolveria.
2. *"Refrescar `fecha_captura` (touch idempotente) en el camino skip"* - viable, pero **no es un
   touch**: `SupabaseSnapshotStore` es INSERT-only (`insert(row)` mas manejo de `23505` que
   devuelve el id existente **sin actualizar `fetched_at`**). Y del lado de `citacion` no existe
   hoy un metodo de writer para tocar la semana afectada. Cerrarlo exige un camino de escritura
   NUEVO.

**Por que se difiere:** es una eleccion de diseno entre dos contratos (que significa
`fecha_captura`: "cuando se ingirio el dato" o "cuando se verifico la fuente") con un camino de
escritura nuevo detras, y ese camino toca PROD. No corresponde decidirlo de paso en una pasada de
fix; corresponde una fase que lo declare.

**Pasos concretos para quien lo tome:**

* Introducir el concepto explicito de "verificacion sin novedad" (p.ej. un
  `source_snapshot.checked_at` distinto de `fetched_at`, o un `upsert` real del store con
  `onConflict` que refresque el timestamp), y apuntar la senal `agenda` a ESE campo.
* **Criterio de cierre verificable:** con el crudo de Camara sin cambios durante 8 dias seguidos,
  `pnpm freshness` reporta `agenda` como `OK` y el motivo es demostrable con una consulta.

### WR-03 - limitacion aceptada (NO se cambia la key)

El diagnostico es correcto: con `date` = dia de la corrida, dos corridas semanales con contenido
byte-identico producen keys distintas, `existed` nunca es `true` entre corridas, y R2 acumula un
duplicado por corrida en leylobby / identity / probidad / camara-lobby.

**No se "arregla" porque la fecha en la key ES parte del contrato LOCKED de `CLAUDE.md`**
(`fuente/recurso/fecha/sha256.ext`). Cambiar la particion es cambiar el contrato de almacenamiento
de TODO el crudo historico, y ademas romperia las keys que los `--from-r2` ya documentados (y sus
regex ancladas) esperan. Eso es una decision de arquitectura, no un fix.

Se registra como limitacion aceptada, con su consecuencia dicha en voz alta: **el `[skip]` de esos
cuatro conectores solo dispara en re-corridas del MISMO DIA.** Agenda es la excepcion porque
particiona por semana ISO, que es el ciclo del recurso.

Camino si una fase futura decide abordarlo **sin tocar el contrato de key**: un `HEAD`/`LIST` por
prefijo `fuente/recurso/` antes del PUT, que es hash-check real sin cambiar donde vive el objeto.

### Nota de metodo - una desviacion deliberada del snippet del review (WR-10)

El review propone `[ "$REEMBED" = "true" ] && ARGS+=(--reembed)`. **Ese snippet aborta el job**
cuando la condicion es falsa: el AND-list devuelve 1 y GitHub corre los steps con `bash -e`. Se
implemento con `if ... fi`, que cumple el mismo objetivo (array mas comillas contra word-splitting
y globbing) sin introducir el fallo. Se deja constancia para que no se "corrija" de vuelta.

### Coherencia con `119-GAP-CLOSURES.md`

Dos fixes tocan divergencias YA declaradas alli; la resolucion se registra en **ambos** lados:

* **G1 (seccion 2)** afirmaba que el cursor de leylobby avanza "con datos y solo con datos". Era
  cierto en intencion pero **no en codigo**: quedaban dos fallbacks al reloj (CR-02). Con
  `20f3b03` la afirmacion pasa a ser literalmente verdadera. La conclusion de la seccion 2 -que
  `lobby-leylobby` siga `stale:true` es lo CORRECTO- no cambia.
* **G12-119 (seccion 3)** ya habia identificado que `marcarIngestado` vive en el writer COMPARTIDO
  y que las 136 filas vigentes las escribio el conector de la **Camara**. CR-03 es la consecuencia
  operativa que no se saco: ese escritor marcaba con el reloj. Con `fd43906`, **los dos**
  escritores del marcador derivan la cobertura del dato. El rotulo de la senal sigue sin
  reapuntarse - `G12-119` permanece ABIERTO con sus dos opciones intactas.
