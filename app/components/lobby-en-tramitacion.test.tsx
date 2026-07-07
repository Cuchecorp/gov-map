import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import {
  LobbyEnTramitacionView,
  type LobbyEnTramitacionRow,
} from "./lobby-en-tramitacion";

afterEach(cleanup);

// ── Valla inline anti-insinuación (§9.1 / banned-vocab §6) — mirror del patrón del
//    repo: el componente no comparte un linter de vocabulario, así que la valla vive
//    como negative-match inline sobre el DOM renderizado. ──────────────────────────
const PROHIBIDO =
  /a cambio de|influy[oó]|gestion[oó]|presion[oó]|afinidad|porque|cercano a|vinculad[oa] a|aliad[oa] de|conflicto de inter|puntaje|score|ranking|los m[aá]s|sospechos|pol[eé]mic/i;
// Patrón de RUT chileno (12.345.678-9 / 12345678-9).
const PATRON_RUT = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/;

// ── Fixtures ───────────────────────────────────────────────────────────────────
// WR-07: el contrato del RPC es de 8 columnas (`audiencia_id` = clave estable de la
// audiencia). Cada makeRow modela por defecto una audiencia REAL DISTINTA (id único
// secuencial); la MISMA reunión repetida (join por comisión) se modela pasando el
// MISMO audiencia_id explícito en ambos overrides.
let audienciaSeq = 0;
function makeRow(
  overrides: Partial<LobbyEnTramitacionRow> = {},
): LobbyEnTramitacionRow {
  return {
    parlamentario_nombre: "Ana Pérez",
    camara: "senado",
    materia: "Regulación de suelos",
    fecha_reunion: "2026-05-14T13:00:00Z",
    semana_iso: "2026-W20",
    comision: "Comisión de Vivienda",
    enlace_detalle:
      "https://www.leylobby.gob.cl/instituciones/AQ001/audiencias/2026/AW1442944",
    audiencia_id: `AW-TEST-${++audienciaSeq}`,
    ...overrides,
  };
}

// ── Vista pura con N filas ───────────────────────────────────────────────────────
describe("LobbyEnTramitacionView — carril de yuxtaposición temporal", () => {
  it("emite su propio h2 (para que el degrade path-1 no deje heading huérfano)", () => {
    render(<LobbyEnTramitacionView rows={[makeRow()]} />);
    expect(
      screen.getByRole("heading", {
        name: /Reuniones de lobby registradas en el mismo período/i,
      }),
    ).toBeInTheDocument();
  });

  it("renderiza el caveat anti-causal UNA sola vez", () => {
    render(
      <LobbyEnTramitacionView
        rows={[makeRow(), makeRow({ parlamentario_nombre: "Juan Soto" })]}
      />,
    );
    const caveats = screen.getAllByText(
      /La coincidencia temporal no implica relación/i,
    );
    expect(caveats.length).toBe(1);
    // El caveat declara explícitamente la coincidencia de fechas.
    expect(
      screen.getByText(/coincidencia de fechas/i),
    ).toBeInTheDocument();
  });

  it("muestra el summary con {N} en un span Mono", () => {
    const { container } = render(
      <LobbyEnTramitacionView
        rows={[makeRow(), makeRow({ parlamentario_nombre: "Juan Soto" })]}
      />,
    );
    expect(
      screen.getByText(/se registraron/i),
    ).toBeInTheDocument();
    // El {N} vive en un span font-mono (regla Mono de metadatos).
    const monos = container.querySelectorAll("span.font-mono");
    const textos = Array.from(monos).map((m) => m.textContent ?? "");
    expect(textos.some((t) => t.trim() === "2")).toBe(true);
  });

  it("una fila por audiencia con nombre (texto plano, NO enlazado) + materia + meta Mono", () => {
    render(<LobbyEnTramitacionView rows={[makeRow()]} />);
    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByText(/Regulación de suelos/)).toBeInTheDocument();
    // Meta line: "Reunión registrada el {fecha} · semana {semanaISO}".
    expect(
      screen.getByText(/Reunión registrada el .* · semana 2026-W20/),
    ).toBeInTheDocument();
    // El nombre del parlamentario NO está envuelto en un <a> (contexto de
    // yuxtaposición, no atribución).
    const links = screen.queryAllByRole("link");
    for (const l of links) {
      expect(l.textContent).not.toContain("Ana Pérez");
    }
  });

  it("cada fila lleva su enlace 'Ver fuente oficial ↗' a enlace_detalle", () => {
    render(
      <LobbyEnTramitacionView
        rows={[makeRow(), makeRow({ parlamentario_nombre: "Juan Soto" })]}
      />,
    );
    const fuentes = screen.getAllByText(/Ver fuente oficial ↗/i);
    expect(fuentes.length).toBe(2);
  });

  it("WR-02: la MISMA audiencia citada por DOS comisiones la misma semana se muestra UNA vez (conteo no inflado)", () => {
    // El RPC emite una fila por (audiencia × semana × comisión): dos comisiones
    // viendo el boletín la misma semana duplican la misma reunión (MISMO
    // audiencia_id). La unidad de presentación es (audiencia × semana): 1 fila,
    // {N}=1, comisiones agregadas.
    const { container } = render(
      <LobbyEnTramitacionView
        rows={[
          makeRow({ comision: "Comisión de Vivienda", audiencia_id: "AW-MISMA" }),
          makeRow({ comision: "Comisión de Hacienda", audiencia_id: "AW-MISMA" }),
        ]}
      />,
    );
    // Una sola fila de audiencia (un solo enlace de fuente, un solo nombre).
    expect(screen.getAllByText(/Ver fuente oficial ↗/i).length).toBe(1);
    expect(screen.getAllByText("Ana Pérez").length).toBe(1);
    // El conteo neutro es 1 (reuniones reales), nunca 2 (filas del join).
    const texto = container.textContent ?? "";
    expect(texto).toMatch(/comisiones Comisión de Vivienda, Comisión de Hacienda/);
    const monos = Array.from(container.querySelectorAll("span.font-mono")).map(
      (m) => (m.textContent ?? "").trim(),
    );
    expect(monos).toContain("1");
    expect(monos).not.toContain("2");
  });

  it("WR-07: DOS audiencias REALES distintas del mismo día/materia con enlace null (caso Cámara) cuentan 2 — audiencia_id las separa", () => {
    // Antes de la enmienda (7 columnas), estas dos filas eran INDISTINGUIBLES para el
    // composite (persona+instante+materia+enlace): la Cámara publica enlace_detalle
    // null y fecha date-only, y dos reuniones reales colapsaban en 1 (undercount del
    // conteo neutro). Con audiencia_id son 2 reuniones.
    const base = {
      materia: "Regulación de suelos",
      fecha_reunion: "2026-05-14T04:00:00Z", // medianoche Santiago (date-only Cámara)
      enlace_detalle: null,
    };
    const { container } = render(
      <LobbyEnTramitacionView
        rows={[
          makeRow({ ...base, audiencia_id: "CAMARA-dup-1" }),
          makeRow({ ...base, audiencia_id: "CAMARA-dup-2" }),
        ]}
      />,
    );
    // Dos filas de audiencia (dos nombres), conteo neutro = 2.
    expect(screen.getAllByText("Ana Pérez").length).toBe(2);
    const monos = Array.from(container.querySelectorAll("span.font-mono")).map(
      (m) => (m.textContent ?? "").trim(),
    );
    expect(monos).toContain("2");
    // El audiencia_id es INTERNO al dedupe: nunca se renderiza.
    expect(container.textContent ?? "").not.toMatch(/CAMARA-dup/);
  });

  it("forward-compat: sin audiencia_id (RPC pre-enmienda) el dedupe cae al composite — misma reunión × 2 comisiones sigue siendo 1", () => {
    render(
      <LobbyEnTramitacionView
        rows={[
          makeRow({ comision: "Comisión de Vivienda", audiencia_id: null }),
          makeRow({ comision: "Comisión de Hacienda", audiencia_id: null }),
        ]}
      />,
    );
    expect(screen.getAllByText("Ana Pérez").length).toBe(1);
    expect(screen.getAllByText(/Ver fuente oficial ↗/i).length).toBe(1);
  });

  it("agrupa por semana ISO cuando hay más de una semana (summary por semana)", () => {
    const { container } = render(
      <LobbyEnTramitacionView
        rows={[
          makeRow({ semana_iso: "2026-W20", comision: "Comisión de Vivienda" }),
          makeRow({
            parlamentario_nombre: "Juan Soto",
            semana_iso: "2026-W22",
            comision: "Comisión de Hacienda",
          }),
        ]}
      />,
    );
    // "Semana" (prosa) y el valor Mono viven en nodos separados → se asierta sobre
    // el textContent agregado, no sobre un único nodo.
    const texto = container.textContent ?? "";
    expect(texto).toMatch(/Semana\s*2026-W20/);
    expect(texto).toMatch(/Semana\s*2026-W22/);
    expect(texto).toMatch(/comisión Comisión de Vivienda/);
    expect(texto).toMatch(/comisión Comisión de Hacienda/);
  });
});

// ── Empty honesto (0 filas) ──────────────────────────────────────────────────────
describe("LobbyEnTramitacionView — empty honesto", () => {
  it("0 filas → empty-state honesto + caveat, sin filas fabricadas", () => {
    render(<LobbyEnTramitacionView rows={[]} />);
    expect(
      screen.getByText(
        /No se registran reuniones de lobby en las semanas en que una comisión vio este proyecto, según las fuentes consultadas/i,
      ),
    ).toBeInTheDocument();
    // El caveat sigue presente (honestidad de la superficie).
    expect(
      screen.getByText(/La coincidencia temporal no implica relación/i),
    ).toBeInTheDocument();
    // Sin filas de fuente fabricadas.
    expect(screen.queryByText(/Ver fuente oficial ↗/i)).not.toBeInTheDocument();
  });
});

// ── Anti-insinuación: sin vocabulario causal/afinidad ni RUT ─────────────────────
describe("LobbyEnTramitacionView — anti-insinuación", () => {
  it("el output NO contiene vocabulario causal/afinidad (banned-vocab §6)", () => {
    const { container } = render(
      <LobbyEnTramitacionView
        rows={[makeRow(), makeRow({ parlamentario_nombre: "Juan Soto" })]}
      />,
    );
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(PROHIBIDO);
    expect(texto).not.toMatch(PATRON_RUT);
  });

  it("no compone con ningún voto/tally: sin copy de voto en el carril", () => {
    const { container } = render(
      <LobbyEnTramitacionView rows={[makeRow()]} />,
    );
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/a favor|en contra|votación|votacion|\bvoto\b/i);
  });
});

// ── Invariantes de fuente (Pitfall 8: process.cwd + path.join, NO import.meta) ────
describe("lobby-en-tramitacion — invariantes de fuente", () => {
  const APP_ROOT = process.cwd(); // app/
  const TSX = path.join(APP_ROOT, "components", "lobby-en-tramitacion.tsx");
  const SRC = readFileSync(TSX, "utf8");

  it("NO es 'use client' (RSC)", () => {
    expect(SRC).not.toMatch(/^\s*["']use client["']/m);
  });

  it("degrade honesto: distingue PGRST202/function-missing (→null) de error real (→throw)", () => {
    expect(SRC).toContain("PGRST202");
    expect(SRC).toMatch(/return null/);
    expect(SRC).toMatch(/throw new Error/);
  });

  it("WR-01: el camino 1 gatea SOLO por código PGRST202 — sin fallback por regex de mensaje", () => {
    // Un regex sobre error.message ("does not exist" / "schema cache") tragaría
    // errores REALES de schema (columna/relación renombrada) como "función ausente"
    // y ocultaría la sección en silencio, violando el degrade-honesto (camino 3).
    expect(SRC).not.toMatch(/\.test\(\s*error\??\.message/);
    expect(SRC).toMatch(/error\?\.code === "PGRST202"/);
  });

  it("consume el RPC lobby_en_tramitacion con p_boletin", () => {
    expect(SRC).toContain('lobby_en_tramitacion');
    expect(SRC).toContain("p_boletin");
  });

  it("WR-07: el dedupe se apoya en audiencia_id (contrato de 8 columnas de 0048)", () => {
    expect(SRC).toMatch(/audiencia_id/);
    // La clave primaria del dedupe usa el id; el composite queda solo como fallback.
    expect(SRC).toMatch(/r\.audiencia_id\s*\?/);
  });
});
