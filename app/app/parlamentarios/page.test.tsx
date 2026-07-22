import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Tests del directorio /parlamentarios (SC2 + SC4). Verifican por comportamiento
 * (no por convención):
 *   - render con 186 filas mock → todas listadas, cada una con link /parlamentario/<id>.
 *   - filtro camara=senado → solo filas senado.
 *   - filtro q por nombre → solo coincidencias (case-insensitive).
 *   - `[]` genuino tras filtro → honest-empty ("Sin parlamentarios para este filtro."),
 *     NUNCA un banner de error.
 *   - error real de RPC → THROW (#34), NO "sin resultados".
 *   - BIO-03: la fila SÍ puede renderizar el PartidoChip (reversión LEGAL-03,
 *     decisión operador 2026-07-21); rut/email/foto siguen PROHIBIDOS.
 *
 * `createServerSupabase` se mockea para inyectar el resultado del RPC sin tocar DB.
 */

const rpcMock = vi.fn();
const createServerSupabaseMock = vi.fn(() => ({ rpc: rpcMock }));
vi.mock("@/lib/supabase", () => ({
  createServerSupabase: () => createServerSupabaseMock(),
}));

// Importar DESPUÉS de los mocks.
import { DirectoryList } from "./page";

type Row = {
  id: string;
  nombre: string;
  camara: "diputados" | "senado";
  region: string | null;
  distrito: string | null;
  circunscripcion: string | null;
  periodo: string | null;
  // BIO-03 (super-set v2): partido de la militancia vigente + provenance. null = honesto.
  partido: string | null;
  partido_fecha_captura: string | null;
  partido_origen: string | null;
};

function makeRows(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => {
    const senado = i % 4 === 0; // ~25% senado
    return {
      id: senado ? `S${1000 + i}` : `D${1000 + i}`,
      nombre: senado ? `Senador Apellido${i}` : `Diputado Apellido${i}`,
      camara: senado ? "senado" : "diputados",
      region: senado ? `Región ${i}` : null,
      distrito: senado ? null : `${i}`,
      circunscripcion: senado ? `${i}` : null,
      periodo: "2022-2026",
      // Default honesto: sin militancia vigente (el chip se omite) salvo override.
      partido: null,
      partido_fecha_captura: null,
      partido_origen: null,
    } satisfies Row;
  });
}

beforeEach(() => {
  rpcMock.mockReset();
  createServerSupabaseMock.mockClear();
});

describe("/parlamentarios — DirectoryList", () => {
  it("render con 186 filas → lista todas con link /parlamentario/<id>", async () => {
    const rows = makeRows(186);
    rpcMock.mockResolvedValue({ data: rows, error: null });

    const el = await DirectoryList({ q: "" });
    const html = renderToStaticMarkup(el);

    // Conteo declarado y enlaces presentes.
    expect(html).toContain("186 parlamentarios");
    expect(html).toContain(`href="/parlamentario/${rows[0].id}"`);
    expect(html).toContain(`href="/parlamentario/${rows[185].id}"`);
    // Un link por cada fila (186 enlaces a fichas).
    const matches = html.match(/href="\/parlamentario\//g) ?? [];
    expect(matches).toHaveLength(186);
  });

  it("filtro camara=senado → solo filas senado", async () => {
    const rows = makeRows(20);
    rpcMock.mockResolvedValue({ data: rows, error: null });

    const el = await DirectoryList({ camara: "senado", q: "" });
    const html = renderToStaticMarkup(el);

    const esperados = rows.filter((r) => r.camara === "senado");
    const enlaces = html.match(/href="\/parlamentario\//g) ?? [];
    expect(enlaces).toHaveLength(esperados.length);
    // Ninguna fila de diputados (id D####) aparece.
    for (const r of rows.filter((r) => r.camara === "diputados")) {
      expect(html).not.toContain(`href="/parlamentario/${r.id}"`);
    }
  });

  it("filtro q por nombre → solo coincidencias (case-insensitive)", async () => {
    const sinPartido = { partido: null, partido_fecha_captura: null, partido_origen: null };
    const rows: Row[] = [
      { id: "D1", nombre: "María González", camara: "diputados", region: null, distrito: "1", circunscripcion: null, periodo: "2022-2026", ...sinPartido },
      { id: "D2", nombre: "Juan Pérez", camara: "diputados", region: null, distrito: "2", circunscripcion: null, periodo: "2022-2026", ...sinPartido },
      { id: "S3", nombre: "Ana GONZALEZ-Vera", camara: "senado", region: "X", distrito: null, circunscripcion: "3", periodo: "2022-2026", ...sinPartido },
    ];
    rpcMock.mockResolvedValue({ data: rows, error: null });

    const el = await DirectoryList({ q: "gonzalez" });
    const html = renderToStaticMarkup(el);

    // Sin acentos NO matchea "González" (búsqueda literal); SÍ matchea "GONZALEZ-Vera".
    expect(html).toContain(`href="/parlamentario/S3"`);
    expect(html).not.toContain(`href="/parlamentario/D2"`);
    // Case-insensitive: "ana gonzalez" también con mayúsculas distintas.
    const el2 = await DirectoryList({ q: "MARÍA" });
    const html2 = renderToStaticMarkup(el2);
    expect(html2).toContain(`href="/parlamentario/D1"`);
    expect(html2).not.toContain(`href="/parlamentario/D2"`);
  });

  it("[] genuino tras filtro → honest-empty, NO error", async () => {
    rpcMock.mockResolvedValue({ data: makeRows(10), error: null });
    const el = await DirectoryList({ q: "nadie-coincide-zzz" });
    const html = renderToStaticMarkup(el);
    expect(html).toContain("Sin parlamentarios para este filtro.");
    expect(html).not.toMatch(/falló|error/i);
  });

  it("BENTO-04: honest-empty box lleva rounded-[var(--radius-tile)]", async () => {
    rpcMock.mockResolvedValue({ data: makeRows(10), error: null });
    const el = await DirectoryList({ q: "nadie-coincide-zzz" });
    const html = renderToStaticMarkup(el);
    expect(html).toContain("rounded-[var(--radius-tile)]");
  });

  it("error real de RPC → THROW (#34), NO 'sin resultados'", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(DirectoryList({ q: "" })).rejects.toThrow(/boom/);
  });

  it("BENTO-04: fila de directorio lleva rounded-[var(--radius-tile)]", async () => {
    const rows = makeRows(3);
    rpcMock.mockResolvedValue({ data: rows, error: null });
    const el = await DirectoryList({ q: "" });
    const html = renderToStaticMarkup(el);
    expect(html).toContain("rounded-[var(--radius-tile)]");
    // Defensivo: rounded-lg sigue presente en interiores (inputs de filtro); no exigir ausencia global.
    // Pero la tarjeta de directorio (Link root) lleva la clase bento.
  });

  it("BIO-03: la fila con partido renderiza el PartidoChip; rut/email/foto siguen prohibidos", async () => {
    const rows = makeRows(3);
    // Una fila con militancia vigente → chip visible con fuente+fecha.
    rows[0] = {
      ...rows[0],
      partido: "Partido Demócrata",
      partido_fecha_captura: "2026-07-21",
      partido_origen: "camara-bio-diputados",
    };
    rpcMock.mockResolvedValue({ data: rows, error: null });
    const el = await DirectoryList({ q: "" });
    const html = renderToStaticMarkup(el);

    // Reversión LEGAL-03: el partido de la fila con dato SÍ aparece.
    expect(html).toContain("Partido Demócrata");
    // El aria-label del chip expone partido + fuente (según fuente al [fecha]).
    expect(html).toMatch(/aria-label="Partido: Partido Demócrata/);
    // Piso de PII dura intacto: NUNCA rut/email/foto.
    expect(html).not.toMatch(/\brut\b|email|<img/i);
  });

  it("BIO-03: fila sin militancia vigente (partido null) OMITE el chip (honesto)", async () => {
    const rows = makeRows(2); // todas con partido null por default
    rpcMock.mockResolvedValue({ data: rows, error: null });
    const el = await DirectoryList({ q: "" });
    const html = renderToStaticMarkup(el);
    // Sin partido → el chip no se renderiza (no "Sin partido", no data-slot).
    expect(html).not.toContain('data-slot="partido-chip"');
  });
});
