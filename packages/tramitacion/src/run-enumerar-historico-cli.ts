// run-enumerar-historico-cli — entry-point de OPERADOR (LOCAL, one-shot) para ENUMERAR el
// histórico de proyectos de ley de la Cámara por rango de años vía WSLegislativo.asmx.
//
// NO ingiere: solo enumera. Recorre `--desde YYYY --hasta YYYY`, llama
// `CamaraConnector.enumerarProyectosXAnno(anno)` (política LOCKED @obs/ingest: SSRF allowlist →
// robots → rate-limit 2-3s → fetcher con UA identificatorio), dedup global, filtra con
// `BOLETIN_RE`, e IMPRIME la lista de boletines (una por línea + una línea CSV al final) para que
// el operador la pipe a `run-tramitacion-prod-cli --boletines a,b,c` (P03 hace el backfill real).
//
// LOCKED (CLAUDE.md Conventions): backfill masivo = LOCAL, NUNCA GitHub Actions. Este es un
// SEGUNDO entrypoint de @obs/tramitacion junto a run-tramitacion-prod-cli/ingest-cli — por diseño
// NO está cableado a ningún cron YAML (histórico = one-shot LOCAL). No pisar esta invariante.
//
// Secretos: este CLI NO necesita credenciales (solo enumera contra un WS público). El env se carga
// BOM-safe por consistencia; ninguna credencial llega por argv.
//
// Uso:
//   tsx packages/tramitacion/src/run-enumerar-historico-cli.ts --desde 2018 --hasta 2024 [--dry-run]

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Fetcher, HostRateLimiter, RobotsGuard } from "@obs/ingest";
import { CamaraConnector } from "./connector-camara";
import { findWorkspaceRoot } from "./ingest-cli";

/** Filtro de boletín bien formado `NNNNN-NN` (defensa: no imprimimos basura para el backfill). */
const BOLETIN_RE = /^\d{3,6}-\d{1,3}$/;

function flagValue(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1]! : null;
}

/**
 * Carga `.env` BOM-safe con PRECEDENCIA de `process.env`. Espeja `run-tramitacion-prod-cli.loadEnv`.
 * Este CLI no requiere secretos, pero mantiene el idiom por consistencia (y por si un futuro
 * warm-up necesita R2). Nunca lee credenciales de argv.
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
    // Sin `.env` (CI/local sin archivo): no es error — este CLI no necesita secretos.
  }
  return out;
}

async function run(): Promise<void> {
  const root = findWorkspaceRoot(process.cwd());
  loadEnv(root); // consistencia (no requiere credenciales)
  const log = (m: string) => console.log(m);

  const dryRun = process.argv.includes("--dry-run");
  const desdeRaw = flagValue("--desde");
  const hastaRaw = flagValue("--hasta");
  const desde = desdeRaw != null ? Number(desdeRaw) : NaN;
  const hasta = hastaRaw != null ? Number(hastaRaw) : NaN;

  // Validación de rango (V5: no basura al WS gob). Mismo rango que el connector (1990..2100).
  if (
    !Number.isInteger(desde) ||
    !Number.isInteger(hasta) ||
    desde < 1990 ||
    hasta > 2100 ||
    desde > hasta
  ) {
    throw new Error(
      `rango de años inválido: --desde ${desdeRaw} --hasta ${hastaRaw} ` +
        `(esperado enteros 1990..2100, desde <= hasta)`,
    );
  }

  // Colaboradores REALES de @obs/ingest (política LOCKED: rate-limit 2-3s + robots + UA + SSRF).
  // Espeja el ensamblado de ingest-cli.ts L266-270 verbatim.
  const conector = new CamaraConnector({
    fetcher: new Fetcher(),
    rateLimiter: new HostRateLimiter(),
    robots: new RobotsGuard({ allowlist: {} }),
  });

  if (dryRun) {
    log(
      `enumerar-historico: DRY-RUN — enumeraría años ${desde}..${hasta} vía WSLegislativo ` +
        `(no hace fetch). Quita --dry-run para correr LIVE.`,
    );
    process.exit(0);
    return;
  }

  const vistos = new Set<string>();
  let errores = 0;
  for (let anno = desde; anno <= hasta; anno++) {
    try {
      const boletines = await conector.enumerarProyectosXAnno(anno);
      let nuevos = 0;
      for (const b of boletines) {
        if (BOLETIN_RE.test(b) && !vistos.has(b)) {
          vistos.add(b);
          nuevos++;
        }
      }
      log(`enumerar-historico: ${anno} → ${boletines.length} boletines (${nuevos} nuevos)`);
    } catch (e) {
      errores++;
      console.error(
        `enumerar-historico: ERROR año ${anno}:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  const lista = [...vistos];
  log(
    `\nenumerar-historico: ${lista.length} boletines únicos ${desde}..${hasta} ` +
      `(errores=${errores}). Pipe a: run-tramitacion-prod-cli --boletines <lista>\n`,
  );
  // Una por línea (para pipe/grep) + una línea CSV lista para `--boletines`.
  for (const b of lista) console.log(b);
  if (lista.length > 0) console.log(`\n--boletines ${lista.join(",")}`);

  process.exit(errores > 0 ? 1 : 0);
}

// Entry-point isMain (MEMORY gotcha "dos entrypoints CLI"): el regex DEBE matchear el nombre
// PROPIO de este archivo — así no se dispara cuando otro entrypoint importa de este módulo.
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  /run-enumerar-historico-cli\.(ts|js|mjs|cjs)$/.test(process.argv[1]);

if (isMain) {
  run().catch((err) => {
    console.error(
      "enumerar-historico FALLÓ:",
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  });
}
