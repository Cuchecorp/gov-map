---
phase: 125-e2e-pasada-final-producto-a-producto
plan: 03
subsystem: e2e-verification
tags: [e2e, dom-evidence, rutas, chrome, not-found, canarios-124, sql-cross-check]
requires:
  - "125-01 (deploy 0ea5d97f-a172-436e-aad0-add95940ee0e)"
  - "113-INVENTARIO.md (universo de rutas)"
  - "122-CRUCES-SQL.md (queries Q-56..Q-65, Q-28..Q-35, Q-79..Q-81)"
  - "117-DISPOSICION.md (F-06, F-09, F-12, F-14)"
  - "124-SUPA-FIX.md (no-regresion 134/7394)"
provides:
  - "125-E2E-B-RUTAS.md — evidencia DOM de 11 rutas + 4 not-found + chrome compartido"
  - "estado verificado de las filas declaradas 4-14, 4-15 y 3.3"
  - "veredicto de los canarios 0077 y 0078/0079 sobre /buscar"
affects: []
tech-stack:
  added: []
  patterns:
    - "conteo DOM por `grep -o … | wc -l` (jamas `grep -c`: HTML de una linea)"
    - "patrones tolerantes a `<!-- -->` y a singular/plural"
    - "cruce DOM vs SQL por `psql -tA` read-only, query verbatim de 122"
    - "falsacion del contrato date-only por DIA DE LA SEMANA (delata cualquier corrimiento de tz)"
key-files:
  created:
    - ".planning/phases/125-e2e-pasada-final-producto-a-producto/125-E2E-B-RUTAS.md"
  modified: []
decisions:
  - "El criterio F-06 (`Última consulta a las fuentes` >= 1 en `/`) es insatisfacible: el copy vive solo en el huerfano E-008. Se documenta como desviacion RULE-1 en vez de declarar PASS falso."
  - "El canario que SI discrimina el fix de 117 es `Última actualización de datos` = 0 y `Actualizado` = 0, medido en 11/11 capturas."
  - "El avance de `fecha_captura_max` VSIM (2026-07-28 -> 2026-07-29) se atribuye a la ingesta de votos, NO a drift de 124: N/M no se movieron."
metrics:
  duration: "~40 min"
  completed: 2026-07-29
  rutas_recorridas: 11
  not_found_verificadas: 4
  requests_al_worker: 21
  queries_sql: 24
  conteos_cuadrados: "18/18 panel + 186 directorio + 80/235 red + 3655/3672 VSIM + 36 co-firmados"
---

# Phase 125 Plan 03: E2E rutas de navegación y catálogo — Summary

Las 11 rutas de navegación/catálogo del inventario 113 más el chrome compartido y las 4 `not-found`
quedaron recorridas sobre el deploy `0ea5d97f`, con fragmento DOM por superficie y cada conteo pegado
al lado de su query SQL re-ejecutada: **18/18 conteos del panel de actualidad, 186 del directorio,
80/235 de `/red`, 3655/3672 de VSIM y 36 co-firmados, todos idénticos**; los canarios de 124 (`0077`,
`0078`/`0079`) pasan con atribución explícita y cero superficie visible cambió.

**Artefacto:** `.planning/phases/125-e2e-pasada-final-producto-a-producto/125-E2E-B-RUTAS.md`
(870 líneas, 10 secciones).

---

## Precondición de frescura (bloqueante) — SATISFECHA

| check | resultado |
|---|---|
| uuid declarado en `125-DEPLOY-RUNBOOK.md` §2 | `0ea5d97f-a172-436e-aad0-add95940ee0e` ✓ |
| `/proyecto/14309-04` | **200**, 1.282.093 bytes |
| HTML de una línea (confirma el gotcha de `grep -c`) | `wc -l` = **1** |
| marcador `3,8` del fix de 122 | **2** ocurrencias == las 2 del runbook POST-deploy ✓ |

Se midió **después** de esto, nunca antes. No hubo que PARAR.

---

## Veredicto por ruta

| superficie | sujeto / estado | veredicto | número clave DOM == SQL |
|---|---|:---:|---|
| chrome `C-01`…`C-04` | `/` + confirmado en `/sobre` | `cuadra` | 4/4 footer · 5/5 nav · wordmark · C-04 ausente por diseño |
| `/` panel de actualidad | — | `cuadra` | **18/18** conteos == `Q-57` |
| `/parlamentarios` | — (universo) | `cuadra` | **186** == `parlamentarios_publico_v2()` (155+31) |
| `/agenda` (reloj = `2026-W31`) | vacío honesto | `cuadra` | **0** == 0 citaciones en la semana ISO |
| `/agenda?semana=2026-W32` | poblada | `cuadra` | 3 días == 08-03/04/05 (5+8+9 = 22) |
| `/buscar?q=pensiones` | canarios 124 | `cuadra` | banner **3100** == `proyecto_embedding` |
| `/comparar?a=D1165&b=S1338` | cross-cámara | `cuadra` (3.3 declarada) | ejes `48`/`21`; comisiones 0; circunscripción 7 |
| `/comparar?a=D1170&b=D1165` | mismo-cámara, VSIM | `cuadra` | **3655/3672** == RPC == primeros principios; **36** co-firmados |
| `/red?seed=D1165` | vecindario | `cuadra` | **80 vecinos / 235 hechos**, tres lecturas |
| `/red?seed=S1338` | vacío honesto | `cuadra` | 0/0, seednote **0**, HTTP 200 |
| `/metodologia` | estática | `cuadra` | 0 fechas, 0 `captura` pelado |
| `/sobre` | estática | `cuadra` | 0 fechas, 0 `captura` pelado |
| `not-found` E-049 / E-023 / E-050 / E-047 | 4 sub-superficies | `cuadra` | **404** ×4 con copy verbatim |

Fragmentos DOM verbatim más citados (todos en el artefacto con su contexto):

```
net-b-seednote">80 vecinos<!-- --> ·<!-- --> <!-- -->235 hechos documentados<!-- -->.
Coinciden en <!-- -->3655<!-- --> de <!-- -->3672<!-- --> votaciones compartidas (<!-- -->100<!-- -->%).
Fuente: Agenda del Congreso · datos al 10 ago 2026
Lunes 3 de agosto · Martes 4 de agosto · Miércoles 5 de agosto
Aún no hay relaciones para mostrar para este parlamentario. Cuando existan hechos públicos …
Las listas consultadas al 2026-07-29 están truncadas (más de 20 registros por parlamentario) …
```

---

## Estado de los canarios de 124

| migración | superficie | resultado | veredicto |
|---|---|---|:---:|
| **`0077`** `statement_timeout` 5 s | `/buscar` (`match_proyectos`) | **200** ×3; `time_total` 3,02 / 1,92 / 0,96 s (`starttransfer` ≤ 0,88 s); cero timeout visible. `proconfig=statement_timeout=5s` verificado vivo en 5 RPCs | ✓ **PASA** |
| **`0078`/`0079`** cotas de cardinalidad | `/buscar` conteo | cuerpo vivo: `limit least(coalesce(match_count,20), 4000)`. Demanda viva **21**, máximo posible **1001**, tope **4000** ⇒ **sin recorte**. El DOM **no emite total absoluto** (`Resultados 1–20+`) ⇒ no hay número truncable; `hayMas` true prueba ≥21 filas devueltas | ✓ **PASA, atribuido** |
| **`0074`/`0076`** ACL + `search_path` | `/red`, `/`, `/comparar` | `subgrafo_red('D1009',2)` = **134/7394** (idéntico a `124-SUPA-FIX.md`); `80/235`; panel 18/18; `3655/3672` | ✓ **PASA** |

**Cero superficie visible cambió por 124.** Ningún número exigió escalar.

---

## Estado de las filas `discrepancia-declarada` que tocaban a este plan

| fila | qué declara | estado hoy | veredicto |
|---|---|---|:---:|
| **4-14** | tile *Por materia* agrupa `3100` de `3675` (84,4 %) sin declarar que la base es el corpus embebido | DOM: 10 filas `N proyectos`, **cero denominador**. SQL `Q-65`: `3100 / 3100 / 3675` | **SIGUE DECLARADA** ✓ |
| **4-15** | dos grafías de cámara conviven en la misma landing | los **6** chips verbatim: `(sin cámara) · C.Diputados · Senado · senado · camara · senado`; confirmado por `Q-63`/`Q-64` (crudas) vs `Q-57` (normalizadas) | **SIGUE DECLARADA** ✓ |
| **3.3** | eje Co-autoría truncado fail-closed CR-01 (SQL da `0`, el deploy declara indeterminación) | copy **byte-idéntico** al de 122; columnas `48`/`21`; `Q-32` = **0** | **SIGUE DECLARADA** ✓ |

**Ninguna se cerró sola** — que era el hallazgo a escalar. En 4-14 **no apareció ningún denominador
nuevo** en el DOM.

---

## Deviations from Plan

### 1. [Rule 1 — Premisa falsa del criterio] El criterio F-06 es insatisfacible

- **Encontrado durante:** Task 1 (verificación automatizada del plan).
- **Criterio del plan:** `grep -c "Última consulta a las fuentes"` en `/` → **≥ 1**.
- **Medido:** **0**.
- **Investigación (no se re-interpretó el criterio, se buscó la causa):**

| # | comprobación | resultado |
|---|---|---|
| 1 | `grep -rln "Última consulta a las fuentes" app --include=*.tsx \| grep -v .test.` | **un solo archivo**: `app/components/actualidad-module.tsx` |
| 2 | `grep -rn "ActualidadModule" app … \| grep -v .test. \| grep -v actualidad-module.tsx` | **salida vacía** ⇒ cero call-sites |
| 3 | qué monta `/` (`app/app/page.tsx:5,138`) | `PanelActualidad` (`panel-actualidad.tsx`, **E-055**) |

- **Causa:** `actualidad-module.tsx` **es E-008, emisor huérfano** — el mismo que 113 §3.0.1,
  `125-CONTEXT.md` §Specific Ideas y el **gotcha 7 de este propio plan** mandan **no buscar en el
  DOM**. 117 §2(c) lo dice literal: *«los huérfanos se corrigen de copy pero NO se eliminan»*, con
  destino «fase de limpieza de huérfanos». El criterio pedía en el DOM un literal que sólo existe en
  un componente sin call-site. Su redacción vino de una lectura laxa de 117 §4 SC2 («el strip de la
  home usa el mismo idiom (F-06)»), que nombra el fix sin registrar que su archivo es huérfano.
- **Acción:** **ninguna sobre el código.** Se documentó en §2.4 del artefacto con las 3
  comprobaciones, y se verificó el control **que sí discrimina**:

| control | valor | lectura |
|---|---:|---|
| `Última actualización de datos` (el idiom que F-06 vino a matar) | **0** | ✓ cero regresión |
| `Actualizado` (idiom viejo de F-01) | **0** en **11/11** capturas | ✓ cero regresión |

- **Por qué no se declaró PASS:** habría sido un verde falso. Se registra como `declarado` con causa
  y destino, que es un resultado válido; silenciarlo no lo sería.
- **Commit:** contenido en `618148c` (ver desviación 3).

### 2. [Rule 1 — Corrección de expectativa] `/agenda` en la semana del reloj está vacía, y es correcto

- **Encontrado durante:** Task 2.
- **Observado:** la vista por defecto y `?semana=2026-W31` rinden
  `No hay citaciones de comisiones registradas para esta semana.`
- **Verificado por SQL antes de despacharlo:** la DB tiene **0** citaciones en la semana ISO en curso;
  las vecinas sí (`W30` = 32, `W32` = 22, `W33` = 1; rango total `2026-05-11 .. 2026-08-10`, 295
  filas). Los links de nav apuntan a `W30`/`W32`, confirmando que el reloj resuelve `W31`.
- **Acción:** se recorrió **además** `?semana=2026-W32` (poblada) para poder registrar fechas civiles
  reales y falsar el contrato date-only. Sin este paso, el plan habría cerrado `/agenda` sin una sola
  fecha observada.
- **Resultado:** el vacío es **honesto** (`cuadra`, 0 == 0), no un empty-state defensivo tapando un
  fallo de ingesta.

### 3. [Rule 3 — Carrera de índice git en waves paralelas] El artefacto entró en el commit del Plan 05

- **Encontrado durante:** el commit atómico de este plan.
- **Qué pasó:** se hizo `git add` **sólo** del archivo propio, pero el Plan 05 —que corre en paralelo
  sobre el **mismo índice git**— ejecutó su `git commit` en la ventana entre mi `add` y mi `commit`.
  Su commit barrió el índice compartido y se llevó mi archivo dentro:

```
618148c test(125-05): corrida de links internos contra el deploy 0ea5d97f
 .../125-E2E-B-RUTAS.md      | 870 ++++++++++++
 .../125-LINKS-INT.json      | 1449 +++++++++++++++++
 .../125-LINKS-INT.txt       | 106 ++
```

- **Estado:** el artefacto **está committeado y con las 870 líneas íntegras**
  (`git ls-files --error-unmatch` → TRACKEADO; `git log -- <archivo>` → `618148c`).
  **Cero pérdida de contenido, cero deleciones** (`git diff --diff-filter=D` vacío).
- **Acción:** **no** se reescribió la historia ni se hizo `reset`/`revert` para "recuperar" la
  atribución — eso destruiría el commit de un plan concurrente (prohibición absoluta de
  `<destructive_git_prohibition>`). Se deja constancia aquí y este SUMMARY lleva el commit propio con
  ámbito `125-03`.
- **Nota para el orquestador:** con `isolation` compartida, varios ejecutores en un mismo checkout
  comparten `.git/index`; commits atómicos por plan **no** están garantizados. Si se quiere
  atribución estricta, los planes paralelos necesitan worktrees separados.

**Cero desviaciones RULE-4** (ninguna decisión arquitectónica se cruzó).

---

## Límites declarados de este plan

1. **Interacción cliente no ejercida.** `curl` lee el HTML servido; no ejerce el ciclo cliente. Por
   eso en `/red?seed=D1165` el literal `Ver fuente oficial` da **0**: la fila de procedencia por
   arista sólo se renderiza **con el detalle de un vecino abierto** (113 §4.9 A1). Los enlaces **sí**
   están en los datos entregados al islote (`www.camara.cl` ×4490 en el JSON del grafo). Se registra
   como límite del método, **no** como link faltante. → **Plan 06 (BrowserOS)**.
2. **`not-found` en payload RSC.** Las 4 sirven `<html id="__next_error__">` con el cuerpo en el
   payload Flight (Next 16). Un `grep` de `<main>` da 0 y sería una falsa ausencia; el copy se leyó
   del payload. Registrado en §5.3.
3. **Gate MONEY no verificado aquí.** De `/contraparte/NOEXISTE` sólo se registró el 404 y el copy de
   E-050. → **Plan 04**.
4. **Emisores huérfanos no buscados en el DOM** por regla LOCKED: `E-003`, `E-008`, `E-029` y el
   empty-state de `E-053`. Registrados como tales en §2.5.
5. **Links no verificados exhaustivamente.** Este plan sólo listó los salientes de las rutas que
   cubrió. → **Plan 05**.

## Cobertura declarada

**Cubierto (11 rutas + 4 `not-found`):** chrome `C-01`…`C-04`, `/`, `/parlamentarios`, `/agenda`
(reloj + `W31` + `W32`), `/buscar?q=pensiones`, `/comparar` (cross-cámara + mismo-cámara), `/red`
(`D1165` + `S1338`), `/metodologia`, `/sobre`, y las `not-found` E-049/E-023/E-050/E-047.

**NO cubierto, con destino nombrado:** `/parlamentario/[id]` y `/proyecto/[boletin]` → **Plan 02** ·
gate MONEY y rutas NOTIF (`/cuenta`, `/notificaciones/*`) → **Plan 04** · links exhaustivos →
**Plan 05** · las 82 filas de cruces e interacción cliente → **Plan 06** ·
`/admin/revisar-entidades` → **EXCLUIDA** por decisión LOCKED del CONTEXT.

## Known Stubs

Ninguno. Este plan no escribe código: produce un artefacto de evidencia. Cero valores placeholder,
cero `TODO`, cero componente sin fuente de datos.

## Threat Flags

Ninguno. Cero superficie nueva: sólo lecturas `GET` al Worker propio y `select` read-only a PROD. Se
respetaron las 3 mitigaciones del threat model del plan — T-125-07 (secuencial, 1 s entre requests,
cero concurrencia, cero crawl: **21 requests** en total), T-125-08 (sólo conteos y copy institucional;
cero PII; `SUPABASE_DB_URL` jamás expandida ni ecoada), T-125-09 (régimen read-only, sólo `SELECT`).

## Self-Check: PASSED

| # | check | resultado |
|---|---|---|
| 1 | artefacto existe | **FOUND** `125-E2E-B-RUTAS.md` — 870 líneas, 53.131 bytes |
| 2 | `contains: panel-actualidad` (must_haves) | **3** ocurrencias |
| 3 | uuid del deploy en el artefacto | **3** ocurrencias de `0ea5d97f-a172-436e-aad0-add95940ee0e` |
| 4 | filas declaradas registradas | **8** ocurrencias de `SIGUE DECLARADA` |
| 5 | verify Task 2 (`Coinciden en` en par mismo-cámara) | **1** ✓ |
| 6 | verify Task 3 (`/proyecto/00000-00`) | **404** ✓ |
| 7 | verify Task 1 (`Última consulta a las fuentes`) | **0** — desviación RULE-1 documentada, no PASS falso |
| 8 | commit del artefacto en la historia | `618148c`, TRACKEADO, cero deleciones |
