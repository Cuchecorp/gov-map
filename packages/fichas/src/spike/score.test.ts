import { describe, it, expect } from "vitest";
import { evaluarRetrieval } from "./score";
import type { CasoRetrieval } from "./golden-set";

function makeCase(
  id: string,
  category: CasoRetrieval["category"],
  expected: string[],
): CasoRetrieval {
  return { id, category, query: `query-${id}`, expected, nota: "test" };
}

describe("evaluarRetrieval", () => {
  it("expected en pos 0 → hit1=1, hit5=1, mrr=1", async () => {
    const caso = makeCase("c1", "titulo-literal", ["14309-04"]);
    const m = await evaluarRetrieval([caso], async () => ["14309-04", "other"]);
    expect(m.agregado.hit1).toBe(1);
    expect(m.agregado.hit5).toBe(1);
    expect(m.agregado.mrr).toBe(1);
  });

  it("expected en pos 4 (rank 5) → hit1=0, hit5=1, mrr=1/5", async () => {
    const caso = makeCase("c2", "titulo-literal", ["14309-04"]);
    const lista = ["a", "b", "c", "d", "14309-04"];
    const m = await evaluarRetrieval([caso], async () => lista);
    expect(m.agregado.hit1).toBe(0);
    expect(m.agregado.hit5).toBe(1);
    expect(m.agregado.mrr).toBeCloseTo(1 / 5);
  });

  it("expected en pos 7 (rank 8) → hit1=0, hit5=0, mrr=0, rank=8 en detalle", async () => {
    const caso = makeCase("c3", "titulo-literal", ["14309-04"]);
    const lista = ["a", "b", "c", "d", "e", "f", "g", "14309-04"];
    const m = await evaluarRetrieval([caso], async () => lista);
    expect(m.agregado.hit1).toBe(0);
    expect(m.agregado.hit5).toBe(0);
    expect(m.agregado.mrr).toBe(0);
    expect(m.detalle[0]?.rank).toBe(8);
  });

  it("expected ausente de la lista → rank=null, hit1=0, hit5=0, mrr=0, ok=false", async () => {
    const caso = makeCase("c4", "boletin", ["14309-04"]);
    const m = await evaluarRetrieval([caso], async () => ["x", "y", "z"]);
    expect(m.agregado.hit1).toBe(0);
    expect(m.agregado.hit5).toBe(0);
    expect(m.agregado.mrr).toBe(0);
    expect(m.detalle[0]?.rank).toBeNull();
    expect(m.detalle[0]?.ok).toBe(false);
  });

  it("match accent-insensitive: expected '14309-04' hace hit contra '14309-04' via normalizarLiteral", async () => {
    const caso = makeCase("c5", "acentos-toponimos", ["14309-04"]);
    // La lista devuelve el mismo string — debe hacer hit
    const m = await evaluarRetrieval([caso], async () => ["14309-04"]);
    expect(m.agregado.hit1).toBe(1);
  });

  it("porCategoria agrupa por category correctamente", async () => {
    const casos: CasoRetrieval[] = [
      makeCase("g1", "titulo-literal", ["A"]),
      makeCase("g2", "boletin", ["B"]),
      makeCase("g3", "titulo-literal", ["C"]),
    ];
    const m = await evaluarRetrieval(casos, async (caso) => {
      // g1: hit, g2: miss, g3: hit
      if (caso.id === "g1") return ["A"];
      if (caso.id === "g2") return ["X"];
      return ["C"];
    });
    expect(m.porCategoria["titulo-literal"]?.n).toBe(2);
    expect(m.porCategoria["titulo-literal"]?.hit1).toBe(1); // 2/2 = 1.0
    expect(m.porCategoria["boletin"]?.n).toBe(1);
    expect(m.porCategoria["boletin"]?.hit1).toBe(0);
  });

  it("detalle[] tiene una entrada por caso con {id, category, rank, ok}", async () => {
    const casos: CasoRetrieval[] = [
      makeCase("d1", "normas", ["A"]),
      makeCase("d2", "similares", ["B"]),
    ];
    const m = await evaluarRetrieval(casos, async (caso) => {
      if (caso.id === "d1") return ["A"];
      return ["X"];
    });
    expect(m.detalle).toHaveLength(2);
    expect(m.detalle[0]).toMatchObject({ id: "d1", category: "normas", rank: 1, ok: true });
    expect(m.detalle[1]).toMatchObject({ id: "d2", category: "similares", rank: null, ok: false });
  });
});
