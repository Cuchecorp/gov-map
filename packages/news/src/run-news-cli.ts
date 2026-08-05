// run-news-cli — entry-point local que ata Etapa 1 (RSS → R2) + Etapa 2 (R2 → Supabase)
// de la ingesta de prensa (132-06). Espeja `ingest-cli.ts`/`run-tramitacion-prod-cli.ts` de
// @obs/tramitacion y `ingest-cli.ts` de @obs/lobby: colaboradores REALES de @obs/ingest vía
// `buildNewsDeps()` (132-03), credenciales SOLO desde env/`.env` (JAMÁS por argv), R2
// OBLIGATORIO (a diferencia de esos analogs, que degradan con una advertencia + Etapa 1 omitida:
// para news R2 es el corazón de SC2/SC3, así que sin R2 y sin `--dry-run` el CLI FALLA DURO
// con exit 2 — cero rama de advertencia que continúe).
//
// Flags (validados ANTES de tocar red/DB):
//   --dry-run            Etapa 2 escribe con InMemoryNewsWriter (NO toca Supabase).
//                         ADVERTENCIA (F-2, premortem): --dry-run SOLO cambia el writer de la
//                         Etapa 2. La Etapa 1 sigue pasando por BaseConnector.run(), que escribe
//                         source_snapshot INCONDICIONALMENTE, y DailyCache lee de ahí ⇒ un
//                         --dry-run de Etapa 1 CONSUME la caché diaria del día igual que una
//                         corrida LIVE. La única rama que NO consume la caché diaria es
//                         --from-r2 (no pasa por run()).
//   --from-r2 <r2Path>   Replay: la ÚNICA fuente de datos es `r2Store.getObject(r2Path)`. CERO
//                         fetch a los 5 feeds — la red está PROHIBIDA en este camino (SC3).
//   --feeds a,b,c        subconjunto de FEEDS por slug (para no golpear los 5 innecesariamente).
//   --etapa1 | --etapa2  corre solo una etapa (por defecto corren ambas encadenadas).
//
// R2 (Etapa 1, hash-check, replay): construido desde env R2_* si no se inyecta. Tri-estado:
//   r2Store === null      → forzar SIN R2 (tests: fuerza el fallo duro).
//   r2Store === undefined → construir desde env si las vars están.
//   r2Store: R2Store       → inyectado (tests / replay).
// Sin R2 configurado y sin --dry-run: FALLA DURO (exit 2), nunca `[WARN]+continuar` — R2 es el
// corazón de SC2/SC3 para news (T-132-17).
//
// [skip] observable (D-132-B, SC2): `BaseConnector.run()` hace `continue` SILENCIOSO en
// cache-hit (base-connector.ts:124, NO llama a `log.skip`). El `[skip]` se DERIVA aquí
// comparando los slugs pedidos contra el `resource` codificado en el `r2Path` de cada
// `SnapshotRef` devuelto — sin tocar `@obs/ingest` (framework compartido LOCKED, D-132-B).

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  R2Store,
  SnapshotWriter,
  SupabaseSnapshotStore,
  type CreateSupabaseClient,
  type SnapshotRef,
} from "@obs/ingest";
import type { IngestRun } from "@obs/core";
import { createClient } from "@supabase/supabase-js";
import { NewsConnector, buildNewsDeps } from "./connector-news";
import { FEEDS, type FeedDef } from "./feeds";
import { parseRss } from "./parse-rss";
import { cargar, type CargarResult } from "./carga-run";
import { InMemoryNewsWriter, type NewsWriter } from "./writer";
import { SupabaseNewsWriter } from "./writer-supabase";

/** Adapta `createClient` de supabase-js a la factory estructural de `SupabaseSnapshotStore`
 * (espejo de `run-tramitacion-prod-cli.ts` / `ingest-cli.ts` de @obs/lobby). */
const createSupabaseClient: CreateSupabaseClient = (url, serviceKey) =>
  createClient(url, serviceKey) as unknown as ReturnType<CreateSupabaseClient>;

export interface NewsCliOptions {
  dryRun?: boolean;
  fromR2?: string;
  feeds?: string[];
  soloEtapa1?: boolean;
  soloEtapa2?: boolean;
  /** URL/serviceKey del Supabase de destino (tests / corrida real). Default: env. */
  url?: string;
  serviceKey?: string;
  /** Raíz para resolver `.env` (default: cwd). */
  cwd?: string;
  /** Conector inyectable (tests, sin red). Si se omite, `main` construye el REAL vía buildNewsDeps(). */
  conector?: { run(ctx: IngestRun): Promise<SnapshotRef[]> };
  /** Writer inyectable para tests sin DB. */
  writer?: NewsWriter;
  /** Store R2 inyectable (tests / corrida real con env cargado). undefined = construir desde
   * env; null = forzar SIN R2 (fallo duro si !dryRun). */
  r2Store?: R2Store | null;
  /**
   * Writer de `source_snapshot` inyectable (tests / corrida real). Si se omite, se construye
   * desde las mismas credenciales Supabase ya resueltas cuando aplica. SOLO se usa en la Etapa 1
   * real (`BaseConnector.run()`) — la rama `--from-r2` JAMÁS lo invoca (F-2/T-132-26): el
   * replay no pasa por `run()` y por tanto no puede escribir `source_snapshot`.
   */
  snapshotWriter?: Pick<SnapshotWriter, "write">;
  log?: (msg: string) => void;
}

export interface NewsCliResult {
  dryRun: boolean;
  dbLoaded: boolean;
  feedsPedidos: string[];
  descargados: number;
  skips: string[];
  carga?: CargarResult;
}

/** Error de validación de flags (se reporta ANTES de cualquier red/DB). */
export class NewsCliArgsError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "NewsCliArgsError";
  }
}

/** Error del fallo duro sin R2 (T-132-17): NUNCA degrada a `[WARN]+continuar`. */
export class NewsR2RequeridoError extends Error {
  constructor() {
    super(
      "run-news-cli: R2 no configurado (faltan R2_ACCESS_KEY_ID/R2_ENDPOINT_URL) — " +
        "R2 es obligatorio para news (SC2/SC3); usa --dry-run solo para pruebas locales sin R2, " +
        "o configura las variables R2_* en .env",
    );
    this.name = "NewsR2RequeridoError";
  }
}

/** Parsea argv → NewsCliOptions, validando los valores ANTES de cualquier red/DB. */
export function parseArgs(argv: string[]): NewsCliOptions {
  const opts: NewsCliOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    // `--` separador de `pnpm --filter ... exec tsx script -- --flag`: pnpm/npm lo consumen
    // para que TODO lo que sigue llegue intacto al script; si llega hasta acá (invocación
    // directa de tsx) se ignora silenciosamente — nunca es un flag desconocido.
    if (a === "--") continue;
    switch (a) {
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--from-r2": {
        const path = argv[++i];
        if (!path || path.startsWith("--")) {
          throw new NewsCliArgsError("--from-r2 requiere un r2Path");
        }
        opts.fromR2 = path;
        break;
      }
      case "--feeds": {
        const raw = argv[++i];
        if (raw == null || raw.trim().length === 0) {
          throw new NewsCliArgsError("--feeds vacío (esperado slug,slug)");
        }
        const lista = raw.split(",").map((s) => s.trim()).filter(Boolean);
        if (lista.length === 0) {
          throw new NewsCliArgsError("--feeds no contiene ningún slug válido");
        }
        opts.feeds = lista;
        break;
      }
      case "--etapa1":
        opts.soloEtapa1 = true;
        break;
      case "--etapa2":
        opts.soloEtapa2 = true;
        break;
      default:
        if (a != null && a.startsWith("--")) {
          throw new NewsCliArgsError(`flag desconocido: ${a}`);
        }
    }
  }
  return opts;
}

/**
 * Resuelve la RAÍZ del workspace subiendo desde `start` hasta hallar `pnpm-workspace.yaml`
 * (pnpm corre el script con cwd = paquete — Pitfall 9). Lanza si no la encuentra.
 */
export function findWorkspaceRoot(start: string): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `findWorkspaceRoot: no se encontró pnpm-workspace.yaml subiendo desde ${start}`,
      );
    }
    dir = parent;
  }
}

/** Carga `.env` BOM-safe con PRECEDENCIA de `process.env` (patrón `run-tramitacion-prod-cli.ts`). */
function loadEnv(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(join(root, ".env"), "utf8").replace(/^﻿/, "");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]!] = m[2]!.trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Sin `.env` (CI): los secrets vienen de process.env.
  }
  for (const k of [
    "SUPABASE_API_URL",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_URL",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_ENDPOINT_URL",
    "R2_BUCKET",
  ]) {
    if (process.env[k]) out[k] = process.env[k]!;
  }
  return out;
}

/** Slug de feed derivado de un `r2Path` con `resource = rss-<slug>` (Pattern 2, 132-03). */
function slugDesdeR2Path(r2Path: string): string | null {
  const m = /\/rss-([a-z]+)\//.exec(r2Path);
  return m ? m[1]! : null;
}

/**
 * Corre la ingesta local Etapa1+Etapa2 end-to-end. Lanza `NewsCliArgsError` si los flags son
 * inválidos, o `NewsR2RequeridoError` si falta R2 fuera de `--dry-run` (T-132-17, fallo duro).
 */
export async function main(opts: NewsCliOptions = {}): Promise<NewsCliResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const root = opts.cwd ?? findWorkspaceRoot(process.cwd());
  const env = loadEnv(root);

  const dryRun = opts.dryRun === true;
  const url = opts.url ?? env.SUPABASE_API_URL ?? env.SUPABASE_URL ?? "";
  const serviceKey = opts.serviceKey ?? env.SUPABASE_SECRET_KEY ?? "";

  // R2 Store — tri-estado (T-132-17): null = forzar sin R2; undefined = construir desde env.
  let r2Store: R2Store | null;
  if (opts.r2Store !== undefined) {
    r2Store = opts.r2Store;
  } else {
    const ak = env.R2_ACCESS_KEY_ID;
    const sk = env.R2_SECRET_ACCESS_KEY ?? "";
    const ep = env.R2_ENDPOINT_URL ?? "";
    const bk = env.R2_BUCKET ?? "";
    r2Store = ak && ep
      ? new R2Store({ accessKeyId: ak, secretAccessKey: sk, endpoint: ep, bucket: bk })
      : null;
  }
  // Fallo duro sin R2 (T-132-17): NUNCA una advertencia que deje continuar la corrida. news
  // depende de R2 para SC2 (caché diaria) y SC3 (replay) — sin él, la corrida no puede cumplir
  // su contrato.
  if (!r2Store && !dryRun) {
    throw new NewsR2RequeridoError();
  }

  // Feeds a pedir: subconjunto explícito o los 5 congelados.
  const feedsPedidos: FeedDef[] = opts.feeds
    ? FEEDS.filter((f) => opts.feeds!.includes(f.slug))
    : [...FEEDS];
  if (opts.feeds) {
    const encontrados = new Set(feedsPedidos.map((f) => f.slug));
    const faltantes = opts.feeds.filter((s) => !encontrados.has(s));
    if (faltantes.length > 0) {
      throw new NewsCliArgsError(`--feeds contiene slugs desconocidos: ${faltantes.join(",")}`);
    }
  }

  // Writer: --dry-run ⇒ in-memory; si no, Supabase real desde env (credenciales JAMÁS por argv).
  let writer: NewsWriter;
  let dbLoaded = false;
  if (dryRun) {
    writer = opts.writer ?? new InMemoryNewsWriter();
  } else {
    writer = opts.writer ?? new SupabaseNewsWriter({ url, serviceKey });
    dbLoaded = true;
  }

  const soloEtapa2 = opts.soloEtapa2 === true;
  const soloEtapa1 = opts.soloEtapa1 === true;
  const correrEtapa1 = !soloEtapa2;
  const correrEtapa2 = !soloEtapa1;

  // ── Modo --from-r2: replay SIN pasar por Etapa 1 / BaseConnector.run() (SC3) ────────────────
  // La red está PROHIBIDA en este camino: la única fuente de datos es `r2Store.getObject`.
  // No consume la caché diaria del día (no escribe source_snapshot) — es el único modo repetible.
  if (opts.fromR2 != null) {
    if (!r2Store) {
      throw new NewsCliArgsError("--from-r2 requiere R2 configurado (R2_ACCESS_KEY_ID + R2_ENDPOINT_URL)");
    }
    const slug = slugDesdeR2Path(opts.fromR2);
    const feed = slug ? FEEDS.find((f) => f.slug === slug) : undefined;
    const outlet = feed?.outlet ?? slug ?? "desconocido";
    log(`news-cli: modo --from-r2 → leyendo crudo desde R2 (${opts.fromR2})`);
    const bytes = await r2Store.getObject(opts.fromR2);
    const xml = new TextDecoder().decode(bytes);
    const { items, errores: erroresParseo } = parseRss(xml, outlet);
    for (const e of erroresParseo) log(`news-cli: WARN parseo ${e}`);

    const carga = await cargar({
      items,
      r2Path: opts.fromR2,
      contenidoHash: "",
      writer,
      log,
    });

    return {
      dryRun,
      dbLoaded,
      feedsPedidos: feed ? [feed.slug] : [],
      descargados: 0,
      skips: [],
      carga,
    };
  }

  // ── Etapa 1: RSS → R2 (BaseConnector.run(), orden LOCKED cache→robots→rate-limit→fetch→drift→R2→snapshot) ──
  let refs: SnapshotRef[] = [];
  const skips: string[] = [];
  if (correrEtapa1) {
    let conector: { run(ctx: IngestRun): Promise<SnapshotRef[]> };
    if (opts.conector) {
      conector = opts.conector;
    } else {
      // Cache diaria real (CR-01, 132-08): buildNewsDeps LANZA `NewsCacheRequeridaError` si no
      // recibe `cache` ni `supabase` — mismas credenciales ya resueltas arriba (líneas 222-223),
      // ANTES de tocar red (el conector aún no se construyó ni corrió).
      const deps = buildNewsDeps({
        ...(url && serviceKey ? { supabase: { url, serviceKey } } : {}),
        // r2/snapshot reales cuando hay R2/credenciales; si no (--dry-run sin R2), quedan los
        // dobles no-op de buildNewsDeps (la Etapa 1 igual corre fetch+parse, solo no persiste).
        ...(r2Store
          ? {
              r2: {
                putImmutable: (source, resource, date, sha, ext, body) =>
                  r2Store!.putImmutable(source, resource, date, sha, ext, body),
              },
            }
          : {}),
        ...(opts.snapshotWriter
          ? { snapshot: opts.snapshotWriter }
          : r2Store && !dryRun && url && serviceKey
            ? {
                snapshot: new SnapshotWriter(
                  new SupabaseSnapshotStore({ url, serviceKey, createClient: createSupabaseClient }),
                ),
              }
            : {}),
      });
      // NewsConnector siempre pide los 5 feeds congelados (FEEDS); `--feeds` filtra la Etapa 1
      // acotando qué endpoints Etapa 2 procesa después (no hay override de `endpoints()` sin
      // tocar el conector: se filtran los `refs` resultantes por slug pedido).
      conector = new NewsConnector(deps);
    }
    // `_ctx` no se usa dentro de `BaseConnector.run()` (base-connector.ts:114) — objeto mínimo
    // para satisfacer el tipo `IngestRun` sin fabricar un `ingest_run` real en DB.
    const ctx: IngestRun = {
      id: 0,
      source: "news",
      startedAt: new Date().toISOString(),
      status: "running",
      stats: {},
    };
    const todosRefs = await conector.run(ctx);
    const slugsPedidos = new Set(feedsPedidos.map((f) => f.slug));
    refs = todosRefs.filter((r) => {
      const slug = slugDesdeR2Path(r.r2Path);
      return slug != null && slugsPedidos.has(slug);
    });

    // [skip] observable (D-132-B): comparar slugs pedidos vs slugs presentes en `refs` — sin
    // tocar @obs/ingest, que hace `continue` SILENCIOSO en cache-hit (base-connector.ts:124).
    const slugsDescargados = new Set(
      refs.map((r) => slugDesdeR2Path(r.r2Path)).filter((s): s is string => s != null),
    );
    for (const f of feedsPedidos) {
      if (!slugsDescargados.has(f.slug)) {
        skips.push(f.slug);
        log(`[skip] rss-${f.slug} (cache-hit del día)`);
      }
    }
    log(`news-cli: descargados=${refs.length} skips=${skips.length}`);
  }

  // ── Etapa 2: R2 → Supabase (por cada SnapshotRef, getObject → parseRss → cargar) ──────────
  let cargaAcumulada: CargarResult | undefined;
  if (correrEtapa2 && refs.length > 0) {
    if (!r2Store) {
      throw new NewsCliArgsError("Etapa 2 requiere R2 configurado para leer los snapshots de Etapa 1");
    }
    for (const ref of refs) {
      const slug = slugDesdeR2Path(ref.r2Path);
      const feed = slug ? FEEDS.find((f) => f.slug === slug) : undefined;
      const outlet = feed?.outlet ?? slug ?? "desconocido";
      const bytes = await r2Store.getObject(ref.r2Path);
      const xml = new TextDecoder().decode(bytes);
      const { items, errores: erroresParseo } = parseRss(xml, outlet);
      for (const e of erroresParseo) log(`news-cli: WARN parseo ${e}`);

      const carga = await cargar({
        items,
        r2Path: ref.r2Path,
        contenidoHash: ref.contentHash,
        writer,
        log,
      });
      cargaAcumulada = cargaAcumulada
        ? {
            vistos: cargaAcumulada.vistos + carga.vistos,
            nuevos: cargaAcumulada.nuevos + carga.nuevos,
            duplicados: cargaAcumulada.duplicados + carga.duplicados,
            descartados: cargaAcumulada.descartados + carga.descartados,
            cargados: cargaAcumulada.cargados + carga.cargados,
            errores: [...cargaAcumulada.errores, ...carga.errores],
          }
        : carga;
    }
  }

  return {
    dryRun,
    dbLoaded,
    feedsPedidos: feedsPedidos.map((f) => f.slug),
    descargados: refs.length,
    skips,
    ...(cargaAcumulada ? { carga: cargaAcumulada } : {}),
  };
}

// Entry-point CLI: `tsx run-news-cli.ts [--dry-run] [--from-r2 path] [--feeds a,b] [--etapa1|--etapa2]`.
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  /run-news-cli\.(ts|js|mjs|cjs)$/.test(process.argv[1]);
if (isMain) {
  let parsed: NewsCliOptions;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error("news-cli FLAGS:", err instanceof Error ? err.message : err);
    process.exit(2);
  }
  main(parsed)
    .then((r) => {
      console.log(
        `\nnews-cli ${r.dryRun ? "DRY-RUN" : "LIVE"}: feeds=${r.feedsPedidos.length} ` +
          `descargados=${r.descargados} skips=${r.skips.length} dbLoaded=${r.dbLoaded}` +
          (r.carga
            ? ` | carga: vistos=${r.carga.vistos} nuevos=${r.carga.nuevos} ` +
              `duplicados=${r.carga.duplicados} descartados=${r.carga.descartados} ` +
              `cargados=${r.carga.cargados} errores=${r.carga.errores.length}`
            : ""),
      );
      process.exit(r.carga && r.carga.errores.length > 0 ? 1 : 0);
    })
    .catch((err) => {
      if (err instanceof NewsR2RequeridoError) {
        console.error("news-cli FALLÓ:", err.message);
        process.exit(2);
      }
      console.error("news-cli FALLÓ:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
