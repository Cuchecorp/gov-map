---
phase: 35-ent-resoluci-n-de-identidades-de-terceros
plan: 03
subsystem: "@obs/adjudication — capa de adjudicación LLM + cola humana de terceros"
tags: [adjudication, entity-resolution, fail-closed, rut-gate, juridica-skip-llm, human-gate, ENT-02, ENT-04]
requires:
  - "@obs/identity matchDeterministaEntidad / EnlaceEntidadConfirmado / confirmarEntidad (Plan 02)"
  - "@obs/llm assertNoRutInLlmInput / assertSensitivityAllowed / LLMProvider (reusados)"
  - "packages/adjudication/src/compuerta.ts (UMBRAL 0.90 estricto — reusado, no duplicado)"
  - "supabase/migrations/0035 (vinculo_entidad/revision_entidad) + 0036 (RPC resolver_entidad) — referenciados por nombre; apply remoto = checkpoint operador, NO requerido para build/unit-test"
provides:
  - "correrPipelineEntidad (etapas 0→3 + Δ2 jurídica-salta-LLM + gate RUT fail-closed)"
  - "AdjudicacionEntidadSchema (chosen_id /^E\\d{5}$/) + SYSTEM terceros + construirPromptEntidad sin RUT"
  - "RevisionEntidadWriter (upsertVinculoEntidad onConflict tipo_entidad,mencion_normalizada + resolverEntidad RPC con p_tipo_entidad)"
  - "revisor-entidad-cli (list/show/confirm/reject/correct; promoción humana exclusiva)"
  - "aplicarCompuertaEntidad (reusa UMBRAL de compuerta.ts) + MockMiniMaxProviderEntidad"
affects:
  - "Plan 04 (reconciliadores lobby/dinero): consumirán correrPipelineEntidad + el FK branded EnlaceEntidadConfirmado"
  - "compuerta.ts: ahora exporta UMBRAL (un solo punto de verdad del 0.90 entre parlamentario y entidad)"
tech-stack:
  added: []
  patterns:
    - "espejo del pipeline parlamentario con Δ2 (rama discriminada por tipo_entidad que salta el LLM)"
    - "gate RUT fail-closed sobre system+user EXACTO antes de complete() — 0 llamadas si se cuela"
    - "auto-aceptar LLM → 'probable' (NUNCA 'confirmado'); confirmado solo vía RPC humano"
    - "UMBRAL exportado y reusado (no redefinido) para evitar drift del 0.90 estricto"
    - "FK branded minteado solo en la promoción humana (confirmarEntidad(...,'humano'))"
key-files:
  created:
    - packages/adjudication/src/prompt-entidad.ts
    - packages/adjudication/src/prompt-entidad.test.ts
    - packages/adjudication/src/tipos-entidad.ts
    - packages/adjudication/src/pipeline-entidad.ts
    - packages/adjudication/src/pipeline-entidad.test.ts
    - packages/adjudication/src/compuerta-entidad.ts
    - packages/adjudication/src/mock-provider-entidad.ts
    - packages/adjudication/src/writer-revision-entidad.ts
    - packages/adjudication/src/writer-revision-entidad.test.ts
    - packages/adjudication/src/revisor-entidad-cli.ts
    - packages/adjudication/src/revisor-entidad-cli.test.ts
  modified:
    - packages/adjudication/src/compuerta.ts
    - packages/adjudication/src/index.ts
decisions:
  - "Se CREÓ compuerta-entidad.ts pese a que el plan pedía reusar compuerta.ts tal cual: aplicarCompuerta hard-referencia mencion.camara/candidato.camara/periodo (parlamentario-específicos) que NO existen en los tipos de entidad → no tipa. Se exportó UMBRAL de compuerta.ts y compuerta-entidad lo REUSA (un solo punto de verdad del 0.90 estricto). La regla 5 cámara/periodo se sustituyó por consistencia de tipo_entidad. El must_have del UMBRAL 0.90 estricto queda satisfecho sin duplicar el operador."
  - "tipos-entidad.ts y mock-provider-entidad.ts se crearon como análogos nuevos (no estaban en files_modified del plan) porque MencionForanea/tipos.ts y mock-provider.ts son parlamentario-específicos (camara/periodo; Adjudicacion). Espejos limpios, sin lógica nueva."
  - "writer-revision-entidad.ts se escribió en el commit de Task 2 (es dependencia de TIPOS del pipeline) y sus tests/CLI en Task 3 — la implementación quedó atómica con quien la consume."
  - "El plan pedía `pnpm --filter @obs/adjudication build`; el paquete no define script build (igual que @obs/identity en Plan 02). El gate de compilación es `typecheck` (tsc -b), que pasa limpio."
  - "Las migraciones 0035/0036 se referencian por nombre; el onConflict 'tipo_entidad,mencion_normalizada' del writer y la firma de 10 params del RPC resolver_entidad son los contratos que esas migraciones deben honrar (apply remoto = checkpoint operador)."
metrics:
  duration: ~12min
  completed: 2026-06-23
---

# Phase 35 Plan 03: Capa de adjudicación de terceros (@obs/adjudication) — Summary

Pipeline de adjudicación LLM de terceros (`correrPipelineEntidad`, etapas 0→3 espejo de `correrPipeline`) con la pieza nueva crítica Δ2 — una entidad jurídica salta la Etapa 2 LLM por completo (no_confirmado directo, 0 llamadas al modelo) — más el gate RUT fail-closed sobre el prompt exacto (ENT-02), el prompt+schema de terceros (`chosen_id /^E\d{5}$/`), el writer de la cola/RPC `resolver_entidad` y el CLI revisor humano (ENT-04). Reusa `assertNoRutInLlmInput` y el UMBRAL 0.90 estricto de `compuerta.ts` sin duplicarlos.

## What Was Built

- **Task 1 — prompt-entidad (56cf592):** `AdjudicacionEntidadSchema` espeja `AdjudicacionSchema` cambiando SOLO el regex de `chosen_id` (`/^P\d{5}$/` → `/^E\d{5}$/`); `decision`/`confidence`/`evidence`/`conflicts` y el refine cruzado match→chosen_id quedan idénticos (la compuerta sirve sin cambios). `SYSTEM_ADJUDICACION_ENTIDAD` reescrito para terceros personas naturales (anti-causalidad/anti-invención). `construirPromptEntidad` sin RUT por construcción. `tipos-entidad.ts` con `MencionEntidadForanea` (discriminador `tipoEntidad`, sin cámara/periodo). 8 tests verdes (regex E/rechazo P, forma idéntica al analog, gate RUT pasa limpio sobre system+user).
- **Task 2 — pipeline-entidad (6989b65):** `correrPipelineEntidad(mencion, maestra, provider, writer)` espeja las 4 etapas. **Δ2 (crítico):** una `tipoEntidad === 'juridica'` corta antes de blocking/LLM → `no_confirmado` directo, el provider recibe 0 llamadas. **Gate RUT (ENT-02):** `assertNoRutInLlmInput(`SYSTEM\nuser`)` antes de `complete()` — un RUT colado (incluso vía maestra sucia) lanza con 0 llamadas. **A4:** auto-aceptar → `probable` metodo='llm', NUNCA `confirmado`. Borde UMBRAL 0.90 estricto (0.90 PASA, 0.8999 → revisión). Se exportó `UMBRAL` de `compuerta.ts` y `aplicarCompuertaEntidad` (en `compuerta-entidad.ts`) lo reusa. `writer-revision-entidad.ts` (tipos + RevisionEntidadWriter) y `mock-provider-entidad.ts`. 6 tests verdes (los 6 casos del behavior).
- **Task 3 — writer tests + revisor-cli + barrel (2f857a5):** `writer-revision-entidad.test.ts` asierta `onConflict='tipo_entidad,mencion_normalizada'` (Pitfall 6, índice único TOTAL de 0035; constante `ONCONFLICT_VINCULO_ENTIDAD` exportada para coincidir byte-a-byte con el on conflict del RPC en 0036) y que `resolverEntidad` llama `.rpc('resolver_entidad', {...})` con los 10 params incluyendo `p_tipo_entidad`. `revisor-entidad-cli.ts` (list/show/confirm/reject/correct): `list` muestra solo `pendiente`; `confirm`/`correct` promueven vía `resolverEntidad` con `p_promover=true` minteando `confirmarEntidad(..., 'humano')` (FK branded); `correct` valida `/^E\d{5}$/`; inputs inválidos no tocan la DB. Exports al `index.ts`. 14 tests nuevos verdes.

## Verification

- `pnpm --filter @obs/adjudication test` → **89 passed / 1 skipped (12 archivos)**, incluyendo `prompt-entidad` (8), `pipeline-entidad` (6 casos del behavior), `writer-revision-entidad` (6), `revisor-entidad-cli` (8). Sin regresión en la suite parlamentario (compuerta 11, pipeline 6, revisor-cli 11, writer-revision 7) pese a editar `compuerta.ts`.
- `pnpm --filter @obs/adjudication typecheck` (tsc -b) → limpio (gate de compilación; el paquete no define script `build`, igual que @obs/identity).
- Δ2 jurídica: el test afirma `provider.callCount === 0` (nunca construye prompt ni llama complete).
- Gate RUT (ENT-02): el test afirma `rejects.toThrow()` con `callCount === 0` y ningún vínculo confirmado.
- onConflict idéntico en el writer y la constante exportada; pendiente que las migraciones 0035/0036 honren la misma clave (apply = operador).

## Deviations from Plan

### Auto-fixed / adjustments

**1. [Rule 3 - Blocking] El plan pedía reusar `compuerta.ts` tal cual; `aplicarCompuerta` no tipa contra entidades.**
- **Found during:** Task 2.
- **Issue:** `aplicarCompuerta(llm, mencion, candidatos)` hard-referencia `mencion.camara`, `elegido.camara` y `elegido.periodo` (parlamentario-específicos). Los tipos de entidad (`MencionEntidadForanea`/`EntidadTerceroRow`) no tienen esos campos → no compila reusarla directamente.
- **Fix:** Se exportó `UMBRAL` de `compuerta.ts` (un solo punto de verdad del 0.90 estricto) y se creó `compuerta-entidad.ts` con `aplicarCompuertaEntidad` que REUSA `UMBRAL` y replica las reglas universales 1-4; la regla 5 (cámara/periodo) se sustituyó por consistencia de `tipo_entidad`. El must_have "UMBRAL=0.9 comparación ESTRICTA <" queda satisfecho sin duplicar el operador ni arriesgar drift.
- **Files modified:** compuerta.ts (export UMBRAL), compuerta-entidad.ts (nuevo).
- **Commit:** 6989b65.

**2. [Rule 3 - Blocking] `tipos-entidad.ts` y `mock-provider-entidad.ts` no estaban en `files_modified` pero son necesarios.**
- **Found during:** Tasks 1-2.
- **Issue:** `tipos.ts` (`MencionForanea` con camara/periodo) y `mock-provider.ts` (tipado a `Adjudicacion`) son parlamentario-específicos. El prompt/pipeline de terceros necesitan una mención sin cámara/periodo y un mock tipado a `AdjudicacionEntidad`.
- **Fix:** Creados como análogos nuevos (espejos limpios, sin lógica de dominio nueva). Coherente con el patrón "copiar el patrón, no el tipo" del RESEARCH/PATTERNS.
- **Files modified:** tipos-entidad.ts, mock-provider-entidad.ts (nuevos).
- **Commits:** 56cf592, 6989b65.

**3. [Rule 3 - Blocking] El plan especifica `pnpm --filter @obs/adjudication build`; el paquete no tiene script `build`.**
- **Found during:** Task 3 verificación.
- **Fix:** Usado `typecheck` (tsc -b) como gate de compilación equivalente (lo mismo que decidió Plan 02 para @obs/identity). Pasa limpio.
- **Files modified:** ninguno (decisión de verificación).

## Threat Surface

Las mitigaciones del threat register del plan quedaron implementadas en código:
- **T-35-10** (RUT a prompt LLM): `assertNoRutInLlmInput(system+user)` antes de `complete()`; test #4 afirma 0 llamadas (ENT-02).
- **T-35-11** (jurídica por LLM): Δ2 corta antes de la Etapa 2; test #2 afirma `callCount === 0` al provider.
- **T-35-12** (dudoso auto-promovido): auto-aceptar → 'probable' (A4); confirmado solo vía RPC `resolver_entidad` (humano); UMBRAL 0.90 estricto reusado.
- **T-35-13** (huérfanos por resolución no atómica): `resolverEntidad` usa el RPC transaccional `resolver_entidad` (UPDATE+UPSERT+audit atómicos).
- **T-35-SC** (deps npm nuevas): cero paquetes nuevos (reusa @obs/llm, @obs/identity, mock existentes).

No se introdujo superficie de seguridad nueva fuera del threat_model (sin endpoints, sin DDL aplicado, sin canales públicos — todo TS puro/CLI consumido por Plan 04).

## Known Stubs

Ninguno que impida la meta del plan. El pipeline/writer/CLI son inyectables y están testeados contra mocks; el apply remoto de 0035/0036 y la fuente real de menciones (reconciliadores) viven fuera de este plan (checkpoint operador / Plan 04).

## Self-Check: PASSED

- Archivos creados verificados en disco (11 nuevos + compuerta.ts/index.ts modificados).
- Commits verificados: 56cf592 (Task 1), 6989b65 (Task 2), 2f857a5 (Task 3).
