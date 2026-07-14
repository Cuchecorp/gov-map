---
phase: 64-voto-p3a-validar-caracterizar-opendata-camara-cl-live-spike
plan: 02
subsystem: ingesta LIVE / caracterización endpoint votaciones Cámara
tags: [voto, live, spike, r2, dos-etapas, pareo, cross-check, opendata-camara]
requires:
  - packages/tramitacion/src/connector-camara.ts (fetchVotacionDetalle — política LOCKED)
  - packages/tramitacion/src/parse-camara-votacion.ts (parseCamaraVotoDetalle — semántica Plan 01)
  - packages/ingest/src/r2-store.ts (R2Store.putImmutable, sha256Hex)
  - packages/votos/src/run-camara-votos.ts (buildCamaraConnector)
provides:
  - "Endpoint getVotacion_Detalle confirmado UP a escala (5/5 votaciones 200, cross-check verde) — SC#1/SC#3 LIVE"
  - "Pareo desde bloque <Pareos> CONFIRMADO LIVE (A1b resuelto contra la fuente, 5/5 votaciones)"
  - "caracterizarVotacionDetalle(xml): header Total* + DIPID pareados, mismo fast-xml-parser (no regex)"
  - "Crudo LIVE persistido a R2 content-addressed (STAGE 1 dos-etapas LOCKED, 5 objetos)"
  - "Decisión de fallback SC#4 documentada (getVotaciones_Boletin como contingencia + re-plan bloque VOTO)"
affects:
  - Phase 66 (wire producción del voto individual): arranca con veredicto binario ENDPOINT-UP + detalle primario
tech-stack:
  added: []
  patterns:
    - "Probe LIVE gated (VOTOS_LIVE=1 / describe.skip + exclusión de glob) — CI no quema el WAF"
    - "STAGE 1 dos-etapas: crudo → R2 content-addressed ANTES de parsear (If-None-Match:*, 412=idempotente)"
    - "Cross-check LIVE por bucket semántico Σ(roster)==Total* sobre la respuesta viva → expect-fail ruidoso"
    - "Hunt por observación: registra lo visto; lo no observado se anota fail-closed, NUNCA se fabrica"
key-files:
  created:
    - packages/votos/src/spike-votacion-detalle.live.test.ts
    - packages/votos/src/spike-votacion-detalle.live.test.ts.md
    - packages/votos/vitest.live.config.ts
  modified:
    - packages/tramitacion/src/parse-camara-votacion.ts
    - packages/tramitacion/src/index.ts
decisions:
  - "PAREO CONFIRMADO LIVE 2026-07-14: observado en 5/5 votaciones desde <Pareos> (A1b, que RESEARCH dejó como residual, queda resuelto contra la fuente; código 3 nunca promovido)"
  - "DISPENSADO no observado (TotalDispensados=0 en la muestra) → registrado, no fabricado; re-probe en Phase 66"
  - "Detalle voto-a-voto = vía primaria para Phase 66 (UP a escala); getVotaciones_Boletin = fallback contingente (SC#4)"
  - "caracterizarVotacionDetalle vive en @obs/tramitacion (dueño del parser); @obs/votos NO toma dep de fast-xml-parser"
metrics:
  duration: "~25 min"
  completed: "2026-07-14"
  tasks: 2
  files: 5
  tests_after: "145 offline (@obs/tramitacion) + 1 LIVE gated (verde en corrida deliberada)"
---

# Phase 64 Plan 02: VOTO P3a — Validación LIVE del SPIKE (crudo a R2 + Pareo confirmado + cross-check contra la fuente) Summary

Cerró la mitad LIVE del SPIKE contra `opendata.camara.cl/getVotacion_Detalle`: probó que la semántica fijada offline en Plan 01 cuadra con el endpoint real, persistió el crudo LIVE a R2 como fixture autoritativo (STAGE 1 dos-etapas LOCKED), y resolvió por observación las dos preguntas abiertas. **El endpoint está UP a escala** (5/5 votaciones HTTP 200, cross-check Σ(roster)==`Total*` verde en las 5). **El pareo se observó LIVE en 5/5 votaciones** desde el bloque hermano `<Pareos>` — A1b, que RESEARCH había dejado como residual no-observado, queda **confirmado contra la fuente**. `TotalDispensados=0` en toda la muestra → Dispensado se registra honestamente como **no observado**, nunca fabricado. Cero paquetes nuevos, cero escritura a Supabase.

## What Was Built

### Task 1 — Probe LIVE gated: crudo a R2 + cross-check + hunt Pareo/Dispensado (`ba9aa40`, `fb85bc7`)

- **`spike-votacion-detalle.live.test.ts`** (nuevo): gated por `VOTOS_LIVE=1` (`describe.skip` si no + excluido del glob de vitest normal → CI no colecta ni corre). Mirror del patrón `run-camara-votos.live.test.ts`. `loadEnv` BOM-safe construye `R2Store` desde `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_ENDPOINT_URL`/`R2_BUCKET` (si faltan → falla ruidoso, no persist silencioso).
- **Recorrido SERIAL** (for-await, nunca en paralelo) sobre `{89178,89179,89180,88813,89000}`: el `HostRateLimiter` interno de `buildCamaraConnector()` impone el delay 2-3s LOCKED (no override). Fetch fallido se registra y continúa (fallback honesto), no aborta.
- **STAGE 1 (dos-etapas LOCKED):** por cada crudo, `body=TextEncoder().encode(xml)` → `sha256Hex` → `R2Store.putImmutable("camara-opendata","getVotacion_Detalle",fecha,sha,"xml",body)` ANTES de parsear. Assert `r2Path` no-vacío (412 existed=true también válido).
- **STAGE 2 + cross-check LIVE:** `parseCamaraVotoDetalle(xml)` + `caracterizarVotacionDetalle(xml)` sobre el MISMO XML crudo; assert por bucket semántico Σ(si)==`TotalAfirmativos`, Σ(no)==`TotalNegativos`, Σ(abstencion)==`TotalAbstenciones`. Mismatch → `expect`-fail ruidoso (SC#3 LIVE).
- **HUNT:** (a) si `<Pareos>` no vacío → assert que el parser emite `pareo` para cada DIPID pareado; (b) si `TotalDispensados>0` → inspecciona filas ausente. No observado → log fail-closed.
- **`caracterizarVotacionDetalle(xml)`** (nuevo en `parse-camara-votacion.ts`, exportado desde `@obs/tramitacion`): devuelve header `{afirmativos,negativos,abstenciones,dispensados,pareados[]}` con el MISMO `fast-xml-parser` del módulo (respeta "no regex sobre voto" de CLAUDE.md; evita que `@obs/votos` tome dep de `fast-xml-parser`).
- **`vitest.live.config.ts`** (nuevo): config deliberada `include:["src/**/*.live.test.ts"]` para correr los probes gated a mano (la suite normal los excluye del glob y no se pueden re-incluir por CLI porque el `exclude` de config se mergea).

### Task 2 — Documento de hallazgos + decisión de fallback SC#4 (`05a6008`)

- **`spike-votacion-detalle.live.test.ts.md`** (nuevo): registra (a) veredicto de escala UP con tabla de cross-check 5/5; (b) mapeo confirmado LIVE `0→no 1→si 2→abstencion 4→ausente` + pareo desde `<Pareos>` (con los DIPID por votación) + Dispensado no-observado; (c) los 5 `r2Path` del crudo; (d) **decisión de fallback SC#4**: detalle voto-a-voto = vía primaria (UP a escala), `getVotaciones_Boletin` = contingencia si degrada (pierde voto individual, conserva `Total*`) + re-plan del bloque VOTO. Cierra con preguntas abiertas para Phase 66. Lenguaje técnico factual, sin insinuación.

## Verification

- **Corrida LIVE 2026-07-14** (`VOTOS_LIVE=1 … --config vitest.live.config.ts`): 1 test verde, 18 s (16 s de fetch serial con delay 2-3s). 5 crudos R2 persistidos (`existed=false`), cross-check verde 5/5, PAREO observado 5/5, DISPENSADO no observado.
- `pnpm --filter @obs/votos test` (offline): pasa y **NO colecta** el `*.live.test.ts` (solo `run-camara-votos.test.ts`, 3 tests).
- `pnpm --filter @obs/tramitacion test`: 17 archivos, **145 tests** verdes (el helper `caracterizarVotacionDetalle` no altera comportamiento existente).
- `tsc --noEmit` verde en `@obs/tramitacion` y `@obs/votos`.
- `git grep -c putImmutable …live.test.ts` → 3 (STAGE 1 presente). `git grep -c "Promise.all" …live.test.ts` → 0 (fetch serial).

## Success Criteria

- **SC#1 (crudo LIVE en R2):** ✅ 5 respuestas `getVotacion_Detalle` crudas persistidas content-addressed en R2 (`camara-opendata/getVotacion_Detalle/2026-07-14/<sha>.xml`). El namespace agregado (`getVotaciones_Boletin`) queda disponible como fallback caracterizado.
- **SC#2 (mitad LIVE):** ✅ Pareo (bloque `<Pareos>`) RESUELTO por observación LIVE (5/5); Dispensado (`TotalDispensados`) registrado como **no observado** en la ventana (fail-closed, no fabricado).
- **SC#3 (LIVE):** ✅ cross-check Σ(roster)==`Total*` cuadra sobre la respuesta viva en las 5 votaciones; mismatch habría sido ruidoso.
- **SC#4:** ✅ fallback honesto a `getVotaciones_Boletin` documentado como contingencia + re-plan del bloque VOTO.

## Deviations from Plan

**1. [Rule 3 - Blocking] `caracterizarVotacionDetalle` añadido a `@obs/tramitacion` en vez de parsear el header en el test**
- **Found during:** Task 1 — el cross-check y el hunt necesitan `Total*` + DIPID pareados del MISMO XML crudo.
- **Issue:** El plan sugería re-usar helpers locales, pero importar `fast-xml-parser` directamente en el test falla (no es dep de `@obs/votos`) y parsear el header a mano en `packages/votos` violaría "fast-xml-parser, no regex" (CLAUDE.md) y duplicaría lógica del parser.
- **Fix:** Exporté un helper focalizado `caracterizarVotacionDetalle(xml)` desde `parse-camara-votacion.ts` (dueño del parser), reusando la MISMA instancia `XMLParser`. El test lo consume vía `@obs/tramitacion`. Sin dep nueva, sin regex.
- **Files modified:** `packages/tramitacion/src/parse-camara-votacion.ts`, `packages/tramitacion/src/index.ts`.
- **Commit:** `ba9aa40`.

**2. [Rule 3 - Blocking] `vitest.live.config.ts` añadido para correr el probe gated**
- **Found during:** Task 1 verify — el comando del plan (`vitest run src/…live.test.ts`) NO colecta el archivo: `vitest.config.ts` lo excluye del glob y el `exclude` de config se MERGEA con el CLI (no se puede desactivar por flag).
- **Fix:** Config deliberada `vitest.live.config.ts` con `include:["src/**/*.live.test.ts"]`. El gate real (`VOTOS_LIVE=1`/`describe.skip`) sigue intacto; la suite normal sigue excluyéndolos. Comando de corrida documentado en el `.md`.
- **Commit:** `ba9aa40`.

**3. Hallazgo que MEJORA la expectativa: Pareo SÍ observado LIVE**
- RESEARCH (2026-07-13) dejó el pareo como residual no-observado. Este SPIKE lo observó en 5/5 votaciones → A1b confirmado contra la fuente (no solo offline). No es una desviación de alcance; es el objetivo del hunt cumplido con mejor resultado que el esperado.

## Threat Surface

Mitigaciones del `<threat_model>` reforzadas por la corrida:
- **T-64-04 (DoS al WS gob):** fetch serial (0 `Promise.all`), rate-limit 2-3s LOCKED no overrideado, UA identificatorio vía `Fetcher`, gated `VOTOS_LIVE=1`. La corrida LIVE tomó 16 s para 5 votaciones (~3.2 s/fetch) — consistente con el delay.
- **T-64-05 (creds R2 en logs):** el test loguea solo `r2Path`/`existed`/status, nunca la config R2.
- **T-64-06 (SSRF):** `CamaraConnector.fetch` ejecuta `assertAllowedUrl` antes del fetch; allowlist no editado.
- **T-64-07 (integridad del voto):** cross-check LIVE ruidoso 5/5; Pareo/Dispensado por observación, código nunca fabricado.

No se detectó superficie de amenaza nueva fuera del `<threat_model>` del plan (probe read-only + una escritura R2 idempotente; sin endpoint/auth/schema nuevos).

## Known Stubs

Ninguno. El único dato no resuelto (bucket de `Dispensado`) está documentado como Open Question para Phase 66 con `TotalDispensados=0` en la muestra como causa — no es un stub que impida el objetivo del SPIKE (validar LIVE la semántica y persistir el crudo). No se fabricó ningún código.

## Notes for Phase 66 (wire producción)

- **Arranca con veredicto binario: ENDPOINT-UP.** El detalle voto-a-voto es la vía primaria; usar `--from-r2` sobre los crudos ya persistidos cuando aplique (DEBT-01 fundido con el wire).
- **Re-probar Dispensado** en una votación con `TotalDispensados>0` para fijar el bucket.
- **Escala de backfill:** probar rangos más antiguos/grandes de Leg-58 y decidir detalle-directo vs fallback agregado por rango (SC#4).

## Self-Check: PASSED

Archivos verificados (existen): `64-02-SUMMARY.md`, `spike-votacion-detalle.live.test.ts`, `spike-votacion-detalle.live.test.ts.md`, `vitest.live.config.ts`, `parse-camara-votacion.ts` (con `caracterizarVotacionDetalle`).
Commits verificados (en git log): `ba9aa40` (Task 1 probe+helper), `05a6008` (Task 2 doc), `fb85bc7` (style — verify serial limpio).
