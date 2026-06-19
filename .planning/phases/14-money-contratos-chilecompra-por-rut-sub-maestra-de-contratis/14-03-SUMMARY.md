---
phase: 14-money-contratos-chilecompra-por-rut-sub-maestra-de-contratis
plan: 03
subsystem: ui
tags: [nextjs, react, server-components, rsc, money-gate, chilecompra, ficha, rtl, vitest]

# Dependency graph
requires:
  - phase: 14-01
    provides: RPC contratos_de_parlamentario, tabla/marcador contratos_ingesta_estado, RLS deny-by-default
  - phase: 14-02
    provides: conector @obs/dinero (origen="chilecompra"), enlace RUT-exacto
  - phase: 13
    provides: app/lib/money-gate.ts (moneyPublicEnabled, server-only, fail-closed OFF)
provides:
  - "Sección de ficha 'Contratos del Estado asociados al RUT' (ContratosView pura + ContratosSection gated)"
  - "Rama ChileCompra en sourceLabel() (chilecompra/mercado → 'ChileCompra')"
  - "Interface ContratoRpcRow en app/lib/types.ts (licencia 'mención de la fuente', fecha_corte)"
  - "Gate de exposición LOCKED: <section id='dinero'> entera envuelta en moneyPublicEnabled()"
affects: [phase-16-agregacion-contratos-por-contraparte, money-financiamiento-servel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tres estados honestos (vs dos de lobby): no_consultado / consultado_sin_contratos / enlazado"
    - "Gate de presentación que envuelve TODA la <section> (heading incluido) en page.tsx, no en el componente"
    - "Persona jurídica: sujeto = entidad proveedora + línea de enlace separada (sin posesivo)"

key-files:
  created:
    - app/components/contratos-de-parlamentario.tsx
    - app/components/contratos-de-parlamentario.test.tsx
  modified:
    - app/lib/types.ts
    - app/app/parlamentario/[id]/page.tsx

key-decisions:
  - "El gate moneyPublicEnabled() envuelve la <section id='dinero'> COMPLETA en page.tsx (heading + Suspense + skeleton); ContratosSection también retorna null bajo OFF como doble candado, pero la ausencia del heading la garantiza el wrapper de page.tsx"
  - "Estado server-derived: >=1 fila → enlazado; sin marcador (o RUT interno no poblado) → no_consultado; marcador presente + 0 filas → consultado_sin_contratos"
  - "fecha_corte tomada de ingestado_hasta del marcador para el copy de 'consultado sin contratos'"

patterns-established:
  - "Gate de exposición a nivel de <section> en el Server Component de page.tsx (presencia/ausencia del carril entero)"
  - "Persona jurídica/natural: '(persona jurídica)'/'(persona natural)' paréntesis muted + 'Enlazado por RUT al parlamentario.' en línea separada"

requirements-completed: [MONEY-02]

# Metrics
duration: ~25min
completed: 2026-06-19
---

# Phase 14 Plan 03: Sección de ficha "Contratos del Estado asociados al RUT" Summary

**Sección de ficha MONEY gated detrás de moneyPublicEnabled() (default OFF) con tres estados honestos textualmente distintos, tratamiento persona-jurídica sin posesivo, y rama ChileCompra en sourceLabel — la cara ciudadana de la fase con el gate de exposición LOCKED.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-19T18:02:00Z (aprox.)
- **Completed:** 2026-06-19T18:27:00Z
- **Tasks:** 2
- **Files modified:** 4 (2 creados, 2 modificados)

## Accomplishments
- `ContratosView` (componente puro, RTL-testable) renderiza el intro honesto + uno de tres estados mutuamente excluyentes: "no consultado todavía" / "consultado sin contratos (corte al {fecha})" / "enlazado" (lista paginada).
- `ContratosSection` (Server Component) aplica el gate `moneyPublicEnabled()` ANTES de cualquier lectura Supabase, lee el RPC `contratos_de_parlamentario` (throw en rpcError, #34), lee el marcador `contratos_ingesta_estado` vía `.maybeSingle()`, deriva el estado server-side y pagina (PAGE_SIZE=20).
- Mount en `page.tsx`: la `<section id="dinero" className="mt-12">` ENTERA (heading + Suspense + `ContratosSkeleton`) envuelta en `moneyPublicEnabled(process.env)`. Con OFF (default) el nodo entero —heading incluido— está ausente del HTML.
- `sourceLabel()` gana la rama ChileCompra (`chilecompra`/`mercado` → "ChileCompra"); interface `ContratoRpcRow` agregada a `types.ts`.
- Persona jurídica: sujeto = entidad proveedora (`Proveedor: {nombre}` + `(persona jurídica)` muted) con el enlace al parlamentario en línea SEPARADA "Enlazado por RUT al parlamentario." — nunca un posesivo.
- 12 tests RTL nuevos: gate-off heading ausente (3 variantes de flag), redacción "asociados al RUT" sin posesivo, atribución "mención de la fuente" (no CC BY 4.0), tres estados distintos, persona jurídica/natural, provenance por fila + cero cómputo.

## Task Commits

1. **Task 1: sourceLabel ChileCompra + ContratoRpcRow + componente** - `35b0f4c` (feat)
2. **Task 2: mount #dinero gated en page.tsx + tests RTL** - `082da90` (feat)

## Files Created/Modified
- `app/components/contratos-de-parlamentario.tsx` (creado) - `ContratosView` puro + `ContratosSection` gated; tres estados honestos; fila con sujeto proveedor + enlace separado; ProvenanceBadge + fecha de corte por fila; paginación `?contratosPage=N`.
- `app/components/contratos-de-parlamentario.test.tsx` (creado) - 12 tests RTL del gate, los 3 estados, persona jurídica, atribución y cero cómputo.
- `app/lib/types.ts` (modificado) - rama ChileCompra en `sourceLabel()`; interface `ContratoRpcRow`.
- `app/app/parlamentario/[id]/page.tsx` (modificado) - imports `ContratosSection`/`moneyPublicEnabled`; `<section id="dinero">` gated con heading exacto + `ContratosSkeleton`.

## Decisions Made
- El gate envuelve la `<section>` completa en `page.tsx` (no solo el `return null` de `ContratosSection`), porque depender del componente dejaría el `<h2>` filtrado. `ContratosSection` igual retorna `null` bajo OFF como segundo candado antes de tocar Supabase.
- La `fecha de corte` del estado "consultado sin contratos" se deriva de `ingestado_hasta` del marcador; si está ausente, el copy cae a "la fecha de corte" sin inventar fecha.
- Detección persona jurídica por `tipo_persona.includes("jur")` (case-insensitive) para tolerar "jurídica"/"juridica"/"Jurídica" de la fuente.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Flag de regex `s` (dotAll) incompatible con el target tsc**
- **Found during:** Task 2 (tests RTL)
- **Issue:** Un assert usaba `/.../is` (flag `s`); `tsc --noEmit` lo rechazó (TS1501: el flag solo existe con target es2018+), aunque vitest lo ejecutaba bien.
- **Fix:** Se dividió el assert en dos (`getByText` de un fragmento + `toMatch` del otro), eliminando la necesidad del flag `s`.
- **Files modified:** app/components/contratos-de-parlamentario.test.tsx
- **Verification:** `tsc --noEmit` sin errores en archivos del plan; los 12 tests siguen verdes.
- **Committed in:** `082da90` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** El fix es de compatibilidad de tipos, sin cambio de comportamiento ni de cobertura. Sin scope creep.

## Issues Encountered
- `tsc --noEmit` reporta 2 errores PRE-EXISTENTES en `app/lib/buscar.test.ts` (TS2532/TS2493, líneas 156), de Phase 07, sin relación con este plan. Fuera de alcance (scope boundary) — registrados en `deferred-items.md`, no corregidos. El archivo pasa en vitest (10/10); los errores son de estrictez de tipos en el test, no de runtime.

## User Setup Required
None - no external service configuration required. El flag `MONEY_PUBLIC_ENABLED` permanece OFF (default) hasta el sign-off legal (deuda de operador F13); encenderlo es una acción de operador, no de este plan.

## Next Phase Readiness
- La sección de ficha MONEY está construida y gated; lista para encenderse vía operador tras sign-off legal (F13).
- La cobertura real será baja mientras el RUT interno de la maestra no esté poblado (deuda IDENT-10): la mayoría de parlamentarios mostrará "no consultado todavía" de forma honesta — comportamiento esperado, no bug.
- Phase 16 (agregación de contratos por contraparte) consumirá la sub-maestra `contratista`; este plan no la toca.

## Threat Flags

None — no se introduce superficie de seguridad nueva fuera del threat_model del plan. La sección lee SOLO vía el RPC security-definer `contratos_de_parlamentario` (Plan 01) detrás del gate `moneyPublicEnabled()`; no hay endpoint nuevo, ni auth nueva, ni acceso directo a tablas deny-by-default.

## Self-Check: PASSED

- Files created/modified verified on disk: `contratos-de-parlamentario.tsx`, `contratos-de-parlamentario.test.tsx`, `14-03-SUMMARY.md`.
- Commits verified in git log: `35b0f4c`, `082da90`.
- Heading exacto, gate wiring (`moneyPublicEnabled(process.env)`) y rama `"ChileCompra"` confirmados por grep en los archivos finales.
- `pnpm test`: 127/127 verde (14 archivos), incl. 12 tests nuevos de contratos.
- `tsc --noEmit`: limpio en todos los archivos del plan (solo persisten 2 errores PRE-EXISTENTES en `lib/buscar.test.ts`, fuera de alcance, registrados en `deferred-items.md`).

---
*Phase: 14-money-contratos-chilecompra-por-rut-sub-maestra-de-contratis*
*Completed: 2026-06-19*
