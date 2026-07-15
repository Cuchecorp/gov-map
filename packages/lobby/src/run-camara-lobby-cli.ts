// run-camara-lobby-cli — entry-point de OPERADOR de la ingesta LIVE del lobby de la Cámara
// (`camara.cl/transparencia/listadodeaudiencias.aspx`, Phase 25).
//
// Ensambla los colaboradores REALES (Fetcher + HostRateLimiter + RobotsGuard de @obs/ingest en el
// ORDEN LOCKED), el R2Store (Etapa 1, crudo content-addressed) y el SupabaseLobbyWriter (Etapa 2),
// carga la maestra del seed autoritativo y corre `runCamaraLobby` deterministic-only (sin provider
// LLM: los homónimos degradan a no_confirmado, NUNCA fabrica un FK).
//
// Credenciales SOLO de `.env` (BOM-safe). `--dry-run` corre fetch/parse/cruce in-memory sin
// escribir DB/R2. Idempotente: upsert por clave natural; re-correr no duplica.
//
// WAF (Phase 25, no-obvio): el WAF de `www.camara.cl` BLOQUEA el fetch de Node (undici) con 403
// por TLS/HTTP-fingerprint —independiente de los headers— pero PERMITE `curl`. Por eso se ofrece
// `--html-file <ruta>`: el operador baja el crudo con curl (un único GET respetuoso) y se lo pasa
// al runner; la Etapa 1 (R2) y la Etapa 2 (parse→reconcile→write) corren desde ese crudo (alineado
// con la convención LOCKED: Etapa 2 lee del crudo, no de la fuente). `opendata.camara.cl` (votos)
// NO tiene este WAF; es específico del portal de transparencia.
//
// Uso: tsx packages/lobby/src/run-camara-lobby-cli.ts [--dry-run] [--html-file <ruta>]

import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { Fetcher, HostRateLimiter, RobotsGuard, R2Store } from "@obs/ingest";
import type { Parlamentario } from "@obs/core";
import { CamaraLobbyConnector } from "./connector-camara-lobby";
import { SupabaseLobbyWriter } from "./writer-supabase";
import { InMemoryLobbyWriter, type LobbyWriter } from "./writer";
import { runCamaraLobby } from "./run-camara-lobby";

/** Lee el valor de un flag `--x <valor>` de argv, o null. */
function flagValue(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1]! : null;
}

/**
 * Carga variables BOM-safe: parte del `.env` local (operador) y deja que `process.env`
 * tenga PRECEDENCIA (CI/GitHub Actions inyecta los secrets ahí, sin archivo `.env`). Si
 * no hay `.env` (CI), usa solo `process.env`.
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
 * Necesario porque `pnpm --filter <pkg> exec` pone el cwd en el directorio del paquete,
 * no en la raíz — idéntico al patrón de run-tramitacion-prod-cli.ts (RC-2 fix).
 */
function findWorkspaceRoot(start: string): string {
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

function cargarMaestra(root: string): Parlamentario[] {
  return JSON.parse(
    readFileSync(join(root, "supabase", "seeds", "parlamentario.seed.json"), "utf8"),
  ) as Parlamentario[];
}

async function main(): Promise<void> {
  const root = findWorkspaceRoot(process.cwd());
  const dryRun = process.argv.includes("--dry-run");
  const env = loadEnv(root);
  const log = (m: string) => console.log(m);

  // Conector: el REAL (fetch undici) o, si el WAF lo bloquea, un stub que sirve el crudo bajado
  // por curl (`--html-file`). El stub respeta el contrato `fetchListado(): Promise<string>`.
  const htmlFile = flagValue("--html-file");
  const conector = htmlFile
    ? ({ fetchListado: async () => readFileSync(htmlFile, "utf8") } as CamaraLobbyConnector)
    : new CamaraLobbyConnector({
        fetcher: new Fetcher({ allowlist: {} }),
        rateLimiter: new HostRateLimiter(),
        robots: new RobotsGuard({ allowlist: {} }),
        allowlist: {},
      });
  if (htmlFile) log(`camara-lobby: crudo desde archivo (WAF bypass) → ${htmlFile}`);

  const maestra = cargarMaestra(root);
  log(`camara-lobby: maestra cargada (${maestra.length} parlamentarios)`);

  let r2Store: R2Store | undefined;
  if (!dryRun && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_ENDPOINT_URL) {
    r2Store = new R2Store({
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      endpoint: env.R2_ENDPOINT_URL,
      bucket: env.R2_BUCKET ?? "observatorio",
    });
  }

  let writer: LobbyWriter;
  if (dryRun || !env.SUPABASE_API_URL || !env.SUPABASE_SECRET_KEY) {
    writer = new InMemoryLobbyWriter();
    log("camara-lobby: DRY-RUN (in-memory, no escribe DB/R2)");
  } else {
    writer = new SupabaseLobbyWriter({
      url: env.SUPABASE_API_URL,
      serviceKey: env.SUPABASE_SECRET_KEY,
    });
    log(`camara-lobby: writer Supabase (${env.SUPABASE_API_URL}) — upsert idempotente`);
  }

  const res = await runCamaraLobby({
    conector,
    writer,
    maestra,
    ...(r2Store ? { r2Store } : {}),
    log,
  });

  console.log(
    `\ncamara-lobby ${dryRun ? "DRY-RUN" : "LIVE"}: audiencias=${res.audiencias} ` +
      `contrapartes=${res.contrapartes} confirmados=${res.confirmados} ` +
      `marcados=${res.parlamentariosMarcados} r2Path=${res.r2Path ?? "none"}`,
  );
}

main().catch((err) => {
  console.error("camara-lobby FALLÓ:", err instanceof Error ? err.message : err);
  process.exit(1);
});
