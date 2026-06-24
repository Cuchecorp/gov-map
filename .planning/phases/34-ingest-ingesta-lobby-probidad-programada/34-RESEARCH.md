# Phase 34: INGEST — Ingesta lobby + probidad programada — Research

**Researched:** 2026-06-24
**Domain:** GitHub Actions wiring de 3 CLIs ETL ya completos + wire de provenance R2 en probidad
**Confidence:** HIGH (todo verificado contra código real del repo)

## Summary

Phase 34 es una **transcripción de un diseño LOCKED** (MILESTONE-v4-cruces §1.1). Tres CLIs ETL ya están completos y CI-safe (loadEnv parcheado en Phase 33). El trabajo es: (1) crear 3 workflows de GitHub Actions copiando el patrón de `agenda-weekly.yml`/`leyes-weekly.yml`; (2) añadir un bloque R2 best-effort a `run-probidad-todos.ts` espejando `run-camara-lobby.ts` L88–105; (3) wirear la provenance run-level a `source_snapshot` vía `SnapshotWriter`.

**Hallazgo crítico (gap de API):** `SnapshotWriter` existe en `@obs/ingest` pero **la ÚNICA implementación concreta de `SnapshotStore` vive inline en el Deno worker** (`supabase/functions/ingest-worker/worker.ts` L197–228, usando `supabase-js`). NO existe un `SupabaseSnapshotStore` reusable desde Node/tsx. Los CLIs corren en Node vía tsx, no Deno. Por tanto INGEST-04 requiere **construir un `SnapshotStore` Node-side** (≈30 líneas, supabase-js `.from("source_snapshot").insert(row).select("id").single()` con manejo de 23505) — no solo "wirear" algo que ya existe. Esto NO es DDL nuevo (la tabla 0002 existe), pero sí es código nuevo. El diseño lo describe como "wirearlos a SnapshotWriter" subestimando que falta el store concreto.

**Primary recommendation:** Construir 3 workflows + un `SnapshotStore` Node-side compartido + el bloque R2 en probidad. Cero migraciones. Cero DDL. Todo validable por `workflow_dispatch` + `--dry-run` sin encender LIVE (los runs LIVE necesitan secrets de operador = checkpoint humano).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Scheduling de ingesta | GitHub Actions (CI) | — | Crawls largos / recurrentes fuera de Edge Functions (CLAUDE.md regla orquestación) |
| Fetch anti-WAF Cámara | CI shell (`curl`) | CLI `--html-file` | Node fetch (undici) bloqueado por TLS fingerprint; curl pasa |
| ETL parse→reconcile→write | CLI Node/tsx (`@obs/lobby`,`@obs/probidad`) | — | Código ya completo, deterministic-only |
| Provenance run-level (R2 ref) | `source_snapshot` (Postgres) + `SnapshotWriter` | R2Store (crudo) | FND-08; tabla 0002 existente; NO `crudo_r2_key` paralelo |
| Crudo inmutable | Cloudflare R2 (`R2Store.putImmutable`) | — | Etapa 1 LOCKED, content-addressed |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INGEST-01 | `lobby-camara-weekly` dispatch manual: curl anti-WAF (fail <10KB) + `--html-file`, loguea `audiencias=N>0`, escribe `lobby_audiencia` `estado_vinculo='confirmado'` | CLI `run-camara-lobby-cli.ts` YA soporta `--html-file` (L79–88) y `--dry-run`; output line L123–127 imprime `audiencias=N` |
| INGEST-02 | `lobby-leylobby-weekly` (solo ejecutivo): `audiencias=N>0` o degrada honesto `LeylobbyBloqueadaError` | `ingest-cli.ts` corre `runIngestLobby`; `LeylobbyBloqueadaError` capturada en `ingest-run.ts` L108–111 → degradación honesta (NO error, exit 0). CLI imprime `audiencias=…degradaciones=…` |
| INGEST-03 | `probidad-weekly` ~155–200 SPARQL rate-limit 3s, loguea `declaraciones/bienes/confirmados>0`, filas `declaracion` con `parlamentario_id` no nulo | `run-probidad-todos-cli.ts` + `run-probidad-todos.ts`; output L97–101 imprime `declaraciones=…bienes=…confirmados=…`. Rate-limit lo aplica `HostRateLimiter` del conector (sin sleeps manuales) |
| INGEST-04 | Tras run LIVE, `source_snapshot` 1 fila/run con `r2_path` poblado vía `SnapshotWriter`; añadir bloque R2 a `run-probidad-todos.ts` | `source_snapshot` DDL en 0002 (L22–36) existe. `SnapshotWriter` en `snapshot.ts`. **GAP:** falta `SnapshotStore` Node-side (solo existe inline en Deno worker) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **NUNCA `supabase db push`** — DDL solo por `psql --db-url --single-transaction`. **Phase 34 NO crea migraciones** (confirmado: usa `source_snapshot` 0002 existente).
- **Ingesta en DOS ETAPAS:** Etapa 1 Fuente→R2 crudo content-addressed; Etapa 2 R2→Supabase. El bloque R2 nuevo de probidad es Etapa 1.
- **Rate-limit 2–3s/host, User-Agent identificatorio, robots.txt** — ya aplicado por `HostRateLimiter`/`RobotsGuard` dentro de los conectores; NO añadir sleeps en CI.
- **`packageManager: pnpm@11.3.0`**; CI usa `pnpm install --frozen-lockfile --ignore-scripts`; tsx en CI; secrets vía `${{ secrets.* }}` mapeados a `env:` del job (NUNCA en `if:` ni interpolados en shell).

## Findings 1 — Firmas y comportamiento de los 3 CLIs (verificado)

### (a) `packages/lobby/src/run-camara-lobby-cli.ts` — INGEST-01
- **Flags:** `--dry-run`, `--html-file <ruta>`. (L73, L79). No tiene `--limit`.
- **loadEnv (post-Phase 33):** `process.env` tiene PRECEDENCIA; sin `.env` no falla (try/catch L43–51). Lee `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT_URL`, `R2_BUCKET` (L52–61).
- **`--html-file` confirmado:** cuando se pasa, el conector es un stub `{ fetchListado: async () => readFileSync(htmlFile) }` (L80–81) → bypassa el WAF. **Este es el camino obligado en CI** (Node fetch bloqueado).
- **R2 wiring HOY:** `r2Store` solo se construye si `!dryRun && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_ENDPOINT_URL` (L94–101). Se pasa a `runCamaraLobby`. **Pero `r2Path` se DESCARTA** — solo se imprime (L126), nunca se escribe a `source_snapshot`. INGEST-04 debe cerrar esto (ver Findings 2).
- **Output:** `camara-lobby DRY-RUN|LIVE: audiencias=N contrapartes=N confirmados=N marcados=N r2Path=…` (L123–127). El assert del workflow parsea `audiencias=`.
- **Invocación CI:** `pnpm --filter @obs/lobby exec tsx src/run-camara-lobby-cli.ts --html-file /tmp/lobby.html`.
- **`estado_vinculo='confirmado'`:** lo escribe `SupabaseLobbyWriter` (writer-supabase.ts L53, campo `estado_vinculo`); los confirmados salen del match determinista en `reconciliarSujeto`.

### (b) `packages/lobby/src/ingest-cli.ts` (LeyLobby) — INGEST-02
- **Flags:** `--institucion CODE` (default `AA001`), `--anio YYYY` (default año actual), `--paginas N` (default 1), `--dry-run` (L65–102). Valida flags ANTES de tocar red/DB (`LobbyCliArgsError`, exit 2).
- **Env:** lee `SUPABASE_DB_URL`/`SUPABASE_URL` (url) y `SUPABASE_SERVICE_KEY`/`SUPABASE_LOCAL_SERVICE_KEY` (key) de `process.env` (L110–115). **OJO: nombres de env DISTINTOS** a los del CLI de Cámara (`SUPABASE_API_URL`/`SUPABASE_SECRET_KEY`). Sin key → degrada a dry-run automático (L123–126). El workflow debe mapear ambos sets o el operador debe alinear secrets. **RIESGO a verificar en plan:** confirmar qué nombre de secret existe en el repo (agenda-weekly usa `SUPABASE_API_URL`/`SUPABASE_SECRET_KEY`).
- **Degradación honesta `LeylobbyBloqueadaError`:** definida en `connector-leylobby.ts` L44–50, lanzada en L117 (403/503). Capturada en `ingest-run.ts` L108–111 / L145 → empuja a `degradaciones[]`, **NO a `errores[]`** (bloqueada ≠ error). El CLI imprime por cada una `ingest-lobby: DEGRADA [fuente]: motivo` (L163) y la línea final `audiencias=N …degradaciones=N`. **Exit code:** `process.exit(r.errores.length > 0 ? 1 : 0)` (L193) → una degradación honesta es exit 0. El assert del workflow debe aceptar `audiencias=N>0` **O** `degradaciones>0` (no fallar por degradación).
- **Invocación CI:** `pnpm --filter @obs/lobby exec tsx src/ingest-cli.ts --institucion <CODE> --anio <YYYY>`.
- **Alcance LOCKED:** solo instituciones del ejecutivo (Cámara/Senado NO publican en leylobby.gob.cl). Sin WAF → fetch nativo OK, sin `--html-file`.

### (c) `packages/probidad/src/run-probidad-todos-cli.ts` — INGEST-03
- **Flags:** `--dry-run`, `--limit N` (L61–63). loadEnv post-Phase 33 (L36–51) lee solo `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY` (L47). **NO lee R2 hoy** — hay que añadirlo (Findings 2).
- **Sin WAF:** InfoProbidad SPARQL (`datos.cplt.cl/sparql`) responde a fetch de Node. Sin `--html-file`.
- **Rate-limit:** `HostRateLimiter` del conector (run-probidad-todos.ts L18 comment). ~155–200 queries × 2–3s ≈ 6–10 min, dentro de límites GH.
- **Output:** `probidad-todos DRY-RUN|LIVE: consultados=N declaraciones=N bienes=N familiares=N confirmados=N errores=N` (L97–101). Assert parsea `declaraciones=`/`confirmados=`.
- **Tolerante:** un parlamentario que falla se anota en `errores[]` y NO aborta (run-probidad-todos.ts L111–114).
- **Invocación CI:** `pnpm --filter @obs/probidad exec tsx src/run-probidad-todos-cli.ts` (sin `--limit` = todos).

## Findings 2 — R2 / SnapshotWriter / source_snapshot (el wire de provenance, INGEST-04)

### Cómo `run-camara-lobby.ts` usa R2 HOY (L85–105) — el espejo a copiar en probidad
```ts
let r2Path: string | null = null;
if (opts.r2Store) {
  try {
    const bytes = new TextEncoder().encode(html);
    const sha = await sha256Hex(bytes);                 // de @obs/ingest
    r2Path = await opts.r2Store.putImmutable(
      "camara-lobby", "listadodeaudiencias", date, sha, "html", bytes,
    );
    log(`camara-lobby: crudo en R2 → ${r2Path}`);
  } catch (err) {
    r2Path = null;                                       // best-effort, NO fatal
    log(`camara-lobby: Etapa 1 R2 falló (no fatal): ${(err as Error).message}`);
  }
}
```
- **`R2Store.putImmutable(source, resource, date, sha, ext, body)`** → `Promise<string>` (key). Verificado en `r2-store.ts` L55–79. Key = `{source}/{resource}/{date}/{sha}.{ext}`; `If-None-Match: *`; 412 = idempotente OK.
- **`R2Store` constructor:** `new R2Store({ accessKeyId, secretAccessKey, endpoint, bucket })` (r2-store.ts L38). Probidad CLI debe construirlo desde env igual que el CLI de Cámara (run-camara-lobby-cli.ts L94–101).
- **Para probidad el crudo es JSON SPARQL**, no HTML. Una corrida = N queries (una por parlamentario). Decisión de diseño para el plan: **¿un snapshot por query o un snapshot agregado por run?** El diseño dice "una fila por run con `r2_path` poblado" (INGEST-04 / ACCEPTANCE 4) → recomendar **un crudo agregado por run** (concatenar/array de responses, o el último) para tener UN `r2_path` representativo. Marcar como decisión de implementación en el plan.

### `SnapshotWriter` — firma real (snapshot.ts)
```ts
new SnapshotWriter(store: SnapshotStore)
writer.write(input: SnapshotWrite): Promise<SnapshotRef>

interface SnapshotWrite {
  source: string; resource: string; cacheKey: string;
  r2Path: string; contentHash: string; fingerprint: string;
  dateBucket: string; provenance: Provenance;  // { sourceUrl, fetchedAt }
  ingestRunId?: number;
}
interface SnapshotStore { insertSnapshot(row): Promise<{ id: number }>; }
```

### GAP CRÍTICO — falta un `SnapshotStore` Node-side
- `SnapshotWriter` NO sabe hablar con Postgres por sí solo: necesita un `SnapshotStore.insertSnapshot`.
- **La única implementación concreta** está inline en el **Deno** Edge worker `supabase/functions/ingest-worker/worker.ts` L197–228 (usa `supabase-js`, maneja 23505 unique-violation como idempotente).
- Los CLIs corren en **Node/tsx** y usan `@supabase/supabase-js` `createClient` (writer-supabase.ts L17). **Hay que construir un `SnapshotStore` Node-side** que mapee el patrón del worker:
  ```ts
  const sb = createClient(env.SUPABASE_API_URL, env.SUPABASE_SECRET_KEY);
  const store: SnapshotStore = {
    async insertSnapshot(row) {
      const { data, error } = await sb.from("source_snapshot")
        .insert(row).select("id").single();
      if (error?.code === "23505") { /* leer fila existente, idempotente */ }
      if (error) throw new Error(`insert source_snapshot: ${error.message}`);
      return { id: data.id };
    },
  };
  ```
- **Recomendación:** crear un helper compartido (p.ej. `packages/ingest/src/snapshot-store-supabase.ts`) exportado desde `@obs/ingest`, reusable por ambos CLIs (Cámara + probidad), espejando el manejo de 23505 del worker. Evita duplicar la lógica en cada CLI.

### `source_snapshot` DDL (0002, existente — NO tocar)
Columnas: `id`, `ingest_run_id`, `source`, `resource`, `cache_key`, `r2_path NOT NULL`, `content_hash NOT NULL`, `fingerprint NOT NULL`, `source_url NOT NULL`, `fetched_at`, `date_bucket NOT NULL`. **Unique `(source, resource, date_bucket)`** = caché diaria: un snapshot por día por recurso (re-correr el mismo día → 23505 → idempotente). RLS deny-by-default (solo service role escribe — el CLI usa la service key, OK).
- **Campos NOT NULL a poblar:** `fingerprint` y `cache_key` no los produce hoy ningún CLI. El plan debe decidir valores (p.ej. `fingerprint` = sha del crudo o un fingerprint estructural simple; `cache_key` = `source:resource:date`). Verificar contra cómo el worker los rellena.
- **CONFIRMADO: NO se requiere DDL nuevo.** La tabla cubre el caso. NO añadir `crudo_r2_key` a `*_ingesta_estado` (corrección de validador). Si el plan descubriera que falta una columna en `source_snapshot`, eso sería **cambio de alcance** (DDL por psql) → marcar como riesgo, no ejecutar dentro de esta fase.

## Findings 3 — Patrón de los 3 workflows YAML (copiar agenda-weekly.yml)

**Esqueleto común** (de agenda-weekly.yml L30–71): `checkout@v4` → `pnpm/action-setup@v4` → `setup-node@v4` (node 22, cache pnpm) → `pnpm install --frozen-lockfile --ignore-scripts` → step de run con secrets en `env:`.

### `lobby-camara-weekly.yml` (INGEST-01) — con curl anti-WAF
```yaml
- name: Descargar crudo Cámara (curl anti-WAF)
  run: |
    curl -sS -A 'Bot-Ciudadano/1.0' \
      -o /tmp/lobby.html \
      'https://www.camara.cl/transparencia/listadodeaudiencias.aspx'
    SIZE=$(stat -c%s /tmp/lobby.html)
    echo "lobby.html = $SIZE bytes"
    if [ "$SIZE" -lt 10240 ]; then echo "WAF/respuesta < 10KB"; exit 1; fi
- name: Run lobby Cámara
  env:
    SUPABASE_API_URL: ${{ secrets.SUPABASE_API_URL }}
    SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}
    R2_ENDPOINT_URL: ${{ secrets.R2_ENDPOINT_URL }}
    R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
    R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
    R2_BUCKET: ${{ secrets.R2_BUCKET }}
  run: |
    OUT=$(pnpm --filter @obs/lobby exec tsx src/run-camara-lobby-cli.ts --html-file /tmp/lobby.html)
    echo "$OUT"
    echo "$OUT" | grep -qE 'audiencias=[1-9][0-9]*' || { echo "audiencias=0"; exit 1; }
```

### `lobby-leylobby-weekly.yml` (INGEST-02) — sin WAF, acepta degradación
- Sin curl. Run directo. **El assert debe aceptar degradación honesta:** `audiencias=N>0` O `degradaciones>0` (no fallar). Exit del CLI ya es 0 si solo hubo degradaciones.
- Cuidar nombres de env (ver Findings 1b): el CLI lee `SUPABASE_URL`/`SUPABASE_DB_URL` y `SUPABASE_SERVICE_KEY`/`SUPABASE_LOCAL_SERVICE_KEY`, NO `SUPABASE_API_URL`/`SUPABASE_SECRET_KEY`. **Mapear ambos** en `env:` para robustez:
  `SUPABASE_URL: ${{ secrets.SUPABASE_API_URL }}` + `SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}`.

### `probidad-weekly.yml` (INGEST-03) — SPARQL, sin WAF, +R2
- Run directo `pnpm --filter @obs/probidad exec tsx src/run-probidad-todos-cli.ts`.
- env: `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY` + (tras el wire) los 4 `R2_*`.
- Assert: `grep -qE 'confirmados=[1-9]'` o `declaraciones=[1-9]`.
- **Schedule:** elegir un día distinto a agenda(lun)/leyes(vie) para no solapar. Sugerencia: lobby-camara mar, leyleylobby mié, probidad jue (cron `0 NN * * D`). Todos con `workflow_dispatch` + `concurrency` group (como leyes-weekly L31–33) para evitar runs solapados.

**Convenciones de seguridad obligatorias (de agenda-weekly L63–66):** inputs por ENV, nunca interpolados en el shell de un step que lleva secrets (evita inyección de comandos). En estos 3 workflows hay pocos inputs; si se añaden (`--limit`, `--institucion`), pasarlos por `env:` y leer `$VAR`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Anti-WAF Cámara | Puppeteer / reintentos de fetch undici | `curl -A` en el step + `--html-file` | TLS fingerprint; CLI ya soporta `--html-file` (L79) |
| Insert a source_snapshot | SQL crudo / DDL nuevo | `SnapshotWriter` + `SnapshotStore` supabase-js (espejo worker L197–228) | Maneja 23505 idempotente; tabla 0002 existe |
| Rate-limit en CI | `sleep 3` entre queries | `HostRateLimiter` del conector (ya activo) | Ya aplicado en el orden LOCKED de @obs/ingest |
| R2 put | SDK S3 a mano | `R2Store.putImmutable` (de @obs/ingest) | content-addressed, If-None-Match, 412 idempotente |

## Runtime State Inventory

No es una fase de rename/refactor — es wiring de CI. Inventario acotado a estado externo relevante:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Live service config | 3 GitHub Actions workflows NUEVOS (no en git aún). Secrets de repo (`SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`, `R2_*`) ya en agenda-weekly — reusables. | Crear los 3 .yml. Verificar que los secrets existen en el repo destino (Cuchecorp/gov-map: secrets NO se transfieren — operador re-carga, ver MEMORY crons-y-transfer). |
| Stored data | `source_snapshot` (tabla 0002) — vacía o con filas de runs previos del worker. Nuevas filas por run. | Ninguna migración; INSERT idempotente por unique (source,resource,date_bucket). |
| Secrets/env vars | LeyLobby CLI lee nombres DISTINTOS (`SUPABASE_URL`/`SUPABASE_SERVICE_KEY`) vs Cámara/probidad (`SUPABASE_API_URL`/`SUPABASE_SECRET_KEY`). | Mapear ambos en el `env:` del workflow leylobby. |
| Build artifacts | Ninguno (tsx, sin build). | None — `--ignore-scripts` evita ERR_PNPM_IGNORED_BUILDS. |
| OS-registered state | None — verificado: el scheduling es cron de GitHub Actions, no Task Scheduler/pm2. | None. |

## Common Pitfalls

### Pitfall 1: assumir que `SnapshotWriter` ya está wireado
**Qué sale mal:** el diseño dice "wirearlos a SnapshotWriter" implicando que solo falta conectar. Realidad: falta el `SnapshotStore` Node-side (solo existe en Deno). **Evitar:** construir el store supabase-js compartido primero; los dos CLIs lo consumen.

### Pitfall 2: el workflow leylobby falla por degradación honesta
**Qué sale mal:** un assert `audiencias>0` estricto rompe el run cuando la institución degrada (`LeylobbyBloqueadaError`), que es comportamiento CORRECTO (exit 0). **Evitar:** assert que acepta `audiencias>0` OR `degradaciones>0`.

### Pitfall 3: nombres de env divergentes entre CLIs
**Qué sale mal:** leylobby `ingest-cli.ts` no lee `SUPABASE_API_URL`/`SUPABASE_SECRET_KEY` → degrada a dry-run silencioso aunque los secrets estén presentes. **Evitar:** mapear `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` en ese workflow.

### Pitfall 4: campos NOT NULL de source_snapshot sin valor
**Qué sale mal:** `fingerprint`/`cache_key`/`source_url` son NOT NULL; los CLIs no los producen hoy. INSERT falla. **Evitar:** definir valores en el wire (`source_url` = URL de la fuente; `cache_key`=`source:resource:date`; `fingerprint`=sha o estructural). Mirar cómo el worker los puebla.

### Pitfall 5: curl `stat -c%s` es GNU/Linux
**Qué sale mal:** `stat -c%s` funciona en `ubuntu-latest` (OK aquí) pero no en macOS. **Evitar:** runners son ubuntu-latest (agenda/leyes lo usan) — no hay problema; documentado por si migra.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| GitHub Actions ubuntu-latest | los 3 workflows | ✓ (asumido, igual que agenda/leyes) | — | — |
| pnpm | install | ✓ via action-setup@v4 | 11.3.0 (packageManager) | — |
| Node | tsx | ✓ via setup-node@v4 | 22 | — |
| curl | anti-WAF Cámara | ✓ (preinstalado en ubuntu-latest) | — | — |
| Secrets `SUPABASE_*`, `R2_*` | runs LIVE | ✗ en CI hasta que operador los cargue | — | dry-run (sin secrets → InMemory writer) |

**Missing con fallback:** secrets de operador → el agente construye + valida por `workflow_dispatch` dry-run; encender LIVE es checkpoint humano.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (existe `*.test.ts` en packages/lobby, packages/ingest) |
| Quick run | `pnpm --filter @obs/lobby test` / `pnpm --filter @obs/probidad test` |
| Full suite | `pnpm test` (ACCEPTANCE 5: verde) |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Command | Exists? |
|-----|----------|-----------|---------|---------|
| INGEST-01..03 | CLIs corren en CI sin `.env` | smoke (dry-run) | `workflow_dispatch` con dry-run / sin secrets | ✅ (CLIs ya CI-safe, Phase 33) |
| INGEST-04 | SnapshotWriter inserta provenance | unit | nuevo test del `SnapshotStore` supabase-js (espejo `snapshot.test.ts`) | ❌ Wave 0 |
| Bloque R2 probidad | best-effort, no fatal | unit | test de `run-probidad-todos` con r2Store mock que lanza → no aborta | ❌ Wave 0 |

### Wave 0 Gaps
- [ ] `packages/ingest/src/snapshot-store-supabase.test.ts` — store Node-side, manejo 23505 (espejo worker)
- [ ] Test de `run-probidad-todos.ts` con r2Store que falla → r2Path null, corrida sigue (espejo `run-camara-lobby` best-effort)
- [ ] (Workflows YAML no son unit-testables; validación = `workflow_dispatch` dry-run + lint YAML)

## Security Domain

| ASVS | Aplica | Control |
|------|--------|---------|
| V5 Input Validation | sí | inputs de workflow por `env:`, nunca interpolados en shell con secrets (agenda L63–66) |
| V6 Cryptography | sí | R2 SigV4 vía aws4fetch (NUNCA hand-roll); sha256 Web Crypto |
| V7 Secrets | sí | secrets vía `${{ secrets.* }}`→`env:`; service key nunca en error messages (writer L9) |

| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Command injection en step con secrets | Tampering | inputs por ENV, leer `$VAR` (no interpolar `${{ }}` en `run:`) |
| RLS bypass | Elevation | source_snapshot deny-by-default; CLI usa service key server-side, OK |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Secrets `SUPABASE_API_URL`/`SUPABASE_SECRET_KEY`/`R2_*` existen en el repo destino | Findings 3 | Runs LIVE degradan a dry-run; build/dry-run no afectado |
| A2 | `source_snapshot` `fingerprint`/`cache_key` aceptan valores derivados simples sin romper invariantes downstream | Findings 2 | Si hay consumidor del fingerprint estructural, valor naïve podría confundir drift; bajo (drift no se consulta en esta fase) |
| A3 | Para probidad, un snapshot agregado por run (no por query) satisface ACCEPTANCE 4 | Findings 2 | Bajo; INGEST-04 dice "una fila por run" |
| A4 | Días de cron sugeridos (mar/mié/jue) son aceptables | Findings 3 | Cosmético; operador ajusta |

## Open Questions

1. **Probidad: granularidad del crudo R2 (snapshot por query vs por run).**
   - Sé: el crudo SPARQL es N responses; ACCEPTANCE pide "una fila por run con r2_path".
   - No claro: si guardar el último response, un array concatenado, o N snapshots.
   - Recomendación: **un crudo agregado por run** (array JSON de responses) → un `r2_path` → una fila `source_snapshot`. Decisión de implementación para el planner.

2. **Valores de `fingerprint`/`cache_key` para el SnapshotWrite de los CLIs.**
   - Sé: son NOT NULL en 0002; el worker los puebla.
   - Recomendación: replicar exactamente cómo `BaseConnector`/worker los computa (revisar `base-connector.ts` L159–162 en el plan) para no divergir.

## Sources

### Primary (HIGH — código real del repo)
- `packages/lobby/src/run-camara-lobby-cli.ts` (L73–127), `run-camara-lobby.ts` (L85–105)
- `packages/lobby/src/ingest-cli.ts` (L65–199), `connector-leylobby.ts` (L44–117), `ingest-run.ts` (L108–146)
- `packages/probidad/src/run-probidad-todos-cli.ts` (L36–101), `run-probidad-todos.ts` (L78–127)
- `packages/ingest/src/snapshot.ts`, `r2-store.ts` (L55–79)
- `supabase/migrations/0002_control_tables.sql` (L22–56)
- `supabase/functions/ingest-worker/worker.ts` (L197–228) — único SnapshotStore concreto (Deno)
- `.github/workflows/agenda-weekly.yml`, `leyes-weekly.yml` — patrón a copiar
- `.planning/MILESTONE-v4-cruces.md` §1.1, `REQUIREMENTS.md` INGEST-01..04, `ROADMAP.md` Phase 34

## Metadata

**Confidence breakdown:**
- CLI signatures/behavior: HIGH — leídos línea por línea
- R2/SnapshotWriter wire: HIGH — gap del SnapshotStore Node-side confirmado por grep exhaustivo
- Workflow pattern: HIGH — copiado de agenda/leyes existentes
- source_snapshot DDL / no-DDL: HIGH — 0002 leído completo

**Research date:** 2026-06-24
**Valid until:** 2026-07-24 (estable; depende solo de código del repo, no de fuentes externas volátiles)
