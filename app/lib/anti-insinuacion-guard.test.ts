/**
 * ANTI-INSINUACION-GUARD (VOTO-04) — Linter anti-vocabulario-insinuante.
 *
 * Espejo EXACTO de `app/lib/lockdown-guard.test.ts`: un guard-como-test de vitest
 * que ESCANEA archivos de fuente (no runtime) y FALLA si el texto renderizado de
 * cualquier superficie de voto contiene un término de insinuación. No es un CLI
 * `node`/`tsx` separado (no hay CI que lo corra); es un `*.test.ts` que la suite
 * recoge → corre en `pnpm test` (root → `pnpm --filter ./app test`) y en el gate
 * GSD verify-work, en el MISMO lugar que el lockdown-guard.
 *
 * Regla rector (CONTEXT §decisions, LOCKED): un voto es un HECHO OBSERVABLE. Está
 * PROHIBIDO en el copy ciudadano el vocabulario de juicio/comparación de bancada:
 * "rebeldía"/"disciplina"/"alineamiento"/"vota como"/"similar a"/"mediana de su
 * cámara"/score/ranking/etc. Una insinuación en el render es difamación/
 * editorialización — el riesgo #1 del proyecto.
 *
 * DOS piezas críticas heredadas del molde:
 *
 * (1) `stripTsComments` — quita `/* *\/` y `// …` ANTES de aplicar los regex.
 *     Sin esto el guard tendría ~15 falsos positivos: hay usos LEGÍTIMOS de los
 *     términos prohibidos en comentarios/JSDoc (p.ej. `voto-ficha-row.tsx` doc
 *     "el nombre interno 'rebeldías' JAMÁS aparece aquí"; `page.tsx` un comentario
 *     que LISTA los términos prohibidos "influencia/conexiones/afinidad/score").
 *     REUSAR verbatim (incluye el skip de `://` en URLs).
 *
 * (2) `LEYENDA_NEGACIONES` — la leyenda anti-insinuación LOCKED es un STRING
 *     RENDERIZADO que contiene la palabra "disciplina" en un contexto que la
 *     NIEGA ("No medimos disciplina ni motivo."). Es el patrón LOCKED de los
 *     tests de componente (`votos-por-parlamentario.test.tsx`: "la leyenda NIEGA
 *     'disciplina' → se resta antes del negative-match"). Se resta del contenido
 *     ANTES de matchear para no cazar la propia leyenda que enfuerza la regla.
 *
 * MUTATION SELF-CHECK (Test 2): el guard prueba, contra un fixture EN MEMORIA (no
 * un archivo del repo), que SÍ fallaría ante un término inyectado — para que el
 * guard NO sea un no-op verde vacío (T-68-02: tampering del guard mismo).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Helpers (espejo verbatim de lockdown-guard.test.ts)
// ---------------------------------------------------------------------------

// vitest corre desde el directorio app/ (vitest.config.ts vive ahí).
const APP_ROOT = process.cwd(); // app/

/**
 * Eliminar comentarios de TypeScript/JavaScript:
 *  - bloques `/** … *\/` y `/* … *\/`
 *  - líneas `// …`
 * Esto evita que prosa en JSDoc/comentarios dispare los regex de términos.
 *
 * OJO (heredado del molde, WR-05): NO tratar `//` como comentario cuando va
 * precedido de `:` — cortar en el `//` de una URL (`"https://x.cl"`) truncaría la
 * línea y crearía un FALSO NEGATIVO. Heurística barata que cubre `http://`/`https://`.
 */
function stripTsComments(content: string): string {
  // Remove block comments (including JSDoc /** … */ and /* … */)
  let stripped = content.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove line comments (// …) — skipping `://` (URLs inside string literals)
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
// Alcance: las superficies de voto ciudadanas (UI-SPEC §Linter).
// ---------------------------------------------------------------------------

/**
 * Rutas EXPLÍCITAS a escanear (relativas a app/). Lista dura — el linter cubre
 * exactamente el carril de voto ciudadano + la fuente de verdad de labels + la
 * sección VOTE de la ficha. Si una ruta no existe (p.ej. `ausencias-contexto.tsx`
 * borrado por la poda 68-03), se SALTA sin fallar (su ausencia es correcta).
 */
const SUPERFICIES_VOTO: string[] = [
  "components/votos-por-parlamentario.tsx",
  "components/votos-chart.tsx",
  "components/voto-detalle.tsx",
  "components/voto-row.tsx",
  "components/voto-ficha-row.tsx",
  "lib/voto-presentacion.ts",
  "app/parlamentario/[id]/page.tsx",
];

/**
 * Términos prohibidos (lista dura VERBATIM de 68-UI-SPEC §Linter). Se buscan en el
 * texto RENDERIZADO (post-strip de comentarios), con límite de palabra en español
 * para no cazar identificadores snake_case: `rebeldias_de_parlamentario` (nombre de
 * RPC, sin tilde, con `_`) NO dispara; `rebeldía`/`rebeldías` en prosa SÍ.
 *
 * Los acentos importan: los términos con tilde se buscan CON la tilde (`rebeldía`,
 * `índice`, `díscolo`, `traición`, `cercanía`).
 */
const TERMINOS_PROHIBIDOS: string[] = [
  "rebeldía",
  "rebeldías",
  "rebelde",
  "disciplina",
  "indisciplina",
  "alineamiento",
  "alineado",
  "alineada",
  "afinidad",
  "cercanía política",
  "lealtad",
  "traición",
  "díscolo",
  "score",
  "puntaje",
  "índice",
  "ranking",
  "nivel de acuerdo",
  "vota como",
  "votan como",
  "similar a",
  "mediana de su cámara",
  "financió su voto",
  "a cambio de",
];

/**
 * Fragmentos LOCKED que contienen un término prohibido en un contexto que lo NIEGA
 * (la propia leyenda anti-insinuación). Se restan del contenido ANTES de matchear —
 * patrón idéntico a los tests de componente ("la leyenda NIEGA 'disciplina' → se
 * resta antes del negative-match"). Verbatim de 68-UI-SPEC §Leyenda / §Copywriting.
 */
const NEGACIONES_LOCKED: string[] = [
  "Un voto es un hecho observable. Ausente o pareo no equivalen a votar en contra. No medimos disciplina ni motivo.",
];

/**
 * Construye el regex de un término con límite de palabra tolerante a acentos.
 * `\b` de JS no maneja bien caracteres acentuados (los trata como no-palabra), así
 * que usamos lookarounds sobre la clase de "carácter de palabra en español"
 * (letras ASCII + acentuadas + dígitos + `_`). Con esto:
 *  - `rebeldía` en " la rebeldía de …" → MATCH.
 *  - `rebeldias_de_parlamentario` → NO match (`s` seguido de `_`, que es palabra).
 *  - `score` en "un score de" → MATCH; `scoreboard` → NO match.
 * Los términos multi-palabra (con espacio) usan `\s+` entre tokens.
 */
const WORD = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_";

function buildTermRegex(term: string): RegExp {
  const tokens = term.trim().split(/\s+/).map(escapeRegex);
  const body = tokens.join("\\s+");
  // (?<![WORD]) antes y (?![WORD]) después = límite de palabra tolerante a acentos.
  return new RegExp(`(?<![${WORD}])${body}(?![${WORD}])`, "i");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Detector puro y testeable: dado el CONTENIDO CRUDO de un archivo (o fixture),
 * devuelve los términos prohibidos que aparecen en el texto RENDERIZADO. Aplica
 * `stripTsComments` y resta las negaciones LOCKED antes de matchear.
 *
 * Es la pieza que el mutation self-check (Test 2) ejercita contra un string inyectado.
 */
function detectarInsinuaciones(rawContent: string): string[] {
  let texto = stripTsComments(rawContent);
  for (const neg of NEGACIONES_LOCKED) {
    // Restar cada aparición literal de la negación LOCKED.
    texto = texto.split(neg).join(" ");
  }
  const hits: string[] = [];
  for (const term of TERMINOS_PROHIBIDOS) {
    if (buildTermRegex(term).test(texto)) hits.push(term);
  }
  return hits;
}

// ---------------------------------------------------------------------------
// (1) Guard — CERO términos de insinuación en el render de las superficies de voto
// ---------------------------------------------------------------------------

describe("(1) Guard — ninguna superficie de voto insinúa (texto renderizado)", () => {
  it("sanity: al menos escanea votos-por-parlamentario.tsx (existe y es legible)", () => {
    const principal = path.join(
      APP_ROOT,
      "components",
      "votos-por-parlamentario.tsx",
    );
    expect(readFileSync(principal, "utf-8").length).toBeGreaterThan(100);
  });

  it("ningún término prohibido aparece en el texto renderizado (post-strip de comentarios)", () => {
    const offenders: string[] = [];
    for (const rel of SUPERFICIES_VOTO) {
      const full = path.join(APP_ROOT, rel);
      let raw: string;
      try {
        raw = readFileSync(full, "utf-8");
      } catch {
        // Ausencia legítima (p.ej. ausencias-contexto.tsx borrado por la poda 68-03).
        continue;
      }
      for (const term of detectarInsinuaciones(raw)) {
        offenders.push(`${rel} → "${term}"`);
      }
    }
    expect(
      offenders,
      `Vocabulario de insinuación en el render de superficies de voto ` +
        `(un voto es un HECHO DESCRIPTIVO, no un juicio): [${offenders.join("; ")}]. ` +
        `Elimina el término del copy renderizado; si es un comentario/doc, envuélvelo ` +
        `en // o /* */ (el guard strippea comentarios); si es la leyenda LOCKED que ` +
        `NIEGA el término, añádela a NEGACIONES_LOCKED verbatim.`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// (2) Mutation self-check — el guard NO es un no-op: FALLA ante un término inyectado
// ---------------------------------------------------------------------------

describe("(2) Mutation self-check — el guard SÍ muerde", () => {
  it("detecta un término inyectado en un fixture EN MEMORIA (no un archivo del repo)", () => {
    // Un string que simula JSX renderizado con una insinuación PROHIBIDA.
    const fixtureMutado = `
      export function Malo() {
        return <p>Este parlamentario vota por rebeldía contra su bancada.</p>;
      }
    `;
    const hits = detectarInsinuaciones(fixtureMutado);
    expect(
      hits,
      "El detector NO cazó 'rebeldía' inyectado en render → el guard sería un no-op",
    ).toContain("rebeldía");
  });

  it("detecta varios términos inyectados (score, disciplina, mediana de su cámara)", () => {
    const fixture = `
      <span>score de disciplina: 7 — falta más que la mediana de su cámara</span>
    `;
    const hits = detectarInsinuaciones(fixture);
    expect(hits).toEqual(
      expect.arrayContaining([
        "score",
        "disciplina",
        "mediana de su cámara",
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// (3) No-falsos-positivos — comentarios, identificadores y la leyenda LOCKED
// ---------------------------------------------------------------------------

describe("(3) Sin falsos positivos — strip de comentarios, límites de palabra, negación LOCKED", () => {
  it("un término dentro de un comentario `//` o `/* */` NO cuenta como offender", () => {
    const conComentarios = `
      // esto documenta la regla: prohibido el término disciplina y rebeldía
      /* el nombre interno "rebeldías" JAMÁS se renderiza; score/ranking tampoco */
      export const X = <p>Cómo votó</p>;
    `;
    expect(detectarInsinuaciones(conComentarios)).toEqual([]);
  });

  it("el identificador snake_case `rebeldias_de_parlamentario` en `.rpc()` NO dispara", () => {
    // Sin tilde y con `_` a ambos lados del token → no es palabra renderizada.
    const conRpc = `const r = sb.rpc("rebeldias_de_parlamentario", { id });`;
    expect(detectarInsinuaciones(conRpc)).toEqual([]);
  });

  it("la leyenda anti-insinuación LOCKED (que NIEGA 'disciplina') NO es offender", () => {
    const conLeyenda = `
      const LEYENDA =
        "Un voto es un hecho observable. Ausente o pareo no equivalen a votar en contra. No medimos disciplina ni motivo.";
      export const V = <p>{LEYENDA}</p>;
    `;
    expect(detectarInsinuaciones(conLeyenda)).toEqual([]);
  });

  it("edge: `://` en una URL de string literal no rompe el strip (heredado del molde)", () => {
    const conUrl = `const src = "https://www.camara.cl/votacion"; // fuente oficial`;
    // No hay término prohibido; lo que se verifica es que el strip no truncó el string.
    expect(detectarInsinuaciones(conUrl)).toEqual([]);
    expect(stripTsComments(conUrl)).toContain("https://www.camara.cl/votacion");
  });

  it("`similar a` (contexto de voto) se caza pero `similares` NO (límite de palabra)", () => {
    expect(detectarInsinuaciones(`<p>vota similar a su bancada</p>`)).toContain(
      "similar a",
    );
    expect(detectarInsinuaciones(`<p>proyectos similares</p>`)).toEqual([]);
  });
});
