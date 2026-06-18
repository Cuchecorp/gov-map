# Phase 4: Adjudicación de Identidad + Compuerta Humana + Golden Set - Research

**Researched:** 2026-06-18
**Domain:** Reconciliación de identidad asistida por LLM (entity resolution) con compuerta fail-closed, cola de revisión humana en Postgres, audit log inmutable, y golden set como gate de deploy
**Confidence:** HIGH (toda la pila aguas arriba — `@obs/llm`, `@obs/identity`, migraciones/RLS/pgTAP — está implementada y verificada en el repo; el único elemento externo nuevo es el patrón de tabla append-only en Postgres, confirmado vía docs oficiales)

## Summary

Esta fase NO introduce librerías nuevas. Es un subsistema de **composición**: consume `MiniMaxProvider` + `parseAndValidate` + `assertNoRutInLlmInput`/`assertSensitivityAllowed` (Fase 2, `@obs/llm`) y `normalizarNombre` + `matchDeterminista` + el tipo `Parlamentario` (Fase 3, `@obs/identity`/`@obs/core`), y los encadena en un pipeline de 4 etapas: blocking → adjudicación LLM → compuerta → cola humana, con auditoría inmutable de cada decisión. El riesgo del producto no es técnico (la pila ya existe) sino **de diseño de la compuerta**: un solo `>=` mal puesto convierte un falso positivo en una afirmación falsa creíble (riesgo existencial #1).

La estrategia ganadora es la que ya estableció Fase 3: **lógica pura, fail-closed, unit-testable**. La generación de candidatos (blocking), la compuerta (gate), y la evaluación del golden set son todas funciones puras sobre datos en memoria — sin red, sin DB, deterministas. El LLM se aísla detrás del contrato `LLMProvider` y se mockea en los tests (la pila de Fase 2 ya prueba este patrón con `makeMockFetch`). La persistencia (`revision_identidad` + audit append-only) es una migración 0006 que espeja exactamente el patrón de 0005 (provenance inline, RLS deny-by-default, pgTAP), con un único elemento nuevo: enforcement de inmutabilidad vía `REVOKE update/delete` + trigger `RAISE EXCEPTION`.

**Primary recommendation:** Construir un nuevo paquete `@obs/adjudication` (o ampliar `@obs/identity`) con tres funciones puras separadas — `generarCandidatos(mention, maestra)`, `construirPromptAdjudicacion(...)` + `AdjudicacionSchema` (zod), y `aplicarCompuerta(salidaLLM, mention, candidatos)` — cada una unit-testable de forma aislada. La compuerta es el corazón crítico y se prueba EXHAUSTIVAMENTE contra el golden set. El audit log es append-only enforced a nivel DB (revoke + trigger), no por convención de aplicación. El golden set corre en vitest con LLM mockeado (determinista, gate de CI) y un modo LIVE opcional gated por env (`LLM_SMOKE`/nuevo flag) para medir precisión real de MiniMax-M3.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Generación de candidatos (blocking) | Lógica pura (`@obs/adjudication`) | — | Filtra la maestra en memoria por apellido+cámara+periodo+región; sin red/DB. Reusa `normalizarNombre`. Unit-testable. |
| Construcción del prompt + schema | Lógica pura (`@obs/adjudication`) | — | El prompt es una función de (mención, candidatos); el schema zod es estático. No toca red. |
| Adjudicación LLM (la call) | API/Backend (`@obs/llm` `MiniMaxProvider`) | — | La única operación con red; aislada tras el contrato `LLMProvider`. Mockeable. |
| Compuerta de validación (gate) | Lógica pura (`@obs/adjudication`) | — | Reglas duras del umbral 0.90 asimétrico. El corazón fail-closed. 100% unit-testable. |
| Cola de revisión humana | Database/Storage (migración 0006 `revision_identidad`) | API/Backend (CLI) | Estado durable en Postgres; el CLI lee/escribe vía service role. |
| Audit log inmutable | Database/Storage (migración 0006, append-only) | — | Inmutabilidad enforced a nivel DB (revoke+trigger), no en aplicación. |
| Reviewer CLI | API/Backend (`@obs/identity` o `@obs/adjudication` CLI) | Database/Storage | Espeja el patrón `seed-cli.ts` de Fase 3; escribe estado + audit vía service role. |
| Golden set / eval | Lógica pura + test harness (vitest) | API/Backend (modo LIVE gated) | El eval corre el pipeline con LLM mockeado (CI) o LIVE (gated). Mide precisión/recall. |

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Umbral, adjudicación LLM, revisión humana y golden set:**

- **Umbral de confianza = 0.90, asimétrico (preferir falso negativo):** la compuerta enruta a revisión humana todo `decision=match` con `confidence < 0.90`, **o** con `conflicts` no vacío, **o** inconsistencia de cámara/periodo, **o** `decision=uncertain`. **Nada bajo el umbral se auto-acepta.** Ante duda, no confirmar.
- **Adjudicación LLM = MiniMax-M3** (modelo crítico) vía `@obs/llm` (`LLMProvider`, tool calling forzado, temp baja). Una call por registro dudoso. Pipeline:
  - **Etapa 0** (ya en Fase 3): atajo determinista — RUT exacto / nombre normalizado único en (cámara,periodo) → confirmado sin LLM.
  - **Etapa 1 — candidatos por blocking:** apellido + cámara + periodo + región (reusa `normalizarNombre`/tokens de Fase 3) → lista corta de candidatos de la maestra.
  - **Etapa 2 — adjudicación LLM:** se pasa el registro foráneo + candidatos; el modelo devuelve JSON validado con zod contra el schema:
    `{ "decision": "match|no_match|uncertain", "chosen_id": "P00123|null", "confidence": 0.0-1.0, "evidence": [...], "conflicts": [...] }`.
  - **Etapa 3 — compuerta automática:** aplica las reglas duras del umbral; enruta a revisión humana o auto-acepta (solo si supera todo).
  - El RUT/dato personal NUNCA se envía al LLM (al modelo solo van nombres, cámara, periodo, región, candidatos — minimización por diseño; data-routing de Fase 2 aplica).
- **Revisión humana = cola en Postgres + CLI de revisor** (ID-05): tabla `revision_identidad` (registro foráneo, candidatos, salida del modelo, estado); un CLI permite confirmar/rechazar/corregir, registrando `revisor_id` + timestamp. UI web rica diferida a Fase 5+ (aquí basta CLI + cola).
- **Audit log inmutable (ID-08):** cada match guarda procedencia: `metodo` (determinista|llm|humano), `confidence`, `timestamp`, `modelo_version`, `revisor_id` (si aplica). Append-only (sin update/delete; RLS deny-by-default; trigger o tabla append-only).
- **Estados (ID-06):** cada vínculo nombre→id es `confirmado`/`probable`/`no_confirmado`. **Solo `confirmado` se muestra como hecho en la capa pública**; `probable`/`no_confirmado` nunca como hecho sin marca visible (la capa pública es Fase 5+, pero el modelo de estado + la garantía se fijan aquí).
- **Golden set (ID-07):** conjunto etiquetado de casos difíciles (homónimos, nombres de casada, abreviaturas tipo "Walker P., Matías", cambios de grafía) con su match correcto. Corre como **test de regresión** en cada cambio de prompt/modelo/lógica. Trackea precisión/recall. **Si la precisión baja del umbral, bloquea el deploy** (test que falla / gate en CI).

### Claude's Discretion

- Esquema fino de las tablas (`revision_identidad`, `match_audit`/`identidad_log`), prompt exacto del adjudicador, valor del umbral de precisión del golden set (sugerido alto, p.ej. ≥0.95 en el set), tamaño inicial del golden set, y forma del CLI quedan a discreción del planner respetando lo anterior.
- La adjudicación LLM se testea con mock (sin red/cuota) + un smoke LIVE opcional gated por env contra el golden set para medir precisión real de MiniMax-M3.

### Deferred Ideas (OUT OF SCOPE)

- UI web de revisión humana → Fase 5+ (aquí CLI + cola).
- Conectores que generan los registros foráneos (votaciones/tramitación/lobby) → Fase 5+.
- Adjudicación live a escala (cuota MiniMax) → se ejercita contra el golden set; el volumen real llega con los conectores.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ID-03 | Para matches dudosos, generar candidatos por blocking (apellido + cámara + periodo + región) y adjudicar con LLM (MiniMax) devolviendo decisión/confianza/evidencia/conflictos en JSON validado | `generarCandidatos()` (Don't Hand-Roll: reusa `normalizarNombre`/tokens); `AdjudicacionSchema` zod + `MiniMaxProvider.complete(req, AdjudicacionSchema)` (tool-calling forzado de Fase 2). Ver "Pattern 1" + "Pattern 2". |
| ID-04 | Una compuerta enruta a revisión humana todo match con confianza < umbral, con conflictos, o inconsistencia de cámara/periodo — nada bajo el umbral se auto-acepta | `aplicarCompuerta()` función pura fail-closed; reglas duras en "Pattern 3"; tabla de decisión + tests en "Validation Architecture". |
| ID-05 | Un revisor humano puede confirmar/rechazar/corregir un match, registrándose con revisor y timestamp | Reviewer CLI espejando `seed-cli.ts` de Fase 3; escribe `estado` + fila de audit. Ver "Pattern 5". |
| ID-06 | Cada vínculo nombre→id tiene estado `confirmado`/`probable`/`no_confirmado`, y solo `confirmado` se muestra como hecho en la capa pública | Reusa `EstadoIdentidad` (`@obs/core`) + columna `estado` de 0005; la garantía pública es de Fase 5+ pero el modelo se fija aquí. Tabla `vinculo_identidad` (o columna en `revision_identidad`). |
| ID-07 | Golden set de casos difíciles que bloquea el deploy si la precisión baja del umbral | Golden set como fixture vitest; eval con LLM mockeado (CI gate) + LIVE gated; umbral de precisión ≥0.95. Ver "Pattern 6" + "Validation Architecture". |
| ID-08 | Cada match guarda procedencia (método, confianza, timestamp, versión de modelo) para auditoría | Audit log append-only (migración 0006); inmutabilidad enforced por `REVOKE` + trigger `RAISE EXCEPTION`. Ver "Pattern 4" + "DB schema". |
</phase_requirements>

---

## Standard Stack

### Core (TODO ya en el repo — cero instalaciones nuevas)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@obs/llm` | workspace:* | `MiniMaxProvider` (tool-calling forzado, `trainsOnInputs=false`), `parseAndValidate` (compuerta zod única + repair loop), `assertNoRutInLlmInput`/`assertSensitivityAllowed` (data-routing) | Fase 2 lo dejó verificado (27 tests verdes). La adjudicación es un consumidor directo. [VERIFIED: codebase — packages/llm/src/providers/minimax.ts, data-routing.ts] |
| `@obs/identity` | workspace:* | `normalizarNombre`, `matchDeterminista`, `MaestraRow`/`Mention`/`Resolution`, patrón `seed-cli.ts` | Fuente de candidatos + precedente de CLI + normalización reusable. [VERIFIED: codebase — packages/identity/src/deterministic.ts, seed-cli.ts] |
| `@obs/core` | workspace:* | Tipos `Parlamentario`/`EstadoIdentidad`/`Camara`, zod schemas | Contrato puro consumible. `EstadoIdentidad` ya define `confirmado`/`probable`/`no_confirmado`. [VERIFIED: codebase — packages/core/src/parlamentario.ts] |
| `zod` | ^4.4.3 | `AdjudicacionSchema` (validación de salida del LLM) | Ya en el lockfile; `z.toJSONSchema` deriva el tool schema para MiniMax (lo hace `zodToToolSchema` de Fase 2). [VERIFIED: codebase] |
| `@supabase/supabase-js` | ^2.108.2 | Cliente DB para el CLI + writers (cola/audit) | Ya dependencia de `@obs/identity`. [VERIFIED: codebase — packages/identity/package.json] |
| Supabase Postgres (local) | 15+ | Migración 0006 (`revision_identidad` + audit append-only) | Patrón de 0005 establecido (provenance inline, RLS, pgTAP). [VERIFIED: codebase — supabase/migrations/0005] |
| `vitest` | ^3.0.0 | Tests unitarios + golden set como regresión | Framework del monorepo. [VERIFIED: codebase] |
| pgTAP | (Supabase test db) | Tests de la migración 0006 (columnas, check, RLS, inmutabilidad) | Patrón de `0004_parlamentario.test.sql`. [VERIFIED: codebase — supabase/tests/] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tsx` | ^4.22.4 | Runner del reviewer CLI (`tsx src/revisor-cli.ts`) | Ya devDep de `@obs/identity`; el `seed:live` script lo usa. [VERIFIED: codebase] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Trigger `RAISE EXCEPTION` + `REVOKE` para inmutabilidad | Solo `REVOKE update/delete` | `REVOKE` solo no protege contra el service role / superuser; el trigger añade defensa en profundidad (rechaza UPDATE/DELETE incluso desde un rol con grants). Recomendado: AMBOS. [CITED: postgresql.org/docs/current/plpgsql-trigger.html] |
| Trigger de inmutabilidad | Postgres `REVOKE` + RLS sin policy de UPDATE/DELETE | RLS sin policy bloquea anon, pero el writer usa service role (bypassa RLS). El trigger es la única defensa que aplica al service role. AMBOS: RLS para anon, trigger para todos. |
| Nuevo paquete `@obs/adjudication` | Ampliar `@obs/identity` | `@obs/identity` ya tiene la maestra + matcher; añadir adjudicación ahí mantiene cohesión (un subsistema de identidad). Nuevo paquete aísla la dependencia de `@obs/llm` del matcher puro. **Discreción del planner** — recomendación leve: nuevo paquete `@obs/adjudication` que depende de `@obs/identity` + `@obs/llm`, para que el matcher determinista NO arrastre la dependencia LLM. |
| Blocking en SQL (query a la maestra) | Blocking en memoria (filtrar array) | El matcher de Fase 3 ya opera sobre la maestra en memoria (`matchDeterminista(mention, maestra[])`). Para 186 parlamentarios reales, cargar la maestra en memoria y filtrar es trivial y mantiene la función pura/testeable. SQL solo si la maestra creciera a miles (no es el caso). **Recomendación: en memoria** (consistente con Fase 3). |

**Installation:**
```bash
# CERO instalaciones nuevas. Todo el stack está en el lockfile (Fases 1-3).
# Si se crea @obs/adjudication, espeja packages/identity/package.json:
#   deps: @obs/core, @obs/identity, @obs/llm, @supabase/supabase-js, zod
#   devDeps: @types/node, tsx, vitest
```

**Version verification:** No aplica registro externo — todas las deps son `workspace:*` o ya están fijadas en `pnpm-lock.yaml` por Fases 1-3 y verificadas allí. [VERIFIED: codebase — pnpm-lock.yaml, package.json de cada paquete]

## Package Legitimacy Audit

> Esta fase NO instala ningún paquete externo nuevo. Todas las dependencias son `workspace:*` internas o paquetes ya instalados y auditados en Fases 1-2 (`openai@6`, `@google/genai@2`, `zod@4`, `@supabase/supabase-js@2`, `vitest@3`, `tsx@4`, `fast-xml-parser@5`).

| Package | Registry | Disposition |
|---------|----------|-------------|
| `@obs/llm`, `@obs/identity`, `@obs/core` | workspace (interno) | Approved — código propio del monorepo |
| `zod@4`, `@supabase/supabase-js@2`, `vitest@3`, `tsx@4` | npm | Approved — ya instalados y auditados en Fases 1-2 (sin flags SLOP/SUS); SDKs/herramientas de primera mano |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck no se ejecutó porque no hay instalaciones nuevas; todos los paquetes ya pasaron el gate de legitimidad en sus fases de origen (ver 02-01-SUMMARY threat flag T-02-SC).*

## Architecture Patterns

### System Architecture Diagram

```
  Registro foráneo (mención)                     Tabla maestra `parlamentario`
  { nombreNormalizado, claveEstricta,            (186 reales, en memoria via
    camara, periodo, region,                      service role; SIN rut al pipeline)
    nombreOriginal, rut? }                                    │
         │                                                     │
         ▼                                                     ▼
  ┌──────────────────── ETAPA 0 (Fase 3): matchDeterminista ───────────────┐
  │  RUT exacto único / nombre único en (cámara,periodo) → confirmado       │
  │  ───────────────────────────────────────────────────────────────────── │
  │  estado=confirmado, metodo='determinista' ──────────────► AUDIT (append) │
  └────────────────────────────────┬───────────────────────────────────────┘
                                    │ no_confirmado (homónimo / sin-candidato)
                                    ▼
  ┌──────── ETAPA 1: generarCandidatos(mention, maestra)  [PURA] ───────────┐
  │  blocking: apellido(token paterno) + camara + periodo + region          │
  │  → lista corta de Parlamentario candidatos                              │
  └────────────────────────────────┬───────────────────────────────────────┘
                                    │ candidatos[]  (0..N; 0 → no_confirmado directo)
                                    ▼
  ┌──── ETAPA 2: adjudicación LLM  [RED — única operación con red] ──────────┐
  │  assertNoRutInLlmInput(prompt)  ◄── GATE: aborta si hay RUT             │
  │  assertSensitivityAllowed(personal, MiniMax)  ◄── trainsOnInputs=false   │
  │  construirPromptAdjudicacion(mention, candidatos)  [solo nombres/cám/per/reg]│
  │  MiniMaxProvider.complete(req, AdjudicacionSchema)  [tool-calling, temp baja]│
  │  → parseAndValidate → { decision, chosen_id, confidence, evidence, conflicts }│
  └────────────────────────────────┬───────────────────────────────────────┘
                                    │ salidaLLM (validada por zod)
                                    ▼
  ┌──────── ETAPA 3: aplicarCompuerta(salidaLLM, mention, candidatos) [PURA] ┐
  │  REGLAS DURAS (fail-closed, asimétrico):                                 │
  │   decision!=match                          → REVISIÓN                    │
  │   confidence < 0.90                         → REVISIÓN                    │
  │   conflicts.length > 0                      → REVISIÓN                    │
  │   chosen_id no está entre los candidatos    → REVISIÓN                    │
  │   cámara/periodo del candidato ≠ mención    → REVISIÓN                    │
  │   (todo lo anterior OK)                      → auto-aceptar (probable*)    │
  └──────────────┬────────────────────────────────────────┬─────────────────┘
                 │ REVISIÓN                                 │ auto-aceptar
                 ▼                                          ▼
  ┌─── cola Postgres `revision_identidad` ──┐   estado=probable, metodo='llm'
  │  estado='pendiente', candidatos,         │            │
  │  salida_modelo, modelo_version           │            ▼
  └──────────────┬──────────────────────────┘   AUDIT (append-only)
                 │  Reviewer CLI (service role)
                 ▼
  ┌─── revisor: confirmar / rechazar / corregir ───┐
  │  estado → confirmado|rechazado, chosen_id,      │
  │  revisor_id + timestamp ──────────────────────► AUDIT (metodo='humano')
  └─────────────────────────────────────────────────┘

  Capa pública (Fase 5+): SOLO vínculos con estado=confirmado se muestran como hecho.
```

> Nota sobre "auto-aceptar → probable": el CONTEXT define el umbral asimétrico. Un `match` que supera TODAS las reglas duras puede auto-aceptarse, pero la garantía de ID-06 es que **solo `confirmado` es público**. Discreción del planner: o (a) auto-aceptar a `probable` y exigir confirmación humana para llegar a `confirmado` (más conservador, recomendado para sellar riesgo existencial #1), o (b) auto-aceptar directo a `confirmado` solo cuando el LLM supera el umbral con margen. **Recomendación HIGH: opción (a)** — el LLM nunca escribe `confirmado` directo; `confirmado` requiere humano O determinista. Esto hace literal "nada bajo el umbral se auto-acepta [como hecho público]".

### Recommended Project Structure
```
packages/adjudication/          # nuevo paquete (o dentro de @obs/identity)
├── src/
│   ├── candidatos.ts           # generarCandidatos() PURA (blocking)
│   ├── candidatos.test.ts
│   ├── prompt.ts               # construirPromptAdjudicacion() + AdjudicacionSchema (zod)
│   ├── prompt.test.ts          # asserts: schema válido, prompt sin RUT, español
│   ├── compuerta.ts            # aplicarCompuerta() PURA fail-closed (el corazón)
│   ├── compuerta.test.ts       # tabla de decisión exhaustiva
│   ├── pipeline.ts             # orquesta etapas 0-3 (consume @obs/llm)
│   ├── pipeline.test.ts        # e2e con MiniMax mockeado (makeMockFetch)
│   ├── revisor-cli.ts          # CLI: list/show/confirm/reject/correct (espeja seed-cli.ts)
│   ├── revisor-cli.test.ts
│   ├── writer-revision.ts      # escribe revision_identidad + audit (Supabase)
│   ├── golden/
│   │   ├── golden-set.ts       # casos etiquetados (fixture, incluye "Walker P., Matías")
│   │   └── golden-set.test.ts  # eval: mockeado (CI gate) + LIVE gated por env
│   └── index.ts                # barrel
supabase/migrations/0006_revision_identidad.sql
supabase/tests/0005_revision_identidad.test.sql   # pgTAP
```

### Pattern 1: Blocking (generación de candidatos) — función pura
**What:** Filtrar la maestra en memoria por (token apellido paterno) + cámara + periodo + región, devolviendo una lista corta de candidatos. Reusa `normalizarNombre` para extraer el token de apellido.
**When to use:** Etapa 1, solo para menciones que `matchDeterminista` dejó en `no_confirmado`.
**Example:**
```typescript
// Source: derivado del patrón puro de matchDeterminista (packages/identity/src/deterministic.ts)
import type { Parlamentario } from "@obs/core";
import { normalizarNombre } from "@obs/core"; // o @obs/identity barrel

export interface MencionForanea {
  nombreOriginal: string;       // "Walker P., Matías" (display, va al prompt)
  nombreNormalizado: string;    // de normalizarNombre (clave)
  tokens: string[];             // tokens de normalizarNombre (apellido paterno = tokens[0] del paterno)
  camara: Parlamentario["camara"];
  periodo: string;
  region: string | null;
  // SIN rut aquí: el rut se cruza en Etapa 0 (determinista), nunca llega al blocking/LLM.
}

export function generarCandidatos(
  m: MencionForanea,
  maestra: Parlamentario[],
): Parlamentario[] {
  return maestra.filter((p) => {
    if (p.camara !== m.camara) return false;
    if (p.periodo !== m.periodo) return false;
    // región como filtro BLANDO: si la mención no trae región, no filtra por región
    // (fail-OPEN en blocking — preferimos sobre-incluir candidatos y dejar que el
    //  LLM + compuerta decidan; perder un candidato real sería un falso negativo
    //  que el blocking no debe causar).
    if (m.region != null && p.region != null && p.region !== m.region) return false;
    // apellido paterno compartido (token): el puente entre grafías ("Walker P." vs "Walker Prieto")
    const apellidoMencion = m.tokens[0];
    return p.nombre_normalizado.split(" ").includes(apellidoMencion);
  });
}
```
**Confidence:** HIGH — espeja la lógica de filtrado pura de `matchDeterminista`; el exacto criterio de token (apellido paterno vs todos los apellidos) es discreción del planner, pero el blocking debe ser **fail-open** (preferir sobre-incluir).

### Pattern 2: Adjudicación LLM (consumo de `@obs/llm`) + schema zod
**What:** Construir el prompt en español, temperatura baja, pasar por las compuertas de data-routing, y llamar a `MiniMaxProvider.complete(req, AdjudicacionSchema)`.
**When to use:** Etapa 2, solo cuando hay ≥1 candidato.
**Example:**
```typescript
// Source: consumo del contrato de packages/llm/src/types.ts + data-routing.ts
import { z } from "zod";
import { assertNoRutInLlmInput, assertSensitivityAllowed } from "@obs/llm";

export const AdjudicacionSchema = z.object({
  decision: z.enum(["match", "no_match", "uncertain"]),
  chosen_id: z.string().regex(/^P\d{5}$/).nullable(), // formato P00123, o null
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string().max(500)).max(10),
  conflicts: z.array(z.string().max(500)).max(10),
})
// invariante cruzado: si decision=match, chosen_id NO puede ser null (la compuerta también lo verifica)
.refine((o) => o.decision !== "match" || o.chosen_id != null, {
  message: "decision=match requiere chosen_id no nulo",
});
export type Adjudicacion = z.infer<typeof AdjudicacionSchema>;

// Prompt (español, restrictivo, sin causalidad — riesgo existencial #2):
const SYSTEM = `Eres un asistente de reconciliación de identidad de parlamentarios chilenos.
Tu única tarea es decidir si un REGISTRO (un nombre como aparece en una fuente) corresponde
a UNO de los CANDIDATOS de la tabla maestra, basándote SOLO en nombre, cámara, periodo y región.
Reglas estrictas:
- Solo puedes elegir un chosen_id de la lista de candidatos provista, o null.
- Si hay cualquier ambigüedad (homónimo, nombre de casada, abreviatura que no resuelve
  unívocamente), responde decision="uncertain".
- Lista en "conflicts" cualquier inconsistencia (cámara/periodo distintos, dos candidatos igual de plausibles).
- En "evidence" cita SOLO coincidencias de nombre/cámara/periodo/región. NUNCA infieras
  intención, parentesco político, ni nada fuera de los datos provistos.
- NO inventes candidatos. NO uses conocimiento externo sobre estas personas.`;

async function adjudicar(provider, mencion, candidatos): Promise<Adjudicacion> {
  const userPrompt = construirPromptAdjudicacion(mencion, candidatos); // solo nombres/cám/per/reg
  assertNoRutInLlmInput(userPrompt);          // GATE: aborta si un RUT se coló (T-02-05)
  assertSensitivityAllowed({ sensitivity: "personal" }, provider); // MiniMax trainsOnInputs=false → OK
  return provider.complete(
    { system: SYSTEM, user: userPrompt, criticality: "critical", sensitivity: "personal" },
    AdjudicacionSchema,
  );
  // MiniMaxProvider usa tool-calling forzado + parseAndValidate (compuerta zod única, repair loop).
}
```
**Confidence:** HIGH — el contrato `complete(req, schema)` y las compuertas de data-routing están implementados y testeados en Fase 2. La call usa `criticality: "critical"` (→ MiniMax por el router) y `sensitivity: "personal"`.

> **Temperatura baja:** El contrato `CompletionRequest` actual NO expone `temperature`. El planner debe verificar si `MiniMaxProvider` permite fijar temp baja (idealmente 0) — si no, es una pequeña extensión del adapter de Fase 2 (añadir `temperature?` a `CompletionRequest` con default conservador). [ASSUMED] El adapter de Fase 2 no parametriza temperatura; revisar `packages/llm/src/providers/minimax.ts` durante el planning.

### Pattern 3: Compuerta fail-closed (el corazón crítico) — función pura
**What:** Aplicar las reglas duras del umbral 0.90 asimétrico sobre la salida del LLM. Devuelve `auto-aceptar` SOLO si TODAS las reglas pasan; cualquier fallo → `revisión`.
**When to use:** Etapa 3, siempre que haya salida LLM.
**Example:**
```typescript
// Source: derivado del patrón fail-closed de matchDeterminista (cada rama confirma solo con === 1)
const UMBRAL = 0.90;

export type DecisionCompuerta =
  | { ruta: "auto-aceptar"; chosenId: string }
  | { ruta: "revision"; razones: string[] };

export function aplicarCompuerta(
  llm: Adjudicacion,
  mencion: MencionForanea,
  candidatos: Parlamentario[],
): DecisionCompuerta {
  const razones: string[] = [];
  if (llm.decision !== "match") razones.push(`decision=${llm.decision}`);
  if (llm.confidence < UMBRAL) razones.push(`confidence ${llm.confidence} < ${UMBRAL}`);
  if (llm.conflicts.length > 0) razones.push("conflicts no vacío");
  const chosen = candidatos.find((c) => c.id === llm.chosen_id);
  if (llm.chosen_id == null || chosen == null) razones.push("chosen_id no es un candidato válido");
  else {
    if (chosen.camara !== mencion.camara) razones.push("inconsistencia de cámara");
    if (chosen.periodo !== mencion.periodo) razones.push("inconsistencia de periodo");
  }
  // FAIL-CLOSED: cualquier razón → revisión. Solo lista vacía auto-acepta.
  if (razones.length > 0) return { ruta: "revision", razones };
  return { ruta: "auto-aceptar", chosenId: llm.chosen_id! };
}
```
**Confidence:** HIGH — es lógica pura, determinista, y espeja exactamente el principio fail-closed de Fase 3 ("cada rama confirma solo con `=== 1`; cualquier ambigüedad degrada"). Esta es la función que el golden set ejercita más a fondo.

### Pattern 4: Audit log append-only (enforced a nivel DB)
**What:** Tabla de auditoría a la que solo se puede INSERT; UPDATE/DELETE rechazados por trigger + REVOKE.
**When to use:** Cada decisión (determinista, llm, humano) escribe una fila.
**Example:**
```sql
-- Source: postgresql.org/docs/current/plpgsql-trigger.html (RAISE EXCEPTION en trigger)
create table identidad_audit (
  id              bigint generated always as identity primary key,
  vinculo_id      bigint references vinculo_identidad(id),  -- o el registro foráneo
  metodo          text not null check (metodo in ('determinista','llm','humano')),
  decision        text not null,                            -- match|no_match|uncertain|confirmado|rechazado
  confidence      numeric,                                  -- null para determinista/humano
  modelo_version  text,                                     -- p.ej. 'MiniMax-M3' (null si no-LLM)
  revisor_id      text,                                     -- null salvo metodo='humano'
  evidence        jsonb not null default '[]'::jsonb,
  conflicts       jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now()
);

-- Inmutabilidad #1: trigger que rechaza UPDATE y DELETE (aplica incluso al service role).
create function identidad_audit_immutable() returns trigger as $$
begin
  raise exception 'identidad_audit es append-only: % no permitido', tg_op;
end;
$$ language plpgsql;

create trigger identidad_audit_no_update
  before update or delete on identidad_audit
  for each row execute function identidad_audit_immutable();

-- Inmutabilidad #2: REVOKE update/delete (defensa en profundidad).
revoke update, delete, truncate on identidad_audit from public;

-- RLS deny-by-default (espejo de 0005): anon nunca lee la auditoría.
alter table identidad_audit enable row level security;
```
**Confidence:** HIGH — patrón confirmado en docs oficiales de Postgres; el `REVOKE`+trigger combinado es defensa en profundidad estándar para audit trails. [CITED: postgresql.org/docs/current/plpgsql-trigger.html] [CITED: wiki.postgresql.org/wiki/Audit_trigger]

> **Por qué AMBOS (trigger + REVOKE):** El writer de la cola usa el service role, que **bypassa RLS** y normalmente tiene grants amplios. RLS protege a anon; pero solo el trigger rechaza un UPDATE/DELETE ejecutado por el service role. El `REVOKE` añade una segunda barrera. pgTAP debe verificar las tres: trigger existe, REVOKE aplicado, RLS habilitada.

### Pattern 5: Reviewer CLI (espeja `seed-cli.ts` de Fase 3)
**What:** CLI con subcomandos `list` (pendientes), `show <id>` (registro+candidatos+razonamiento del modelo), `confirm/reject/correct <id> --revisor <quien>`. Escribe `estado` + fila de audit (`metodo='humano'`).
**When to use:** Operación de revisión humana (ID-05).
**Example:**
```typescript
// Source: patrón de packages/identity/src/seed-cli.ts (run via `tsx`, service role, args parse)
// Subcomandos:
//   tsx src/revisor-cli.ts list
//   tsx src/revisor-cli.ts show 42
//   tsx src/revisor-cli.ts confirm 42 --revisor ana
//   tsx src/revisor-cli.ts reject  42 --revisor ana --motivo "homónimo no resuelto"
//   tsx src/revisor-cli.ts correct 42 --revisor ana --chosen-id P00077
// Cada acción de escritura:
//   1. UPDATE revision_identidad SET estado=..., revisor_id=..., resolved_at=now()
//   2. INSERT identidad_audit (metodo='humano', decision=..., revisor_id=..., created_at=now())
//   3. si confirm/correct: promueve el vínculo a estado='confirmado'
```
**Confidence:** HIGH — `seed-cli.ts` ya establece el patrón de CLI con `tsx` + service role en este paquete. La lógica de parsing/escritura es testeable con el cliente Supabase mockeado (como `writer-supabase.test.ts` de Fase 3).

### Pattern 6: Golden set como test de regresión + gate de deploy
**What:** Fixture de casos etiquetados (`{ mencion, maestra_relevante, expected: { decision, chosen_id } }`) que el eval corre por el pipeline. Mide precisión/recall. Test falla si precisión < umbral → bloquea CI/deploy.
**When to use:** ID-07. Corre en cada PR (CI) con LLM mockeado (determinista) + opcional LIVE.
**Example:**
```typescript
// Source: patrón smoke-gated de packages/llm/src/smoke.test.ts (LIVE ? describe : describe.skip)
import { describe, it, expect } from "vitest";
import { GOLDEN_SET } from "./golden-set"; // incluye "Walker P., Matías" + homónimos + casadas + abreviaturas

const LIVE = process.env.IDENTITY_GOLDEN_LIVE === "1";
const PRECISION_MIN = 0.95; // umbral de bloqueo (discreción: sugerido ≥0.95)

// MODO CI (default): LLM mockeado con respuestas deterministas POR CASO del golden set.
describe("golden set — regresión (LLM mockeado)", () => {
  it("precisión >= umbral sobre el golden set", async () => {
    const { precision, recall } = await evaluarGolden(GOLDEN_SET, mockProviderFromFixtures(GOLDEN_SET));
    expect(precision).toBeGreaterThanOrEqual(PRECISION_MIN); // ← FALLA = bloquea deploy
    expect(recall).toBeGreaterThanOrEqual(/* recall_min, discreción */ 0.80);
  });
});

// MODO LIVE (gated): mide precisión REAL de MiniMax-M3. Skip en CI.
(LIVE ? describe : describe.skip)("golden set — LIVE MiniMax-M3", () => {
  it.skipIf(!process.env.MINIMAX_API_KEY)("precisión real >= umbral", async () => {
    const { precision } = await evaluarGolden(GOLDEN_SET, realMiniMaxProvider());
    expect(precision).toBeGreaterThanOrEqual(PRECISION_MIN);
  });
});
```
**Confidence:** HIGH — el patrón LIVE-gated está implementado y verificado en `smoke.test.ts` de Fase 2 (`(LIVE ? describe : describe.skip)` + `it.skipIf`).

> **Cómo "mockear el LLM de forma determinista por caso":** el golden set asocia a cada caso la salida LLM esperada del modelo (o la salida que un modelo correcto DARÍA). El mock provider mapea `mencion → Adjudicacion` desde el fixture. Esto prueba la **compuerta + pipeline + eval** sin red. El modo LIVE prueba si MiniMax-M3 REALMENTE produce esas salidas. Separar ambos: el gate de CI no debe depender de la red ni de cuota MiniMax (Pitfall 7).

### Anti-Patterns to Avoid
- **Auto-aceptar `confirmado` desde el LLM:** el LLM nunca debe escribir `confirmado` directo. `confirmado` = determinista o humano. Auto-aceptar va a `probable` como máximo (recomendación HIGH).
- **Compuerta con `>` en vez de `<`:** un solo operador invertido convierte el umbral en su opuesto. La compuerta debe tener un test que verifique exactamente `confidence === 0.90 → revisión` (el límite es estricto: `< 0.90` enruta, `>= 0.90` pasa esa regla; verificar el borde).
- **Enviar el RUT o `nombreNormalizado`-con-RUT al prompt:** `assertNoRutInLlmInput` DEBE correr sobre el prompt final, no solo sobre campos sueltos. Es la última barrera (T-02-05).
- **Blocking fail-closed (perder candidatos):** si el blocking es demasiado estricto y descarta el candidato correcto, el LLM nunca lo verá → falso negativo silencioso. El blocking debe ser **fail-open** (sobre-incluir).
- **Audit mutable "por confianza":** confiar en que la aplicación nunca hace UPDATE no es suficiente. La inmutabilidad debe estar enforced en la DB (trigger + REVOKE), no por convención.
- **LLM que "explica" o conecta hechos:** el prompt prohíbe inferir parentesco/intención (riesgo existencial #2); `evidence` solo cita coincidencias de los datos provistos.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Normalización de nombres / tokens para blocking | Tu propio `slugify`/strip de acentos | `normalizarNombre` (`@obs/core`/`@obs/identity`) | Ya maneja NFD, ñ→n, partículas, convergencia catálogo↔votación, alias materno. Reinventarlo rompe la consistencia clave↔maestra. [VERIFIED: codebase] |
| Llamada al LLM + validación de salida | `fetch` a MiniMax + `JSON.parse` + checks manuales | `MiniMaxProvider.complete(req, schema)` | Tool-calling forzado + `parseAndValidate` (compuerta zod única + repair loop) + sin secretos en errores. [VERIFIED: codebase — minimax.ts, validate.ts] |
| Evitar RUT/PII al LLM | `if (texto.includes("-"))` casero | `assertNoRutInLlmInput` + `assertSensitivityAllowed` | Regex de RUT determinista probada + gate fail-closed compartido con el router. [VERIFIED: codebase — data-routing.ts] |
| Match determinista (Etapa 0) | Re-implementar la lógica de RUT/nombre único | `matchDeterminista` (`@obs/identity`) | Ya fail-closed, probado contra el invariante existencial #1. La adjudicación solo procesa su salida `no_confirmado`. [VERIFIED: codebase — deterministic.ts] |
| Inmutabilidad del audit log | Lógica de "no actualizar" en la app | Trigger Postgres `RAISE EXCEPTION` + `REVOKE` | La DB es el único punto que no se puede saltar; la app sí. [CITED: postgresql.org/docs] |
| CLI scaffolding (args, service role) | Parser de args desde cero | Patrón de `seed-cli.ts` | Precedente en el mismo paquete; `tsx` + Supabase service role ya resuelto. [VERIFIED: codebase — seed-cli.ts] |
| Tool schema desde zod (para MiniMax) | Escribir el JSON schema a mano | `zodToToolSchema` (`z.toJSONSchema`) | Una sola fuente de verdad (el zod); ya implementado en Fase 2. [VERIFIED: codebase — json-schema.ts] |

**Key insight:** Esta fase es 90% composición de piezas ya construidas y probadas. El único código verdaderamente nuevo y crítico es la **compuerta** (`aplicarCompuerta`, ~15 líneas puras) y el **enforcement de inmutabilidad en SQL**. Todo lo demás es cablear contratos existentes. El riesgo no está en lo nuevo sino en cablear mal el umbral.

## Runtime State Inventory

> Fase parcialmente greenfield (código nuevo) pero crea estado durable nuevo. No es rename/refactor, así que el inventario clásico de "old string cached" no aplica. Se documentan los datastores nuevos para que el planner los contemple.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Tablas NUEVAS: `revision_identidad` (cola), `identidad_audit` (append-only), posiblemente `vinculo_identidad` (estado por nombre→id). No hay datos previos que migrar — la maestra `parlamentario` (0005) ya existe y no se modifica. | Migración 0006 (DDL nuevo); ningún backfill. |
| Live service config | Ninguna. El subsistema corre en CI/local; no registra config en servicios externos. MiniMax se consume vía `@obs/llm` con keys de `.env` (ya establecido Fase 2). | None — verificado: el CLI y el pipeline usan service role + keys de env, sin estado externo. |
| OS-registered state | Ninguna. Sin tasks/daemons; el CLI es invocación manual (`tsx`). | None. |
| Secrets/env vars | Reusa `MINIMAX_API_KEY` (Fase 2) + `SUPABASE_*` service role (Fase 3). Nuevo flag opcional `IDENTITY_GOLDEN_LIVE=1` para el eval LIVE (solo gate de test, no secreto). | None nuevo — documentar el flag del eval LIVE. |
| Build artifacts | Si se crea `@obs/adjudication`, nuevo `package.json`/`tsconfig` en el workspace → `pnpm install` + referencia en `tsconfig.json` raíz + path en `tsconfig.base.json` (patrón de Fase 3). | Alta de paquete (espeja Fase 3) si se opta por paquete nuevo. |

## Common Pitfalls

### Pitfall 1: El umbral mal cableado (el operador invertido)
**What goes wrong:** `confidence > 0.90 → revisión` en vez de `< 0.90 → revisión`, o `>=` vs `>`. Convierte la compuerta en su opuesto: auto-acepta los dudosos.
**Why it happens:** El umbral asimétrico es contraintuitivo (preferir falso negativo); es fácil "optimizar" el sentido sin querer.
**How to avoid:** Test del borde EXACTO: `confidence === 0.90` debe pasar esa regla (`< 0.90` es estricto), `confidence === 0.8999` debe enrutar. Tabla de decisión exhaustiva en `compuerta.test.ts`.
**Warning signs:** Tasa de auto-aceptación >90% sobre el golden set (el CONTEXT/PITFALLS lo nombra como señal del umbral flojo).

### Pitfall 2: Blocking demasiado estricto descarta el candidato correcto
**What goes wrong:** El filtro de región/apellido excluye al verdadero match antes de que el LLM lo vea → falso negativo silencioso (queda `no_confirmado` para siempre, nadie lo revisa porque no entró a la cola con candidatos).
**Why it happens:** Tratar el blocking como una decisión, no como un pre-filtro.
**How to avoid:** Blocking **fail-open** — región es filtro blando (solo si ambos lados la traen); ante duda, incluir. El golden set debe tener un caso donde el blocking laxo es necesario (p.ej. región distinta entre fuentes).
**Warning signs:** Casos del golden set que salen `no_confirmado` con cola vacía (0 candidatos) cuando debería haber match.

### Pitfall 3: El RUT se cuela al prompt vía un campo compuesto
**What goes wrong:** El `nombreOriginal` o un campo de evidencia trae un RUT embebido y `assertNoRutInLlmInput` corre sobre el campo equivocado.
**Why it happens:** Validar campos sueltos en vez del prompt final ensamblado.
**How to avoid:** Correr `assertNoRutInLlmInput(promptFinal)` sobre el string EXACTO que va al `user` del request, justo antes de `provider.complete`. Test con una mención que (incorrectamente) trae RUT → debe lanzar `RutInLlmInputError` y NO llamar al provider (assert 0 fetch, como el e2e fail-closed de Fase 2).
**Warning signs:** Un test de "RUT en mención" que pasa sin verificar 0 llamadas al provider.

### Pitfall 4: Audit log mutable por el service role
**What goes wrong:** RLS deny-by-default protege a anon, pero el writer usa service role que bypassa RLS y tiene grants de UPDATE/DELETE → el audit no es realmente inmutable.
**Why it happens:** Asumir que RLS = inmutabilidad. RLS controla acceso por rol anon; no protege contra el service role.
**How to avoid:** Trigger `RAISE EXCEPTION` en UPDATE/DELETE (aplica a TODOS los roles) + `REVOKE update,delete`. pgTAP que intenta un UPDATE como service role y verifica `throws_ok`.
**Warning signs:** pgTAP de la migración solo verifica RLS, no la inmutabilidad real contra UPDATE.

### Pitfall 5: El golden set depende de la red (cuota MiniMax) en CI
**What goes wrong:** El gate de deploy llama a MiniMax real → consume la cuota crítica (45k/sem, Pitfall 7) en cada PR, y falla por 429/red en vez de por regresión.
**Why it happens:** No separar el modo mockeado (CI) del LIVE (manual).
**How to avoid:** CI corre SIEMPRE mockeado y determinista (gate de regresión de la lógica/compuerta/pipeline). LIVE gated por env, manual, mide la precisión real del modelo. Patrón `(LIVE ? describe : describe.skip)` de Fase 2.
**Warning signs:** El test del golden set requiere `MINIMAX_API_KEY` para pasar en CI.

## Code Examples

### Eval del golden set (precisión/recall)
```typescript
// Source: definición estándar de precisión/recall para entity resolution + patrón de fixtures
export interface CasoGolden {
  id: string;                          // "walker-p-matias"
  mencion: MencionForanea;             // "Walker P., Matías", senado, periodo, region
  maestraRelevante: Parlamentario[];   // subset de la maestra para el caso
  llmEsperado: Adjudicacion;           // respuesta que un modelo correcto DARÍA (para el mock)
  expected:                            // ground truth
    | { tipo: "match"; chosenId: string }
    | { tipo: "no_match" }             // no está en la maestra → debe quedar no_confirmado
    | { tipo: "revision" };            // ambiguo → debe enrutar a humano
}

export async function evaluarGolden(set: CasoGolden[], provider: LLMProvider) {
  let tp = 0, fp = 0, fn = 0;
  for (const caso of set) {
    const resultado = await correrPipeline(caso.mencion, caso.maestraRelevante, provider);
    // PRECISIÓN: de los que el sistema CONFIRMÓ/auto-aceptó, ¿cuántos eran correctos?
    // Un falso positivo (auto-aceptar un id equivocado) es el error EXISTENCIAL → pesa máximo.
    if (resultado.ruta === "auto-aceptar") {
      if (caso.expected.tipo === "match" && resultado.chosenId === caso.expected.chosenId) tp++;
      else fp++;  // auto-aceptó algo que NO debía → falso positivo (el error que mata el producto)
    } else {
      // enrutó a revisión / no_confirmado
      if (caso.expected.tipo === "match") fn++; // debió matchear y no lo hizo (falso negativo, tolerable)
    }
  }
  const precision = tp / (tp + fp || 1);
  const recall = tp / (tp + fn || 1);
  return { precision, recall, tp, fp, fn };
}
// REGRESIÓN: una caída de precisión (más fp) bloquea el deploy. Recall bajo es tolerable
// (falso negativo = trabajo humano); precisión baja es inaceptable (falso positivo = afirmación falsa).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fuzzy-match `similarity > 0.8 → match` automático | Determinista → LLM crítico → compuerta fail-closed → humano → golden set | Establecido por PITFALLS/CONTEXT del proyecto | El 5% de fuzzy-match equivocado es el riesgo existencial; la compuerta + golden set lo sellan |
| Audit por convención de aplicación | Append-only enforced en DB (trigger + REVOKE) | Patrón estándar Postgres | El service role no puede saltarse la inmutabilidad |
| `response_format: json_schema` para salida LLM | Tool-calling forzado + zod gate (MiniMax no soporta `response_format`) | Verificado en Fase 2 | Ya resuelto por `MiniMaxProvider`; la adjudicación lo hereda |

**Deprecated/outdated:**
- Cualquier mención de enviar RUT al LLM "para mejor desambiguación": prohibido por diseño (Ley 21.719, data-routing de Fase 2). El RUT solo cruza determinísticamente en Etapa 0.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `MiniMaxProvider`/`CompletionRequest` de Fase 2 NO expone `temperature`; fijar temp baja requiere una pequeña extensión del adapter | Pattern 2 | Bajo — el planner verifica `minimax.ts`; si ya la soporta, no hay trabajo; si no, es añadir un campo opcional al request |
| A2 | El criterio exacto de blocking (token apellido paterno vs todos los apellidos) es discreción; recomendación fail-open | Pattern 1 | Bajo — el golden set valida que el blocking no pierde candidatos reales |
| A3 | El umbral de precisión del golden set ≥0.95 y recall ≥0.80 son sugerencias (discreción del planner) | Pattern 6, Validation | Bajo — son parámetros del gate, ajustables; la asimetría (precisión > recall) es lo no negociable |
| A4 | Auto-aceptar va a `probable` (no `confirmado`); `confirmado` requiere humano o determinista | Architecture diagram | Medio — si el planner opta por auto-confirmar, debilita el sello del riesgo existencial #1. Recomendación HIGH: probable. |
| A5 | Tamaño inicial del golden set (sugerido ~20-40 casos cubriendo las 4 categorías) es discreción | Pattern 6 | Bajo — más casos = mejor regresión; el mínimo es cubrir homónimo, casada, abreviatura, grafía + "Walker P., Matías" |

## Open Questions

1. **¿`MiniMaxProvider` permite fijar `temperature` baja hoy?**
   - What we know: El contrato `CompletionRequest` (Fase 2) no lista `temperature`; el adapter usa defaults del SDK.
   - What's unclear: Si MiniMax vía OpenAI-compat acepta `temperature: 0` y si el adapter lo pasa.
   - Recommendation: El planner lee `packages/llm/src/providers/minimax.ts` en Task 1; si falta, añade `temperature?` opcional al request (cambio mínimo, retrocompatible).

2. **¿`@obs/adjudication` nuevo paquete o dentro de `@obs/identity`?**
   - What we know: `@obs/identity` ya tiene la maestra + matcher + CLI; `@obs/llm` es la dep nueva.
   - What's unclear: Si conviene que `@obs/identity` (matcher puro, sin LLM) arrastre `@obs/llm`.
   - Recommendation: Nuevo paquete `@obs/adjudication` que depende de ambos, para mantener el matcher determinista libre de la dependencia LLM. Discreción del planner.

3. **¿Modelo `vinculo_identidad` separado o estado en `revision_identidad`?**
   - What we know: ID-06 exige estado por vínculo nombre→id; `EstadoIdentidad` ya existe.
   - What's unclear: Si el vínculo confirmado vive en su propia tabla o como columna resuelta de `revision_identidad`.
   - Recommendation: Tabla `vinculo_identidad` (registro foráneo → parlamentario_id + estado) como producto final; `revision_identidad` es la cola de trabajo. Discreción del planner sobre normalización.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI (local) | Migración 0006 + pgTAP | Asumido (Fases 1-3 lo usan) | — | — |
| `pnpm` workspace | Paquete nuevo / tests | ✓ (lockfile presente) | — | — |
| `tsx` | Reviewer CLI + seed CLI | ✓ (devDep de @obs/identity) | ^4.22.4 | — |
| `MINIMAX_API_KEY` | Eval LIVE (opcional) | Solo para modo LIVE | — | CI corre mockeado; LIVE skip sin la key |
| Red a `api.minimax.io` | Eval LIVE (opcional) | Solo modo LIVE | — | Modo mockeado no requiere red |

**Missing dependencies with no fallback:** Ninguna — el gate de CI (mockeado) no depende de red ni de la key.
**Missing dependencies with fallback:** El eval LIVE depende de `MINIMAX_API_KEY` + red; sin ellos se skip (no bloquea CI), igual que el smoke de Fase 2.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.0.0 (TS, lógica/pipeline) + pgTAP (migración 0006) |
| Config file | `packages/adjudication/vitest.config.ts` (clon de `@obs/identity`); `supabase/tests/` para pgTAP |
| Quick run command | `pnpm --filter @obs/adjudication test --run` |
| Full suite command | `pnpm -w test && supabase test db` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ID-03 | blocking genera candidatos correctos; adjudicación valida JSON contra zod | unit | `pnpm --filter @obs/adjudication test candidatos prompt` | ❌ Wave 0 |
| ID-04 | compuerta fail-closed: <0.90 / conflicts / decision≠match / inconsistencia cám-per → revisión; borde 0.90 exacto | unit (tabla de decisión) | `pnpm --filter @obs/adjudication test compuerta` | ❌ Wave 0 |
| ID-04 | RUT en prompt → `RutInLlmInputError`, 0 llamadas al provider | unit | `pnpm --filter @obs/adjudication test pipeline` | ❌ Wave 0 |
| ID-05 | CLI confirm/reject/correct escribe estado + audit con revisor+timestamp | unit (cliente mockeado) | `pnpm --filter @obs/adjudication test revisor-cli` | ❌ Wave 0 |
| ID-06 | solo `confirmado` es promovible; LLM auto-acepta a `probable` máx | unit | `pnpm --filter @obs/adjudication test pipeline` | ❌ Wave 0 |
| ID-07 | golden set: precisión ≥ umbral (mockeado, gate CI); falla = bloquea deploy | regression (vitest) | `pnpm --filter @obs/adjudication test golden-set` | ❌ Wave 0 |
| ID-07 | golden set LIVE mide precisión real MiniMax-M3 (gated) | smoke (gated) | `IDENTITY_GOLDEN_LIVE=1 pnpm --filter @obs/adjudication test golden-set` | ❌ Wave 0 |
| ID-08 | audit append-only: UPDATE/DELETE como service role → throws; RLS habilitada; REVOKE aplicado | pgTAP | `supabase test db` | ❌ Wave 0 |
| ID-08 | cada decisión (det/llm/humano) inserta fila de audit con metodo/confidence/modelo_version | unit + pgTAP | `pnpm --filter @obs/adjudication test writer-revision` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @obs/adjudication test --run` (lógica pura, ~1s sin red)
- **Per wave merge:** `pnpm -w test && supabase test db` (suite completa + pgTAP)
- **Phase gate:** golden set verde (precisión ≥ umbral, mockeado) + pgTAP de inmutabilidad verde antes de `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/adjudication/` scaffold (package.json/tsconfig/vitest) — espeja `@obs/identity`; alta en `tsconfig.json` raíz + `tsconfig.base.json`
- [ ] `candidatos.test.ts` — cubre ID-03 (blocking)
- [ ] `prompt.test.ts` — cubre ID-03 (schema + prompt sin RUT)
- [ ] `compuerta.test.ts` — cubre ID-04 (tabla de decisión exhaustiva, borde 0.90)
- [ ] `pipeline.test.ts` — cubre ID-03/04/06 (e2e con MiniMax mockeado, fail-closed 0-fetch)
- [ ] `revisor-cli.test.ts` — cubre ID-05
- [ ] `golden/golden-set.ts` + `golden-set.test.ts` — cubre ID-07 (incluye "Walker P., Matías")
- [ ] `supabase/migrations/0006_revision_identidad.sql` + `supabase/tests/0005_revision_identidad.test.sql` — cubre ID-06/08
- [ ] `mockProviderFromFixtures` helper — provider determinista desde el golden set

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high` (config.json).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Sin auth de usuario en esta fase (CLI usa service role local) |
| V3 Session Management | no | Sin sesiones |
| V4 Access Control | yes | RLS deny-by-default en `revision_identidad`/`identidad_audit`/`vinculo_identidad` (espejo 0005). anon nunca lee identidad/audit. Audit inmutable: trigger + REVOKE incluso para service role. |
| V5 Input Validation | yes | `AdjudicacionSchema` (zod) valida TODA salida LLM vía `parseAndValidate` (compuerta única + repair). `assertNoRutInLlmInput` valida el prompt. Inputs del CLI validados (id numérico, revisor no vacío). |
| V6 Cryptography | no | Sin cripto nueva; keys de env (Fase 2) |
| V7 Error Handling/Logging | yes | `LLMValidationError` sin secretos (heredado Fase 2). El audit log ES el logging de decisiones (append-only). Errores del CLI no exponen RUT ni prompt. |
| V8 Data Protection | yes | RUT/PII NUNCA al LLM (`assertNoRutInLlmInput` + `assertSensitivityAllowed`, Ley 21.719). Minimización: al LLM solo nombres/cámara/periodo/región/candidatos. RUT solo determinista (Etapa 0). |

### Known Threat Patterns for {Postgres + LLM adjudication}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Salida LLM adversaria (chosen_id inexistente, confidence fabricada) | Tampering | `AdjudicacionSchema` zod (enum/rango 0-1/regex P\d{5}) + compuerta verifica chosen_id ∈ candidatos. Sin schema válido → repair → `LLMValidationError`, nunca cruda. |
| RUT/PII filtrado al LLM (tier que entrena) | Information Disclosure | `assertNoRutInLlmInput(promptFinal)` aborta 0-fetch; `assertSensitivityAllowed` (MiniMax `trainsOnInputs=false`). |
| Manipulación del audit log (borrar/editar una decisión) | Tampering/Repudiation | Append-only enforced: trigger `RAISE EXCEPTION` en UPDATE/DELETE + `REVOKE` (aplica a service role) + RLS. pgTAP verifica los tres. |
| Falso positivo de identidad (match equivocado auto-aceptado) | Tampering (afirmación falsa) | Compuerta fail-closed asimétrica (umbral 0.90, conflicts, inconsistencia) + golden set como gate de deploy + LLM nunca escribe `confirmado` directo. |
| Lectura no autorizada de la cola/audit por anon | Information Disclosure | RLS deny-by-default (sin policies) en las 3 tablas nuevas; espejo verificado de 0005. |
| LLM que infiere causalidad/parentesco (riesgo existencial #2) | — (integridad del producto) | Prompt restrictivo: `evidence` solo cita datos provistos; prohíbe inferir intención/parentesco. |

## Sources

### Primary (HIGH confidence)
- Codebase: `packages/llm/src/{types,data-routing,validate,router}.ts`, `providers/minimax.ts`, `json-schema.ts`, `smoke.test.ts` — contrato LLM, tool-calling, data-routing, compuerta zod, patrón LIVE-gated
- Codebase: `packages/identity/src/{deterministic,seed-cli,writer-supabase}.ts` — matcher fail-closed, patrón CLI con tsx+service role, writer mockeable
- Codebase: `packages/core/src/parlamentario.ts` — tipos `Parlamentario`/`EstadoIdentidad`, zod
- Codebase: `supabase/migrations/{0002,0005}.sql`, `supabase/tests/0004_parlamentario.test.sql` — patrón migración/RLS/pgTAP
- `.planning/phases/04-.../04-CONTEXT.md` — decisiones LOCKED
- `.planning/research/PITFALLS.md` — riesgo existencial #1 y #2, umbral asimétrico, fail-closed

### Secondary (MEDIUM confidence)
- [PostgreSQL Docs — Trigger Functions](https://www.postgresql.org/docs/current/plpgsql-trigger.html) — `RAISE EXCEPTION` en trigger para rechazar UPDATE/DELETE
- [PostgreSQL Wiki — Audit trigger](https://wiki.postgresql.org/wiki/Audit_trigger) — patrón de audit trail append-only
- [DesignGurus — Enforce immutability and append-only audit trails](https://www.designgurus.io/answers/detail/how-do-you-enforce-immutability-and-appendonly-audit-trails) — REVOKE + trigger combinados, grant solo INSERT

### Tertiary (LOW confidence)
- Ninguna — todas las afirmaciones críticas están verificadas en codebase o citadas de docs oficiales.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todo en el repo, verificado en Fases 1-3, cero instalaciones nuevas
- Architecture: HIGH — composición de contratos existentes; el pipeline de 4 etapas está fijado por CONTEXT
- Pitfalls: HIGH — el riesgo existencial #1 está documentado a fondo en PITFALLS y la mitigación (fail-closed) ya probada en Fase 3
- Audit inmutable (único elemento externo): MEDIUM-HIGH — patrón estándar Postgres confirmado por docs oficiales, no aún implementado en este repo

**Research date:** 2026-06-18
**Valid until:** 2026-07-18 (stack interno estable; sin deps externas que se muevan)
