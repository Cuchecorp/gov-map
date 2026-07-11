import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// El banner de cobertura declara sobre cuántos proyectos busca /buscar. El N DEBE
// venir del count real (contarCoberturaBusqueda), NUNCA de una constante hardcodeada
// (T-63-14). Aquí mockeamos el contador para probar que el banner refleja el mock,
// y que el número no está horneado en el JSX.
const contarCoberturaBusquedaMock = vi.fn();
vi.mock("@/lib/coverage", () => ({
  contarCoberturaBusqueda: (...a: unknown[]) => contarCoberturaBusquedaMock(...a),
  ALCANCE_COBERTURA: "período legislativo 2022–2026",
}));

// BuscarPage (Server Component) llama a contarCoberturaBusqueda + buscarProyectos,
// y para la rama vacía (q="") no toca Supabase. Mockeamos las deps server-only para
// poder renderizar sin el runtime de Next.
vi.mock("@/lib/buscar", async () => {
  const real = await vi.importActual<typeof import("@/lib/buscar")>("@/lib/buscar");
  return { ...real, buscarProyectos: vi.fn() };
});
vi.mock("@/lib/supabase", () => ({
  createServerSupabase: () => ({}),
}));

// SearchBox es un Client Component (useRouter) → sin app router montado en test
// revienta. Lo stubeamos: solo nos importa el banner de cobertura hermano.
vi.mock("@/components/search-box", () => ({
  SearchBox: () => null,
}));

import BuscarPage from "./page";

async function render(n: number | null): Promise<string> {
  contarCoberturaBusquedaMock.mockResolvedValue(n);
  // Query vacía → sin lista ni Supabase; solo se ejercita el banner de cobertura.
  const el = await BuscarPage({ searchParams: Promise.resolve({}) });
  return renderToStaticMarkup(el);
}

describe("BuscarPage — banner de cobertura (BUSQ-03)", () => {
  beforeEach(() => {
    contarCoberturaBusquedaMock.mockReset();
  });

  it("Test 1: renderiza 'Busca sobre {N} proyectos de ley' con N desde el count", async () => {
    const html = await render(3506);
    expect(html).toContain("Busca sobre 3506 proyectos de ley");
    // El alcance documentado aparece en el copy.
    expect(html).toContain("período legislativo 2022–2026");
  });

  it("Test 2: el N viene del count (mock), NO de una constante hardcodeada", async () => {
    // Con un N distinto el banner cambia → prueba que no está horneado.
    const html = await render(42);
    expect(html).toContain("Busca sobre 42 proyectos de ley");
    expect(html).not.toContain("3506");
    // Y el contador fue efectivamente consultado (no un literal en el JSX).
    expect(contarCoberturaBusquedaMock).toHaveBeenCalledTimes(1);
  });

  it("Test 3: count desconocido (null) → NO renderiza el banner (WR-02: no miente '0')", async () => {
    // Fallo del count → contarCoberturaBusqueda devuelve null → banner oculto.
    const html = await render(null);
    expect(html).not.toContain("Busca sobre");
    expect(html).not.toContain("proyectos de ley (período");
  });

  it("Test 4: count = 0 (sin corpus) → NO renderiza el banner (no afirma 'sobre 0')", async () => {
    const html = await render(0);
    expect(html).not.toContain("Busca sobre 0 proyectos de ley");
    expect(html).not.toContain("Busca sobre");
  });
});
