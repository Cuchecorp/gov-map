---
phase: 125-e2e-pasada-final-producto-a-producto
plan: 05
subsystem: verificacion-e2e
tags: [links, robots, rate-limit, fechas, dom, post-deploy]
requires: ["125-01 (deploy 0ea5d97f)", "114-CORRIDA-POST", "115-PATRONES/ROBOTS/MUESTRA/VEREDICTO", "117-DISPOSICION", "113-INVENTARIO Tabla D"]
provides: ["125-RE-VERIFICACION.md", "125-LINKS-INT.json/.txt", "125-ROBOTS-RUN.json/.txt", "125-MUESTRA-EXT.json/.txt"]
affects: ["SC3 del ROADMAP", "mitad de fechas de SC4"]
tech-stack:
  added: []
  patterns: ["runners existentes se corren, no se reescriben (git diff -- scripts/ vacio)", "mesura instrumentada con dos sellos date -u +%s", "grep -o | wc -l sobre HTML de una linea"]
key-files:
  created:
    - .planning/phases/125-e2e-pasada-final-producto-a-producto/125-RE-VERIFICACION.md
    - .planning/phases/125-e2e-pasada-final-producto-a-producto/125-LINKS-INT.json
    - .planning/phases/125-e2e-pasada-final-producto-a-producto/125-LINKS-INT.txt
    - .planning/phases/125-e2e-pasada-final-producto-a-producto/125-ROBOTS-RUN.json
    - .planning/phases/125-e2e-pasada-final-producto-a-producto/125-ROBOTS-RUN.txt
    - .planning/phases/125-e2e-pasada-final-producto-a-producto/125-MUESTRA-EXT.json
    - .planning/phases/125-e2e-pasada-final-producto-a-producto/125-MUESTRA-EXT.txt
  modified: []
decisions:
  - "El 520 de www.senado.cl (P-22-c01) se declara como fuente caida, no se reintenta ni se evade"
  - "Los 5 FAIL nuevos de links internos se auditan a mano y se declaran falsos FAIL del assert CR-02 sobre contenido RSC/cliente; el runner NO se modifica (regla LOCKED)"
  - "Las 4 rutas cuyo dato fechado viaja diferido (shell de streaming / isla cliente) se declaran como limite, no se cuentan como aprobadas ni como defecto"
metrics:
  duration: ~35 min
  completed: 2026-07-29
---

# Phase 125 Plan 05: Re-verificación de links y fechas post-deploy — Summary

Re-verificación exhaustiva de links internos y de la muestra estratificada de links externos sobre
el deploy `0ea5d97f-a172-436e-aad0-add95940ee0e`, más el barrido de etiquetado de fechas sobre el
HTML servido: **cero 404 internos, cero anclas ausentes, cero regresiones, rate-limit demostrado en
2,89 s/request y una sola diferencia externa vs 115 (fuente caída, declarada)**.

## Paso 0 — precondición de frescura (bloqueante) PASADA

`0ea5d97f-a172-436e-aad0-add95940ee0e` leído de `125-DEPLOY-RUNBOOK.md` §2 y registrado en la
cabecera del artefacto. Marcador de 122 `3,8` → **2** ocurrencias (literal que sólo existe tras el
fix); marcador de 117 `según fuente al ` → **32**; idiom viejo `Actualizado` → **0**. Los cuatro
coinciden exactamente con el runbook ⇒ el sitio interrogado es el nuevo, no el viejo. Recién
entonces se corrieron los runners.

## Links internos — cero 404, cero anclas ausentes, cero regresiones

`node scripts/verificar-links-internos.mjs --out …/125-LINKS-INT`, sin filtros, 32 s.

- **95/95** entradas del manifiesto (= las 95 de `114-CORRIDA-POST`, conjunto de ids **idéntico**).
- **0** links internos con status 404 (los 4 casos que *esperan* 404 lo dan y pasan).
- **0** anclas ausentes del DOM destino (24/24 `tipo: ancla` PASS).
- **0** aserciones de ausencia rotas (7/7 PASS; MONEY y NOTIF siguen inertes).
- 23 diferencias vs 114, todas clasificadas: **1 mejora**, **0 regresiones**, **22 de método**.

**La mejora:** `4.2.b-404` pasó de FAIL a PASS. 114 declaró honestamente "fix en código, deploy
diferido a 125"; aquí `/proyecto/00000-00` devuelve **404** de verdad y el fix de `10f1106` queda
verificado sobre el deploy, no sólo sobre el árbol.

**Los 22 de método:** el runner se endureció después de guardar `114-CORRIDA-POST` (CR-01, CR-02,
WR-02, WR-03, W-01), y su propia cabecera lo advierte. 17 quedaron en `WARN-STREAM` (shell de
streaming, el runner no falla). Los **5 FAIL nuevos** se auditaron uno a uno contra el HTML servido
y ninguno es un link roto:

- 4 son las páginas `not-found.tsx` (`/parlamentario/D0000000`, `/proyecto/00000-00`,
  `/contraparte/c:sujeto-inexistente`, `/red?seed=D0000000`): Next las sirve **enteras por el stream
  RSC** — `grep -o '<a '` da **0** en el markup — y el link existe verbatim en el payload:
  `{"href":"/","className":"text-primary underline underline-offset-2","children":"Volver al inicio"}`.
  El destino `/` responde 200. Falso FAIL, equivalente semántico de WARN-STREAM.
- 1 es `4.9-A1`: el href sale de `<Link href={`/red?seed=${vecinoId}`}>` en `red-graph.tsx:210`, que
  es `"use client"` ⇒ se materializa en hidratación. Y además el caso se instanció con el **propio
  seed**, el único id que nunca será vecino de sí mismo ⇒ aserción insatisfacible por construcción.

Se declararon como hallazgos **H-125-05-A** (caso mal instanciado) y **H-125-05-B** (el assert CR-02
carece de rama para rutas 100 % RSC). **No se tocó el runner ni el manifiesto** — regla LOCKED del
plan; `git diff --name-only -- scripts/` quedó **vacío** en los tres pasos.

## Links externos — robots primero y rate-limit instrumentado

**Orden probado por mtime:** `125-ROBOTS-RUN` a las `17:41:20.342 -0400`, `125-MUESTRA-EXT` a las
`17:42:57.861 -0400` ⇒ **97 s** de separación, robots antes de pedir un solo recurso de caso.

**Directivas de hoy vs las congeladas en `115-ROBOTS.txt`: cero cambios adversos.**
`www.senado.cl` sirve el mismo `Allow: /` + `Disallow: /proyecto-365` (nuestro caso es
`/appsenado/…`); `web-back.senado.cl` el mismo robots de Drupal (los casos son `/api/…`);
`opendata.camara.cl` y `tramitacion.senado.cl` siguen sin robots publicado. `www.leylobby.gob.cl`
y `datos.cplt.cl` devuelven **403 en el propio robots.txt**, igual que en 115: se **declara**
(WAF-en-robots, sin directiva que respetar ni burlar; RFC 9309 §2.3.1.3 trata 4xx como
*unavailable*) y se mantiene el criterio de 115 — mismos casos, mismo UA, mismo delay, sin proxies
ni headers de navegador. `www.camara.cl` no aparece porque su retiro por `Disallow: /` está
**codificado** en el runner, no confiado a un comentario.

**Prueba de mesura, con los dos sellos verbatim:**

```
MUESTRA_INICIO_UNIX=1785361322  (2026-07-29T21:42:02Z)
MUESTRA_FIN_UNIX=1785361377  (2026-07-29T21:42:57Z)
(1785361377 − 1785361322) / 19 requests = 55 / 19 = 2,89 s por request   ≥ 2 s ✓
```

Corroborado por los sellos internos del runner (`21:42:02.431Z → 21:42:57.861Z`) y por
`delta_ms_mismo_host`, cuyo **mínimo instantáneo es 2.501 ms** en las 13 filas con predecesor de
host. **0 reintentos.** Ningún host recibió ráfagas; ningún crawl.

**Muestra: 19 casos / 18 patrones / 6 hosts**, la misma cobertura ≥1 por patrón×host de
`115-PATRONES.md` §4, sin ampliar ni filtrar. **Una sola diferencia de código HTTP vs 115:**

| caso | 115 (28 jul) | 125 (29 jul) | clasificación |
|---|---|---|---|
| `P-22-c01` (`www.senado.cl`, `…getDocto&iddocto=11240`) | 200 tras 2 redirects, `application/msword` | **520**, cuerpo `error code: 520`, 2026-07-29T21:42Z | **fuente caída — declarada** |

El 520 es el código de Cloudflare para "el origen devolvió una respuesta desconocida": el fallo es
del servidor del Senado, y 115 ya había probado que el patrón P-22 construye la URL correcta. **No
se reintentó** (política del runner: un reintento sólo ante fallo de red) y **no se cambió nada**
para forzar un 200.

Los 5 **patrón malo** (`P-03-c02`, `P-11-c01`, `P-18-c01`, `P-23-c01`, `P-25-c01`) reprodujeron
código y cuerpo idénticos a 115: son los hallazgos **A-3** (`Falta el parámetro: prmBoletin`) y
**A-5** (SPARQL mal formada, `Virtuoso 37000 Error SP030`) ya levantados por `115-VEREDICTO.md`.
Cero deriva; su fix sigue siendo trabajo de fase de datos, no de este plan.

## Fechas sobre el DOM del deploy

Cobertura **declarada con lista**: 20 URLs para las 19 filas de la Tabla D de 113 (las 15 rutas
LOCKED + las 4 `not-found.tsx`, con `/parlamentario` y `/proyecto` instanciadas con dos sujetos cada
una y `/buscar` con y sin `q`). `/admin/revisar-entidades` **no** se barrió: es la fila
`n/a — EXCLUIDA` por decisión LOCKED del CONTEXT de 113, y la exclusión se declara.

| grep | resultado |
|---|---|
| `Actualizado hace` | **0 en 20/20** — con la advertencia repetida de que es un **control inerte** (ya era 0 pre-deploy); el discriminante real es `Actualizado` 318→0 / `según fuente al ` 0→32 |
| `corte al` | **0 en 20/20** (F-08) |
| `según fuente al ` | **≥1 en las 6 rutas con dato fechado servido**: D1165 **14**, S1338 **20**, 14309-04 **32**, 17870-05 **527**, `/buscar?q=pension` **20**, `/comparar` **2** |
| `recalculado por el Observatorio al ` | presente donde F-02 lo puso: cruces de parlamentario (**180**) y cruces de proyecto (**288**) |
| `captura` pelado | **0 en 20/20** |

**Criterio de separación de `captura` escrito, no supuesto:** la clase previa del regex excluye `_`,
y además se re-corrió cada página normalizando `fecha_captura`/`fechaCaptura` → `FKID` con `sed`
antes del grep: **0 en las 20, idéntico**. O sea, el 0 no se obtiene escondiendo el identificador —
no existe ninguna ocurrencia de la palabra suelta. Los identificadores sí están y se declaran:
`fecha_captura` aparece **186 veces en `/parlamentarios`**, todas como clave de objeto en el payload
RSC, cero como texto visible.

**Límite declarado (4 rutas):** `/`, `/agenda`, `/parlamentarios` y `/red?seed=D1165` dan 0 en
`según fuente al `, y eso **no** se contó como aprobado ni como defecto: se midió el motivo. Las
tres primeras sirven un shell (`hidden id="S:` = 6 / 3 / 1); `/parlamentarios` lleva 186
`fecha_captura` en el payload (el dato viaja, el render no); `/red` es isla cliente
(`"use client"`). En `/` sí llega el idiom de F-14 (**16 × `datos al `**) y falta la franja de F-06,
que va en un boundary sin resolver. Cierre real: DOM, Plan 06.

**Las 3 fechas muestreadas, verbatim, con su fila:**

- **F-14** (date-only disfrazada de `timestamptz`, `fechaCivilCorta`) en `/`:
  `"children":["Fuente: ","Tramitación",[" · datos al ","22 jul 2026"]]` — sin conversión de zona:
  la parte UTC **es** el día chileno. *Sustitución declarada:* el plan sugería una citación de
  `/agenda`, que sirve shell; se muestreó otro call-site del mismo helper y la misma clase de dato.
- **F-05 + F-07** (fecha de hecho, `fechaHechoCorta`) en `/proyecto/14309-04`:
  `"children":["Hito del ",…{"className":"font-mono","children":"15 jun 2021"}]`, con el crudo
  expuesto en el `key`: `C.Diputados-2021-06-15T00:00:00+00:00`. Hermano: `Votada el` `08 sept 2021`.
- **F-01** (fecha de captura, idiom LOCKED) en `/proyecto/14309-04`:
  `según fuente al <!-- -->09 jul 2026</span>`, y con F-03
  `["según fuente al ","09 jul 2026"," (evento más reciente)"]`, tooltip con el instante crudo
  `2026-07-09T04:37:00.302Z` (04:37 Z ⇒ `09 jul 2026` con `timeZone: "UTC"`, F-10).

Bonus F-02 verbatim: `recalculado por el Observatorio al <!-- -->29 jul 2026` — el rebuild se nombra
rebuild. F-13 corroborado: `Urgencia Suma vigente desde el 07 jul 2026`, sin tiempo relativo.

## Canario de 124

Los 5 conteos acotados que el runbook publicó son **idénticos** hoy: `href="/proyecto/` en
`/parlamentario/D1165` = **23**; las 4 anclas del rail = **1 cada una**; `según fuente al ` en
14309-04 = **32**; `3,8` = **2**; `Actualizado` = **0**. ⇒ **la cota de cardinalidad de `0079` no se
disparó** y el timeout de 5 s de `0077` no degradó ninguna sección a vacío.

El único delta es de bytes totales (1.282.007 hoy vs 1.242.030 citados en el runbook §3.2, +3,2 %)
y **se atribuye, no se despacha**: esa cifra del runbook es la de la captura **PRE-deploy** (la nota
de método la usa para explicar por qué `grep -c` es inservible) y el bundle nuevo añade justamente
el copy de 117 y 122. Control de variabilidad por request: tres capturas consecutivas de la misma
URL dieron `1282007 / 1282050 / 1282007` bytes (±43 B) con `Hito del` = 170 y `según fuente al ` =
32 en las tres ⇒ la variabilidad por request es de decenas de bytes, no de decenas de KB. Como todos
los conteos acotados coinciden, el delta no toca ninguna superficie contada.

## Deviations from Plan

**Ninguna desviación RULE-1/2/3/4.** Cero fixes de código, cero DDL/DML, cero deploy, cero flips de
flag, cero PII, `SUPABASE_DB_URL` jamás expandida ni ecoada. Los dos runners se corrieron tal como
están (`git diff --name-only -- scripts/` vacío, T-125-15) y el manifiesto no se amplió.

Tres **decisiones de clasificación** que el plan pedía tomar explícitamente, tomadas y registradas:

1. Los 5 FAIL nuevos de links internos → **falsos FAIL del assert CR-02** sobre contenido RSC /
   cliente (auditados a mano, con el payload verbatim como evidencia), no regresiones. Se declaran
   como hallazgos de runner y de instanciación de caso, sin tocar código.
2. `P-22-c01` 520 → **fuente caída**, con código y fecha, sin reintento y sin evasión.
3. Las 4 rutas con dato fechado diferido → **límite de medición declarado**, cerrable sólo en DOM
   (Plan 06, dueño de BrowserOS). No se afirmó verde ni se levantó defecto.

## Ámbito respetado

No se tocó `app/`, `supabase/`, `scripts/`, BrowserOS/MCP, ni ningún artefacto de los planes 02/03/04
que corren en paralelo (`125-E2E-B-RUTAS.md` quedó sin stagear, tal cual estaba).

## Commits

| commit | contenido |
|---|---|
| `618148c` | `test(125-05)`: corrida de links internos contra el deploy `0ea5d97f` |
| `166c912` | `test(125-05)`: robots-primero + muestra externa con rate-limit demostrado |
| `f499aec` | `docs(125-05)`: `125-RE-VERIFICACION.md` |

## Self-Check: PASSED

Archivos declarados, todos presentes en disco: `125-RE-VERIFICACION.md`, `125-LINKS-INT.json`,
`125-LINKS-INT.txt`, `125-ROBOTS-RUN.json`, `125-ROBOTS-RUN.txt`, `125-MUESTRA-EXT.json`,
`125-MUESTRA-EXT.txt`. Commits declarados, los tres en `git log`: `618148c`, `166c912`, `f499aec`.
Verificaciones automatizadas del plan: `Object.keys(125-LINKS-INT.json)` → `["meta","resultados"]`;
`test -f 125-MUESTRA-EXT.json` → OK; `curl /agenda | grep -c "Actualizado hace"` → **0**.
`git diff --name-only -- scripts/` → vacío.
