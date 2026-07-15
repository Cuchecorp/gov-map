/**
 * D1 — Test de contraste WCAG 1.4.11 para la barra cívica dark (Phase 84).
 *
 * Congela los valores actuales de --camara / --senado en modo dark y asegura
 * que ambos cumplan ≥ 3:1 sobre --card dark (WCAG 1.4.11 non-text contrast).
 *
 * El test parsea civic-tokens.css y globals.css como texto (sin DOM/browser)
 * para NO hardcodear los valores — si los tokens cambian, el test se actualiza
 * automáticamente. Si alguien baja la luminosidad de un par dark por debajo
 * del umbral, CI falla antes de que llegue a producción.
 *
 * Cálculo ejecutado durante research (Phase 84):
 *   Cámara dark  (213 90% 62%) vs card dark (222 24% 12%) → 5.63:1  ✅
 *   Senado dark  (355 70% 62%) vs card dark (222 24% 12%) → 4.80:1  ✅
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// vitest corre desde el directorio app/ (vitest.config.ts vive ahí).
const APP_ROOT = process.cwd();

// ---------------------------------------------------------------------------
// WCAG matemática pura (sin dependencias externas)
// ---------------------------------------------------------------------------

/**
 * Convierte un triplete HSL (H 0-360, S 0-100, L 0-100) a sRGB lineal [0,1].
 * Fórmula estándar CSS Color Level 4.
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  return [r + m, g + m, b + m];
}

/**
 * Aplica la gamma de linearización sRGB definida por WCAG 2.x.
 */
function linearize(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

/**
 * Luminancia relativa WCAG (0 = negro absoluto, 1 = blanco absoluto).
 */
function relativeLuminance(h: number, s: number, l: number): number {
  const [r, g, b] = hslToRgb(h, s, l);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * Ratio de contraste WCAG (resultado siempre ≥ 1; el mayor siempre en el
 * numerador).
 */
function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// Parser de CSS: extrae tripletes HSL de tokens dentro de .dark { … }
// ---------------------------------------------------------------------------

/**
 * Extrae el valor `H S% L%` del primer `hsl(H S% L%)` que aparece en la
 * definición de un token dado, DENTRO del bloque `.dark { … }` del CSS.
 *
 * Retorna [H, S, L] como números. Lanza si no encuentra el token.
 */
function parseDarkHsl(css: string, tokenName: string): [number, number, number] {
  // Aislar el contenido del bloque .dark { … }
  const darkMatch = css.match(/\.dark\s*\{([\s\S]+?)\}/);
  if (!darkMatch) throw new Error("Bloque .dark no encontrado en el CSS");
  const darkBlock = darkMatch[1];

  // Buscar la línea con el token (p.ej. --camara: hsl(213 90% 62%);)
  const tokenRegex = new RegExp(
    `${tokenName}\\s*:\\s*hsl\\(\\s*(\\d+(?:\\.\\d+)?)\\s+(\\d+(?:\\.\\d+)?)%\\s+(\\d+(?:\\.\\d+)?)%\\s*\\)`
  );
  const match = darkBlock.match(tokenRegex);
  if (!match) {
    throw new Error(`Token ${tokenName} no encontrado en bloque .dark`);
  }
  return [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])];
}

/**
 * Extrae el valor de --card en `.dark` de globals.css.
 * En globals.css, --card se define como `H S% L%` (sin wrapper hsl()),
 * ya que la variable se usa como `hsl(var(--card))`.
 */
function parseDarkCardHsl(globalsContent: string): [number, number, number] {
  const darkMatch = globalsContent.match(/\.dark\s*\{([\s\S]+?)\}/);
  if (!darkMatch) throw new Error("Bloque .dark no encontrado en globals.css");
  const darkBlock = darkMatch[1];

  // --card: 222 24% 12%;  (sin hsl())
  const match = darkBlock.match(
    /--card\s*:\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/
  );
  if (!match) throw new Error("--card no encontrado como triplete en globals.css .dark");
  return [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("D1 — Contraste barra cívica dark ≥ 3:1 (WCAG 1.4.11)", () => {
  const civicCss = readFileSync(
    path.join(APP_ROOT, "app/styles/civic-tokens.css"),
    "utf-8"
  );
  const globalsCss = readFileSync(
    path.join(APP_ROOT, "app/globals.css"),
    "utf-8"
  );

  const [cardH, cardS, cardL] = parseDarkCardHsl(globalsCss);
  const cardLum = relativeLuminance(cardH, cardS, cardL);

  it("--camara dark cumple ≥ 3:1 sobre --card dark (WCAG 1.4.11)", () => {
    const [h, s, l] = parseDarkHsl(civicCss, "--camara");
    const ratio = contrastRatio(relativeLuminance(h, s, l), cardLum);
    expect(
      ratio,
      `--camara dark (hsl(${h} ${s}% ${l}%)) vs --card dark: ratio ${ratio.toFixed(2)}:1 < 3:1 (WCAG 1.4.11). ` +
        `Subir la L del par dark de --camara para recuperar el contraste.`
    ).toBeGreaterThanOrEqual(3);
  });

  it("--senado dark cumple ≥ 3:1 sobre --card dark (WCAG 1.4.11)", () => {
    const [h, s, l] = parseDarkHsl(civicCss, "--senado");
    const ratio = contrastRatio(relativeLuminance(h, s, l), cardLum);
    expect(
      ratio,
      `--senado dark (hsl(${h} ${s}% ${l}%)) vs --card dark: ratio ${ratio.toFixed(2)}:1 < 3:1 (WCAG 1.4.11). ` +
        `Subir la L del par dark de --senado para recuperar el contraste.`
    ).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Mutation self-check — las funciones WCAG muerden
// ---------------------------------------------------------------------------

describe("Mutation self-check — funciones WCAG muerden bajo umbral", () => {
  it("blanco (100% L) vs negro (0% L) → 21:1 (caso extremo conocido)", () => {
    const white = relativeLuminance(0, 0, 100);
    const black = relativeLuminance(0, 0, 0);
    const ratio = contrastRatio(white, black);
    // Esperamos ≈ 21 (el valor exacto WCAG para blanco/negro)
    expect(ratio).toBeGreaterThan(20);
    expect(ratio).toBeLessThan(22);
  });

  it("color oscuro (L=10%) vs fondo oscuro (L=12%) → ratio bajo < 3 (fixture fallido)", () => {
    // Este fixture representa un hipotético token demasiado oscuro que NO cumple
    const tokenDemasiado = relativeLuminance(213, 90, 10); // muy oscuro
    const card = relativeLuminance(222, 24, 12);
    const ratio = contrastRatio(tokenDemasiado, card);
    // Debe ser < 3 → así confirmamos que el test FALLARÍA con valores malos
    expect(ratio).toBeLessThan(3);
  });

  it("parseDarkHsl extrae correctamente el triplete de --camara (sanity check)", () => {
    const fakeCss = `.dark {\n  --camara: hsl(213 90% 62%);\n  --senado: hsl(355 70% 62%);\n}`;
    const [h, s, l] = parseDarkHsl(fakeCss, "--camara");
    expect(h).toBe(213);
    expect(s).toBe(90);
    expect(l).toBe(62);
  });
});
