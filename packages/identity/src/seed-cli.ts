/**
 * seed-cli — corrida LIVE de la siembra (ID-01 / ID-09).
 *
 * Flujo:
 *   1. Instancia los colaboradores REALES de `@obs/ingest` (Fetcher + HostRateLimiter +
 *      RobotsGuard) — política de fetch respetuosa (rate-limit 2-3s + UA identificado +
 *      robots + SSRF allowlist), NO reimplementada.
 *   2. `runSeeder` LIVE contra ambos catálogos gubernamentales (Senado XML + Cámara XML).
 *   3. `upsertMaestra` con el `SupabaseMaestraWriter` real contra el Supabase LOCAL
 *      (idempotente por clave natural). Si no hay credencial local, se omite la carga a DB
 *      pero el snapshot git (autoritativo, ID-09) SIEMPRE se escribe.
 *   4. `exportMaestra` con el `FsSeedFileWriter` real → `supabase/seeds/parlamentario.seed.json`
 *      (snapshot autoritativo versionado en git = ID-09 HOY).
 *
 * El `estado` NO se auto-confirma: la promoción a `confirmado` es revisión humana (checkpoint
 * Task 2). Con `--promote`, tras el visto bueno del operador, promueve las filas vigentes a
 * `confirmado` en el local y re-exporta el snapshot.
 *
 * Credenciales (CONTEXT): apunta SIEMPRE al Supabase LOCAL. Push remoto y R2 = pasos de
 * operador diferidos (ver docs/operador-fase3.md).
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Fetcher, HostRateLimiter, RobotsGuard } from "@obs/ingest";
import { runSeeder, upsertMaestra } from "./seeder";
import { exportMaestra, serializeMaestra, SEED_PATH } from "./backup";
import { SupabaseMaestraWriter } from "./writer-supabase";
import { FsSeedFileWriter } from "./writer-fs";
import type { Parlamentario, EstadoIdentidad } from "@obs/core";

/**
 * Resuelve la RAÍZ del workspace subiendo desde `start` hasta hallar `pnpm-workspace.yaml`.
 * El snapshot autoritativo (ID-09) vive en `<root>/supabase/seeds/...`, NO en el cwd del
 * paquete: pnpm corre el script con cwd = packages/identity, lo que escribiría el snapshot en
 * el lugar equivocado si se usara cwd directamente.
 */
function findWorkspaceRoot(start: string): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return start; // fallback: no se encontró (no rompe el export)
    dir = parent;
  }
}

const ESTADOS_VALIDOS = new Set<EstadoIdentidad>([
  "confirmado",
  "probable",
  "no_confirmado",
]);

function isEstado(v: unknown): v is EstadoIdentidad {
  return typeof v === "string" && ESTADOS_VALIDOS.has(v as EstadoIdentidad);
}

/** Lee `id -> estado` del snapshot committeado (si existe). Vacío si falta/ilegible. */
function readEstadoSnapshot(path: string): Map<string, EstadoIdentidad> {
  const out = new Map<string, EstadoIdentidad>();
  if (!existsSync(path)) return out;
  try {
    const rows = JSON.parse(readFileSync(path, "utf8")) as Array<{
      id?: unknown;
      estado?: unknown;
    }>;
    for (const r of rows) {
      if (typeof r.id === "string" && isEstado(r.estado)) {
        out.set(r.id, r.estado);
      }
    }
  } catch {
    // Snapshot ausente/corrupto: no se preserva nada (no rompe el export).
  }
  return out;
}

export interface SeedCliOptions {
  /** URL del Supabase LOCAL (default: env SUPABASE_LOCAL_URL || 127.0.0.1:54421). */
  localUrl?: string;
  /** Service key LOCAL (default: env SUPABASE_LOCAL_SERVICE_KEY). */
  serviceKey?: string;
  /** Promover el lote vigente a `confirmado` tras visto bueno humano. Default false. */
  promote?: boolean;
  /**
   * Preserva el `estado` ya confirmado por revisión humana al re-exportar (backup CI):
   * mergea el `estado` del snapshot committeado por `id`. Evita que una re-siembra
   * automática REVIERTA en silencio la compuerta humana (`confirmado` → `no_confirmado`).
   * Default false. Excluye `--promote` (el operador no corre en CI).
   */
  preserveEstado?: boolean;
  /** Raíz para resolver el snapshot (default: cwd). */
  cwd?: string;
  /** Sink de logs (inyectable para tests). Default console.log. */
  log?: (msg: string) => void;
}

export interface SeedCliResult {
  total: number;
  diputados: number;
  senadores: number;
  dbLoaded: boolean;
  promoted: { senado: number; camara: number } | null;
  snapshotPath: string;
  snapshotBytes: number;
}

const DEFAULT_LOCAL_URL = "http://127.0.0.1:54421";

/**
 * Corre la siembra live end-to-end. Devuelve un resumen (conteos, si cargó a DB, snapshot).
 * Lanza si un catálogo da error de fetch (403/429/etc.) — el caller decide reintento.
 */
export async function main(opts: SeedCliOptions = {}): Promise<SeedCliResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const localUrl =
    opts.localUrl ?? process.env.SUPABASE_LOCAL_URL ?? DEFAULT_LOCAL_URL;
  const serviceKey =
    opts.serviceKey ?? process.env.SUPABASE_LOCAL_SERVICE_KEY ?? "";

  // 1. Colaboradores reales (política de @obs/ingest: rate-limit + robots + UA + SSRF).
  const deps = {
    fetcher: new Fetcher(),
    rateLimiter: new HostRateLimiter(),
    robots: new RobotsGuard(),
  };

  // 2. Corrida LIVE: fetch ambos catálogos → parse → match (sin auto-confirmar).
  log("seed: fetching catálogos LIVE (Senado + Cámara, rate-limit 2-3s)…");
  const maestra: Parlamentario[] = await runSeeder(deps);
  const senadores = maestra.filter((p) => p.camara === "senado").length;
  const diputados = maestra.filter((p) => p.camara === "diputados").length;
  log(
    `seed: maestra real -> ${maestra.length} filas (${senadores} senadores + ${diputados} diputados)`,
  );

  // 3. Carga al Supabase LOCAL (idempotente por clave natural). Si no hay service key,
  //    se omite la DB (pero el snapshot git, autoritativo, SIEMPRE se escribe).
  let dbLoaded = false;
  let promoted: { senado: number; camara: number } | null = null;
  if (serviceKey.length > 0) {
    const writer = new SupabaseMaestraWriter({ url: localUrl, serviceKey });
    await upsertMaestra(maestra, writer);
    dbLoaded = true;
    log(`seed: maestra cargada en Supabase LOCAL (${localUrl}) — upsert idempotente`);

    // Compuerta humana (ID-01): solo con --promote, tras visto bueno del operador.
    if (opts.promote) {
      promoted = await writer.promoteToConfirmado(maestra);
      // Refleja el estado promovido en el dataset que se exporta al snapshot.
      for (const row of maestra) row.estado = "confirmado";
      log(
        `seed: PROMOVIDAS a confirmado (revisión humana) -> ${promoted.senado} senadores + ${promoted.camara} diputados`,
      );
    }
  } else {
    log(
      "seed: sin SUPABASE_LOCAL_SERVICE_KEY -> carga a DB OMITIDA (snapshot git sigue siendo autoritativo, ID-09)",
    );
  }

  // 3b. Preservar la compuerta humana en backups automáticos (CI): mergea el `estado`
  //     ya committeado por `id`. Sin esto, una re-siembra revertiría `confirmado` →
  //     `no_confirmado` en silencio (deshacer la revisión humana es un fallo de corrección).
  const root = opts.cwd ?? findWorkspaceRoot(process.cwd());
  if (opts.preserveEstado && !opts.promote) {
    const prev = readEstadoSnapshot(resolve(root, SEED_PATH));
    let preservados = 0;
    for (const row of maestra) {
      const estadoPrevio = prev.get(row.id);
      if (estadoPrevio != null && estadoPrevio !== row.estado) {
        row.estado = estadoPrevio;
        preservados++;
      }
    }
    log(`seed: estado preservado del snapshot previo -> ${preservados} filas`);
  }

  // 4. Snapshot autoritativo en git (ID-09). R2 gateado (r2Enabled=false; credencial 401).
  //    El destino se resuelve contra la RAÍZ del workspace (no el cwd del paquete).
  const fsWriter = new FsSeedFileWriter({ cwd: root });
  const res = await exportMaestra(maestra, { writer: fsWriter, r2Enabled: false });
  log(`seed: snapshot escrito -> ${res.path} (${res.bytes} bytes)`);

  return {
    total: maestra.length,
    diputados,
    senadores,
    dbLoaded,
    promoted,
    snapshotPath: res.path,
    snapshotBytes: res.bytes,
  };
}

// Re-export por conveniencia (round-trip / verificación).
export { serializeMaestra, SEED_PATH };

// Entry-point CLI: `node seed-cli.js [--promote] [--preserve-estado]`.
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  /seed-cli\.(ts|js|mjs|cjs)$/.test(process.argv[1]);
if (isMain) {
  const promote = process.argv.includes("--promote");
  const preserveEstado = process.argv.includes("--preserve-estado");
  main({ promote, preserveEstado })
    .then((r) => {
      console.log(
        `\nseed OK: total=${r.total} senadores=${r.senadores} diputados=${r.diputados} dbLoaded=${r.dbLoaded} promoted=${JSON.stringify(r.promoted)}`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error("seed FALLÓ:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
