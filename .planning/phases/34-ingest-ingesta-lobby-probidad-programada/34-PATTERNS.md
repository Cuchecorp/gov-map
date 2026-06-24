# Phase 34: INGEST — Ingesta lobby + probidad programada — Pattern Map

**Mapped:** 2026-06-24
**Files analyzed:** 6 (3 nuevos workflows + 1 nuevo store + 2 modificaciones probidad)
**Analogs found:** 6 / 6 (todos con analog directo en el repo; el store Node-side tiene analog Deno, no Node)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `.github/workflows/lobby-camara-weekly.yml` | config (CI workflow) | batch / scheduled | `.github/workflows/agenda-weekly.yml` | exact (curl anti-WAF + secrets→env) |
| `.github/workflows/lobby-leylobby-weekly.yml` | config (CI workflow) | batch / scheduled | `.github/workflows/agenda-weekly.yml` + `leyes-weekly.yml` | role-match (sin curl; OJO env names) |
| `.github/workflows/probidad-weekly.yml` | config (CI workflow) | batch / scheduled | `.github/workflows/leyes-weekly.yml` | exact (run directo + concurrency) |
| `packages/ingest/src/snapshot-store-supabase.ts` | utility (DB store) | request-response (insert) | `supabase/functions/ingest-worker/worker.ts` L197–228 (Deno inline) | role-match (analog Deno, no Node) |
| `packages/probidad/src/run-probidad-todos.ts` (MOD) | service (ETL orchestration) | batch / file-I/O→R2 | `packages/lobby/src/run-camara-lobby.ts` L85–105 | exact (R2 best-effort) |
| `packages/probidad/src/run-probidad-todos-cli.ts` (MOD) | utility (CLI entry) | request-response | `packages/lobby/src/run-camara-lobby-cli.ts` L52–101 | exact (R2Store wiring desde env) |

## Pattern Assignments

### `.github/workflows/lobby-camara-weekly.yml` (config, scheduled batch) — INGEST-01

**Analog:** `.github/workflows/agenda-weekly.yml` (esqueleto + curl) + `leyes-weekly.yml` (concurrency)

**Esqueleto común a copiar** (agenda-weekly.yml L27–53):
```yaml
permissions:
  contents: read

jobs:
  <job>:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "pnpm"
      - name: Install deps
        run: pnpm install --frozen-lockfile --ignore-scripts
```

**Concurrency group** (de leyes-weekly.yml L31–33) — añadir para evitar runs solapados:
```yaml
concurrency:
  group: lobby-camara-weekly
  cancel-in-progress: false
```

**curl anti-WAF + fail-<10KB + assert `audiencias=`** (patrón nuevo, de RESEARCH §Findings 3; el transporte curl espeja el que agenda-weekly usa para Cámara):
```yaml
- name: Descargar crudo Cámara (curl anti-WAF)
  run: |
    curl -sS -A 'Bot-Ciudadano/1.0' -o /tmp/lobby.html \
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

**Env names:** Cámara CLI lee `SUPABASE_API_URL` / `SUPABASE_SECRET_KEY` (run-camara-lobby-cli.ts L52–61) — los MISMOS que agenda/leyes. Reusables tal cual.

---

### `.github/workflows/lobby-leylobby-weekly.yml` (config, scheduled batch) — INGEST-02

**Analog:** `.github/workflows/leyes-weekly.yml` (run directo, sin curl — leylobby.gob.cl no tiene WAF)

**CRÍTICO — env names DIVERGENTES.** `packages/lobby/src/ingest-cli.ts` L110–115 lee nombres distintos a los de Cámara/probidad:
```ts
const url = opts.url ?? process.env.SUPABASE_DB_URL ?? process.env.SUPABASE_URL ?? "";
const serviceKey =
  opts.serviceKey ??
  process.env.SUPABASE_SERVICE_KEY ??
  process.env.SUPABASE_LOCAL_SERVICE_KEY ??
  "";
```
→ Si el workflow solo expone `SUPABASE_API_URL`/`SUPABASE_SECRET_KEY` (los secrets que existen en el repo), este CLI NO los ve → degrada a dry-run silencioso (ingest-cli.ts L123–126). **Mapear ambos** en `env:`:
```yaml
env:
  SUPABASE_URL: ${{ secrets.SUPABASE_API_URL }}
  SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}
  INSTITUCION: ${{ github.event.inputs.institucion }}
  ANIO: ${{ github.event.inputs.anio }}
```

**Inputs por ENV, leídos con `$VAR`** (patrón de seguridad de leyes-weekly L59–67 — nunca interpolar `${{ }}` en `run:` de un step con secrets):
```yaml
run: |
  ARGS=""
  if [ -n "$INSTITUCION" ]; then ARGS="$ARGS --institucion $INSTITUCION"; fi
  if [ -n "$ANIO" ]; then ARGS="$ARGS --anio $ANIO"; fi
  OUT=$(pnpm --filter @obs/lobby exec tsx src/ingest-cli.ts $ARGS)
  echo "$OUT"
  # ACEPTA degradación honesta: audiencias>0 O degradaciones>0 (LeylobbyBloqueadaError → exit 0)
  echo "$OUT" | grep -qE 'audiencias=[1-9][0-9]*|degradaciones=[1-9][0-9]*' \
    || { echo "ni audiencias ni degradaciones"; exit 1; }
```

**Assert NO estricto:** una degradación honesta (`LeylobbyBloqueadaError`, 403/503) es exit 0 correcto. El assert debe aceptar `audiencias>0` OR `degradaciones>0`. NO fallar por degradación.

---

### `.github/workflows/probidad-weekly.yml` (config, scheduled batch) — INGEST-03

**Analog:** `.github/workflows/leyes-weekly.yml` (run directo, sin WAF, con concurrency)

**Run directo + env + assert.** SPARQL `datos.cplt.cl` responde a fetch de Node (sin WAF, sin `--html-file`). ~155–200 queries × 2–3s ≈ 6–10 min (dentro de límite GH). El rate-limit lo aplica `HostRateLimiter` del conector — NO añadir `sleep` en CI.
```yaml
concurrency:
  group: probidad-weekly
  cancel-in-progress: false
# ...
- name: Run probidad weekly ingest
  env:
    SUPABASE_API_URL: ${{ secrets.SUPABASE_API_URL }}
    SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}
    R2_ENDPOINT_URL: ${{ secrets.R2_ENDPOINT_URL }}
    R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
    R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
    R2_BUCKET: ${{ secrets.R2_BUCKET }}
  run: |
    OUT=$(pnpm --filter @obs/probidad exec tsx src/run-probidad-todos-cli.ts)
    echo "$OUT"
    echo "$OUT" | grep -qE 'declaraciones=[1-9][0-9]*|confirmados=[1-9][0-9]*' \
      || { echo "sin declaraciones/confirmados"; exit 1; }
```

**Env names:** probidad CLI lee `SUPABASE_API_URL` / `SUPABASE_SECRET_KEY` (run-probidad-todos-cli.ts L47) — MISMOS que Cámara/agenda/leyes. Los 4 `R2_*` se añaden tras el wire (ver modificaciones abajo).

**Schedule:** elegir día distinto a agenda (lun) y leyes (vie). Sugerencia RESEARCH: lobby-camara mar, leylobby mié, probidad jue.

---

### `packages/ingest/src/snapshot-store-supabase.ts` (utility, DB insert) — INGEST-04 (NUEVO, gap de API)

**Analog (Deno, NO Node):** `supabase/functions/ingest-worker/worker.ts` L197–228 — la ÚNICA implementación concreta de `SnapshotStore`. Hay que portarla a un helper Node-side reusable y exportarlo desde `@obs/ingest`.

**Firma a implementar** (de `packages/ingest/src/snapshot.ts` L31–34):
```ts
export interface SnapshotStore {
  insertSnapshot(row: Record<string, unknown>): Promise<{ id: number }>;
}
```

**Manejo de 23505 a portar EXACTO del worker** (worker.ts L197–228 — idempotencia caché-diaria por `unique (source, resource, date_bucket)`):
```ts
const { data, error } = await sb
  .from("source_snapshot")
  .insert(row)
  .select("id")
  .single();
if (error) {
  if (error.code === "23505") {            // unique(source,resource,date_bucket) → otra corrida hoy
    const { data: existing } = await sb
      .from("source_snapshot")
      .select("id")
      .eq("source", row.source as string)
      .eq("resource", row.resource as string)
      .eq("date_bucket", row.date_bucket as string)
      .maybeSingle();
    if (existing) return { id: existing.id as number };
    throw new Error(`source_snapshot 23505 sin fila recuperable (carrera): ...`); // RETRYABLE, no undefined
  }
  throw new Error(`insert source_snapshot fallo: ${error.message}`);
}
return { id: data.id as number };
```

**Cliente supabase-js Node-side** (espejo de `writer-supabase.ts` de probidad/lobby): `createClient(env.SUPABASE_API_URL, env.SUPABASE_SECRET_KEY)`. Service key → RLS deny-by-default OK (0002 L55).

**Export:** añadir a `packages/ingest/src/index.ts` L40–41 junto a `SnapshotWriter`. Reusable por ambos CLIs (Cámara — que hoy descarta `r2Path` — y probidad).

**Firma de `SnapshotWriter.write(input)`** que este store alimenta (snapshot.ts L36–60):
```ts
new SnapshotWriter(store: SnapshotStore)
writer.write(input: SnapshotWrite): Promise<SnapshotRef>  // { snapshotId, r2Path, contentHash }
```

**`SnapshotWrite` — campos a poblar** (snapshot.ts L17–29). `SnapshotWriter.write` mapea a las columnas (L41–53):

| `SnapshotWrite` field | → columna DDL | NOT NULL? | Valor a derivar en el CLI |
|-----------------------|---------------|-----------|---------------------------|
| `source` | `source` | sí | `"camara-lobby"` / `"infoprobidad"` |
| `resource` | `resource` | sí | `"listadodeaudiencias"` / `"declaraciones"` |
| `cacheKey` | `cache_key` | **sí** | derivar — sugerido `${source}:${resource}:${date}` |
| `r2Path` | `r2_path` | **sí** | retorno de `R2Store.putImmutable` |
| `contentHash` | `content_hash` | **sí** | `sha256Hex(bytes)` (el mismo sha del put) |
| `fingerprint` | `fingerprint` | **sí** | derivar — sugerido `fingerprint(...)` de `@obs/ingest` (drift.ts) o el sha del crudo |
| `dateBucket` | `date_bucket` | **sí** | `fechaCaptura.slice(0,10)` |
| `provenance.sourceUrl` | `source_url` | **sí** | URL de la fuente |
| `provenance.fetchedAt` | `fetched_at` | default now() | ISO timestamp |
| `ingestRunId` | `ingest_run_id` | no (FK) | `null` (los CLIs no abren `ingest_run`) |

**Columnas NOT NULL de `source_snapshot`** (0002 L22–36) que el store DEBE poblar o el INSERT falla: `source`, `resource`, `cache_key`, `r2_path`, `content_hash`, `fingerprint`, `source_url`, `date_bucket`. **Decisión para el plan (RESEARCH Pitfall 4 / Open Q2):** `cache_key` y `fingerprint` no los produce hoy ningún CLI — definir valores (sugerido arriba); revisar `base-connector.ts` L159–162 para no divergir de cómo el worker los computa.

`Provenance` viene de `@obs/core` (`packages/core/src/provenance.ts` L8–17): `{ source, fetchedAt, sourceUrl, snapshotRef? }`. Constructor `makeProvenance(source, sourceUrl)` (L23) setea `fetchedAt = now()`.

---

### `packages/probidad/src/run-probidad-todos.ts` (MOD: bloque R2 Etapa-1) — INGEST-04

**Analog EXACTO:** `packages/lobby/src/run-camara-lobby.ts` L85–105 (bloque R2 best-effort try/catch, NO fatal):
```ts
let r2Path: string | null = null;
if (opts.r2Store) {
  try {
    const bytes = new TextEncoder().encode(html);     // probidad: serializar JSON SPARQL agregado
    const sha = await sha256Hex(bytes);                // de @obs/ingest (r2-store.ts L12)
    r2Path = await opts.r2Store.putImmutable(
      "camara-lobby", "listadodeaudiencias", date, sha, "html", bytes,
    );
    log(`camara-lobby: crudo en R2 → ${r2Path}`);
  } catch (err) {
    r2Path = null;                                     // best-effort, NO fatal
    log(`camara-lobby: Etapa 1 R2 falló (no fatal): ${(err as Error).message}`);
  }
}
```

**Adaptación a probidad:**
- Añadir `r2Store?: R2Store` y opcionalmente `snapshotWriter?: SnapshotWriter` a `RunProbidadTodosOpts` (hoy L27–37, sin R2).
- **Granularidad del crudo (RESEARCH Open Q1):** una corrida = N responses SPARQL (una por parlamentario). El crudo es JSON, no HTML. Recomendación RESEARCH: **un crudo AGREGADO por run** (array JSON de responses) → un `r2_path` → una fila `source_snapshot` (satisface ACCEPTANCE 4 "una fila por run"). Acumular las responses dentro del loop L100–115 y hacer el `putImmutable` UNA vez tras el loop.
- `putImmutable("infoprobidad", "declaraciones", date, sha, "json", bytes)`.
- Tras el put, llamar `snapshotWriter.write({...})` para escribir la fila de provenance (cierra el gap que el CLI de Cámara aún NO cierra — aquí se hace bien).
- **Best-effort:** mantener el try/catch; R2/snapshot que falla → `r2Path = null`, la corrida sigue (espeja la tolerancia existente del loop L111–114).

**Helper `R2Store.putImmutable`** (r2-store.ts L55–79): `putImmutable(source, resource, date, sha, ext, body): Promise<string>` (key `{source}/{resource}/{date}/{sha}.{ext}`; `If-None-Match: *`; 412 = idempotente OK).

**`RunProbidadTodosResult`:** añadir `r2Path: string | null` (espejo de `RunCamaraLobbyResult.r2Path` que el CLI imprime).

---

### `packages/probidad/src/run-probidad-todos-cli.ts` (MOD: wire R2Store desde env) — INGEST-04

**Analog EXACTO:** `packages/lobby/src/run-camara-lobby-cli.ts` L52–101 (bloque R2Store ya existente).

**1. Extender `loadEnv` allowlist** (hoy run-probidad-todos-cli.ts L47 lee solo `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`) — copiar la lista de Cámara (run-camara-lobby-cli.ts L52–61):
```ts
for (const k of [
  "SUPABASE_API_URL", "SUPABASE_SECRET_KEY",
  "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT_URL", "R2_BUCKET",
]) {
  if (process.env[k]) out[k] = process.env[k]!;
}
```

**2. Construir `R2Store` condicional** (copiar run-camara-lobby-cli.ts L93–101 — solo si LIVE y creds R2 presentes):
```ts
let r2Store: R2Store | undefined;
if (!dryRun && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_ENDPOINT_URL) {
  r2Store = new R2Store({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    endpoint: env.R2_ENDPOINT_URL,
    bucket: env.R2_BUCKET ?? "observatorio",
  });
}
```

**3. Construir `SnapshotWriter` con el nuevo store** (NUEVO — usa `SupabaseSnapshotStore` de este phase, solo si LIVE):
```ts
import { R2Store, SnapshotWriter } from "@obs/ingest";
import { SupabaseSnapshotStore } from "@obs/ingest"; // nuevo helper de Wave 0
// ...
const snapshotWriter = (!dryRun && env.SUPABASE_API_URL && env.SUPABASE_SECRET_KEY)
  ? new SnapshotWriter(new SupabaseSnapshotStore({ url: env.SUPABASE_API_URL, serviceKey: env.SUPABASE_SECRET_KEY }))
  : undefined;
```

**4. Pasar a `runProbidadTodos`** (espejo del spread condicional `...(r2Store ? { r2Store } : {})` de run-camara-lobby-cli.ts L119) y añadir `r2Path=` a la línea de output (L97–101, espejo de run-camara-lobby-cli.ts L123–127).

**Import:** añadir `R2Store, SnapshotWriter` (+ el nuevo store) al import de `@obs/ingest` (hoy run-probidad-todos-cli.ts L18 importa solo `Fetcher, HostRateLimiter, RobotsGuard`).

---

## Shared Patterns

### loadEnv CI-safe (process.env precedencia)
**Source:** `packages/lobby/src/run-camara-lobby-cli.ts` L36–63 (= `run-probidad-todos-cli.ts` L31–51)
**Apply to:** los 2 CLIs modificados. Patrón ya parcheado en Phase 33 — try/catch sobre `readFileSync(.env)`, `process.env` toma precedencia. En CI (sin `.env`) usa solo `process.env`. **NO regresionar:** al extender la allowlist de probidad, mantener el try/catch.

### Secrets → env, nunca interpolados en shell con secrets
**Source:** `.github/workflows/agenda-weekly.yml` L63–71 / `leyes-weekly.yml` L59–67
**Apply to:** los 3 workflows. Inputs (`--institucion`, `--anio`, `--limit`) pasan por `env:` y se leen con `$VAR` en `run:`; NUNCA `${{ github.event.inputs.* }}` interpolado en un `run:` que lleva `SUPABASE_SECRET_KEY`/`R2_*` (V5/STRIDE-Tampering, command injection).

### Install CI-safe
**Source:** `.github/workflows/agenda-weekly.yml` L46–50
**Apply to:** los 3 workflows. `pnpm install --frozen-lockfile --ignore-scripts` (evita `ERR_PNPM_IGNORED_BUILDS` de pnpm 11; tsx trae su propio esbuild). `pnpm/action-setup@v4` + `setup-node@v4` node 22 cache pnpm.

### R2 Etapa-1 best-effort (NO fatal)
**Source:** `packages/lobby/src/run-camara-lobby.ts` L85–105
**Apply to:** `run-probidad-todos.ts`. R2/snapshot que falla → `r2Path = null` + log, la carga a Supabase procede. El crudo es verdad versionada pero no bloquea el derivado.

### Idempotencia source_snapshot (23505)
**Source:** `supabase/functions/ingest-worker/worker.ts` L197–228
**Apply to:** `snapshot-store-supabase.ts`. Unique `(source, resource, date_bucket)` = caché diaria; re-correr el mismo día → 23505 → leer fila existente y devolver su id (no fallo de job). Si 23505 sin fila recuperable → throw RETRYABLE (no caer a undefined/TypeError).

## No Analog Found

Ninguno. Los 6 archivos tienen analog directo en el repo. Matiz: el `SnapshotStore` Node-side (`snapshot-store-supabase.ts`) NO tiene analog Node — su único analog concreto es el inline Deno del worker (worker.ts L197–228). Es código nuevo a portar, no un wire de algo preexistente (RESEARCH Pitfall 1 / hallazgo crítico).

## Metadata

**Analog search scope:** `.github/workflows/`, `packages/lobby/src/`, `packages/probidad/src/`, `packages/ingest/src/`, `packages/core/src/`, `supabase/functions/ingest-worker/`, `supabase/migrations/0002`
**Files scanned:** 11 (agenda-weekly.yml, leyes-weekly.yml, worker.ts, snapshot.ts, run-probidad-todos.ts, run-probidad-todos-cli.ts, run-camara-lobby-cli.ts, run-camara-lobby.ts, ingest-cli.ts, ingest/index.ts, 0002_control_tables.sql, provenance.ts)
**Pattern extraction date:** 2026-06-24
