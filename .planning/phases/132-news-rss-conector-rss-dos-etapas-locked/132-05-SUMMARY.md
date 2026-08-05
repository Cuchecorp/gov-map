---
phase: 132-news-rss-conector-rss-dos-etapas-locked
plan: 05
subsystem: database
tags: [supabase, upsert, idempotencia, dedup, pipeline, news, tdd]

requires:
  - phase: 132-02
    provides: "Schema aplicado 0084_noticia.sql (tablas noticia, noticia_url_vista, deny-all RLS)"
  - phase: 132-04
    provides: "model.ts (RssItem), canonicalizar-url.ts (urlHash/canonicalizarUrl), prefiltro-lexico.ts (esLegislativo)"
provides:
  - "NewsWriter (interfaz + InMemoryNewsWriter fake) para tests sin red ni DB"
  - "SupabaseNewsWriter con upsert idempotente por url_hash, chunking, dedupe defensivo"
  - "cargar() — orquestador de Etapa 2 con orden LOCKED (marcar vista ANTES del reject)"
affects: [132-06, 132-07]

tech-stack:
  added: []
  patterns:
    - "Writer inyectable (interfaz + fake in-memory + impl Supabase) espejando packages/tramitacion/src/writer.ts"
    - "Orden LOCKED verificado por traza de invocationCallOrder de mocks, no por estado final"
    - "Dedup en dos niveles: nivel 1 contra el ledger persistido (urlsYaVistas), nivel 2 dentro del lote (canonicalizarUrl colapsa utm_*)"

key-files:
  created:
    - packages/news/src/writer.ts
    - packages/news/src/writer-supabase.ts
    - packages/news/src/carga-run.ts
    - packages/news/src/carga-run.test.ts
  modified: []

key-decisions:
  - "carga-run.ts hace llamadas per-ítem a marcarVistas/upsertNoticias (no un solo upsert batch) para que un fallo de writer en un ítem no aborte el resto del lote — deviación menor del analog ingest-run.ts (batch por boletín), justificada por el requisito explícito de degradación honesta a nivel de ítem individual (SC del plan)."
  - "El marcado provisional en noticia_url_vista usa estado='descarta'/causa='prefiltro_lexico' como valor por defecto seguro; se sobreescribe con el resultado real tras evaluar esLegislativo (segunda llamada a marcarVistas), tal como sugiere la acción del plan."

patterns-established:
  - "Test de orden LOCKED por invocationCallOrder de vi.spyOn sobre writer.marcarVistas y el módulo prefiltro-lexico (esLegislativo), no por assert sobre estado final — permite que la mutación de reordenar el pipeline se detecte."

requirements-completed: [NEWS-01, NEWS-02]

duration: 45min
completed: 2026-08-05
---

# Phase 132 Plan 05: Etapa 2 orquestada (carga-run.ts) + writers Summary

**Escribió `NewsWriter`/`InMemoryNewsWriter`/`SupabaseNewsWriter` y el orquestador `cargar()` que marca toda URL vista ANTES de cualquier rechazo (orden LOCKED D-07/Pitfall 11), con idempotencia y dedup en dos niveles probados por mutación.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2/2 completed
- **Files modified:** 4 (todos creados)

## Accomplishments
- `writer.ts` + `writer-supabase.ts`: interfaz `NewsWriter`, fake in-memory, e impl Supabase con `upsert(onConflict:"url_hash")`, `dedupePorClave`, `CHUNK=500`, `urlsYaVistas` paginado (evita el cap de 1.000 filas de PostgREST).
- `carga-run.ts`: `cargar()` implementa el pipeline LOCKED exacto (canonicalizar → dedup nivel 1 → marcarVistas provisional → esLegislativo → upsertNoticias → marcarVistas final), con `errores[]` por ítem para degradación honesta.
- 10 tests (`carga-run.test.ts`) cubriendo orden LOCKED, idempotencia, dedup nivel 1, dedup nivel 2, invariante aritmético, degradación honesta, y preservación de campos (`fecha_pub`, `r2_path`, `contenido_hash`).
- 3 mutaciones ejecutadas manualmente contra el código y revertidas — las tres hicieron caer el test correspondiente (ver sección Mutaciones).

## Task Commits

Each task was committed atomically:

1. **Task 1: writer.ts (interfaz + InMemory) y writer-supabase.ts (upsert idempotente)** - `20811cf` (feat)
2. **Task 2: carga-run.ts — orden LOCKED + idempotencia** - `4272782` (feat, incluye tests TDD)

**Plan metadata:** (este commit — SUMMARY)

## Files Created/Modified
- `packages/news/src/writer.ts` - Interfaz `NewsWriter` + `InMemoryNewsWriter` (Maps por `url_hash`)
- `packages/news/src/writer-supabase.ts` - `SupabaseNewsWriter`: upsert idempotente, chunking, dedupe, paginación de `urlsYaVistas`
- `packages/news/src/carga-run.ts` - `cargar()`: orquestador de Etapa 2 con orden LOCKED
- `packages/news/src/carga-run.test.ts` - 10 tests (orden, idempotencia, dedup×2, conteos, degradación, datos preservados)

## Decisions Made
- Llamadas per-ítem (no batch único) en `cargar()` para writer.marcarVistas/upsertNoticias — permite que un solo ítem que revienta el writer no aborte el resto del lote (comportamiento explícito exigido por `<behavior>` del plan). `SupabaseNewsWriter` sigue soportando arrays batch (chunking a 500) para cuando se invoque con lotes mayores desde otros callers.
- El marcado provisional usa `estado:'descarta', causa:'prefiltro_lexico'` como valor por defecto conservador antes de conocer el resultado real del pre-filtro; se sobreescribe con una segunda llamada a `marcarVistas` tras `esLegislativo` — exactamente como sugiere la acción del plan ("Se puede hacer con un marcarVistas inicial + un segundo marcarVistas que actualice el resultado").

## Deviations from Plan

None - plan ejecutado tal como está escrito. La única decisión de implementación no explícita en el plan (llamadas per-ítem vs batch) está documentada arriba en "Decisions Made", no constituye una desviación de comportamiento — cumple literalmente el `<behavior>` del plan.

## Mutaciones (registradas per acceptance_criteria de Task 2)

Las tres mutaciones exigidas por el plan se ejecutaron manualmente sobre el código, se corrió `vitest run src/carga-run.test.ts`, se confirmó la caída del test correspondiente, y se revirtió la mutación antes de continuar:

1. **Orden LOCKED invertido** — mover `esLegislativo` antes de `writer.marcarVistas` (provisional) ⇒ el test "marca vista ANTES de evaluar esLegislativo" FALLÓ (`expected 2 to be less than 1`, comparando `invocationCallOrder`). Revertido.
2. **Idempotencia rota** — `InMemoryNewsWriter.upsertNoticias` cambiado a push ciego a un array interno en vez de `Map.set` por `url_hash` ⇒ los tests "correr cargar() 2 veces..." y "dos ítems... colapsan a una fila" FALLARON (`writer.noticias.size` quedó en 0 en vez de 1). Revertido.
3. **Dedup nivel 2 quitado** — `hash = item.link` (URL cruda) en vez de `hash = await urlHash(item.link)` (que canonicaliza internamente) ⇒ el test "dos ítems del mismo lote con URLs que difieren solo en utm_* colapsan a una fila" FALLÓ (`vistos` pasó de 1 a 2). Revertido.

Ninguna mutación quedó en el código final — las tres demuestran que los tests miran comportamiento real, no vacío.

## Issues Encountered
- El grep de verificación `fetch\(|Fetcher|createClient` sobre `carga-run.ts` matcheaba inicialmente contra un comentario de cabecera que mencionaba "Fetcher" en prosa (falso positivo, no código). Se reescribió el comentario sin la palabra literal "Fetcher" — el grep pasa a 0 sin cambiar comportamiento.
- El log de `vitest run` con color ANSI activo no matcheaba el patrón `grep -Eo "Tests +[0-9]+ passed"` del `<automated>` porque los códigos de escape se intercalan entre "Tests" y el número. Verificado localmente con `--no-color` (10/10 tests, patrón matchea limpio); el comportamiento real (10 tests pasan) es idéntico con o sin color — no es un problema del código bajo prueba.

## User Setup Required
None - no external service configuration required (schema ya aplicado en 132-02; SupabaseNewsWriter no se ejercita contra DB real en este plan, solo vía tests con fake in-memory y typecheck).

## Next Phase Readiness
- `NewsWriter`/`SupabaseNewsWriter`/`cargar()` listos para que 132-06/132-07 los conecten al CLI (`run-news-cli.ts`) y a la Etapa 1 real (fetch → R2 → `cargar()`).
- Suite completa del paquete `@obs/news`: 108/108 tests, `tsc -b` limpio.

---
*Phase: 132-news-rss-conector-rss-dos-etapas-locked*
*Completed: 2026-08-05*

## Self-Check: PASSED

All files created (writer.ts, writer-supabase.ts, carga-run.ts, carga-run.test.ts, this SUMMARY.md) verified present. Both task commits (20811cf, 4272782) verified in git log.
