import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { LobbyCapa1 } from "./lobby-capa1";
import type { LobbyMateria } from "@/lib/parlamentario-resumen-conteos";

afterEach(cleanup);

// Valla anti-insinuación (§9.1, mirror verbatim de cruces/lobby-de-parlamentario.test).
const PROHIBIDO =
  /se reunió para|a cambio de|antes de votar|que resultó en|cercano a|vinculad[oa] a|aliad[oa] de|su lobista|lobista habitual|se reúne más|afinidad|conflicto de inter|posible conflicto|influencia|influyente|score|ranking|índice de|leaderboard|sospechos|polémic|controversial|oscuro/i;

function fixture(): LobbyMateria[] {
  return [
    { materia: "Salud", n: 5 },
    { materia: "Educación", n: 3 },
    { materia: "Vivienda", n: 2 },
  ];
}

describe("LobbyCapa1 — resumen preatentivo de lobby (55-02)", () => {
  it("muestra barras top-N por materia (asunto verbatim) + conteo total", () => {
    const { container } = render(<LobbyCapa1 topMaterias={fixture()} estado={{ tipo: "dato", n: 10 }} />);
    const barras = container.querySelectorAll("li");
    expect(barras).toHaveLength(3);
    // orden preservado (ya viene rankeado desc del productor).
    expect(barras[0].textContent).toContain("Salud");
    expect(barras[1].textContent).toContain("Educación");
    // conteo total neutro.
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText(/reuniones/)).toBeInTheDocument();
  });

  it("usa color NEUTRO en las barras, NUNCA petróleo", () => {
    const { container } = render(<LobbyCapa1 topMaterias={fixture()} estado={{ tipo: "dato", n: 10 }} />);
    const html = container.innerHTML;
    expect(html).toMatch(/bg-muted-foreground/);
    expect(html).not.toMatch(/accent-product/);
  });

  it("degradación honesta: sin materias publicadas muestra solo el conteo total", () => {
    const { container } = render(<LobbyCapa1 topMaterias={[]} estado={{ tipo: "dato", n: 4 }} />);
    expect(container.querySelectorAll("li")).toHaveLength(0);
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText(/reuniones/)).toBeInTheDocument();
  });

  /**
   * 122-05, fila 5.11 de `122-CRUCES-SQL-03-LOBBY.md`.
   *
   * `page.tsx:617` pasaba `total={conteos.lobby.tipo === "dato" ? conteos.lobby.n : 0}`,
   * colapsando `vacio` y `no_ingerido` al literal `0`, que este componente imprimía
   * como el HECHO "0 reuniones". En `/parlamentario/S1338` la MISMA sección declaraba
   * `—` en su encabezado (honesto: no ingerido) y `0 reuniones` tres líneas más abajo
   * (afirmación de hecho: se ingirió y no hubo ninguna). Contradice la regla LOCKED de
   * `lobby-de-parlamentario.tsx:47`: "Un vacío es un HECHO, no una virtud: 'no
   * ingestado' ≠ 'ingestado, cero'".
   *
   * El fix es de TIPO, no de copy: el componente recibe el `CarrilEstado` completo y
   * OMITE la línea de conteo cuando el estado no es `dato` — espejo de
   * `cruces-capa1.tsx:28` (`{sector.nVotos > 0 && …}`), que ya resuelve el mismo
   * problema por omisión honesta. El 3-estado lo declara el rótulo del carril
   * (`conteoLabel`), que es su único emisor legítimo.
   */
  describe("5.11 — un estado no-`dato` JAMÁS se imprime como el hecho `0 reuniones`", () => {
    it("`no_ingerido`: omite la línea de conteo (no fabrica un dígito)", () => {
      const { container } = render(
        <LobbyCapa1 topMaterias={[]} estado={{ tipo: "no_ingerido" }} />,
      );
      expect(container.textContent ?? "").not.toMatch(/reuni[óo]n/i);
      expect(container.textContent ?? "").not.toMatch(/\d/);
    });

    it("`vacio`: omite la línea de conteo (ingestado y cero lo declara el rótulo)", () => {
      const { container } = render(
        <LobbyCapa1 topMaterias={[]} estado={{ tipo: "vacio" }} />,
      );
      expect(container.textContent ?? "").not.toMatch(/reuni[óo]n/i);
      expect(container.textContent ?? "").not.toMatch(/\d/);
    });

    it("`pendiente`: omite la línea de conteo", () => {
      const { container } = render(
        <LobbyCapa1 topMaterias={[]} estado={{ tipo: "pendiente" }} />,
      );
      expect(container.textContent ?? "").not.toMatch(/reuni[óo]n/i);
    });

    it("`dato` con n=0 SÍ declara el cero (cero honesto, nunca se rellena ni se oculta)", () => {
      const { container } = render(
        <LobbyCapa1 topMaterias={[]} estado={{ tipo: "dato", n: 0 }} />,
      );
      expect(container.textContent ?? "").toMatch(/0\s*reuniones/);
    });

    it("`dato` con n=1 usa el singular", () => {
      const { container } = render(
        <LobbyCapa1 topMaterias={[]} estado={{ tipo: "dato", n: 1 }} />,
      );
      expect(container.textContent ?? "").toMatch(/1\s*reunión/);
    });
  });

  /**
   * CR-01 del code-review de 122 — el fix de 5.11 quitó el dígito fabricado y dejó
   * en pie, para el MISMO estado `no_ingerido`, una afirmación de ausencia atribuida
   * a la fuente: «Aún no hay materias publicadas EN LAS FUENTES CONSULTADAS.»
   *
   * El fallback `top.length === 0` renderizaba incondicionalmente, sin mirar
   * `estado.tipo`. Con `no_ingerido` (el caso de `/parlamentario/S1338`: 0 audiencias
   * y 0 filas de marcador) esa frase era el ÚNICO contenido de la capa-1 y afirmaba
   * un hecho sobre una fuente que NUNCA se consultó — misma clase de defecto (riesgo
   * #1: ausencia falsa con atribución de fuente) que la fila 5.11 existía para cerrar.
   *
   * Regla: la ausencia sólo se declara cuando SÍ se observó. Un estado no-`dato` no
   * emite prosa de ausencia; el 3-estado lo declara `conteoLabel`, su único emisor.
   */
  describe("CR-01 — un estado no-`dato` JAMÁS afirma una ausencia EN LA FUENTE", () => {
    for (const tipo of ["no_ingerido", "vacio", "pendiente"] as const) {
      it(`\`${tipo}\`: no atribuye la ausencia a la fuente`, () => {
        const { container } = render(
          <LobbyCapa1 topMaterias={[]} estado={{ tipo }} />,
        );
        const texto = container.textContent ?? "";
        expect(texto).not.toMatch(/fuentes consultadas/i);
        expect(texto).not.toMatch(/a[úu]n no hay/i);
      });
    }

    it("`dato` sin materias SÍ declara la ausencia observada (no se oculta)", () => {
      const { container } = render(
        <LobbyCapa1 topMaterias={[]} estado={{ tipo: "dato", n: 4 }} />,
      );
      expect(container.textContent ?? "").toMatch(/fuentes consultadas/i);
    });
  });

  it("CERO vocabulario causal/insinuante (negative-match §9.1)", () => {
    const { container } = render(<LobbyCapa1 topMaterias={fixture()} estado={{ tipo: "dato", n: 10 }} />);
    expect(container.textContent ?? "").not.toMatch(PROHIBIDO);
  });
});
