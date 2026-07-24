---
phase: 100-panel-p1c-landing-panel
plan: 03
subsystem: frontend
tags: [rsc, bento, panel-actualidad, landing, force-dynamic, honesty-contract, self-modification]

# Dependency graph
requires:
  - phase: 100-02
    provides: "components/panel-actualidad.tsx — RSC PanelActualidad() bajo Suspense, cero agregación on-read"
  - phase: 100-01
    provides: "guards (SUPERFICIES_PANEL + cero-hex/tipografía) mordiendo panel-actualidad.tsx"
provides:
  - "app/app/page.tsx — landing con <PanelActualidad/> montado bajo Suspense EN LUGAR del cuerpo producto-céntrico; hero + candados + force-dynamic intactos"
  - "app/app/page.test.tsx — mock del panel + Contract 3 reescrito al montaje; Contract 1/2 byte-idénticos; force-dynamic protegido por assert"
affects: [100-04, home, landing, panel-mount]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Self-modification quirúrgica de page.tsx: reemplazar el BODY (germ tiles) por <Suspense><PanelActualidad/></Suspense>, hero/accent/entry-cards LOCKED byte-idénticos"
    - "El test-contrato de la home viaja con el código: mock del panel espejo del germ mock + Contract 3 reescrito preservando el assert force-dynamic (build-marker LOAD-BEARING)"

key-files:
  created: []
  modified:
    - app/app/page.tsx
    - app/app/page.test.tsx

key-decisions:
  - "actualidad-module.tsx CONSERVADO-no-borrado (RESEARCH Open Question #1): page.tsx retira su import (germen desmontado), el archivo sigue en el repo y en SUPERFICIES_HOME; no se arrastra cambio de guard en esta wave"
  - "Un solo <Suspense> boundary para el panel (el panel emite N tiles en un fragmento): la RPC lenta nunca bloquea el hero, espejo del idiom germ; BloqueSkeleton reusado con span={4}"
  - "Entry-cards movidos DEBAJO del panel (UI-SPEC §Panel Layout, discreción de layout) con copy byte-idéntico; orden DOM hero → /sobre → entry-cards preservado (BENTO-05 (b) intacto porque el panel mockeado no aporta links)"
  - "Contract 3 conserva el assert HomeModule.dynamic === 'force-dynamic' (T-100-09, build-marker LOAD-BEARING) y añade asserts de AUSENCIA del cuerpo producto-céntrico retirado (wrapper lineal + 3 germ tiles)"

patterns-established:
  - "Montaje de panel de señales en la home: reemplazar el BODY producto-céntrico conservando hero/candados/URL/anchors/force-dynamic byte-idénticos; el test-contrato se reescribe en el mismo commit-set"

requirements-completed: [PANEL-01, PANEL-02]

# Metrics
duration: ~10min
completed: 2026-07-24
---

# Phase 100 Plan 03: Montaje del PanelActualidad en la landing (Wave 3) Summary

**La home `/` ahora monta `<PanelActualidad/>` bajo Suspense EN LUGAR del cuerpo producto-céntrico (los 3 germ tiles Votado/Urgencias/Frescura de actualidad-module.tsx): las señales SEN validadas de la RPC bounded reemplazan al folleto, reusando BentoGrid/tokens y conservando byte-idénticos el hero (kicker+h1+SearchBox), el tile accent "¿Cómo leer esto?", los 3 entry-cards (movidos debajo del panel), la URL/section[id]/scroll-margin y `export const dynamic = "force-dynamic"` (LOAD-BEARING). El test-contrato pre-existente `page.test.tsx` viajó con el código: mockea el panel (espejo del germ mock retirado) y su Contract 3 se reescribió para asertar el montaje preservando la garantía force-dynamic. Suite completa verde (1263/1263), tsc 0, guards verdes.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-24
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `app/app/page.tsx`: importa `PanelActualidad` de `@/components/panel-actualidad` y retira el import de `@/components/actualidad-module` (los 3 germ tiles) — el germen queda desmontado, no borrado.
- Los 3 germ tiles bajo Suspense (VotadoEstaSemana/UrgenciasVigentes/UltimaActualizacion) fueron reemplazados por un único `<Suspense fallback={<BloqueSkeleton span={4} />}><PanelActualidad /></Suspense>` (el panel emite un `BentoTile` por `tipo_senal` en un fragmento; `BloqueSkeleton` reusado).
- Los 3 entry-cards (`ENTRY_CARDS`, `<nav aria-label="Secciones del sitio">`) movidos DEBAJO del panel (UI-SPEC §Panel Layout) con su copy LOCKED byte-idéntico.
- `force-dynamic` (ahora L15), hero (kicker+h1+SearchBox), accent "¿Cómo leer esto?" → /sobre, `EXAMPLE_CHIPS`, URL, `section[id]`/scroll-margin, `max-w-[1120px]` — todos intactos (git diff confirma cero cambios de texto en los rangos LOCKED).
- `app/app/page.test.tsx`: `vi.mock("@/components/panel-actualidad", () => ({ PanelActualidad: () => null }))` espejo del germ mock; el mock de `@/components/actualidad-module` se retiró (page.tsx ya no lo importa).
- Contract 3 reescrito: conserva `expect(HomeModule.dynamic).toBe("force-dynamic")` (T-100-09, build-marker LOAD-BEARING) + render sin throw; el assert "no wrapper lineal ActualidadModule" se conserva como no-regresión y se añaden asserts de ausencia de los 3 germ tiles producto-céntricos retirados.
- Contract 1 (hero) y Contract 2 (accent + entry-cards) byte-idénticos; BENTO-05 orden DOM preservado (el panel mockeado a null no aporta links → hero → /sobre → /buscar → /parlamentarios → /agenda intacto).
- Suite app 1263/1263 verde; `pnpm exec tsc --noEmit` exit 0; guards (anti-insinuación + cero-hex + tipografía + lockdown) verdes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Montar PanelActualidad en page.tsx reemplazando el cuerpo producto-céntrico** - `9e876fb` (feat)
2. **Task 2: Actualizar page.test.tsx (mock del panel + Contract 3 reescrito) + suite completa** - `9f5c0a3` (test)

## Files Created/Modified

- `app/app/page.tsx` (modified) - Import de `PanelActualidad`; los 3 germ tiles bajo Suspense reemplazados por `<Suspense><PanelActualidad/></Suspense>`; entry-cards movidos debajo; force-dynamic/hero/accent/copy/URL/anchors intactos. Comentarios de cabecera actualizados (el panel lee las señales precomputadas — rationale de force-dynamic sigue vigente).
- `app/app/page.test.tsx` (modified) - Mock del panel (espejo del germ mock, que se retiró); Contract 3 reescrito al montaje conservando el assert force-dynamic; comentarios de restricción-de-mocks de BENTO-05 actualizados al panel; Contract 1/2 byte-idénticos.

## Decisions Made

- **actualidad-module.tsx CONSERVADO-no-borrado** (RESEARCH Open Question #1): `page.tsx` deja de importarlo (germen desmontado), pero el archivo permanece en el repo y en `SUPERFICIES_HOME` del guard — no se arrastra ningún cambio de guard en esta wave. Su mock en el test se retira porque ya no se importa.
- **Un solo `<Suspense>` boundary** para el panel: `PanelActualidad` emite N tiles en un fragmento, así que un único boundary (con `BloqueSkeleton span={4}`) basta para que la RPC lenta nunca bloquee el hero — espejo del idiom germ, sin multiplicar boundaries.
- **Entry-cards movidos DEBAJO del panel** (UI-SPEC §Panel Layout, discreción de layout): el copy queda byte-idéntico y el orden DOM hero → /sobre → entry-cards se preserva, así que BENTO-05 (b)/(e) NO requirieron ajuste (el panel mockeado a null no aporta links ni secciones al árbol jsdom).
- **Contract 3 conserva la garantía force-dynamic:** el assert `HomeModule.dynamic === "force-dynamic"` (T-100-09) sigue protegiendo el build-marker LOAD-BEARING; se reescribieron solo los asserts obsoletos (el "retiro del wrapper lineal" se conserva como no-regresión y se le suma la ausencia de los germ tiles).

## Deviations from Plan

None — plan ejecutado exactamente como fue escrito. La deuda pre-existente conocida `app/lib/buscar.test.ts:193` (drift Phase 89, similarity 0→null) documentada en el plan NO apareció: la suite completa corrió 1263/1263 verde (ese test pasa hoy). No hubo regresión atribuible a Phase 100.

## Authentication Gates

None.

## Known Stubs

None — la home monta el `PanelActualidad` real (que lee la RPC precomputada `actualidad_senales_panel` con fuente+fecha o supresión verbatim, sin datos hardcodeados). No se introduce ningún stub. El componente `actualidad-module.tsx` queda desmontado pero funcional (near-clone conservado por decisión de research), no es un stub.

## Threat Flags

None — no se introduce superficie de red/auth/schema nueva. La modificación es un swap de nodos JSX en un RSC page (`/`) que ya leía datos vivos server-side. Mitigaciones del threat register verificadas:
- **T-100-09 (DoS por force-dynamic omitido):** `export const dynamic = "force-dynamic"` preservado (L15, grep confirma) + protegido por `expect(HomeModule.dynamic).toBe("force-dynamic")` en page.test.tsx (ahora en scope) — el test falla si se borra.
- **T-100-10 (tampering del copy hero LOCKED):** git diff acotado al montaje del panel; copy hero/accent/ENTRY_CARDS/EXAMPLE_CHIPS byte-idéntico (verificado por grep sobre el diff); Contract 1/2 de page.test.tsx sin cambio.
- **T-100-11 (ruptura de SEO/anchors):** URL raíz sin cambio; `section[id]`/scroll-margin intactos (heredados de layout.tsx/globals; no tocados); BENTO-05 orden DOM verde.

## User Setup Required

None - no external service configuration required. NO deploy en esta wave (eso es Plan 100-04). NO flag flip. NO widening de CSP.

## Next Phase Readiness

- Wave 3 (montaje) CERRADA: la home monta el panel de actualidad; hero/candados/force-dynamic/URL/anchors intactos; suite/tsc/guards verdes.
- Plan 100-04 (Wave 4): benchmark BrowserOS (senado.cl/camara.cl portada/actualidad) + gate cold-read sobre el DEPLOY REAL (workers.dev) — verdict "comprensible" para periodista/tramitador/ciudadano + candados verificados por `getComputedStyle` (la cascada solo se caza en deploy real, gotcha v6.1/v8.0).
- El código de Phase 100 (panel + montaje) está listo para deploy + gate.

## Self-Check: PASSED

- FOUND: `.planning/phases/100-panel-p1c-landing-panel/100-03-SUMMARY.md`
- FOUND: `app/app/page.tsx` (modified — importa PanelActualidad, force-dynamic L15)
- FOUND: `app/app/page.test.tsx` (modified — mockea @/components/panel-actualidad)
- FOUND commit: `9e876fb` (Task 1)
- FOUND commit: `9f5c0a3` (Task 2)

---
*Phase: 100-panel-p1c-landing-panel*
*Completed: 2026-07-24*
