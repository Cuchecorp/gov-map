# Phase 71: DINERO P5c — SERVEL LOCAL (.xlsx artesanal, funde DEBT-01) - Research

**Researched:** 2026-07-14
**Domain:** Ingesta de financiamiento electoral declarado (SERVEL) — wire de dos etapas R2, modo LOCAL (operador coloca el `.xlsx`), reconciliación de identidad, gate MONEY, frescura declarada por dato.
**Confidence:** HIGH (todo el código destino ya existe y fue leído; las divergencias vs el enunciado están explicitadas abajo)

## Summary

Todo el sustrato de SERVEL YA EXISTE desde v2.0 (Fase 15): `connector-servel.ts` (fetch del `.xlsx` del blob de Azure), `parse-servel.ts` (parser `exceljs@4.4.0` con gate de header-text en fila 4), `reconciliar-aporte.ts` (cruce del CANDIDATO), `ingest-run-servel.ts` (orquestación con cuarentena run-level + `ServelBloqueadaError`), `model-servel.ts`, los writers, y la tabla `aporte` (migración `0024_servel.sql`, aplicada). Phase 71 NO es net-new: es **wiring + un modo LOCAL nuevo + una señal de frescura**, espejando lo que Phase 70 hizo para ChileCompra.

**Divergencia rectora que el planner DEBE conocer:** el enunciado de la fase dice "reconciliación por RUT (fail-closed, brand `FilaRutCorroborada` de Phase 69)". **SERVEL NO TRAE RUT — ni de donante ni de candidato, solo NOMBRES** (esto está codificado y comentado en `model-servel.ts`, `reconciliar-aporte.ts` y el DDL de `0024_servel.sql`). El enlace candidato→parlamentario se resuelve por **NOMBRE vía el pipeline de identidad determinista/auditado** (`correrPipeline`, IDENT-12 fail-closed: SOLO `determinista` mintea el FK; todo lo demás → `parlamentario_id NULL` + `estado_vinculo='no_confirmado'`). El brand `FilaRutCorroborada` de Phase 69 aplica a ChileCompra (donde el RUT sí viene). El plan de Phase 71 debe honrar el **espíritu** de "fail-closed, nunca falso por nombre" pero mediante el **cruce por nombre determinista existente**, NO añadiendo un RUT que la fuente no publica. El `aporte`/`donante` schema no debe tocarse por esto (ya modela `rut_donante` nullable "por si una exportación futura lo trae").

**Segunda divergencia clave:** el `ingest-run-servel.ts` actual **FETCHEA** el `.xlsx` del blob de Azure (`ServelConnector.descargar(url)`) y sube el crudo a **Supabase Storage** (`subirCrudo`) DESPUÉS de parsear — NO es el wire de dos etapas R2-primero LOCKED. Phase 71 debe añadir el patrón Etapa-1-R2-primero (espejo exacto de `ingest-run.ts` de dinero, Phase 70) MÁS un modo **LOCAL** donde la Etapa 1 NO es un fetch sino que el operador ya colocó el `.xlsx` en R2, y el pipeline lee de R2 (`--from-r2`).

**Primary recommendation:** Reusar 1:1 la maquinaria de `ingest-run.ts` (Phase 70): añadir `r2Store?`/`snapshotWriter?`/`fromR2?` a `RunIngestServelOpts`; en el camino normal, persistir los BYTES del `.xlsx` content-addressed en R2 (`putImmutable("servel", eleccion, fecha, sha, "xlsx", bytes)`) ANTES de parsear/upsert (put fallido no-412 GATEA la Etapa 2); en `--from-r2`, leer los bytes del `.xlsx` de R2 y correr parse→reconcilia→upsert sin tocar el blob. Añadir el modo LOCAL: una tarea `{ eleccion, r2Path }` (sin `url`) que salta el fetch y lee directo de R2. Añadir la señal de frescura `servel` al `CATALOG` (staleness sobre `aportes_ingesta_estado.ingestado_hasta`, umbral generoso, `workflowYml` "n/d" porque es LOCAL sin cron). Fixture `.xlsx` fake construido in-test con `exceljs`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Colocar el `.xlsx` correcto en R2 por elección | Operador (LOCAL, manual) | — | SERVEL no tiene feed estable; Etapa 1 = acto humano, no fetch |
| Persistir crudo content-addressed (Etapa 1) | `@obs/ingest` `R2Store.putImmutable` | — | Mismo primitivo idempotente (If-None-Match) que Phase 70 |
| Leer crudo de R2 y parsear (Etapa 2) | `@obs/dinero` `runIngestServel` (`--from-r2`) | `parse-servel.ts` (exceljs) | Derivado reconstruible desde R2 sin re-tocar la fuente |
| Cruce candidato→parlamentario | `@obs/adjudication` `correrPipeline` (por NOMBRE) | `@obs/identity` `confirmar` | SERVEL no trae RUT; enlace determinista fail-closed |
| Gate de exposición pública | `app/lib/money-gate.ts` (`moneyPublicEnabled`) server-only | RLS/RPC de `0024` (candado A datos) | Doble candado; OFF hasta sign-off legal (Phase 73) |
| Frescura declarada por dato | `aporte.fecha_corte` + `aporte.eleccion` (columnas EXISTENTES) | `@obs/freshness` CATALOG (staleness operativa) | Corte + elección ya persisten por fila; falta la señal agregada |
| Fixture de test | `exceljs` en-test (dev/prod dep ya presente) | — | 100% offline, sin `.xlsx` real |

## Standard Stack

Cero paquetes nuevos. Todo ya está instalado y en uso.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `exceljs` | 4.4.0 | Parseo del `.xlsx` + construcción del fixture fake in-test | Ya dep de `@obs/dinero` (`parse-servel.ts` lo usa) [VERIFIED: packages/dinero/package.json] |
| `@obs/ingest` `R2Store` | interno | Etapa 1 (`putImmutable` content-addressed) + Etapa 2 (`getObject`) | Mismo primitivo que Phase 70; `aws4fetch` SigV4 [VERIFIED: packages/ingest/src/r2-store.ts] |
| `@obs/adjudication` `correrPipeline` | interno | Cruce candidato→parlamentario por NOMBRE (determinista fail-closed) | Ya cableado en `reconciliar-aporte.ts` [VERIFIED: código leído] |
| `zod` | 3.x/4.x | Validación de la forma cruda de fila (`AporteSheetSchema`) | Ya en `model-servel.ts` [VERIFIED] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@obs/freshness` CATALOG/evaluate | interno | Señal de staleness SERVEL (espejo del entry `chilecompra`) | Añadir un entry al array `CATALOG` [VERIFIED: catalog.ts] |
| `@supabase/supabase-js` v2 | ya dep directa | Writer Supabase + snapshot writer | Ya dep de `@obs/dinero` (Phase 70 lo confirmó) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Modo LOCAL nuevo (tarea con `r2Path`, sin fetch) | Reusar `--from-r2` de un envelope JSON | El envelope de dinero (Phase 70) es JSON de respuestas API; SERVEL es un `.xlsx` binario → el crudo en R2 son los BYTES del `.xlsx` directamente, no un envelope. Mejor: content-address los bytes crudos del `.xlsx`. |
| `putImmutable("servel", eleccion, fecha, sha, "xlsx", bytes)` | Reusar `subirCrudo` (Supabase Storage actual) | `subirCrudo` va a Supabase Storage, NO a R2, y corre DESPUÉS del parse (no es Etapa-1-primero). La regla LOCKED de CLAUDE.md exige R2 como verdad cruda. Mantener `subirCrudo` como best-effort secundario o retirarlo; NO es la Etapa 1. |

**Installation:** ninguna. `pnpm --filter @obs/dinero test` corre offline.

## Package Legitimacy Audit

No se instalan paquetes nuevos. `exceljs@4.4.0` y `aws4fetch` ya están en `package.json` y en uso productivo (verificados por lectura del código). Sin superficie de legitimidad nueva.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| exceljs | npm (ya instalado) | maduro | alto | github.com/exceljs/exceljs | n/a (pre-existente) | Sin cambio |

**Packages removed:** none. **Packages flagged:** none.

## Architecture Patterns

### System Architecture Diagram

```
ETAPA 1 — LOCAL (operador, NO fetch, NO cron)
  Operador obtiene .xlsx de SERVEL por elección
        │
        ▼
  putImmutable("servel", eleccion, fecha, sha256(bytes), "xlsx", bytes)  ── R2 (crudo inmutable, content-addressed)
        │  (If-None-Match:* → 412 = ya existía = éxito idempotente)
        ▼
  source_snapshot (best-effort provenance)

ETAPA 2 — pipeline re-ejecutable (--from-r2), 0 fetch al blob
  R2.getObject(r2Path)  ──►  bytes del .xlsx
        │
        ▼
  parseAportes(bytes)  ── gate header-text fila 4 ── THROW → CUARENTENA RUN (0 filas)
        │
        ▼
  reconciliarCompletitud (Content-MD5 / byte-length) ── !ok → CUARENTENA RUN (0 filas)
        │
        ▼
  reconciliarAporte(parsed, maestra)  ── cruce CANDIDATO por NOMBRE
        │        SOLO determinista → EnlaceConfirmado + estado_vinculo='confirmado'
        │        probable/revision/no_confirmado → parlamentario_id NULL (fail-closed)
        ▼
  upsertDonantes (sub-maestra deny-by-default)  +  upsertAportes (VERSIONADO por fuente_id+fecha_corte)
        │
        ▼
  marcarIngestado(parlamentarios, fecha_corte)  ── aportes_ingesta_estado

GATE (candado B, Phase 73):  moneyPublicEnabled(env) === "true"  → recién ahí la ficha muestra aportes
FRESCURA: aporte.eleccion + aporte.fecha_corte VISIBLES por fila; señal staleness en CATALOG
```

### Recommended Project Structure
```
packages/dinero/src/
├── ingest-run-servel.ts        # MODIFICAR: añadir r2Store/snapshotWriter/fromR2 + modo LOCAL (tarea con r2Path)
├── ingest-run-servel.test.ts   # MODIFICAR: tests del wire (FakeR2Store) + fixture .xlsx exceljs in-test
├── ingest-cli-servel.ts        # MODIFICAR: construir R2Store real de .env + flag --from-r2 / --r2-path
├── connector-servel.ts         # SIN CAMBIO (el fetch sigue disponible para el modo fetched, no LOCAL)
├── parse-servel.ts             # SIN CAMBIO (exceljs, gate header)
├── reconciliar-aporte.ts       # SIN CAMBIO (cruce por NOMBRE — NO por RUT; ver divergencia)
├── model-servel.ts             # SIN CAMBIO
└── writer-*.ts                 # SIN CAMBIO
packages/freshness/src/
└── catalog.ts                  # MODIFICAR: añadir entry "servel" al CATALOG
```

### Pattern 1: Etapa-1-R2-primero para bytes crudos de `.xlsx`
**What:** persistir los BYTES del `.xlsx` content-addressed en R2 ANTES de parsear/upsert. Put fallido no-412 GATEA la Etapa 2 (nunca hay derivado sin crudo reconstruible).
**When to use:** en el camino normal (fetched) y como precondición del modo LOCAL.
**Example (mirror de ingest-run.ts:251-302):**
```typescript
// Source: packages/dinero/src/ingest-run.ts (Phase 70), adaptado a bytes .xlsx
if (r2Store) {
  const sha = await sha256Hex(bytes);           // bytes = el .xlsx CRUDO, no un envelope JSON
  const today = new Date().toISOString().slice(0, 10);
  let r2Path: string; let existed: boolean;
  try {
    ({ r2Path, existed } = await r2Store.putImmutable("servel", tarea.eleccion, today, sha, "xlsx", bytes));
  } catch (err) {
    errores.push({ fuente: ORIGEN_SERVEL, clave: `${clave}#r2-etapa1`, mensaje: (err as Error).message });
    continue; // Etapa-1-primero LOCKED: sin crudo en R2, NO upsert
  }
  if (existed) { log(`[skip] sin novedades — servel ${clave}`); continue; }
  // source_snapshot best-effort ...
}
```

### Pattern 2: Modo LOCAL (Etapa 1 = operador, Etapa 2 = pipeline)
**What:** una tarea que trae `r2Path` (no `url`); el pipeline salta el fetch al blob y lee los bytes del `.xlsx` de R2 directamente. Es el análogo de `--from-r2` pero SIN un fetch previo — el crudo ya está en R2 porque el operador lo puso.
**When to use:** siempre para SERVEL LOCAL (la fuente no tiene feed estable).
**Example:**
```typescript
// Source: derivado de ingest-run.ts --from-r2 (Phase 70), adaptado a bytes .xlsx
if (opts.fromR2 != null && opts.fromR2 !== "") {
  if (!opts.r2Store) throw new Error("runIngestServel: --from-r2 requiere r2Store");
  const bytes = await opts.r2Store.getObject(opts.fromR2);   // los BYTES del .xlsx que el operador colocó
  // parse → completitud → reconcilia por NOMBRE → upsert; NUNCA ServelConnector.descargar
}
```
**Nota de content-addressing:** el `.xlsx` se keya por `servel/<eleccion>/<fecha>/<sha256(bytes)>.xlsx`. Dos cortes/versiones del mismo `.xlsx` de una elección → dos objetos R2 (sha distinto) → dos `fecha_corte` en `aporte` (versiones acumulan, nunca se colapsan). Idéntico a la semántica de versión del schema `0024`.

### Pattern 3: Frescura declarada por dato (SC#3)
**What:** cada fila `aporte` YA lleva `eleccion` (NOT NULL, verbatim: "DIPUTADO - DISTRITO 23 - 2025") + `fecha_corte` (date). El RPC `aportes_de_parlamentario` YA los proyecta. La UI renderiza "Financiamiento de la elección X (corte YYYY-MM-DD)".
**When to use:** ya está en el schema; el plan solo debe garantizar que el wire preserve `fechaCorte` y `eleccion` verbatim (no los recompute).
**Confidence:** HIGH — verificado en `0024_servel.sql:180-195` (el RPC emite `eleccion` + `fecha_corte`).

### Anti-Patterns to Avoid
- **Añadir un RUT a SERVEL:** la fuente no lo publica; el enlace es por NOMBRE determinista. NO tocar `aporte`/`donante`/`reconciliar-aporte.ts` para forzar un RUT (rompería IDENT-12 y el CHECK `aporte_parlamentario_solo_confirmado`).
- **Usar `subirCrudo` (Supabase Storage) como Etapa 1:** corre DESPUÉS del parse y va a Storage, no a R2. La verdad cruda LOCKED es R2. Etapa 1 = `putImmutable` a R2 ANTES del parse.
- **Fetch en el modo LOCAL:** el modo LOCAL JAMÁS toca `repodocgastoelectoral.blob.core.windows.net`; lee de R2. Un fetch accidental viola "no volver a molestar la fuente".
- **Encender la señal de frescura con `workflowYml` de un cron inexistente:** SERVEL es LOCAL sin cron → la señal de GH Actions figura "n/d" (honesto), igual que `chilecompra` hoy.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Escritura idempotente de crudo | PUT + check-exists manual | `R2Store.putImmutable` (If-None-Match:*) | 412 = existía = éxito; sin race |
| sha256 del `.xlsx` | crypto hand-roll | `sha256Hex` de `@obs/ingest` | Web Crypto nativo, ya exportado |
| Cruce candidato→parlamentario | matcher de nombres nuevo | `correrPipeline` (`@obs/adjudication`) | Determinista fail-closed + cola de revisión; IDENT-12 ya codificado |
| Gate de exposición | leer `MONEY_PUBLIC_ENABLED` crudo | `moneyPublicEnabled(env)` | Fail-closed (solo literal "true"), server-only |
| Señal de staleness | query ad-hoc | entry en `CATALOG` + `evaluate` | Patrón único de 7 fuentes; umbral override por env |
| Fixture `.xlsx` | binario checked-in | construir con `exceljs` in-test | 100% offline, sin binario en git; headers en fila 4 controlables |

**Key insight:** Phase 71 es casi enteramente PLUMBING sobre primitivos existentes. El único código de dominio nuevo es el modo LOCAL (leer bytes `.xlsx` de R2 en vez de fetchear) y un entry declarativo de frescura.

## Runtime State Inventory

Phase 71 NO es un rename/refactor. Es un wire nuevo detrás de un gate OFF. Aun así, hay estado runtime relevante:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Tabla `aporte`/`donante` (0024) YA APLICADA a PROD (candado A live, candado B OFF). El wire escribe filas nuevas versionadas. | Ninguna migración nueva — el schema soporta el wire. Data: el operador coloca `.xlsx` (LOCAL). |
| Live service config | R2 bucket (crudo). El operador coloca el `.xlsx` en R2 bajo `servel/<eleccion>/<fecha>/<sha>.xlsx`. | Runbook operador: cómo obtener + colocar el `.xlsx` por elección. |
| OS-registered state | Ningún cron SERVEL (LOCAL por diseño). `workflowYml` "servel-weekly.yml" NO existe ni debe crearse. | None — verificado: SERVEL es LOCAL, sin GH Actions. |
| Secrets/env vars | `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_ENDPOINT`/`R2_BUCKET` (ya usados por Phase 70 CLI); `SUPABASE_*`; `MONEY_PUBLIC_ENABLED` (OFF). Sin secreto por-request (SERVEL es GET anónimo público). | El CLI construye R2Store de `.env` (espejo `run-dinero-masivo-cli.ts`). Ningún secreto nuevo. |
| Build artifacts | Ninguno afectado. `exceljs`/`aws4fetch` ya instalados. | None. |

**Nada encontrado en category "OS-registered state" ni "Build artifacts":** verificado — SERVEL es LOCAL sin cron y sin deps nuevas.

## Common Pitfalls

### Pitfall 1: Confundir "por RUT" del enunciado con la realidad "por NOMBRE" de SERVEL
**What goes wrong:** el plan añade un cruce RUT-exacto o un brand `FilaRutCorroborada` a SERVEL, tocando `aporte`/`reconciliar-aporte.ts`.
**Why it happens:** el CONTEXT y el objetivo dicen "reconciliación por RUT". Pero SERVEL no publica RUT (documentado en 3 archivos).
**How to avoid:** honrar el **espíritu** (fail-closed, nunca falso por nombre) mediante el cruce por NOMBRE determinista EXISTENTE (`correrPipeline`, IDENT-12). Un `no_confirmado` deja `parlamentario_id NULL`. NO añadir RUT.
**Warning signs:** el diff toca `reconciliar-aporte.ts`, `model-servel.ts` o `0024_servel.sql`; aparece `isRutValido`/`normRut` en el path de aportes.

### Pitfall 2: Etapa 1 a Supabase Storage en vez de R2
**What goes wrong:** reusar `subirCrudo` como "la Etapa 1". Va a Supabase Storage, corre post-parse, no gatea.
**Why it happens:** `ingest-run-servel.ts` ya tiene `subirCrudo` cableado.
**How to avoid:** Etapa 1 = `putImmutable` a R2 ANTES del parse; put fallido no-412 GATEA la Etapa 2. `subirCrudo` puede quedarse como secundario best-effort o retirarse, pero NO es la verdad cruda.
**Warning signs:** el crudo de la corrida no aparece en R2; `--from-r2` da 404.

### Pitfall 3: Cuarentena run-level tragando el modo LOCAL entero
**What goes wrong:** un drift de header en el `.xlsx` de UNA elección aborta toda la corrida multi-elección.
**Why it happens:** `ingest-run-servel.ts` cuarentena a nivel de RUN (una elección = un `.xlsx`) — que es CORRECTO por elección, pero debe ser `continue` (fail-soft por elección), no `throw`.
**How to avoid:** verificar que `ServelBloqueadaError` Y la cuarentena de drift hacen `continue` (degradan ESA elección) sin abortar el loop — ya es el comportamiento actual (`ingest-run-servel.ts:158-184`). Los tests deben cubrir "elección A cuarentenada + elección B ok en la misma corrida".
**Warning signs:** una tarea inválida vacía el resultado entero.

### Pitfall 4: `existed` (412) tratado como error en el modo LOCAL
**What goes wrong:** el operador re-coloca el mismo `.xlsx`; `putImmutable` devuelve 412; el wire lo trata como fallo.
**Why it happens:** 412 = éxito idempotente, no error.
**How to avoid:** espejo de `ingest-run.ts:275-279`: `existed:true` → `[skip] sin novedades` → skip Etapa 2 limpiamente. (En modo LOCAL puro con `--from-r2` explícito, `getObject` lee siempre; el gateo 412 aplica al camino fetched.)

## Code Examples

### Fixture `.xlsx` fake in-test (exceljs)
```typescript
// Source: derivado de exceljs API + parse-servel.ts (HEADER_ROW=4, EXPECTED_HEADERS)
import ExcelJS from "exceljs";
async function fakeXlsxAportes(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("aportes");
  // Los headers viven en la FILA 4 (parse-servel.ts:HEADER_ROW). Filas 1-3 = metadata/relleno.
  ws.getRow(4).values = [ /* los 11 EXPECTED_HEADERS VERBATIM, en orden */ ];
  ws.getRow(5).values = [ /* una fila de aporte de prueba */ ];
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}
```
Nota: leer `EXPECTED_HEADERS` de `parse-servel.ts` para los 11 literales exactos; un header renombrado dispara el gate de drift (útil para el test de cuarentena).

### Señal de frescura SERVEL (entry de CATALOG)
```typescript
// Source: catalog.ts (espejo del entry "chilecompra":261-281)
{
  fuente: "servel",
  tabla: "aportes_ingesta_estado",   // marcador por-parlamentario (0024); distingue "0 aportes" de "no barrido"
  columna: "ingestado_hasta",
  umbralDias: 365,                    // LOCAL por elección, no periódico → umbral generoso; stale honesto sin barrido
  overrideEnv: "FRESHNESS_UMBRAL_SERVEL",
  workflowYml: "servel-weekly.yml",  // NO existe (LOCAL sin cron) → señal GH Actions "n/d" (honesto, no error)
}
```
Confirmar el umbral con el operador (los ciclos electorales son bianuales/cuatrienales; 365d es una propuesta [ASSUMED]).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SERVEL fetch → Supabase Storage (crudo post-parse) | SERVEL LOCAL: operador → R2 (Etapa 1) → pipeline `--from-r2` (Etapa 2) | Phase 71 | Cumple DEBT-01 (dos etapas R2) para SERVEL; funde la deuda |
| Sin señal de frescura SERVEL | Entry `servel` en CATALOG | Phase 71 | El operador ve staleness declarada |

**Deprecated/outdated:** nada retirado. `ServelConnector.descargar` (fetch) sigue disponible para el camino fetched (si algún día SERVEL publicara una URL estable), pero el camino LOCKED de esta fase es LOCAL.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `umbralDias: 365` para la señal SERVEL | Code Examples / Frescura | Bajo — solo cambia cuándo la señal reporta "stale"; ajustable por `FRESHNESS_UMBRAL_SERVEL` sin código |
| A2 | El crudo R2 son los BYTES del `.xlsx` directamente (no un envelope JSON como dinero) | Patterns 1/2 | Bajo — es lo natural para un binario; verificado que `putImmutable` acepta `Uint8Array` + `ext` |
| A3 | `subirCrudo` (Supabase Storage) puede quedar como secundario o retirarse sin romper consumidores | Anti-Patterns | Medio — verificar que ningún test/consumidor dependa de que el crudo esté en Supabase Storage; el plan debe grep-confirmar |
| A4 | El modo LOCAL usa una tarea con `r2Path` (o `--r2-path`/`--from-r2`) sin `url` | Pattern 2 | Bajo — decisión de diseño de la interfaz; discreción de Claude por CONTEXT |

## Open Questions

1. **¿`subirCrudo` (Supabase Storage) se retira o coexiste con R2?**
   - Qué sabemos: `ingest-run-servel.ts` sube el crudo a Supabase Storage post-parse; NO es la Etapa 1 LOCKED.
   - Qué falta: si algún consumidor lee ese crudo de Storage.
   - Recomendación: el plan hace un grep de acceptance; si nadie lo lee, retirarlo (o degradarlo a best-effort no-gate) y dejar R2 como única verdad cruda. Tests con `git diff --exit-code` sobre el reconciliador/model.

2. **Umbral de frescura para una fuente LOCAL bianual.**
   - Qué sabemos: SERVEL se publica por ciclo electoral (no periódico).
   - Qué falta: el umbral "correcto" que no grite stale perpetuamente ni oculte data vieja.
   - Recomendación: umbral generoso (365d [ASSUMED]) + override env; la frescura POR DATO (`eleccion` + `fecha_corte` en la fila) es la señal rectora SC#3, la staleness operativa es secundaria.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| exceljs | parse + fixture in-test | ✓ | 4.4.0 | — |
| aws4fetch (R2Store) | Etapa 1/2 R2 | ✓ | (ya instalado) | — |
| R2 bucket + creds `.env` | wire LIVE (operador) | ✗ en test / operador-LOCAL | — | Tests usan FakeR2Store (offline) |
| `.xlsx` real de SERVEL por elección | backfill LIVE | ✗ (toil operador) | — | Fixture fake exceljs para el wire; el `.xlsx` real es operador-LOCAL |
| MONEY_PUBLIC_ENABLED | exposición pública | OFF (correcto) | — | Permanece OFF hasta Phase 73 |

**Missing dependencies with no fallback:** ninguna para el trabajo del agente (todo offline-testable).
**Missing dependencies with fallback:** el `.xlsx` real y las creds R2 son operador-LOCAL; el agente entrega wire + tests + runbook.

## Validation Architecture

**Framework:** vitest (suite `@obs/dinero`, 115 tests tras Phase 70). Comando rápido: `pnpm --filter @obs/dinero test`. Typecheck: `pnpm --filter @obs/dinero typecheck` (`tsc -b`). Freshness: `pnpm --filter @obs/freshness test`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (+ tsc -b typecheck) |
| Config file | `packages/dinero/vitest.config.*` (existente; Phase 43 corrigió el CI-dark) |
| Quick run command | `pnpm --filter @obs/dinero test` |
| Full suite command | `pnpm --filter @obs/dinero test && pnpm --filter @obs/freshness test && pnpm --filter @obs/dinero typecheck` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MONEY-02 / DEBT-01 | Etapa 1: bytes `.xlsx` a R2 ANTES del upsert (orden de captura) | unit | `pnpm --filter @obs/dinero test -t "etapa 1"` | ❌ Wave 0 (extender ingest-run-servel.test.ts) |
| DEBT-01 | `--from-r2`/LOCAL: parse desde R2, 0 fetch al blob | unit | idem (conector que lanza si se toca) | ❌ Wave 0 |
| MONEY-02 | Put fallido no-412 GATEA la Etapa 2 (0 upsert) | unit | idem | ❌ Wave 0 |
| MONEY-02 | `existed` (412) → skip idempotente | unit | idem | ❌ Wave 0 |
| MONEY-02 | Cuarentena por-elección fail-soft (A cuarentenada, B ok) | unit | idem (fixture xlsx drift + xlsx ok) | ❌ Wave 0 (parcialmente cubierto hoy) |
| MONEY-02 | Cruce fail-closed: candidato homónimo → `no_confirmado`, `parlamentario_id` NULL | unit | reusar patrón de `reconciliar-aporte.test.ts` | ✅ (existe; verificar cobertura) |
| MONEY-02 (SC#3) | `eleccion` + `fecha_corte` sobreviven verbatim el replay | unit | fixture → replay → assert byte-idéntico | ❌ Wave 0 |
| MONEY-02 | Señal de frescura `servel` en CATALOG | unit | `pnpm --filter @obs/freshness test` | ❌ Wave 0 (extender evaluate.test.ts) |
| MONEY-02 | Gate OFF: `moneyPublicEnabled` sin flip; `git diff` vacío en money-gate | guard | `pnpm --filter ./app test -t money-gate` | ✅ (money-gate.test.ts existe) |

### Sampling Rate
- **Per task commit:** `pnpm --filter @obs/dinero test`
- **Per wave merge:** full suite (dinero + freshness + typecheck)
- **Phase gate:** full suite verde + `git diff --exit-code` VACÍO en `reconciliar-aporte.ts`, `model-servel.ts`, `supabase/migrations/0024_servel.sql`, `app/lib/money-gate.ts` antes de `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Extender `packages/dinero/src/ingest-run-servel.test.ts` — FakeR2Store (putImmutable/getObject) + fixture `.xlsx` exceljs in-test; cubre MONEY-02/DEBT-01
- [ ] `packages/freshness/src/evaluate.test.ts` (o catalog test) — cubre el entry `servel`
- [ ] Fixture helper `fakeXlsxAportes()` in-test (exceljs, headers fila 4) — sin binario en git
- [ ] Runbook operador `71-BACKFILL-SERVEL-RUNBOOK.md` (espejo de `70-BACKFILL-CHILECOMPRA-RUNBOOK.md`): cómo obtener + colocar el `.xlsx` en R2 por elección, correr `--from-r2`
- [ ] Framework install: ninguno (vitest + exceljs ya presentes)

## Security Domain

> `security_enforcement` no está explícito en config → tratado como habilitado. SERVEL toca PII sensible (afiliación política, Ley 21.719) y una superficie de exposición gated.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | Candado A (RLS `donante` deny-by-default + revoke) + Candado B (`moneyPublicEnabled` OFF); RPC `aportes_de_parlamentario` NUNCA proyecta `rut_donante`/`donante_id` |
| V5 Input Validation | yes | `AporteSheetSchema` (zod) + gate de header-text (drift → cuarentena); `assertAllowedUrl` SSRF en el conector (host EXACTO via extraHosts, https forzado) |
| V6 Cryptography | yes (no hand-roll) | sha256 vía Web Crypto (`sha256Hex`); SigV4 R2 vía aws4fetch — NUNCA hand-roll |
| V2/V3 Auth/Session | no | Ingesta server-only; sin sesión de usuario |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Aporte mal atribuido a un parlamentario (defamación) | Tampering/Repudiation | CHECK `aporte_parlamentario_solo_confirmado` (schema) + cruce por NOMBRE determinista fail-closed (IDENT-12); un `no_confirmado` → `parlamentario_id` NULL |
| RUT de donante filtrado al público | Info Disclosure | RPC nunca proyecta columnas de `donante`; `donante` deny-by-default (RLS + revoke, Ley 21.719) |
| SSRF vía URL del `.xlsx` (modo fetched) | Tampering | `assertAllowedUrl` host EXACTO + https-only; en modo LOCAL no hay fetch (superficie reducida a 0) |
| Exposición prematura de aportes | Info Disclosure | `moneyPublicEnabled` fail-closed (solo literal "true"); flip = acto humano Phase 73 |
| Derivado sin crudo reconstruible | Repudiation | Etapa-1-R2-primero GATEA la Etapa 2 (put fallido no-412 → no upsert) |

## Sources

### Primary (HIGH confidence — código leído en esta sesión)
- `packages/dinero/src/connector-servel.ts` — fetch del blob Azure, `ServelBloqueadaError`, SSRF/https
- `packages/dinero/src/ingest-run-servel.ts` — orquestación, cuarentena run-level, `subirCrudo` (Supabase Storage post-parse)
- `packages/dinero/src/reconciliar-aporte.ts` — cruce por NOMBRE (correrPipeline, IDENT-12 fail-closed), NO por RUT
- `packages/dinero/src/model-servel.ts` — schema `Aporte`/`Donante`, sin RUT, versión por (fuenteId, fechaCorte)
- `packages/dinero/src/ingest-cli-servel.ts` — CLI actual (fetch, sin R2/from-r2)
- `packages/dinero/src/parse-servel.ts` — exceljs, HEADER_ROW=4, gate header-text
- `packages/dinero/src/ingest-run.ts` (Phase 70) — patrón Etapa-1-R2-primero + `--from-r2` a ESPEJAR
- `supabase/migrations/0024_servel.sql` — tabla `aporte` (eleccion NOT NULL, fecha_corte en PK), `donante` deny-by-default, RPC, CHECK anti-atribución
- `packages/ingest/src/r2-store.ts` — `R2Store.putImmutable`/`getObject`, `sha256Hex`
- `packages/freshness/src/catalog.ts` — CATALOG (entry chilecompra a espejar)
- `app/lib/money-gate.ts` — `moneyPublicEnabled` fail-closed
- `.planning/REQUIREMENTS.md` — MONEY-02, DEBT-01

### Secondary (MEDIUM)
- Phase 70 SUMMARY (70-01) — wire dos-etapas ChileCompra (molde directo)
- Phase 69 SUMMARY (69-01) — brand fail-closed name-match≠write-rut (aplica a ChileCompra, contexto de por qué SERVEL difiere)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — cero paquetes nuevos, todo verificado por lectura
- Architecture (wire + modo LOCAL): HIGH — espejo directo de Phase 70, ya probado
- Divergencia RUT→NOMBRE: HIGH — codificada y comentada en 3 archivos + el DDL
- Frescura umbral: MEDIUM — 365d es propuesta [ASSUMED], ajustable por env
- Pitfalls: HIGH — derivados del código real y de las lecciones de Phase 70

**Research date:** 2026-07-14
**Valid until:** ~2026-08-14 (estable; el código destino existe y no depende de fuentes externas volátiles)

## RESEARCH COMPLETE

**Phase:** 71 - DINERO P5c SERVEL LOCAL (.xlsx artesanal, funde DEBT-01)
**Confidence:** HIGH

### Key Findings
- **Todo el sustrato SERVEL ya existe** (`connector-servel`, `parse-servel` con exceljs@4.4.0, `reconciliar-aporte`, `ingest-run-servel`, tabla `aporte` 0024 aplicada). Phase 71 = wiring + modo LOCAL + señal de frescura, NO net-new.
- **DIVERGENCIA RECTORA:** SERVEL NO trae RUT (documentado en model/reconciler/DDL). El enlace es por NOMBRE determinista fail-closed (IDENT-12), NO por RUT. El plan debe honrar el espíritu "fail-closed nunca falso por nombre" con el cruce por NOMBRE existente, SIN tocar `reconciliar-aporte.ts`/`model-servel.ts`/`0024`. El brand `FilaRutCorroborada` de Phase 69 pertenece a ChileCompra.
- **El wire de dos etapas R2 NO existe aún para SERVEL:** el flujo actual fetchea el blob y sube crudo a Supabase Storage post-parse. Añadir Etapa-1-R2-primero (`putImmutable("servel", eleccion, fecha, sha, "xlsx", bytes)`) + modo LOCAL (`--from-r2` leyendo los BYTES del `.xlsx` que el operador colocó), espejo directo de `ingest-run.ts` (Phase 70).
- **Frescura por dato YA está en el schema** (`eleccion` NOT NULL + `fecha_corte` en el RPC). Falta solo la señal de staleness operativa (entry `servel` en CATALOG, LOCAL sin cron → `workflowYml` "n/d").
- **100% offline-testable:** FakeR2Store + fixture `.xlsx` fake construido in-test con exceljs (headers en fila 4). El `.xlsx` real y las creds R2 son toil operador-LOCAL (runbook + gate OFF hasta Phase 73).

### File Created
`.planning/phases/71-dinero-p5c-servel-local-xlsx-artesanal-funde-debt-01/71-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Cero deps nuevas; todo leído |
| Architecture | HIGH | Espejo directo de Phase 70 |
| RUT→NOMBRE divergence | HIGH | Codificado en 3 archivos + DDL |
| Frescura umbral | MEDIUM | 365d [ASSUMED], override por env |

### Open Questions
1. ¿`subirCrudo` (Supabase Storage) se retira o coexiste con R2? (grep de acceptance en el plan)
2. Umbral de frescura para fuente LOCAL bianual (365d propuesto, confirmar con operador)

### Ready for Planning
Research completo. El planner puede crear PLAN.md honrando: (1) cruce por NOMBRE, NO RUT; (2) Etapa-1-R2-primero + modo LOCAL espejo de Phase 70; (3) `git diff` vacío en reconciler/model/0024/money-gate; (4) señal de frescura declarativa; (5) fixture exceljs offline + runbook operador.
