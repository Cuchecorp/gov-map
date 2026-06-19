# Phase 09 — Deferred Items (out-of-scope discoveries during execution)

## Plan 09-01

### [Pre-existing, OUT OF SCOPE] `app` typecheck falla en `app/lib/buscar.test.ts:156`

- **Found during:** Plan 09-01, paso `pnpm -r typecheck` (acceptance check).
- **Error:**
  - `lib/buscar.test.ts(156,17): error TS2532: Object is possibly 'undefined'.`
  - `lib/buscar.test.ts(156,41): error TS2493: Tuple type '[]' of length '0' has no element at index '0'.`
- **Línea:** `const arg = emb.embed.mock.calls[0][0][0] as string;` — acceso a tupla
  bajo `noUncheckedIndexedAccess` sobre el mock de `embed`.
- **Por qué es pre-existente y ajeno a 09-01:**
  - `app` NO importa ninguno de los símbolos nuevos de esta fase
    (`EnlaceConfirmado`, `VotoParaEscribir`, `aplanarVoto`) — verificado por grep.
  - `app/lib/buscar.test.ts` se tocó por última vez en Phase 07 (commit `86073bf`),
    mucho antes de este plan.
  - El error aparece solo en `app` (que usa `tsc --noEmit`, incluyendo tests);
    `@obs/identity` y `@obs/tramitacion` (y sus dependientes via `tsc -b`) typechequean exit 0.
- **Acción:** NO se corrige aquí (SCOPE BOUNDARY). Se difiere a un fix de Phase 10+
  o a un barrido de higiene de tests del `app`.

### [Pre-existing, OUT OF SCOPE] `@obs/agenda` typecheck falla en `parse-camara-citaciones.ts:105`

- **Found during:** Plan 09-01, paso `pnpm -r typecheck`.
- **Error:** `src/parse-camara-citaciones.ts(105,24): error TS2532: Object is possibly 'undefined'.`
- **Línea:** `const boletin = \`${m[1].replace(...)}-${m[2]}\`;` — acceso a grupos de
  `RegExpExecArray` bajo `noUncheckedIndexedAccess`.
- **Por qué es pre-existente y ajeno a 09-01:**
  - `@obs/agenda` depende SOLO de `@obs/core` y `@obs/ingest` — NO de `@obs/identity`
    ni `@obs/tramitacion`. No importa ninguno de los símbolos nuevos.
  - El archivo se tocó por última vez en `dea2578` (fix de agenda), no en este plan;
    el dir `packages/agenda` quedó intacto (sin cambios míos).
- **Acción:** NO se corrige aquí (SCOPE BOUNDARY). Diferido a higiene de `@obs/agenda`.

### Nota sobre la acceptance criterion `pnpm -r typecheck`

Los consumidores REALES del invariante (`@obs/identity`, `@obs/tramitacion` y sus
dependientes vía `tsc -b`) recompilan limpio (exit 0). Las únicas dos fallas de
`pnpm -r typecheck` son `app` y `@obs/agenda`, ambas pre-existentes y sin relación con
los símbolos branded (verificado por grep + git log). No se tocan por SCOPE BOUNDARY.

