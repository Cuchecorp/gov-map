// run-backfill-prmid-cli — CLI LOCAL dos-etapas reanudable para poblar proyecto.prm_id_camara.
//
// TRACE-01 (Phase 89-01): el `<Id>` del XML WSLegislativo (prmID interno de Cámara) no estaba
// persistido. Esta columna es necesaria para construir el deep-link de tramitación:
//   https://www.camara.cl/legislacion/ProyectosDeLey/tramitacion.aspx?prmID={prmId}&prmBOLETIN={boletin}
//
// DOS ETAPAS por año, separadas y re-ejecutables independientemente:
//   ETAPA 1 — WSLegislativo → R2 (crudo XML, content-addressed, idempotente 412=OK).
//   ETAPA 2 — R2-cached XML → Supabase PROD (UPDATE proyecto SET prm_id_camara = ... WHERE boletin = ...).
//             Solo actualiza filas EXISTENTES (no crea proyectos); solo cuando prmId != null.
//
// REANUDABLE:
//   - El hash-check R2 (If-None-Match: *) detecta XMLs ya persistidos → 412=OK → salta la
//     escritura R2 pero AÚN parsea el XML local para el UPDATE. Sin embargo, para simplificar
//     el re-entrado, el CLI re-parsea el XML (el R2 lo ignora si ya existe → idempotente).
//   - El UPDATE es idempotente (mismo prmId → no-op DB).
//   - Reanudación: correr de nuevo con el mismo --desde/--hasta omite años cuyo XML ya está
//     en R2 (412 idempotente) y re-aplica los UPDATEs (idempotentes).
//
// LOCKED (CLAUDE.md Conventions):
//   - Backfill masivo = LOCAL (operador), NUNCA GitHub Actions.
//   - Rate-limit 2-3s OBLIGATORIO (WAF camara.cl): reusa `this.fetch` de CamaraConnector
//     (assertAllowedUrl + robots + rateLimiter 2-3s + fetcher con UA identificatorio).
//     NUNCA hand-roll fetch.
//   - Secretos SOLO de .env/process.env, NUNCA de argv.
//   - Propagar solo `error.message`, JAMÁS la service key (T-89-03).
//
// Uso:
//   tsx packages/tramitacion/src/run-backfill-prmid-cli.ts \
//       --desde 1990 --hasta 2024 [--dry-run]
//
// Corrida de validación corta (~10 boletines, rate-limit 2-3s):
//   tsx packages/tramitacion/src/run-backfill-prmid-cli.ts --desde 2024 --hasta 2024
//
// Corrida completa (~3.659 boletines, ≈2-3h con rate-limit 2-3s):
//   tsx packages/tramitacion/src/run-backfill-prmid-cli.ts --desde 1990 --hasta 2024
//
// Reanudación (si se interrumpió):
//   tsx packages/tramitacion/src/run-backfill-prmid-cli.ts --desde 1990 --hasta 2024
//   (idempotente: R2 412 para XMLs ya guardados; UPDATEs idempotentes en DB)

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { Fetcher, HostRateLimiter, RobotsGuard, R2Store, sha256Hex } from "@obs/ingest";
import { CamaraConnector } from "./connector-camara";
import { findWorkspaceRoot } from "./ingest-cli";

// ── Helpers verbatim de run-enumerar-historico-cli ─────────────────────────────────────────────

function flagValue(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1]! : null;
}

/**
 * Carga `.env` BOM-safe con PRECEDENCIA de `process.env`. Espeja `run-tramitacion-prod-cli.loadEnv`.
 * Propaga: SUPABASE_API_URL, SUPABASE_SECRET_KEY, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *          R2_ENDPOINT_URL, R2_BUCKET (errores de acceso los detecta el caller, no aquí).
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
    // Sin `.env`: secretos vienen de process.env (CI/Docker).
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

// ── Entry-point ────────────────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const root = findWorkspaceRoot(process.cwd());
  const env = loadEnv(root);
  const log = (m: string) => console.log(m);

  const dryRun = process.argv.includes("--dry-run");
  const desdeRaw = flagValue("--desde");
  const hastaRaw = flagValue("--hasta");
  const desde = desdeRaw != null ? Number(desdeRaw) : NaN;
  const hasta = hastaRaw != null ? Number(hastaRaw) : NaN;

  // V5: validación de rango (1990..2100), mismo que el connector.
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

  if (dryRun) {
    log(
      `backfill-prmid: DRY-RUN — recorrería años ${desde}..${hasta} vía WSLegislativo ` +
        `(rate-limit 2-3s, dos-etapas R2→UPDATE). Quita --dry-run para correr LIVE.`,
    );
    log(
      `backfill-prmid: Comando completo (1990..2024):` +
        `\n  tsx packages/tramitacion/src/run-backfill-prmid-cli.ts --desde 1990 --hasta 2024`,
    );
    process.exit(0);
    return;
  }

  // ── Validar credenciales (fail-loud, sin imprimir los valores — T-89-03) ──────────────────
  const supabaseUrl = env["SUPABASE_API_URL"] ?? env["SUPABASE_URL"];
  const serviceKey = env["SUPABASE_SECRET_KEY"];
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "backfill-prmid: faltan SUPABASE_API_URL / SUPABASE_SECRET_KEY en .env (no imprimir valores)",
    );
  }
  const r2AccessKey = env["R2_ACCESS_KEY_ID"];
  const r2SecretKey = env["R2_SECRET_ACCESS_KEY"];
  const r2Endpoint = env["R2_ENDPOINT_URL"];
  const r2Bucket = env["R2_BUCKET"];
  if (!r2AccessKey || !r2SecretKey || !r2Endpoint || !r2Bucket) {
    throw new Error(
      "backfill-prmid: faltan R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT_URL / R2_BUCKET en .env",
    );
  }

  // ── Colaboradores @obs/ingest (política LOCKED: rate-limit 2-3s + robots + UA + SSRF) ──────
  const conector = new CamaraConnector({
    fetcher: new Fetcher(),
    rateLimiter: new HostRateLimiter(),
    robots: new RobotsGuard({ allowlist: {} }),
  });

  // ── R2Store (content-addressed, idempotente) ─────────────────────────────────────────────
  const r2 = new R2Store({
    accessKeyId: r2AccessKey,
    secretAccessKey: r2SecretKey,
    endpoint: r2Endpoint,
    bucket: r2Bucket,
  });

  // ── Supabase PROD (service_role, bypassa RLS) ─────────────────────────────────────────────
  // createClient con persistSession:false (patrón run-tramitacion-prod-cli:110).
  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // ── Fecha del bucket R2 (YYYY-MM-DD UTC, constante por corrida) ───────────────────────────
  const fechaBucket = new Date().toISOString().slice(0, 10);

  let totalEnumerados = 0;
  let totalConPrmId = 0;
  let totalUpdated = 0;
  let totalErrAnos = 0;

  log(`backfill-prmid: iniciando años ${desde}..${hasta} (rate-limit 2-3s, dos-etapas R2→UPDATE)`);

  for (let anno = desde; anno <= hasta; anno++) {
    let enumerados = 0;
    let conPrmId = 0;
    let updated = 0;

    try {
      // ETAPA 1 + parse: el callback onXml persiste cada XML crudo a R2 ANTES del parse.
      const pares = await conector.enumerarProyectosConIdXAnno(anno, async (op, xml) => {
        const body = new TextEncoder().encode(xml);
        const sha = await sha256Hex(body);
        // Key: camara-legislativo/{anno}-{op}/{fecha}/{sha}.xml
        const resource = `${anno}-${op}`;
        const { existed } = await r2.putImmutable(
          "camara-legislativo",
          resource,
          fechaBucket,
          sha,
          "xml",
          body,
        );
        if (existed) {
          log(`backfill-prmid: R2 ${resource} ya existía (412 idempotente) — salta escritura`);
        }
      });

      enumerados = pares.length;

      // ETAPA 2: UPDATE por par (solo si prmId != null y solo filas existentes).
      for (const { boletin, prmId } of pares) {
        if (prmId == null) continue; // sin Id en la fuente → skip (fail-honest)
        conPrmId++;
        const { error } = await sb
          .from("proyecto")
          .update({ prm_id_camara: prmId })
          .eq("boletin", boletin);
        if (error) {
          // Error de DB → LANZA (fail-loud); propagar solo message (T-89-03).
          throw new Error(`UPDATE proyecto boletin=${boletin}: ${error.message}`);
        }
        updated++;
      }

      totalEnumerados += enumerados;
      totalConPrmId += conPrmId;
      totalUpdated += updated;
      log(
        `backfill-prmid: ${anno} → ${enumerados} enumerados, ${conPrmId} con prmId, ${updated} updated`,
      );
    } catch (e) {
      totalErrAnos++;
      console.error(
        `backfill-prmid: ERROR año ${anno}:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  log(
    `\nbackfill-prmid: COMPLETADO años ${desde}..${hasta}` +
      ` | enumerados=${totalEnumerados} conPrmId=${totalConPrmId} updated=${totalUpdated} errAnos=${totalErrAnos}`,
  );
  log(
    `backfill-prmid: Para verificar cobertura:\n` +
      `  psql "$SUPABASE_DB_URL" -c "select count(*) filter (where prm_id_camara is not null) as con_prmid, count(*) as total from proyecto;"`,
  );
  log(
    `backfill-prmid: Para corrida completa (1990..2024, reanudable):\n` +
      `  tsx packages/tramitacion/src/run-backfill-prmid-cli.ts --desde 1990 --hasta 2024`,
  );

  process.exit(totalErrAnos > 0 ? 1 : 0);
}

// Entry-point isMain: el regex DEBE matchear el nombre PROPIO de este archivo.
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  /run-backfill-prmid-cli\.(ts|js|mjs|cjs)$/.test(process.argv[1]);

if (isMain) {
  run().catch((err) => {
    console.error(
      "backfill-prmid FALLÓ:",
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  });
}
