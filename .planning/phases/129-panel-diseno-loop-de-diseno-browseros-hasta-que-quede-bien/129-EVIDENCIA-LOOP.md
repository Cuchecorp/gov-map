# 129 — EVIDENCIA DEL LOOP (consolidado SC1–SC4)

**Fase:** 129 PANEL-DISEÑO · **Requisito:** PANEL-09 · **Plan:** 129-05 Task 1
**Fuentes de este consolidado:** `129-DEPLOY-EVIDENCIA.md`, `129-H01-DEBUG.md`, `129-CRITICA.md`,
`129-01..04-SUMMARY.md`. **Este documento no pisa ningún `129-0N-SUMMARY.md`**: es un archivo
propio, y los SUMMARY de los cuatro planes quedan intactos.

**Este documento no deploya, no aplica fixes, no toca `.env`, migraciones ni la CSP.**

## Cadena de version-ids (trazabilidad del loop)

| # | version-id | de quién es | qué contiene |
|---|---|---|---|
| 0 | `b69f2ec2-37c9-4212-b91c-a9ad97b4aeb7` | **preexistente**, NO acreditable a esta fase | estado previo al loop |
| 1 | `4c6fdbda-61ae-485e-9a4d-4197db35cf61` | `129-01` | el deploy que se criticó y sobre el que se midió H-01 |
| 2 | `f9c5bf23-c021-4a90-b5f5-ff9dd7abbb82` | `129-04`, **primer** re-deploy | plural (C-04) + C-01 + C-02 + C-03 **parcial** — **falló su propio criterio C-03** |
| 3 | **`9a8acdb0-0534-4419-a8a3-8a8df3de79f5`** | `129-04`, **VERSIÓN FINAL** | + el tercer sitio ISO que la crítica no había localizado |

```
$ grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' 129-DEPLOY-EVIDENCIA.md | sort -u | wc -l
4
```

> **Hubo DOS deploys en la ola 4, y el segundo no es cosmético.** El primero (`f9c5bf23`) se midió
> contra el DOM servido y dejaba **2** fechas ISO en `/comparar`, emitidas por un **tercer** sitio
> que la crítica no había localizado (`app/app/comparar/page.tsx:338`, provenance de comisiones,
> que interpolaba `fecha_captura` cruda). Se corrigió (`ebb2242`) y se volvió a deployar. La
> medición fallida se conserva: sin ella, el `0` final no se distingue de un criterio nunca medido.

---

## SC1 — Loop deploy→captura→crítica→corrección, con cierre por fragmento DOM + captura

**Estado: CERRADO CON SALVEDAD** (la salvedad vive en SC2: una de las tres capturas no es del
deploy real).

### Iteraciones gastadas: 3 de 3 — ninguna fila `FIX` quedó abierta

| # | qué entró | dónde se gastó | estado |
|---|---|---|---|
| 1 | **C-04** — concordancia de plural en 4 moldes | `129-03` | GASTADA — CERRADA |
| 2 | **C-01** — huecos interiores de la grilla bento | `129-04` (`eb2ff8a`) | GASTADA — CERRADA |
| 3 | **C-02** + **C-03** — token del CTA y fecha ISO de `/comparar` | `129-04` | GASTADA — CERRADA |

### Hallazgos de la crítica y su estado

| id | veredicto | estado | evidencia de cierre |
|---|---|---|---|
| C-01 huecos de la grilla bento | FIX | **CERRADO** | spans `[6,4,2,6,4,2]` medidos **en el DOM del deploy final**, no solo en test |
| C-02 CTA `Comparar` fuera de token | FIX | **CERRADO** | `bg-foreground`=0 / `bg-accent-product`=4 sobre el mismo archivo, y `cls` del CTA leído del DOM en producción |
| C-03 fechas ISO en `/comparar` | FIX | **CERRADO** | ISO=0 apareado con `jul 2026`=22 sobre el DOM servido del deploy final |
| C-04 concordancia de plural | FIX | **CERRADO** | suite `31 → 41` tests (+10) con las 4 rutas explícitas |
| C-05 muerte del tile `Por materia` | ACEPTAR | mejora vs baseline | ver SC3 |
| C-06 remanente de urgencias sin link | ACEPTAR | decisión fijada W-6/O-6 | no procede fix |
| C-07 tres votaciones del mismo boletín | ACEPTAR | invariante anti-agregación testeada | no procede fix |
| C-08 nav que envuelve a 390 px | ACEPTAR | comportamiento declarado | no procede fix |
| C-09 placeholder recortado a 390 px | DIFERIR | ver §Diferidos D-3 | — |

### Cierre por fragmento DOM (no por adjetivo)

C-01 verificado **en producción**, con los `span` reales leídos del DOM del deploy final:

```
spans en orden DOM = [6,4,2,6,4,2]   ⇒ filas 6 | 4+2 | 6 | 4+2, cero huecos
```

C-02 y C-03 sobre el DOM servido del deploy final (`/tmp/p129-fin-comp.html`):

```
$ grep -oF 'bg-foreground'     /tmp/p129-fin-comp.html | wc -l     → 0
$ grep -oF 'bg-accent-product' /tmp/p129-fin-comp.html | wc -l     → 4    (control positivo apareado)
$ grep -oE '20[0-9]{2}-[0-9]{2}-[0-9]{2}' /tmp/p129-fin-comp.html | wc -l → 0
$ grep -oF 'jul 2026' /tmp/p129-fin-comp.html | wc -l              → 22   (control positivo apareado)
$ grep -oF 'No pudimos cargar la portada' /tmp/p129-fin-comp.html | wc -l → 0
```

Control negativo del propio criterio C-03, conservado: contra el deploy **intermedio** `f9c5bf23`,
`ISO = 2` (molde `Fuente: Cámara/Senado · según fuente al 2026-07-22`).

### Prueba de que el bundle desplegado contiene el fix (cuatro patas)

`BUNDLE=C:/Temp/obs-build/app/.open-next/server-functions` (`worker.js` son 2.278 bytes de
entrypoint-shim; el código de la app no vive ahí).

| pata | comando | pre-fix | medido | criterio | ✓ |
|---|---|---:|---:|---|---|
| 1 — negativo CON carne | `grep -rhoF 'citaciones del Senado' "$BUNDLE" \| wc -l` | 2 | **0** | == 0 | ✔ |
| 1b — refuerzo | `grep -rhoF '"citación"' "$BUNDLE" \| wc -l` | 1 | **2** | >= 2 | ✔ |
| 2 — control positivo apareado | `grep -rhoF 'Comisiones citadas esta semana' "$BUNDLE" \| wc -l` | 2 | **2** | >= 1 | ✔ |
| 4 — hashes de chunks SSR | `comm -3 chunks-prefix.txt chunks-final.txt \| wc -l` | — | **8** | >= 1 | ✔ |

> **Corrección medida a una premisa del plan:** el plan anticipaba que el fix compilaría a
> `app_components_*.js`. Medido, **esos nombres NO cambiaron**: los 8 nombres que difieren son
> todos `[root-of-the-server]__*`. Por eso el criterio se evaluó sobre el listado COMPLETO
> re-listado con glob — mirar solo `app_components_*` habría dado un **falso ROJO**.

### Gate anti-bundle-viejo y status HTTP

```
$ test C:/Temp/obs-build/app/.open-next/worker.js -nt /tmp/129-redeploy-stamp && echo GATE_OK
GATE_OK          # worker.js 20:49:33 > stamp 20:28:00
$ curl -s -o /tmp/p129-fin.html -w '%{http_code}' https://observatorio-congreso.thevalis.workers.dev/
200              # intento 1
$ curl -s -o /tmp/p129-fin-comp.html -w '%{http_code}' ".../comparar?a=D1178&b=D1099"
500 · 500 · 200  # intentos 1, 2 y 3 — se registran, no se ocultan
```

Los dos `500` de `/comparar` son ventana de propagación / arranque en frío, y son **coherentes con
el modo M-B** de SC4 (`Promise.all` sin aislamiento por eje). Se dejan escritos a propósito.

### Capturas del loop (rutas y tamaños reales)

| archivo | `file` | posterior al deploy final | superficie |
|---|---|---|---|
| `assets/129-final-landing-desktop.png` | **1620 x 917** | ✔ 20:54:18 > 20:51:06 | `/` — **deploy REAL** |
| `assets/129-final-panel-390.png` | **390 x 1400** | ✔ | escalón **(b)** — **NO es del deploy real**, ver SC2 |
| `assets/129-final-comparar.png` | **1620 x 847** | ✔ | `/comparar` — **deploy REAL** |
| `assets/129-final-landing-full.png` (bonus) | 1600 x 1603 | ✔ | `/` completa: la grilla bento entera |

Las tres se acreditan por **contenido** (`textContent`, jamás `innerText`), no por `test -s`:
`bros-cli` sale 0 tras `CDP request timeout` y un PNG en blanco pesa > 0.

`textContent` de un H2 REALMENTE renderizado en la landing (no del payload RSC, que
`document.body.textContent` también incluye):

```
{"w":1296,"h":734,"href":"https://observatorio-congreso.thevalis.workers.dev/","dpr":1.25}
{"heads":1,"tag":"H2","head":"Comisiones citadas esta semana","card":"Comisiones citadas esta semanaRecibir al Alcalde de la comuna de Concepción…"}
```

`/comparar` final, con los dos parlamentarios resueltos y C-02/C-03 probados sobre el DOM hidratado:

```
{"href":".../comparar?a=D1178&b=D1099",
 "heads":["Comparar dos parlamentarios","Militancia (histórica)","Comisiones","Co-autoría de proyectos","Zona electoral","Similitud de votación"],
 "err":false,"iso":0,"civil":22,
 "sels":[{"val":"D1099","txt":"Jaime Araya Guerrero · Cámara"},{"val":"D1178","txt":"Héctor Ulloa Aguilera · Cámara"}],
 "cta":{"txt":"Comparar","cls":"rounded-lg bg-accent-product px-4 py-2 …"}}
```

### Suite y guards tras las tres iteraciones

```
$ pnpm --filter ./app test     → 1789 passed (120 files), exit 0     # base 129-03: 1786/119 ⇒ +3
$ pnpm guards                  → exit 0
```

### Lo que NO quedó cerrado en SC1

- El **aislamiento del componente exacto** de H-01 modo M-A sigue **ABIERTO** (ver SC4 y §Diferidos D-2).
- La superficie de 390 px se juzgó sobre una captura que **no es de producción** (ver SC2).

---

## SC2 — Densidad validada a 390 px, con "y N más →" honesto

**Estado: CERRADO CON SALVEDAD.** El criterio de densidad está cumplido y medido; **la captura de
390 px NO es del deploy real** y eso no se suaviza.

### La salvedad, sin suavizar

`assets/129-final-panel-390.png` se obtuvo por el **escalón (b)**: un proxy local efímero
(`127.0.0.1:4390`, `scratchpad/p129-harness.mjs`, **fuera del repo**) que reenvía el contenido del
Worker desplegado y quita **de la RESPUESTA** solo `content-security-policy` y `x-frame-options`,
para poder enmarcarlo en un `<iframe width:390px>`. El `href` medido justo antes del shot fue
`http://127.0.0.1:4390/`, **no** la URL de producción.

**Por qué el escalón (a) —viewport real de 390 px— es imposible en este entorno** (cinco intentos,
todos medidos):

| intento | resultado medido |
|---|---|
| `create_window` + `window.resizeTo(406,900)` | ventana nace **maximizada**, `resizeTo` es no-op: `{"w":1296,"ow":1536}` |
| `window.open(...,"width=406")` | **bloqueado** por el pop-up blocker sin gesto: `{"opened":false}` |
| tool MCP de viewport | **no existe** en BrowserOS |
| CDP crudo (`Emulation.setDeviceMetricsOverride`) | **sin puerto DevTools abierto** (solo el MCP en 9200) |
| Win32 `MoveWindow` | **tope duro de Chromium**: `innerWidth` mínimo alcanzable **770**, nunca 390 |

Y el iframe directo contra el deploy está muerto por **`frame-ancestors 'none'` + `x-frame-options:
DENY`** (verificados en los headers en vivo), y **está PROHIBIDO tocar la CSP**. El escalón (c)
(`<div style="width:390px">` del top-level) está prohibido y **no se usó**.

Control de que el proxy sirve el contenido del deploy y no otra cosa:

```
$ curl -s http://127.0.0.1:4390/ | grep -oF 'Comisiones citadas esta semana' | wc -l
2          # igual que contra el deploy
```

Salida VERBATIM tomada en la MISMA página justo antes del shot:

```
{"w":390,"h":1400,"href":"http://127.0.0.1:4390/","dpr":1.25,"rect":{"x":0,"y":0,"width":390,"height":1400,…}}
```

El **DPR de esta máquina es 1,25, no 1** (el plan afirmaba lo contrario y era falso): el PNG de
390×1400 se obtuvo recortando el rect exacto del iframe en px de dispositivo (488×1750) y
reescalando a la grilla CSS.

```
SRC=1620x1750 · CROP cropped=488x1750 out=390x1400
$ file 129-final-panel-390.png
PNG image data, 390 x 1400, 8-bit/color RGB, non-interlaced
```

**Consecuencia honesta:** el CONTENIDO es el del deploy real y las media queries evaluaron un
viewport real de 390 CSS px (el layout de una columna lo confirma), pero el reescalado impide juzgar
nitidez tipográfica o hairlines de 1 px en esa superficie.

### Pata 1 — DOM a 390 px, contra el deploy final `9a8acdb0-…`

Salida VERBATIM del `evaluate_script` ejecutado en el `contentDocument` del iframe:

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

`vw:390` ⇒ se midió en el viewport de 390 CSS px. `maxItems:4` ⇒ **ninguna sección supera 4 ítems
visibles** (decisión O-7 cumplida).

### Tabla de densidad y honestidad del N

| tile | ítems visibles (<=4) | literal de remanente en el DOM | test que prueba el N honesto | version-id |
|---|---:|---|---|---|
| `panel-tile-sala` | 4 | `y 30 más →` | `panel-tile-sala.test.tsx:123` (`tabla_total:25` → `y 24 más →`) | `9a8acdb0-…` |
| `panel-tile-comisiones` | 4 | `y 27 más →` | `panel-tile-comisiones.test.tsx:177` (`puntos_total:31` → `y 27 más →`) | `9a8acdb0-…` |
| `panel-tile-urgencias` | 4 | **`62 más`** (texto SIN link) | `panel-tile-urgencias.test.tsx:234` (O-6: cero `<a>` + control positivo `/2 más/`) | `9a8acdb0-…` |
| `panel-tile-movimiento` | 4 | ninguno | `panel-tile-movimiento.test.tsx:119` (`total:9` → `5 más`) | `9a8acdb0-…` |
| `panel-tile-votaciones` | 4 | ninguno | **n/a** — no declara remanente (invariante anti-agregación) | `9a8acdb0-…` |
| `panel-tile-ingresos` | 1 | ninguno | `panel-tile-ingresos.test.tsx:190` (7 archivados → `3 más`) y `:213` | `9a8acdb0-…` |

**Por qué son dos patas:** los totales del jsonb (`puntos_total`, `tabla_total`, `evidencia.total`)
**nunca llegan al DOM** — los tiles son Server Components y el payload RSC lleva el string ya
renderizado. Un agente que "leyera el total" desde el navegador estaría FABRICANDO el dato. El
navegador aporta solo ítems visibles y el literal verbatim; la honestidad del N se prueba en TEST.

```
$ pnpm --filter ./app exec vitest run components/panel-tile-comisiones.test.tsx \
    components/panel-tile-sala.test.tsx components/panel-tile-movimiento.test.tsx \
    components/panel-tile-ingresos.test.tsx
 Test Files  4 passed (4)
      Tests  44 passed (44)          # BASE 41 · DELTA +3
```

### Dos correcciones a premisas del plan, medidas y no silenciadas

1. **La premisa del plan sobre urgencias era FALSA.** El plan lo daba por "sin remanente por diseño"
   y mandaba registrarlo como `n/a`. Lo medido dice otra cosa: el DOM del deploy muestra **`62
   más`**. Lo que `panel-tile-urgencias` **no tiene es LINK**, que es exactamente el hallazgo C-06,
   aceptado por decisión fijada (W-6/O-6). Poner `n/a` habría escondido un remanente real.
2. **El tile que sí va con `n/a` es `panel-tile-votaciones`**, con razón citada: no hay total
   agregado del que restar, porque agregar votaciones del mismo boletín está prohibido por
   invariante testeada.

---

## SC3 — B-02 cerrado: el tile con denominador ausente ya no existe

**Estado: CERRADO, PERO NO ACREDITABLE AL DEPLOY DE ESTA FASE.**

### Conteos post-deploy CON el baseline pre-deploy al lado

HTML bajado a archivo (nunca pipeado); el HTML del Worker viene en **una sola línea** (`wc -l` = 1)
⇒ `grep -c` toparía en 1 ⇒ se usa `grep -oF … | wc -l`.

```
$ curl -s https://observatorio-congreso.thevalis.workers.dev/ > /tmp/p129-pre.html    # PRE-deploy
$ grep -oF '(sin materia)' /tmp/p129-pre.html | wc -l                 → 0
$ grep -oF 'Por materia' /tmp/p129-pre.html | wc -l                   → 0
$ grep -oF 'Comisiones citadas esta semana' /tmp/p129-pre.html | wc -l → 2

$ curl -s https://observatorio-congreso.thevalis.workers.dev/ > /tmp/p129.html        # POST-deploy
$ wc -l < /tmp/p129.html                                              → 1
$ grep -oF '(sin materia)' /tmp/p129.html | wc -l                     → 0
$ grep -oF 'Por materia' /tmp/p129.html | wc -l                       → 0
$ grep -oF 'Comisiones citadas esta semana' /tmp/p129.html | wc -l    → 2
```

| literal | PRE | POST | lectura |
|---|---:|---:|---|
| `(sin materia)` | 0 | **0** | negativo CON carne — el literal existiría si el tile de materia se montara |
| `Por materia` | 0 | **0** | **cero ESTRUCTURAL, no medido** — ver abajo |
| `Comisiones citadas esta semana` | 2 | **2** | **control positivo apareado** ≥ 1 ⇒ los ceros son FUERTES, no vacuos |

### Frase de no-acreditación (obligatoria)

**El baseline PRE-deploy ya pasaba los tres conteos de B-02. El cero de B-02 NO se acredita como
logro del deploy de esta fase**: el tile de materia ya estaba muerto antes de que la ola 1 tocara
nada. Lo que esta fase aporta es la **medición apareada** que convierte ese cero en un cero fuerte.

### `Por materia` es un cero ESTRUCTURAL, no medido

El tile **no se monta**: `app/components/panel-actualidad.tsx:51`, bloque
`I. agrupacion_materia MUERE sin tombstone (O-3)`. Es decir, el `0` no dice "el tile se montó y no
tenía datos": dice "el tile no existe en el árbol". Se rotula así a propósito. También verificado el
`0` de tombstone (`(sin materia)`), con el control positivo apareado al lado.

---

## SC4 — H-01 `/comparar` re-verificado: tasa medida y causa raíz con `archivo:línea`

**Estado: CERRADO EN LO QUE SC4 PIDE, CON UN ÍTEM ABIERTO Y UN FIX DIFERIDO.**

SC4 pide: *re-verificado; si reaparece, causa raíz documentada con evidencia (jamás "no reproducible"
a secas)*. Reapareció, y aquí está la causa raíz con archivo y línea.

### Histograma de la tasa observada (N >= 20)

**Ventana:** `2026-07-30T23:51:21Z` → `23:52:16Z` (UTC), bucle **seriado**, 1 s entre iteraciones.
**Comando:** `curl -s -o /dev/null -w "%{http_code}\n"`. **Deploy medido:** `4c6fdbda-…`.

```
# N = 24 sobre /comparar?a=D1178&b=D1099
     24 200
200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200

# control apareado — N = 24 sobre / (portada, force-dynamic ⇒ ejercita el canal Worker→Supabase)
     24 200

# canal RSC (navegación de cliente) — N = 12
     12 200

# integridad del cuerpo — N = 15, una sola variante de tamaño
req=1..15  bytes=109384  cierra_html=1  flight_pushes=14
```

Conteos sobre el cuerpo servido:

| métrica | valor | lectura |
|---|---:|---|
| `No pudimos cargar la portada` | **0** | el boundary NO está en el HTML servido |
| `__next_error__` | **0** | no hay 500 de Next en el documento |
| `D1178` | **10** | control positivo: la comparación real se renderizó |
| `<option` | **374** | roster completo ×2 selects |

`wrangler tail` sobre una ventana de ~100 s con 10 recargas inyectadas: **6/6 `outcome:"ok"`,
`exceptions:[]`, `status:200`**.

**La tasa ES el hallazgo y se publica tal cual: 0/24 fallos en el documento, 0/12 en RSC, 0/15
cuerpos degradados.** No se redondea a una conclusión sobre M-A, porque M-A no vive en esta capa.

### H-01 son DOS modos de fallo distintos

| modo | qué se observó | estado |
|---|---|---|
| **M-A — boundary post-hidratación** | boundary raíz en el navegador con el HTML SSR sano detrás (200, 109.384 bytes, boletines ×10, boundary=0 en el HTML). Re-navegar cura | **REPRODUCIDO** por la ola 1. Mecanismo acotado con control apareado; **el componente exacto NO quedó aislado** |
| **M-B — `500 __next_error__`** | body `<html id="__next_error__">`, 1 observación del premortem; y los dos `500` del deploy final son de la misma familia | Sin explicación confirmada; el amplificador estructural está identificado. **Se registra, NO se descarta** |

### Causa raíz de M-A — hipótesis mejor sostenida, con control apareado

`/comparar` **no tiene ni un solo componente cliente propio** (verificado con `"use client"`
anclado a la línea 1; `components/comparar-selector.tsx` lo menciona solo en un **comentario**,
línea 20 — falso positivo del `grep -rl` ingenuo). El único islote cliente es `HeaderNav`
(`app/app/layout.tsx:40`), presente en TODAS las rutas, y las demás no exhiben M-A. Eso empuja la
causa hacia la **carga del bundle**:

```
# los 9 chunks únicos que referencia la página vigente
     9 200
# control NEGATIVO apareado: hash de chunk que ya no existe en el bundle vigente
stale_chunk_http=404
```

Un `404` al importar un chunk durante la hidratación produce un `ChunkLoadError` **de cliente**.

### Por qué el fallo se come la página entera — `archivo:línea`

`ls app/comparar/` devuelve exactamente `page.test.tsx` y `page.tsx`: **la ruta `/comparar` NO tiene
`error.tsx` propio**, así que cualquier `throw` de su subárbol sube al boundary RAÍZ
(`app/app/error.tsx:17`) y el usuario, estando en `/comparar`, lee `No pudimos cargar la portada`
(`app/app/error.tsx:30`) — copy que ni siquiera corresponde a su ruta.

### Causa raíz de M-B — el amplificador estructural

| sitio | RPC | ante error |
|---|---|---|
| `app/app/comparar/page.tsx:81` | `parlamentarios_publico_v2` (roster) | `throw` en `:83` — corre **antes** de todo (`:194`) |
| `app/app/comparar/page.tsx:92` | `militancia_historica_compartida` | `throw` en `:95-98` |
| `app/app/comparar/page.tsx:108` | `comisiones_de_parlamentario` | `throw` en `:112` |
| `app/app/comparar/page.tsx:124` | `coautores_de_parlamentario_v2` | `throw` en `:128` |
| `app/app/comparar/page.tsx:510` | `coincidencia_votos_par` (VSIM, gated) | `throw` en `:517` |

**El amplificador es `app/app/comparar/page.tsx:246`**: un único `await Promise.all([...])` dispara
**seis** de esas lecturas a la vez. `Promise.all` rechaza con el **primer** rechazo ⇒ basta que UNA
reviente para tumbar la página entera. Con `:510` (VSIM ON en PROD) son **siete** RPCs sin un solo
punto de contención. Ninguna tiene `AbortSignal.timeout`, ni retry, ni `Promise.allSettled`, ni
degradación por eje (verificado por lectura del archivo completo, 699 líneas).

### Lo que NO quedó cerrado en SC4 — dicho con esas palabras

1. **El aislamiento del componente exacto de M-A queda ABIERTO.** `get_console_logs` devolvió
   `{"entries":[],"totalCount":0}` en los 3 intentos (la re-navegación que curó el fallo borró el
   buffer), así que **no hay stack trace**. La hipótesis del chunk stale es **la explicación mejor
   sostenida, no un hecho verificado por reproducción**. Ver §Diferidos D-2.
2. **El fix de resiliencia SSR NO se implementó en esta fase: va DIFERIDO**, porque enmendar el
   contrato LOCKED #34 requiere **pronunciamiento del operador**. Ver §Diferidos D-1 y §Decisiones
   pendientes. Se dice aquí y no se omite.

---

## Deuda de operador

### 1. **ROTAR** la password de la base de datos del proyecto Supabase — acción del operador

**Recomendación explícita: rotar la password de la DB.**

Motivo: durante las olas previas, **dos agentes ecoaron la URL de conexión con credencial en
transcripts locales** (no en el repo). Los artefactos del repo quedaron **redactados** (punto 2),
pero **la redacción de un artefacto no invalida una credencial** — solo deja de publicarla.
Mientras la password no se rote, cualquier copia de esos transcripts sigue siendo utilizable.

Esta fase **no toca `.env`, no toca credenciales y no rota nada** (`git status --porcelain .env` →
vacío): rotar es acción del operador sobre la consola de Supabase.

### 2. Redacción B26 — hecho dentro del alcance de esta fase

En `.planning/milestones/v1.0-phases/07-b-squeda-sem-ntica-fichas-estructuradas/07-01-SUMMARY.md`
había **TRES** literales a redactar, no uno: el project-ref, el host del pooler IPv4 con puerto, y
el host de la API. Se **redactó, no se borró**: el archivo conserva **186 líneas** antes y después.

> **Este documento no repite los literales.** Redactar el `07-01-SUMMARY.md` para luego reimprimir
> el ref aquí sería un no-fix. Por eso los comandos van **parametrizados** (`$REF` / `$DOMINIO`),
> jamás con el valor. Ya se pagó una vez ese error en esta fase.

```
$ REF=<el project-ref>            # no se transcribe aquí, a propósito
$ grep -oE "$REF"'|supabase\.'"$DOMINIO"'|aws-1-sa-east-1\.pooler' 07-01-SUMMARY.md | wc -l
0
$ grep -oE '<PROJECT_REF_REDACTADO>|<SUPABASE_HOST_REDACTADO>|<POOLER_HOST_REDACTADO>' 07-01-SUMMARY.md | wc -l
3          # control positivo: los marcadores SÍ están
$ grep -oF 'supabase' 07-01-SUMMARY.md | wc -l
6          # control positivo apareado ⇒ el 0 es FUERTE
$ wc -l < 07-01-SUMMARY.md
186        # invariante
```

### 3. Alcance restante, cuantificado

```
$ git grep -lF "$REF" -- . | wc -l
49
$ git grep -lF 'supabase' -- . | wc -l
793        # control positivo: el recorrido de archivos tracked funciona
```

**49 archivos tracked aún contienen el project-ref** y quedan **fuera del alcance de la Phase 129**:
redactarlos es deuda de operador, a decidir junto con la rotación del punto 1.

> Nota de método sobre el número: el plan citaba `~96`, medido con `grep -rlF … --exclude-dir=…`,
> comando que **agotó el timeout de 2 minutos** en este entorno (el repo vive bajo OneDrive). Se
> midió con `git grep -lF`, que recorre exactamente los archivos **tracked** — el universo relevante
> para "qué se publica en el repo". El número publicado es el medido, **49**, con su comando al lado.

---

## Diferidos

| id | ítem | mecanismo | razón del diferimiento | criterio de cierre futuro |
|---|---|---|---|---|
| **D-1** | **Fix de resiliencia SSR de `/comparar` — NO se implementó en esta fase** | `Promise.all` de `app/app/comparar/page.tsx:246` sin aislamiento por eje; cinco lectores que lanzan (`:81`, `:92`, `:108`, `:124`, `:510`); `/comparar` sin `error.tsx` propio ⇒ boundary raíz. Modo **M-B** | Implementarlo exige **enmendar el contrato LOCKED #34** (`page.tsx:74-76`) e **invertir su test** (`page.test.tsx:218-231`). Esa regla existe justamente para impedir que un error se lea como ausencia: degradarla mal fabricaría un hecho negativo con atribución de fuente — el riesgo #1 del proyecto. **Requiere pronunciamiento del operador.** Además introduciría copy nuevo en producción fuera del único checkpoint humano de la fase | Test de fallo de upstream sobre el harness **ya existente** (`app/app/comparar/page.test.tsx:218-231`) que, con una RPC en error, (a) NO rechace el render, (b) muestre la declaración de eje caído, (c) NO emita ninguna frase de ausencia — con control apareado (cero de la frase de ausencia + presencia positiva del copy de fallo) |
| **D-2** | **Aislamiento de M-A** (`ChunkLoadError` post-hidratación) | Hipótesis del chunk stale sostenida por control apareado (9 chunks vigentes → 200; hash inventado → 404) y por eliminación de 4 alternativas. **No verificada por reproducción** | Requiere una ventana de deploy coordinada con una sesión de navegador viva y capturar el stack **antes** de re-navegar (la re-navegación borró el buffer de consola en los 3 intentos). No cabía en el flujo de `129-04` | Stack trace del error de hidratación con componente/chunk nombrado, o descarte positivo de la hipótesis |
| **D-3** | **C-09 — placeholder del hero recortado a 390 px** (`Escribe una idea o un númerc`) | 42 caracteres en un input de ~280 px útiles (`app/components/search-box.tsx:111-114`) | Doble razón: (i) es **copy de producción** y entraría fuera del único checkpoint humano; (ii) el único testigo es la superficie del **escalón (b)**, y la salvedad de SC2 impide dar por firme un recorte tipográfico sin viewport real | Shot en viewport real de 390 CSS px con el `placeholder` completo visible, o aserción de longitud sobre el literal de la rama hero |

Propuesta de fix de D-1, ya escrita (para cuando el operador se pronuncie): sustituir el
`Promise.all` por `Promise.allSettled` o envoltorio por lector; introducir un **tercer estado
`fallo`, DISTINTO de `vacío`** (hoy hay `presente`/`ausente`/`indeterminado`, `page.tsx:625-628`)
que declare *"no pudimos cargar este eje"* y **jamás** degrade un error a `[]`; `AbortSignal.timeout`
+ retry acotado en las siete lecturas; y un `app/comparar/error.tsx` propio.

---

## Decisiones pendientes para el operador

**Una sola, y es una PREGUNTA — no un cambio hecho a sus espaldas.** Nada de lo descrito abajo se
implementó en esta fase.

| # | decisión | qué se pregunta | si dice SÍ | si dice NO | ¿bloquea el veredicto de diseño? |
|---|---|---|---|---|---|
| **1** | Enmienda al contrato LOCKED #34 para aislar el fallo por eje en `/comparar` | ¿Autoriza enmendar `app/app/comparar/page.tsx:74-76` (*"cada lector LANZA; error ≠ vacío"*) e invertir su test, para que un fallo transitorio de UNA RPC deje de tumbar la página entera? La línea roja se mantiene intacta en la propuesta: el estado nuevo `fallo` es **DISTINTO** de `vacío` y declara *"no pudimos cargar este eje"*, **jamás** "no hay registros" | se planifica D-1 en una fase futura, con el copy nuevo pasando por checkpoint humano | D-1 queda cerrado como decisión, y los `500` transitorios de `/comparar` se aceptan como comportamiento conocido y documentado | **NO.** Responderla es **opcional** para el veredicto de diseño; queda registrada igual |

---

## Estado por Success Criterion (resumen)

| SC | enunciado (ROADMAP §Phase 129) | estado |
|---|---|---|
| **SC1** | Loop iterado hasta veredicto, cierre por fragmento DOM + captura | **CERRADO CON SALVEDAD** — 3/3 iteraciones gastadas, los 4 `FIX` cerrados con comando+salida; la salvedad es la superficie de 390 px (SC2) |
| **SC2** | Densidad a 390 px con `y N más →` honesto | **CERRADO CON SALVEDAD** — `maxItems:4` y N honestos probados; **la captura 390 px NO es del deploy real** (escalón (b), CSP `frame-ancestors 'none'`) |
| **SC3** | B-02: el tile con denominador ausente ya no existe | **CERRADO, NO ACREDITABLE** — ceros fuertes con control positivo apareado, pero el baseline pre-deploy ya los pasaba; `Por materia` es cero **ESTRUCTURAL** |
| **SC4** | H-01 re-verificado; si reaparece, causa raíz con evidencia | **CERRADO en lo que SC4 pide** (tasa N=24+24+12+15 y causa raíz con `archivo:línea`); **ABIERTO** el aislamiento del componente de M-A; **DIFERIDO** el fix de resiliencia SSR |

**El veredicto de cierre de la fase es del operador** (`129-05` Task 2). Este documento no lo emite,
no lo infiere y no lo deriva del silencio.

---

## Método de medición (anti-falso-verde)

- Todos los contadores usan `grep -oF … | wc -l` o `grep -oE … | wc -l`; **nunca `grep -c`** (topa
  en 1 sobre HTML de una sola línea).
- Ningún `grep -q` bajo `pipefail`; ningún `grep -i` combinado con `-F`.
- Cada cero va apareado con un **control positivo sobre el mismo cuerpo o archivo**.
- Rutas de `vitest` **explícitas**, nunca glob (`vitest run <glob>` sale 0 sin correr nada).
- Capturas acreditadas por **contenido** (`textContent`, jamás `innerText`), nunca por `test -s`.
- Los chunks del bundle se re-listan con glob; **jamás** se hardcodea una ruta de chunk.
- Este plan **no deploya, no instala paquetes y no toca `supabase/migrations/`, `.env` ni la CSP.**

---

## Addendum ola 5 — re-deploy final tras el code-review

El consolidado de arriba se escribió contra el deploy `9a8acdb0`. Después de él, un code-review
profundo (`129-REVIEW.md`, 2 críticos + 10 warnings + 3 info) produjo 10 commits de corrección
(`bd785da` … `ee2b2e5`) que **PROD no tenía**. Se re-deployó por el mismo procedimiento probado.

**Version-id vigente: `8e0f403e-5806-411c-8289-ec416924058c`.** Es el 5.º de la cadena
(`b69f2ec2` → `4c6fdbda` → `f9c5bf23` → `9a8acdb0` → **`8e0f403e`**). Detalle completo, patas del
bundle y mediciones DOM en `129-DEPLOY-EVIDENCIA.md` §Re-deploy FINAL post-review (ola 5).

### Qué cambia para el operador

| # | hallazgo del review | qué se hizo | ¿se ve en pantalla? |
|---|---|---|---|
| **CR-01** | el fix C-03 del eje VSIM no tenía ni un test que lo respaldara (sobrevivía a la mutación) | test real con `VSIM_PUBLIC_ENABLED=true` y control positivo apareado (`bd785da`) | no — es blindaje de regresión |
| **CR-02** | "Nuevos ingresos" truncaba a 4 **sin declarar el remanente**, y un test de la fase certificaba la omisión | el tile emite su "N más" con `Math.max(total_jsonb, items.length)`; el test se invirtió (`1c696b6`) | **hoy NO**, y la razón está medida: la ventana de 7 días viene con **cero** ingresos, así que la subsección rinde su ausencia declarada (*"sin nuevos ingresos fechados en la ventana"*) y no hay nada que truncar. El código está en el bundle desplegado (pata 1 del bundle: **0 → 2**) y su honestidad está probada por test (`panel-tile-ingresos.test.tsx:230`, `"5 más"`) |
| **WR-01/02/IN-03** | `fecha_captura_max` es timestamp real, no date-only; el fix podía **borrar** la línea de provenance | degradación honesta a `"fecha no informada"`, nunca a la nada (`f5d61ae`) | sólo si el dato es impresentable |
| **WR-03** | el skeleton del Suspense seguía en span 4 tras subir el tile a 6 ⇒ reflow de media portada | fallback a span 6 (`2ebcd9f`) | sí, durante la carga: la fila ya no salta |
| **WR-04/08** | el test de spans validaba una **réplica** del orquestador, no el orquestador | monta el componente real (`46ae509`) | no |
| **WR-05** | aserción vacua en densidad de archivados | fixture con `total ≠ items.length` (`ff726ee`) | no |
| **WR-06/07** | `total` del jsonb descartado; `plural()` sin adoptar en 2 sitios | excepción documentada + adopción (`3e59cf2`, `e150b80`) | no |
| **IN-01** | parámetro muerto `primero` | eliminado (`3bee95b`) | no |
| **WR-09** | project-ref en claro dentro de `129-03-PLAN.md` | redactado (`ee2b2e5`) | no |

### Mediciones sobre el deploy `8e0f403e`

- **Densidad 390 px:** `[4, 4, 4, 4, 4, 1]` ítems por sección ⇒ **ninguna** sobre 4. Remanentes vivos
  en el DOM: `y 30 más →`, `y 27 más →`, `62 más`.
- **B-02:** `(sin materia)` = 0 · `Por materia` = 0 · control positivo
  `Comisiones citadas esta semana` = 2 ⇒ ceros **fuertes**. (Sigue siendo cero **estructural**, no
  acreditable como logro del deploy: el baseline pre-fase ya los pasaba.)
- **`/comparar`:** `200` al 2.º intento (el 1.º dio `500`, modo M-B ya diferido a D-1), 6 ejes,
  `err:false`, `iso:0` con `civil:22`, ambos parlamentarios resueltos.
- **Suite del tile tocado:** `vitest run components/panel-tile-ingresos.test.tsx` → **11/11**.

### Capturas vigentes (sobrescritas, mismos nombres, todas `-nt /tmp/129-deploy-final`)

`129-final-landing-desktop.png` (1620×917) · `129-final-landing-full.png` (1600×4190, **la única
donde se ve la grilla bento entera**) · `129-final-comparar.png` (1620×847) ·
`129-final-panel-390.png` (390×1400, **escalón (b): NO es del deploy real**, `href` = `127.0.0.1`).

### Gotcha nuevo, medido en esta ola

**Los nombres de chunk SSR de Turbopack NO son hashes de contenido fiables.** El listado completo de
`chunks/ssr/*.js` salió **idéntico** entre el bundle viejo y el nuevo (`comm -3` = 0), y sin embargo
`app_app_page_tsx_0rknh79._.js` — mismo nombre — pasó de **0** a **2** ocurrencias del literal nuevo.
Un listado de nombres igual **no** prueba que el bundle sea el mismo: la pata que discrimina es el
conteo de un literal por contenido, con su medición pre-purga como control negativo.
