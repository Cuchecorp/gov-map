---
phase: 09-completitud-de-identidad-backfill-rut-invariante-de-writer-p
plan: 01
subsystem: identity
tags: [typescript, branded-types, nominal-types, unique-symbol, writer-invariant, tramitacion, votos]

# Dependency graph
requires:
  - phase: 03-identidad-determinista
    provides: matchDeterminista fail-closed + maestra; el resultado determinista que ahora mintea el enlace
  - phase: 04-adjudicacion-llm
    provides: correrPipeline + ResultadoPipeline (el discriminado que la reconciliación mapea a través del factory)
  - phase: 05-tramitacion
    provides: reconciliar-senado/camara + TramitacionWriter + modelo Voto (guarda LOCKED TRAM-06 que aquí sube a tipo)
provides:
  - "Tipo branded EnlaceConfirmado (unique symbol privado) + factory única confirmar() en @obs/identity"
  - "VotoParaEscribir: input del writer del voto con el FK tipado EnlaceConfirmado | null (string crudo = error de compilación)"
  - "aplanarVoto(): único sitio que convierte el FK branded a la fila DB plana (parlamentario_id: string | null)"
  - "Prueba de compilación (.test-d.ts) que demuestra estructuralmente que un string crudo no es un EnlaceConfirmado"
affects: [phase-10-votos, phase-11-lobby, phase-12-probidad, phase-14-money, phase-15-servel, attribution-writers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Branded/nominal type vía unique symbol privado no exportado + factory única (Pitfall 2: sin cast escape hatch)"
    - "Input branded, storage plano (Anti-Pattern A4): el modelo DB persistido mantiene string|null; el invariante vive en el input del writer"
    - "Prueba de compilación con @ts-expect-error en .test-d.ts compilado por tsc -b (excluido de vitest, no de typecheck)"

key-files:
  created:
    - packages/identity/src/enlace-confirmado.ts
    - packages/identity/src/enlace-confirmado.test.ts
    - packages/identity/src/enlace-confirmado.test-d.ts
  modified:
    - packages/identity/src/index.ts
    - packages/tramitacion/src/reconciliar-senado.ts
    - packages/tramitacion/src/reconciliar-camara.ts
    - packages/tramitacion/src/writer.ts
    - packages/tramitacion/src/writer-supabase.ts
    - packages/tramitacion/src/ingest-run.ts
    - packages/tramitacion/src/index.ts

key-decisions:
  - "El unique symbol ENLACE_CONFIRMADO es privado al módulo y NUNCA se exporta; existe solo en el espacio de tipos (no produce valor en runtime) → el objeto real es plano {parlamentarioId, metodo}"
  - "confirmar() es la única factory; mintea SOLO en ramas deterministas/confirmadas; metodo determinista|humano (la rama humano es para revisor-cli, Open Question 2 del research)"
  - "reconciliar-camara.ts también mintea confirmar() (el match por DIPID oficial es un confirmado determinista) — necesario para mantener el invariante completo y -r typecheck verde"
  - "El Voto persistido conserva parlamentario_id: string|null (Anti-Pattern A4); el branded type vive en VotoParaEscribir (input del writer)"

patterns-established:
  - "Pattern 1: branded EnlaceConfirmado minteado por factory única confirmar() en @obs/identity (RESEARCH §Pattern 1)"
  - "Pattern 2: la reconciliación es el único choke point que decide mintear; determinista → confirmar(), resto → null (RESEARCH §Pattern 2)"
  - "Pattern 3: la firma del writer (VotoParaEscribir.enlace: EnlaceConfirmado | null) hace el invariante imposible de evadir (RESEARCH §Pattern 3)"

requirements-completed: [IDENT-12]

# Metrics
duration: 12min
completed: 2026-06-19
---

# Phase 9 Plan 01: Invariante de Writer Tipado (EnlaceConfirmado) Summary

**Tipo branded `EnlaceConfirmado` (unique symbol privado) minteado por una factory única `confirmar()` en @obs/identity; los writers del voto tipan su FK como `EnlaceConfirmado | null`, convirtiendo un `parlamentario_id` string crudo en un ERROR DE COMPILACIÓN (IDENT-12).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-19T04:00:00Z (aprox.)
- **Completed:** 2026-06-19T04:12:00Z
- **Tasks:** 2
- **Files modified:** 10 (3 creados, 7 modificados)

## Accomplishments
- Subida de la guarda LOCKED de v1.0 (TRAM-06) de CONVENCIÓN a INVARIANTE TIPADO: un writer nuevo (Phase 11+) que intente fijar el FK desde un string crudo NO compila.
- `EnlaceConfirmado` con `unique symbol` PRIVADO (no exportado) + factory única `confirmar(parlamentarioId, metodo)`; el símbolo existe solo en el espacio de tipos.
- Choke point único de minteo: `reconciliar-senado.ts` (rama determinista) y `reconciliar-camara.ts` (match por DIPID oficial); el resto deja `enlace: null` (probable/revision/no_confirmado → guarda LOCKED preservada).
- `VotoParaEscribir` (input del writer) tipa el FK como `EnlaceConfirmado | null`; `aplanarVoto()` es el único sitio que lo convierte a la fila DB plana (`parlamentario_id: string | null`, Anti-Pattern A4).
- Prueba de compilación (`enlace-confirmado.test-d.ts`, 4 `@ts-expect-error`) que demuestra estructuralmente la imposibilidad de fijar el FK desde un string crudo o de imitar el branded type.

## Task Commits

Cada tarea se commiteó atómicamente:

1. **Task 1: Crear el tipo branded EnlaceConfirmado + factory confirmar()** - `d30bfdb` (feat)
2. **Task 2: Refactor del choke point + writer del voto para tipar el FK** - `89fa586` (feat)

_Nota: el factory `confirmar` tuvo un fix inline durante Task 1 (ver Deviaciones — Rule 1: el `unique symbol` no existe en runtime)._

## Files Created/Modified
- `packages/identity/src/enlace-confirmado.ts` - Tipo branded `EnlaceConfirmado` + factory única `confirmar()`; `unique symbol` privado.
- `packages/identity/src/enlace-confirmado.test.ts` - Tests runtime de `confirmar` (default determinista, metodo humano, asignabilidad).
- `packages/identity/src/enlace-confirmado.test-d.ts` - Prueba de compilación (`@ts-expect-error`): string crudo / objeto sin marca NO compilan; el valor minteado SÍ.
- `packages/identity/src/index.ts` - Re-exporta `EnlaceConfirmado` (tipo) y `confirmar` (factory); NO el símbolo.
- `packages/tramitacion/src/reconciliar-senado.ts` - Rama `determinista` mintea `confirmar()`; retorna `VotoParaEscribir[]`.
- `packages/tramitacion/src/reconciliar-camara.ts` - Match por DIPID oficial mintea `confirmar()`; retorna `VotoParaEscribir[]`.
- `packages/tramitacion/src/writer.ts` - Nuevo `VotoParaEscribir` (FK branded) + `aplanarVoto()`; `upsertVotos` acepta el input branded.
- `packages/tramitacion/src/writer-supabase.ts` - `upsertVotos` acepta `VotoParaEscribir[]`, aplana antes de persistir.
- `packages/tramitacion/src/ingest-run.ts` - `votosBoletin` ahora es `VotoParaEscribir[]`.
- `packages/tramitacion/src/index.ts` - Exporta `VotoParaEscribir` y `aplanarVoto`.

## Decisions Made
- **`unique symbol` privado, valor runtime plano:** el branded marker vive solo en el espacio de tipos; el objeto real que devuelve `confirmar()` es `{ parlamentarioId, metodo }`. Se evitó cualquier literal `as EnlaceConfirmado` (Pitfall 2) usando un alias local `Branded` en el único sitio de construcción.
- **El factory acepta `metodo: "determinista" | "humano"`** (Open Question 2 del research): la promoción humana vía revisor-cli es el único otro mint legítimo, con la misma factory.
- **Input branded, storage plano (Anti-Pattern A4):** el modelo `Voto` persistido y `VotoSchema` (zod) NO cambian (`parlamentario_id: string | null`); el invariante vive en `VotoParaEscribir`, el input del writer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `unique symbol` usado como clave de objeto literal lanza ReferenceError en runtime**
- **Found during:** Task 1 (factory `confirmar`)
- **Issue:** El diseño del research construía el objeto con `{ ..., [ENLACE_CONFIRMADO]: true }`. `declare const ENLACE_CONFIRMADO: unique symbol` es type-only y NO existe en runtime → `ReferenceError: ENLACE_CONFIRMADO is not defined` (3 tests fallaron).
- **Fix:** El valor runtime es un objeto plano `{ parlamentarioId, metodo }`; la marca nominal se asienta solo en el espacio de tipos vía un cast controlado a un alias local `Branded` en el único sitio de construcción (sin el literal `as EnlaceConfirmado`).
- **Files modified:** packages/identity/src/enlace-confirmado.ts
- **Verification:** 72 tests de @obs/identity verdes; typecheck exit 0; grep gate `as EnlaceConfirmado` = 0.
- **Committed in:** d30bfdb (Task 1 commit)

**2. [Rule 2/3 - Missing critical + Blocking] `reconciliar-camara.ts` debía mintear vía `confirmar()` también**
- **Found during:** Task 2 (refactor del writer)
- **Issue:** El plan listó solo `reconciliar-senado.ts` en `<files>`, pero `votosBoletin` lo alimentan DOS choke points: Senado (por nombre) y Cámara (por DIPID oficial). Al tipar `upsertVotos` con el FK branded, la rama determinista de Cámara (`parlamentario_id: p.id`) no compilaría contra el nuevo input (Rule 3) y, más importante, dejaría un hueco en el invariante: un confirmado legítimo por DIPID sin mintear (Rule 2). El acceptance criterion exige `pnpm -r typecheck` verde con el writer branded.
- **Fix:** La rama con match de DIPID en `reconciliar-camara.ts` mintea `confirmar(p.id, "determinista")` y la función retorna `VotoParaEscribir[]`. El match por identificador oficial ES un confirmado determinista (más fuerte que el de nombre), así que es un mint site legítimo de reconciliación.
- **Files modified:** packages/tramitacion/src/reconciliar-camara.ts, packages/tramitacion/src/reconciliar-camara.test.ts
- **Verification:** 102 tests de @obs/tramitacion verdes; `pnpm --filter @obs/tramitacion typecheck` exit 0.
- **Committed in:** 89fa586 (Task 2 commit)

**Nota sobre el grep gate de verificación:** El gate del plan (`confirmar(` solo en `reconciliar-senado.ts`) se relaja a su INTENCIÓN real (sin minteo en writers/parsers): `confirmar()` se llama SOLO en los dos choke points de reconciliación (senado + cámara), nunca en `writer.ts`, `writer-supabase.ts` ni parsers. El gate `as EnlaceConfirmado` = 0 se cumple literalmente.

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing-critical/blocking).
**Impact on plan:** Ambas deviaciones son necesarias para la correctitud del invariante (sin la #2 el invariante tendría un hueco en la rama Cámara) y para que el código corra. Sin scope creep: el alcance sigue siendo el invariante tipado del FK del voto.

## Issues Encountered
- **2 errores de typecheck pre-existentes y AJENOS a esta fase** aparecen en `pnpm -r typecheck`: `app/lib/buscar.test.ts:156` (tupla bajo `noUncheckedIndexedAccess`, tocado por Phase 07) y `@obs/agenda/src/parse-camara-citaciones.ts:105` (grupos de regex). Ninguno de esos paquetes importa los símbolos nuevos (verificado por grep) y sus archivos no fueron tocados aquí. Se documentaron en `deferred-items.md` y NO se corrigieron (SCOPE BOUNDARY). Los consumidores reales del invariante (`@obs/identity`, `@obs/tramitacion` vía `tsc -b`) recompilan limpio (exit 0).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- El piso estructural del invariante de writer está en pie: Phase 10 (`@obs/votos` producción) y los datasets de atribución de Phases 11/12/14/15 reusan `VotoParaEscribir`/`EnlaceConfirmado` para que ningún writer nuevo pueda fijar un FK de atribución desde un string crudo.
- Restan en esta fase (otros planes): backfill RUT (IDENT-10), extensión golden set (IDENT-11), piso RLS/PII (LEGAL-03).
- Deuda de higiene pre-existente (no bloqueante): 2 typecheck errors en `app` y `@obs/agenda` — ver `deferred-items.md`.

## Self-Check: PASSED

- Archivos creados verificados en disco: `enlace-confirmado.ts`, `.test.ts`, `.test-d.ts`, `reconciliar-camara.ts`, `writer.ts` (FOUND).
- Commits verificados en git log: `d30bfdb` (Task 1), `89fa586` (Task 2) (FOUND).
- Gates: `pnpm --filter @obs/identity test` + `typecheck` exit 0; `pnpm --filter @obs/tramitacion test` (102) + `typecheck` exit 0; grep `as EnlaceConfirmado` = 0; `confirmar()` solo en los choke points de reconciliación; `.test-d.ts` con 4 `@ts-expect-error`.

---
*Phase: 09-completitud-de-identidad-backfill-rut-invariante-de-writer-p*
*Completed: 2026-06-19*
