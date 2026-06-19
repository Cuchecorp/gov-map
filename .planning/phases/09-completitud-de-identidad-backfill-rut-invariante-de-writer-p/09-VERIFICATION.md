---
phase: 09-completitud-de-identidad-backfill-rut-invariante-de-writer-p
verified: 2026-06-19T00:45:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Poblar supabase/seeds/parlamentario-rut.seed.json con RUTs reales DV-válidos + provenance (declaraciones InfoProbidad / diario oficial) y correr runBackfillRut → updateRut contra la DB; re-exportar el seed snapshot (dual-write)."
    expected: "{ escritas, rechazadas }: cada rechazada por DV inválido o provenance faltante (esperado), nunca un RUT fabricado escrito. Conteo de rut no-null del seed == conteo en la DB. parlamentario.rut sigue anon-denied."
    why_human: "No existe ninguna fuente oficial del Congreso que exponga el RUT de forma cruzable determinísticamente (verificado en vivo: Senado no lo trae; Cámara WSDiputado VACÍO). Poblar RUTs reales es una tarea de OPERADOR con datos externos; fabricarlos está prohibido por la regla LOCKED. La MÁQUINA de backfill (DV-gate + provenance + updateRut + idempotencia) está completa y verde."
  - test: "Re-correr el pgTAP supabase/tests/0018_piso_pii.test.sql contra una DB con la migración 0018 aplicada (`supabase test db` o psql contra el remoto/local aplicado)."
    expected: "plan 11, 11/11 PASS: pii_contraparte_declaracion con RLS enabled + cero policies + provenance NOT NULL; parlamentario sigue RLS-enabled + cero policies. `set role anon; select count(*) from pii_contraparte_declaracion;` → 0."
    why_human: "build/typecheck NO prueban que Postgres ejecutó el DDL (Pitfall 4). El verificador no tiene acceso a una DB en vivo. SUMMARY 09-03 reporta 11/11 PASS aplicado al remoto sa-east-1 vía pooler — claim creíble (archivo + test correctos) pero no re-ejecutable aquí; requiere confirmación humana contra el schema aplicado."
---

# Phase 9: Completitud de Identidad — Backfill RUT + Invariante de Writer + Piso PII — Verification Report

**Phase Goal:** Generalizar la guarda de identidad de v1.0 a las nuevas fuentes ANTES de que escriba el primer dataset de atribución: completar el RUT interno de la maestra, convertir la guarda de enlace-confirmado en un invariante tipado a nivel de writer, y dejar el piso de RLS/data-routing para toda PII nueva.
**Verified:** 2026-06-19T00:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criteria) | Status | Evidence |
|---|----------------------------------|--------|----------|
| 1 | IDENT-10 — `rut` de la maestra completado server-side, nunca legible por `anon` (RLS deny-by-default); habilita cruce por RUT | ✓ VERIFIED (machinery) | `backfill-rut.ts`: `aceptarRutBackfill` exige provenance + DV-gate vía `isRutValido` (REUSADO, no reimplementado); `runBackfillRut` solo pasa válidas al writer. `SupabaseMaestraWriter.updateRut` por fila `.eq(id)`, chunked, idempotente. `parlamentario-rut.seed.json` Track B (`filas: []` documentado, sin RUTs fabricados). `@obs/identity` 82 tests verdes. **RUT VALUES = operator/human task** (ver human_verification) — no es falla de fase. |
| 2 | IDENT-12 — invariante tipado: ningún `*Writer` fija FK salvo determinista/confirmado; rechazado ESTRUCTURALMENTE | ✓ VERIFIED | `EnlaceConfirmado` con `unique symbol` privado no exportado + factory única `confirmar()`. `VotoParaEscribir.enlace: EnlaceConfirmado \| null`. **Prueba de compilación load-bearing confirmada por falsificación:** removí un `@ts-expect-error` → `tsc` falla con `TS2322: Type 'string' is not assignable to type 'EnlaceConfirmado'`. Mint sites = solo `reconciliar-senado.ts` + `reconciliar-camara.ts`. `as EnlaceConfirmado` grep = 0. typecheck exit 0. |
| 3 | IDENT-11 — golden set extendido (DV/homónimo/persona-jurídica/colisión); gate CI ≥0.95 sigue bloqueando | ✓ VERIFIED | `golden-set.ts` casos g25 (colisión-homónimo→revisión), g26 (persona-jurídica→no_match), g27 (colisión-dura→revisión), etiquetados al outcome correcto, NO movidos al set adversario. Umbral ≥0.95 sin cambiar. `@obs/adjudication` 61 tests verdes incl. gate sobre `GOLDEN_SET_GATE` y meta-prueba "el gate puede fallar". Cobertura nueva de `isRutValido` (jurídica + DV inválido). |
| 4 | LEGAL-03 — PII nueva deny-by-default a anon (RLS) + data-routing extendido; ningún RUT/PII al LLM | ✓ VERIFIED (code) | `0018_piso_pii.sql`: `pii_contraparte_declaracion` con `enable row level security`, cero policies, sin GRANT a anon, provenance NOT NULL; re-asegura `parlamentario`. Check automatizado OK. `assertPiiDocumentSafeForLlm` COMPONE `assertNoRutInLlmInput` + `assertSensitivityAllowed` (sin duplicar). `@obs/llm` 78 tests verdes (22 data-routing). pgTAP 0018 existe (11 asserts). **Aplicación DDL + pgTAP run = human_verification** (no re-ejecutable sin DB). |

**Score:** 4/4 truths verified (machinery/code level). 2 operator/human items carried for live-DB and real-data confirmation.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/identity/src/enlace-confirmado.ts` | Branded `EnlaceConfirmado` + factory `confirmar()` | ✓ VERIFIED | `unique symbol` privado no exportado; `confirmar()` única factory; sin cast `as EnlaceConfirmado`. |
| `packages/identity/src/enlace-confirmado.test-d.ts` | Prueba de compilación (FK crudo NO compila) | ✓ VERIFIED | 4 `@ts-expect-error`; falsificación confirmó que tsc rechaza string crudo (TS2322). |
| `packages/tramitacion/src/writer.ts` | FK del writer tipado `EnlaceConfirmado \| null` | ✓ VERIFIED | `VotoParaEscribir.enlace` branded; `aplanarVoto()` único sitio de aplanado a `string\|null`. |
| `packages/tramitacion/src/reconciliar-senado.ts` + `reconciliar-camara.ts` | Choke points que mintean | ✓ VERIFIED | Únicos mint sites del branded factory (rama determinista / match DIPID). |
| `packages/identity/src/backfill-rut.ts` | Backfill DV-validado + provenance | ✓ VERIFIED | `isRutValido` gate; nunca fabrica; idempotente. |
| `supabase/seeds/parlamentario-rut.seed.json` | Track B curado server-side | ✓ VERIFIED | `filas: []` documentado; sin placeholders fabricados. |
| `packages/adjudication/src/golden/golden-set.ts` | Casos RUT golden | ✓ VERIFIED | g25/g26/g27 etiquetados; gate ≥0.95 intacto. |
| `supabase/migrations/0018_piso_pii.sql` | Convención RLS deny-by-default | ✓ VERIFIED | RLS enabled, cero policies, sin GRANT anon, provenance NOT NULL. |
| `supabase/tests/0018_piso_pii.test.sql` | pgTAP RLS + cero policies | ✓ VERIFIED (exists/correct) | plan 11; relrowsecurity + is_empty(pg_policy); re-asevera parlamentario. Run contra DB = human. |
| `packages/llm/src/data-routing.ts` | Gate extendido a PII nueva | ✓ VERIFIED | `assertPiiDocumentSafeForLlm` compone ambos asserts sin duplicar. |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `reconciliar-senado.ts` / `reconciliar-camara.ts` | `confirmar` (@obs/identity) | rama determinista mintea | ✓ WIRED (grep: solo estos 2 mint sites del branded factory) |
| `writer.ts` | `EnlaceConfirmado` | FK del input tipado branded | ✓ WIRED |
| `backfill-rut.ts` | `isRutValido` | DV módulo-11 antes de escribir | ✓ WIRED |
| `backfill-rut.ts` → `runBackfillRut` | `SupabaseMaestraWriter.updateRut` | update por id de filas válidas | ✓ WIRED |
| `data-routing.ts` | `assertNoRutInLlmInput` / `assertSensitivityAllowed` | reusa asserts fail-closed | ✓ WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Identity suite verde (incl. backfill + enlace) | `pnpm --filter @obs/identity test` | 82 passed | ✓ PASS |
| Golden gate ≥0.95 + meta-prueba viva | `pnpm --filter @obs/adjudication test` | 61 passed (1 skip) | ✓ PASS |
| Data-routing PII gate | `pnpm --filter @obs/llm test` | 78 passed (22 data-routing) | ✓ PASS |
| Tramitacion (writer branded) | `pnpm --filter @obs/tramitacion test` | 102 passed | ✓ PASS |
| Compile-time invariant (IDENT-12) | `pnpm --filter @obs/identity typecheck` | exit 0 | ✓ PASS |
| **Falsificación del gate IDENT-12** | quitar 1 `@ts-expect-error` → `tsc -b` | falla TS2322 (string ≠ EnlaceConfirmado) | ✓ PASS (gate load-bearing) |
| 0018 RLS convención (sin comentarios) | node check enable RLS / no GRANT anon / no policy | true / false / false | ✓ PASS |
| Seed parity | parse parlamentario.seed.json | 186 rows, 186 rut null, 0 populated | ✓ PASS (consistente con Track B vacío) |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` declared for this phase. The migration/RLS verification is the pgTAP file `0018_piso_pii.test.sql`, which requires an applied DB (routed to human_verification — not re-executable in this environment without a live Postgres).

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| IDENT-10 | 09-02 | ✓ SATISFIED (machinery) | backfill DV-gate + provenance + updateRut; RUT values = operator task |
| IDENT-11 | 09-02 | ✓ SATISFIED | golden g25/g26/g27; gate ≥0.95 intacto; suite verde |
| IDENT-12 | 09-01 | ✓ SATISFIED | branded type + compile-time proof (falsified-positive) |
| LEGAL-03 | 09-03 | ✓ SATISFIED (code) | 0018 RLS deny-by-default + data-routing gate; pgTAP run = human |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (modified files) | — | TODO/FIXME/XXX/HACK | ℹ️ None | grep returned 0 debt markers across all phase-modified core files |
| `app/lib/buscar.test.ts:156`, `@obs/agenda/parse-camara-citaciones.ts:105` | — | pre-existing typecheck errors | ℹ️ Info | Confirmed pre-existing & unrelated: `app` imports NO Phase-9 symbols (grep). Real invariant consumers (`@obs/identity`, `@obs/tramitacion`) typecheck exit 0. Documented in `deferred-items.md`. NOT a Phase-9 regression. |

### Human Verification Required

1. **Backfill de RUTs reales (IDENT-10 data task)** — Poblar `parlamentario-rut.seed.json` con RUTs DV-válidos + provenance desde fuentes externas (InfoProbidad/diario oficial), correr `runBackfillRut`, dual-write seed+DB. Expected: rechazos solo por DV/provenance, nunca un RUT fabricado escrito; paridad seed↔DB; `parlamentario.rut` anon-denied. Razón humana: no hay fuente oficial cruzable determinísticamente; fabricar está prohibido. **La máquina está completa y verde; esto NO es una falla de fase.**

2. **pgTAP 0018 contra DB aplicada (LEGAL-03 proof)** — Re-correr `0018_piso_pii.test.sql` contra una DB con 0018 aplicada. Expected: 11/11 PASS; anon lee 0 filas de la PII nueva. Razón humana: build/typecheck no prueban DDL aplicado (Pitfall 4); sin acceso a DB en vivo. SUMMARY 09-03 reporta 11/11 PASS aplicado al remoto — claim creíble (archivo + test correctos), pendiente de confirmación humana.

### Gaps Summary

**No code/test gaps.** Las 4 success criteria de la ROADMAP están satisfechas a nivel de código: el invariante tipado IDENT-12 es estructuralmente probado (falsificación confirmó que tsc rechaza un FK string crudo), el backfill IDENT-10 tiene la máquina completa (DV-gate + provenance + updateRut + idempotencia) con Track B honestamente vacío, el golden set IDENT-11 está extendido con el gate ≥0.95 intacto, y el piso LEGAL-03 (migración 0018 + data-routing) está en su lugar. Todas las suites (identity 82, adjudication 61, llm 78, tramitacion 102) pasan; typechecks de los consumidores reales exit 0.

Los dos items de `human_verification` son límites de entorno / tareas de operador honestamente carried — NO fallas:
- Los valores RUT reales requieren una fuente de datos externa (ninguna oficial es cruzable determinísticamente; fabricar está prohibido por regla LOCKED).
- La corrida pgTAP requiere una DB en vivo (no re-ejecutable por el verificador; SUMMARY reporta 11/11 PASS contra el remoto aplicado).

Por la regla de status (cualquier item de human_verification → `human_needed`), el estado es **human_needed** pese a que las 4 truths verifican a nivel de código.

---

_Verified: 2026-06-19T00:45:00Z_
_Verifier: Claude (gsd-verifier)_
