import { describe, expect, it } from "vitest";
import { claseCamara } from "./panel-camara";

describe("claseCamara", () => {
  it("Cámara de Diputados → bg-[var(--camara)]", () => {
    expect(claseCamara("Cámara de Diputados")).toBe("bg-[var(--camara)]");
  });

  it("Senado → bg-[var(--senado)]", () => {
    expect(claseCamara("Senado")).toBe("bg-[var(--senado)]");
  });

  it("piso de corpus → null (regla A, sin barra)", () => {
    expect(claseCamara("2022-2026 (piso de corpus)")).toBeNull();
  });
});
