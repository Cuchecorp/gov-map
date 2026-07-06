import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import {
  VotadoEstaSemanaView,
  UrgenciasVigentesView,
  UltimaActualizacionView,
  inicioSemanaIso,
  type VotadoItem,
  type UrgenciaItem,
  type FrescuraItem,
} from "./actualidad-module";

afterEach(cleanup);

// ── Fixtures ────────────────────────────────────────────────────────────────
function makeVotado(overrides: Partial<VotadoItem> = {}): VotadoItem {
  return {
    boletin: "14309-04",
    titulo: "Sala cuna para Chile",
    resultado: "aprobado",
    totalSi: 58,
    totalNo: 81,
    fecha: new Date("2026-07-02T00:00:00Z"),
    enlace: "https://camara.cl/votacion/1",
    ...overrides,
  };
}

function makeUrgencia(overrides: Partial<UrgenciaItem> = {}): UrgenciaItem {
  return {
    boletin: "16284-07",
    titulo: "Reforma a la salud",
    tipo: "Suma",
    desde: new Date("2026-07-01T00:00:00Z"),
    ...overrides,
  };
}

function makeFrescura(overrides: Partial<FrescuraItem> = {}): FrescuraItem {
  return { fuente: "Votaciones", fecha: new Date("2026-07-05T00:00:00Z"), ...overrides };
}

// ── inicioSemanaIso — lunes 00:00 de la semana vigente ──────────────────────────
describe("inicioSemanaIso", () => {
  it("un jueves → devuelve el lunes 00:00 de esa semana", () => {
    // 2026-07-02 es jueves.
    const lunes = inicioSemanaIso(new Date("2026-07-02T15:30:00"));
    expect(lunes.getDay()).toBe(1); // lunes
    expect(lunes.getHours()).toBe(0);
    expect(lunes.getMinutes()).toBe(0);
  });

  it("un domingo → devuelve el lunes anterior (no el siguiente)", () => {
    // 2026-07-05 es domingo → el lunes de su semana ISO es 2026-06-29.
    const lunes = inicioSemanaIso(new Date("2026-07-05T10:00:00"));
    expect(lunes.getDay()).toBe(1);
    expect(lunes.getDate()).toBe(29);
  });
});

// ── BLOQUE 1 — "Votado esta semana" ─────────────────────────────────────────────
describe("VotadoEstaSemanaView", () => {
  it("con datos: título + desenlace factual + tally Mono en-dash + fecha Mono + fuente", () => {
    const { container } = render(
      <VotadoEstaSemanaView items={[makeVotado()]} />,
    );
    expect(
      screen.getByRole("heading", { name: "Votado esta semana" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sala cuna para Chile")).toBeInTheDocument();
    // Desenlace factual con tally en Mono (en-dash U+2013 vía conteoVotacion).
    expect(screen.getByText(/El proyecto fue aprobado/)).toBeInTheDocument();
    const monos = container.querySelectorAll("span.font-mono");
    const monoText = Array.from(monos).map((m) => m.textContent);
    expect(monoText).toContain("58–81");
    expect(screen.getByText(/Votación del/)).toBeInTheDocument();
    // Enlace de fuente oficial.
    const link = screen.getByRole("link", { name: /Ver fuente oficial/ });
    expect(link).toHaveAttribute("href", "https://camara.cl/votacion/1");
  });

  it("resultado null → OMITE 'El proyecto fue …' pero conserva 'Votación del {fecha}'", () => {
    render(<VotadoEstaSemanaView items={[makeVotado({ resultado: null })]} />);
    expect(screen.queryByText(/El proyecto fue/)).not.toBeInTheDocument();
    expect(screen.getByText(/Votación del/)).toBeInTheDocument();
  });

  it("título null → muestra el boletín (nunca fabrica un título)", () => {
    const { container } = render(
      <VotadoEstaSemanaView
        items={[makeVotado({ titulo: null })]}
      />,
    );
    const monos = Array.from(container.querySelectorAll("span.font-mono")).map(
      (m) => m.textContent,
    );
    expect(monos).toContain("14309-04");
  });

  it("0 datos → su empty-state honesto propio", () => {
    render(<VotadoEstaSemanaView items={[]} />);
    expect(
      screen.getByText(
        "Sin votaciones registradas esta semana en las fuentes consultadas.",
      ),
    ).toBeInTheDocument();
  });
});

// ── BLOQUE 2 — "Urgencias vigentes" ─────────────────────────────────────────────
describe("UrgenciasVigentesView", () => {
  it("con datos: título + urgencia {tipo} + fecha Mono + boletín Mono + link ficha", () => {
    const { container } = render(
      <UrgenciasVigentesView items={[makeUrgencia()]} />,
    );
    expect(
      screen.getByRole("heading", { name: "Urgencias vigentes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Reforma a la salud — urgencia Suma vigente desde el/),
    ).toBeInTheDocument();
    const monos = Array.from(container.querySelectorAll(".font-mono")).map(
      (m) => m.textContent,
    );
    expect(monos).toContain("16284-07");
    const link = screen.getByRole("link", { name: /Ver proyecto/ });
    expect(link).toHaveAttribute("href", "/proyecto/16284-07");
  });

  it("0 datos → su empty-state honesto propio", () => {
    render(<UrgenciasVigentesView items={[]} />);
    expect(
      screen.getByText("No hay urgencias vigentes registradas esta semana."),
    ).toBeInTheDocument();
  });
});

// ── BLOQUE 3 — "Última actualización de datos" ──────────────────────────────────
describe("UltimaActualizacionView", () => {
  it("con datos: una línea por fuente '{fuente}: actualizada el {fecha}.' (fecha Mono)", () => {
    const { container } = render(
      <UltimaActualizacionView
        items={[
          makeFrescura({ fuente: "Votaciones" }),
          makeFrescura({ fuente: "Proyectos de ley" }),
        ]}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Última actualización de datos" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Votaciones: actualizada el/)).toBeInTheDocument();
    expect(
      screen.getByText(/Proyectos de ley: actualizada el/),
    ).toBeInTheDocument();
    expect(container.querySelectorAll("span.font-mono").length).toBe(2);
  });

  it("0 datos → su empty-state honesto propio", () => {
    render(<UltimaActualizacionView items={[]} />);
    expect(
      screen.getByText("Aún no hay registros de actualización disponibles."),
    ).toBeInTheDocument();
  });
});

// ── Empty-states independientes (3 strings DISTINTOS) ───────────────────────────
describe("empty-states honestos independientes", () => {
  it("los 3 empties son strings distintos entre sí", () => {
    const e1 = "Sin votaciones registradas esta semana en las fuentes consultadas.";
    const e2 = "No hay urgencias vigentes registradas esta semana.";
    const e3 = "Aún no hay registros de actualización disponibles.";
    expect(new Set([e1, e2, e3]).size).toBe(3);

    const { container: c1 } = render(<VotadoEstaSemanaView items={[]} />);
    expect(c1.textContent).toContain(e1);
    cleanup();
    const { container: c2 } = render(<UrgenciasVigentesView items={[]} />);
    expect(c2.textContent).toContain(e2);
    cleanup();
    const { container: c3 } = render(<UltimaActualizacionView items={[]} />);
    expect(c3.textContent).toContain(e3);
  });
});

// ── Anti-insinuación — negative-match banned-vocab (T-52-13) ─────────────────────
describe("GATE §9.1 — sin ranking / score / juicio / causa", () => {
  it("el copy del módulo (los 3 bloques poblados) no contiene lenguaje prohibido", () => {
    const { container } = render(
      <>
        <VotadoEstaSemanaView items={[makeVotado()]} />
        <UrgenciasVigentesView items={[makeUrgencia()]} />
        <UltimaActualizacionView items={[makeFrescura()]} />
      </>,
    );
    const texto = container.textContent ?? "";
    const PROHIBIDO =
      /porque|a cambio de|influy[oó]|gestion[oó]|presion[oó]|afinidad|puntaje|score|ranking|los m[aá]s|los peores|qui[eé]n gan[oó]|conflicto de inter|sospechos|% de/i;
    expect(texto).not.toMatch(PROHIBIDO);
  });
});

// ── Source-scan estructural (invariantes que RTL no puede ejercer en RSC) ────────
describe("actualidad-module — invariantes de fuente", () => {
  const APP_ROOT = process.cwd(); // app/
  const MOD_TSX = path.join(APP_ROOT, "components", "actualidad-module.tsx");
  const SRC = readFileSync(MOD_TSX, "utf8");

  it("NO es 'use client' (RSC)", () => {
    expect(SRC).not.toMatch(/^\s*["']use client["']/m);
  });

  it("cada bloque LANZA ante error real de lectura (#34), no fabrica bloque vacío", () => {
    // Un throw por cada Server Component + los helpers de lectura.
    const throws = SRC.match(/throw new Error/g) ?? [];
    expect(throws.length).toBeGreaterThanOrEqual(4);
  });

  it("Bloque 2 REUSA urgenciaVigente (import), no re-implementa la lógica", () => {
    expect(SRC).toMatch(
      /import\s*\{[^}]*urgenciaVigente[^}]*\}\s*from\s*["']@\/components\/estado-actual-block["']/,
    );
    // No re-declara la función localmente.
    expect(SRC).not.toMatch(/function\s+urgenciaVigente/);
  });

  it("Bloque 3 lee fecha_captura SOLO de tablas NO-PII (cero .from PII)", () => {
    const PII = /\.from\(\s*["'](aporte|contrato|declaracion|declaracion_familiar|declaracion_accion_derecho|donante|cruce_senal|parlamentario)["']/;
    expect(SRC).not.toMatch(PII);
    // Las fuentes de frescura declaradas son todas no-PII.
    expect(SRC).toMatch(/tabla:\s*["']votacion["']/);
    expect(SRC).toMatch(/tabla:\s*["']proyecto_ficha["']/);
  });
});
