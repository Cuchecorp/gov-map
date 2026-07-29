---
phase: 125-e2e-pasada-final-producto-a-producto
plan: 05
fecha: 2026-07-29
version_desplegada: 0ea5d97f-a172-436e-aad0-add95940ee0e
commit_bundle: b4882e9
url: https://observatorio-congreso.thevalis.workers.dev
---

# 125-RE-VERIFICACION — links internos, muestra externa y fechas sobre el deploy nuevo

Re-verificación post-deploy de SC3 (links) y de la mitad de fechas de SC4, contra el deploy
**`0ea5d97f-a172-436e-aad0-add95940ee0e`** (`125-DEPLOY-RUNBOOK.md` §2), commit `b4882e9`.

**Régimen de la corrida:** contra el Worker propio, `curl`/fetch secuencial. Contra fuentes
gubernamentales, **rate-limit de 2-3 s por host** (`DELAY_MS = 2500`), User-Agent identificatorio,
robots.txt primero y muestra estratificada acotada — **jamás ráfagas, jamás crawl exhaustivo**
(decisión de operador 2026-07-27, LOCKED). El cumplimiento del rate-limit no se afirma: se
**instrumenta** en §2.3 con los dos sellos `date -u +%s` y la aritmética.

**Cero fixes de código, cero DDL/DML, cero deploy, cero flips de flag, cero PII.**
`git diff --name-only -- scripts/` → **vacío** en los tres pasos: los runners se corrieron,
no se reescribieron (T-125-15).

---

## §0 Precondición de frescura (BLOQUEANTE) — PASADA

`depends_on` garantiza orden, no frescura. Antes de correr un solo runner:

| # | check | comando | resultado |
|---|-------|---------|-----------|
| 1 | el runbook declara la versión | lectura de `125-DEPLOY-RUNBOOK.md` §2 | **`VERSIÓN DESPLEGADA: 0ea5d97f-a172-436e-aad0-add95940ee0e`** ✓ |
| 2 | marcador de 122 vivo | `curl -s .../proyecto/14309-04 \| grep -o '3,8' \| wc -l` | **2** (literal que sólo existe tras el fix de 122) ✓ |
| 3 | marcador de 117 vivo | `grep -o 'según fuente al ' \| wc -l` | **32** ✓ |
| 4 | idiom viejo muerto | `grep -o 'Actualizado' \| wc -l` | **0** ✓ |

Método: `grep -o … | wc -l`, **nunca `grep -c`** (el HTML es una sola línea de ~1,28 MB ⇒ `grep -c`
topa en 1 y es inservible — gotcha pagado por 125-01).

Sello: `2026-07-29T21:37Z`. Los cuatro marcadores coinciden **exactamente** con los del runbook
⇒ el sitio interrogado es el nuevo. Se procede.

---

## §1 Links internos — corrida exhaustiva contra el deploy nuevo

### §1.1 Comando y totales

```bash
set -o pipefail
node scripts/verificar-links-internos.mjs \
  --out .planning/phases/125-e2e-pasada-final-producto-a-producto/125-LINKS-INT
```

Sin filtros (`--route`/`--tipo` no se usaron ⇒ `MSYS_NO_PATHCONV=1` innecesario).
Inicio `1785361073` → fin `1785361105` (**32 s**), `delay_ms = 400`, secuencial, caché de HTML por
URL, UA identificatorio, cota de 15 s por request. Contra el **Worker propio**, no contra fuentes.

| medición | 114-CORRIDA-POST (2026-07-28T01:21Z) | 125-LINKS-INT (2026-07-29T21:37Z) |
|---|---:|---:|
| entradas del manifiesto | 95 | **95** (≥ 114 ✓, conjunto de ids **idéntico**: 0 nuevos, 0 desaparecidos) |
| PASS | 94 | **73** |
| WARN-STREAM | (estado inexistente en esa corrida) | **17** |
| FAIL | 1 | **5** |
| MISSING-SSR | 0 | **0** |

### §1.2 Los tres criterios duros del plan — los tres en cero

| criterio | medición | resultado |
|---|---|---|
| links internos con **404** | filas `espera: no-404` con `status = 404` | **0** ✓ |
| **anclas** declaradas ausentes del DOM destino | filas `tipo: ancla` con veredicto ≠ PASS | **0** ✓ (24/24 anclas PASS) |
| aserciones de **ausencia** que dejaron de dar ausencia | filas `tipo: ausencia` con veredicto ≠ PASS | **0** ✓ (7/7 PASS — gates MONEY y NOTIF siguen inertes) |

Los 3 casos que **esperan** 404 lo dan y pasan: `4.1.b-404` (404), `4.2.b-404` (404),
`4.3-A2-A3` (404), `4.9.b-404` (404).

### §1.3 Las 23 diferencias vs 114, una por una, clasificadas

**(a) MEJORA — 1 id.** Lo que 114 dejó rojo y el deploy cerró:

| id | 114 | 125 | qué cambió |
|---|---|---|---|
| `4.2.b-404` | **FAIL** (esperaba 404, observaba **200**) | **PASS** (`status: 404`) | el fix de 114 (`app/app/proyecto/[boletin]/page.tsx`, commit `10f1106`: comprobación de existencia elevada ANTES del primer `<Suspense>`) **ya viaja en este deploy**. 114 lo declaró "fix en código, no verificado sobre el deploy"; aquí queda verificado sobre el deploy. |

**(b) REGRESIÓN del sitio — 0 ids.** Ningún destino dejó de responder, ninguna ancla desapareció,
ninguna ausencia se rompió.

**(c) CAMBIO DE MÉTODO (no del sitio) — 22 ids.** El runner se **endureció** después de guardar
`114-CORRIDA-POST` (CR-01, CR-02, WR-02, WR-03 y el tercer estado W-01 del `114-REVIEW.md`), y su
propia cabecera lo advierte: *"un veredicto de esta versión puede diferir del de los `.json`
guardados: es el runner el que se endureció, no el sitio el que cambió"*. Las 22 filas son el
assert de **emisión** de CR-02 (el origen debe EMITIR el href, no basta que el destino responda),
que en 114 no existía. Se subdividen así:

**(c.1) 17 ids `PASS → WARN-STREAM`** — el origen sirve un **shell de streaming** y el href viaja
en el payload RSC / en un fallback de `<Suspense>` sin resolver. El propio runner reserva
WARN-STREAM para esto y **no falla la corrida**:

`4.1-A4`, `4.1-A6`, `4.1-A7`, `4.1-A9`, `4.1-A10`, `4.1-A14`, `4.1-A15`, `4.1-A16`, `4.1-A17`,
`4.2-A3`, `4.2-A4`, `4.2-A10`, `4.5-A2`, `4.5-A3`, `4.5-A7`, `4.5-A8`, `4.6-A4`.

Evidencia del mecanismo (verbatim del `.txt`): *"destino alcanzable; el origen sirve un SHELL de
streaming (54 fallbacks de Suspense sin resolver) y el href no está en los bytes servidos ⇒ no se
puede concluir ausencia — verificar en DOM (125/BrowserOS)"*. **Cierre: DOM, Plan 06.**

**(c.2) 5 ids `PASS → FAIL`** — mismo mecanismo, pero el detector de shell del runner no los
reconoce como shell. Se auditó cada uno **a mano contra el HTML servido**; ninguno es un link roto:

| id | origen | href esperado | qué dice el HTML servido | veredicto real |
|---|---|---|---|---|
| `4.1.b-A1` | `/parlamentario/D0000000` (404) | `/` | **cero etiquetas `<a>`** en el markup; el link vive en el payload RSC: `{\"href\":\"/\",\"className\":\"text-primary underline underline-offset-2\",\"children\":\"Volver al inicio\"}` | **falso FAIL** — el link SÍ se emite (payload RSC), destino `/` en 200. Equivale a WARN-STREAM |
| `4.2.b-A1` | `/proyecto/00000-00` (404) | `/` | ídem (mismo payload verbatim, `<Link href="/">Volver al inicio</Link>` de `not-found.tsx:37`) | **falso FAIL** |
| `4.3.b-A1` | `/contraparte/c:sujeto-inexistente` (404) | `/` | ídem (`not-found.tsx:19`, E-050) | **falso FAIL** |
| `4.9.b-A1` | `/red?seed=D0000000` (404) | `/` | ídem (`app/app/red/not-found.tsx:19`, E-047) | **falso FAIL** |
| `4.9-A1` | `/red?seed=D1165` | `/red?seed=D1165` | el href lo emite `<Link href={\`/red?seed=${vecinoId}\`}>` dentro de `red-graph.tsx:210`, que es **`"use client"`** ⇒ se materializa en hidratación, no en SSR. El HTML sirve `href="/red"` (nav) y `seed=D1165` sólo como metadato de ruta (`"q":"?seed=D1165"`) | **falso FAIL + defecto de instanciación del caso**: el href es *por vecino*, y el caso se instanció con el **propio seed**, el único id que jamás será vecino de sí mismo. Ver hallazgo H-125-05-A |

Las 4 páginas `not-found.tsx` comparten causa: Next sirve la sub-superficie 404 **entera** por el
stream RSC (`grep -o '<a ' → 0`), así que ningún assert basado en el atributo `href="…"` del markup
puede verse satisfecho ahí. **No se tocó el runner** (regla LOCKED): se declara.

### §1.4 Hallazgos declarados (no se arreglan en este plan)

- **H-125-05-A — `4.9-A1` mal instanciado.** El caso pide que `/red?seed=D1165` emita
  `href="/red?seed=D1165"`, pero ese href se genera por **vecino** del grafo; con el seed como
  sujeto la aserción es insatisfacible por construcción. Corregir el caso implica **modificar el
  manifiesto**, prohibido por el plan ("se declara como hallazgo; ampliarlo sería trabajo de otra
  fase"). Además `/red` es isla cliente: cualquier verificación real es de DOM (Plan 06).
- **H-125-05-B — el assert de emisión CR-02 carece de rama para rutas 100 % RSC.**
  WARN-STREAM cubre el shell con fallbacks de Suspense; no cubre la página servida sin un solo
  `<a>` (las 4 `not-found.tsx`). Trabajo de runner, fuera de alcance aquí.
- **Sincronía del manifiesto:** no se detectó desincronización. 95 ids idénticos a 114, y la
  cobertura del universo que 114 cerró (73 refs en MANIFIESTO + 4 en EXCLUIDOS = 77 =
  `|REFS_INVENTARIO|`) sigue siendo el denominador vigente.

### §1.5 Canario de 124 — cotas de cardinalidad de `0079`

Las 5 migraciones de 124 no debían mover ninguna superficie visible. Contra las cifras del
runbook (§3.2/§3.3), medidas con `grep -o … | wc -l`:

| marcador | runbook (POST-deploy) | esta corrida | veredicto |
|---|---:|---:|:---:|
| `href="/proyecto/` en `/parlamentario/D1165` | 23 | **23** | ✓ idéntico |
| `<section id="…">` del rail (`votos`, `lobby`, `patrimonio`, `cruces`) | 1 cada una | **1 cada una** | ✓ idéntico |
| `según fuente al ` en `/proyecto/14309-04` | 32 | **32** | ✓ idéntico |
| `3,8` en `/proyecto/14309-04` | 2 | **2** | ✓ idéntico |
| `Actualizado` en `/proyecto/14309-04` | 0 | **0** | ✓ idéntico |

**Cero conteos movidos ⇒ el canario de `0079` (cotas de cardinalidad) NO se dispara**, y tampoco
el timeout de 5 s de `0077` (ninguna sección degradó a vacío).

**Delta atribuido, no despachado:** el tamaño total de `/proyecto/14309-04` es **1.282.007 B** hoy
frente a los **1.242.030 B** citados en el runbook §3.2 (+39.977, +3,2 %). Atribución: esa cifra
del runbook es la de la captura **PRE-deploy** (la nota de método la usa para explicar por qué
`grep -c` es inservible), y el bundle nuevo **añade** justamente el copy de 117 (32 badges
`según fuente al `) y el de 122 (línea de cobertura), lo que explica un crecimiento de ese orden.
Control de variabilidad por request: tres capturas consecutivas de la misma URL dieron
`1282007 / 1282050 / 1282007` bytes (±43 B, por cadenas de tiempo y framing de streaming) con
`Hito del` = **170** y `según fuente al ` = **32** en las tres ⇒ la variabilidad por request es de
decenas de bytes, no de decenas de KB. Como **todos** los conteos acotados son idénticos, el delta
no toca ninguna superficie contada y no es discriminante en ningún sentido.

---

## §2 Links externos — muestra estratificada, robots primero, mesura instrumentada

### §2.1 Orden robots-primero, demostrado por mtime

```bash
# 1) SIEMPRE primero
node scripts/probar-links-externos.mjs --robots \
  --out .planning/phases/125-e2e-pasada-final-producto-a-producto/125-ROBOTS-RUN
# 2) DESPUÉS la muestra
node scripts/probar-links-externos.mjs \
  --out .planning/phases/125-e2e-pasada-final-producto-a-producto/125-MUESTRA-EXT
```

| artefacto | mtime |
|---|---|
| `125-ROBOTS-RUN.json` / `.txt` | `2026-07-29 17:41:20.342 -0400` |
| `125-MUESTRA-EXT.json` / `.txt` | `2026-07-29 17:42:57.861 -0400` |

**ROBOTS-RUN precede a MUESTRA-EXT por 97 s** ✓. La corrida de robots: 6 requests en
`1785361264 → 1785361280` (**16 s** ⇒ 2,67 s/request), exit 0.

### §2.2 Directivas de hoy vs las congeladas en `115-ROBOTS.txt` — cero cambios adversos

| host | robots hoy | directivas | vs 115 | ¿algún `Disallow` cubre un caso? |
|---|---|---|---|:---:|
| `opendata.camara.cl` | 200 `text/html` | sin robots.txt publicado (devuelve la portada HTML) | idéntico | **no** |
| `tramitacion.senado.cl` | 206 `text/html` | sin robots.txt publicado (redirección genérica) | idéntico | **no** |
| `www.senado.cl` | 206 `text/plain` | `User-agent: *` / `Allow: /` / `Disallow: /proyecto-365` | **byte-idéntico** a 115 (§4 líneas 181-183) | **no** (el caso es `/appsenado/index.php`) |
| `web-back.senado.cl` | 206 `text/plain` | robots de Drupal (`/core/`, `/profiles/`, `/admin/`, …) | idéntico | **no** (los casos son `/api/…`) |
| `www.leylobby.gob.cl` | **403** | WAF-en-robots (Apache 2.4.67) — sin directivas publicadas | idéntico a 115 (403) | **no hay directiva** |
| `datos.cplt.cl` | **403** | WAF-en-robots (Azure App Gateway) — sin directivas publicadas | idéntico a 115 (403) | **no hay directiva** |

**Ningún caso se retiró por directiva nueva**, porque no hubo directiva nueva. `www.camara.cl`
—séptimo host de la corrida de 115— **ya no aparece**: 115 lo retiró del manifiesto por su grupo
final `User-agent: *` / `Disallow: /`, y el retiro está **codificado** (`probar-links-externos.mjs`
:129-134), no confiado a un comentario. Su ausencia aquí es el retiro funcionando, no un olvido.

**Los dos 403 en robots.txt se declaran, no se evaden.** El servidor niega el propio archivo de
exclusión: no hay directiva que respetar ni que burlar (RFC 9309 §2.3.1.3 trata 4xx como
*unavailable* ⇒ sin restricciones). Se mantuvo el criterio ya fijado por 115: los 3 casos de esos
dos hosts se intentan con **el mismo User-Agent y el mismo delay**, sin proxies, sin headers de
navegador, sin rotación de identidad.

### §2.3 Prueba de mesura — con los dos sellos verbatim y la aritmética escrita

Los dos sellos, pegados tal como los emitió `date -u +%s` en el mismo shell que lanzó el runner:

```
MUESTRA_INICIO_UNIX=1785361322  (2026-07-29T21:42:02Z)
MUESTRA_FIN_UNIX=1785361377  (2026-07-29T21:42:57Z)
DURACION_S=55
```

Aritmética:

```
(fin − inicio) / nº requests = (1785361377 − 1785361322) / 19
                             = 55 s / 19 requests
                             = 2,89 s por request      ≥ 2 s ✓
```

Corroboración interna independiente (el propio runner sella cada caso): los `ts_inicio`/`ts_fin`
extremos del `.json` dan `21:42:02.431Z → 21:42:57.861Z`, y el campo `delta_ms_mismo_host` de las
14 filas que tienen predecesor en su host arroja
`2509, 2513, 2513, 2514, 2512, 2508, 2509, 2509, 2510, 2501, 2501, 2514, 2501` ms — **mínimo
2501 ms**, ninguno por debajo de la banda 2-3 s de CLAUDE.md. **0 reintentos** en toda la corrida.
Un cociente < 2 s/request delataría ráfaga; 2,89 s con mínimo instantáneo de 2,50 s no la admite.

Régimen efectivo registrado en `meta`: `delay_ms: 2500`, secuencial (`concurrencia` inexistente en
el archivo), `user_agent: "ObservatorioCongreso360/1.0 (+https://observatorio-congreso.thevalis.workers.dev; contacto: https://github.com/Cuchecorp/gov-map/issues)"`,
GET con `--range 0-8191` vía `curl` (`execFile`, array de argumentos, sin shell).

### §2.4 La muestra caso × resultado (19 casos, 18 patrones, 6 hosts)

Cobertura ≥ 1 caso por **patrón × host**, exactamente el manifiesto cerrado de `115-PATRONES.md`
§4 — sin ampliar, sin filtrar, sin crawl.

| caso | patrón | host | 115 (28 jul) | **125 (29 jul)** | clasificación |
|---|---|---|:---:|:---:|---|
| `P-01-c01` | P-01 tramitación Senado | tramitacion.senado.cl | 206 OK | **206 OK** | sin cambio |
| `P-03-c01` | P-03 enlaceHumanoProyecto | tramitacion.senado.cl | 206 OK | **206 OK** | sin cambio |
| `P-03-c02` | P-03 rama-verbatim | opendata.camara.cl | 500 PATRON-MALO | **500 NO-DISPONIBLE** | **patrón malo** (ya registrado, A-3 de 115) |
| `P-07-c01` | P-07 citaciones API | web-back.senado.cl | 200 OK | **200 OK** | sin cambio |
| `P-11-c01` | P-11 `declaracion*.enlace` | datos.cplt.cl | 400 PATRON-MALO | **400 NO-DISPONIBLE** | **patrón malo** (A-5: SPARQL mal formada) |
| `P-13-c01` | P-13 audiencia lobby | www.leylobby.gob.cl | 200 OK | **200 OK** | sin cambio |
| `P-14-c01` | P-14 audiencia detalle | www.leylobby.gob.cl | 200 OK | **200 OK** | sin cambio |
| `P-15-c01` | P-15 `parlamentario.enlace` | opendata.camara.cl | 200 XML-CRUDO | **200 XML-CRUDO** | sin cambio |
| `P-16-c01` | P-16 senadores vigentes | tramitacion.senado.cl | 206 XML-CRUDO | **206 XML-CRUDO** | sin cambio |
| `P-17-c01` | P-17 tramitación | tramitacion.senado.cl | 206 OK | **206 OK** | sin cambio |
| `P-18-c01` | P-18 `proyecto.enlace` verbatim | opendata.camara.cl | 500 PATRON-MALO | **500 NO-DISPONIBLE** | **patrón malo** (A-3) |
| `P-19-c01` | P-19 tramitación | tramitacion.senado.cl | 206 OK | **206 OK** | sin cambio |
| `P-20-c01` | P-20 tabla semanal API | web-back.senado.cl | 200 OK | **200 OK** | sin cambio |
| `P-22-c01` | P-22 `tramitacion_evento.enlace` | www.senado.cl | 200 REDIR-GENERICA | **520 NO-DISPONIBLE** | **fuente caída — declarada** ⇩ |
| `P-23-c01` | P-23 `tramitacion_evento.enlace` | opendata.camara.cl | 500 PATRON-MALO | **500 NO-DISPONIBLE** | **patrón malo** (A-3) |
| `P-24-c01` | P-24 votaciones XML | tramitacion.senado.cl | 206 XML-CRUDO | **206 XML-CRUDO** | sin cambio |
| `P-25-c01` | P-25 `votacion.enlace` verbatim | opendata.camara.cl | 500 PATRON-MALO | **500 NO-DISPONIBLE** | **patrón malo** (A-3) |
| `P-26-c01` | P-26 tramitación | tramitacion.senado.cl | 206 OK | **206 OK** | sin cambio |
| `P-27-c01` | P-27 tramitación XML | tramitacion.senado.cl | 206 XML-CRUDO | **206 XML-CRUDO** | sin cambio |

**Diferencia de código HTTP vs 115: exactamente 1 caso.**

> **`P-22-c01` — fuente caída, declarada, no evadida.**
> URL: `http://www.senado.cl/appsenado/index.php?mo=tramitacion&ac=getDocto&iddocto=11240&tipodoc=ofic`
> **HTTP 520**, cuerpo verbatim `error code: 520`, fecha **2026-07-29T21:42Z**. El 520 es el código
> de Cloudflare para "el origen devolvió una respuesta desconocida": el fallo está del lado del
> servidor del Senado, no en la URL que construimos. En 115 (28 jul) el mismo caso daba **200**
> tras 2 redirects, con `iddocto=11240` conservado y `content_type: application/msword` — es decir,
> el patrón P-22 **es correcto** y estaba probado. **No se reintentó** (la política del runner es
> un reintento sólo ante fallo de red; 5xx no se reintenta) y **no se cambió nada** para forzar un
> 200. Clasificación: **fuente caída / WAF**, no patrón malo.

Los 5 `patrón malo` (`P-03-c02`, `P-11-c01`, `P-18-c01`, `P-23-c01`, `P-25-c01`) **no son nuevos**:
son los hallazgos **A-3** (URL almacenada apunta al web service sin el parámetro `prmBoletin` ⇒
`Falta el parámetro: prmBoletin`; afecta 1 fila de `proyecto`, 3.797 de `tramitacion_evento`,
3.806 de `votacion`) y **A-5** (`datos.cplt.cl`: consulta SPARQL mal formada ⇒ `Virtuoso 37000
Error SP030`) ya levantados y dispuestos por `115-VEREDICTO.md`. Mismo código, mismo cuerpo,
misma causa: **cero deriva**, y su fix sigue siendo trabajo de fase de datos, no de este plan.

---

## §3 Fechas visibles — los greps de régimen sobre el HTML SERVIDO

117 §3 corrió sus greps sobre el **código**. Aquí corren sobre el **HTML que sirve el deploy**, que
es justo lo que 117 declaró como su LÍMITE 2 (*"la verificación end-to-end sobre HTML renderizado
la hace 125"*).

### §3.1 Cobertura declarada — 20 URLs para las 19 filas de la Tabla D

Lista explícita (no "todas"). Secuencial, 1 s entre requests, UA identificatorio, una descarga por
ruta. Las 15 rutas del universo LOCKED + las 4 sub-superficies `not-found.tsx`; dos rutas se
instanciaron con **dos** sujetos deterministas cada una, y `/buscar` con y sin `q` (la rama con
resultados es la que emite fechas):

| # | fila de Tabla D | URL barrida | HTTP |
|---|---|---|---:|
| 1 | `/parlamentario/[id]` (D) | `/parlamentario/D1165` | 200 |
| 2 | `/parlamentario/[id]` (S) | `/parlamentario/S1338` | 200 |
| 3 | `/proyecto/[boletin]` (bicameral) | `/proyecto/14309-04` | 200 |
| 4 | `/proyecto/[boletin]` (solo-Senado) | `/proyecto/17870-05` | 200 |
| 5 | `/` | `/` | 200 |
| 6 | `/agenda` | `/agenda` | 200 |
| 7 | `/buscar` (sin q) | `/buscar` | 200 |
| 8 | `/buscar` (con q) | `/buscar?q=pension` | 200 |
| 9 | `/comparar` | `/comparar?a=D1165&b=S1338` | 200 |
| 10 | `/parlamentarios` | `/parlamentarios` | 200 |
| 11 | `/red` | `/red?seed=D1165` | 200 |
| 12 | `/metodologia` | `/metodologia` | 200 |
| 13 | `/sobre` | `/sobre` | 200 |
| 14 | `/cuenta` | `/cuenta` | 200 |
| 15 | `/notificaciones/baja` | `/notificaciones/baja` | 200 |
| 16 | `/notificaciones/confirmar` | `/notificaciones/confirmar?token=x` | 200 |
| 17 | `parlamentario/[id]/not-found.tsx` | `/parlamentario/D0000000` | 404 |
| 18 | `proyecto/[boletin]/not-found.tsx` | `/proyecto/00000-00` | 404 |
| 19 | `contraparte/[id]/not-found.tsx` + fila `/contraparte/[id]` | `/contraparte/c:sujeto-inexistente` | 404 |
| 20 | `red/not-found.tsx` | `/red?seed=D0000000` | 404 |

**No barrida:** `/admin/revisar-entidades` — fila `n/a — EXCLUIDA` de la Tabla D por decisión LOCKED
del CONTEXT §4.15 de 113. Se declara la exclusión; no se interrogó.
**Ningún token se inventó** para las rutas de notificaciones (`token=x` es el placeholder ya usado
por el manifiesto de 114, con NOTIF OFF).

### §3.2 Los 5 greps de régimen, por ruta

Método `grep -o … | wc -l` en todas las celdas. Sin `-E '…{0,9000}'` sobre el HTML de una línea
(backtracking catastrófico, gotcha de 125-01).

| # | ruta | `Actualizado hace` | `corte al` | `según fuente al ` | `recalculado por el Observatorio al ` | `captura` pelado |
|---|---|---:|---:|---:|---:|---:|
| 1 | `/parlamentario/D1165` | **0** | **0** | **14** | **180** | **0** |
| 2 | `/parlamentario/S1338` | **0** | **0** | **20** | 0 | **0** |
| 3 | `/proyecto/14309-04` | **0** | **0** | **32** | **288** | **0** |
| 4 | `/proyecto/17870-05` | **0** | **0** | **527** | 0 | **0** |
| 5 | `/` | **0** | **0** | 0 † | 0 | **0** |
| 6 | `/agenda` | **0** | **0** | 0 † | 0 | **0** |
| 7 | `/buscar` | **0** | **0** | 0 ‡ | 0 | **0** |
| 8 | `/buscar?q=pension` | **0** | **0** | **20** | 0 | **0** |
| 9 | `/comparar?a=D1165&b=S1338` | **0** | **0** | **2** | 0 | **0** |
| 10 | `/parlamentarios` | **0** | **0** | 0 † | 0 | **0** |
| 11 | `/red?seed=D1165` | **0** | **0** | 0 † | 0 | **0** |
| 12 | `/metodologia` | **0** | **0** | 0 ‡ | 0 | **0** |
| 13 | `/sobre` | **0** | **0** | 0 ‡ | 0 | **0** |
| 14 | `/cuenta` | **0** | **0** | 0 ‡ | 0 | **0** |
| 15 | `/notificaciones/baja` | **0** | **0** | 0 ‡ | 0 | **0** |
| 16 | `/notificaciones/confirmar?token=x` | **0** | **0** | 0 ‡ | 0 | **0** |
| 17 | `/parlamentario/D0000000` (404) | **0** | **0** | 0 ‡ | 0 | **0** |
| 18 | `/proyecto/00000-00` (404) | **0** | **0** | 0 ‡ | 0 | **0** |
| 19 | `/contraparte/c:sujeto-inexistente` (404) | **0** | **0** | 0 ‡ | 0 | **0** |
| 20 | `/red?seed=D0000000` (404) | **0** | **0** | 0 ‡ | 0 | **0** |

- **`Actualizado hace` = 0 en 20/20** ✓ — y se repite la advertencia de 125-01: **es un control
  inerte**, ya daba 0 antes del deploy (el build viejo rendía `Actualizado <fecha absoluta>`). El
  discriminante real es el par `Actualizado` 318→0 / `según fuente al ` 0→32, re-medido en §1.5.
- **`corte al` = 0 en 20/20** ✓ (F-08; el copy MONEY quedó corregido antes del flip, y MONEY sigue OFF).
- **`recalculado por el Observatorio al ` presente donde F-02 lo puso** ✓: cruces de parlamentario
  (`/parlamentario/D1165`, 180) y cruces de proyecto (`/proyecto/14309-04`, 288). Ausente donde no
  hay cruces (`S1338` y `17870-05` no tienen filas de cruce) — omisión honesta, no falta de idiom.

**‡ = ruta sin dato fechado** (copy estático, formularios, superficies 404, `/buscar` sin `q` ⇒ sin
resultados). 0 es el valor correcto: el criterio del plan pide ≥1 *"en toda ruta con dato fechado"*.

**† = dato fechado DIFERIDO, no ausente — LÍMITE declarado.** Estas 4 rutas sirven un **shell** y su
contenido fechado no está en los bytes. Medido, no supuesto:

| ruta | `hidden id="S:` (Suspense sin resolver) | evidencia de dato fechado en el payload | disposición |
|---|---:|---|---|
| `/` | **6** | **16 × `datos al `** (tiles del panel, F-14) ✓; la franja F-06 (`Última consulta a las fuentes`) = 0 ⇒ va en un boundary sin resolver | idiom presente, el otro **diferido** |
| `/agenda` | **3** | 0 idioms fechados en los bytes | **diferido** → DOM (Plan 06) |
| `/parlamentarios` | **1** | 0 idioms, pero **186 × `fecha_captura`** en el payload RSC ⇒ el dato viaja, el render no | **diferido** → DOM (Plan 06) |
| `/red?seed=D1165` | 0 | 0 idioms; `red-graph.tsx` es `"use client"` ⇒ toda fecha se rinde en hidratación | **isla cliente** → DOM (Plan 06) |

Se declara el límite en vez de contar el 0 como aprobado o como defecto.

### §3.3 `captura` pelado — cero copy renderizado, con el criterio de separación escrito

`grep -o -iE '(^|[^a-záéíóúñ_])captura([^a-záéíóúñ]|$)' | wc -l` → **0 en las 20 URLs**.

**Criterio de separación usado (explícito):** la clase de carácter previa excluye `_`, de modo que
el identificador serializado `fecha_captura` **no** cuenta como ocurrencia; y para no depender sólo
de eso, se re-corrió cada página normalizando primero `fecha_captura`/`fechaCaptura` → `FKID`
(`sed`) y luego aplicando el mismo grep: **0 en las 20**, idéntico. Es decir, el 0 no se obtiene
por escondido del identificador: **no existe ninguna ocurrencia de la palabra suelta**.

Los identificadores sí están, y se declaran uno a uno como payload RSC (nunca copy):
`fecha_captura` aparece **186 veces en `/parlamentarios`** (nombre de columna serializado en el
payload de la lista) y **0 veces en las otras 19 URLs**. Ninguna de esas 186 es texto visible:
todas viven dentro de `<script>`/payload como clave de objeto.

### §3.4 Las 3 fechas muestreadas, verbatim, cada una con su fila F-NN

**(a) Date-only disfrazada de `timestamptz` → `fechaCivilCorta` — fila F-14**

```
"children":["Fuente: ","Tramitación",[" · datos al ","22 jul 2026"]]
```
Ruta `/` (`app/components/panel-actualidad.tsx:104`). F-14 sustituyó `diaCalendarioCitacion(iso)`
—que rendía el ISO crudo `datos al 2026-08-10`— por `fechaCivilCorta(iso)`, **con año**. El helper
**no convierte zona**: la parte fecha UTC **es** el día chileno publicado, gotcha rector de la
pasada 1. Se rinde `22 jul 2026`, no `21 jul 2026`.
*Sustitución declarada:* el plan sugería una citación de `/agenda`; `/agenda` sirve shell (§3.2 †),
así que se muestreó otro call-site del **mismo helper y la misma clase de dato** en una ruta que sí
lo sirve. El call-site de citación (`estado-actual-block.tsx:544` `Citado el …`, F-09) no aparece
en el DOM de ninguno de los 2 boletines muestreados porque ninguno tiene filas de citación/tabla de
sala — omisión honesta del componente, verificable sólo con un boletín que las tenga.

**(b) Fecha de HECHO → `fechaHechoCorta` — filas F-05 y F-07**

```
"children":["Hito del ",["$","span",null,{"className":"font-mono","children":"15 jun 2021"}]]
```
Ruta `/proyecto/14309-04`, timeline. El `key` del `<li>` expone el dato crudo:
`"C.Diputados-2021-06-15T00:00:00+00:00-tramite-1"`. F-07 fijó el copy (`Hito del <fecha>`, en vez
de la fecha pegada sin calificador) y F-05 el helper (`fechaHechoCorta`, que para una date-only
disfrazada **conserva su parte UTC** ⇒ `15 jun 2021`, no `14 jun 2021`). Hermano de la misma
familia, también verbatim: `Votada el` + `"08 sept 2021"` (`fechaHechoCortaSegura`, F-07).
Corroboración de F-13 en la misma página: `Urgencia Suma vigente desde el` + `07 jul 2026`, **sin
tiempo relativo** (`relativeTimeEs` eliminado del bloque).

**(c) Fecha de CAPTURA → idiom LOCKED `según fuente al ` — fila F-01**

```
según fuente al <!-- -->09 jul 2026</span>
```
y con el calificador de agregación de **F-03** en el badge de "Tramitación":
```
"children":["según fuente al ","09 jul 2026"," (evento más reciente)"]
```
cuyo tooltip lleva el instante crudo `2026-07-09T04:37:00.302Z` (04:37 Z ⇒ `09 jul 2026` con
`timeZone: "UTC"`, F-10). El `<!-- -->` intercalado por React entre texto y dígitos es exactamente
el gotcha que 125-01 documentó; los greps de este barrido son tolerantes a él por construcción
(literal + `-o`). Bonus F-02, verbatim: `recalculado por el Observatorio al <!-- -->29 jul 2026`
— el rebuild se nombra rebuild, no se disfraza de captura de fuente.

**Cero fechas de captura presentadas como el hecho. Cero `fecha_captura` en copy.**

---

## §4 Cierre

| criterio del plan | resultado |
|---|---|
| Paso 0: uuid del runbook leído y marcador `3,8` confirmado antes de correr | ✓ §0 — `0ea5d97f…`, `3,8` = 2 |
| `125-LINKS-INT.json`/`.txt` cubren el manifiesto completo (≥ 114) | ✓ **95 = 95**, ids idénticos |
| **0** links internos con 404 | ✓ §1.2 |
| **0** anclas ausentes del DOM destino | ✓ 24/24 anclas PASS |
| toda diferencia vs 114 clasificada (mejora / regresión / método) | ✓ §1.3 — 1 mejora, **0 regresiones**, 22 de método |
| `125-ROBOTS-RUN` **antes** de `125-MUESTRA-EXT` (mtime) | ✓ §2.1 — 97 s de separación |
| muestra ≥ 1 caso por patrón × host, igual a 115 §4 | ✓ §2.4 — 19 casos, 18 patrones, 6 hosts |
| los dos sellos `date -u +%s` verbatim | ✓ §2.3 — `1785361322` / `1785361377` |
| ≥ 2 s por request con la aritmética escrita | ✓ **2,89 s/request**; mínimo instantáneo 2.501 ms |
| cada diferencia vs 115 clasificada con código y fecha | ✓ 1 diferencia: `P-22-c01` 520, 2026-07-29T21:42Z, **fuente caída** |
| `git diff --name-only -- scripts/` vacío | ✓ los runners se corrieron, no se reescribieron |
| fechas: `Actualizado hace` = 0 y `corte al` = 0 por ruta | ✓ §3.2 — 0 en 20/20 |
| `según fuente al ` ≥ 1 en toda ruta con dato fechado servido | ✓ 6/6 (14, 20, 32, 527, 20, 2); 4 rutas con dato **diferido** declaradas |
| `captura` pelado justificado / ausente | ✓ **0 ocurrencias**; criterio de separación escrito (§3.3) |
| 3 fechas muestreadas con su fila F-NN | ✓ §3.4 — F-14, F-05/F-07, F-01 (+F-02, F-03, F-10, F-13) |
| canario de 124 (cotas de `0079`) | ✓ §1.5 — 5/5 conteos idénticos al runbook; delta de bytes atribuido |

**SC3 verificado post-deploy. La mitad de fechas de SC4, verificada sobre el DOM servido, con sus
4 límites de streaming declarados** (cierre en el Plan 06, que es el dueño de BrowserOS).
