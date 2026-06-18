---
phase: 04-adjudicacion-identidad-compuerta-humana-golden-set
verified: 2026-06-18T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Correr el golden set en MODO LIVE contra MiniMax-M3 real"
    expected: "precision >= 0.95 sobre GOLDEN_SET_GATE; recall >= 0.80; resultado impreso en el log de CI"
    why_human: "El bloque LIVE esta gated por IDENTITY_GOLDEN_LIVE=1 + MINIMAX_API_KEY; no se puede correr en verificacion automatica sin quemar cuota. Es el unico check que requiere el modelo real; el gate CI mockeado ya pasa."
---

# Phase 4: Adjudicacion de Identidad + Compuerta Humana + Golden Set — Verification Report

**Phase Goal:** El subsistema de identidad aislado resuelve los casos ambiguos con LLM critico, escala lo dudoso a revision humana bajo umbral conservador, audita cada decision y bloquea el deploy si el golden set baja del umbral — sella el riesgo existencial #1.
**Verified:** 2026-06-18T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Para matches dudosos genera candidatos por blocking (apellido+camara+periodo+region) y adjudica con LLM (MiniMax) devolviendo decision/confianza/evidencia/conflictos en JSON validado | VERIFIED | `candidatos.ts:27-51` implementa blocking con filtros duros (camara/periodo) y blando (region fail-open linea 45). `AdjudicacionSchema` (zod en `prompt.ts`) valida la salida LLM con campos decision/chosen_id/confidence/evidence/conflicts. `pipeline.ts:149-162` ensambla el prompt, corre el gate de RUT, y llama `provider.complete(..., AdjudicacionSchema)`. |
| 2 | Una compuerta enruta a revision humana todo match con confianza<umbral, conflictos o inconsistencia camara/periodo — nada bajo umbral se auto-acepta (asimetrico, falso negativo) | VERIFIED | `compuerta.ts:44` usa `if (llm.confidence < UMBRAL)` con `UMBRAL = 0.9` ESTRICTO. La funcion acumula TODAS las razones (sin corto-circuito, lineas 39-76) y solo devuelve `auto-aceptar` si la lista queda vacia (linea 79-83). El borde 0.90 auto-acepta; 0.8999 va a revision (documentado en el codigo como mandatorio). |
| 3 | Un revisor humano confirma/rechaza/corrige con revisor+timestamp; cada match guarda procedencia en audit log inmutable | VERIFIED | `revisor-cli.ts` implementa subcomandos list/show/confirm/reject/correct con validacion pre-escritura (lineas 36-45). Cada resolucion llama `resolverYAuditar` que escribe `identidad_audit` (append-only) con `revisor_id` y `resolved_at` (lineas 201-251). `appendAudit` en `writer-revision.ts` es SOLO insert. La inmutabilidad esta enforceada por trigger BEFORE UPDATE OR DELETE (SQLSTATE 23001) + BEFORE TRUNCATE (0007) + REVOKE a `service_role` (0007). |
| 4 | Cada vinculo nombre->id tiene estado confirmado/probable/no_confirmado y solo confirmado se muestra como hecho | VERIFIED | `vinculo_identidad` en `0006_revision_identidad.sql:22-39` define `estado text not null default 'no_confirmado' check (estado in ('confirmado', 'probable', 'no_confirmado'))`. `pipeline.ts:166-184` mapea auto-aceptar a `'probable'` NUNCA `'confirmado'` (A4). `revisor-cli.ts:226-238` es el unico camino a `'confirmado'` con `metodo='humano'`. El trigger `vinculo_identidad_guarda` en `0007` bloquea al DB-tier cualquier promocion por `metodo='llm'` (lineas 62-65) y cualquier demotion de `confirmado` (lineas 44-56). |
| 5 | El golden set (homonimos, nombres de casada, abreviaturas) corre como regresion y bloquea el deploy si la precision baja del umbral | VERIFIED | `golden-set.ts` tiene 22 casos (24 con adversarios) cubriendo las 5 categorias obligatorias. `GOLDEN_SET_GATE` excluye los 2 adversarios. El test `golden-set.test.ts:71-79` hace `expect(m.precision).toBeGreaterThanOrEqual(0.95)` — un fallo bloquea CI. La meta-prueba (lineas 89-114) demuestra que la rama `fp` es alcanzable: los casos adversarios producen precision=0 < 0.95, probando que el gate NO es una tautologia (CR-02 corregido). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/adjudication/src/compuerta.ts` | Compuerta fail-closed UMBRAL=0.90 estricto | VERIFIED | 84 lineas, UMBRAL=0.9, comparacion `<` estricta, acumulacion de razones, funcion pura. |
| `packages/adjudication/src/pipeline.ts` | Orquestacion etapas 0-3 con audit por decision | VERIFIED | 217 lineas, etapas 0-3 completas, `appendAudit` en cada rama, `assertNoRutInLlmInput` sobre `system+user`, A4 enforceado. |
| `packages/adjudication/src/revisor-cli.ts` | CLI revisor con confirm/reject/correct + audit humano | VERIFIED | 327 lineas, subcomandos completos, validacion pre-escritura, promocion a `confirmado` exclusiva del humano. |
| `packages/adjudication/src/golden/golden-set.ts` | 22+ casos etiquetados + evaluarGolden + gate real | VERIFIED | 568 lineas, 24 casos (22 gate + 2 adversarios), `evaluarGolden` con logica fp/fn, `GOLDEN_SET_GATE` y `GOLDEN_SET_ADVERSARIO` separados. |
| `supabase/migrations/0006_revision_identidad.sql` | DDL: vinculo_identidad + revision_identidad + identidad_audit append-only | VERIFIED | 107 lineas, trigger `identidad_audit_immutable` BEFORE UPDATE OR DELETE, REVOKE UPDATE/DELETE/TRUNCATE from public, RLS deny-by-default en 3 tablas. |
| `supabase/migrations/0007_identidad_guardas.sql` | CR-01 fix: guarda vinculo + audit TRUNCATE + REVOKE service_role | VERIFIED | 158 lineas, trigger `vinculo_identidad_guarda` BEFORE UPDATE (bloquea demotion y reescritura de `confirmado`), trigger `vinculo_identidad_guarda_insert` BEFORE INSERT, trigger BEFORE TRUNCATE en audit, REVOKE a `service_role`, CHECK vocabulario cerrado de `decision`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pipeline.ts` | `compuerta.ts:aplicarCompuerta` | Importacion directa + llamada en Etapa 3 | WIRED | Linea 35 importa, linea 165 llama con (llm, mencion, candidatos). |
| `pipeline.ts` | `candidatos.ts:generarCandidatos` | Importacion + Etapa 1 | WIRED | Linea 122 llama; resultado controla si se entra a Etapa 2. |
| `pipeline.ts` | `@obs/llm:assertNoRutInLlmInput` | Linea 150, sobre `SYSTEM_ADJUDICACION + userPrompt` | WIRED | Gate corre sobre el payload completo antes de `provider.complete` (WR-05 corregido). |
| `pipeline.ts` | `writer:appendAudit` | Cada rama escribe una fila de audit con `vinculo_id` real | WIRED | `upsertVinculo` devuelve el id (WR-01 corregido); la rama de revision deja `vinculo_id: null` por diseno documentado. |
| `revisor-cli.ts` | `vinculo_identidad.estado='confirmado'` | `resolverYAuditar` -> `upsertVinculo` con `estado:'confirmado', metodo:'humano'` | WIRED | Lineas 226-238; unica ruta a `confirmado` desde la aplicacion. |
| `0007_identidad_guardas.sql` | `vinculo_identidad` (DB-tier guard) | Trigger `vinculo_identidad_guarda` BEFORE UPDATE + INSERT | WIRED | Bloquea `metodo='llm'` promoviendo a `confirmado` y demotion de filas ya confirmadas. |
| `golden-set.test.ts` | `evaluarGolden(GOLDEN_SET_GATE)` + precision gate | `expect(precision).toBeGreaterThanOrEqual(0.95)` | WIRED | Linea 78; la meta-prueba (lineas 89-114) demuestra que el gate puede fallar con los casos adversarios. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `pipeline.ts:correrPipeline` | `llm: Adjudicacion` | `provider.complete(..., AdjudicacionSchema)` — MiniMax real o mock segun entorno | Si (validado por zod; mock determinista en CI; real en LIVE) | FLOWING |
| `vinculo_identidad` | `estado`, `parlamentario_id` | `writer.upsertVinculo(...)` desde el pipeline o el revisor-cli | Si — ningun path escribe `confirmado` sin persona real (guarda DB + validacion app) | FLOWING |
| `identidad_audit` | Fila por decision | `writer.appendAudit(...)` con `vinculo_id` del upsert previo | Si — el audit tiene el id del vinculo en todas las ramas excepto la de revision (diseno documentado) | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — no hay entry points ejecutables sin Supabase local o API key de MiniMax. La suite de vitest corre los comportamientos criticos de forma determinista (mock sin red); los spot-checks de la aplicacion requieren el servidor Supabase local.

### Probe Execution

No hay probe scripts en `scripts/*/tests/probe-*.sh` para esta fase. La verificacion de comportamiento se realiza via pgTAP (100 asserts, segun REVIEW.md) y vitest (274 tests + 4 live-skip).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ID-03 | 04-01, 04-03 | Generacion de candidatos por blocking | SATISFIED | `generarCandidatos()` en `candidatos.ts` con filtros duros/blandos. |
| ID-04 | 04-01, 04-03 | Adjudicacion LLM con schema validado | SATISFIED | `AdjudicacionSchema` (zod) + `construirPromptAdjudicacion` + `aplicarCompuerta`. |
| ID-05 | 04-02, 04-03 | Cola de revision humana con revisor+timestamp | SATISFIED | `revision_identidad` DDL + `revisor-cli.ts` con confirm/reject/correct. |
| ID-06 | 04-02, 04-03 | `vinculo_identidad` con estados confirmado/probable/no_confirmado | SATISFIED | DDL en 0006 + guarda en 0007; `confirmado` exclusivo de humano/determinista. |
| ID-07 | 04-03 | Golden set como gate de deploy | SATISFIED | 22 casos + meta-prueba que demuestra que el gate puede fallar (CR-02 corregido). |
| ID-08 | 04-02, 04-03 | Audit log inmutable append-only | SATISFIED | Trigger BEFORE UPDATE/DELETE/TRUNCATE en `identidad_audit` + REVOKE a `service_role` (0006+0007). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `pipeline.ts` | 147-156 | `provider.complete` sin try/catch | Info (IN-01 diferido) | Un fallo de red/LLM deja la mencion sin vinculo ni audit. Diferido por diseno (requiere decidir politica de retry). No bloquea el goal de la fase. |
| `revisor-cli.ts` | 239-242 | CLI acepta `--revisor --motivo` como valor de flag | Info (IN-02 diferido) | El `validarRevisor` solo rechaza vacio/whitespace; un flag como valor de otro flag pasaria. Bajo riesgo (uso manual operativo). Diferido. |
| `writer-revision.ts` | 163-173 | `obtenerCaso` usa `[0]` en vez de `.maybeSingle()` | Info (IN-03 diferido) | El `id` es PK; sin riesgo practico hoy. Diferido. |
| Varios | — | Regex `P\d{5}` duplicado en 3 sitios | Info (IN-04 diferido) | Deuda de DRY; sin impacto funcional inmediato. Diferido. |

Ningun marcador TBD/FIXME/XXX sin referencia formal fue encontrado. Los 4 Info estan documentados en REVIEW.md como diferidos explicitamente.

### Existential-Risk Controls — Verificacion Critica

Los controles especificos del riesgo existencial #1 ("un match equivocado = afirmacion falsa creible") fueron verificados en el codigo fuente:

1. **Compuerta fail-closed con UMBRAL=0.90 estricto:** `compuerta.ts:24` define `UMBRAL = 0.9`; `compuerta.ts:44` usa `if (llm.confidence < UMBRAL)`. El borde exacto 0.90 auto-acepta; 0.8999 va a revision. Verificado en codigo.

2. **A4 — LLM nunca confirma, maximo probable:** `pipeline.ts:168` escribe `estado: "probable"` en auto-aceptar. `pipeline.ts:166` comentario `/* A4: auto-aceptar NUNCA produce 'confirmado' */`. El trigger `vinculo_identidad_guarda` en 0007 bloquea `metodo='llm'` promoviendo a `confirmado` a nivel DB.

3. **RUT/PII nunca al LLM:** `pipeline.ts:150` corre `assertNoRutInLlmInput` sobre `SYSTEM_ADJUDICACION + userPrompt` (payload completo; WR-05 corregido). `MencionForanea` en `tipos.ts` no incluye campo `rut` por diseno. `candidatos jsonb` en `revision_identidad` declarados SIN rut (0006:57).

4. **Golden gate real, no tautologia:** `GOLDEN_SET_ADVERSARIO` contiene 2 casos donde el mock devuelve un id equivocado con alta confianza. La meta-prueba en `golden-set.test.ts:90-114` verifica que `m.fp >= 1` y `m.precision < 0.95`, demostrando que la rama `fp` es alcanzable y el gate puede fallar.

5. **Guarda DB en `vinculo_identidad`:** Migration 0007 agrega triggers BEFORE UPDATE e INSERT que bloquean: (a) demotion de `confirmado` a otro estado, (b) reescritura de `parlamentario_id` en una fila confirmada, (c) confirmacion por `metodo='llm'`, (d) confirmacion sin `parlamentario_id`. pgTAP verifica estos bloqueadores (100 asserts segun REVIEW.md).

6. **Audit TRUNCATE gap cerrado:** Migration 0007 agrega `identidad_audit_no_truncate` BEFORE TRUNCATE FOR EACH STATEMENT; REVOKE explicito a `service_role` (no solo a `public`).

### Human Verification Required

#### 1. Golden Set en MODO LIVE contra MiniMax-M3 real

**Test:** `IDENTITY_GOLDEN_LIVE=1 MINIMAX_API_KEY=<key> pnpm --filter @obs/adjudication test --run golden-set`
**Expected:** El test imprime `golden LIVE MiniMax-M3: precision=X.XXX recall=X.XXX (tp=N fp=N fn=N)` y `expect(m.precision).toBeGreaterThanOrEqual(0.95)` pasa. Esto establece la linea base de precision real del modelo antes de usarlo en volumen en Fases 5-7.
**Why human:** El bloque LIVE esta gated por `IDENTITY_GOLDEN_LIVE === "1"` y `MINIMAX_API_KEY` para no quemar cuota en CI. No es un bloqueador del phase goal (el gate CI mockeado ya pasa y la meta-prueba demuestra que el gate es real), pero es recomendado correrlo una vez antes de que los conectores de Fases 5-7 produzcan menciones en volumen.

---

### Gaps Summary

No hay gaps. Los 5 criterios de exito estan satisfechos a nivel de codigo:

- SC-1 (blocking + LLM + schema validado): VERIFIED en `candidatos.ts` + `prompt.ts` + `pipeline.ts`.
- SC-2 (compuerta fail-closed asimetrica): VERIFIED en `compuerta.ts` con UMBRAL=0.90 estricto.
- SC-3 (revision humana con audit inmutable): VERIFIED en `revisor-cli.ts` + `0006`+`0007`.
- SC-4 (estados confirmado/probable/no_confirmado, solo confirmado como hecho): VERIFIED via DDL + guarda DB (0007) + A4 en app.
- SC-5 (golden gate real que puede fallar): VERIFIED con meta-prueba aislada de casos adversarios.

Los 4 items Info del code-review estan diferidos explicitamente y no afectan el goal de la fase.

El unico item de verificacion pendiente es la corrida LIVE de MiniMax-M3 (no automatizable sin cuota), clasificado como human_needed no bloqueante.

---

_Verified: 2026-06-18T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
