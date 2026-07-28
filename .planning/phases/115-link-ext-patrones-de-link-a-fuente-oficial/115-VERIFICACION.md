---
phase: 115
plan: 03
estado: cerrado
---

# 115 — Verificación de cierre (LINK-EXT)

Insumos: `115-VEREDICTO.md` (§2 tabla, §4 lista cerrada A-1…A-6, §5 deploy diferido),
`115-MUESTRA.json` / `115-MUESTRA.txt` (bloque **ANTES**, corrida del 2026-07-28),
re-probe acotado del 2026-07-28 (bloque **DESPUÉS**), y la suite del repo.

Regla que gobierna este documento: **lo que no se observó contra el deploy real no cierra
como PASS pelado** (precedente LOCKED de 114-03). Los fixes viajan a la **Phase 125**.

## 1. Qué se corrigió

| hallazgo | archivo:línea | ANTES | DESPUÉS | test que lo respalda | commit |
|----------|---------------|-------|---------|----------------------|--------|
| **A-1** — `/buscar` pasaba `proyecto.enlace` crudo al badge (patrón `P-27`, 3.658 filas) | `app/components/buscar-filtros.tsx:493` | `sourceUrl: row.enlace ?? null` → el badge enlazaba a `https://tramitacion.senado.cl/wspublico/tramitacion.php` (registro `P-27-c01`: HTTP 206, `application/xml`, cuerpo `<proyectos></proyectos>` — XML **vacío**) | `sourceUrl: row.enlace ? enlaceHumanoProyecto(row.enlace, row.boletin) : null` → `https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=<boletín>` | `components/buscar-filtros.test.tsx` §10 — rewrite, rama verbatim (`opendata.camara.cl`) y borde `enlace` null/vacío | `66fb1f0` |
| **A-2 (rewrite)** — el evento del timeline enlazaba al WS XML (patrón `P-24`, 982 filas) | `app/components/timeline-event.tsx:42` | `href={evento.enlace}` → `https://tramitacion.senado.cl/wspublico/votaciones.php` (registro `P-24-c01`: HTTP 206, `application/xml`, cuerpo `<votaciones> </votaciones>`) | `href` = `safeExternalHref(enlaceHumanoProyecto(evento.enlace, evento.boletin))` → ficha humana del boletín **del evento** | `components/timeline-view.test.tsx` — ramas `:243` y `:252` renderizadas **desde `TimelineView`** | `66fb1f0` |
| **A-2 (guard)** — último emisor externo del sitio sin `safeExternalHref` | `app/components/timeline-event.tsx:42` | `<a href={evento.enlace}>` sin guard; un esquema no-web de la fuente llegaba al DOM | si el guard devuelve `null`, **no se emite el `<a>`**; el evento sigue visible (se pierde el enlace, jamás el hecho) | `timeline-view.test.tsx` — caso `javascript:` (T-115-10) | `66fb1f0` |
| **Intermediario** — los **dos** call-sites del componente | `app/components/timeline-view.tsx:243` y `:252` | ambas ramas emitían el `enlace` crudo a través del hijo | **sin cambios de código**: el boletín viaja DENTRO de la fila (`TramitacionEventoRow.boletin` es `string` no-nulable, `app/lib/types.ts:32-33`, 0 nulos en PROD) → el fix en el hijo cubre las dos ramas | un test por rama; mutación de `:252` (`evento={{...e, enlace: null}}`) tumba 2 tests → la rama NO es vacua | `66fb1f0` |
| **Origen de la cadena** | `app/app/proyecto/[boletin]/page.tsx:525` | `<TimelineView eventos boletin urgenciaExpandida />` | **no-op verificado**: ya recibía `boletin`; NO se tocó el JSX (el test `page.test.tsx:285-332` sigue verde) | `app/proyecto/[boletin]/page.test.tsx` (13 tests) | — |
| **Linter ANTES del copy** | `app/lib/anti-insinuacion-guard.test.ts` | el carril LINK-EXT no existía; `timeline-event.tsx` / `timeline-view.tsx` fuera de todo escaneo | `SUPERFICIES_LINK_EXT` (4 archivos) + vocabulario de intención-de-la-fuente + mutation self-check | 37 tests, 0 offenders sobre el árbol real | `801d319` |

**Alcance = §4, sin acciones huérfanas y sin fixes de más.** Cada archivo modificado
corresponde a una acción de `115-VEREDICTO.md` §4; ningún archivo fuera de esa lista se
tocó. `A-6` (los 8 patrones de `www.camara.cl` retirados por robots) exigía explícitamente
**ninguna acción de código y cero requests a ese host**: se cumplió — el re-probe de §4 no
contiene una sola URL de `www.camara.cl`.

## 2. Qué se declaró

### 2.1 `FUENTE-CAIDA-WAF` — cero casos que declarar

`115-VEREDICTO.md` §1 y §2 registran **0** patrones con esa etiqueta, y la ausencia está
declarada con su evidencia: los dos hosts que negaron su `/robots.txt` con 403
(`www.leylobby.gob.cl`, `datos.cplt.cl`) **sí respondieron** las URLs de caso, y los cuatro
500 de `opendata.camara.cl` traen cuerpo `Falta el parámetro: prmBoletin` — respuestas
deliberadas del web service, es decir defecto de **nuestra** URL. No hay leyenda de fuente
caída que redactar, y este plan **no** inventó una: las leyendas escritas son de **recurso
no-humano**, que es cosa distinta.

### 2.2 `OK-POR-CONSTRUCCION` (9 filas) — declaración sin probe

| caso | declaración | evidencia | ¿toca UI? |
|------|-------------|-----------|-----------|
| `P-04` (`partidoLegible`) | no emite `href`: extrae el slug y devuelve el nombre | invariante CERO URI en el DOM (`115-VEREDICTO.md` §2) | no — no hay enlace que declarar |
| `P-02`, `P-05`, `P-06`, `P-08`, `P-09`, `P-10`, `P-12`, `P-21` (`www.camara.cl`) | validados **sólo por construcción**; no se solicitaron | `Disallow: /` verbatim en `115-ROBOTS.txt` §1 | no — el patrón está bien construido; su no-probe es respeto al protocolo de exclusión, no una avería |

### 2.3 Recurso no-humano sin URL humana derivable (A-3 / A-4 / A-5) — **declarado en la UI**

Leyenda LOCKED, single-source en `app/components/provenance-badge.tsx`:

> «La fuente oficial publica este dato como servicio de datos, no como página de consulta.»

Describe el **formato** en que la fuente publica el dato; jamás su intención. El carril
LINK-EXT del linter caza `oculta` / `esconde` / `no quiere` / `se niega a` /
`bloquea a propósito` / `censura`, y un test monta la leyenda verbatim exigiendo `[]`
offenders — por eso NO requiere entrada en `NEGACIONES_LOCKED`.

| acción | destinos que la disparan (`esServicioDeDatos`, host+path) | evidencia (`115-MUESTRA.json`) | dónde lo ve el ciudadano |
|--------|----------------------------------------------------------|-------------------------------|--------------------------|
| **A-3** | `opendata.camara.cl` (web services `.asmx`) | `P-03-c02`, `P-18-c01`, `P-23-c01`, `P-25-c01` → HTTP 500, cuerpo `Falta el parámetro: prmBoletin` | bajo el badge de procedencia, junto al enlace, que **se conserva** |
| **A-4** | `web-back.senado.cl/api/*` · `tramitacion.senado.cl/wspublico/*` | `P-07-c01` y `P-20-c01` → 200 `application/json`; `P-15-c01` → 200 `text/xml`; `P-16-c01` → 206 `application/xml` | ídem |
| **A-5** | `datos.cplt.cl/sparql` | `P-11-c01` → HTTP 400, `Virtuoso 37000 Error SP030: SPARQL compiler, line 1: syntax error at 'alessandri' before 'vergara'` | ídem |

**A-5, además:** el defecto de origen vive en la **ingesta** que persiste ese `enlace`
(9.441 filas sobre 7 tablas `declaracion*`), no en la UI. Queda registrado con conteo y
evidencia en `deferred-items.md` de esta fase — **cero cambio de conector aquí**, cero dato
personal en el registro.

Por qué NO se fabricó una URL humana: el destino humano de la Cámara es
`buildCamaraUrl(boletin, prmId)` y exige `prm_id_camara`, dato que **no acompaña** a
`tramitacion_evento` ni a `votacion`; `?limit=100` es paginación, no identidad. Inventar un
enlace que aterrice en una portada sería peor que declarar la limitación.

## Veredicto por success criterion

*(§3 del documento — header exacto exigido por el plan.)*

Los 4 criterios de `.planning/ROADMAP.md` §Phase 115, transcritos **verbatim**.

**SC1 — «Cada patrón de URL externa que el sitio construye está enumerado con su fuente, su
plantilla y el dato que lo parametriza (boletín, prmID, idNorma, id de audiencia), y probado
por construcción con casos reales»**

**PASS.** `115-PATRONES.md` §1 enumera 27 patrones (4 builders + familias URL-desde-columna
de 8 hosts descubiertos por `information_schema`), cada uno con host, plantilla, parámetro y
caso real elegido con query verbatim de PROD; §2 lista las exclusiones con su razón.
`115-VEREDICTO.md` §2 cierra 28 filas (`P-03` aporta dos) con **cero** patrones sin
veredicto; la cobertura 1:1 se verificó con `comm -23` → salida vacía.

**SC2 — «Existe una muestra live estratificada —al menos un caso por patrón y por host— con
su respuesta registrada, respetando rate-limit 2-3s/host, User-Agent identificatorio y
robots.txt; cero ráfagas»**

**PASS.** `115-MUESTRA.json` / `.txt`: 19 registros / 6 hosts, en **una sola pasada**,
`CASOS_EJECUTADOS 19/19`, `HOSTS_CUBIERTOS 6/6`, `PATRONES_CUBIERTOS 18/18` probables.
Delta mínimo intra-host **calculado** desde los `ts_inicio`: **2.589 ms** (≥ 2.000).
`USER_AGENT` identificatorio con contacto; `robots.txt` de cada host consultado ANTES y
registrado en `115-ROBOTS.txt`; los 8 casos de `www.camara.cl` **retirados** por
`Disallow: /`. Reintentos: 0. El re-probe de este plan (§4) mantuvo el mismo runner, el
mismo UA y una separación de **9.447 ms** entre sus 2 requests.

**SC3 — «Todo patrón roto, o que apunta a una página genérica en vez del recurso específico,
quedó corregido — o su limitación quedó declarada honestamente en la UI»**

**PASS con limitación declarada.** Los 10 `PATRON-MALO` de §2 están cerrados: **A-1** y
**A-2** corregidos en código con tests que muerden (§1); **A-3**, **A-4** y **A-5**
declarados en la UI con la leyenda de recurso no-humano (§2.3), porque no existe URL humana
derivable con los datos en mano; **A-6** sin acción por diseño. La limitación que se declara
aquí es la del **deploy**: todo esto está verificado **en código y en test**, y **no
observado contra el deploy real** — el sitio sigue sirviendo el bundle anterior hasta la
Phase 125 (decisión LOCKED de v12.0, `115-VEREDICTO.md` §5, precedente 114-03).

**SC4 — «El resultado distingue "patrón malo" (defecto nuestro, se arregla) de "fuente caída
/ WAF" (se declara, jamás se evade)»**

**PASS.** La taxonomía CERRADA de `115-VEREDICTO.md` §1 separa las dos categorías con
criterio duro y con la regla LOCKED de que un WAF **no absuelve** a un patrón mal
construido. El resultado: `OK` 9 · `PATRON-MALO` 10 · `FUENTE-CAIDA-WAF` **0** · sin-probe
9. Ni un solo 403/429 se reintentó, no se cambió el User-Agent, no se usaron proxies. La
ausencia de `FUENTE-CAIDA-WAF` se **declara** con su evidencia (§2.1) en vez de dejarse como
silencio, y los cuatro 500 se imputaron a **nuestra** URL, no a la fuente.

## 4. Re-probe acotado — bloques ANTES / DESPUÉS

Sólo los casos afectados por los fixes, por `--id`, mismo `DELAY_MS` (2500) y mismo UA.
El re-probe prueba que la URL **RESULTANTE** del patrón corregido responde; **NO** prueba el
deploy (§5).

**ANTES** (`115-MUESTRA.json`, corrida 2026-07-28T04:06Z) — lo que recibía quien hacía clic:

```
P-27-c01  206  application/xml  https://tramitacion.senado.cl/wspublico/tramitacion.php   <proyectos></proyectos>
P-24-c01  206  application/xml  https://tramitacion.senado.cl/wspublico/votaciones.php    <votaciones> </votaciones>
```

**DESPUÉS** (re-probe 2026-07-28T04:24Z) — la URL que los patrones corregidos producen:

```
comando: MSYS_NO_PATHCONV=1 node scripts/probar-links-externos.mjs --id P-03-c01 --out "$TMPDIR/115-repost-a"
P-03-c01  ts=2026-07-28T04:24:10.665Z  206  text/html; charset=UTF-8  redirects=0
          https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=14309-04
          <input name="boletin_ini" id="boletin_ini" type="hidden" value="14309-04">

comando: MSYS_NO_PATHCONV=1 node scripts/probar-links-externos.mjs --id P-01-c01 --out "$TMPDIR/115-repost-b"
P-01-c01  ts=2026-07-28T04:24:20.112Z  206  text/html; charset=UTF-8  redirects=0
          https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=10986-24
          <input name="boletin_ini" id="boletin_ini" type="hidden" value="10986-24">
```

Lectura: **2 requests**, delta **9.447 ms** (≥ 2.500), 0 reintentos, 0 redirecciones, cero
requests a `www.camara.cl`. El snippet trae el `value="<boletín>"` instanciado por el
servidor: se llega al **recurso específico**, no a una lista genérica. Se re-probaron **dos**
boletines distintos (14309-04, el del candidato #1, y 10986-24) para que el resultado no
dependa de una fila afortunada. Los destinos de A-1 y A-2 convergen a esta misma plantilla
(`enlaceHumanoProyecto` → `buildSenadoUrl`), de modo que estos dos registros los cubren a
ambos sin pedirle al Senado un request por cada boletín.

### Reproducción

```bash
# muestra completa (NO re-correr sin necesidad: 19 requests)
MSYS_NO_PATHCONV=1 node scripts/probar-links-externos.mjs --out /tmp/115-MUESTRA
# un caso puntual
MSYS_NO_PATHCONV=1 node scripts/probar-links-externos.mjs --id P-03-c01 --out /tmp/115-uno
# suite y tipos
cd app && pnpm test
pnpm -r --filter "./packages/*" test
pnpm typecheck
# los 9 guards de régimen
cd app && pnpm vitest run lib/anti-insinuacion-guard.test.ts lib/lockdown-guard.test.ts \
  lib/vsim-antiflip-guard.test.ts lib/notif-antiflip-guard.test.ts lib/money-antiflip-guard.test.ts \
  lib/bento-guards.test.ts lib/bento-coherencia-guard.test.ts lib/env-example-guard.test.ts \
  lib/name-match-rut-guard.test.ts
```

## 5. Deuda que viaja a la Phase 125

Lista nominal de lo que la 125 debe **re-verificar contra el deploy real** (para que el E2E
final no lo redescubra):

1. **A-1 · `/buscar`** — el badge de un resultado del Senado enlaza a
   `…/appsenado/templates/tramitacion/index.php?boletin_ini=<boletín>` y **no** a
   `/wspublico/`. Casos de referencia: `P-27-c01` (ANTES) → `P-03-c01` (DESPUÉS).
2. **A-2 · timeline de la ficha** — "Ver fuente oficial ↗" de un evento lleva a la ficha
   humana, en las **dos** ramas (evento suelto y evento dentro de un período de urgencia
   expandido, `?urgencias=uN`). Casos de referencia: `P-24-c01` (ANTES) → `P-01-c01`/
   `P-03-c01` (DESPUÉS).
3. **A-2 (guard)** — ningún `<a>` del timeline con esquema no-web en el DOM servido.
4. **A-3/A-4/A-5** — la leyenda de recurso no-humano es **visible** bajo el badge cuando el
   destino es `opendata.camara.cl`, `web-back.senado.cl/api/*`, `/wspublico/*` o
   `datos.cplt.cl/sparql`, y **ausente** cuando el destino es una ficha humana.
5. **Re-verificación live de la muestra** — diferida por respeto al rate-limit: dentro de
   esta fase no se volvió a consultar a los servidores más allá de los 2 requests de §4.
6. **D-115-01** (`deferred-items.md`) — deuda de **ingesta** del `enlace` SPARQL de
   `declaracion*`: no es trabajo de la 125 sobre el deploy, pero debe seguir viva.

## 6. No-regresión

| gate | baseline | resultado |
|------|----------|-----------|
| `cd app && pnpm test` | 1431 | **1453** = 1431 + **22** tests nuevos de este plan (guard `+4`, `buscar-filtros` `+3`, `timeline-view` `+5`, `provenance-badge` `+10`); 107 archivos, 0 fallos |
| `pnpm -r --filter "./packages/*" test` | sin delta | **sin delta** — esta fase no toca `packages/`: identity 110 · agenda 113 · bio 70 · adjudication 89 (+1 skip) · tramitacion 171 · lobby 68 · probidad 46 · dinero 167 · fichas 159 (+1 skip) · votos 31 → todos verdes |
| `pnpm typecheck` (raíz, `tsc -b`) | exit 0 | **exit 0** — prueba que el tipo del `href` recorre toda la cadena |
| 9 guards de régimen (invocación única) | verdes | **272 tests, 9/9 verdes** (anti-insinuación 37 · lockdown 22 · vsim-antiflip 20 · notif-antiflip 20 · money-antiflip 20 · bento 114 · bento-coherencia 8 · env-example 16 · name-match-rut 15) |
| `git diff .env.example \| wc -l` | 0 | **0** — MONEY / NOTIF / VSIM / CLASIFICACION intactos |
| `app/proyecto/[boletin]/page.test.tsx` | verde | **13 tests verdes** — `<TimelineView` sigue existiendo en el source y después del `DetalleColapsable` |
| builders nuevos | 0 | **0** — `git diff` de `validacion-fuente.tsx`, `lib/format.ts` y `lib/utils.ts` = **0 líneas** |
| lenguaje de alcance reducido | ninguno | ninguno — `git diff` sin "por ahora" / "placeholder" / "versión simplificada" |

**Los tests muerden (mutación verificada y revertida):**

| mutación aplicada | efecto |
|-------------------|--------|
| revertir `buscar-filtros.tsx` a `sourceUrl: row.enlace ?? null` | **1 test cae** (`buscar-filtros.test.tsx`) |
| `timeline-view.tsx:252` → `evento={{ ...e, enlace: null }}` | **2 tests caen** (la rama de urgencia expandida no es vacua) |
| quitar `safeExternalHref` de `timeline-event.tsx` | **1 test cae** (caso `javascript:`, T-115-10) |

El árbol quedó restaurado tras cada mutación (`git status` limpio salvo los fixes reales).
