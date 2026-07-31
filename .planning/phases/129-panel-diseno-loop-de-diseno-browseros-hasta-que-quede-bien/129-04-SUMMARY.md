---
phase: 129-panel-diseno-loop-de-diseno-browseros-hasta-que-quede-bien
plan: 04
subsystem: frontend-panel
tags: [diseno, bento, tokens, fechas-es-cl, deploy, capturas, densidad]
requires:
  - 129-01 (bundle PRE-fix, version-id 4c6fdbda, escalera 390px)
  - 129-03 (129-CRITICA.md §Hallazgos y §Presupuesto de iteraciones)
provides:
  - "deploy final 9a8acdb0-0534-4419-a8a3-8a8df3de79f5 con todo el codigo de la fase"
  - "assets/129-final-{landing-desktop,panel-390,comparar}.png posteriores al deploy"
  - "129-CRITICA.md §Densidad 390px y §Iteraciones (los 4 FIX en CERRADO)"
  - "129-DEPLOY-EVIDENCIA.md §Re-deploy final con las 4 patas del bundle"
affects:
  - "129-05: checkpoint del operador (mira estas 3 capturas)"
tech-stack:
  added: []
  patterns:
    - "spans bento que cierran filas de 6 sin reordenar tiles (orden D-01/O-5 LOCKED intacto)"
    - "fechaCivilCorta como unico formateador de fecha de /comparar"
key-files:
  created:
    - app/components/comparar-selector.test.tsx
    - .planning/phases/129-.../assets/129-final-landing-desktop.png
    - .planning/phases/129-.../assets/129-final-panel-390.png
    - .planning/phases/129-.../assets/129-final-comparar.png
    - .planning/phases/129-.../assets/129-final-landing-full.png
  modified:
    - app/components/panel-tile-sala.tsx
    - app/components/panel-tile-movimiento.tsx
    - app/components/comparar-selector.tsx
    - app/app/comparar/page.tsx
    - app/components/panel-actualidad.test.tsx
    - app/app/comparar/page.test.tsx
    - app/components/panel-tile-movimiento.test.tsx
    - app/components/panel-tile-ingresos.test.tsx
    - .planning/phases/129-.../129-CRITICA.md
    - .planning/phases/129-.../129-DEPLOY-EVIDENCIA.md
decisions:
  - "C-01 se cerro SIN reordenar los tiles (contra la implementacion propuesta por la propia critica): reordenar habria roto el orden D-01/O-5, que tiene test propio. Dos spans 4->6 cierran las filas conservando el orden"
  - "C-03 exigio DOS deploys: el primero (f9c5bf23) fallo su propio criterio con 2 ISO en el DOM por un tercer sitio no localizado por la critica; se registra la medicion fallida en vez de borrarla"
  - "La premisa del plan de que panel-tile-urgencias no tiene remanente es FALSA: tiene '62 más' como texto sin link. El tile sin remanente es votaciones. La tabla publica lo medido"
metrics:
  duration: ~75 min
  tasks: 3
  tests_delta: "+7 (1786 -> 1793 en la suite; 41 -> 44 en las 4 rutas de densidad)"
  completed: 2026-07-30
requirements: [PANEL-09]
---

# Phase 129 Plan 04: FIX de la crítica + re-deploy final + densidad 390px — Summary

Los tres `FIX` pendientes de la crítica cerrados con evidencia (grilla bento sin huecos, CTA de
`/comparar` en el token del sistema, cero fechas ISO en `/comparar`), re-deploy **incondicional** a
producción —**dos**, porque el primero falló su propio criterio— y las tres capturas finales
probadas posteriores al deploy por `mtime`, con la densidad a 390 px cerrada por sus dos patas.
**Deploy final: `9a8acdb0-0534-4419-a8a3-8a8df3de79f5`.**

## Task 1 — Los FIX (2 iteraciones, las 3 de la fase gastadas)

| id | qué | cómo se cerró | commit |
|---|---|---|---|
| **C-01** | huecos interiores de 2 columnas en la grilla bento | `panel-tile-sala` y `panel-tile-movimiento` pasan de `span=4` a `span=6` ⇒ filas `6 \| 4+2 \| 6 \| 4+2`. Test de composición que lee los spans de las clases realmente emitidas, simula el auto-placement y falla si un tile no cabe en el remanente, con control positivo apareado de los 6 `<h2>` | `eb2ff8a` |
| **C-02** | CTA `Comparar` fuera del sistema de color | mismas clases que el `Buscar` del hero (`bg-accent-product text-background hover:bg-accent-product/90`). `grep` del token viejo = **0**, control positivo `bg-accent-product` = **4** sobre el mismo archivo. Test nuevo con 2 casos | `9157ff0` |
| **C-03** | fechas ISO en `/comparar` | `fechaConsultaHoy`, `fechaCaptura` y (el que faltaba) la provenance de comisiones pasan por `fechaCivilCorta`. DOM del deploy final: **0** ISO con **22** fechas civiles de control positivo | `9157ff0` + `ebb2242` |
| C-04 | plural | ya cerrado en `129-03` | — |

**Ninguna fila `FIX` quedó en `AGOTADAS ITERACIONES`.** Las 3 iteraciones del tope de la fase se
gastaron (1 en `129-03`, 2 aquí).

### La decisión de método que más pesó: C-01 sin reordenar

La propia crítica proponía reordenar los tiles a `sala(4)+urgencias(2) · comisiones(4)+ingresos(2) ·
movimiento(6) · votaciones(6)`. **Se descartó**: ese reorden altera el ORDEN D-01/O-5, que es una
decisión ya arbitrada y tiene test propio (`"orden del DOM: sala → comisiones → urgencias →
movimiento → votaciones → ingresos"`). Cerrar un hallazgo de layout rompiendo un invariante de
contenido habría sido un mal cambio. La alternativa —dos `span` de 4 a 6— cierra las cuatro filas
**sin tocar el orden**, y el test de orden siguió verde sin modificarse.

## Task 2 — Re-deploy INCONDICIONAL

**Dos deploys, y el segundo no es cosmético.** El primero (`f9c5bf23-c021-4a90-b5f5-ff9dd7abbb82`)
se midió contra el DOM servido y **falló el criterio de C-03**: quedaban 2 ISO
(`según fuente al 2026-07-22`), de un tercer sitio que la crítica no había localizado
(`page.tsx:338`, provenance de comisiones). Se corrigió y se re-deployó → `9a8acdb0-…`. La medición
fallida queda escrita: sin ella el `0` final no se distingue de un criterio que nunca se midió.

**Las 4 patas del bundle desplegado** (`.open-next/server-functions`; `worker.js` son 2.278 bytes de
entrypoint-shim, no lleva código de app):

| pata | pre-fix | medido | criterio | ✓ |
|---|---:|---:|---|---|
| 1 — negativo con carne `citaciones del Senado` | 2 | **0** | == 0 | ✔ |
| 1b — refuerzo `"citación"` | 1 | **2** | >= 2 | ✔ |
| 2 — control positivo `Comisiones citadas esta semana` | 2 | **2** | >= 1 | ✔ |
| 4 — nombres de `chunks/ssr/*.js` distintos vs `129-01` | — | **8** (4 nuevos, 4 muertos) | >= 1 | ✔ |

Pata 3 = los valores pre-fix (2 y 1) citados desde `129-01` §Bundle PRE-fix.

**Hecho que corrige la expectativa del plan:** el plan anticipaba que el fix compilaría a
`app_components_*.js`. Medido, esos nombres **no cambiaron**; los 8 que difieren son todos
`[root-of-the-server]__*`. Evaluar el criterio sobre un prefijo habría dado un falso ROJO — por eso
se re-listó el glob COMPLETO.

**Capturas** (`test -s` + `textContent` + `-nt /tmp/129-deploy-done`):

| archivo | `file` | superficie |
|---|---|---|
| `129-final-landing-desktop.png` | 1620 x 917 | `/` deploy REAL (`href` de producción, `dpr` 1,25) |
| `129-final-panel-390.png` | **390 x 1400** | **escalón (b)** — proxy local, `href` `127.0.0.1` ⇒ **NO es del deploy real** |
| `129-final-comparar.png` | 1620 x 847 | `/comparar` deploy REAL, `err:false`, apellidos Araya Guerrero y Ulloa Aguilera |
| `129-final-landing-full.png` (bonus) | 1600 x 1603 | página completa: es donde se ve que la grilla bento ya no tiene huecos |

La de 390 px lleva pegado su `{"w":390,"h":1400,"href":"http://127.0.0.1:4390/","dpr":1.25}` verbatim
y la salvedad obligatoria, y su ancho se verificó con `file` (`= 390`), no por narración.

## Task 3 — Densidad 390px

**Pata 1 (DOM, medida en el viewport de 390 con `vw:390` en la propia salida):** los 6 tiles con
`items` de 4, 4, 4, 4, 4 y 1 ⇒ **ninguno supera 4**. La misma consulta devolvió los `span` reales
del deploy: `[6,4,2,6,4,2]` ⇒ **C-01 verificado en producción**, no solo en test.

**Pata 2 (TEST, la honestidad del N):** tests nuevos en movimiento (`total:9` del jsonb con array de
6 y `maxItems:4` → `5 más`, con controles negativos `2 más`/`6 más`) e ingresos (7 proyectos → `3
más`; y el caso que fija que `Nuevos ingresos` corta sin declarar remanente). Los de sala y
comisiones ya existían y se citaron, no se reescribieron. **41 → 44 tests (+3)** en las 4 rutas.

## Desviaciones del plan

**1. [Rule 1 — Bug] C-03 estaba incompleto: un tercer sitio ISO que la crítica no vio**

- **Encontrado en:** Task 2, midiendo el DOM del primer deploy.
- **Problema:** la crítica nombraba `page.tsx:54-61` y sus dos usos. Existía un tercero
  (`fechaFuenteComisiones`, provenance de comisiones) que interpolaba `fecha_captura` cruda ⇒ el
  criterio "cero ISO en el DOM" seguía en **2** tras el primer deploy.
- **Fix:** el mismo helper `fechaCivilCorta`, sobre el MISMO día que ya se elegía (la selección del
  máximo sigue hecha sobre el ISO, para que el `.sort()` lexicográfico siga siendo cronológico).
  Cambia la presentación, jamás el hecho. Segundo deploy.
- **Commit:** `ebb2242`

**2. [Rule 1 — Bug] Mi propio comentario de código volvía vacuo el criterio de C-02**

- La primera redacción del comentario explicativo **transcribía el token viejo**, y el contador
  `grep -oF 'bg-foreground' comparar-selector.tsx` subía a **2** — el propio comentario habría
  hecho fallar (y, peor, habría podido "cumplirse" con el literal solo en prosa). Se reescribió sin
  el literal; el `0` publicado es el posterior a esa corrección. Mismo patrón de error que la
  desviación 1 de `129-03` (documentar un secreto al describir su redacción).

**3. [Método] La premisa del plan sobre `panel-tile-urgencias` es falsa**

- El plan mandaba ponerlo como `N = n/a` "porque no tiene remanente por diseño". Lo medido dice
  otra cosa: el DOM del deploy muestra **`62 más`**, y el componente lo documenta (W-6/O-6). Lo que
  no tiene es **link** — que es el hallazgo `C-06`, aceptado. Se publicó lo medido, con su test
  (`panel-tile-urgencias.test.tsx:234`). El tile que sí va con `n/a` razonado es
  `panel-tile-votaciones`.

**4. [Método] Un `\d` mal escapado dio una primera lectura de densidad silenciosamente vacía**

- La primera consulta al DOM devolvió `span:null` y `mas:[]` en los 6 tiles. No era un hallazgo:
  era el escape de `\\d` roto en el pipeline shell→node→JSON→MCP. Se detectó porque el resultado
  contradecía un `grep` del HTML servido que sí encontraba `y 30 más →`. Se re-midió con clases de
  caracteres explícitas (`[0-9]`). **Ningún número de la tabla proviene de la medición fallida.**

**5. [Registrado, no ocultado] Dos 500 transitorios en `/comparar` tras el deploy**

- El tercer intento y todo lo posterior dan 200 con la página íntegra. Es coherente con el modo
  M-B ya descrito en §Diferidos **D-1** (`Promise.all` sin aislamiento por eje), cuyo fix requiere
  pronunciamiento del operador. **No se tocó** el manejo de errores de `/comparar`: el contrato
  LOCKED #34 queda intacto, como mandaba el plan.

## Verificación

| criterio | resultado |
|---|---|
| version-id final distinto de `4c6fdbda` y de `b69f2ec2` | ✔ `9a8acdb0-0534-4419-a8a3-8a8df3de79f5` |
| UUIDs únicos en la evidencia | **4** (>= 3) |
| `worker.js -nt /tmp/129-redeploy-stamp` | GATE_OK (20:49:33 > 20:28:00) |
| patas del bundle 1 / 1b / 2 / 4 | **0 / 2 / 2 / 8** ✔ |
| 3 capturas `test -s` + `-nt /tmp/129-deploy-done` + `textContent` | ✔ |
| `file` de la de 390 → ancho `= 390` | ✔ 390 x 1400 |
| escalón declarado coherente con el `href` pegado | ✔ (b), y `NO es del deploy real` presente **4** veces |
| `curl` sobre `/` | **200** |
| C-03 en el DOM del deploy: ISO / control positivo | **0 / 22** |
| C-02 en el DOM del deploy: token viejo / `bg-accent-product` | **0 / 4** |
| densidad: máximo de ítems visibles entre los 6 tiles | **4** (`maxItems:4` en la salida verbatim) |
| vitest 4 rutas de densidad | **44 passed**, base 41 ⇒ **+3** |
| `pnpm --filter ./app test` | **1793 passed (120 files)**, exit 0 |
| `pnpm guards` | exit 0 |
| `git status --porcelain supabase/migrations` / `.env` | vacío / vacío |
| `git diff` de los 4 archivos de CSP | vacío |

## Known Stubs

Ninguno. Los tres FIX son cambios completos y cableados; no hay placeholders ni datos mock nuevos.

## Deferred Issues

Sin cambios respecto de `129-03`: **D-1** (resiliencia SSR de `/comparar` — reforzado por los dos
500 transitorios medidos aquí; requiere pronunciamiento del operador sobre el contrato LOCKED #34),
**D-2** (aislamiento de M-A) y **D-3** (placeholder recortado a 390 px, visible también en
`129-final-panel-390.png`). La rotación de la password de la DB y los 49 archivos con el project-ref
siguen como deuda de operador en §Deuda de operador.

## Para el checkpoint del operador (129-05)

Las tres capturas a mirar son `129-final-landing-desktop.png`, `129-final-panel-390.png` (con su
salvedad: NO es del deploy real) y `129-final-comparar.png`, más `129-final-landing-full.png`, que
es la única donde se ve la grilla bento completa y por tanto el efecto de C-01.

## Self-Check: PASSED

6 archivos declarados verificados con `test -f` (6/6 FOUND: SUMMARY, las 4 capturas y el test nuevo
del CTA); 4 commits verificados con `git log --oneline --all` (`eb2ff8a`, `9157ff0`, `ebb2242`,
`620f93a`, 4/4 FOUND). Las líneas citadas en la tabla de densidad se abrieron una a una y
corresponden al caso descrito (sala :123, comisiones :177, urgencias :234, movimiento :119,
ingresos :190 y :213).
