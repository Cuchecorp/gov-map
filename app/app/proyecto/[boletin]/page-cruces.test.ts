import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Source-scan estructural del cableado del carril CRUCES (Phase 38, SURF-02) en la
 * ficha /proyecto/[boletin]. Verifica invariantes LOCKED que NO se ven en un render
 * (el gate Candado B está OFF en el env de test → la <section> no se renderiza):
 *
 *   - placement DOM: `id="cruces"` ENTRE `#lobby-tramitacion` y `#idea-matriz`;
 *   - la <section id="cruces"> y su rail entry están envueltas en crucesPublicEnabled
 *     (Candado B) — sin ancla muerta pre-encendido;
 *   - navEntries incluye la entrada `{ id:"cruces", ..., marker:"diamante" }` tras lobby;
 *   - CrucesSection se importa desde @/components/cruces-de-proyecto;
 *   - el disclosure primary NO se duplica en la page (vive DENTRO de CrucesView).
 *
 * Espejo del describe "invariantes de fuente" de page.test.tsx (source-scan, .ts).
 */

const PAGE_SRC = readFileSync(
  path.join(process.cwd(), "app", "proyecto", "[boletin]", "page.tsx"),
  "utf8",
);

describe("/proyecto/[boletin] — cableado del carril #cruces (SURF-02)", () => {
  it("la <section id=\"cruces\"> está presente con mt-12 (sin scroll-mt-6 — Phase 79-02)", () => {
    // scroll-mt-6 removido; el offset de ancla aplica desde globals.css (80px, Phase 76).
    // El offset real vs. header se valida en Phase 81 (BrowserOS deploy real; jsdom no tiene layout).
    expect(PAGE_SRC).toContain('<section id="cruces" className="mt-12"');
  });

  it("placement DOM: #cruces entre #lobby-tramitacion y #idea-matriz", () => {
    const idxLobby = PAGE_SRC.indexOf('<section id="lobby-tramitacion"');
    const idxCruces = PAGE_SRC.indexOf('<section id="cruces"');
    const idxIdea = PAGE_SRC.indexOf('<section id="idea-matriz"');
    expect(idxLobby).toBeGreaterThan(0);
    expect(idxCruces).toBeGreaterThan(idxLobby);
    expect(idxIdea).toBeGreaterThan(idxCruces);
  });

  it("la <section id=\"cruces\"> está envuelta en crucesPublicEnabled (Candado B)", () => {
    // El gate `&& (` aparece inmediatamente antes del tag <section> real (mismo
    // idiom que /parlamentario). Se busca el tag real, no la mención en el comentario.
    const idxGate = PAGE_SRC.indexOf("crucesPublicEnabled(process.env) && (");
    const idxCruces = PAGE_SRC.indexOf('<section id="cruces"');
    expect(idxGate).toBeGreaterThan(0);
    expect(idxGate).toBeLessThan(idxCruces);
  });

  it("CrucesSection se importa desde @/components/cruces-de-proyecto y se monta con el boletín", () => {
    expect(PAGE_SRC).toContain(
      'import { CrucesSection } from "@/components/cruces-de-proyecto"',
    );
    expect(PAGE_SRC).toContain("<CrucesSection boletin={boletin} />");
  });

  it("navEntries incluye la entrada cruces con marcador diamante, tras lobby y antes de idea-matriz", () => {
    expect(PAGE_SRC).toContain('{ id: "cruces", label: "Cruces", marker: "diamante" as const }');
    const idxRailLobby = PAGE_SRC.indexOf('{ id: "lobby-tramitacion", label: "Lobby del período" }');
    const idxRailCruces = PAGE_SRC.indexOf('id: "cruces", label: "Cruces"');
    const idxRailIdea = PAGE_SRC.indexOf('{ id: "idea-matriz", label: "Idea matriz" }');
    expect(idxRailLobby).toBeGreaterThan(0);
    expect(idxRailCruces).toBeGreaterThan(idxRailLobby);
    expect(idxRailIdea).toBeGreaterThan(idxRailCruces);
  });

  it("el rail entry de cruces también está gated por crucesPublicEnabled", () => {
    // El spread condicional del entry usa el mismo gate (no ancla muerta pre-apply).
    expect(PAGE_SRC).toContain("...(crucesPublicEnabled(process.env)");
  });

  it("define un CrucesSkeleton local para el fallback del Suspense", () => {
    expect(PAGE_SRC).toContain("function CrucesSkeleton()");
    expect(PAGE_SRC).toContain("<CrucesSkeleton />");
  });

  it("NO duplica el disclosure primary en la page (vive DENTRO de CrucesView)", () => {
    // El único DetalleColapsable de la page es el de Tramitación; el trigger de
    // cruces "Explorar los N cruces" NO aparece en el source de la page.
    expect(PAGE_SRC).not.toContain("Explorar los");
  });
});
