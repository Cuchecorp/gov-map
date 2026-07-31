import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { CompararSelector } from "./comparar-selector";
import type { ParlamentarioListadoRow } from "@/lib/types";

afterEach(cleanup);

const ROSTER = [
  { id: "D1099", nombre: "Jaime Araya Guerrero", camara: "camara" },
  { id: "D1178", nombre: "Héctor Ulloa Aguilera", camara: "camara" },
] as unknown as ParlamentarioListadoRow[];

describe("CompararSelector — C-02: el CTA primario usa el token del sistema", () => {
  it("el botón `Comparar` lleva bg-accent-product y CERO bg-foreground", () => {
    const { container } = render(<CompararSelector roster={ROSTER} />);
    const boton = container.querySelector('button[type="submit"]');

    // Control positivo apareado: el botón EXISTE y es el CTA `Comparar`.
    expect(boton).not.toBeNull();
    expect(boton!.textContent).toBe("Comparar");

    // El token del sistema está presente…
    expect(boton!.className).toContain("bg-accent-product");
    // …y el outlier murió. Sin el control positivo de arriba, este cero sería vacuo.
    expect(boton!.className).not.toContain("bg-foreground");
  });

  it("no arrastra el token a los `<select>`: su petróleo sigue siendo solo focus-visible", () => {
    const { container } = render(<CompararSelector roster={ROSTER} />);
    const selects = Array.from(container.querySelectorAll("select"));
    expect(selects).toHaveLength(2); // control positivo
    for (const s of selects) {
      expect(s.className).not.toContain("bg-accent-product");
    }
  });
});
