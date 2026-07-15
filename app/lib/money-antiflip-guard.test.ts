/**
 * MONEY-05 — Guard CI anti-flip del gate deny-by-default MONEY (73-01, T-73-01/02/03).
 *
 * El flip de `MONEY_PUBLIC_ENABLED` a `"true"` es un ACTO HUMANO EXCLUSIVO del operador,
 * condicionado a `signoff: approved` en `docs/legal/13-LEGAL-DOSSIER.md` (Ley 21.719). Un
 * commit de AGENTE no puede encender ni erosionar el gate. Este guard CONGELA las tres
 * invariantes del gate y FALLA (la suite se pone roja) ante cualquiera de estas mutaciones:
 *
 *   (Vector 1 — fail-closed) `money-gate.ts` enciende SOLO con el literal `"true"`
 *     (`=== "true"`, sin `Boolean(...)` laxo ni `!== "false"`) y esa comparación es el
 *     ÚNICO camino de encendido: sin `||`, sin segunda comparación del flag, sin
 *     `NODE_ENV`/`==` laxo/`.trim()` que abra una rama de preview/CI/'1' (CR-01).
 *   (Vector 2 — nada `=true` committeado) `.env.example` trae `MONEY_PUBLIC_ENABLED=false`,
 *     jamás `=true`.
 *   (Vector 3 — no raw env en ruta) NINGÚN archivo fuente de `app/` NI de `packages/`
 *     (.ts/.tsx/.mjs/.cjs/.js; excepto el chokepoint `lib/money-gate.ts`) nombra
 *     `MONEY_PUBLIC_ENABLED`: toda ruta MONEY lee el flag SOLO vía `moneyPublicEnabled()`,
 *     nunca `process.env.MONEY_PUBLIC_ENABLED` crudo (WR-03/WR-04).
 *
 * Molde: `packages/dinero/src/servel-frozen-guard.test.ts §(5)` (vectores 1+2) +
 * `app/lib/lockdown-guard.test.ts` (walkSourceFiles / SKIP_DIRS / stripTsComments, para el
 * vector 3, NET-NEW). La lógica de detección vive en helpers PUROS
 * (`detectarRelajacionGate`, `detectarRawEnvEnRuta`) para poder ejercerlos EN MEMORIA en el
 * mutation self-check (§4) — así el guard prueba que MUERDE y no es un no-op verde (T-73-03).
 *
 * ESTE GUARD SOLO LEE Y AFIRMA. NO edita `money-gate.ts` ni `.env.example`, NO pone `=true`,
 * NO relaja el `===`. Lee `money-gate.ts` con `readFileSync` (no importa el módulo
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
const MONEY_GATE = path.join(APP_ROOT, "lib", "money-gate.ts");
const ENV_EXAMPLE = path.join(REPO_ROOT, ".env.example");

/** relPath (POSIX) del chokepoint único que SÍ puede nombrar el flag crudo. */
const MONEY_GATE_REL = "lib/money-gate.ts";

// ---------------------------------------------------------------------------
// stripTsComments (espejo verbatim de lockdown-guard.test.ts) — la PROSA de los JSDoc
// menciona `MONEY_PUBLIC_ENABLED` para EXPLICAR el chokepoint (p.ej. contraparte/[id]/page.tsx
// dice "NUNCA leer `MONEY_PUBLIC_ENABLED` crudo"); no debe disparar el vector 3.
// OJO (WR-05): NO tratar `//` como comentario cuando va precedido de `:` (URLs).
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
// walkSourceFiles + SKIP_DIRS (espejo de lockdown-guard.test.ts, extendido WR-04) — recorre
// .ts/.tsx/.mjs/.cjs/.js del árbol, saltando build/deps; EXCLUYE *.test.* (los tests que legítimamente
// inyectan `{ MONEY_PUBLIC_ENABLED: "true" }` para probar el gate — money-gate.test.ts, los RTL
// de superficie, este mismo archivo — no se escanean, por construcción del walker).
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
// `MONEY_PUBLIC_ENABLED` es el chokepoint `lib/money-gate.ts`. Los *.test.ts/*.test.tsx que
// inyectan `{ MONEY_PUBLIC_ENABLED: "true" }` (money-gate.test.ts, parlamentario-resumen.test.tsx,
// contratos/financiamiento-de-parlamentario.test.tsx, este guard) quedan fuera del walk por
// construcción de walkSourceFiles (excluye *.test.*), NO por un patrón amplio. Cada excepción
// está nominada aquí con su razón.
const RAW_ENV_ALLOWLIST: ReadonlyArray<{ rel: string; razon: string }> = [
  {
    rel: MONEY_GATE_REL,
    razon: "chokepoint único server-only (WR-02): la ÚNICA lectura de la env cruda vive aquí.",
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
  /** Contenido crudo de money-gate.ts. */
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
  if (!/MONEY_PUBLIC_ENABLED\s*===\s*["']true["']/.test(gateSrc)) {
    offenders.push(
      "V1: money-gate.ts perdió `MONEY_PUBLIC_ENABLED === \"true\"` — el gate ya no enciende " +
        "SOLO con el literal \"true\" (fail-closed roto).",
    );
  }
  // (V1b) NO usa `Boolean(... MONEY_PUBLIC_ENABLED ...)` laxo (dejaría pasar "false").
  if (/Boolean\s*\(\s*[^)]*MONEY_PUBLIC_ENABLED/.test(gateSrc)) {
    offenders.push(
      "V1: money-gate.ts usa `Boolean(...MONEY_PUBLIC_ENABLED...)` — truthiness laxa deja pasar " +
        "\"false\"/\"0\"; el gate debe ser `=== \"true\"` estricto.",
    );
  }
  // (V1c) NO usa `!== "false"` (encendería con undefined/cualquier-cosa ≠ "false").
  if (/MONEY_PUBLIC_ENABLED\s*!==\s*["']false["']/.test(gateSrc)) {
    offenders.push(
      "V1: money-gate.ts usa `MONEY_PUBLIC_ENABLED !== \"false\"` — encendería con undefined y " +
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
  //   `return env.MONEY_PUBLIC_ENABLED === "true";`.)
  const enableLine =
    gateSrc.match(/return[^;]*MONEY_PUBLIC_ENABLED[^;]*;/)?.[0] ?? "";
  if (enableLine) {
    const comparaciones = (enableLine.match(/MONEY_PUBLIC_ENABLED/g) ?? []).length;
    // Cualquier `.trim()`/`.toLowerCase()`/wrapper aplicado al flag ensancha el literal.
    const flagConWrapper =
      /MONEY_PUBLIC_ENABLED\s*\??\s*\./.test(enableLine) ||
      /MONEY_PUBLIC_ENABLED\s*\)/.test(enableLine);
    // `==` laxo (no `===`) sobre el flag: aceptaría coerciones.
    const igualdadLaxa = /MONEY_PUBLIC_ENABLED\s*(?<!!)={2}(?!=)/.test(enableLine);
    if (
      comparaciones > 1 ||
      /\|\|/.test(enableLine) ||
      /NODE_ENV/.test(enableLine) ||
      flagConWrapper ||
      igualdadLaxa
    ) {
      offenders.push(
        "V1: money-gate.ts tiene MÁS DE UN camino de encendido (|| , segunda comparación, " +
          "NODE_ENV, `==` laxo o `.trim()`/wrapper) — el gate debe encender SOLO con la " +
          "única comparación estricta `MONEY_PUBLIC_ENABLED === \"true\"`, sin ramas extra " +
          "(preview/CI/'1'). El flip es acto HUMANO (21.719), no una segunda ruta de código.",
      );
    }
  }

  // (V2a) .env.example trae `MONEY_PUBLIC_ENABLED=false` (OFF por defecto).
  if (!/^MONEY_PUBLIC_ENABLED\s*=\s*false\s*$/m.test(envSrc)) {
    offenders.push(
      "V2: .env.example ya no trae `MONEY_PUBLIC_ENABLED=false` — el default versionado debe ser OFF.",
    );
  }
  // (V2b) NUNCA `MONEY_PUBLIC_ENABLED=true` en el ejemplo committeado.
  if (/^MONEY_PUBLIC_ENABLED\s*=\s*true\s*$/m.test(envSrc)) {
    offenders.push(
      "V2: .env.example contiene `MONEY_PUBLIC_ENABLED=true` — el flip es acto HUMANO (21.719), " +
        "jamás se committea `=true`.",
    );
  }

  return offenders;
}

/**
 * Vector 3: una ruta lee la env cruda. Dado el código crudo de un archivo y su relPath (POSIX),
 * devuelve `true` si nombra `MONEY_PUBLIC_ENABLED` (tras stripTsComments) y NO es el chokepoint
 * allowlisted. El chokepoint (`lib/money-gate.ts`) es la única lectura permitida.
 */
export function detectarRawEnvEnRuta(fileSrc: string, relPath: string): boolean {
  if (estaEnAllowlist(relPath)) return false;
  const stripped = stripTsComments(fileSrc);
  return /MONEY_PUBLIC_ENABLED/.test(stripped);
}

// ---------------------------------------------------------------------------
// (1) Vector 1 — money-gate.ts fail-closed (=== "true", sin Boolean laxo).
// ---------------------------------------------------------------------------
describe("(1) Vector 1 — el gate enciende SOLO con el literal \"true\" (fail-closed)", () => {
  it("money-gate.ts conserva `MONEY_PUBLIC_ENABLED === \"true\"` y no usa truthiness laxa", () => {
    const gate = readFileSync(MONEY_GATE, "utf-8");
    expect(/MONEY_PUBLIC_ENABLED\s*===\s*["']true["']/.test(gate)).toBe(true);
    expect(/Boolean\s*\(\s*[^)]*MONEY_PUBLIC_ENABLED/.test(gate)).toBe(false);
    expect(/MONEY_PUBLIC_ENABLED\s*!==\s*["']false["']/.test(gate)).toBe(false);
  });

  it("money-gate.ts REAL: la comparación estricta es el ÚNICO camino de encendido (CR-01)", () => {
    // Corre el detector completo contra el archivo real: 0 offenders = el gate enciende
    // SOLO con `=== "true"`, sin segunda rama (||, NODE_ENV, '1', .trim(), == laxo).
    const gate = readFileSync(MONEY_GATE, "utf-8");
    const env = readFileSync(ENV_EXAMPLE, "utf-8");
    expect(detectarRelajacionGate({ gateSrc: gate, envSrc: env })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// (2) Vector 2 — .env.example=false (nunca =true committeado).
// ---------------------------------------------------------------------------
describe("(2) Vector 2 — .env.example trae MONEY_PUBLIC_ENABLED=false", () => {
  it("`.env.example` es `=false` y jamás `=true` (el flip es acto humano 21.719)", () => {
    const env = readFileSync(ENV_EXAMPLE, "utf-8");
    expect(/^MONEY_PUBLIC_ENABLED\s*=\s*false\s*$/m.test(env)).toBe(true);
    expect(/^MONEY_PUBLIC_ENABLED\s*=\s*true\s*$/m.test(env)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// (3) Vector 3 — ninguna ruta lee la env cruda (walk de app/, chokepoint allowlisted).
// ---------------------------------------------------------------------------
describe("(3) Vector 3 — MONEY_PUBLIC_ENABLED crudo SOLO en el chokepoint money-gate.ts", () => {
  const sourceFiles = walkSourceFiles(APP_ROOT);
  // WR-03: además de app/, escanear packages/ (el monorepo tiene packages/dinero). El
  // ÚNICO chokepoint allowlisted vive en app/lib/money-gate.ts; NINGÚN archivo fuente de
  // packages/ puede nombrar el flag crudo. Si una fase futura mueve un render/lector de
  // MONEY a un package, este walk lo caza en vez de dejar un punto ciego por diseño.
  const packageFiles = walkSourceFiles(PACKAGES_ROOT);

  it("sanity: el walker encontró archivos fuente (no es un escaneo vacío)", () => {
    expect(sourceFiles.length).toBeGreaterThan(10);
  });

  it("ningún archivo fuente (≠ lib/money-gate.ts) nombra MONEY_PUBLIC_ENABLED tras strip de comentarios", () => {
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
      "Ruta(s) que leen MONEY_PUBLIC_ENABLED crudo (bypassean el chokepoint server-only): " +
        `[${offenders.join("; ")}]. Toda ruta MONEY debe leer el flag vía moneyPublicEnabled(), ` +
        "nunca process.env.MONEY_PUBLIC_ENABLED. El único archivo que puede nombrarlo es lib/money-gate.ts.",
    ).toHaveLength(0);
  });

  it("WR-03: sanity — el walker de packages/ encontró archivos (no es un escaneo vacío)", () => {
    // packages/dinero existe hoy; si el escaneo diera 0 el punto ciego volvería silencioso.
    expect(packageFiles.length).toBeGreaterThan(0);
  });

  it("WR-03: ningún archivo fuente de packages/ nombra MONEY_PUBLIC_ENABLED crudo", () => {
    const offenders: string[] = [];
    for (const file of packageFiles) {
      // rel POSIX relativo al repo (p.ej. packages/dinero/src/x.ts) — packages/ NO tiene
      // chokepoint allowlisted, así que CUALQUIER mención cruda tras strip es offender.
      const rel = path.relative(REPO_ROOT, file).split(path.sep).join("/");
      const src = readFileSync(file, "utf-8");
      if (detectarRawEnvEnRuta(src, rel)) {
        offenders.push(rel);
      }
    }
    expect(
      offenders,
      "Archivo(s) de packages/ que nombran MONEY_PUBLIC_ENABLED crudo: " +
        `[${offenders.join("; ")}]. El flag vive SOLO en app/lib/money-gate.ts; una ruta ` +
        "MONEY en un package debe leerlo vía moneyPublicEnabled(), nunca la env cruda.",
    ).toHaveLength(0);
  });

  it("el chokepoint lib/money-gate.ts SÍ está allowlisted (razón nominada)", () => {
    expect(estaEnAllowlist(MONEY_GATE_REL)).toBe(true);
    // El walker por sí solo NO excluye money-gate.ts (no es un test) — la allowlist es lo que lo permite.
    const gate = readFileSync(MONEY_GATE, "utf-8");
    expect(/MONEY_PUBLIC_ENABLED/.test(stripTsComments(gate))).toBe(true); // el chokepoint SÍ lo nombra
    expect(detectarRawEnvEnRuta(gate, MONEY_GATE_REL)).toBe(false); // …y por eso NO es offender
  });
});

// ---------------------------------------------------------------------------
// (4) Mutation self-check — los detectores SÍ MUERDEN ante cada relajación (fixtures EN MEMORIA,
//     sin tocar los archivos reales del repo). Prueba que el guard no es un no-op verde (T-73-03).
// ---------------------------------------------------------------------------
describe("(4) Mutation self-check — el guard MUERDE ante cada relajación", () => {
  const GATE_VALIDO = 'return env.MONEY_PUBLIC_ENABLED === "true";';
  const ENV_VALIDO = "MONEY_PUBLIC_ENABLED=false\n";

  it("base válida → 0 offenders (el guard no es un falso-positivo permanente)", () => {
    expect(detectarRelajacionGate({ gateSrc: GATE_VALIDO, envSrc: ENV_VALIDO })).toEqual([]);
  });

  // Self-check A — gate relajado.
  it("A MUERDE: gate mutado a `Boolean(env.MONEY_PUBLIC_ENABLED)` (truthiness laxa)", () => {
    const offenders = detectarRelajacionGate({
      gateSrc: "return Boolean(env.MONEY_PUBLIC_ENABLED);",
      envSrc: ENV_VALIDO,
    });
    expect(offenders.length).toBeGreaterThan(0);
    expect(offenders.some((o) => o.startsWith("V1"))).toBe(true);
  });

  it("A MUERDE: gate mutado a `!== \"false\"` (encendería con undefined)", () => {
    const offenders = detectarRelajacionGate({
      gateSrc: 'return env.MONEY_PUBLIC_ENABLED !== "false";',
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
        'return env.MONEY_PUBLIC_ENABLED === "true" || env.MONEY_PUBLIC_ENABLED === "1";',
      envSrc: ENV_VALIDO,
    });
    expect(offenders.some((o) => o.startsWith("V1"))).toBe(true);
  });

  it("A' MUERDE (CR-01): gate con `|| env.NODE_ENV === \"preview\"` (rama de entorno)", () => {
    const offenders = detectarRelajacionGate({
      gateSrc:
        'return env.MONEY_PUBLIC_ENABLED === "true" || env.NODE_ENV === "preview";',
      envSrc: ENV_VALIDO,
    });
    expect(offenders.some((o) => o.startsWith("V1"))).toBe(true);
  });

  it("A' MUERDE (CR-01): gate con `.trim() === \"true\"` (wrapper que ensancha el literal)", () => {
    const offenders = detectarRelajacionGate({
      gateSrc: 'return env.MONEY_PUBLIC_ENABLED.trim() === "true";',
      envSrc: ENV_VALIDO,
    });
    expect(offenders.some((o) => o.startsWith("V1"))).toBe(true);
  });

  it("A' MUERDE (CR-01): gate con `== \"true\"` laxo (coerción, no `===`)", () => {
    const offenders = detectarRelajacionGate({
      // `== "true"` NO contiene `=== "true"` → V1a también dispara; V1d refuerza.
      gateSrc: 'return env.MONEY_PUBLIC_ENABLED == "true";',
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
  it("B MUERDE: `.env.example` mutado a `MONEY_PUBLIC_ENABLED=true`", () => {
    const offenders = detectarRelajacionGate({
      gateSrc: GATE_VALIDO,
      envSrc: "MONEY_PUBLIC_ENABLED=true\n",
    });
    expect(offenders.some((o) => o.startsWith("V2"))).toBe(true);
  });

  // Self-check C — raw env en ruta.
  it("C MUERDE: raw env `process.env.MONEY_PUBLIC_ENABLED` en una ruta (no-chokepoint)", () => {
    const fixture = 'if (process.env.MONEY_PUBLIC_ENABLED === "true") { render(); }';
    expect(detectarRawEnvEnRuta(fixture, "app/contraparte/[id]/page.tsx")).toBe(true);
  });

  it("C NO reporta: el mismo raw env dentro del chokepoint lib/money-gate.ts (allowlisted)", () => {
    const fixture = 'return env.MONEY_PUBLIC_ENABLED === "true";';
    expect(detectarRawEnvEnRuta(fixture, MONEY_GATE_REL)).toBe(false);
  });

  it("C NO reporta: una mención de MONEY_PUBLIC_ENABLED SOLO en un comentario (stripTsComments)", () => {
    const soloComentario =
      "// chokepoint WR-02: NUNCA leer MONEY_PUBLIC_ENABLED crudo\nexport const x = 1;";
    expect(detectarRawEnvEnRuta(soloComentario, "app/contraparte/[id]/page.tsx")).toBe(false);
  });
});
