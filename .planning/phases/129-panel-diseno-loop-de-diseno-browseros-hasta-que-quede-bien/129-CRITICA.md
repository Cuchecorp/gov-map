# 129-CRITICA — Crítica de diseño del panel contra los baselines v13

**Plan:** 129-03 · **Requisito:** PANEL-09
**Deploy criticado:** `4c6fdbda-61ae-485e-9a4d-4197db35cf61`
**Baselines:** `.planning/spikes/assets/v13-baseline-{landing,panel-mid,panel}.png`
**Capturas criticadas:** `.planning/phases/129-…/assets/129-deploy-{landing-desktop,panel-390,comparar}.png`
(+ `it1-landing-full.png`, la única captura de página COMPLETA del panel: es la que permite ver la
grilla bento entera de una vez).

Este documento **no deploya y no aplica fixes**. Aplicar los `FIX` es trabajo de `129-04` Task 1.

---

## Salvedad obligatoria sobre la superficie `panel 390`

**La captura `129-deploy-panel-390.png` NO es del deploy real.** Se obtuvo por el **escalón (b)** de
`129-01`: un proxy local efímero (`127.0.0.1:4390`) que reenvía el contenido del Worker desplegado
quitando `content-security-policy` y `x-frame-options` de la RESPUESTA, para poder enmarcarlo en un
`<iframe width:390px>`. El `href` medido justo antes del shot fue `http://127.0.0.1:4390/`, no la
URL de producción. El escalón (a) —viewport real de 390 px— resultó IMPOSIBLE en este entorno:
`create_window` nace maximizada, `resizeTo` es no-op, `window.open` está bloqueado sin gesto, no hay
tool MCP de viewport, no hay puerto CDP abierto, y `MoveWindow` topa en el mínimo duro de Chromium
(`innerWidth` 770).

Además, el **DPR de esta máquina es 1,25, no 1**: el PNG de 390×1400 se obtuvo recortando el rect
exacto del iframe en px de dispositivo (488×1750) y reescalando ×0,8 a la grilla CSS.

**Consecuencia para esta crítica:** los hallazgos de la superficie `panel 390` se leen con esa
salvedad — el CONTENIDO es el del deploy real y las media queries evaluaron un viewport real de
390 CSS px (el layout de una columna lo confirma), pero **no** son un shot de producción y el
reescalado ×0,8 impide juzgar nitidez tipográfica o hairlines de 1 px en esa superficie.

---

## §Hallazgos

| id | superficie | delta observado vs baseline | archivo del componente responsable | veredicto | criterio de cierre | estado |
|---|---|---|---|---|---|---|
| **C-01** | landing desktop (`it1-landing-full.png`) vs `v13-baseline-landing.png` + `-panel-mid.png` | La grilla bento deja **dos huecos interiores de 2 columnas**: la fila de `En tabla de sala esta semana` y la fila de `Movimiento reciente` ocupan cols 1-4 y dejan cols 5-6 VACÍAS, mientras las otras dos filas sí van pareadas (`Comisiones`+`Urgencias`, `Votaciones`+`Ingresos`). El baseline no exhibía huecos interiores. Derivación mecánica: la grilla es de 6 columnas (`bento-grid.tsx:25`, `md:grid-cols-6`) y el orden de montaje es sala(4)·comisiones(4)·urgencias(2)·movimiento(4)·votaciones(4)·ingresos(2) (`panel-actualidad.tsx:182-187`) ⇒ auto-placement produce `[4|hueco2] [4+2] [4|hueco2] [4+2]` | `app/components/panel-actualidad.tsx` (orden, `:182-187`) + `app/components/panel-tile-movimiento.tsx:96` y `app/components/panel-tile-votaciones.tsx:89` (`span`) | **FIX** | Test de composición sobre `panel-actualidad`: la secuencia de `span` de los 6 tiles se particiona en filas de 6 sin remanente — es decir, `grep -oF 'md:col-span-' ` sobre el DOM renderizado del panel arroja spans cuya suma acumulada cierra en múltiplos de 6 en cada corte de fila. Implementación mínima propuesta: reordenar a sala(4)+urgencias(2) · comisiones(4)+ingresos(2) · movimiento(6) · votaciones(6). Control positivo apareado obligatorio: los 6 tiles siguen presentes (6 `<h2>` de tile en el DOM) | **CERRADO en 129-04** (iteración 2) — ver §Iteraciones C-01 |
| **C-02** | `/comparar` desktop (`129-deploy-comparar.png`) vs el botón `Buscar` de la landing en ambos baselines | El CTA primario `Comparar` se pinta **casi negro** (`bg-foreground`), mientras el CTA primario homólogo de toda la app (`Buscar` del hero) es **teal** (`bg-accent-product`). Evidencia de que es un outlier y no un sistema de dos CTAs: `bg-accent-product` aparece en **17** archivos de `components/`, `bg-foreground` en **2**, y el otro (`capa1/tramitacion-stepper.tsx:86`) no es un botón sino un marcador de paso ⇒ `/comparar` es el ÚNICO CTA primario de la app fuera del token | `app/components/comparar-selector.tsx:79` | **FIX** | `grep -oF 'bg-foreground' app/components/comparar-selector.tsx \| wc -l` == 0 **y** `grep -oF 'bg-accent-product' app/components/comparar-selector.tsx \| wc -l` >= 1 (control positivo apareado sobre el mismo archivo, para que el cero no sea vacuo) | **CERRADO en 129-04** (iteración 3) — ver §Iteraciones C-02 |
| **C-03** | `/comparar` desktop (`129-deploy-comparar.png`) vs todos los tiles del panel en `v13-baseline-panel-mid.png` | Las fechas de `/comparar` se emiten en **ISO** (`En las fuentes consultadas al 2026-07-30…`, `Fuente: BCN · consultado al 2026-07-30`), mientras TODO el panel y los baselines usan el formato civil chileno (`datos al 24 jul 2026`, `Citado el 03 ago 2026`). La causa es `fechaConsultaHoy()`, que formatea con `Intl.DateTimeFormat("en-CA", …)` — locale que produce `YYYY-MM-DD` | `app/app/comparar/page.tsx:54-61` (y sus dos sitios de uso, `:54` y `:237`) | **FIX** | El DOM renderizado de `/comparar` contiene `jul 2026` (o el mes civil que corresponda) y **cero** ocurrencias del patrón ISO: `grep -oE '20[0-9]{2}-[0-9]{2}-[0-9]{2}'` sobre el HTML servido == 0, apareado con control positivo `grep -oF ' 2026' \| wc -l` >= 1. **Guardarraíl**: usar `fechaCivilCorta` (`lib/dia-calendario`), que es el helper date-only del repo — JAMÁS convertir zona horaria sobre estos valores (gotcha rector v12.0: `date-only disfrazado de timestamptz`) | **CERRADO en 129-04** (iteración 3) — ver §Iteraciones C-03 |
| **C-04** | panel 390 (con salvedad) y landing desktop | **D-06, concordancia de plural**: los moldes emitían `1 citaciones del Senado`, `1 proyectos con {grado}`, `1 abstenciones`, `1 pareos`. El baseline lo exhibe literalmente: `v13-baseline-panel-mid.png` muestra **`1 sesiones de sala próximas`** | `app/components/panel-tile-comisiones.tsx:37`, `panel-tile-urgencias.tsx:160`, `panel-tile-votaciones.tsx:64` | **FIX** | `pnpm --filter ./app exec vitest run lib/plural.test.ts components/panel-tile-comisiones.test.tsx components/panel-tile-urgencias.test.tsx components/panel-tile-votaciones.test.tsx` sale 0 con más tests que el conteo base | **CERRADO en 129-03** (ver §Plural) |
| **C-05** | landing desktop vs `v13-baseline-panel.png` | El tile `Por materia`, que en el baseline llenaba una columna entera con **seis** filas idénticas `(sin materia)` seguidas de un número, **ya no se monta**. Es una mejora respecto del baseline, no una regresión | `app/components/panel-actualidad.tsx:51` (bloque `I. agrupacion_materia MUERE sin tombstone (O-3)`) | **ACEPTAR** | Ya verificado en `129-DEPLOY-EVIDENCIA.md` §B-02: `(sin materia)`=0 y `Por materia`=0 sobre el DOM del deploy, con control positivo apareado `Comisiones citadas esta semana`=2 ⇒ ceros fuertes | n/a |
| **C-06** | landing desktop (`it1-landing-full.png`) | El remanente del tile `Urgencias del Ejecutivo` se muestra como **texto plano** (`62 más`), mientras `Comisiones` y `Sala` lo muestran como **link** (`y 27 más →`). Es una asimetría visual REAL, pero es **decisión fijada**, no defecto | `app/components/panel-tile-urgencias.tsx:26-32` | **ACEPTAR** | No procede fix: el comentario del componente lo declara textualmente — *"O-6 elimina el link agregado de tile: … el remanente se declara como TEXTO SIN LINK (fix W-6, FIJADO, cero discreción) — jamás un 'y N más →' con destino"*. No existe destino honesto al que enlazar el remanente de urgencias; enlazarlo fabricaría una promesa de navegación | n/a |
| **C-07** | landing desktop (`it1-landing-full.png`) | El tile `Votaciones recientes` muestra **tres filas consecutivas con el mismo título** (`18259-08 — Modifica el Código de Minería…`), leyéndose como duplicado a primera vista; el distintivo (fecha, resultado, conteos) vive solo en la línea `muted` inferior | `app/components/panel-tile-votaciones.tsx:106-107` | **ACEPTAR** | No procede fix: son **tres votaciones distintas del mismo boletín**, y no agregarlas es invariante testeada (`panel-tile-votaciones.test.tsx`, *"dos votaciones del MISMO boletín producen DOS `<li>`, jamás una agregada"*, con el control `queryByText(/62/)` que prohíbe sumar). Fusionarlas o titular distinto sería afirmar un hecho que la fuente no da | n/a |
| **C-08** | panel 390 (con salvedad) | La nav del header **envuelve a dos líneas**, dejando `Sobre` huérfano en la segunda | `app/components/header-nav.tsx:67` | **ACEPTAR** | No procede fix: el wrap es el comportamiento declarado (`flex flex-wrap items-center gap-x-1 gap-y-1 sm:gap-x-2`). Con 5 destinos y 390 px, envolver es preferible al scroll horizontal o al truncado; no hay hueco de layout ni superposición en la captura | n/a |
| **C-09** | panel 390 (con salvedad) | El placeholder del buscador hero se **recorta** a `Escribe una idea o un númerc` (42 caracteres en un input de ~280 px útiles) | `app/components/search-box.tsx:111-114` | **DIFERIR** | Ver §Diferidos, fila D-3 | n/a |

**Ningún hallazgo `FIX` de esta tabla es irrecuperable**: los cuatro nombran archivo y línea existentes
y cierran con un `grep`/test, no con un adjetivo. Los cuatro `ACEPTAR` llevan razón explícita —
tres de ellos porque el "defecto" aparente es una **decisión ya arbitrada** (O-3, W-6/O-6, y la
invariante anti-agregación de votaciones), no porque no se supiera qué hacer.

Verificación de existencia de los responsables de las filas `FIX`:

```
$ for f in app/components/panel-actualidad.tsx app/components/panel-tile-movimiento.tsx \
           app/components/panel-tile-votaciones.tsx app/components/comparar-selector.tsx \
           app/app/comparar/page.tsx app/components/panel-tile-comisiones.tsx \
           app/components/panel-tile-urgencias.tsx; do test -f "$f" && echo "OK $f"; done
```

---

## §Presupuesto de iteraciones

**Tope de la fase: 3 iteraciones.** `129-03` **consume 1**; quedan **2** disponibles para `129-04`.

| # | qué entra | dónde se gasta | estado |
|---|---|---|---|
| **1** | **C-04** (plural, los 4 moldes) | `129-03` (este plan) | **GASTADA — CERRADA** |
| **2** | **C-01** (huecos de la grilla bento) — el de mayor impacto visual y el único que se ve a distancia | `129-04` Task 1 | **GASTADA — CERRADA** (`eb2ff8a`) |
| **3** | **C-02** + **C-03** (los dos deltas de `/comparar`: token del CTA y formato de fecha) — se agrupan en UNA iteración porque son dos ediciones de una línea cada una, en la misma superficie, con criterios independientes | `129-04` Task 1 | **GASTADA — CERRADA** |

**Iteraciones gastadas en la fase: 3 de 3.** Ninguna fila `FIX` quedó en `AGOTADAS ITERACIONES`:
los cuatro `FIX` (C-01, C-02, C-03, C-04) están `CERRADO`.

---

## §Iteraciones — evidencia de cierre de los FIX de `129-04`

### C-01 — huecos interiores de la grilla bento (iteración 2, commit `eb2ff8a`)

**Desviación deliberada respecto de la implementación PROPUESTA por esta misma crítica.** La
propuesta era *reordenar* a sala(4)+urgencias(2) · comisiones(4)+ingresos(2) · movimiento(6) ·
votaciones(6). Se descartó porque **altera el ORDEN D-01/O-5**, que es una decisión ya arbitrada y
tiene test propio (`panel-actualidad.test.tsx`, *"orden del DOM: sala → comisiones → urgencias →
movimiento → votaciones → ingresos (O-5/D-01)"*): cerrar un hallazgo de layout rompiendo un
invariante de contenido habría sido un mal cambio.

La alternativa aplicada **conserva el orden intacto** y toca solo dos `span`:

| tile (orden DOM, sin cambios) | span antes | span ahora | fila resultante |
|---|---:|---:|---|
| sala | 4 | **6** | fila 1 = 6 ✔ |
| comisiones | 4 | 4 | fila 2 = 4+2 = 6 ✔ |
| urgencias | 2 | 2 | ↑ |
| movimiento | 4 | **6** | fila 3 = 6 ✔ |
| votaciones | 4 | 4 | fila 4 = 4+2 = 6 ✔ |
| ingresos | 2 | 2 | ↑ |

```
$ grep -hoE 'span=\{[0-9]\}' app/components/panel-tile-{sala,comisiones,urgencias,movimiento,votaciones,ingresos}.tsx
span={6} span={4} span={2} span={6} span={4} span={2}
```

Test de composición añadido en `app/components/panel-actualidad.test.tsx` (*"C-01: los spans de los
6 tiles cierran filas de 6 sin remanente"*): lee los spans de las **clases realmente emitidas** por
`BentoTile` en orden DOM (`[class*="md:col-span-"]`), exige `[6,4,2,6,4,2]`, simula el
auto-placement de la grilla de 6 columnas (si un tile no cabe en el remanente ⇒ hay hueco ⇒ falla) y
cierra con acumulado `0`. **Control positivo apareado dentro del mismo test:** los 6 `<h2>` de tile
siguen presentes — sin él, una lista vacía de spans "cerraría filas" de forma vacua.

### C-02 — token del CTA `Comparar` (iteración 3)

`app/components/comparar-selector.tsx`: el botón pasa a las MISMAS clases de color que el CTA
homólogo de la app (el `Buscar` del hero, `search-box.tsx:129-130`):
`bg-accent-product text-background hover:bg-accent-product/90`.

```
$ grep -oF 'bg-foreground' app/components/comparar-selector.tsx | wc -l
0
$ grep -oF 'bg-accent-product' app/components/comparar-selector.tsx | wc -l
4          # control positivo apareado sobre el MISMO archivo ⇒ el cero es FUERTE
```

> Nota de método: la primera redacción del comentario explicativo **transcribía el token viejo**, y
> el contador subía a **2** — el propio comentario habría vuelto vacuo el criterio. Se reescribió sin
> el literal. El valor `0` de arriba es el medido DESPUÉS de esa corrección.

Test nuevo `app/components/comparar-selector.test.tsx` (2 casos): el `button[type=submit]` existe y
dice `Comparar` (control positivo), lleva `bg-accent-product` y **no** el token viejo; y los dos
`<select>` NO heredan el relleno petróleo (su petróleo sigue siendo solo `focus-visible`).

El docblock del componente, que declaraba "petróleo SOLO en focus-visible", se **enmendó
explícitamente** en vez de dejarlo contradiciendo al código: esa regla describía los controles de
filtro, no el CTA primario.

### C-03 — fecha ISO en `/comparar` (iteración 3)

`app/app/comparar/page.tsx`: `fechaConsultaHoy()` sigue calculando el **mismo día** (`en-CA` +
`timeZone: America/Santiago` sobre `new Date()` — un instante REAL con hora, que sí debe convertirse
de zona) y solo re-formatea el resultado con `fechaCivilCorta` (`lib/dia-calendario`), que es
date-only y **no vuelve a convertir** — respetando el gotcha rector *date-only disfrazado de
timestamptz*. Segundo sitio corregido: `fechaCaptura`, que se emitía como `…slice(0,10)` crudo en la
línea de provenance de similitud de votación; ahora pasa por el mismo helper, sobre **exactamente el
mismo día** que ya se mostraba. **Cambia la presentación, jamás el hecho.**

**Fuera de alcance, intacto por mandato:** el manejo de errores de esta página (contrato LOCKED #34,
`page.tsx` *"cada lector LANZA; error ≠ vacío"*) NO se tocó — su enmienda es el diferido D-1 y
requiere pronunciamiento del operador.

La medición del criterio (cero ISO en el DOM servido, apareado con control positivo) se hace contra
el **deploy final** y vive en `129-DEPLOY-EVIDENCIA.md` §C-03 sobre el DOM desplegado.

### Suite tras las dos iteraciones

`pnpm --filter ./app test` → **1789 passed (120 files)**, exit 0 (base de `129-03`: 1786/119 ⇒
**+3**: 1 de composición bento + 2 del CTA). `pnpm guards` → exit 0.

**Orden de prioridad si el presupuesto se agota antes:** C-01 > C-02 > C-03. C-01 primero porque es
el único que altera la composición de la página completa; C-02 antes que C-03 porque un CTA fuera de
token se lee como "otro producto", mientras la fecha ISO se lee como dato crudo pero sigue siendo
correcta y trazable. Si una iteración se agota sin cerrar, `129-04` Task 1 marca la fila como
`AGOTADAS ITERACIONES` con lo medido, **jamás** como cerrada.

---

## §Diferidos

| id | hallazgo | mecanismo | propuesta de fix | razón del diferimiento | criterio de cierre futuro |
|---|---|---|---|---|---|
| **D-1** | **Resiliencia SSR de `/comparar`** (arrastrado de `129-02` / `129-H01-DEBUG.md` §DIFERIDO) | Seis lectores server-only se disparan juntos en el `Promise.all` de `app/app/comparar/page.tsx:246`, y **cada uno lanza** ante cualquier error de DB/red (`page.tsx:81` roster, `:92` militancia, `:108` comisiones, `:124` co-autoría, `:510` VSIM). `Promise.all` rechaza con el primer rechazo ⇒ **un fallo transitorio de UNA RPC tumba la página entera a 500**; y como `/comparar` no tiene `error.tsx` de ruta, el error sube al boundary raíz y el usuario lee `No pudimos cargar la portada` estando en `/comparar`. Es el modo **M-B** | Sustituir el `Promise.all` por aislamiento por eje (`Promise.allSettled` o envoltorio por lector); introducir un **tercer estado `fallo`, DISTINTO de `vacío`** (hoy hay `presente`/`ausente`/`indeterminado`, `page.tsx:625-628`), que declare *"no pudimos cargar este eje"* y jamás degrade un error a `[]`; `AbortSignal.timeout` + retry acotado en las siete lecturas; añadir `app/comparar/error.tsx` propio | **Enmendar el contrato LOCKED #34** (`page.tsx:74-76`) e invertir su test requiere **pronunciamiento del operador**: esa regla existe justamente para impedir que un error se lea como ausencia, y degradarla mal fabricaría un hecho negativo con atribución de fuente (riesgo #1 del proyecto). Además introduciría copy nuevo en producción fuera del único checkpoint humano de la fase | Un test de fallo de upstream sobre el harness **existente** `app/app/comparar/page.test.tsx:218-231` que, con una RPC en error, (a) NO rechace el render, (b) muestre la declaración de eje caído, (c) NO emita ninguna frase de ausencia — con control apareado (cero de la frase de ausencia + presencia positiva del copy de fallo). Requisito previo: pronunciamiento del operador |
| **D-2** | **Aislamiento de M-A** (`ChunkLoadError` post-hidratación) — arrastrado de `129-H01-DEBUG.md` §Aislamiento | El boundary raíz apareció con el SSR sano detrás (200, 109.384 bytes, boletines ×10, boundary=0 en el HTML). Hipótesis mejor sostenida: un cliente con el mapa de chunks del deploy anterior pide un chunk que ya no existe (control apareado medido: 9 chunks vigentes → 200; hash inventado → 404). **No verificada por reproducción** | Reproducir forzando un deploy con la pestaña ya abierta y **capturar el stack ANTES de re-navegar** — la re-navegación es lo que borró el buffer de consola y dejó `get_console_logs` en `{"entries":[],"totalCount":0}` en los 3 intentos de la ola 1 | Requiere una ventana de deploy coordinada con una sesión de navegador viva; no cabe en el flujo de `129-04`, cuyo re-deploy ocurre con capturas posteriores y páginas nuevas | Stack trace del error de hidratación capturado con el componente/chunk nombrado, o descarte positivo de la hipótesis del chunk stale |
| **D-3** | **C-09 — placeholder recortado a 390 px** | El placeholder del hero mide 42 caracteres (`Escribe una idea o un número de boletín…`) y el input a 390 px muestra ~28 (`…un númerc`) | Emitir el placeholder corto ya existente en el mismo archivo (`Busca por idea o número de boletín…`, la rama no-hero de `search-box.tsx:114`) por debajo de cierto ancho, o acortar el literal del hero | Doble razón: (i) es **copy de producción**, y el único checkpoint humano de la fase muestra 3 capturas del happy path — entraría copy que nadie le pone delante al operador; (ii) el único testigo es la superficie del **escalón (b)**, y un recorte de placeholder es exactamente el tipo de detalle que la salvedad de arriba impide dar por firme sin un viewport real | Un shot en viewport real de 390 CSS px donde el `value` completo del atributo `placeholder` sea visible, o una aserción de longitud sobre el literal emitido en la rama hero |

---

## §Plural (D-06 / C-04)

Fix ejecutado en este plan. Helper **general y explícito**, deliberadamente **sin heurística
morfológica**: `citación → citaciones` y `abstención → abstenciones` pierden la tilde al pluralizar y
ninguna regla de sufijo genérica lo acierta, así que ambas formas viajan como argumento.

```ts
// app/lib/plural.ts
export function plural(n: number, singular: string, pluralForma: string): string {
  return n === 1 ? singular : pluralForma;
}
```

`app/lib/idioms-panel.ts` **NO se tocó** (`git diff --name-only` sobre él: vacío). Los sustantivos
contados no son stems de fecha ni de procedencia; añadirlos habría roto el guard sin necesidad.

**Los 4 moldes corregidos:**

| molde | antes (n=1) | ahora (n=1) | archivo |
|---|---|---|---|
| cobertura L7 del Senado | `1 citaciones del Senado` | `1 citación del Senado` | `panel-tile-comisiones.tsx:38` |
| encabezado del primer grado | `1 proyectos con Discusión inmediata` | `1 proyecto con Discusión inmediata` | `panel-tile-urgencias.tsx:161` |
| detalle de votación (abstenciones) | `1 abstenciones` | `1 abstención` | `panel-tile-votaciones.tsx:65` |
| detalle de votación (pareos) | `1 pareos` | `1 pareo` | `panel-tile-votaciones.tsx:66` |

`a favor` / `en contra` NO se tocaron: son locuciones adverbiales, no sustantivos contados — no varían.

### Delta de tests (ambos números registrados)

**Conteo BASE — medido ANTES de tocar nada**, con el comando que **OMITE** `lib/plural.test.ts`
(todavía no existía; incluirlo habría hecho fallar la corrida entera):

```
$ pnpm --filter ./app exec vitest run components/panel-tile-comisiones.test.tsx \
    components/panel-tile-urgencias.test.tsx components/panel-tile-votaciones.test.tsx
 ✓ components/panel-tile-urgencias.test.tsx  (7 tests)
 ✓ components/panel-tile-comisiones.test.tsx (11 tests)
 ✓ components/panel-tile-votaciones.test.tsx (13 tests)
 Test Files  3 passed (3)
      Tests  31 passed (31)
```

**Conteo POSTERIOR** — el comando de los criterios, con las 4 rutas EXPLÍCITAS (un glob saldría 0
sin correr nada, gotcha v12.0):

```
$ pnpm --filter ./app exec vitest run lib/plural.test.ts components/panel-tile-comisiones.test.tsx \
    components/panel-tile-urgencias.test.tsx components/panel-tile-votaciones.test.tsx
 ✓ lib/plural.test.ts                        (5 tests)
 ✓ components/panel-tile-urgencias.test.tsx  (9 tests)
 ✓ components/panel-tile-comisiones.test.tsx (12 tests)
 ✓ components/panel-tile-votaciones.test.tsx (15 tests)
 Test Files  4 passed (4)
      Tests  41 passed (41)
```

**BASE = 31 · POSTERIOR = 41 · DELTA = +10 > 0.** Desglose: 5 del helper, +1 comisiones (n=1),
+2 urgencias (n=1 y n=2 de no-regresión), +2 votaciones (n=1 y n=2 de no-regresión).

Suite completa y guards, sin regresiones: `pnpm --filter ./app test` → **1786 passed (119 files)**,
exit 0; `pnpm guards` → exit 0.

### Aserciones de cierre (contadores `grep -oF … | wc -l`, jamás `grep -c`)

| comando | valor | lectura |
|---|---:|---|
| `grep -oF 'citaciones del Senado' app/components/panel-tile-comisiones.tsx` | **0** | el molde viejo murió |
| `grep -oF 'del Senado' app/components/panel-tile-comisiones.tsx` | **3** | **control positivo apareado** ⇒ el cero de arriba es FUERTE, no vacuo |
| `grep -oF 'from "@/lib/plural"' app/components/panel-tile-comisiones.tsx` | **1** | key_link del plan |
| `grep -oF 'from "@/lib/plural"' app/components/panel-tile-urgencias.tsx` | **1** | |
| `grep -oF 'from "@/lib/plural"' app/components/panel-tile-votaciones.tsx` | **1** | |
| `grep -oF '1 citación del Senado' app/components/panel-tile-comisiones.test.tsx` | **2** | aserción n=1 nueva |
| `grep -oF '1 proyecto con' app/components/panel-tile-urgencias.test.tsx` | **2** | aserción n=1 nueva |
| `grep -oF '1 abstención' app/components/panel-tile-votaciones.test.tsx` | **2** | aserción n=1 nueva |
| `git diff --name-only app/lib/idioms-panel.ts` | (vacío) | single-source de stems intacto |

---

## §Deuda de operador

### 1. Rotación de la password de la DB — **acción del operador, no del agente**

**Recomendación explícita: ROTAR la password de la base de datos del proyecto Supabase.**

Motivo: durante las olas previas, **dos agentes ecoaron la URL de conexión con credencial en
transcripts locales**. Los **artefactos del repo** quedaron redactados (ver punto 2), pero la
redacción de un artefacto **no invalida una credencial** — solo deja de publicarla. Mientras la
password no se rote, cualquier copia de esos transcripts sigue siendo utilizable.

Este plan **no toca `.env`, no toca credenciales y no rota nada** (`git status --porcelain .env` →
vacío): rotar es acción del operador sobre la consola de Supabase, fuera del alcance de un plan
autónomo.

### 2. Redacción B26 — hecho en el alcance de esta fase

En `.planning/milestones/v1.0-phases/07-b-squeda-sem-ntica-fichas-estructuradas/07-01-SUMMARY.md`
había **TRES** cosas a redactar, no una:

| línea | qué | sustituido por |
|---|---|---|
| 176 | el project-ref del proyecto nube (20 caracteres) | `<PROJECT_REF_REDACTADO>` |
| 176 | el host del pooler IPv4 de la región `sa-east-1`, con puerto | `<POOLER_HOST_REDACTADO>` |
| 181 | el host de la API (`https://{ref}.{dominio-supabase}`) | `<SUPABASE_HOST_REDACTADO>` |

> **Este documento tampoco repite los literales.** Redactar el `07-01-SUMMARY.md` para luego
> reimprimir el ref aquí sería un no-fix. Por eso los comandos de abajo llevan el patrón
> parametrizado como `$REF` / `$DOMINIO`, no el valor.

Se **redactó, no se borró**: el archivo conserva **186 líneas** antes y después, y cada frase
mantiene su sentido.

```
$ REF=<el project-ref>   # no se transcribe aquí, a propósito
$ grep -oE "$REF"'|supabase\.'"$DOMINIO"'|aws-1-sa-east-1\.pooler' 07-01-SUMMARY.md | wc -l
0
$ grep -oE '<PROJECT_REF_REDACTADO>|<SUPABASE_HOST_REDACTADO>|<POOLER_HOST_REDACTADO>' 07-01-SUMMARY.md | wc -l
3          # control positivo: los marcadores SÍ están
$ grep -oF 'supabase' 07-01-SUMMARY.md | wc -l
6          # control positivo apareado: el grep SÍ encuentra en este archivo ⇒ el 0 es FUERTE
$ wc -l < 07-01-SUMMARY.md
186        # invariante (antes: 186)
```

### 3. Alcance restante — deuda de operador cuantificada

**El alcance de la Phase 129 es SOLO `07-01-SUMMARY.md`.** El project-ref sigue presente en el resto
del repo:

```
$ git grep -lF "$REF" -- . | wc -l
49
$ git grep -lF 'supabase' -- . | wc -l
793        # control positivo: el recorrido de archivos tracked funciona
```

**49 archivos tracked** aún contienen el project-ref, y quedan **fuera del alcance de esta fase**:
redactarlos es deuda de operador, a decidir junto con la rotación del punto 1.

> **Nota de método sobre el número.** El plan citaba `~96` medido con
> `grep -rlF … --exclude-dir=node_modules --exclude-dir=.git . | wc -l`. Ese comando **agotó el
> timeout de 2 minutos** en este entorno (el repo vive bajo OneDrive y el recorrido recursivo del
> working tree es patológicamente lento), así que se midió con `git grep -lF`, que recorre
> **exactamente los archivos tracked** — que es el universo relevante para "qué se publica en el
> repo". La diferencia entre 96 y 49 se explica porque el recorrido del working tree incluye
> artefactos no versionados. **El número que se publica es el medido, 49, con su comando al lado.**

---

## §Densidad 390px

Medida **DESPUÉS** del re-deploy final y contra ese deploy:
**version-id `9a8acdb0-0534-4419-a8a3-8a8df3de79f5`** (`129-DEPLOY-EVIDENCIA.md` §Re-deploy final).

**Las dos patas, y por qué son dos.** Los totales del jsonb (`puntos_total`, `tabla_total`,
`evidencia.total`) **NUNCA llegan al DOM**: los tiles son Server Components y el payload RSC lleva el
string ya renderizado, no las props. Un agente que "leyera el total" desde el navegador estaría
FABRICANDO el dato. Por eso el navegador aporta solo lo que sabe —ítems visibles y el literal del
remanente, verbatim— y la **honestidad del N** se prueba en TEST, donde el total del jsonb sí es
observable.

### Pata 1 — DOM, sobre la superficie 390 px del deploy final

`expression` usado (BrowserOS `evaluate_script`, parámetro `expression`, ejecutado en el
`contentDocument` del iframe de 390 px):

```js
(function(){var d=document.getElementById("f").contentDocument;
 var out=Array.from(d.querySelectorAll("section"))
   .filter(s=>s.querySelector(":scope > h2"))
   .map(function(s){
     var rem=Array.from(s.querySelectorAll("p,a")).map(e=>e.textContent.trim())
              .filter(t=>/^(y )?[0-9]+ más( →)?$/.test(t));
     var cls=s.getAttribute("class")||""; var m=cls.match(/md:col-span-([0-9]+)/);
     return {h2:s.querySelector(":scope > h2").textContent,
             items:s.querySelectorAll("ul > li").length,
             span:m?m[1]:null, remanente:rem};});
 return JSON.stringify({vw:document.getElementById("f").contentWindow.innerWidth,
                        tiles:out, maxItems:Math.max.apply(null,out.map(o=>o.items))});})()
```

Salida VERBATIM (`vw:390` ⇒ se midió en el viewport de 390 CSS px, no en el desktop):

```json
{"vw":390,"tiles":[
 {"h2":"En tabla de sala esta semana","items":4,"span":"6","remanente":["y 30 más →"]},
 {"h2":"Comisiones citadas esta semana","items":4,"span":"4","remanente":["y 27 más →"]},
 {"h2":"Urgencias del Ejecutivo, por grado","items":4,"span":"2","remanente":["62 más"]},
 {"h2":"Movimiento reciente","items":4,"span":"6","remanente":[]},
 {"h2":"Votaciones recientes","items":4,"span":"4","remanente":[]},
 {"h2":"Ingresos, archivos y retiros","items":1,"span":"2","remanente":[]}],
 "maxItems":4}
```

`maxItems:4` es el máximo sobre los 6 tiles ⇒ **ninguna sección supera 4 ítems visibles**. La misma
salida entrega, de paso, los `span` REALES del deploy: `[6,4,2,6,4,2]` ⇒ **C-01 verificado en
producción**, no solo en test.

### Tabla

| tile | ítems visibles en el DOM (<=4) | literal `y N más →` en el DOM (verbatim o ninguno) | caso de test que prueba el N honesto (archivo:línea) | version-id medido |
|---|---:|---|---|---|
| `panel-tile-sala` | 4 | `y 30 más →` | `app/components/panel-tile-sala.test.tsx:123` (`tabla_total:25`, `maxItems:4` → `y 24 más →`; refuerzo en `:169` con el caso sin remanente) | `9a8acdb0-…` |
| `panel-tile-comisiones` | 4 | `y 27 más →` | `app/components/panel-tile-comisiones.test.tsx:177` (`puntos_total:31`, `maxItems:4` → `y 27 más →`) | `9a8acdb0-…` |
| `panel-tile-urgencias` | 4 | **`62 más`** (texto sin link, NO `y N más →`) | `app/components/panel-tile-urgencias.test.tsx:234` (O-6: cero `<a>` de remanente + control positivo `/2 más/`) | `9a8acdb0-…` |
| `panel-tile-movimiento` | 4 | ninguno (el conteo vivo no supera `maxItems`) | `app/components/panel-tile-movimiento.test.tsx:119` **(NUEVO)** — `total:9` del jsonb con array de 6 y `maxItems:4` → `5 más`, y controles negativos `2 más`/`6 más` | `9a8acdb0-…` |
| `panel-tile-votaciones` | 4 | ninguno | n/a — el tile **no declara remanente**: su invariante testeada prohíbe agregar votaciones (`panel-tile-votaciones.test.tsx`, "dos votaciones del MISMO boletín producen DOS `<li>`"), y no hay total de jsonb del que restar | `9a8acdb0-…` |
| `panel-tile-ingresos` | 1 | ninguno | `app/components/panel-tile-ingresos.test.tsx:190` **(NUEVO)** — archivados: 7 proyectos, `maxItems:4` → `3 más`. Y `:213` **(NUEVO)** fija que la subsección `Nuevos ingresos` corta a `maxItems` **sin** declarar remanente | `9a8acdb0-…` |

**Ninguna celda de esta tabla contiene un total de jsonb obtenido del navegador.** Los N honestos
(24, 27, 5, 3) vienen de los tests; los literales del DOM (`y 30 más →`, `y 27 más →`, `62 más`)
vienen del `expression` de arriba, verbatim.

### Dos correcciones a premisas del plan, medidas y no silenciadas

1. **`panel-tile-urgencias` SÍ tiene remanente.** El plan lo daba por "sin remanente por diseño" y
   mandaba ponerlo como `N = n/a`. Lo medido dice otra cosa: el DOM del deploy muestra **`62 más`**,
   y el componente lo documenta (`panel-tile-urgencias.tsx:26-32`: *"el remanente se declara como
   TEXTO SIN LINK (fix W-6, FIJADO)"*). Lo que NO tiene es **link** — que es justo el hallazgo
   `C-06`, aceptado. Poner `n/a` habría escondido un remanente real detrás de una premisa. La fila
   va con su literal y su test.
2. **El tile SIN remanente es `panel-tile-votaciones`**, y ahí sí corresponde `n/a` con razón
   citada: no hay total agregado del que restar, porque agregar votaciones del mismo boletín está
   prohibido por invariante.

### Pata 2 — delta de tests (ambos números registrados)

Comando de los criterios, con las 4 rutas EXPLÍCITAS (un glob saldría 0 sin correr nada):

```
$ pnpm --filter ./app exec vitest run components/panel-tile-comisiones.test.tsx \
    components/panel-tile-sala.test.tsx components/panel-tile-movimiento.test.tsx \
    components/panel-tile-ingresos.test.tsx
 ✓ components/panel-tile-movimiento.test.tsx  (8 tests)
 ✓ components/panel-tile-sala.test.tsx        (13 tests)
 ✓ components/panel-tile-comisiones.test.tsx  (12 tests)
 ✓ components/panel-tile-ingresos.test.tsx    (11 tests)
 Test Files  4 passed (4)
      Tests  44 passed (44)
```

**BASE = 41 · POSTERIOR = 44 · DELTA = +3.** La base se midió sin re-ejecutar la suite vieja (que ya
no existe en el working tree), contando los `it(` de las versiones en `HEAD` — método independiente
del runner, y que coincide tile a tile con sus totales:

```
$ for f in comisiones sala movimiento ingresos; do
    echo "$f HEAD=$(git show HEAD:app/components/panel-tile-$f.test.tsx | grep -oE '^\s+it\(' | wc -l)"; done
comisiones HEAD=12   sala HEAD=13   movimiento HEAD=7   ingresos HEAD=9      # suma 41
```

---

## Método de medición (anti-falso-verde)

- Todos los contadores usan `grep -oF … | wc -l` o `grep -oE … | wc -l`; **nunca `grep -c`** (topa en
  1 sobre archivos de una sola línea).
- Ningún `grep -q` bajo `pipefail`; ningún `grep -i` combinado con `-F`.
- Cada cero va apareado con un **control positivo sobre el mismo archivo** (`del Senado`=3 junto al
  `citaciones del Senado`=0; `supabase`=6 junto al criterio B26=0).
- Rutas de `vitest` **explícitas**, nunca glob (`vitest run <glob>` sale 0 sin correr nada).
- El conteo base de tests se registró **antes** de crear ningún archivo nuevo, con el comando que
  omite `lib/plural.test.ts`.
- Ningún deploy ocurrió en este plan.
