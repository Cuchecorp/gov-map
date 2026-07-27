# Phase 65: VOTO P3b — Golden set DIPID→id_maestra (gate fail-closed pre-backfill) - Research

**Researched:** 2026-07-13
**Domain:** Reconciliación determinista de identidad de votos (data-integrity, defamation-critical)
**Confidence:** HIGH (todo el código y los datos fueron leídos en el codebase; cero dependencia de conocimiento de entrenamiento)

## Summary

El reconciliador de votos de la Cámara (`reconciliarVotosCamara`) y el branded type `EnlaceConfirmado` **YA EXISTEN, están completos y probados**. El cruce ya es DIPID-determinista PUNTO: no hay `normalizarNombre`, ni `correrPipeline`, ni LLM en el paquete `@obs/votos` ni en `reconciliar-camara.ts` (verificado por grep). El scoping por cámara (`camara==='diputados'`) es siempre-activo y el scoping por `periodo` está implementado (`opts.periodo`) y probado (trampa "DIPID reciclado entre periodos" ya cubierta por test). El FK es `EnlaceConfirmado | null` branded; un string crudo no compila; el único mint site es `confirmar()`.

Hallazgo rector: **el "golden set" que esta fase debe validar YA está sembrado como dato en `supabase/seeds/parlamentario.seed.json`.** Ese seed contiene los 155 diputados vigentes, cada uno con `id_diputado_camara` poblado (155/155), DIPIDs únicos (sin duplicados), `periodo="2026-2030"` uniforme, y `estado="confirmado"`. `cargarMaestra()` lee ese seed. Es decir: la maestra ya ES la tabla de mapeo DIPID→id_maestra. Esta fase NO construye el mapeo desde cero — lo **congela como golden artifact versionado** y lo **blinda con tests-gate** que fallan cerrado (a) si un DIPID desconocido llegara a atribuirse, (b) si aparecieran `normalizarNombre`/LLM/name-match en el camino de votos (grep-gate diff-checkable), y (c) si el conteo/unicidad/periodo del golden set se degradara (piso de plausibilidad ~155, DIPIDs únicos, un solo periodo).

**Primary recommendation:** Crear en `@obs/votos` (o `@obs/tramitacion`) un módulo `golden-dipid.ts` que (1) derive el golden set DIPID→id_maestra del seed autoritativo filtrando `camara==='diputados' && periodo==='2026-2030'`, (2) lo valide con zod + invariantes duras (155±holgura, DIPIDs únicos, un solo periodo, todos `estado==='confirmado'`), y (3) un test-gate que corre `reconciliarVotosCamara` contra el golden y assert-a el contrato fail-closed + un grep-gate que prueba la ausencia de name-match/LLM en el path de votos. NO tocar el reconciliador ni el branded type.

## User Constraints (from CONTEXT.md)

### Locked Decisions
Fase auto-generada (discuss skipped); las decisiones son a discreción de Claude guiadas por success criteria y reglas rectoras heredadas:
- Voto reconciliado por **DIPID determinista PUNTO**; NUNCA name-match para votos (riesgo #1).
- **Fail-closed**: DIPID desconocido → `no_confirmado`, `parlamentario_id=null`.
- FK branded `EnlaceConfirmado | null` (type-safe, string crudo no compila).
- El pipeline de identidad por nombre (auditado) es para *linking general*; para VOTOS el cruce es DIPID exacto, no el pipeline de nombre.

### Claude's Discretion
Toda la implementación (forma del golden artifact, ubicación del módulo, forma de los tests-gate) queda a discreción de Claude dentro de los 4 success criteria.

### Deferred Ideas (OUT OF SCOPE)
- **None.** Alcance acotado al golden set + gate. El backfill a escala es Phase 66.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VOTO-03 | Cada voto individual reconciliado fail-closed contra la maestra (link solo si `confirmado`; jamás atribuido a la persona equivocada) — golden set DIPID→maestra validado ANTES del backfill masivo. | El reconciliador fail-closed (`reconciliar-camara.ts`) y el branded FK (`enlace-confirmado.ts`) ya implementan el link-only-if-confirmado. El seed (`parlamentario.seed.json`) ya es el mapeo DIPID→id_maestra (155/155). Esta fase congela + blinda ese mapeo como golden artifact con tests-gate. Ver Architecture Patterns + Validation Architecture. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Golden set DIPID→id_maestra (artefacto validado) | Data / Seed (`supabase/seeds/parlamentario.seed.json`) | Package `@obs/votos` (derivación + validación) | El mapeo autoritativo YA vive en el seed leído por `cargarMaestra()`. El golden set es una vista/validación derivada de ese seed, no una nueva fuente de verdad. |
| Cruce voto→persona (fail-closed) | Package `@obs/tramitacion` (`reconciliarVotosCamara`, pura, sin red/DB) | — | Función pura ya existente; recibe la maestra cargada. No toca DB. |
| Invariante tipado del FK | Package `@obs/identity` (`EnlaceConfirmado`, `confirmar()`) | — | Branded type con único mint site; error de compilación, no de runtime. |
| Gate de CI (fail-closed + anti-name-match) | Test suite (`vitest`) del paquete | pgTAP (`supabase/tests/`) solo si se toca DB | El gate corre como test de regresión; bloquea CI si el contrato se rompe. Espejo del patrón `golden-set.test.ts` de `@obs/adjudication`. |

## Existing Code — Signatures & Behavior (leído, no asumido)

### `reconciliarVotosCamara` — `packages/tramitacion/src/reconciliar-camara.ts` `[VERIFIED: codebase]`

```typescript
export interface ReconciliarCamaraOpts {
  /** Si se pasa, SOLO se vinculan DIPIDs cuya fila de maestra es de ese periodo
   *  (fail-closed cruzando periodos). Si se omite, el filtro por cámara='diputados'
   *  se aplica igual y se asume maestra acotada al periodo vigente. */
  periodo?: string;
}

export function reconciliarVotosCamara(
  votosCrudos: CamaraVotoDetalle[],   // { diputadoId, opcion, nombreCrudo }
  votacionId: string,                 // FK a votacion.id, p.ej. "camara:89178"
  maestra: Parlamentario[],
  opts: ReconciliarCamaraOpts = {},
): VotoParaEscribir[]
```

**Cómo resuelve DIPID→id_maestra HOY:**
1. Construye un índice `Map<string, Parlamentario>` sobre `maestra`, **saltando** filas donde `camara !== "diputados"` (un PARLID del Senado nunca contamina), y —si `opts.periodo` viene— saltando filas de otro periodo (fail-closed cross-periodo). Clave del índice = `p.id_diputado_camara` (skip null/vacío).
2. Por cada voto crudo: `key = String(v.diputadoId ?? "")`; busca `idx.get(key)`.
3. **Match** → `enlace: confirmar(p.id, "determinista")` (mint del branded), `estado_vinculo: "confirmado"`, `metodo: "determinista"`, `fuente_voter_id: key` (DIPID, NO el nombre).
4. **No match** (fail-closed) → `enlace: null`, `estado_vinculo: "no_confirmado"`, `metodo: null`, `parlamentario_id=null`, conservando `mencion_nombre` crudo para display marcado "identidad no verificada".
5. Defensa en profundidad: cada fila plana valida con `VotoSchema.parse(aplanarVoto(voto))`.

Función **PURA**: sin red, sin DB, sin LLM. Los comentarios de cabecera documentan explícitamente T-05-07 (guarda fail-closed) y WR-02 (precondición periodo/cámara).

### `EnlaceConfirmado` — `packages/identity/src/enlace-confirmado.ts` `[VERIFIED: codebase]`

- Interface branded con `readonly [ENLACE_CONFIRMADO]: true` donde `ENLACE_CONFIRMADO` es un `unique symbol` **privado al módulo** (nunca exportado). Un writer que tipa su FK como `EnlaceConfirmado | null` rechaza estructuralmente un `string` crudo.
- `confirmar(parlamentarioId, metodo = "determinista"): EnlaceConfirmado` es la **única factory**. La invocan solo la reconciliación (determinista) y `revisor-cli` (promoción humana). Un grep-gate de la fase 09 ya prueba que `confirmar(` no aparece en writers/parsers.

### Runner de producción — `packages/votos/src/run-camara-votos.ts` `[VERIFIED: codebase]`

- `runCamaraVotos(opts)` ensambla el conector Cámara con la política LOCKED (rate-limit 2-3s, robots, UA, SSRF allowlist), carga la maestra vía `cargarMaestra()` si no se inyecta, y delega en `runIngest` que usa `reconciliarVotosCamara`. `LEGISLATURA_VIGENTE = 58`.
- **No importa** `normalizarNombre`, `correrPipeline`, `LLMProvider` ni `adjudicac*` (grep vacío en `packages/votos/src`). El camino de votos ya está limpio.

### Maestra / golden data source — `supabase/seeds/parlamentario.seed.json` `[VERIFIED: codebase]`

Inspección con Node (2026-07-13):
- 186 filas totales; **155 diputados**; **155/155 con `id_diputado_camara`** poblado.
- **DIPIDs únicos** (0 duplicados) entre los 155.
- **`periodo` uniforme = "2026-2030"** para todos los diputados.
- **`estado = "confirmado"` para los 155** diputados.
- Cargado por `cargarMaestra(root, log)` (`packages/tramitacion/src/ingest-cli.ts`), que lee ese path exacto y devuelve `Parlamentario[]`.
- Poblado por `parseCamara` (`packages/identity/src/parse-camara.ts`) desde el endpoint LIVE `WSDiputado.asmx/retornarDiputadosPeriodoActual` (~155 `<Diputado>` con `<Id>` = DIPID). Ahí `id = "D"+DIPID`, `id_diputado_camara = DIPID`, `periodo = "2026-2030"`.

Fixture DIPIDs de Phase 64 (`1240/1082/1259/1142/1039/1131/1015/1217/1107/1219` + `1009`): **los 11 resuelven** en el seed. El golden set y la votación LIVE ya son coherentes.

## Standard Stack

Sin paquetes nuevos. Esta fase es 100% código/datos/tests dentro del monorepo existente.

### Core (ya presente)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 3.0.0 | test-gate del golden set + fail-closed | ya es el runner de `@obs/votos` y `@obs/tramitacion` |
| zod | 4.4.3 | validación de forma del golden artifact | compuerta de contrato ya usada en `ParlamentarioSeedSchema`/`VotoSchema` |
| @obs/core | workspace:* | tipo `Parlamentario`, `ParlamentarioSeedSchema` | contrato de la maestra |
| @obs/identity | workspace:* | `EnlaceConfirmado`, `confirmar` | branded FK (no re-crear) |
| @obs/tramitacion | workspace:* | `reconciliarVotosCamara`, `cargarMaestra`, `findWorkspaceRoot` | reconciliador + loader (no re-crear) |

**Installation:** ninguna. No se instala ningún paquete.

## Package Legitimacy Audit

No aplica — esta fase **no instala paquetes externos**. Todo el trabajo usa dependencias ya presentes en el monorepo (`vitest`, `zod`, workspaces `@obs/*`). slopcheck N/A.

## Architecture Patterns

### System Architecture Diagram

```
opendata.camara.cl (WSDiputado.asmx)         [FUENTE LIVE — ya ingerida]
        │  parseCamara()  (155 <Diputado>, id_diputado_camara=DIPID, periodo=2026-2030)
        ▼
supabase/seeds/parlamentario.seed.json        [MAESTRA autoritativa — 155 diputados, DIPIDs únicos]
        │  cargarMaestra(root)
        ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  GOLDEN SET DIPID→id_maestra  (ESTA FASE)                    │
  │  derivar: filtrar camara='diputados' ∧ periodo='2026-2030'  │
  │  validar: 155±holgura · DIPIDs únicos · estado=confirmado   │
  │  congelar: artefacto versionado + zod-schema                │
  └─────────────────────────────────────────────────────────────┘
        │  (dato de entrada del cruce)
        ▼
reconciliarVotosCamara(votosCrudos, votacionId, maestra, {periodo})   [YA EXISTE]
        │  DIPID en índice ── sí ──▶ confirmar(id,"determinista") → EnlaceConfirmado (confirmado)
        │                   └─ no ──▶ null (no_confirmado, parlamentario_id=null)  [FAIL-CLOSED]
        ▼
VotoParaEscribir[]  (FK = EnlaceConfirmado | null branded)
        ▲
        │  GATES (ESTA FASE, en CI):
        │   • test golden: DIPID conocido → confirmado; DIPID desconocido → no_confirmado/null
        │   • grep-gate: NO normalizarNombre / correrPipeline / LLM en el path de votos
        │   • invariantes: unicidad DIPID, periodo único, piso de conteo
        └──────────────────────────────────────────────────────────
```

### Recommended Project Structure
```
packages/votos/src/
├── golden-dipid.ts          # deriva + valida el golden set DIPID→id_maestra desde el seed
├── golden-dipid.test.ts     # test-gate: fail-closed + invariantes + anti-name-match (grep)
└── (run-camara-votos.ts)    # sin cambios
```
(Alternativa: ubicarlo en `packages/tramitacion/src/` junto al reconciliador; ambos válidos. Recomendado `@obs/votos` porque es el dueño del *camino de votos* y donde el grep-gate anti-name-match tiene más sentido semántico.)

### Pattern 1: Golden set derivado + validado (espejo de `@obs/adjudication`)
**What:** Un módulo exporta `GOLDEN_DIPID` (el mapeo congelado) + una función `validarGoldenDipid()` que corre invariantes duras. El patrón ya existe en `packages/adjudication/src/golden/golden-set.ts` (`GOLDEN_SET`, `GOLDEN_SET_GATE`, `evaluarGolden`, umbral que bloquea CI).
**When to use:** cuando el gate de deploy del riesgo #1 debe correr como test de regresión.
**Example:**
```typescript
// Source: patrón de packages/adjudication/src/golden/golden-set.ts (codebase)
import { cargarMaestra, findWorkspaceRoot } from "@obs/tramitacion";
import type { Parlamentario } from "@obs/core";

export const PERIODO_VIGENTE = "2026-2030";
export const N_DIPUTADOS_ESPERADO = 155;   // piso/techo con holgura razonada

export interface GoldenDipidRow { dipid: string; idMaestra: string; }

/** Deriva el golden set DIPID→id_maestra del seed autoritativo (read-only, sin DB). */
export function derivarGoldenDipid(maestra: Parlamentario[]): GoldenDipidRow[] {
  return maestra
    .filter((p) => p.camara === "diputados" && p.periodo === PERIODO_VIGENTE)
    .filter((p) => p.id_diputado_camara != null && p.id_diputado_camara.length > 0)
    .map((p) => ({ dipid: p.id_diputado_camara!, idMaestra: p.id }));
}
```

### Pattern 2: Test-gate fail-closed contra el reconciliador real
**What:** El test alimenta a `reconciliarVotosCamara` con (a) un DIPID del golden → assert `confirmado` + `parlamentarioId` correcto + `EnlaceConfirmado` minteado, y (b) un DIPID **fuera** del golden → assert `no_confirmado` + `parlamentario_id=null` + `enlace=null`. Reusa `aplanarVoto` para inspeccionar la forma plana. Los tests base ya existen en `reconciliar-camara.test.ts`; esta fase los eleva a "gate contra el golden set derivado", no contra fixtures ad-hoc.

### Pattern 3: grep-gate anti-name-match (diff-checkable)
**What:** Un test que lee el fuente del camino de votos y assert-a la **ausencia** de `normalizarNombre`, `correrPipeline`, `adjudicar`, `LLMProvider` en `reconciliar-camara.ts` + `packages/votos/src/*.ts` (excluyendo tests). Espejo del grep-gate de fase 09 (`confirmar(` no aparece en writers). Es la evidencia "verificable en el diff" que pide SC#2.
**Example:**
```typescript
// Source: patrón grep-gate de fase 09 (codebase, enlace-confirmado)
import { readFileSync } from "node:fs";
const PROHIBIDOS = [/normalizarNombre/, /correrPipeline/, /LLMProvider/, /adjudic/i];
it("el camino de votos NO contiene name-match/LLM (SC#2)", () => {
  const src = readFileSync(reconciliarCamaraPath, "utf8");
  for (const re of PROHIBIDOS) expect(src).not.toMatch(re);
});
```

### Anti-Patterns to Avoid
- **Re-crear `reconciliarVotosCamara` o `EnlaceConfirmado`:** ya existen y están probados. Esta fase construye el golden + gate *alrededor* de ellos. Un HALLAZGO RECTOR de STATE.md rechaza toda fase "crear conector/modelo".
- **Introducir name-match como "fallback" cuando el DIPID no resuelve:** prohibido. Un DIPID desconocido es fail-closed → `no_confirmado`. Nunca "recuperar por nombre" (riesgo #1).
- **Hardcodear los 155 DIPIDs en el golden en vez de derivarlos del seed:** el seed es la fuente de verdad; derivar + validar mantiene el golden en sync y evita un artefacto que se pudre.
- **Asumir que `estado==='confirmado'` implica "linkeable":** el reconciliador NO lee `estado`; linkea por *presencia en el índice* (cámara+periodo+DIPID). Si se quiere que solo `confirmado` linkee, hay que decidir explícitamente si el golden set filtra por `estado` (hoy los 155 ya son `confirmado`, así que es un no-op benigno — pero documéntalo como invariante, no como suerte). **[ASSUMED — ver Assumptions Log A1]**

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cruce DIPID→persona | Un nuevo matcher | `reconciliarVotosCamara` | ya existe, puro, fail-closed, probado |
| FK type-safe del voto | Un `string` + validación runtime | `EnlaceConfirmado` + `confirmar()` | el error pasa a ser de compilación, no de runtime |
| Cargar la maestra | Un `JSON.parse` ad-hoc | `cargarMaestra(findWorkspaceRoot(cwd), log)` | ya maneja seed-ausente/ilegible fail-safe |
| Estructura del golden gate | Un test improvisado | espejo de `golden-set.ts` de `@obs/adjudication` | patrón probado que ya bloquea CI por riesgo #1 |

**Key insight:** El 90% de esta fase es *ensamblar y blindar* código y datos que ya existen. El net-new es un módulo golden derivado + una suite de tests-gate.

## Runtime State Inventory

Fase **greenfield de tests/datos derivados** (no es rename/refactor/migración). No mueve datos persistidos ni renombra nada.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | El golden set YA vive como dato en `supabase/seeds/parlamentario.seed.json` (155 diputados). No se migra ni se muta. | Ninguna — se **lee** read-only para derivar el golden. |
| Live service config | None — verificado: la fase no toca n8n/Datadog/servicios externos. | Ninguna. |
| OS-registered state | None — verificado: sin tareas programadas ni procesos registrados. | Ninguna. |
| Secrets/env vars | None nuevos. El backfill LIVE (Phase 66) usa `VOTOS_LIVE=1` + Supabase keys; esta fase corre offline. | Ninguna. |
| Build artifacts | None — no se publica paquete ni se compila binario. | Ninguna. |

## Common Pitfalls

### Pitfall 1: DIPID reciclado entre legislaturas
**What goes wrong:** Un DIPID que perteneció a un diputado del periodo 2018-2022 se reasigna a otra persona en 2026-2030; un cruce sin scoping de periodo atribuiría el voto a la persona equivocada.
**Why it happens:** los DIPID no son globalmente únicos en el tiempo.
**How to avoid:** el reconciliador YA soporta `opts.periodo` (fail-closed cross-periodo) y el índice siempre filtra `camara==='diputados'`. El golden set debe fijar `periodo="2026-2030"` y el backfill (Phase 66) debe pasar `opts.periodo` coherente con la legislatura de la votación. **El seed actual tiene un único periodo (2026-2030), así que hoy no hay colisión posible** — pero el golden debe *assert-ar* "un solo periodo" para que un futuro seed multi-periodo rompa el gate ruidoso en vez de silenciosamente.
**Warning signs:** el golden set contiene >1 periodo, o un DIPID duplicado entre filas.

### Pitfall 2: name-match colándose como "fallback"
**What goes wrong:** alguien añade "si el DIPID no resuelve, intenta por nombre" → reintroduce el riesgo #1.
**How to avoid:** grep-gate anti-name-match (Pattern 3) que falla el build si aparece `normalizarNombre`/`correrPipeline`/LLM en el path de votos.
**Warning signs:** el diff introduce un import de `@obs/adjudication` o `normalizarNombre` en `packages/votos` o `reconciliar-camara.ts`.

### Pitfall 3: golden hardcodeado que se desincroniza del seed
**What goes wrong:** se congela una lista de 155 DIPIDs a mano; el seed se actualiza (nuevo diputado por reemplazo); el golden queda stale y el gate valida contra datos viejos.
**How to avoid:** derivar el golden del seed en runtime del test + validar invariantes (conteo con holgura, unicidad). El artefacto congelado, si se quiere uno, debe regenerarse desde el seed con un checksum verificado.
**Warning signs:** el conteo del golden ≠ conteo de diputados del seed.

### Pitfall 4: piso de conteo demasiado estricto
**What goes wrong:** assert `=== 155` exacto; un reemplazo legítimo (renuncia/subrogancia) cambia el conteo a 154/156 y rompe el gate por una razón legítima.
**How to avoid:** usar un rango razonado (p.ej. `>= 150 && <= 160`) documentado, o derivar del conteo del seed y solo assert-ar unicidad+periodo+no-vacío. El `parse-camara.ts` ya usa `MIN_DIPUTADOS` como piso de plausibilidad — reusar esa filosofía.

## Code Examples

### Cargar la maestra real y derivar el golden (offline, read-only)
```typescript
// Source: packages/tramitacion/src/ingest-cli.ts (cargarMaestra, findWorkspaceRoot) — codebase
import { cargarMaestra, findWorkspaceRoot } from "@obs/tramitacion";
const root = findWorkspaceRoot(process.cwd());
const maestra = cargarMaestra(root, () => {});     // lee supabase/seeds/parlamentario.seed.json
const golden = derivarGoldenDipid(maestra);         // 155 filas DIPID→idMaestra
```

### Assert fail-closed contra el reconciliador real
```typescript
// Source: packages/tramitacion/src/reconciliar-camara.test.ts — codebase
import { reconciliarVotosCamara } from "@obs/tramitacion";
import { aplanarVoto } from "...";

// DIPID conocido del golden → confirmado
const [ok] = reconciliarVotosCamara(
  [{ diputadoId: golden[0].dipid, opcion: "si", nombreCrudo: "x" }],
  "camara:1", maestra, { periodo: "2026-2030" });
expect(ok.enlace?.parlamentarioId).toBe(golden[0].idMaestra);
expect(ok.estado_vinculo).toBe("confirmado");

// DIPID inexistente → no_confirmado / null (FAIL-CLOSED)
const [nc] = reconciliarVotosCamara(
  [{ diputadoId: "999999", opcion: "si", nombreCrudo: "Ex" }],
  "camara:1", maestra, { periodo: "2026-2030" });
expect(nc.enlace).toBeNull();
expect(aplanarVoto(nc).parlamentario_id).toBeNull();
expect(nc.estado_vinculo).toBe("no_confirmado");
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Voto linkeado por nombre (`reconciliar-senado` v1.0) | Voto de Cámara linkeado por DIPID determinista | Addendum usuario (documentado en cabecera de `reconciliar-camara.ts`) | Cero riesgo de identidad por nombre en el path de Cámara |
| FK como `string \| null` (fabricable) | FK como `EnlaceConfirmado \| null` branded (único mint site) | IDENT-12 / fase 09 | Un match equivocado es error de compilación |

**Deprecated/outdated:** ninguno relevante a esta fase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Solo `estado==='confirmado'` debe linkear" es la política deseada. El reconciliador NO lee `estado` (linkea por presencia en índice); hoy los 155 son `confirmado`, así que filtrar por `estado` en el golden es un no-op benigno. Si en el futuro un diputado quedara `no_confirmado`/`probable` en el seed, el reconciliador lo linkearía igual (por DIPID) salvo que se decida filtrar. | Anti-Patterns / Pattern 1 | Un diputado en estado dudoso podría linkearse. Bajo hoy (todos confirmado); el planner debe decidir si el golden/reconciliador filtra por `estado` o si `estado` es solo metadato de display. Recomendación: documentar la decisión explícita en el plan. |
| A2 | El backfill de Phase 66 pasará `opts.periodo` coherente con la legislatura de cada votación. | Pitfall 1 | Si Phase 66 omite `periodo` con un seed multi-periodo futuro, la trampa DIPID-reciclado revive. Hoy mitigado por seed mono-periodo + invariante del golden. |

## Open Questions

1. **¿El golden set debe filtrar por `estado==='confirmado'` o linkea todo DIPID presente?**
   - What we know: el reconciliador linkea por presencia en índice, no por `estado`; hoy los 155 son `confirmado`.
   - What's unclear: si se desea que un futuro diputado `no_confirmado`/`probable` NO linkee su voto.
   - Recommendation: el planner decide. Opción segura: el golden set assert-a `estado==='confirmado'` para los 155 como invariante (falla ruidoso si alguno deja de serlo), y se documenta que `reconciliarVotosCamara` linkea por DIPID+cámara+periodo (no por estado). No cambiar el reconciliador salvo decisión explícita.

2. **¿Se congela un artefacto físico (JSON) del golden o se deriva siempre del seed en el test?**
   - Recommendation: derivar del seed en el test (evita staleness). Si se quiere un artefacto versionado para diff-review, generarlo desde el seed con checksum, no a mano.

## Environment Availability

Fase 100% offline (código + datos del repo + tests). Sin dependencias externas de runtime.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| vitest | test-gate | ✓ | 3.0.0 | — |
| Node/tsx | correr tests | ✓ | (monorepo) | — |
| seed maestra | derivar golden | ✓ | `supabase/seeds/parlamentario.seed.json` (155 diputados) | — |

**Missing dependencies:** ninguna.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.0.0 |
| Config file | `packages/votos/vitest.config.ts` (y `packages/tramitacion/vitest.config.ts`) |
| Quick run command | `pnpm --filter @obs/votos test` (y `--filter @obs/tramitacion test`) |
| Full suite command | `pnpm -r test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOTO-03 (SC#1) | Golden set DIPID→id_maestra válido para ~155 vigentes; DIPIDs únicos; periodo único (2026-2030); todos confirmado | unit | `pnpm --filter @obs/votos test golden-dipid` | ❌ Wave 0 — crear `golden-dipid.test.ts` |
| VOTO-03 (SC#2) | NO name-match/normalizarNombre/LLM en el path de votos (grep-gate, diff-checkable) | unit (source-grep) | `pnpm --filter @obs/votos test golden-dipid` | ❌ Wave 0 |
| VOTO-03 (SC#3) | DIPID fuera de la maestra → `no_confirmado`, `parlamentario_id=null` (fail-closed) contra el reconciliador real | unit | `pnpm --filter @obs/tramitacion test reconciliar-camara` | ✅ (base) — extender contra golden derivado |
| VOTO-03 (SC#4) | FK sigue `EnlaceConfirmado \| null` branded (string crudo no compila) | type (tsc) + test-d | `pnpm --filter @obs/votos typecheck` | ✅ (`enlace-confirmado.test-d.ts` en `@obs/identity`) — no regresionar |

### Sampling Rate
- **Per task commit:** `pnpm --filter @obs/votos test` (o el filter del paquete tocado)
- **Per wave merge:** `pnpm -r test` + `pnpm -r typecheck`
- **Phase gate:** suite completa verde + typecheck verde antes de `/gsd:verify-work`. No hay red ni DB → determinista.

### Wave 0 Gaps
- [ ] `packages/votos/src/golden-dipid.ts` — deriva + valida el golden set desde el seed (cubre SC#1)
- [ ] `packages/votos/src/golden-dipid.test.ts` — invariantes del golden (SC#1), grep-gate anti-name-match (SC#2), fail-closed contra el reconciliador real usando el golden derivado (SC#3)
- [ ] (opcional) extender `packages/tramitacion/src/reconciliar-camara.test.ts` para usar el golden derivado en vez de fixtures ad-hoc (fortalece SC#3)
- [ ] Framework install: ninguno — vitest 3.0.0 ya presente.

**No DB-touching:** esta fase NO toca Supabase → **pgTAP no requerido**. (La infra pgTAP existe en `supabase/tests/` — `0004_parlamentario.test.sql`, `0007_tramitacion.test.sql` — si el planner decidiera añadir una guarda DB, ese sería el lugar; pero no es necesario para los 4 SC, que son puros/offline.)

## Security Domain

`security_enforcement` no está `false` en config → se incluye.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | fase offline, sin auth |
| V3 Session Management | no | — |
| V4 Access Control | no | no toca RLS/DB en esta fase |
| V5 Input Validation | yes | zod (`ParlamentarioSeedSchema`, `VotoSchema`) valida forma del golden y de cada fila reconciliada |
| V6 Cryptography | no | — |

### Known Threat Patterns for {golden set DIPID / identidad de votos}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Atribución de voto a persona equivocada (DIPID reciclado / name-match) | Tampering / Repudiation | Cruce DIPID-determinista + scoping cámara/periodo + fail-closed (`reconciliar-camara.ts`); grep-gate anti-name-match |
| Golden stale que valida contra datos viejos | Tampering | derivar del seed autoritativo + invariantes (conteo/unicidad/periodo) |
| FK fabricado (string crudo publicado como confirmado) | Spoofing | branded `EnlaceConfirmado`, único mint site `confirmar()`, error de compilación |
| PII (RUT) filtrado | Information Disclosure | `rut` nullable, jamás fabricado ni público (CLAUDE.md / Ley 21.719); esta fase no lo toca |

## Project Constraints (from CLAUDE.md)

- **Tabla maestra de identidades respaldada fuera de Supabase sí o sí** — el seed `parlamentario.seed.json` ES ese respaldo autoritativo; el golden se deriva de ahí (read-only). No introducir una segunda fuente de verdad.
- **PII / Ley 21.719:** `rut` es interno nullable, jamás fabricado ni expuesto. Esta fase no toca RUT.
- **Voto reconciliado por DIPID determinista PUNTO; nunca name-match para votos (riesgo #1)** — LOCKED; el grep-gate lo blinda.
- **GSD Workflow Enforcement:** todo cambio de archivo pasa por un comando GSD. Esta fase se ejecuta vía `/gsd:execute-phase`.
- **Tests con vitest**, un solo lenguaje TS/Deno, `zod` como compuerta de contrato.

## Sources

### Primary (HIGH confidence — codebase, leído en esta sesión)
- `packages/tramitacion/src/reconciliar-camara.ts` — `reconciliarVotosCamara`, scoping cámara/periodo, fail-closed
- `packages/identity/src/enlace-confirmado.ts` — `EnlaceConfirmado` branded + `confirmar()`
- `packages/tramitacion/src/reconciliar-camara.test.ts` — tests base (WR-02 periodo, fail-closed) ya existentes
- `packages/votos/src/run-camara-votos.ts` — runner prod (sin name-match/LLM, verificado por grep)
- `packages/identity/src/parse-camara.ts` — fuente del DIPID (endpoint `retornarDiputadosPeriodoActual`, ~155, periodo 2026-2030)
- `packages/core/src/parlamentario.ts` — tipo `Parlamentario` + `ParlamentarioSeedSchema` (campos `id_diputado_camara`, `periodo`, `camara`, `estado`)
- `packages/adjudication/src/golden/golden-set.ts` — patrón golden-set gate a espejar
- `packages/tramitacion/src/ingest-cli.ts` — `cargarMaestra`, `findWorkspaceRoot`
- `supabase/seeds/parlamentario.seed.json` — 155 diputados, 155/155 DIPID, únicos, periodo 2026-2030, estado confirmado (inspeccionado con Node)
- `.planning/REQUIREMENTS.md` (VOTO-03), `.planning/STATE.md`, `.planning/phases/64-.../64-01-SUMMARY.md`

### Secondary / Tertiary
- Ninguna búsqueda web necesaria — la fase es interna al monorepo y todas las claves se verificaron leyendo código/datos.

## Metadata

**Confidence breakdown:**
- Existing code (reconciler, branded FK): **HIGH** — leído íntegro.
- Golden data source (seed): **HIGH** — inspeccionado con Node (conteos/unicidad/periodo/estado confirmados).
- Golden gate pattern: **HIGH** — patrón ya implementado en `@obs/adjudication`.
- Policy question (`estado` filter): **MEDIUM** — depende de decisión del planner (A1).

**Research date:** 2026-07-13
**Valid until:** ~30 días (código estable; el seed puede actualizarse con reemplazos legislativos — re-verificar conteo/unicidad si el seed cambia).

## RESEARCH COMPLETE

**Phase:** 65 - VOTO P3b — Golden set DIPID→id_maestra (gate fail-closed pre-backfill)
**Confidence:** HIGH

### Key Findings
- `reconciliarVotosCamara` y `EnlaceConfirmado` YA EXISTEN, completos, puros, probados; el scoping cámara+periodo (trampa DIPID-reciclado) YA está implementado y testeado. NO re-crear.
- El "golden set" DIPID→id_maestra YA es un dato: `supabase/seeds/parlamentario.seed.json` tiene 155 diputados, 155/155 con `id_diputado_camara`, DIPIDs únicos, periodo único "2026-2030", todos `estado=confirmado`. Esta fase lo **congela + blinda con tests-gate**, no lo construye.
- El camino de votos YA está limpio: cero `normalizarNombre`/`correrPipeline`/LLM en `@obs/votos` ni en `reconciliar-camara.ts` (grep vacío). SC#2 es un grep-gate que preserva ese estado.
- Patrón a espejar: `packages/adjudication/src/golden/golden-set.ts` (golden set + gate que bloquea CI por riesgo #1).
- Fase 100% offline: sin paquetes nuevos, sin DB, sin red. pgTAP no requerido.

### File Created
`.planning/phases/65-voto-p3b-golden-set-dipid-maestra-gate-fail-closed-pre-backf/65-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | sin paquetes nuevos; deps ya presentes |
| Architecture | HIGH | reconciliador/branded/golden-pattern leídos |
| Pitfalls | HIGH | trampa DIPID-reciclado ya cubierta en código; seed inspeccionado |

### Open Questions
- ¿El golden/reconciliador debe filtrar por `estado==='confirmado'` o linkear todo DIPID presente? (hoy no-op; decisión del planner — A1)
- ¿Artefacto físico congelado vs. derivación en test? (recomendado: derivar del seed)

### Ready for Planning
Research completo. El planner puede crear PLAN.md: (1) `golden-dipid.ts` derivado+validado, (2) `golden-dipid.test.ts` con invariantes + fail-closed contra el reconciliador real + grep-gate anti-name-match, sin tocar el reconciliador ni el branded type.
