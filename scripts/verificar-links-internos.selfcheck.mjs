#!/usr/bin/env node
/**
 * verificar-links-internos.selfcheck.mjs — Phase 114 Plan 02 (LINK-02, T-114-12)
 *
 * Prueba que la aserción de ancla de `scripts/verificar-links-internos.mjs` MUERDE.
 *
 * Una aserción de ancla laxa (búsqueda de la subcadena `votos` o incluso de `id="votos"` sin
 * exigir que sea el atributo `id` de un elemento) produciría PASS falsos en masa: el HTML de
 * Next.js trae `aria-controls`, `aria-labelledby`, `data-*` y un payload RSC dentro de bloques
 * `<script>` donde la cadena aparece sin que exista el elemento destino del salto `#id`.
 *
 * Uso:
 *   node scripts/verificar-links-internos.selfcheck.mjs
 *   exit 0 = todos los fixtures dan el valor esperado · exit 1 = la aserción no muerde.
 *
 * Comprobación de que el self-check a su vez muerde: relajar `tieneId` a una búsqueda de
 * subcadena pelada (`html.includes(id)`) debe hacer FALLAR este script.
 */

import {
  tieneId,
  contienePatron,
  veredictoDeEmision,
} from "./verificar-links-internos.mjs";

/** @type {{nombre:string, html:string, ancla:string, espera:boolean}[]} */
const FIXTURES = [
  // ── Los 3 obligatorios del <behavior> del plan ────────────────────────────────
  {
    nombre: "aria-controls no es id",
    html: '<div aria-controls="votos"></div>',
    ancla: "votos",
    espera: false,
  },
  {
    nombre: "id dentro de un bloque <script> no es un elemento",
    html: '<script>{"id":"votos"}</script>',
    ancla: "votos",
    espera: false,
  },
  {
    nombre: "id real de elemento",
    html: '<section id="votos" class="mt-8">',
    ancla: "votos",
    espera: true,
  },
  // ── Recomendados por el plan ──────────────────────────────────────────────────
  {
    nombre: "comillas simples",
    html: "<section id='votos'>",
    ancla: "votos",
    espera: true,
  },
  {
    nombre: "prefijo ajeno (votos-extra no es votos)",
    html: '<section id="votos-extra">',
    ancla: "votos",
    espera: false,
  },
  // ── Endurecimiento adicional (mismo espíritu) ─────────────────────────────────
  {
    nombre: "data-id no es id",
    html: '<div data-id="cruces"></div>',
    ancla: "cruces",
    espera: false,
  },
  {
    nombre: "aria-labelledby no es id",
    html: '<section aria-labelledby="patrimonio"></section>',
    ancla: "patrimonio",
    espera: false,
  },
  {
    nombre: 'atributo id serializado como texto dentro de <script> (payload RSC)',
    html: '<script id="x">self.__next_f.push([1,"<section id=\\"lobby\\">"])</script>',
    ancla: "lobby",
    espera: false,
  },
  {
    nombre: "id con guiones (ancla real del inventario)",
    html: '<section id="lobby-tramitacion" class="scroll-mt-24">',
    ancla: "lobby-tramitacion",
    espera: true,
  },
  {
    nombre: "id presente después de otros atributos",
    html: '<h2 class="a b" id="idea-matriz">Idea matriz</h2>',
    ancla: "idea-matriz",
    espera: true,
  },
  // ── WR-04 (review 114): markup que NO es nodo navegable ───────────────────────
  {
    nombre: "id dentro de un comentario HTML no es un elemento",
    html: '<!-- <section id="votos"> -->',
    ancla: "votos",
    espera: false,
  },
  {
    nombre: "id dentro de <template> no es un elemento del documento",
    html: '<template><section id="cruces"></section></template>',
    ancla: "cruces",
    espera: false,
  },
  {
    nombre: "id dentro de <noscript> no es destino de salto",
    html: '<noscript><section id="patrimonio"></section></noscript>',
    ancla: "patrimonio",
    espera: false,
  },
  {
    nombre: "el strip de ruido NO se come el markup vivo que lo rodea",
    html: '<!-- comentario --><section id="similares"></section>',
    ancla: "similares",
    espera: true,
  },
];

/**
 * Fixtures de `contienePatron` — la aserción de las entradas `tipo: "ausencia"`, que
 * respaldan los gates MONEY y NOTIF (WR-03 del review 114). Un substring pelado sobre el
 * HTML completo daba falso FAIL cuando `id="dinero"` aparecía sólo en el payload RSC, y
 * falso PASS cuando el markup emitía `id='dinero'` con comillas simples.
 *
 * @type {{nombre:string, html:string, patron:string, espera:boolean}[]}
 */
const FIXTURES_PATRON = [
  {
    nombre: 'id="dinero" dentro de <script> NO cuenta como presencia (falso FAIL del gate MONEY)',
    html: '<script>self.__next_f.push([1,"<section id=\\"dinero\\">"])</script>',
    patron: 'id="dinero"',
    espera: false,
  },
  {
    nombre: "id='dinero' con comillas simples SÍ cuenta (el substring pelado lo perdía)",
    html: "<section id='dinero'>",
    patron: 'id="dinero"',
    espera: true,
  },
  {
    nombre: 'id="dinero" real de elemento',
    html: '<section id="dinero" class="mt-8">',
    patron: 'id="dinero"',
    espera: true,
  },
  {
    nombre: "id ausente (el caso PASS del gate MONEY OFF)",
    html: '<section id="financiamiento-pendiente">',
    patron: 'id="dinero"',
    espera: false,
  },
  {
    nombre: 'href="/contraparte/ presente como link real',
    html: '<a href="/contraparte/c:x">x</a>',
    patron: 'href="/contraparte/',
    espera: true,
  },
  {
    nombre: 'href="/contraparte/ sólo como texto en <script> NO cuenta',
    html: '<script>{"url":"/contraparte/c:x"}</script>',
    patron: 'href="/contraparte/',
    espera: false,
  },
  {
    nombre: "/cuenta?next= como prefijo de href (gate NOTIF)",
    html: '<a href="/cuenta?next=%2Fparlamentario%2FD1165">Seguir</a>',
    patron: "/cuenta?next=",
    espera: true,
  },
  {
    nombre: "/cuenta?next= ausente (el caso PASS del gate NOTIF OFF)",
    html: '<a href="/cuenta">Mi cuenta</a>',
    patron: "/cuenta?next=",
    espera: false,
  },
];

/**
 * Fixtures de `veredictoDeEmision` — los TRES estados del assert de emisión (W-01).
 *
 * El defecto que cierran: con sólo PASS/FAIL, una sección emisora bajo `<Suspense>`
 * (`/agenda` sirve el shell de streaming: los hrefs llegan en el payload RSC dentro de
 * `<script>`, que `sinRuido()` remueve) producía FAIL falsos — 10 en el subset `/proyecto`
 * cuando el defecto real era 1. WARN-STREAM separa "emisión diferida" de "link ausente".
 *
 * @type {{nombre:string, html:string, href:string, espera:"PASS"|"WARN-STREAM"|"FAIL"}[]}
 */
const FIXTURES_EMISION = [
  {
    nombre: "(c) href en HTML plano → PASS",
    html: '<a href="/proyecto/14309-04">Boletín</a>',
    href: "/proyecto/14309-04",
    espera: "PASS",
  },
  {
    nombre: "(a) href sólo en el payload RSC dentro de <script> + fallback de Suspense → WARN-STREAM",
    html:
      '<div class="animate-pulse h-11"></div>' +
      '<script>self.__next_f.push([1,"<a href=\\"/proyecto/14309-04\\">Boletín</a>"])</script>',
    href: "/proyecto/14309-04",
    espera: "WARN-STREAM",
  },
  {
    nombre: "(b) href ausente del crudo Y del sin-ruido, en página YA resuelta (sin shell) → FAIL",
    html: '<main><a href="/agenda">Agenda</a></main>',
    href: "/proyecto/14309-04",
    espera: "FAIL",
  },
  {
    nombre:
      "shell de streaming sin el href ni en el crudo → WARN-STREAM (el caso REAL de /agenda: 54 fallbacks, 0 ocurrencias del boletín)",
    html: '<div class="animate-pulse h-11"></div><a href="/agenda">Agenda</a>',
    href: "/proyecto/14309-04",
    espera: "WARN-STREAM",
  },
  {
    nombre: "un href AJENO en el payload RSC no salva a otro (comparación por valor completo)",
    html: '<script>self.__next_f.push([1,"<a href=\\"/proyecto/14309-041\\">x</a>"])</script>',
    href: "/proyecto/14309-04",
    espera: "FAIL",
  },
  {
    nombre: "sin fallbacks, el href en el stream sigue siendo WARN-STREAM (no FAIL)",
    html: '<script>self.__next_f.push([1,"<a href=\\"/parlamentarios\\">x</a>"])</script>',
    href: "/parlamentarios",
    espera: "WARN-STREAM",
  },
];

let fallos = 0;
console.log("=== self-check de la aserción de ancla (tieneId) ===");
for (const f of FIXTURES) {
  const obtenido = tieneId(f.html, f.ancla);
  const ok = obtenido === f.espera;
  if (!ok) fallos++;
  console.log(
    `  ${ok ? "OK  " : "FAIL"}  ${f.nombre} — ancla="${f.ancla}" espera=${f.espera} obtenido=${obtenido}`,
  );
}

console.log("\n=== self-check de la aserción de ausencia (contienePatron) ===");
for (const f of FIXTURES_PATRON) {
  const obtenido = contienePatron(f.html, f.patron);
  const ok = obtenido === f.espera;
  if (!ok) fallos++;
  console.log(
    `  ${ok ? "OK  " : "FAIL"}  ${f.nombre} — patrón=${JSON.stringify(f.patron)} espera=${f.espera} obtenido=${obtenido}`,
  );
}

console.log("\n=== self-check del assert de emisión, 3 estados (veredictoDeEmision) ===");
for (const f of FIXTURES_EMISION) {
  const obtenido = veredictoDeEmision(f.html, f.href).estado;
  const ok = obtenido === f.espera;
  if (!ok) fallos++;
  console.log(
    `  ${ok ? "OK  " : "FAIL"}  ${f.nombre} — href="${f.href}" espera=${f.espera} obtenido=${obtenido}`,
  );
}

console.log(
  `\nTotal: ${FIXTURES.length + FIXTURES_PATRON.length + FIXTURES_EMISION.length} fixtures | fallos ${fallos}`,
);
if (fallos > 0) {
  console.error(
    "Alguna aserción NO muerde: no se puede confiar en el veredicto de anclas ni en el de ausencia.",
  );
  process.exit(1);
}
process.exit(0);
