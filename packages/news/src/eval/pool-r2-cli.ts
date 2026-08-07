// pool-r2-cli.ts — reconstrucción REAL de la ventana 133-b: source_snapshot (Postgres) →
// R2 (getObject) → construirPool (pool-r2.ts) → pool-133b.json congelado (133-b-01).
//
// Colaboradores INYECTABLES por parámetro (patrón carga-run.ts): `reconstruirPool` es cero
// red por sí misma, toda la I/O vive detrás de `r2Store`/`supabase` inyectados — con dobles
// de test corre sin red real. El entry-point (`main`) construye esos colaboradores desde env
// vía `findWorkspaceRoot`/`loadEnv` IMPORTADOS de `../run-news-cli.js` (B6) — jamás copiados:
// dos `loadEnv` divergiendo sería peor que exportar los dos que ya existían.
//
// Fail-closed (T-133-31): si la tasa de reconstrucción es < 1.0, o hay `sobrantes`, este CLI
// LANZA con el listado de hashes en vez de escribir un `pool-133b.json` parcial — una
// reconstrucción incompleta sesgaría el estrato sin dejar rastro.
//
// Credenciales SOLO desde env (JAMÁS por argv): la service key y el project-ref de Supabase
// NUNCA se interpolan ni se loguean en ningún mensaje de este módulo.
//
// Cero re-scrape de la fuente: la única entrada de red de este CLI es `r2Store.getObject`
// (más la lectura read-only de `source_snapshot`/`noticia_url_vista`). Jamás un `fetch` a
// latercera/lacuarta/exante/biobiochile/cooperativa.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { R2Store } from "@obs/ingest";
import { FEEDS } from "../feeds.js";
import { R2_PATH_RE, findWorkspaceRoot, loadEnv } from "../run-news-cli.js";
import { construirPool, type PoblacionRow, type PoolResultado, type SnapshotCrudo } from "./pool-r2.js";
import { canonicalizar, sha256 } from "./canonicalizar-json.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const POOL_JSON_PATH = join(AQUI, "pool-133b.json");

/** Fila cruda de `source_snapshot` para `source='news'`. */
interface SourceSnapshotRow {
  r2_path: string;
  resource: string;
  date_bucket: string;
}

/** Sub-conjunto ESTRUCTURAL del cliente supabase-js — tipado estructural (espejo de
 * `rotacion-leyes.ts`/`ClienteCorpus`) para no acoplar este módulo al tipo genérico-profundo
 * del SDK. Ambas tablas se leen READ-ONLY, paginadas con `.order().range()` (cap 1k de
 * PostgREST — gotcha rector v6.1). */
export interface SupabaseLike {
  from(tabla: string): {
    select(cols: string): {
      eq(col: string, val: unknown): {
        order(col: string, opts: { ascending: boolean }): {
          range(
            from: number,
            to: number,
          ): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
        };
      };
      order(col: string, opts: { ascending: boolean }): {
        range(
          from: number,
          to: number,
        ): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
      };
    };
  };
}

const PAGE = 1000;

/** Lee `source_snapshot` completo para `source='news'`, paginado (WR-01: orden estable). */
async function leerSourceSnapshots(supabase: SupabaseLike): Promise<SourceSnapshotRow[]> {
  const todos: SourceSnapshotRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("source_snapshot")
      .select("r2_path,resource,date_bucket")
      .eq("source", "news")
      .order("r2_path", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`leerSourceSnapshots falló: ${error.message}`);
    const filas = (data ?? []) as SourceSnapshotRow[];
    todos.push(...filas);
    if (filas.length < PAGE) break;
  }
  return todos;
}

/** Lee `noticia_url_vista` completa, paginada (WR-01: cap 1k de PostgREST, gotcha rector v6.1;
 * el orden total del muestreo se aplica en código en 133-b-02, `.order()` solo pagina). */
async function leerPoblacion(supabase: SupabaseLike): Promise<PoblacionRow[]> {
  const todos: PoblacionRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("noticia_url_vista")
      .select("url_hash,url_canonica,outlet,estado,causa")
      .order("url_hash", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`leerPoblacion falló: ${error.message}`);
    const filas = (data ?? []) as PoblacionRow[];
    todos.push(...filas);
    if (filas.length < PAGE) break;
  }
  return todos;
}

/** Resuelve el `slug` de un `resource` `rss-<slug>` contra `FEEDS` — jamás un valor inventado
 * (WR-04 de 132: un outlet sin respaldo ensucia el dato). */
function outletDeResource(resource: string): string {
  const m = /^rss-([a-z0-9-]+)$/.exec(resource);
  const slug = m?.[1];
  const feed = slug ? FEEDS.find((f) => f.slug === slug) : undefined;
  if (!feed) {
    throw new Error(`pool-r2-cli: resource sin feed reconocido en FEEDS: ${resource}`);
  }
  return feed.slug;
}

export interface ReconstruirPoolOpts {
  r2Store: R2Store;
  supabase: SupabaseLike;
  log: (msg: string) => void;
}

/**
 * Orquesta la reconstrucción real: `source_snapshot` → `getObject` × 15 → `noticia_url_vista`
 * → `construirPool`. Fail-closed: lanza si `tasaReconstruccion < 1.0` o si hay `sobrantes` —
 * jamás devuelve (ni el CLI escribe) una reconstrucción parcial.
 */
export async function reconstruirPool(opts: ReconstruirPoolOpts): Promise<PoolResultado> {
  const { r2Store, supabase, log } = opts;

  const filasSnapshot = await leerSourceSnapshots(supabase);
  const snapshots: SnapshotCrudo[] = [];
  for (const fila of filasSnapshot) {
    if (!R2_PATH_RE.test(fila.r2_path)) {
      throw new Error(`pool-r2-cli: r2_path no matchea R2_PATH_RE: ${fila.r2_path}`);
    }
    const outlet = outletDeResource(fila.resource);
    log(`pool-r2-cli: leyendo ${fila.r2_path}`);
    const bytes = await r2Store.getObject(fila.r2_path);
    const xml = new TextDecoder().decode(bytes);
    snapshots.push({ r2Path: fila.r2_path, dateBucket: fila.date_bucket, outlet, xml });
  }

  const poblacion = await leerPoblacion(supabase);

  const resultado = await construirPool({ snapshots, poblacion });

  // Fail-closed (T-133-31): una reconstrucción parcial NUNCA se escribe. `sobrantes` también
  // reprueba: crudo reconstruido sin contraparte en Postgres es señal de una ventana que se
  // movió o un join roto — ninguno de los dos se tolera en silencio.
  if (resultado.tasaReconstruccion < 1 || resultado.sobrantes.length > 0) {
    const hashesFaltantes = resultado.faltantes.map((f) => f.url_hash).join(", ");
    const hashesSobrantes = resultado.sobrantes.map((s) => s.url_hash).join(", ");
    throw new Error(
      `pool-r2-cli: reconstrucción parcial (tasa=${resultado.tasaReconstruccion}) — ` +
        `faltantes=[${hashesFaltantes}] sobrantes=[${hashesSobrantes}]`,
    );
  }

  return resultado;
}

/** Línea de una sola pieza parseable, gates de composición incluidos (W3). Nombres de campo
 * SIN dígitos, para que el extractor `sed` de medición no tenga que desambiguar. */
function lineaResumen(r: PoolResultado): string {
  const outlets = ["latercera", "lacuarta", "exante", "biobiochile", "cooperativa"] as const;
  const nombreCampo: Record<(typeof outlets)[number], string> = {
    latercera: "pOutletLatercera",
    lacuarta: "pOutletLacuarta",
    exante: "pOutletExante",
    biobiochile: "pOutletBiobiochile",
    cooperativa: "pOutletCooperativa",
  };
  const porOutletTxt = outlets
    .map((o) => `${nombreCampo[o]}=${r.stats.porOutlet[o] ?? 0}`)
    .join(" ");
  const pTotal = outlets.reduce((acc, o) => acc + (r.stats.porOutlet[o] ?? 0), 0);
  return (
    `pool: snapshots=${r.stats.snapshots} itemsParseados=${r.stats.itemsParseados} ` +
    `hashesUnicos=${r.stats.hashesUnicos} poblacion=${r.casos.length + r.faltantes.length} ` +
    `reconstruidos=${r.casos.length} faltantes=${r.faltantes.length} sobrantes=${r.sobrantes.length} ` +
    `sinDescripcion=${r.stats.sinDescripcion} erroresParseo=${r.stats.erroresParseo} ` +
    `tituloVacio=${r.stats.titulosVacios} ${porOutletTxt} pTotal=${pTotal}`
  );
}

/** Entry-point CLI: construye colaboradores REALES desde env y congela `pool-133b.json`. */
export async function main(): Promise<void> {
  const root = findWorkspaceRoot(process.cwd());
  const env = loadEnv(root);
  const log = (m: string) => console.log(m);

  const faltantesR2 = ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT_URL", "R2_BUCKET"].filter(
    (k) => !env[k],
  );
  if (faltantesR2.length > 0) {
    throw new Error(`pool-r2-cli: faltan variables R2 en env: ${faltantesR2.join(", ")}`);
  }
  const url = env.SUPABASE_API_URL ?? env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "pool-r2-cli: faltan credenciales Supabase en env (SUPABASE_API_URL/SUPABASE_URL + SUPABASE_SECRET_KEY)",
    );
  }

  const { R2Store } = await import("@obs/ingest");
  const r2Store = new R2Store({
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    endpoint: env.R2_ENDPOINT_URL!,
    bucket: env.R2_BUCKET!,
  });
  const supabase = createClient(url, serviceKey) as unknown as SupabaseLike;

  const resultado = await reconstruirPool({ r2Store, supabase, log });

  const raw = canonicalizar(
    resultado.casos.map((c) => ({
      caso_id: c.caso_id,
      url_hash: c.url_hash,
      url_canonica: c.url_canonica,
      outlet: c.outlet,
      estado: c.estado,
      causa: c.causa,
      titulo: c.titulo,
      descripcion: c.descripcion,
      fecha_pub: c.fecha_pub,
      r2_path: c.r2_path,
      date_bucket: c.date_bucket,
    })),
  );
  writeFileSync(POOL_JSON_PATH, raw, "utf8");
  log(`pool-r2-cli: pool-133b.json escrito (sha256=${sha256(raw)})`);
  log(lineaResumen(resultado));
}

const ESTE_ARCHIVO = fileURLToPath(import.meta.url);
const ARCHIVO_INVOCADO = process.argv[1] ?? "";
if (ESTE_ARCHIVO === ARCHIVO_INVOCADO) {
  main().catch((err) => {
    console.error("pool-r2-cli FALLÓ:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
