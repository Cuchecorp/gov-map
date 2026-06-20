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
  added:
    - "unpdf ^1.6.2 (@obs/fichas) — extracción de capa de texto de PDFs del Senado (pdfjs serverless, JS puro, sin nativos; corre en Node 22 y Edge). Caso A2 del threat register T-21-03-SC: pasó por la Package Legitimacy Gate (lib elegida y verificada por el orquestador)."
  patterns:
    - "Colaborador inyectado (resolverLink) en vez de import directo => writer no conoce @obs/tramitacion"
    - "Degradación honesta blindada en wrapper try/catch (resolverLinkSeguro): error => null, no aborta el lote"
    - "Detección de PDF por magic bytes (%PDF-) + extracción con unpdf; escaneo sin capa de texto (<200 chars no-blancos) => null honesto (OCR diferido)"
    - "Upgrade http->https ANTES del allowlist: links gov http que 301 a https; allowlist exige https; sin reescribir host (sufijo acepta www.senado.cl y redirect a tramitacion.senado.cl)"
key-files:
  created: []
  modified:
    - packages/fichas/src/writer-supabase.ts
    - packages/fichas/src/writer-supabase.test.ts
    - packages/fichas/src/pipeline-cli.ts
    - packages/fichas/src/texto-fuente.ts
    - packages/fichas/src/texto-fuente.test.ts
    - packages/fichas/package.json
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

Se eligió la inyección `resolverLink` dentro de `SupabaseFichasWriterOptions` (la opción de menor blast-radius del `<action>`); el writer queda agnóstico de `@obs/tramitacion`. No se introdujo DDL sobre `proyecto` (Opción A LOCKED respetada).

### Deviación 1 — el `link_mensaje_mocion` real resuelve a un PDF http, no a texto inline (commit `16e9eba`)

- **Encontrado durante:** pre-flight LIVE del orquestador (Task 2). El writer (commit `e93c411`) ya resuelve el link REAL por boletín, pero `obtenerTextoFuente` FALLABA sobre esos links por dos motivos verificados en vivo.
- **Issue 1 — scheme:** el link viene como `http://www.senado.cl/appsenado/index.php?...&tipodoc=mensaje_mocion`; `@obs/ingest assertAllowedUrl` lo rechaza con `scheme-no-https`. (El HOST está bien: el allowlist es por SUFIJO sobre `senado.cl`, así que `www.senado.cl` y el host de redirect `tramitacion.senado.cl` pasan; solo el scheme http era el bloqueo.)
- **Issue 2 — PDF:** aun fetcheado, el body es un PDF (`%PDF`); el código hacía `new TextDecoder().decode(body)` → basura. No había extracción de PDF.
- **Fix (`packages/fichas/src/texto-fuente.ts`):**
  1. **Upgrade http→https** ANTES de `assertAllowedUrl` (los portales gov publican http que 301 a https; sin reescribir el host — el sufijo acepta `www.senado.cl` y el redirect). Log `texto-fuente: upgrade http→https`.
  2. **Detección de PDF por magic bytes** (`%PDF-`, primeros 5 bytes) reemplazando el `TextDecoder().decode` ciego. Si es PDF → extracción de la capa de texto con **unpdf** (`getDocumentProxy` + `extractText({ mergePages: true })`). No-PDF → decodifica UTF-8 como antes (HTML/texto plano).
  3. **Degradación honesta del escaneo:** PDFs NUEVOS (grueso de los 74, boletines ~18300s, 2024-2026) son digitales CON capa de texto (verificado: 12.5k chars limpios de iddocto=18974); PDFs VIEJOS (p.ej. boletín 14309, 2021) son escaneos SIN capa de texto → unpdf devuelve <200 chars no-blancos → `{ texto: null }` (NUNCA fabrica). **OCR es un fallback DIFERIDO, fuera de scope.**
  4. Se preservó la firma/return type de `obtenerTextoFuente`, toda la semántica de degradación honesta (link ausente/robots/rate-limit/fetch/SSRF → `{texto:null}` sin lanzar) y el gate best-effort de respaldo R2 (sigue guardando el TEXTO EXTRAÍDO utf-8, ext "txt", no el PDF crudo).
- **Nueva dependencia:** `unpdf ^1.6.2` solo en `@obs/fichas` (pure-JS, ESM, pdfjs serverless; sin nativos). Verificado import+extracción en Node 22 antes de cablear. Cubre el caso A2 anticipado por el threat register `T-21-03-SC` (extractor de PDF detrás de la Package Legitimacy Gate).
- **Tests (`packages/fichas/src/texto-fuente.test.ts`):** +4 casos (mock de `unpdf` vía `vi.mock`): http→https upgrade (el fetcher recibe https), PDF con capa de texto → texto extraído, PDF escaneado/corto → null honesto, body no-PDF → decode UTF-8 como antes. Tests previos siguen verdes.
- **Verificación:** `pnpm --filter @obs/fichas test` → **66 passed / 1 skipped** (texto-fuente: 11 tests, +4). `tsc --noEmit` → EXIT 0.
- **Files modificados:** `packages/fichas/src/texto-fuente.ts`, `packages/fichas/src/texto-fuente.test.ts`, `packages/fichas/package.json`, `pnpm-lock.yaml`.
- **NO se corrió backfill LIVE ni llamadas reales de red/DeepSeek** — el orquestador corre el backfill LIVE después de esta deviación.

## Task 2 — BLOCKING checkpoint (operador / orquestador): backfill LIVE

Task 2 es `checkpoint:human-action gate="blocking"`: corrida LIVE LOCAL que llama DeepSeek + escribe a la nube `bctyygbmqcvizyplktuw` + gate psql. **NO ejecutada por el agente** (CLAUDE.md: backfill masivo = LOCAL operador; las keys reales y la escritura a la nube son del operador). Secuencia exacta en la sección CHECKPOINT del mensaje de retorno.

## Self-Check: PASSED

- `packages/fichas/src/writer-supabase.ts` — FOUND (resolverLink cableado)
- `packages/fichas/src/writer-supabase.test.ts` — FOUND (5 casos nuevos)
- `packages/fichas/src/pipeline-cli.ts` — FOUND (SenadoConnector wireado)
- Commit `e93c411` — FOUND en git log
- Tests verdes (62/63, 1 skip) + tsc EXIT 0 — verificado arriba
