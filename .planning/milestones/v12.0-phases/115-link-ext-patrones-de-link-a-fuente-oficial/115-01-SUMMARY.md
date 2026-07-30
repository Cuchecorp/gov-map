---
phase: 115
plan: 01
subsystem: validacion-links-externos
tags: [link-03, robots, patrones-url, ingesta-respetuosa, inventario]
requires:
  - "113-INVENTARIO.md §3.1/§3.2/§3.3 (universo de emisores, builders y familias URL-desde-columna)"
  - "scripts/verificar-links-internos.mjs (molde de runner: UA, delay, salida .txt/.json)"
provides:
  - "115-PATRONES.md — universo cerrado patron x host con plantilla, parametro, emisor y caso real"
  - "scripts/probar-links-externos.mjs — runner curl-first rate-limited con gate robots-primero y array CASOS"
  - "115-ROBOTS.txt — protocolo de exclusion de los 7 hosts, con veredicto y bloque RETIRADOS"
affects:
  - "115-02 (muestra live): consume CASOS y los conteos CASOS_MANIFIESTO/HOSTS_MANIFIESTO como gate de cobertura"
  - "115-03 (veredicto): cita evidencia por id P-NN-cNN"
tech-stack:
  added: []
  patterns:
    - "curl via execFile con array de argumentos (nunca exec con string, nunca shell)"
    - "gate de orden EN EL CODIGO: el modo muestra falla si 115-ROBOTS.txt no existe"
    - "ids de caso P-NN-cNN como contrato documento <-> runner <-> evidencia"
key-files:
  created:
    - ".planning/phases/115-link-ext-patrones-de-link-a-fuente-oficial/115-PATRONES.md"
    - ".planning/phases/115-link-ext-patrones-de-link-a-fuente-oficial/115-ROBOTS.txt"
    - "scripts/probar-links-externos.mjs"
  modified: []
decisions:
  - "www.camara.cl: se adopta la lectura LITERAL de su robots.txt (grupo `User-agent: *` final con `Disallow: /`) por sobre la lectura RFC-9309 (allow gana ante patrones equivalentes). 8 casos RETIRADOS; sus patrones se validan solo por construccion."
  - "El origen real del href de cruces NO es `cruce_senal.evidencia->>'enlace_fuente'` (0 filas) sino la columna `cruce_senal.enlace` (781)."
  - "El universo de la fase es el grep AMPLIADO de `sourceUrl` (prop JSX + propiedad de objeto): suma 5 call-sites que §3.1.4 no tenia, incluido el candidato #1 de /buscar."
metrics:
  duration: ~30 min
  completed: 2026-07-28
---

# Phase 115 Plan 01: Universo de patrones + infraestructura de la muestra — Summary

Universo cerrado de **28 filas patrón×host** (4 builders + 23 familias URL-desde-columna + el
candidato #1 de `/buscar`) con plantilla verbatim, parámetro y caso real elegido por SQL de PROD;
runner **curl-first** rate-limitado con gate robots-primero impuesto por código; y el `robots.txt` de
los 7 hosts registrado **antes** de pedir un solo recurso de caso — lo que retiró 8 casos del
manifiesto por respeto, no por avería.

## Qué se construyó

**Task 1 — `115-PATRONES.md`** (commit `907867a`)

- §0 método, regla LOCKED "JAMÁS crawl exhaustivo", ancla temporal `2026-07-28`, restricciones de PII
  y de credenciales heredadas de 113.
- §0.1 las tres correcciones de partida pedidas por el plan: ubicación real de los builders
  (`validacion-fuente.tsx:60/67/87`, sólo `partidoLegible` en `format.ts:153-174`), grep ampliado de
  `sourceUrl` con su salida verbatim, y la discrepancia **10-vs-11** de §3.3.5 resuelta a favor de **11**
  con lista nominal.
- §1 la tabla del universo: `P-01`…`P-27` (28 filas: `P-03` aporta dos, una por rama). `P-04`
  (`partidoLegible`) queda declarado como patrón **sin recurso que pedir**, para que su ausencia de la
  muestra no se lea como omisión.
- §2 exclusiones con razón y **sin doble-conteo MONEY**: las 4 columnas MONEY son subconjunto de las
  11 vacías, no un grupo adicional.
- §3 el SQL verbatim de cada caso, con `ORDER BY` determinista y `LIMIT 1`, y su salida inline.
- §4 el manifiesto agrupado por host con ids `P-NN-cNN` y las dos líneas grepeables
  `CASOS_MANIFIESTO:` / `HOSTS_MANIFIESTO:`.

**Task 2 — `scripts/probar-links-externos.mjs`** (commit `91566c8`)

- `CASOS` exportado, transcripción de §4. Ids `P-NN-cNN` como contrato con el documento.
- `curl` por `execFile` con array de argumentos (T-115-05). GET con `--range 0-8191`; el método de
  sólo-cabeceras está prohibido. `USER_AGENT` identificatorio en constante auditable.
- `DELAY_MS = 2500`, recorrido **secuencial** agrupado por host, delay también entre hosts. Sin
  `Promise.all`. Reintento único y sólo ante fallo de RED; 403/429/5xx se registran y clasifican.
- **Gate de orden (T-115-13):** el modo muestra se niega a correr si `115-ROBOTS.txt` no existe —
  exit 1 y **cero requests emitidos**. Verificado empíricamente.
- Registros con `ts_inicio`/`ts_fin` ISO con ms, `delta_ms_mismo_host`, `http_code`, `url_effective`,
  `num_redirects`, `content_type` y `snippet` de 300 caracteres. Salida `.txt` + `.json`.
- Validado **sólo** con `--robots --host www.senado.cl`: 1 registro, url terminada en `/robots.txt`,
  exit 0. Cero URLs de caso pedidas en este task. Filtro sin match → exit 2.

**Task 3 — `115-ROBOTS.txt`** (commit `915b638`)

7 hosts, cada uno con comando, `http_code`, cuerpo (verbatim o los 300 caracteres del snippet cuando
la respuesta es una página de error) y su línea `VEREDICTO`:

| host | robots | veredicto |
|------|--------|-----------|
| `www.camara.cl` | 200 `text/plain` | **NO permitido** — grupo `User-agent: *` final con `Disallow: /` |
| `opendata.camara.cl` | 200 `text/html` | sin robots.txt publicado (sirve el portal) — permitido |
| `tramitacion.senado.cl` | 206 con 1 redirect a `index.php` | sin robots.txt publicado — permitido |
| `www.senado.cl` | 206 `text/plain` | permitido (sólo `/proyecto-365` restringido; no lo tocamos) |
| `web-back.senado.cl` | 206 `text/plain` | permitido (robots de Drupal; `/api/` no restringido) |
| `www.leylobby.gob.cl` | 403 | WAF-en-robots — sin directivas publicadas |
| `datos.cplt.cl` | 403 | WAF-en-robots (Azure App Gateway) — sin directivas publicadas |

`RETIRADOS:` 8 ids, todos de `www.camara.cl`, cada uno citando la directiva. Manifiesto vigente:
**19 casos sobre 6 hosts**, espejado en `115-PATRONES.md` §4 y en `CASOS` (sincronía verificada por
el gate del plan: `SYNC_OK 19`).

## Hallazgos de sustancia (insumo del Plan 02, no juzgados aquí)

1. **`www.camara.cl` prohíbe el acceso a agentes genéricos.** Su `robots.txt` trae dos grupos
   `User-agent: *`: el gestionado por Cloudflare (`Allow: /`) y uno final del operador del sitio
   (`Disallow: /`). RFC 9309 fusionaría los grupos y, ante patrones equivalentes, haría ganar al
   `Allow`. **Se adoptó la lectura literal** (la última voluntad expresada en el archivo), que es la
   que aplica la regla del plan sin excepciones de interpretación. Ambas lecturas quedan escritas en
   `115-ROBOTS.txt` §1 para que el operador pueda revisitar la decisión con la evidencia a la vista.
2. **La mayoría de los valores `enlace` almacenados son endpoints de ingesta, no deep-links.**
   `tramitacion.php`, `getVotaciones_Boletin`, `listadodeaudiencias.aspx`,
   `comisiones_permanentes.aspx` no llevan parámetro de fila: P-05, P-10 y P-12 comparten literalmente
   la misma URL, igual que P-08 y P-09. Sólo `www.leylobby.gob.cl` guarda deep-links reales.
3. **`cruce_senal.evidencia` no tiene la clave `enlace_fuente`** (`0` filas; sus claves de primer
   nivel son `conteo` e `items`). El origen real del href es la columna `cruce_senal.enlace` (781).
   Corrige a §3.1.4 filas 6-7 del inventario.
4. **Candidato #1 confirmado en código:** `buscar-filtros.tsx:493` pasa `proyecto.enlace` **crudo**,
   sin `enlaceHumanoProyecto` → patrón `P-27`, 3.658 filas hacia XML crudo. Registrado, **no** corregido
   (esta fase no arregla; el fix y su deploy viajan con 125).

## Desviaciones del plan

**1. [Rule 2 — respeto al servidor] Criterios de cobertura reducidos por robots**

- **Encontrado durante:** Task 3.
- **Situación:** el `<success_criteria>` del plan exige `CASOS.length >= 20` sobre **≥7 hosts**. Tras
  aplicar el retiro que el propio Task 3 ordena (`Disallow: /` de `www.camara.cl`), el manifiesto
  vigente queda en **19 casos sobre 6 hosts**.
- **Resolución:** se cumple la regla de respeto, no el número. El plan es explícito en que un caso
  retirado por robots **no** es una falla ("es respeto, y su patrón se valida sólo por construcción"),
  y ambos criterios no podían satisfacerse a la vez. Los 8 patrones retirados siguen en el universo de
  §1 con plantilla y parámetro: pierden probe, no cobertura documental.
- **Impacto para el Plan 02:** los gates de cobertura deben leer `CASOS_MANIFIESTO: 19` /
  `HOSTS_MANIFIESTO: 6` del documento —que es justamente para lo que el plan definió esas líneas como
  "fuente única de verdad"— y **no** las constantes 20/7 del `<success_criteria>` de este plan.
- **Archivos:** `115-ROBOTS.txt`, `115-PATRONES.md` §4, `scripts/probar-links-externos.mjs`.
- **Commit:** `915b638`.

**2. [Rule 1 — bug] Marcador duplicado en el parser de metadatos de curl**

- **Encontrado durante:** Task 2, al validar el smoke de `--robots`.
- **Problema:** el argumento `-w` llevaba el marcador `0x02` dos veces (prefijo del template y primer
  carácter de la constante `W`), de modo que `lastIndexOf` cortaba el cuerpo después del primer
  marcador y el `snippet` arrastraba un carácter de control.
- **Fix:** el marcador vive sólo en el prefijo del argumento. Re-verificado con un segundo smoke:
  `snippet` limpio (`"User-agent: * Allow: / Disallow: /proyecto-365"`), `http_code` 206.
- **Commit:** `91566c8`.

**3. [Rule 2 — completitud] Cuarto hallazgo añadido como §0.2**

El plan pedía exactamente tres correcciones en §0.1. El hallazgo sobre `cruce_senal.evidencia`
apareció al construir el caso de `P-10` y se registró como **§0.2** para no alterar la estructura de
§0.1 ni sus gates. Sin él, `P-10` habría quedado sin caso real.

## Puertas de red ejercidas

Todo el tráfico de este plan fue a `/robots.txt` — el primer acto que el protocolo de exclusión
sanciona. Requests emitidos: **2 smokes** a `www.senado.cl/robots.txt`, **7** de la corrida `--robots`
(uno por host), y **2** recuperaciones de cuerpo completo (`www.camara.cl`, `web-back.senado.cl`) con
el mismo UA y ≥3 s de separación, necesarias porque el runner trunca a 8 KiB. **Cero** URLs de caso.

## Notas de seguridad

- `SUPABASE_DB_URL` se usó siempre como `psql "$SUPABASE_DB_URL" -tA -f ...`, jamás ecoada ni escrita.
  `! grep -qE 'postgres(ql)?://'` verde sobre ambos artefactos.
- Cero columnas PII consultadas: `pii_contraparte_declaracion.*` y los dominios
  `infoprobidad/`, `servel/`, `money/`, `rut/` quedaron fuera; las 4 columnas MONEY están vacías y
  aparecen sólo como exclusión.
- `curl` invocado por `execFile` con array de argumentos; las URLs vienen del manifiesto, nunca de
  entrada libre. Cero paquetes nuevos (curl del sistema + stdlib de Node).

## Verificación

| gate | resultado |
|------|-----------|
| `<automated>` Task 1 | `PATRONES_OK` |
| filas `^\| P-` en 115-PATRONES.md | 55 (28 de §1 + 27 de §4) ≥ 20 |
| ids fuera del esquema `P-NN-cNN` | 0 |
| 7 hosts emitidos presentes | sin salida (todos) |
| celdas vacías | ninguna |
| `<automated>` Task 2 | `RUNNER_OK 27 7` (pre-retiro) |
| `DELAY_MS` | 2500 ≥ 2000 |
| concurrencia | `SIN_CONCURRENCIA` |
| gate de orden sin `115-ROBOTS.txt` | exit 1, sin `.json` escrito |
| smoke `--robots` un host | exit 0, 1 registro terminado en `/robots.txt` |
| filtro sin match | exit 2 |
| `<automated>` Task 3 | `ROBOTS_OK` |
| líneas `^VEREDICTO` | 7 |
| retiros sin directiva citada | 0 |
| `pendiente` / `TBD` en 115-ROBOTS.txt | ninguno |
| sincronía manifiesto ↔ runner | `SYNC_OK 19` |
| credenciales en artefactos | `SIN_CREDENCIALES` |

## Known Stubs

Ninguno. Los artefactos son documentales y el runner queda funcional; la muestra live es,
por diseño del plan, trabajo del Plan 02.

## Self-Check: PASSED

Los 4 archivos declarados existen en disco y los 3 commits de task existen en el historial
(`907867a`, `91566c8`, `915b638`).
