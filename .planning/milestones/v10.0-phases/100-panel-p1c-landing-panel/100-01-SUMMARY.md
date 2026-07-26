---
phase: 100-panel-p1c-landing-panel
plan: 01
subsystem: testing
tags: [guards-as-test, anti-insinuacion, bento, vitest, honesty-contract, denylist]

# Dependency graph
requires:
  - phase: 68-01
    provides: anti-insinuacion-guard.test.ts (linter anti-vocabulario-insinuante, molde SUPERFICIES_* + mutation self-check)
  - phase: 80-02
    provides: bento-guards.test.ts (cero-hex + tipografia + bare-var guards)
  - phase: 99-02
    provides: RPC actualidad_senales_panel ya en PUBLIC_RPC_ALLOWLIST (lockdown-guard intacto)
provides:
  - "SUPERFICIES_PANEL en anti-insinuacion-guard cubriendo components/panel-actualidad.tsx (Wave 2)"
  - "Vocabulario timing/editorial/anti-ranking en TERMINOS_PROHIBIDOS con tildes exactas"
  - "mutation self-check PANEL que prueba que el detector muerde"
  - "panel-actualidad.tsx declarado en cero-hex + tipografia de bento-guards"
  - "Tolerancia de superficie declarada-pero-ausente en los loaders bento (try/catch continue)"
affects: [100-02, panel-actualidad, panel-copy, Wave-2]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guard-first (Wave 0): declarar la superficie NUEVA en los guards ANTES de escribir el copy — tripwire de honestidad estatico en CI"
    - "Superficie declarada-pero-ausente tolerada (try/catch continue) -> guard verde ahora, muerde cuando el componente exista"

key-files:
  created: []
  modified:
    - app/lib/anti-insinuacion-guard.test.ts
    - app/lib/bento-guards.test.ts

key-decisions:
  - "Nuevo array SUPERFICIES_PANEL (no renombrar SUPERFICIES_HOME — Pitfall 1)"
  - "Bare 'top' RECHAZADO por colision con identificador const top de actualidad-module.tsx:407 (falso positivo); ranking cubierto por frases multi-palabra"
  - "Rule 3 fix: bento-guards NO toleraba archivo ausente (readFileSync directo) -> añadido try/catch continue a ambos loaders (A)"

patterns-established:
  - "Guard-first Wave 0: el copy nuevo pasa por el linter antes de existir"
  - "Anti-ranking idioms como frases multi-palabra (no tokens bare) para evitar colision con identificadores de codigo"

requirements-completed: [PANEL-01]

# Metrics
duration: ~18min
completed: 2026-07-24
---

# Phase 100 Plan 01: Extender guards del panel (Wave 0) Summary

**Guards de honestidad extendidos ANTES del copy: SUPERFICIES_PANEL + vocabulario timing/editorial/anti-ranking (tildes exactas) en anti-insinuacion-guard, y panel-actualidad.tsx en los candados cero-hex + tipografia de bento — con tolerancia de superficie declarada-pero-aun-inexistente para quedar verde hoy y morder en Wave 2.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-24T~11:00Z
- **Completed:** 2026-07-24
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `SUPERFICIES_PANEL` nuevo (activo, no comentado) declarando `components/panel-actualidad.tsx` + wired al bucle de escaneo (`...SUPERFICIES_PANEL`). El loader tolera el archivo aun-inexistente (try/catch continue) → guard VERDE en Wave 0, MUERDE en Wave 2 cuando el componente exista.
- 11 terminos de timing/editorial/anti-ranking añadidos a `TERMINOS_PROHIBIDOS` con tildes exactas: `ultimo momento`, `a ultima hora`, `de madrugada`, `expres`, `revivido`, `reactivado`, `zombie`, `resucito`, `colado`, `la camara mas activa`, `los mas`.
- mutation self-check `PANEL (100)` que prueba que el detector muerde sobre `expres`/`de madrugada`/`reactivado`/`la camara mas activa`.
- `panel-actualidad.tsx` en `SUPERFICIES_CERO_HEX` + `SUPERFICIES_TIPOGRAFIA` de bento-guards (Guard III bare-var ya cubre `components/**` recursivo).
- Suite completa verde (1255/1255), tsc limpio, lockdown-guard intacto (14/14, sin tocar).

## Task Commits

Each task was committed atomically:

1. **Task 1: SUPERFICIES_PANEL + terminos timing + mutation self-check** - `4a71184` (test)
2. **Task 2: panel-actualidad.tsx en bento cero-hex + tipografia** - `ce5f74d` (test)

## Files Created/Modified

- `app/lib/anti-insinuacion-guard.test.ts` - Nuevo array `SUPERFICIES_PANEL`, entrada en el bucle de escaneo, 11 terminos timing/editorial/anti-ranking en `TERMINOS_PROHIBIDOS`, mutation self-check `PANEL (100)`.
- `app/lib/bento-guards.test.ts` - `panel-actualidad.tsx` en `SUPERFICIES_CERO_HEX` + `SUPERFICIES_TIPOGRAFIA`; try/catch continue en ambos loaders (A) para tolerar la superficie declarada-pero-ausente.

## Decisions Made

- **Nuevo array SUPERFICIES_PANEL** (no renombrar `SUPERFICIES_HOME`, que ya cubre `app/page.tsx` + `actualidad-module.tsx` — Pitfall 1).
- **Bare `top` RECHAZADO:** la verificacion por grep confirmo que `top`/`los mas`/`la camara mas activa`/`reactivado` no estaban en la lista. Al añadir bare `top` la corrida cazo `const top = vigentes.slice(...)` en `actualidad-module.tsx:407` — un identificador de codigo, NO copy renderizado → falso positivo. Se retiro el token bare y el idiom anti-ranking se cubre con las frases multi-palabra `los mas` y `la camara mas activa` (que no colisionan con identificadores). `indice`/`ranking`/`score`/`puntaje` ya cubrian el ranking numerico.
- **NEGACIONES_LOCKED sin cambios:** el germen del copy del panel no introduce ninguna leyenda que NIEGUE un termino prohibido. Si el copy del Plan 02 introduce una leyenda que NIEGA un termino prohibido, esa leyenda debe registrarse verbatim en `NEGACIONES_LOCKED` ANTES de que la superficie entre al escaneo real (Pitfall 2, leccion BLOCKER 91).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] bento-guards no toleraba superficies declaradas-pero-ausentes**
- **Found during:** Task 2 (declarar panel-actualidad.tsx en bento-guards)
- **Issue:** El plan (`important_notes` + 100-PATTERNS §bento) asumia que "el loader TOLERA archivos faltantes (try/catch continue)" para AMBOS guards. Es cierto para anti-insinuacion-guard (bucle unico con try/catch, L475-480), pero FALSO para bento-guards: sus loaders (A) generan un `it()` por archivo con `readFileSync(full, "utf-8")` directo, sin try/catch → al declarar `panel-actualidad.tsx` (aun inexistente) el test fallaba con `ENOENT`, no verde.
- **Fix:** Añadido `try { raw = readFileSync(...) } catch { return; }` a los dos loaders (A) de bento-guards (cero-hex L128-141 y tipografia L304-317), espejo exacto del patron de anti-insinuacion-guard. La superficie declarada-ausente se salta (return) → guard verde ahora; el `it()` corre con contenido real y muerde cuando el archivo exista en Wave 2.
- **Files modified:** app/lib/bento-guards.test.ts
- **Verification:** `pnpm test -- --run bento-guards lockdown-guard` verde (1255/1255); las superficies existentes (bento-grid, bento-tile, page.tsx, actualidad-module, brand-icon) siguen ejerciendo los detectores con contenido real → la tolerancia solo salta el unico archivo aun-inexistente, sin volver el guard un no-op.
- **Committed in:** `ce5f74d` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking, Rule 3)
**Impact on plan:** El fix es necesario para materializar la propia estrategia del plan (declarar la superficie activa → verde ahora). Sin el, el plan no podia quedar verde en Wave 0. Mismo patron ya presente en anti-insinuacion-guard. Sin scope creep.

## Issues Encountered

- La primera corrida del mutation self-check PANEL uso "reactivada" (femenino) en el fixture; el termino declarado es "reactivado" (masculino) y `buildTermRegex` respeta el limite de palabra por inflexion → no matcheaba. Se corrigio el fixture a "Proyecto reactivado: ley expres aprobada de madrugada, la camara mas activa." (verificado por probe de regex aislado antes de re-correr).

## Known Stubs

None — este plan solo extiende guards (tests). El componente `components/panel-actualidad.tsx` NO se crea aqui (es Plan 02); su ausencia es la condicion esperada (superficie tolerada-ausente).

## Threat Flags

None — no se introduce superficie de red/auth/schema nueva. `actualidad_senales_panel` ya estaba en `PUBLIC_RPC_ALLOWLIST` (99-02); lockdown-guard NO tocado (T-100-03 = accept, verificado verde).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 0 (guards) CERRADA: el copy del panel (Plan 02) pasara por el linter antes de existir.
- Cuando Plan 02 cree `components/panel-actualidad.tsx`, los 3 guards MUERDEN automaticamente (anti-insinuacion + cero-hex + tipografia).
- RECORDATORIO Plan 02: si el copy introduce una leyenda que NIEGA un termino prohibido, registrarla verbatim en `NEGACIONES_LOCKED` ANTES de que la superficie entre al scan (Pitfall 2). Reusar solo off-steps ya whitelisteados; si se necesita uno nuevo, añadirlo a `WHITELIST_ARBITRARIOS` con razon documentada (DEBT-05).

## Self-Check: PASSED

- FOUND: `.planning/phases/100-panel-p1c-landing-panel/100-01-SUMMARY.md`
- FOUND: `app/lib/anti-insinuacion-guard.test.ts`
- FOUND: `app/lib/bento-guards.test.ts`
- FOUND commit: `4a71184` (Task 1)
- FOUND commit: `ce5f74d` (Task 2)

---
*Phase: 100-panel-p1c-landing-panel*
*Completed: 2026-07-24*
