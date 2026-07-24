---
phase: 101-relaciones-p2a-audit-brecha-bloque-relaciones-comparar-coali
plan: 02
subsystem: frontend
tags: [relaciones, cross-links, anti-insinuacion, lockdown-guard, wave-0, composicion, ficha]

# Dependency graph
requires:
  - phase: 101-01 (audit N/M)
    provides: "zona SOLO-Senado (diputados 155->0), militancia histórica net-new 696 LOCKED, lobby DIFERIDO"
  - phase: 91 (0060/0061 cross-link RPCs)
    provides: "4 CrossLinkBloque montados + LEYENDA_CROSS_LINK + crossLinkReader"
provides:
  - "SUPERFICIES_RELACIONES (4 superficies: relaciones-section, relaciones-eje-comparar, comparar/page, comparar-selector) en el linter anti-insinuación ANTES del copy (Wave 0)"
  - "mutation self-check RELACIONES: el guard MUERDE ante aliado/bloque de/coordina con"
  - "militancia_historica_compartida allowlistada (Direction-A/B) + migración 0067 ESCRITA (net-new-only 696, cruce por partido_alias) — NO aplicada a PROD"
  - "RelacionesSection: bloque relaciones above-the-fold en <section id=relaciones> con heading + leyenda de grupo + grid 2×2; CrossLinkBloque byte-intacto"
affects: [101-03 (/comparar + apply 0067 + consumo + pgTAP), ui-review (doble-espaciado mt-12 grid, chip #relaciones omitido)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0: registrar superficies en el linter ANTES del copy (loader tolera archivos ausentes → guard VERDE hoy, MUERDE al aterrizar)"
    - "Composición pura por children: wrapper recibe los 4 bloques ya renderizados → readers + CrossLinkBloque byte-intactos"
    - "Neutralizar mt-12 interno de bloques en grid con [&>section]:mt-0 SIN tocar el componente (Pitfall A4); frontera mt-12 preservada en la sección misma"
    - "Restar leyenda-que-niega-término-prohibido antes de negative-match (mismo idiom que NEGACIONES_LOCKED) en tests de shell"

key-files:
  created:
    - "app/components/relaciones-section.tsx"
    - "app/components/relaciones-section.test.tsx"
    - "supabase/migrations/0067_militancia_historica_compartida.sql"
  modified:
    - "app/lib/anti-insinuacion-guard.test.ts"
    - "app/lib/lockdown-guard.test.ts"
    - "app/app/parlamentario/[id]/page.tsx"
    - "app/app/parlamentario/[id]/page.test.tsx"

key-decisions:
  - "Variante de reuso de CrossLinkBloque = CHILDREN (composición pura): RelacionesSection recibe los 4 bloques ya renderizados → los readers (getCopartidarios etc.) y los sub-componentes CrossLink* quedan donde están en page.tsx; CrossLinkBloque byte-intacto (git diff vacío)"
  - "Chip #relaciones NO entró al rail: el patrón del rail es conteo-driven (cada RailEntry deriva de un CarrilEstado); el bloque relaciones no tiene un conteo único (4 RPCs independientes bajo Suspense). id=relaciones queda deep-linkable con scroll-margin-top:5rem auto. Omisión anotada para ui-review."
  - "Migración 0067 ESCRITA en este plan (net-new-only 696 LOCKED, cruce por partido_alias) para no dejar huérfana la entrada del allowlist en Direction-B; apply+consumo+pgTAP = Plan 03"

requirements-completed: [REL-02]

# Metrics
duration: ~22min
completed: 2026-07-24
---

# Phase 101 Plan 02: Bloque relaciones above-the-fold + Wave 0 guards Summary

**Wave 0 extiende ambos guards (SUPERFICIES_RELACIONES + self-check que MUERDE, militancia_historica_compartida allowlistada) ANTES de que aterrice copy/RPC; luego des-entierra por COMPOSICIÓN PURA los 4 CrossLinkBloque en un `<section id=relaciones>` above-the-fold con heading + leyenda de grupo + grid 2×2, dejando CrossLinkBloque byte-intacto.**

## Performance

- **Duration:** ~22 min
- **Tasks:** 2
- **Files:** 3 created, 4 modified

## Accomplishments

- **Task 1 (Wave 0 guards):** `SUPERFICIES_RELACIONES` (4 superficies) + spread en el scan loop del linter anti-insinuación; el loader try/catch ya tolera las 3 superficies aún ausentes (relaciones-eje-comparar / comparar/page / comparar-selector) → guard VERDE hoy, MUERDE cuando Plan 03 las cree. Mutation self-check RELACIONES prueba que el guard caza `aliado`/`bloque de`/`coordina con` inyectados. `militancia_historica_compartida` allowlistada alfabéticamente (entre `match_proyectos` y `militancias_de_parlamentario`).
- **Task 2 (REL-02):** `RelacionesSection` (wrapper de composición pura) monta `<section id="relaciones" className="mt-12">` con heading "Relaciones con otros parlamentarios" + leyenda de grupo `LEYENDA_CROSS_LINK` verbatim + grid `grid-cols-1 md:grid-cols-2 gap-4 [&>section]:mt-0`. En `page.tsx` los 4 `<Suspense><CrossLink*/></Suspense>` se MOVIERON del final de columna (era 283-294) a tras `MilitanciasSection` y antes de `CarrilesSection` — above-the-fold. RTL verifica sección + heading + leyenda 1× + 4 bloques + mt-12 + neutralización del grid.
- **Verificación:** `pnpm test --run anti-insinuacion-guard lockdown-guard relaciones-section parlamentario/[id]/page` = 1275 verde; `tsc -b` exit 0; `cross-links-parlamentario.tsx` git diff VACÍO (byte-intacto); cero hex / cero text-[Npx] en el componente nuevo.

## Task Commits

1. **Task 1 (Wave 0 guards + 0067 migración)** — `836094b` (test)
2. **Task 2 (RelacionesSection above-the-fold + fix negative-match)** — `ec5b040` (feat)

## Files Created/Modified

- `app/lib/anti-insinuacion-guard.test.ts` — SUPERFICIES_RELACIONES + spread + self-check RELACIONES
- `app/lib/lockdown-guard.test.ts` — militancia_historica_compartida en PUBLIC_RPC_ALLOWLIST
- `supabase/migrations/0067_militancia_historica_compartida.sql` — RPC net-new-only (696) secdef, cruce por partido_alias, doble-revoke; NO aplicada a PROD
- `app/components/relaciones-section.tsx` — wrapper de composición <section id=relaciones>
- `app/components/relaciones-section.test.tsx` — RTL del wrapper
- `app/app/parlamentario/[id]/page.tsx` — montaje above-the-fold + import
- `app/app/parlamentario/[id]/page.test.tsx` — resta LEYENDA_CROSS_LINK antes del negative-match

## Decisions Made

- **Reuso de CrossLinkBloque = CHILDREN (composición pura).** La Discreción del plan ofrecía (a) exportar los sub-componentes de page.tsx o (b) pasarlos como children. Se eligió (b): `RelacionesSection` recibe los 4 bloques YA renderizados. Ventaja: los readers (`crossLinkReader`/`getCopartidarios` etc.) y los sub-componentes `CrossLink*` NO se mueven; `CrossLinkBloque` queda byte-intacto (git diff vacío). Cada bloque conserva su `<Suspense fallback={null}>` para streaming independiente.
- **Chip `#relaciones` OMITIDO del rail.** El patrón del rail (`construirChips` → `chipToRailEntry`) es conteo-driven: cada `RailEntry` deriva de un `CarrilEstado` 3-estado. El bloque relaciones no tiene un conteo único (son 4 RPCs independientes que streamean bajo Suspense), así que un chip requeriría fabricar un conteo sintético que rompería el contrato. Per el plan ("SOLO si el patrón del rail soporta un ancla no-carril; si no, dejar deep-linkable y anotar"), se dejó `id="relaciones"` deep-linkable (`scroll-margin-top:5rem` auto desde globals.css). **Anotado para ui-review.**
- **Migración 0067 ESCRITA aquí** (ver Deviations) con la decisión LOCKED del audit (net-new-only 696, cruce por `partido_alias`, EXCLUYE pares que ya comparten el partido vigente).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migración 0067 ESCRITA para no dejar huérfana la entrada del allowlist en Direction-B**
- **Found during:** Task 1
- **Issue:** El plan afirma que allowlistar `militancia_historica_compartida` "satisface Direction-B por adelantado" y espera ambos guards VERDES. Pero el código del lockdown-guard prueba lo contrario: **Direction-B (bloque A2) es `allowlist ⊆ definidas-en-migraciones`** — una entrada del allowlist SIN una `create function` en `supabase/migrations/` es un ORPHAN → el test FALLA (`orphans` no vacío). El plan confundió Direction-A (served⊆allowlist, que sí se satisface "por adelantado" porque aún no hay consumidor) con Direction-B (allowlist⊆definidas, que exige la definición). La migración 0067 NO existía (solo 0060-0066).
- **Fix:** Se escribió `supabase/migrations/0067_militancia_historica_compartida.sql` definiendo la RPC VERBATIM del molde 0061 (RESEARCH Pattern 1), con la decisión LOCKED del audit 101-01 §4: **net-new-only (696)** — cruce por `partido_alias` (Pitfall 1), EXCLUYE con `not exists` los pares que ya comparten el partido de la militancia VIGENTE (esos ya salen en copartidarios 0061). secdef, `search_path=''`, LIMIT 20, `total_n` window, doble-revoke, CERO grant. Consistente con el patrón del codebase (migración escrita en un plan, aplicada en otro). **NO aplicada a PROD** — el apply (`psql --single-transaction`), el consumo (5º bloque ficha + eje /comparar) y el pgTAP contra el schema aplicado son de Plan 03.
- **Files modified:** supabase/migrations/0067_militancia_historica_compartida.sql (created)
- **Verification:** Direction-B (A2) verde con la definición presente; `pnpm test --run lockdown-guard` PASS.
- **Committed in:** `836094b`

**2. [Rule 1 - Bug] page.test.tsx negative-match se auto-cazaba sobre la leyenda de grupo negada**
- **Found during:** Task 2
- **Issue:** El montaje de `RelacionesSection` above-the-fold puso la leyenda de grupo `LEYENDA_CROSS_LINK` (CONTIENE "afinidad" en un contexto que lo NIEGA) en el SHELL de la página. El test pre-existente `page.test.tsx:321` (`NET gate ON`) hace un `expect(html).not.toMatch(/…afinidad…/i)` crudo sobre el shell renderizado → el "afinidad" negado de la leyenda lo hacía fallar. Es exactamente el mismo problema que NEGACIONES_LOCKED resuelve en el linter, pero este test usaba un negative-match sin la resta.
- **Fix:** Restar `LEYENDA_CROSS_LINK` del html (`html.split(LEYENDA_CROSS_LINK).join(" ")`) ANTES del negative-match — mismo idiom que NEGACIONES_LOCKED. El test sigue MORDIENDO vocabulario de insinuación genuino (influencia/afinidad/score fuera de la leyenda) pero tolera la leyenda legítimamente negada.
- **Files modified:** app/app/parlamentario/[id]/page.test.tsx
- **Verification:** `pnpm test --run parlamentario/[id]/page` PASS (1275 verde total).
- **Committed in:** `ec5b040`

---

**Total deviations:** 2 auto-fixed (1 Rule 3 blocking — la premisa del plan sobre Direction-B era incorrecta; 1 Rule 1 bug — el test de shell se auto-cazaba sobre la leyenda negada del bloque des-enterrado).
**Impact on plan:** Cero scope creep. La 0067 escrita adelanta trabajo que Plan 03 igual necesitaría; Plan 03 conserva apply + consumo + pgTAP + net-new WHERE refinable.

## Known Stubs

Ninguno en las superficies de este plan. Las 3 superficies aún ausentes de `SUPERFICIES_RELACIONES` (relaciones-eje-comparar / comparar/page / comparar-selector) son ausencias INTENCIONALES de Wave 0 — el loader del guard las tolera y las cazará cuando Plan 03 las cree. La migración 0067 está escrita-no-aplicada por diseño (apply = Plan 03).

## Threat Flags

Ninguno. Las mitigaciones del threat_model (T-101-04 SUPERFICIES_RELACIONES antes del copy; T-101-05 RPC allowlistada; T-101-06 grid es layout, no re-ordena) están implementadas. CERO paquetes nuevos (T-101-SC).

## Notes for ui-review

- **Doble-espaciado mt-12 en el grid:** cada `CrossLinkBloque` emite su propia `<section className="mt-12">`. Dentro del grid 2×2 eso se neutraliza con `[&>section]:mt-0` en el contenedor del grid (sin tocar `CrossLinkBloque`). La frontera anti-insinuación mt-12 vive en la `<section id="relaciones">` misma (entre relaciones y sus hermanas militancias/carriles). **Verificar visualmente en deploy real** que el gap-4 del grid da ritmo correcto y que no hay colapso ni doble-espaciado entre celdas (cascada CSS solo cazable con getComputedStyle en deploy, memoria v6.1/v8.0).
- **Chip #relaciones omitido del rail:** el ancla es deep-linkable pero NO tiene entrada en el rail sticky. Evaluar si el rail debería mostrar "Relaciones" como ancla no-conteo (requeriría extender el contrato RailEntry). Por ahora fuera de alcance.

## Next Phase Readiness

- **Plan 03 DESBLOQUEADO:** `SUPERFICIES_RELACIONES` ya cubre las 3 superficies de /comparar (muerden al aterrizar el copy); `militancia_historica_compartida` allowlistada + migración 0067 escrita → Plan 03 solo aplica (psql), consume (5º bloque ficha + eje /comparar), escribe el pgTAP contra el schema aplicado, y refina el WHERE net-new si el audit lo exige. `RelacionesSection` es el wrapper donde Plan 03 puede insertar un 5º bloque (militancia histórica) como children adicional.

---
*Phase: 101-relaciones-p2a-audit-brecha-bloque-relaciones-comparar-coali*
*Completed: 2026-07-24*

## Self-Check: PASSED
- FOUND: app/components/relaciones-section.tsx
- FOUND: app/components/relaciones-section.test.tsx
- FOUND: supabase/migrations/0067_militancia_historica_compartida.sql
- FOUND: .planning/phases/101-.../101-02-SUMMARY.md
- FOUND commit: 836094b (Task 1)
- FOUND commit: ec5b040 (Task 2)
