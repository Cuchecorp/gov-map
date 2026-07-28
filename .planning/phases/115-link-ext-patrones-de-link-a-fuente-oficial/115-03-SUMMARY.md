---
phase: 115-link-ext-patrones-de-link-a-fuente-oficial
plan: 03
subsystem: links-externos-ui
tags: [link-03, anti-insinuacion, safe-external-href, enlace-humano, limitacion-declarada, deploy-diferido]
requires:
  - "115-VEREDICTO.md §4 — lista cerrada de acciones A-1..A-6"
  - "115-MUESTRA.json — bloque ANTES de los patrones corregidos"
  - "app/components/validacion-fuente.tsx — enlaceHumanoProyecto (builder existente, NO se tocó)"
  - "app/lib/utils.ts — safeExternalHref (guard existente, NO se tocó)"
provides:
  - "SUPERFICIES_LINK_EXT + vocabulario de intención-de-la-fuente en el linter anti-insinuación"
  - "/buscar: el badge de cada resultado enlaza a la ficha humana del Senado"
  - "timeline: el enlace del evento pasa por enlaceHumanoProyecto + safeExternalHref"
  - "provenance-badge: LEYENDA_RECURSO_NO_HUMANO + esServicioDeDatos (limitación declarada A-3/A-4/A-5)"
  - "115-VERIFICACION.md — ANTES/DESPUÉS por hallazgo + veredicto de los 4 SC + deuda que viaja a 125"
affects:
  - "Phase 125: deploy y observación live de A-1/A-2 y de la leyenda de recurso no-humano"
  - "deferred-items.md (D-115-01): deuda de ingesta del enlace SPARQL de declaracion* (9.441 filas)"
tech-stack:
  added: []
  patterns:
    - "el guard anti-insinuación se extiende ANTES de escribir el copy (orden LOCKED 68-01/100-01/101-02/103-03)"
    - "dedupe de superficies del linter con Set en el bucle de escaneo, en vez de omitir rutas del array de alcance"
    - "los tests del fix renderizan desde el INTERMEDIARIO (TimelineView), no desde el hijo aislado"
    - "limitación declarada por predicado host+path de lista cerrada, jamás por substring"
key-files:
  created:
    - ".planning/phases/115-link-ext-patrones-de-link-a-fuente-oficial/115-VERIFICACION.md"
    - ".planning/phases/115-link-ext-patrones-de-link-a-fuente-oficial/deferred-items.md"
  modified:
    - "app/lib/anti-insinuacion-guard.test.ts"
    - "app/components/buscar-filtros.tsx"
    - "app/components/buscar-filtros.test.tsx"
    - "app/components/timeline-event.tsx"
    - "app/components/timeline-view.test.tsx"
    - "app/components/provenance-badge.tsx"
    - "app/components/provenance-badge.test.tsx"
decisions:
  - "El boletín NO se threadea por timeline-view.tsx: viaja dentro de la fila (TramitacionEventoRow.boletin no-nulable, 0 nulos en PROD). El gate de paridad del plan se RE-EXPRESA con esa evidencia, no se relaja: ambas ramas de call-site quedan cubiertas por test y la mutación de :252 tumba 2 tests."
  - "buscar-filtros.tsx y provenance-badge.tsx se listan IGUALMENTE en SUPERFICIES_LINK_EXT (aunque ya vivan en BUSQUEDA/DEEPLINK) y la duplicación se disuelve con un Set en el bucle: el array es el registro completo del alcance de la fase y ningún archivo se escanea dos veces."
  - "La leyenda de recurso no-humano NO entra en NEGACIONES_LOCKED porque no contiene término prohibido; eso se VERIFICA con un test que la monta verbatim y exige cero offenders, en vez de asumirse."
  - "Re-probe de 2 requests (P-03-c01 y P-01-c01) en vez de re-probar los ids ANTES: la URL que interesa observar es la RESULTANTE del patrón corregido, y los destinos de A-1 y A-2 convergen a la misma plantilla."
metrics:
  duration: ~35 min
  completed: 2026-07-28
---

# Phase 115 Plan 03: Fixes de patrones de link externo + veredicto de fase — Summary

Los dos patrones que mandaban al ciudadano a un XML **vacío** —el badge de `/buscar` (3.658
filas) y el enlace de cada evento del timeline (982 filas)— ahora llevan a la ficha humana
del boletín, el último `<a>` externo del sitio sin guard anti-XSS quedó cubierto, y los
destinos para los que **no existe** página humana derivable declaran su limitación en la UI
sin atribuirle intención a la fuente.

## Qué se construyó

**Task 1 — linter anti-insinuación extendido ANTES del copy** (commit `801d319`)

`SUPERFICIES_LINK_EXT` con las 4 superficies de la fase (`timeline-event.tsx`,
`timeline-view.tsx`, `buscar-filtros.tsx`, `provenance-badge.tsx`) y el vocabulario propio
del carril: `oculta` / `ocultan` / `esconde` / `esconden` / `no quiere` / `se niega a` /
`bloquea a propósito` / `censura`. El riesgo específico de una fase de links no es el
vocabulario de bancada sino insinuar que la fuente **oculta** el dato: que un organismo
publique un web service en vez de una página es un hecho de formato, jamás una voluntad.

- Arrays previos **intactos** (0 declaraciones `const SUPERFICIES_` eliminadas). Lo único
  que cambió fuera del alcance nuevo es el bucle de escaneo, que ahora envuelve la
  concatenación en un `Set`.
- Mutation self-check: 2 tests nuevos inyectan los términos en fixtures EN MEMORIA y exigen
  que el detector los cace; sin ellos el carril sería un no-op verde.
- No-falsos-positivos verificados: `Ocultar urgencias` (copy real de `timeline-view.tsx`) y
  `Ver fuente oficial ↗` NO disparan; el único `oculta`/`esconde` del árbol vive en
  comentarios, que el `stripTsComments` ya quita.
- El vocabulario se declaró **antes** de que existiera una línea del copy nuevo, y la
  leyenda futura se montó como fixture para probarla limpia por anticipado.

**Task 2 — los fixes, con tests que muerden** (RED `726ea7f`, GREEN `66fb1f0`)

- **A-1 `/buscar`** (`buscar-filtros.tsx:493`): `sourceUrl` pasa por `enlaceHumanoProyecto`
  con el `row.boletin` que ya estaba en el mismo `.map`. Cero threading, cero builder nuevo.
- **A-2 timeline** (`timeline-event.tsx:42`): `safeExternalHref(enlaceHumanoProyecto(...))`.
  Si el guard devuelve `null`, no se emite el `<a>`: se pierde el enlace, jamás el hecho.
- **A-3/A-4/A-5** (`provenance-badge.tsx`): `LEYENDA_RECURSO_NO_HUMANO` + `esServicioDeDatos`,
  un predicado de **lista cerrada por host+path** (opendata.camara.cl · web-back.senado.cl/api
  · tramitacion.senado.cl/wspublico · datos.cplt.cl/sparql). La leyenda aparece junto al badge
  **sin quitar el enlace**, y el DOM del resto de los badges queda byte-idéntico (sólo se
  envuelve cuando hay algo que declarar).
- **A-5 (ingesta)**: la deuda del `enlace` SPARQL mal formado (9.441 filas, 7 tablas
  `declaracion*`) quedó registrada en `deferred-items.md` con conteo y evidencia. Cero cambio
  de conector en esta fase.
- **A-6**: ninguna acción de código y **cero requests** a `www.camara.cl`.
- `page.tsx:525` — **no-op verificado**: `TimelineView` ya recibía `boletin`; no se tocó el
  JSX y `page.test.tsx` sigue verde.

**Task 3 — re-probe acotado y cierre** (commit `b53fade`)

`115-VERIFICACION.md` con §1 qué se corrigió (incluida la fila del intermediario), §2 qué se
declaró (los 9 sin-probe + las tres leyendas + la ausencia declarada de `FUENTE-CAIDA-WAF`),
`## Veredicto por success criterion` con los 4 SC verbatim, §4 reproducción, §5 deuda que
viaja a la 125 y §6 no-regresión.

## Hallazgos de sustancia

1. **El fix del candidato #2 es local, y eso se PRUEBA, no se afirma.** La premisa del plan
   (threadear el boletín por `timeline-view.tsx`) es falsa: `TramitacionEventoRow.boletin` es
   `string` no-nulable con 0 nulos en PROD. Para que "local" no signifique "a medias", la
   mutación de `:252` (`evento={{...e, enlace: null}}`) se ejecutó de verdad: tumba **2**
   tests. La rama de urgencia expandida no es vacua.
2. **La leyenda tuvo que decidir por host+path, no por substring.** Un `?query=wspublico` en
   otro host habría declarado una limitación falsa. Hay un test explícito para ese borde.
3. **La limitación se declara SIN quitar el enlace.** Quitarlo habría sido más "limpio" y
   menos honesto: el ciudadano pierde la posibilidad de ir a la fuente. Se declara el
   formato y se conserva el acceso.
4. **`timeline-event.tsx` era el último emisor externo sin `safeExternalHref`.** El guard
   existía desde v1.0 y todos los demás href lo aplicaban; este se lo saltaba desde entonces.

## Desviaciones del plan

**1. [Rule 2 — evidencia sobre premisa] El gate de paridad `<TimelineEvent` se RE-EXPRESA, no se relaja**

- **Encontrado durante:** Task 2 (ya anticipado por `115-02-SUMMARY.md` y `115-VEREDICTO.md` §3).
- **Problema:** el `<automated>` del plan exigía
  `grep -c '<TimelineEvent'` == `grep -c '<TimelineEvent[^>]*boletin'`, escrito bajo la
  premisa de que el boletín debía threadearse. Con el boletín viajando DENTRO de la fila,
  añadir un prop `boletin` a `TimelineEvent` sería threading redundante y contradiría
  explícitamente la acción A-2 («El boletín **no** se threadea»), que es el alcance cerrado.
- **Fix:** el gate se sustituye por uno **más fuerte**, no más débil: (a) `pnpm typecheck`
  exit 0 sobre toda la cadena; (b) un test por **cada** call-site renderizado desde
  `TimelineView`; (c) **mutación real** de `:252` que debe tumbar tests. Evidencia del
  no-threading: `app/lib/types.ts:32-33` + `select count(*) … where boletin is null` = 0
  (registrado en `115-VEREDICTO.md` §3). Queda escrito en `115-VERIFICACION.md` §1 y §6.
- **Archivos:** ninguno adicional — `timeline-view.tsx` NO se modificó.
- **Commit:** `66fb1f0`.

**2. [Rule 3 — colisión de criterios] `SUPERFICIES_LINK_EXT` lista archivos que ya viven en otros carriles**

- **Problema:** el plan exige que **cada** archivo de UI de §4 aparezca en
  `SUPERFICIES_LINK_EXT`, pero `buscar-filtros.tsx` ya está en `SUPERFICIES_BUSQUEDA` y
  `provenance-badge.tsx` en `SUPERFICIES_DEEPLINK`, y el Pitfall 4 LOCKED prohíbe duplicar
  (precedente `app/comparar/page.tsx` en VSIM).
- **Fix:** se cumplen **ambos**: el array lista los 4 archivos (registro completo del alcance
  de la fase) y el bucle de escaneo envuelve la concatenación en un `Set`, de modo que ningún
  archivo se lee dos veces ni un offender se reporta duplicado. Documentado en el JSDoc.
- **Commit:** `801d319`.

**3. [Rule 2 — verificar en vez de asumir] La leyenda no entra en `NEGACIONES_LOCKED`**

- **Problema:** el plan pedía restar la leyenda del scan «para que su propio texto no se
  auto-invalide». La leyenda de §4 no contiene ningún término prohibido, así que restarla
  sería un no-op que ensucia la semántica del array (precedente AGENDA/NOTIF: negaciones de
  términos NO prohibidos no se registran).
- **Fix:** en vez de asumirlo, se añadió un test que monta la leyenda verbatim y exige `[]`
  offenders. Si un copy futuro del carril negara un término prohibido, ese test lo delata.
- **Commit:** `801d319`.

**4. [Rule 3 — respeto al rate-limit] El re-probe usa `--id P-03-c01` / `P-01-c01`**

- **Problema:** el plan sugería re-probar «los casos afectados» por su id. Los ids afectados
  (`P-27-c01`, `P-24-c01`) apuntan a la URL **vieja**: re-pedirla no aportaría información
  sobre el fix, sólo carga al servidor.
- **Fix:** se re-probó la URL **resultante** del patrón corregido, con dos boletines distintos
  (14309-04 y 10986-24) para que el resultado no dependa de una fila afortunada. 2 requests,
  delta 9.447 ms, mismo runner y mismo UA. El bloque ANTES se copió de `115-MUESTRA.json`.
- **Commit:** `b53fade`.

## Puertas de red ejercidas

**2 requests** en total, ambos a `tramitacion.senado.cl`, separados **9.447 ms** (≥ 2.500),
con el User-Agent identificatorio del runner de la fase. Cero requests a `www.camara.cl`
(A-6). Cero reintentos, cero cambios de User-Agent, cero proxies.

## Notas de seguridad

- **T-115-10** mitigado: `timeline-event.tsx` pasa por `safeExternalHref`; test con
  `javascript:` renderizado desde `TimelineView` que asevera que el `<a>` no se emite.
- **T-115-14** mitigado: `tsc -b` exit 0 + un test por call-site + mutación de `:252` que
  tumba 2 tests.
- **T-115-11** mitigado: carril LINK-EXT en el linter, extendido antes del copy, con mutation
  self-check.
- **T-115-12** mitigado: `git diff .env.example` = **0** líneas; los 4 anti-flip y el lockdown
  verdes (272 tests en los 9 guards).
- **T-115-01** mitigado: re-probe de 2 requests por `--id`, jamás re-corrida completa.
- **T-115-SC** mitigado: **cero paquetes** instalados; `package.json` sin cambios.
- Ningún dato personal en los artefactos; `! grep -qE 'postgres(ql)?://'` verde sobre
  `115-VERIFICACION.md` y `deferred-items.md`.

## Verificación

| gate | resultado |
|------|-----------|
| `<automated>` Task 1 | 37 tests verdes, `SUPERFICIES_LINK_EXT` + ambas superficies del timeline presentes |
| arrays previos intactos | 0 declaraciones `const SUPERFICIES_` eliminadas |
| `<automated>` Task 2 | `buscar-filtros` 25 · `timeline-view` 21 · `page.test.tsx` 13 → 59/59 verdes |
| `pnpm typecheck` (raíz) | exit 0 |
| tests que muerden (3 mutaciones) | 1 / 2 / 1 tests caídos respectivamente; árbol restaurado |
| builders nuevos | `git diff` de `validacion-fuente.tsx` + `lib/format.ts` + `lib/utils.ts` = **0 líneas** |
| lenguaje de alcance reducido | ninguno |
| `cd app && pnpm test` | **1453** = baseline 1431 + 22 (107 archivos, 0 fallos) |
| `pnpm -r --filter "./packages/*" test` | todos verdes, sin delta (esta fase no toca `packages/`) |
| 9 guards de régimen | 9/9, **272** tests |
| `git diff .env.example \| wc -l` | **0** |
| `<automated>` Task 3 | `CIERRE_OK`; 5 veredictos `PASS`/`FAIL` (≥ 4) |
| acciones huérfanas vs §4 | ninguna — A-1…A-6 aparecen en §1 o §2 de `115-VERIFICACION.md` |

## Known Stubs

Ninguno. Los tres fixes están cableados a datos reales (el rewrite y el guard operan sobre
las columnas de PROD ya pobladas) y la leyenda se dispara con un predicado sobre la URL
efectiva, no con un flag. Lo único **no observado** es el deploy: los fixes viajan con la
Phase 125 por decisión LOCKED de v12.0, y por eso el SC3 cierra como **PASS con limitación
declarada** y no como PASS pelado.

## Threat Flags

Ninguno. Este plan no introduce endpoint de red, ruta de autenticación, acceso a archivos ni
cambio de esquema; su superficie nueva es un `<a href>` que ahora pasa por el guard que antes
se saltaba —es decir, superficie **reducida**— y un texto estático en el badge.

## Self-Check: PASSED

- `.planning/phases/115-.../115-VERIFICACION.md` — FOUND
- `.planning/phases/115-.../deferred-items.md` — FOUND
- `app/components/provenance-badge.tsx` (con `LEYENDA_RECURSO_NO_HUMANO`) — FOUND
- Commits `801d319`, `726ea7f`, `66fb1f0`, `b53fade` — FOUND en el historial
