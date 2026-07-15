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
    camara: "diputados",
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

// ── inicioSemanaIso — lunes 00:00 America/Santiago (WR-01) ──────────────────────
// Chile invierno (junio/julio) = CLT = UTC-4 → midnight Santiago = 04:00 UTC.
describe("inicioSemanaIso", () => {
  it("jueves en Santiago → devuelve el lunes de esa semana como midnight CLST", () => {
    // 2026-07-02T15:30:00Z = jueves 11:30 CLST (UTC-4).
    // Lunes de esa semana en Santiago = 2026-06-29.
    // Midnight Santiago (UTC-4) = 2026-06-29T04:00:00Z.
    const lunes = inicioSemanaIso(new Date("2026-07-02T15:30:00Z"));
    expect(lunes.toISOString()).toBe("2026-06-29T04:00:00.000Z");
  });

  it("domingo en Santiago → devuelve el lunes ANTERIOR (semana ISO correcta)", () => {
    // 2026-07-05T10:00:00Z = domingo 06:00 CLST (UTC-4).
    // Lunes de esa semana ISO en Santiago = 2026-06-29.
    const lunes = inicioSemanaIso(new Date("2026-07-05T10:00:00Z"));
    expect(lunes.toISOString()).toBe("2026-06-29T04:00:00.000Z");
  });

  it("lunes en Santiago → la semana empieza ese mismo lunes", () => {
    // 2026-07-06T15:00:00Z = lunes 11:00 CLST (UTC-4).
    // Lunes de esa semana = 2026-07-06 → midnight CLST = 2026-07-06T04:00:00Z.
    const lunes = inicioSemanaIso(new Date("2026-07-06T15:00:00Z"));
    expect(lunes.toISOString()).toBe("2026-07-06T04:00:00.000Z");
  });

  it("el resultado es efectivamente medianoche en America/Santiago", () => {
    const lunes = inicioSemanaIso(new Date("2026-07-02T15:30:00Z"));
    const horaEnSantiago = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Santiago",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(lunes);
    expect(horaEnSantiago).toBe("00:00:00");
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
    // Enlace de fuente oficial.
    const link = screen.getByRole("link", { name: /Ver fuente oficial/ });
    expect(link).toHaveAttribute("href", "https://camara.cl/votacion/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("resultado null → OMITE 'El proyecto fue …' pero conserva la fecha en meta", () => {
    const { container } = render(<VotadoEstaSemanaView items={[makeVotado({ resultado: null, camara: null })]} />);
    expect(screen.queryByText(/El proyecto fue/)).not.toBeInTheDocument();
    // Con camara null, el meta es "Votación del {fecha}"
    expect(container.textContent).toMatch(/Votación del/);
  });

  // WR-03: tally 0–0 nunca se muestra cuando totales son cero (fabricación anti-honesta)
  it("totalSi=0, totalNo=0 con resultado → omite tally, NO muestra '0–0'", () => {
    const { container } = render(
      <VotadoEstaSemanaView
        items={[makeVotado({ totalSi: 0, totalNo: 0, resultado: "aprobado" })]}
      />,
    );
    // El desenlace se muestra
    expect(screen.getByText(/El proyecto fue aprobado/)).toBeInTheDocument();
    // Pero el tally 0–0 no aparece en ningún span.font-mono
    const monoText = Array.from(container.querySelectorAll("span.font-mono")).map(
      (m) => m.textContent,
    );
    expect(monoText).not.toContain("0–0");
    // Y la cadena "0–0" no aparece en ningún lugar del DOM
    expect(container.textContent).not.toMatch(/0[–-]0/);
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

  // ── Barra cámara ──────────────────────────────────────────────────────────
  it("camara='diputados' → barra bg-[var(--camara)] aria-hidden + meta '· Cámara'", () => {
    const { container } = render(
      <VotadoEstaSemanaView items={[makeVotado({ camara: "diputados" })]} />,
    );
    const barra = container.querySelector('[class*="var(--camara)"]');
    expect(barra).not.toBeNull();
    expect(barra).toHaveAttribute("aria-hidden", "true");
    // Meta should include "· Cámara"
    expect(container.textContent).toMatch(/·\s*Cámara/);
  });

  it("camara='senado' → barra bg-[var(--senado)] aria-hidden + meta '· Senado'", () => {
    const { container } = render(
      <VotadoEstaSemanaView items={[makeVotado({ camara: "senado" })]} />,
    );
    const barra = container.querySelector('[class*="var(--senado)"]');
    expect(barra).not.toBeNull();
    expect(barra).toHaveAttribute("aria-hidden", "true");
    expect(container.textContent).toMatch(/·\s*Senado/);
  });

  it("camara=null → NO existe marcador de barra y meta es 'Votación del {fecha}' sin suffix", () => {
    const { container } = render(
      <VotadoEstaSemanaView items={[makeVotado({ camara: null })]} />,
    );
    expect(container.querySelector('[class*="var(--camara)"]')).toBeNull();
    expect(container.querySelector('[class*="var(--senado)"]')).toBeNull();
    expect(container.textContent).toMatch(/Votación del/);
    expect(container.textContent).not.toMatch(/·\s*Cámara/);
    expect(container.textContent).not.toMatch(/·\s*Senado/);
  });
});

// ── BLOQUE 2 — "Urgencias vigentes" ─────────────────────────────────────────────
describe("UrgenciasVigentesView", () => {
  it("con datos: chip pill con tipo verbatim + bg-accent-product-soft + font-mono text-[11px]", () => {
    const { container } = render(
      <UrgenciasVigentesView items={[makeUrgencia()]} />,
    );
    expect(
      screen.getByRole("heading", { name: "Urgencias vigentes" }),
    ).toBeInTheDocument();
    // Chip with tipo verbatim
    const chip = container.querySelector(".bg-accent-product-soft");
    expect(chip).not.toBeNull();
    expect(chip).toHaveClass("font-mono");
    expect(chip).toHaveClass("text-[11px]");
    expect(chip?.textContent).toBe("Suma");
    // "desde {fecha}" en font-mono — fecha formateada por fechaCorta (es-CL, America/Santiago).
    // El fixture es 2026-07-01T00:00:00Z = 30 jun en CLST (UTC-4) → "30 jun".
    // Pero si el runtime corre en UTC-3 (horario de verano) sería "1 jul".
    // Anclamos al texto que debe contener la abreviatura del mes en español.
    const monos = Array.from(container.querySelectorAll(".font-mono")).map(
      (m) => m.textContent,
    );
    const desdeText = monos.find((t) => t?.startsWith("desde "));
    expect(desdeText).toBeDefined();
    // El formato es "desde D mes" — debe contener al menos el día y algún texto de mes
    expect(desdeText).toMatch(/desde \d{1,2} [a-záéíóúñ]{3}/i);
    // link
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
  it("con datos: label + dot petróleo + fuente + fecha mono por item", () => {
    const { container } = render(
      <UltimaActualizacionView
        items={[
          makeFrescura({ fuente: "Votaciones" }),
          makeFrescura({ fuente: "Proyectos de ley" }),
        ]}
      />,
    );
    expect(screen.getByText("Última actualización de datos")).toBeInTheDocument();
    // fuente labels present
    expect(screen.getByText("Votaciones")).toBeInTheDocument();
    expect(screen.getByText("Proyectos de ley")).toBeInTheDocument();
    // 2 font-mono date spans
    expect(container.querySelectorAll("span.font-mono").length).toBe(2);
  });

  it("0 datos → strip no renderiza contenido (null — OMITIR)", () => {
    const { container } = render(<UltimaActualizacionView items={[]} />);
    // When 0 items, the component returns null → container is empty
    expect(container.textContent).toBe("");
  });
});

// ── Empty-states independientes (2 strings DISTINTOS — frescura ahora omite) ────
describe("empty-states honestos independientes", () => {
  it("los 2 empties de votado y urgencias son strings distintos", () => {
    const e1 = "Sin votaciones registradas esta semana en las fuentes consultadas.";
    const e2 = "No hay urgencias vigentes registradas esta semana.";
    expect(e1).not.toBe(e2);

    const { container: c1 } = render(<VotadoEstaSemanaView items={[]} />);
    expect(c1.textContent).toContain(e1);
    cleanup();
    const { container: c2 } = render(<UrgenciasVigentesView items={[]} />);
    expect(c2.textContent).toContain(e2);
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
