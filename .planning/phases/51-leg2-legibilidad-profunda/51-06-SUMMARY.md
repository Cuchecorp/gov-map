---
phase: 51-leg2-legibilidad-profunda
plan: 06
subsystem: ui
tags: [footer, layout, next, metodologia, cc-by, atribucion, legal]

# Dependency graph
requires:
  - phase: 21-frontend-deploy-cloudflare
    provides: "layout.tsx con GlobalHeader + generateMetadata gate PUBLIC_INDEXABLE"
  - phase: 19-producto-diseno
    provides: "DESIGN-SYSTEM §6 trust line LOCKED + banned-vocab vallado + /sobre como molde de página honesta"
provides:
  - "Footer global (SC8) en toda página: atribución + CC BY 4.0 con scope-caveat + links Metodología/Sobre/Contacto + trust line LOCKED"
  - "Página /metodologia mínima y honesta (fuentes, 3 estados honestos, licencias por dataset, contacto)"
  - "Test estructural source-scan del footer (footer tras children, links, CC BY, no-ChileCompra/SERVEL, gate noindex intacto)"
affects: [51-07, futuros milestones de metodología/diccionario de datos]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Footer global en layout.tsx tras {children} — atribución CC BY 4.0 con scope-caveat que NO reafirma datasets no-CC-BY (ChileCompra/SERVEL)"
    - "Página estática honesta como twin de /sobre (metadata + main container max-w-3xl + h2/Separator + ← Volver al inicio)"
    - "Test estructural source-scan por process.cwd()+path.join (NUNCA import.meta.url — OneDrive)"

key-files:
  created:
    - app/app/metodologia/page.tsx
    - app/app/layout.test.tsx
  modified:
    - app/app/layout.tsx

key-decisions:
  - "El footer global NO nombra ChileCompra ni SERVEL: la línea CC BY 4.0 cubre solo la compilación propia; las atribuciones por-dataset viven en sus secciones y en /metodologia (T-51-18 scope-caveat, test-enforced)"
  - "Contacto = mailto:contacto@observatoriocongreso.cl (placeholder de dominio); links con touch-target min-h-11"
  - "/metodologia declara alcance honesto: NO promete diccionario de datos por sección ni tabla de frescura (milestone futuro, espeja /sobre)"

patterns-established:
  - "Footer global con scope-caveat de licencia: una línea CC BY global convive con licencias por-dataset sin reafirmarlas"
  - "Test source-scan del layout con strip de comentarios de bloque (cubre {/* … */} JSX)"

requirements-completed: [LEG2, SC8, SC9]

# Metrics
duration: 7min
completed: 2026-07-03
---

# Phase 51 Plan 06: Footer global + /metodologia Summary

**Footer global CC BY 4.0 con scope-caveat (no reafirma ChileCompra/SERVEL) en toda página, links resolubles a /metodologia y /sobre, y página /metodologia mínima y honesta (fuentes, 3 estados, licencias por dataset).**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-07-03T13:47:02Z
- **Completed:** 2026-07-03T13:50:00Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- Footer global en `layout.tsx` tras `{children}`: atribución de datos, licencia CC BY 4.0 con scope-caveat, links a /metodologia · /sobre · Contacto (mailto), y trust line LOCKED §6 al pie.
- Página `/metodologia` creada (antes 404): fuentes consultadas hoy, los 3 estados honestos, licencias por dataset que conviven, contacto — sin prometer diccionario de datos completo.
- Test estructural source-scan del footer (5 asserts): footer tras children, links, cadena "CC BY 4.0", ausencia de ChileCompra/SERVEL en el global, gate PUBLIC_INDEXABLE intacto.
- Requisito legal del proyecto (atribución CC BY 4.0 visible en toda página) cumplido sin pisar las atribuciones no-CC-BY.

## Task Commits

Each task was committed atomically:

1. **Task 1: Página /metodologia mínima y honesta** - `efb6e49` (feat)
2. **Task 2: Footer global en layout.tsx + test de estructura** - `bd1df98` (feat)

## Files Created/Modified
- `app/app/metodologia/page.tsx` - (nueva) página estática honesta: fuentes, 3 estados honestos, licencias por dataset, contacto; declara alcance sin prometer diccionario completo.
- `app/app/layout.tsx` - (modificada) `<footer>` global tras `{children}` con atribución + CC BY 4.0 scope-caveat + links + trust line; import de `Link`; gate `generateMetadata`/`PUBLIC_INDEXABLE` intacto.
- `app/app/layout.test.tsx` - (nuevo) test source-scan del footer: existencia tras children, links, CC BY, no-ChileCompra/SERVEL, gate noindex presente.

## Decisions Made
- El footer global cubre SOLO la compilación propia con CC BY 4.0 y NO nombra ChileCompra/SERVEL (scope-caveat T-51-18); esas atribuciones no-CC-BY siguen por sección y en /metodologia. El test lo asserta como invariante.
- Contacto vía `mailto:contacto@observatoriocongreso.cl` (dominio placeholder, uniforme entre footer y /metodologia).
- /metodologia espeja la declaración de alcance de /sobre: no promete diccionario de datos por sección (milestone futuro).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. `pnpm --dir app exec tsc -b` limpio en ambas tareas; `pnpm --dir app test -- --run layout` verde. Suite app/ 471 → 476 (5 tests nuevos de layout).

## Threat Model Compliance
- **T-51-18** (atribución falsa CC BY vs ChileCompra/SERVEL): mitigado — scope-caveat en el footer + test que asserta ausencia de ChileCompra/SERVEL en el global.
- **T-51-19** (regresión del gate noindex): mitigado — `generateMetadata`/`PUBLIC_INDEXABLE` sin tocar + test que asserta su presencia.
- **T-51-20** (metodología sobre-promete): mitigado — página mínima honesta que declara su alcance actual, no promete diccionario completo.
- **T-51-SC** (npm installs): sin dependencias nuevas.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SC8 cerrado; el footer y /metodologia quedan listos. Nota operador: el dominio de contacto `contacto@observatoriocongreso.cl` es placeholder — confirmar/ajustar antes del lanzamiento público.
- 51-07 (último plan de la fase) queda como siguiente.

## Self-Check: PASSED

- Files: `app/app/metodologia/page.tsx`, `app/app/layout.test.tsx`, `app/app/layout.tsx`, `51-06-SUMMARY.md` — all FOUND.
- Commits: `efb6e49`, `bd1df98` — both FOUND.

---
*Phase: 51-leg2-legibilidad-profunda*
*Completed: 2026-07-03*
