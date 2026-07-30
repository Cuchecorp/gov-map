---
phase: 125-e2e-pasada-final-producto-a-producto
plan: 03
fecha: 2026-07-29
worker: observatorio-congreso
url: https://observatorio-congreso.thevalis.workers.dev
version_desplegada: 0ea5d97f-a172-436e-aad0-add95940ee0e
commit_bundle: b4882e9
supabase_ref: bctyygbmqcvizyplktuw
alcance: "rutas de navegacion y catalogo + chrome compartido + 4 not-found"
---

# 125-E2E-B-RUTAS — evidencia DOM de navegación, catálogo y chrome

**VERSIÓN LEÍDA: `0ea5d97f-a172-436e-aad0-add95940ee0e`** (§2 de `125-DEPLOY-RUNBOOK.md`),
commit del bundle `b4882e9`. Todo lo que sigue se midió **contra ese deploy**, no contra el árbol.

Régimen de la corrida: `curl` **secuencial, 1 s entre requests**, User-Agent identificatorio, cero
requests a fuentes gubernamentales, cero fixes de código, cero DDL/DML, cero flips. Los cruces contra
SQL van por `psql -tA` **read-only** (`select` exclusivamente). `SUPABASE_DB_URL` **jamás** expandida
ni ecoada.

**Método de conteo:** todas las cifras usan **`grep -o … | wc -l`**. `grep -c` **no se usa para
contar**: el HTML del Worker es **una sola línea** (`wc -l` = 1) ⇒ `grep -c` topa en 1 (gotcha pagado
en 125-01). Los patrones son **tolerantes a `<!-- -->`** (React intercala el separador entre texto y
dígito) y a **singular/plural**. Cero `grep -o -E '…{0,9000}'` sobre el HTML de una línea
(backtracking catastrófico, >120 s en 122).

---

## §0 Precondición de frescura — BLOQUEANTE, ejecutada ANTES de medir

`depends_on` garantiza orden, no frescura. Se comprobó que el Worker sirve el bundle nuevo **antes**
de tomar cualquier otra medida.

| # | check | comando | resultado | veredicto |
|---|-------|---------|-----------|:---------:|
| 1 | uuid declarado en el runbook | lectura de `125-DEPLOY-RUNBOOK.md` §2 | `0ea5d97f-a172-436e-aad0-add95940ee0e` | ✓ presente |
| 2 | `/proyecto/14309-04` responde | `curl -w "%{http_code}"` | **200**, 1.282.093 bytes, 1,90 s | ✓ |
| 3 | HTML de una línea (confirma el gotcha) | `wc -l` | **1** | ✓ |
| 4 | **marcador `3,8` del fix de 122** | `grep -o "3,8" \| wc -l` | **2** | ✓ **es el deploy nuevo** |

Fragmento vivo del marcador (fila 5.12 de 122, verbatim del deploy leído hoy):

```
audiencias registradas con parlamentario identificado y materia publicada citan el número de un
boletín en su materia (3,8 %), según fuente al 29 jul 2026. Este recuento cubre solo esa parte
del registro.
```

`2` ocurrencias == las `2` que el runbook midió POST-deploy (§3.2). **Precondición SATISFECHA**; se
procede a medir. Si hubiera dado `0` el plan exigía PARAR — no fue el caso.

### §0.1 Códigos HTTP de las 15 superficies recorridas

Secuencial, 1 s entre cada una.

| # | superficie | HTTP | bytes | latencia |
|---|------------|-----:|------:|---------:|
| 1 | `/` | **200** | 63.072 | 0,33 s |
| 2 | `/sobre` | **200** | 27.353 | 0,17 s |
| 3 | `/metodologia` | **200** | 29.560 | 0,20 s |
| 4 | `/parlamentarios` | **200** | 295.491 | 0,90 s |
| 5 | `/agenda` (semana del reloj) | **200** | 38.417 | 0,30 s |
| 6 | `/agenda?semana=2026-W31` | **200** | 38.539 | — |
| 7 | `/agenda?semana=2026-W32` | **200** | 218.656 | — |
| 8 | `/buscar?q=pensiones` | **200** | 99.236 | 1,09 s |
| 9 | `/comparar?a=D1165&b=S1338` | **200** | 108.271 | 1,10 s |
| 10 | `/comparar?a=D1170&b=D1165` | **200** | 109.187 | 0,78 s |
| 11 | `/red?seed=D1165` | **200** | 1.636.624 | 1,10 s |
| 12 | `/red?seed=S1338` | **200** | 20.708 | 0,26 s |
| 13 | `/parlamentario/NOEXISTE` | **404** | 15.864 | — |
| 14 | `/proyecto/00000-00` | **404** | 16.479 | — |
| 15 | `/contraparte/NOEXISTE` | **404** | 15.670 | — |
| 16 | `/red?seed=NOEXISTE` | **404** | 14.739 | — |

---

## §1 Chrome compartido (C-01 … C-04) — verificado UNA VEZ, declarado compartido

Regla del inventario 113 §2: las 4 piezas se montan en `app/app/layout.tsx` y por lo tanto aplican a
**las 15 rutas**. Se verifican en `/` y se **confirman en `/sobre`** como segundo punto de muestra.

| id | pieza | emisor | evidencia en `/` | confirmado en `/sobre` | veredicto |
|----|-------|--------|------------------|------------------------|:---------:|
| **C-01** | footer global | `app/app/layout.tsx:58,70-71,76-77,83` | 4/4 hrefs presentes | 4/4 presentes | `cuadra` |
| **C-02** | nav principal (5 ítems) | `app/components/header-nav.tsx:36-42` | 5/5 ítems | 5/5 ítems | `cuadra` |
| **C-03** | wordmark `gov-map` → `/` | `app/components/global-header.tsx:35-36` | presente | presente | `cuadra` |
| **C-04** | migaja de ruta | `app/components/breadcrumbs.tsx` | **ausente por diseño** — `/` y `/sobre` no montan breadcrumbs (113 §4.4/§4.11: «Sin C-04») | ídem | `cuadra` (ausencia esperada) |

### §1.1 C-01 — footer, hrefs medidos

| href | `/` | `/sobre` |
|------|----:|---------:|
| `https://creativecommons.org/licenses/by/4.0/deed.es` | 2 | 4 |
| `href="/metodologia"` | 1 | 1 |
| `href="/sobre"` | 3 | 2 |
| `mailto:contacto@observatoriocongreso.cl` | 2 | 2 |

**Nota de método (no es hallazgo):** los conteos difieren entre rutas porque el HTML del Worker trae
el markup servido **más** el payload RSC (Flight) donde el mismo href aparece serializado, y porque
cada página emite links **propios** que duplican los del chrome (113 §4.10 nota de B1: el CC BY de
`/metodologia:93` y el de `/sobre:94` son links propios, no repetición de chrome). Lo verificable es
**presencia ≥ 1 en ambas rutas**, y eso se cumple 4/4.

Copy del footer, **verbatim** del deploy:

```
Datos de fuentes públicas del Congreso de Chile, con fuente, fecha y enlace en cada dato.
Contenido bajo CC BY 4.0 — atribución a Observatorio del Congreso 360. Esta licencia cubre la
compilación propia; cada fuente conserva sus propios términos, indicados en su sección y en la
metodología.
… Metodología · Sobre el proyecto · Contacto
Fuente, fecha y enlace en cada dato · Sin afirmar intención ni causalidad.
```

El SCOPE-CAVEAT de licencia (113 §2 C-01) está **presente y literal**: *«Esta licencia cubre la
compilación propia; cada fuente conserva sus propios términos»*.

### §1.2 C-02 — nav, los 5 ítems verbatim

```
Buscar | Parlamentarios | Agenda | Red | Sobre
```

| ítem | `/` | `/sobre` | nota |
|------|----:|---------:|------|
| `/buscar` | 2 | 2 | — |
| `/parlamentarios` | 2 | 2 | — |
| `/agenda` | 2 | 2 | — |
| `/red` | **1** | **1** | **gate NET ON** ⇒ el ítem se emite. Con NET OFF el nodo estaría AUSENTE del DOM (`header-nav.tsx:61-63`), nunca un link a 404 |
| `/sobre` | 3 | 2 | — |

**Canario de gate leído del DOM, no asumido:** el boolean no-sensible `showRed` viaja al islote
cliente con valor `true` — el flag crudo `NET_PUBLIC_ENABLED` **no** aparece en el payload:

```
[\"$\",\"$L3\",null,{\"showRed\":true}]
```

Coincide con `125-DEPLOY-RUNBOOK.md` §2.3 (NET presente/ON) y con 113 §2 nota de gate.

### §1.3 C-03 — wordmark

```html
…<path d="M12 8.35 L15 12 L12 15.65 L9 12 Z" fill="hsl(var(--accent-product))"></path></svg>gov-map</a><nav aria-label="Navegación principal">
```

`BrandIcon` + texto `gov-map`, envuelto en el `<a href="/">`, inmediatamente antes del `<nav
aria-label="Navegación principal">`. Presente en `/` y `/sobre`.

---

## §2 `/` — panel de actualidad (E-055)

**Emisor vivo:** `app/components/panel-actualidad.tsx`, montado en `app/app/page.tsx:138`.
**E-008 `actualidad-module.tsx` NO se mide en el DOM** — es emisor huérfano (§2.4).

### §2.1 Los 7 tiles y sus 18 conteos, lado a lado con el SQL

Títulos leídos del deploy (7/7, verbatim):

```
Movimiento reciente · Urgencias del Ejecutivo · Citaciones próximas · Sesiones de sala ·
Nuevos ingresos · Archivos y retiros · Por materia
```

Conteos del DOM (`grep -o -E '<span class="font-mono">[0-9]+</span>'`, 18 valores en orden de
emisión) contra `Q-57` re-ejecutada hoy contra PROD:

| # | tile | fila (cobertura / cluster) | **nº DOM** | **nº SQL** | query | veredicto |
|---|------|---------------------------|-----------:|-----------:|-------|:---------:|
| 4-0 | universo | 7 tiles · 18 filas activas + 1 supresión = 19 | **19** | **19** filas / 7 tipos | `Q-56`,`Q-57` | `cuadra` |
| 4-1 | Movimiento reciente | `velocity` `(sin cámara)` | **1** | **1** | `Q-57` | `cuadra` |
| 4-2 | Movimiento reciente | `velocity` `C.Diputados` | **37** | **37** | `Q-57` | `cuadra` |
| 4-3 | Movimiento reciente | `velocity` `Senado` | **44** | **44** | `Q-57` | `cuadra` |
| 4-4 | Urgencias del Ejecutivo | `urgencias` `30d` | **95** | **95** | `Q-57` | `cuadra` |
| 4-5 | Citaciones próximas | `agenda_citacion` `senado` | **23** | **23** | `Q-57`,`Q-63` | `cuadra` |
| 4-6 | Sesiones de sala | `agenda_sala` `camara` | **1** | **1** | `Q-57`,`Q-64` | `cuadra` |
| 4-7 | Sesiones de sala | `agenda_sala` `senado` | **2** | **2** | `Q-57`,`Q-64` | `cuadra` |
| 4-8 | Nuevos ingresos | supresión-como-fila | copy, **sin dígito** | conteo `0` + `supresion_causa` | `Q-57` | `cuadra` |
| 4-9 | Archivos y retiros | `archivados` `30d` | **2** | **2** | `Q-57` | `cuadra` |
| 4-10 | Por materia | 10 clusters | **452, 615, 95, 363, 192, 62, 421, 335, 272, 293** (Σ **3100**) | idénticos, Σ **3100** | `Q-57`,`Q-65` | `cuadra` |
| 4-11 | Por materia | etiqueta de materia | `(sin materia)` ×10 | `(sin materia)` ×10 | `Q-57` | `cuadra` |

Serie del DOM verbatim, en orden:

```
1 37 44 95 23 1 2 2 452 615 95 363 192 62 421 335 272 293
```

`Q-57` re-ejecutada hoy (19 filas, salida real de `psql -tA`, recortada a las columnas relevantes):

```
agenda_citacion   |futuras|23 |senado                    |             |  |2026-08-10 00:00:00+00|
agenda_sala       |futuras|1  |camara                    |             |  |2026-08-03 00:00:00+00|
agenda_sala       |futuras|2  |senado                    |             |  |2026-08-05 00:00:00+00|
agrupacion_materia|       |452|                          |(sin materia)|0 |                      |
agrupacion_materia|       |615|                          |(sin materia)|1 |                      |
agrupacion_materia|       |95 |                          |(sin materia)|2 |                      |
agrupacion_materia|       |363|                          |(sin materia)|3 |                      |
agrupacion_materia|       |192|                          |(sin materia)|4 |                      |
agrupacion_materia|       |62 |                          |(sin materia)|5 |                      |
agrupacion_materia|       |421|                          |(sin materia)|6 |                      |
agrupacion_materia|       |335|                          |(sin materia)|7 |                      |
agrupacion_materia|       |272|                          |(sin materia)|8 |                      |
agrupacion_materia|       |293|                          |(sin materia)|9 |                      |
archivados        |30d    |2  |                          |             |  |2026-07-06 00:00:00+00|
nuevos_ingresos   |7d     |0  |2022-2026 (piso de corpus)|             |  |2026-07-28 00:00:00+00|sin nuevos ingresos fechados en la ventana
urgencias         |30d    |95 |                          |             |  |2026-07-22 00:00:00+00|
velocity          |7d     |1  |(sin cámara)              |             |  |2026-07-22 00:00:00+00|
velocity          |7d     |37 |C.Diputados               |             |  |2026-07-24 00:00:00+00|
velocity          |7d     |44 |Senado                   |             |  |2026-07-28 00:00:00+00|
```

**18 de 18 conteos idénticos.** Cero drift respecto a 122 (que midió los mismos valores el
2026-07-29). Las migraciones de 124 no movieron ni un dígito de este panel.

**El cluster `421` no falta** — llega por streaming de Suspense, exactamente como en 122:

```html
</section></div><div hidden id="S:1"><span class="font-mono">421</span></div><script>$RS=…
```

Registrado porque un lector que sólo mire el markup pre-Suspense contaría 17 y concluiría, en falso,
que falta un cluster.

**Supresión-como-fila (4-8), verbatim:** el tile existe y declara la ausencia; **no** hay un `0`
presentado como hecho.

```
sin nuevos ingresos fechados en la ventana — en las fuentes consultadas al 28 jul 2026
```

**Denylist anti-ranking (T-52-13) sobre TODA la landing:**
`grep -o -i -E "los m[aá]s|m[aá]s activ|top [0-9]|ranking|l[ií]der"` → **salida vacía**. Cero
insinuación de ranking.

### §2.2 Fila **4-14** — denominador del tile *Por materia*: **SIGUE DECLARADA**

| lado | valor observado hoy |
|------|---------------------|
| **DOM** | `452 proyectos`, `615 proyectos`, … (10 filas). El marcador de fila `<!-- -->proyectos` aparece **10** veces. **Cero denominador declarado.** |
| **SQL** (`Q-65`, re-ejecutada) | `suma_clusters = 3100` · `proyecto_embedding = 3100` · `proyecto = 3675` |

```
3100|3100|3675
```

Los **números cuadran** (los 10 clusters particionan **exactamente** el corpus embebido: `3100 =
3100`, sin doble conteo ni pérdida). Lo que sigue sin declararse es que la base es el corpus
**embebido** (`proyecto_embedding`), no todos los proyectos: el tile agrupa **3.100 de 3.675**
(**84,4 %**) y el DOM no lo dice.

**Veredicto: `discrepancia-declarada` — SIGUE DECLARADA.** ✓
**Cero denominador nuevo apareció en el DOM** (que sería el hallazgo que el plan pedía escalar). El
fix era SQL de 124 y `124-HANDOFF-EXACTITUD.md` lo dejó en backlog de exactitud; no se cerró sola.

### §2.3 Fila **4-15** — dos grafías de cámara: **SIGUE DECLARADA**

Los **6 chips** de cobertura observados en la misma landing, verbatim y en orden de emisión:

```
(sin cámara) · C.Diputados · Senado · senado · camara · senado
```

| grafía | origen | normalización |
|--------|--------|---------------|
| `C.Diputados`, `Senado` | `velocity` ← `tramitacion_evento.camara` | normalizadas (defecto D2 corregido en ese camino) |
| `senado`, `camara` | `agenda_citacion` / `agenda_sala` ← `citacion.camara` / `sesion_sala.camara` **CRUDAS** (`0065:233,261`) | **sin normalizar** |
| `(sin cámara)` | grupo NULL de `velocity` | etiqueta del NULL |

Confirmado por SQL: `Q-63` devuelve `senado|23` (minúscula, cruda) y `Q-64` devuelve `camara|1` /
`senado|2`, mientras `Q-57` trae `C.Diputados` / `Senado` para `velocity`. **Las dos grafías conviven
en la misma landing.**

**Veredicto: `discrepancia-declarada` — SIGUE DECLARADA.** ✓ No afecta ningún conteo.

### §2.4 Fechas del panel — F-06 y F-14

| control | criterio del plan | medido en `/` | veredicto |
|---------|-------------------|--------------:|:---------:|
| `Última actualización de datos` (idiom viejo) | **0** | **0** | ✓ **PASA** |
| `Última consulta a las fuentes` (F-06) | ≥ 1 | **0** | ⚠ **criterio inaplicable** — ver abajo |
| `datos al <dd mmm aaaa>` con año (F-14) | presente | **8** leyendas con año | ✓ **PASA** |

#### F-14 — las 18 leyendas de fila, verbatim del deploy

```
 1  Fuente: Tramitación · datos al 22 jul 2026
 2  Fuente: Tramitación · datos al 24 jul 2026
 3  Fuente: Tramitación · datos al 28 jul 2026
 4  Fuente: Urgencias del Ejecutivo · datos al 22 jul 2026
 5  Fuente: Agenda del Congreso · datos al 10 ago 2026
 6  Fuente: Agenda del Congreso · datos al 03 ago 2026
 7  Fuente: Agenda del Congreso · datos al 05 ago 2026
 8  Fuente: Tramitación · datos al 06 jul 2026
 9-18  Fuente: Proyectos de ley            ← SIN fecha (10 filas de agrupacion_materia)
```

**F-14 cerrado en el DOM.** El fix `diaCalendarioCitacion` → `fechaCivilCorta` (commit `b420263`,
WR-05) rinde `datos al 10 ago 2026` **CON año**; el ISO crudo `datos al 2026-08-10` que el bug
producía **no aparece**. Y las **10** filas de `agrupacion_materia` muestran `Fuente: Proyectos de
ley` **sin fecha** — es la **omisión honesta** ante `fecha_max` NULL que 117 F-14 declaró intacta,
confirmada por `Q-56` (`fecha_max` NULL en las 10 filas de `agrupacion_materia`). No es una fecha
faltante: es una fecha que no existe y que el panel no fabrica.

**Cruce date-only, sin conversión de tz:** SQL `agenda_citacion.fecha_max = 2026-08-10 00:00:00+00`
→ DOM `datos al 10 ago 2026`. La parte fecha UTC se rinde verbatim. Ídem `2026-07-22` → `22 jul
2026`. **Cero corrimiento de día.**

Nota de lectura: el literal pelado `datos al 10 ago 2026` **no matchea** — el DOM emite
`datos al <!-- --><span class="font-mono">10 ago 2026</span>`. Sólo un patrón tolerante lo encuentra
(gotcha 3).

#### F-06 — [RULE-1] el criterio del plan descansa en una premisa falsa

El plan pide `grep -c "Última consulta a las fuentes"` en `/` → **≥ 1**. Medido: **0**. **No se
maquilló ni se re-interpretó el criterio**; se investigó y la causa es estructural:

| # | comprobación | comando | resultado |
|---|--------------|---------|-----------|
| 1 | ¿dónde vive el copy de F-06? | `grep -rln "Última consulta a las fuentes" app --include=*.tsx \| grep -v .test.` | **un solo archivo**: `app/components/actualidad-module.tsx` |
| 2 | ¿ese archivo tiene call-site? | `grep -rn "ActualidadModule" app --include=*.tsx --include=*.ts \| grep -v .test. \| grep -v actualidad-module.tsx` | **salida vacía** |
| 3 | ¿qué monta `/` realmente? | `app/app/page.tsx:5,138` | `PanelActualidad` (`panel-actualidad.tsx`, E-055) |

`actualidad-module.tsx` **es E-008, emisor huérfano** — el mismo que 113 §3.0.1, `125-CONTEXT.md`
§Specific Ideas y el gotcha 7 de este plan mandan **no buscar en el DOM**. 117 §2(c) lo dice
explícitamente: *«F-06 / E-003 / E-008 — los huérfanos se corrigen de copy pero NO se eliminan»*, con
destino «fase de limpieza de huérfanos».

⇒ **El criterio `≥ 1` es insatisfacible por construcción**: pide en el DOM un literal que sólo existe
en un componente sin call-site. Su redacción vino de una lectura laxa de 117 §4 SC2 («el strip de la
home usa el mismo idiom (F-06)»), que nombra el fix sin registrar que su archivo es huérfano.

**Lo que sí se verificó, y es el control que discrimina:**

| control | valor | lectura |
|---------|------:|---------|
| `Última actualización de datos` (el idiom que F-06 vino a **matar**) | **0** | ✓ cero regresión |
| `Actualizado` (idiom viejo de 117 F-01) | **0** en las **11** capturas de este plan | ✓ cero regresión |

**Veredicto F-06: `declarado` — corregido en código, no alcanzable en el DOM (emisor huérfano
E-008).** Cero acción. Se registra para que ninguna fase futura vuelva a escribir un criterio de DOM
sobre un huérfano. Desviación RULE-1 documentada; **no** se declaró PASS falso.

### §2.5 Emisores huérfanos — registrados como tales, NO buscados en el DOM

| emisor | archivo | disposición |
|--------|---------|-------------|
| **E-008** | `app/components/actualidad-module.tsx` | huérfano confirmado hoy por grep (§2.4). Superseded por E-055 `panel-actualidad.tsx`. Portador único del copy de F-06 |
| **E-003** | `app/components/voto-ficha-row.tsx` | huérfano (113 §3.0.1). Fuera de las rutas de este plan |
| **E-029** | `ResumenView` | huérfano (122 §2.4.0). Fuera de las rutas de este plan |
| empty-state de **E-053** | `cruces-de-parlamentario.tsx:128-139` | inalcanzable (122 fila 3.b-9). Fuera de las rutas de este plan |

Conforme al plan: **no se persiguieron en el DOM.**

---

## §3 `/parlamentarios` — directorio (E-012 / E-019)

| # | superficie | emisor | fragmento DOM | nº SQL | veredicto |
|---|-----------|--------|---------------|-------:|:---------:|
| B-1 | `/parlamentarios` — conteo del directorio | E-012 `parlamentario-directory-row.tsx:40` | `186 parlamentarios` (×2) · **186** hrefs `/parlamentario/{id}` únicos | `parlamentarios_publico_v2()` = **186** | `cuadra` |
| B-2 | `/parlamentarios` — desglose por cámara | filtro server (`page.tsx:124`) | select `Todas / Cámara / Senado` | `diputados 155` + `senado 31` = **186** | `cuadra` |
| B-3 | `/parlamentarios` — faceta de partido | island en memoria (`page.tsx:145-146`) | `<legend>Partido</legend>` · `aria-label="Filtrar por partido"` | n/a (filtro cliente, **nunca** re-consulta Supabase) | `cuadra` |
| B-4 | `/parlamentarios` — chip de partido (C1) | E-019 `partido-chip.tsx:64-74` | ver §3.2 | `partido_fecha_captura` del roster | `cuadra` |

Copy institucional del H1, verbatim:

```
Parlamentarios — Directorio de diputadas, diputados y senadores en ejercicio.
Cada ficha enlaza a su detalle con la fuente a la vista.
```

### §3.1 CANARIO `partidoLegible` (no-regresión de v10.0) — **CERO URI-como-partido**

| control | criterio | medido | veredicto |
|---------|----------|-------:|:---------:|
| `datos.bcn.cl` en el HTML de `/parlamentarios` | 0 visible; toda ocurrencia justificada como payload RSC | **0** | ✓ **PASA, sin excepciones que justificar** |
| `parlamentarios_publico_v2()` con `partido like '%datos.bcn.cl%'` | — | **0 filas** | ✓ |

El criterio del plan contemplaba tolerar **una** ocurrencia (la clave de filtro serializada en el
payload RSC del island, no-visible/RAW por diseño). **No hubo ninguna que justificar: el conteo es
`0` limpio**, ni visible ni en payload. La razón es más fuerte que el fix de presentación: la
**fuente** ya está limpia — `0` filas del roster traen URI en `partido`, gracias al parser de origen
de BCN de la fase 105 (*«cero URI-como-partido en PROD»*). El `partidoLegible` de v10.0 sigue como
defensa en profundidad, hoy sin nada que rescatar.

### §3.2 Chip de partido — idiom de procedencia (C1 de 113 §4.8)

El chip no monta `ProvenanceBadge`: **imita** el idiom y lo emite en `title` + `aria-label`
(113 §4.8, precisión del Plan 05). Muestra observada, verbatim:

```
aria-label="Partido: Evolución Política, según Cámara al 22 jul 2026"
aria-label="Partido: Federación Regionalista Verde Social, según Cámara al 22 jul 2026"
aria-label="Partido: Federación Regionalista Verde Social, según Senado al 27 jul 2026"
aria-label="Partido: Frente Amplio, según Cámara al 22 jul 2026"
aria-label="Partido: Independiente, según Senado al 27 jul 2026"
aria-label="Partido: Independientes, según Cámara al 22 jul 2026"
```

Nombres en Title Case legible (nunca URIs), idiom `según {fuente} al {fecha}` **con año**, fuente
nombrada (`Cámara`/`Senado`). Nota: en esta ruta el literal `según fuente al` da **0** — correcto y
esperado: la variante es `según Cámara al` / `según Senado al`, que **nombra la fuente concreta**.
No es un idiom faltante.

---

## §4 Las tres rutas con estado en `searchParams`

### §4.1 `/agenda` — vista por defecto y semana explícita

| # | superficie | fragmento DOM | nº SQL | veredicto |
|---|-----------|---------------|-------:|:---------:|
| B-5 | `/agenda` (semana del reloj) | `No hay citaciones de comisiones registradas para esta semana.` — nav a `2026-W30` / `2026-W32` ⇒ semana en curso = **2026-W31** | citaciones en la semana ISO en curso = **0** | `cuadra` (**vacío honesto**) |
| B-6 | `/agenda?semana=2026-W31` (explícita) | idéntico byte a byte a la vista por defecto | **0** | `cuadra` (confirma que el reloj resuelve W31) |
| B-7 | `/agenda?semana=2026-W32` (poblada) | 3 grupos de día · **43** hrefs `/proyecto/{boletin}` únicos · **26** badges `según fuente al` | **22** citaciones (08-03: 5 · 08-04: 8 · 08-05: 9) | `cuadra` |
| B-8 | `/agenda` — cobertura declarada | ver §4.1.2 | n/a (copy) | `cuadra` |
| B-9 | `/agenda` — PDF de tabla de sala (B3) | `verDoc.aspx?prmId=0&prmTipo=TABLASEMANAL` presente | invariante `agenda-types.ts:82` | `cuadra` |

El vacío de la semana en curso **no es un fallo de ingesta ni un empty-state defensivo**: la DB
tiene `0` citaciones en `2026-W31`. Semanas vecinas, por SQL:

```
2026-W27| 2 |2026-07-02..2026-07-03
2026-W28|32 |2026-07-06..2026-07-08
2026-W29|23 |2026-07-13..2026-07-15
2026-W30|32 |2026-07-20..2026-07-24
2026-W32|22 |2026-08-03..2026-08-05      ← la que se recorrió poblada
2026-W33| 1 |2026-08-10
rango total de citacion: 2026-05-11 .. 2026-08-10  (295 filas)
```

`prmId=0` **no es un placeholder roto** — es la semana vigente del `verDoc.aspx` de la Cámara
(gotcha LOCKED de agenda, 113 §4.5 nota de B3). Registrado, no "arreglado".

#### §4.1.1 GOTCHA LOCKED de fecha — verificado, y **declaro explícitamente que NO se convirtió tz**

`citacion.fecha` es **date-only a medianoche UTC** ⇒ **la parte fecha UTC ES el día chileno**
publicado por la fuente. Convertir a `America/Santiago` fabricaría el día anterior (regresión live
Phase 94). **En esta corrida no se aplicó ninguna conversión de zona, ni en el cruce SQL (`fecha::date`
crudo) ni en la lectura del DOM.**

La prueba es falsable — el **día de la semana** delata cualquier corrimiento:

| SQL (`citacion.fecha::date`) | DOM (`dayLabelCitacion`) | día real de 2026 | si se hubiera convertido a tz |
|---|---|---|---|
| `2026-08-03` | `Lunes 3 de agosto` | lunes ✓ | daría `Domingo 2 de agosto` ✗ |
| `2026-08-04` | `Martes 4 de agosto` | martes ✓ | daría `Lunes 3 de agosto` ✗ |
| `2026-08-05` | `Miércoles 5 de agosto` | miércoles ✓ | daría `Martes 4 de agosto` ✗ |

**Los 3 días cuadran; cero corrimiento.** El helper que rinde estas fechas es
`dayLabelCitacion` (`app/lib/dia-calendario.ts:131-143`), que delega en `diaCalendarioCitacion`
(`:34-43`, `d.toISOString().slice(0,10)` — comentario en el código: *«Parte fecha UTC = día publicado
por la fuente (contrato date-only-midnight-UTC). Cero aritmética de zona»*) y lee el weekday a
**mediodía UTC** para no cruzar huso.

Conteo por día, DOM vs SQL (el rótulo aparece 1× como encabezado de grupo + 1× por `aria-label` de
tarjeta):

| día | ocurrencias DOM | citaciones SQL | lectura |
|-----|----------------:|---------------:|---------|
| `Lunes 3 de agosto` | 6 | 5 | 5 tarjetas + 1 encabezado ✓ |
| `Martes 4 de agosto` | 9 | 8 | 8 + 1 ✓ |
| `Miércoles 5 de agosto` | 10 | 9 | 9 + 1 ✓ |

**Contraste con 117 F-09:** `fechaCivilCorta` (variante **con año**, `:115-122`) es la que se aplicó a
las superficies **históricas** y al panel de `/` (§2.4); `badgeFechaCitacion` (`:91-98`, `DD-mmm`
**sin año**) queda **reservado a `citacion-card.tsx` de `/agenda`**, donde la semana en curso es el
contexto. Las tres variantes delegan en el **mismo** `diaCalendarioCitacion`: sólo cambia el formato
de salida, nunca la aritmética. Coincide con 117 §2(i) verbatim.

#### §4.1.2 Cobertura declarada, verbatim

```
Cobertura de la agenda — Esta agenda muestra lo que se ha ingerido de las fuentes oficiales.
La cobertura es parcial y se declara por origen; no es un calendario completo del Congreso.
  · Comisiones de la Cámara: …
```

Declara el límite del canal en vez de presentar el vacío como calendario completo.

### §4.2 `/buscar?q=pensiones` — con los **canarios de 124**

| # | superficie | fragmento DOM | nº SQL | veredicto |
|---|-----------|---------------|-------:|:---------:|
| B-10 | banner de cobertura del corpus (H-5 de 122) | `Busca sobre 3100 proyectos de ley (período legislativo 2022–2026)` | `proyecto_embedding` = **3100** | `cuadra` |
| B-11 | resultados de la página 1 | `Resultados 1–20+ para "pensiones"` · **20** tarjetas · link `?q=pensiones&page=2` | `match_count` pedido = **21** (`PAGE_SIZE*page+1`) | `cuadra` |
| B-12 | faceta de año (F-12) | `Año del primer trámite` → **1** | n/a (copy) | `cuadra` |
| B-13 | chip de año por tarjeta (F-12) | **20** × `primer trámite <año>`; `primer trámite Sin dato` → **0** | n/a | `cuadra` |

Distribución de los 20 chips de año en el DOM: `2022`×7, `2023`×4, `2024`×6, `2025`×2, `2026`×1
= **20**, uno por tarjeta. El assert negativo obligatorio de 117 F-12 (`not.toMatch(/primer trámite
Sin dato/)`) **se sostiene en el DOM del deploy**, no sólo en jsdom: **0** ocurrencias.

`3100` es **el mismo** corpus embebido que suma el tile *Por materia* (§2.2) — dos superficies
distintas, un solo denominador, coherente.

#### CANARIO `0077` (`statement_timeout` = 5 s) — **PASA**

`/buscar` es la superficie que ejercita `match_proyectos`. Tres mediciones secuenciales:

| intento | HTTP | `time_total` | `time_starttransfer` | bytes |
|--------:|-----:|-------------:|---------------------:|------:|
| 1 | **200** | 3,016 s | 0,881 s | 99.236 |
| 2 | **200** | 1,919 s | 0,380 s | 99.236 |
| 3 | **200** | 0,961 s | 0,213 s | 99.236 |

**200 en 3/3**, byte-idénticos. Latencia máxima **3,02 s** — bajo el `statement_timeout` de 5 s, y
esa cifra incluye el embed de Gemini + red, no sólo la RPC (`time_starttransfer` ≤ 0,88 s). Cero 5xx,
cero timeout visible: `grep -i -E 'statement timeout|canceling statement|57014|error interno|no se
pudo'` → **salida vacía**.

`statement_timeout` **verificado vivo en PROD**, no asumido:

```
actualidad_senales_panel|search_path="",statement_timeout=5s
coincidencia_votos_par  |search_path="",statement_timeout=5s
match_proyectos         |statement_timeout=5s
subgrafo_red            |search_path="",statement_timeout=5s
votos_de_parlamentario  |statement_timeout=5s
```

#### CANARIO `0079` / `0078` (cotas de cardinalidad) — **PASA, con atribución explícita**

La cota dura, leída del **cuerpo vivo** de la función en PROD:

```
match_proyectos        |limit least(coalesce(match_count, 20), 4000)
votos_de_parlamentario |limit least(coalesce(p_limit, 20), 4000) offset p_offset
```

Atribución del conteo del DOM, hecha explícita como exige el plan:

| hecho | valor | consecuencia |
|-------|------:|--------------|
| `match_count` que el sitio pide en la página 1 | `PAGE_SIZE*page+1` = **21** (`buscar/page.tsx:89`) | `least(21, 4000)` = **21** ⇒ **sin recorte** |
| `match_count` máximo que el sitio puede pedir | `MAX_PAGE=50` ⇒ `20*50+1` = **1001** (`page.tsx:33`) | `least(1001, 4000)` = **1001** ⇒ **sin recorte**; concuerda con `124-SUPA-FIX.md`, que midió `match_proyectos(1001)` = **1001** bajo `service_role` |
| tope de la cota | **4000** | **3,996× por encima** de la demanda viva máxima |

**El DOM no emite ningún conteo absoluto de resultados**: dice `Resultados 1–20+ para "pensiones"`.
El `+` declara apertura en vez de afirmar un total — así que **no existe un número que `0079`
pudiera haber truncado**, y menos «un número redondo sospechoso igual al tope». La paginación
(`page=2`) se emite porque `hayMas` es `true`, es decir la RPC devolvió **≥ 21** filas para un pedido
de 21: **evidencia positiva de no-truncamiento en el punto de operación**.

⇒ **Conteo del DOM sin cambios respecto a 122, y el atributo se declara: `0079` no recorta nada
hoy.** Nada que escalar.

### §4.3 `/comparar` — los 4 ejes, los 3 estados y VSIM

#### Par cross-cámara `?a=D1165&b=S1338`

Los 5 `<h2>` emitidos: `Militancia (histórica)` · `Comisiones` · `Co-autoría de proyectos` ·
`Zona electoral` · `Similitud de votación`.

| # | eje | estado | fragmento DOM verbatim | nº SQL | query | veredicto |
|---|-----|--------|------------------------|-------:|-------|:---------:|
| 3.1 | Militancia (histórica) | **no compartido** | `En las fuentes consultadas al 2026-07-29, no registran militancia histórica compartida fuera del partido vigente.` | par ausente en ambas direcciones | `Q-28`/`Q-13` | `cuadra` |
| 3.2 | Comisiones | **no compartido** | `En las fuentes consultadas al 2026-07-29, no comparten comisiones.` | intersección = **0**; listas `2` y `0` (< cap 50 ⇒ completas) | `Q-29`/`Q-30` | `cuadra` |
| 3.3 | Co-autoría de proyectos | **eje ausente / indeterminado** | `Las listas consultadas al 2026-07-29 están truncadas (más de 20 registros por parlamentario) y no permiten determinar si comparten proyectos co-firmados. Ver el detalle en cada ficha.` · columnas `48` / `21` co-autores registrados | `total_n` **48** / **21**; boletines co-firmados = **0** (ausencia REAL) | `Q-31`/`Q-32` | `discrepancia-declarada` |
| 3.4 | Zona electoral | **no compartido** | `Sin zona electoral registrada para Agustín Romero Leiva en las fuentes consultadas al 2026-07-…` · `Circunscripción 7` · `En las fuentes consultadas al 2026-07-29, no comparten zona.` | `D1165` zona NULL; `S1338` circunscripción **7** | `Q-33` | `cuadra` |

Los **3 estados** quedan ejercitados en este solo par: **no compartido** (3.1/3.2/3.4), **eje ausente
/ indeterminado** (3.3) y —en el par siguiente— **compartido**. **Ningún eje emite un `0` pelado que
se lea como "no comparten".** Control del cap de comisiones:
`grep "Lista posiblemente truncada"` → **0** (ninguna lista roza el cap de 50).

**Fila 3.3 — SIGUE DECLARADA** ✓. Ambos números registrados: el SQL **determina** el hecho
(`Q-32` = **0** boletines co-firmados confirmados) y el deploy **no lo afirma**, porque
`interseccionPar` es **fail-closed** por diseño CR-01: con **ambas** listas cap-eadas (48 > 20 y
21 > 20) prefiere declarar el límite del canal antes que afirmar una ausencia que podría ser falsa.
Es la disciplina correcta —el riesgo #1 del proyecto es una ausencia falsa con atribución de
fuente— y **no se toca**. El copy es **byte-idéntico** al que 122 registró: no se cerró sola.

#### Par mismo-cámara `?a=D1170&b=D1165` — VSIM

| # | superficie | fragmento DOM | nº SQL | query | veredicto |
|---|-----------|---------------|-------:|-------|:---------:|
| B-14 | VSIM `Coinciden en N de M` | `Coinciden en 3655 de 3672 votaciones compartidas (100%).` | RPC **3655/3672**; primeros principios **3655/3672** (`99,537 %`) | `Q-34`/`Q-35` | `cuadra` |
| B-15 | caveat de base alta (obligatorio) | `La coincidencia alta es la norma, no una señal: la mayoría de las votaciones se aprueban por amplia mayoría o unanimidad. Coincidir en…` | n/a | — | `cuadra` |
| B-16 | nota de cobertura del voto | `Cobertura del voto: Cámara ~80% confirmado por identificador; Senado ~20% por nombre (probable). El denominador refleja solo votaciones registradas en las fuentes al 2026-07-29.` | n/a | — | `cuadra` |
| B-17 | provenance del eje VSIM (C3) | `Fuente: votaciones de Cámara y Senado · según fuente al 2026-07-29.` | `fecha_captura_max` = `2026-07-29 21:21:31.835+00` | `Q-34` | `cuadra` |
| B-18 | eje Co-autoría (estado **compartido**) | `Comparten 36 proyectos co-firmados` · `48` / `46` co-autores registrados | `n_proyectos` = **36**; primeros principios = **36**; `total_n` **48** / **46** | `Q-31`/`Q-32` | `cuadra` |
| B-19 | eje Comisiones | `no comparten comisiones.` | intersección = **0** | `Q-29` | `cuadra` |
| B-20 | eje Militancia | `no registran militancia histórica compartida fuera del partido vigente.` | par ausente | `Q-28` | `cuadra` |
| B-21 | eje Zona | `no comparten zona.` | ambas zonas NULL | `Q-33` | `cuadra` |

Fragmento verbatim **con los separadores de React** (así se ve realmente en el HTML):

```html
<p class="mt-4 text-sm">Coinciden en <!-- -->3655<!-- --> de <!-- -->3672<!-- --> votaciones compartidas (<!-- -->100<!-- -->%).</p>
```

**N y M IDÉNTICOS al SQL re-ejecutado hoy**, y el par es **simétrico** en ambos órdenes (el plan pide
`a=D1170&b=D1165`; 122 usó el orden inverso):

```
D1170,D1165|3655|3672|2026-07-29 21:21:31.835+00
D1165,D1170|3655|3672|2026-07-29 21:21:31.835+00
D1165,S1338|   0|   0|
Q-35 primeros principios D1165×D1170 → 3655|3672|99.537
```

**El `(100%)` no es un bug de formato:** `Math.round(99.537) = 100` (`page.tsx:518`), y es la cifra
**firmada** en el dossier legal VSIM (`X = round(N/M·100)`, §43), ya adjudicada por el precedente
104-03. La lectura deshonesta la neutraliza el caveat adyacente (B-15), **verificado presente**.

**Comportamiento observado con par de cámaras distintas** (el plan pide registrar cuál de los dos, sin
inventar): en `?a=D1165&b=S1338` el eje **NO se ausenta** — el `<h2> Similitud de votación` está
presente y renderiza su **empty-state honesto**:

```
Sin votaciones compartidas suficientes en las fuentes consultadas al …
```

`Coinciden en` → **0** ocurrencias, y **cero `(0%)`**: sin figura no se fabrica un porcentaje ni un
denominador. Cuadra con `Q-34` (`D1165,S1338` → `0|0|NULL`) y con la fila 4.3 de 122. VSIM sigue
**ON** (el `<h2>` se emite en ambos pares).

**Atribución de la única cifra que cambió respecto a 122:** `fecha_captura_max` pasó de
`2026-07-28 21:34` (122) a **`2026-07-29 21:21:31.835+00`**, y el DOM lo refleja (`según fuente al
2026-07-29`, antes `2026-07-28`). **No es drift de 124**: es la ingesta de votos que corrió entremedio.
`N`/`M` no se movieron (3655/3672 en ambas mediciones), y el idiom sigue siendo el aprobado
(`según fuente al …`; "captura" pelado prohibido). DOM y RPC concuerdan **al día**.

---

## §5 `/red`, `/metodologia`, `/sobre` y las 4 `not-found`

### §5.1 `/red` (gate NET ON)

| # | superficie | emisor | fragmento DOM | nº SQL | query | veredicto |
|---|-----------|--------|---------------|-------:|-------|:---------:|
| H-1 | `/red?seed=D1165` — seednote | E-011 `red-graph.tsx:333,573` | `80 vecinos<!-- --> ·<!-- --> <!-- -->235 hechos documentados<!-- -->.` | RPC **80** vecinos / **235** hechos; primeros principios **80** / **235** | `Q-79`/`Q-80` | `cuadra` |
| H-2 | `/red?seed=S1338` — vacío honesto | E-011 `red-graph.tsx:424` | ver abajo, verbatim | RPC **0** nodos / **0** aristas | `Q-79`/`Q-80` | `cuadra` |

Seednote verbatim del deploy, con los separadores de React:

```html
<p class="net-b-seednote">80 vecinos<!-- --> ·<!-- --> <!-- -->235 hechos documentados<!-- -->.
```

SQL re-ejecutado hoy — **tres lecturas independientes, tres veces el mismo número**:

```
Q-79(a) subgrafo completo:   D1165 → 81 nodos | 4501 aristas    ·   S1338 → 0 | 0
Q-79(b) lo que MUESTRA:      D1165 → 235 hechos seed↔vecino | 80 vecinos
Q-80  primeros principios:   D1165 → 235 | 80        (== Q-79(b))
        universo arista:     7394
```

**Nota de contrato (leída, no asumida):** los `235 hechos` **no** son las `4501` aristas del
subgrafo. `red-graph.tsx:328` suma sólo los hechos **seed↔vecino**; las aristas vecino↔vecino existen
en el JSON pero no entran en ese total. `Q-79(b)` reproduce ese predicado y `Q-80` lo confirma contra
la tabla base. Registrado para que `4501` no se lea como el número que el DOM debería mostrar.

**Vacío honesto de `S1338`, verbatim — cero relleno:**

```
Aún no hay relaciones para mostrar para este parlamentario. Cuando existan hechos públicos que
vinculen a dos parlamentarios —por ejemplo, haber recibido audiencia de la misma contraparte de
lobby— aparecerán …
```

| control del vacío | medido | lectura |
|-------------------|-------:|---------|
| `net-b-seednote` (el marcador del conteo) | **0** | ✓ **ningún dígito de relleno** |
| literal `vecinos` | **0** | ✓ no se insinúa un vecindario inexistente |
| `href="/parlamentarios"` (A2, empty-state) | **2** | ✓ salida ofrecida (`aristas.length === 0`) |
| HTTP | **200** | ✓ **cero-como-cero**, estado honesto, nunca un error |

#### **124 no cambió ningún número de `/red`** — comprobado, no supuesto

Las 5 migraciones de 124 (`0074`, `0076`-`0079`) son ACL, `search_path`, `statement_timeout` y cotas
muy por encima de la demanda viva. La no-regresión que `124-SUPA-FIX.md` midió se **reproduce exacta**:

| medición | `124-SUPA-FIX.md` | re-ejecutado hoy | veredicto |
|----------|------------------:|-----------------:|:---------:|
| `subgrafo_red('D1009', 2)` | **134** nodos / **7394** aristas | **134** / **7394** | ✓ idéntico |
| `subgrafo_red('D1165')` vecinos / hechos | **80** / **235** (122) | **80** / **235** | ✓ idéntico |
| `count(*) from arista` | **7394** (122) | **7394** | ✓ idéntico |

**DOM == SQL en las dos semillas.** Cero desvío ⇒ **nada que escalar**.

**Registro de un comportamiento que NO es hallazgo:** en `/red?seed=D1165` el literal
`Ver fuente oficial` da **0** y `www.camara.cl` da **4490** (dentro del JSON del grafo). La fila de
procedencia por arista (B1, `red-graph.tsx:189-205`) sólo se **renderiza cuando el detalle de un
vecino está abierto** — interacción cliente que un `curl` del HTML servido no ejerce (113 §4.9 A1:
«una por vecino con detalle abierto»). Los enlaces **están** en los datos entregados al islote; su
render es post-interacción. Se registra como límite del método de esta corrida, **no** como link
faltante. La verificación interactiva es del Plan 06 (BrowserOS).

### §5.2 `/metodologia` y `/sobre` — rutas estáticas

Ambas confirmadas **sin lectura de DB** (113 §4.10/§4.11: `grep "rpc(\|from("` → sin match) y
**cero fechas renderizadas**, medido sobre el DOM servido:

| control | `/metodologia` | `/sobre` | esperado |
|---------|---------------:|---------:|----------|
| HTTP | **200** | **200** | 200 |
| fechas `dd mmm aaaa` renderizadas | **0** | **0** | 0 (copy estático) |
| `captura` pelado (término PROHIBIDO) | **0** | **0** | 0 |
| causalidad (`debido a`, `a causa de`) | **0** | **0** | 0 |
| insinuación (`influy…`) | **0** | **0** | 0 |

**Links salientes, listados (no adjetivados):**

| ruta | internos propios + chrome | externos |
|------|---------------------------|----------|
| `/metodologia` | `/` ×2 (A1 «Volver al inicio» + …), `/agenda`, `/buscar`, `/parlamentarios`, `/red`, `/sobre` ×2, `/metodologia` | `https://creativecommons.org/licenses/by/4.0/deed.es` ×2 (B1 propio + C-01), `mailto:contacto@observatoriocongreso.cl` ×2 (B2 propio + C-01) |
| `/sobre` | `/` ×2 (A4), `/buscar` ×2 (A1), `/agenda` ×2 (A2), `/parlamentarios` ×2 (A3), `/red`, `/metodologia`, `/sobre` ×2 | `https://creativecommons.org/licenses/by/4.0/deed.es` ×2 (B1 propio + C-01), `mailto:` ×1 (C-01) |

Cero host externo distinto de `creativecommons.org` y el `mailto:` institucional — coincide
exactamente con las Tablas B de 113 §4.10/§4.11. `/red` aparece en ambas por el nav (C-02, NET ON).

### §5.3 Las 4 `not-found` — 404 con su copy

Nota de método: estas 4 superficies sirven `<html id="__next_error__">` y su cuerpo viaja en el
**payload RSC**, no en el markup inicial (comportamiento de `notFound()` en Next 16). Un `grep` de
`<main>` da 0 y sería una falsa ausencia; el copy se lee del payload.

| # | superficie | emisor | HTTP | copy verbatim | links |
|---|-----------|--------|-----:|---------------|-------|
| D-1 | `/parlamentario/NOEXISTE` | **E-049** `parlamentario/[id]/not-found.tsx:17` | **404** | `Parlamentario no encontrado` — `No encontramos a este parlamentario en el registro. Es posible que el identificador sea incorrecto.` | `/` (A1) + `/metodologia`, `/sobre` (C-01) |
| D-2 | `/proyecto/00000-00` | **E-023** `proyecto/[boletin]/not-found.tsx:18,27,37` | **404** | `Proyecto no encontrado` — `No encontramos el proyecto solicitado. Es posible que aún no haya sido ingresado. Puedes buscarlo directamente en las fuentes oficiales:` | `/` (A1) + C-01 |
| D-3 | `/contraparte/NOEXISTE` | **E-050** `contraparte/[id]/not-found.tsx:19` | **404** | `Contraparte no encontrada` — `No encontramos esta página. Es posible que el identificador sea incorrecto.` | `/` (A1) + C-01 |
| D-4 | `/red?seed=NOEXISTE` | **E-047** `red/not-found.tsx:19` | **404** | `Página no encontrada` — `No encontramos esta página. Es posible que el identificador sea incorrecto.` | `/` (A1) + C-01 |

Las 4 renderizan el **chrome** (C-01…C-03; **sin** breadcrumbs) más su link único a `/`, tal como
declaran 113 §4.1.b / §4.2.b / §4.3.b / §4.9.b.

**Notas de alcance, explícitas:**
- **D-3**: `/contraparte/[id]` 404ea **entera** por gate MONEY — es lo único que este deploy sirve en
  esa ruta. Aquí se registra **sólo** el 404 y el copy de E-050; **la verificación del gate MONEY en
  sí es del Plan 04**.
- **D-4**: `red/not-found.tsx` sirve **dos** casos (gate NET OFF y semilla inválida). Hoy NET está
  **ON**, así que el 404 observado es el de **semilla inválida** (`PARLAMENTARIO_ID_RE` rechaza
  `NOEXISTE` **antes** de tocar la DB). Por diseño **no contiene ningún heading ni dato de NET** —
  verificado: cero filtración de DOM de NET en la página de error.

---

## §6 Canario transversal de 117 — el idiom de fecha en las 11 capturas

El runbook advirtió que `Actualizado hace` es un **control INERTE** (ya era 0 antes del deploy). El
discriminante real es el par `Actualizado` → 0 / `según fuente al` → presente. Medido en **todas** las
capturas de este plan:

| captura | `Actualizado` | `Última actualización de datos` | `Última consulta a las fuentes` | `según fuente al` |
|---------|--------------:|-------------------------------:|--------------------------------:|------------------:|
| `/` | **0** | **0** | 0 (huérfano, §2.4) | 0 (usa `datos al`) |
| `/sobre` | **0** | **0** | 0 | 0 (copy estático) |
| `/metodologia` | **0** | **0** | 0 | 0 (copy estático) |
| `/parlamentarios` | **0** | **0** | 0 | 0 (usa `según Cámara/Senado al`) |
| `/agenda` | **0** | **0** | 0 | 0 (semana vacía) |
| `/agenda?semana=2026-W32` | **0** | **0** | 0 | **26** |
| `/buscar?q=pensiones` | **0** | **0** | 0 | **20** |
| `/comparar?a=D1165&b=S1338` | **0** | **0** | 0 | **2** |
| `/comparar?a=D1170&b=D1165` | **0** | **0** | 0 | **4** |
| `/red?seed=D1165` | **0** | **0** | 0 | 0 (usa `fechaLiteral` propio) |
| `/red?seed=S1338` | **0** | **0** | 0 | 0 (grafo vacío) |

**`Actualizado` = 0 en 11/11 capturas** ⇒ el idiom viejo de F-01 **no sobrevive en ninguna de las
rutas de este plan**, y el nuevo está presente donde hay `ProvenanceBadge` con dato. Las columnas con
`0` en `según fuente al` se explican por variante de idiom o por ausencia de dato, **no** por
regresión: `/` usa `datos al` (F-14), `/parlamentarios` nombra la fuente (`según Cámara al`), `/red`
usa su formatter propio `fechaLiteral` (113 §4.9 nota de método), y las estáticas no rinden fechas.

---

## §7 Estado de las filas `discrepancia-declarada` que le tocan a este plan

De las **8** filas `discrepancia-declarada` de 122, **3** caen en las rutas de este plan. Ninguna
debía cerrarse sola; **ninguna se cerró**.

| fila | superficie | qué declara | estado hoy | veredicto |
|------|-----------|-------------|-----------|:---------:|
| **4-14** | `/` tile *Por materia* | agrupa `3100` de `3675` (84,4 %) sin declarar que la base es el corpus **embebido** | DOM: 10 filas `N proyectos`, **cero denominador**. SQL: `3100/3100/3675` | **SIGUE DECLARADA** ✓ |
| **4-15** | `/` chips de cobertura | dos grafías de cámara conviven (`Senado`/`C.Diputados` normalizadas vs `senado`/`camara` crudas) | los **6** chips conviven, verbatim | **SIGUE DECLARADA** ✓ |
| **3.3** | `/comparar` eje Co-autoría | truncamiento fail-closed CR-01: SQL da `0` co-firmados, el deploy declara indeterminación | copy **byte-idéntico** al de 122; `48`/`21`; SQL `0` | **SIGUE DECLARADA** ✓ |

Las otras 5 (2.1, 2.5, 2.6, 3.b-9, 4-14 ya cubierta… ) viven en `/parlamentario/[id]` y
`/proyecto/[boletin]` ⇒ **Plan 02 / Plan 06**, fuera de este artefacto.

## §8 Estado de los canarios de 124 que le tocan a este plan

| migración | qué cambia | superficie canario | resultado | veredicto |
|-----------|-----------|--------------------|-----------|:---------:|
| **`0077`** | `statement_timeout` = 5 s en RPCs no acotadas | `/buscar` (`match_proyectos`) | **200** ×3, máx **3,02 s** end-to-end (`starttransfer` ≤ 0,88 s), cero timeout visible. `proconfig` verificado vivo en 5 RPCs | ✓ **PASA** |
| **`0078`/`0079`** | cotas de cardinalidad (`least(coalesce(match_count,20), 4000)`) | `/buscar` conteo de resultados | demanda viva **21** (máx posible **1001**) vs tope **4000** ⇒ **sin recorte**; el DOM no emite total absoluto (`1–20+`) ⇒ nada truncable; `hayMas` true prueba ≥21 filas devueltas | ✓ **PASA, atribuido** |
| **`0074`/`0076`** (ACL + `search_path`) | — | `/red`, `/`, `/comparar` | `80/235`, `134/7394`, `3655/3672`, panel 18/18: **todos idénticos** a 122/124 | ✓ **PASA** |

**Cero superficie visible cambió por 124**, que es exactamente lo que las 5 migraciones aditivas
debían garantizar.

---

## §9 Tabla de cobertura declarada de este plan

Por lista, no por adjetivo.

### §9.1 Cubierto por el Plan 03

| ruta / sub-superficie | sujeto o estado usado | evidencia |
|-----------------------|-----------------------|-----------|
| chrome `C-01`…`C-04` | verificado en `/`, confirmado en `/sobre` | §1 |
| `/` | — (sin sujeto) | §2 (7 tiles, 18 conteos, 4-14, 4-15, F-06, F-14) |
| `/parlamentarios` | — (universo, 186 filas) | §3 |
| `/agenda` | semana del **reloj** (`2026-W31`, vacío honesto) | §4.1 |
| `/agenda?semana=…` | `2026-W31` explícita + **`2026-W32`** poblada | §4.1 |
| `/buscar` | `?q=pensiones` (canarios `0077`/`0079`) | §4.2 |
| `/comparar` | `?a=D1165&b=S1338` (cross-cámara, 4 ejes, 3 estados) | §4.3 |
| `/comparar` | `?a=D1170&b=D1165` (mismo-cámara, VSIM) | §4.3 |
| `/red` | `seed=D1165` (vecindario) + `seed=S1338` (vacío honesto) | §5.1 |
| `/metodologia` | — (estática) | §5.2 |
| `/sobre` | — (estática) | §5.2 |
| `not-found` **E-049** | `/parlamentario/NOEXISTE` | §5.3 D-1 |
| `not-found` **E-023** | `/proyecto/00000-00` | §5.3 D-2 |
| `not-found` **E-050** | `/contraparte/NOEXISTE` | §5.3 D-3 |
| `not-found` **E-047** | `/red?seed=NOEXISTE` | §5.3 D-4 |

**11 rutas + 4 `not-found`** del universo de 19 filas de la Tabla D de 113.

### §9.2 NO cubierto por este plan — nombrado, con destino

| ruta / ítem | por qué no | destino |
|-------------|-----------|---------|
| `/parlamentario/[id]` (`D1165`, `S1338`) | ruta densa, fuera del alcance de este plan | **Plan 02** |
| `/proyecto/[boletin]` (`14309-04`, `17870-05`) | ídem | **Plan 02** |
| `/contraparte/[id]` — **verificación del gate MONEY** | aquí sólo se registró el 404 y el copy de E-050 | **Plan 04** |
| `/cuenta`, `/notificaciones/baja`, `/notificaciones/confirmar` | rutas gated NOTIF (OFF, inertes) | **Plan 04** |
| `/admin/revisar-entidades` | **EXCLUIDA** por decisión LOCKED del CONTEXT (113 §4.15) | — |
| verificación **exhaustiva de links** (internos + muestra de externos) | este plan sólo listó los salientes de las rutas que cubrió | **Plan 05** |
| re-lectura de las **82 filas** de cruces | fuera de alcance | **Plan 06** |
| interacción cliente (`/red` detalle de vecino abierto, tooltips Radix, islote de partido) | un `curl` del HTML servido no ejerce el ciclo cliente (§5.1) | **Plan 06** (BrowserOS) |
| emisores huérfanos `E-003`, `E-008`, `E-029`, empty-state de `E-053` | **no se buscan en el DOM** por regla LOCKED; registrados como tales | §2.5 — cerrado como registro |

---

## §10 Cierre — criterios del plan, uno por uno

| criterio | resultado |
|----------|-----------|
| Paso 0: uuid del runbook + marcador `3,8` **antes** de medir | ✓ `0ea5d97f-…`; `3,8` → **2** (== POST-deploy del runbook) |
| Chrome `C-01`…`C-04` con fragmento verbatim, en `/` y confirmado en `/sobre` | ✓ §1 (C-04 ausente por diseño en ambas, declarado) |
| `/`: `Última actualización de datos` → **0** | ✓ **0** (y `Actualizado` → 0 en 11/11 capturas) |
| `/`: `Última consulta a las fuentes` → ≥ 1 | ⚠ **0** — criterio insatisfacible: el copy vive sólo en el huérfano E-008. **Desviación RULE-1 documentada** (§2.4), no PASS falso |
| Cada tile con su número del DOM y el de su query SQL, lado a lado | ✓ §2.1 — **18/18 idénticos** |
| Filas **4-14** y **4-15** registradas como siguen declaradas | ✓ §2.2, §2.3 — ambas SIGUEN DECLARADAS; cero denominador nuevo |
| `/parlamentarios`: toda ocurrencia de `datos.bcn.cl` justificada o hallazgo | ✓ **0** ocurrencias — nada que justificar (§3.1) |
| `/agenda`: conteo + fecha civil verbatim + declaración de no-conversión de tz | ✓ §4.1.1 — 3 días cuadran con SQL; **declaro que no se convirtió tz** |
| `/buscar`: **200**, latencia registrada, conteo vs SQL, `Año del primer trámite` ≥ 1 | ✓ 200×3, 3,02 s máx, atribución `0079` explícita, faceta → **1** |
| `/comparar`: 4 ejes con su estado citado; fila **3.3** sigue declarada | ✓ §4.3 — 3 estados ejercitados; 3.3 byte-idéntica |
| VSIM: `Coinciden en` presente y N/M **idénticos** al SQL | ✓ **3655/3672** DOM == RPC == primeros principios |
| `/red?seed=D1165`: seednote y N/M idénticos al SQL | ✓ **80/235** en tres lecturas independientes |
| `/red?seed=S1338`: vacío honesto verbatim, cero dígito de relleno | ✓ seednote **0**, `vecinos` **0**, HTTP **200** |
| `/metodologia` y `/sobre`: 200 y links salientes listados | ✓ §5.2 |
| Las 4 `not-found` → **404** con su copy citado | ✓ §5.3 — 4/4 |
| Tabla de cobertura declarada, nombrando lo NO cubierto | ✓ §9 |
| Canarios de 124 (`0077`, `0079`) atribuidos, no despachados | ✓ §8 |

**Régimen respetado:** `curl` secuencial 1 s, cero requests a fuentes gubernamentales, cero fixes de
código, cero DDL/DML, cero deploy, cero flips, cero PII, `SUPABASE_DB_URL` jamás ecoada,
`set -o pipefail` + `tr -d '\r'` en todos los pipes, SQL sólo `select`.

**Un solo artefacto escrito:** este archivo. Cero toques a `app/`, `supabase/`, BrowserOS o a los
artefactos de los planes 02/04/05.
