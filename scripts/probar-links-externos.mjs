#!/usr/bin/env node
/**
 * probar-links-externos.mjs — Phase 115 (LINK-03)
 *
 * Prueba, contra la fuente oficial, la muestra ESTRATIFICADA de links externos declarada en
 * `.planning/phases/115-link-ext-patrones-de-link-a-fuente-oficial/115-PATRONES.md` §4.
 * Este script NO hace crawl: recorre un manifiesto cerrado (≥1 caso por patrón×host) y nada más.
 * "JAMÁS crawl exhaustivo" es la regla de la fase (decisión operador 2026-07-27).
 *
 * ── Por qué curl y NO el cliente HTTP de Node ────────────────────────────────────
 * Gotcha pagado en v3.0: el WAF de `camara.cl` bloquea al cliente HTTP de Node y deja pasar
 * `curl`. Todo request de este runner sale por `curl` invocado con `child_process.execFile`
 * (array de argumentos, NUNCA `exec` con string interpolado, NUNCA shell) — T-115-05.
 *
 * ── Método HTTP ──────────────────────────────────────────────────────────────────
 * GET con `--range 0-8191`. El método de sólo-cabeceras está PROHIBIDO: servidores
 * gubernamentales lo rechazan y produce falsos negativos.
 *
 * ── Mesura / ingesta respetuosa (CLAUDE.md §Conventions, T-115-01) ───────────────
 * Recorrido SECUENCIAL, agrupado por host, con `DELAY_MS = 2500` (banda 2-3 s de CLAUDE.md)
 * entre requests. El delay se aplica también ENTRE hosts para no acumular ráfagas.
 * Concurrencia PROHIBIDA: no hay ejecución paralela de requests en este archivo.
 * User-Agent identificatorio en la constante `USER_AGENT` (auditable, T-115-06).
 * Reintento: máximo UNO por caso y sólo ante fallo de RED (código de salida de curl), tras 5 s.
 * Un 403/429/5xx NO se reintenta: se registra y se clasifica.
 *
 * ── Gate de orden robots-primero (T-115-13, BLOCKER 1 del plan) ──────────────────
 * El modo por defecto (pedir las URLs de los casos) se NIEGA a correr si todavía no existe
 * `115-ROBOTS.txt`, y —fix WR-01— PARSEA sus directivas antes de emitir un solo request:
 * cada caso cuyo path caiga bajo un `Disallow` del grupo `User-agent: *`, o cuyo host ni
 * siquiera figure en el artefacto, aborta la corrida con exit 1 nombrando el `id` ofensor.
 * El retiro de `www.camara.cl` deja de depender de un comentario a mano. El respeto al
 * protocolo de exclusión no depende de la disciplina del operador: lo impone el runner.
 * Primero `--robots`, después la muestra. Self-check: `probar-links-externos.selfcheck.mjs`.
 *
 * ── Comandos ─────────────────────────────────────────────────────────────────────
 *   # 1) robots.txt de cada host del manifiesto (SIEMPRE primero)
 *   node scripts/probar-links-externos.mjs --robots --out .planning/phases/115-.../115-ROBOTS-RUN
 *
 *   # 1b) robots de un solo host
 *   node scripts/probar-links-externos.mjs --robots --host www.senado.cl --out /tmp/115-smoke
 *
 *   # 2) la muestra (exige que 115-ROBOTS.txt ya exista)
 *   node scripts/probar-links-externos.mjs --out .planning/phases/115-.../115-MUESTRA
 *
 *   # filtros componibles
 *   MSYS_NO_PATHCONV=1 node scripts/probar-links-externos.mjs --id P-13-c01 --out /tmp/115-uno
 *
 * ── Portabilidad (LOCKED) ────────────────────────────────────────────────────────
 * Rutas temporales SIEMPRE con `os.tmpdir()` de Node — jamás una variable de entorno de temp,
 * que en Git Bash/Windows es `undefined` y haría escribir en la raíz del repo.
 * En Git Bash/Windows, las invocaciones con `--id`/`--host` cuyos valores contengan `/`
 * requieren el prefijo `MSYS_NO_PATHCONV=1`: sin él, el valor se mangle a una ruta de disco.
 *
 * Exit code: 0 corrida normal · 1 gate de orden violado o error de red irrecuperable de uso
 * · 2 error de uso (incl. filtros que no casan ninguna entrada — precedente W-01 de 114).
 */

import { parseArgs } from "node:util";
import { execFile } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import os from "node:os";

// ── Constantes de mesura ────────────────────────────────────────────────────────
/**
 * Contacto del User-Agent identificatorio (CLAUDE.md §Conventions).
 *
 * WR-06: el valor de la variable de entorno se interpolaba CRUDO en la cabecera. Un
 * `INGESTA_CONTACTO` con `\r\n` construye una cabecera adicional en el request de curl
 * (no hay shell, pero sí hay construcción de cabecera) y un valor con caracteres de
 * control o no-ASCII rompe la identificación. Se sanea ANTES de interpolar: se descartan
 * los caracteres fuera del ASCII imprimible (incl. `\r`, `\n`, `\0`) y se acota el largo.
 *
 * El defecto es un destino REALMENTE alcanzable: un User-Agent "identificatorio" cuyo
 * contacto no existe no identifica a nadie, y `contacto@observatorio-congreso` (sin TLD)
 * no era resoluble. Se usa el issue tracker público del repo, que sí existe hoy; el
 * operador puede sustituirlo por un buzón propio vía `INGESTA_CONTACTO`.
 *
 * OJO trazabilidad: `115-ROBOTS.txt` y `115-MUESTRA.json` registran el User-Agent
 * VIGENTE EN SU CORRIDA (con el contacto viejo). Son el registro de lo que efectivamente
 * se envió y no se reescriben.
 */
const CONTACTO_DEFECTO = "https://github.com/Cuchecorp/gov-map/issues";
export function sanearContacto(valor) {
  const limpio = String(valor ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .slice(0, 120);
  return limpio || CONTACTO_DEFECTO;
}
const CONTACTO = sanearContacto(process.env.INGESTA_CONTACTO);
export const USER_AGENT = `ObservatorioCongreso360/1.0 (+https://observatorio-congreso.thevalis.workers.dev; contacto: ${CONTACTO})`;
export const DELAY_MS = 2500;
const REINTENTO_MS = 5000;
const MAX_TIME_S = 20;
const MAX_FILESIZE = 200000;

// Prefijo de salida por defecto. Portabilidad LOCKED: `os.tmpdir()` de Node, JAMÁS una
// variable de entorno de temp (en Git Bash/Windows es `undefined`).
const OUT_DEFECTO = join(os.tmpdir(), "115-probar-links-externos");

const AQUI = dirname(fileURLToPath(import.meta.url));
export const ROBOTS_ARTEFACTO = join(
  AQUI,
  "..",
  ".planning",
  "phases",
  "115-link-ext-patrones-de-link-a-fuente-oficial",
  "115-ROBOTS.txt",
);

/**
 * Manifiesto de la muestra — transcripción literal de `115-PATRONES.md` §4.
 * El `id` (`P-NN-cNN`) es el contrato entre el documento, este array, `115-MUESTRA.json`
 * (Plan 02) y las citas de evidencia de `115-VEREDICTO.md`. Un caso en el .md sin fila aquí
 * (o viceversa) es un DEFECTO. Orden: agrupado por host, estable.
 */
export const CASOS = [
  // ── www.camara.cl — RETIRADO por robots ────────────────────────────────────────
  // `www.camara.cl/robots.txt` cierra con un grupo `User-agent: *` cuya unica directiva es
  // `Disallow: /` (evidencia verbatim en 115-ROBOTS.txt §1). Los 8 casos de este host quedan
  // RETIRADOS del manifiesto: P-02-c01, P-05-c01, P-06-c01, P-08-c01, P-09-c01, P-10-c01,
  // P-12-c01, P-21-c01. Sus patrones se validan SOLO por construccion, sin probe. No es
  // "fuente caida": es respeto al protocolo de exclusion.
  // ── opendata.camara.cl ─────────────────────────────────────────────────────────
  { id: "P-03-c02", patron: "P-03 enlaceHumanoProyecto rama-verbatim", host: "opendata.camara.cl", url: "https://opendata.camara.cl/wscamaradiputados.asmx/getVotaciones_Boletin", espera: "web service XML sin parametro (no es pagina humana)" },
  { id: "P-15-c01", patron: "P-15 parlamentario.enlace", host: "opendata.camara.cl", url: "https://opendata.camara.cl/camaradiputados/WServices/WSDiputado.asmx/retornarDiputadosPeriodoActual", espera: "web service XML del padron de diputados" },
  { id: "P-18-c01", patron: "P-18 proyecto.enlace verbatim", host: "opendata.camara.cl", url: "https://opendata.camara.cl/wscamaradiputados.asmx/getVotaciones_Boletin", espera: "mismo web service que P-03-c02" },
  { id: "P-23-c01", patron: "P-23 tramitacion_evento.enlace", host: "opendata.camara.cl", url: "https://opendata.camara.cl/wscamaradiputados.asmx/getVotaciones_Boletin", espera: "mismo web service" },
  { id: "P-25-c01", patron: "P-25 votacion.enlace verbatim", host: "opendata.camara.cl", url: "https://opendata.camara.cl/wscamaradiputados.asmx/getVotaciones_Boletin", espera: "mismo web service" },
  // ── tramitacion.senado.cl ──────────────────────────────────────────────────────
  { id: "P-01-c01", patron: "P-01 buildSenadoUrl", host: "tramitacion.senado.cl", url: "https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=10986-24", espera: "ficha humana de tramitacion del boletin" },
  { id: "P-03-c01", patron: "P-03 enlaceHumanoProyecto rama-rewrite", host: "tramitacion.senado.cl", url: "https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=14309-04", espera: "ficha humana del Sujeto C" },
  { id: "P-16-c01", patron: "P-16 parlamentario.enlace", host: "tramitacion.senado.cl", url: "https://tramitacion.senado.cl/wspublico/senadores_vigentes.php", espera: "XML crudo del padron de senadores (no pagina humana)" },
  { id: "P-17-c01", patron: "P-17 proyecto.enlace post-rewrite", host: "tramitacion.senado.cl", url: "https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=9301-14", espera: "ficha humana del boletin 9301-14" },
  { id: "P-19-c01", patron: "P-19 proyecto_autor.enlace post-rewrite", host: "tramitacion.senado.cl", url: "https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=10986-24", espera: "mismo destino que P-01-c01 (el rewrite converge)" },
  { id: "P-24-c01", patron: "P-24 tramitacion_evento.enlace sin rewrite", host: "tramitacion.senado.cl", url: "https://tramitacion.senado.cl/wspublico/votaciones.php", espera: "XML crudo de votaciones (candidato de §3.3.6 punto 4)" },
  { id: "P-26-c01", patron: "P-26 votacion.enlace post-rewrite", host: "tramitacion.senado.cl", url: "https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=18384-08", espera: "ficha humana del boletin 18384-08" },
  { id: "P-27-c01", patron: "P-27 proyecto.enlace CRUDO en /buscar", host: "tramitacion.senado.cl", url: "https://tramitacion.senado.cl/wspublico/tramitacion.php", espera: "XML crudo sin parametro — candidato #1 de la fase" },
  // ── www.senado.cl ──────────────────────────────────────────────────────────────
  { id: "P-22-c01", patron: "P-22 tramitacion_evento.enlace", host: "www.senado.cl", url: "http://www.senado.cl/appsenado/index.php?mo=tramitacion&ac=getDocto&iddocto=11240&tipodoc=ofic", espera: "documento de tramitacion (oficio); esquema http:" },
  // ── web-back.senado.cl ─────────────────────────────────────────────────────────
  { id: "P-07-c01", patron: "P-07 citacion.enlace", host: "web-back.senado.cl", url: "https://web-back.senado.cl/api/commissions_citations?limit=100", espera: "API JSON de citaciones (no pagina humana)" },
  { id: "P-20-c01", patron: "P-20 sesion_sala.enlace", host: "web-back.senado.cl", url: "https://web-back.senado.cl/api/weekly_table?limit=100", espera: "API JSON de la tabla semanal" },
  // ── www.leylobby.gob.cl ────────────────────────────────────────────────────────
  { id: "P-13-c01", patron: "P-13 lobby_audiencia.enlace", host: "www.leylobby.gob.cl", url: "https://www.leylobby.gob.cl/instituciones/AA001/audiencias/2024/663021", espera: "ficha humana de la audiencia (deep-link real)" },
  { id: "P-14-c01", patron: "P-14 lobby_audiencia.enlace_detalle", host: "www.leylobby.gob.cl", url: "https://www.leylobby.gob.cl/instituciones/AA001/audiencias/2024/663021/728817", espera: "detalle humano de la audiencia (deep-link real)" },
  // ── datos.cplt.cl ──────────────────────────────────────────────────────────────
  { id: "P-11-c01", patron: "P-11 declaracion*.enlace (7 tablas)", host: "datos.cplt.cl", url: "https://datos.cplt.cl/sparql?query=alessandri%20vergara", espera: "endpoint SPARQL con query — no pagina humana de declaracion" },
];

// ── Gate robots-primero: PARSEO del artefacto, no mera existencia (WR-01) ───────
//
// El gate anterior era `existsSync(115-ROBOTS.txt)`: un artefacto vacio, obsoleto o de
// otra corrida lo satisfacia, y el retiro de los 8 casos de `www.camara.cl` estaba
// implementado como COMENTARIO a mano — agregar manana un CASOS de un host prohibido lo
// probaria igual. El encabezado afirma que "el respeto al protocolo de exclusion no
// depende de la disciplina del operador: lo impone el runner"; estas funciones lo hacen
// cierto: se parsean las directivas del artefacto y se NIEGA todo request que matchee.

/**
 * Parsea `115-ROBOTS.txt` (artefacto de prosa con los cuerpos verbatim embebidos) y
 * devuelve `Map<host, string[]>` con los patrones `Disallow` del grupo `User-agent: *`.
 *
 * Reglas de lectura, deliberadamente CONSERVADORAS:
 *  · El host de cada seccion se toma del encabezado numerado (`3. tramitacion.senado.cl`).
 *  · Solo cuentan las lineas que EMPIEZAN (tras trim) por `User-agent:`/`Disallow:` —
 *    las menciones en prosa (`retirado por \`Disallow: /\``) no empiezan asi y no cuentan.
 *  · Solo se acumulan los `Disallow` cuyo grupo vigente es `*`: los grupos de otros
 *    product tokens (`ClaudeBot`, `GPTBot`, …) NO nos aplican.
 *  · Los `Allow` se IGNORAN a proposito: es la Lectura B (literal) que el propio
 *    artefacto adopta para `www.camara.cl` — ante conflicto gana la restriccion.
 *  · `Disallow:` con valor vacio no restringe nada (RFC 9309) y se descarta.
 * Un host presente en el artefacto SIN ninguna directiva (robots ausente / 403 / HTML)
 * queda con `[]` — presente y sin restricciones, que es distinto de ausente.
 */
export function parsearRobots(texto) {
  const porHost = new Map();
  let host = null;
  let ua = null;
  for (const linea of String(texto).split(/\r?\n/)) {
    const l = linea.trim();
    const cab = /^\d+\.\s+([a-z0-9][a-z0-9.-]*\.[a-z]{2,})$/i.exec(l);
    if (cab) {
      host = cab[1].toLowerCase();
      ua = null;
      if (!porHost.has(host)) porHost.set(host, []);
      continue;
    }
    if (!host) continue;
    const mUa = /^user-agent:\s*(\S+)/i.exec(l);
    if (mUa) {
      ua = mUa[1];
      continue;
    }
    const mDis = /^disallow:\s*(\S*)/i.exec(l);
    if (mDis && ua === "*" && mDis[1]) {
      porHost.get(host).push(mDis[1]);
    }
  }
  return porHost;
}

/**
 * `true` si `path` cae bajo el patron `Disallow` de robots.txt. Soporta el comodin `*`
 * y el ancla de fin `$` (extensiones de facto, presentes en el robots de
 * `web-back.senado.cl`); sin ellos, es prefijo simple.
 */
export function pathProhibido(path, patron) {
  const anclado = patron.endsWith("$");
  const cuerpo = anclado ? patron.slice(0, -1) : patron;
  const rx = cuerpo
    .split("*")
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${rx}${anclado ? "$" : ""}`).test(path);
}

/**
 * Cruza el manifiesto con el artefacto de robots. Devuelve la lista de VIOLACIONES
 * (`{ id, host, url, motivo }`). Vacia = se puede emitir.
 *
 * Dos motivos de bloqueo, ambos fail-closed:
 *  · `host-sin-robots-consultado`: el host no aparece en el artefacto ⇒ nunca se
 *    consulto su protocolo de exclusion. Se NIEGA (no se asume permiso).
 *  · `disallow`: alguna directiva del grupo `*` cubre el path del caso.
 */
export function violacionesRobots(casos, textoArtefacto) {
  const porHost = parsearRobots(textoArtefacto);
  const violaciones = [];
  for (const c of casos) {
    const host = c.host.toLowerCase();
    if (!porHost.has(host)) {
      violaciones.push({ id: c.id, host: c.host, url: c.url, motivo: "host-sin-robots-consultado" });
      continue;
    }
    let path;
    try {
      path = new URL(c.url).pathname;
    } catch {
      violaciones.push({ id: c.id, host: c.host, url: c.url, motivo: "url-no-parseable" });
      continue;
    }
    for (const patron of porHost.get(host)) {
      if (pathProhibido(path, patron)) {
        violaciones.push({ id: c.id, host: c.host, url: c.url, motivo: `Disallow: ${patron}` });
        break;
      }
    }
  }
  return violaciones;
}

// ── Clasificación PROPUESTA (el veredicto de fase lo confirma el Plan 02) ────────
export const CLASES = ["OK", "REDIR-GENERICA", "XML-CRUDO", "WAF-403", "NO-DISPONIBLE", "RED"];

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const W = "%{http_code}%{url_effective}%{num_redirects}%{content_type}%{time_total}";

function curl(url) {
  const args = [
    "--silent",
    "--show-error",
    "--location",
    "--max-time",
    String(MAX_TIME_S),
    "--max-filesize",
    String(MAX_FILESIZE),
    "--range",
    "0-8191",
    "--user-agent",
    USER_AGENT,
    "-w",
    `${W}`,
    url,
  ];
  return new Promise((resolve) => {
    execFile("curl", args, { maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && !stdout) {
        resolve({ redError: String(err.message || stderr || err).trim() });
        return;
      }
      const i = stdout.lastIndexOf("");
      const cuerpo = i >= 0 ? stdout.slice(0, i) : stdout;
      const meta = (i >= 0 ? stdout.slice(i + 1) : "").split("");
      resolve({
        cuerpo,
        http_code: Number(meta[0] || 0),
        url_effective: meta[1] || url,
        num_redirects: Number(meta[2] || 0),
        content_type: meta[3] || "",
        time_total: meta[4] || "",
      });
    });
  });
}

function snippet(cuerpo) {
  return String(cuerpo || "").replace(/\s+/g, " ").trim().slice(0, 300);
}

export function clasificar(r) {
  if (r.clase_red) return "RED";
  if (r.http_code === 403 || r.http_code === 429) return "WAF-403";
  // Cualquier 4xx (no sólo 404) y cualquier 5xx es "no disponible". Sin esta rama, un 400
  // —p.ej. el `Virtuoso ... syntax error` de `datos.cplt.cl` ante un SPARQL mal formado—
  // caía al `return "OK"` final y se etiquetaba como éxito. Defecto de la clasificación
  // PROPUESTA, no de la respuesta: los campos crudos del registro no cambian.
  if (r.http_code === 0 || r.http_code >= 500 || (r.http_code >= 400 && r.http_code < 500)) {
    return "NO-DISPONIBLE";
  }
  const ct = (r.content_type || "").toLowerCase();
  const sn = (r.snippet || "").slice(0, 80).toLowerCase();
  if (ct.includes("xml") || sn.startsWith("<?xml")) return "XML-CRUDO";
  if (r.num_redirects > 0) return "REDIR-GENERICA";
  return "OK";
}

async function pedir({ id, patron, host, url, espera }) {
  const ts_inicio = new Date().toISOString();
  let res = await curl(url);
  let reintentado = false;
  if (res.redError) {
    reintentado = true;
    await dormir(REINTENTO_MS);
    res = await curl(url);
  }
  const ts_fin = new Date().toISOString();
  const base = {
    id,
    patron,
    host,
    url,
    espera,
    ts_inicio,
    ts_fin,
    reintentado,
  };
  if (res.redError) {
    const reg = { ...base, clase_red: res.redError, http_code: 0, url_effective: url, num_redirects: 0, content_type: "", time_total: "", snippet: "" };
    reg.clasificacion = clasificar(reg);
    return reg;
  }
  const reg = {
    ...base,
    http_code: res.http_code,
    url_effective: res.url_effective,
    num_redirects: res.num_redirects,
    content_type: res.content_type,
    time_total: res.time_total,
    snippet: snippet(res.cuerpo),
  };
  reg.clasificacion = clasificar(reg);
  return reg;
}

function tabla(registros) {
  const filas = registros.map((r) =>
    [r.id.padEnd(10), String(r.http_code).padEnd(4), r.clasificacion.padEnd(15), r.host.padEnd(24), r.url].join(" "),
  );
  return filas.join("\n");
}

function escribir(prefijo, registros, modo) {
  mkdirSync(dirname(prefijo), { recursive: true });
  const cabecera = [
    `# probar-links-externos.mjs — modo ${modo}`,
    `# fecha: ${new Date().toISOString()}`,
    `# USER_AGENT = "${USER_AGENT}"`,
    `# DELAY_MS = ${DELAY_MS}`,
    `# registros: ${registros.length}`,
    "",
  ].join("\n");
  writeFileSync(`${prefijo}.txt`, `${cabecera}${tabla(registros)}\n`, "utf8");
  writeFileSync(
    `${prefijo}.json`,
    `${JSON.stringify({ meta: { modo, user_agent: USER_AGENT, delay_ms: DELAY_MS, fecha: new Date().toISOString() }, registros }, null, 2)}\n`,
    "utf8",
  );
}

async function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      robots: { type: "boolean", default: false },
      host: { type: "string" },
      id: { type: "string" },
      out: { type: "string" },
      "json-only": { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  const outPrefijo = values.out || OUT_DEFECTO;

  let entradas;
  let modo;

  if (values.robots) {
    modo = "robots";
    const hosts = [];
    for (const c of CASOS) if (!hosts.includes(c.host)) hosts.push(c.host);
    const filtrados = values.host ? hosts.filter((h) => h === values.host) : hosts;
    entradas = filtrados.map((h) => ({
      id: `ROBOTS-${h}`,
      patron: "robots.txt",
      host: h,
      url: `https://${h}/robots.txt`,
      espera: "protocolo de exclusion del host",
    }));
  } else {
    modo = "muestra";
    if (!existsSync(ROBOTS_ARTEFACTO)) {
      console.error(
        `robots.txt no consultado: correr \`--robots\` primero.\n` +
          `Falta el artefacto ${ROBOTS_ARTEFACTO}. No se emitio ningun request.`,
      );
      return 1;
    }
    entradas = CASOS.filter((c) => (values.host ? c.host === values.host : true)).filter((c) =>
      values.id ? c.id === values.id : true,
    );

    // WR-01: el gate NO es de existencia sino de CONTENIDO. Se parsean las directivas
    // del artefacto y se niega TODO caso cuyo path caiga bajo un `Disallow` del grupo
    // `User-agent: *` — o cuyo host ni siquiera figure en el artefacto. Antes de emitir
    // un solo request.
    const violaciones = violacionesRobots(entradas, readFileSync(ROBOTS_ARTEFACTO, "utf8"));
    if (violaciones.length > 0) {
      console.error(
        `protocolo de exclusion: ${violaciones.length} caso(s) del manifiesto NO se pueden pedir.\n` +
          violaciones
            .map((v) => `  ${v.id}  ${v.host}  ${v.motivo}\n    ${v.url}`)
            .join("\n") +
          `\nRetira esos casos de CASOS (se validan por construccion) o corre \`--robots\` ` +
          `para consultar el host. No se emitio ningun request.`,
      );
      return 1;
    }
  }

  if (entradas.length === 0) {
    console.error("filtros sin coincidencias: cero entradas que probar (exit 2)");
    return 2;
  }

  const registros = [];
  let primero = true;
  for (const e of entradas) {
    if (!primero) await dormir(DELAY_MS);
    primero = false;
    const anterior = [...registros].reverse().find((r) => r.host === e.host);
    const reg = await pedir(e);
    reg.delta_ms_mismo_host = anterior
      ? new Date(reg.ts_inicio).getTime() - new Date(anterior.ts_fin).getTime()
      : null;
    registros.push(reg);
  }

  escribir(outPrefijo, registros, modo);
  if (!values["json-only"]) console.log(tabla(registros));
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
