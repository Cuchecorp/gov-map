// taxonomia-superficie-guard.test.ts — G2 (D-133-G, D-133-K1). Guard de régimen: ningún
// literal de etiqueta de la taxonomía (snake_case, tal cual sale de `ETIQUETAS`) puede aparecer
// en una superficie renderizada de `app/`. D-133-G decidió que la etiqueta jamás se renderiza —
// pero "el cumplimiento va por guard, no por promesa".
//
// G2 vive en `packages/news` (no en `app/`) porque `app/` no depende de ningún `@obs/*` — régimen
// documentado en `app/lib/week-utils.ts:3`, `app/lib/types.ts:4`,
// `app/lib/name-match-rut-guard.test.ts:79`. Añadir esa dependencia sería la PRIMERA arista
// `app` → `@obs/*`, rompiendo el desacoplamiento. G2 lee `app/` por DISCO (bytes, walk de
// filesystem — NO import), localizándolo con `findWorkspaceRoot` importada del MÓDULO DIRECTO
// `../run-news-cli` (no del barrel, que arrastraría `@supabase/supabase-js`/`fast-xml-parser`).
//
// Enumeración: `walkSourceFiles` + `SKIP_DIRS` copiados de `app/lib/lockdown-guard.test.ts:102-135`
// (cita de origen), WALK COMPLETO de `app/`, SIN allowlist — la sobre-cobertura es virtud (nunca
// produce falso verde, solo falsos rojos ruidosos). Los `.test.ts` quedan excluidos por el mismo
// filtro del molde original — necesario, o G2 se cazaría a sí mismo (sus propios fixtures
// contienen el literal a propósito).
//
// G2 NO strippea comentarios (D-133-K1) — más simple y estrictamente más estricto que reusar
// `stripTsComments`: cualquier ocurrencia del literal, sea código o comentario, es una violación.
//
// MATCHING CASE-SENSITIVE — decisión de diseño explícita, NO heredada del guard de `app/`.
// `buildTermRegex` de `anti-insinuacion-guard.test.ts:843` compila con el flag "i". G2 NO hereda
// ese flag: combinado con "no strippear comentarios", "i" haría que
// `app/app/buscar/page.tsx:215` (`// Ambiguo o ninguno → null (fail-honest).`) matcheara el
// literal `ambiguo` con frontera limpia, y G2 nacería rojo sobre un comentario en castellano
// ajeno a la taxonomía. Verificado en el repo: case-sensitive → 0 hits en los 6 literales;
// case-insensitive → 1 hit, ese comentario exacto. Lo que D-133-G prohíbe es que el LITERAL DE
// ETIQUETA (snake_case, tal cual sale de `ETIQUETAS`) llegue a una superficie renderizada; una
// palabra castellana capitalizada en un comentario no es ese literal.
// Si algún día apareciera un hit real: PARAR y escalar. JAMÁS editar `app/` para poner el guard
// verde.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path, { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findWorkspaceRoot } from "../run-news-cli.js";
import { ETIQUETAS } from "./taxonomia.js";

const APP_ROOT = join(findWorkspaceRoot(import.meta.dirname), "app");

/** Copiado de `app/lib/lockdown-guard.test.ts:102-135` (cita de origen). */
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".open-next",
  ".turbo",
  "dist",
  "coverage",
  ".vercel",
  ".wrangler",
]);

function walkSourceFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      out.push(...walkSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Matching CASE-SENSITIVE del literal snake_case exacto, con frontera de "palabra de código"
 * (letras/dígitos/`_`) — así un literal con sufijo (p. ej. `_v2`) no cazaría de más, pero
 * tampoco hace falta tolerar acentos (las etiquetas son snake_case ASCII puro). Sin flag "i". */
function contieneLiteralCaseSensitive(contenido: string, literal: string): boolean {
  const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`);
  return regex.test(contenido);
}

const archivos = walkSourceFiles(APP_ROOT);

describe("G2 — enumeración de app/ (piso anti-cero-vacuo)", () => {
  it("el walk de app/ devuelve > 100 archivos .ts/.tsx no-test", () => {
    expect(
      archivos.length,
      `El walk de app/ devolvió ${archivos.length} archivos (piso 100). Si cae por debajo, ` +
        `sospechar de APP_ROOT mal resuelto (walkSourceFiles hace try/catch y devuelve [] en ` +
        `silencio ante una raíz inexistente) antes de asumir que el árbol se redujo.`,
    ).toBeGreaterThan(100);
  });

  it("sanity: un archivo concreto de app/ se leyó con contenido real", () => {
    const knownFile = join(APP_ROOT, "app", "buscar", "page.tsx");
    expect(
      readFileSync(knownFile, "utf8").length,
      "app/app/buscar/page.tsx no se pudo leer o está vacío — señal de APP_ROOT mal resuelto.",
    ).toBeGreaterThan(100);
  });
});

describe("G2 — cero literales de etiqueta en superficie de app/", () => {
  it("cero literales de etiqueta en app/ (CASE-SENSITIVE), anti-cero-vacuo con escaneados", () => {
    let escaneados = 0;
    const offenders: string[] = [];

    for (const file of archivos) {
      escaneados++;
      const contenido = readFileSync(file, "utf8");
      for (const etiqueta of ETIQUETAS) {
        if (contieneLiteralCaseSensitive(contenido, etiqueta)) {
          offenders.push(`${path.relative(APP_ROOT, file)} → "${etiqueta}"`);
        }
      }
    }

    expect(
      escaneados,
      "El contador de archivos escaneados no coincide con el walk — un archivo se saltó en " +
        "silencio (¿continue/filtro colado en el bucle?).",
    ).toBe(archivos.length);

    expect(
      offenders,
      `Literal de etiqueta de la taxonomía renderizado en app/ (D-133-G lo prohíbe): ` +
        `[${offenders.join("; ")}]. JAMÁS editar app/ para poner este guard verde: PARAR y ` +
        `escalar — la etiqueta no debe llegar jamás a una superficie renderizada.`,
    ).toHaveLength(0);
  });

  it("control positivo apareado: el mismo fixture con y sin el literal de etiqueta insertado", () => {
    // Fixture hardcodeado (no interpolado desde ETIQUETAS[0]): el guard no debe depender del
    // orden del array. La única ocurrencia del literal snake_case en este archivo vive en
    // `conLiteral`, abajo — la verificación recorre TODAS las etiquetas reales (ETIQUETAS),
    // igual que hace el guard sobre app/.
    const sinLiteral =
      "export const copy = 'Esta noticia trata sobre el avance de un proyecto en el Congreso.';";
    const conLiteral =
      "export const copy = 'clase: tramitacion_legislativa detectada por el modelo.';";

    const hitsSinLiteral = ETIQUETAS.some((e) => contieneLiteralCaseSensitive(sinLiteral, e));
    const hitsConLiteral = ETIQUETAS.some((e) => contieneLiteralCaseSensitive(conLiteral, e));

    expect(hitsSinLiteral).toBe(false);
    expect(hitsConLiteral).toBe(true);
  });

  it("el matching es CASE-SENSITIVE: \"// Ambiguo o ninguno\" → 0 hits, \"// ambiguo o ninguno\" → 1", () => {
    // Los dos strings difieren en UNA sola letra (la A/a de "Ambiguo"). Es el criterio real de
    // B-3, ejecutado por la función de matching real de G2 — no un grep de respaldo.
    expect(contieneLiteralCaseSensitive("// Ambiguo o ninguno", "ambiguo")).toBe(false);
    expect(contieneLiteralCaseSensitive("// ambiguo o ninguno", "ambiguo")).toBe(true);
  });
});
