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
 * Corrida por ruta (re-verificación rápida tras un fix) — en Git Bash/Windows el prefijo
 * `MSYS_NO_PATHCONV=1` es OBLIGATORIO: sin él, `/parlamentario/D1165` se mangle a una ruta
 * de disco (`C:/Program Files/...`) y el filtro queda vacío. Cero entradas ⇒ exit 2 (W-01).
 *   MSYS_NO_PATHCONV=1 node scripts/verificar-links-internos.mjs --route /parlamentario/D1165 --out /tmp/114-ruta
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
 * la misma página cuestan UN solo request. Cada request tiene una cota de 15s
 * (`AbortSignal.timeout`) y un fallo de RED se reintenta UNA vez tras 2s sin cachearse
 * (WR-05) — la secuencialidad y el delay se mantienen intactos.
 *
 * ── Portabilidad (LOCKED) ────────────────────────────────────────────────────────
 * Windows / Git Bash NO define la variable de entorno de directorio temporal. Para rutas
 * temporales usar SIEMPRE `os.tmpdir()` desde Node — jamás esa variable de entorno, que aquí es
 * `undefined` y haría escribir en la raíz del repo.
 *
 * ── Endurecimiento post code-review (Phase 114 · REVIEW.md) ─────────────────────
 * El runner de la corrida guardada (114-CORRIDA-PRE/POST) era MÁS LAXO que éste. Los
 * artefactos históricos NO se re-escriben: la re-corrida real ocurre en la Phase 125.
 *  · CR-01: `ausencia` exige 200 con cuerpo no vacío (antes, un origen 404 dejaba
 *    `html=""` y la aserción pasaba SIEMPRE ⇒ gates MONEY/NOTIF vacuos).
 *  · CR-02: `status` con `origen` real + `href` comprueba además que el origen EMITA
 *    ese href (integridad del link), no sólo que el destino responda.
 *  · WR-02: `no-404` pasó a exigir 200 (un 301/302 o un 500 ya no cuenta como sano).
 *  · WR-03: los patrones de `ausencia` dejan de ser substring pelado sobre el HTML
 *    completo y pasan por la maquinaria endurecida (`contienePatron`).
 * ⇒ un veredicto de esta versión puede diferir del de los `.json` guardados: es el
 * runner el que se endureció, no el sitio el que cambió.
 *
 *  · W-01 (verifier de fase): el assert de emisión de CR-02 daba falsos FAIL con las
 *    secciones bajo `<Suspense>` (`/agenda` sirve el shell: los hrefs viajan en el payload
 *    RSC dentro de `<script>`, que `sinRuido()` remueve). Tercer estado `WARN-STREAM` —
 *    href presente en el HTML CRUDO pero no en el sin-ruido ⇒ emisión diferida, NO defecto.
 *    FAIL queda reservado a: destino no-200, u href ausente TAMBIÉN del crudo.
 *
 * Exit code: 0 sin FAIL · 1 con al menos un FAIL · 2 error de uso (incl. filtros que no
 * casan ninguna entrada). Los MISSING-SSR y los WARN-STREAM NO fallan la corrida
 * (candidatos al fallback BrowserOS / a la verificación de DOM de 125).
 */

import { parseArgs } from "node:util";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

import { BASE_URL, MANIFIESTO } from "./links-internos-manifiesto.mjs";

// User-Agent identificatorio (requisito de ingesta respetuosa, CLAUDE.md). El contacto
// sale de `INGESTA_CONTACTO` (IN-01 del review 114): antes era una dirección personal
// hardcodeada que además se propagaba a `meta.user_agent` de cada `.json` commiteado.
const CONTACTO = process.env.INGESTA_CONTACTO || "contacto@observatorio-congreso";
const UA = `ObservatorioCongreso360/1.0 (+https://observatorio-congreso.thevalis.workers.dev; contacto: ${CONTACTO})`;

const DELAY_MS = 400; // rango 300-500ms del CONTEXT
const TIMEOUT_MS = 15_000; // WR-05: cota por request; sin ella una ruta colgada cuelga la corrida
const REINTENTO_MS = 2_000; // WR-05: backoff antes del único reintento tras un fallo de red
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

/**
 * ¿Aparece `id` como atributo `id` de un ELEMENTO real del HTML servido?
 *
 * Contrato (probado por `scripts/verificar-links-internos.selfcheck.mjs`, T-114-12):
 *  - `aria-controls="votos"` / `data-id="votos"` / `aria-labelledby="votos"` → false
 *    (el atributo debe ser exactamente `id`, precedido de whitespace: `\s` + `id=`).
 *  - un `{"id":"votos"}` dentro de un bloque `<script>` → false (los bloques script se
 *    remueven del HTML ANTES de buscar: el payload RSC de Next.js es texto, no DOM).
 *  - markup dentro de un comentario HTML, de `<template>` o de `<noscript>` → false (WR-04:
 *    no son nodos navegables ⇒ no pueden ser destino de un salto `#id`).
 *  - `<section id="votos">` / `<section id='votos'>` → true.
 *  - `<section id="votos-extra">` con ancla `votos` → false (la comilla de cierre ancla el final).
 *
 * Exportada con nombre para poder ejercerla desde el self-check: una aserción sin prueba de
 * que muerde no cuenta como aserción (patrón mutation self-check: 68-01, 100-01, 103-01).
 */
/**
 * Remueve del HTML todo lo que NO es markup vivo del documento servido.
 *
 * WR-04 (review 114): con sólo los bloques `<script>` fuera, un `<!-- <section id="votos"> -->`
 * o markup dentro de `<template>` / `<noscript>` producía un PASS falso para un ancla que no
 * existe como destino de salto (ni el comentario ni el contenido de `<template>` son nodos
 * navegables; `<noscript>` sólo se materializa con JS deshabilitado).
 */
export function sinRuido(html) {
  return String(html)
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<template\b[\s\S]*?<\/template\s*>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

export function tieneId(html, id) {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\sid=["']${esc}["']`).test(sinRuido(html));
}

/**
 * Normaliza un valor de href para poder compararlo con el que EMITE el HTML servido:
 * el serializador escapa `&` como `&amp;` (y las comillas como `&#x27;`), así que un
 * `?a=1&b=2` del manifiesto jamás casaría contra el markup sin des-escapar antes.
 */
function normalizarHref(v) {
  return String(v)
    .replace(/&amp;/gi, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;|&#34;/g, '"')
    .trim();
}

/**
 * ¿La página de ORIGEN emite realmente un `href` con este valor? (CR-02 del review 114)
 *
 * Sólo cuenta como emisión el valor COMPLETO de un atributo `href` de un elemento real
 * (bloques `<script>` removidos: el payload RSC es texto, no DOM). Un substring pelado
 * daría PASS con `/proyecto/14309-04` cuando lo emitido es `/proyecto/14309-041`.
 */
function* hrefsDe(texto) {
  for (const m of String(texto).matchAll(/\shref=["']([^"']*)["']/gi)) {
    yield normalizarHref(m[1]);
  }
}

export function tieneHref(html, href) {
  const objetivo = normalizarHref(href);
  for (const v of hrefsDe(sinRuido(html))) if (v === objetivo) return true;
  return false;
}

/**
 * ¿El href aparece en el HTML **CRUDO** —incluido el payload RSC serializado dentro de
 * bloques `<script>`— aunque `sinRuido()` lo haya removido? (W-01, verifier de fase)
 *
 * Next.js serializa el markup de las secciones suspendidas como TEXTO con las comillas
 * escapadas: `<a href=\"/proyecto/14309-04\">`. Des-escapando primero, el mismo regex de
 * atributo `href` lo encuentra. Sigue siendo una comparación por VALOR COMPLETO — no un
 * substring —, así que un href `/` no casa contra `/proyecto/14309-04` ni al revés.
 *
 * Esta función NO afirma que el link esté en el DOM: afirma que el servidor lo mandó en
 * el stream. Es exactamente la evidencia que separa "emisión diferida" de "link ausente".
 */
export function tieneHrefCrudo(html, href) {
  const objetivo = normalizarHref(href);
  const desescapado = String(html).replace(/\\"/g, '"').replace(/\\'/g, "'");
  for (const v of hrefsDe(desescapado)) if (v === objetivo) return true;
  return false;
}

/**
 * ¿Cuántos fallbacks de `<Suspense>` trae el HTML servido? (`Skeleton` = `animate-pulse`).
 *
 * Señal de que la respuesta es un SHELL: las secciones suspendidas no están resueltas en los
 * bytes servidos. Observado 2026-07-28 en el deploy: `/agenda` trae 54 y **cero** ocurrencias
 * de `14309-04` — ni en el sin-ruido ni en el crudo.
 */
export function contarFallbacksDeStreaming(html) {
  return (String(html).match(/animate-pulse/gi) ?? []).length;
}

/** ¿Algún `href` de un elemento real EMPIEZA por este prefijo? (familias `/contraparte/…`). */
export function tieneHrefConPrefijo(html, prefijo) {
  const objetivo = normalizarHref(prefijo);
  for (const v of hrefsDe(sinRuido(html))) if (v.startsWith(objetivo)) return true;
  return false;
}

/**
 * Veredicto de EMISIÓN de un href por su página de origen (CR-02 + W-01).
 *
 * W-01 (verifier de fase 114): el assert de emisión introducido por CR-02 daba **falsos
 * FAIL** cuando la sección emisora vive bajo un boundary de `<Suspense>`. `/agenda` sirve
 * el shell de streaming (54 `animate-pulse`, cero `href="/proyecto/…"` en el HTML plano):
 * los hrefs llegan en el payload RSC dentro de `<script>`, que `sinRuido()` remueve por
 * diseño. El subset `/proyecto` pasó a 10 FAIL cuando el defecto real era 1.
 *
 * Estados, con la evidencia que los separa:
 *  · `PASS`        — el href está en el HTML sin-ruido ⇒ emisión observada en markup vivo.
 *  · `WARN-STREAM` — hay evidencia de emisión DIFERIDA, así que la ausencia en el markup vivo
 *                    no prueba nada. Dos señales, cualquiera basta:
 *                      (a) el href está en el HTML CRUDO (payload RSC dentro de `<script>`);
 *                      (b) la respuesta es un SHELL con fallbacks de Suspense sin resolver.
 *                    NO es defecto y NO falla la corrida: se cierra en 125 contra el DOM.
 *  · `FAIL`        — el href no está en el markup vivo NI en el crudo, y la respuesta NO es
 *                    un shell ⇒ el origen simplemente no emite ese href.
 *
 * Por qué (b) es necesaria y no un salvoconducto: medido contra el deploy (2026-07-28),
 * `/agenda` NO contiene el href ni siquiera en el crudo — el contenido suspendido se
 * resuelve en el cliente. Con sólo (a), las 10 entradas del subset `/proyecto` seguían en
 * FAIL cuando el defecto real era 1. Un shell no es evidencia de ausencia: es ausencia de
 * evidencia, y el veredicto honesto es "no se puede concluir aquí", no "el link está roto".
 * La contrapartida es explícita: en una página SIN fallbacks, un href faltante sigue siendo
 * FAIL — el assert de CR-02 conserva su mordida donde puede morder.
 */
export function veredictoDeEmision(html, href) {
  if (tieneHref(html, href)) return { estado: "PASS", causa: "" };
  if (tieneHrefCrudo(html, href)) {
    return {
      estado: "WARN-STREAM",
      causa:
        "destino alcanzable; href presente en el payload RSC pero no en el markup vivo " +
        "(emisión bajo Suspense) — verificar en DOM (125/BrowserOS)",
    };
  }
  const nFallbacks = contarFallbacksDeStreaming(html);
  if (nFallbacks > 0) {
    return {
      estado: "WARN-STREAM",
      causa:
        `destino alcanzable; el origen sirve un SHELL de streaming (${nFallbacks} fallbacks de Suspense ` +
        "sin resolver) y el href no está en los bytes servidos ⇒ no se puede concluir ausencia " +
        "— verificar en DOM (125/BrowserOS)",
    };
  }
  return { estado: "FAIL", causa: "" };
}

/**
 * Evalúa el patrón `espera` de una entrada `tipo: "ausencia"` con la MISMA maquinaria
 * endurecida que las anclas (WR-03 del review 114). Antes se hacía `html.includes(espera)`
 * sobre el HTML COMPLETO — con `<script>` incluidos —, lo que producía las dos fallas
 * simétricas que este archivo argumenta en detalle para las anclas: falso FAIL si
 * `id="dinero"` aparecía sólo en el payload RSC serializado, y falso PASS si el markup
 * emitía `id='dinero'` (comillas simples) o el href con otra forma.
 *
 * Formas soportadas del patrón, en orden:
 *  · `id="x"`     → `tieneId` (atributo id de un elemento real).
 *  · `href="/x/`  → prefijo de href de un elemento real.
 *  · `/x?y=`      → prefijo de href (familia de rutas, p. ej. `/cuenta?next=`).
 *  · cualquier otro → substring sobre el HTML sin bloques `<script>`.
 */
export function contienePatron(html, espera) {
  const p = String(espera);
  const mId = p.match(/^id=["'](.+)["']$/);
  if (mId) return tieneId(html, mId[1]);
  const mHref = p.match(/^href=["'](.+)$/);
  if (mHref) return tieneHrefConPrefijo(html, mHref[1]);
  if (p.startsWith("/")) return tieneHrefConPrefijo(html, p);
  return sinRuido(html).includes(p);
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

  // W-01: un filtro que no casa NADA salía antes con exit 0 y "Total: 0" — indistinguible
  // de una corrida sana. El caso real es el mangling de rutas de Git Bash/MSYS: sin
  // `MSYS_NO_PATHCONV=1`, `--route /proyecto` se reescribe a `C:/Program Files/...` y el
  // filtro devuelve 0 entradas EN SILENCIO. Cero entradas es error de uso, no un veredicto.
  if (entradas.length === 0) {
    usage(
      `los filtros (route=${values.route ?? "—"} tipo=${values.tipo ?? "—"}) no casan ninguna de las ` +
        `${MANIFIESTO.length} entradas del manifiesto. En Git Bash/Windows anteponer MSYS_NO_PATHCONV=1: ` +
        `sin ella una ruta como /proyecto se mangle a una ruta de disco y el filtro queda vacío.`,
    );
  }

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

  async function pedirUnaVez(ruta) {
    await sleep(DELAY_MS); // mesura: solo antes de un request REAL
    try {
      const res = await fetch(`${BASE_URL}${ruta}`, {
        headers: { "user-agent": UA },
        redirect: "manual",
        // WR-05: sin timeout, una ruta colgada bloqueaba la corrida indefinidamente.
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // CR-02: el cuerpo se lee SIEMPRE, también con status != 200 — las páginas
      // not-found se sirven con 404 y su único link (`/`) sólo se puede comprobar
      // leyendo ese cuerpo. Quien exija 200 lo hace explícitamente (rama `ausencia`).
      const html = await res.text();
      return { status: res.status, html };
    } catch (err) {
      return { status: -1, html: "", error: err.message };
    }
  }

  /**
   * WR-05 (review 114): un fallo de red NO se cachea y se reintenta UNA vez.
   *
   * Antes, `cache.set(ruta, out)` corría también en el `catch`: un único ECONNRESET
   * transitorio marcaba la ruta como fallida para TODAS las entradas restantes que la
   * comparten (las 11 anclas de `/proyecto/14309-04` caían juntas) sin un solo reintento
   * y sin volver a pagar el `sleep`, porque la ruta ya estaba en caché. La corrida se
   * volvía no determinista bajo red inestable — inaceptable en un artefacto reproducible.
   * Sólo se cachea una respuesta REAL del servidor (cualquier status HTTP).
   */
  async function pedir(ruta) {
    if (cache.has(ruta)) return cache.get(ruta);
    let out = await pedirUnaVez(ruta);
    if (out.error) {
      await sleep(REINTENTO_MS); // backoff antes del único reintento
      out = await pedirUnaVez(ruta);
    }
    if (!out.error) cache.set(ruta, out);
    return out;
  }

  const resultados = [];
  let nPass = 0;
  let nFail = 0;
  let nMissing = 0;
  let nWarnStream = 0;

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
        // WR-02 (review 114): "no-404" aceptaba como sano un 301/302/307/308 —incluido
        // un redirect HACIA una página que 404ea, porque `redirect: "manual"` no lo
        // sigue— y también un 500/502/503. Toda la clase `status` (el grueso de SC#1)
        // quedaba sin poder distinguir "vivo" de "roto de otra forma". Se exige 200.
        resultado = r.status === 200 ? "PASS" : "FAIL";
        if (resultado === "FAIL") causa = `esperaba 200, observado ${r.status}`;
      }
      // CR-02 (review 114) — INTEGRIDAD DEL LINK, no sólo alcanzabilidad del destino.
      // Hasta aquí sólo se probó que `destino` responde; un href borrado, mal escrito o
      // condicionado a datos que ya no existen seguía dando PASS mientras la ruta destino
      // viviera. Cuando la entrada declara un `origen` real (una ruta, no "chrome"/"—") y
      // un `href`, se exige además que ESA página emita ESE href.
      if (resultado === "PASS" && entrada.href && entrada.origen?.startsWith("/")) {
        const o = await pedir(entrada.origen);
        if (o.error) {
          resultado = "FAIL";
          causa = `origen ${entrada.origen}: error de red: ${o.error}`;
        } else if (o.status !== 200 && o.status !== 404) {
          // 404 es un origen legítimo: las páginas not-found se sirven con ese status.
          resultado = "FAIL";
          causa = `origen ${entrada.origen} HTTP ${o.status}: no se puede comprobar emisión`;
        } else {
          // W-01: tres estados, no dos. Un href que sólo viaja en el payload RSC (sección
          // bajo <Suspense>) NO es un link roto ⇒ WARN-STREAM, no FAIL.
          const v = veredictoDeEmision(o.html, entrada.href);
          if (v.estado === "WARN-STREAM") {
            resultado = "WARN-STREAM";
            causa = `href="${entrada.href}" en ${entrada.origen}: ${v.causa}`;
          } else if (v.estado === "FAIL") {
            resultado = "FAIL";
            causa = `href="${entrada.href}" NO emitido por ${entrada.origen} (ausente del markup vivo y del HTML crudo, y el origen NO es un shell; destino alcanzable)`;
          }
        }
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
      // CR-01 (review 114): afirmar ausencia EXIGE haber leído el HTML servido. Antes
      // se aceptaba `status === 404` como origen válido y, como `pedir()` deja `html=""`
      // fuera del 200, `!"".includes(espera)` daba PASS SIEMPRE: las 7 entradas que
      // respaldan los gates MONEY/NOTIF se volvían vacuas justo cuando el sitio estaba
      // roto. Sin 200 con cuerpo no vacío no hay evidencia ⇒ FAIL, nunca PASS.
      if (r.status !== 200) {
        causa = `origen HTTP ${r.status}: no se puede afirmar ausencia sin HTML servido`;
      } else if (r.html.length === 0) {
        causa = "origen HTTP 200 con cuerpo vacío: no se puede afirmar ausencia";
      } else if (!contienePatron(r.html, entrada.espera)) {
        resultado = "PASS";
      } else {
        causa = `patrón presente aunque el inventario lo declara ausente (gate ${entrada.gate}): ${entrada.espera}`;
      }
    }

    if (resultado === "PASS") nPass++;
    else if (resultado === "MISSING-SSR") nMissing++;
    else if (resultado === "WARN-STREAM") nWarnStream++;
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
  emit(
    `Total: ${resultados.length} | PASS ${nPass} | FAIL ${nFail} | WARN-STREAM ${nWarnStream} | MISSING-SSR ${nMissing}`,
  );
  if (nWarnStream > 0) {
    emit(
      `  (WARN-STREAM = destino alcanzable, pero el origen no permite concluir sobre la emisión desde` +
        ` el HTML servido: href en el payload RSC, o respuesta = shell con fallbacks de Suspense sin` +
        ` resolver. NO falla la corrida; se cierra en 125 con verificación de DOM.)`,
    );
  }

  const meta = {
    base_url: BASE_URL,
    iso_timestamp: isoTimestamp,
    total: resultados.length,
    pass: nPass,
    fail: nFail,
    warn_stream: nWarnStream,
    missing_ssr: nMissing,
    filtros: { route: values.route ?? null, tipo: values.tipo ?? null },
    cheerio_probe: CHEERIO_PROBE,
    delay_ms: DELAY_MS,
    timeout_ms: TIMEOUT_MS,
    reintento_ms: REINTENTO_MS,
    user_agent: UA,
  };

  const base = values.out;
  mkdirSync(dirname(base), { recursive: true });
  writeFileSync(`${base}.txt`, lineas.join("\n") + "\n", "utf8");
  writeFileSync(`${base}.json`, JSON.stringify({ meta, resultados }, null, 2) + "\n", "utf8");

  process.exit(nFail > 0 ? 1 : 0);
}

// Solo corre cuando el módulo se invoca como script. Importarlo (p. ej. desde el self-check)
// NO debe disparar la corrida ni el `usage()` por falta de --out.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("Error inesperado:", err);
    process.exit(1);
  });
}
