---
phase: 115
plan: 02
subsystem: validacion-links-externos
tags: [link-03, muestra-live, rate-limit, robots, veredicto, patron-malo]
requires:
  - "115-PATRONES.md §1/§4 (universo + manifiesto vigente con CASOS_MANIFIESTO/HOSTS_MANIFIESTO)"
  - "115-ROBOTS.txt (bloque RETIRADOS: — 8 ids de www.camara.cl)"
  - "scripts/probar-links-externos.mjs (runner curl-first con gate robots-primero)"
provides:
  - "115-MUESTRA.json — 19 registros crudos con timestamps, http_code, url_effective y snippet"
  - "115-MUESTRA.txt — tabla + bloques EVIDENCIA DE RATE-LIMIT / COBERTURA / REDACCION"
  - "115-VEREDICTO.md — un veredicto de taxonomia cerrada por cada P-NN + 6 acciones para el Plan 03"
affects:
  - "115-03: consume la seccion 4 de 115-VEREDICTO.md como lista cerrada de trabajo (A-1..A-6)"
  - "Phase 125: deploy y observacion live de los fixes A-1/A-2 (diferido por decision LOCKED de v12.0)"
tech-stack:
  added: []
  patterns:
    - "evidencia de rate-limit CALCULADA desde los ts_inicio del .json, jamas afirmada"
    - "conteos de cobertura leidos del manifiesto vigente (CASOS_MANIFIESTO/HOSTS_MANIFIESTO), nunca de constantes"
    - "clasificacion re-derivada de registros crudos ya almacenados: corregir la heuristica NO cuesta requests"
key-files:
  created:
    - ".planning/phases/115-link-ext-patrones-de-link-a-fuente-oficial/115-MUESTRA.json"
    - ".planning/phases/115-link-ext-patrones-de-link-a-fuente-oficial/115-MUESTRA.txt"
    - ".planning/phases/115-link-ext-patrones-de-link-a-fuente-oficial/115-VEREDICTO.md"
  modified:
    - "scripts/probar-links-externos.mjs"
decisions:
  - "P-22 (2 redirects, application/msword) se veredicta OK: la url_effective conserva iddocto=11240, luego entrega el recurso ESPECIFICO; el formato .doc es como la fuente publica el oficio, no un defecto nuestro."
  - "Cero patrones reciben FUENTE-CAIDA-WAF: los dos hosts que negaron su /robots.txt con 403 SI respondieron las URLs de caso, y los cuatro 500 de opendata.camara.cl son respuestas deliberadas (`Falta el parametro: prmBoletin`), es decir defecto de nuestra URL."
  - "El fix del candidato #2 NO requiere threadear el boletin por timeline-view.tsx: TramitacionEventoRow.boletin es no-nulable y PROD tiene 0 nulos. Corrige la premisa del plan con evidencia."
metrics:
  duration: ~25 min
  completed: 2026-07-28
---

# Phase 115 Plan 02: Muestra live + veredicto por patrón — Summary

Una sola pasada de 19 requests sobre 6 hosts con delta mínimo intra-host de **2.589 ms**, y el
veredicto cerrado que sale de ella: **10 patrones malos nuestros, 9 correctos, 9 sin probe por
respeto a robots y CERO fuentes caídas** — la muestra no dejó ni un 403 ni una indisponibilidad
detrás de la cual esconder un patrón defectuoso.

## Qué se construyó

**Task 1 — `115-MUESTRA.json` / `115-MUESTRA.txt`** (commit `2fc9283`)

Corrida única del runner del Plan 01 sobre el manifiesto vigente. Antes de disparar se verificó
que el array `CASOS` no contuviera ninguno de los 8 ids del bloque `RETIRADOS:` (`retirados_presentes=0`).

- **19 registros / 6 hosts**, cuadrando con `CASOS_MANIFIESTO: 19` y `HOSTS_MANIFIESTO: 6` leídos
  del documento, no de constantes.
- **`=== EVIDENCIA DE RATE-LIMIT ===`** — por host: requests, delta mínimo **calculado** desde los
  `ts_inicio` del `.json`, y veredicto. Peor caso intra-host **2.589 ms**; delta mínimo **global**
  (incluido el salto entre hosts) también 2.589 ms, porque el delay se aplica igualmente entre
  hosts. Reintentos: **0**. Pasadas: **1**.
- **`=== COBERTURA ===`** — `CASOS_EJECUTADOS: 19 / CASOS_MANIFIESTO: 19`,
  `HOSTS_CUBIERTOS: 6 / HOSTS_MANIFIESTO: 6`, `PATRONES_CUBIERTOS: 18 / PATRONES_PROBABLES: 18`
  (27 patrones de §1 menos 9 sin-probe: `P-04` + los 8 retirados). Lista **nominal** de los 8 casos
  no ejecutados, cada uno con su directiva. Cero casos asumidos.
- **`=== REDACCION DE SNIPPETS ===`** — redacciones aplicadas: **0**, con la razón: la respuesta de
  `datos.cplt.cl` es un error del compilador SPARQL, sin dato personal alguno, porque el servidor
  nunca llegó a ejecutar la consulta. La regla de redacción queda escrita por si un futuro caso la
  necesita.

Ningún 403 ni 429 se reintentó, no se cambió el User-Agent, no se usaron proxies ni headers de
navegador. Los dos hosts con WAF-en-robots se consultaron con la misma identidad y la misma mesura.

**Task 2 — `115-VEREDICTO.md`** (commit `9037490`)

- **§1** taxonomía cerrada de 4 etiquetas con criterio duro y la regla LOCKED de que un WAF no
  absuelve a un patrón mal construido.
- **§2** una fila por cada `P-NN` de §1 (28 filas; `P-03` aporta dos, una por rama), cada una
  citando su id de registro. Cobertura 1:1 verificada con `comm`: salida vacía.
- **§3** los dos candidatos resueltos con SQL de PROD y respuesta live.
- **§4** seis acciones cerradas (A-1…A-6) con archivo:línea, fix y criterio de aceptación.
- **§5** deploy diferido a Phase 125 con el precedente de 114-03.

## Hallazgos de sustancia

1. **El candidato #1 es peor de lo documentado: el XML no sólo es crudo, es VACÍO.** `P-27-c01`
   devuelve `<proyectos></proyectos>` — el endpoint sin parámetro de fila no tiene nada que decir.
   Las 3.658 filas de `proyecto.enlace` en `tramitacion.senado.cl` son **todas** `/wspublico/`
   (3.658 = 3.658), justo el caso que `enlaceHumanoProyecto` existe para reescribir.
2. **El candidato #2, idéntico: `<votaciones> </votaciones>`.** Y las 982 filas de
   `tramitacion_evento` en ese host son `/wspublico/` **todas** (982 = 982): no hay subconjunto
   sano que preservar.
3. **El fix del candidato #2 no exige threading.** El plan asumía que había que pasar el boletín
   desde `page.tsx` por `TimelineView`. Falso: `TramitacionEventoRow.boletin` es `string`
   no-nulable (`app/lib/types.ts:32-33`) y PROD tiene **0** nulos, luego `TimelineEvent` ya lo
   tiene. El fix es local a `timeline-event.tsx:42`. `timeline-view.tsx:243,252` sigue siendo de
   revisión obligada porque son los **dos** call-sites del componente y omitir el segundo dejaría
   sin arreglar los eventos dentro de un período de urgencia expandido.
4. **`timeline-event.tsx:42` además carece de `safeExternalHref`**, que el resto de los href
   externos sí aplica (`validacion-fuente.tsx:123-124`). Se incorporó al fix A-2.
5. **Cero fuentes caídas.** Los cuatro 500 de `opendata.camara.cl` traen cuerpo
   `Falta el parámetro: prmBoletin`: el host responde y acusa **nuestra** URL. El 400 de
   `datos.cplt.cl` es un `Virtuoso 37000 SP030 syntax error`: la URL almacenada
   (`?query=alessandri%20vergara`) es texto libre, no SPARQL. Ninguno de los dos hosts con
   WAF-en-robots negó su recurso. No hubo ni un solo 403 que pudiera usarse como excusa.
6. **P-22 es el único caso con redirección y aun así llega**: 2 saltos de `www.senado.cl` a
   `tramitacion.senado.cl` conservando `iddocto=11240`, entregando el oficio en
   `application/msword`. `OK`: el formato es cómo la fuente publica el documento, no un defecto
   del patrón.

## Desviaciones del plan

**1. [Rule 1 — bug] `clasificar()` no tenía rama para 4xx distintos de 403/404**

- **Encontrado durante:** Task 1, al revisar la salida.
- **Problema:** el 400 de `P-11-c01` caía al `return "OK"` final y quedaba etiquetado como éxito —
  precisamente el tipo de falso verde que esta fase existe para impedir.
- **Fix:** rama explícita para todo 4xx y 5xx en `scripts/probar-links-externos.mjs`, y la columna
  `clasificacion` **re-derivada de los mismos registros crudos ya almacenados**. `P-11-c01` pasa de
  `OK` a `NO-DISPONIBLE`. **Cero requests adicionales**: ningún servidor se consultó de nuevo, y
  `http_code`, `url_effective`, `content_type`, `snippet` y los timestamps quedaron intactos. La
  nota queda declarada en `115-MUESTRA.txt`.
- **Archivos:** `scripts/probar-links-externos.mjs`, `115-MUESTRA.json`, `115-MUESTRA.txt`.
- **Commit:** `2fc9283`.

**2. [Rule 2 — completitud] Corrección de la premisa del plan sobre el threading del candidato #2**

El plan pedía «registrar la cadena de llamada real que el fix deberá tocar», declarando
`TimelineView` como «intermediario obligado: sin él el boletín no llega al evento». La cadena se
registró tal cual, pero la premisa del threading resultó falsa y se corrigió **con evidencia**
(tipo + conteo de nulos en PROD) en vez de transcribirse. `timeline-view.tsx` sigue nombrado en §3
y en la acción A-2, por la razón correcta: son los dos call-sites que el test debe cubrir.

**3. [Rule 2 — honestidad del veredicto] Ningún patrón recibió `FUENTE-CAIDA-WAF`**

La etiqueta existe en §1 y su ausencia en §2 se **declara explícitamente** con la evidencia que la
sostiene, en vez de dejarse como silencio. §4 cierra el punto: no hay leyenda de fuente caída que
redactar, y las leyendas de A-3/A-4/A-5 son de **recurso no-humano**, que es cosa distinta.

## Puertas de red ejercidas

**19 requests**, uno por caso del manifiesto vigente, en **una sola pasada**, con el User-Agent
identificatorio de la fase y ≥2.589 ms entre requests consecutivos al mismo host (y también entre
hosts). Cero requests a `www.camara.cl`. Cero reintentos. Cero re-corridas.

## Notas de seguridad

- `SUPABASE_DB_URL` se usó siempre como `psql "$SUPABASE_DB_URL" -tA -c ...`, jamás ecoada ni
  escrita. `! grep -qE 'postgres(ql)?://'` verde sobre los tres artefactos.
- Queries de los candidatos: sólo `count(*)` y `split_part(enlace,'/',3)`. Cero valores de fila,
  cero columnas PII.
- Snippets colapsados y truncados a 300 caracteres por el runner; regla de redacción del dominio
  de declaraciones declarada, con 0 aplicaciones necesarias y la razón registrada.
- `curl` invocado por `execFile` con array de argumentos; URLs siempre del manifiesto cerrado.

## Verificación

| gate | resultado |
|------|-----------|
| `<automated>` Task 1 | `MUESTRA_OK 19 6` |
| registros vs `CASOS_MANIFIESTO` | 19 = 19 |
| hosts vs `HOSTS_MANIFIESTO` | 6 = 6 |
| delta mínimo intra-host (calculado) | 2589 ms ≥ 2000 |
| `http_code` faltante | `HTTPCODE_OK` (ninguno) |
| ids fuera del manifiesto | `IDS_OK` (ninguno) |
| intersección ejecutados ∩ `RETIRADOS:` | `RETIRADOS_OK retirados=8 interseccion=0` |
| reintentos agresivos en el `.txt` | `SIN_REINTENTOS_AGRESIVOS` |
| `<automated>` Task 2 | `VEREDICTO_OK` |
| cobertura 1:1 patrón→veredicto (`comm -23`) | salida VACÍA |
| etiqueta sin-probe en §2 | 9 / límite 9 (1 + 8 retirados) |
| líneas con esa etiqueta sin cita | 0 |
| etiquetas ambiguas en las tablas | ninguna |
| sub-secciones de candidatos | 5 menciones ≥ 2 |
| §4 como lista numerada | `SEC4_OK` |
| credenciales en los tres artefactos | ninguna |

## Known Stubs

Ninguno. Los tres artefactos son documentales y están completos; las 6 acciones de §4 son trabajo
declarado del Plan 03, no stubs de este plan. Ningún fix de código se aplicó aquí — esta fase
diagnostica; el Plan 03 arregla y el deploy viaja con la Phase 125.

## Self-Check: PASSED

Los tres artefactos declarados existen en disco (`115-MUESTRA.json`, `115-MUESTRA.txt`,
`115-VEREDICTO.md`) y los dos commits de task existen en el historial (`2fc9283`, `9037490`).
