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
import {
  Fetcher,
  HostRateLimiter,
  RobotsGuard,
  R2Store,
  sha256Hex,
} from "@obs/ingest";
import {
  runSeeder,
  upsertMaestra,
  reconciliarMaestra,
  vigentesDeCatalogo,
} from "./seeder";
import {
  exportMaestra,
  serializeMaestra,
  SEED_PATH,
  type R2BackupTarget,
} from "./backup";
import { SupabaseMaestraWriter } from "./writer-supabase";
import { FsSeedFileWriter } from "./writer-fs";
import type { Parlamentario, EstadoIdentidad } from "@obs/core";

/**
 * Resuelve la RAÍZ del workspace subiendo desde `start` hasta hallar `pnpm-workspace.yaml`.
 * El snapshot autoritativo (ID-09) vive en `<root>/supabase/seeds/...`, NO en el cwd del
 * paquete: pnpm corre el script con cwd = packages/identity, lo que escribiría el snapshot en
 * el lugar equivocado si se usara cwd directamente.
 *
 * IN-02: si NO se encuentra la raíz, se LANZA (en vez de devolver `start`, un path plausible
 * pero equivocado que escribiría el snapshot en `packages/identity/supabase/seeds/...` y que
 * git no recogería para el commit de ID-09). Una mala configuración debe fallar, no ocultarse.
 */
export function findWorkspaceRoot(start: string): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `findWorkspaceRoot: no se encontró pnpm-workspace.yaml subiendo desde ${start} ` +
          "— no se puede ubicar supabase/seeds (IN-02)",
      );
    }
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

/**
 * Firma de identidad ESTABLE de una fila, independiente de la clave natural (`id`). WR-03:
 * si el catálogo reemite a un parlamentario bajo un PARLID/Id distinto, su `id` cambia y el
 * lookup por `id` falla; esta firma (cámara + periodo + nombre_normalizado) sigue empatando,
 * de modo que un `confirmado` humano no se pierde por una rotación de la clave natural.
 */
export function firmaIdentidad(r: {
  camara?: unknown;
  periodo?: unknown;
  nombre_normalizado?: unknown;
}): string {
  return `${String(r.camara)}|${String(r.periodo)}|${String(r.nombre_normalizado)}`;
}

interface SnapshotEstadoIndex {
  /** estado por `id` (clave natural primaria). */
  porId: Map<string, EstadoIdentidad>;
  /** estado por firma de identidad estable (fallback ante rotación de `id`). */
  porFirma: Map<string, EstadoIdentidad>;
}

/**
 * Lee el snapshot committeado (si existe) y devuelve dos índices de `estado`: por `id` y por
 * firma de identidad estable (WR-03). Vacío si falta. IN-03: un snapshot corrupto/ilegible se
 * REGISTRA vía `log` (antes se tragaba en silencio, ocultando la pérdida de la compuerta humana).
 */
export function readEstadoSnapshot(
  path: string,
  log: (msg: string) => void,
): SnapshotEstadoIndex {
  const porId = new Map<string, EstadoIdentidad>();
  const porFirma = new Map<string, EstadoIdentidad>();
  if (!existsSync(path)) return { porId, porFirma };
  try {
    const rows = JSON.parse(readFileSync(path, "utf8")) as Array<{
      id?: unknown;
      estado?: unknown;
      camara?: unknown;
      periodo?: unknown;
      nombre_normalizado?: unknown;
    }>;
    for (const r of rows) {
      if (isEstado(r.estado)) {
        if (typeof r.id === "string") porId.set(r.id, r.estado);
        porFirma.set(firmaIdentidad(r), r.estado);
      }
    }
  } catch (err) {
    // IN-03: snapshot corrupto. No se preserva nada (no rompe el export), pero se visibiliza
    // en CI: tragarlo en silencio degradaría la preservación de la compuerta humana sin aviso.
    log(
      `seed: WARN snapshot previo ilegible/corrupto en ${path} -> no se preserva estado ` +
        `(${err instanceof Error ? err.message : String(err)}) (IN-03)`,
    );
  }
  return { porId, porFirma };
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
  /**
   * Habilita el respaldo del snapshot a R2 (WR-02). Solo surte efecto si HAY credenciales R2
   * válidas en el entorno (`R2_ENDPOINT_URL`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/
   * `R2_BUCKET`); sin ellas, el flag es un no-op explícito (se registra y se omite R2). Default
   * false.
   */
  r2?: boolean;
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
  /** Filas promovidas a `confirmado` (allow-list principiada) o null si no se promovió. */
  promoted: { promovidos: number } | null;
  /** true si el snapshot se subió a R2 con éxito; false si deshabilitado/sin cred/falló. */
  r2Ok: boolean;
  snapshotPath: string;
  snapshotBytes: number;
}

const DEFAULT_LOCAL_URL = "http://127.0.0.1:54421";

/**
 * Construye el `R2BackupTarget` desde el entorno SOLO si las 4 credenciales R2 están presentes
 * (WR-02). Devuelve `null` si falta alguna → R2 queda como no-op explícito (sin enmascarar un
 * leg de respaldo inerte como funcional). Gateado por presencia de credencial, no por el flag.
 */
export function buildR2Target(): R2BackupTarget | null {
  const endpoint = process.env.R2_ENDPOINT_URL ?? "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
  const bucket = process.env.R2_BUCKET ?? "";
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) return null;

  const store = new R2Store({ endpoint, accessKeyId, secretAccessKey, bucket });
  return {
    async put(content: string): Promise<string> {
      const body = new TextEncoder().encode(content);
      const sha = await sha256Hex(body);
      const date = new Date().toISOString().slice(0, 10);
      return store.putImmutable("identity", "parlamentario-seed", date, sha, "json", body);
    },
  };
}

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
    robots: new RobotsGuard({ allowlist: {} }),
  };

  // 2. Corrida LIVE: fetch ambos catálogos → parse → match (sin auto-confirmar).
  log("seed: fetching catálogos LIVE (Senado + Cámara, rate-limit 2-3s)…");
  const maestra: Parlamentario[] = await runSeeder(deps);
  const senadores = maestra.filter((p) => p.camara === "senado").length;
  const diputados = maestra.filter((p) => p.camara === "diputados").length;
  log(
    `seed: maestra real -> ${maestra.length} filas (${senadores} senadores + ${diputados} diputados)`,
  );

  // 2b. Reconciliación determinista (IN-01): NO se descarta su Resolution. Es la fuente (b)
  //     que gatea la promoción de identidades que requieren match (no las que vienen directo
  //     del catálogo de vigentes). Pura: no muta `estado`.
  const audit = reconciliarMaestra(maestra);

  // 3. Carga al Supabase LOCAL (idempotente por clave natural). Si no hay service key,
  //    se omite la DB (pero el snapshot git, autoritativo, SIEMPRE se escribe).
  let dbLoaded = false;
  let promoted: { promovidos: number } | null = null;
  if (serviceKey.length > 0) {
    const writer = new SupabaseMaestraWriter({ url: localUrl, serviceKey });
    await upsertMaestra(maestra, writer);
    dbLoaded = true;
    log(`seed: maestra cargada en Supabase LOCAL (${localUrl}) — upsert idempotente`);

    // Compuerta humana (ID-01) + CR-01: la promoción es PRINCIPIADA, jamás un blanket-confirm.
    // Dos fuentes legítimas de confirmación, ambas explícitas:
    //   (a) seed-from-authoritative-vigentes-catalog: una fila que viene DIRECTO del catálogo
    //       oficial de vigentes ES un miembro actual confirmado por definición.
    //   (b) reconciliación: filas cuyo `matchDeterminista` devolvió `confirmado` (único por
    //       nombre/clave estricta en su cámara+periodo). Homónimo/no_confirmado NUNCA entran.
    // El operador debe correr --promote SOLO tras su visto bueno del lote (Task 2).
    if (opts.promote) {
      const idsVigentes = vigentesDeCatalogo(maestra); // fuente (a)
      const idsConfirmadosPorMatch = new Set<string>(); // fuente (b)
      for (const [id, res] of audit) {
        if (res.estado === "confirmado") idsConfirmadosPorMatch.add(id);
      }
      const allowList = [...new Set([...idsVigentes, ...idsConfirmadosPorMatch])];

      const r = await writer.promoteToConfirmado(allowList);
      promoted = r;

      // Refleja en memoria SOLO los ids efectivamente promovidos — NUNCA el lote completo.
      const allowSet = new Set(allowList);
      for (const row of maestra) {
        if (allowSet.has(row.id)) row.estado = "confirmado";
      }
      log(
        `seed: PROMOVIDAS a confirmado (allow-list principiada) -> ${r.promovidos} filas ` +
          `[catálogo-vigentes=${idsVigentes.size}, match-confirmado=${idsConfirmadosPorMatch.size}]`,
      );
    }
  } else {
    log(
      "seed: sin SUPABASE_LOCAL_SERVICE_KEY -> carga a DB OMITIDA (snapshot git sigue siendo autoritativo, ID-09)",
    );
  }

  // 3b. Preservar la compuerta humana en backups automáticos (CI): mergea el `estado`
  //     ya committeado, primero por `id` y, si falla (WR-03: rotación de la clave natural),
  //     por la firma de identidad estable (cámara+periodo+nombre_normalizado). Sin esto, una
  //     re-siembra revertiría `confirmado` → `no_confirmado` en silencio (fallo de corrección).
  const root = opts.cwd ?? findWorkspaceRoot(process.cwd());
  if (opts.preserveEstado && !opts.promote) {
    const prev = readEstadoSnapshot(resolve(root, SEED_PATH), log);
    let preservados = 0;
    for (const row of maestra) {
      const estadoPorId = prev.porId.get(row.id);
      const estadoPrevio = estadoPorId ?? prev.porFirma.get(firmaIdentidad(row));
      if (estadoPrevio == null) continue;
      const matchPorId = estadoPorId != null;
      // #17: 'confirmado' SOLO se auto-preserva por el `id` ESTABLE. Si el match es por
      // FIRMA (camara|periodo|nombre_normalizado, SIN apellido materno), una colisión de
      // homónimo podría heredar la confirmación humana a OTRA persona. En ese caso se AVISA
      // y NO se preserva (el operador re-promueve explícitamente si corresponde).
      if (estadoPrevio === "confirmado" && !matchPorId) {
        log(
          `seed: WARN firma coincide pero id NO (id=${row.id}, ${row.nombre_normalizado}); ` +
            `NO se auto-preserva 'confirmado' por firma (posible homónimo) — re-promover si corresponde (#17)`,
        );
        continue;
      }
      if (estadoPrevio !== row.estado) {
        // WR-03: visibiliza cualquier caída de `confirmado` que el preserve está reparando.
        if (estadoPrevio === "confirmado" && row.estado !== "confirmado") {
          log(
            `seed: WARN preservando confirmado humano para id=${row.id} ` +
              `(${row.nombre_normalizado}) que la re-siembra había bajado a ${row.estado} (WR-03)`,
          );
        }
        row.estado = estadoPrevio;
        preservados++;
      }
    }
    log(`seed: estado preservado del snapshot previo -> ${preservados} filas`);
  }

  // 4. Snapshot autoritativo en git (ID-09). R2 gateado por flag --r2 Y presencia de credencial
  //    (WR-02): sin credenciales, R2 es un no-op explícito (no un leg inerte enmascarado).
  const r2Target = opts.r2 ? buildR2Target() : null;
  if (opts.r2 && r2Target == null) {
    log("seed: --r2 pedido pero sin credenciales R2 completas -> R2 OMITIDO (no-op, WR-02)");
  }
  const fsWriter = new FsSeedFileWriter({ cwd: root });
  const res = await exportMaestra(maestra, {
    writer: fsWriter,
    r2Enabled: r2Target != null,
    ...(r2Target != null ? { r2: r2Target } : {}),
  });
  log(
    `seed: snapshot escrito -> ${res.path} (${res.bytes} bytes)` +
      (r2Target != null ? ` | R2 ${res.r2Ok ? "OK" : "FALLÓ (best-effort)"}` : ""),
  );

  return {
    total: maestra.length,
    diputados,
    senadores,
    dbLoaded,
    promoted,
    r2Ok: res.r2Ok,
    snapshotPath: res.path,
    snapshotBytes: res.bytes,
  };
}

// Re-export por conveniencia (round-trip / verificación).
export { serializeMaestra, SEED_PATH };

// Entry-point CLI: `node seed-cli.js [--promote] [--preserve-estado] [--r2]`.
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  /seed-cli\.(ts|js|mjs|cjs)$/.test(process.argv[1]);
if (isMain) {
  const promote = process.argv.includes("--promote");
  const preserveEstado = process.argv.includes("--preserve-estado");
  const r2 = process.argv.includes("--r2"); // WR-02: ahora SÍ se parsea y se cablea
  main({ promote, preserveEstado, r2 })
    .then((r) => {
      console.log(
        `\nseed OK: total=${r.total} senadores=${r.senadores} diputados=${r.diputados} dbLoaded=${r.dbLoaded} promoted=${JSON.stringify(r.promoted)} r2Ok=${r.r2Ok}`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error("seed FALLÓ:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
