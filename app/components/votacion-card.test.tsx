import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { VotacionCard } from "./votacion-card";
import { conteoVotacion } from "@/lib/format";
import type { VotacionRow } from "@/lib/types";

afterEach(cleanup);

// ── Fixture ─────────────────────────────────────────────────────────────────
function makeVotacion(overrides: Partial<VotacionRow> = {}): VotacionRow {
  return {
    id: "camara:1",
    boletin: "18296-05",
    fecha: "2026-05-14T00:00:00Z",
    etapa: "Tercer trámite",
    tipo: "general",
    quorum: "Simple",
    resultado: "Aprobado",
    total_si: 80,
    total_no: 40,
    total_abstencion: 2,
    total_pareo: 0,
    camara: "diputados",
    origen: "camara",
    fecha_captura: "2026-06-18T00:00:00Z",
    enlace: "https://opendata.camara.cl/votacion/1",
    ...overrides,
  };
}

// ── Task 1: VotacionCard — desenlace factual (espejo del proyecto, SC6) ────────
describe("VotacionCard — desenlace factual (Phase 22, §3.3/§9)", () => {
  it("resultado='Rechazado' total 58/81 → frase de desenlace factual con conteo mono", () => {
    render(
      <VotacionCard
        votacion={makeVotacion({
          resultado: "Rechazado",
          total_si: 58,
          total_no: 81,
        })}
      />,
    );
    // Enmarca el desenlace como hecho de la votación (sin adjetivo de juicio).
    expect(screen.getByText(/El proyecto fue Rechazado/)).toBeInTheDocument();
    // El conteo usa el helper conteoVotacion (en-dash), en Mono.
    expect(screen.getByText(conteoVotacion(58, 81))).toBeInTheDocument();
    expect(screen.getByText("58–81")).toHaveClass("font-mono");
  });

  it("resultado null → muestra 'Desenlace no informado por la fuente.' y conserva la barra y los totales", () => {
    render(
      <VotacionCard
        votacion={makeVotacion({
          resultado: null,
          total_si: 30,
          total_no: 12,
        })}
      />,
    );
    // B14: la ausencia de desenlace es un HECHO honesto explícito (no un silencio).
    expect(
      screen.getByText("Desenlace no informado por la fuente."),
    ).toBeInTheDocument();
    // La frase con conteo de un desenlace real NO aparece (no hay resultado).
    expect(screen.queryByText(/El proyecto fue/)).not.toBeInTheDocument();
    // Los totales y la barra se conservan intactos.
    expect(screen.getByText(/Sí: 30 · No: 12/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Resultado de votación/i)).toBeInTheDocument();
  });

  it("abstención/quórum/etapa se muestran cuando existen", () => {
    render(
      <VotacionCard
        votacion={makeVotacion({
          quorum: "4/7",
          etapa: "Primer trámite",
          total_abstencion: 3,
        })}
      />,
    );
    expect(screen.getByText(/Quórum: 4\/7/)).toBeInTheDocument();
    expect(screen.getByText(/Etapa: Primer trámite/)).toBeInTheDocument();
    expect(screen.getByText(/Abst\.: 3/)).toBeInTheDocument();
  });

  it("quórum/etapa null → no se fabrican (cero invención)", () => {
    render(
      <VotacionCard
        votacion={makeVotacion({ quorum: null, etapa: null })}
      />,
    );
    expect(screen.queryByText(/Quórum:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Etapa:/)).not.toBeInTheDocument();
  });

  it("deep-links humanos (quick 260722-eia): enlace wspublico → fuente oficial reruta a ficha humana (nunca WS XML)", () => {
    render(
      <VotacionCard
        votacion={makeVotacion({
          origen: "senado",
          boletin: "16456-35",
          enlace: "https://tramitacion.senado.cl/wspublico/tramitacion.php",
        })}
      />,
    );
    const fuente = screen.getByRole("link", {
      name: /Fuente oficial.*abre en nueva pestaña/i,
    });
    const href = fuente.getAttribute("href") ?? "";
    expect(href).not.toContain("/wspublico/");
    expect(href).toContain("boletin_ini=16456-35");
    expect(href).toContain("appsenado");
  });

  it("deep-links humanos: enlace no-wspublico (opendata Cámara) se respeta verbatim", () => {
    render(
      <VotacionCard
        votacion={makeVotacion({
          enlace: "https://opendata.camara.cl/votacion/1",
        })}
      />,
    );
    const fuente = screen.getByRole("link", {
      name: /Fuente oficial.*abre en nueva pestaña/i,
    });
    expect(fuente).toHaveAttribute(
      "href",
      "https://opendata.camara.cl/votacion/1",
    );
  });

  it("GATE §6: el render no contiene banned-vocab ni juicio sobre la votación", () => {
    const { container } = render(
      <VotacionCard
        votacion={makeVotacion({
          resultado: "Rechazado",
          total_si: 58,
          total_no: 81,
        })}
      />,
    );
    const texto = container.textContent ?? "";
    const PROHIBIDO =
      /porque|a cambio de|afinidad|puntaje|score|conflicto de inter|enriquecimiento|sospechos|incoherent|pol[eé]mic|traici|rebeld|favoreciendo a/i;
    expect(texto).not.toMatch(PROHIBIDO);
  });
});
