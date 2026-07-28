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
//
// W-9/G7: con `--html-file` el crudo del curl PASA POR R2 (Etapa 1, content-addressed) ANTES
// de parsear ⇒ el fallback local queda re-procesable. Para re-ingestar SIN volver a chocar con
// el WAF (regla LOCKED 2 de CLAUDE.md):
//   tsx packages/lobby/src/run-camara-lobby-cli.ts --from-r2 camara-lobby/listadodeaudiencias/<YYYY-MM-DD>/<sha>.html
// La key la imprime la corrida anterior (`r2Path=` en la línea-resumen).

import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { Fetcher, HostRateLimiter, RobotsGuard, R2Store, sha256Hex } from "@obs/ingest";
import type { Parlamentario } from "@obs/core";
import { CamaraLobbyConnector } from "./connector-camara-lobby";
import { SupabaseLobbyWriter } from "./writer-supabase";
import { InMemoryLobbyWriter, type LobbyWriter } from "./writer";
import { runCamaraLobby } from "./run-camara-lobby";

/**
 * Keys ACEPTADAS por `--from-r2` (T-119-13): la partición content-addressed que escribe la
 * Etapa 1 de este conector (`camara-lobby/listadodeaudiencias/<fecha>/<sha256>.html`). El
 * anclaje de punta a punta excluye `..`, rutas absolutas y prefijos de otras fuentes.
 */
const R2_KEY_LOBBY_RE =
  /^camara-lobby\/listadodeaudiencias\/\d{4}-\d{2}-\d{2}\/[0-9a-f]{64}\.html$/;

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

  // G7 — Etapa 2 DESDE R2 (`--from-r2 <r2Path>`, firma de la plantilla dorada
  // `tramitacion/src/ingest-cli.ts:130`). El crudo YA versionado se re-procesa sin volver a
  // chocar con el WAF de camara.cl. Validación del flag ANTES de cualquier red/DB.
  const fromR2Idx = process.argv.indexOf("--from-r2");
  const fromR2 = fromR2Idx >= 0 ? process.argv[fromR2Idx + 1] : undefined;
  if (fromR2Idx >= 0 && (!fromR2 || fromR2.startsWith("--"))) {
    throw new Error("--from-r2 requiere un r2Path");
  }
  if (fromR2 && !R2_KEY_LOBBY_RE.test(fromR2)) {
    // T-119-13: el r2Path es input del operador y se usa como key de `getObject`; se ancla a
    // la partición conocida de este conector (ni `..`, ni rutas absolutas, ni prefijos ajenos).
    throw new Error(
      `--from-r2: r2Path no reconocido (${fromR2}); se espera ` +
        `camara-lobby/listadodeaudiencias/<YYYY-MM-DD>/<sha256>.html`,
    );
  }

  // Conector: el REAL (fetch undici), un stub sobre el crudo bajado por curl (`--html-file`),
  // o un stub sobre el crudo YA versionado en R2 (`--from-r2`). Todos respetan el contrato
  // `fetchListado(): Promise<string>`. En modo replay NO se instancia el conector real →
  // estructuralmente imposible tocar camara.cl.
  const htmlFile = flagValue("--html-file");
  const conector = fromR2
    ? ({
        fetchListado: async () => {
          if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_ENDPOINT_URL) {
            throw new Error(
              "--from-r2 requiere R2 configurado (R2_ENDPOINT_URL + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY)",
            );
          }
          const lector = new R2Store({
            accessKeyId: env.R2_ACCESS_KEY_ID,
            secretAccessKey: env.R2_SECRET_ACCESS_KEY,
            endpoint: env.R2_ENDPOINT_URL,
            bucket: env.R2_BUCKET ?? "observatorio",
          });
          // `getObject` lanza con status y path, SIN credenciales (T-119-16). Fail-loud: el
          // replay NUNCA degrada a re-fetch de la fuente.
          const bytes = await lector.getObject(fromR2);
          // T-119-14: la key ES el sha256 del contenido → se re-verifica antes de parsear.
          const shaKey = fromR2.split("/").pop()!.replace(/\.html$/, "");
          const shaReal = await sha256Hex(bytes);
          if (shaReal !== shaKey) {
            throw new Error(
              `--from-r2: sha del contenido (${shaReal}) ≠ sha de la key (${shaKey}) en ${fromR2}`,
            );
          }
          return new TextDecoder().decode(bytes);
        },
      } as CamaraLobbyConnector)
    : htmlFile
    ? ({ fetchListado: async () => readFileSync(htmlFile, "utf8") } as CamaraLobbyConnector)
    : new CamaraLobbyConnector({
        fetcher: new Fetcher({ allowlist: {} }),
        rateLimiter: new HostRateLimiter(),
        robots: new RobotsGuard({ allowlist: {} }),
        allowlist: {},
      });
  if (htmlFile) log(`camara-lobby: crudo desde archivo (WAF bypass) → ${htmlFile}`);
  if (fromR2) log(`camara-lobby: REPLAY desde R2 (${fromR2}) — CERO fetch a camara.cl`);

  const maestra = cargarMaestra(root);
  log(`camara-lobby: maestra cargada (${maestra.length} parlamentarios)`);

  // Etapa 1: en modo REPLAY el crudo YA está en R2 — re-escribirlo daría 412 y saltaría la
  // Etapa 2 entera (justo lo que el operador quiere correr) → no se pasa store, y se declara
  // con `omitirEtapa1` para no emitir el `[WARN]` de degradación (no la hay).
  let r2Store: R2Store | undefined;
  if (!fromR2 && !dryRun && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_ENDPOINT_URL) {
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
    ...(fromR2 ? { omitirEtapa1: true } : {}),
    log,
  });

  // El `r2Path` se imprime SIEMPRE (en replay, el de origen): es la key que el operador
  // necesita para re-procesar este mismo crudo con `--from-r2` sin volver al WAF.
  console.log(
    `\ncamara-lobby ${dryRun ? "DRY-RUN" : "LIVE"}: audiencias=${res.audiencias} ` +
      `contrapartes=${res.contrapartes} confirmados=${res.confirmados} ` +
      `marcados=${res.parlamentariosMarcados} r2Path=${res.r2Path ?? fromR2 ?? "none"}`,
  );
}

main().catch((err) => {
  console.error("camara-lobby FALLÓ:", err instanceof Error ? err.message : err);
  process.exit(1);
});
