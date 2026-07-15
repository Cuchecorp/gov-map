/**
 * BENTO-06 — Candados de régimen bento (Phase 80-02).
 *
 * DOS guards en un solo archivo (cohesión temática: candados de diseño bento):
 *
 * (I)  CERO-HEX: ninguna superficie bento (incluida brand-icon.tsx tras el fix
 *      currentColor de 80-01) puede contener un literal hex hardcodeado.
 *      Protege que una futura edición meta `#2A5859` ad-hoc y degrade la
 *      disciplina D4 de token-only.
 *
 * (II) TIPOGRAFÍA ARBITRARIA WHITELISTED: los arbitrary values Tailwind del bento
 *      (text-[Npx], gap-[…], px-[…], etc.) están enumerados en una whitelist dura
 *      (off-steps intencionales del mockup). Cualquier valor no enumerado y no
 *      `[var(--…)]` es un offender.
 *
 * Patrón de idioma (molde verbatim bento-coherencia-guard.test.ts):
 *  - `const APP_ROOT = process.cwd()` (vitest corre desde app/)
 *  - detector PURO: función sobre strings en memoria (testeable sin disco)
 *  - describe (A): test VERDE sobre archivos REALES (readFileSync)
 *  - describe (B): mutation self-check EN MEMORIA (demuestra que el detector MUERDE)
 *
 * `stripTsComments` reusada VERBATIM de anti-insinuacion-guard.test.ts (WR-05):
 * sin el strip, un hex en JSDoc daría falso positivo y una URL truncaría la línea.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// vitest corre desde el directorio app/ (vitest.config.ts vive ahí).
const APP_ROOT = process.cwd(); // app/

// ---------------------------------------------------------------------------
// Helper: stripTsComments (VERBATIM de anti-insinuacion-guard.test.ts líneas 69-81)
// ---------------------------------------------------------------------------

/**
 * Eliminar comentarios de TypeScript/JavaScript:
 *  - bloques `/** … *\/` y `/* … *\/`
 *  - líneas `// …`
 * Evita falsos positivos por hex/términos en JSDoc/comentarios.
 *
 * OJO (WR-05): NO tratar `//` como comentario cuando va precedido de `:` —
 * cortar en el `//` de una URL (`"https://x.cl"`) crearía un falso negativo.
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
// Superficies bento a escanear
// ---------------------------------------------------------------------------

/**
 * Superficies del guard CERO-HEX (rutas relativas a app/).
 * Incluye brand-icon.tsx para proteger el fix currentColor de Phase 80-01.
 * Incluye page.tsx y actualidad-module.tsx (copy + layout de la home bento).
 */
const SUPERFICIES_CERO_HEX: string[] = [
  "components/bento/bento-grid.tsx",
  "components/bento/bento-tile.tsx",
  "app/page.tsx",
  "components/actualidad-module.tsx",
  "components/brand-icon.tsx",
];

/**
 * Superficies del guard TIPOGRÁFICO (subset — excluye brand-icon.tsx).
 *
 * Decisión de scope: brand-icon.tsx NO entra en el scan tipográfico porque sus
 * atributos SVG (width/height como JSX props numéricas) no son utilidades Tailwind
 * y el regex `(text|gap|…)-\[…\]` no los captura de todas formas; no genera ruido,
 * pero tampoco aporta cobertura tipográfica real (el SVG no usa arbitrary Tailwind).
 * Se mantiene SOLO en el array cero-hex donde sí aporta protección al fix 80-01.
 */
const SUPERFICIES_TIPOGRAFIA: string[] = [
  "components/bento/bento-grid.tsx",
  "components/bento/bento-tile.tsx",
  "app/page.tsx",
  "components/actualidad-module.tsx",
];

// ===========================================================================
// GUARD (I): CERO-HEX-HARDCODEADO
// ===========================================================================

// ---------------------------------------------------------------------------
// Detector puro CERO-HEX
// ---------------------------------------------------------------------------

/**
 * Detecta literales hex hardcodeados en el contenido fuente (post-strip de comentarios).
 *
 * @param contenido  Texto fuente ya pasado por stripTsComments
 * @returns Array de matches hex encontrados (vacío = sin offenders)
 */
function detectarHexHardcodeado(contenido: string): string[] {
  return contenido.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
}

// ---------------------------------------------------------------------------
// (A) Cero-hex — archivos reales bento: 0 offenders
// ---------------------------------------------------------------------------

describe("(A) cero-hex — archivos reales bento: 0 offenders", () => {
  for (const rel of SUPERFICIES_CERO_HEX) {
    it(`${rel} no contiene literales hex hardcodeados`, () => {
      const full = path.join(APP_ROOT, rel);
      const contenido = stripTsComments(readFileSync(full, "utf-8"));
      const offenders = detectarHexHardcodeado(contenido);
      expect(
        offenders,
        `Hex hardcodeado en ${rel}: [${offenders.join(", ")}]. ` +
          `Reemplazar por token CSS (bg-[var(--token)], text-accent-product, etc.). ` +
          `brand-icon.tsx debe usar currentColor o un token (fix 80-01).`,
      ).toHaveLength(0);
    });
  }
});

// ---------------------------------------------------------------------------
// (B) Mutation self-check CERO-HEX — el detector muerde
// ---------------------------------------------------------------------------

describe("(B) Mutation self-check cero-hex — el detector muerde", () => {
  it("fixture mutado con `#2A5859` → detectado como offender", () => {
    const mutado = `const c = "#2A5859"; export function X() { return <div style={{ color: c }} />; }`;
    const offenders = detectarHexHardcodeado(stripTsComments(mutado));
    expect(
      offenders,
      "El detector NO cazó #2A5859 en fixture mutado — el guard sería un no-op",
    ).toContain("#2A5859");
  });

  it("fixture con hex dentro de comentario → 0 offenders tras strip (anti-falso-positivo T-80-04)", () => {
    // El strip elimina el comentario ANTES de buscar hex → no debe cazar el hex del JSDoc.
    const conComentario = `
      // color #2A5859 (documentado, no renderizado)
      export function BrandIcon({ color = "currentColor" }: Props) {
        return <svg><path stroke={color} /></svg>;
      }
    `;
    const offenders = detectarHexHardcodeado(stripTsComments(conComentario));
    expect(
      offenders,
      "El detector cazó hex en comentario → falso positivo; verificar strip",
    ).toHaveLength(0);
  });

  it("fixture limpio (bg-card, currentColor, tokens) → 0 offenders (anti-falso-positivo)", () => {
    const limpio = `
      export function Tile({ className }: { className?: string }) {
        return <div className="bg-card border border-border rounded-[var(--radius-tile)]" />;
      }
    `;
    const offenders = detectarHexHardcodeado(stripTsComments(limpio));
    expect(
      offenders,
      "El detector reportó falsos positivos sobre un fixture limpio",
    ).toHaveLength(0);
  });

  it("fixture con `#fff` corto (3 dígitos) → detectado", () => {
    const mutado = `<div style={{ background: "#fff" }}>`;
    const offenders = detectarHexHardcodeado(stripTsComments(mutado));
    expect(offenders).toContain("#fff");
  });
});

// ===========================================================================
// GUARD (II): TIPOGRAFÍA ARBITRARIA WHITELISTED
// ===========================================================================

// ---------------------------------------------------------------------------
// Whitelist dura — off-steps intencionales del mockup (enumeración exacta)
// ---------------------------------------------------------------------------

/**
 * Arbitrary values Tailwind SANCIONADOS en las superficies bento.
 * Cada entrada tiene su razón (patrón DEBT-05 de documentación de off-steps).
 *
 * Regla:
 *  - PERMITIR siempre `[var(--…)]` (tokens CSS — no son magic numbers).
 *  - PERMITIR los valores de esta lista (off-steps intencionales del mockup).
 *  - FALLAR ante cualquier OTRO arbitrary value de las categorías escaneadas.
 *
 * Categorías escaneadas: text, gap, gap-x, gap-y, px, py, w, h, max-w, tracking, rounded.
 * Categorías NO escaneadas: grid-auto-rows y similares de layout (fuera del scope tipográfico).
 */
const WHITELIST_ARBITRARIOS: Set<string> = new Set([
  "text-[11px]",       // kicker (page.tsx:93) + chip mono (actualidad-module.tsx:309) — sub-caption/chip
  "text-[13px]",       // desenlace/ver fuente/strip ×3 (actualidad-module.tsx) — body compacto 12/14 scale
  "text-[15px]",       // título votado (actualidad-module.tsx:178) — entre text-sm y text-base
  "tracking-[0.08em]", // kicker (page.tsx:93) — letter-spacing mono off-step
  "gap-[14px]",        // grid bento (bento-grid.tsx:25) + lista votados (actualidad-module.tsx:164) — mockup gap
  "gap-x-[22px]",      // strip frescura (actualidad-module.tsx:439) — espaciado strip horizontal
  "px-[9px]",          // chip/pill (actualidad-module.tsx:309) — padding pill pill
  "py-[18px]",         // strip frescura (actualidad-module.tsx:439) — padding vertical strip
  "w-[3px]",           // barra cívica (actualidad-module.tsx:170) — ancho barra 3px off-step
  "rounded-[2px]",     // barra cívica (actualidad-module.tsx:170) — radio barra pequeña
  "h-[52px]",          // input/botón hero SearchBox (search-box.tsx:118,128) — altura input mockup
  "w-[1120px]",        // contenedor bento (page.tsx, layout.tsx) — ancho contenedor mockup
  "max-w-[1120px]",    // contenedor bento (page.tsx:87, layout.tsx) — max-width contenedor mockup
]);

// ---------------------------------------------------------------------------
// Detector puro TIPOGRAFÍA
// ---------------------------------------------------------------------------

/**
 * Detecta arbitrary values Tailwind NO sancionados en el contenido bento.
 *
 * Categorías escaneadas: text, gap, gap-x, gap-y, px, py, w, h, max-w, tracking, rounded.
 * Permite: [var(--…)] (tokens CSS) y los valores enumerados en WHITELIST_ARBITRARIOS.
 *
 * @param contenido  Texto fuente ya pasado por stripTsComments
 * @returns Array de offenders (valores no sancionados encontrados)
 */
function detectarArbitrarioNoSancionado(contenido: string): string[] {
  const regex =
    /(text|gap-x|gap-y|gap|px|py|max-w|tracking|rounded|w|h)-\[[^\]]+\]/g;
  const matches = contenido.match(regex) ?? [];
  const offenders: string[] = [];
  for (const match of matches) {
    // Permitir tokens CSS (var(--…)) — no son magic numbers
    if (match.includes("var(--")) continue;
    // Permitir off-steps sancionados del mockup
    if (WHITELIST_ARBITRARIOS.has(match)) continue;
    offenders.push(match);
  }
  return offenders;
}

// ---------------------------------------------------------------------------
// (A) Tipografía — archivos reales bento: 0 offenders no-sancionados
// ---------------------------------------------------------------------------

describe("(A) tipografía — archivos reales bento: 0 offenders no-sancionados", () => {
  for (const rel of SUPERFICIES_TIPOGRAFIA) {
    it(`${rel}: todos los arbitrary values son tokens o están en la whitelist`, () => {
      const full = path.join(APP_ROOT, rel);
      const contenido = stripTsComments(readFileSync(full, "utf-8"));
      const offenders = detectarArbitrarioNoSancionado(contenido);
      expect(
        offenders,
        `Arbitrary values NO sancionados en ${rel}: [${offenders.join(", ")}]. ` +
          `Si es un off-step intencional del mockup, añadir a WHITELIST_ARBITRARIOS ` +
          `con su razón documentada. Si es deriva accidental, usar un paso Tailwind estándar.`,
      ).toHaveLength(0);
    });
  }
});

// ---------------------------------------------------------------------------
// (B) Mutation self-check TIPOGRAFÍA — el detector muerde
// ---------------------------------------------------------------------------

describe("(B) Mutation self-check tipografía — el detector muerde", () => {
  it("fixture con `text-[17px]` (no sancionado) → offender detectado", () => {
    const mutado = `<p className="text-[17px] font-bold">Título ad-hoc</p>`;
    const offenders = detectarArbitrarioNoSancionado(stripTsComments(mutado));
    expect(
      offenders,
      "El detector NO cazó text-[17px] no sancionado → el guard sería un no-op",
    ).toContain("text-[17px]");
  });

  it("fixture con `gap-[99px]` (px no sancionado) → offender detectado", () => {
    const mutado = `<div className="grid gap-[99px]">`;
    const offenders = detectarArbitrarioNoSancionado(stripTsComments(mutado));
    expect(offenders).toContain("gap-[99px]");
  });

  it("fixture con `rounded-[var(--radius-tile)]` (token) → 0 offenders (permitido)", () => {
    const limpio = `<div className="rounded-[var(--radius-tile)] bg-card">`;
    const offenders = detectarArbitrarioNoSancionado(stripTsComments(limpio));
    expect(
      offenders,
      "El detector cazó rounded-[var(--radius-tile)] como offender → falso positivo; los tokens deben ser permitidos",
    ).toHaveLength(0);
  });

  it("fixture con `text-[13px]` (sancionado) → 0 offenders (en whitelist)", () => {
    const sancionado = `<span className="text-[13px] text-muted-foreground">Fuente</span>`;
    const offenders = detectarArbitrarioNoSancionado(
      stripTsComments(sancionado),
    );
    expect(
      offenders,
      "El detector cazó text-[13px] como offender — está en la whitelist de off-steps sancionados",
    ).toHaveLength(0);
  });

  it("fixture con `text-[12px]` (ad-hoc, no sancionado) → offender (no está en whitelist)", () => {
    // text-[12px] NO está en la lista; solo text-[11px]/[13px]/[15px] son sancionados.
    const mutado = `<span className="text-[12px]">texto ad-hoc</span>`;
    const offenders = detectarArbitrarioNoSancionado(stripTsComments(mutado));
    expect(offenders).toContain("text-[12px]");
  });

  it("fixture limpio (sin arbitrary values, solo clases estándar) → 0 offenders", () => {
    const limpio = `<div className="flex items-center gap-4 text-sm font-medium bg-card border border-border">`;
    const offenders = detectarArbitrarioNoSancionado(stripTsComments(limpio));
    expect(
      offenders,
      "El detector reportó falsos positivos sobre clases Tailwind estándar",
    ).toHaveLength(0);
  });
});
