---
phase: 132-news-rss-conector-rss-dos-etapas-locked
plan: 04
subsystem: news
tags: [rss, xml-parsing, dedup, prefiltro-lexico, zod, fast-xml-parser, pure-functions]

requires: ["132-01"]
provides:
  - "parseRss: XML crudo → RssItem[] puro, offset del pubDate preservado (nunca normalizado a tz global)"
  - "canonicalizarUrl + urlHash: canonicalización de tracking + sha256 estable, PK de noticia/noticia_url_vista (D-13)"
  - "esLegislativo/terminosQueMatchean: pre-filtro léxico recall-first con frontera de palabra (D-05/D-06)"
affects: ["132-05", "132-06", "132-07"]

tech-stack:
  added: []
  patterns:
    - "parsePubDate: reformatea RFC822 a ISO SIN pasar por Date.toISOString() para preservar el offset original del feed (gotcha rector v9.0/v12.0)"
    - "RegExp de frontera de palabra precompiladas a nivel de módulo (const PATRONES) — String.includes() PROHIBIDO en el matching léxico"

key-files:
  created:
    - packages/news/src/model.ts
    - packages/news/src/parse-rss.ts
    - packages/news/src/parse-rss.test.ts
    - packages/news/src/canonicalizar-url.ts
    - packages/news/src/canonicalizar-url.test.ts
    - packages/news/src/prefiltro-lexico.ts
    - packages/news/src/prefiltro-lexico.test.ts
  modified: []

key-decisions:
  - "Los conteos de item literales de la plan-acceptance ('grep -c \"<item\"' válido porque los fixtures son multilínea) NO aplican a latercera/lacuarta: esos dos fixtures vienen minificados en 1 sola línea (F-9, recorte de 132-01). `grep -c` sobre ellos cuenta 1 línea, no 20 ítems. Se usó `grep -o \"<item\" | wc -l` para el conteo real (20/20), documentado en el test."
  - "El XML mal formado que hace lanzar a fast-xml-parser NO es un tag sin cerrar (la librería lo tolera y lo colapsa silenciosamente) sino un atributo con comilla sin cerrar (`<rss version=\"2.0\"`). Verificado empíricamente contra la librería real antes de escribir el test, para no fabricar un caso que nunca lanza."
  - "Los 3 titulares POSITIVOS literales del <behavior> del plan ('Senadores presentan bancada...', 'Gobierno logra despachar a ley...') no existen verbatim en la corrida real de los 5 fixtures capturados en 132-01 (feeds vivos del 2026-08-05, contenido distinto al ejemplo hipotético del plan). Se sustituyeron por 3 casos positivos REALES tomados de los fixtures (mismo espíritu: titulares legislativos genuinos), documentado en el test."
requirements-completed: [NEWS-02]

duration: ~50min
completed: 2026-08-05
---

# Phase 132 Plan 04: parse-rss + canonicalizar-url + prefiltro-lexico Summary

**Los 3 módulos puros de la Etapa 2 (parseo RSS con offset de fecha preservado,
canonicalización de URL con dedup nivel 1-2, y pre-filtro léxico recall-first con
frontera de palabra) — verificados contra los 5 feeds reales y con 9 mutaciones
obligatorias ejecutadas y revertidas.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3/3
- **Files created:** 7 (3 módulos + 3 tests + implícito ninguno modificado)
- **Tests:** 83 pasando en el paquete completo (18 + 11 + 29 en los 3 archivos nuevos, más 10+9+6 preexistentes de 132-01)

## Accomplishments

- `model.ts`: `RssItemSchema` (zod v4) con `link: z.url()` como identidad, `fechaPub`
  ISO con offset preservado (comentario explícito anti-normalización-tz-global).
- `parse-rss.ts`: `parseRss(xml, outlet)` puro — `XMLParser` de fast-xml-parser,
  `[].concat` fuerza array de nodo único, `txt()` copiado literal del analog de
  tramitación, `parsePubDate` reformatea RFC822 preservando el offset SIN pasar por
  `Date.toISOString()` (ese camino siempre convierte a UTC). Ítems inválidos se
  omiten con degradación honesta (`errores[]`). Pureza verificada: 0 ocurrencias de
  `fetch(`/`https?://` fuera de comentarios.
- `canonicalizar-url.ts`: `canonicalizarUrl` elimina `utm_*` + set congelado
  (`fbclid`/`gclid`/`mc_cid`/`mc_eid`/`igshid`/`ref`/`source`), quita fragmento y
  barra final redundante, host a minúsculas, ordena params restantes
  alfabéticamente. `urlHash` = sha256Hex (`@obs/ingest`) sobre la canónica UTF-8 —
  PK del ledger `noticia`/`noticia_url_vista` (D-13).
- `prefiltro-lexico.ts`: `VOCABULARIO_LEGISLATIVO` (30 términos) congelado,
  `esLegislativo`/`terminosQueMatchean` puros con RegExp de frontera de palabra
  precompiladas a nivel de módulo. `despojarHtml` elimina `<script>`/`<style>` CON
  su contenido antes de despojar el resto de tags. `fold` = NFD + strip diacríticos
  + lower (misma forma que `packages/core/src/nombre.ts`). `String.includes()`
  ausente del archivo completo (grep == 0).

## Task Commits

1. **Task 1: model.ts + parse-rss.ts contra los 5 fixtures reales** — `8b61a17` (feat)
2. **Task 2: canonicalizar-url.ts + urlHash (dedup nivel 1-2, D-13)** — `1ecf668` (feat)
3. **Task 3: prefiltro-lexico.ts — vocabulario congelado, frontera de palabra** — `01e7389` (feat)

## Mutaciones registradas (anti-vacuo)

Las 9 mutaciones exigidas por el plan (3+2+4) se ejecutaron manualmente y se
revirtieron; todas hicieron caer el test correspondiente.

**Task 1 (parse-rss.ts):**
1. Quitar `[].concat` que fuerza array → `asArray` devuelve `[]` para el nodo
   único → cae "un feed con un solo `<item>` devuelve 1 ítem, no revienta"
   (esperado 1, recibido 0). Revertido.
2. Reemplazar `parsePubDate` por `new Date(raw).toISOString()` → caen "cooperativa:
   pubDate -0400 preserva el offset original" (esperado `...T00:41:06-04:00`,
   recibido `...T04:41:06.000Z`) Y "latercera: pubDate +0000 se conserva tal cual"
   (esperado `+00:00`, recibido `.000Z`). Revertido.
3. Usar `guid` en vez de `link` como identidad del candidato → cae "biobiochile:
   guid difiere del link" (esperado el link real, recibido `?p=6913066`). Revertido.

**Task 2 (canonicalizar-url.ts):**
1. Quitar `utm_` del predicado `esParamTracking` (dejar solo el set exacto) → caen
   "elimina utm_source/utm_medium" Y "mismo hash con distinto orden de tracking"
   (el `utm_source` sobrevive en la canónica). Revertido.
2. Quitar el `.sort()` de las entradas de `searchParams` antes de reconstruir → cae
   "mismo hash con distinto orden de tracking" (canónicas distintas: `b=2&id=1` vs
   `b=2&id=1&utm_source=rss` porque el orden de deleción también cambia el resultado
   sin sort). Revertido.

**Task 3 (prefiltro-lexico.ts):**
1. Quitar el fold NFD (dejar solo lower+trim) → caen 5 tests (COMISIÓN DE HACIENDA,
   Megarreforma exante, boletín 12.345, Comisión mixta, fold determinista). Revertido.
2. Quitar el despojo de `<script>`/`<style>` (dejar solo el strip genérico de tags,
   que preserva el contenido de texto entre `<script>` y `</script>`) → caen los 2
   tests del script con "senado" (`esLegislativo` pasa cuando debía descartar, y
   `despojarHtml` deja "var senado=1;" en el resultado). Revertido.
3. Vaciar `VOCABULARIO_LEGISLATIVO` (ternario `[] ? [] : [...]` para forzar `[]`
   sin romper el tipo) → caen 15 tests, incluidos los 3 positivos reales, todos los
   de diacríticos, 4 de los 4 positivos de frontera, tasa (0% agregado) y
   `terminosQueMatchean`. Revertido.
4. Reemplazar el matching por frontera (`re.test(texto)`) por `texto.includes(termino)`
   → caen 4 de los 6 negativos de frontera (`ensalada`, `salarial`, `leyenda`,
   `Bradley`). Los otros 2 negativos (`veteranos`/`comisario`) NO contienen "veto"/
   "comision" como subcadena literal, así que sobreviven a ESTA mutación puntual —
   la garantía real de que son casos de frontera la da la RegExp explícita, no esta
   mutación por sí sola (documentado en el test). Revertido.

## Tasa de paso del pre-filtro léxico sobre los 5 feeds reales (REPORTE)

Corrida contra los ítems parseados de los 5 fixtures reales (132-01), impresa por
`console.log` en el test y verificada `> 0% y < 100%` (cero fuerte por ambos lados,
sin assert de rango):

| outlet | pasan/total | % |
|---|---|---|
| biobiochile | 3/20 | 15.0% |
| cooperativa | 1/15 | 6.7% |
| latercera | 0/20 | 0.0% |
| lacuarta | 1/20 | 5.0% |
| exante | 1/10 | 10.0% |
| **AGREGADO** | **6/85** | **7.1%** |

Tasa agregada 7.1% (< 35%), NO se ejecutó la rama de depuración por muestra de
`terminosQueMatchean` (esa rama solo aplica si la tasa supera 35%). No se podó el
vocabulario en ningún momento — todos los términos del `<action>` del plan quedaron
en `VOCABULARIO_LEGISLATIVO` sin excepción.

`latercera` con 0% se explica por el contenido real de la corrida capturada
(20 titulares de deportes/farándula/internacional, sin ningún titular legislativo
en esa muestra concreta de 20 — el feed vivo original tenía 100 ítems, recortado a
20 por F-9 de 132-01). No es un bug del matching: se verificó manualmente que
ninguno de los 20 titulares de `latercera.xml` contiene un término del vocabulario
con frontera de palabra.

## Files Created/Modified

- `packages/news/src/model.ts` — `RssItemSchema` (zod) + tipo `RssItem`
- `packages/news/src/parse-rss.ts` — `parseRss()`, `parsePubDate()`, `ParseRssError`
- `packages/news/src/parse-rss.test.ts` — 18 tests
- `packages/news/src/canonicalizar-url.ts` — `canonicalizarUrl()`, `urlHash()`, `PARAMS_TRACKING`, `UrlInvalidaError`
- `packages/news/src/canonicalizar-url.test.ts` — 11 tests
- `packages/news/src/prefiltro-lexico.ts` — `VOCABULARIO_LEGISLATIVO`, `esLegislativo()`, `terminosQueMatchean()`, `despojarHtml()`, `fold()`
- `packages/news/src/prefiltro-lexico.test.ts` — 29 tests

## Decisions Made

Ver `key-decisions` en el frontmatter — resumen: (1) el criterio literal `grep -c`
del plan para contar `<item>` no aplica a los 2 fixtures minificados en 1 línea
(latercera/lacuarta), se usó `grep -o | wc -l`; (2) el caso de "XML mal formado"
se verificó empíricamente contra fast-xml-parser real (tags sin cerrar NO lanzan,
atributos con comilla sin cerrar SÍ); (3) los titulares POSITIVOS literales del plan
no existen en la corrida real capturada, se sustituyeron por titulares reales
equivalentes de los mismos fixtures.

Ninguna de las tres es un cambio arquitectónico (Regla 4): son ajustes de
verificación empírica contra la realidad de las herramientas/datos, sin alterar el
alcance ni los artefactos comprometidos por el plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TS18048 en `parsePubDate`: acceso a grupos de captura posiblemente `undefined`**
- **Found during:** Task 1, `pnpm --filter @obs/news exec tsc -b`
- **Issue:** El destructuring de `m` (resultado de `RegExp.exec`/`match`) tipa cada
  grupo como `string | undefined` bajo `strict` de TS; el código accedía a
  `mesTxt.toLowerCase()` etc. sin narrow previo.
- **Fix:** Guard explícito `if (dd == null || ... || offRaw == null) return null;`
  antes de usar los grupos.
- **Files modified:** packages/news/src/parse-rss.ts
- **Verification:** `pnpm --filter @obs/news exec tsc -b` sale 0.
- **Committed in:** 8b61a17

**Total deviations:** 1 auto-fixed (bug de tipos, sin impacto en comportamiento —
el `if` del regex ya garantizaba que los 7 grupos existen cuando `m` no es null;
el guard solo satisface al type-checker).

## Issues Encountered

Ninguno adicional. `pnpm install --prefer-offline` se corrió una vez al inicio del
plan (el worktree había quedado detrás del HEAD de la wave 1 y requirió
`git reset --hard` al commit `3d36dff` antes de empezar — ver nota de contexto del
agente, no es un issue del plan en sí).

## User Setup Required

None - sin configuración externa requerida (módulos puros, sin red/DB/LLM).

## Next Phase Readiness

- Los 3 módulos puros de la Etapa 2 están completos, testeados (58 tests nuevos +
  25 preexistentes = 83 en el paquete) y disponibles para `132-05` (writer a
  Supabase) y `132-06` (barrel/orquestación que reemplaza el placeholder
  `src/index.ts`).
- `parseRss`/`canonicalizarUrl`/`urlHash`/`esLegislativo`/`terminosQueMatchean` son
  la base que `carga-run.ts` (132-05) debe consumir sin reescribir su propia lógica.
- Ningún blocker.

---
*Phase: 132-news-rss-conector-rss-dos-etapas-locked*
*Completed: 2026-08-05*

## Self-Check: PASSED

All 7 created files verified present on disk; all 3 task commits (8b61a17,
1ecf668, 01e7389) verified present in `git log --oneline --all`.
