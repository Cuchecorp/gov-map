/**
 * LEG-01/LEG-03 — Test ESTRUCTURAL source-scan de la ficha /parlamentario/[id].
 *
 * Protege los invariantes LOCKED del re-layout (Phase 45) leyendo el TEXTO FUENTE
 * de `page.tsx` (no el DOM: la página es un Server Component async, igual que el
 * estilo de `lib/lockdown-guard.test.ts`). Strip de comentarios para no contar
 * prosa (mismo helper que el guard). Falla si una regresión:
 *
 *   1. (mt-12)      quita el `mt-12` de un carril o lo mueve fuera de su <section>.
 *   2. (1×dominio)  agrupa dos dominios en un acordeón / desbalancea section↔acordeón.
 *   3. (gates)      elimina un gate cruces/money que envuelve una <section> entera.
 *   4. (resumen)    quita el resumen above-fold o lo pone tras el primer carril.
 *   5. (no-leak)    hace que `carril-accordion.tsx` importe una sección o Supabase.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// vitest corre desde app/ (vitest.config.ts vive ahí). Resolvemos por process.cwd()
// + path.join — NO import.meta.url (no resuelve a file:// en este vitest sobre
// OneDrive; lección 45-01).
const APP_ROOT = process.cwd(); // app/
const PAGE_TSX = path.join(
  APP_ROOT,
  "app",
  "parlamentario",
  "[id]",
  "page.tsx",
);
const CARRIL_ACCORDION_TSX = path.join(
  APP_ROOT,
  "components",
  "carril-accordion.tsx",
);

/** Elimina comentarios TS/JS (bloque `/* … *\/` y línea `// …`) para no contar prosa. */
function stripTsComments(content: string): string {
  let stripped = content.replace(/\/\*[\s\S]*?\*\//g, "");
  stripped = stripped
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("//");
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join("\n");
  return stripped;
}

const PAGE_SRC = stripTsComments(readFileSync(PAGE_TSX, "utf8"));
const ACCORDION_SRC = stripTsComments(
  readFileSync(CARRIL_ACCORDION_TSX, "utf8"),
);

// Carriles de dominio LOCKED (orden). Cada uno = su propia <section mt-12>.
const CARRIL_IDS = [
  "votos",
  "lobby",
  "patrimonio",
  "cruces",
  "dinero",
  "financiamiento",
  "financiamiento-pendiente",
] as const;

/** Todas las aperturas `<section id="…" className="…">` del fuente. */
function matchSections(src: string): { id: string; className: string }[] {
  const re = /<section\s+id="([^"]+)"\s+className="([^"]+)"\s*>/g;
  const out: { id: string; className: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out.push({ id: m[1], className: m[2] });
  }
  return out;
}

describe("page-estructura — invariantes LOCKED del re-layout (LEG-01/LEG-03)", () => {
  // ── Test 1: frontera mt-12 por carril ─────────────────────────────────────────
  it("Test 1 (mt-12): cada carril de dominio está en una <section> con mt-12", () => {
    const sections = matchSections(PAGE_SRC);
    const sectionIds = sections.map((s) => s.id);

    // Los 7 carriles LOCKED están presentes como <section>.
    for (const id of CARRIL_IDS) {
      expect(sectionIds).toContain(id);
    }

    // CADA <section> de carril lleva el mt-12 en SU className (no en un wrapper).
    for (const s of sections) {
      expect(
        s.className.split(/\s+/),
        `la <section id="${s.id}"> debe conservar mt-12`,
      ).toContain("mt-12");
    }

    // El número de fronteras mt-12 cubre al menos los carriles renderizados.
    const mt12Count = (PAGE_SRC.match(/\bmt-12\b/g) || []).length;
    expect(mt12Count).toBeGreaterThanOrEqual(CARRIL_IDS.length);
  });

  // ── Test 2: un acordeón por dominio (jamás dos dominios en una unidad) ─────────
  it("Test 2 (1×dominio): un CarrilAccordion por <section>; ningún Accordion.Root agrupa dominios", () => {
    const sections = matchSections(PAGE_SRC);
    const accordionUses = (PAGE_SRC.match(/<CarrilAccordion[\s>]/g) || [])
      .length;

    // section ↔ acordeón 1:1 (cada carril su propio acordeón, nunca dos dominios juntos).
    expect(accordionUses).toBe(sections.length);
    expect(accordionUses).toBe(CARRIL_IDS.length);

    // La página NO instancia un Accordion.Root crudo (que podría agrupar varios
    // items/dominios): SOLO usa el wrapper CarrilAccordion (1 item interno).
    expect(PAGE_SRC).not.toMatch(/Accordion\.Root/);
    expect(PAGE_SRC).not.toMatch(/AccordionPrimitive/);
  });

  // ── Test 3: gates cruces/money intactos (envuelven la <section> entera) ────────
  it("Test 3 (gates): crucesPublicEnabled y moneyPublicEnabled siguen envolviendo sus secciones", () => {
    expect(PAGE_SRC).toContain("crucesPublicEnabled(process.env)");
    expect(PAGE_SRC).toContain("moneyPublicEnabled(process.env)");
    // honest-state MONEY OFF presente (gate negado).
    expect(PAGE_SRC).toContain("!moneyPublicEnabled(process.env)");
  });

  // ── Test 4: resumen above-fold antes del primer carril ────────────────────────
  it("Test 4 (resumen): <ParlamentarioResumen aparece ANTES de la primera <section mt-12>", () => {
    const resumenIdx = PAGE_SRC.indexOf("<ParlamentarioResumen");
    const firstSectionIdx = PAGE_SRC.search(/<section\s+id="/);

    expect(resumenIdx).toBeGreaterThanOrEqual(0);
    expect(firstSectionIdx).toBeGreaterThanOrEqual(0);
    expect(resumenIdx).toBeLessThan(firstSectionIdx);
  });

  // ── Test 5: no-leak reforzado (carril-accordion no importa sección/Supabase) ───
  it("Test 5 (no-leak): carril-accordion.tsx no contiene Section ni @/lib/supabase", () => {
    expect(ACCORDION_SRC).not.toMatch(/Section/);
    expect(ACCORDION_SRC).not.toContain("@/lib/supabase");
    expect(ACCORDION_SRC).not.toContain("createServerSupabase");
  });

  // ── Test 6: WR-02 — conteos tras Suspense vía wrapper seguro (no eager top-level) ─
  it("Test 6 (WR-02): los conteos se leen con contarCarrilesSeguro y los carriles van tras <Suspense>", () => {
    // La lectura usa el wrapper a prueba de fallos, NUNCA el `contarCarriles` crudo
    // (que lanza #34 y tumbaría la ficha entera, cabecera incluida).
    expect(PAGE_SRC).toContain("contarCarrilesSeguro");
    // NINGUNA llamada cruda `contarCarriles(` en el shell (sólo el wrapper seguro).
    expect(PAGE_SRC).not.toMatch(/contarCarriles\(/);
    // Los carriles (CarrilesSection) viven DENTRO de un <Suspense> → streaming
    // independiente del shell; un fallo degrada sólo este subárbol.
    expect(PAGE_SRC).toMatch(/<Suspense[\s\S]*?<CarrilesSection/);
  });

  // ── Test 7: WR-01 — cada carril MONEY lee su PROPIO conteo (no el combinado) ────
  it("Test 7 (WR-01): #dinero usa dineroContratos y #financiamiento usa dineroAportes; sin combinado", () => {
    expect(PAGE_SRC).toContain("conteos.dineroContratos");
    expect(PAGE_SRC).toContain("conteos.dineroAportes");
    // El conteo combinado `conteos.dinero` ya NO existe (el \b evita casar dineroContratos/dineroAportes).
    expect(PAGE_SRC).not.toMatch(/conteos\.dinero\b/);
  });
});
