/**
 * VSIM-03 — Guard CI estático permanente: `co_votacion` ∉ superficie /red.
 *
 * REGLA RECTORA (VSIM-03, LOCKED, anti-DW-NOMINATE): la similitud/co-votación JAMÁS
 * entra al grafo de relaciones /red. Un label espacial de "misma votación" sobre el
 * grafo de personas insinúa proximidad ideológica (DW-NOMINATE) — exactamente la
 * lectura que el proyecto rechaza. La única arista de /red es `co_lobby_contraparte`
 * (audiencia de la misma contraparte, hecho declarado); `co_votacion` fue una rama
 * LATENTE muerta (0 filas en DB, CHECK constraint solo permite co_lobby_contraparte)
 * y se BORRÓ de red-graph.tsx (TIPO_LABEL) y arista-hecho.tsx (case) en este plan.
 *
 * Este test ESCANEA el código RENDERIZADO (post-strip de comentarios) de la superficie
 * /red y FALLA si reaparece `co_votacion`/`covotacion`. Es un tripwire PERMANENTE: si
 * una fase futura intentara re-introducir co-votación en el grafo, la suite se pone roja.
 *
 * IMPORTANTE — strip de comentarios (Pitfall LOCKED): `0030_net.sql:27,145` mencionan
 * `co_votacion` en COMENTARIOS que DOCUMENTAN la exclusión (explican por qué el CHECK
 * solo admite co_lobby_contraparte). Esos comentarios son documentación legítima y NO
 * deben borrarse ni disparar el guard: se strippean los comentarios (TS de linea y de
 * bloque, y SQL con doble-guion) ANTES de matchear. El guard caza co_votacion en el
 * CODIGO renderizado, nunca en prosa/comentario.
 *
 * Molde: `walkSourceFiles`/`stripTsComments` de money-antiflip-guard.test.ts
 * (reproducidos módulo-local, no importados). Mutation self-check EN MEMORIA prueba que
 * el guard MUERDE si `co_votacion` se inyecta en un fixture de código.
 *
 * WR-03 (102-REVIEW) — tripwire de PROSA RENDERIZADA: el identificador `co_votacion`
 * no basta. El CR-01 de 102 (la leyenda viva de /red decía "misma votación" y citaba
 * "votaciones de sala") pasó este guard porque el copy no nombra el identificador.
 * Lo que el régimen prohíbe es el CONCEPTO voto sobre el grafo de personas, no solo
 * el símbolo. Por eso el guard también escanea el código post-strip de comentarios
 * (strings/JSX incluidos) buscando idiomas de voto (votación/votaciones/vota(n/ron)/
 * voto(s)). Los comentarios que DOCUMENTAN la exclusión siguen siendo legítimos
 * (se strippean antes del match).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = process.cwd(); // app/
const REPO_ROOT = path.resolve(APP_ROOT, ".."); // raíz del monorepo

// Superficie /red a vigilar: la ruta + los componentes NET + el schema del grafo.
const RED_DIRS = [
  path.join(APP_ROOT, "app", "red"),
  path.join(APP_ROOT, "components", "red"),
];
const NET_SCHEMA_SQL = path.join(
  REPO_ROOT,
  "supabase",
  "migrations",
  "0030_net.sql",
);

// El patrón prohibido: co_votacion / covotacion (con o sin guion bajo).
const CO_VOTACION_RE = /co_?votacion/i;

// WR-03: idiomas de VOTO en prosa/código renderizado de /red. `votaci` cubre
// votación/votaciones (con y sin tilde); los \b evitan falsos positivos por
// subcadena (p.ej. "pivota" NO dispara — la 'v' no abre palabra ahí).
const PROSA_VOTO_RE =
  /votaci|\bvota\b|\bvotan\b|\bvotar\b|\bvotaron\b|\bvoto\b|\bvotos\b|votó/i;

// ---------------------------------------------------------------------------
// stripTsComments (espejo verbatim del molde) — quita `/* */` y `// …` (skip `://`).
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// stripSqlComments — quita comentarios de línea SQL (`-- …`). El .sql del grafo
// menciona co_votacion en comentarios que documentan la exclusión: NO deben disparar.
// ---------------------------------------------------------------------------
function stripSqlComments(content: string): string {
  return content
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("--");
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// walkSourceFiles + SKIP_DIRS (espejo del molde) — .ts/.tsx/.mjs/.cjs/.js del árbol,
// EXCLUYE *.test.* (los tests pueden usar co_votacion como fixture legítimo).
// ---------------------------------------------------------------------------
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
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      out.push(...walkSourceFiles(full));
    } else if (
      /\.(ts|tsx|mjs|cjs|js)$/.test(entry) &&
      !/\.test\.(ts|tsx|mjs|cjs|js)$/.test(entry)
    ) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Detector puro: dado el código crudo de un archivo TS/SQL, devuelve `true` si nombra
 * `co_votacion`/`covotacion` en CÓDIGO (tras strip de comentarios del lenguaje que sea).
 */
export function tieneCoVotacionEnCodigo(
  fileSrc: string,
  tipo: "ts" | "sql",
): boolean {
  const stripped =
    tipo === "sql" ? stripSqlComments(fileSrc) : stripTsComments(fileSrc);
  return CO_VOTACION_RE.test(stripped);
}

/**
 * Detector puro WR-03: `true` si el código TS post-strip de comentarios (strings y
 * JSX incluidos) contiene un idioma de VOTO. En /red el concepto entero está
 * prohibido (anti-DW-NOMINATE), no solo el identificador `co_votacion`.
 */
export function tieneProsaVotoEnCodigo(fileSrc: string): boolean {
  return PROSA_VOTO_RE.test(stripTsComments(fileSrc));
}

// ---------------------------------------------------------------------------
// (1) Guard — CERO `co_votacion` en el CÓDIGO de la superficie /red (comentarios OK).
// ---------------------------------------------------------------------------
describe("(1) VSIM-03 — co_votacion ∉ código de la superficie /red", () => {
  const redFiles = RED_DIRS.flatMap((d) => walkSourceFiles(d));

  it("sanity: el walker encontró archivos fuente de /red (no es un escaneo vacío)", () => {
    // Si el escaneo diera 0, el guard pasaría verde sin haber mirado nada.
    expect(redFiles.length).toBeGreaterThan(1);
  });

  it("ningún archivo TS/TSX de /red nombra co_votacion en código (post-strip de comentarios)", () => {
    const offenders: string[] = [];
    for (const file of redFiles) {
      const rel = path.relative(APP_ROOT, file).split(path.sep).join("/");
      const src = readFileSync(file, "utf-8");
      if (tieneCoVotacionEnCodigo(src, "ts")) {
        offenders.push(rel);
      }
    }
    expect(
      offenders,
      `Archivo(s) de /red que nombran co_votacion en código: [${offenders.join("; ")}]. ` +
        "La co-votación/similitud JAMÁS entra al grafo /red (VSIM-03, anti-DW-NOMINATE). " +
        "Si la mención es documentación de la exclusión, envuélvela en un comentario.",
    ).toHaveLength(0);
  });

  it("WR-03: ningún archivo de /red contiene PROSA de voto renderizada (misma votación / votaciones / votan…)", () => {
    // El agujero por el que cayó CR-01 (102): la leyenda decía "misma votación" y
    // "votaciones de sala" sin nombrar jamás el identificador co_votacion. El
    // concepto voto NO existe en la superficie /red: cero idiomas de voto en el
    // código post-strip (strings/JSX incluidos). La documentación en comentarios
    // sigue siendo legítima (se strippea antes del match).
    const offenders: string[] = [];
    for (const file of redFiles) {
      const rel = path.relative(APP_ROOT, file).split(path.sep).join("/");
      const src = readFileSync(file, "utf-8");
      if (tieneProsaVotoEnCodigo(src)) {
        offenders.push(rel);
      }
    }
    expect(
      offenders,
      `Archivo(s) de /red con prosa de voto en código renderizado: [${offenders.join("; ")}]. ` +
        "El concepto voto/votación JAMÁS entra a la superficie /red (VSIM-03, " +
        "anti-DW-NOMINATE) — ni como identificador ni como copy. Si es documentación " +
        "de la exclusión, envuélvela en un comentario.",
    ).toHaveLength(0);
  });

  it("0030_net.sql NO nombra co_votacion en CÓDIGO (solo en comentarios de la exclusión)", () => {
    // El schema del grafo documenta la exclusión de co_votacion en comentarios `--`;
    // esos son legítimos y se strippean. El CHECK constraint del tipo de arista NO
    // admite co_votacion → cero mención en código.
    const src = readFileSync(NET_SCHEMA_SQL, "utf-8");
    expect(tieneCoVotacionEnCodigo(src, "sql")).toBe(false);
    // …y sanity: el archivo SÍ menciona co_votacion en algún comentario (documenta la
    // exclusión) — si no lo mencionara, la premisa del strip sería vacía (no un error,
    // pero confirma que el strip es lo que evita el falso positivo).
    expect(/co_?votacion/i.test(src)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (2) Mutation self-check — el guard MUERDE si co_votacion reaparece en CÓDIGO.
// ---------------------------------------------------------------------------
describe("(2) Mutation self-check — el guard SÍ muerde", () => {
  it("detecta `co_votacion` inyectado en un fixture de código TS (no un archivo del repo)", () => {
    const fixtureMutado = `
      const TIPO_LABEL = { co_votacion: "Misma votación" };
      export const X = TIPO_LABEL;
    `;
    expect(tieneCoVotacionEnCodigo(fixtureMutado, "ts")).toBe(true);
  });

  it("detecta `covotacion` (sin guion bajo) inyectado en código", () => {
    expect(
      tieneCoVotacionEnCodigo(`const t = "covotacion";`, "ts"),
    ).toBe(true);
  });

  it("NO reporta: co_votacion SOLO en un comentario TS (documentación de la exclusión)", () => {
    const soloComentario =
      "// co_votacion fue removido de /red por VSIM-03\nexport const x = 1;";
    expect(tieneCoVotacionEnCodigo(soloComentario, "ts")).toBe(false);
  });

  it("NO reporta: co_votacion SOLO en un comentario SQL `--` (documentación de la exclusión)", () => {
    const soloComentario =
      "-- el CHECK del tipo NO admite co_votacion (excluido a propósito)\ncreate table t (id int);";
    expect(tieneCoVotacionEnCodigo(soloComentario, "sql")).toBe(false);
  });

  it("detecta co_votacion en CÓDIGO SQL (un CHECK que lo admitiera es offender)", () => {
    const codigo =
      "alter table arista add constraint c check (tipo in ('co_lobby_contraparte','co_votacion'));";
    expect(tieneCoVotacionEnCodigo(codigo, "sql")).toBe(true);
  });

  // ── WR-03: el tripwire de PROSA muerde sobre el copy exacto del CR-01 de 102 ──
  it("WR-03: detecta 'misma votación' en JSX renderizado (el copy del CR-01)", () => {
    const leyendaStale = `
      export const Paso = () => (
        <li>Una relación es un hecho documentado (audiencia, misma votación).</li>
      );
    `;
    expect(tieneProsaVotoEnCodigo(leyendaStale)).toBe(true);
  });

  it("WR-03: detecta 'votaciones de sala' en un string de fuente", () => {
    expect(
      tieneProsaVotoEnCodigo(`const fuente = "Ley del Lobby y votaciones de sala";`),
    ).toBe(true);
  });

  it("WR-03: detecta 'votan'/'votaron' en prosa renderizada", () => {
    expect(tieneProsaVotoEnCodigo(`const t = "cómo votan juntos";`)).toBe(true);
    expect(tieneProsaVotoEnCodigo(`const t = "votaron lo mismo";`)).toBe(true);
  });

  it("WR-03: NO reporta prosa de voto SOLO en comentarios (documentación de la exclusión)", () => {
    const soloComentario =
      "// la leyenda ya NO dice 'misma votación' (VSIM-03)\nexport const x = 1;";
    expect(tieneProsaVotoEnCodigo(soloComentario)).toBe(false);
  });

  it("WR-03: NO reporta subcadenas inocentes ('pivota' no es 'vota')", () => {
    expect(tieneProsaVotoEnCodigo(`const t = "la curva pivota en el seed";`)).toBe(
      false,
    );
  });
});
