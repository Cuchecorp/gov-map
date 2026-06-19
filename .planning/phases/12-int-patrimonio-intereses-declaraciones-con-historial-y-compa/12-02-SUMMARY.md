---
phase: 12-int-patrimonio-intereses-declaraciones-con-historial-y-compa
plan: 02
subsystem: ingestion-connector
tags: [connector, sparql, infoprobidad, zod, no-llm, versioned, identity, deny-by-default, drift-blocking, cc-by-4.0]
requires:
  - "migración 0022 (Plan 01): declaracion VERSIONADA + 6 sub-tablas de bienes + declaracion_familiar deny-by-default + probidad_ingesta_estado"
  - "@obs/ingest (orden LOCKED: assertAllowedUrl → robots → rateLimiter.wait → fetcher.get; DriftStore/fingerprint)"
  - "@obs/adjudication correrPipeline + @obs/identity confirmar/EnlaceConfirmado + @obs/core normalizarNombre (Phase 9)"
provides:
  - "@obs/probidad: conector SPARQL + parser zod literal + reconciliación name-only + writer VERSIONADO + orquestación drift-bloqueante"
  - "parseDeclaraciones: SPARQL-JSON → Declaracion[] versionadas keyed por (fuenteId, fechaPresentacion), LITERAL sin LLM, CC BY 4.0 por fila"
  - "reconciliarDeclarante: cruce name-only solo-determinista (EnlaceConfirmado + identidad_audit); familiares deny-by-default"
  - "SupabaseProbidadWriter: onConflict 'fuente_id,fecha_presentacion' (versiones acumulan, nunca sobreescribe)"
  - "InfoProbidadConnector: SPARQL GET datos.cplt.cl en orden LOCKED; ingest-cli corrida LIVE acotada / dry-run; live probe"
affects:
  - "ficha /parlamentario/[id] sección patrimonio (Plan 03) lee las versiones que este conector escribe"
tech-stack:
  added: []
  patterns:
    - "parser SPARQL-JSON literal (zod, sin lib RDF, sin LLM) agrupado por clave de versión"
    - "writer VERSIONADO: onConflict incluye fecha_presentacion → versiones acumulan, nunca colapsan"
    - "reconciliación name-only (la fuente no tiene RUT): solo-determinista mintea EnlaceConfirmado"
    - "familiares deny-by-default: delete+insert (sin clave única natural), nunca enlazados a persona"
    - "drift BLOQUEANTE en fuente PII: forma inesperada o fingerprint cambiado → cuarentena (0 filas)"
key-files:
  created:
    - "packages/probidad/package.json"
    - "packages/probidad/tsconfig.json"
    - "packages/probidad/vitest.config.ts"
    - "packages/probidad/src/model.ts"
    - "packages/probidad/src/sparql.ts"
    - "packages/probidad/src/parse-infoprobidad.ts"
    - "packages/probidad/src/parse-infoprobidad.test.ts"
    - "packages/probidad/src/reconciliar-declarante.ts"
    - "packages/probidad/src/reconciliar-declarante.test.ts"
    - "packages/probidad/src/writer.ts"
    - "packages/probidad/src/writer.test.ts"
    - "packages/probidad/src/writer-supabase.ts"
    - "packages/probidad/src/connector-infoprobidad.ts"
    - "packages/probidad/src/ingest-run.ts"
    - "packages/probidad/src/ingest-run.test.ts"
    - "packages/probidad/src/ingest-cli.ts"
    - "packages/probidad/src/live-infoprobidad.probe.ts"
    - "packages/probidad/src/index.ts"
    - "packages/probidad/test/fixtures/declaraciones-sparql.json"
  modified:
    - "pnpm-lock.yaml (registro del workspace @obs/probidad)"
decisions:
  - "El fixture SPARQL-JSON es REAL (capturado LIVE 2026-06-19 contra datos.cplt.cl/sparql): declarante 'CARLOS ANTONIO KARIM BIANCHI CHELECH', 5 versiones en el fixture (10 en vivo), bienes inmuebles reales (HUERTO FAMILIAR/JOSE MIGUEL CARRERA); la fila de familiar se marcó sintética (predicado documentado esConyugeDe) porque ese declarante no retornó familiares en vivo, sin fabricar declaraciones"
  - "El parser consume una proyección ANCHA del SPARQL-JSON (columnas de declaración + columnas opcionales de bien/familiar por fila) y agrupa por (fuenteId, fechaPresentacion) acumulando hijos distintos"
  - "tipo guarda el rdfs:label resuelto (OQ3); cargo/organismo guardan la URI cruda verbatim si no hay label (literal, nunca fabricado)"
  - "familiares: delete-por-versión + insert (la tabla tiene PK surrogate, sin clave única natural) → re-run idempotente sin acumular duplicados de tercero PII"
metrics:
  duration: 38min
  completed: 2026-06-19
---

# Phase 12 Plan 02: Conector @obs/probidad (SPARQL + parser literal + reconciliación name-only + writer versionado) Summary

Paquete `@obs/probidad` que ingiere las declaraciones de patrimonio e intereses de InfoProbidad (`datos.cplt.cl/sparql`, CC BY 4.0) espejando `@obs/lobby` archivo-por-archivo: query builders SPARQL + parser zod LITERAL (SIN LLM) que mapea el SPARQL-JSON a `Declaracion[]` VERSIONADAS keyed por `(fuenteId, fechaPresentacion)`, reconciliación NAME-ONLY del declarante vía `correrPipeline` (FK solo en determinista vía `EnlaceConfirmado` + `identidad_audit`; familiares deny-by-default sin enlace), writer VERSIONADO con `onConflict 'fuente_id,fecha_presentacion'` (las versiones acumulan, nunca sobreescribe una vieja), y orquestación con DRIFT BLOQUEANTE (cuarentena ante forma SPARQL-JSON inesperada o fingerprint cambiado). Suite offline 30/30 verde + typecheck verde; corrida LIVE acotada contra el endpoint real validó 10 versiones / 9 fechas distintas con CC BY 4.0 por fila para un declarante real.

## What Was Built

- **`model.ts`:** `Declaracion` raíz VERSIONADA con bienes (6 sub-clases pineadas a los predicados literales de OQ2) y familiares anidados; zod schemas; `ProvenanceInline` con `licencia`; **sin columna RUT de persona natural**. `ORIGEN_PROBIDAD`/`LICENCIA_PROBIDAD`.
- **`sparql.ts`:** `queryDeclaracionesPorNombre` (nombre normalizado ESCAPADO/encodeado → sin inyección SPARQL, T-12-07) + `queryBienesInmuebles`/`queryActividades`; `bindingsToRows` puro (JSON.parse nativo, NO lib RDF); `fechaPresentacionDe` (dateTime → date ISO, null si no parsea).
- **`parse-infoprobidad.ts`:** `parseDeclaraciones` agrupa los bindings por `(fuenteId, fechaPresentacion)`, acumula bienes/familiares distintos, valida con `DeclaracionSchema`, descarta+registra drift, LITERAL (sin LLM). `tipo` = label resuelto; cargo/organismo = URI cruda verbatim.
- **`reconciliar-declarante.ts`:** `reconciliarDeclarante` aplica `normalizarNombre` (limpia `\t`+dobles-espacios) → `correrPipeline` → SOLO `determinista` llama `confirmar(id,"determinista")` y puebla el FK + `estado_vinculo:"confirmado"`; el resto → `enlace:null` + mención cruda + `no_confirmado`. Familiares crudos sin enlace. Provider/writer inyectables, fail-closed sin provider. Tipo del provider derivado de la firma de `correrPipeline` (sin edge a `@obs/llm`).
- **`writer.ts` / `writer-supabase.ts`:** `ProbidadWriter` + `InMemoryProbidadWriter` + `SupabaseProbidadWriter`. **`declaracion` onConflict `'fuente_id,fecha_presentacion'`** (CRÍTICO Pitfall 1: incluye la fecha → versiones acumulan); sub-tablas de bienes onConflict por su clave de versión; `declaracion_familiar` delete-por-versión + insert (deny-by-default, sin clave única); `probidad_ingesta_estado` onConflict `parlamentario_id`. Storage plano (FK branded → string|null); service key nunca en mensajes de error.
- **`connector-infoprobidad.ts`:** `InfoProbidadConnector` SPARQL GET en el ORDEN LOCKED (`assertAllowedUrl → robots.isAllowed → rateLimiter.wait → fetcher.get` con `Accept: application/sparql-results+json` + UA `Bot-Ciudadano/1.0`); `InfoProbidadBloqueadaError` para 403/503; `cplt.cl` ya allowlisted; NUNCA `BaseConnector.run`; sin LLM.
- **`ingest-run.ts`:** `runIngestProbidad` por declarante (build query → fetch orden LOCKED → DRIFT BLOQUEANTE → parse → reconcilia → upsert versionado → marcarIngestado). Forma SPARQL-JSON inesperada (sin `results.bindings`) o fingerprint cambiado → CUARENTENA (0 filas + degradación, nunca filas vacías). Declarante inalcanzable degrada honesto sin abortar; nunca fabrica.
- **`ingest-cli.ts` / `live-infoprobidad.probe.ts`:** corrida LIVE ACOTADA por `--nombre` (service key solo de env, degrada a dry-run sin key); probe gated que hace 1 request real y verifica `results.bindings` + `fechaDeclaracion`.
- **`test/fixtures/declaraciones-sparql.json`:** fixture SPARQL-JSON REAL (≥2 fechas) capturado LIVE.

## Corrida LIVE acotada (ATENTADA y exitosa para el camino de lectura)

- **Probe LIVE** contra `https://datos.cplt.cl/sparql` (delay 2-3s + UA, `Accept: application/sparql-results+json`): HTTP 200, `results.bindings` con 10 filas → **10 versiones parseadas / 9 fechas distintas** para el declarante real "CARLOS ANTONIO KARIM BIANCHI CHELECH", `tipo` resuelto (label), **`licencia: CC BY 4.0` por fila**.
- **CLI dry-run** (`--nombre "bianchi chelech" --dry-run`) end-to-end contra el endpoint real: **10 versiones** ingestadas al `InMemoryProbidadWriter`, 0 errores, 0 degradaciones, drift-quarantine false. El versioning nativo (INT-04) y la atribución CC BY 4.0 quedaron verificados en vivo.
- **DB persistence a Supabase remoto = `human_verification` (operador, Task 4 checkpoint `gate="blocking"`):** la escritura real con la service key requiere (a) confirmar 0022 aplicada (Plan 01 ya la aplicó + pgTAP 34/34) y (b) la service key/escritura remota, que en este entorno está fuera de alcance (MEMORY: Supabase remoto bloqueado). La corrida LIVE de lectura + parse + versioning + reconciliación corre sin DB; nunca se fabricaron declaraciones.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Colisión de la assertion "sin @obs/llm" con menciones en comentarios**
- **Found during:** Task 1
- **Issue:** El test (f) "el árbol de imports no contiene @obs/llm" usaba `toContain("@obs/llm")`, que colisionaba con la mención del paquete en los comentarios del parser (documentando "sin LLM").
- **Fix:** Reformulado el comentario del parser para no usar el literal `@obs/llm`, y endurecida la assertion a un regex de SENTENCIAS de import (`from "@obs/llm"` / `require("@obs/llm")` / `import("@obs/llm")`), que no matchea comentarios. La invariante real (no se importa el paquete de modelos) queda mejor verificada.
- **Files modified:** packages/probidad/src/parse-infoprobidad.ts, packages/probidad/src/parse-infoprobidad.test.ts
- **Commit:** 6eb3af8

**2. [Rule 1 - Bug] Conteo del fixture (5 versiones, no 6)**
- **Found during:** Task 1
- **Issue:** El test esperaba 6 versiones; el fixture real tiene 5 URIs de declaración válidas + 1 fila de drift (sin fecha).
- **Fix:** Ajustado el test a 5 versiones reales (la fila sin fecha se descarta como drift). Verifica el descarte sin fabricar.
- **Files modified:** packages/probidad/src/parse-infoprobidad.test.ts
- **Commit:** 6eb3af8

**3. [Rule 3 - Blocking] Cruce determinista del test de reconciliación**
- **Found during:** Task 2
- **Issue:** El test (a) usaba "JUAN ANTONIO COLOMA CORREA" contra `nombre_normalizado: "antonio coloma juan"`; el token extra "correa" rompía el match determinista por tokens.
- **Fix:** Alineado el nombre crudo del declarante a la misma forma que el test verde de lobby ("Coloma C., Juan Antonio"), que normaliza al mismo set de tokens. (Espejo del patrón ya validado en Phase 11.)
- **Files modified:** packages/probidad/src/reconciliar-declarante.test.ts
- **Commit:** 02d61f5

## Verification

- `pnpm --filter @obs/probidad test`: **30/30 PASS** (4 archivos: parse 8, reconciliar 5, writer 9, ingest-run 8).
- `pnpm --filter @obs/probidad typecheck`: **PASS** (un string crudo como FK no compila — la guarda de identidad tipada se mantiene).
- LIVE probe + CLI dry-run contra `datos.cplt.cl/sparql`: **PASS** (10 versiones, 9 fechas, CC BY 4.0 por fila, 0 errores).
- Invariantes LOCKED verificadas por tests: keying por versión, versioning (≥2 fechas = ≥2 filas, re-run no sobreescribe), licencia CC BY 4.0 por fila, reconciliación solo-determinista + audit, familiares deny-by-default sin enlace, drift bloqueante (forma inesperada + fingerprint), nunca fabrica, idempotencia, sin import de `@obs/llm`.

## Notes for Next Plans

- **Plan 03 (ficha):** lee las versiones que este conector escribe vía `declaraciones_de_parlamentario` (historial DESC) y `comparar_declaraciones` (lado-a-lado sin delta). La `licencia` CC BY 4.0 viaja por fila → renderizarla visible incluso en la comparación. `probidad_ingesta_estado` distingue "no ingestado" (fila ausente) de "ingestado, cero confirmadas" (fila presente).
- **Operador (Task 4 checkpoint):** correr `ingest-cli` LIVE con la service key en env (sin `--dry-run`) tras confirmar 0022 aplicada; verificar provenance + CC BY 4.0 por fila, FK solo en determinista (`identidad_audit`), familiares en `declaracion_familiar` deny-by-default, `probidad_ingesta_estado` marcado, idempotencia (re-run = conteos idénticos, versión vieja no sobreescrita). Si InfoProbidad inalcanzable → degradar a fixture, nunca fabricar.

## Self-Check: PASSED

- Archivos creados verificados en disco: model.ts, parse-infoprobidad.ts, reconciliar-declarante.ts, writer-supabase.ts, connector-infoprobidad.ts, ingest-run.ts, fixture SPARQL-JSON — todos FOUND.
- Commits verificados: 6eb3af8 (Task 1), 02d61f5 (Task 2), 6dd17f1 (Task 3) — todos FOUND.
