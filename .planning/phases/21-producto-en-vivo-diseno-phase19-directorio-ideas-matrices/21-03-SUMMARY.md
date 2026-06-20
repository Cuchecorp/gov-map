---
phase: 21-producto-en-vivo-diseno-phase19-directorio-ideas-matrices
plan: 03
subsystem: fichas
tags: [fichas, pipeline, backfill, senado, idea-matriz, SC3, SC4]
status: task-1-complete-task-2-operator-checkpoint
requires:
  - "@obs/tramitacion: SenadoConnector.fetchTramitacion + parseSenadoTramitacion(...).linkMensajeMocion"
  - "@obs/ingest: Fetcher/HostRateLimiter/RobotsGuard (allowlist senado.cl + rate-limit 2-3s)"
provides:
  - "leerPendientes cablea el link_mensaje_mocion REAL (Opción A, re-fetch Senado, SIN DDL)"
  - "resolverLink inyectado: writer agnóstico de @obs/tramitacion (separación de capas)"
  - "degradación honesta blindada: sin resolvedor / fallo / link ausente => null (NUNCA fabrica)"
affects:
  - "pipeline de fichas: ahora recibe el link real por boletín => puede poblar idea_matriz"
  - "proyecto_ficha.idea_matriz (se enciende tras el backfill LIVE = Task 2 operador)"
tech-stack:
  added: []
  patterns:
    - "Colaborador inyectado (resolverLink) en vez de import directo => writer no conoce @obs/tramitacion"
    - "Degradación honesta blindada en wrapper try/catch (resolverLinkSeguro): error => null, no aborta el lote"
key-files:
  created: []
  modified:
    - packages/fichas/src/writer-supabase.ts
    - packages/fichas/src/writer-supabase.test.ts
    - packages/fichas/src/pipeline-cli.ts
decisions:
  - "Opción A (LOCKED): re-fetch del XML del Senado por boletín BASE, SIN DDL sobre proyecto"
  - "Ubicación de la inyección: resolverLink en SupabaseFichasWriterOptions (no en pipeline-cli post-leerPendientes) — menor blast-radius: el campo llega al pipeline ya resuelto desde la misma fuente que lo lee, sin un segundo bucle de enriquecimiento; el writer queda agnóstico de @obs/tramitacion porque solo ve (base)=>Promise<string|null>"
metrics:
  duration: ~12min
  tasks_completed: 1
  tasks_total: 2
  completed: 2026-06-20
---

# Phase 21 Plan 03: Encender idea_matriz — link real + backfill LIVE — Summary

Cierre de la causa raíz de `idea_matriz = 0/74`: `writer-supabase.ts` ya NO entrega `link_mensaje_mocion: null` incondicional. `leerPendientes` ahora resuelve el link REAL del texto íntegro por boletín vía un `resolverLink` inyectado que el CLI ensambla con el `SenadoConnector` real (re-fetch del XML del Senado por boletín BASE, Opción A sin DDL), reusando la política @obs/ingest (allowlist senado.cl + robots + rate-limit 2-3s). La degradación honesta queda blindada: sin resolvedor, fallo de fetch/parse o link ausente → `null`, NUNCA un valor fabricado.

## What Was Built (Task 1 — autonomous, committed)

**`packages/fichas/src/writer-supabase.ts`**
- Nueva opción `resolverLink?: (boletinBase: string) => Promise<string | null>` en `SupabaseFichasWriterOptions`. El writer solo conoce esta firma — **no importa `@obs/tramitacion`** (separación de capas).
- `leerPendientes` ahora resuelve el link por fila (bucle `for...of` async) en vez del map con `link_mensaje_mocion: null` hardcodeado (antes línea 143).
- `resolverLinkSeguro(boletin)`: helper privado que (a) strip del sufijo de comisión al boletín BASE (`boletin.replace(/-\d+$/, "")`, Pitfall 1), (b) llama `resolverLink(base)`, (c) `try/catch` → cualquier fallo (503/timeout/parse roto) o link ausente devuelve `null`. **Degradación honesta blindada**: el error NO se propaga ni aborta el lote, y NUNCA se fabrica un link.
- Sin `resolverLink` inyectado → `null` (comportamiento previo seguro; los tests offline no se rompen).

**`packages/fichas/src/pipeline-cli.ts`**
- Importa `SenadoConnector` + `parseSenadoTramitacion` de `@obs/tramitacion`.
- Ensambla `const senado = new SenadoConnector({ fetcher, rateLimiter, robots })` con los mismos colaboradores @obs/ingest ya construidos, y `resolverLink = async (base) => parseSenadoTramitacion(await senado.fetchTramitacion(base)).linkMensajeMocion`.
- Pasa `resolverLink` a `new SupabaseFichasWriter({ url, serviceKey, resolverLink })` (solo en el path LIVE; el dry-run usa el writer noop).

**`packages/fichas/src/writer-supabase.test.ts`** (+5 casos, `describe` "leerPendientes — cablea el link real (SC3)")
- `fakeSelectClient` thenable (select/in/eq encadenables → `{data,error}`).
- Link REAL emitido (no null) cuando el resolvedor lo trae; `resolverLink` llamado 1 vez (reuso @obs/ingest, no fetch global).
- Boletín consultado en forma BASE (`18296-05` → `resolverLink("18296")`).
- Resolvedor devuelve `null` → link `null` (degradación honesta).
- Resolvedor LANZA (fetch falla) → link `null`, no aborta.
- Sin resolvedor → `null` + resto de campos intacto.

## Verification (Task 1)

- `pnpm --filter @obs/fichas test`: **62 passed / 1 skipped** (writer-supabase: 10 tests, incl. 5 nuevos).
- `pnpm --filter @obs/fichas exec tsc --noEmit`: **EXIT 0** (limpio).
- Commit atómico: `e93c411`.

## Deviations from Plan

None — plan ejecutado tal cual. Se eligió la inyección `resolverLink` dentro de `SupabaseFichasWriterOptions` (la opción de menor blast-radius del `<action>`); el writer queda agnóstico de `@obs/tramitacion`. No se introdujo DDL sobre `proyecto` (Opción A LOCKED respetada).

## Task 2 — BLOCKING checkpoint (operador / orquestador): backfill LIVE

Task 2 es `checkpoint:human-action gate="blocking"`: corrida LIVE LOCAL que llama DeepSeek + escribe a la nube `bctyygbmqcvizyplktuw` + gate psql. **NO ejecutada por el agente** (CLAUDE.md: backfill masivo = LOCAL operador; las keys reales y la escritura a la nube son del operador). Secuencia exacta en la sección CHECKPOINT del mensaje de retorno.

## Self-Check: PASSED

- `packages/fichas/src/writer-supabase.ts` — FOUND (resolverLink cableado)
- `packages/fichas/src/writer-supabase.test.ts` — FOUND (5 casos nuevos)
- `packages/fichas/src/pipeline-cli.ts` — FOUND (SenadoConnector wireado)
- Commit `e93c411` — FOUND en git log
- Tests verdes (62/63, 1 skip) + tsc EXIT 0 — verificado arriba
