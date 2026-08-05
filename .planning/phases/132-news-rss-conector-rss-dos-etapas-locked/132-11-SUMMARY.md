---
phase: 132-news-rss-conector-rss-dos-etapas-locked
plan: 11
subsystem: news
tags: [rss, parser, prefiltro-lexico, vitest, gap-closure]

# Dependency graph
requires:
  - phase: 132-news-rss-conector-rss-dos-etapas-locked
    provides: parse-rss.ts / prefiltro-lexico.ts / carga-run.ts / feeds.ts (132-04..132-10)
provides:
  - "parsePubDate tolerante a variantes RFC 822 (hora 1 dígito, sin segundos, zonas nombradas) con pubDate no parseable reportado en errores[]"
  - "Truncado de descripción en frontera de palabra con margen derivado del vocabulario (WR-13)"
  - "Test 'cero red' de carga-run.test.ts corre bajo un fetch que explota, con control positivo"
  - "fixtures.test.ts parsea cada fixture de verdad (items>0, errores==[]) y verifica marca de recorte"
affects: [132-review, 137-timeline-fechas]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Margen de truncado derivado de Math.max(...VOCABULARIO.map(len)), nunca un número mágico"
    - "Zonas horarias nombradas RFC 822 mapeadas a offset fijo (sin horario de verano) en ZONAS_NOMBRADAS"
    - "Marca visible <!-- recortado a N ítems, F-9 --> en fixtures editados a mano, verificada por test"

key-files:
  created: []
  modified:
    - packages/news/src/parse-rss.ts
    - packages/news/src/parse-rss.test.ts
    - packages/news/src/prefiltro-lexico.ts
    - packages/news/src/prefiltro-lexico.test.ts
    - packages/news/src/carga-run.test.ts
    - packages/news/src/fixtures.test.ts
    - packages/news/src/__fixtures__/latercera.xml
    - packages/news/src/__fixtures__/lacuarta.xml

key-decisions:
  - "El margen de truncado se deriva de VOCABULARIO_LEGISLATIVO (Math.max de longitudes) en vez de un literal, para que ampliar el vocabulario no reintroduzca el bug de WR-13"
  - "parsePubDate mantiene la prohibición LOCKED de new Date(...).toISOString() — la ampliación de variantes solo agrega piezas al mismo reformateo literal"
  - "pubDate ausente NO es un error (sin entrada en errores[]); pubDate presente pero no parseable SÍ lo es — control apareado explícito en el test"

patterns-established:
  - "Mutación manual + reversión documentada en SUMMARY para cada acceptance criteria de tipo 'mutación'"

requirements-completed: [NEWS-01, NEWS-02]

duration: 35min
completed: 2026-08-05
---

# Phase 132 Plan 11: Gap Closure (WR-12, WR-13, IN-01, IN-06) Summary

**parsePubDate ahora acepta variantes RFC 822 (hora de 1 dígito, segundos opcionales, zonas nombradas EST/EDT/CST/CDT/MST/MDT/PST/PDT) sin normalizar el offset, deja rastro en `errores[]` cuando un pubDate no parsea, el truncado de la descripción del pre-filtro léxico corta en frontera de palabra con margen derivado del vocabulario, y dos tests dejaron de certificar una omisión (assert tautológico eliminado, fixtures verificados como RSS parseable de verdad).**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3/3 completados
- **Files modified:** 8

## Accomplishments

- **WR-12:** `parsePubDate` amplía el regex (hora `\d{1,2}`, segundos opcionales, zonas nombradas mapeadas a offset fijo vía `ZONAS_NOMBRADAS`), preservando el offset original en todos los casos (jamás `new Date(...).toISOString()`). Un `pubDate` presente pero no parseable queda registrado en `errores[]` con el literal crudo; un `pubDate` ausente no genera entrada (control apareado explícito).
- **WR-13:** `construirTexto` corta con un margen extra (`LIMITE_DESCRIPCION + MARGEN_TRUNCADO`, donde `MARGEN_TRUNCADO` es la longitud del término más largo de `VOCABULARIO_LEGISLATIVO`) y limpia la cola parcial con `.replace(/\S*$/, "")`. Un término legislativo que cruza el char 600 ya no produce falso negativo; el control apareado (relleno no legislativo tras el límite) sigue descartando.
- **IN-01:** El assert tautológico `expect(typeof cargar).toBe("function")` fue eliminado. El nuevo test instala `vi.stubGlobal("fetch", () => { throw ... })`, corre `cargar()` completo con un writer in-memory bajo ese stub, y un control positivo confirma que el stub está activo (llamar a `fetch` explota).
- **IN-06:** `fixtures.test.ts` ahora parsea cada uno de los 5 fixtures con `parseRss` de verdad (`items > 0`, `errores === []`), en vez de solo contar/nombrar archivos. Los dos fixtures recortados a mano (`latercera.xml`, `lacuarta.xml`, F-9) llevan la marca visible `<!-- recortado a 20 ítems, F-9 -->` insertada justo después del prólogo XML, verificada por test dedicado. El conteo de `<item>` de ambos archivos se confirmó sin cambios (20 y 20) antes/después de insertar la marca.

## Task Commits

1. **Task 1: [WR-12] parsePubDate tolerante a variantes RFC 822** - `d31e844` (feat)
2. **Task 2: [WR-13] Truncado en frontera de palabra** - `e0f0fc1` (feat)
3. **Task 3: [IN-01 + IN-06] Tests que dejan de certificar una omisión** - `1098e40` (test)

_TDD: cada task incluyó las mutaciones obligatorias del plan, ejecutadas manualmente y revertidas (ver "Mutaciones ejecutadas" abajo). No se generaron commits separados de mutación — se documentan aquí porque fueron ejecutadas in-situ y revertidas antes de continuar._

## Files Created/Modified

- `packages/news/src/parse-rss.ts` — `ZONAS_NOMBRADAS`, regex ampliado (hora 1-2 dígitos, segundos opcionales, zonas nombradas), `errores.push` para `pubDate` no parseable
- `packages/news/src/parse-rss.test.ts` — 22 tests nuevos (variantes RFC 822, zonas nombradas x8, anti-normalización, ausente vs no-parseable)
- `packages/news/src/prefiltro-lexico.ts` — `MARGEN_TRUNCADO` derivado del vocabulario, `construirTexto` corta con margen + `.replace(/\S*$/, "")`
- `packages/news/src/prefiltro-lexico.test.ts` — 3 tests nuevos (término que cruza el límite pasa, control apareado descarta, vocabulario no podado)
- `packages/news/src/carga-run.test.ts` — describe "cero red" reescrito con `vi.stubGlobal` + control positivo, assert tautológico eliminado
- `packages/news/src/fixtures.test.ts` — `it.each` que parsea cada fixture de verdad + verificación de marca de recorte
- `packages/news/src/__fixtures__/latercera.xml`, `.../lacuarta.xml` — comentario XML de marca de recorte agregado (conteo de `<item>` sin cambios: 20/20)

## Decisions Made

- El margen de truncado se calcula (`Math.max(...VOCABULARIO_LEGISLATIVO.map(t => t.length))`) en vez de hardcodearse, para que ampliar el vocabulario no reintroduzca el bug de WR-13 en silencio.
- Se mantuvo intacta la restricción LOCKED de `parsePubDate` (nunca `new Date(...).toISOString()`); la ampliación de variantes solo agrega piezas al mismo reformateo literal, con comentario reforzado para disuadir "simplificaciones" futuras.
- El caso "pubDate ausente" y "pubDate presente pero no parseable" quedan como dos ramas explícitamente distintas en `parseRss` (uno no genera error, el otro sí), en vez de colapsarlos en una sola condición — necesario para el control apareado del acceptance criteria.

## Deviations from Plan

None - plan ejecutado tal como estaba escrito. Las 6 mutaciones del plan se ejecutaron manualmente y se revirtieron; ver detalle abajo.

## Mutaciones ejecutadas (registradas y revertidas)

1. **WR-12 — regex viejo (segundos obligatorios de 2 dígitos, sin zonas nombradas):** 10 tests de variantes cayeron (hora 1 dígito, sin día semana, zonas nombradas x8); el test de no-regresión (`"Wed, 05 Aug 2026 00:41:06 GMT"`) siguió PASANDO. Revertido.
2. **WR-12 — anti-normalización (`new Date(iso).toISOString()` en el camino de construcción):** 14 tests cayeron, incluido el de offset `-04:00` (el que protege el gotcha rector v9.0/v12.0). Revertido.
3. **WR-12 — quitar `errores.push` del pubDate no parseable:** el test "pubDate presente pero NO parseable" cayó; el control apareado "pubDate ausente" siguió PASANDO. Revertido.
4. **WR-13 — restaurar `.slice(0, LIMITE_DESCRIPCION)` a secas:** el test del término cruzando el límite cayó (`false` en vez de `true`); el control apareado (relleno no legislativo) siguió PASANDO. Revertido.
5. **IN-01 — quitar `vi.stubGlobal`:** el control positivo (`fetch` debía explotar) cayó como se esperaba (fetch real no lanzó `"red prohibida en tests"`). Revertido.
6. **IN-06 — corromper `exante.xml` (etiquetas `<item>`→`<itemBROKEN>`):** el test de ese fixture cayó (`items.length` 0, esperado >0). Revertido; conteo de `<item>` verificado en 10 antes/después de la restauración.

---

**Total deviations:** 0
**Impact on plan:** Ninguno — ejecución literal.

## Issues Encountered

Una primera mutación de IN-06 (eliminar `</channel>` de `exante.xml`) no hizo fallar el test porque `fast-xml-parser` tolera etiquetas sin cerrar (las colapsa), tal como ya advertía un comentario existente en `parse-rss.test.ts`. Se cambió la mutación a corromper los tags `<item>` (renombrarlos), que sí produce `items.length === 0` y demuestra que el test detecta la degradación. No afectó el código de producción, solo la elección de la mutación de verificación.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WR-12, WR-13, IN-01, IN-06 cerrados; WR-14 queda diferido con razón dura (documentado en `<deferred_con_razon>` del plan — exige tocar `@obs/ingest`, prohibido por D-132-B en esta fase).
- Suite `@obs/news` en 206 tests (baseline 123, piso del plan ≥123 ampliamente superado); `pnpm typecheck` y `pnpm guards` verdes.
- `git diff --name-only 7b188f3..HEAD -- packages/ingest/` = 0 archivos (D-132-B respetado).
- 137 (timeline por fecha) puede confiar en que un `pubDate` no parseable ahora se ve en `errores[]` del CLI, no como `null` silencioso indistinguible de "ausente".

---
*Phase: 132-news-rss-conector-rss-dos-etapas-locked*
*Completed: 2026-08-05*
