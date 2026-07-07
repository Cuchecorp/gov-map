/**
 * LEG-01/LEG-03 + UXCOG 55-03 — Test ESTRUCTURAL source-scan de la ficha
 * /parlamentario/[id].
 *
 * Protege los invariantes LOCKED del re-layout leyendo el TEXTO FUENTE de
 * `page.tsx` (no el DOM: la página es un Server Component async, igual que el
 * estilo de `lib/lockdown-guard.test.ts`). Strip de comentarios para no contar
 * prosa (mismo helper que el guard). Falla si una regresión:
 *
 *   1. (mt-12)      quita el `mt-12`/`scroll-mt-6` de un carril o lo mueve fuera de su <section>.
 *   2. (disclosure) vuelve al CarrilAccordion F45 / agrupa dominios en un Accordion.Root.
 *   3. (gates)      elimina un gate cruces/money que envuelve una <section> entera.
 *   4. (rail+capa-1) quita el rail (FichaRail/construirChips) o mete una capa-1 dentro del disclosure.
 *   5. (no-leak)    hace que `detalle-colapsable.tsx` importe una sección o Supabase.
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
const DETALLE_COLAPSABLE_TSX = path.join(
  APP_ROOT,
  "components",
  "detalle-colapsable.tsx",
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
const DETALLE_SRC = stripTsComments(
  readFileSync(DETALLE_COLAPSABLE_TSX, "utf8"),
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

    // CADA <section> de carril lleva mt-12 (frontera) + scroll-mt-6 (ancla del
    // rail) en SU className (no en un wrapper).
    for (const s of sections) {
      const clases = s.className.split(/\s+/);
      expect(
        clases,
        `la <section id="${s.id}"> debe conservar mt-12`,
      ).toContain("mt-12");
      expect(
        clases,
        `la <section id="${s.id}"> debe llevar scroll-mt-6 (salto del rail)`,
      ).toContain("scroll-mt-6");
    }

    // El número de fronteras mt-12 cubre al menos los carriles renderizados.
    const mt12Count = (PAGE_SRC.match(/\bmt-12\b/g) || []).length;
    expect(mt12Count).toBeGreaterThanOrEqual(CARRIL_IDS.length);
  });

  // ── Test 2: disclosure inverso (DetalleColapsable, ya no CarrilAccordion) ──────
  it("Test 2 (disclosure): el detalle usa DetalleColapsable; la página ya NO usa CarrilAccordion", () => {
    // UXCOG 55-03 invierte el disclosure: el detalle (*Section) se envuelve en
    // DetalleColapsable (default cerrado) y la capa-1 vive FUERA. Al menos un
    // DetalleColapsable se instancia (los carriles con datos).
    expect(PAGE_SRC).toMatch(/<DetalleColapsable[\s>]/);
    // El patrón F45 (CarrilAccordion, capa-1 dentro del cuerpo) quedó superado.
    expect(PAGE_SRC).not.toMatch(/<CarrilAccordion[\s>]/);
    // La página NO instancia un Accordion.Root crudo (que agruparía dominios).
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

  // ── Test 4: rail (FichaRail/construirChips) + capa-1 fuera del disclosure ──────
  it("Test 4 (rail+capa-1): FichaRail arma el índice y las capa-1 se montan FUERA del DetalleColapsable", () => {
    // El rail reemplaza el resumen above-fold: FichaRail alimentado por construirChips
    // (orden gate-aware) — el índice vive UNA vez en el rail.
    expect(PAGE_SRC).toContain("<FichaRail");
    expect(PAGE_SRC).toContain("construirChips");
    // Las 4 capa-1 (55-02) se montan como resumen preatentivo por carril.
    for (const capa1 of [
      "<VotosCapa1",
      "<LobbyCapa1",
      "<PatrimonioCapa1",
      "<CrucesCapa1",
    ]) {
      expect(PAGE_SRC).toContain(capa1);
    }
    // La primera capa-1 aparece ANTES del primer DetalleColapsable → capa-1 vive
    // FUERA del disclosure (solo el detalle colapsa).
    const idxCapa1 = PAGE_SRC.indexOf("<VotosCapa1");
    const idxDetalle = PAGE_SRC.indexOf("<DetalleColapsable");
    expect(idxCapa1).toBeGreaterThanOrEqual(0);
    expect(idxDetalle).toBeGreaterThan(idxCapa1);
  });

  // ── Test 5: no-leak reforzado (detalle-colapsable no importa sección/Supabase) ─
  it("Test 5 (no-leak): detalle-colapsable.tsx no contiene Section ni @/lib/supabase", () => {
    expect(DETALLE_SRC).not.toMatch(/Section/);
    expect(DETALLE_SRC).not.toContain("@/lib/supabase");
    expect(DETALLE_SRC).not.toContain("createServerSupabase");
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
