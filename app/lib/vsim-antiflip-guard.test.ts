/**
 * VSIM-02 — Guard CI anti-flip del gate deny-by-default VSIM (similitud de votación).
 *
 * El flip de `VSIM_PUBLIC_ENABLED` a `"true"` es un ACTO HUMANO EXCLUSIVO del operador,
 * condicionado a `signoff: approved` en `docs/legal/102-LEGAL-DOSSIER-VSIM.md`
 * (anti-DW-NOMINATE, base-alta caveat). Un commit de AGENTE no puede encender ni
 * erosionar el gate. Este guard CONGELA las tres invariantes del gate y FALLA (la suite
 * se pone roja) ante cualquiera de estas mutaciones:
 *
 *   (Vector 1 — fail-closed) `vsim-gate.ts` enciende SOLO con el literal `"true"`
 *     (`=== "true"`, sin `Boolean(...)` laxo ni `!== "false"`) y esa comparación es el
 *     ÚNICO camino de encendido: sin `||`, sin segunda comparación del flag, sin
 *     `NODE_ENV`/`==` laxo/`.trim()` que abra una rama de preview/CI/'1' (CR-01).
 *   (Vector 2 — nada `=true` committeado) `.env.example` trae `VSIM_PUBLIC_ENABLED=false`,
 *     jamás `=true`.
 *   (Vector 3 — no raw env en ruta) NINGÚN archivo fuente de `app/` NI de `packages/`
 *     (.ts/.tsx/.mjs/.cjs/.js; excepto el chokepoint `lib/vsim-gate.ts`) nombra
 *     `VSIM_PUBLIC_ENABLED`: toda ruta VSIM lee el flag SOLO vía `vsimPublicEnabled()`,
 *     nunca `process.env.VSIM_PUBLIC_ENABLED` crudo.
 *
 * Molde: `app/lib/money-antiflip-guard.test.ts` (byte-a-byte, swap MONEY→VSIM). La lógica
 * de detección vive en helpers PUROS (`detectarRelajacionGate`, `detectarRawEnvEnRuta`)
 * para poder ejercerlos EN MEMORIA en el mutation self-check (§4) — así el guard prueba
 * que MUERDE y no es un no-op verde.
 *
 * ESTE GUARD SOLO LEE Y AFIRMA. NO edita `vsim-gate.ts` ni `.env.example`, NO pone `=true`,
 * NO relaja el `===`. Lee `vsim-gate.ts` con `readFileSync` (no importa el módulo
 * server-only). Reproduce `walkSourceFiles`/`SKIP_DIRS` (no los importa; son módulo-local).
 * Si al correr HOY encontrara una violación real, es un FALLO LEGÍTIMO a reportar, jamás a
 * "arreglar" flipeando algo.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Rutas — vitest de app/ corre desde el dir app/ (vitest.config.ts vive ahí).
// ---------------------------------------------------------------------------
const APP_ROOT = process.cwd(); // app/
const REPO_ROOT = path.resolve(APP_ROOT, ".."); // raíz del monorepo
const PACKAGES_ROOT = path.join(REPO_ROOT, "packages"); // workspaces del monorepo (WR-03)
const VSIM_GATE = path.join(APP_ROOT, "lib", "vsim-gate.ts");
const ENV_EXAMPLE = path.join(REPO_ROOT, ".env.example");

/** relPath (POSIX) del chokepoint único que SÍ puede nombrar el flag crudo. */
const VSIM_GATE_REL = "lib/vsim-gate.ts";

// ---------------------------------------------------------------------------
// stripTsComments (espejo verbatim de money-antiflip-guard.test.ts) — la PROSA de los
// JSDoc menciona `VSIM_PUBLIC_ENABLED` para EXPLICAR el chokepoint; no debe disparar el
// vector 3. OJO (WR-05): NO tratar `//` como comentario cuando va precedido de `:` (URLs).
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
// walkSourceFiles + SKIP_DIRS (espejo de money-antiflip-guard.test.ts, WR-04) — recorre
// .ts/.tsx/.mjs/.cjs/.js del árbol, saltando build/deps; EXCLUYE *.test.* (los tests que
// legítimamente inyectan `{ VSIM_PUBLIC_ENABLED: "true" }` para probar el gate —
// vsim-gate.test.ts, los RTL de superficie, este mismo archivo — no se escanean, por
// construcción del walker).
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
      // WR-04: además de .ts/.tsx, escanear .mjs/.cjs/.js — un config/helper
      // (p.ej. eslint.config.mjs, un middleware o instrumentación) que leyera el
      // flag crudo NO debe escapar el scan. Se siguen excluyendo los *.test.*.
      /\.(ts|tsx|mjs|cjs|js)$/.test(entry) &&
      !/\.test\.(ts|tsx|mjs|cjs|js)$/.test(entry)
    ) {
      out.push(full);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Allowlist EXPLÍCITA nominada del vector 3: el ÚNICO archivo NO-test que puede nombrar
// `VSIM_PUBLIC_ENABLED` es el chokepoint `lib/vsim-gate.ts`. Los *.test.ts/*.test.tsx que
// inyectan `{ VSIM_PUBLIC_ENABLED: "true" }` (vsim-gate.test.ts, comparar/page.test.tsx,
// este guard) quedan fuera del walk por construcción de walkSourceFiles (excluye *.test.*),
// NO por un patrón amplio. Cada excepción está nominada aquí con su razón.
const RAW_ENV_ALLOWLIST: ReadonlyArray<{ rel: string; razon: string }> = [
  {
    rel: VSIM_GATE_REL,
    razon: "chokepoint único server-only: la ÚNICA lectura de la env cruda vive aquí.",
  },
];

function estaEnAllowlist(rel: string): boolean {
  return RAW_ENV_ALLOWLIST.some((a) => a.rel === rel);
}

// ---------------------------------------------------------------------------
// Detectores PUROS — dado el código crudo (o fixtures en memoria) devuelven violaciones.
// Verde (lista vacía / false) = la invariante sigue intacta. Se ejercen en §4 (self-check).
// ---------------------------------------------------------------------------

export interface FuentesGate {
  /** Contenido crudo de vsim-gate.ts. */
  gateSrc: string;
  /** Contenido crudo de .env.example. */
  envSrc: string;
}

/**
 * Vectores 1+2: el gate enciende SOLO con `=== "true"` (sin truthiness laxa) y `.env.example`
 * trae `=false` (nunca `=true`). Devuelve la lista de relajaciones detectadas.
 */
export function detectarRelajacionGate({ gateSrc, envSrc }: FuentesGate): string[] {
  const offenders: string[] = [];

  // (V1a) La comparación estricta contra el literal "true" DEBE seguir siendo el único encendido.
  if (!/VSIM_PUBLIC_ENABLED\s*===\s*["']true["']/.test(gateSrc)) {
    offenders.push(
      "V1: vsim-gate.ts perdió `VSIM_PUBLIC_ENABLED === \"true\"` — el gate ya no enciende " +
        "SOLO con el literal \"true\" (fail-closed roto).",
    );
  }
  // (V1b) NO usa `Boolean(... VSIM_PUBLIC_ENABLED ...)` laxo (dejaría pasar "false").
  if (/Boolean\s*\(\s*[^)]*VSIM_PUBLIC_ENABLED/.test(gateSrc)) {
    offenders.push(
      "V1: vsim-gate.ts usa `Boolean(...VSIM_PUBLIC_ENABLED...)` — truthiness laxa deja pasar " +
        "\"false\"/\"0\"; el gate debe ser `=== \"true\"` estricto.",
    );
  }
  // (V1c) NO usa `!== "false"` (encendería con undefined/cualquier-cosa ≠ "false").
  if (/VSIM_PUBLIC_ENABLED\s*!==\s*["']false["']/.test(gateSrc)) {
    offenders.push(
      "V1: vsim-gate.ts usa `VSIM_PUBLIC_ENABLED !== \"false\"` — encendería con undefined y " +
        "cualquier valor ≠ \"false\"; el gate debe ser `=== \"true\"` estricto (deny-by-default).",
    );
  }

  // (V1d — CR-01) La comparación estricta debe ser el ÚNICO camino de encendido, no
  //   *un* camino entre varios. V1a/V1b/V1c sólo cazan la AUSENCIA del `=== "true"` o
  //   formas laxas puntuales; un mutante que CONSERVA el `=== "true"` pero AÑADE una
  //   segunda rama OR (`|| ... === "1"`, `|| env.NODE_ENV === "preview"`) pasaba las tres.
  //   Aquí afirmamos la ESTRUCTURA de la línea de encendido: la expresión `return` que
  //   nombra el flag debe ser EXACTAMENTE la única comparación estricta `=== "true"`,
  //   sin `||`, sin segunda comparación del flag, sin `NODE_ENV`, sin `==` laxo, sin
  //   `.trim()`/wrapper que ensanche el literal. (El gate legítimo es un one-liner
  //   `return env.VSIM_PUBLIC_ENABLED === "true";`.)
  const enableLine =
    gateSrc.match(/return[^;]*VSIM_PUBLIC_ENABLED[^;]*;/)?.[0] ?? "";
  if (enableLine) {
    const comparaciones = (enableLine.match(/VSIM_PUBLIC_ENABLED/g) ?? []).length;
    // Cualquier `.trim()`/`.toLowerCase()`/wrapper aplicado al flag ensancha el literal.
    const flagConWrapper =
      /VSIM_PUBLIC_ENABLED\s*\??\s*\./.test(enableLine) ||
      /VSIM_PUBLIC_ENABLED\s*\)/.test(enableLine);
    // `==` laxo (no `===`) sobre el flag: aceptaría coerciones.
    const igualdadLaxa = /VSIM_PUBLIC_ENABLED\s*(?<!!)={2}(?!=)/.test(enableLine);
    if (
      comparaciones > 1 ||
      /\|\|/.test(enableLine) ||
      /NODE_ENV/.test(enableLine) ||
      flagConWrapper ||
      igualdadLaxa
    ) {
      offenders.push(
        "V1: vsim-gate.ts tiene MÁS DE UN camino de encendido (|| , segunda comparación, " +
          "NODE_ENV, `==` laxo o `.trim()`/wrapper) — el gate debe encender SOLO con la " +
          "única comparación estricta `VSIM_PUBLIC_ENABLED === \"true\"`, sin ramas extra " +
          "(preview/CI/'1'). El flip es acto HUMANO (anti-DW-NOMINATE), no una segunda ruta de código.",
      );
    }
  }

  // (V2a) .env.example trae `VSIM_PUBLIC_ENABLED=false` (OFF por defecto).
  if (!/^VSIM_PUBLIC_ENABLED\s*=\s*false\s*$/m.test(envSrc)) {
    offenders.push(
      "V2: .env.example ya no trae `VSIM_PUBLIC_ENABLED=false` — el default versionado debe ser OFF.",
    );
  }
  // (V2b) NUNCA `VSIM_PUBLIC_ENABLED=true` en el ejemplo committeado.
  if (/^VSIM_PUBLIC_ENABLED\s*=\s*true\s*$/m.test(envSrc)) {
    offenders.push(
      "V2: .env.example contiene `VSIM_PUBLIC_ENABLED=true` — el flip es acto HUMANO (anti-DW-NOMINATE), " +
        "jamás se committea `=true`.",
    );
  }

  return offenders;
}

/**
 * Vector 3: una ruta lee la env cruda. Dado el código crudo de un archivo y su relPath (POSIX),
 * devuelve `true` si nombra `VSIM_PUBLIC_ENABLED` (tras stripTsComments) y NO es el chokepoint
 * allowlisted. El chokepoint (`lib/vsim-gate.ts`) es la única lectura permitida.
 */
export function detectarRawEnvEnRuta(fileSrc: string, relPath: string): boolean {
  if (estaEnAllowlist(relPath)) return false;
  const stripped = stripTsComments(fileSrc);
  return /VSIM_PUBLIC_ENABLED/.test(stripped);
}

// ---------------------------------------------------------------------------
// (1) Vector 1 — vsim-gate.ts fail-closed (=== "true", sin Boolean laxo).
// ---------------------------------------------------------------------------
describe("(1) Vector 1 — el gate enciende SOLO con el literal \"true\" (fail-closed)", () => {
  it("vsim-gate.ts conserva `VSIM_PUBLIC_ENABLED === \"true\"` y no usa truthiness laxa", () => {
    const gate = readFileSync(VSIM_GATE, "utf-8");
    expect(/VSIM_PUBLIC_ENABLED\s*===\s*["']true["']/.test(gate)).toBe(true);
    expect(/Boolean\s*\(\s*[^)]*VSIM_PUBLIC_ENABLED/.test(gate)).toBe(false);
    expect(/VSIM_PUBLIC_ENABLED\s*!==\s*["']false["']/.test(gate)).toBe(false);
  });

  it("vsim-gate.ts REAL: la comparación estricta es el ÚNICO camino de encendido (CR-01)", () => {
    // Corre el detector completo contra el archivo real: 0 offenders = el gate enciende
    // SOLO con `=== "true"`, sin segunda rama (||, NODE_ENV, '1', .trim(), == laxo).
    const gate = readFileSync(VSIM_GATE, "utf-8");
    const env = readFileSync(ENV_EXAMPLE, "utf-8");
    expect(detectarRelajacionGate({ gateSrc: gate, envSrc: env })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// (2) Vector 2 — .env.example=false (nunca =true committeado).
// ---------------------------------------------------------------------------
describe("(2) Vector 2 — .env.example trae VSIM_PUBLIC_ENABLED=false", () => {
  it("`.env.example` es `=false` y jamás `=true` (el flip es acto humano anti-DW-NOMINATE)", () => {
    const env = readFileSync(ENV_EXAMPLE, "utf-8");
    expect(/^VSIM_PUBLIC_ENABLED\s*=\s*false\s*$/m.test(env)).toBe(true);
    expect(/^VSIM_PUBLIC_ENABLED\s*=\s*true\s*$/m.test(env)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// (3) Vector 3 — ninguna ruta lee la env cruda (walk de app/, chokepoint allowlisted).
// ---------------------------------------------------------------------------
describe("(3) Vector 3 — VSIM_PUBLIC_ENABLED crudo SOLO en el chokepoint vsim-gate.ts", () => {
  const sourceFiles = walkSourceFiles(APP_ROOT);
  // WR-03: además de app/, escanear packages/ (el monorepo tiene packages/*). El
  // ÚNICO chokepoint allowlisted vive en app/lib/vsim-gate.ts; NINGÚN archivo fuente de
  // packages/ puede nombrar el flag crudo. Si una fase futura mueve un render/lector de
  // VSIM a un package, este walk lo caza en vez de dejar un punto ciego por diseño.
  const packageFiles = walkSourceFiles(PACKAGES_ROOT);

  it("sanity: el walker encontró archivos fuente (no es un escaneo vacío)", () => {
    expect(sourceFiles.length).toBeGreaterThan(10);
  });

  it("ningún archivo fuente (≠ lib/vsim-gate.ts) nombra VSIM_PUBLIC_ENABLED tras strip de comentarios", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      const rel = path.relative(APP_ROOT, file).split(path.sep).join("/");
      const src = readFileSync(file, "utf-8");
      if (detectarRawEnvEnRuta(src, rel)) {
        offenders.push(rel);
      }
    }
    expect(
      offenders,
      "Ruta(s) que leen VSIM_PUBLIC_ENABLED crudo (bypassean el chokepoint server-only): " +
        `[${offenders.join("; ")}]. Toda ruta VSIM debe leer el flag vía vsimPublicEnabled(), ` +
        "nunca process.env.VSIM_PUBLIC_ENABLED. El único archivo que puede nombrarlo es lib/vsim-gate.ts.",
    ).toHaveLength(0);
  });

  it("WR-03: sanity — el walker de packages/ encontró archivos (no es un escaneo vacío)", () => {
    // packages/* existe hoy; si el escaneo diera 0 el punto ciego volvería silencioso.
    expect(packageFiles.length).toBeGreaterThan(0);
  });

  it("WR-03: ningún archivo fuente de packages/ nombra VSIM_PUBLIC_ENABLED crudo", () => {
    const offenders: string[] = [];
    for (const file of packageFiles) {
      // rel POSIX relativo al repo (p.ej. packages/x/src/y.ts) — packages/ NO tiene
      // chokepoint allowlisted, así que CUALQUIER mención cruda tras strip es offender.
      const rel = path.relative(REPO_ROOT, file).split(path.sep).join("/");
      const src = readFileSync(file, "utf-8");
      if (detectarRawEnvEnRuta(src, rel)) {
        offenders.push(rel);
      }
    }
    expect(
      offenders,
      "Archivo(s) de packages/ que nombran VSIM_PUBLIC_ENABLED crudo: " +
        `[${offenders.join("; ")}]. El flag vive SOLO en app/lib/vsim-gate.ts; una ruta ` +
        "VSIM en un package debe leerlo vía vsimPublicEnabled(), nunca la env cruda.",
    ).toHaveLength(0);
  });

  it("el chokepoint lib/vsim-gate.ts SÍ está allowlisted (razón nominada)", () => {
    expect(estaEnAllowlist(VSIM_GATE_REL)).toBe(true);
    // El walker por sí solo NO excluye vsim-gate.ts (no es un test) — la allowlist es lo que lo permite.
    const gate = readFileSync(VSIM_GATE, "utf-8");
    expect(/VSIM_PUBLIC_ENABLED/.test(stripTsComments(gate))).toBe(true); // el chokepoint SÍ lo nombra
    expect(detectarRawEnvEnRuta(gate, VSIM_GATE_REL)).toBe(false); // …y por eso NO es offender
  });
});

// ---------------------------------------------------------------------------
// (4) Mutation self-check — los detectores SÍ MUERDEN ante cada relajación (fixtures EN MEMORIA,
//     sin tocar los archivos reales del repo). Prueba que el guard no es un no-op verde.
// ---------------------------------------------------------------------------
describe("(4) Mutation self-check — el guard MUERDE ante cada relajación", () => {
  const GATE_VALIDO = 'return env.VSIM_PUBLIC_ENABLED === "true";';
  const ENV_VALIDO = "VSIM_PUBLIC_ENABLED=false\n";

  it("base válida → 0 offenders (el guard no es un falso-positivo permanente)", () => {
    expect(detectarRelajacionGate({ gateSrc: GATE_VALIDO, envSrc: ENV_VALIDO })).toEqual([]);
  });

  // Self-check A — gate relajado.
  it("A MUERDE: gate mutado a `Boolean(env.VSIM_PUBLIC_ENABLED)` (truthiness laxa)", () => {
    const offenders = detectarRelajacionGate({
      gateSrc: "return Boolean(env.VSIM_PUBLIC_ENABLED);",
      envSrc: ENV_VALIDO,
    });
    expect(offenders.length).toBeGreaterThan(0);
    expect(offenders.some((o) => o.startsWith("V1"))).toBe(true);
  });

  it("A MUERDE: gate mutado a `!== \"false\"` (encendería con undefined)", () => {
    const offenders = detectarRelajacionGate({
      gateSrc: 'return env.VSIM_PUBLIC_ENABLED !== "false";',
      envSrc: ENV_VALIDO,
    });
    expect(offenders.some((o) => o.startsWith("V1"))).toBe(true);
  });

  // Self-check A' (CR-01) — camino de encendido ADITIVO: conserva `=== "true"` PERO añade
  //   una segunda rama. V1a/V1b/V1c pasarían (el literal estricto sigue presente); V1d
  //   debe MORDER porque `=== "true"` ya no es el ÚNICO encendido.
  it("A' MUERDE (CR-01): gate con `|| ... === \"1\"` (segunda rama de valor)", () => {
    const offenders = detectarRelajacionGate({
      gateSrc:
        'return env.VSIM_PUBLIC_ENABLED === "true" || env.VSIM_PUBLIC_ENABLED === "1";',
      envSrc: ENV_VALIDO,
    });
    expect(offenders.some((o) => o.startsWith("V1"))).toBe(true);
  });

  it("A' MUERDE (CR-01): gate con `|| env.NODE_ENV === \"preview\"` (rama de entorno)", () => {
    const offenders = detectarRelajacionGate({
      gateSrc:
        'return env.VSIM_PUBLIC_ENABLED === "true" || env.NODE_ENV === "preview";',
      envSrc: ENV_VALIDO,
    });
    expect(offenders.some((o) => o.startsWith("V1"))).toBe(true);
  });

  it("A' MUERDE (CR-01): gate con `.trim() === \"true\"` (wrapper que ensancha el literal)", () => {
    const offenders = detectarRelajacionGate({
      gateSrc: 'return env.VSIM_PUBLIC_ENABLED.trim() === "true";',
      envSrc: ENV_VALIDO,
    });
    expect(offenders.some((o) => o.startsWith("V1"))).toBe(true);
  });

  it("A' MUERDE (CR-01): gate con `== \"true\"` laxo (coerción, no `===`)", () => {
    const offenders = detectarRelajacionGate({
      // `== "true"` NO contiene `=== "true"` → V1a también dispara; V1d refuerza.
      gateSrc: 'return env.VSIM_PUBLIC_ENABLED == "true";',
      envSrc: ENV_VALIDO,
    });
    expect(offenders.some((o) => o.startsWith("V1"))).toBe(true);
  });

  it("A' NO reporta (CR-01): el gate REAL de un-solo-camino `=== \"true\"` sigue verde", () => {
    // El gate legítimo actual — la única comparación estricta — NO debe ser offender.
    expect(
      detectarRelajacionGate({ gateSrc: GATE_VALIDO, envSrc: ENV_VALIDO }),
    ).toEqual([]);
    // …y verificado contra el archivo REAL (no un fixture) en el bloque (1).
  });

  // Self-check B — .env.example mutado a =true.
  it("B MUERDE: `.env.example` mutado a `VSIM_PUBLIC_ENABLED=true`", () => {
    const offenders = detectarRelajacionGate({
      gateSrc: GATE_VALIDO,
      envSrc: "VSIM_PUBLIC_ENABLED=true\n",
    });
    expect(offenders.some((o) => o.startsWith("V2"))).toBe(true);
  });

  // Self-check C — raw env en ruta.
  it("C MUERDE: raw env `process.env.VSIM_PUBLIC_ENABLED` en una ruta (no-chokepoint)", () => {
    const fixture = 'if (process.env.VSIM_PUBLIC_ENABLED === "true") { render(); }';
    expect(detectarRawEnvEnRuta(fixture, "app/comparar/page.tsx")).toBe(true);
  });

  it("C NO reporta: el mismo raw env dentro del chokepoint lib/vsim-gate.ts (allowlisted)", () => {
    const fixture = 'return env.VSIM_PUBLIC_ENABLED === "true";';
    expect(detectarRawEnvEnRuta(fixture, VSIM_GATE_REL)).toBe(false);
  });

  it("C NO reporta: una mención de VSIM_PUBLIC_ENABLED SOLO en un comentario (stripTsComments)", () => {
    const soloComentario =
      "// chokepoint: NUNCA leer VSIM_PUBLIC_ENABLED crudo\nexport const x = 1;";
    expect(detectarRawEnvEnRuta(soloComentario, "app/comparar/page.tsx")).toBe(false);
  });
});
