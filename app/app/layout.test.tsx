/**
 * SC8 — Test ESTRUCTURAL source-scan del footer global de `app/layout.tsx`.
 *
 * Lee el TEXTO FUENTE del layout (no el DOM: es un Server Component). Strip de
 * comentarios para no contar prosa (mismo idiom que `page-estructura.test.ts` y
 * `lockdown-guard.test.ts`). Rutas por `process.cwd()` + `path.join`, NUNCA
 * `import.meta.url` (no resuelve a file:// en este vitest sobre OneDrive; lección 45-01).
 *
 * Protege los invariantes del footer:
 *   1. (footer)     existe un <footer> DESPUÉS de {children}.
 *   2. (links)      el footer enlaza a /metodologia y a /sobre.
 *   3. (cc-by)      contiene la cadena "CC BY 4.0".
 *   4. (scope)      NO reafirma ChileCompra/SERVEL en el global (T-51-18 scope-caveat).
 *   5. (gate)       el gate PUBLIC_INDEXABLE sigue presente (T-51-19, noindex intacto).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// vitest corre desde app/ (vitest.config.ts vive ahí).
const APP_ROOT = process.cwd(); // app/
const LAYOUT_TSX = path.join(APP_ROOT, "app", "layout.tsx");

/**
 * Elimina comentarios TS/JS y JSX (`/* … *\/`, `// …`, `{/* … *\/}`) para no contar
 * prosa. WR-05: un `//` precedido de `:` NO es comentario (URL en string literal,
 * `"https://…"`) — cortarlo truncaría la línea y ocultaría código posterior al scan.
 */
function stripComments(content: string): string {
  let stripped = content.replace(/\/\*[\s\S]*?\*\//g, ""); // bloque (cubre {/* … */})
  stripped = stripped
    .split("\n")
    .map((line) => {
      const idx = line.search(/(?<!:)\/\//);
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join("\n");
  return stripped;
}

const LAYOUT_SRC = stripComments(readFileSync(LAYOUT_TSX, "utf8"));

describe("layout — footer global (SC8)", () => {
  // ── Test 1: <footer> tras {children} ──────────────────────────────────────────
  it("Test 1 (footer): renderiza un <footer> DESPUÉS de {children}", () => {
    const childrenIdx = LAYOUT_SRC.indexOf("{children}");
    const footerIdx = LAYOUT_SRC.indexOf("<footer");

    expect(childrenIdx).toBeGreaterThanOrEqual(0);
    expect(footerIdx).toBeGreaterThanOrEqual(0);
    expect(footerIdx).toBeGreaterThan(childrenIdx);
    expect(LAYOUT_SRC).toContain("</footer>");
  });

  // ── Test 2: links resolubles a /metodologia y /sobre ──────────────────────────
  it("Test 2 (links): el footer enlaza a /metodologia y a /sobre", () => {
    expect(LAYOUT_SRC).toContain('href="/metodologia"');
    expect(LAYOUT_SRC).toContain('href="/sobre"');
  });

  // ── Test 3: licencia CC BY 4.0 visible ────────────────────────────────────────
  it("Test 3 (cc-by): el footer contiene la cadena 'CC BY 4.0'", () => {
    expect(LAYOUT_SRC).toContain("CC BY 4.0");
  });

  // ── Test 4: scope-caveat — no reafirma ChileCompra/SERVEL en el global ─────────
  it("Test 4 (scope): el global NO nombra ChileCompra ni SERVEL (T-51-18)", () => {
    expect(LAYOUT_SRC).not.toMatch(/ChileCompra/i);
    expect(LAYOUT_SRC).not.toMatch(/SERVEL/i);
  });

  // ── Test 5: gate noindex intacto ──────────────────────────────────────────────
  it("Test 5 (gate): PUBLIC_INDEXABLE sigue presente (T-51-19, gate no removido)", () => {
    expect(LAYOUT_SRC).toContain("PUBLIC_INDEXABLE");
    expect(LAYOUT_SRC).toContain("generateMetadata");
  });
});
