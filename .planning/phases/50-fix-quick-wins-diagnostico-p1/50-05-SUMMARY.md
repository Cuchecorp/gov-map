---
phase: 50-fix-quick-wins-diagnostico-p1
plan: 05
subsystem: frontend (agenda + ficha patrimonio)
tags: [fix, honest-state, integridad-informativa, throw-on-error, fecha-guard, i18n]
requires:
  - "app/lib/format.ts::capitalizarPrimera (Plan 50-01)"
  - "app/lib/format.ts::fechaCortaSegura (Plan 50-01)"
  - "app/app/agenda/error.tsx (Plan 50-03)"
provides:
  - "agenda #34-compliant: .error de Supabase → throw (nunca 'No hay citaciones' fabricado)"
  - "headers de agenda capitalizados correctamente ('Jueves, 2 de julio')"
  - "VersionRow patrimonio con guard de fecha (fechaCortaSegura) — sin 'Invalid Date'"
affects:
  - app/app/agenda/page.tsx
  - app/components/patrimonio-de-parlamentario.tsx
tech-stack:
  added: []
  patterns:
    - "Patrón #34: if (error) throw new Error(...) — capturado por route error boundary"
    - "capitalizarPrimera sobre output de Intl.DateTimeFormat (en vez de CSS text-transform:capitalize)"
    - "guard ISO WR-03 vía helper compartido fechaCortaSegura"
key-files:
  created: []
  modified:
    - app/app/agenda/page.tsx
    - app/components/patrimonio-de-parlamentario.tsx
    - app/components/patrimonio-de-parlamentario.test.tsx
decisions:
  - "B7: se chequea .error de las 3 queries de sala (senado, cámara, probe forward-only); un fallo del probe NO fabrica fueraDeVentanaSenado — se lanza."
  - "B12: fix mínimo = solo capitalización; se conserva la coma del locale es-CL (no se normaliza el formato)."
  - "B17: TDD RED→GREEN; import fechaCorta eliminado (ya sin uso tras el swap)."
metrics:
  duration: ~7min
  completed: 2026-07-02
---

# Phase 50 Plan 05: Fixes de wave 2 (agenda #34 + capitalización + guard de fecha) Summary

Cierre de la integridad informativa de wave 2 consumiendo los contratos de wave 1: agenda deja de tragar errores de DB (B7, throw-on-error #34 capturado por `agenda/error.tsx`), los headers de fecha se capitalizan con `capitalizarPrimera` en vez de CSS `capitalize` (B12) y `VersionRow`/comparación de patrimonio guardan la fecha con `fechaCortaSegura` (B17).

## What Was Built

**Task 1 — B7 (throw-on-error #34):** `f7d3cdb`
- `CitacionesSection` (`agenda/page.tsx`) ahora desestructura `error` y lanza `throw new Error(\`citacion falló para semana ${key}: ...\`)` antes de construir el array — el literal "No hay citaciones" solo se renderiza ante query exitosa con cero filas.
- `SalaTableServer` chequea `.error` de las TRES queries: `senadoRes`, `camaraRes` (Promise.all) y el probe forward-only del Senado. Un fallo del probe ya NO se degrada a `fueraDeVentanaSenado` fabricado — se lanza.
- Los throws los captura `app/app/agenda/error.tsx` (creado en Plan 50-03).

**Task 2 — B12 (capitalización correcta):** `82f989c`
- Importa `capitalizarPrimera` de `@/lib/format`.
- Quita `className="capitalize"` de los 2 headers de fecha (span de `ResultadosBusqueda`, h3 de `CitacionesSection`) y envuelve el output del formatter es-CL con `capitalizarPrimera`.
- Resultado: "Jueves, 2 de julio" (antes CSS `text-transform:capitalize` producía "Jueves, 2 De Julio"). Se conserva la coma del locale.

**Task 3 — B17 (guard de fecha, TDD):** `229482e` (RED) → `8b849af` (GREEN)
- RED: test en `patrimonio-de-parlamentario.test.tsx` con `fecha_presentacion: null` que asserta "Presentada el fecha no informada" y ausencia de "Invalid Date" (falló porque `new Date(null)` renderizaba "01 ene 1970").
- GREEN: reemplaza `fechaCorta(new Date(version.fecha_presentacion))` (`:383`) y `fechaCorta(new Date(c.fecha_presentacion))` (`:607`) por `fechaCortaSegura(...)`. Import `fechaCorta` eliminado (ya sin uso). La rama `es_historica` hereda el fallback vía `fechaTexto`.

## Verification

- `pnpm --filter app exec tsc -b` — limpio.
- `pnpm --filter app test` — **400 tests / 43 files, todos verdes** (399 baseline + 1 nuevo de patrimonio). Sin regresión.
- `lockdown-guard.test.ts` — 7/7 verde (Camino A intacto: cero RPC nueva, cero `.from()` PII, cero flags/DDL).
- Grep: `agenda/page.tsx` sin `className="capitalize"`, con `throw new Error` en ambas secciones server; `patrimonio-de-parlamentario.tsx` sin `new Date(...fecha_presentacion)` crudo.

## Deviations from Plan

None - plan executed exactly as written. La única micro-corrección fue eliminar el import `fechaCorta` que quedó sin uso tras el swap a `fechaCortaSegura` (necesario para que `tsc -b` quede limpio) — cambio implícito en la acción de la Task 3, no una desviación de alcance.

## Threat Model Compliance

- **T-50-05-INT** (integridad): mitigado — `.error` → `throw` en las 3 queries; nunca "No hay citaciones" fabricado.
- **T-50-05-AV** (disponibilidad): mitigado — `fechaCortaSegura` valida ISO antes de `new Date`; test cubre null.
- **T-50-05-CAMA** (lockdown): intacto — solo se endureció el manejo de error de lecturas existentes; `lockdown-guard` verde.

## TDD Gate Compliance

Task 3 (`tdd="true"`): gate RED (`229482e` — `test(50)`) → GREEN (`8b849af` — `fix(50)`) presente en el log. Sin fase REFACTOR (no requerida).

## Self-Check: PASSED

- FOUND: app/app/agenda/page.tsx (modificado, B7+B12)
- FOUND: app/components/patrimonio-de-parlamentario.tsx (modificado, B17)
- FOUND: app/components/patrimonio-de-parlamentario.test.tsx (test null)
- FOUND commit f7d3cdb (B7)
- FOUND commit 82f989c (B12)
- FOUND commit 229482e (B17 RED)
- FOUND commit 8b849af (B17 GREEN)
