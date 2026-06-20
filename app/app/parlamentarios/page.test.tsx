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
 *   - ninguna fila renderiza partido/rut/email/foto.
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
    const rows: Row[] = [
      { id: "D1", nombre: "María González", camara: "diputados", region: null, distrito: "1", circunscripcion: null, periodo: "2022-2026" },
      { id: "D2", nombre: "Juan Pérez", camara: "diputados", region: null, distrito: "2", circunscripcion: null, periodo: "2022-2026" },
      { id: "S3", nombre: "Ana GONZALEZ-Vera", camara: "senado", region: "X", distrito: null, circunscripcion: "3", periodo: "2022-2026" },
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

  it("error real de RPC → THROW (#34), NO 'sin resultados'", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(DirectoryList({ q: "" })).rejects.toThrow(/boom/);
  });

  it("ninguna fila renderiza partido/rut/email/foto", async () => {
    const rows = makeRows(12);
    rpcMock.mockResolvedValue({ data: rows, error: null });
    const el = await DirectoryList({ q: "" });
    const html = renderToStaticMarkup(el);
    expect(html).not.toMatch(/partido|\brut\b|email|<img/i);
  });
});
