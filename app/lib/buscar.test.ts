import { describe, it, expect, vi, beforeEach } from "vitest";

// `next/navigation`.redirect lanza (Next interrumpe el render). Mockeamos para
// observar que el atajo de boletín redirige ANTES de embeber, sin necesitar el
// runtime de Next.
const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

// El cliente Supabase server-only: mockeamos `createServerSupabase().rpc(...)`.
const rpcMock = vi.fn();
vi.mock("@/lib/supabase", () => ({
  createServerSupabase: () => ({ rpc: rpcMock }),
}));

import { buscarProyectos, CONTRAPARTE_ID_RE } from "./buscar";

beforeEach(() => {
  redirectMock.mockClear();
  rpcMock.mockReset();
});

/** Embedder mockeado: nunca toca red ni la Gemini key. */
function fakeEmbedder() {
  const embed = vi.fn(async () => [{ vector: new Array(768).fill(0.1) }]);
  return { embed };
}

describe("buscarProyectos — query vacía / whitespace", () => {
  it("q vacía → [] sin llamar al embedder ni al rpc", async () => {
    const emb = fakeEmbedder();
    const res = await buscarProyectos("", { embedder: emb });
    expect(res).toEqual([]);
    expect(emb.embed).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("q solo-whitespace → [] sin llamar al embedder ni al rpc", async () => {
    const emb = fakeEmbedder();
    const res = await buscarProyectos("   \t\n  ", { embedder: emb });
    expect(res).toEqual([]);
    expect(emb.embed).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("buscarProyectos — atajo de boletín (T-07-10)", () => {
  it("q que matchea BOLETIN_RE → redirect(/proyecto/{q}) ANTES de embeber", async () => {
    const emb = fakeEmbedder();
    await expect(
      buscarProyectos("15234-07", { embedder: emb }),
    ).rejects.toThrow("NEXT_REDIRECT:/proyecto/15234-07");
    expect(redirectMock).toHaveBeenCalledWith("/proyecto/15234-07");
    // El atajo ocurre ANTES de embeber: ni embedder ni rpc se tocan.
    expect(emb.embed).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("boletín sin sufijo también redirige", async () => {
    const emb = fakeEmbedder();
    await expect(
      buscarProyectos("12345", { embedder: emb }),
    ).rejects.toThrow("NEXT_REDIRECT:/proyecto/12345");
    expect(redirectMock).toHaveBeenCalledWith("/proyecto/12345");
  });
});

describe("buscarProyectos — flujo normal (embed RETRIEVAL_QUERY + rpc)", () => {
  it("q normal → embed RETRIEVAL_QUERY → rpc match_proyectos → filas", async () => {
    const emb = fakeEmbedder();
    rpcMock.mockResolvedValue({
      data: [
        { boletin: "111-07", similarity: 0.9 },
        { boletin: "222-07", similarity: 0.8 },
      ],
      error: null,
    });

    const res = await buscarProyectos("protección de datos personales", {
      embedder: emb,
    });

    // Embebe la consulta como RETRIEVAL_QUERY (asimétrico, SEM-03).
    expect(emb.embed).toHaveBeenCalledTimes(1);
    expect(emb.embed).toHaveBeenCalledWith(
      ["protección de datos personales"],
      "RETRIEVAL_QUERY",
    );

    // RPC parametrizado: el vector va como query_embedding; q nunca se interpola.
    expect(rpcMock).toHaveBeenCalledWith(
      "match_proyectos",
      expect.objectContaining({
        query_embedding: expect.any(Array),
        match_count: 20,
        exclude_boletin: null,
      }),
    );

    expect(res).toEqual([
      { boletin: "111-07", similarity: 0.9 },
      { boletin: "222-07", similarity: 0.8 },
    ]);
  });

  it("rpc devuelve data null → []", async () => {
    const emb = fakeEmbedder();
    rpcMock.mockResolvedValue({ data: null, error: null });
    const res = await buscarProyectos("algo", { embedder: emb });
    expect(res).toEqual([]);
  });

  it("rpc devuelve error → LANZA (no [] silencioso; honest degradation error ≠ vacío)", async () => {
    const emb = fakeEmbedder();
    // Fallo real del RPC: supabase-js devuelve { data: null, error }.
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "permission denied for function match_proyectos" },
    });
    await expect(
      buscarProyectos("algo que falla", { embedder: emb }),
    ).rejects.toThrow(/match_proyectos RPC falló/);
  });

  it("excludeBoletin se pasa al rpc (self-exclusion para similares, SEM-05)", async () => {
    const emb = fakeEmbedder();
    rpcMock.mockResolvedValue({ data: [], error: null });
    await buscarProyectos("regulación del endeudamiento", {
      embedder: emb,
      excludeBoletin: "18296-05",
    });
    expect(rpcMock).toHaveBeenCalledWith(
      "match_proyectos",
      expect.objectContaining({ exclude_boletin: "18296-05" }),
    );
  });
});

describe("buscarProyectos — input validation (V5: trim + cap ≤300)", () => {
  it("trimea la consulta antes de embeber", async () => {
    const emb = fakeEmbedder();
    rpcMock.mockResolvedValue({ data: [], error: null });
    await buscarProyectos("  datos personales  ", { embedder: emb });
    expect(emb.embed).toHaveBeenCalledWith(["datos personales"], "RETRIEVAL_QUERY");
  });

  it("capea a ≤300 caracteres", async () => {
    const emb = fakeEmbedder();
    rpcMock.mockResolvedValue({ data: [], error: null });
    const largo = "a".repeat(500);
    await buscarProyectos(largo, { embedder: emb });
    const arg = (emb.embed.mock.calls as unknown as string[][][])[0]![0][0];
    expect(arg.length).toBe(300);
  });
});

describe("CONTRAPARTE_ID_RE — acepta ortografía española, rechaza control/traversal (WR-02)", () => {
  it("acepta ids 'c:' / 'd:' ASCII (RUT proveedor / nombre simple)", () => {
    expect(CONTRAPARTE_ID_RE.test("c:76.123.456-0")).toBe(true);
    expect(CONTRAPARTE_ID_RE.test("d:Constructora Andes Ltda")).toBe(true);
  });

  it("WR-02: acepta nombres con acentos / ñ / ampersand (antes 404eaban)", () => {
    expect(CONTRAPARTE_ID_RE.test("d:Constructora Peñalolén")).toBe(true);
    expect(CONTRAPARTE_ID_RE.test("d:Compañía Logística del Maule S.A.")).toBe(true);
    expect(CONTRAPARTE_ID_RE.test("d:Constructora Ñandú Ltda")).toBe(true);
    expect(CONTRAPARTE_ID_RE.test("d:García & Muñoz SpA")).toBe(true);
  });

  it("rechaza ids sin prefijo 'c:'/'d:'", () => {
    expect(CONTRAPARTE_ID_RE.test("x:Empresa")).toBe(false);
    expect(CONTRAPARTE_ID_RE.test("Empresa")).toBe(false);
    expect(CONTRAPARTE_ID_RE.test("c:")).toBe(false);
  });

  it("rechaza path-traversal y control chars (V5)", () => {
    expect(CONTRAPARTE_ID_RE.test("d:../../etc/passwd")).toBe(false);
    expect(CONTRAPARTE_ID_RE.test("d:Empresa/sub")).toBe(false);
    expect(CONTRAPARTE_ID_RE.test("d:Empresa\\sub")).toBe(false);
    expect(CONTRAPARTE_ID_RE.test("d:linea1\nlinea2")).toBe(false);
    expect(CONTRAPARTE_ID_RE.test("d:tab\there")).toBe(false);
  });
});
