# Phase 57: CRON-FIX — Research

**Researched:** 2026-07-08
**Domain:** Ingesta incremental Node.js/TypeScript — R2 dos-etapas, hash-check, GH Actions secrets
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Etapa 2 seam COMPARTIDO en `@obs/ingest`: lector de snapshots R2 (por `source_snapshot` y/o clave content-addressed) entregando crudo a los parsers existentes sin tocar la red gubernamental.
- Cada CLI recurrente gana modo `--from-r2` re-ingestando desde crudo; parsers NO se duplican.
- Alcance: 5 conectores recurrentes. fichas-backfill/backup solo si costo marginal trivial.
- Etapa 1: tramitacion y lobby-leylobby añaden escritura R2 content-addressed (`If-None-Match: *`, 412=éxito) ANTES de parsear, reusando el writer existente.
- Conectores que son no-op silencioso por falta de secrets en CI deben FALLAR LOUD (WARN log) cuando R2 no está configurado en cron.
- Hash-check: conditional GET (ETag/If-Modified-Since) si la fuente lo soporta; si no, sha256→412 skip. Log estándar: `[skip] sin novedades — <fuente> <recurso>`.
- G4 (CRITICAL): deduplicar batch tramitacion_evento por clave natural antes del upsert + test reproductor.
- Probidad assertion: distinguir "0 resultados SPARQL" de "0 identity matches"; 0 sistemático tras N corridas = fail loud con diagnóstico.
- G7 (CRITICAL): lobby-camara-weekly pasa a FALLBACK LOCAL — runbook + CLI idempotente en `docs/runbooks/cron-local-fallback.md`; workflow GH schedule deshabilitado, dispatch-only, con comentario explicativo.
- Secrets: cargar R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET/DEEPSEEK_API_KEY etc. vía `gh secret set` leyendo de .env local. Valores NUNCA impresos en logs/commits/docs.
- Billing GH activo: camino primario es GH Actions; fallback local solo para WAF-bloqueado.
- NUNCA: flags `*_PUBLIC_ENABLED`, DDL destructivo, backfill masivo en GH, tocar MONEY/SERVEL, imprimir valores de secrets.
- Migraciones SQL solo si fix las exige (additivas, vía archivo en supabase/migrations + pgTAP, apply con psql).
- Suite completa + typecheck verdes al cierre.

### Claude's Discretion
- Diseño exacto del lector R2 (clave por listado vs registro source_snapshot).
- Nombres de flags CLI.
- Estructura del runbook.
- Orden de ataque de gaps no-críticos G1–G22 (los CRITICAL G4, G7, G23 son obligatorios).

### Deferred Ideas (OUT OF SCOPE)
- Frescura/alertas por fuente → Phase 58.
- Ingesta de autoría → Phase 59.
- Backfill histórico tabla de sala Cámara.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CRON-02 | G23 sistémico: Etapa-2 R2→Supabase re-ejecutable sin tocar fuentes | Seam diseñado: `R2Store.getObject` + `readSnapshotBody` en `@obs/ingest`; `--from-r2` en cada CLI |
| CRON-03 | Hash-check con salida temprana + log `[skip]` grep-able | Sitios de inserción identificados por conector; ETag no disponible en fuentes gubernamentales (sin evidencia); sha256/412 es el mecanismo viable |
| CRON-04 | Secrets cargados, crons verdes, runbook WAF | Lista exacta de secrets por workflow documentada; lobby-camara runbook diseñado |

</phase_requirements>

---

## Summary

La brecha sistémica es G23: ningún conector de producción implementa la ruta R2→Supabase (Etapa 2). El crudo existe parcialmente en R2 desde corridas manuales locales, pero re-ingestar a Supabase requiere hoy volver a la fuente gubernamental. El fix es añadir `R2Store.getObject` a `@obs/ingest` y un modo `--from-r2 <r2-path>` a cada CLI recurrente que reuse los parsers existentes alimentados desde R2 en vez de fetch.

El bug CRITICAL G4 (`tramitacion_evento` ON CONFLICT error) está a un cambio de una línea de `writer-supabase.ts`: la función `dedupePorClave` ya existe y ya se aplica a votos (líneas 43-47 + 85-88); solo falta aplicarla también a eventos antes del upsert batch (línea 104). La clave natural ya está definida en `writer.ts:74`.

Los secrets faltantes (5 nombres de R2 + DEEPSEEK_API_KEY) bloquean la Etapa 1 en todos los workflows CI. El probidad-weekly falla por la aserción YAML `declaraciones=[1-9]` al llegar 0 confirmados; la causa raíz exacta (SPARQL endpoint o identity matching) requiere logging previo al matching que hoy no existe.

**Primary recommendation:** Atacar en orden: (1) cargar secrets + G4 dedupe fix (desbloquea leyes-weekly inmediatamente), (2) G23 R2 reader seam, (3) probidad assertion redesign, (4) G7 runbook + lobby-camara dispatch-only, (5) hash-check CRON-03.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Descarga crudo de fuentes | CLI / package Node | — | Fetch con rate-limit, robots, UA desde proceso aislado |
| Persistencia crudo versionado | R2 (Cloudflare) | — | Content-addressed, inmutable, verdad cruda fuera de Postgres |
| Parseo + transformación | package Node (parsers existentes) | — | Reutilizados desde ambas etapas (fetch y R2); no se duplican |
| Persistencia derivada | Supabase Postgres | — | Upsert idempotente por clave natural; reconstruible desde R2 |
| Observabilidad de ingesta | source_snapshot + ingest_run (Postgres) | — | 0 filas actualmente; Phase 57 empieza a poblarlas |
| Scheduling | GH Actions (schedule) | pg_cron (futuro) | Actions activas, billing OK; pg_cron fuera de alcance Phase 57 |
| Fallback WAF | Local CLI operador | — | lobby-camara: mismo código CLI, runbook documentado |

---

## Standard Stack

### Core (ya presente, no instalar)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@obs/ingest` (interno) | workspace | BaseConnector, R2Store, SnapshotWriter, sha256Hex | El contrato de dos-etapas; extensión aquí, no en cada paquete |
| `aws4fetch` | ya en `@obs/ingest` | SigV4 para R2 PUT y GET | Nunca hand-roll de firma — T-01-05 |
| `vitest` | workspace | Tests unitarios | Marco existente en todos los paquetes |

### Package Legitimacy Audit

No se instalan paquetes externos nuevos en esta fase. Todos los cambios reusan dependencias existentes del workspace.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (ninguno nuevo) | — | — | — | — | — | — |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### Sistema de dos etapas (flujo de datos)

```
Fuente gubernamental
       │ fetch (rate-limit 2-3s, UA, robots)
       ▼
  [sha256 check vs R2]──→ 412/ya existe ──→ [skip] log ──→ fin Etapa 1
       │ nueva
       ▼
   R2Store.putImmutable(source/resource/date/sha.ext)
       │ r2Path
       ▼
  source_snapshot.write(r2Path, contentHash, provenance)
       │
       ▼
   [parsers existentes] ◄── Etapa 2 normal (desde resultado en memoria)
       │
       ▼
   Supabase upsert
```

```
CLI --from-r2 <r2Path>   (Etapa 2 re-ejecutable)
       │
       ▼
   R2Store.getObject(r2Path) ──→ Uint8Array
       │
       ▼
   [mismos parsers existentes]
       │
       ▼
   Supabase upsert (idempotente)
```

### Recommended Project Structure (cambios Phase 57)

```
packages/ingest/src/
├── r2-store.ts          # añadir getObject() [NUEVA función]
├── r2-store.test.ts     # añadir tests de getObject
└── index.ts             # re-exportar getObject

packages/tramitacion/src/
├── ingest-cli.ts        # añadir --from-r2 flag + lógica Etapa 1 R2
└── writer-supabase.ts   # G4: aplicar dedupePorClave a upsertEventos

packages/lobby/src/
└── ingest-cli.ts        # añadir Etapa 1 R2 write (G10)

packages/agenda/src/
└── run-agenda-prod-cli.ts   # WARN loud si R2 no configurado

packages/probidad/src/
├── run-probidad-todos.ts    # mejorar logging SPARQL count pre-matching
└── run-probidad-todos-cli.ts  # assertion redesign

.github/workflows/
├── lobby-camara-weekly.yml  # deshabilitar schedule, dispatch-only + comentario (G7)
└── (restantes)              # añadir secrets R2_* + DEEPSEEK faltantes en env:

docs/runbooks/
└── cron-local-fallback.md   # runbook WAF + instrucciones gh secret set

supabase/migrations/
└── (solo si el fix de G4 requiere índice/constraint nuevo — evaluar en planificación)
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SigV4 para R2 GET | Firma manual de requests S3 | `AwsClient.sign` de `aws4fetch` (ya en r2-store.ts) | T-01-05: nunca hand-roll de firma |
| Hash de contenido | SHA-256 manual | `sha256Hex` de `@obs/ingest` | Ya existe y usa Web Crypto nativo |
| Parser XML/HTML desde R2 | Duplicar parsers | Reusar `parseSenadoTramitacion`, `parseCamaraLobbyAudiencias`, etc. | La convención LOCKED: parsers se alimentan desde el body crudo, independiente del origen |
| Skip-check por fecha | Re-fetch + comparar | sha256 → R2 `putImmutable` 412 como gate idempotente | Patrón ya establecido en BaseConnector |
| Orchestración de jobs | BullMQ / Redis | GH Actions schedule existente | Todo ya en Supabase/GH; Redis = infra extra prohibida en M1 |

---

## Design Detallado: Etapa-2 Seam (G23)

### 1. `R2Store.getObject` — función nueva en `packages/ingest/src/r2-store.ts`

**Inserción:** después de `putImmutable` (línea 79 del archivo actual).

```typescript
// [ASSUMED] Firma propuesta — verificar que AwsClient.sign acepta método GET
async getObject(r2Path: string): Promise<Uint8Array> {
  const url = `${this.endpoint}/${this.bucket}/${r2Path}`;
  const signed = await this.client.sign(url, { method: "GET" });
  const res = await this.fetchFn(signed);
  if (!res.ok) {
    throw new Error(`R2 GET ${res.status} para ${r2Path}`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}
```

**Re-exportar** en `packages/ingest/src/index.ts` (buscar el bloque de exports de `r2-store`).

**Tests:** `packages/ingest/src/r2-store.test.ts` — añadir describe block `R2Store.getObject`:
- Test: GET 200 devuelve Uint8Array correcta (mock fetch).
- Test: GET 404/500 lanza error (no expone credenciales).
- Patrón de mock: `makeMockFetch` igual que los tests existentes de `putImmutable`.

### 2. `--from-r2 <r2Path>` por conector

**Localización de cambios por paquete:**

| Conector | Archivo | Punto de inserción |
|----------|---------|-------------------|
| tramitacion | `packages/tramitacion/src/ingest-cli.ts` | `parseArgs()` y `main()`: si `--from-r2` presente, llama `r2Store.getObject(r2Path)` → body → `parseSenadoTramitacion` / `parseCamaraVotacion` → writer, sin fetch a fuentes |
| lobby-leylobby | `packages/lobby/src/ingest-cli.ts` | Mismo patrón: `--from-r2` → body → `parseLobbyAudiencias` → writer |
| agenda | `packages/agenda/src/run-agenda-prod-cli.ts` | `--from-r2` → body → parsers de Senado/Cámara existentes |
| probidad | `packages/probidad/src/run-probidad-todos-cli.ts` | `--from-r2` → el JSON agregado se re-parsea: `JSON.parse` → array de responses SPARQL → `parseDeclaraciones` por item → writer |
| lobby-camara | `packages/lobby/src/run-camara-lobby-cli.ts` | `--from-r2` → body (HTML) → `parseCamaraLobbyAudiencias` → writer |

**Nota tramitacion:** el crudo de tramitacion tiene estructura multi-fuente por boletín (tramitación Senado XML + votaciones Cámara XML + detalle). El snapshot R2 debe guardar el crudo COMPLETO (todos los XMLs del run). El modo `--from-r2` re-parsea desde ese agregado. **Diseño alternativo más simple (discretion):** guardar un JSON envelope `{ senado: [...xml], camaraTramitacion: [...xml], camaraDetalle: [...xml] }` por run, idéntico al patrón de probidad (array de crudos).

**Resolución de r2Path en `--from-r2`:** el operador pasa el path explícito (obtenido de `source_snapshot.r2_path` o del log `crudo en R2 → <path>`). No se necesita lookupdb en la Etapa 2 — el path es content-addressed y suficiente.

---

## Design Detallado: Etapa-1 faltante (G5, G10)

### tramitacion — G5

**Archivo:** `packages/tramitacion/src/ingest-cli.ts` (comentario en línea 16: "R2/remoto diferidos.")

**Punto de inserción:** en `main()`, después de cada fetch + parse pero ANTES del upsert writer, invocar:
```typescript
// Pseudocódigo — la estructura exacta depende de cómo se acumula el crudo por boletín
const bytes = new TextEncoder().encode(JSON.stringify({ tramXml, votXml, detalles }));
const sha = await sha256Hex(bytes);
await r2Store.putImmutable("tramitacion", boletin, date, sha, "json", bytes);
```

**Gate R2 en CLI:** `ingest-cli.ts:main()` lee `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_ENDPOINT_URL`/`R2_BUCKET` de `process.env`. Si ausentes en corrida de cron (no dry-run), log WARN loud: `[WARN] R2 no configurado — Etapa 1 omitida (sin crudo versionado)`; continuar con Etapa 2 (no fatal, alineado con run-camara-lobby).

**Patrón de referencia:** `packages/lobby/src/run-camara-lobby.ts:85-105` — exactamente este patrón best-effort con `try/catch` y log de error no-fatal.

### lobby-leylobby — G10

**Archivo:** `packages/lobby/src/ingest-cli.ts` (sin ningún import de R2Store en todo el archivo).

**Cambios:**
1. Añadir `import { R2Store, sha256Hex } from "@obs/ingest";` al top del archivo.
2. En `main()`, después de construir el `conector`, inicializar `r2Store` desde env (mismo gate que tramitacion).
3. Pasar `r2Store` a `runIngestLobby()` — verificar que `RunIngestLobbyOpts` ya tiene o necesita campo `r2Store?: R2Store`.

**Verificación:** `packages/lobby/src/ingest-run.ts` no tiene campo `r2Store` en `RunIngestLobbyOpts` (líneas 41-64). Habrá que añadirlo junto con la llamada a `putImmutable` en el loop de tareas, usando el JSON de audiencias como crudo.

---

## Design Detallado: G4 — Dedupe tramitacion_evento (CRITICAL)

### Root Cause

La función `upsertEventos` en `packages/tramitacion/src/writer-supabase.ts:102-113` envía el lote directamente a Postgres sin deduplicar. El `fusionarTimeline` en `ingest-run.ts:250` puede producir eventos con la misma tupla `(boletin, fecha, camara, tipo, descripcion)` cuando:
- Un boletín tiene múltiples votaciones en el mismo día y cámara con tipo/descripción idénticos.
- El Senado XML repite un evento en distintos trámites que se fusionan.

### Fix: una línea en writer-supabase.ts

**La función `dedupePorClave` ya está definida en el mismo archivo (líneas 43-47).** Solo falta aplicarla:

```typescript
// packages/tramitacion/src/writer-supabase.ts — upsertEventos (línea 102)
async upsertEventos(eventos: TramitacionEvento[]): Promise<void> {
  if (eventos.length === 0) return;
  // AÑADIR: dedup por clave natural antes del upsert (espejo de upsertVotos:85-88)
  const deduped = dedupePorClave(
    eventos,
    (e) => [e.boletin, e.fecha, e.camara, e.tipo, e.descripcion].join("\x00"),
  );
  for (const lote of chunk(deduped, CHUNK)) {   // ← cambiar 'eventos' por 'deduped'
    const { error } = await this.client
      .from("tramitacion_evento")
      .upsert(lote, {
        onConflict: "boletin,fecha,camara,tipo,descripcion",
        ignoreDuplicates: false,
      });
    if (error) throw new Error(`upsert tramitacion_evento falló: ${error.message}`);
  }
}
```

**Nota:** la clave natural en `writer.ts:74` usa ` ` (espacio) como separador — para el dedupe interno puede usarse cualquier separador no ambiguo (se recomienda `\x00` para evitar colisiones de contenido).

**Test reproductor** (vitest, en `packages/tramitacion/src/writer-supabase.test.ts` o nuevo archivo):
```typescript
// Test: upsertEventos con duplicados en el lote NO lanza ON CONFLICT
it("G4: upsertEventos dedup — mismo evento dos veces en el lote no produce error", async () => {
  // fixture: dos eventos idénticos
  const ev: TramitacionEvento = {
    boletin: "18000-05", fecha: "2026-01-10", camara: "camara",
    tipo: "votacion", descripcion: "aprobado en general",
    // ... resto del modelo
  };
  const writer = new InMemoryTramitacionWriter();
  await writer.upsertEventos([ev, ev]); // mismo evento duplicado
  expect(writer.eventos.size).toBe(1);  // deduplicado
});
```

Para el `SupabaseTramitacionWriter` en tests de integración (con cliente mock), verificar que el array enviado a `.upsert()` no tenga duplicados usando un spy.

---

## Design Detallado: Hash-check / salida temprana (CRON-03)

### Estado actual por conector

| Conector | Mecanismo de check actual | Ubicación actual |
|----------|--------------------------|-----------------|
| agenda | ISO-semana key en memoria; no sha256 | `packages/agenda/src/ingest-run.ts` |
| tramitacion | Ninguno | — |
| lobby-leylobby | Ninguno | `packages/lobby/src/ingest-run.ts` |
| probidad | Ninguno | `packages/probidad/src/run-probidad-todos.ts` |
| lobby-camara | Ninguno (curl externo al CLI) | `.github/workflows/lobby-camara-weekly.yml:49` |

### ETag / If-Modified-Since en fuentes gubernamentales

**Hallazgo:** No hay evidencia en fixtures o snapshots de que camara.cl, senado.cl, leylobby.gob.cl o datos.cplt.cl soporten ETag condicional de forma confiable en sus endpoints de datos. [ASSUMED] El WAF de camara.cl y la naturaleza de los endpoints SOAP/REST no garantizan ETag. **Recomendación: sha256 + 412 como mecanismo primario** (ya probado en `putImmutable`).

### Mecanismo sha256 + R2 412-skip

El patrón es: calcular sha256 del body descargado → intentar `putImmutable` → si 412 (ya existía) → el crudo no cambió → skip Etapa 2, emitir log `[skip] sin novedades — <fuente> <recurso>`.

```typescript
// En el flujo de cada conector tras fetch:
const sha = await sha256Hex(body);
const r2Path = await r2Store.putImmutable(source, resource, date, sha, ext, body);
// Si 412 no lanza (tratado como éxito), necesitamos saber SI fue 412:
// Opción A: putImmutable retorna { path, existed: boolean }
// Opción B: verificar si el sha ya existe en source_snapshot antes de fetch
```

**Opción A (discreción):** extender el tipo de retorno de `putImmutable` para incluir `existed: boolean` (412 → `existed: true`). Esto no rompe callers existentes si el return type pasa de `Promise<string>` a `Promise<{ r2Path: string; existed: boolean }>` — requiere actualizar todos los callers.

**Opción B (menos invasiva, discreción):** añadir `putImmutableStatus` como overload que devuelve `{ r2Path: string; existed: boolean }`, manteniendo `putImmutable` original intacto para compatibilidad.

**Log estándar grep-able:** `log(\`[skip] sin novedades — ${source} ${resource}\`)` — exacto, para que Phase 58 y el operador puedan hacer `grep "[skip] sin novedades" <log>`.

### Puntos de inserción por conector

| Conector | Archivo:Línea aprox. | Dónde añadir el check |
|----------|---------------------|----------------------|
| tramitacion | `packages/tramitacion/src/ingest-cli.ts` después del fetch por boletín | Tras descarga de XML senado, antes de parse |
| lobby-leylobby | `packages/lobby/src/ingest-run.ts:~línea 80` (en el loop por tarea+página) | Tras fetch de audiencias, antes de parseLobbyAudiencias |
| probidad | `packages/probidad/src/run-probidad-todos.ts:120` (en el loop por parlamentario) | Sha256 del JSON SPARQL; skip si 412 |
| agenda | `packages/agenda/src/ingest-run.ts` — extender el cache ISO-semana con sha256 | Reemplazar o complementar el check de semana con sha256 del HTML/XML |

---

## Design Detallado: Probidad Assertion (G12)

### Problema

El workflow `probidad-weekly.yml:69-70` hace:
```bash
echo "$OUT" | grep -qE 'declaraciones=[1-9][0-9]*|confirmados=[1-9][0-9]*' \
  || { echo "sin declaraciones/confirmados"; exit 1; }
```

Esto falla si en la semana legítimamente no hay NUEVAS declaraciones (todos los parlamentarios ya tenían la última versión capturada). También no distingue "SPARQL 503" de "identidad no matcheó".

### Fix en dos partes

**Parte 1 — Logging pre-matching en `run-probidad-todos.ts:119-135`:**

Añadir, tras la línea `const json = await opts.conector.fetchSparql(...)`:
```typescript
const rawBindings = (json as { results?: { bindings?: unknown[] } })?.results?.bindings ?? [];
log(`probidad-todos: ${p.id} (${frag}) → SPARQL devolvió ${rawBindings.length} bindings`);
```

Esto hace visible en el log si SPARQL devuelve 0 resultados (problema upstream) vs. si parsea+reconcilia a 0 (problema de identity matching).

**Parte 2 — Redesign del assert en `probidad-weekly.yml`:**

```bash
# Aceptar: (a) declaraciones nuevas, (b) error 0 con todos errores tolerados,
# (c) run vacío honesto (N parlamentarios, 0 nuevas declaraciones esta semana)
echo "$OUT" | grep -qE 'consultados=[1-9][0-9]*' \
  || { echo "probidad: 0 parlamentarios consultados — posible error fatal"; exit 1; }
# El assert de declaraciones pasa a WARNING no-fatal en el log, no exit 1
```

**Alternativa (discreción):** agregar al output del CLI una línea `[ok] probidad consultados=N declaraciones=M errores=K` y hacer el assert sobre `consultados=[1-9]`, que es la señal de que el loop corrió. `declaraciones=0` con `errores=0` es válido (semana sin novedades). `errores=N` con `consultados=N` significa que TODOS fallaron → eso sí debería ser exit 1.

### Causa raíz candidates (2026-07-02)

- **Candidate A (HIGH):** El endpoint SPARQL `datos.cplt.cl/sparql` devolvió 0 bindings para TODOS los fragmentos de apellido. Posible mantenimiento o cambio de schema ontológico. [ASSUMED — no se verificó live]
- **Candidate B (MEDIUM):** El `reconciliarDeclaracionesObjetivo` produjo 0 filas para todos los parlamentarios, indicando un cambio en el formato del label en los bindings SPARQL (OQ3 drift). [ASSUMED]
- **Candidate C (LOW):** La maestra cargada tenía 0 parlamentarios. Improbable (el seed existe y tiene 136 filas).

El logging de `rawBindings.length` en Parte 1 permitirá distinguir A vs B en la próxima corrida.

---

## Design Detallado: Secrets y Workflows (CRON-04)

### Mapa de secrets por workflow

| Workflow | Secrets requeridos | Presentes hoy | Faltantes a cargar |
|----------|--------------------|---------------|-------------------|
| agenda-weekly | `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`, `DEEPSEEK_API_KEY`, `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | 2/7 | `DEEPSEEK_API_KEY`, 4×R2 |
| leyes-weekly | `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY` | 2/2 | **ninguno** (bug es G4, no secrets) |
| lobby-camara-weekly | `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`, 4×R2 | 2/6 | 4×R2 (+ G7: schedule OFF) |
| lobby-leylobby-weekly | `SUPABASE_API_URL`→`SUPABASE_URL`, `SUPABASE_SECRET_KEY`→`SUPABASE_SERVICE_KEY` | 2/2 | **ninguno** (mapeo correcto en YAML) |
| probidad-weekly | `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`, 4×R2 opcionales | 2/6 | 4×R2 (opcionales — habilitarían Etapa 1) |
| fichas-backfill (manual) | +`DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_URL` | 2/9 | `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_URL`, 4×R2 |

**Lista consolidada de secrets a cargar en Cuchecorp/gov-map** (nombres exactos del repo):
```
R2_ENDPOINT_URL
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
DEEPSEEK_API_KEY
```

Los 5 se leen de `.env` local con `gh secret set --repo Cuchecorp/gov-map -e <nombre> -b <valor>` o vía `gh secret set --env-file .env`. [ASSUMED — verificar exact `gh secret set` syntax; los nombres de env en `.env` deben coincidir con los nombres de secret del repo]

**G7 — lobby-camara-weekly.yml cambio mínimo:**
```yaml
# ANTES:
on:
  schedule:
    - cron: "0 11 * * 2"
  workflow_dispatch:

# DESPUÉS:
on:
  # WAF de camara.cl bloquea IPs de GH Actions desde al menos 2026-06-30 (G7 del audit Phase 56).
  # El curl devuelve 5463 bytes < gate 10KB → el paso de descarga falla antes del CLI.
  # Schedule DESHABILITADO: usar dispatch manual solo cuando el operador confirme que el WAF permite GH.
  # Fallback: docs/runbooks/cron-local-fallback.md
  workflow_dispatch:
```

**Runbook `docs/runbooks/cron-local-fallback.md`** — secciones sugeridas:
1. Prerequisitos (`.env` con creds, pnpm, node 22).
2. Lobby Cámara: `pnpm --filter @obs/lobby exec tsx src/run-camara-lobby-cli.ts --html-file /tmp/lobby.html` con instrucciones de descarga previa con curl.
3. `gh secret set` cookbook — cómo cargar/actualizar secrets del repo desde `.env` local.
4. Re-habilitar schedule lobby-camara: editar el YAML y pushear.
5. Verificación post-corrida: comandos psql para verificar frescura.

**Nota sobre `backup-parlamentario.yml` G19 (startup_failure):** el failure fue en un push event, no en el schedule. Las corridas scheduled son exitosas. Verificar con `actionlint .github/workflows/backup-parlamentario.yml` antes del cierre de la fase — si el linter pasa, el issue es episódico y no requiere fix.

---

## Common Pitfalls

### Pitfall 1: putImmutable retorna void-like — no indica si fue 412

**What goes wrong:** el caller no sabe si el crudo ya existía (412) o fue nuevo (200/201), por lo tanto no puede implementar skip de Etapa 2 correctamente.
**Why it happens:** el contrato actual de `putImmutable` solo retorna el r2Path (string), tratando 412 como éxito silencioso.
**How to avoid:** extender el tipo de retorno o añadir overload (ver Opciones A/B arriba). Elegir antes de implementar para que todos los callers sean consistentes.

### Pitfall 2: `--from-r2` con crudo multi-boletín (tramitacion)

**What goes wrong:** tramitacion acumula XMLs de múltiples boletines en un run; un solo r2Path contiene el crudo de todos. Al re-ingestar con `--from-r2`, hay que re-procesar el envelope completo, no un boletín individual.
**How to avoid:** el modo `--from-r2` en tramitacion re-corre el loop completo desde el JSON envelope. El flag `--boletines` puede filtrar qué procesar del envelope si se desea re-ingestar solo algunos.

### Pitfall 3: dedupePorClave en writer-supabase.ts — separador de clave

**What goes wrong:** si algún campo de la clave natural contiene el separador ` ` (espacio), la clave puede colisionar entre eventos distintos. La clave actual en `writer.ts:74` usa espacio.
**How to avoid:** usar `\x00` (NUL) o `\x1F` (US separator) como separador en la clave de Map para el dedupe, que es distinto del separador de `eventoKey` en el writer.ts (solo afecta al Map interno, no al onConflict de Postgres).

### Pitfall 4: lobby-leylobby SUPABASE_URL vs SUPABASE_API_URL

**What goes wrong:** el CLI de leylobby lee `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` (`ingest-cli.ts:110`), pero el repo de CI tiene `SUPABASE_API_URL`/`SUPABASE_SECRET_KEY`. El YAML ya mapea correctamente (`SUPABASE_URL: ${{ secrets.SUPABASE_API_URL }}`). Si alguien añade código que lea directamente `process.env.SUPABASE_API_URL` en ese CLI, dejará de funcionar.
**How to avoid:** mantener el mapping en el YAML; no cambiar los nombres de env que lee el CLI de leylobby.

### Pitfall 5: Probidad SPARQL — 0 resultados honesto vs. drift

**What goes wrong:** en una semana sin novedades en InfoProbidad, todos los parlamentarios pueden devolver `declaraciones=0` (todos ya ingeridos con la misma versión). El assert actual `declaraciones=[1-9]` interpreta esto como fallo.
**How to avoid:** el assert solo debe verificar que el loop CORRIÓ (`consultados>0`), no que produjo declaraciones nuevas.

---

## Code Examples

### R2Store.getObject (nuevo)

```typescript
// packages/ingest/src/r2-store.ts — añadir tras putImmutable
// [ASSUMED] Patrón SigV4 GET — mismo que PUT con método GET
async getObject(r2Path: string): Promise<Uint8Array> {
  const url = `${this.endpoint}/${this.bucket}/${r2Path}`;
  const signed = await this.client.sign(url, { method: "GET" });
  const res = await this.fetchFn(signed);
  if (!res.ok) {
    throw new Error(`R2 GET ${res.status} para ${r2Path}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}
```

### Hash-check early-exit pattern

```typescript
// Patrón para cualquier conector tras fetch del body
const sha = await sha256Hex(body);
const { r2Path, existed } = await r2Store.putImmutableStatus(source, resource, date, sha, ext, body);
if (existed) {
  log(`[skip] sin novedades — ${source} ${resource}`);
  return; // Etapa 2 skip
}
// ... parsear + upsert Supabase
```

### Dedupe tramitacion_evento (G4 fix)

```typescript
// packages/tramitacion/src/writer-supabase.ts — upsertEventos
async upsertEventos(eventos: TramitacionEvento[]): Promise<void> {
  if (eventos.length === 0) return;
  const deduped = dedupePorClave(
    eventos,
    (e) => [e.boletin, e.fecha, e.camara, e.tipo, e.descripcion].join("\x00"),
  );
  for (const lote of chunk(deduped, CHUNK)) {
    const { error } = await this.client
      .from("tramitacion_evento")
      .upsert(lote, { onConflict: "boletin,fecha,camara,tipo,descripcion", ignoreDuplicates: false });
    if (error) throw new Error(`upsert tramitacion_evento falló: ${error.message}`);
  }
}
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (workspace) |
| Config file | `vitest.config.ts` (raíz) o por paquete |
| Quick run command | `pnpm --filter @obs/ingest test` / `pnpm --filter @obs/tramitacion test` |
| Full suite command | `pnpm test` (raíz) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CRON-02 | R2Store.getObject retorna Uint8Array correcta | unit | `pnpm --filter @obs/ingest test -- r2-store` | ❌ Wave 0 |
| CRON-02 | CLI `--from-r2` pasa body a parsers sin fetch | unit | `pnpm --filter @obs/tramitacion test -- ingest-cli` | ❌ Wave 0 (extender fixture existente) |
| CRON-03 | Hash-check: segundo run con mismo body emite `[skip]` | unit | `pnpm --filter @obs/tramitacion test -- hash-check` | ❌ Wave 0 |
| CRON-04 | G4: `upsertEventos` con dupes en batch no lanza ON CONFLICT | unit | `pnpm --filter @obs/tramitacion test -- writer-supabase` | ❌ Wave 0 |
| CRON-04 | Workflow GH leyes-weekly corre sin error (post-secret load) | smoke/manual | `gh workflow run leyes-weekly.yml --repo Cuchecorp/gov-map` | N/A (manual) |

### Sampling Rate

- **Per task commit:** `pnpm --filter @obs/<pkg> test --run`
- **Per wave merge:** `pnpm test` (suite completa raíz)
- **Phase gate:** Full suite green + `pnpm tsc -b` typecheck antes de `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/ingest/src/r2-store.test.ts` — añadir describe `R2Store.getObject` (extender archivo existente)
- [ ] `packages/tramitacion/src/writer-supabase.test.ts` — test G4 reproductor (archivo nuevo o extender)
- [ ] `packages/tramitacion/src/ingest-cli.test.ts` — test `--from-r2` mode (extender archivo existente)

---

## Runtime State Inventory

> Fase de hardening de ingesta: rename/refactor no aplica. Sin embargo, hay estado runtime relevante para no romper.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `source_snapshot`: 0 filas; `ingest_run`: 0 filas; `probidad_ingesta_estado`: 136 filas con `ingestado_hasta=2026-06-22` | Phase 57 empieza a poblar source_snapshot al cargar secrets R2; probidad se actualiza en el próximo run exitoso |
| Live service config | 5 GH Actions workflows activos en Cuchecorp/gov-map | Secrets a añadir vía `gh secret set`; lobby-camara schedule a deshabilitar |
| OS-registered state | None — ningún Windows Task Scheduler / pm2 / systemd involucrado | None |
| Secrets/env vars | `.env` local tiene los 5 secrets faltantes (R2_*, DEEPSEEK); confirmado por MEMORY.md "R2 S3 OK al 2026-06-20" | Cargar al repo CI con `gh secret set` sin imprimir valores |
| Build artifacts | None — no hay binarios compilados ni npm installs globales relevantes | None |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `gh` CLI | secret set, workflow dispatch | ✓ | verificado en Phase 56 | — |
| pnpm | install + test | ✓ | workspace | — |
| Node 22 | tsx / CLI | ✓ (GH Actions setup-node@v4) | 22 | — |
| R2 bucket "observatorio" | Etapa 1 crudo | ✓ | activo (Phase 56 probe SigV4) | — |
| datos.cplt.cl/sparql | probidad SPARQL | UNKNOWN | — | Ver Pitfall 5; fix assertion para no fallar en 0 |
| camara.cl transparencia | lobby-camara | ✗ (WAF en GH Actions) | — | Local runbook (G7) |

**Missing dependencies con fallback:**
- `datos.cplt.cl/sparql`: reachability incierta; el fix de assertion (consultados>0, no declaraciones>0) hace el cron tolerante a una semana honestamente vacía.

---

## Open Questions

1. **`putImmutable` return type: Opción A vs B**
   - What we know: actualmente retorna `Promise<string>` (el r2Path); 412 es éxito silencioso.
   - What's unclear: si cambiar el tipo de retorno a `{ r2Path: string; existed: boolean }` rompe callers existentes que esperan `string`.
   - Recommendation: revisar todos los callers de `putImmutable` antes de decidir. Si son todos internos al workspace y no muchos, Opción A (cambio directo) es más limpio.

2. **Tramitacion: crudo por boletín vs. crudo por run**
   - What we know: probidad usa "crudo agregado por run" (un solo JSON con todos los responses).
   - What's unclear: para tramitacion, que procesa N boletines con múltiples XMLs cada uno, un crudo por run es voluminoso. Un crudo por boletín permite re-ingestar boletines individuales pero crea N objetos R2 por run.
   - Recommendation: crudo por boletín (más granular, permite re-ingestar `--boletines X --from-r2 <path-de-X>`) con un envelope `{ boletin, tramXml, votXml, detalles: string[] }`.

3. **datos.cplt.cl/sparql — reachability 2026-07-08**
   - What we know: el run de 2026-07-02 produjo 0 declaraciones; la tabla `probidad_ingesta_estado` no se actualizó.
   - What's unclear: si el endpoint está caído/modificado o si fue un problema de identity matching en ese run.
   - Recommendation: el fixture de logging propuesto (rawBindings.length por parlamentario) aclarará esto en la próxima corrida, sin necesidad de probe live ahora.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ETag/If-Modified-Since no disponibles en fuentes gubernamentales; sha256+412 es el mecanismo viable | Hash-check | Si las fuentes sí soportan ETag, sha256 sigue funcionando pero descarga el body antes del check — ineficiente, no incorrecto |
| A2 | `AwsClient.sign` acepta `{ method: "GET" }` para R2 GetObject | R2Store.getObject | Si la firma SigV4 difiere para GET, la implementación de getObject necesita ajuste; aws4fetch maneja GET/PUT/HEAD — LOW riesgo |
| A3 | datos.cplt.cl/sparql accessible desde GH Actions (sin WAF) | Probidad | Si el SPARQL endpoint introdujo bloqueo por IP de GH, la fase requiere investigación adicional |
| A4 | Cargar 5 secrets al repo no tiene efectos secundarios en workflows que ya corren | Secrets CRON-04 | LOW — los secrets solo se leen cuando el YAML los referencia; no hay sideeffect |
| A5 | `gh secret set` acepta `--env-file .env` o `gh secret set -e <nombre> -b $(grep NOMBRE .env | cut -d= -f2)` | Runbook | Verificar exact syntax de `gh` version instalada; la clave es que los valores NUNCA se impriman |

---

## Sources

### Primary (HIGH confidence)
- `packages/ingest/src/r2-store.ts` (leído en esta sesión) — R2Store.putImmutable, sha256Hex, R2Config
- `packages/ingest/src/base-connector.ts` (leído en esta sesión) — flujo invariante, ConnectorDeps
- `packages/ingest/src/snapshot.ts` (leído en esta sesión) — SnapshotWriter, SnapshotWrite
- `packages/tramitacion/src/writer-supabase.ts` (leído en esta sesión) — dedupePorClave (ya existe), upsertEventos (sin dedupe — G4)
- `packages/tramitacion/src/writer.ts` (leído en esta sesión) — eventoKey (clave natural definida en línea 74)
- `packages/tramitacion/src/ingest-cli.ts` (leído en esta sesión) — comentario "R2/remoto diferidos" línea 16
- `packages/tramitacion/src/run-tramitacion-prod-cli.ts` (leído en esta sesión) — loadEnv, boletinesARefrescar
- `packages/lobby/src/ingest-cli.ts` (leído en esta sesión) — sin import R2Store, G10 confirmado
- `packages/lobby/src/run-camara-lobby.ts` (leído en esta sesión) — patrón Etapa 1 best-effort líneas 85-105
- `packages/probidad/src/run-probidad-todos.ts` (leído en esta sesión) — crudos acumulados, Etapa 1, confirmados
- `packages/probidad/src/run-probidad-todos-cli.ts` (leído en esta sesión) — loadEnv, R2 gate
- `packages/probidad/src/sparql.ts` (leído en esta sesión) — INFOPROBIDAD_SPARQL_URL, queryDeclaracionesPorNombre
- `.github/workflows/leyes-weekly.yml` (leído en esta sesión) — solo 2 secrets, sin R2
- `.github/workflows/agenda-weekly.yml` (leído en esta sesión) — 7 secrets, 5 faltantes
- `.github/workflows/lobby-leylobby-weekly.yml` (leído en esta sesión) — mapeo env correcto, assert audiencias
- `.github/workflows/lobby-camara-weekly.yml` (leído en esta sesión) — gate curl 10KB, líneas 49-54
- `.github/workflows/probidad-weekly.yml` (leído en esta sesión) — assert declaraciones line 69
- `packages/ingest/src/r2-store.test.ts` (leído en esta sesión) — patrón makeMockFetch para nuevos tests
- `.planning/phases/56-cron-audit-auditor-a-e2e-de-los-9-workflows-de-ingesta/56-CRON-AUDIT.md` (leído en esta sesión) — gap-list G1–G23 con archivo:línea
- `57-CONTEXT.md` (leído en esta sesión) — decisiones locked

### Secondary (MEDIUM confidence)
- `packages/tramitacion/src/ingest-run.ts` (leído en esta sesión) — flujo runIngest, fusionarTimeline, upsertEventos call en línea 263
- `packages/lobby/src/ingest-run.ts` (leído parcialmente) — RunIngestLobbyOpts sin r2Store (confirmado G10)
- `packages/agenda/src/ingest-run.ts` (leído parcialmente) — TablaR2Target interface, hash-check ISO-semana parcial

---

## Metadata

**Confidence breakdown:**
- G4 fix (dedupe): HIGH — código leído, función existe, fix es una línea
- G23 seam design (R2 reader): HIGH — patrón claro, aws4fetch ya presente
- Etapa 1 tramitacion/leylobby: HIGH — puntos de inserción localizados, patrón de run-camara-lobby como referencia
- Hash-check mechanism: MEDIUM — ETag no verificado en fuentes; sha256+412 es el único mecanismo confirmado disponible
- Probidad assertion redesign: MEDIUM — causa raíz no confirmada (A3); fix de logging es seguro independientemente
- Secrets list: HIGH — nombres exactos del YAML leídos directamente
- G7 lobby-camara: HIGH — comportamiento WAF confirmado en audit Phase 56

**Research date:** 2026-07-08
**Valid until:** 2026-08-07 (30 días — stack estable)
