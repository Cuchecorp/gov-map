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

import { tieneId } from "./verificar-links-internos.mjs";

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
console.log(`\nTotal: ${FIXTURES.length} fixtures | fallos ${fallos}`);
if (fallos > 0) {
  console.error("La aserción de ancla NO muerde: no se puede confiar en ningún veredicto de ancla.");
  process.exit(1);
}
process.exit(0);
