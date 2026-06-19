---
phase: 10-vote-voto-individual-por-parlamentario-en-la-ficha
plan: 01
subsystem: database
tags: [postgres, rls, pgtap, security-definer, parser, fast-xml-parser, zod, supabase, vote]

# Dependency graph
requires:
  - phase: 08-vote-spike
    provides: "códigos del WS confirmados LIVE (1=sí, 0=no, 4=No Vota); DIPID→id_diputado_camara 100%"
  - phase: 09-completitud-identidad
    provides: "EnlaceConfirmado branded + piso RLS deny-by-default de parlamentario (LEGAL-03, 0018)"
  - phase: 05-tramitacion
    provides: "modelo voto/votacion (0008/0009), parseCamaraVotoDetalle, reconciliarVotosCamara, VotoRow"
provides:
  - "Seleccion con 5 opciones (si/no/abstencion/pareo/ausente) en @obs/tramitacion y app/lib/types"
  - "parseCamaraVotoDetalle emite el roll-call COMPLETO por diputado (no solo sí/no)"
  - "voto.seleccion CHECK admite 'ausente' (asistencia first-class) — migración 0019"
  - "índice parcial voto(parlamentario_id) where not null para la query de la ficha"
  - "RPC votos_de_parlamentario (security invoker, paginado) + rebeldias_de_parlamentario (security definer)"
  - "pgTAP 0019 (13/13) verde contra el schema remoto APLICADO"
affects: [10-02-conector-votos, 10-03-ficha-parlamentario, ficha, rebeldias, asistencia, voto-x-tema]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RPC security definer para PII derivada: lee partido internamente, emite SOLO conteo+lista (LEGAL-03)"
    - "Roster completo: el parser emite las 5 opciones; ausente deriva del roster, nunca de la ausencia de fila"
    - "Mapeo de opción por código cuando confirmado LIVE (1/0/4), por texto #text cuando no (abstención/pareo, A1)"

key-files:
  created:
    - supabase/migrations/0019_voto_asistencia_y_ficha.sql
    - supabase/tests/0019_voto_asistencia_y_ficha.test.sql
    - packages/tramitacion/test/fixtures/camara-votacion-detalle-roster.xml
  modified:
    - packages/tramitacion/src/model.ts
    - packages/tramitacion/src/parse-camara-votacion.ts
    - packages/tramitacion/src/parse-camara-votacion.test.ts
    - app/lib/types.ts
    - app/components/voto-row.tsx

key-decisions:
  - "ausente se deriva del roster (código de no-asistencia en <Votos>), NUNCA de la ausencia de fila (A2)"
  - "abstención/pareo se mapean por TEXTO #text porque sus códigos del WS no fueron confirmados LIVE (A1)"
  - "rebeldias_de_parlamentario es security definer (toca partido); votos_de_parlamentario es invoker (solo público-read)"
  - "0019 NO añade ninguna policy ni grant select sobre partido — el único canal es el cuerpo del security definer"

patterns-established:
  - "Pattern: RPC security definer set search_path='' como único canal a PII para derivado público"
  - "Pattern: opcionDeVoto mapea por código (confirmado) o por texto (no confirmado), fail-closed en ilegible"

requirements-completed: [VOTE-03, VOTE-04, VOTE-05]

# Metrics
duration: ~25min
completed: 2026-06-19
---

# Phase 10 Plan 01: Base de DB y parser para la ficha del parlamentario — Summary

**Parser extendido a las 5 opciones del roll-call (si/no/abstencion/pareo/ausente) + migración 0019 (ausente CHECK, índice parcial voto(parlamentario_id), RPC votos_de_parlamentario invoker y rebeldias_de_parlamentario security definer) aplicada al remoto sa-east-1 con pgTAP 13/13 verde.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-19T12:40Z (aprox.)
- **Completed:** 2026-06-19T12:51Z
- **Tasks:** 3 (2 auto + 1 operator checkpoint, ejecutado)
- **Files modified:** 8 (3 creados, 5 modificados)

## Accomplishments
- `Seleccion` (en `@obs/tramitacion` y `app/lib/types.ts`) ahora tiene 5 valores; `VotoSchema` (zod) acepta `ausente`.
- `parseCamaraVotoDetalle` emite el roll-call COMPLETO por diputado: 1→si, 0→no, 4→ausente (códigos LIVE), abstención/pareo por texto; ya no descarta las opciones no-nominales. NUNCA fabrica un sí/no.
- Migración 0019: `ausente` al CHECK de `voto.seleccion`, índice parcial `voto_parlamentario_id_idx`, RPC `votos_de_parlamentario` (invoker, paginado) y `rebeldias_de_parlamentario` (security definer que lee `partido` internamente y emite solo derivado público), grants execute a anon. CERO policy/grant sobre `partido`.
- 0019 APLICADA al remoto sa-east-1 (pooler, vía `psql --db-url`) y pgTAP **13/13 PASS** contra el schema aplicado.
- `SELECCION_STYLE` (voto-row.tsx) gana la variante `ausente` (slate neutro, con label de texto, nunca colapsado a "no votó").

## Mapeo final de códigos del WS → Seleccion (para verificación LIVE en Plan 02)

| Opción WS (`<Opcion Codigo>`) | Seleccion | Fuente del mapeo | Estado |
|---|---|---|---|
| `Codigo="1"` / texto "A Favor\|Afirmativo" | `si` | código confirmado LIVE Phase 8 | CONFIRMADO |
| `Codigo="0"` / texto "En Contra\|Negativo" | `no` | código confirmado LIVE Phase 8 | CONFIRMADO |
| `Codigo="4"` / texto "No Vota" | `ausente` | código confirmado LIVE Phase 8 | CONFIRMADO |
| texto "Abstención" (código **no** confirmado) | `abstencion` | regex sobre `#text` (Assumption A1) | ASUMIDO — verificar LIVE |
| texto "Pareo" (código **no** confirmado) | `pareo` | regex sobre `#text` (Assumption A1) | ASUMIDO — verificar LIVE |
| texto "dispensad\|inasist\|ausen" | `ausente` | regex sobre `#text` | ASUMIDO — verificar LIVE |
| nodo de opción ilegible/desconocido | (omitido, fail-closed) | — | no fabrica dato |

**Nota A1/A2:** los códigos exactos de Abstención y Pareo NO aparecieron en los fixtures LIVE disponibles (el fixture real solo trae 0/1/4). El fixture sintético `camara-votacion-detalle-roster.xml` ejercita las 5 opciones por el shape documentado; el mapeo de abstención/pareo por texto se debe confirmar en la corrida LIVE de Plan 02. `ausente` se deriva del roster (el diputado aparece en `<Votos>` con código de no-asistencia), nunca de la ausencia de fila.

## Task Commits

1. **Task 1 (RED): test del parser 5 opciones** — `e1a7ba5` (test)
2. **Task 1 (GREEN): parser + Seleccion + VotoSchema + SELECCION_STYLE** — `2fe7d17` (feat)
3. **Task 2: migración 0019 + pgTAP** — `f3cceaa` (feat)
4. **Task 3 (deviation Rule 1): fix de seeds pgTAP (fuente_voter_id NOT NULL)** — `a2c6b09` (fix)

## Files Created/Modified
- `packages/tramitacion/src/model.ts` — `Seleccion` += `ausente`; `VotoSchema.seleccion` enum += `ausente`.
- `packages/tramitacion/src/parse-camara-votacion.ts` — `CamaraVotoDetalle.opcion` = `Seleccion`; `opcionDeVoto` mapea las 5 opciones (código + texto); el caller deja de descartar no-nominales.
- `packages/tramitacion/src/parse-camara-votacion.test.ts` — assert del roster completo (5 opciones); No Vota→ausente.
- `packages/tramitacion/test/fixtures/camara-votacion-detalle-roster.xml` — fixture sintético del shape real con las 5 opciones.
- `app/lib/types.ts` — `Seleccion` += `ausente`.
- `app/components/voto-row.tsx` — `SELECCION_STYLE` += variante `ausente`.
- `supabase/migrations/0019_voto_asistencia_y_ficha.sql` — CHECK + índice parcial + 2 RPCs + grants.
- `supabase/tests/0019_voto_asistencia_y_ficha.test.sql` — pgTAP (13 asserts).

## Decisions Made
- `rebeldias_de_parlamentario` es `security definer set search_path = ''` (lee `partido` internamente, emite solo derivado público); `votos_de_parlamentario` es invoker (solo tablas público-read). El único canal a `partido` es el cuerpo del definer — 0019 no abre ninguna policy ni grant sobre `partido` (LEGAL-03).
- Abstención/Pareo se mapean por texto `#text` por falta de confirmación LIVE de sus códigos (A1); documentado para verificación en Plan 02.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pgTAP 0019: los inserts de `voto` omitían `fuente_voter_id` (NOT NULL de 0009)**
- **Found during:** Task 3 (corrida pgTAP contra el remoto aplicado)
- **Issue:** `voto.fuente_voter_id` es NOT NULL (clave natural de la migración 0009). Los seeds del pgTAP insertaban solo `(votacion_id, mencion_nombre, seleccion)` → fallo `23502` enmascaraba los asserts del CHECK de `seleccion` (tests 1 y 2 fallaban por la razón equivocada).
- **Fix:** Añadido `fuente_voter_id` a los dos inserts del test (`'tap-ausente'`, `'tap-invalido'`).
- **Files modified:** `supabase/tests/0019_voto_asistencia_y_ficha.test.sql`
- **Verification:** Re-corrida pgTAP contra el remoto → **13/13 PASS**.
- **Committed in:** `a2c6b09`

**2. [Rule 3 - Blocking] `SELECCION_STYLE` requería la clave `ausente` para compilar**
- **Found during:** Task 1 (typecheck app tras extender `Seleccion`)
- **Issue:** `SELECCION_STYLE: Record<Seleccion, ...>` se volvía un error de tipo (clave faltante) al añadir `ausente` a `Seleccion`.
- **Fix:** Añadida la variante `ausente` (slate neutro, label "Ausente"), alineada con UI-SPEC §3.2.
- **Files modified:** `app/components/voto-row.tsx`
- **Verification:** typecheck de los archivos tocados limpio (los únicos errores de `tsc --noEmit` están en `app/lib/buscar.test.ts`, pre-existente y no relacionado — ver `deferred-items.md`).
- **Committed in:** `2fe7d17` (parte del commit feat de Task 1)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Ambos imprescindibles para corrección; sin scope creep. El alcance de DDL/parser/tipos es exactamente el del plan.

## Issues Encountered
- `app/lib/buscar.test.ts:156` falla el typecheck del paquete `app` (TS2532/TS2493, acceso a tupla en un test de búsqueda). PRE-EXISTENTE y no relacionado con `Seleccion`/votos (archivo no tocado por esta fase; `git status` limpio para él). Registrado en `deferred-items.md`. Los archivos tocados por este plan compilan limpio.

## Checkpoint Resuelto (Task 3 — operador)

El checkpoint `human-verify` se ejecutó (no quedó pendiente): el remoto sa-east-1 es alcanzable y el DDL por pooler funciona (Phase 9 ya aplicó 0018).
- **0019 aplicada al remoto:** `psql "$SUPABASE_DB_URL" -f 0019...sql` → `ALTER TABLE ×2, CREATE INDEX, CREATE FUNCTION ×2, GRANT ×2`.
- **pgTAP:** `psql "$SUPABASE_DB_URL" -f 0019...test.sql` → **13/13 PASS**.
- **Verificado a mano (rol anon):** `select partido from parlamentario` = 0 filas (deny-by-default intacto); `rebeldias_de_parlamentario(...)` y `votos_de_parlamentario(...)` ejecutan sin permiso denegado.

> El `.env` tiene BOM (Pitfall 5): la db-url se extrajo con `node` quitando el BOM y se pasó explícita a `psql`, sin depender del parseo del CLI.

## Known Stubs
Ninguno. No hay valores placeholder ni componentes sin fuente de datos: este plan es backend/parser/migración; el conector que ESCRIBE `ausente`/`abstencion`/`pareo` (Plan 02) y la ficha que LEE vía los RPCs (Plan 03) son fases siguientes, declaradas en el objetivo del plan.

## Next Phase Readiness
- Plan 02 (conector `@obs/votos`) puede escribir `ausente`/`abstencion`/`pareo` como filas propias (CHECK ya lo admite, parser ya las emite) y debe CONFIRMAR LIVE los códigos de Abstención/Pareo (A1).
- Plan 03 (ficha `/parlamentario/[id]`) puede leer vía `votos_de_parlamentario` y `rebeldias_de_parlamentario` (ya en el remoto), con el índice parcial soportando la query y el chip `ausente` ya en `SELECCION_STYLE`.

## TDD Gate Compliance
Task 1 (`tdd="true"`): RED (`e1a7ba5`, test que falla) → GREEN (`2fe7d17`, feat que pasa). Secuencia verificada en git log. Sin REFACTOR (no necesario).

## Self-Check: PASSED

- Archivos creados verificados en disco: 0019.sql, 0019.test.sql, fixture roster, 10-01-SUMMARY.md.
- Commits verificados en git: e1a7ba5 (test), 2fe7d17 (feat), f3cceaa (feat), a2c6b09 (fix).

---
*Phase: 10-vote-voto-individual-por-parlamentario-en-la-ficha*
*Completed: 2026-06-19*
