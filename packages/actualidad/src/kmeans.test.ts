import { describe, it, expect } from "vitest";
import { kmeans, labelCluster, KMEANS_SEED } from "./kmeans";

/**
 * Genera un vector 768d determinista (para no depender de embeddings reales en el test).
 * Usa un patrón simple parametrizado por `base` para poder fabricar clusters "obvios".
 */
function vec768(base: number): number[] {
  const v = new Array<number>(768);
  for (let i = 0; i < 768; i++) {
    // señal dominante en las primeras dims según `base`, resto pequeño y estable.
    v[i] = i < 3 ? (i === base % 3 ? 1 : 0.01) : 0.001 * ((i * 7 + base) % 5);
  }
  return v;
}

describe("kmeans — determinismo (Pitfall 4)", () => {
  it("misma entrada + misma seed → asignaciones IDÉNTICAS en dos corridas", () => {
    // 12 vectores repartidos en 3 grupos obvios.
    const vectors = Array.from({ length: 12 }, (_, i) => vec768(i % 3));
    const a = kmeans(vectors, 3, KMEANS_SEED);
    const b = kmeans(vectors, 3, KMEANS_SEED);
    expect(b.assignments).toEqual(a.assignments);
    expect(b.k).toEqual(a.k);
  });

  it("vectores idénticos caen en el mismo cluster", () => {
    const vectors = [vec768(0), vec768(0), vec768(1), vec768(1)];
    const { assignments } = kmeans(vectors, 2, KMEANS_SEED);
    expect(assignments[0]).toBe(assignments[1]);
    expect(assignments[2]).toBe(assignments[3]);
  });

  it("vectores de grupos distintos tienden a clusters distintos con k pequeño", () => {
    const vectors = [vec768(0), vec768(0), vec768(1), vec768(1), vec768(2), vec768(2)];
    const { assignments } = kmeans(vectors, 3, KMEANS_SEED);
    // los dos del grupo 0 juntos, distintos de los del grupo 2.
    expect(assignments[0]).toBe(assignments[1]);
    expect(assignments[0]).not.toBe(assignments[4]);
  });

  it("clampa k hacia abajo si N < k (checker warning #2)", () => {
    const vectors = [vec768(0), vec768(1)];
    const { k, centroids } = kmeans(vectors, 10, KMEANS_SEED);
    expect(k).toBeLessThanOrEqual(2);
    expect(centroids.length).toBe(k);
  });
});

describe("labelCluster — mode(materia) factual, JAMÁS LLM (T-99-11)", () => {
  it("toma la materia más frecuente (mode)", () => {
    expect(labelCluster(["A", "A", "B"])).toBe("A");
  });

  it("empate → orden alfabético (determinista)", () => {
    expect(labelCluster(["B", "A"])).toBe("A");
    expect(labelCluster(["Salud", "Educación"])).toBe("Educación");
  });

  it("ignora null/vacío pero devuelve algo estable si el cluster no tiene materia", () => {
    expect(labelCluster([null, "", "  ", "Trabajo"])).toBe("Trabajo");
    expect(labelCluster([null, ""])).toBe("(sin materia)");
  });
});
