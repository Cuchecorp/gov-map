#!/usr/bin/env node
/**
 * probar-links-externos.selfcheck.mjs — Phase 115 (LINK-03), fix WR-01 de la review.
 *
 * Prueba que el gate robots-primero de `scripts/probar-links-externos.mjs` MUERDE.
 *
 * El gate original era `existsSync(115-ROBOTS.txt)`: un artefacto vacio, obsoleto o de
 * otra corrida lo satisfacia, y el retiro de los 8 casos de `www.camara.cl` estaba
 * escrito como COMENTARIO a mano. Este self-check verifica que ahora el runner PARSEA
 * las directivas y NIEGA por codigo.
 *
 * CERO red: todos los fixtures son strings en memoria, salvo la ultima comprobacion,
 * que lee el artefacto REAL del repo y cruza el manifiesto REAL (tampoco pide nada).
 *
 * Uso:
 *   node scripts/probar-links-externos.selfcheck.mjs
 *   exit 0 = el gate muerde y el manifiesto vigente esta limpio · exit 1 = defecto.
 */

import { readFileSync } from "node:fs";

import {
  parsearRobots,
  pathProhibido,
  violacionesRobots,
  CASOS,
  ROBOTS_ARTEFACTO,
} from "./probar-links-externos.mjs";

const fallos = [];
function comprobar(nombre, real, esperado) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) fallos.push(`${nombre}\n    esperado: ${JSON.stringify(esperado)}\n    real    : ${JSON.stringify(real)}`);
  console.log(`${ok ? "ok  " : "FAIL"}  ${nombre}`);
}

// ── (1) parsearRobots: grupo `*`, grupos ajenos, prosa ──────────────────────────

const ARTEFACTO_FIXTURE = `
================================================================================
1. www.prohibido.cl
================================================================================
cuerpo (verbatim):
User-agent: ClaudeBot
Disallow: /solo-para-claudebot

User-agent: *
Allow: /
Disallow: /

lectura: el operador cierra con \`Disallow: /\` para \`*\`.

================================================================================
2. www.parcial.cl
================================================================================
User-agent: *
Allow: /core/*.css$
Disallow: /admin/
Disallow: /core/
Disallow:

================================================================================
3. www.libre.cl
================================================================================
lectura: 403 en robots.txt — sin directivas publicadas.
P-99-c01 — retirado por \`Disallow: /\` (mencion en PROSA, no es directiva)
`;

const parseado = parsearRobots(ARTEFACTO_FIXTURE);
comprobar("(1a) grupo `User-agent: *` de un host restringido", parseado.get("www.prohibido.cl"), ["/"]);
comprobar("(1b) grupo de OTRO product token NO nos aplica", parseado.get("www.prohibido.cl")?.includes("/solo-para-claudebot"), false);
comprobar("(1c) `Disallow:` vacio no restringe; `Allow:` se ignora (Lectura B)", parseado.get("www.parcial.cl"), ["/admin/", "/core/"]);
comprobar("(1d) host presente sin directivas → [] (presente ≠ ausente)", parseado.get("www.libre.cl"), []);
comprobar("(1e) una mencion de `Disallow: /` en PROSA no se cuenta como directiva", parseado.get("www.libre.cl")?.length, 0);

// ── (2) pathProhibido: prefijo, comodin, ancla ──────────────────────────────────

comprobar("(2a) `/` cubre cualquier path", pathProhibido("/appsenado/index.php", "/"), true);
comprobar("(2b) prefijo simple", pathProhibido("/admin/users", "/admin/"), true);
comprobar("(2c) prefijo que NO cubre", pathProhibido("/api/weekly_table", "/admin/"), false);
comprobar("(2d) comodin `*`", pathProhibido("/es/media/oembed", "/*/media/oembed"), true);
comprobar("(2e) ancla `$` exige fin exacto", pathProhibido("/core/x.css", "/core/*.css$"), true);
comprobar("(2f) ancla `$` no casa con sufijo extra", pathProhibido("/core/x.css.map", "/core/*.css$"), false);

// ── (3) violacionesRobots: el gate NIEGA (esto es lo que el gate viejo no hacia) ─

const CASO_PROHIBIDO = { id: "X-01", host: "www.prohibido.cl", url: "https://www.prohibido.cl/legislacion/x.aspx" };
const CASO_OK = { id: "X-02", host: "www.parcial.cl", url: "https://www.parcial.cl/api/weekly_table?limit=100" };
const CASO_ADMIN = { id: "X-03", host: "www.parcial.cl", url: "https://www.parcial.cl/admin/panel" };
const CASO_HUERFANO = { id: "X-04", host: "www.jamas-consultado.cl", url: "https://www.jamas-consultado.cl/x" };

comprobar(
  "(3a) un caso bajo `Disallow: /` se NIEGA nombrando el id",
  violacionesRobots([CASO_PROHIBIDO], ARTEFACTO_FIXTURE).map((v) => [v.id, v.motivo]),
  [["X-01", "Disallow: /"]],
);
comprobar("(3b) un caso permitido pasa", violacionesRobots([CASO_OK], ARTEFACTO_FIXTURE), []);
comprobar(
  "(3c) un caso bajo un Disallow de path se NIEGA",
  violacionesRobots([CASO_ADMIN], ARTEFACTO_FIXTURE).map((v) => v.motivo),
  ["Disallow: /admin/"],
);
comprobar(
  "(3d) fail-closed: host que no figura en el artefacto se NIEGA",
  violacionesRobots([CASO_HUERFANO], ARTEFACTO_FIXTURE).map((v) => v.motivo),
  ["host-sin-robots-consultado"],
);
comprobar(
  "(3e) un artefacto VACIO ya no satisface el gate (defecto del gate por existencia)",
  violacionesRobots([CASO_OK], "").map((v) => v.motivo),
  ["host-sin-robots-consultado"],
);

// ── (4) el manifiesto VIGENTE contra el artefacto REAL del repo ─────────────────

const artefactoReal = readFileSync(ROBOTS_ARTEFACTO, "utf8");
const violacionesReales = violacionesRobots(CASOS, artefactoReal);
comprobar(
  `(4a) los ${CASOS.length} casos vigentes del manifiesto estan permitidos por 115-ROBOTS.txt`,
  violacionesReales.map((v) => `${v.id} ${v.motivo}`),
  [],
);
comprobar(
  "(4b) `www.camara.cl` sigue registrado con `Disallow: /` (el retiro de los 8 casos no fue un capricho)",
  parsearRobots(artefactoReal).get("www.camara.cl"),
  ["/"],
);
comprobar(
  "(4c) reintroducir un caso de www.camara.cl seria NEGADO por codigo, no por comentario",
  violacionesRobots(
    [{ id: "P-02-c01", host: "www.camara.cl", url: "https://www.camara.cl/legislacion/ProyectosDeLey/tramitacion.aspx?prmID=1" }],
    artefactoReal,
  ).map((v) => v.motivo),
  ["Disallow: /"],
);

if (fallos.length > 0) {
  console.error(`\n${fallos.length} comprobacion(es) FALLARON:\n${fallos.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log("\nself-check OK: el gate robots-primero muerde y el manifiesto vigente esta limpio.");
}
