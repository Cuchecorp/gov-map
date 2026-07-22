// run-bio-cli — entry-point de OPERADOR/AGENTE de la ingesta LIVE de bio (diputados +
// senadores + comisiones) del Congreso, dos-etapas fail-closed.
//
// Ensambla los colaboradores REALES (Fetcher + HostRateLimiter + RobotsGuard de @obs/ingest en
// el ORDEN LOCKED), el R2Store (Etapa 1, envelope crudo content-addressed) y el SupabaseBioWriter
// (Etapa 2), carga la maestra del seed autoritativo y corre `runBio` deterministic-only (sin
// provider LLM: diputados/comisiones por DIPID exacto, senadores por nombre único — un sin-match
// degrada a skip, NUNCA fabrica un FK).
//
// Credenciales SOLO de `.env` (BOM-safe, precedencia process.env para CI). `--dry-run` corre
// fetch/parse/cruce in-memory sin escribir DB/R2. Idempotente: upsert por clave natural.
//
// WAF (research Pitfall 5): `opendata.camara.cl` (diputados, WSDiputado.asmx) NO tiene WAF → el
// fetch de Node (undici) pasa. `www.camara.cl` (comisiones, comisiones_permanentes.aspx /
// integrantes.aspx) SÍ lo tiene → el operador baja esos crudos con curl y los pasa por
// `--xml-file` (catálogo) + `--integrantes-file <prmId>=<ruta>` (repetible). BCN (senadores) es
// un GET anónimo sin WAF. La Etapa 1 (R2) y la Etapa 2 (parse→match→write) corren desde el
// envelope crudo, no de la fuente (convención LOCKED: Etapa 2 lee del crudo).
//
// Uso:
//   tsx packages/bio/src/run-bio-cli.ts --fuente diputados [--dry-run]
//   tsx packages/bio/src/run-bio-cli.ts --fuente senadores [--dry-run]
//   tsx packages/bio/src/run-bio-cli.ts --fuente comisiones --xml-file <catalogo.html> \
//        --integrantes-file 4884=<integrantes-4884.html> [--integrantes-file 5001=...]
//   tsx packages/bio/src/run-bio-cli.ts --from-r2 <r2Path>        (replay sin red)

import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { Fetcher, HostRateLimiter, RobotsGuard, R2Store, assertAllowedUrl } from "@obs/ingest";
import type { MaestraRow } from "@obs/identity";
import type { Parlamentario } from "@obs/core";
import { runBio, type BioConector, type BioEnvelope } from "./run-bio";
import { DIPUTADOS_BIO_URL } from "./parse-diputados";
import { buildSparqlUrl, BCN_UA } from "./parse-bcn-senadores";
import {
  COMISIONES_CATALOGO_URL,
  integrantesUrl,
  parseComisionesCatalogo,
} from "./parse-comisiones";
import { SupabaseBioWriter } from "./writer-supabase";
import { InMemoryBioWriter, type BioWriter } from "./writer";

/** Lee el valor de un flag `--x <valor>` de argv, o null. */
export function flagValue(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1]! : null;
}

/** Lee TODAS las apariciones de un flag repetible `--x <valor> --x <valor2>`. */
export function flagValues(name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === name && i + 1 < process.argv.length) out.push(process.argv[i + 1]!);
  }
  return out;
}

/**
 * Carga variables BOM-safe: parte del `.env` local (operador) y deja que `process.env`
 * tenga PRECEDENCIA (CI/GitHub Actions inyecta los secrets ahí, sin archivo `.env`). Si
 * no hay `.env` (CI), usa solo `process.env`.
 */
export function loadEnv(root: string): Record<string, string> {
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
  for (const k of [
    "SUPABASE_API_URL",
    "SUPABASE_SECRET_KEY",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_ENDPOINT_URL",
    "R2_BUCKET",
  ]) {
    if (process.env[k]) out[k] = process.env[k]!;
  }
  return out;
}

/**
 * Resuelve la raíz del workspace subiendo desde `start` hasta hallar `pnpm-workspace.yaml`.
 * `pnpm --filter <pkg> exec` pone el cwd en el directorio del paquete, no en la raíz.
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

/** Carga la maestra del seed autoritativo (read-only, no toca DB). */
export function cargarMaestra(root: string): MaestraRow[] {
  const filas = JSON.parse(
    readFileSync(join(root, "supabase", "seeds", "parlamentario.seed.json"), "utf8"),
  ) as Parlamentario[];
  return filas as MaestraRow[];
}

/** Qué fuente acota la corrida. `all` corre las tres (según crudos disponibles). */
export type Fuente = "diputados" | "senadores" | "comisiones" | "all";

/**
 * Conector REAL que arma el `BioEnvelope` desde las fuentes vivas, respetando el ORDEN LOCKED de
 * @obs/ingest por request (assertAllowedUrl → robots.isAllowed → rateLimiter.wait → fetcher.get).
 * Acota por `fuente`. Los crudos de `www.camara.cl` (comisiones, con WAF) NO se fetchean aquí: se
 * inyectan por archivo (curl-first) vía `catalogoHtml`/`integrantesHtml`.
 */
export function buildBioConector(opts: {
  fuente: Fuente;
  catalogoHtml?: string | null;
  integrantesHtml?: Record<string, string>;
  log?: (m: string) => void;
}): BioConector {
  const log = opts.log ?? (() => {});
  const allowlist = {};
  const fetcher = new Fetcher({ allowlist });
  const rateLimiter = new HostRateLimiter();
  const robots = new RobotsGuard({ allowlist });

  async function getText(url: string, headers?: Record<string, string>): Promise<string> {
    const parsed = assertAllowedUrl(url, allowlist); // SSRF + allowlist gubernamental
    if (!(await robots.isAllowed(url))) throw new Error(`robots-disallow: ${url}`);
    await rateLimiter.wait(parsed.host); // 2-3s serial por host (LOCKED)
    const body = await fetcher.get(headers ? { url, headers } : { url });
    return new TextDecoder("utf-8").decode(body);
  }

  return {
    async fetchEnvelope(): Promise<BioEnvelope> {
      const wantDip = opts.fuente === "diputados" || opts.fuente === "all";
      const wantSen = opts.fuente === "senadores" || opts.fuente === "all";
      const wantCom = opts.fuente === "comisiones" || opts.fuente === "all";

      let diputadosXml: string | null = null;
      if (wantDip) {
        log(`bio: fetch diputados → ${DIPUTADOS_BIO_URL}`);
        diputadosXml = await getText(DIPUTADOS_BIO_URL);
      }

      let senadoresSparql: string | null = null;
      if (wantSen) {
        const sparqlUrl = buildSparqlUrl();
        log(`bio: fetch senadores (BCN SPARQL) → ${sparqlUrl}`);
        senadoresSparql = await getText(sparqlUrl, {
          "User-Agent": BCN_UA,
          Accept: "application/sparql-results+json",
        });
      }

      // Comisiones (www.camara.cl, WAF): crudo por archivo (curl-first). NUNCA fetch aquí.
      let comisionesCatalogoHtml: string | null = null;
      const integrantesPorComision: Record<string, string> = {};
      if (wantCom) {
        if (opts.catalogoHtml == null) {
          log(
            "bio: --fuente comisiones sin --xml-file (WAF www.camara.cl) → sin catálogo. " +
              "Baja el crudo con curl y pásalo por --xml-file.",
          );
        } else {
          comisionesCatalogoHtml = opts.catalogoHtml;
          Object.assign(integrantesPorComision, opts.integrantesHtml ?? {});
        }
      }

      return {
        diputadosXml,
        senadoresSparql,
        comisionesCatalogoHtml,
        integrantesPorComision,
      };
    },
  };
}

/** Parsea `--integrantes-file prmId=ruta` (repetible) → { prmId: html }. */
function cargarIntegrantes(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const spec of flagValues("--integrantes-file")) {
    const eq = spec.indexOf("=");
    if (eq < 0) throw new Error(`--integrantes-file inválido (esperado prmId=ruta): ${spec}`);
    const prmId = spec.slice(0, eq).trim();
    const ruta = spec.slice(eq + 1).trim();
    out[prmId] = readFileSync(ruta, "utf8");
  }
  return out;
}

async function main(): Promise<void> {
  const root = findWorkspaceRoot(process.cwd());
  const dryRun = process.argv.includes("--dry-run");
  const env = loadEnv(root);
  const log = (m: string) => console.log(m);

  const fromR2 = flagValue("--from-r2");
  const fuente = (flagValue("--fuente") ?? "all") as Fuente;
  if (!["diputados", "senadores", "comisiones", "all"].includes(fuente)) {
    throw new Error(`--fuente inválida: ${fuente} (usa diputados|senadores|comisiones|all)`);
  }

  const maestra = cargarMaestra(root);
  log(`bio: maestra cargada (${maestra.length} parlamentarios)`);

  // Etapa 1 (R2): solo en LIVE con credenciales R2. En dry-run no se construye (verificado por test).
  let r2Store: R2Store | undefined;
  if (!dryRun && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_ENDPOINT_URL) {
    r2Store = new R2Store({
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      endpoint: env.R2_ENDPOINT_URL,
      bucket: env.R2_BUCKET ?? "observatorio",
    });
  }

  // Etapa 2 writer: Supabase real solo si hay URL + service key; si no (o --dry-run) → in-memory.
  let writer: BioWriter;
  if (dryRun || !env.SUPABASE_API_URL || !env.SUPABASE_SECRET_KEY) {
    writer = new InMemoryBioWriter();
    log("bio: DRY-RUN / sin credenciales → in-memory (no escribe DB/R2)");
  } else {
    writer = new SupabaseBioWriter({
      url: env.SUPABASE_API_URL,
      serviceKey: env.SUPABASE_SECRET_KEY,
    });
    log(`bio: writer Supabase (${env.SUPABASE_API_URL}) — upsert idempotente`);
  }

  // --from-r2: replay desde el envelope crudo en R2 (CERO red). El conector no se usa (fake).
  if (fromR2 != null) {
    if (r2Store == null) {
      throw new Error("--from-r2 requiere R2_* en .env (y no --dry-run)");
    }
    const res = await runBio({
      conector: { fetchEnvelope: async () => ({} as BioEnvelope) }, // no se invoca en modo fromR2
      writer,
      maestra,
      r2Store,
      fromR2,
      log,
    });
    reportar(res, "from-r2");
    return;
  }

  // Comisiones (WAF): crudos por archivo (curl-first). --xml-file = catálogo.
  const catalogoFile = flagValue("--xml-file");
  const catalogoHtml = catalogoFile ? readFileSync(catalogoFile, "utf8") : null;
  const integrantesHtml = cargarIntegrantes();
  if (catalogoFile) {
    const n = parseComisionesCatalogo(catalogoHtml!).length;
    log(`bio: catálogo de comisiones desde archivo (WAF bypass) → ${catalogoFile} (${n} comisiones)`);
    log(`bio: integrantes por prmID: ${Object.keys(integrantesHtml).length} archivo(s)`);
  }

  const conector = buildBioConector({
    fuente,
    catalogoHtml,
    integrantesHtml,
    log,
  });

  const res = await runBio({
    conector,
    writer,
    maestra,
    ...(r2Store ? { r2Store } : {}),
    log,
  });
  reportar(res, dryRun ? "DRY-RUN" : "LIVE");
}

function reportar(
  res: Awaited<ReturnType<typeof runBio>>,
  modo: string,
): void {
  console.log(
    `\nbio ${modo}: militancias=${res.militancias} bios=${res.bios} ` +
      `comisiones=${res.comisiones} membresias=${res.membresias} ` +
      `partidosActualizados=${res.actualizados} sinMatch=${res.sinMatch.length} ` +
      `r2Path=${res.r2Path ?? "none"}`,
  );
  // Los DIPIDs/nombres sin match SOLO se listan en log local — NUNCA se persisten fuera de la maestra.
  if (res.sinMatch.length > 0) {
    console.log(`bio: sin match (fail-closed, no persistidos): ${res.sinMatch.join(", ")}`);
  }
}

// Utilidad para tests/consumidores: URL de integrantes por prmID (re-export delgado).
export { integrantesUrl, COMISIONES_CATALOGO_URL };

// Solo corre `main` cuando se ejecuta como entry-point (no bajo import de test).
const isEntry =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  /run-bio-cli\.(ts|js|mts|cjs)$/.test(process.argv[1] ?? "");
if (isEntry) {
  main().catch((err) => {
    console.error("bio FALLÓ:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
