# Phase 133-a — PREMORTEM DE LOS PLANES

**Fecha:** 2026-08-06 · **Objeto:** `133-0{1..5}-PLAN.md` (commit `0ae3e8a`) · **Método:** refutación.
**No es** el premortem de la adjudicación (`133-PREMORTEM.md`, otro objeto).
**Nada aquí re-abre una decisión LOCKED.** Lo que se dice es: *este plan, tal como está escrito, no
se puede ejecutar / sale verde sin probar nada / se detiene en un punto ya predecible hoy.*

Todo se verificó ejecutando comandos en el working tree en `563c663`. Los que fallan, fallan **hoy**.

---

## 0. Resumen ejecutivo

**PREMORTEM: 6 BLOCKERS** (+ 6 hallazgos menores).

El más caro no es de diseño: es de **fontanería**. El comando de extracción de conteo que aparece en
**los cinco planes**, en 11 tareas, y que es la `<verify><automated>` de casi todas, **no devuelve
nada contra la salida real de vitest**. Como los planes prohíben explícitamente aceptar el exit code
solo, y el plan 02 ordena *"si `N_ANTES` no se puede extraer, PARAR y escalar"*, la fase se detiene
en la **Task 1 del plan 02** y no llega a escribir una línea de código.

El segundo es de orquestación: los dos planes de la wave 2 **modifican el mismo archivo**, con
`use_worktrees: true`.

El tercero es un gate de escalada que ya sabemos que va a dispararse: la comparación de índices de
corte de D-133-J1.4 diverge en **44 de 85** ítems de los fixtures reales, por una razón trivial
(`fold()` hace `.trim()`), y el plan ordena parar.

---

## 1. Tabla de premisas VERIFICADAS

| # | Premisa (y qué plan descansa en ella) | Cómo se verificó | Veredicto | Evidencia |
|---|---|---|---|---|
| P1 | `grep -oE 'Tests[^0-9]+[0-9]+ passed'` extrae el conteo de vitest (01·T2,T3 · 02·T1,T3 · 03·T2 · 04·T1,T2,T3 · 05·T1,T2,T3) | `vitest run \| tee log; grep -oE ... log` | **FALSA** | salida vacía, `rc=1`. `cat -v`: `^[[2m      Tests ^[[22m ^[[1m^[[32m206 passed^[[39m` — el `22` del reset ANSI es dígito y rompe `[^0-9]+[0-9]+ passed` |
| P2 | La suite de `@obs/news` está en **206** hoy | `pnpm --filter @obs/news exec vitest run` | **VERDADERA** | `Test Files 12 passed (12)` / `Tests 206 passed (206)` |
| P3 | La suite de `app/` tiene línea base extraíble | `NO_COLOR=1 pnpm --filter ./app test` | **VERDADERA con la corrección de P1** | `Test Files 121 passed (121)` / `Tests 1799 passed (1799)`, 98 s |
| P4 | El allowlist son **63 rutas, 0 faltantes** (02·T3; habilita G3 sin reparación) | script sobre los 14 arrays `SUPERFICIES_*` + `existsSync` | **VERDADERA** | `arrays: 14 · rutas unicas: 63 · faltantes: 0 []` |
| P5 | Hay **dos** `try{readFileSync}catch{continue}` | lectura directa | **VERDADERA** (líneas ligeramente corridas) | `anti-insinuacion-guard.test.ts:940-948` (test 1) y `:972-978` (test 1b) — los planes citan `:943-948` y `:974-978` |
| P6 | `TERMINOS_LINK_EXT :569`, `TERMINOS_COBERTURA :605`, `TERMINOS_PROHIBIDOS :623` | `grep -n` | **VERDADERA** | `app/lib/anti-insinuacion-guard.test.ts:569,:605,:623` |
| P7 | `NEGACIONES_LOCKED` en `:764-826`, importa 5 constantes `.tsx` en `:33-40` | `grep -n` | **FALSA (drift de línea)** | `NEGACIONES_LOCKED` está en `:776`; el import (`IDIOMS_APROBADOS`) está en `:59`, no en `:33-40`. `:33-40` es JSDoc |
| P8 | `buildTermRegex`/`WORD` en `:828-841` | `grep -n` | **VERDADERA** | `:837` (`const WORD`), `:839` (`buildTermRegex`) |
| P9 | `findWorkspaceRoot` existe y lanza | `grep -rn` | **VERDADERA** | definida en `packages/news/src/run-news-cli.ts:190`; re-exportada en `packages/news/src/index.ts:46` |
| P10 | `walkSourceFiles` + `SKIP_DIRS` en `lockdown-guard.test.ts:102-135`, piso `>10` en `:733-736` | lectura | **VERDADERA** | `SKIP_DIRS` en `:102`; `expect(sourceFiles.length).toBeGreaterThan(10)` en `:735` |
| P11 | `assertFrozen`/`hashCasos` en `llm-bench/src/guards/freeze.ts:29-52` y los 4 tests en `disjuncion.test.ts:52-70` | lectura | **VERDADERA** | `hashCasos` `:34`, `assertFrozen` `:46`, mensaje `FREEZE ROTO:`; los 4 `it` en `:52-70` |
| P12 | El walk de `app/` da **> 100** archivos `.ts/.tsx` no-test (05·T2 piso) | walk replicado con los `SKIP_DIRS` reales | **VERDADERA** | `158` |
| P13 | Ningún literal de `ETIQUETAS` aparece hoy en `app/` (G2 nace verde) | walk + `includes` de las 6 etiquetas | **VERDADERA** | `0` hits para las 6 |
| P14 | G1 nace verde: cero términos prohibidos en las glosas de A2.2 | extracción real de los 3 arrays + `buildTermRegex` verbatim sobre las 14 glosas + 6 etiquetas + 3 `enruta_a` | **VERDADERA** | `terminos extraidos: 104` · `HITS: 0` |
| P15 | El piso duro `>= 100` términos de G1 es alcanzable por regex sobre disco | mismo script | **VERDADERA, pero justa** | `104` únicos (`TERMINOS_PROHIBIDOS` + los 2 spreads). Extraer solo `TERMINOS_PROHIBIDOS` daría **< 100** |
| P16 | `pnpm guards` imprime hoy **3** líneas de conteo → 4 tras añadir news (05·T3) | `NO_COLOR=1 pnpm guards \| grep -cE ...` | **VERDADERA (con P1 corregido)** | `3` — `347`, `34`, `7` |
| P17 | `grep -c '\*guard\*' package.json` = 0 tras el cambio (05·T3) | `grep -c` | **FALSA — inalcanzable** | vale **1 hoy** y el literal vive en el JSDoc `//guards` (`package.json:12`) que el propio plan manda **conservar** |
| P18 | El patrón `packages/news/src/eval/**/*.json` cubre `eval/x.json` (sin subdir) | `git -c core.attributesFile=... check-attr` | **VERDADERA** | `eval/x.json: text: set / eol: lf`; `eval/sub/y.json` idem; `src/otro.json: unspecified` |
| P19 | `git add --renormalize -- packages/news/src/eval` es "no-op" hoy (01·T1 paso 2) | ejecutado | **FALSA** | `fatal: pathspec 'packages/news/src/eval' did not match any files` · `rc=128` |
| P20 | `core.autocrlf=false`, `.gitattributes` no existe, `eval/` no existe | `git config`, `ls` | **VERDADERA** | `false`; `ls: cannot access '.gitattributes'`; `ls: cannot access 'packages/news/src/eval'` |
| P21 | `git clone -q --no-hardlinks "file://<ruta con espacio>"` funciona (03·T3) | ejecutado con la ruta real bajo `OneDrive - pjud.cl` | **VERDADERA** | `clone rc=0`, clon poblado |
| P22 | `LIMITE_DESCRIPCION=600` `:50`, `MARGEN_TRUNCADO` `:107`, `construirTexto` `:109`, truncado `:119-121` | `grep -n` | **VERDADERA** | exacto: `:50`, `:107`, `:109`, `:120-121` |
| P23 | `MARGEN_TRUNCADO` se deriva en runtime | evaluado | **VERDADERA** | `= 23` (`"tribunal constitucional"`), 30 términos |
| P24 | El test `prefiltro-lexico.test.ts:188-192` "ejercita el corte a 600" y por tanto caza la mutación del `.replace(/\S*$/,"")` | reproducido numéricamente | **FALSA** | la descripción del test mide **623 = 600 + 23** exactos ⇒ el `slice` no corta nada y el `.replace` solo borra `"hoy"`. Sin el `.replace`, el string sigue conteniendo `"proyecto de ley"` ⇒ **test verde** |
| P25 | Los índices de corte foldeado vs sin-foldear pueden coincidir en los 5 fixtures (04·T2) | simulación con `despojarHtml`/`fold`/truncado reales sobre `__fixtures__/*.xml` | **FALSA** | 5 fixtures, **85** ítems con descripción, **44** con longitud distinta y **44 con índice de corte distinto** (`fold()` hace `.trim()`) |
| P26 | `zod` ya es dependencia; `passWithNoTests: true` en ambos paquetes; `tsconfig` de news incluye solo `src/**/*.ts` | lectura | **VERDADERA** | `packages/news/package.json:21` `"zod": "^4.4.3"`; `app/vitest.config.ts` y `packages/news/vitest.config.ts` ambos `passWithNoTests: true`; `packages/news/tsconfig.json` `"include": ["src/**/*.ts"]` |
| P27 | Worktrees ON (relevante para conflictos de wave) | `.planning/PROJECT.md:74` | **VERDADERA** | `use_worktrees: true` |

---

## 2. Modos de fracaso, ordenados por daño

### BLOCKER 1 — El comando que mide TODO no devuelve nada (falso rojo universal)

**Síntoma, hora 0:15.** El ejecutor del plan 02 corre la Task 1, `tee /tmp/133-app-antes.log`, y
después `grep -oE 'Tests[^0-9]+[0-9]+ passed'`. Salida vacía. El plan dice, literalmente:

> *"Si `N_ANTES` no se puede extraer (el grep no encuentra la línea), **PARAR y escalar**: sin línea
> base no hay diff-cero demostrable."* (`133-02-PLAN.md:78-79`)

La fase se detiene antes de tocar código. En los otros cuatro planes, el mismo grep es la
`<verify><automated>` — el ejecutor verá 11 verificaciones "vacías" y, o bien las declara cumplidas
sin número (falso verde por omisión), o las declara rotas.

**Causa raíz, con la evidencia literal.** vitest emite ANSI aunque la salida vaya a un archivo:

```
$ pnpm --filter @obs/news exec vitest run 2>&1 | tee /tmp/pm-news.log > /dev/null
$ grep -oE 'Tests[^0-9]+[0-9]+ passed' /tmp/pm-news.log ; echo rc=$?
rc=1
$ grep -a 'Tests' /tmp/pm-news.log | cat -v
^[[2m      Tests ^[[22m ^[[1m^[[32m206 passed^[[39m^[[22m^[[90m (206)^[[39m
```

Tras `Tests` viene `\e[22m` — el `22` es dígito, `[^0-9]+` se detiene ahí, `[0-9]+` consume `22`, y
después falta `" passed"`. No hay otra posición de inicio posible (`Tests` es literal). Cero matches,
siempre.

**Qué cambiar.** Uno de los dos, verificados funcionando hoy:

```
$ NO_COLOR=1 pnpm --filter @obs/news exec vitest run 2>&1 | grep -oE 'Tests[^0-9]+[0-9]+ passed'
Tests  206 passed                                   # rc=0
$ grep -a 'Tests' log | sed 's/\x1b\[[0-9;]*m//g' | grep -oE 'Tests[^0-9]+[0-9]+ passed'
Tests  206 passed                                   # rc=0
```

Afecta a: **01**·T2,T3 · **02**·T1,T2,T3 · **03**·T2 · **04**·T1,T2,T3 · **05**·T1,T2,T3 —
`<acceptance_criteria>` y `<verify>` de cada una.
Nota: `pnpm guards` con `NO_COLOR=1` sí da los 3 conteos, así que el criterio de "4 líneas" de
05·T3 es correcto **una vez arreglado el grep** (hoy da `0`, jamás `4`).

---

### BLOCKER 2 — Los dos planes de la wave 2 escriben el mismo archivo

**Síntoma, hora 2.** El merge de la wave 2 conflictúa en `packages/news/src/eval/index.ts`, o —si el
runner no usara worktrees— el criterio de 03·T3 *"`git diff --name-only <SHA>` lista
`.github/workflows/ci.yml` y nada más"* falla listando los archivos del plan 04.

**Causa raíz.** Ambos lo declaran en su propio front-matter:

- `133-03-PLAN.md:14` → `files_modified: … packages/news/src/eval/index.ts`
- `133-04-PLAN.md:14` → `files_modified: … packages/news/src/eval/index.ts`

y ambos son `wave: 2`, `depends_on: ["133-01"]` (`133-03-PLAN.md:5-6`, `133-04-PLAN.md:5-6`). Con
`use_worktrees: true` (`.planning/PROJECT.md:74`) corren en árboles separados y colisionan al
integrar. La afirmación del planner de que no hay conflicto de archivo entre waves es correcta para
la wave 1 (01 y 02 son disjuntos) y **falsa para la wave 2**.

Agravante acoplado: los dos planes tienen criterios de conteo relativos —03·T2 *"un número mayor que
el conteo registrado al cierre del plan 133-01"*, 04·T1 *"`N_DESPUES == N_ANTES + nuevos`"*— medidos
mientras el otro plan añade tests al mismo paquete. Cualquiera de los dos órdenes de merge produce un
número que ninguno de los dos criterios predice.

**Qué cambiar.** O bien 03 y 04 pasan a waves distintas (04 → wave 2, 03 → wave 3, empujando 05), o
`eval/index.ts` se declara íntegro en **133-01** (que ya lo crea, `133-01-PLAN.md:11`) con todos los
re-exports previstos, y 03/04 quedan prohibidos de tocarlo. Lo segundo es más barato y coherente con
el motivo que ambos planes ya invocan para no tocar el barrel raíz.

---

### BLOCKER 3 — El gate de escalada de D-133-J1.4 está garantizado a dispararse

**Síntoma, hora 3.** El ejecutor del plan 04 corre el test comparativo de índices de corte. Diverge.
El plan (`133-04-PLAN.md:187-189`) ordena:

> *"**Si los índices difieren en CUALQUIER fixture, el ejecutor PARA y escala.** No elige un lado, no
> ajusta el test, no 'documenta la diferencia y sigue'."*

Escalada al operador por un resultado que se podía calcular hoy, en 30 segundos, y cuya explicación
es de una línea.

**Causa raíz, medida.** Simulando `despojarHtml`/`fold`/truncado verbatim sobre
`packages/news/src/__fixtures__/*.xml`:

```
fixtures: 5
items con descripcion: 85
items donde len(despojado) != len(foldeado): 44
items donde el INDICE DE CORTE difiere: 44
  ej: biobiochile.xml  len 602 vs 600  corte 602 vs 599  '" El Cuerpo de Bomberos de Quil"'
```

`fold()` (`packages/news/src/prefiltro-lexico.ts:93-100`) termina en `.trim()`; `despojarHtml`
(`:77-89`) no. Las descripciones del RSS vienen con espacio de guarda ⇒ 2 chars de diferencia
sistemática. **No es un defecto**: es un desplazamiento constante de trim, que no amputa ningún
término del vocabulario.

**Qué cambiar.** 04·T2. El test debe comparar **contenido tras `.trim()`**, no el índice crudo; y la
condición de escalada debe ser la que a D-133-J1.4 realmente le importa —*"el truncado sin foldear
pierde un término del vocabulario que el foldeado conservaba"*— no *"los índices difieren"*. La
decisión firmada dice *"puede cortar en un índice distinto **si `fold` cambia la longitud**"*: ya
sabemos que la cambia y por qué; el plan puede declararlo y medir la consecuencia real.

---

### BLOCKER 4 — La prueba de mutación de 04·T1 no puede salir roja

**Síntoma, hora 1.** El ejecutor quita `.replace(/\S*$/, "")`, corre
`vitest run prefiltro-lexico`, y sale **verde**. El criterio exige `test $rc -ne 0`. Bucle: o lo
declara cumplido en falso, o inventa un test nuevo (que ya no prueba lo que el criterio dice probar).

**Causa raíz, reproducida numéricamente.** El test que el plan y el addendum citan como el que
*"ejercita el corte a 600"* (`133-04-PLAN.md:80,89`; `133-ADDENDUM-IMPLEMENTACION.md:52`) es
`packages/news/src/prefiltro-lexico.test.ts:187-194`:

```
relleno.slice(0, 590) + "el proyecto de ley fue votado hoy"   → 623 chars
LIMITE_DESCRIPCION + MARGEN_TRUNCADO = 600 + 23              = 623
```

El `slice` no corta nada. El `.replace(/\S*$/,"")` solo borra la última palabra, `"hoy"`. Quitarlo
deja los 623 chars intactos, `"proyecto de ley"` sigue presente, `esLegislativo` → `true`.
Verificado: `con replace contiene: true` / `sin replace contiene: true`. Ese test cubre el
**margen** (`+ MARGEN_TRUNCADO`), no el corte en frontera. **El `.replace` no tiene cobertura hoy.**

**Qué cambiar.** 04·T1. La mutación honesta para la suite existente es **quitar `MARGEN_TRUNCADO`**
(dejar `slice(0, LIMITE_DESCRIPCION)`), que sí pone rojo (`corte en seco 600 contiene: false`,
`"...bra palabrel proyect"`). Si se quiere cubrir el `.replace`, hay que **escribir el test que hoy
falta** — con una descripción bastante más larga que 623 — y esa es una tarea, no un criterio.

---

### BLOCKER 5 — El criterio que debe probar "DOS skips cerrados" solo ve UNO, y ya vale 1 hoy

**Síntoma, 6 meses después.** Alguien lee el SUMMARY: *"se cerraron DOS skips silenciosos"*. Vuelve
al archivo: el test (1) sigue con `catch { continue }`. El guard que se declaró curado sigue ciego en
su camino principal.

**Causa raíz.** El criterio de `133-02-PLAN.md:209-210` es

```
grep -n -A2 'readFileSync' app/lib/anti-insinuacion-guard.test.ts | grep -c 'continue'   → debe ser 0
```

Medido **hoy, sin ningún cambio**:

```
-A2 → 1        # solo ve el skip #2
-A4 → 2        # ve los dos
```

En el bloque `:940-948` median 3 líneas entre `readFileSync` y `continue` (`} catch {` + comentario);
en `:972-978` median 2. Con `-A2` el criterio **solo detecta el segundo**. Cerrar únicamente el
skip #2 hace que el criterio marque `0` y el plan se declare cumplido — exactamente el falso verde
que D-133-J3 nombra (`133-ADDENDUM-IMPLEMENTACION.md:106-107`: *"cerrar la mitad y reportarlo como
cerrado sería el falso verde de esta fase"*).

Segundo defecto del mismo criterio: `grep -c` devuelve `0` **con exit code 1**. Encadenado con `&&`
el criterio correcto se lee como fallo.

**Qué cambiar.** 02·T3. Contexto suficiente (`-A6`) o, mejor, un criterio que no dependa de la
distancia: `grep -c 'catch' `… acotado a los dos `it`, o directamente
`grep -c 'continue' app/lib/anti-insinuacion-guard.test.ts`. Y capturar el conteo con
`n=$(grep -c ... || true)` para no confundir "cero" con "falló".

---

### BLOCKER 6 — 05·T3 exige borrar el propio aviso D-13 que el plan manda conservar

**Síntoma, hora 5.** El ejecutor actualiza el JSDoc de `package.json:12` de 17 a 20 guards, añade el
bloque de `@obs/news`, y corre el criterio:

```
grep -c '\*guard\*' package.json   → el criterio exige 0
```

Da **1**, hoy y después. El literal está dentro del propio JSDoc que el plan manda preservar:

> `package.json:12` — *"(D-13: jamás glob — `vitest run src/*guard*.test.ts` sale 0 sin correr nada)"*

y `133-05-PLAN.md:258-261` ordena *"Actualizar el JSDoc `//guards` (`package.json:12`)"*, no
borrarlo. Las dos únicas salidas del ejecutor son igual de malas: borrar el aviso D-13 (perder una
lección LOCKED documentada) o declarar el criterio cumplido en falso.

**Qué cambiar.** 05·T3. El criterio debe medir el **script**, no el archivo: p.ej.
`node -e 'process.exit(/\*guard\*/.test(require("./package.json").scripts.guards)?1:0)'`.

---

### Hallazgos menores (no bloquean, pero cuestan tiempo o mienten)

| # | Hallazgo | Evidencia | Dónde |
|---|---|---|---|
| M1 | `git add --renormalize -- packages/news/src/eval` **no es no-op**: `fatal: pathspec … did not match any files`, `rc=128`. El plan lo llama *"red idempotente; hoy es no-op"* | ejecutado | 01·T1 paso 2 (`133-01-PLAN.md:103-104`) |
| M2 | `Object.keys(o.umbrales \|\| o).length` debe dar **9**, pero la `<action>` describe `THRESHOLDS` como objeto plano con T1..T9 **más** `regla_de_intervalos`, `hipotesis_preregistrada` y `refutacion` ⇒ `Object.keys(o).length` = **12**. La clave `umbrales` no se manda crear en ningún lado | `133-03-PLAN.md:103-113` vs `:137-139` | 03·T1 |
| M3 | La canonicalización ordena claves ascendentemente ⇒ si `umbrales` es un **objeto**, el orden LOCKED `T1..T5, T9, T6, T7, T8` (D-133-D2) se pierde en el JSON (`T5` < `T6` < `T9`). Si es **array**, M2 no compila. La `<action>` no elige | D-133-E2 + tabla D-133-D2 | 03·T1 |
| M4 | 01·T2 ofrece *"`Object.freeze` … **o** usar `as const` con `readonly`"* — pero el `<behavior>` exige *"mutar `TAXONOMIA[0]` en runtime **lanza**"*, que `as const` (solo compile-time) no da. Una de las dos alternativas ofrecidas no satisface el behavior del mismo bloque | `133-01-PLAN.md:165-166` vs `:149` | 01·T2 |
| M5 | Drift de `ruta:línea` heredado del addendum: `NEGACIONES_LOCKED` está en `:776` (no `:764`); sus imports en `:59` (no `:33-40`); los skips en `:940`/`:972` (no `:943`/`:974`). No rompe nada, pero los `<read_first>` mandan a leer el lugar equivocado | `grep -n` | 02, 05 |
| M6 | El piso duro de G1 (`>= 100`) es alcanzable **solo** si se extraen los tres arrays: el conjunto completo da **104** únicos. Extraer solo `TERMINOS_PROHIBIDOS` (sin resolver sus dos spreads `...TERMINOS_LINK_EXT`/`...TERMINOS_COBERTURA`) queda por debajo. El plan lo pide bien, pero el margen es de 4 términos: cualquier poda futura del vocabulario rompe el piso | script de extracción: `terminos extraidos: 104` | 05·T1 |
| M7 | 05 importa `findWorkspaceRoot` "del barrel `index.ts:46`". Importar el barrel arrastra `writer-supabase`/`carga-run` a un guard que solo quiere una función de rutas. `packages/news/src/run-news-cli.ts:190` es el import directo | `packages/news/src/index.ts:40-51` | 05·T1,T2 |

---

## 3. Alcance y deriva de lo firmado — sin hallazgos

Revisado explícitamente, **sin blockers**:

- **Ningún plan etiqueta un caso.** 04·T3 lo prohíbe por escrito y añade el criterio de que
  `golden-set.json` **no** exista (`133-04-PLAN.md:270-272`). Correcto: es 133-b.
- **Ningún plan toca migraciones, RPC, flags ni el SC1 de la 134.** `files_modified` de los cinco
  planes: `.gitattributes`, `packages/news/src/{eval/*,prefiltro-lexico*}`, `app/lib/{terminos-insinuacion.ts,anti-insinuacion-guard.test.ts}`, `.github/workflows/ci.yml`, `package.json`. Nada más.
- **Cero instalaciones.** Verificado que `zod@^4.4.3` ya está (`packages/news/package.json:21`) y que
  `node:crypto`/`vitest` no requieren nada. Los cinco `T-133-SC` son correctos.
- **Deriva de D-133-K4:** el addendum dice *"clon limpio → **los tres** sha256 coinciden"*
  (`133-ADDENDUM-IMPLEMENTACION.md:187`). El plan 03 **corrige la cuenta a dos** y explica por qué
  (`golden-set.json` es 133-b), con anti-cero-vacuo `wc -l = 2` (`133-03-PLAN.md:56-58, 261-262`).
  Eso es lectura fiel, no deriva.
- **D-133-K3 (17 → 20) y D-133-K2 (deuda de raíz declarada, no arreglada)** se implementan tal cual.

---

## 4. Lo que los planes aciertan y no hay que tocar

No es una demolición: seis de las siete premisas *sustantivas* del research resistieron la
verificación independiente, y varias de las defensas más caras están bien puestas.

1. **G1 y G2 nacen verdes, y eso está medido, no supuesto.** Corrí `buildTermRegex` verbatim con los
   104 términos reales sobre las 14 glosas de A2.2 más las 6 etiquetas: **0 hits**. Y las 6 etiquetas
   no aparecen en ninguno de los 158 archivos no-test de `app/`. Los dos guards se pueden encender
   sin presupuestar reparación.
2. **63/0 confirmado.** G3 se puede convertir en fallo duro sin poner la suite roja, exactamente como
   dice D-133-J3 — y el plan **sigue exigiendo re-verificarlo en ejecución** en vez de confiar en la
   medición del research (`133-02-PLAN.md:196-200`). Eso es la actitud correcta.
3. **El orden `.gitattributes` → JSON es correcto y el patrón funciona.** `check-attr` confirma que
   `**/*.json` cubre el archivo directo en `eval/`, y el control negativo apareado varía **una sola**
   variable (el directorio), sobre dos rutas inexistentes. Es un control positivo bien construido.
4. **El control positivo del hash en clon limpio es ejecutable en esta máquina**, con la ruta con
   espacio bajo OneDrive: `git clone -q --no-hardlinks "file://$R"` → `rc=0`. Y viene con
   anti-cero-vacuo (`wc -l = 2` antes del `diff`) y con control apareado propio. Es el criterio mejor
   construido de los cinco planes.
5. **La mutación estrella de 03·T2 —reordenar claves sin cambiar semántica y exigir que la sincronía
   falle— es la prueba correcta** del falso verde que el research nombra como el más probable de la
   fase. Aísla exactamente una variable (bytes vs objeto parseado) y no puede pasar por otra razón.
6. **05·T3 ya entendió que el nombre fantasma no se caza por exit code.** El criterio por
   **diferencia de conteo** (no `rc`) bajo `passWithNoTests: true` es exactamente lo que hace falta —
   y `pnpm guards` sí imprime los 3 conteos hoy, así que el "4" es la meta correcta. Solo hay que
   arreglarle el grep (B1) y el criterio del glob (B6).
7. **La disciplina de `if CMD > log 2>&1; then rc=0; else rc=$?; fi`** en las 14 pruebas de mutación,
   con la advertencia explícita *"jamás bajo `set -e`"*, está bien aplicada en los cinco planes.

---

## 5. Veredicto

**PREMORTEM: 6 BLOCKERS**

| # | Blocker | Plan / tarea a cambiar | Severidad |
|---|---|---|---|
| B1 | `grep -oE 'Tests[^0-9]+[0-9]+ passed'` nunca matchea (ANSI de vitest) — falso rojo universal; la fase para en 02·T1 | **los 5 planes**, 11 tareas (todos los `<acceptance_criteria>` de conteo y los `<verify>`) | **CRÍTICA** |
| B2 | 133-03 y 133-04 (misma wave 2) modifican ambos `packages/news/src/eval/index.ts`; conteos de test mutuamente no deterministas | front-matter de **03** y **04** (re-waving, o mover el barrel a 01) | **CRÍTICA** |
| B3 | El gate de escalada D-133-J1.4 se dispara con certeza: 44/85 ítems divergen por el `.trim()` de `fold()` | **04**·T2 (condición de escalada y forma del test) | **ALTA** |
| B4 | La mutación de `.replace(/\S*$/,"")` no puede salir roja: ningún test cubre el corte en frontera (623 = 600+23) | **04**·T1 (mutar `MARGEN_TRUNCADO`, o escribir el test que falta) | **ALTA** |
| B5 | `grep -A2` solo ve **uno** de los dos skips y ya vale 1 hoy ⇒ cerrar la mitad pasaría el criterio | **02**·T3 (criterio de los DOS skips) | **ALTA** |
| B6 | `grep -c '\*guard\*' package.json` = 0 es inalcanzable sin borrar el aviso D-13 que el mismo plan manda conservar | **05**·T3 | **MEDIA-ALTA** |

Ninguno es de diseño: los seis son de **redacción de criterio y de orquestación**. La arquitectura
que los planes describen —taxonomía como SSoT, congelación por bytes, guards por disco sin invertir
el grafo, truncado compartido— resistió la verificación.

---

*Premortem de planes — Phase 133-a. Todo hallazgo reproducido en el working tree en `563c663`.
Cero red. Ningún PLAN.md fue modificado.*
