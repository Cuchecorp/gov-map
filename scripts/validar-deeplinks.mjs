#!/usr/bin/env node
/**
 * validar-deeplinks.mjs — TRACE-02: validación empírica de deep-links vivos
 *
 * Valida que los deep-links a Senado y Cámara construidos por ValidacionFuenteSection
 * devuelvan HTTP 200 + content-match del boletín en el HTML de respuesta.
 *
 * Estrategia:
 *   - Senado: curl -sL (sigue redirects), max-time 40s
 *   - Cámara: curl -s (sin -L; curl-first pasa el WAF a diferencia de fetch)
 *   - sleep 3s entre boletines (rate-limit LOCKED, CLAUDE.md §Ingesta)
 *   - UA identificatorio (robots-courteous)
 *   - exit 1 si algún assert falla
 *
 * Uso:
 *   node scripts/validar-deeplinks.mjs
 *   node scripts/validar-deeplinks.mjs --muestra '[{"boletin":"14309-04","prmId":"17140"}]'
 *   node scripts/validar-deeplinks.mjs --smoke   # solo 3 primeras entradas (smoke test)
 *
 * La muestra por defecto cubre ≥10 boletines incl. golden 14309-04 + fixture 16572-06.
 * prmId se obtiene del backfill de Plan 01 (run-backfill-prmid-cli); null = no testar Cámara.
 *
 * JAMÁS construye rutas con buildId ni URLs de sesión (TRACE-02).
 * NO correr en loop masivo automático — esta corrida completa es del gate 89-03.
 */

import { execSync, spawnSync } from "node:child_process";
import { parseArgs } from "node:util";

const UA =
  "ObservatorioCongreso360/1.0 (+https://observatorio-congreso.thevalis.workers.dev; contacto: sanchez.rossi@gmail.com)";

/** Muestra por defecto: ≥10 boletines, golden 14309-04 + fixture 16572-06.
 *  prmId: el ID de tramitación de la Cámara (del backfill Plan 01).
 *  null → solo Senado (fail-honest — Cámara gated hasta backfill). */
const MUESTRA_DEFAULT = [
  // Golden set verificado vivo 2026-07-21 (RESEARCH §Deep-links)
  { boletin: "14309-04", prmId: null },
  // Fixture de tests
  { boletin: "16572-06", prmId: null },
  // Muestra representativa de boletines con tramitación activa
  { boletin: "15963-21", prmId: null },
  { boletin: "15721-07", prmId: null },
  { boletin: "15915-11", prmId: null },
  { boletin: "15388-25", prmId: null },
  { boletin: "16244-07", prmId: null },
  { boletin: "15578-06", prmId: null },
  { boletin: "14991-06", prmId: null },
  { boletin: "16066-16", prmId: null },
  // Dos adicionales para superar el mínimo de 10
  { boletin: "15640-07", prmId: null },
  { boletin: "13664-06", prmId: null },
];

// ── Construcción de URLs (espejo exacto del componente) ────────────────────────

function buildSenadoUrl(boletin) {
  return `https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=${encodeURIComponent(boletin)}`;
}

function buildCamaraUrl(boletin, prmId) {
  return `https://www.camara.cl/legislacion/ProyectosDeLey/tramitacion.aspx?prmID=${encodeURIComponent(prmId)}&prmBOLETIN=${encodeURIComponent(boletin)}`;
}

// ── curl wrapper ──────────────────────────────────────────────────────────────

/**
 * Ejecuta curl y devuelve { status: number, body: string }.
 * curl-first para Cámara (WAF); -sL para Senado (sigue redirects).
 */
function curlGet(url, opts = {}) {
  const { followRedirects = false, maxTime = 25, connectTimeout = 15 } = opts;
  const args = [
    "-s",
    ...(followRedirects ? ["-L"] : []),
    "-A", UA,
    "--max-time", String(maxTime),
    "--connect-timeout", String(connectTimeout),
    "-w", "\n__HTTP_STATUS__%{http_code}",
    url,
  ];
  const result = spawnSync("curl", args, { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  if (result.error) {
    return { status: -1, body: "", error: result.error.message };
  }
  const out = result.stdout ?? "";
  const statusMatch = out.match(/__HTTP_STATUS__(\d+)$/);
  const status = statusMatch ? parseInt(statusMatch[1], 10) : -1;
  const body = out.replace(/__HTTP_STATUS__\d+$/, "");
  return { status, body };
}

// ── sleep ─────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── assert ────────────────────────────────────────────────────────────────────

/**
 * Verifica HTTP 200 + content-match del boletín en el body.
 * Devuelve { ok: boolean, reason?: string }.
 */
function assertResponse(boletin, { status, body, error }) {
  if (error) return { ok: false, reason: `curl error: ${error}` };
  if (status !== 200) return { ok: false, reason: `HTTP ${status}` };
  // content-match: el boletín COMPLETO con sufijo debe aparecer en el HTML.
  // Usar solo la base numérica (e.g. "14309") era demasiado laxo: coincide en
  // páginas de listado, soft-404 o JS bundles, anulando la garantía TRACE-02.
  if (!body.includes(boletin)) {
    return { ok: false, reason: `content-match fallo (boletin completo "${boletin}" no en body; body length: ${body.length})` };
  }
  return { ok: true };
}

// ── tabla de resultados ───────────────────────────────────────────────────────

function padRight(s, n) {
  return String(s).padEnd(n, " ");
}

function printRow(boletin, fuente, http, match, reason) {
  const status = match === true ? "✓" : match === false ? "✗" : "?";
  const reasonStr = reason ? ` (${reason})` : "";
  console.log(
    `  ${status}  ${padRight(boletin, 12)}  ${padRight(fuente, 8)}  HTTP ${padRight(http, 4)}  match:${match}${reasonStr}`,
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Parsear args
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      muestra: { type: "string" },
      smoke: { type: "boolean", default: false },
    },
    strict: false,
  });

  let muestra = MUESTRA_DEFAULT;
  if (values.muestra) {
    try {
      muestra = JSON.parse(values.muestra);
    } catch (e) {
      console.error("Error parseando --muestra:", e.message);
      process.exit(1);
    }
  }
  if (values.smoke) {
    muestra = muestra.slice(0, 3);
    console.log("Modo --smoke: solo primeras 3 entradas.\n");
  }

  console.log(`\n=== validar-deeplinks.mjs — ${muestra.length} boletines ===`);
  console.log(`UA: ${UA}\n`);

  let failures = 0;

  for (let i = 0; i < muestra.length; i++) {
    const { boletin, prmId } = muestra[i];

    if (i > 0) {
      // rate-limit LOCKED: 3s entre boletines
      await sleep(3000);
    }

    // ── Senado (SIEMPRE) ──
    const senadoUrl = buildSenadoUrl(boletin);
    const senadoRes = curlGet(senadoUrl, { followRedirects: true, maxTime: 40, connectTimeout: 15 });
    const senadoAssert = assertResponse(boletin, senadoRes);

    printRow(boletin, "Senado", senadoRes.status ?? "?", senadoAssert.ok, senadoAssert.reason);
    if (!senadoAssert.ok) failures++;

    // ── Cámara (SOLO si prmId) ──
    if (prmId) {
      const camaraUrl = buildCamaraUrl(boletin, prmId);
      const camaraRes = curlGet(camaraUrl, { followRedirects: false, maxTime: 25, connectTimeout: 15 });
      const camaraAssert = assertResponse(boletin, camaraRes);

      printRow(boletin, "Camara", camaraRes.status ?? "?", camaraAssert.ok, camaraAssert.reason);
      if (!camaraAssert.ok) failures++;
    }
  }

  console.log(`\n=== Resultado: ${failures === 0 ? "OK — todos los asserts pasan" : `FALLO — ${failures} assert(s) fallaron`} ===\n`);

  if (failures > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});
