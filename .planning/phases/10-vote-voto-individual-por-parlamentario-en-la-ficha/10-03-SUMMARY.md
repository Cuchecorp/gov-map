---
phase: 10-vote-voto-individual-por-parlamentario-en-la-ficha
plan: 03
subsystem: ui
tags: [nextjs, react, server-components, supabase, rls, rpc, pgtap, rtl, vitest, vote, ficha]

# Dependency graph
requires:
  - phase: 10-01-base-db-parser
    provides: "RPCs votos_de_parlamentario (invoker) y rebeldias_de_parlamentario (security definer); Seleccion con 'ausente'; índice parcial voto(parlamentario_id)"
  - phase: 05-tramitacion
    provides: "design system cívico v1.0 (ProvenanceBadge, IdentityMarker, CamaraChip, VotacionBar CSS, SELECCION_STYLE, sourceLabel) + patrón ficha /proyecto/[boletin]"
  - phase: 09-completitud-identidad
    provides: "parlamentario deny-by-default (LEGAL-03, 0018); estado_vinculo confirmado vía EnlaceConfirmado"
provides:
  - "Ruta /parlamentario/[id] (Server Component): primera ficha del parlamentario, shell de secciones apilables (Phase 11+ apila INT/MONEY) + sección VOTE completa"
  - "ParlamentarioHeader reusable (CamaraChip + nombre + cargo + ProvenanceBadge); chip de partido OMITIDO por LEGAL-03"
  - "VotoFichaRow + VotoFichaMencionRow (guarda de identidad de la ficha: estado (a)/(b))"
  - "VotosSection/VotosView: asistencia + lista paginada + voto×tema + votó distinto a su bancada + 3 estados honestos"
  - "RPC parlamentario_publico (migración 0020, security definer) — cabecera pública sin partido/rut/email"
  - "PARLAMENTARIO_ID_RE (validador único del path); tipos ParlamentarioPublicoRow/VotoFichaRow/VotoFichaMencion/RebeldiaRow"
affects: [11-int-lobby, 12-int-probidad, 14-money-chilecompra, ficha-parlamentario, shell-secciones-apilables]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shell de ficha de UNA columna con secciones APILABLES e independientes: cada sección su propio <h2> + Suspense + empty honesto (seam para Phase 11+ INT/MONEY)"
    - "RPC security definer para cabecera de tabla deny-by-default: parlamentario_publico lee la maestra internamente y emite SOLO columnas públicas (NUNCA partido/rut/email)"
    - "Componente RSC (data) + Vista pura (props) — VotosSection lee Supabase, VotosView se testea con fixtures sin runtime de Next/Supabase"
    - "Gate de contenido §9.1 como criterio de aceptación: assert RTL sobre container.textContent + grep de no-comentarios"

key-files:
  created:
    - app/app/parlamentario/[id]/page.tsx
    - app/app/parlamentario/[id]/not-found.tsx
    - app/components/parlamentario-header.tsx
    - app/components/voto-ficha-row.tsx
    - app/components/votos-por-parlamentario.tsx
    - app/components/votos-por-parlamentario.test.tsx
    - supabase/migrations/0020_parlamentario_publico.sql
    - supabase/tests/0020_parlamentario_publico.test.sql
  modified:
    - app/lib/types.ts
    - app/lib/buscar.ts
    - app/components/voto-row.tsx

key-decisions:
  - "El chip de bancada/partido de UI-SPEC §3.1 se OMITE: partido es afiliación política (dato sensible Ley 21.719) y parlamentario es deny-by-default; exponerlo violaría LEGAL-03"
  - "Nueva migración 0020 (RPC parlamentario_publico security definer) por gap de plan: anon no lee la maestra → la cabecera necesita un canal público-seguro espejo de rebeldias_de_parlamentario"
  - "voto×tema facetea por proyecto.materia (público-read), unida por boletín a las filas confirmadas del RPC; cero materia fabricada"
  - "VotoFichaRow usa copy §9 ('A favor'/'En contra') reusando el className a11y-safe de SELECCION_STYLE; el enlace al PROYECTO (ruta interna) es independiente de la guarda de identidad del PARLAMENTARIO"

patterns-established:
  - "Pattern: shell de ficha apilable (secciones independientes, h1→h2→h3 válido al crecer) — base para INT/MONEY"
  - "Pattern: RPC security definer como único canal a una tabla deny-by-default, emitiendo solo derivado público (parlamentario_publico, espejo de rebeldias_de_parlamentario)"
  - "Pattern: RSC de datos + Vista pura testeable por props (sin async RSC en RTL)"

requirements-completed: [VOTE-03, VOTE-04, VOTE-05]

# Metrics
duration: ~9min
completed: 2026-06-19
---

# Phase 10 Plan 03: Ficha del parlamentario `/parlamentario/[id]` — Summary

**Primera ficha del parlamentario: Server Component con shell de secciones apilables + sección VOTE completa (asistencia, lista paginada, voto×tema, votó distinto a su bancada) con los 3 estados honestos, guarda de identidad LOCKED y el gate de contenido §9.1 verde; cabecera vía nuevo RPC `parlamentario_publico` (sin exponer partido).**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-19T13:12Z
- **Completed:** 2026-06-19T13:21Z
- **Tasks:** 2 (ambas auto, tdd)
- **Files modified:** 11 (8 creados, 3 modificados)

## Accomplishments
- Ruta `/parlamentario/[id]` (Server Component, Next 16 `params`/`searchParams` Promises): valida `PARLAMENTARIO_ID_RE` antes de DB, lee la cabecera vía RPC, distingue error real de 404 (`.maybeSingle`), shell de una columna con secciones apilables (deja el seam documentado para Phase 11+ INT/MONEY), `not-found` espejo de proyecto.
- `ParlamentarioHeader` reusable: CamaraChip + nombre `<h1>` + cargo (distrito/circunscripción + región) + ProvenanceBadge. Sin foto (la maestra no trae URL con fuente). Chip de partido OMITIDO (LEGAL-03).
- Sección VOTE: asistencia (barra CSS-pura + desglose textual con `Ausente`, a11y), lista por votación `fecha DESC` paginada `?votosPage=N` (20/pág, deep-linkable), voto×tema faceta `?materia=slug` (conteos crudos, CERO score), votó distinto a su bancada (conteo + lista + footnote del método, sin juicio).
- Tres estados honestos (§3.6): confirmado → fila completa; mención sin verificar → `IdentityMarker`, fuera de los agregados, nunca enlaza al parlamentario; no-ingestado ≠ ingestado-cero, un vacío nunca se lee como "limpio".
- RPC `parlamentario_publico` (migración 0020, security definer) + pgTAP: la cabecera pública existe sin exponer `partido`/`rut`/`email`.
- Gate de contenido §9.1 verde: assert RTL sobre el render + grep de no-comentarios. `pnpm --filter app test` 82/82 verde; `pnpm --filter app build` verde.

## Task Commits

1. **Task 1 (RED): test RTL — 3 estados + gate §9.1** — `aca9d73` (test)
2. **Task 1 (GREEN): shell + header + VotoFichaRow + tipos + RPC 0020** — `04086c1` (feat)
3. **Task 2 (GREEN): sección VOTE (asistencia + lista + tema + votó distinto)** — `66508ab` (feat)

_El test (RED) cubre el comportamiento de ambas tareas; la implementación se separó en dos commits feat por tarea. Sin REFACTOR (no necesario)._

## Files Created/Modified
- `app/app/parlamentario/[id]/page.tsx` — ruta + shell apilable + lectura de cabecera vía RPC + skeletons.
- `app/app/parlamentario/[id]/not-found.tsx` — copy honesto §6.1.
- `app/components/parlamentario-header.tsx` — cabecera reusable (sin chip de partido por LEGAL-03).
- `app/components/voto-ficha-row.tsx` — `VotoFichaRow` (estado a) + `VotoFichaMencionRow` (estado b).
- `app/components/votos-por-parlamentario.tsx` — `VotosSection` (RSC) + `VotosView` (pura).
- `app/components/votos-por-parlamentario.test.tsx` — RTL: 3 estados, asistencia con ausente, voto×tema, votó distinto, gate §9.1, paginación.
- `app/lib/types.ts` — `ParlamentarioPublicoRow`, `VotoFichaRow`, `VotoFichaMencion`, `RebeldiaRow`.
- `app/lib/buscar.ts` — `PARLAMENTARIO_ID_RE` (validador único del path).
- `app/components/voto-row.tsx` — exporta `SELECCION_STYLE` (reuso del className a11y-safe).
- `supabase/migrations/0020_parlamentario_publico.sql` — RPC `parlamentario_publico` security definer + grant a anon.
- `supabase/tests/0020_parlamentario_publico.test.sql` — pgTAP (7 asserts): existe, security definer, anon execute, sin policies, anon no lee partido, devuelve cabecera, no emite PII.

## Decisions Made
- **Chip de partido OMITIDO (LEGAL-03):** `partido` es afiliación política (sensible, Ley 21.719) y `parlamentario` es deny-by-default. El RPC `parlamentario_publico` no lo emite y la cabecera no lo muestra — coincide con el criterio de éxito "partido never exposed to anon".
- **Faceta voto×tema por `proyecto.materia`:** el RPC `votos_de_parlamentario` no devuelve materia; se une por boletín a `proyecto` (público-read 0008). Cero materia fabricada.
- **Guarda doble en `VotoFichaRow`:** el enlace al PROYECTO (`/proyecto/[boletin]`) es ruta interna confiable y siempre se enlaza; la guarda de identidad (estado b) gobierna SOLO el enlace/atribución al PARLAMENTARIO.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Nueva migración 0020 — RPC `parlamentario_publico` (canal público a la cabecera)**
- **Found during:** Task 1 (lectura de la cabecera del parlamentario)
- **Issue:** El plan asume `lee parlamentario por id con .maybeSingle()`, pero `parlamentario` es deny-by-default (RLS on, cero policies, 0005/0018): el rol anon NO lee NINGUNA columna directamente → un `select` por anon devuelve 0 filas y la página haría `notFound()` para un parlamentario que SÍ existe. Sin un canal público-seguro, la ficha es no funcional.
- **Fix:** RPC `parlamentario_publico(p_id)` `security definer set search_path=''` (espejo EXACTO de `rebeldias_de_parlamentario` de 0019) que lee la maestra internamente y emite SOLO columnas públicas (id, nombre, cámara, región, distrito, circunscripción, periodo, provenance). NUNCA `partido`/`rut`/`email`. `grant execute … to anon`; CERO policy sobre `parlamentario`. + pgTAP 0020.
- **Files modified:** `supabase/migrations/0020_parlamentario_publico.sql`, `supabase/tests/0020_parlamentario_publico.test.sql`, `app/app/parlamentario/[id]/page.tsx`, `app/lib/types.ts`
- **Verification:** `pnpm --filter app build`/typecheck verde; pgTAP escrito (aplicación al remoto = paso de OPERADOR, ver abajo).
- **Committed in:** `04086c1`

**2. [Rule 3 - Blocking] `voto-row.tsx` debía exportar `SELECCION_STYLE`**
- **Found during:** Task 1 (`VotoFichaRow` reusa el className a11y-safe del chip)
- **Issue:** `SELECCION_STYLE` era privado de `voto-row.tsx`; `voto-ficha-row.tsx` lo necesita para no duplicar los colores a11y-safe (incluida la variante `ausente` ya añadida en Plan 01).
- **Fix:** Se exportó `SELECCION_STYLE`. El label de la ficha usa el copy §9 ("A favor"/"En contra") en un mapa propio, reusando solo el className.
- **Files modified:** `app/components/voto-row.tsx`
- **Verification:** typecheck verde; los tests de `voto-row` siguen pasando (6/6).
- **Committed in:** `04086c1`

**3. [Rule 1 - Bug] El grep de gate §9.1 marcaba el docstring que lista los términos prohibidos**
- **Found during:** Verificación (grep de contenido del plan)
- **Issue:** El grep del plan solo descarta comentarios de línea `//`, no bloques `/* */`. El docstring de `votos-por-parlamentario.tsx` deletreaba los términos prohibidos como documentación → falso positivo del gate.
- **Fix:** Se reescribió el docstring para referir a UI-SPEC §9.1 sin deletrear los términos. La copy/código user-facing siempre estuvo limpia (lo prueba el assert RTL sobre `container.textContent`).
- **Files modified:** `app/components/votos-por-parlamentario.tsx`
- **Verification:** grep de contenido → "content gate OK"; assert RTL del gate verde.
- **Committed in:** `66508ab`

---

**Total deviations:** 3 auto-fixed (1 missing critical, 1 blocking, 1 bug)
**Impact on plan:** La migración 0020 es imprescindible para que la ficha funcione (gap real del plan, en patrón con 0019, sin nuevas tablas ni cambio arquitectónico). Las otras dos son higiene. Sin scope creep: el alcance es exactamente ficha + sección VOTE + tipos + gate.

## Issues Encountered
- `app/lib/buscar.test.ts:156` falla el typecheck del paquete `app` (TS2532/TS2493). PRE-EXISTENTE, no relacionado, documentado en `deferred-items.md` (registrado en Plan 01). `next build` lo excluye y pasa; los archivos de este plan compilan limpio.

## Operator Next Steps (aplicación de 0020 al remoto)
La migración 0020 NO se aplicó al remoto desde aquí (build/typecheck no prueban el DDL; el `.env` tiene BOM, Pitfall 5). Igual que 0018/0019, es un paso de OPERADOR:
- Aplicar `supabase/migrations/0020_parlamentario_publico.sql` al remoto sa-east-1 (`psql "$SUPABASE_DB_URL" -f …`, db-url sin BOM).
- Correr `supabase/tests/0020_parlamentario_publico.test.sql` (pgTAP, esperado 7/7 PASS).
- Verificar a mano (rol anon): `select partido from parlamentario` = 0 filas; `parlamentario_publico('P00001')` devuelve la cabecera.
- La app necesita además los datos en la nube (deuda v1.0 acarreada: cargar corpus/maestra + wiring app→nube) para render real; la ruta y la lógica ya están listas.

## Known Stubs
Ninguno. Todos los datos provienen de RPCs/tablas reales (sin valores placeholder). El estado (c) "no ingestado" es un camino honesto modelado (no un stub): `VotosView` lo expone explícitamente como distinto de "ingestado, 0 confirmados".

## Threat Flags
Ninguno nuevo. La única superficie de datos es lectura vía RPCs ya existentes (0019) + el nuevo RPC `parlamentario_publico` (0020), que reduce superficie respecto a un `select` directo: emite solo columnas públicas y deja `partido`/`rut`/`email` deny-by-default (refuerza LEGAL-03).

## TDD Gate Compliance
Task 1/2 (`tdd="true"`): RED (`aca9d73`, test que define el comportamiento de ambas) → GREEN (`04086c1` shell/header/tipos/RPC, `66508ab` sección VOTE). Secuencia verificada en git log. Sin REFACTOR.

## Next Phase Readiness
- La ficha `/parlamentario/[id]` es la base del frente "parlamentarios 360": Phase 11 (INT lobby) y 12 (INT probidad) apilan su `<section>` en el seam documentado del shell, cada una con su `<h2>`+Suspense+empty honesto, sin componer datos de otro bloque.
- `ParlamentarioHeader` y el patrón RPC-security-definer-sobre-tabla-deny-by-default son reusables tal cual por las secciones de PII futuras.
- Pendiente de OPERADOR: aplicar 0020 al remoto + cargar datos a la nube (deuda v1.0) para render con datos reales.

## Self-Check: PASSED

- Archivos creados verificados en disco: page.tsx, not-found.tsx, parlamentario-header.tsx, voto-ficha-row.tsx, votos-por-parlamentario.tsx, votos-por-parlamentario.test.tsx, 0020 migración+test, 10-03-SUMMARY.md.
- Commits verificados en git: aca9d73 (test), 04086c1 (feat), 66508ab (feat).

---
*Phase: 10-vote-voto-individual-por-parlamentario-en-la-ficha*
*Completed: 2026-06-19*
