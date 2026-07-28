#!/usr/bin/env node
/**
 * verificar-links-internos.mjs — Phase 114 (LINK-02)
 *
 * Verifica contra el DEPLOY REAL cada link interno declarado en
 * `scripts/links-internos-manifiesto.mjs` (universo derivado del inventario rector 113).
 *
 * ── Comandos ──────────────────────────────────────────────────────────────────────
 * Corrida completa (la que produce los artefactos de la fase):
 *   node scripts/verificar-links-internos.mjs --out .planning/phases/114-link-int-links-internos-exhaustivos/114-CORRIDA-PRE
 *
 * Corrida por ruta (re-verificación rápida tras un fix):
 *   node scripts/verificar-links-internos.mjs --route /parlamentario/D1165 --out /tmp/114-ruta
 *
 * Corrida por tipo (la usa el Plan 02 para re-correr solo las anclas):
 *   node scripts/verificar-links-internos.mjs --tipo ancla --out /tmp/114-anclas
 *
 * `--route` y `--tipo` son componibles (se aplican en AND). `--json-only` suprime la tabla
 * por stdout (el `.txt` se escribe igual).
 *
 * ── Probe de resolución de cheerio (DESVIACIÓN DECLARADA) ────────────────────────
 *   $ node -e "import('cheerio').then(()=>console.log('CHEERIO_OK')).catch(()=>console.log('CHEERIO_NO'))"
 *   CHEERIO_NO      ← salida observada 2026-07-28, raíz del repo, Node v22.21.1
 * cheerio 1.2.0 está declarado sólo en packages/agenda|bio|lobby, no en el package.json raíz ⇒
 * bajo pnpm (node_modules estricto) NO resuelve desde scripts/. NO se añade el paquete a la raíz
 * (paquete nuevo = fuera de alcance, T-114-SC). Las aserciones de ancla y de ausencia se hacen por
 * búsqueda sobre el HTML servido (regex de atributo `id=` para anclas; substring literal para
 * ausencia), lo que es suficiente para el contrato de esta fase.
 *
 * ── Mesura (T-114-02) ────────────────────────────────────────────────────────────
 * Recorrido SECUENCIAL con sleep(400) entre requests reales. Concurrencia PROHIBIDA (nada de
 * disparar los fetch en paralelo). El HTML se cachea por URL dentro de la corrida: N anclas sobre
 * la misma página cuestan UN solo request.
 *
 * ── Portabilidad (LOCKED) ────────────────────────────────────────────────────────
 * Windows / Git Bash NO define la variable de entorno de directorio temporal. Para rutas
 * temporales usar SIEMPRE `os.tmpdir()` desde Node — jamás esa variable de entorno, que aquí es
 * `undefined` y haría escribir en la raíz del repo.
 *
 * Exit code: 0 sin FAIL · 1 con al menos un FAIL · 2 error de uso.
 * Los MISSING-SSR no fallan la corrida (candidatos al fallback BrowserOS del Plan 02).
 */

import { parseArgs } from "node:util";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { BASE_URL, MANIFIESTO } from "./links-internos-manifiesto.mjs";

const UA =
  "ObservatorioCongreso360/1.0 (+https://observatorio-congreso.thevalis.workers.dev; contacto: sanchez.rossi@gmail.com)";

const DELAY_MS = 400; // rango 300-500ms del CONTEXT
const TIPOS = ["status", "ancla", "ausencia"];
const CHEERIO_PROBE = "CHEERIO_NO (cheerio no resuelve desde la raíz; verificación por búsqueda sobre el HTML servido)";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function usage(msg) {
  console.error(`Error de uso: ${msg}`);
  console.error(
    "Uso: node scripts/verificar-links-internos.mjs [--route <ruta>] [--tipo status|ancla|ausencia] [--json-only] --out <basename>",
  );
  process.exit(2);
}

/** ¿Aparece `id` como atributo id de algún elemento del HTML? */
function tieneId(html, id) {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\sid=["']${esc}["']`).test(html);
}

function padRight(s, n) {
  return String(s ?? "").padEnd(n, " ");
}

async function main() {
  let values;
  try {
    ({ values } = parseArgs({
      args: process.argv.slice(2),
      options: {
        route: { type: "string" },
        tipo: { type: "string" },
        out: { type: "string" },
        "json-only": { type: "boolean", default: false },
      },
      strict: true,
    }));
  } catch (err) {
    usage(err.message);
  }

  if (!values.out) usage("falta --out <basename>");
  if (values.tipo && !TIPOS.includes(values.tipo)) {
    usage(`--tipo "${values.tipo}" fuera de la lista cerrada (${TIPOS.join(" | ")})`);
  }

  // Filtros (AND).
  let entradas = MANIFIESTO;
  if (values.route) {
    entradas = entradas.filter(
      (e) =>
        (e.origen && e.origen.startsWith(values.route)) ||
        (e.destino && e.destino.startsWith(values.route)),
    );
  }
  if (values.tipo) entradas = entradas.filter((e) => e.tipo === values.tipo);

  const lineas = [];
  const emit = (s) => {
    lineas.push(s);
    if (!values["json-only"]) console.log(s);
  };

  const isoTimestamp = new Date().toISOString();
  emit("=== verificar-links-internos.mjs ===");
  emit(`base_url : ${BASE_URL}`);
  emit(`timestamp: ${isoTimestamp}`);
  emit(`filtros  : route=${values.route ?? "—"} tipo=${values.tipo ?? "—"}`);
  emit(`entradas : ${entradas.length} de ${MANIFIESTO.length}`);
  emit(`cheerio  : ${CHEERIO_PROBE}`);
  emit("");
  emit(
    `  ${padRight("id", 26)} ${padRight("tipo", 9)} ${padRight("gate", 7)} ${padRight("url", 56)} ${padRight("res", 12)} causa`,
  );

  /** @type {Map<string,{status:number,html:string,error?:string}>} */
  const cache = new Map();

  async function pedir(ruta) {
    if (cache.has(ruta)) return cache.get(ruta);
    await sleep(DELAY_MS); // mesura: solo antes de un request REAL
    let out;
    try {
      const res = await fetch(`${BASE_URL}${ruta}`, {
        headers: { "user-agent": UA },
        redirect: "manual",
      });
      const html = res.status === 200 ? await res.text() : "";
      out = { status: res.status, html };
    } catch (err) {
      out = { status: -1, html: "", error: err.message };
    }
    cache.set(ruta, out);
    return out;
  }

  const resultados = [];
  let nPass = 0;
  let nFail = 0;
  let nMissing = 0;

  for (const entrada of entradas) {
    const rutaPedida = entrada.tipo === "ausencia" ? entrada.origen : entrada.destino;
    const r = await pedir(rutaPedida);

    let resultado = "FAIL";
    let causa = "";

    if (r.error) {
      causa = `error de red: ${r.error}`;
    } else if (entrada.tipo === "status") {
      if (entrada.espera === 404) {
        resultado = r.status === 404 ? "PASS" : "FAIL";
        if (resultado === "FAIL") causa = `esperaba 404, observado ${r.status}`;
      } else {
        resultado = r.status !== 404 ? "PASS" : "FAIL";
        if (resultado === "FAIL") causa = "HTTP 404";
      }
    } else if (entrada.tipo === "ancla") {
      if (r.status !== 200) {
        causa = `destino HTTP ${r.status}`;
      } else if (tieneId(r.html, entrada.espera)) {
        resultado = "PASS";
      } else {
        resultado = "MISSING-SSR";
        causa = `id="${entrada.espera}" ausente del HTML SSR — candidato a fallback BrowserOS (Plan 02)`;
      }
    } else if (entrada.tipo === "ausencia") {
      if (r.status !== 200 && r.status !== 404) {
        causa = `origen HTTP ${r.status}`;
      } else if (!r.html.includes(entrada.espera)) {
        resultado = "PASS";
      } else {
        causa = `patrón presente aunque el inventario lo declara ausente (gate ${entrada.gate}): ${entrada.espera}`;
      }
    }

    if (resultado === "PASS") nPass++;
    else if (resultado === "MISSING-SSR") nMissing++;
    else nFail++;

    resultados.push({
      id: entrada.id,
      inventarioRef: entrada.inventarioRef,
      tipo: entrada.tipo,
      gate: entrada.gate,
      origen: entrada.origen,
      destino: entrada.destino,
      href: entrada.href,
      espera: entrada.espera ?? null,
      status: r.status,
      resultado,
      causa,
    });

    emit(
      `  ${padRight(entrada.id, 26)} ${padRight(entrada.tipo, 9)} ${padRight(entrada.gate, 7)} ${padRight(rutaPedida, 56)} ${padRight(resultado, 12)} ${causa}`,
    );
  }

  emit("");
  emit(`Total: ${resultados.length} | PASS ${nPass} | FAIL ${nFail} | MISSING-SSR ${nMissing}`);

  const meta = {
    base_url: BASE_URL,
    iso_timestamp: isoTimestamp,
    total: resultados.length,
    pass: nPass,
    fail: nFail,
    missing_ssr: nMissing,
    filtros: { route: values.route ?? null, tipo: values.tipo ?? null },
    cheerio_probe: CHEERIO_PROBE,
    delay_ms: DELAY_MS,
    user_agent: UA,
  };

  const base = values.out;
  mkdirSync(dirname(base), { recursive: true });
  writeFileSync(`${base}.txt`, lineas.join("\n") + "\n", "utf8");
  writeFileSync(`${base}.json`, JSON.stringify({ meta, resultados }, null, 2) + "\n", "utf8");

  process.exit(nFail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});
