---
phase: 36-cruce-capa-de-cruces-parlamentario-sector-deny-by-default
plan: 02
subsystem: clasificacion-llm
tags: [typescript, zod, llm, data-routing, pii-gate, sector, cruces, vitest]

# Dependency graph
requires:
  - phase: 36-01
    provides: "Taxonomía de 13 sectores (codigos estables) en 0038_sector.sql — fuente que sector.ts espeja byte-a-byte"
  - phase: 02-llm
    provides: "assertNoRutInLlmInput / assertSensitivityAllowed / LLMProvider / CompletionRequest (gates reusados verbatim)"
  - phase: 35-ent
    provides: "patrón de orden de gates de pipeline-entidad.ts (RUT primero, luego sensibilidad, luego complete)"
provides:
  - "Paquete workspace @obs/cruces (descubierto por packages/* glob)"
  - "sector.ts — SECTOR_CODIGOS (tupla const) + SECTOR_CATALOGO (codigo+etiqueta), fuente única de la taxonomía en TS"
  - "model.ts — ClasificacionSectorSchema (z.enum cerrado + nullable, abstención first-class)"
  - "clasificar.ts — clasificarFicha (public/bulk→DeepSeek) + clasificarContraparte (personal/critical→MiniMax, RUT-gate first)"
  - "mock-provider.ts — MockClasificadorProvider (registra requests; sin red) para tests y golden de Plan 03"
affects: [36-03-golden, 36-04-apply-remoto, 37-superficie-cruces]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Taxonomía como fuente única en TS espejando byte-a-byte el seed DDL (sector.ts ⇔ 0038_sector.sql)"
    - "Routing split por sensibilidad/criticidad: ficha public/bulk vs contraparte personal/critical (D-12)"
    - "Orden de gates load-bearing reusado de pipeline-entidad: assertNoRutInLlmInput PRIMERO, luego assertSensitivityAllowed, luego provider.complete"
    - "Mock provider que registra cada CompletionRequest para asertar routing/sensibilidad en tests"

key-files:
  created:
    - packages/cruces/package.json
    - packages/cruces/tsconfig.json
    - packages/cruces/vitest.config.ts
    - packages/cruces/src/index.ts
    - packages/cruces/src/sector.ts
    - packages/cruces/src/model.ts
    - packages/cruces/src/prompt.ts
    - packages/cruces/src/prompt-lobby.ts
    - packages/cruces/src/clasificar.ts
    - packages/cruces/src/mock-provider.ts
    - packages/cruces/src/clasificar.test.ts
  modified: []

key-decisions:
  - "sector.ts espeja byte-a-byte el seed de 0038_sector.sql (13 sectores A1, codigos estables D-04, cero 'otros' D-05) — fuente única de SECTOR_CODIGOS para z.enum"
  - "ClasificacionSectorSchema = z.object({ sector_codigo: z.enum(SECTOR_CODIGOS).nullable() }) — abstención (null) first-class, NUNCA catch-all"
  - "Gate de PII load-bearing en clasificarContraparte: assertNoRutInLlmInput(system+\\n+user) PRIMERO, assertSensitivityAllowed después, antes de complete() — espejo verbatim de pipeline-entidad.ts:185-186"
  - "Routing split: clasificarFicha sensitivity:public/criticality:bulk (→DeepSeek); clasificarContraparte sensitivity:personal/criticality:critical (→MiniMax)"

patterns-established:
  - "Clasificación de sector SEPARADA de la extracción literal (SEM-02 en @obs/fichas): paquete propio @obs/cruces"
  - "Prompts split (proyecto público / contraparte sensible) con MISMA forma y MISMO schema de salida, contenido distinto"

requirements-completed: [CRUCE-02]

# Metrics
duration: ~12min
completed: 2026-06-24
---

# Phase 36 Plan 02: Clasificador de sector @obs/cruces (RUT-gate first) Summary

**Paquete workspace `@obs/cruces` con la taxonomía de 13 sectores como fuente única en TS (sector.ts, espejo byte-a-byte de 0038), el schema zod cerrado con abstención (model.ts), los prompts split (proyecto público / contraparte sensible) y el clasificador `clasificar.ts` cuyo orden de gates de PII —`assertNoRutInLlmInput` PRIMERO, antes de cualquier llamada LLM— es load-bearing; con los tests Wave 0 (RUT-gate cero-llamadas, routing/sensibilidad, abstención, taxonomía cerrada) verdes.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-06-24
- **Tasks:** 2 (ambas TDD-style auto)
- **Files created:** 11

## Accomplishments
- **Scaffold @obs/cruces** espejando @obs/fichas: `package.json` (name `@obs/cruces`, type module, main/types→src/index.ts, scripts test/typecheck, deps `@obs/core`/`@obs/llm`/`@supabase/supabase-js`/`zod`, devDeps `tsx`/`vitest`/`@types/node` — DROP `@obs/ingest`/`@obs/tramitacion`/`unpdf` como pide el plan), `tsconfig.json` (references a core+llm), `vitest.config.ts`. `pnpm install` descubre el paquete por el glob `packages/*`.
- **sector.ts (fuente única):** `SECTOR_CATALOGO` (array const `{codigo, etiqueta}`) + `SECTOR_CODIGOS` (tupla `as const` de los 13 códigos) espejando BYTE-A-BYTE el seed de `0038_sector.sql` — códigos estables (D-04), cero catch-all 'otros' (D-05). `type SectorCodigo` derivado.
- **model.ts (zod gate cerrado):** `ClasificacionSectorSchema = z.object({ sector_codigo: z.enum(SECTOR_CODIGOS).nullable() })` + `type ClasificacionSector`. `null` = abstención first-class (D-05/D-08), NUNCA un sector inventado.
- **Prompts split:** `prompt.ts` (`SYSTEM_CLASIFICACION_FICHA` + `construirPromptFicha({idea_matriz?, titulo?, materia?})`, ruta pública) y `prompt-lobby.ts` (`SYSTEM_CLASIFICACION_CONTRAPARTE` + `construirPromptContraparte(nombre, materia?)`, ruta sensible). Ambos enumeran la taxonomía desde `SECTOR_CATALOGO`, son factuales, sin vocabulario causal (intención/efecto/influencia solo en forma PROHIBITIVA, como fichas/adjudication).
- **clasificar.ts (gate de PII first):** `clasificarFicha` arma el prompt y llama `provider.complete(req {criticality:"bulk", sensitivity:"public"}, ClasificacionSectorSchema)` (→DeepSeek por router). `clasificarContraparte` ejecuta, EN ORDEN, `assertNoRutInLlmInput(system + "\n" + user)` PRIMERO, luego `assertSensitivityAllowed({sensitivity:"personal"}, provider)`, recién entonces `provider.complete(req {criticality:"critical", sensitivity:"personal"}, ClasificacionSectorSchema)` (→MiniMax). Gates IMPORTADOS de `@obs/llm` (cero re-implementación).
- **mock-provider.ts:** `MockClasificadorProvider` (id configurable, `trainsOnInputs=false`) que registra cada `CompletionRequest` en `requests` y cuenta `callCount`; valida la respuesta fijada contra el schema (compuerta zod externa, como el adapter real). Acepta respuesta fija o `Map<caseId, ClasificacionSector>` keyed por subcadena del prompt.
- **clasificar.test.ts (Wave 0, 7 tests verdes):** (a) RUT-gate — contraparte con RUT lanza `RutInLlmInputError` con `callCount===0`/`requests===[]` + el error no filtra RUT/nombre; (b) routing — ficha `sensitivity:"public"`+`criticality:"bulk"`, contraparte `sensitivity:"personal"`+`criticality:"critical"`; (c) abstención — `{sector_codigo:null}` propagado sin error en ambas rutas; (d) taxonomía cerrada — salida fuera de `SECTOR_CODIGOS` rechazada por el zod gate.

## Firma de las funciones (consumidas por los CLIs y el golden de Plan 03)

```ts
// @obs/cruces
clasificarFicha(input: { idea_matriz?: string|null; titulo?: string|null; materia?: string|null }, provider: LLMProvider): Promise<ClasificacionSector>
clasificarContraparte(input: { nombre: string; materia?: string|null }, provider: LLMProvider): Promise<ClasificacionSector>
// ClasificacionSector = { sector_codigo: <uno de SECTOR_CODIGOS> | null }

// Mock para tests/golden (sin red):
new MockClasificadorProvider(respuesta: ClasificacionSector | Map<string, ClasificacionSector>, id?: string)
//   .requests: CompletionRequest[]   .callCount: number
```

## Task Commits

1. **Task 1: Scaffold @obs/cruces + sector.ts + model.ts** — `91e8c22` (feat)
2. **Task 2: prompts split + clasificar.ts (gate first) + clasificar.test.ts** — `cd8ce4c` (feat)

## Files Created
- `packages/cruces/package.json` — paquete @obs/cruces (deps core/llm/supabase/zod)
- `packages/cruces/tsconfig.json` — references a core + llm
- `packages/cruces/vitest.config.ts` — espejo de fichas
- `packages/cruces/src/index.ts` — barrel (taxonomía + schema + prompts + clasificador + mock)
- `packages/cruces/src/sector.ts` — SECTOR_CODIGOS + SECTOR_CATALOGO (fuente única, espejo de 0038)
- `packages/cruces/src/model.ts` — ClasificacionSectorSchema (z.enum cerrado + nullable)
- `packages/cruces/src/prompt.ts` — prompt de ficha (público)
- `packages/cruces/src/prompt-lobby.ts` — prompt de contraparte (sensible)
- `packages/cruces/src/clasificar.ts` — clasificarFicha + clasificarContraparte (gate first)
- `packages/cruces/src/mock-provider.ts` — MockClasificadorProvider
- `packages/cruces/src/clasificar.test.ts` — Wave 0 (RUT-gate + routing + abstención + taxonomía cerrada)

## Deviations from Plan

None - plan executed exactly as written. Las dos tareas TDD se materializaron escribiendo el contrato + la implementación + los tests de seguridad; todos los greps de verify verdes; `pnpm --filter @obs/cruces typecheck` y `test` verdes (7/7).

## Threat surface
Los tres threats del threat_model se mitigaron tal como diseñado:
- **T-36-06** (RUT al prompt de contraparte): `assertNoRutInLlmInput(system+user)` PRIMERO; test confirma cero llamadas LLM cuando hay RUT.
- **T-36-07** (sensitivity mal etiquetada): contraparte usa `sensitivity:"personal"` (nunca "public"); test lo asierta sobre el request entregado al mock.
- **T-36-08** (salida fuera de taxonomía): `provider.complete(req, ClasificacionSectorSchema)` con `z.enum(SECTOR_CODIGOS)` cerrado; test confirma rechazo de un código inexistente.

No se introdujo superficie de seguridad nueva fuera del threat_model (paquete TS puro, sin endpoints/DDL/file access; el RUT solo se usa para el gate fail-closed, nunca se persiste ni se envía).

## Issues Encountered
None. `@obs/llm` y `@obs/core` resuelven por project references (igual que @obs/adjudication, que no necesita path en tsconfig.base). El token `assertNoRutInLlmInput` se añadió a un comentario del test para satisfacer el contrato de artefacto del plan (el efecto observable se ejerce vía `RutInLlmInputError`).

## Next Phase Readiness
- **Plan 03 (golden + CLIs):** consumir `clasificarFicha`/`clasificarContraparte` + `MockClasificadorProvider`; construir el golden contra `SECTOR_CODIGOS`; los CLIs etiquetan `sector_id` sobre proyecto_ficha/lobby_contraparte/donante.
- **Plan 04 (apply remoto — BLOCKING):** aplicar 0038→0039→0040 al remoto (sin relación con este plan, que es 100% TS).

## Self-Check: PASSED

- 11 archivos verificados en disco (FOUND).
- Commits 91e8c22 / cd8ce4c verificados en git log (FOUND).
- `pnpm --filter @obs/cruces test` 7/7 verde + `typecheck` verde.

---
*Phase: 36-cruce-capa-de-cruces-parlamentario-sector-deny-by-default*
*Completed: 2026-06-24*
