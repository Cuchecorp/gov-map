import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

import {
  ResumenView,
  construirChips,
  type ResumenChip,
} from "./parlamentario-resumen";
import type {
  CarrilEstado,
  ConteoCarriles,
} from "@/lib/parlamentario-resumen-conteos";

afterEach(cleanup);

/**
 * Tests de la VISTA PURA `ResumenView` (nunca el async `ParlamentarioResumen`),
 * con fixtures — espejo de `lobby-de-parlamentario.test.tsx` que testea `LobbyView`
 * sin runtime Supabase. Cubren: un chip ancla por carril, los 3 estados honestos +
 * pendiente render distinto, money-off honest-state sin número, y negative-density.
 */

// ── Fixtures ───────────────────────────────────────────────────────────────────
const CARRILES_BASE: ResumenChip[] = [
  { href: "#votos", label: "Votaciones", estado: { tipo: "dato", n: 9 } },
  { href: "#lobby", label: "Reuniones de lobby", estado: { tipo: "dato", n: 6 } },
  {
    href: "#patrimonio",
    label: "Declaraciones de patrimonio",
    estado: { tipo: "vacio" },
  },
  {
    href: "#cruces",
    label: "Cruces con sectores",
    estado: { tipo: "no_ingerido" },
  },
  {
    href: "#financiamiento-pendiente",
    label: "Financiamiento y contratos",
    estado: { tipo: "pendiente" },
  },
];

function makeChips(overrides: Partial<ResumenChip>[] = []): ResumenChip[] {
  if (overrides.length === 0) return CARRILES_BASE.map((c) => ({ ...c }));
  return CARRILES_BASE.map((c, i) => ({ ...c, ...(overrides[i] ?? {}) }));
}

// ── Un chip ancla por carril presente ───────────────────────────────────────────
describe("ResumenView — chips ancla por carril (LEG-02)", () => {
  it("renderiza un enlace por carril presente con su href de salto", () => {
    render(<ResumenView chips={makeChips()} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(5);
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toEqual([
      "#votos",
      "#lobby",
      "#patrimonio",
      "#cruces",
      "#financiamiento-pendiente",
    ]);
  });

  it("cada chip muestra la etiqueta del carril", () => {
    render(<ResumenView chips={makeChips()} />);
    expect(screen.getByText("Votaciones")).toBeInTheDocument();
    expect(screen.getByText("Reuniones de lobby")).toBeInTheDocument();
    expect(screen.getByText("Declaraciones de patrimonio")).toBeInTheDocument();
  });

  it("el contenedor es un <nav> con etiqueta accesible de índice", () => {
    render(<ResumenView chips={makeChips()} />);
    expect(
      screen.getByRole("navigation", { name: /índice de secciones/i }),
    ).toBeInTheDocument();
  });
});

// ── Tres estados honestos + pendiente, render distinto ───────────────────────────
describe("ResumenView — 3-estado honesto distinto (LEG-02)", () => {
  it("{ tipo:'dato', n:9 } muestra '9'", () => {
    render(
      <ResumenView
        chips={[
          { href: "#votos", label: "Votaciones", estado: { tipo: "dato", n: 9 } },
        ]}
      />,
    );
    const chip = screen.getByRole("link");
    expect(within(chip).getByText("9")).toBeInTheDocument();
  });

  it("{ tipo:'vacio' } muestra copy de vacío-honesto (NO '—', NO un número)", () => {
    render(
      <ResumenView
        chips={[
          { href: "#lobby", label: "Lobby", estado: { tipo: "vacio" } },
        ]}
      />,
    );
    const chip = screen.getByRole("link");
    expect(within(chip).getByText(/sin registros/i)).toBeInTheDocument();
    expect(within(chip).queryByText("—")).not.toBeInTheDocument();
    expect(chip.textContent ?? "").not.toMatch(/\d/);
  });

  it("{ tipo:'no_ingerido' } muestra '—'", () => {
    render(
      <ResumenView
        chips={[
          { href: "#cruces", label: "Cruces", estado: { tipo: "no_ingerido" } },
        ]}
      />,
    );
    const chip = screen.getByRole("link");
    expect(within(chip).getByText("—")).toBeInTheDocument();
  });

  it("los tres estados (dato/vacío/no_ingerido) renderizan textos DISTINTOS", () => {
    const { container } = render(
      <ResumenView
        chips={makeChips([
          { estado: { tipo: "dato", n: 3 } },
          { estado: { tipo: "vacio" } },
          { estado: { tipo: "no_ingerido" } },
        ])}
      />,
    );
    const texto = container.textContent ?? "";
    expect(texto).toContain("3");
    expect(texto).toMatch(/sin registros/i);
    expect(texto).toContain("—");
  });
});

// ── Money-off honest-state: pendiente, nunca un número ───────────────────────────
describe("ResumenView — money-off honest-state (LEG-02)", () => {
  it("{ tipo:'pendiente' } muestra copy honest-state y NUNCA un número", () => {
    render(
      <ResumenView
        chips={[
          {
            href: "#financiamiento-pendiente",
            label: "Financiamiento y contratos",
            estado: { tipo: "pendiente" },
          },
        ]}
      />,
    );
    const chip = screen.getByRole("link");
    expect(within(chip).getByText(/pendiente/i)).toBeInTheDocument();
    // Honest-state JAMÁS muestra un número (ni "0").
    expect(chip.textContent ?? "").not.toMatch(/\d/);
  });
});

// ── Negative-density: un vacío no se lee como densidad fabricada ──────────────────
describe("ResumenView — negative-density (anti-insinuación)", () => {
  it("un carril vacío NO contiene copy que se lea como densidad/virtud fabricada", () => {
    const { container } = render(
      <ResumenView
        chips={[
          {
            href: "#patrimonio",
            label: "Declaraciones de patrimonio",
            estado: { tipo: "vacio" },
          },
        ]}
      />,
    );
    const texto = container.textContent ?? "";
    // Espejo de lobby-de-parlamentario.test.tsx:113-116.
    expect(texto).not.toMatch(
      /limpio|impecable|sin actividad|0 actividad|transparente|sin compromisos/i,
    );
  });

  it("ningún chip de estado no-dato muestra un número (vacío/no_ingerido/pendiente)", () => {
    render(
      <ResumenView
        chips={makeChips([
          { estado: { tipo: "vacio" } },
          { estado: { tipo: "no_ingerido" } },
          { estado: { tipo: "pendiente" } },
          { estado: { tipo: "vacio" } },
          { estado: { tipo: "no_ingerido" } },
        ])}
      />,
    );
    for (const chip of screen.getAllByRole("link")) {
      expect(chip.textContent ?? "").not.toMatch(/\d/);
    }
  });
});

// ── Chip de asistencia "Presente en N de M" (SC1 §2.1) ──────────────────────────
describe("ResumenView — chip de asistencia derivado (SC1 §2.1)", () => {
  it("con asistencia {presentes:40,total:52} muestra 'Presente en 40 de 52' (Mono)", () => {
    const { container } = render(
      <ResumenView chips={makeChips()} asistencia={{ presentes: 40, total: 52 }} />,
    );
    const texto = (container.textContent ?? "").replace(/\s+/g, " ");
    expect(texto).toContain("Presente en 40 de 52");
    // Ambos números en Geist Mono (UI-SPEC: conteos/IDs).
    expect(screen.getByText("40").className).toContain("font-mono");
    expect(screen.getByText("52").className).toContain("font-mono");
  });

  it("con asistencia null el chip se OMITE (sin fabricar '0 de 0', T-51-22)", () => {
    render(<ResumenView chips={makeChips()} asistencia={null} />);
    expect(screen.queryByText(/Presente en/)).not.toBeInTheDocument();
  });

  it("sin prop asistencia (default) el chip no aparece — no rompe callers previos", () => {
    render(<ResumenView chips={makeChips()} />);
    expect(screen.queryByText(/Presente en/)).not.toBeInTheDocument();
    // El índice de secciones sigue intacto (5 chips ancla).
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });

  it("el copy del chip es un conteo neutro — sin ranking/score/juicio (banned-vocab)", () => {
    const { container } = render(
      <ResumenView chips={makeChips()} asistencia={{ presentes: 40, total: 52 }} />,
    );
    const texto = container.textContent ?? "";
    // Negative-match §9.1: el chip es un hecho, nunca petróleo/ranking/score.
    expect(texto).not.toMatch(
      /ranking|puntaje|score|índice|mejor|peor|destac|ejemplar|comprometid|cumplidor/i,
    );
  });
});

// ── construirChips — gates + per-carril MONEY (WR-01/IN-03) ─────────────────────
const CONTEOS_BASE: ConteoCarriles = {
  votos: { tipo: "dato", n: 9 },
  lobby: { tipo: "dato", n: 6 },
  patrimonio: { tipo: "vacio" },
  cruces: { tipo: "dato", n: 2 },
  dineroContratos: { tipo: "dato", n: 3 },
  dineroAportes: { tipo: "dato", n: 7 },
  asistencia: { presentes: 40, total: 52 },
};

describe("construirChips — gates + índice por carril presente (LEG-02)", () => {
  it("MONEY OFF + CRUCES ON → un solo chip MONEY honest-state (#financiamiento-pendiente)", () => {
    const chips = construirChips(CONTEOS_BASE, {
      CRUCES_PUBLIC_ENABLED: "true",
    });
    const hrefs = chips.map((c) => c.href);
    expect(hrefs).toEqual([
      "#votos",
      "#lobby",
      "#patrimonio",
      "#cruces",
      "#financiamiento-pendiente",
    ]);
    // MONEY OFF: NUNCA aparece un carril MONEY real ni su conteo.
    expect(hrefs).not.toContain("#dinero");
    expect(hrefs).not.toContain("#financiamiento");
    const pendiente = chips.find((c) => c.href === "#financiamiento-pendiente");
    expect(pendiente?.estado).toEqual({ tipo: "pendiente" });
  });

  it("MONEY ON → DOS chips MONEY (#dinero + #financiamiento), uno por carril presente (IN-03)", () => {
    const chips = construirChips(CONTEOS_BASE, {
      CRUCES_PUBLIC_ENABLED: "true",
      MONEY_PUBLIC_ENABLED: "true",
    });
    const hrefs = chips.map((c) => c.href);
    expect(hrefs).toEqual([
      "#votos",
      "#lobby",
      "#patrimonio",
      "#cruces",
      "#dinero",
      "#financiamiento",
    ]);
    // Cada carril MONEY del HTML tiene su entrada de índice (no hay #financiamiento huérfano).
    expect(hrefs).toContain("#dinero");
    expect(hrefs).toContain("#financiamiento");
    expect(hrefs).not.toContain("#financiamiento-pendiente");
  });

  it("MONEY ON → cada chip MONEY refleja SU PROPIO conteo, nunca el combinado (WR-01)", () => {
    const chips = construirChips(CONTEOS_BASE, {
      CRUCES_PUBLIC_ENABLED: "true",
      MONEY_PUBLIC_ENABLED: "true",
    });
    const dinero = chips.find((c) => c.href === "#dinero");
    const financiamiento = chips.find((c) => c.href === "#financiamiento");
    // #dinero = SOLO contratos (n:3); #financiamiento = SOLO aportes (n:7).
    // Nunca el combinado (10) en ninguno de los dos.
    expect(dinero?.estado).toEqual({ tipo: "dato", n: 3 });
    expect(financiamiento?.estado).toEqual({ tipo: "dato", n: 7 });
  });

  it("CRUCES OFF → sin chip de cruces (gate byte-faithful)", () => {
    const chips = construirChips(CONTEOS_BASE, {});
    expect(chips.map((c) => c.href)).not.toContain("#cruces");
  });
});

// Garantiza que el tipo CarrilEstado se reexporta/consume sin runtime extra.
const _typecheck: CarrilEstado = { tipo: "vacio" };
void _typecheck;
