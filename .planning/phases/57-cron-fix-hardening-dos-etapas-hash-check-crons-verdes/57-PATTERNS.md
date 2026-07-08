# Phase 57: CRON-FIX — Pattern Map

**Mapped:** 2026-07-08
**Files analyzed:** 11 new/modified files
**Analogs found:** 11 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/ingest/src/r2-store.ts` (add `getObject`) | utility | file-I/O | `r2-store.ts` itself — `putImmutable` (lines 55–79) | exact |
| `packages/ingest/src/r2-store.test.ts` (extend) | test | file-I/O | `r2-store.test.ts` — `putImmutable` describe block (lines 12–75) | exact |
| `packages/tramitacion/src/writer-supabase.ts` (G4 fix) | service | CRUD | same file — `upsertVotos` with `dedupePorClave` (lines 77–99) | exact |
| `packages/tramitacion/src/ingest-cli.ts` (add `--from-r2`, Etapa 1, hash-check) | utility | request-response | same file — `parseArgs` + `main` (lines 62–243); Etapa 1 pattern from `run-camara-lobby.ts:85–105` | exact |
| `packages/lobby/src/ingest-cli.ts` (add R2Store import + Etapa 1, `--from-r2`) | utility | request-response | `packages/tramitacion/src/ingest-cli.ts` `parseArgs`/`main`; `run-camara-lobby.ts:85–105` for Etapa 1 | role-match |
| `packages/agenda/src/run-agenda-prod-cli.ts` (WARN loud R2 not configured) | utility | request-response | `packages/probidad/src/run-probidad-todos-cli.ts` loadEnv + R2 gate (lines 55–77) | role-match |
| `packages/probidad/src/run-probidad-todos.ts` (rawBindings logging) | service | request-response | same file — existing `confirmados` log pattern; SPARQL response shape documented in RESEARCH.md | exact |
| `packages/probidad/src/run-probidad-todos-cli.ts` (assertion redesign) | utility | request-response | `.github/workflows/probidad-weekly.yml:69–70` (the assert being replaced) | exact |
| `.github/workflows/lobby-camara-weekly.yml` (disable schedule, dispatch-only + comment) | config | event-driven | `.github/workflows/probidad-weekly.yml` — `workflow_dispatch` with inputs (lines 14–22) | role-match |
| `.github/workflows/agenda-weekly.yml` + `leyes-weekly.yml` + `lobby-leylobby-weekly.yml` + `probidad-weekly.yml` (add missing secrets in `env:`) | config | event-driven | `.github/workflows/agenda-weekly.yml` — full `env:` block (lines 53–70) | exact |
| `docs/runbooks/cron-local-fallback.md` | doc | — | no existing runbook in `docs/runbooks/` (directory does not exist yet) | no-analog |

---

## Pattern Assignments

### `packages/ingest/src/r2-store.ts` — add `getObject`

**Analog:** `packages/ingest/src/r2-store.ts` — `putImmutable` (lines 55–79)

**Core pattern to mirror** (lines 55–79 of r2-store.ts — the PUT signing loop):

```typescript
// PUT (existing — mirror the signing + fetchFn pattern for GET):
async putImmutable(
  source: string, resource: string, date: string,
  sha: string, ext: string, body: Uint8Array,
): Promise<string> {
  const key = `${source}/${resource}/${date}/${sha}.${ext}`;
  const url = `${this.endpoint}/${this.bucket}/${key}`;
  const signed = await this.client.sign(url, {
    method: "PUT",
    body: body as BodyInit,
    headers: { "If-None-Match": "*" },
  });
  const res = await this.fetchFn(signed);
  if (!res.ok && res.status !== 412) {
    throw new Error(`R2 PUT ${res.status} para ${key}`);   // T-01-06: no creds
  }
  return key;
}
```

**New `getObject` method** — insert after line 79, mirror the signing convention:

```typescript
async getObject(r2Path: string): Promise<Uint8Array> {
  const url = `${this.endpoint}/${this.bucket}/${r2Path}`;
  const signed = await this.client.sign(url, { method: "GET" });
  const res = await this.fetchFn(signed);
  if (!res.ok) {
    throw new Error(`R2 GET ${res.status} para ${r2Path}`); // T-01-06: no creds
  }
  return new Uint8Array(await res.arrayBuffer());
}
```

**Return type extension for hash-check (CRON-03) — Opción A:** change `putImmutable` return from `Promise<string>` to `Promise<{ r2Path: string; existed: boolean }>` where `existed = (res.status === 412)`. Callers that currently do `const path = await store.putImmutable(...)` need updating to destructure. Alternatively add a separate `putImmutableStatus` overload (Opción B) to avoid touching all callers.

**Re-export:** add `getObject` to `packages/ingest/src/index.ts` — the existing export line is:
```typescript
export { R2Store, sha256Hex } from "./r2-store";  // line 36 of index.ts
```
No change needed to that line; `getObject` is a method on `R2Store`, already exported.

---

### `packages/ingest/src/r2-store.test.ts` — extend with `getObject` describe block

**Analog:** same file, `describe("R2Store.putImmutable", ...)` block (lines 12–75)

**Test helper pattern** (lines 1–10 + helper import):

```typescript
import { describe, expect, it } from "vitest";
import { makeMockFetch } from "../test/_helpers";
import { R2Store, sha256Hex } from "./r2-store";

const CFG = {
  accessKeyId: "AKIA_TEST",
  secretAccessKey: "secret_test",
  endpoint: "https://acct.r2.cloudflarestorage.com",
  bucket: "observatorio",
};
```

**New describe block to append** (mirror Test 1a/1d/error patterns):

```typescript
describe("R2Store.getObject", () => {
  it("GET 200 devuelve Uint8Array del body", async () => {
    const expected = new TextEncoder().encode("crudo-leído");
    const r2Path = "tramitacion/boletin/2026-01-10/abc123.json";
    const url = `${CFG.endpoint}/${CFG.bucket}/${r2Path}`;
    const mock = makeMockFetch({ [url]: { status: 200, body: expected } });
    const store = new R2Store(CFG, { fetchFn: mock.fn });
    const result = await store.getObject(r2Path);
    expect(result).toEqual(expected);
  });

  it("GET 404 lanza error sin exponer credenciales (T-01-06)", async () => {
    const r2Path = "no/existe/path.json";
    const url = `${CFG.endpoint}/${CFG.bucket}/${r2Path}`;
    const mock = makeMockFetch({ [url]: { status: 404 } });
    const store = new R2Store(CFG, { fetchFn: mock.fn });
    await expect(store.getObject(r2Path)).rejects.toThrow(/404/);
    await expect(store.getObject(r2Path)).rejects.not.toThrow(/secret_test/);
  });
});
```

Note: verify that `makeMockFetch` in `../test/_helpers` accepts a `body` field for GET responses; if it only returns empty bodies, extend the helper or use a custom mock in these tests.

---

### `packages/tramitacion/src/writer-supabase.ts` — G4 dedupe fix

**Analog:** same file, `upsertVotos` (lines 77–99) — exact mirror for `upsertEventos` (lines 102–113)

**Existing `dedupePorClave` function** (lines 43–47 — already present, do not re-implement):

```typescript
function dedupePorClave<T>(arr: T[], key: (v: T) => string): T[] {
  const m = new Map<string, T>();
  for (const v of arr) m.set(key(v), v);
  return [...m.values()];
}
```

**`upsertVotos` as analog** (lines 85–88 — the dedupe call to copy):

```typescript
const deduped = dedupePorClave(
  filas,
  (v) => `${v.votacion_id} ${v.fuente_voter_id}`,
);
```

**Fix for `upsertEventos`** — replace line 104 (`for (const lote of chunk(eventos, CHUNK))`) with:

```typescript
async upsertEventos(eventos: TramitacionEvento[]): Promise<void> {
  if (eventos.length === 0) return;
  // G4: de-duplicar por clave natural antes del upsert (espejo de upsertVotos:85-88).
  // Usar \x00 como separador (no ambiguo con contenido de campo; distinto del ' ' de eventoKey).
  const deduped = dedupePorClave(
    eventos,
    (e) => [e.boletin, e.fecha, e.camara, e.tipo, e.descripcion].join("\x00"),
  );
  for (const lote of chunk(deduped, CHUNK)) {
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

**Test reproductor** (new file `packages/tramitacion/src/writer-supabase.test.ts` or extend existing):

```typescript
// G4 test: upsertEventos con batch con duplicados no lanza ON CONFLICT
it("G4: dedup previene ON CONFLICT en batch con evento duplicado", async () => {
  const capturedUpserts: unknown[][] = [];
  const mockClient = {
    from: () => ({
      upsert: (rows: unknown[]) => {
        capturedUpserts.push(rows);
        return Promise.resolve({ error: null });
      },
    }),
  };
  const writer = new SupabaseTramitacionWriter({ url: "x", serviceKey: "x", client: mockClient as any });
  const ev = { boletin: "18000-05", fecha: "2026-01-10", camara: "camara", tipo: "votacion", descripcion: "aprobado" };
  await writer.upsertEventos([ev, ev]); // duplicado
  expect(capturedUpserts[0]).toHaveLength(1); // deduplicado a 1 fila
});
```

---

### `packages/tramitacion/src/ingest-cli.ts` — add `--from-r2`, Etapa 1, hash-check

**Analog A (flag parsing):** same file, `parseArgs` (lines 62–109) — copy the `switch(a)` pattern for `--from-r2`:

```typescript
// In parseArgs switch(a):
case "--from-r2":
  opts.fromR2 = argv[++i];
  if (!opts.fromR2) throw new IngestCliArgsError("--from-r2 requiere un r2Path");
  break;
```

Add `fromR2?: string` to `IngestCliOptions` interface.

**Analog B (Etapa 1 best-effort):** `packages/lobby/src/run-camara-lobby.ts` lines 85–105 — the `if (opts.r2Store) { try { ... putImmutable ... } catch { log(no fatal) } }` pattern. Insert in `main()` after fetch of XML per boletín, before parsers run.

**Analog C (R2 env gate + WARN loud):** `packages/probidad/src/run-probidad-todos-cli.ts` lines 66–77 — the env keys loop that reads `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT_URL`, `R2_BUCKET` and constructs `R2Store`. Copy the construction block; add WARN log when keys absent in a cron context (not dry-run):

```typescript
// Construct R2Store if configured (Etapa 1 gate):
const r2Cfg = {
  accessKeyId: env.R2_ACCESS_KEY_ID ?? "",
  secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? "",
  endpoint: env.R2_ENDPOINT_URL ?? "",
  bucket: env.R2_BUCKET ?? "",
};
const r2Store = r2Cfg.accessKeyId && r2Cfg.endpoint
  ? new R2Store(r2Cfg)
  : null;
if (!r2Store && !dryRun) {
  log("[WARN] R2 no configurado — Etapa 1 omitida (sin crudo versionado)");
}
```

**`--from-r2` mode in `main()`:** guard at top of function body — if `opts.fromR2` is set, call `r2Store.getObject(opts.fromR2)` → body → run parsers → writer, then `return`. Must have `r2Store` configured; throw if not.

**Hash-check insertion point:** after each boletín fetch, before parse. Pattern:

```typescript
const { r2Path, existed } = await r2Store.putImmutableStatus(source, resource, date, sha, ext, body);
if (existed) {
  log(`[skip] sin novedades — ${source} ${resource}`);
  continue; // skip Etapa 2 for this boletín
}
```

(Requires extending `putImmutable` return type per the Opción A/B choice in r2-store.ts.)

---

### `packages/lobby/src/ingest-cli.ts` — add R2Store + `--from-r2`

**Analog (imports + R2 init):** `packages/tramitacion/src/ingest-cli.ts` R2 block (pattern defined above); `packages/lobby/src/run-camara-lobby.ts` lines 19–20 for the import:

```typescript
import { R2Store, sha256Hex } from "@obs/ingest";
```

**Analog (flag):** `packages/tramitacion/src/ingest-cli.ts` `parseArgs` — copy `--from-r2` case verbatim.

**Analog (Etapa 1 insertion):** `run-camara-lobby.ts:85–105` — insert the same `if (r2Store) { try { putImmutable } catch { log no-fatal } }` block in `runIngestLobby` opts or inline in `main()` before `runIngestLobby` call.

**Note on `RunIngestLobbyOpts`:** current type at `packages/lobby/src/ingest-run.ts` lines 41–64 has no `r2Store` field. Add `r2Store?: R2Store` to that interface if the Etapa 1 write happens inside `runIngestLobby`; alternatively do the write in `ingest-cli.ts::main()` before calling `runIngestLobby` (simpler, no interface change).

---

### `packages/agenda/src/run-agenda-prod-cli.ts` — WARN loud when R2 not configured

**Analog:** `packages/probidad/src/run-probidad-todos-cli.ts` lines 55–77 (`loadEnv` + R2 env keys loop)

The agenda CLI already reads R2 env keys (it has `DEEPSEEK_API_KEY`, `R2_*` in the workflow). Verify that the CLI itself constructs `R2Store` and logs a WARN (not silent no-op) when keys absent in a non-dry-run context. Apply the same WARN pattern as tramitacion above.

---

### `packages/probidad/src/run-probidad-todos.ts` — rawBindings logging

**Analog:** same file — existing `log(...)` calls for `confirmados`, `declaraciones` counters (pattern: single `log(...)` line after async call).

**Insertion:** after `const json = await opts.conector.fetchSparql(...)`, add:

```typescript
const rawBindings = (json as { results?: { bindings?: unknown[] } })?.results?.bindings ?? [];
log(`probidad-todos: ${p.id} (${frag}) → SPARQL devolvió ${rawBindings.length} bindings`);
```

This is a pure log addition — no logic change; zero regression risk.

---

### `packages/probidad/src/run-probidad-todos-cli.ts` — assertion redesign

**Analog (current broken assert):** `.github/workflows/probidad-weekly.yml` lines 69–70:

```bash
echo "$OUT" | grep -qE 'declaraciones=[1-9][0-9]*|confirmados=[1-9][0-9]*' \
  || { echo "sin declaraciones/confirmados"; exit 1; }
```

**Fix:** the CLI output line (emitted by the CLI, not the workflow) should include `consultados=N`. The workflow assert changes to:

```bash
echo "$OUT" | grep -qE 'consultados=[1-9][0-9]*' \
  || { echo "probidad: 0 parlamentarios consultados — posible error fatal"; exit 1; }
# declaraciones=0 con consultados>0 es válido (semana sin novedades) → no exit 1
```

**CLI output format to add** (in `run-probidad-todos-cli.ts`, mirror the existing summary log):

```typescript
// After runProbidadTodos returns:
log(`[ok] probidad consultados=${res.consultados} declaraciones=${res.declaraciones} errores=${res.errores}`);
```

The `RunProbidadTodosResult` type may need a `consultados` field if not already present.

---

### `.github/workflows/lobby-camara-weekly.yml` — disable schedule + dispatch-only

**Analog:** `.github/workflows/probidad-weekly.yml` lines 14–22 — `workflow_dispatch` with inputs block (no schedule).

**Change:** replace the current `on:` block (lines 14–17):

```yaml
# BEFORE:
on:
  schedule:
    - cron: "0 11 * * 2"
  workflow_dispatch:
```

**With:**

```yaml
# WAF de camara.cl bloquea IPs de GH Actions desde al menos 2026-06-30 (G7 audit Phase 56).
# curl devuelve <10KB (WAF intercept) → el paso de descarga falla antes del CLI.
# Schedule DESHABILITADO: usar dispatch manual solo cuando el operador confirme que el WAF
# permite GH Actions. Fallback local: docs/runbooks/cron-local-fallback.md
on:
  workflow_dispatch:
```

Leave all other steps intact; the `curl` step already serves as the gate when run manually.

---

### `.github/workflows/agenda-weekly.yml` + others — add missing secrets

**Analog:** `.github/workflows/agenda-weekly.yml` lines 53–70 — the complete `env:` block with all 7 secrets. This is the reference format:

```yaml
env:
  SUPABASE_API_URL: ${{ secrets.SUPABASE_API_URL }}
  SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}
  DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
  R2_ENDPOINT_URL: ${{ secrets.R2_ENDPOINT_URL }}
  R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
  R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
  R2_BUCKET: ${{ secrets.R2_BUCKET }}
```

**Per-workflow gaps to fill** (secret names are exact — match what `gh secret set` will load):

| Workflow | Currently missing from `env:` |
|----------|-------------------------------|
| `agenda-weekly.yml` | `DEEPSEEK_API_KEY`, `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` |
| `lobby-camara-weekly.yml` | `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` |
| `probidad-weekly.yml` | `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (already present as comments — uncomment/add) |
| `leyes-weekly.yml` | nothing (G4 is code bug, not secret) |
| `lobby-leylobby-weekly.yml` | nothing (mapping already correct per RESEARCH.md) |

---

### `docs/runbooks/cron-local-fallback.md` — new runbook

**No analog** — `docs/runbooks/` directory does not exist. Create both the directory and the file.

**Structure (operator-facing markdown):**

1. **Prerequisitos** — `.env` with R2_*, SUPABASE_*, DEEPSEEK_API_KEY; pnpm installed; Node 22.
2. **Lobby Cámara (WAF-bloqueado en GH Actions)** — curl command + `--html-file` CLI command. Reference existing step from `lobby-camara-weekly.yml:50–65` as the exact commands.
3. **`gh secret set` cookbook** — how to load/update the 5 secrets from `.env` without printing values. Pattern: `gh secret set <NAME> --repo Cuchecorp/gov-map < <(grep ^<NAME>= .env | cut -d= -f2-)` or `gh secret set -R Cuchecorp/gov-map -f .env` (verify exact `gh` version syntax).
4. **Re-enabling lobby-camara schedule** — edit `lobby-camara-weekly.yml` `on:` block, push to master, confirm Actions tab.
5. **Post-run verification** — psql commands to check `lobby_audiencia` count and `source_snapshot` (when populated).

---

## Shared Patterns

### Etapa 1 best-effort (R2 write, not fatal)

**Source:** `packages/lobby/src/run-camara-lobby.ts` lines 85–105
**Apply to:** `tramitacion/src/ingest-cli.ts`, `lobby/src/ingest-cli.ts`

```typescript
// Etapa 1 (R2, best-effort): persiste el crudo content-addressed. NO fatal.
let r2Path: string | null = null;
if (r2Store) {
  try {
    const bytes = new TextEncoder().encode(rawContent); // or JSON.stringify(envelope)
    const sha = await sha256Hex(bytes);
    r2Path = await r2Store.putImmutable(source, resource, date, sha, ext, bytes);
    log(`${source}: crudo en R2 → ${r2Path}`);
  } catch (err) {
    r2Path = null;
    log(`${source}: Etapa 1 R2 falló (no fatal): ${(err as Error).message}`);
  }
}
```

### R2 env gate + WARN loud

**Source:** `packages/probidad/src/run-probidad-todos-cli.ts` lines 66–77
**Apply to:** `tramitacion/src/ingest-cli.ts`, `lobby/src/ingest-cli.ts`, `agenda/src/run-agenda-prod-cli.ts`

```typescript
const r2Store = (env.R2_ACCESS_KEY_ID && env.R2_ENDPOINT_URL)
  ? new R2Store({
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? "",
      endpoint: env.R2_ENDPOINT_URL,
      bucket: env.R2_BUCKET ?? "",
    })
  : null;
if (!r2Store && !dryRun) {
  log("[WARN] R2 no configurado — Etapa 1 omitida (sin crudo versionado)");
}
```

### Upsert idempotente con `dedupePorClave`

**Source:** `packages/tramitacion/src/writer-supabase.ts` lines 43–47 + 85–88
**Apply to:** `upsertEventos` in the same file (G4 fix)

### `[skip] sin novedades` log line

**Apply to:** every connector after hash-check returns `existed: true`
**Exact string:** `` `[skip] sin novedades — ${source} ${resource}` ``
Grep-able by Phase 58 and operator: `grep "\[skip\] sin novedades"`.

### GH Actions `env:` secrets block format

**Source:** `.github/workflows/agenda-weekly.yml` lines 53–70
**Apply to:** all workflows missing R2/DEEPSEEK secrets

### SigV4 via `AwsClient.sign`

**Source:** `packages/ingest/src/r2-store.ts` lines 67–72
**Apply to:** `getObject` method — never hand-roll SigV4 (T-01-05)

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `docs/runbooks/cron-local-fallback.md` | doc | — | No `docs/runbooks/` directory exists; no existing runbook to copy from. Structure specified above is the design pattern. |

---

## Metadata

**Analog search scope:** `packages/ingest/src/`, `packages/tramitacion/src/`, `packages/lobby/src/`, `packages/probidad/src/`, `packages/agenda/src/`, `.github/workflows/`, `docs/`
**Files read:** 12
**Pattern extraction date:** 2026-07-08
