// run-actualidad-prod-cli — entry-point de CRON (GH Actions intradía L-V) de la capa
// SECUNDARIA de agrupación por materia del panel de actualidad (SEN-05, tipo_senal='agrupacion_materia').
//
// Espeja `run-tramitacion-prod-cli.ts` de @obs/tramitacion en la conexión y carga de env:
// carga `.env` BOM-safe con precedencia de `process.env` (CI inyecta secrets ahí), apunta al
// Supabase REMOTO (SUPABASE_API_URL + SUPABASE_SECRET_KEY = service_role), credenciales SOLO
// de env (NUNCA por argv ni log; threat T-99-13).
//
// JOB: lee `proyecto_embedding.embedding vector(768)` PAGINADO (cap PostgREST 1k) uniéndolo a
// `proyecto.materia`, corre k-means DETERMINISTA (mulberry32 seed-fija, coseno) y hace
// full-rebuild ACOTADO a `tipo_senal='agrupacion_materia'` (delete where tipo_senal=... —
// disjunto del set temporal del proc SQL 0065; NUNCA delete global; Pitfall 5 / threat T-99-10).
// El label de cada cluster = mode(proyecto.materia) FACTUAL (JAMÁS LLM; T-99-11).
//
// NO toca fuentes gubernamentales → sin R2, sin rate-limit, sin robots.txt. Solo Supabase.
//
// Uso:
//   tsx packages/actualidad/src/run-actualidad-prod-cli.ts [--dry-run] [--k N]

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { kmeans, labelCluster, DEFAULT_K, K_MIN, K_MAX, KMEANS_SEED } from "./kmeans";

/** Tamaño de página bajo el cap de PostgREST (1000) — lectura de embeddings. */
const PAGE_SIZE = 1000;

function flagValue(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1]! : null;
}

/**
 * Carga `.env` BOM-safe con PRECEDENCIA de `process.env` (CI inyecta secrets ahí, sin archivo).
 * Espeja `run-tramitacion-prod-cli.loadEnv` (L64-87). Solo credenciales Supabase (sin R2).
 */
function loadEnv(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(join(root, ".env"), "utf8").replace(/^﻿/, "");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]!] = m[2]!.trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Sin `.env` (CI): los secrets vienen de process.env (abajo).
  }
  for (const k of ["SUPABASE_API_URL", "SUPABASE_SECRET_KEY", "SUPABASE_URL"]) {
    if (process.env[k]) out[k] = process.env[k]!;
  }
  return out;
}

/** Sube desde `start` hasta el directorio que contiene `pnpm-workspace.yaml` (raíz del monorepo). */
function findWorkspaceRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 20; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

/** Parsea el vector que PostgREST devuelve: string "[0.1,0.2,...]" o array numérico. */
function parseEmbedding(raw: unknown): number[] | null {
  if (Array.isArray(raw)) {
    const nums = raw.map(Number);
    return nums.every((n) => Number.isFinite(n)) ? nums : null;
  }
  if (typeof raw === "string") {
    try {
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr)) {
        const nums = arr.map(Number);
        return nums.every((n) => Number.isFinite(n)) ? nums : null;
      }
    } catch {
      return null;
    }
  }
  return null;
}

interface EmbRow {
  boletin: string;
  vector: number[];
  materia: string | null;
}

type Sb = ReturnType<typeof createClient>;

/**
 * Lee `proyecto_embedding` (boletin, embedding) uniendo `proyecto.materia`, PAGINADO
 * (.order('boletin').range()) para superar el cap 1k de PostgREST. Orden por boletín
 * ⇒ entrada estable para el determinismo del k-means (Pitfall 4). Un error LANZA (fail-loud):
 * el cron sale != 0 en vez de un no-op verde. Nunca se propaga la service key.
 */
async function leerEmbeddings(sb: Sb, log: (m: string) => void): Promise<EmbRow[]> {
  const rows: EmbRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await sb
      .from("proyecto_embedding")
      .select("boletin, embedding, proyecto(materia)")
      .order("boletin", { ascending: true })
      .range(from, to);
    if (error) throw new Error(`leerEmbeddings: proyecto_embedding: ${error.message}`);
    const page = (data as unknown as Record<string, unknown>[] | null) ?? [];
    for (const r of page) {
      const boletin = typeof r.boletin === "string" ? r.boletin : null;
      const vector = parseEmbedding(r.embedding);
      if (!boletin || !vector) continue;
      // el embed de proyecto(materia) llega como objeto {materia} (o array en algunos shapes).
      const proj = r.proyecto as { materia?: unknown } | { materia?: unknown }[] | null;
      const projObj = Array.isArray(proj) ? proj[0] : proj;
      const materia =
        projObj && typeof projObj.materia === "string" ? (projObj.materia as string) : null;
      rows.push({ boletin, vector, materia });
    }
    if (page.length < PAGE_SIZE) break;
  }
  log(`actualidad-prod: ${rows.length} embeddings leídos (paginado ${PAGE_SIZE}, orden boletín)`);
  return rows;
}

function clampK(raw: string | null, n: number, log: (m: string) => void): number {
  let k = raw != null ? Number(raw) : DEFAULT_K;
  if (!Number.isInteger(k) || k <= 0) k = DEFAULT_K;
  // rango discrecional [8,15] documentado, y nunca > N (checker warning #2).
  const withinRange = Math.max(K_MIN, Math.min(K_MAX, k));
  const effective = Math.max(1, Math.min(withinRange, n));
  if (effective !== k) {
    log(`actualidad-prod: k solicitado ${k} → k efectivo ${effective} (rango [${K_MIN},${K_MAX}], N=${n})`);
  }
  return effective;
}

async function run(): Promise<void> {
  const root = findWorkspaceRoot(process.cwd());
  const env = loadEnv(root);
  const log = (m: string) => console.log(m);

  const dryRun = process.argv.includes("--dry-run");
  const kRaw = flagValue("--k");

  const url = env.SUPABASE_API_URL || env.SUPABASE_URL || "";
  const serviceKey = env.SUPABASE_SECRET_KEY || "";

  const efectivoDryRun = dryRun || !url || !serviceKey;
  if (!dryRun && (!url || !serviceKey)) {
    log("actualidad-prod: sin SUPABASE_API_URL/SECRET_KEY → DRY-RUN (no toca DB)");
  }
  if (efectivoDryRun && (!url || !serviceKey)) {
    log("actualidad-prod: DRY-RUN sin credenciales → nada que leer/escribir. Salida limpia.");
    return;
  }

  const sb: Sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 1. Leer embeddings + materia (paginado, orden estable).
  const rows = await leerEmbeddings(sb, log);
  if (rows.length === 0) {
    log("actualidad-prod: proyecto_embedding vacío → no hay corpus que clusterizar. Salida limpia.");
    return;
  }

  // 2. k-means determinista (seed fija) sobre los vectores en el orden de boletín.
  const k = clampK(kRaw, rows.length, log);
  const vectors = rows.map((r) => r.vector);
  const { assignments, k: kEfectivo } = kmeans(vectors, k, KMEANS_SEED);
  log(
    `actualidad-prod: k-means N=${rows.length} boletines, k=${kEfectivo}, ` +
      `seed=0x${KMEANS_SEED.toString(16)} (determinista). Cobertura = subset con embedding.`,
  );

  // 3. Agrupar miembros por cluster; label = mode(materia) factual.
  interface Cluster {
    boletines: string[];
    materias: (string | null)[];
  }
  const clusters = new Map<number, Cluster>();
  for (let i = 0; i < rows.length; i++) {
    const c = assignments[i]!;
    let cl = clusters.get(c);
    if (!cl) {
      cl = { boletines: [], materias: [] };
      clusters.set(c, cl);
    }
    cl.boletines.push(rows[i]!.boletin);
    cl.materias.push(rows[i]!.materia);
  }

  // 4. Construir una fila por cluster (agrupacion_materia). Sin ningún texto generado.
  const fecha_captura = new Date().toISOString();
  const filas = Array.from(clusters.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([clusterId, cl]) => ({
      tipo_senal: "agrupacion_materia" as const,
      ventana: null as string | null,
      conteo: cl.boletines.length,
      cobertura_camara: null as string | null,
      materia: labelCluster(cl.materias), // label FACTUAL mode(materia)
      cluster_id: clusterId,
      fecha_max: null as string | null,
      supresion_causa: null as string | null,
      evidencia: {
        boletines: cl.boletines,
        cobertura_clustering: `${rows.length} PLs con embedding (subset del corpus)`,
        metodo: `kmeans Lloyd determinista seed=0x${KMEANS_SEED.toString(16)}, coseno, k=${kEfectivo}`,
        enlaces: cl.boletines.map(
          (b) => `https://www.camara.cl/legislacion/ProyectosDeLey/tramitacion.aspx?prmBOLETIN=${b}`,
        ),
      },
      dataset: "actualidad_senal",
      origen: "@obs/actualidad kmeans (agrupacion_materia)",
      fecha_captura,
      enlace: null as string | null,
    }));

  if (efectivoDryRun) {
    log(`actualidad-prod: DRY-RUN — ${filas.length} clusters computados, NO se escribe. Muestra:`);
    for (const f of filas.slice(0, 5)) {
      log(`  cluster ${f.cluster_id}: materia='${f.materia}' conteo=${f.conteo}`);
    }
    return;
  }

  // 5. Full-rebuild ACOTADO a tipo_senal='agrupacion_materia' (disjunto del proc SQL; T-99-10).
  //    NUNCA `delete from actualidad_senal` global.
  const { error: delErr } = await sb
    .from("actualidad_senal")
    .delete()
    .eq("tipo_senal", "agrupacion_materia");
  if (delErr) throw new Error(`actualidad-prod: delete acotado: ${delErr.message}`);

  // El cliente supabase-js sin tipos generados infiere `never` para insert(); el cast aísla
  // el payload estructural (mismo patrón que run-tramitacion-prod-cli con `as unknown`).
  const { error: insErr } = await sb
    .from("actualidad_senal")
    .insert(filas as unknown as never[]);
  if (insErr) throw new Error(`actualidad-prod: insert clusters: ${insErr.message}`);

  log(`actualidad-prod: LIVE — reescritos ${filas.length} clusters agrupacion_materia (k=${kEfectivo}).`);
}

run().catch((err) => {
  console.error("actualidad-prod FALLÓ:", err instanceof Error ? err.message : err);
  process.exit(1);
});
