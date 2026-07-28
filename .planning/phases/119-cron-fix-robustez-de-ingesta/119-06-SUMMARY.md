---
phase: 119-cron-fix-robustez-de-ingesta
plan: 06
subsystem: ingesta
tags: [cursor, freshness, lobby, leylobby, g1, g9, degradacion-honesta]
requires:
  - packages/lobby/src/reconciliar-sujeto.ts (parlamentariosConfirmados)
  - packages/probidad/src/run-probidad-todos.ts:138 (plantilla "cursor al día tras lote confirmado")
  - supabase/seeds/parlamentario.seed.json (maestra autoritativa)
provides:
  - lobby_ingesta_estado.ingestado_hasta derivado de los DATOS y monotónico
  - RunIngestLobbyResult.marcadoHasta (cobertura marcada por parlamentario)
  - LobbyWriter.marcarIngestado con contrato MONOTÓNICO (no retrocede)
  - bloque `POR QUÉ DOS CURSORES` en cursor-leylobby.ts
  - fichas-backfill.yml sin referencias a secrets inexistentes
affects:
  - packages/lobby/src/ingest-run.ts
  - packages/lobby/src/ingest-cli.ts
  - packages/lobby/src/cursor-leylobby.ts
  - packages/lobby/src/writer.ts
  - packages/lobby/src/writer-supabase.ts
  - .github/workflows/fichas-backfill.yml
tech-stack:
  added: []
  patterns: [degradacion-honesta, cursor-monotonico, dato-no-reloj, fail-closed-identidad]
key-files:
  created: []
  modified:
    - packages/lobby/src/ingest-run.ts
    - packages/lobby/src/ingest-run.test.ts
    - packages/lobby/src/ingest-cli.ts
    - packages/lobby/src/ingest-cli.test.ts
    - packages/lobby/src/cursor-leylobby.ts
    - packages/lobby/src/writer.ts
    - packages/lobby/src/writer.test.ts
    - packages/lobby/src/writer-supabase.ts
    - .github/workflows/fichas-backfill.yml
decisions:
  - "Causa G1 = (a) audiencias SIN parlamentarios confirmados, con una razón ESTRUCTURAL: el alcance LOCKED del cron son instituciones del EJECUTIVO, cuyos sujetos pasivos no son parlamentarios. Marcar de todos modos sería fabricar cobertura ⇒ NO se marca, y el test lo asevera."
  - "Los dos cursores CONVIVEN y no se derivan uno del otro: `leylobby_cursor_estado` = posición del barrido (clave institución); `lobby_ingesta_estado` = cobertura por parlamentario (clave parlamentario_id). Dominios que no se corresponden."
  - "`ingestado_hasta` sale de la fecha MÁXIMA de las audiencias ingeridas del parlamentario, nunca del reloj; y es MONOTÓNICO (un re-proceso histórico no retrocede la marca)."
  - "G9-yaml: la línea se ELIMINA en vez de remapearse porque `pipeline-cli.ts:150` ya cae a `SUPABASE_API_URL` — menos superficie que más mapeo."
metrics:
  duration: ~70min
  completed: 2026-07-28
requirements: [CRON-02]
---

# Phase 119 Plan 06: G1 (cursor de lobby) + G9-yaml Summary

El cursor de cobertura de leylobby ahora avanza con datos y **sólo** con datos: `ingestado_hasta`
sale de la fecha de las audiencias ingeridas (no del reloj), nunca retrocede, y una corrida que no
confirma a nadie no escribe nada. El diagnóstico previo demostró que el cursor detenido **no es una
avería**: es la lectura honesta de que el cron de leylobby barre instituciones del Ejecutivo, donde
ningún sujeto pasivo es parlamentario.

## Diagnostico G1

**Causa: (a) — las corridas traen audiencias pero CERO parlamentarios confirmados ⇒ `marcados`
queda vacío ⇒ `marcarIngestado` nunca corre.** La evidencia la distingue sin ambigüedad de (b) y (c).

Corrida de GH Actions `29920799120` (`lobby-leylobby-weekly`, schedule, `success`, 2026-07-22):

```
ingest-lobby: cursor AA001 → año 2026 pág 1
ingest-lobby: AA001/2026/p1 → 25 audiencias
ingest-lobby: OK → 25 audiencias / 0 contrapartes / 0 parlamentarios marcados
              (errores: 0, degradaciones: 0, drift-quarantine: false)
ingest-lobby: cursor avanzado → año 2026 pág 2
```

Eso **descarta (b)** (`degradaciones: 0`, no hubo 403/503) y **descarta (c)** (25 audiencias reales,
no un barrido vacío). Queda (a), y con la cifra exacta: `0 parlamentarios marcados` sobre 25
audiencias. Las 4 corridas semanales (`29920799120`, `29414815860`, `28942497396`, `28521694750`)
son todas `success`.

psql read-only (URL nunca impresa):

```
select origen, estado_vinculo, count(*) from lobby_audiencia group by 1,2;
camara-transparencia-lobby|confirmado|5106
camara-transparencia-lobby|no_confirmado|12624
leylobby-audiencias|no_confirmado|32

select count(*), max(ingestado_hasta) from lobby_ingesta_estado;
136|2026-06-22
```

**El dato decisivo:** el conector `leylobby-audiencias` tiene **32 filas, todas `no_confirmado`, cero
confirmadas EN TODA SU HISTORIA**. Las 136 filas de `lobby_ingesta_estado` con `2026-06-22` no las
escribió leylobby: las escribió el conector de la **Cámara** (`run-camara-lobby.ts:164`), que es el
único que confirma parlamentarios.

**Por qué (a) ocurre — dos razones que se suman:**

1. **Estructural (la de fondo):** el alcance LOCKED del cron son instituciones del **Ejecutivo**
   (`lobby-leylobby-weekly.yml:3-5`: "la Cámara y el Senado NO publican en leylobby.gob.cl"). Sus
   sujetos pasivos son autoridades de gobierno, no parlamentarios. `lobby_ingesta_estado` está
   claveada por `parlamentario_id`. **Este cron no puede, por diseño, avanzar ese marcador.**
2. **Defecto real (RULE-2, corregido acá):** la CLI llamaba a `runIngestLobby` con `maestra: []`
   siempre — nunca cargaba la maestra. `reconciliarSujeto` no podía confirmar a nadie ni en
   principio: la reconciliación era código muerto en el cron. Aunque un parlamentario hubiese
   aparecido, se habría perdido en silencio.

**Conclusión que gobierna el fix:** el cursor no miente por estar detenido; miente el *rótulo*. Ver
"Hallazgo para el documento de cierre".

## Qué se hizo

### Task 1 — diagnóstico (arriba)

Se eligió el fix por evidencia, no por analogía: la plantilla de probidad
(`run-probidad-todos.ts:138`) se aplicó en lo que aplica (marcar tras lote confirmado, `hasta` desde
los datos) y se **rechazó** el atajo de marcar `ingestado_hasta = hoy`, que habría puesto la señal en
verde sin un solo dato nuevo de un parlamentario.

### Task 2 — el cursor avanza con datos y sólo con datos (commits `42449bc` RED, `04217fc` GREEN)

- **`ingest-run.ts`**: `marcados` pasa de `Set<id>` a `Map<id, hasta>`. El `hasta` de cada
  parlamentario es la fecha **máxima de sus audiencias ingeridas** en la corrida
  (`fila.fecha.slice(0,10)`), con `opts.ingestadoHasta` sólo como fallback para una audiencia sin
  fecha parseable. Se agrupa por valor y se emite un `marcarIngestado` por grupo. `marcados` vacío ⇒
  **cero escrituras**. Nuevo campo `marcadoHasta` en el resultado.
- **`writer.ts` + `writer-supabase.ts`**: `marcarIngestado` es ahora **MONOTÓNICO** por contrato. La
  impl Supabase lee la cobertura vigente (`select ... in(...)`, chunks de 500 < cap PostgREST) y
  descarta los ids cuyo `ingestado_hasta` ya sea `>= hasta`; si ninguno avanza, no emite upsert. Un
  fallo de lectura propaga (nunca se escribe "por si acaso"). El fake in-memory espeja la regla.
- **`cursor-leylobby.ts`**: bloque `POR QUÉ DOS CURSORES` (28 líneas) que explica que **conviven** y
  por qué no se derivan uno del otro: `leylobby_cursor_estado` responde "qué recurso pido la próxima
  vez" (clave institución, operativo); `lobby_ingesta_estado` responde "hasta cuándo hay datos para
  este parlamentario" (clave `parlamentario_id`, es lo que lee freshness). Sus dominios no se
  corresponden: una institución puede barrerse entera sin cubrir a nadie, y un parlamentario puede
  quedar cubierto por el conector de la Cámara sin que el cursor de leylobby se mueva.
- **RULE-2**: la CLI carga la maestra del seed autoritativo cuando no se inyecta (misma fuente que
  `run-camara-lobby-cli.ts:98`). Verificado: **186 parlamentarios**. Esto no fabrica cobertura — sólo
  deja de ser ciego.
- **RULE-1**: `SUPABASE_DB_URL` (cadena psql `postgres://`) encabezaba la resolución de la URL REST →
  `Invalid supabaseUrl` en toda corrida local con `.env` completo. Invisible en CI porque allí esa
  variable no existe.

Los 5 tests de `<behavior>` existen y pasan; Test 3 asevera **explícitamente** la decisión de diseño
(cero confirmados ⇒ no se marca).

### Task 3 — G9 parte YAML (commit `a4eb239`)

`pipeline-cli.ts:150` ya resuelve `process.env.SUPABASE_URL ?? process.env.SUPABASE_API_URL`, y
`SUPABASE_API_URL` **ya estaba mapeado** en el workflow. Por eso se aplicó la rama del plan "eliminar
en vez de remapear": la línea que apuntaba a un secret inexistente se borró, con el comentario que
explica por qué (y por qué `lobby-leylobby-weekly.yml:57` sí debe remapear — su CLI no tenía ese
fallback). El diff toca 1 línea del bloque `env:` y nada más: ni `schedule:`, ni `permissions:`, ni
los pins de las actions. `GEMINI_API_KEY` **no se tocó**.

`gh secret list --repo Cuchecorp/gov-map` (NOMBRES y fechas — cero valores):

| Secret | Actualizado |
|---|---|
| DEEPSEEK_API_KEY | 2026-07-09 |
| R2_ACCESS_KEY_ID | 2026-07-09 |
| R2_BUCKET | 2026-07-09 |
| R2_ENDPOINT_URL | 2026-07-09 |
| R2_SECRET_ACCESS_KEY | 2026-07-09 |
| SUPABASE_API_URL | 2026-06-23 |
| SUPABASE_SECRET_KEY | 2026-06-23 |

**`GEMINI_API_KEY` sigue AUSENTE** ⇒ deuda de operador abierta, con checkpoint ya emitido en
`118-OPERATOR-CHECKPOINT.md`. **No se re-pide, no se carga.** Por lo tanto el dispatch de prueba de
`fichas-backfill` (paso 3 de G9) **NO se disparó**, y así se declara.

## Verificación

| Check | Resultado |
|---|---|
| `pnpm --filter @obs/lobby test` | 82 passed (9 archivos) — base 71 |
| `pnpm test` (suite completa) | 107 archivos verdes; bloque final 1560 passed |
| `npx tsc -b` | exit 0 |
| `! grep -q 'secrets.SUPABASE_URL' .github/workflows/fichas-backfill.yml` | **OK** (count 0) |
| `grep -c 'POR QUÉ DOS CURSORES' packages/lobby/src/*.ts` | cursor-leylobby.ts:1, ingest-run.ts:1 (≥1) |
| Guards env-example + lockdown + name-match-rut | 53 passed (3 archivos) |

### Mutación: el Test 2 muerde

Mutación en memoria de `ingest-run.ts` — añadir un `marcarIngestado` incondicional al cierre de la
corrida (es decir, fabricar cobertura ignorando si hubo datos):

```
FAIL  Test 2: corrida degradada (503) ⇒ NINGÚN cursor avanza (T-74-02 preservada)
FAIL  Test 3: audiencias pero CERO confirmados ⇒ NO se marca nada
FAIL  Test 5: `ingestado_hasta` NUNCA retrocede
Tests  5 failed | 9 passed (14)
```

Restaurado el archivo, 82/82 verde. Los tests no son decorativos.

### Corrida LOCAL acotada contra PROD (rate-limit, UA y robots intactos)

Tres corridas de UNA institución / UNA página cada una, con override `--anio` (que **no** consulta ni
mueve `leylobby_cursor_estado`, así que el cron del miércoles queda donde estaba).

`select count(*), max(ingestado_hasta) from lobby_ingesta_estado;` (psql read-only, URL no impresa):

```
ANTES    136|2026-06-22
DESPUÉS  136|2026-06-22
```

```
select institucion_codigo, anio, pagina from leylobby_cursor_estado;
ANTES    AA001|2026|2
DESPUÉS  AA001|2026|2
```

**La marca NO se movió, y eso es el resultado correcto**, no un fallo. Log de las corridas:

```
ingest-lobby: maestra cargada del seed (186 parlamentarios)
[skip] sin novedades — leylobby AA001/2024/p1              ← hash-check R2 (G6) vivo
...
leylobby: crudo en R2 → leylobby/AA001/2023/p1/2026-07-28/071951ba5f15….html
leylobby: fila source_snapshot escrita (AA001/2023/p1)      ← provenance G5 vivo
ingest-lobby: AA001/2023/p1 → 0 audiencias
ingest-lobby: OK → 0 audiencias / 0 contrapartes / 0 parlamentarios marcados
```

Con la maestra CARGADA (186) la corrida sigue confirmando a cero: confirma que la causa de fondo es
estructural (Ejecutivo ≠ parlamentarios), no el bug de la maestra vacía. El bug era real y está
corregido, pero no era suficiente por sí solo — y decirlo al revés habría sido inventar un cierre.

`source_snapshot` pasó de 3 a **4 fuentes** (`lobby-leylobby` estrena sus 2 filas), cerrando de paso
el pendiente que 119-04 declaró abierto para este conector.

### `pnpm freshness --json` — antes y después

`lobby-leylobby` **sigue `stale: true`, 36 días**, y es lo honesto:

```json
{ "fuente": "lobby-leylobby", "tabla": "lobby_ingesta_estado",
  "ultimoUpsert": "2026-06-22", "diasDesdeUpsert": 36, "umbralDias": 7,
  "stale": true, "motivoStale": "dias>umbral",
  "ghRun": "success @ 2026-07-22",
  "r2Snapshot": "2026-07-28 18:49:24.229+00" }
```

Las tres señales juntas cuentan la verdad completa y **ninguna** se puede fabricar desde acá: el cron
corre (`ghRun: success`), la fuente entrega crudo fresco hoy (`r2Snapshot`), y la cobertura por
parlamentario está genuinamente vieja porque este conector no cubre parlamentarios. El criterio 2 del
ROADMAP se respeta: cero frescura fabricada.

## Deviations from Plan

**1. [Rule 2 — Funcionalidad crítica faltante] La CLI corría siempre con `maestra: []`**
- **Found during:** Task 1 (leyendo por qué `parlamentariosConfirmados` era 0 en el log del cron).
- **Issue:** `ingest-cli.ts` pasaba `maestra: opts.maestra ?? []` y nadie inyectaba nada en el cron
  ⇒ `reconciliarSujeto` no podía confirmar a ningún sujeto pasivo, jamás. Un parlamentario que
  apareciera se habría perdido en silencio como `no_confirmado`.
- **Fix:** `cargarMaestraSeed()` — mismo seed autoritativo que `run-camara-lobby-cli.ts:98`,
  best-effort (si el seed no está, devuelve `[]` con log: degradar a "no confirma a nadie" es el
  comportamiento previo, nunca un enlace falso). Verificado LIVE: 186 parlamentarios.
- **Files:** `packages/lobby/src/ingest-cli.ts` · **Commit:** `04217fc`

**2. [Rule 1 — Bug] `SUPABASE_DB_URL` encabezaba la resolución de la URL REST**
- **Found during:** Task 2, primera corrida LIVE local (`Invalid supabaseUrl: Must be a valid HTTP or
  HTTPS URL`).
- **Issue:** `SUPABASE_DB_URL` es la cadena de conexión `postgres://` de psql, no una URL REST.
  Toda corrida local del operador con `.env` completo moría en `createClient`. Invisible en CI porque
  allí esa variable no existe — el mismo patrón de "defecto que sólo destapa la corrida real" que
  119-04 registró con `date_bucket`.
- **Fix:** sólo se aceptan las dos URLs REST (`SUPABASE_URL`, `SUPABASE_API_URL`).
- **Files:** `packages/lobby/src/ingest-cli.ts` · **Commit:** `04217fc`

**3. [Rule 1 — Bug] `import.meta.url` no resolvía la raíz bajo `tsx -e`**
- **Found during:** verificación de la Deviation 1 (el loader devolvía `[]` en silencio).
- **Fix:** `import.meta.dirname` + `process.cwd()` como arranques de la búsqueda ascendente — el
  gotcha de Phase 46 (`new URL(import.meta.url)` se rompe bajo jsdom) y el de v8.1 (cwd bajo
  `pnpm --filter exec`), ambos aplicados.
- **Commit:** `04217fc`

**4. [Alcance] La guarda monotónica exigió tocar `writer.ts` / `writer-supabase.ts` / `writer.test.ts`**
- No estaban en `files_modified`, pero la no-regresión de `ingestado_hasta` (Test 5, T-119-17) sólo
  puede vivir donde se escribe. Cambio acotado a `marcarIngestado`; el fake in-memory del test
  espeja la regla y el mock del cliente Supabase se extendió con `select().in()`.

## Hallazgo para el documento de cierre de la fase

**`catalog.ts:11` y `:26` atribuyen mal la señal `lobby-leylobby`.** El comentario afirma que
`lobby_ingesta_estado.ingestado_hasta` "solo lo escribe el conector leylobby". Es **falso y está
invertido**: la única escritura vive en `run-camara-lobby.ts:164` (conector de la **Cámara**), y
leylobby no ha escrito nunca (0 confirmados en 32 filas). Es decir, la señal rotulada `lobby-leylobby`
mide en realidad la frescura del conector de la Cámara — el mismo "verde/rojo prestado" que G4 fue a
corregir, sobreviviendo en la otra dirección.

Criterio de cierre sugerido (fuera de este plan: `catalog.ts` es materia de 119-02, ya ejecutado):
o bien `lobby-leylobby` mide su propia huella —`source_snapshot where source='lobby-leylobby'`, que
desde hoy existe y hoy dice `2026-07-28`— o bien se declara que este conector no produce señal de
cobertura por parlamentario y se retira la entrada. Lo que **no** corresponde es dejar el rótulo
actual: hoy un lector concluiría que leylobby lleva 36 días caído cuando corrió hace 6 y trajo datos.

**Secundario:** `run-camara-lobby.ts:89` deriva su `date` de `fechaCaptura` (el reloj), no de las
fechas de las audiencias. Es el mismo T-119-17 que este plan cerró para leylobby, vivo en el conector
hermano. La guarda monotónica nueva ya le impide retroceder, pero puede sobrestimar hacia adelante.
Fuera de alcance acá (no está en `files_modified`); queda anotado.

## Known Stubs

Ninguno.

## Self-Check: PASSED

9/9 archivos declarados en `key-files.modified` existen. 3/3 commits declarados existen en el
historial (`42449bc`, `04217fc`, `a4eb239`).

## Threat Flags

Ninguno. **T-119-17** (repudiation): mitigado — `ingestado_hasta` sale de la fecha de las audiencias
ingeridas y la marca es monotónica; tests 1 y 5 lo aseveran y la mutación demuestra que muerden.
**T-119-18** (tampering): mitigado — T-74-02 preservada, verificada por el Test 2 a nivel de
`runIngestLobby` y por el test nuevo de `ingest-cli` que asevera que **ninguno de los dos** cursores
se mueve ante una degradación. **T-119-19** (information disclosure): mitigado — sólo NOMBRES y
fechas de `gh secret list`; ninguna URL ni credencial impresa en logs o en este documento.
**T-119-20** (elevation): el YAML **reduce** el conjunto de secrets referenciados (elimina uno, no
añade); `permissions: contents: read` intacto. **T-119-SC**: cero paquetes instalados. Rate-limit, UA
y robots intactos en las tres corridas LIVE.
