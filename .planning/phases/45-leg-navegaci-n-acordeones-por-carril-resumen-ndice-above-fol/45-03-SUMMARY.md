---
phase: 45-leg-navegaci-n-acordeones-por-carril-resumen-ndice-above-fol
plan: 03
subsystem: frontend-ficha-parlamentario
tags: [leg, navegacion, acordeon, resumen, above-fold, ssr, mt-12, gates, leg-01, leg-03]
requires:
  - "CarrilAccordion (45-01) — isla cliente Radix, h2 al header + forceMount"
  - "ParlamentarioResumen + contarCarriles (45-02) — server-only, React.cache, 3-estado"
  - "gates crucesPublicEnabled/moneyPublicEnabled (server-only)"
provides:
  - "page.tsx re-layouteada: resumen above-fold + cada carril en CarrilAccordion"
  - "page-estructura.test.ts: source-scan de invariantes LOCKED (mt-12, 1xdominio, gates, resumen, no-leak)"
affects:
  - "Ninguno aguas abajo en esta fase; F46 (chart patrimonio) construye sobre la ficha navegable"
tech-stack:
  added: []
  patterns:
    - "Server passes sections as children to client islands (no-leak SSR, Camino A)"
    - "contarCarriles UNA vez (React.cache dedupe) → conteo header + defaultOpen + resumen"
    - "gate envuelve la <section> ENTERA (heading incl.) — OFF = nodo ausente"
    - "source-scan structural test (espejo lockdown-guard.test.ts, process.cwd()+path.join)"
dependency_graph:
  requires: ["45-01", "45-02"]
  provides: ["ficha-parlamentario-navegable"]
  affects: ["46-*"]
key-files:
  created:
    - "app/app/parlamentario/[id]/page-estructura.test.ts"
  modified:
    - "app/app/parlamentario/[id]/page.tsx"
    - "app/app/parlamentario/[id]/page.test.tsx"
decisions:
  - "defaultOpen conservador determinista: abrir SOLO carriles tipo 'dato' (total>0); colapsar vacio/no_ingerido/pendiente"
  - "ParlamentarioResumen envuelto en <Suspense fallback={ResumenSkeleton}> (consistencia con secciones + renderToStaticMarkup no rompe)"
  - "page body await contarCarriles(id) tras validar id (React.cache lo comparte con el resumen) — alimenta conteo+defaultOpen"
  - "honest-state #financiamiento-pendiente: h2 migra al header del acordeon con conteo 'pendiente'; gate !money y texto legal LOCKED verbatim"
  - "#dinero y #financiamiento (MONEY ON) comparten conteos.dinero (contarCarriles combina contratos+aportes)"
requirements: [LEG-01, LEG-03]
metrics:
  duration: "~12min"
  completed: "2026-06-26"
  tasks: 2
  files: 3
---

# Phase 45 Plan 03: LEG Navegación — Integración (resumen above-fold + carriles en acordeón) Summary

Integra LEG-01 (CarrilAccordion) y LEG-02 (ParlamentarioResumen/contarCarriles) en la ficha del parlamentario: la página re-layouteada inserta el resumen + índice above-fold tras la cabecera y envuelve cada `<section className="mt-12">` de dominio en su propio `CarrilAccordion` (un acordeón por dominio, `<h2>` migrado al header siempre visible, cuerpo colapsable). La frontera anti-insinuación `mt-12` permanece en cada `<section>` hermana, los gates MONEY/CRUCES siguen envolviendo la sección entera (OFF = nodo ausente del HTML), el SSR queda intacto (sólo el toggle es cliente) y un test estructural source-scan blinda los invariantes LOCKED.

## What Was Built

### Task 1 — Re-layout de page.tsx (commit `36a520b`)
- **Imports nuevos:** `CarrilAccordion` (`@/components/carril-accordion`), `ParlamentarioResumen` (`@/components/parlamentario-resumen`), `contarCarriles` + `type CarrilEstado` (`@/lib/parlamentario-resumen-conteos`).
- **Conteos UNA vez:** `const conteos = await contarCarriles(id)` en el cuerpo de `ParlamentarioPage`, tras validar `PARLAMENTARIO_ID_RE`. React.cache deduplica la lectura que también hace `ParlamentarioResumen`. Respeta los gates internamente (cruces/dinero no se consultan con su candado OFF).
- **Resumen above-fold:** `<Suspense fallback={<ResumenSkeleton/>}><ParlamentarioResumen id={id} /></Suspense>` DESPUÉS de `HeaderSection` y ANTES del primer carril (`#votos`).
- **Cada carril en un acordeón:** las 7 `<section id="…" className="mt-12">` (votos, lobby, patrimonio, cruces gated, dinero gated, financiamiento gated, financiamiento-pendiente gated `!money`) conservan EXACTAMENTE su `id` + `mt-12`; el `<h2>` migró al prop `titulo=` del `CarrilAccordion`; el `<Suspense fallback={<XSkeleton/>}><XSection/></Suspense>` existente pasa como `children`. Skeletons reutilizados sin cambios.
- **Helpers de derivación:** `conteoLabel(estado)` (3-estado → "n"/"sin registros"/"—"/"pendiente", espejo textual de `ChipConteo`) y `abrePorDefecto(estado)` (heurística conservadora: abrir SOLO `tipo === "dato"`).
- **NO TOCADO:** validación del id, `HeaderSection`, `FinanciamientoSectionConPeriodo`, lógica de los gates, el texto legal del honest-state, el contenido interno de cada `*Section`.

### Task 2 — Test estructural source-scan (commit `c027c5d`)
- `app/app/parlamentario/[id]/page-estructura.test.ts` (141 líneas): lee el FUENTE de `page.tsx`/`carril-accordion.tsx` con `readFileSync` + `stripTsComments` (estilo `lockdown-guard.test.ts`, ruta vía `process.cwd()+path.join`). 5 comportamientos:
  1. **mt-12:** cada uno de los 7 carriles LOCKED está en una `<section>` cuyo `className` incluye `mt-12`; `mt-12` aparece ≥ nº de carriles.
  2. **un acordeón por dominio:** `<CarrilAccordion` ↔ `<section>` 1:1 (7=7); la página NO instancia `Accordion.Root`/`AccordionPrimitive` crudos (no puede agrupar dominios).
  3. **gates:** `crucesPublicEnabled(process.env)`, `moneyPublicEnabled(process.env)` y `!moneyPublicEnabled(process.env)` presentes.
  4. **resumen:** `<ParlamentarioResumen` aparece antes de la primera `<section id="…">`.
  5. **no-leak:** `carril-accordion.tsx` no contiene `Section`/`@/lib/supabase`/`createServerSupabase`.

## Verification

- `cd app && pnpm test "page-estructura"` → **5/5 verde**.
- `cd app && pnpm test "app/parlamentario"` (behavioral page.test.tsx + parlamentarios) → **10/10 verde**.
- `cd app && pnpm test` (suite completa) → **357/357 verde** (40 archivos; +5 nuevos sobre 352).
- `cd app && pnpm typecheck` → **limpio** (tsc --noEmit).
- `cd app && pnpm test "lockdown-guard"` → **7/7 verde** (Block A + Block B sin regresión sobre el árbol re-layouteado).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] El mock de Supabase en `page.test.tsx` no tenía `.from()`**
- **Found during:** Task 1.
- **Issue:** El re-layout hace que la página llame `contarCarriles(id)` en su cuerpo (await directo, no en Suspense), que lee los marcadores `*_ingesta_estado` vía `sb.from(tabla).select().eq().maybeSingle()`. El mock existente sólo exponía `.rpc` → `sb.from` indefinido → la página lanzaba y rompía los 4 tests behaviorales de `page.test.tsx`.
- **Fix:** Añadido `fromMock` (cadena `from→select→eq→maybeSingle` que resuelve `{data:null,error:null}` = carril `no_ingerido`) al `createServerSupabaseMock`, y su `mockClear()` en `beforeEach`. El test no toca PROD; sólo refleja la nueva dependencia de datos de la página.
- **Files modified:** `app/app/parlamentario/[id]/page.test.tsx`.
- **Commit:** `36a520b`.

## Threat Model Compliance

- **T-45-07 (Information Disclosure — wrap de secciones):** la página importa las `*Section` y las pasa como `children` al `CarrilAccordion`; el wrapper (isla cliente) NO las importa → no entran al module graph cliente, el `service_role` (Camino A) nunca se filtra. Reforzado por el no-leak test (behavior 5) + lockdown-guard Block B (7/7). ✓
- **T-45-08 (Tampering / gate bypass):** los gates `crucesPublicEnabled`/`moneyPublicEnabled` se conservan envolviendo la `<section>` ENTERA (heading/acordeón incluido); el behavioral `page.test.tsx` confirma OFF = `id="cruces"` ausente del HTML + RPC cruces NUNCA invocado, y el estructural falla si un gate se elimina. ✓
- **T-45-09 (Integrity — frontera anti-insinuación):** el `mt-12` permanece en cada `<section>` hermana (no en el wrapper); un acordeón por dominio (1:1). El estructural source-scan lo garantiza (Test 1 + Test 2). ✓
- **T-45-SC (Tampering — npm install):** este plan NO instala paquetes (la única dep nueva, `@radix-ui/react-accordion`, fue auditada en 45-01). ✓

## Known Stubs

Ninguno. La ficha consume datos reales vía `contarCarriles` (RPCs allowlisted); los carriles MONEY (`#dinero`/`#financiamiento`) sólo renderizan con MONEY ON (gated-OFF por default, encender = Phase 39 firma humana) y comparten `conteos.dinero` (combinado contratos+aportes) — no es un stub sino el contrato gated existente.

## Threat Flags

Ninguno nuevo. El re-layout no introduce endpoints, rutas de auth, accesos a archivos ni cambios de esquema; sólo reordena la composición de Server Components ya existentes.

## Checkpoint de operador (NO autónomo — fuera del plan)

El build OpenNext + deploy a Cloudflare es paso de OPERADOR, NO ejecutado por el agente:
- Build OpenNext en **Docker Linux** (Windows rompe el worker → 500); deploy `wrangler` local.
- Validación visual de la animación del acordeón con `prefers-reduced-motion` activo (no observable en jsdom).

El plan se considera completo con la suite `app/` verde (357/357) + tsc limpio + lockdown 7/7.

## Self-Check: PASSED

- `app/app/parlamentario/[id]/page.tsx` — FOUND (modificado)
- `app/app/parlamentario/[id]/page-estructura.test.ts` — FOUND (creado)
- `app/app/parlamentario/[id]/page.test.tsx` — FOUND (mock extendido)
- Commit `36a520b` (Task 1) — FOUND
- Commit `c027c5d` (Task 2) — FOUND
