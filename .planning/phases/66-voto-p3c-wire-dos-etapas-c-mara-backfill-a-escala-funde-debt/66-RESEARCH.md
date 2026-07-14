# Phase 66: VOTO P3c — Wire dos-etapas Cámara + backfill a escala (funde DEBT-01) - Research

**Researched:** 2026-07-13
**Domain:** Ingesta dos-etapas (fuente→R2→Supabase) del voto individual de Cámara + backfill LOCAL reanudable
**Confidence:** HIGH (todo el código existe y fue leído directamente; el "wire" es plumbing de símbolos ya presentes, no diseño nuevo)

## Summary

Esta fase NO construye subsistemas. Cada pieza —modelo `voto` (0019/0008), runner `run-camara-votos`, conector/parser corregidos (P64), reconciliador DIPID + golden set (P65), infra R2 dos-etapas (`R2Store.putImmutable`+`getObject`, `sha256Hex`, `BaseConnector`, `Fetcher`, `HostRateLimiter`)— YA EXISTE y fue leída. El hallazgo rector de la investigación es más fuerte de lo que el CONTEXT anticipaba: **el patrón de dos etapas completo, incluido el replay `--from-r2`, YA está implementado y probado en `packages/tramitacion/src/ingest-cli.ts` + `ingest-run.ts`** (envelope crudo `{boletin,tramXml,votXml,detalles[]}` → R2 content-addressed → `source_snapshot` → skip si `existed` → replay desde R2 con conectores fake). El problema es que el **runner de PRODUCCIÓN de votos (`run-camara-votos.ts`) NO pasa `r2Store`/`snapshotWriter` a `runIngest`**, y el **entry-point de operador (`run-votos-masivo-cli.ts`) NO acepta `--from-r2`**. Hoy los votos producen 0 snapshots R2 justamente por esa desconexión.

El wire tiene dos rutas viables y el planner debe elegir una (ver Architecture Patterns): (A) **threadear** `r2Store`/`fromR2`/`snapshotWriter` a través de `RunCamaraVotosOpts` → `runIngest` (ya los acepta) y añadir el modo replay al `run-votos-masivo-cli.ts`; o (B) **reusar `ingest-cli.ts` tal cual** como el entry-point de votos (ya hace todo), acotando por `--boletines`. La ruta A conserva la identidad "runner de votos" y es la de menor sorpresa dado el mandato del CONTEXT ("`run-camara-votos` enruta por `BaseConnector`"); la ruta B es menos código pero difumina el límite votos/tramitación. **Recomendación primaria: ruta A** — threadear las 3 opciones existentes de `runIngest` hacia arriba, sin tocar `runIngest` ni `ingest-cli.ts` (que ya son el patrón de referencia).

La reconciliación es DIPID-determinista fail-closed (P65 golden gate ya verde); el % confirmado no puede bajar al escalar porque `reconciliarVotosCamara` nunca hace name-match — un DIPID fuera de la maestra → `no_confirmado`/`parlamentario_id=null`. La cobertura confirmado/no_confirmado se mide con un `SELECT count(*) ... group by estado_vinculo` sobre `voto` (o un RPC/CLI report), paginando PostgREST con `.order().range()` si se lee vía supabase-js.

**Primary recommendation:** Threadear `r2Store` + `fromR2` + `snapshotWriter` (ya soportados por `runIngest`) a través de `runCamaraVotos`/`run-votos-masivo-cli.ts`, espejando VERBATIM el patrón `--from-r2` de `ingest-cli.ts`. Backfill LOCAL por `--boletines-file` (boletines de proyectos ya en DB), rate-limit 2-3s LOCKED intacto, reporte de cobertura por `estado_vinculo`. Cero paquetes nuevos, cero migraciones, cero cambios al reconciliador/parser/golden.

## User Constraints (from CONTEXT.md)

### Locked Decisions
Reglas rectoras NO negociables (CLAUDE.md "Ingesta y Cron — LOCKED", STATE.md):
- **Dos etapas SIEMPRE:** Etapa 1 fuente→R2 (crudo inmutable content-addressed `fuente/recurso/fecha/sha256.ext`, PUT `If-None-Match:*`, 412=éxito idempotente). Etapa 2 R2→Supabase lee del crudo, NUNCA de la fuente. Re-ingesta = `--from-r2` replay.
- **Hash-check ANTES de descargar;** salir temprano si no hay novedades.
- **Rate-limit 2-3s/host, UA identificatorio, robots.txt.** Nunca ráfagas (WAF gubernamental).
- **Backfill masivo = LOCAL** (operador), NO GitHub Actions. Idempotente/reanudable.
- **Paginación PostgREST:** SIEMPRE `.order().range()` (cap 1k por request — gotcha v6.1).
- **Voto por DIPID determinista PUNTO** (Phase 65 golden + fail-closed); un DIPID fuera de maestra → `no_confirmado`/`parlamentario_id=null`. El % confirmado NO baja al escalar.
- Cobertura confirmado/no_confirmado medida y reportada.

### Claude's Discretion (dentro de reglas LOCKED)
- Flags: `--boletines`/`--limite` para acotar; `--from-r2` para replay Etapa 2 sin tocar la fuente.
- Backfill LOCAL reanudable; paginar PostgREST con `.range()`.
- Medir y reportar cobertura confirmado vs no_confirmado tras el backfill.
- Snapshots R2 hoy en 0 → esta fase produce los primeros para votos.
- Elección de ruta de wire (A: threadear runCamaraVotos; B: reusar ingest-cli) — discreción del planner.

### Deferred Ideas (OUT OF SCOPE)
- Superficie ciudadana del voto en la ficha (sí/no/abstención/pareo/ausente con fuente/fecha/enlace) → **Phase 68**. NO construir UI de ficha aquí.
- Paridad Senado → **Phase 67**.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VOTO-01 | El ciudadano puede ver cómo votó individualmente cada parlamentario en una votación de sala (a favor/en contra/abstención/pareo/ausente) con fuente/fecha/enlace | El DATO es lo que se puebla aquí (la SUPERFICIE es P68). `reconciliarVotosCamara` emite `seleccion ∈ {si,no,abstencion,pareo,ausente}` (0019 amplió el CHECK); `votacion` lleva `origen`/`fecha_captura`/`enlace` (provenance por fila, verificado en `run-camara-votos.test.ts`). RPC `votos_de_parlamentario` (0019) ya expone la consulta. |
| DEBT-01 (parcial — votos) | Los conectores restantes cumplen las dos etapas LOCKED (`source_snapshot` a R2 crudo content-addressed) y soportan `--from-r2` | El wire funde esto: threadear `r2Store`+`snapshotWriter`+`fromR2` (todos ya soportados por `runIngest`) a través del runner de votos. Patrón de referencia VERBATIM: `ingest-cli.ts` líneas 200-263. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch votaciones Cámara (getVotaciones_Boletin / getVotacion_Detalle) | Conector/Ingesta (Deno/TS, server-only) | — | WAF bloquea browser + ráfagas; `CamaraConnector` con política LOCKED es el único caller |
| Persistir crudo (Etapa 1) | R2 (object storage) | — | `R2Store.putImmutable` content-addressed; verdad cruda versionada fuera de Postgres |
| Parse + reconciliar DIPID→id (Etapa 2) | Ingesta (función pura) | — | `parseCamaraVotoDetalle` + `reconciliarVotosCamara`, sin red ni DB |
| Upsert idempotente voto/votacion | Database (Supabase Postgres) | Ingesta (writer) | `onConflict:'votacion_id,fuente_voter_id'`; RLS-bypass service key server-side |
| Replay Etapa 2 (`--from-r2`) | R2 (read) + Ingesta | — | `R2Store.getObject` → envelope → conectores fake → `runIngest` sin tocar la fuente |
| Reporte de cobertura confirmado/no_confirmado | Database (query) | Ingesta (CLI report) | `group by estado_vinculo` sobre `voto`; PostgREST `.range()` si vía supabase-js |
| Backfill orquestación (bounded/resumable) | Operador LOCAL (CLI tsx) | — | LOCKED: backfill masivo = LOCAL, NO GitHub Actions; rate-limit serial 2-3s |
| Ficha ciudadana del voto (UI) | **Frontend (Next.js) — Phase 68** | — | FUERA DE ALCANCE aquí; solo se puebla el dato consultable |

## Standard Stack

Sin paquetes nuevos. Todo el stack ya está instalado y en uso. Lo relevante para esta fase:

### Core (ya presente — no instalar)
| Símbolo | Paquete | Propósito | Ubicación |
|---------|---------|-----------|-----------|
| `runCamaraVotos` | `@obs/votos` | Runner de producción Cámara-only (a threadear r2Store/fromR2) | `packages/votos/src/run-camara-votos.ts` |
| `run-votos-masivo-cli` | `@obs/votos` | Entry-point de OPERADOR del backfill masivo (a añadir `--from-r2`) | `packages/votos/src/run-votos-masivo-cli.ts` |
| `runIngest` | `@obs/tramitacion` | Orquestador que YA acepta `r2Store`/`snapshotWriter` (Etapa 1) | `packages/tramitacion/src/ingest-run.ts` |
| `main` (ingest-cli) | `@obs/tramitacion` | **PATRÓN DE REFERENCIA `--from-r2` VERBATIM** | `packages/tramitacion/src/ingest-cli.ts:200-263` |
| `R2Store` | `@obs/ingest` | `putImmutable` (Etapa 1) + `getObject` (replay Etapa 2) | `packages/ingest/src/r2-store.ts` |
| `sha256Hex` | `@obs/ingest` | Hash content-addressed (Web Crypto, sin lib externa) | `packages/ingest/src/r2-store.ts:12` |
| `reconciliarVotosCamara` | `@obs/tramitacion` | Cruce DIPID determinista fail-closed (NO tocar) | `packages/tramitacion/src/reconciliar-camara.ts` |
| `derivarGoldenDipid`/`validarGoldenDipid` | `@obs/votos` | Golden gate P65 — DEBE estar verde antes del backfill | `packages/votos/src/golden-dipid.ts` |
| `SupabaseTramitacionWriter` | `@obs/tramitacion` | Upsert idempotente `voto` por `(votacion_id,fuente_voter_id)` | `packages/tramitacion/src/writer-supabase.ts:84` |

**Installation:** Ninguna. `pnpm install` ya cubre todo. No hay migración nueva (0019/0008 ya definen el modelo `voto`).

## Package Legitimacy Audit

No aplica: esta fase NO instala paquetes externos. Todos los símbolos provienen de paquetes del workspace (`@obs/*`) o de dependencias ya instaladas y en uso en producción (`@supabase/supabase-js`, `aws4fetch`, `fast-xml-parser`). slopcheck no se ejecuta porque no hay `install` de terceros.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────── ETAPA 1 (fuente → R2) ────────────────────┐
  --boletines / -file    │                                                              │
  --limite  ────────────►│  runCamaraVotos ──► runIngest (loop por boletín)             │
                         │      │                    │                                   │
                         │      │        CamaraConnector.fetchVotacionesBoletin ──┐      │
                         │      │        (rate-limit 2-3s LOCKED, UA, robots)     │      │
                         │      │        CamaraConnector.fetchVotacionDetalle ────┤      │
                         │      │                    │                            ▼      │
                         │      │              envelope {boletin,tramXml,         WAF    │
                         │      │                votXml, detalles[]}          opendata.  │
                         │      │                    │                        camara.cl  │
                         │      │           sha256Hex(bytes)                          │  │
                         │      │                    ▼                               │  │
                         │      │      R2Store.putImmutable(If-None-Match:*) ─────────┘  │
                         │      │         │              │                               │
                         │      │      412 existed=true  200 new                         │
                         │      │         │              │                               │
                         │      │      [skip Etapa 2]  source_snapshot.write (provenance)│
                         └──────┼─────────┼──────────────┼───────────────────────────────┘
                                │         │              ▼
   --from-r2 <path> ───────────┘         │   ┌──── ETAPA 2 (R2 → Supabase) ─────────────┐
   R2Store.getObject(path)               │   │  parseCamaraVotoDetalle(detXml)          │
        │                                │   │        │                                 │
        ▼                                │   │  reconciliarVotosCamara(crudos,           │
   envelope (mismos XML)                 │   │     votacionId, maestra)                  │
        │                                │   │        │  DIPID en maestra? ─┐            │
        └── conectores FAKE ─────────────┘   │        ▼                    ▼            │
            (cero fetch a la fuente)          │  confirmado             no_confirmado    │
                                              │  parlamentario_id       null (fail-closed)│
                                              │        │                    │            │
                                              │        └──── upsertVotos ────┘            │
                                              │   onConflict (votacion_id, fuente_voter_id)│
                                              │        │                                 │
                                              │        ▼                                 │
                                              │   Supabase voto / votacion (idempotente) │
                                              └──────────────┬───────────────────────────┘
                                                             ▼
                                            REPORTE cobertura: group by estado_vinculo
                                            (PostgREST .order().range() si vía supabase-js)
```

### Recommended Project Structure
Sin estructura nueva. Los cambios viven en 2 archivos existentes de `packages/votos/src/`:
```
packages/votos/src/
├── run-camara-votos.ts        # threadear r2Store/fromR2/snapshotWriter → runIngest
├── run-votos-masivo-cli.ts    # añadir --from-r2, --boletines-file (ya existe), reporte cobertura
├── run-camara-votos.test.ts   # extender: aserción de que r2Store se pasa a runIngest
└── (opcional) cobertura-cli.ts # o report inline en run-votos-masivo-cli
```

### Pattern 1: Threadear las opciones de dos-etapas (ya soportadas por `runIngest`)
**What:** `runIngest` YA acepta `r2Store` y `snapshotWriter` (ingest-run.ts:91-97) y ejecuta Etapa 1 (R2 content-addressed + skip si `existed` + source_snapshot). El runner de votos simplemente no los reenvía. Añadir estos campos a `RunCamaraVotosOpts` y pasarlos al `runIngest`.
**When to use:** Ruta A (recomendada). Conserva el runner de votos como propietario del entry-point.
**Example:**
```typescript
// Source: espeja packages/tramitacion/src/ingest-cli.ts:289-300 (ya en el repo)
// En run-camara-votos.ts — RunCamaraVotosOpts gana 3 campos opcionales:
//   r2Store?: R2Store; snapshotWriter?: SnapshotWriter; fromR2?: string;
const res = await runIngest({
  ...(tieneBoletines ? { boletines: opts.boletines } : {}),
  legislaturaId,
  ...(tieneLimite ? { limite: opts.limite } : {}),
  maestra, camara, senado, writer, log,
  ...(opts.r2Store ? { r2Store: opts.r2Store } : {}),
  ...(opts.snapshotWriter ? { snapshotWriter: opts.snapshotWriter } : {}),
});
```

### Pattern 2: Replay `--from-r2` (copiar VERBATIM de ingest-cli.ts)
**What:** El replay lee el envelope crudo de R2 y monta **conectores fake** que sirven los XML desde el envelope — cero fetch a la fuente. `ingest-cli.ts:219-263` ya lo hace exactamente para el mismo `runIngest`.
**When to use:** Etapa 2 re-ejecutable sin molestar al WAF (DEBT-01, SC#1).
**Example:**
```typescript
// Source: packages/tramitacion/src/ingest-cli.ts:221-262 (patrón de referencia EN EL REPO)
const bytes = await r2Store.getObject(opts.fromR2);
const envelope = JSON.parse(new TextDecoder().decode(bytes)) as {
  boletin: string; tramXml: string | null; votXml: string | null; detalles: string[];
};
let detalleIdx = 0;
const camaraFake = {
  async descubrirBoletines() { return [envelope.boletin]; },
  async fetchVotacionesBoletin() { return envelope.votXml ?? ""; },
  async fetchVotacionDetalle() { return envelope.detalles[detalleIdx++] ?? ""; },
} as unknown as CamaraConnector;
const senadoFake = {
  async fetchTramitacion() { return envelope.tramXml ?? ""; },
  async fetchVotaciones() { return ""; },
} as unknown as SenadoConnector;
// → runIngest con camara/senado fake, boletines:[envelope.boletin]
```

### Pattern 3: Backfill LOCAL acotado y reanudable por archivo de boletines
**What:** `run-votos-masivo-cli.ts` YA soporta `--boletines-file <ruta>` (un boletín por línea) — la vía robusta, porque el descubrimiento por sesiones del WS suele devolver 0. La idempotencia por `(votacion_id,fuente_voter_id)` HACE al backfill reanudable: re-correr con el mismo archivo no duplica; un boletín ya cargado es un no-op de upsert. "Reanudable" se logra particionando el archivo de boletines (o filtrando los ya presentes en DB), NO con un cursor persistente nuevo.
**When to use:** SC#3 — backfill masivo LOCAL, acotado por archivo, rate-limit 2-3s.
**Example:**
```bash
# Fuente de boletines: los proyectos ya trackeados en DB (SELECT boletin FROM proyecto)
# → un boletin por línea → boletines.txt. Backfill por lotes (reanudable = re-correr el resto).
VOTOS_LIVE=1 pnpm --filter @obs/votos exec tsx src/run-votos-masivo-cli.ts \
  --boletines-file boletines-lote-01.txt
# Idempotente: interrumpir y re-correr no duplica (upsert por clave natural).
```

### Anti-Patterns to Avoid
- **Tocar `reconciliarVotosCamara`, `parseCamaraVotoDetalle`, el golden set o el branded type.** Están verificados (P64/P65) y protegidos por el grep-gate anti-name-match. El wire NO los altera.
- **Escribir un `--from-r2` distinto del de `ingest-cli.ts`.** Espejar VERBATIM evita divergencia de formato de envelope (mismo `runIngest`, mismo shape).
- **Correr `descubrirBoletines` a ciegas contra el WAF.** El WS no enumera por sesión (suele dar 0); usar `--boletines-file` con boletines de la DB.
- **Leer la cobertura sin paginar.** PostgREST corta a 1k filas/request → usar un agregado SQL (`group by`, devuelve pocas filas) O `.order().range()` si se materializa la lista.
- **Cambiar el rate-limiter o meter `Promise.all` en el fetch.** Fetch serial con delay 2-3s LOCKED (verificado en P64: ~3.2 s/fetch).
- **Construir la ficha UI del voto.** Es Phase 68. Aquí solo se puebla el dato.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persistir crudo idempotente | PUT S3 a mano + dedup | `R2Store.putImmutable` (If-None-Match:*, 412=existed) | Content-addressed + race-free ya resuelto |
| Replay Etapa 2 | Cache local de XML + re-parse ad hoc | `R2Store.getObject` + conectores fake (ingest-cli.ts) | Patrón exacto ya en el repo, mismo envelope |
| Cruce DIPID→persona | Match por nombre / fuzzy | `reconciliarVotosCamara` (determinista, fail-closed) | Name-match = riesgo #1 (difamación); golden gate lo prohíbe |
| Upsert sin duplicar | INSERT + check-exists | `upsert(onConflict:'votacion_id,fuente_voter_id')` | Idempotencia + dedup-por-clave ya en el writer |
| Rate-limit / UA / robots | delays manuales | `Fetcher`+`HostRateLimiter`+`RobotsGuard` (política LOCKED) | Una sola fuente de verdad de la política de red |
| Hash | crypto lib externa | `sha256Hex` (Web Crypto nativo) | Sin dependencia; ya usado en Etapa 1 |

**Key insight:** El 95% de esta fase es **conectar cables existentes**. Cualquier "construcción" que aparezca en el plan es señal de alarma — el patrón de dos etapas + `--from-r2` ya está escrito, probado y en producción para tramitación; votos solo necesita heredarlo.

## Runtime State Inventory

> Fase de wiring/backfill (no rename). Se incluye porque el backfill produce estado runtime nuevo.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `voto` en Supabase: hoy poblado solo por los 2 boletines del MVP (14309, 18296). El backfill lo escala. Filas `voto.estado_vinculo ∈ {confirmado,no_confirmado}`. | Data migration = el backfill mismo (upsert idempotente). NO borrar lo existente. |
| Live service config | R2 bucket: **0 snapshots de votos hoy** (verificado en CONTEXT). Esta fase produce los primeros crudos content-addressed para votos. `source_snapshot` en Postgres se puebla vía `snapshotWriter`. | Ninguna config manual — se crea al correr Etapa 1. |
| OS-registered state | Ninguno. Backfill = LOCAL, invocado a mano (`tsx`), sin task scheduler/cron nuevo (el cron de novedades es Phase 74, no aquí). | None — verificado: sin registro OS. |
| Secrets/env vars | `.env` YA tiene: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT_URL`, `R2_BUCKET`, `SUPABASE_API_URL`/`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_DB_URL`, `SUPABASE_PROJECT_ID`. Ningún secreto nuevo. | None — todas las claves presentes (verificado por grep de nombres). |
| Build artifacts | `packages/votos/dist/*.d.ts` reflejan la API previa; tras editar `run-camara-votos.ts` habrá que `pnpm -F @obs/votos build` para regenerar tipos si otro paquete los consume. | Rebuild del paquete si cambia la firma pública exportada. |

## Common Pitfalls

### Pitfall 1: El descubrimiento de boletines devuelve 0 → backfill vacío silencioso
**What goes wrong:** `runCamaraVotos` sin `--boletines`/`--boletines-file` cae en `descubrirBoletines(legId)`, que el WS de la Cámara no enumera por sesión → 0 boletines → 0 votos, sin error.
**Why it happens:** El WS `getVotaciones_*` no expone enumeración por año/sesión (documentado en ingest-run.ts:135-139 y run-votos-masivo-cli.ts:10-12).
**How to avoid:** Backfill SIEMPRE por `--boletines-file` derivado de `SELECT boletin FROM proyecto` (los proyectos ya trackeados). Assert `boletines.length > 0` antes de correr.
**Warning signs:** `votaciones=0 votos=0` en un backfill que debería poblar.

### Pitfall 2: `runIngest` etiqueta el snapshot bajo source `"tramitacion"`/`"leyes"`, no `"camara-votos"`
**What goes wrong:** El envelope de Etapa 1 en `runIngest` usa `putImmutable("tramitacion", boletinFull, ...)` y `snapshotWriter.write({source:"leyes",...})` (ingest-run.ts:281-306). El SPIKE de P64 usó `putImmutable("camara-opendata","getVotacion_Detalle",...)`. Son namespaces R2 distintos.
**Why it happens:** `runIngest` es el orquestador compartido tramitación+votos; su envelope mezcla tramXml+votXml+detalles bajo el paraguas "tramitacion".
**How to avoid:** Decidir explícitamente en el plan el namespace del crudo de votos. Si se reusa `runIngest` (ruta A/B), el crudo de votos vive DENTRO del envelope `tramitacion/<boletin>/...` (votXml+detalles incluidos) — es consistente y ya probado; NO hace falta un namespace separado. Solo documentar que el crudo de votos = campo `votXml`+`detalles[]` del envelope tramitación. El SPIKE de P64 (`camara-opendata/...`) fue un fixture de validación, no el canal de producción.
**Warning signs:** Buscar snapshots de votos bajo `camara-opendata/` y no encontrarlos (están bajo `tramitacion/`).

### Pitfall 3: El % confirmado "baja" al escalar por confundir cobertura de boletines con % de vínculo
**What goes wrong:** Al escalar aparecen votos de periodos/cámaras que la maestra vigente no cubre → más filas `no_confirmado` en términos absolutos → parece que "baja el % confirmado".
**Why it happens:** `reconciliarVotosCamara` solo indexa `camara==='diputados'` + periodo (WR-02). Un DIPID de periodo anterior es `no_confirmado` por diseño (correcto, fail-closed).
**How to avoid:** SC#4 se verifica correctamente midiendo el % confirmado **dentro del universo de DIPIDs del periodo vigente** (los que la maestra puede confirmar), no sobre el total bruto. El invariante real: **ningún DIPID de la maestra vigente que votó queda sin confirmar** (el golden gate garantiza esto). Reportar ambos: cobertura absoluta (N confirmado / M total) Y verificación de que 0 DIPIDs-de-maestra quedaron `no_confirmado`.
**Warning signs:** Un DIPID presente en el golden set aparece como `no_confirmado` → BUG (rompe P65).

### Pitfall 4: `seleccion='ausente'`/`'pareo'` rechazado por el CHECK viejo si la DB no tiene 0019
**What goes wrong:** El CHECK original (0008) solo permite `{si,no,abstencion,pareo}`; 0019 amplió a incluir `ausente`. Si la DB destino no aplicó 0019, un voto `ausente` aborta el upsert.
**Why it happens:** La aplicación de DDL es checkpoint de operador (0019 header lo dice); build/typecheck no prueban que Postgres ejecutó la migración.
**How to avoid:** Verificar `\d voto` (constraint incluye `ausente`) en la DB destino ANTES del backfill. Es un pre-check del backfill LOCAL.
**Warning signs:** `upsert voto falló: new row violates check constraint "voto_seleccion_check"`.

### Pitfall 5: Escritura remota vs local — apuntar el writer al destino correcto
**What goes wrong:** `run-votos-masivo-cli.ts` construye `SupabaseTramitacionWriter` con `SUPABASE_API_URL`+`SUPABASE_SECRET_KEY`; `ingest-cli.ts` default apunta al LOCAL (`127.0.0.1:54421`). Un backfill de PROD contra el LOCAL escribe en la DB equivocada.
**Why it happens:** Dos entry-points con defaults distintos de destino (patrón visto en memoria del proyecto: "dos entrypoints CLI").
**How to avoid:** El backfill de PROD usa `run-votos-masivo-cli.ts` (que lee `SUPABASE_API_URL` de `.env`, apuntando al REMOTO). Loguear el destino (`writer Supabase (<url>)`) y verificarlo antes de escribir. Para writes remotos, project memory confirma la vía por `--db-url`/API URL de `.env`.
**Warning signs:** El log dice `LOCAL (127.0.0.1...)` cuando se esperaba PROD.

## Code Examples

### Medir cobertura confirmado/no_confirmado (agregado SQL — sin paginación necesaria)
```sql
-- Source: modelo voto (supabase/migrations/0008 + 0019). Agregado → pocas filas, sin cap 1k.
select estado_vinculo, count(*) as n
from voto
group by estado_vinculo
order by estado_vinculo;
-- SC#4: además, verificar que NINGÚN DIPID del golden set quedó no_confirmado:
select count(*) as dipids_maestra_no_confirmados
from voto v
where v.estado_vinculo = 'no_confirmado'
  and v.fuente_voter_id in (
    select id_diputado_camara from parlamentario
    where camara='diputados' and periodo='2026-2030' and id_diputado_camara is not null
  );  -- DEBE ser 0.
```

### Cobertura vía supabase-js con paginación LOCKED (si se lista, no se agrega)
```typescript
// Source: gotcha v6.1 (MEMORY) — PostgREST cap 1k → .order().range() SIEMPRE al listar.
async function contarPorEstado(client: SupabaseClient) {
  // Para conteos usar head+count (no trae filas); para listar usar range paginado.
  const { count } = await client.from("voto")
    .select("*", { count: "exact", head: true })
    .eq("estado_vinculo", "confirmado");
  return count ?? 0;
}
// Si se necesita materializar filas: bucle con .order("votacion_id").range(from, from+999)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Votos escritos directo fetch→parse→Supabase (sin R2) | Dos etapas fuente→R2→Supabase + `--from-r2` (ya en runIngest/ingest-cli) | Wire de esta fase (P66) | Votos ganan crudo versionado + replay; funde DEBT-01 |
| `--from-r2` solo en tramitación/lobby | `--from-r2` disponible también por el entry-point de votos | P66 | Re-ingesta de votos sin molestar al WAF |

**Deprecated/outdated:**
- `spike/spike.ts` de @obs/votos: OBSOLETO (index.ts:3). La producción vive en `run-camara-votos.ts`.
- Namespace R2 `camara-opendata/getVotacion_Detalle/` del SPIKE P64: fue fixture de validación, no el canal de producción (el canal es el envelope `tramitacion/<boletin>/` de runIngest).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | El crudo de votos de producción debe vivir en el envelope `tramitacion/<boletin>` de `runIngest` (no en un namespace `camara-votos` separado) | Pitfall 2 | Si el operador/planner prefiere un namespace R2 dedicado para votos, habría que extender `runIngest` o escribir un putImmutable separado — más código. Confirmar con el planner. |
| A2 | "Reanudable" se satisface con idempotencia + particionar el archivo de boletines (sin cursor persistente nuevo) | Pattern 3 | Si el requisito exige un cursor/checkpoint durable (estilo DEBT-02 leylobby), habría trabajo extra. El CONTEXT dice "idempotente/reanudable"; la idempotencia ya lo cubre para re-correr. |
| A3 | SC#4 ("% confirmado no baja") se verifica sobre el universo de DIPIDs del periodo vigente, no sobre el total bruto de filas | Pitfall 3 | Si se mide sobre el total bruto, escalar a periodos históricos "bajará" el % legítimamente (más no_confirmado correctos) y el criterio se leería como fallo. Confirmar la métrica exacta con el planner. |
| A4 | El backfill de PROD escribe vía `run-votos-masivo-cli.ts` leyendo `SUPABASE_API_URL`/`SUPABASE_SECRET_KEY` de `.env` (writer PostgREST), no vía `psql --db-url` | Environment / Pitfall 5 | Project memory menciona ambos caminos (API URL para writer, `--db-url` para DDL). El writer de votos usa supabase-js (PostgREST), no psql. DDL (0019) sí es psql/operador. |
| A5 | La DB destino ya tiene 0019 aplicada (CHECK con `ausente`) | Pitfall 4 | Si no, el primer voto `ausente` aborta. Es un pre-check del backfill, no un supuesto silencioso — el plan debe incluir la verificación. |

## Open Questions

1. **Namespace R2 del crudo de votos: envelope tramitación vs dedicado**
   - What we know: `runIngest` ya escribe el envelope bajo `tramitacion/<boletin>` incluyendo votXml+detalles; el SPIKE P64 usó `camara-opendata/`.
   - What's unclear: si el operador quiere el crudo de votos separable/consultable por sí solo.
   - Recommendation: Reusar el envelope `tramitacion/<boletin>` (menos código, ya probado). Documentar que el crudo de votos = `votXml`+`detalles[]` del envelope. Escalar a namespace dedicado solo si el operador lo pide.

2. **Métrica exacta de SC#4 ("% confirmado no baja")**
   - What we know: name-match nunca ocurre (golden gate); no_confirmado crece legítimamente al incluir periodos históricos.
   - What's unclear: el denominador del "%" (total bruto vs DIPIDs-de-maestra).
   - Recommendation: Reportar DOS números — (a) cobertura absoluta N/M, y (b) el invariante duro "0 DIPIDs de la maestra vigente quedaron no_confirmado". El (b) es el que "no puede bajar".

3. **Ruta de wire A (threadear runCamaraVotos) vs B (reusar ingest-cli)**
   - What we know: ambas funcionan; B es menos código pero difumina el límite votos/tramitación.
   - What's unclear: preferencia del planner por cohesión de paquete.
   - Recommendation: Ruta A — el CONTEXT manda "`run-camara-votos` enruta por BaseConnector"; threadear las 3 opciones ya soportadas es mínimo y conserva la identidad del runner.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| R2 (S3 API) creds | Etapa 1 putImmutable + replay getObject | ✓ | `.env`: R2_ACCESS_KEY_ID/SECRET/ENDPOINT_URL/BUCKET | — (sin R2, Etapa 1 se omite con WARN; degrada honesto) |
| Supabase remoto | Backfill write | ✓ | `.env`: SUPABASE_API_URL + SUPABASE_SECRET_KEY (+ SUPABASE_DB_URL para DDL) | Supabase LOCAL (127.0.0.1:54421) para dry-run/tests |
| opendata.camara.cl | Fetch votaciones (Etapa 1 nueva) | ✓ (verificado UP a escala en P64, 5/5) | getVotaciones_Boletin + getVotacion_Detalle | `--from-r2` replay (no toca la fuente); fallback agregado getVotaciones_Boletin (SC#4 P64) |
| Node/tsx | Correr el CLI LOCAL | ✓ | tsx (ya en uso: run-votos-masivo-cli) | — |
| pnpm | Build/test del paquete | ✓ | pnpm 11 (Docker: dangerouslyAllowAllBuilds — MEMORY) | — |

**Missing dependencies with no fallback:** Ninguna — todas las creds y fuentes verificadas presentes/UP.

**Missing dependencies with fallback:**
- Si el WAF degrada durante el backfill LIVE: `--from-r2` replay para lo ya persistido + fallback honesto a agregados (documentado en P64 SC#4).

**Ejecutor vs operador-LOCAL:**
- **Ejecutor (CI/agente) puede correr:** suite offline (`pnpm -F @obs/votos test`), typecheck, el golden gate (P65), tests del wire con conectores/writer fake e in-memory, y un dry-run del replay `--from-r2` con `R2Store` inyectado (fetch mockeado).
- **Solo operador-LOCAL (NO CI, LOCKED):** el backfill LIVE contra opendata.camara.cl con rate-limit 2-3s (quema el WAF; `VOTOS_LIVE=1`) y la escritura remota a Supabase PROD. El probe LIVE está gated por `VOTOS_LIVE=1` (describe.skip + excluido del glob) — CI no lo colecta.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (node env) |
| Config file | `packages/votos/vitest.config.ts` (suite) + `packages/votos/vitest.live.config.ts` (probes LIVE a mano) |
| Quick run command | `pnpm --filter @obs/votos test` |
| Full suite command | `pnpm --filter @obs/votos test && pnpm --filter @obs/tramitacion test` |
| Typecheck | `pnpm --filter @obs/votos typecheck` (consume el `.test-d.ts` del golden FK) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEBT-01 | Etapa 1 persiste crudo a R2 antes de Etapa 2 (r2Store se pasa a runIngest) | unit (fake R2) | `pnpm -F @obs/votos test run-camara-votos` | ❌ Wave 0 (extender test: assert putImmutable llamado) |
| DEBT-01 | `--from-r2` replay lee de R2 y NO fetchea la fuente (conectores fake) | unit (fake R2 + spy) | `pnpm -F @obs/votos test` | ❌ Wave 0 (nuevo test espejo de ingest-cli --from-r2) |
| DEBT-01 | Etapa 1 y Etapa 2 re-ejecutables por separado; `existed=true`→skip | unit | `pnpm -F @obs/votos test` | ❌ Wave 0 |
| VOTO-01 | Voto individual poblado con seleccion ∈ {si,no,abstencion,pareo,ausente} + provenance | unit (in-memory) | `pnpm -F @obs/votos test run-camara-votos` | ✅ (run-camara-votos.test.ts — extender para `ausente`) |
| VOTO-01 | Cruce DIPID determinista fail-closed (confirmado/no_confirmado) | unit | `pnpm -F @obs/votos test` | ✅ (existente) |
| VOTO-03 | Golden gate verde antes del backfill; 0 DIPID-maestra no_confirmado | unit | `pnpm -F @obs/votos test golden-dipid` | ✅ (P65) |
| SC#3 | Backfill acotado por --boletines/--limite; rate-limit serial 2-3s | unit + LIVE gated | `VOTOS_LIVE=1 ... vitest --config vitest.live.config.ts` | ✅ (live.test — operador) |
| SC#4 | Reporte cobertura confirmado/no_confirmado | unit (report fn) | `pnpm -F @obs/votos test` | ❌ Wave 0 (report + su test) |

### Sampling Rate
- **Per task commit:** `pnpm --filter @obs/votos test` (suite offline, instantánea — excluye `*.live.test.ts`)
- **Per wave merge:** `pnpm --filter @obs/votos test && pnpm --filter @obs/tramitacion test` (145 tramitación + votos, sin regresión al reconciliador/parser)
- **Phase gate:** suite offline verde + typecheck verde + golden gate verde ANTES de habilitar el backfill LOCAL; el backfill LIVE + write remoto = corrida deliberada de operador (no bloquea el gate de código)

### Wave 0 Gaps
- [ ] `run-camara-votos.test.ts` — extender: assert que `r2Store` inyectado recibe `putImmutable` (Etapa 1) y que `seleccion='ausente'` se persiste (0019)
- [ ] `run-votos-masivo-cli` / `run-camara-votos` `--from-r2` test — espejo del test de `ingest-cli --from-r2`: con `R2Store` fake (getObject devuelve envelope), 0 fetch a la fuente
- [ ] `cobertura` report + test — función que agrega `voto` por `estado_vinculo` y verifica invariante "0 DIPID-maestra no_confirmado"
- [ ] Pre-check del backfill (documentado, no test automatizado): `\d voto` incluye `ausente` (0019 aplicada en la DB destino)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Ingesta server-side con service key (no auth de usuario) |
| V3 Session Management | no | Sin sesión (CLI batch) |
| V4 Access Control | yes | Service key bypassa RLS server-side (writer); `voto`/`votacion` público-read; RUT/PII NUNCA en votos (solo DIPID+nombre público) |
| V5 Input Validation | yes | `VotoSchema` (zod) valida cada fila antes del upsert; `validateShape` suave en BaseConnector; XML por fast-xml-parser (no regex sobre voto) |
| V6 Cryptography | yes | R2 SigV4 vía aws4fetch (NUNCA hand-roll — T-01-05); sha256 Web Crypto |
| V9/V10 (SSRF/comms) | yes | `Fetcher.assertAllowedUrl` allowlist antes del fetch (SSRF); UA identificatorio; robots.txt |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Atribución errónea de voto (persona equivocada) | Tampering/Repudiation | DIPID determinista fail-closed; golden gate; NUNCA name-match (riesgo #1) |
| DoS al WS gubernamental (ráfagas → WAF ban) | DoS | Fetch serial + rate-limit 2-3s LOCKED; `--from-r2` para re-ingesta sin tocar la fuente |
| Creds R2/Supabase en logs | Info Disclosure | `R2Store`/writer nunca interpolan creds en errores (T-01-06/T-05-13); loguear solo r2Path/status |
| SSRF vía URL de conector | Tampering | `assertAllowedUrl` allowlist (host derivado de la URL real, WR-01) |
| Crudo mutado / snapshot pisado | Tampering | Content-addressed + `If-None-Match:*` (append-only, 412=idempotente) |
| Exposición de RUT/PII vía votos | Info Disclosure | Votos NO tocan RUT; solo DIPID (id oficial público) + nombre público; `parlamentario.partido` nunca vía votos |

## Sources

### Primary (HIGH confidence — código leído en este repo)
- `packages/votos/src/run-camara-votos.ts` — runner de producción (NO pasa r2Store/fromR2 hoy)
- `packages/votos/src/run-votos-masivo-cli.ts` — entry-point operador (soporta --boletines-file; NO --from-r2)
- `packages/tramitacion/src/ingest-cli.ts:200-263` — **PATRÓN DE REFERENCIA --from-r2 VERBATIM**
- `packages/tramitacion/src/ingest-run.ts:67-318` — runIngest YA acepta r2Store/snapshotWriter (Etapa 1)
- `packages/ingest/src/base-connector.ts` — flujo invariante cache→robots→rate-limit→fetch→drift→R2→snapshot
- `packages/ingest/src/r2-store.ts` — putImmutable (If-None-Match:*) + getObject (replay)
- `packages/tramitacion/src/reconciliar-camara.ts` — DIPID determinista fail-closed (WR-02)
- `packages/tramitacion/src/writer-supabase.ts:84-107` — upsert voto onConflict '(votacion_id,fuente_voter_id)'
- `supabase/migrations/0019_voto_asistencia_y_ficha.sql` — CHECK amplió a 'ausente'; RPC votos_de_parlamentario
- `supabase/migrations/0008_tramitacion.sql:56-86` — tabla voto (columnas, FK, unique)
- `packages/lobby/src/run-camara-lobby.ts` + `packages/lobby/src/ingest-cli.ts` — otro conector con Etapa 1 + --from-r2 (espejo)
- `packages/votos/src/golden-dipid.ts` (P65) — golden gate que debe estar verde pre-backfill
- `.planning/phases/64-.../64-02-SUMMARY.md` — endpoint UP a escala, crudo LIVE en R2, pareo confirmado
- `.env` (nombres de claves, grep) — R2 + Supabase creds presentes

### Secondary (MEDIUM confidence — memoria del proyecto)
- MEMORY: PostgREST cap 1k → `.order().range()` SIEMPRE (gotcha v6.1)
- MEMORY: dos entrypoints CLI → verificar destino LOCAL vs REMOTO; write remoto vía `.env` API URL / `--db-url`
- CLAUDE.md "Ingesta y Cron — LOCKED" — dos etapas, hash-check, backfill LOCAL, rate-limit

### Tertiary (LOW confidence)
- Ninguna. Toda afirmación factual se verificó contra código del repo o el CONTEXT/SUMMARY de fases previas.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todos los símbolos leídos directamente; cero paquetes nuevos
- Architecture (wire + --from-r2): HIGH — el patrón exacto ya está implementado y probado en ingest-cli.ts/runIngest
- Backfill mechanics: HIGH — --boletines-file ya existe; idempotencia por clave natural verificada en test
- Coverage measurement: HIGH — group by estado_vinculo trivial; columnas confirmadas en 0008
- Namespace R2 de votos / métrica SC#4 exacta: MEDIUM — dos opciones razonables (A1/A3 en Assumptions), plan debe confirmar

**Research date:** 2026-07-13
**Valid until:** 2026-08-13 (stack estable; el único riesgo de caducidad es el estado LIVE del WS opendata.camara.cl, verificado UP en P64 el 2026-07-14)

## RESEARCH COMPLETE

**Phase:** 66 - VOTO P3c — Wire dos-etapas Cámara + backfill a escala (funde DEBT-01)
**Confidence:** HIGH

### Key Findings
- El patrón dos-etapas COMPLETO, incluido `--from-r2`, YA existe y está probado en `ingest-cli.ts` + `runIngest`. `runIngest` ya acepta `r2Store`/`snapshotWriter`.
- El gap real: `run-camara-votos.ts` NO reenvía `r2Store`/`fromR2` a `runIngest`, y `run-votos-masivo-cli.ts` NO tiene `--from-r2`. Por eso hay 0 snapshots de votos hoy.
- El wire = threadear 3 opciones ya soportadas + espejar VERBATIM el replay de `ingest-cli.ts`. Cero paquetes, cero migraciones, cero cambios al reconciliador/parser/golden.
- Idempotencia por `(votacion_id,fuente_voter_id)` HACE al backfill reanudable; `--boletines-file` (ya existe) es la vía robusta (el descubrimiento por sesión da 0).
- Cobertura SC#4 = `group by estado_vinculo` + invariante duro "0 DIPID-de-maestra no_confirmado" (el golden gate lo garantiza; el % no puede bajar por name-match porque no hay name-match).
- Todas las creds (R2 + Supabase remoto) presentes en `.env`; endpoint UP a escala (P64). Backfill LIVE + write remoto = operador LOCAL; el resto lo corre el ejecutor con fakes.

### File Created
`.planning/phases/66-voto-p3c-wire-dos-etapas-c-mara-backfill-a-escala-funde-debt/66-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Símbolos leídos; nada nuevo que instalar |
| Architecture | HIGH | Patrón --from-r2 ya implementado en el repo (ingest-cli.ts) |
| Pitfalls | HIGH | Derivados de código + memoria del proyecto (namespaces, destino CLI, CHECK 0019) |

### Open Questions
1. Namespace R2 del crudo de votos (envelope tramitación vs dedicado) — recomendación: reusar envelope.
2. Métrica exacta de SC#4 (denominador del %) — recomendación: reportar N/M + invariante "0 DIPID-maestra no_confirmado".
3. Ruta de wire A vs B — recomendación: A (threadear runCamaraVotos), por mandato del CONTEXT.

### Ready for Planning
Research completo. El planner puede crear PLAN.md: el trabajo es plumbing acotado de símbolos existentes con patrón de referencia VERBATIM en el repo, más un report de cobertura y su test. Confirmar A1/A3 con el planner/operador.
