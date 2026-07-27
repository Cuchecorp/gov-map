# Phase 69: DINERO P5a — RUT-01 backfill a la maestra (CHECKPOINT OPERADOR) - Research

**Researched:** 2026-07-14
**Domain:** Backfill de PII interna (RUT chileno) a la maestra de identidad, con DV-gate, provenance NOT NULL, guard name-match≠write, RLS deny-by-default y medición de cobertura N/M. Escritura remota = checkpoint de operador.
**Confidence:** HIGH (todo el mecanismo core YA EXISTE y está testeado en el repo; la fase es wiring + guard + cobertura, no net-new)

## Summary

El mecanismo de backfill de RUT **ya existe, está completo y testeado** en el monorepo. Contrario a lo que sugiere el CONTEXT ("harvest-rut.ts / runBackfillRut EXISTEN — confirmar si el DV existe o crearlo"), la investigación confirma con evidencia directa del código que **todas las piezas exigidas por RUT-01 ya están construidas**:

- El DV módulo-11 (`isRutValido`) existe en `packages/identity/src/deterministic.ts:63` — no hay que crearlo.
- El DV-gate + provenance NOT NULL + fail-closed a log de revisión viven en `runBackfillRut`/`aceptarRutBackfill` (`packages/identity/src/backfill-rut.ts`), con tests exhaustivos (`backfill-rut.test.ts`).
- La regla "name-match NUNCA escribe RUT" ya está **estructuralmente** garantizada en `reconciliar-contrato.ts`: el único canal de escritura (`CandidatoCosechaRut` → `runHarvestRut` → `updateRut`) solo se alimenta cuando la maestra YA tenía un `rut` que coincide (corroboración/no-op); un RUT derivado por nombre viaja por un canal SEPARADO (`CandidatoRevisionRut` → `enqueueRevision`, cola humana).
- El RUT nunca cruza al LLM: `assertNoRutInLlmInput` (`packages/llm/src/data-routing.ts:52`) aborta fail-closed.
- La columna `parlamentario.rut` es RLS deny-by-default (`0005_parlamentario.sql:63`, re-afirmada en `0018_piso_pii.sql:74`); `entidad_tercero.rut` igual (`0034_entidad_tercero.sql:72` + `revoke all from anon, authenticated`).
- El writer real (`SupabaseMaestraWriter.updateRut`) apunta SIEMPRE al Supabase LOCAL; el push remoto es checkpoint de operador por diseño (writer-supabase.ts docstring).
- El seed Track B (`supabase/seeds/parlamentario-rut.seed.json`) existe con `filas: []` vacío — el operador lo puebla.

**Lo que esta fase debe AGREGAR (los gaps reales):**
1. Un **guard CI dedicado** (nuevo test, espejo de `lockdown-guard.test.ts` / `anti-insinuacion-guard.test.ts`) que enforce estáticamente que ningún code path deje que un name-match escriba `updateRut`/`parlamentario.rut`. Hoy la garantía es estructural en el código, pero NO hay un test-guardián que muerda si un refactor futuro rompe el corte.
2. La **señal de cobertura N/M de RUT DV-válido** en `pnpm freshness` (nuevo `COBERTURA_RUT_SENALES` en `catalog.ts` + `queryCoberturaRut` + `renderCoberturaRut`, espejo EXACTO de `COBERTURA_VOTO_SENALES` de Phase 68), con techo honesto por causa (sin dato / DV inválido / ambigüedad).
3. Un **runbook de operador** para la escritura remota (espejo de `66-BACKFILL-RUNBOOK.md` / `67-BACKFILL-SENADO-RUNBOOK.md`): cómo poblar el seed, correr el backfill contra la maestra remota vía `db-url`, y reportar N/M.

**Primary recommendation:** No reconstruir nada del mecanismo. Planificar 3 unidades: (a) guard CI name-match≠write-rut como test de vitest en `app/lib/` (o en `packages/identity`/`packages/dinero` como test de invariante estático); (b) señal de cobertura RUT en `@obs/freshness` espejando el patrón VOTO-05; (c) runbook + verificación de que el seed/guards/cobertura corren offline con writer espía. El agente NO ejecuta la escritura remota.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **PII / minimización (rector):** El RUT NUNCA cruza al LLM ni a una tabla/ruta PÚBLICA. RLS deny-by-default sobre la columna `rut`. Minimización de dato.
- **Name-match NUNCA escribe el `rut` de la maestra** (name-uniqueness ≠ RUT-ownership). Un name-match SOLO corrobora un RUT ya presente, o encola a revisión humana. Un GUARD CI lo enforça (fail-closed).
- **DV-gate módulo-11 obligatorio** antes de escribir cualquier RUT; provenance NOT NULL (de dónde vino el RUT).
- **Cobertura de RUT DV-válido MEDIDA y DECLARADA** como techo honesto (N/M); "sin dato de RUT" ≠ "sin vínculos".
- **Track B (seed curado) es el default de escritura;** Track A (SERVEL) corrobora, no sobre-escribe a ciegas.
- **Checkpoint operador:** la escritura remota a la maestra (db-url) NO la ejecuta el agente. El agente entrega el mecanismo validado + runbook + guards + medición; el operador corre la escritura y reporta cobertura N/M.

### Claude's Discretion
- Detalles de implementación del mecanismo/guard/medición dentro de las reglas anteriores; reusar `harvest-rut.ts`/`runBackfillRut` existentes.

### Deferred Ideas (OUT OF SCOPE)
- Cruces de dinero (ChileCompra Phase 70, SERVEL financiamiento Phase 71) — dependen de esta fase.
- La escritura remota real = acto de operador (checkpoint), no de esta corrida autónoma.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RUT-01 | La maestra de terceros (`entidad_tercero`) tiene RUT backfilleado para las entidades cruzables, con cobertura N/M declarada como techo honesto — bloqueante duro de TODO cruce de dinero. El RUT nunca se expone públicamente (minimización) ni cruza al LLM (LOCKED); personas jurídicas solo por RUT exacto, fail-closed. | Mecanismo completo (`runBackfillRut`, `isRutValido`, `updateRut`), canal corroboración/revisión (`reconciliar-contrato.ts`), gate LLM (`assertNoRutInLlmInput`), RLS deny-by-default (0005/0018/0034). Gaps: guard CI dedicado + señal cobertura RUT + runbook operador. NOTA de matiz abajo (Open Question 1): RUT-01 nombra `entidad_tercero`; el código de backfill principal escribe `parlamentario.rut`. Ambas maestras existen con RLS; el planner debe fijar cuál poblar. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| DV módulo-11 + provenance gate | Logic (packages/identity, pura) | — | `aceptarRutBackfill` es función pura sin red/DB; testeable offline. YA EXISTE. |
| Corroboración vs revisión (name-match routing) | Logic (packages/dinero, pura) | Human queue (revision_entidad) | `reconciliar-contrato.ts` decide canal; el RUT name-only va a cola humana, nunca al writer. YA EXISTE. |
| Escritura del RUT a la maestra | Backend / DB (Supabase, service_role) | Operador (checkpoint) | `SupabaseMaestraWriter.updateRut` bypassa RLS con service key; escritura remota = operador vía db-url. YA EXISTE (writer local). |
| RLS deny-by-default de `rut` | Database (Postgres RLS) | CI guard (lockdown-guard) | 0005/0018/0034 habilitan RLS sin policies + revoke. El guard estático escanea `app/` por PII. YA EXISTE. |
| Gate RUT-fuera-del-LLM | Logic (packages/llm) | — | `assertNoRutInLlmInput` fail-closed antes de todo `complete()`. YA EXISTE. |
| Guard name-match≠write-rut | CI test (vitest) | — | **GAP** — no hay un test-guardián dedicado; la garantía es estructural en el código pero sin linter que muerda ante refactor. |
| Cobertura N/M RUT DV-válido | Logic (packages/freshness) + CLI operador | Database (read-only counts) | **GAP** — no hay señal RUT en `pnpm freshness`; espejar `COBERTURA_VOTO_SENALES`. |
| Escritura remota + reporte N/M | Operador (runbook) | — | **GAP** — no hay runbook; espejar `66/67-BACKFILL-RUNBOOK.md`. |

## Standard Stack

Esta fase NO instala paquetes nuevos. Todo el stack ya está en el monorepo.

### Core (todo existente, sin instalación)
| Módulo | Ubicación | Propósito | Por qué estándar |
|--------|-----------|-----------|------------------|
| `isRutValido` / `normRut` | `packages/identity/src/deterministic.ts:52,63` | DV módulo-11 + normalización de RUT chileno | Único verificador DV del repo; ya reusado por `backfill-rut`, `reconciliar-contrato`, `data-routing`. NUNCA reimplementar. |
| `runBackfillRut` / `aceptarRutBackfill` | `packages/identity/src/backfill-rut.ts:71,112` | Orquesta DV-gate + provenance NOT NULL + fail-closed a `rechazadas` | Función pura + async; testeada (`backfill-rut.test.ts`). Idempotente por `id`. |
| `runHarvestRut` / `construirFilasCosecha` | `packages/dinero/src/harvest-rut.ts:31,46` | Adapta candidatos de cosecha → `runBackfillRut` (delega, no reimplementa) | Canal de corroboración; writer inyectable (espía en test, Supabase en LIVE). |
| `SupabaseMaestraWriter` (implements `RutBackfillWriter`) | `packages/identity/src/writer-supabase.ts:52,121` | `updateRut` por PK `id` (update por fila, no `.in()`), service_role bypassa RLS | Apunta al LOCAL; el push remoto es checkpoint de operador (docstring líneas 19-21). |
| `reconciliarContrato` | `packages/dinero/src/reconciliar-contrato.ts:254` | Emite `cosechas` (corroboración) vs `revisionesRut` (cola humana) — el corte name-match≠write | La lógica del guard vive aquí; el guard CI la protege. |
| `assertNoRutInLlmInput` | `packages/llm/src/data-routing.ts:52` | Fail-closed: aborta si un RUT aparece en input LLM | Ya invocado dentro de `correrPipeline`. |

### Supporting (para los gaps a construir)
| Módulo | Ubicación | Propósito | Cuándo usar |
|--------|-----------|-----------|-------------|
| `@obs/freshness` (`catalog.ts`, `evaluate.ts`, `query-runner.ts`, `cli.ts`) | `packages/freshness/src/` | Patrón de cobertura N/M (`COBERTURA_*_SENALES` + `evaluateCobertura` + `queryCobertura*` + `renderCobertura*`) | Agregar `COBERTURA_RUT_SENALES` espejando `COBERTURA_VOTO_SENALES` (Phase 68). Reusa `evaluateCobertura` tal cual (marca su propio `esDenominador`). |
| `app/lib/lockdown-guard.test.ts` | ídem | Plantilla de guard CI estático (walk source files, strip comments, regex offenders, mutation self-check) | Espejo para el guard name-match≠write-rut. |
| `app/lib/anti-insinuacion-guard.test.ts` | ídem (Phase 68) | Segundo espejo de guard estático (caza texto renderizado, mutation self-check "prueba que muerde") | Confirmar el patrón de self-check antes de landear. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusar `isRutValido` existente | Implementar un nuevo DV util | RECHAZADO — duplicaría el verificador, violaría Don't-Hand-Roll, y arriesgaría divergencia (el `isRutValido` ya maneja K, casefold, 7-8 dígitos). |
| Guard como test de vitest | Guard como script CI standalone | El patrón del repo es test de vitest (lockdown-guard, anti-insinuacion-guard corren en la suite). Mantener consistencia. |
| Cobertura en `@obs/freshness` | Nueva CLI de cobertura RUT separada | RECHAZADO — `pnpm freshness` ya es el hogar de las señales N/M (BUSQ-03, VOTO-05); una CLI aparte fragmenta la superficie del operador. |

**Installation:** Ninguna. Verificación de que las piezas compilan y testean:
```bash
pnpm --filter @obs/identity test    # backfill-rut.test.ts (DV gate + idempotencia)
pnpm --filter @obs/dinero test      # harvest-rut.test.ts + reconciliar-contrato tests
pnpm --filter @obs/freshness test   # evaluate.test.ts (patrón cobertura)
```

## Package Legitimacy Audit

No aplica: esta fase NO instala paquetes externos. Todo es código interno del monorepo (`@obs/identity`, `@obs/dinero`, `@obs/freshness`, `@obs/llm`) más `vitest` (ya presente). slopcheck no requerido.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Runtime State Inventory

> Fase de backfill/wiring de PII: aunque no es un rename, escribe estado que persiste FUERA del árbol de archivos. Inventario explícito.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `parlamentario.rut` (columna, RLS deny-by-default, `0005`) — HOY probablemente NULL/vacío en la mayoría de filas; `entidad_tercero.rut` (`0034`, RLS + revoke). El seed Track B `supabase/seeds/parlamentario-rut.seed.json` tiene `filas: []` (0 filas — verificado). | **Data migration** = la escritura remota del backfill (checkpoint operador). **Code edit** = ninguno para escribir; el mecanismo ya escribe correctamente. El seed lo puebla el operador con RUTs DV-válidos + provenance. |
| Live service config | Ninguno. El backfill no toca servicios externos configurados por UI/DB. La escritura es un `UPDATE` directo a la maestra vía `db-url`. | None — verificado: el writer es `@supabase/supabase-js` contra la DB, no un servicio con config UI. |
| OS-registered state | Ninguno — verificado: sin tasks/cron/pm2 asociados a este backfill (backfill masivo = LOCAL por convención CLAUDE.md, no un cron). El cron de novedades NO incluye RUT. | None. |
| Secrets/env vars | `SUPABASE_LOCAL_URL`/`SUPABASE_LOCAL_SERVICE_KEY` (writer local); para el remoto el operador usa `db-url` (MEMORY: write remoto solo vía `db push --db-url`; service key API ≠ PAT `sbp_`; el .env HOY no tiene DB password apto para push remoto — writer-supabase.ts docstring líneas 19-21). | Ninguno a renombrar. El runbook debe documentar QUÉ credencial usa el operador para el write remoto (no está en .env por diseño). |
| Build artifacts | `packages/dinero/dist/harvest-rut.js`/`.d.ts`, `packages/identity/dist/*` (compilados). Stale si se editan las fuentes. | Rebuild (`pnpm build`) tras cualquier edit; los tests corren sobre `src/`. |

**Nota de estado bloqueante:** Con `filas: []` en el seed y `parlamentario.rut` mayormente vacío, la cobertura REAL de RUT hoy es ≈ 0/M. Ese es el "techo honesto" que la señal de cobertura debe reportar HASTA que el operador puebla el seed y corre el backfill remoto. La fase entrega el MECANISMO + la MEDICIÓN; el DATO lo puebla el operador.

## Architecture Patterns

### System Architecture Diagram

```
                       ┌─────────────────────────────────────────────┐
                       │  FUENTES DE RUT (dos tracks, LOCKED)         │
                       │                                             │
   Track B (default)   │  supabase/seeds/parlamentario-rut.seed.json │  ← operador puebla
   [seed curado] ──────┼──▶ { id, rut, origen, fecha_captura, enlace}│    (filas: [] hoy)
                       │                                             │
   Track A (corrob.)   │  ChileCompra proveedor persona-natural      │
   [SERVEL/contrato]───┼──▶ reconciliarContrato(contratos, maestra)  │
                       └──────────────┬──────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────────┐
                    │  DECISIÓN DE CANAL (name-match≠write)  │
                    │  reconciliar-contrato.ts               │
                    └───┬───────────────────────────────┬────┘
      RUT ya en maestra │                               │ RUT derivado por NOMBRE
      == rutProveedor   │                               │ (sin match con rut presente)
      (CORROBORACIÓN)   ▼                               ▼ (REVISIÓN HUMANA)
            CandidatoCosechaRut               CandidatoRevisionRut
                    │                               │
                    ▼                               ▼
        construirFilasCosecha            enqueueRevision(caso)  ← cola humana
                    │                    (revision_entidad; SIN el RUT crudo — minimización)
                    ▼                    ── NUNCA toca el writer ──✗
        runHarvestRut → runBackfillRut
                    │
         ┌──────────┴───────────┐
         │  DV-GATE (módulo-11) │  aceptarRutBackfill:
         │  + provenance NOT    │   - isRutValido? no → rechazadas["dv-invalido"] ✗ nunca escribe
         │    NULL              │   - provenance? no  → rechazadas["provenance-faltante"] ✗
         └──────────┬───────────┘   - sí+sí → FilaRutEscribir (normRut aplicado)
                    │ (solo escribibles)
                    ▼
        writer.updateRut(rows)  ── RutBackfillWriter interface
                    │
         ┌──────────┴────────────────────────────────┐
         │  writer LOCAL (test/dev): SpyRutWriter     │  ← offline, sin DB
         │  writer LIVE: SupabaseMaestraWriter        │  ← service_role bypassa RLS
         │    .updateRut → UPDATE parlamentario        │
         │      SET rut, origen, fecha_captura, enlace │
         │      WHERE id = ...                         │
         └────────────────────┬───────────────────────┘
                              │  REMOTO (db-url) = CHECKPOINT OPERADOR ⛔ (agente NO ejecuta)
                              ▼
                    parlamentario.rut / entidad_tercero.rut
                    (RLS deny-by-default; nunca a anon, nunca a LLM, nunca a ruta pública)
                              │
                              ▼
                    pnpm freshness → COBERTURA_RUT_SENALES (N/M, techo honesto)  ← GAP a construir
```

### Recommended Structure (edits, no new dirs)
```
packages/
├── identity/src/
│   ├── backfill-rut.ts          # EXISTE — no tocar (mecanismo + DV gate)
│   ├── deterministic.ts         # EXISTE — isRutValido (no tocar)
│   └── writer-supabase.ts       # EXISTE — updateRut (no tocar; el remoto es operador)
├── dinero/src/
│   ├── harvest-rut.ts           # EXISTE — no tocar
│   └── reconciliar-contrato.ts  # EXISTE — el corte name-match≠write (no tocar; el guard lo protege)
├── freshness/src/
│   ├── catalog.ts               # EDIT — agregar COBERTURA_RUT_SENALES (espejo VOTO)
│   ├── query-runner.ts          # EDIT — agregar queryCoberturaRut
│   └── cli.ts                   # EDIT — renderCoberturaRut + append a la salida
app/lib/
└── name-match-rut-guard.test.ts # NUEVO — guard CI estático (espejo lockdown-guard)
docs/  (o .planning/phases/69-.../)
└── 69-BACKFILL-RUT-RUNBOOK.md    # NUEVO — runbook operador (espejo 66/67)
```

### Pattern 1: Guard CI estático de invariante (espejo lockdown-guard)
**What:** Un test de vitest que camina el árbol de fuentes, strippea comentarios, y falla si algún path viola la invariante. Incluye un **mutation self-check** que prueba que el guard MUERDE.
**When to use:** Para congelar el corte name-match≠write-rut contra refactors futuros.
**Example:**
```typescript
// Source: app/lib/lockdown-guard.test.ts (patrón) + anti-insinuacion-guard.test.ts (self-check)
// El guard debe verificar (estáticamente sobre packages/dinero/src/reconciliar-contrato.ts):
//   1. runHarvestRut / runBackfillRut / updateRut se alimentan SOLO de `cosechas`
//      (CandidatoCosechaRut), NUNCA de `revisionesRut` (CandidatoRevisionRut).
//   2. La rama que empuja a `cosechas` está guardada por `rutMaestra != null && rutMaestra === rutNorm`
//      (corroboración de RUT ya presente), no por el resultado del name-match solo.
//   3. `revisionesRut` viaja SOLO por `enqueueRevision` (cola humana), nunca a un writer de escritura.
// Enfoque robusto: verificar que NO exista un edge `revisionesRut` → (runBackfillRut|runHarvestRut|updateRut)
// en el árbol, y que `cosechas.push` esté dentro del bloque `if (rutMaestra === rutNorm)`.
// Self-check: una versión mutada (que empuja rutCandidato a cosechas) DEBE hacer fallar el guard.
```
**Consideración de robustez:** un guard puramente textual/regex es frágil ante renombres. Preferir un guard que verifique la propiedad a nivel de tipos/estructura donde sea posible (p.ej. un test que construya un caso name-only y assert que `cosechas` está vacío y `revisionesRut` tiene el candidato — este ya es un test de comportamiento, más robusto que un regex). El planner puede combinar: (a) test de comportamiento fail-closed (un contrato persona-natural name-only NUNCA produce cosecha) + (b) guard estático que ningún import de `runBackfillRut`/`updateRut` reciba `revisionesRut`.

### Pattern 2: Señal de cobertura N/M con denominador propio (espejo VOTO-05)
**What:** Un array `COBERTURA_RUT_SENALES` separado en `catalog.ts`, con SQL 100% estática, denominador = universo de entidades cruzables, numeradores = RUT DV-válido presente / rechazadas por causa.
**When to use:** Para el techo honesto de RUT-01.
**Example:**
```typescript
// Source: packages/freshness/src/catalog.ts:107 (COBERTURA_VOTO_SENALES, espejo exacto)
export const COBERTURA_RUT_SENALES: CoberturaSenalConfig[] = [
  {
    senal: "entidades",
    etiqueta: "entidades cruzables (universo)",
    // Denominador M: el universo de filas que DEBERÍAN tener RUT para cruzar dinero.
    // El planner fija la tabla exacta (parlamentario vigente / entidad_tercero juridica).
    sql: "SELECT count(*) FROM parlamentario WHERE estado = 'confirmado';",
    esDenominador: true,
  },
  {
    senal: "con_rut_valido",
    etiqueta: "con RUT DV-válido",
    // Numerador N: filas con rut no nulo (el DV se garantiza en escritura vía isRutValido).
    sql: "SELECT count(*) FROM parlamentario WHERE estado = 'confirmado' AND rut IS NOT NULL AND rut <> '';",
    esDenominador: false,
  },
];
// evaluateCobertura(counts, COBERTURA_RUT_SENALES) se reusa TAL CUAL — degrada null (no 0)
// si el count no se leyó; M=0 → pct null (no divide por cero).
```

### Anti-Patterns to Avoid
- **Reimplementar el DV módulo-11:** `isRutValido` ya existe y maneja K/casefold/7-8 dígitos. Un segundo verificador diverge.
- **Escribir el RUT remoto en la corrida autónoma:** viola el checkpoint LOCKED. El writer remoto lo dispara el operador vía db-url.
- **Poner el RUT en un RPC público o proyectar `rut` en `app/lib/supabase.ts`:** el guard B de lockdown ya lo prohíbe; NO agregar `rut` a ninguna proyección/allowlist.
- **Contar cobertura como 0% cuando el count no se pudo leer:** degradar a `n/d` (null), nunca fingir 0 ni 100.
- **Cosechar un RUT nuevo desde un name-match:** el canal de escritura solo corrobora RUT ya presente. Un RUT name-only va a `revisionesRut` (cola humana).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Validar DV de RUT chileno | Un nuevo verificador módulo-11 | `isRutValido` (`packages/identity/src/deterministic.ts:63`) | Ya maneja K, casefold, 7-8 dígitos, normalización; ya reusado en 3 sitios. |
| Normalizar RUT (strip puntos/guión/case) | Regex ad-hoc | `normRut` (`deterministic.ts:52`) | Fuente única de la forma almacenada/comparada. |
| Gate DV + provenance + fail-closed | Loop de filtrado custom | `runBackfillRut`/`aceptarRutBackfill` (`backfill-rut.ts`) | Testeado, idempotente, devuelve `{escritas, rechazadas}`. |
| RUT-fuera-del-LLM | Chequeo manual en cada prompt | `assertNoRutInLlmInput` (`data-routing.ts:52`) | Fail-closed, regex amplio deliberado; ya en `correrPipeline`. |
| Cobertura N/M con degradación honesta | Nuevo cálculo de porcentaje | `evaluateCobertura` (`evaluate.ts:98`) | Ya maneja null/M=0/denominador-propio; solo hace falta un array de config nuevo. |
| Guard estático de invariante | Script bash/grep suelto | Test de vitest espejo de `lockdown-guard.test.ts` | Corre en la suite, con mutation self-check y mensajes de offender. |

**Key insight:** El 90% de RUT-01 ya está construido y testeado. El error de planificación más caro sería reconstruir el mecanismo (DV, backfill, canal de escritura) en vez de reconocer que existe y solo faltan el guard-guardián, la señal de cobertura y el runbook. Los tres son "wrap + measure + document", no "build".

## Common Pitfalls

### Pitfall 1: Confundir "el mecanismo existe" con "el DATO existe"
**What goes wrong:** El planner asume que porque el código escribe RUT correctamente, la cobertura ya es alta. En realidad el seed tiene `filas: []` y `parlamentario.rut` está mayormente vacío → cobertura real ≈ 0/M.
**Why it happens:** El mecanismo está completo, pero poblar el dato es acto de operador (checkpoint).
**How to avoid:** La fase entrega el mecanismo + la MEDICIÓN honesta. El criterio de éxito NO es "cobertura alta" sino "el guard muerde, la señal N/M reporta el techo real, el runbook está listo". Reportar 0/M como el estado verídico HOY es correcto, no un fallo.
**Warning signs:** Un plan con una task "poblar el seed con RUTs" ejecutada por el agente — eso es del operador (RUTs reales, no fabricados).

### Pitfall 2: El guard estático da falso verde por comentarios/prosa
**What goes wrong:** Un guard regex cuenta un `//` de URL o prosa de JSDoc como código y muerde donde no debe, o al revés strippea de más y no muerde.
**Why it happens:** `stripTsComments` corta en `//` incluso dentro de URLs (`https://`) si no se maneja el `://` (lección WR-05 de lockdown-guard).
**How to avoid:** Reusar el `stripTsComments` de `lockdown-guard.test.ts` (ya maneja `(?<!:)\/\/`). Incluir un **mutation self-check** que pruebe que el guard falla ante una violación sintética.
**Warning signs:** El guard pasa pero nunca lo viste fallar. Sin self-check, un guard mudo es peor que ninguno.

### Pitfall 3: CI verde ≠ escritura remota probada (falso positivo de build)
**What goes wrong:** El plan concluye "backfill funciona" porque compila/testea, pero la escritura remota nunca corrió (es checkpoint operador).
**Why it happens:** Los tests usan `SpyRutWriter` in-memory; el `SupabaseMaestraWriter` real contra el remoto no se ejercita en CI (por diseño).
**How to avoid:** El verifier debe distinguir "mecanismo validado offline con writer espía" (lo que el agente entrega) de "dato escrito remoto" (lo que el operador reporta). El runbook es el handoff.
**Warning signs:** Un criterio de éxito que exija "RUT escrito en la maestra remota" dentro de la corrida autónoma — eso NO es alcanzable ni deseable aquí.

### Pitfall 4: Denominador de cobertura mal elegido (parlamentario vs entidad_tercero)
**What goes wrong:** RUT-01 nombra `entidad_tercero`, pero el backfill principal (`backfill-rut.ts` + `parlamentario-rut.seed.json`) escribe `parlamentario.rut`. Medir la tabla equivocada da un N/M engañoso.
**Why it happens:** Hay DOS maestras con columna `rut`: `parlamentario` (0005) y `entidad_tercero` (0034). La cosecha de contrato corrobora `parlamentario.rut`; la resolución de proveedor puebla `entidad_tercero` (vía `backfill-entidad-cli`).
**How to avoid:** El planner debe fijar explícitamente cuál maestra es la "bloqueante de TODO cruce de dinero" para esta fase (ver Open Question 1) y medir esa. Probablemente AMBAS señales (parlamentario cruzable + entidad_tercero juridica) en la tabla de cobertura.
**Warning signs:** Una sola señal RUT sin decir de qué tabla.

## Code Examples

### Correr el mecanismo offline con writer espía (lo que el agente valida)
```typescript
// Source: packages/dinero/src/harvest-rut.test.ts (patrón real del repo)
import { runHarvestRut } from "@obs/dinero";
import type { RutBackfillWriter, FilaRutEscribir } from "@obs/identity";

class SpyRutWriter implements RutBackfillWriter {
  rows: FilaRutEscribir[] = [];
  async updateRut(rows: FilaRutEscribir[]) { this.rows.push(...rows); return { actualizadas: rows.length }; }
}
// DV-inválido → rechazado, NUNCA escrito (fail-closed):
const w = new SpyRutWriter();
const r = await runHarvestRut([{ /* cosecha con rut inválido */ }], w);
// r.escritas === 0; r.rechazadas[0].razon === "dv-invalido"; w.rows.length === 0
```

### El corte name-match≠write (comportamiento a congelar con el guard)
```typescript
// Source: packages/dinero/src/reconciliar-contrato.ts:369-407 (rama determinista por nombre)
// if (rutMaestra != null && rutMaestra === rutNorm)  → cosechas.push(...)   [CORROBORA, escribe]
// else if (nombreGlobalUnico)                        → revisionesRut.push(...) + enqueueRevision  [COLA HUMANA, NO escribe]
// else (homónimo global)                             → enlace se mantiene, NO propone RUT
// El guard debe garantizar que revisionesRut NUNCA fluye a runBackfillRut/updateRut.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| "RUT-exacto, nunca por nombre" absoluto | Persona natural: nombre vía pipeline confirma el ENLACE, pero el RUT name-only va a cola humana (CR-01, "finalidad del dato") | Retrofit aprobado por operador (v2.0+) | El name-match confirma fiscalización, jamás la propiedad RUT↔persona. Persona jurídica sigue RUT-exacto-only. |
| RUT como columna en tabla pública | RUT en tabla/columna deny-by-default; filas públicas solo con FK `parlamentario_id` | 0018_piso_pii convención | Minimización Ley 21.719; el RUT nunca a anon. |

**Deprecated/outdated:**
- La nota en `deterministic.ts:94-97` dice que `isRutValido` está "diferido para Fase 4" en el matcher — eso es sobre `matchDeterminista`, NO sobre el backfill. En el backfill (`aceptarRutBackfill`) `isRutValido` SÍ está cableado y activo. No confundir.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | La maestra bloqueante para "TODO cruce de dinero" que esta fase debe medir es `parlamentario` (donde escribe `backfill-rut`) Y/O `entidad_tercero`. RUT-01 nombra `entidad_tercero`; el código principal escribe `parlamentario.rut`. | Phase Requirements / Pitfall 4 / Open Q1 | Medir la tabla equivocada da N/M engañoso; el planner debe fijar cuál(es). |
| A2 | El guard name-match≠write se implementa como test de vitest en `app/` (donde viven lockdown/anti-insinuacion). Alternativa: en `packages/dinero` como test de invariante. | Architecture Pattern 1 | Ubicación afecta qué corre en qué suite; bajo riesgo (ambas corren en `pnpm test`). |
| A3 | La escritura remota usa `db-url` (MEMORY confirma `db push --db-url`); el .env HOY no tiene DB password apto para push remoto (writer-supabase.ts docstring). El operador provee la credencial en el runbook. | Runtime State / Environment | Si el operador no tiene credencial de write remoto, el checkpoint queda bloqueado (esperado — es su acto). |
| A4 | La señal de cobertura RUT va en `pnpm freshness` (append, no reemplaza VOTO/BUSQ). | Architecture Pattern 2 | Bajo riesgo; es el patrón establecido. |

## Open Questions

1. **¿Qué maestra mide la cobertura RUT-01: `parlamentario`, `entidad_tercero`, o ambas?**
   - What we know: RUT-01 (REQUIREMENTS.md:22) nombra explícitamente `entidad_tercero`. Pero el mecanismo principal de backfill (`backfill-rut.ts` + `parlamentario-rut.seed.json`) escribe `parlamentario.rut`. La cosecha de contrato corrobora `parlamentario.rut`; la resolución de proveedor puebla `entidad_tercero` vía `backfill-entidad-cli`. Ambas tienen RLS deny-by-default.
   - What's unclear: Cuál es el denominador "bloqueante de TODO cruce de dinero" para ESTA fase.
   - Recommendation: Medir AMBAS señales (parlamentario confirmado con RUT + entidad_tercero juridica con RUT) en la tabla de cobertura, y que el runbook explicite que el cruce dinero necesita RUT en la maestra que el matcher de Phase 70/71 consulta. El planner debe confirmar con el CONTEXT ("entidad_tercero/parlamentario" aparecen juntos en el boundary línea 10) que ambas cuentan.

2. **¿El guard debe ser puramente estático (regex) o de comportamiento (test fail-closed)?**
   - What we know: El corte ya es estructural en `reconciliar-contrato.ts`. Un test de comportamiento (contrato name-only → 0 cosechas, 1 revisión) es más robusto que un regex.
   - What's unclear: Si el CONTEXT exige literalmente "un GUARD CI" estático estilo lockdown, o si un test de invariante de comportamiento satisface la regla.
   - Recommendation: Hacer AMBOS — (a) test de comportamiento fail-closed (robusto ante renombres) + (b) guard estático ligero (ningún import de `runBackfillRut`/`updateRut` recibe `revisionesRut`), con mutation self-check. Cubre la letra ("guard CI") y el espíritu (fail-closed real).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `vitest` | Guard CI + tests de mecanismo/cobertura | ✓ (en el monorepo) | workspace | — |
| `psql` | `queryCoberturaRut` (read-only counts, como VOTO) | ✓ (usado por `pnpm freshness` hoy) | — | Degrada a `n/d` si falta (patrón query-runner) |
| Supabase LOCAL (docker) | Ejercitar `updateRut` con writer real (opcional; el agente usa espía) | Depende de la máquina | — | `SpyRutWriter` in-memory (offline) — es lo que el agente usa |
| Supabase REMOTO (`db-url`) | Escritura remota real | ⛔ solo operador | — | **CHECKPOINT OPERADOR** — no fallback; es su acto por diseño |
| RUTs reales curados (seed Track B) | Poblar `filas: []` | ✗ (no en el repo; PII real) | — | Operador provee; NUNCA fabricar placeholders |

**Missing dependencies with no fallback:**
- Credencial de write remoto + RUTs reales — ambos son del OPERADOR (checkpoint). El agente NO los necesita para entregar mecanismo + guard + cobertura + runbook.

**Missing dependencies with fallback:**
- Supabase LOCAL: el agente valida todo offline con `SpyRutWriter`; no requiere DB.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (workspace) |
| Config file | `app/vitest.config.ts` (guards de app) + configs por paquete (`packages/*/vitest.config.ts` o root) |
| Quick run command | `pnpm --filter @obs/identity test && pnpm --filter @obs/dinero test` |
| Full suite command | `pnpm test` (app 758+ tests hoy; incluye lockdown/anti-insinuacion guards) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RUT-01 | DV inválido → rechazado, nunca escrito | unit | `pnpm --filter @obs/identity test -- backfill-rut` | ✅ (`backfill-rut.test.ts`) |
| RUT-01 | provenance faltante → rechazado | unit | `pnpm --filter @obs/identity test -- backfill-rut` | ✅ |
| RUT-01 | idempotencia (2 corridas = mismas escrituras) | unit | `pnpm --filter @obs/identity test -- backfill-rut` | ✅ |
| RUT-01 | cosecha corrobora RUT presente; name-only → cola humana | unit | `pnpm --filter @obs/dinero test -- reconciliar-contrato` | ✅ (verificar cobertura del caso CR-01) |
| RUT-01 | harvest DV-inválido/provenance → rechazado con writer espía | unit | `pnpm --filter @obs/dinero test -- harvest-rut` | ✅ (`harvest-rut.test.ts`) |
| RUT-01 | **name-match NUNCA escribe rut** (guard) | guard/invariant | `pnpm --filter app test -- name-match-rut-guard` | ❌ Wave 0 |
| RUT-01 | guard MUERDE ante violación sintética (mutation self-check) | guard | ídem | ❌ Wave 0 |
| RUT-01 | **cobertura N/M RUT** degrada honesto (null no 0) | unit | `pnpm --filter @obs/freshness test -- evaluate` | ⚠️ parcial (`evaluate.test.ts` cubre `evaluateCobertura`; falta caso RUT) |
| RUT-01 | RUT nunca a LLM | unit | `pnpm --filter @obs/llm test -- data-routing` | ✅ (`data-routing.test.ts`) |
| RUT-01 | `rut` no proyectado en superficie pública | guard | `pnpm --filter app test -- lockdown-guard` | ✅ (guard B ya cubre `rut`) |

### Sampling Rate
- **Per task commit:** `pnpm --filter @obs/identity test && pnpm --filter @obs/dinero test && pnpm --filter @obs/freshness test`
- **Per wave merge:** `pnpm --filter app test` (incluye guards)
- **Phase gate:** `pnpm test` verde antes de `/gsd:verify-work`; luego handoff del runbook al operador.

### Wave 0 Gaps
- [ ] `app/lib/name-match-rut-guard.test.ts` — guard name-match≠write-rut + mutation self-check (cubre RUT-01 corte estructural)
- [ ] `packages/freshness/src/catalog.ts` — `COBERTURA_RUT_SENALES` (nuevo array)
- [ ] `packages/freshness/src/query-runner.ts` — `queryCoberturaRut`
- [ ] `packages/freshness/src/cli.ts` — `renderCoberturaRut` + append a la salida
- [ ] `packages/freshness/src/evaluate.test.ts` — caso de cobertura RUT (degradación null/M=0)
- [ ] `.planning/phases/69-.../69-BACKFILL-RUT-RUNBOOK.md` — runbook operador (espejo 66/67)

*(El mecanismo core, el gate DV, el canal corroboración/revisión y el gate LLM ya tienen cobertura de tests existente — no son gaps.)*

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | El backfill corre con service_role (worker/CI), no hay auth de usuario en este path. |
| V3 Session Management | no | Sin sesión de usuario. |
| V4 Access Control | **yes** | RLS deny-by-default sobre `parlamentario.rut`/`entidad_tercero.rut` (0005/0018/0034). anon NUNCA lee el RUT. service_role bypassa RLS → guard B de lockdown escanea `app/` por `.from('parlamentario')`/`.from('entidad_tercero')`. |
| V5 Input Validation | **yes** | DV módulo-11 (`isRutValido`) valida el RUT antes de escribir; provenance NOT NULL. SQL de cobertura 100% estática (sin interpolación de input — como VOTO T-68-03). |
| V6 Cryptography | no | Sin cripto nueva. (El RUT NO se hashea; es identificador interno, minimización por RLS.) |
| V8 Data Protection (privacy) | **yes** | Minimización Ley 21.719: RUT es PII interna, nunca a tabla/ruta pública, nunca al LLM (`assertNoRutInLlmInput`), nunca en el jsonb de `revision_entidad` (el RUT viaja fuera del prompt/cola). |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Name-match escribe un RUT ajeno (difamación / vínculo falso, riesgo #1) | Tampering / Spoofing | Corte estructural CR-01 (`reconciliar-contrato.ts`): name-only → cola humana, jamás al writer. Guard CI a construir. |
| RUT filtrado a anon / ruta pública | Information Disclosure | RLS deny-by-default + revoke + guard B lockdown (escanea `.from(PII_TABLE)` y proyección `rut` en `supabase.ts`). |
| RUT enviado a un LLM (data exfil vía prompt) | Information Disclosure | `assertNoRutInLlmInput` fail-closed antes de todo `complete()`; el RUT nunca entra a `correrPipeline`. |
| RUT fabricado / DV falso escrito a la maestra | Tampering | `isRutValido` (módulo-11) rechaza DV inválido a `rechazadas["dv-invalido"]`; provenance NOT NULL rechaza sin fuente. NUNCA se fabrica. |
| SQL injection en la query de cobertura | Tampering | SQL estática sin interpolación de input (patrón VOTO); `psql` vía `execFileSync` (argv separado, sin shell, dbUrl no re-citada). |
| dbUrl/password en logs | Information Disclosure | query-runner nunca imprime dbUrl/password (solo `err.code`); el writer remoto lo maneja el operador fuera de CI. |

## Sources

### Primary (HIGH confidence — código verificado en el repo, sesión 2026-07-14)
- `packages/identity/src/deterministic.ts:52,63` — `normRut`, `isRutValido` (DV módulo-11) — [VERIFIED: codebase]
- `packages/identity/src/backfill-rut.ts` — `aceptarRutBackfill`, `runBackfillRut`, `RutBackfillWriter` — [VERIFIED: codebase]
- `packages/identity/src/backfill-rut.test.ts` — tests DV gate + provenance + idempotencia — [VERIFIED: codebase]
- `packages/identity/src/writer-supabase.ts:52,121` — `SupabaseMaestraWriter.updateRut` (local; remoto = operador) — [VERIFIED: codebase]
- `packages/dinero/src/harvest-rut.ts` — `runHarvestRut`, `construirFilasCosecha` — [VERIFIED: codebase]
- `packages/dinero/src/harvest-rut.test.ts` — tests writer espía — [VERIFIED: codebase]
- `packages/dinero/src/reconciliar-contrato.ts:254,369-407` — canal corroboración (`cosechas`) vs revisión (`revisionesRut` + `enqueueRevision`) — [VERIFIED: codebase]
- `packages/llm/src/data-routing.ts:52` — `assertNoRutInLlmInput` — [VERIFIED: codebase]
- `supabase/migrations/0005_parlamentario.sql:30,63` — `rut` NULLABLE + RLS deny-by-default — [VERIFIED: codebase]
- `supabase/migrations/0018_piso_pii.sql:74` — re-afirma `parlamentario` RLS tras backfill de RUT — [VERIFIED: codebase]
- `supabase/migrations/0034_entidad_tercero.sql:39,72,80` — `entidad_tercero.rut` + RLS + revoke — [VERIFIED: codebase]
- `supabase/seeds/parlamentario-rut.seed.json` — Track B, `filas: []` (0 filas) — [VERIFIED: codebase]
- `app/lib/lockdown-guard.test.ts` — plantilla de guard CI (PII_TABLES incluye `parlamentario`/`entidad_tercero`; PII_COLUMNS incluye `rut`) — [VERIFIED: codebase]
- `packages/freshness/src/catalog.ts:107` (`COBERTURA_VOTO_SENALES`), `evaluate.ts:98` (`evaluateCobertura`), `query-runner.ts:169` (`queryCoberturaVoto`), `cli.ts:163` (`renderCoberturaVoto`) — patrón de cobertura N/M a espejar — [VERIFIED: codebase]
- `packages/identity/src/seed-cli.ts`, `packages/identity/src/backfill-entidad-cli.ts` — patrones de CLI de operador (LOCAL, .env BOM-safe) — [VERIFIED: codebase]
- `.planning/config.json` — `security_enforcement: true`, `nyquist_validation: true` — [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- `MEMORY.md` (v7 arrancado, env-credentials-reality) — write remoto vía `db push --db-url`; identidad maestra fuera de Supabase — [CITED: project memory]
- `.planning/STATE.md` — RUT-01 checkpoint operador, Candado A/B service_role + PII guard, patrón de runbook 66/67 — [CITED: project state]

### Tertiary (LOW confidence)
- Ninguna. Todo se verificó contra el código o docs del proyecto; sin claims de WebSearch.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — cada pieza verificada en el código (paths + líneas).
- Architecture: HIGH — el flujo corroboración/revisión está documentado en el código y testeado.
- Pitfalls: HIGH — derivados de lecciones concretas del repo (WR-05 stripTsComments, falso positivo de build, dos maestras con `rut`).
- Guard/cobertura gaps: HIGH — el patrón a espejar (lockdown, VOTO-05) está en el repo; solo falta instanciarlo para RUT.

**Research date:** 2026-07-14
**Valid until:** ~30 días (código estable; el único cambio esperado es la decisión del planner sobre qué maestra mide la cobertura, Open Question 1).

## RESEARCH COMPLETE

**Phase:** 69 - DINERO P5a — RUT-01 backfill a la maestra (CHECKPOINT OPERADOR)
**Confidence:** HIGH

### Key Findings
- El mecanismo completo YA EXISTE y está testeado: `isRutValido` (DV módulo-11), `runBackfillRut`/`aceptarRutBackfill` (DV-gate + provenance NOT NULL + fail-closed), `runHarvestRut`, `SupabaseMaestraWriter.updateRut`. NO reconstruir nada.
- El corte "name-match NUNCA escribe RUT" ya es ESTRUCTURAL en `reconciliar-contrato.ts` (canal `cosechas`/corroboración vs `revisionesRut`/cola humana). El gap es un GUARD CI que lo congele + mutation self-check.
- El RUT ya está protegido: RLS deny-by-default (0005/0018/0034), guard B de lockdown escanea `app/` por `rut`/tablas PII, `assertNoRutInLlmInput` fail-closed. NO agregar `rut` a ninguna proyección/RPC público.
- Los 3 gaps reales a planificar: (1) guard CI name-match≠write-rut; (2) señal de cobertura N/M de RUT en `pnpm freshness` (espejo VOTO-05); (3) runbook operador para la escritura remota (espejo 66/67).
- Estado del DATO hoy: seed `filas: []`, `rut` mayormente vacío → cobertura real ≈ 0/M. La fase entrega mecanismo + medición honesta; el operador puebla el dato y corre el write remoto (checkpoint). El agente NO ejecuta la escritura remota.

### File Created
`.planning/phases/69-dinero-p5a-rut-01-backfill-a-la-maestra-checkpoint-operador/69-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Cada pieza verificada con path+línea en el repo |
| Architecture | HIGH | Flujo corroboración/revisión documentado y testeado en código |
| Pitfalls | HIGH | Derivados de lecciones concretas del repo |

### Open Questions
1. ¿Qué maestra mide la cobertura RUT-01: `parlamentario`, `entidad_tercero`, o ambas? RUT-01 nombra `entidad_tercero`; el backfill principal escribe `parlamentario.rut`. Recomendación: medir ambas. (Assumption A1)
2. ¿Guard estático (regex) o de comportamiento (test fail-closed)? Recomendación: ambos, con mutation self-check. (Assumption A2)

### Ready for Planning
Research complete. El planner debe: reusar el mecanismo existente sin reconstruirlo; planificar guard CI + señal de cobertura + runbook; NO planificar la escritura remota como task del agente (checkpoint operador); resolver Open Question 1 (qué maestra medir) contra el CONTEXT/operador.
