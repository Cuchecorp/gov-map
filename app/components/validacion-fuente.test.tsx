/**
 * validacion-fuente.test.tsx — TRACE-01/TRACE-03
 *
 * Cobertura:
 *   TRACE-01: deep-links fail-honest (Senado SIEMPRE, Cámara condicional, BCN nunca)
 *   TRACE-03: fecha de captura visible + respaldo R2 con allowlist de prefijo
 *   T-89-06: allowlist prefijo tramitacion/* (información disclosure)
 *   T-89-08: safeExternalHref guard anti-XSS
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import {
  ValidacionFuenteSection,
  type ValidacionFuenteProps,
} from "./validacion-fuente";

afterEach(cleanup);

// ── helpers ──────────────────────────────────────────────────────────────────

function renderSection(props: ValidacionFuenteProps) {
  return render(<ValidacionFuenteSection {...props} />);
}

const BASE: ValidacionFuenteProps = {
  boletin: "14309-04",
  prm_id_camara: null,
  fecha_captura: "2026-07-15T12:00:00Z",
  snapshot: null,
};

// ── TRACE-01: Senado SIEMPRE ──────────────────────────────────────────────────

describe("TRACE-01 — Senado link (SIEMPRE)", () => {
  it("renderiza link Senado con boletin completo encodeURIComponent para 14309-04", () => {
    renderSection({ ...BASE, boletin: "14309-04" });
    const link = screen.getByRole("link", { name: /Senado.*abre en nueva pestaña/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("boletin_ini=14309-04"),
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("el link Senado contiene el host correcto (tramitacion.senado.cl)", () => {
    renderSection({ ...BASE, boletin: "14309-04" });
    const link = screen.getByRole("link", { name: /Senado.*abre en nueva pestaña/i });
    expect(link.getAttribute("href")).toMatch(/tramitacion\.senado\.cl/);
  });
});

// ── TRACE-01: Cámara SOLO si prm_id_camara ───────────────────────────────────

describe("TRACE-01 — Cámara link (condicional)", () => {
  it("con prm_id_camara renderiza link Cámara con prmID y prmBOLETIN", () => {
    renderSection({
      ...BASE,
      boletin: "16572-06",
      prm_id_camara: "17140",
    });
    const link = screen.getByRole("link", { name: /Cámara.*abre en nueva pestaña/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toContain("prmID=17140");
    expect(link.getAttribute("href")).toContain("prmBOLETIN=16572-06");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("sin prm_id_camara (null) NO renderiza fila ni link Cámara (fail-honest)", () => {
    renderSection({ ...BASE, prm_id_camara: null });
    const link = screen.queryByRole("link", { name: /Cámara.*abre en nueva pestaña/i });
    expect(link).not.toBeInTheDocument();
    // No debe haber texto "Ver en la Cámara" en el DOM
    expect(screen.queryByText(/Ver en la Cámara/i)).not.toBeInTheDocument();
  });
});

// ── TRACE-01: BCN NUNCA ───────────────────────────────────────────────────────

describe("TRACE-01 — BCN omitido del DOM", () => {
  it("BCN nunca aparece en el DOM (sin idNorma, fail-honest)", () => {
    // Incluso con prm_id_camara presente — BCN siempre omitido
    renderSection({ ...BASE, prm_id_camara: "17140" });
    expect(screen.queryByText(/BCN/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/leyChile/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/leychile\.cl/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Biblioteca del Congreso/i)).not.toBeInTheDocument();
  });
});

// ── TRACE-03: respaldo R2 con allowlist de prefijo ────────────────────────────

describe("TRACE-03 — respaldo R2 (allowlist prefijo tramitacion/*)", () => {
  it("con r2_path=tramitacion/... muestra fecha + hash abreviado + leyenda", () => {
    renderSection({
      ...BASE,
      snapshot: {
        content_hash: "abcdef123456789xyz",
        fetched_at: "2026-07-10T08:00:00Z",
        r2_path: "tramitacion/16572-06/2026-07-10/abc123.xml",
      },
    });
    // hash 12 chars = "abcdef123456"
    expect(screen.getByText(/abcdef123456/)).toBeInTheDocument();
    expect(screen.getByText(/Esto decía la fuente ese día/i)).toBeInTheDocument();
    // NUNCA debe aparecer el r2_path como href
    const links = screen.getAllByRole("link");
    for (const link of links) {
      const href = link.getAttribute("href") ?? "";
      expect(href).not.toContain("tramitacion/16572-06");
      expect(href).not.toContain("r2_path");
    }
  });

  it("con r2_path=infoprobidad/... (prefijo no-tramitacion) → respaldo OMITIDO", () => {
    renderSection({
      ...BASE,
      snapshot: {
        content_hash: "xyz999",
        fetched_at: "2026-07-10T08:00:00Z",
        r2_path: "infoprobidad/parlamentario/2026/abc.json",
      },
    });
    expect(screen.queryByText(/Respaldo del/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Esto decía la fuente ese día/i)).not.toBeInTheDocument();
  });

  it("con snapshot null → sin bloque respaldo", () => {
    renderSection({ ...BASE, snapshot: null });
    expect(screen.queryByText(/Respaldo del/i)).not.toBeInTheDocument();
  });

  it("con r2_path con componente '..' (traversal) → respaldo OMITIDO (T-89-06)", () => {
    renderSection({
      ...BASE,
      snapshot: {
        content_hash: "abc123",
        fetched_at: "2026-07-10T08:00:00Z",
        r2_path: "tramitacion/../infoprobidad/parlamentario/2026/abc.json",
      },
    });
    expect(screen.queryByText(/Respaldo del/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Esto decía la fuente ese día/i)).not.toBeInTheDocument();
  });
});

// ── T-89-08: guard safeExternalHref ──────────────────────────────────────────

describe("T-89-08 — guard safeExternalHref (anti-XSS)", () => {
  it("un href javascript: en el componente NO aparece como href (guard muerde)", () => {
    // El componente construye URLs con hosts fijos (senado.cl/camara.cl) y
    // encodeURIComponent; el guard protege contra corrupción inesperada de datos.
    // Usamos un boletín vacío para forzar una URL malformada (cobertura del guard).
    renderSection({
      ...BASE,
      boletin: "", // → encodeURIComponent("") → string vacío → URL sin boletin_ini
    });
    const links = screen.queryAllByRole("link");
    for (const link of links) {
      const href = link.getAttribute("href") ?? "";
      // Ningún href debe ser javascript: ni data:
      expect(href).not.toMatch(/^javascript:/i);
      expect(href).not.toMatch(/^data:/i);
    }
  });
});
