---
phase: 91-personas-p2b-ficha-bio-partido-directo-cross-links-factuale
plan: 02
subsystem: frontend
tags: [next16, rsc, ficha-parlamentario, partido-chip, bio, militancias, comisiones, anti-insinuacion, legal-03-revert]

# Dependency graph
requires:
  - phase: 91-01
    provides: "RPCs v2 (parlamentario_publico_v2/comisiones_de_parlamentario/militancias_de_parlamentario) + row-types (ParlamentarioPublicoRow ampliado, ComisionRow, MilitanciaRow) + 8 RPCs en PUBLIC_RPC_ALLOWLIST"
  - phase: 45-legibilidad
    provides: "DetalleColapsable (Radix Accordion, disclosure inverso, contrato no-leak SSR)"
provides:
  - "PartidoChip reutilizable NEUTRO (bg-muted, omite si null, tooltip 'según fuente al [fecha]', aria-label) — Plan 03 lo consume en cross-links/directorio"
  - "ComisionesDeParlamentario (lista compacta + DetalleColapsable si >5 + empty honesto) montado en el header"
  - "MilitanciasDeParlamentario (section mt-12, vigente en capa-1 + acordeon historico) montado tras el header"
  - "page.tsx lee las 3 RPCs v2 (parlamentario_publico_v2 + comisiones + militancias) via React.cache dedicado, reversion LEGAL-03 en el header"
affects: [91-03, ficha-parlamentario]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PartidoChip espeja CamaraChip estructuralmente (Badge outline, return null si sin dato) PERO con neutralidad de color LOCKED: bg-muted identico por partido — el color jamas codifica identidad politica"
    - "RPC v2 migrada in-place en getParlamentarioPublico (mismo React.cache): los consumidores que solo leen nombre/camara/periodo heredan el super-set sin cambios"
    - "Lectores cacheados dedicados por RPC (getComisiones/getMilitancias) con #34 throw — un vacio honesto es [] SIN error, nunca un fallo enmascarado"

key-files:
  created:
    - app/components/partido-chip.tsx
    - app/components/partido-chip.test.tsx
    - app/components/comisiones-de-parlamentario.tsx
    - app/components/militancias-de-parlamentario.tsx
  modified:
    - app/components/parlamentario-header.tsx
    - app/components/parlamentario-header.test.tsx
    - app/app/parlamentario/[id]/page.tsx
    - app/app/parlamentario/[id]/page.test.tsx

key-decisions:
  - "MilitanciasSection retorna null si el RPC devuelve 0 filas (vacio TOTAL de militancias → sin carril); el estado 'solo vigente' SI muestra la leyenda empty honesta (hay militancia vigente que exhibir)"
  - "PartidoChip usa un tooltip Radix (no subtexto <p> inline) para el 'segun fuente al [fecha]' — la fila de chips densa se manteniene compacta y el wrap movil no se rompe"
  - "El partido_origen cae a parlamentario.origen si el RPC no trae origen de militancia (fallback honesto en el header, no en el chip)"

patterns-established:
  - "Chip reutilizable con data-slot para asertar neutralidad de color en RTL (dos partidos → mismo className de fondo)"

requirements-completed: [BIO-02, BIO-03]

# Metrics
duration: ~8min
completed: 2026-07-22
---

# Phase 91 Plan 02: Ficha bio + partido directo + cross-links factuales — Montaje header Summary

**PartidoChip NEUTRO reutilizable (omite si null, tooltip "según fuente al [fecha]") + bloque comisiones + sección militancias (vigente en capa-1 + acordeón histórico) montados en la ficha, leyendo las 3 RPCs v2 de 0060; la reversión operador 2026-07-21 de LEGAL-03 muestra el partido del cargo electo sin tocar el piso de PII. Suite app 1106/1106 verde + tsc limpio.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-22T16:30:03Z
- **Completed:** 2026-07-22T16:37:45Z
- **Tasks:** 3
- **Files modified:** 8 (4 creados, 4 modificados)

## Accomplishments
- **PartidoChip** (`partido-chip.tsx`): Badge outline NEUTRO (`bg-muted border-border text-foreground`, idéntico por partido — el color jamás codifica identidad política); retorna `null` si partido null/vacío (espejo CamaraChip); tooltip Radix "según {fuente} al {fecha}" (fecha font-mono) + `aria-label` completo. TDD: RED (test sin componente falla) → GREEN (5/5 RTL: con-dato, null→omite, cadena-vacía, sin-placeholder, neutralidad-de-color).
- **ComisionesDeParlamentario**: lista compacta `{nombre} · {tipo} · {cargo}` (omisión honesta de partes ausentes, sin "· ·" colgantes), `DetalleColapsable` para el excedente si >5, leyenda empty LOCKED ("Sin comisiones registradas … en la fuente.").
- **MilitanciasDeParlamentario**: su propia `<section className="mt-12">`; capa-1 con h2 "Militancias registradas" + leyenda LOCKED + la vigente (rango mono + etiqueta sobria "Vigente"); tramos históricos en `DetalleColapsable` (cerrado); leyenda empty si solo vigente. Fechas SIEMPRE font-mono.
- **page.tsx cableado**: `getParlamentarioPublico` migró a `parlamentario_publico_v2` (mismo React.cache — todos los consumidores heredan el super-set); `getComisiones`/`getMilitancias` cacheados dedicados (#34 throw); `MilitanciasSection` tras el header (omite si 0 filas) con su `MilitanciasSkeleton` anti-CLS.
- **Header revierte LEGAL-03**: docstring documenta la decisión operador 2026-07-21; `PartidoChip` en la fila `flex flex-wrap gap-2` DESPUÉS de CamaraChip; `ComisionesDeParlamentario` bajo el cargo, ANTES del ProvenanceBadge. Sin foto, sin profesión, sin rut/email.

## Task Commits

1. **Task 1: PartidoChip reutilizable (TDD)** — `f29be0a` (feat)
2. **Task 2: bloque comisiones + sección militancias** — `63a7cfe` (feat)
3. **Task 3: cablear v2 en page.tsx + header con partido/comisiones + sección militancias** — `cd11bc7` (feat)

**Plan metadata:** (final docs commit)

## Files Created/Modified
- `app/components/partido-chip.tsx` — chip neutro reutilizable, omite si null, tooltip fuente+fecha.
- `app/components/partido-chip.test.tsx` — 5 tests RTL (con-dato/null/vacía/placeholder/neutralidad).
- `app/components/comisiones-de-parlamentario.tsx` — bloque comisiones con DetalleColapsable si >5 + empty honesto.
- `app/components/militancias-de-parlamentario.tsx` — sección militancias vigente + acordeón histórico.
- `app/components/parlamentario-header.tsx` — revierte docstring LEGAL-03; +PartidoChip en fila de chips; +ComisionesDeParlamentario bajo el cargo; prop `comisiones` opcional.
- `app/components/parlamentario-header.test.tsx` — reemplaza las aserciones LEGAL-03 (no partido) por las de la reversión: partido presente renderiza chip, null lo omite, PII dura intacta.
- `app/app/parlamentario/[id]/page.tsx` — RPC v2 + 2 lectores cacheados nuevos + MilitanciasSection + skeleton.
- `app/app/parlamentario/[id]/page.test.tsx` — mock Supabase migrado a v2 (super-set con partido null) + comisiones/militancias ([]); aserción de dedup por `parlamentario_publico_v2`.

## Decisions Made
- **MilitanciasSection omite la sección si el RPC devuelve `[]`** (sin ninguna militancia registrada) — un vacío TOTAL no merece un carril vacío; el estado "solo vigente" SÍ muestra la leyenda empty (hay militancia vigente que exhibir).
- **Tooltip Radix para la procedencia del chip** (no subtexto `<p>` inline): mantiene la fila de chips compacta y no rompe el wrap en móvil 390px.
- **`partido_origen ?? origen`** en el header: si el RPC no trae origen de militancia, cae al origen de cabecera — fallback honesto, nunca "fuente desconocida" fabricada.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] page.test.tsx mock rompía por el rename de RPC**
- **Found during:** Task 3 (migrar `parlamentario_publico` → `parlamentario_publico_v2`)
- **Issue:** El `rpcMock` de `page.test.tsx` solo reconocía `"parlamentario_publico"` y devolvía el thenable con `.maybeSingle()`; tras el rename, el `name` no matcheaba → caía al default `Promise.resolve({data:null})` (sin `.maybeSingle`) → `TypeError: sb.rpc(...).maybeSingle is not a function`. 4 tests fallaban. Causado directamente por el rename requerido por el plan.
- **Fix:** Mock actualizado a `parlamentario_publico_v2` (payload super-set con `partido: null` + origen/fecha_captura/enlace) y añadidos los casos `comisiones_de_parlamentario`/`militancias_de_parlamentario` (awaited directo → `[]`). Aserción de dedup actualizada al nuevo nombre de RPC (getComisiones es un RPC distinto, no cuenta contra la dedup de 1).
- **Files modified:** app/app/parlamentario/[id]/page.test.tsx
- **Verification:** `pnpm exec vitest run` → 1106/1106 verde.
- **Committed in:** `cd11bc7` (Task 3)

**2. [Rule 3 - Blocking] parlamentario-header.test.tsx afirmaba LEGAL-03 (no partido)**
- **Found during:** Task 3 (revertir LEGAL-03 en el header)
- **Issue:** El test existente asertaba `expect(texto).not.toMatch(/partido|afiliaci|bancada|militancia/i)` — invariante DIRECTAMENTE contradicha por el objetivo del plan (mostrar el partido). Habría fallado con el PartidoChip montado.
- **Fix:** Reemplazadas las 2 aserciones LEGAL-03 por 3 nuevas de la reversión: partido presente → chip visible con aria-label de fuente+fecha; partido null → chip omitido (sin "Sin partido"); rut/email siguen prohibidos (piso de PII dura intacto). El fixture BASE conserva partido null (no rompe las aserciones de período).
- **Files modified:** app/components/parlamentario-header.test.tsx
- **Verification:** `pnpm exec vitest run components/parlamentario-header.test.tsx` verde dentro de la suite completa.
- **Committed in:** `cd11bc7` (Task 3)

---

**Total deviations:** 2 auto-fixed (2 blocking, ambos test-mock/aserción causados directamente por los renames/reversión que el plan exige).
**Impact on plan:** Sin scope creep — ambos son consecuencia directa de migrar a v2 y revertir LEGAL-03. Cero cambios de arquitectura.

## Issues Encountered
None más allá de las 2 desviaciones test-side (esperables al migrar la RPC y revertir la invariante LEGAL-03).

## Verification Results
- `pnpm exec tsc -b` → exit 0 (limpio).
- `pnpm exec vitest run` → **1106/1106 verde, 88 files** (incluye anti-insinuacion-guard, lockdown-guard, civic/globals cero-hex, page.test, header test).
- `partido-chip.tsx`: `bg-muted` presente; CERO token de color cívico/partidista ni hex (solo una referencia en comentario a "cámara/senado").
- `page.tsx`: `parlamentario_publico_v2`, `comisiones_de_parlamentario`, `militancias_de_parlamentario` presentes (10 ocurrencias).
- `parlamentario-header.tsx`: `PartidoChip` renderizado en la fila de chips (5 ocurrencias); docstring LEGAL-03 revertido documenta 2026-07-21; cero rut/email/profesión.

## Threat Register Compliance (91-02-PLAN §threat_model)
- **T-91-05 (Info Disclosure, header render):** MITIGADO — PartidoChip/comisiones consumen SOLO row-types PII-safe (ComisionRow/ParlamentarioPublicoRow sin rut/email); profesión omitida.
- **T-91-06 (Repudiation, partido sin fuente):** MITIGADO — el chip SIEMPRE lleva "según {fuente} al {fecha}"; nunca "actual" sin fecha (el subtexto degrada a solo-fuente, jamás fabrica fecha).
- **T-91-07 (Info Disclosure, color partidista):** MITIGADO — chip NEUTRO `bg-muted` idéntico por partido; test de neutralidad de color asserta mismo className de fondo.
- **T-91-SC (Tampering, npm installs):** MITIGADO — CERO paquetes nuevos (Radix Tooltip/Accordion ya instalados).

## User Setup Required
None — todo el montaje es frontend sobre las RPCs v2 ya aplicadas a PROD en Plan 01.

## Next Phase Readiness
- **Plan 03 puede consumir PartidoChip** en cross-links (opcional por fila) y directorio; el contrato (partido/fechaCaptura/origen, omite si null) está congelado.
- **Diferido a Plan 03:** bloques cross-links factuales (4), filtro por partido en /parlamentarios (island), extensión del linter anti-insinuación a las superficies de cross-links.
- **Sin blockers de operador.**

## Self-Check: PASSED

- Files verified: partido-chip.tsx, partido-chip.test.tsx, comisiones-de-parlamentario.tsx, militancias-de-parlamentario.tsx, parlamentario-header.tsx, page.tsx, 91-02-SUMMARY.md — all FOUND.
- Commits verified: `f29be0a`, `63a7cfe`, `cd11bc7` — all FOUND in git log.

---
*Phase: 91-personas-p2b-ficha-bio-partido-directo-cross-links-factuale*
*Completed: 2026-07-22*
