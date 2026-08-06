// taxonomia-guard.test.ts — G1 (D-133-A2.4, D-133-J2). Guard de régimen: NINGÚN string de
// `taxonomia.ts` puede contener un término prohibido del linter anti-insinuación de `app/`.
//
// Vía B acotada (D-133-J2): `TERMINOS_PROHIBIDOS` (+ sub-listas `TERMINOS_LINK_EXT` y
// `TERMINOS_COBERTURA`) se movieron a `app/lib/terminos-insinuacion.ts` — módulo SIN JSX, SIN
// imports de componentes. Este guard los lee por DISCO (bytes, `readFileSync`, NO import): así
// no se crea una arista en el grafo de módulos y la dirección `app` → `packages` del monorepo
// no se invierte (`app/` no depende de ningún `@obs/*`, régimen documentado en
// `app/lib/week-utils.ts:3`, `app/lib/types.ts:4`, `app/lib/name-match-rut-guard.test.ts:79`).
//
// `NEGACIONES_LOCKED` NO se movió (D-133-J2.2): incluye constantes `.tsx` que arrastrarían
// jsdom al carril de news. Este guard lee TAMBIÉN por disco el cuerpo de `NEGACIONES_LOCKED`
// (dentro de `anti-insinuacion-guard.test.ts`) y el de `IDIOMS_APROBADOS`
// (`app/lib/idioms-panel.ts`, que `NEGACIONES_LOCKED` incorpora por spread) para reproducir la
// MISMA sustracción de negaciones antes de matchear.
//
// `findWorkspaceRoot` se importa del MÓDULO DIRECTO `../run-news-cli` (no del barrel
// `../index`): el barrel re-exporta `writer-supabase`/`carga-run`, que arrastrarían
// `@supabase/supabase-js` y `fast-xml-parser` a un guard que no los necesita.
//
// MÉTODO DE EXTRACCIÓN — `stripTsComments` OBLIGATORIO sobre LOS DOS archivos leídos
// (`terminos-insinuacion.ts` y `anti-insinuacion-guard.test.ts`), copiado verbatim de
// `app/lib/anti-insinuacion-guard.test.ts:80-95` (con el cuidado del `://` de URLs, WR-05),
// ANTES de extraer los literales de cada array (balanceo de corchetes, acotado al cuerpo del
// array — nunca todo el archivo). Motivo medido, no teórico: sin strip, una extracción sobre
// `anti-insinuacion-guard.test.ts` captura los términos citados dentro del JSDoc de este mismo
// archivo (comentarios que EXPLICAN qué niega cada leyenda, citando el término prohibido que
// niegan). Contraste verificado en el working tree (2026-08-06):
//
//   Extracción              | sin strip | con strip
//   -------------------------|-----------|----------
//   TERMINOS_LINK_EXT        |     8     |     8
//   TERMINOS_COBERTURA       |     6     |     6
//   TERMINOS_PROHIBIDOS inline |  137    |    78
//   total único               |  104     |    92
//   NEGACIONES_LOCKED inline   |   20     |     2
//
// El "104"/"20" de la columna sin-strip están INVALIDADOS por el método (cuando un fix cambia
// cómo se mide algo, la cifra derivada de la medición anterior deja de valer).
//
// PISOS (medidos con strip, citados en el SUMMARY):
//   - términos prohibidos únicos: >= 90 (medido 92, margen 2).
//   - NEGACIONES_LOCKED inline: === 2 EXACTO (conjunto cerrado; su crecimiento debe ser una
//     decisión visible, no un piso que absorbe basura).
//   - IDIOMS_APROBADOS: >= 4 (medido 10). El piso NO es 10: `anti-insinuacion-guard.test.ts`
//     (D-10(i)) ya declara >= 4 como el piso LOCKED de ESE MISMO array ("por debajo, el
//     it.each del self-check generaría cero tests"). Poner 10 con una medición de 10 deja
//     margen cero — la retirada legítima de un idiom en otra fase pondría este guard rojo sin
//     que nada esté mal. G1 espeja el piso existente y cita el conteo real en el SUMMARY.
//
// ALCANCE HONESTO — lo que esta extracción por disco NO cubre: las CINCO constantes que viven
// en componentes `.tsx` y quedan fuera de `NEGACIONES_LOCKED` movible (verificadas por
// `grep -n` en el cuerpo 584-644 de `anti-insinuacion-guard.test.ts`):
//   LEYENDA_ANTI_INSINUACION_MONEY, LEYENDA_CROSS_LINK, LEYENDA_MENCIONES_LOBBY,
//   EMPTY_MENCIONES_LOBBY, LEYENDA_SIMILITUD_VOTO.
// Son CINCO, no cuatro (una declaración de alcance honesto que omite una entrada es peor que
// no declararlo). No participan del cómputo de "inline === 2": ese piso cuenta solo los
// literales de string sueltos del array, no las referencias a constantes importadas.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findWorkspaceRoot } from "../run-news-cli.js";
import { TAXONOMIA } from "./taxonomia.js";

const APP_ROOT = join(findWorkspaceRoot(import.meta.dirname), "app");
const TERMINOS_PATH = join(APP_ROOT, "lib", "terminos-insinuacion.ts");
const GUARD_PATH = join(APP_ROOT, "lib", "anti-insinuacion-guard.test.ts");
const IDIOMS_PATH = join(APP_ROOT, "lib", "idioms-panel.ts");

/**
 * Copiado verbatim de `app/lib/anti-insinuacion-guard.test.ts:80-95` (cita de origen). Cuidado
 * WR-05: NO tratar `//` como comentario cuando va precedido de `:` (URL `https://...`).
 */
function stripTsComments(content: string): string {
  let stripped = content.replace(/\/\*[\s\S]*?\*\//g, "");
  stripped = stripped
    .split("\n")
    .map((line) => {
      const idx = line.search(/(?<!:)\/\//);
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join("\n");
  return stripped;
}

/** Extrae el cuerpo `[...]` balanceado de `const NOMBRE ... = [...]` (o `export const`).
 * `markerHint` es el texto que precede al `[` de apertura (incluye ": string[] = " cuando el
 * array está tipado explícitamente, o solo " = " para arrays `as const` sin anotación). */
function extraerCuerpoArray(
  strippedSource: string,
  nombreConst: string,
  markerHint = ": string[] = ",
): string {
  const marker = `${nombreConst}${markerHint}`;
  const idx = strippedSource.indexOf(marker);
  if (idx < 0) {
    throw new Error(`extraerCuerpoArray: no se encontró "${marker}" en la fuente`);
  }
  const bracketStart = strippedSource.indexOf("[", idx + marker.length);
  if (bracketStart < 0) {
    throw new Error(`extraerCuerpoArray: no se encontró "[" tras "${marker}"`);
  }
  let depth = 0;
  let i = bracketStart;
  for (; i < strippedSource.length; i++) {
    if (strippedSource[i] === "[") depth++;
    else if (strippedSource[i] === "]") {
      depth--;
      if (depth === 0) break;
    }
  }
  return strippedSource.slice(bracketStart, i + 1);
}

/** Literales de string dentro de un cuerpo de array ya extraído (spreads `...X` se ignoran). */
function extraerLiterales(cuerpoArray: string): string[] {
  const matches = cuerpoArray.match(/"(?:[^"\\]|\\.)*"/g) ?? [];
  return matches.map((s) => s.slice(1, -1));
}

// --- Lectura por disco de los tres archivos, con sanity + strip -----------------------------

const terminosRaw = readFileSync(TERMINOS_PATH, "utf8");
const guardRaw = readFileSync(GUARD_PATH, "utf8");
const idiomsRaw = readFileSync(IDIOMS_PATH, "utf8");

const terminosStripped = stripTsComments(terminosRaw);
const guardStripped = stripTsComments(guardRaw);
const idiomsStripped = stripTsComments(idiomsRaw);

const linkExt = extraerLiterales(extraerCuerpoArray(terminosStripped, "TERMINOS_LINK_EXT"));
const cobertura = extraerLiterales(extraerCuerpoArray(terminosStripped, "TERMINOS_COBERTURA"));
const prohibidosInline = extraerLiterales(
  extraerCuerpoArray(terminosStripped, "TERMINOS_PROHIBIDOS"),
);
const TERMINOS_UNICOS = Array.from(new Set([...linkExt, ...cobertura, ...prohibidosInline]));

const negacionesInline = extraerLiterales(
  extraerCuerpoArray(guardStripped, "const NEGACIONES_LOCKED"),
);
const idiomsAprobados = extraerLiterales(
  extraerCuerpoArray(idiomsStripped, "IDIOMS_APROBADOS", " = "),
);

/** Sustracción de negaciones — MISMO patrón que `detectarTerminos`/`detectarInsinuaciones` de
 * `anti-insinuacion-guard.test.ts:714-730`: se restan las negaciones LOCKED del contenido antes
 * de matchear términos prohibidos. D-133-J2.4: aplicada aquí y se asserta que NO removió nada
 * de las glosas de la taxonomía (si una glosa contuviera una negación LOCKED verbatim, eso es
 * un hallazgo que DEBE fallar). */
function restarNegaciones(texto: string, negaciones: string[]): string {
  let out = texto;
  for (const neg of negaciones) {
    out = out.split(neg).join(" ");
  }
  return out;
}

const WORD = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Copiado verbatim de `anti-insinuacion-guard.test.ts:837-845` (cita de origen), con el mismo
 * flag "i" — la sensibilidad a mayúsculas NO es el eje de G1 (a diferencia de G2). */
function buildTermRegex(term: string): RegExp {
  const tokens = term.trim().split(/\s+/).map(escapeRegex);
  const body = tokens.join("\\s+");
  return new RegExp(`(?<![${WORD}])${body}(?![${WORD}])`, "i");
}

function detectarTerminos(rawContent: string, terminos: string[], negaciones: string[]): string[] {
  const contenido = restarNegaciones(rawContent, negaciones);
  const hits: string[] = [];
  for (const term of terminos) {
    if (buildTermRegex(term).test(contenido)) hits.push(term);
  }
  return hits;
}

describe("G1 — extracción por disco (piso de conteo)", () => {
  it("piso: >= 90 términos prohibidos extraídos del disco (medido con strip: 92)", () => {
    expect(
      TERMINOS_UNICOS.length,
      `Se extrajeron ${TERMINOS_UNICOS.length} términos únicos (piso 90). Si cae por debajo, ` +
        `sospechar de la extracción (¿stripTsComments desactivado? ¿ruta mal resuelta?) antes ` +
        `de asumir que el vocabulario real se redujo.`,
    ).toBeGreaterThanOrEqual(90);
  });

  it("piso: NEGACIONES_LOCKED aporta exactamente 2 literales inline", () => {
    expect(
      negacionesInline.length,
      `NEGACIONES_LOCKED dio ${negacionesInline.length} literales inline (esperado 2 EXACTO). ` +
        `Es un conjunto cerrado: su crecimiento debe ser una decisión visible, no un piso que ` +
        `absorbe basura de JSDoc sin strip.`,
    ).toBe(2);
  });

  it("piso: IDIOMS_APROBADOS aporta >= 4 (medido con strip: 10; piso espeja D-10(i) de app/)", () => {
    expect(
      idiomsAprobados.length,
      `IDIOMS_APROBADOS dio ${idiomsAprobados.length} (piso 4, medido 10). El piso es 4 porque ` +
        `no le toca a esta fase endurecer el piso LOCKED que ya declara ` +
        `anti-insinuacion-guard.test.ts (D-10(i)).`,
    ).toBeGreaterThanOrEqual(4);
  });

  it("sanity: terminos-insinuacion.ts se leyó y tiene contenido", () => {
    expect(
      terminosRaw.length,
      "La lectura de app/lib/terminos-insinuacion.ts devolvió longitud sospechosamente baja " +
        "— si la raíz del workspace está mal resuelta, readFileSync debe LANZAR, no devolver " +
        "un archivo vacío/ajeno en silencio.",
    ).toBeGreaterThan(100);
  });
});

describe("G1 — cero términos prohibidos en los strings de la taxonomía", () => {
  const negacionesCompletas = [...negacionesInline, ...idiomsAprobados];

  it("cero términos prohibidos en los strings de la taxonomía (verificados === 30)", () => {
    let verificados = 0;
    const offenders: string[] = [];
    const campos = ["etiqueta", "definicion", "marca_decisoria", "frontera", "enruta_a"] as const;

    for (const clase of TAXONOMIA) {
      for (const campo of campos) {
        verificados++;
        const valor = String(clase[campo]);

        // D-133-J2.4: la sustracción de negaciones se aplica ANTES del match, y se asserta
        // que NO removió nada de la glosa real (si removiera algo, esa glosa contendría una
        // negación LOCKED verbatim — un hallazgo que debe fallar, no disimularse).
        expect(
          restarNegaciones(valor, negacionesCompletas),
          `La sustracción de negaciones alteró ${clase.etiqueta}.${campo} — una glosa de la ` +
            `taxonomía no debería contener ninguna negación LOCKED verbatim.`,
        ).toBe(valor);

        for (const hit of detectarTerminos(valor, TERMINOS_UNICOS, negacionesCompletas)) {
          offenders.push(`${clase.etiqueta}.${campo} → "${hit}"`);
        }
      }
    }

    expect(
      verificados,
      "Algún string de la taxonomía no llegó al detector (¿un `continue`/filtro colado en el " +
        "bucle?). Se esperan 30 (6 clases × 5 campos).",
    ).toBe(30);

    expect(
      offenders,
      `Término prohibido en una glosa de la taxonomía (nunca se afirma intención/causalidad ` +
        `en el copy de clasificación): [${offenders.join("; ")}].`,
    ).toHaveLength(0);
  });
});
