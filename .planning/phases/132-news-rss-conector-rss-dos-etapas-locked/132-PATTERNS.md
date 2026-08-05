# Phase 132: NEWS-RSS — Conector RSS dos-etapas LOCKED - Pattern Map

**Mapped:** 2026-08-05
**Files analyzed:** 16 (14 nuevos en `packages/news` + 1 migración + 1 pgTAP) + 2 modificados
**Analogs found:** 15 / 16

> Régimen de esta fase: **ensamblaje, no infraestructura**. Cada archivo nuevo copia un analog
> existente. Si un archivo nuevo no tiene analog, es señal de que se está reimplementando algo
> que el framework ya resuelve (D-08 lo prohíbe).

## File Classification

| Nuevo/Modificado | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `packages/news/package.json` | config | — | `packages/tramitacion/package.json` | exact |
| `packages/news/tsconfig.json` | config | — | `packages/tramitacion/tsconfig.json` | exact |
| `packages/news/vitest.config.ts` | config | — | `packages/tramitacion/vitest.config.ts` | exact |
| `packages/news/src/index.ts` | barrel | — | `packages/tramitacion/src/index.ts` | exact |
| `packages/news/src/feeds.ts` | config congelado | — | `packages/dinero/src/connector-servel.ts:27` (`SERVEL_HOST` congelado) | partial |
| `packages/news/src/connector-news.ts` | connector | request-response / batch | `packages/ingest/src/dummy-connector.ts` (hooks) + `packages/dinero/src/connector-servel.ts` (extraHosts) | role-match (ver nota) |
| `packages/news/src/model.ts` | model | — | `packages/tramitacion/src/model.ts` (zod + tipos) | exact |
| `packages/news/src/parse-rss.ts` | parser | transform (XML→objetos) | `packages/tramitacion/src/parse-senado-tramitacion.ts` | exact |
| `packages/news/src/canonicalizar-url.ts` | utility | transform | `packages/core/src/nombre.ts` (`fold`, normalización pura + test) | partial |
| `packages/news/src/prefiltro-lexico.ts` | utility | transform | `packages/core/src/nombre.ts:51-63` (NFD→ascii→lower) | role-match |
| `packages/news/src/writer.ts` | writer iface + fake | CRUD | `packages/tramitacion/src/writer.ts` | exact |
| `packages/news/src/writer-supabase.ts` | writer | CRUD | `packages/tramitacion/src/writer-supabase.ts` | exact |
| `packages/news/src/carga-run.ts` | service/orquestador | batch | `packages/tramitacion/src/ingest-run.ts` | role-match |
| `packages/news/src/run-news-cli.ts` | CLI | request-response + file-I/O | `packages/tramitacion/src/ingest-cli.ts` | exact |
| `packages/news/src/__fixtures__/*.xml` | fixture | — | `packages/tramitacion/src/__fixtures__/` | exact |
| `supabase/migrations/0084_noticia.sql` | migration | — | `supabase/migrations/0070_notificacion_envio.sql` | exact |
| `supabase/tests/0084_noticia.test.sql` | test (pgTAP) | — | `supabase/tests/0070_notificacion_envio.test.sql` | exact |
| `tsconfig.json` (raíz) — **modificado** | config | — | entrada existente `{ "path": "./packages/tramitacion" }` | exact |

**Nota de match sobre `connector-news.ts`:** es el **único** consumidor real de
`BaseConnector.run()` en el repo — `DummyConnector` es el único que hoy extiende `BaseConnector`
(`grep "extends BaseConnector"` = 1 hit productivo). `connector-senado.ts` / `connector-servel.ts`
**evitan `run()` a propósito** (su caché diaria saltaría re-corridas). Para news, la caché diaria
**es** el requisito (SC2 `[skip]`) ⇒ el analog de *estructura* es `DummyConnector`, y el analog
de *allowlist SSRF* es `connector-servel.ts`. Copiar de cada uno lo que le corresponde.

---

## Pattern Assignments

### `packages/news/src/connector-news.ts` (connector, batch)

**Analog A (estructura de hooks):** `packages/ingest/src/dummy-connector.ts` — el ÚNICO
`extends BaseConnector` del repo.

Hooks a implementar, líneas 16-42:
```typescript
export class DummyConnector extends BaseConnector<DummyRaw> {
  protected sourceId = "dummy";

  protected endpoints(): RequestSpec[] {
    return [{ url: "https://dummy.local/echo", host: "dummy.local",
              resource: "echo", key: "echo", params: { probe: 1 }, ext: "json" }];
  }

  protected validateShape(body: unknown): DummyRaw { return body; }

  protected fingerprint(raw: DummyRaw): Promise<string> { return fingerprint(raw); }
}
```

Contrato que el hook debe respetar (`packages/ingest/src/base-connector.ts:22-39`):
```typescript
export interface RequestSpec {
  url: string;
  host?: string;      // DEPRECATED (WR-01): el framework deriva el host de new URL(url).host
  resource: string;   // mapea a source_snapshot.resource — UNICO por feed (Pattern 2)
  key: string;
  params?: Record<string, unknown>;
  ext?: string;       // default "json" -> news debe setear "xml"
}
```

**Por qué `resource` único por feed** (`base-connector.ts:124` + `cache.hasToday`):
```typescript
// 1. Cache diaria (FND-03): si ya hay snapshot de hoy, no re-pedir.
if (await this.deps.cache.hasToday(this.sourceId, spec, now)) continue;
```
Si los feeds comparten `resource`, solo el primero se descarga y el resto sale `[skip]` para
siempre. `resource: \`rss-${slug}\``.

**Por qué `validateShape` recibe `string`** (`base-connector.ts:189-198`):
```typescript
protected decodeJson(body: Uint8Array): unknown {
  const text = new TextDecoder().decode(body);
  try { return JSON.parse(text); }
  catch { return text; }   // XML/HTML crudo -> llega un string al hook
}
```
⇒ shape-guard SUAVE sobre string (`/<rss[\s>]|<feed[\s>]/i`), zod estricto NO va aquí (va en
etapa 2, D-10).

**Y los bytes que van a R2 son el `body` crudo, no lo que devuelve `validateShape`**
(`base-connector.ts:143` fetch → `159-169` sha256+putImmutable). Correcto para el régimen; no tocar.

**Analog B (allowlist SSRF con `extraHosts` scoped):** `packages/dinero/src/connector-servel.ts`.

Constante de host congelada (líneas 26-27) + patrón de merge (133-138):
```typescript
/** Host EXACTO del repositorio de gasto electoral de SERVEL (Azure Blob, GET anonimo). */
export const SERVEL_HOST = "repodocgastoelectoral.blob.core.windows.net";

/** Allowlist efectiva: la base del caller + el host SERVEL como extraHost EXACTO. */
private allowlistConServel(): AllowlistOptions {
  const base = this.deps.allowlist ?? {};
  const extra = new Set([...(base.extraHosts ?? []), SERVEL_HOST]);
  return { ...base, extraHosts: [...extra] };
}
```

Aserción `https:` explícita (líneas 157-160) — **obligatoria**, `extraHosts` admite `http`:
```typescript
// 2. ASSERCION https EXPLICITA para SERVEL_HOST: extraHosts admite http; SERVEL es https-only.
if (parsed.protocol !== "https:") {
  throw new Error(`SERVEL requiere https (recibido ${parsed.protocol}): ${urlSinQuery(url)}`);
}
```

Comentario-cabecera que documenta la prohibición (líneas 7-9) — copiar el espíritu literal:
```
// El host SERVEL va como `extraHosts` EXACTO scoped al conector (allowlist.ts:116-123). NUNCA se
// agrega a DEFAULT_ALLOWED_SUFFIXES (ampliaria SSRF a TODO tenant Azure).
```

**Ojo (Pitfall 1 del research):** en news la allowlist debe inyectarse **en `Fetcher` Y en
`RobotsGuard`** — el guard gatea el propio GET de `robots.txt` (`robots.ts:105-111`). Servel es
precedente parcial aquí: pasa la allowlist al `assertAllowedUrl` pero el `RobotsGuard` viene
construido por el CLI (`ingest-cli.ts:272`: `new RobotsGuard({ allowlist: {} })`). **No copiar ese
`{}`** — para news sería un `HOST_BLOCKED` silencioso en los 4 feeds.

**Errores del dominio** (`connector-servel.ts:29-50`): `RobotsDisallowError` ya existe exportado
por `packages/tramitacion/src/connector-camara` y por `connector-servel`. Reusar el de un package
existente o declarar uno propio siguiendo esa forma (clase con `readonly url` + `this.name`).

---

### `packages/news/src/run-news-cli.ts` (CLI, request-response + file-I/O)

**Analog:** `packages/tramitacion/src/ingest-cli.ts` (el patrón LOCKED del `--from-r2`).

**Parseo de flags con error tipado ANTES de tocar red/DB** (líneas 80-143):
```typescript
export class IngestCliArgsError extends Error {
  constructor(msg: string) { super(msg); this.name = "IngestCliArgsError"; }
}

export function parseArgs(argv: string[]): IngestCliOptions {
  const opts: IngestCliOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--dry-run": opts.dryRun = true; break;
      case "--from-r2": {
        const path = argv[++i];
        if (!path) throw new IngestCliArgsError("--from-r2 requiere un r2Path");
        opts.fromR2 = path;
        break;
      }
      default:
        if (a != null && a.startsWith("--")) throw new IngestCliArgsError(`flag desconocido: ${a}`);
    }
  }
  return opts;
}
```

**`findWorkspaceRoot` — copiar LITERALMENTE** (líneas 149-161, Pitfall 9 `process.cwd` bajo
`pnpm --filter exec`):
```typescript
export function findWorkspaceRoot(start: string): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`findWorkspaceRoot: no se encontró pnpm-workspace.yaml subiendo desde ${start}`);
    }
    dir = parent;
  }
}
```
(Es exportado por `@obs/tramitacion` — se puede importar en vez de duplicar; decidir en el plan.)

**Construcción de `R2Store` desde env, con la tri-estado inyectable** (líneas 200-217):
```typescript
// opts.r2Store === null  -> "forzar sin R2"; === undefined -> "construir desde env si disponible"
let r2Store: R2Store | null;
if (opts.r2Store !== undefined) { r2Store = opts.r2Store; }
else {
  const ak = process.env.R2_ACCESS_KEY_ID;
  const sk = process.env.R2_SECRET_ACCESS_KEY ?? "";
  const ep = process.env.R2_ENDPOINT_URL ?? "";
  const bk = process.env.R2_BUCKET ?? "";
  r2Store = ak && ep ? new R2Store({ accessKeyId: ak, secretAccessKey: sk, endpoint: ep, bucket: bk }) : null;
}
if (!r2Store && !dryRun) log("[WARN] R2 no configurado — Etapa 1 omitida (sin crudo versionado)");
```
⚠️ Para 132 ese `[WARN]` **no es aceptable como degradación** (research §Environment): R2 es el
corazón de SC2/SC3. El plan debe decidir si news falla duro sin R2.

**Rama `--from-r2` — el patrón exacto del replay** (líneas 219-266, resumido):
```typescript
if (opts.fromR2) {
  if (!r2Store) throw new IngestCliArgsError("--from-r2 requiere R2 configurado (R2_ACCESS_KEY_ID + R2_ENDPOINT_URL)");
  log(`ingest: modo --from-r2 → leyendo crudo desde R2 (${opts.fromR2})`);
  const bytes = await r2Store.getObject(opts.fromR2);        // UNICA fuente de datos
  const envelope = JSON.parse(new TextDecoder().decode(bytes)) as {...};
  // conectores fake que sirven el crudo del envelope sin red
  const senadoFake = { async fetchTramitacion() { return envelope.tramXml ?? ""; } } as unknown as SenadoConnector;
  const res = await runIngest({ boletines: [envelope.boletin], ..., camara: camaraFake, senado: senadoFake, writer, log });
  return { ...res, dbLoaded, dryRun, boletinesPedidos: [envelope.boletin] };
}
```
**Diferencia para news:** tramitación guarda un *envelope JSON* con los XML dentro; news guarda el
**XML crudo tal cual** en R2 ⇒ el replay es `parseRss(new TextDecoder().decode(bytes))`, sin
envelope y sin conectores fake. Es más simple que el analog — no copiar la indirección del envelope.

**Selección de writer real vs in-memory** (líneas 279-290):
```typescript
let writer: TramitacionWriter;
let dbLoaded = false;
if (dryRun) { writer = opts.writer ?? new InMemoryTramitacionWriter(); }
else {
  writer = opts.writer ?? new SupabaseTramitacionWriter({ url: localUrl, serviceKey });
  dbLoaded = true;
  const destino = localUrl === DEFAULT_LOCAL_URL ? "LOCAL" : "REMOTO";
  log(`ingest: writer Supabase ${destino} (${localUrl}) — upsert idempotente`);
}
```

**Guard de entry-point + exit codes** (líneas 321-346):
```typescript
const isMain = typeof process !== "undefined" && process.argv[1] != null &&
  /ingest-cli\.(ts|js|mjs|cjs)$/.test(process.argv[1]);
if (isMain) {
  let parsed: IngestCliOptions;
  try { parsed = parseArgs(process.argv.slice(2)); }
  catch (err) { console.error("ingest FLAGS:", err instanceof Error ? err.message : err); process.exit(2); }
  main(parsed).then((r) => { console.log(...); process.exit(r.errores.length > 0 ? 1 : 0); })
              .catch((err) => { console.error("ingest FALLÓ:", ...); process.exit(1); });
}
```
Adaptar el regex a `/run-news-cli\.(ts|js|mjs|cjs)$/`.

**Dónde vive el `[skip]` del SC2 (D-132-B):** el CLI compara `endpoints().length` vs
`refs.length` devuelto por `run()` y emite el conteo. `BaseConnector.run()` hace `continue`
silencioso en cache-hit (`base-connector.ts:124`) y **no se toca**.

**Analog secundario para el runner de PROD** (si el plan lo quiere):
`packages/tramitacion/src/run-tramitacion-prod-cli.ts:1-45` — thin runner que carga `.env`
BOM-safe, apunta a `SUPABASE_API_URL` + `SUPABASE_SECRET_KEY` y reusa el `main()` del CLI local.
Credenciales **solo** de `.env`, NUNCA por argv.

---

### `packages/news/src/parse-rss.ts` (parser, transform)

**Analog:** `packages/tramitacion/src/parse-senado-tramitacion.ts`.

**Configuración del parser + helper de texto** (líneas 9-36):
```typescript
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });

function txt(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object") {
    const t = (v as Record<string, unknown>)["#text"];
    if (t == null) return null;
    const s = String(t).trim();
    return s.length === 0 ? null : s;
  }
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}
```
`parseTagValue: false` importa: evita que fast-xml-parser convierta a número/booleano un
`<guid>` o un id — mismo motivo aquí.

**Gotcha de listas** (cabecera, líneas 5-6) — aplica directo a `<item>`:
```
// Listas opcionales forzadas a array con [].concat (fast-xml-parser colapsa nodo único a objeto).
```
Un feed con **un solo `<item>`** llega como objeto, no array. Sin el `[].concat` el parseo
revienta o pierde el ítem.

**Gotcha de nodos nested vs `#text`** (líneas 38-69, `txtAutor`): fast-xml-parser 5.x parsea
`<a><B>x</B></a>` como `{ B: "x" }`, **no** `{ "#text": "x" }`. En RSS esto muerde con
`<dc:creator>`, `<media:content>` y `<source>`: leer la clave real primero, `#text` solo como
fallback defensivo. Y **no modificar el `txt()` genérico** para acomodar un caso — el analog es
explícito en eso.

**Provenance inline** (línea 10, `makeProvenance` de `@obs/core`) + validación con zod schema por
entidad — mismo contrato que el analog.

---

### `packages/news/src/model.ts` (model)

**Analog:** `packages/tramitacion/src/model.ts` — zod schemas + tipos exportados desde el barrel
(`index.ts:8-30`: `type Proyecto…` + `ProyectoSchema…`). Convención: un `XSchema` por entidad, el
tipo derivado con el mismo nombre sin sufijo.

**Restricción de fecha (Pitfall 6 + gotcha rector del proyecto):** `pubDate` viene con offsets
distintos por medio (Cooperativa `-0400`, el resto `+0000`). Columna `timestamptz`; el parseo
respeta el offset del feed. **Jamás** normalizar a una tz global. Analog de manejo de fechas:
`packages/tramitacion/src/fecha.ts` (`parseFechaCL`, `toIso`) — mismo package, mismo estilo de
helper puro con test.

---

### `packages/news/src/prefiltro-lexico.ts` y `canonicalizar-url.ts` (utilities, transform)

**Analog:** `packages/core/src/nombre.ts:50-63` — el `fold` canónico del repo:
```typescript
/** Fold: NFD strip de diacríticos (ñ→n), casefold, puntuación → separador. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/['‘’‐‑‒–—―-]/g, "")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
```
Copiar la **forma** (función pura, comentario que explica cada `replace`, test que congela casos).
El vocabulario legislativo (D-05) va como `const SET = Object.freeze([...])` — precedente de
congelado con `Object.freeze`: `connector-servel.ts:113-120` (`HEADERS_SERVEL`).

**Antes de foldear: despojar HTML** (Pitfall 7) — `description`/`content:encoded` traen `<div>`,
`<script>`, `<iframe>`. Sin despojo, palabras dentro de atributos/scripts inflan falsos positivos.
Y truncar el texto indexado para que un artículo largo no domine el matching.

---

### `packages/news/src/writer.ts` + `writer-supabase.ts` (writer, CRUD)

**Analog:** `packages/tramitacion/src/writer.ts` (interfaz + fake) y `writer-supabase.ts` (impl).

**Cabecera que declara la clave natural** (`writer.ts:1-11`) — replicar para news
(`noticia` → `url_hash`; `noticia_url_vista` → `url_hash`):
```
// El writer persiste el modelo común (...) de forma IDEMPOTENTE por clave natural (migración 0008):
//   * proyecto            → PK `boletin`
//   * voto                → unique (votacion_id, fuente_voter_id)
// Correr la ingesta 2× con el mismo input NO duplica filas (upsert, no insert).
```

**Cliente service_role + upsert idempotente** (`writer-supabase.ts:16-70`):
```typescript
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export class SupabaseTramitacionWriter implements TramitacionWriter {
  private readonly client: SupabaseClient;
  constructor(opts: SupabaseTramitacionWriterOptions) {
    this.client = opts.client ??
      createClient(opts.url, opts.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
  }

  async upsertProyecto(proyecto: Proyecto): Promise<void> {
    const { error } = await this.client
      .from("proyecto")
      .upsert(proyecto, { onConflict: "boletin", ignoreDuplicates: false });
```

**Chunking + dedupe defensivo** (líneas 36-53) — necesario: La Tercera/La Cuarta traen 100 ítems
y un mismo `url_hash` puede repetirse dentro del lote:
```typescript
const CHUNK = 500;
function chunk<T>(arr: T[], size: number): T[][] { ... }

/**
 * De-duplica por una clave (last-write-wins) ... Postgres aborta el lote con
 * `command cannot affect row a second time`.
 */
function dedupePorClave<T>(arr: T[], key: (v: T) => string): T[] {
  const m = new Map<string, T>();
  for (const v of arr) m.set(key(v), v);
  return [...m.values()];
}
```

**Regla de secretos** (cabecera, líneas 11-13): la service key NUNCA se interpola en mensajes de
error; solo se propaga `error.message` de PostgREST.

---

### `packages/news/src/carga-run.ts` (orquestador de etapa 2, batch)

**Analog:** `packages/tramitacion/src/ingest-run.ts` (`runIngest({ ..., writer, log })` con
`RunIngestOpts` / `RunIngestResult` exportados — ver `index.ts` "Ola 4"). Contrato del analog:
todo colaborador inyectado (writer, log, conectores), resultado con conteos + `errores[]`
(`{ boletin, etapa, mensaje }`) para degradación honesta sin abortar la corrida.

**Orden LOCKED del pipeline de etapa 2 (D-07/Pitfall 11):** marcar la URL en
`noticia_url_vista` **ANTES** de cualquier camino de rechazo. Marcar después = los descartados se
re-procesan eternamente y el conteo de D-07 queda inflado.

---

### `supabase/migrations/0084_noticia.sql` (migration)

**Analog:** `supabase/migrations/0070_notificacion_envio.sql` — el patrón deny-all TOTAL exacto
que pide D-12.

**Cabecera documentada + comando de apply** (líneas 1-35, extracto):
```sql
-- ── DENY-BY-DEFAULT TOTAL (más estricto que 0069) ───────────────────────────────
-- RLS habilitada SIN policy alguna (ni para authenticated ni para anon). NO grant.
-- service_role bypassa RLS. NO está en USER_OWNED_TABLES (es cola del cron, no dato
-- del usuario) → un `to authenticated` aquí cae en Block D Y en Block E del guard.
--
-- ── ORDEN DE APPLY / COMANDO (Plan 05) ──────────────────────────────────────────
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f \
--     supabase/migrations/0070_notificacion_envio.sql
-- NUNCA `supabase db push`. pgTAP contra el schema APLICADO = única prueba (Pitfall 6).
```

**DDL + RLS** (líneas 37-58):
```sql
create table if not exists notificacion_envio (
  id                 uuid primary key default gen_random_uuid(),
  ...
  estado             text not null default 'pendiente'
                       check (estado in ('pendiente','enviado','error')),
  created_at         timestamptz not null default now()
);

alter table notificacion_envio enable row level security;
-- SIN policy para authenticated, SIN grant a authenticated (queue service_role-only,
-- Block E del lockdown-guard). service_role bypassa RLS.

-- schema_migrations (insertar tras aplicar a PROD):
-- insert into schema_migrations (version) values ('0070');
```
Copiar: `check` de dominio para `estado`/`causa`, `created_at timestamptz default now()`, el
`enable row level security` **sin** policy, y la línea final de `schema_migrations`.

**Analog secundario para la cabecera-narrativa larga:**
`supabase/migrations/0080_actualidad_evidencia.sql:1-60` — cómo se documentan las decisiones
adjudicadas (D-xx) dentro del propio archivo, incluida la nota "0073/0075 escritas y NO aplicadas,
JAMÁS se editan".

**Numeración verificada:** último archivo = `0083_coautoria_v2.sql` ⇒ **0084 es el siguiente libre**.

---

### `supabase/tests/0084_noticia.test.sql` (test pgTAP)

**Analog:** `supabase/tests/0070_notificacion_envio.test.sql` — copiar íntegro cambiando la tabla.

```sql
begin;
select plan(6);

select has_table('public', 'notificacion_envio', 'tabla notificacion_envio existe');
select is(
  (select count(*)::int from pg_class where relname = 'notificacion_envio' and relrowsecurity = true),
  1, 'RLS enabled en notificacion_envio');

select has_column('public', 'notificacion_envio', 'ultimo_evento_visto',
  'columna ultimo_evento_visto (cursor idempotente) presente');

select is(has_table_privilege('authenticated', 'notificacion_envio', 'select'), false,
  'authenticated SIN select sobre notificacion_envio (cola service_role-only, T-103-06)');
select is(has_table_privilege('authenticated', 'notificacion_envio', 'insert'), false, ...);
select is(has_table_privilege('authenticated', 'notificacion_envio', 'update'), false, ...);

select * from finish();
rollback;
```
Para 132: mismas 6 aserciones **×2 tablas** (`noticia`, `noticia_url_vista`) y **×2 roles**
(`anon` además de `authenticated`, porque D-12 dice cero policy `anon`). Runner:
`PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f` contra el schema **APLICADO**.

---

### `packages/news/package.json` (config)

**Analog:** `packages/tramitacion/package.json` — copiar entero, quitando deps que news no usa
(`@obs/adjudication`, `@obs/identity`):
```json
{
  "name": "@obs/news",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -b",
    "ingest": "tsx src/run-news-cli.ts"
  },
  "dependencies": {
    "@obs/core": "workspace:*",
    "@obs/ingest": "workspace:*",
    "@supabase/supabase-js": "^2.108.2",
    "fast-xml-parser": "^5.9.2",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@types/node": "^20.19.43",
    "tsx": "^4.22.4",
    "vitest": "^3.0.0"
  }
}
```
El script `"test": "vitest run"` es lo que hace que el paquete entre en el `pnpm test` de la raíz
(`pnpm -r --filter "./packages/*" test`).

### `packages/news/tsconfig.json` (config)

**Analog:** `packages/tramitacion/tsconfig.json` — `references`, **NUNCA `paths` a `src`**
(rompe `tsc -b`, gotcha Phase 43):
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src", "outDir": "dist", "composite": true,
    "noEmit": false, "lib": ["ES2022", "DOM"], "types": ["node"]
  },
  "references": [{ "path": "../core" }, { "path": "../ingest" }],
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts", "test", "dist"]
}
```

### `packages/news/vitest.config.ts` (config) — **sin esto el paquete es CI-DARK**

**Analog:** `packages/tramitacion/vitest.config.ts`, literal:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"], passWithNoTests: true },
});
```
⚠️ `passWithNoTests: true` está en el analog. Combinado con Pitfall 8, un paquete sin tests
saldría verde — el plan debe verificar el conteo de tests corridos, no solo el exit code.

### `tsconfig.json` (raíz) — **modificado**

Añadir `{ "path": "./packages/news" }` a `references`. Precedente literal en el archivo
(`{ "path": "./packages/tramitacion" }`). Nota honesta: no todos los packages están listados ahí
(`actualidad`, `notificaciones`, `freshness` faltan) — el planner decide, pero listarlo es lo que
hace que `tsc -b` de la raíz lo cubra.

---

## Shared Patterns

### Cabecera de archivo explicativa (aplica a TODOS los `.ts` y `.sql` nuevos)
**Source:** `connector-servel.ts:1-13`, `writer-supabase.ts:1-14`, `0070_*.sql:1-35`
Todo archivo del repo abre con un bloque de comentario que declara: qué hace, qué orden LOCKED
respeta, qué decisión (D-xx / Pitfall N) lo justifica y qué está **prohibido** hacer ahí. No es
decoración: es donde vive el régimen. Ejemplo:
```typescript
// connector-servel — fetch del .xlsx de SERVEL ... REUSANDO @obs/ingest en el ORDEN LOCKED —
// NO `BaseConnector.run` (su cache diaria saltaria re-corridas):
//   assertAllowedUrl(url, {extraHosts:[SERVEL_HOST]}) -> assercion https explicita
//     -> robots.isAllowed(url) -> rateLimiter.wait(host) -> fetcher.get(...)
```

### Inyección de colaboradores por constructor (todo conector / writer / runner)
**Source:** `base-connector.ts:41-87` (`ConnectorDeps`), `connector-servel.ts:98-107`
**Apply to:** `connector-news.ts`, `carga-run.ts`, ambos writers
```typescript
export interface ServelConnectorDeps {
  fetcher: Fetcher;
  rateLimiter: HostRateLimiter;
  robots: RobotsGuard;
  allowlist?: AllowlistOptions;
  headFn?: HeadFn;   // inyectable para tests
}
```
Todo lo que toca red o DB entra por constructor ⇒ tests sin red ni DB. Es lo que hace posible el
test de replay con `fetch` que **lanza** (SC3).

### Congelado con test (`Object.freeze` + test que cae si cambia)
**Source:** `connector-servel.ts:113-120` (`HEADERS_SERVEL` con `Object.freeze`), guards nombrados
uno por uno en `package.json` raíz (script `guards`)
**Apply to:** `feeds.ts` (URLs + hosts), `prefiltro-lexico.ts` (vocabulario)
Del `package.json` raíz, la regla explícita del proyecto:
```
"//guards": "... D-13: jamás glob — `vitest run src/*guard*.test.ts` sale 0 sin correr nada"
```
⇒ los tests de congelado se referencian **por nombre de archivo**, nunca por glob.

### Degradación honesta con `errores[]` en vez de abortar
**Source:** `ingest-cli.ts:305-311`, `connector-servel.ts:37-50` (`ServelBloqueadaError`)
```typescript
log(`ingest: OK → ${res.proyectos} proyectos / ... (errores: ${res.errores.length})`);
for (const e of res.errores) log(`ingest: ERROR ${e.boletin} [${e.etapa}]: ${e.mensaje}`);
```
Un feed caído no aborta la corrida de los otros 4; se reporta y el exit code lo refleja
(`process.exit(r.errores.length > 0 ? 1 : 0)`).

### Saneo de URL en mensajes de error
**Source:** `connector-servel.ts:192-196`
```typescript
/** Saneo del URL para los mensajes de error: corta la querystring (SAS tokens del blob, etc.). */
function urlSinQuery(url: string): string {
  const i = url.indexOf("?");
  return i === -1 ? url : url.slice(0, i);
}
```
Los feeds de news no llevan secreto en la query, pero el patrón es la convención del repo para
cualquier URL que aparezca en un `throw`.

### Barrel `index.ts` por olas, con comentario de qué aporta cada una
**Source:** `packages/tramitacion/src/index.ts` (secciones "Ola 1..4")
**Apply to:** `packages/news/src/index.ts` — exportar tipos y valores por separado
(`export type {...}` / `export {...}`), agrupados por wave del plan.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `packages/news/src/canonicalizar-url.ts` | utility | transform | No existe canonicalizador de URLs (strip `utm_*`/`fbclid`/`gclid`) en el repo. El analog más cercano es `packages/core/src/nombre.ts` por **forma** (función pura normalizadora + test de congelado), no por contenido. Usar `URL.searchParams.delete` nativo; **no** instalar dependencia (research: cero paquetes nuevos en esta fase). |

**Casi-sin-analog (advertencia al planner):** `connector-news.ts` es el primer conector productivo
que usa `BaseConnector.run()`. `DummyConnector` es un walking skeleton con un endpoint falso —
copiar su **forma de hooks**, pero su cobertura de test no es un precedente suficiente. Los tests
del SC1 (rate-limiter recibe `wait()` por request; robots-disallow ⇒ cero `fetcher.get`; host
derivado de `new URL(spec.url).host` y no de `spec.host`) deben escribirse mirando
`packages/ingest/src/base-connector.test.ts`, que es donde ese comportamiento ya está ejercitado.

---

## Metadata

**Analog search scope:** `packages/{ingest,tramitacion,agenda,dinero,core}/src`,
`supabase/migrations`, `supabase/tests`, configs de raíz (`package.json`, `tsconfig.json`)
**Files read:** 14 (+ listados de 4 directorios)
**Pattern extraction date:** 2026-08-05
