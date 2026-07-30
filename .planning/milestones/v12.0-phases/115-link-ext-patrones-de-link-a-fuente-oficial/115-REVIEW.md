---
phase: 115-link-ext-patrones-de-link-a-fuente-oficial
reviewed: 2026-07-28T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - app/components/buscar-filtros.tsx
  - app/components/buscar-filtros.test.tsx
  - app/components/provenance-badge.tsx
  - app/components/provenance-badge.test.tsx
  - app/components/timeline-event.tsx
  - app/components/timeline-view.test.tsx
  - app/lib/anti-insinuacion-guard.test.ts
  - scripts/probar-links-externos.mjs
findings:
  critical: 1
  warning: 6
  info: 6
  total: 13
status: fixed
fixed_at: 2026-07-28
fixed:
  critical: 1
  warning: 6
  info: 6
  total: 13
skipped: 0
---

# Phase 115: Code Review Report

## Estado de los fixes (2026-07-28)

Los 13 hallazgos quedaron **corregidos**; ninguno se saltó. Commit atómico por hallazgo
(WR-02+WR-03 y WR-04+WR-05 comparten commit por vivir en el mismo archivo y en el mismo
bloque de código).

| ID | estado | commit | qué se hizo |
|----|--------|--------|-------------|
| CR-01 | fixed | `a006167` | leyenda + predicado a `app/lib/recurso-no-humano.ts` (single-source); el timeline la declara UNA vez por contenedor y por fila la lleva en `aria-label`/`title`; 6 tests nuevos |
| WR-01 | fixed | `c91f018` | `parsearRobots`/`pathProhibido`/`violacionesRobots`: el gate niega por código (fail-closed) antes de emitir request; `probar-links-externos.selfcheck.mjs` nuevo |
| WR-02 | fixed | `87ede82` | el guard IMPORTA `LEYENDA_RECURSO_NO_HUMANO` real en vez de una copia literal |
| WR-03 | fixed | `87ede82` | `TERMINOS_LINK_EXT` + tests (1b)/(1c): el vocabulario se verifica por código sobre TODAS las superficies (>20), no por grep sobre 4 |
| WR-04 | fixed | `c9cc51a` | prop `densidad`; 12 call-sites por-fila migrados a `"lista"` → cero repetición visible de la leyenda |
| WR-05 | fixed | `c9cc51a` | en `"lista"` no hay envoltorio `flex-col` (caja idéntica a un destino humano); 6 tests de layout |
| WR-06 | fixed | `6367f5e` | `sanearContacto()` (ASCII imprimible, ≤120) + defecto alcanzable |
| IN-01 | fixed | `7db7442` | `>= 400` en vez de la condición redundante |
| IN-02 | fixed | `7db7442` | rama explícita `3xx → REDIR-GENERICA` |
| IN-03 | fixed | `7db7442` | `CLASES` es el contrato: `clasificar()` valida y lanza |
| IN-04 | fixed | `7db7442` | `MAX_FILESIZE` 16 KB alineado al `--range`; exit 63 de curl no se reintenta |
| IN-05 | fixed | `a006167` | `esServicioDeDatos` compara paths por segmento, no por `includes` |
| IN-06 | fixed | `c9cc51a` | bloque Tooltip extraído a `conTooltip` (estaba duplicado en ambas ramas) |

**Gates:** suite `app` 1467 verde (1453 + 14 nuevos) · `packages` sin delta · `tsc --noEmit`
0 errores · guards verdes (incl. anti-insinuación extendido y el nuevo self-check del
runner, 25 comprobaciones) · `git diff` vacío en `.env`, `.env.example`, `package.json`,
`pnpm-lock.yaml` · cero deploy, cero flags, cero requests a hosts gubernamentales.

Documentos actualizados por el fix: `115-VERIFICACION.md` §2.3 y §"lectura fría" punto 4
(dónde ve el ciudadano la declaración de A-3 tras CR-01).

---

**Reviewed:** 2026-07-28
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

A-1 (`/buscar`) y A-2 (timeline) están correctamente implementadas: el rewrite decide por
host+path (no por substring), `safeExternalHref` envuelve el href del timeline, y los tests
ejercitan ambas ramas de call-site y el borde `javascript:`. El runner es sólido en lo esencial
(`execFile` con array, sin shell; secuencial con delay 2500 ms; sin secretos).

El defecto de fondo es de **cobertura de A-3/A-4**: la leyenda de limitación vive únicamente
dentro de `ProvenanceBadge`, y la superficie con la mayor población afectada por A-3
(`tramitacion_evento` → `opendata.camara.cl`, 3.797 filas según el propio veredicto) es
`timeline-event.tsx`, que **no renderiza `ProvenanceBadge`** desde SC7. Ahí el ciudadano sigue
viendo "Ver fuente oficial ↗" hacia un HTTP 500, sin declaración alguna. Secundariamente: el
gate de robots es de existencia y no de contenido, la leyenda se duplica como fixture en vez de
importarse, y el vocabulario nuevo del linter se agregó a una lista **global** verificada sólo
contra 4 superficies.

## Critical Issues

### CR-01: A-3 no cubre `timeline-event.tsx` — enlace "fuente oficial" a un HTTP 500 sin declaración

**File:** `app/components/timeline-event.tsx:31-33,57-67` (y `app/components/provenance-badge.tsx:132-151`)
**Issue:** `enlaceHumanoProyecto` sólo reescribe `tramitacion.senado.cl` + `/wspublico/`
(982 filas). Los eventos cuyo `enlace` es `opendata.camara.cl/...getVotaciones_Boletin`
—**3.797 filas de `tramitacion_evento`** según `115-VEREDICTO.md` §4 A-3— pasan **verbatim** y se
emiten como `<a>` "Ver fuente oficial ↗". La respuesta live registrada es **HTTP 500
`Falta el parámetro: prmBoletin`**. La mitigación de A-3 (`LEYENDA_RECURSO_NO_HUMANO` +
`esServicioDeDatos`) está cableada **exclusivamente dentro de `ProvenanceBadge`**, y
`timeline-event.tsx` no lo usa (SC7 retiró el badge por evento; ver comentario en `:12-14`).
Resultado: en la superficie con la mayor población A-3, el criterio de aceptación del veredicto
—«la leyenda aparece cuando el destino es un servicio de datos»— **no se cumple**, y el
`115-03-SUMMARY.md:85` declara A-3/A-4/A-5 cerradas. Para un producto cuyo valor rector es la
trazabilidad, un link rotulado "fuente oficial" que entrega un 500 sin decirlo es una afirmación
falsa hacia el ciudadano.
**Fix:** extraer el predicado y la leyenda a un módulo compartido (o exportarlos ya desde
`provenance-badge.tsx`, que es donde viven) y consumirlos también en el timeline:

```tsx
// timeline-event.tsx
import { esServicioDeDatos, LEYENDA_RECURSO_NO_HUMANO } from "@/components/provenance-badge";
...
{hrefFuente !== null && (
  <>
    <a href={hrefFuente} target="_blank" rel="noopener noreferrer" ...>Ver fuente oficial ↗</a>
    {esServicioDeDatos(hrefFuente) && (
      <span className="text-xs text-muted-foreground">{LEYENDA_RECURSO_NO_HUMANO}</span>
    )}
  </>
)}
```

Añadir un test en `timeline-view.test.tsx` con un evento de `opendata.camara.cl` que exija la
leyenda (hoy ningún test cubre ese caso en el timeline).

## Warnings

### WR-01: El gate robots-primero valida existencia, no contenido

**File:** `scripts/probar-links-externos.mjs:285-291`
**Issue:** el gate es `existsSync(ROBOTS_ARTEFACTO)`. Un `115-ROBOTS.txt` vacío, obsoleto o de
otra corrida lo satisface. El retiro de los 8 casos de `www.camara.cl` por `Disallow: /` está
implementado como **comentario a mano** (`:91-96`), no como lógica: agregar mañana un `CASOS`
de un host prohibido lo probaría igual. La afirmación del encabezado «el respeto al protocolo de
exclusión no depende de la disciplina del operador: lo impone el runner» no es cierta hoy.
**Fix:** parsear el artefacto y cruzarlo con el manifiesto antes de emitir requests:
verificar que cada `host` de `CASOS` tenga una sección en el artefacto y que su path no caiga bajo
un `Disallow:` del grupo `User-agent: *`; abortar con exit 1 nombrando el `id` ofensor.

### WR-02: La leyenda se duplica como literal en el test en vez de importarse → drift silencioso

**File:** `app/lib/anti-insinuacion-guard.test.ts:459`
**Issue:** `LEYENDA_RECURSO_NO_HUMANO_FIXTURE` es una copia literal del string. El comentario
afirma «el Test (3) monta la leyenda verbatim y exige `[]`», pero verifica **la copia**, no la
constante real. Si alguien edita `provenance-badge.tsx:35-36` hacia copy insinuante, este test
sigue verde (la única red que queda es el escaneo del archivo, que depende de que la constante
esté en texto no-comentado).
**Fix:** importar la constante real:
`import { LEYENDA_RECURSO_NO_HUMANO } from "../components/provenance-badge";` y usarla en el
fixture. Mismo cambio aplica a la duplicación en `provenance-badge.test.tsx` (ahí sí se importa,
pero se re-afirma el literal, lo que es aceptable como copy-lock).

### WR-03: Vocabulario nuevo agregado a una lista GLOBAL, verificado sólo contra 4 superficies

**File:** `app/lib/anti-insinuacion-guard.test.ts:608-615`
**Issue:** `TERMINOS_PROHIBIDOS` se aplica a **todas** las superficies de todos los carriles
(~50 archivos), pero el comentario declara la verificación hecha «por grep sobre las 4
superficies» de LINK-EXT. Términos genéricos del español (`oculta`, `ocultan`, `esconde`,
`censura`) son minas de falso positivo para copy factual futuro en superficies ajenas
(p. ej. «la tabla oculta las columnas sin dato»), y bloquearían fases no relacionadas.
**Fix:** o bien verificar el grep sobre el conjunto completo de superficies y dejarlo escrito, o
—preferible— asociar el vocabulario a su carril (`TERMINOS_POR_CARRIL`) y escanear cada superficie
sólo contra los términos que le aplican.

### WR-04: La leyenda se repite por fila en superficies de lista (regresión del defecto que SC7 ya corrigió)

**File:** `app/components/provenance-badge.tsx:132-151`
**Issue:** `ProvenanceBadge` se usa por fila en listas largas (`votos-por-parlamentario.tsx:547`,
`voto-ficha-row.tsx:136,220`, `patrimonio-*`, `lobby-*`). Si el `enlace` es de servicio de datos
—caso frecuente: `web-back.senado.cl/api/*`, `wspublico/senadores_vigentes.php`,
`datos.cplt.cl/sparql` con 9.441 filas— la misma leyenda de 90 caracteres se renderiza N veces.
Es exactamente el defecto que motivó SC7 («había 100+ badges idénticos en un timeline largo»).
**Fix:** declarar la limitación **una vez por sección** (junto al badge de encabezado), o
degradarla a `title`/tooltip cuando el badge se renderiza dentro de una lista (prop
`densidad="lista"`).

### WR-05: El envoltorio `flex-col` cambia el layout de un badge inline sin cobertura de test

**File:** `app/components/provenance-badge.tsx:133-134`
**Issue:** cuando el destino es servicio de datos, el badge deja de ser un `<span>` inline y pasa
a `inline-flex flex-col`. Varios call-sites lo colocan dentro de filas/celdas alineadas
horizontalmente (`aportes-por-contraparte.tsx:199`, `contratos-*`, `voto-ficha-row`). El cambio
de caja puede desalinear esas filas y **ningún test cubre el layout**; el comentario `:130-131`
promete que «para el resto de los destinos la estructura del DOM queda EXACTAMENTE igual», lo que
admite implícitamente que para estos sí cambia.
**Fix:** mantener el badge como hijo inline y colgar la leyenda del contenedor propio de cada
superficie, o verificar explícitamente los call-sites afectados en la lectura fría de la Phase 125.

### WR-06: `INGESTA_CONTACTO` se interpola sin sanear en la cabecera `User-Agent`

**File:** `scripts/probar-links-externos.mjs:63-64`
**Issue:** el valor de la variable de entorno se concatena directo al `User-Agent`. Un valor con
`\r\n` produce inyección de cabeceras en el request de `curl` (no hay shell, pero sí hay
construcción de cabecera). Además el default `contacto@observatorio-congreso` no es un dominio
resoluble: el User-Agent "identificatorio" que exige CLAUDE.md ofrece un contacto inalcanzable.
**Fix:** validar/normalizar antes de usar
(`const CONTACTO = (process.env.INGESTA_CONTACTO || DEFECTO).replace(/[\r\n]/g, "").slice(0, 120);`)
y fijar un default con dominio real.

## Info

### IN-01: Condición redundante en `clasificar`

**File:** `scripts/probar-links-externos.mjs:180`
**Issue:** `r.http_code >= 500 || (r.http_code >= 400 && r.http_code < 500)` es simplemente
`r.http_code >= 400`. La forma actual sugiere una distinción que no existe.
**Fix:** `if (r.http_code === 0 || r.http_code >= 400) return "NO-DISPONIBLE";`

### IN-02: 3xx remanente cae a `OK`

**File:** `scripts/probar-links-externos.mjs:180-187`
**Issue:** con `--location`, un 3xx final (p. ej. 304, o redirect no seguido por límite) no cae en
ninguna rama y se etiqueta `OK`. Es el mismo tipo de defecto que el 400→`OK` ya corregido.
**Fix:** rama explícita `if (r.http_code >= 300 && r.http_code < 400) return "REDIR-GENERICA";`

### IN-03: `CLASES` exportado y nunca usado

**File:** `scripts/probar-links-externos.mjs:125`
**Issue:** la constante no valida nada ni se consume; `clasificar` puede devolver un valor fuera
de la lista sin que nadie lo note.
**Fix:** usarla como assert (`if (!CLASES.includes(c)) throw ...`) o eliminarla.

### IN-04: `--max-filesize 200000` incoherente con `--range 0-8191`

**File:** `scripts/probar-links-externos.mjs:67-68,140-141`
**Issue:** si el servidor ignora `Range`, el corte real es 200 KB y no 8 KB; y al excederse, curl
sale con error → se clasifica como fallo de red → **se reintenta**, doblando el request contra ese
host. Fricción innecesaria con la regla de ingesta respetuosa.
**Fix:** alinear `MAX_FILESIZE` a ~16 KB y no reintentar el código de salida 63 de curl.

### IN-05: `esServicioDeDatos` usa `includes` donde el veredicto habla de prefijo

**File:** `app/components/provenance-badge.tsx:57-59`
**Issue:** `path.includes("/sparql")` casa también `/docs/sparql-manual`, y
`path.startsWith("/api/")` no casa `https://web-back.senado.cl/api?x=1`. No hay falsos positivos
sobre los deep-links de `leylobby.gob.cl` (host no listado, verificado por test), pero los
predicados son más laxos/estrictos de lo que dice el comentario "host + path".
**Fix:** normalizar a comparación de segmentos de path (`path === "/sparql" || path.startsWith("/sparql/")`,
`path === "/api" || path.startsWith("/api/")`).

### IN-06: Bloque Tooltip duplicado en las dos ramas de retorno

**File:** `app/components/provenance-badge.tsx:135-145` y `154-164`
**Issue:** el mismo `TooltipProvider/Tooltip/TooltipContent` está escrito dos veces; una edición
futura de uno de los dos deriva silenciosamente.
**Fix:** extraer `const conTooltip = (<TooltipProvider>...</TooltipProvider>)` y envolverlo sólo
cuando hay leyenda.

---

_Reviewed: 2026-07-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
