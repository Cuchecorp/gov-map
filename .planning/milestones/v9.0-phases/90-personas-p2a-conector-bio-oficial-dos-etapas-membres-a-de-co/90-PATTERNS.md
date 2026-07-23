# Phase 90: PERSONAS P2a — Conector bio oficial dos-etapas + membresía de comisiones - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 15 (new `@obs/bio` package + migration 0059 + pgTAP)
**Analogs found:** 15 / 15 (todo tiene analog directo — `@obs/bio` es casi enteramente ensamblaje)

> **Nota rectora:** RESEARCH.md corrige la CONTEXT en un punto load-bearing para los parsers: el endpoint de diputados es `retornarDiputadosPeriodoActual` (opendata.**camara**.cl), NO `getDiputados`. El analog EXACTO de ese endpoint YA existe y ya lo parsea: `packages/identity/src/parse-camara.ts` (mismo XML `DiputadosPeriodoColeccion`, misma lógica de militancia vigente). Ese archivo es el analog #1 del parser de diputados — copiar su forma de lectura, su `partidoVigente`, y su exclusión de PII (RUT/distrito quedan null "no fabricar"). La migración siguiente libre es **0059** (última aplicada = 0058).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/bio/package.json` | config | — | `packages/lobby/package.json` | exact |
| `packages/bio/tsconfig.json` | config | — | `packages/lobby/tsconfig.json` | exact |
| `packages/bio/vitest.config.ts` | config | — | `packages/lobby/vitest.config.ts` | exact |
| `packages/bio/src/index.ts` | barrel | — | `packages/lobby/src/index.ts` / `identity/src/index.ts` | exact |
| `packages/bio/src/model.ts` | model | transform | `packages/lobby/src/model.ts` | exact (provenance+zod) |
| `packages/bio/src/parse-diputados.ts` | parser | transform (XML→model, ALLOWLIST) | `packages/identity/src/parse-camara.ts` | **exact endpoint** |
| `packages/bio/src/parse-diputados.test.ts` | test | — | `packages/lobby/src/parse-camara-lobby.test.ts` | role-match |
| `packages/bio/src/parse-bcn-senadores.ts` | parser | transform (SPARQL-json→model) | `packages/identity/src/parse-camara.ts` + STACK.md §3 | role-match |
| `packages/bio/src/parse-senado-ficha.ts` | parser | transform (HTML cheerio, fallback) | `packages/lobby/src/parse-camara-lobby.ts` | exact (cheerio) |
| `packages/bio/src/parse-comisiones.ts` | parser | transform (Open Q1 fuente) | `packages/lobby/src/parse-camara-lobby.ts` | role-match |
| `packages/bio/src/run-bio.ts` | service/orchestrator | file-I/O + request-response (dos-etapas) | `packages/lobby/src/run-camara-lobby.ts` + `votos/src/run-camara-votos.ts` | exact |
| `packages/bio/src/writer.ts` | writer (iface + in-mem) | CRUD (upsert) | `packages/lobby/src/writer.ts` | exact |
| `packages/bio/src/writer-supabase.ts` | writer (Supabase) | CRUD (upsert idempotente) | `packages/lobby/src/writer-supabase.ts` | exact |
| `packages/bio/src/run-bio-cli.ts` | cli/entrypoint | request-response | `packages/lobby/src/run-camara-lobby-cli.ts` | exact |
| `supabase/migrations/0059_bio_comisiones.sql` | migration | — | `supabase/migrations/0021_lobby.sql` | exact (provenance+RLS deny) |
| `supabase/tests/0059_bio_comisiones.test.sql` | test (pgTAP) | — | `supabase/tests/0021_lobby.test.sql` | exact |

## Shared Patterns

### Dos-etapas (Etapa 1 R2 crudo → Etapa 2 parse+write) — LOCKED
**Source:** `packages/lobby/src/run-camara-lobby.ts:82-110` (best-effort R2) y `packages/votos/src/run-camara-votos.ts:181-242` (modo `--from-r2` replay).
**Apply to:** `run-bio.ts` (todos los sub-runners: diputados, senadores, comisiones).
Fecha de captura única para R2 (`date`) y para el marcado; `putImmutable(prefijo, recurso, date, sha, ext, bytes)`; `existed` → short-circuit "sin novedades" y return con ceros. Prefijo nuevo `bio/<recurso>/<fecha>/<sha>.xml` (no colisiona con votos/lobby/agenda). Excerpt exacto:
```typescript
// packages/lobby/src/run-camara-lobby.ts:88-105
if (opts.r2Store) {
  try {
    const bytes = new TextEncoder().encode(html);
    const sha = await sha256Hex(bytes);
    const { r2Path: newPath, existed } = await opts.r2Store.putImmutable(
      "camara-lobby", "listadodeaudiencias", date, sha, "html", bytes,
    );
    r2Path = newPath;
    if (existed) { log("[skip] sin novedades — camara-lobby listadodeaudiencias"); return {...}; }
    log(`camara-lobby: crudo en R2 → ${r2Path}`);
  } catch (err) { r2Path = null; log(`Etapa 1 R2 falló (no fatal): ${(err as Error).message}`); }
}
```
> Para bio, R2 puede ser fatal-si-falla o best-effort según el plan; el lobby lo hace best-effort. `--from-r2` replay: copiar el envelope-fake-connector de `run-camara-votos.ts:203-223` (conectores fake que sirven el crudo sin red).

### Match determinista fail-closed (único escritor de FK) — LOCKED
**Source:** `packages/identity/src/deterministic.ts:92-139` (`matchDeterminista`) + `packages/identity/src/enlace-confirmado.ts:59-71` (`confirmar()` única factory).
**Apply to:** `run-bio.ts` (diputados por DIPID exacto; senadores por `parlid_senado`/nombre).
- **Diputados:** NO usar `matchDeterminista` por nombre — hay `id_diputado_camara === <Id>` (DIPID) exacto contra la maestra (research VERDICT 1: seed `id_diputado_camara="1009"`, XML `<Id>1074</Id>`). Filtrar `maestra.filter(p => p.id_diputado_camara === dipid)`, confirmar SOLO si `=== 1`, si no → skip + reporte.
- **Senadores:** `parlid_senado` si la fuente lo trae; si no, `matchDeterminista({ nombreNormalizado, camara:"senadores", periodo })` — BCN no expone `parlid_senado` (research A3), match por nombre único fail-closed.
- **FK branded:** el `parlamentario_id` de las filas hijas NUNCA es un string crudo derivado de name-match libre; el patrón `EnlaceConfirmado` (`confirmar(id)`) tipa el FK. El `unique symbol` no se exporta; grep-gate rechaza `confirmar(` fuera del mint site. Excerpt del fail-closed:
```typescript
// packages/identity/src/deterministic.ts:114-116 — confirma SOLO si === 1
if (porNombre.length === 1) return { estado: "confirmado", metodo: "nombre", id: porNombre[0]!.id };
// ...cualquier otro caso → { estado: "no_confirmado", razon: ... }  (nunca fabrica)
```
> Anti-pattern (research Pitfall 4): name-match de diputados a la maestra. Hay DIPID exacto — úsalo. Name-match SOLO senadores, fail-closed.

### Provenance inline + RLS deny-by-default + revoke anon — LOCKED (plantilla 0021)
**Source:** `supabase/migrations/0021_lobby.sql:60-98` (`lobby_contraparte` = tabla deny-by-default).
**Apply to:** las 4 tablas nuevas de 0059 (`parlamentario_bio`, `parlamentario_militancia`, `comision`, `comision_membresia`).
Cada tabla: `origen/fecha_captura/enlace` NOT NULL; clave natural `unique(...)` para upsert idempotente; `enable row level security` SIN policies; `revoke all on <tabla> from anon, authenticated` (defensa contra default privileges de Supabase). **CERO `grant … to anon`** (>0044 lockdown-guard Block A lo prohíbe; las RPCs públicas de lectura nacen en Phase 91, NO aquí).
```sql
-- supabase/migrations/0021_lobby.sql:87-98  (VERBATIM la convención deny-by-default)
alter table lobby_contraparte enable row level security;
-- (intencionalmente NINGÚN create policy ... to anon; NINGÚN grant select ... to anon)
revoke all on lobby_contraparte from anon, authenticated;
```
> NO clonar el RPC público `lobby_de_parlamentario` (0021:105-125) ni su `grant execute to anon` — ese patrón (`security definer set search_path = ''`) es de Phase 91.

### Colaboradores de ingesta ensamblados (política LOCKED)
**Source:** `packages/lobby/src/run-camara-lobby-cli.ts:100-120` + `packages/votos/src/run-camara-votos.ts:113-121`.
**Apply to:** `run-bio-cli.ts`. Todo viene de `@obs/ingest` (`import { Fetcher, HostRateLimiter, RobotsGuard, R2Store, sha256Hex } from "@obs/ingest"` — VERIFIED en `packages/ingest/src/index.ts:19-37`). Allowlist `{}` (el default cubre sufijos gubernamentales); NO se edita el allowlist. UA identificatorio + rate-limit 2-3s ya cableados dentro.

---

## Pattern Assignments

### `packages/bio/package.json` (config)
**Analog:** `packages/lobby/package.json` (exact). Copiar verbatim cambiando `name` → `@obs/bio`, y las deps (research §Standard Stack: CERO deps nuevas):
```json
{
  "name": "@obs/bio",
  "private": true, "type": "module",
  "main": "src/index.ts", "types": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run", "typecheck": "tsc -b" },
  "dependencies": {
    "@obs/core": "workspace:*", "@obs/identity": "workspace:*", "@obs/ingest": "workspace:*",
    "@supabase/supabase-js": "^2.108.2", "cheerio": "1.2.0",
    "fast-xml-parser": "^5", "zod": "^4.4.3"
  },
  "devDependencies": { "@types/node": "^20.19.43", "tsx": "^4.22.4", "vitest": "^3.0.0" }
}
```
> `@obs/adjudication` de lobby NO se necesita (bio no usa provider LLM). Añadir `fast-xml-parser@^5` (lobby no lo tenía; votos/tramitacion sí). `pnpm-workspace.yaml` ya globbea `packages/*` (líneas 1-3) → **NO requiere edición** para descubrir el paquete; sí re-`pnpm install` para el symlink workspace.

### `packages/bio/tsconfig.json` (config)
**Analog:** `packages/lobby/tsconfig.json:1-19` (exact). **GOTCHA Phase 43 (research Anti-Pattern):** usar `"references"` (NO `"paths"` — path-aliases rompen `tsc -b`). Referencias a `../core`, `../ingest`, `../identity` (sin `../adjudication`). `composite: true`, `rootDir: src`, `outDir: dist`, `exclude` los `.test.ts`.

### `packages/bio/vitest.config.ts` (config)
**Analog:** `packages/lobby/vitest.config.ts:1-9` (exact, 9 líneas). **GOTCHA Phase 43 (research Validation Architecture Wave 0):** sin este archivo, 0 tests corren (dinero fue CI-DARK por esto). Copiar verbatim:
```typescript
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"], passWithNoTests: true },
});
```

### `packages/bio/src/model.ts` (model, transform)
**Analog:** `packages/lobby/src/model.ts:19-116` (exact). Copiar el bloque `ProvenanceInline` (`origen`/`fecha_captura`/`enlace` como `z.string()`) y el patrón interface+zod-schema por entidad. **PATRÓN CLAVE ALLOWLIST (research Pattern 2):** el modelo tipado NO declara campos PII → imposible persistirlos. Definir `BioParlamentario` (profesion, sin fechaNacimiento/rut/sexo), `Militancia { partido, partidoAlias, desde, hasta, esActual }`, `Comision`, `ComisionMembresia`. Excerpt del provenance a copiar:
```typescript
// packages/lobby/src/model.ts:22-29
const ProvenanceInline = {
  origen: z.string(), fecha_captura: z.string(), enlace: z.string(),
} as const;
```

### `packages/bio/src/parse-diputados.ts` (parser, XML→model, ALLOWLIST) — analog EXACTO
**Analog:** `packages/identity/src/parse-camara.ts:1-132` (MISMO endpoint `retornarDiputadosPeriodoActual`, MISMO XML `DiputadosPeriodoColeccion>DiputadoPeriodo>Diputado`, MISMA lógica de militancia vigente).
**Imports pattern** (parse-camara.ts:19-24):
```typescript
import { XMLParser } from "fast-xml-parser";
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });
```
**Allowlist EN EL PARSER** (parse-camara.ts:11-13 ya lo hace): `rut` y `distrito` quedan null — "NO fabricar". Para bio, la regla es MÁS fuerte: el modelo de salida NO DECLARA `fechaNacimiento`/`rut`/`sexo` (defensa por construcción, no null). Los nodos `<FechaNacimiento>`/`<RUT>`/`<Sexo>` (research VERDICT 1: presentes en el XML) se ignoran explícitamente.
**Selección de "actual" (militancia vigente)** — copiar `partidoVigente` (parse-camara.ts:110-132): entre las militancias cuyo rango `[FechaInicio, FechaTermino-nil=vigente]` cubre el corte, elegir la de `FechaInicio` MÁS RECIENTE (WR-04: el orden del XML no garantiza recencia). `FechaTermino` self-closing `xsi:nil` llega como objeto/"" → tratar como vigente:
```typescript
// packages/identity/src/parse-camara.ts:114-131
const candidatas = militancias.filter((m) => {
  const ini = fechaInicioOf(m); const fin = fechaTerminoOf(m);
  return (ini == null || ini <= corte) && (fin == null || fin >= corte);
});
const activa = candidatas.reduce((mejor, m) =>
  (fechaInicioOf(m)?.getTime() ?? -Infinity) > (fechaInicioOf(mejor)?.getTime() ?? -Infinity) ? m : mejor);
```
**Fail-closed de fechas** (parse-camara.ts:62-89): `FechaInvalidaError` ante fecha malformada — NUNCA un `Invalid Date` silencioso (research A1: ambigüedad → fail-loud, no actualizar `parlamentario.partido`).
**Helpers a copiar:** `str()` (39-44), `parseFecha()` (79-89), `fechaTerminoOf`/`fechaInicioOf` (92-99), `asArray()` para `Militancias.Militancia[]`, `intParse` de `parse-camara-votacion.ts:48-53` si hace falta.
> DIPID = `<Id>` del `<Diputado>` (parse-camara.ts lee `d.Id`) → es la clave de match contra `id_diputado_camara`.

### `packages/bio/src/parse-diputados.test.ts` (test — "que muerde")
**Analog:** `packages/lobby/src/parse-camara-lobby.test.ts` (role-match) + fixture en `src/__fixtures__/`.
**Test-que-muerde (LOCKED por CONTEXT §Specifics + research Pattern 2):** fixture XML con PII sintético (`<RUT>12345678-9</RUT>`, `<FechaNacimiento>1975-...`) →
```typescript
expect(JSON.stringify(parsed)).not.toContain("12345678");
expect(JSON.stringify(parsed)).not.toContain("FechaNacimiento");
```
Más: asserts de mapeo Militancia→{partido,desde,hasta,esActual} y de que "actual" = la de FechaTermino abierta/más futura.

### `packages/bio/src/parse-bcn-senadores.ts` (parser, SPARQL-json→model)
**Analog:** `packages/identity/src/parse-camara.ts` (forma del parser + `str()`/`parseFecha()`) + STACK.md §3 (fetch SPARQL). NET-NEW real (research §Don't Hand-Roll): cliente SPARQL = `fetch` + `JSON.parse`, CERO librería RDF. `URLSearchParams` para la query (no inyección). Spike de vocabulario primero (research A2: predicados NO son `hasParty`/`startDate` — 1-2 queries `?pred ?obj` sobre un nodo `Militancy`). Mapear `results.bindings[]` → `Militancia` con MISMA allowlist. UA identificatorio: `"ObservatorioCongreso360/1.0 (contacto: sanchez.rossi@gmail.com)"`, `Accept: application/sparql-results+json`.

### `packages/bio/src/parse-senado-ficha.ts` (parser, HTML cheerio — fallback LOCKED)
**Analog:** `packages/lobby/src/parse-camara-lobby.ts:24,150-219` (cheerio exact). `import * as cheerio from "cheerio"; const $ = cheerio.load(html);` + iteración con `normWs()`. Cruza por `parlid_senado` que la maestra YA tiene. Fallback si el spike BCN no cierra (research VERDICT 2 caveat).

### `packages/bio/src/parse-comisiones.ts` (parser, Open Q1 fuente)
**Analog:** `packages/lobby/src/parse-camara-lobby.ts` (cheerio si HTML) o `parse-camara-votacion.ts` (si XML). **Open Question 1 (research):** fuente re-derivada — curl-spike al inicio del plan sobre `citaciones_semana.aspx` (Cámara, WAF→curl) y `senado.cl` comisiones. Si ninguna trae integrantes con id/nombre → degradar a "catálogo de comisiones sin membresía" (`comision_membresia` vacía, estado honesto — NUNCA inventar membresía). La membresía se enlaza SOLO por identidad confirmada (fail-closed).

### `packages/bio/src/run-bio.ts` (orchestrator, dos-etapas)
**Analog:** `packages/lobby/src/run-camara-lobby.ts:74-166` (estructura RunOpts/RunResult + dos-etapas + writer.upsert) + `votos/src/run-camara-votos.ts:181-242` (modo `--from-r2`).
**Imports** (run-camara-lobby.ts:19-26): `import { R2Store, sha256Hex } from "@obs/ingest"; import { type Parlamentario } from "@obs/core";`.
**Estructura:** `RunBioOpts { conector, writer, maestra, r2Store?, fechaCaptura?, log? }` + `RunBioResult { r2Path, actualizados, sinMatch, ... }`. Fetch → Etapa 1 R2 → parse (allowlist) → matchDeterminista/DIPID → `writer.upsertBio(...)` + `UPDATE parlamentario.partido`. Reporte del run: N actualizados / M sin match (nombres en log local, NO persistidos — research §Specifics).

### `packages/bio/src/writer.ts` (writer iface + in-mem)
**Analog:** `packages/lobby/src/writer.ts:20-135` (exact). Interface `BioWriter` con métodos por entidad (upsert por clave natural) + `InMemoryBioWriter` (Map por clave natural → idempotencia verificable en tests: 2× run = mismos conteos). Método que actualiza `parlamentario.partido` + `fecha_captura`.

### `packages/bio/src/writer-supabase.ts` (writer Supabase, CRUD idempotente)
**Analog:** `packages/lobby/src/writer-supabase.ts:17-151` (exact).
**Cliente** (writer-supabase.ts:68-74): `createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })`.
**Upsert por clave natural** (writer-supabase.ts:82-85): `chunk` de 500, `.upsert(lote, { onConflict: "...", ignoreDuplicates: false })`; `if (error) throw new Error(...falló: ${error.message})` — **NUNCA interpolar la service key** (solo `error.message` de PostgREST). `dedupePorClave` (39-44) antes del lote (Postgres aborta lote con dos filas de la misma clave). onConflict sugeridos: `parlamentario_bio`→`parlamentario_id`; `parlamentario_militancia`→`parlamentario_id,partido_alias,desde`; `comision`→clave natural (nombre,camara); `comision_membresia`→`comision_id,parlamentario_id`.

### `packages/bio/src/run-bio-cli.ts` (cli/entrypoint)
**Analog:** `packages/lobby/src/run-camara-lobby-cli.ts:1-153` (exact — copiar casi verbatim).
**Helpers a copiar verbatim:** `flagValue()` (31-34), `loadEnv()` BOM-safe con precedencia `process.env` (41-63), `findWorkspaceRoot()` (70-82), `cargarMaestra()` desde `supabase/seeds/parlamentario.seed.json` (84-88).
**Flags:** `--dry-run` (InMemory writer + no R2), `--from-r2 <path>` (replay), `--xml-file <ruta>` (bypass WAF — research Pitfall 5: `www.camara.cl` bloquea undici pero `opendata.camara.cl` NO; para comisiones curl-first). Ensamblado condicional del conector real vs stub-de-archivo (run-camara-lobby-cli.ts:98-107). `env` keys a añadir a `loadEnv`: ya lista `SUPABASE_API_URL`/`SUPABASE_SECRET_KEY`/`R2_*` (52-61) — sin secreto nuevo (BCN/opendata son GET anónimos).

### `supabase/migrations/0059_bio_comisiones.sql` (migration)
**Analog:** `supabase/migrations/0021_lobby.sql` (exact para la parte deny-by-default). Las 4 tablas siguen `lobby_contraparte` (0021:60-98): provenance inline NOT NULL, `unique(...)` clave natural, `enable row level security` SIN policies, `revoke all … from anon, authenticated`. FK a `parlamentario(id)` con `on delete cascade`/`set null`. **NO** clonar el RPC público ni el `grant … to anon` (eso es Phase 91). Header con la nota "última migración APLICADA es 0058; esta es la 0059" y la advertencia de Pitfall 5 (aplicar por psql, no db push). Comprobación: `col_not_null` de origen/enlace; `parlamentario.partido` se ACTUALIZA por el writer (no cambia el DDL de `parlamentario` salvo `profesion` si el plan decide columna en vez de tabla — research Discretion).

### `supabase/tests/0059_bio_comisiones.test.sql` (pgTAP)
**Analog:** `supabase/tests/0021_lobby.test.sql:1-91` (exact). `begin; select plan(N);` → `has_table` × 4, RLS habilitada (`pg_class.relrowsecurity = true`), DENY-BY-DEFAULT (`pg_policies` count = 0 + `role_table_grants` anon SELECT = 0) en las 4 tablas, `col_not_null` provenance, `col_is_null` de FKs nullable. `select * from finish(); rollback;`. Correr `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f` contra schema APLICADO (research Pitfall 6). Excerpt del deny-by-default assert a copiar:
```sql
-- supabase/tests/0021_lobby.test.sql:36-42
select is((select count(*)::int from pg_policies where tablename = '<tabla>'), 0, '<tabla> sin policies (deny-by-default)');
select is((select count(*)::int from information_schema.role_table_grants
   where table_name = '<tabla>' and grantee = 'anon' and privilege_type = 'SELECT'), 0, 'anon sin grant SELECT');
```

## No Analog Found

Ninguno. Todos los 15 archivos tienen analog directo en el repo. Los únicos fragmentos NET-NEW (no copiables verbatim) son:
| Fragmento | Ubicación | Guía |
|-----------|-----------|------|
| Cliente SPARQL BCN + mapeo Militancy→Militancia | `parse-bcn-senadores.ts` | STACK.md §3 (fetch+JSON, `URLSearchParams`); forma del parser de `identity/parse-camara.ts` |
| Fuente de comisiones (Open Q1) | `parse-comisiones.ts` | Resolver por curl-spike al inicio del plan; degradar honesto si sin integrantes |
| Forma exacta de columnas de las 4 tablas | `0059_*.sql` | Discretion del plan (guía 0021); decidir tabla vs columnas para `bio` por cardinalidad |

## Metadata

**Analog search scope:** `packages/lobby/`, `packages/votos/`, `packages/identity/`, `packages/tramitacion/`, `packages/ingest/`, `supabase/migrations/`, `supabase/tests/`, `pnpm-workspace.yaml`.
**Files scanned:** 16 read + 4 glob/grep.
**Pattern extraction date:** 2026-07-22
