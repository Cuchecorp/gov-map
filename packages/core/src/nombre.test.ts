import { describe, it, expect } from "vitest";
import { normalizarNombre } from "./nombre";

describe("normalizarNombre — convergencia catálogo ↔ formato votación", () => {
  it("produce el MISMO nombre_normalizado desde campos de catálogo y desde 'Apellido P., Nombre'", () => {
    // Catálogo (campos estructurados) — Senado: senador con materno completo
    const catalogo = normalizarNombre({
      nombres: "Juan Pablo",
      apellidoPaterno: "Muñoz",
      apellidoMaterno: "Pérez",
    });
    // Formato votación del Senado: paterno + inicial del materno + nombre
    const votacion = normalizarNombre({ libre: "Muñoz P., Juan Pablo" });

    expect(votacion.nombre_normalizado).toBe(catalogo.nombre_normalizado);
  });

  it("converge aunque el orden de los nombres difiera (clave canónica estable)", () => {
    const a = normalizarNombre({ nombres: "Maria Jose", apellidoPaterno: "Vega", apellidoMaterno: "Soto" });
    const b = normalizarNombre({ libre: "Vega S., Jose Maria" });
    expect(b.nombre_normalizado).toBe(a.nombre_normalizado);
  });
});

describe("normalizarNombre — folding ñ→n y acentos", () => {
  it("'Muñoz' y 'Munoz' colapsan al mismo token", () => {
    const conEñe = normalizarNombre({ apellidoPaterno: "Muñoz", nombres: "Ana" });
    const sinEñe = normalizarNombre({ apellidoPaterno: "Munoz", nombres: "Ana" });
    expect(conEñe.nombre_normalizado).toBe(sinEñe.nombre_normalizado);
  });

  it("'Núñez' y 'Nunez' colapsan al mismo token", () => {
    const a = normalizarNombre({ apellidoPaterno: "Núñez", nombres: "Jose" });
    const b = normalizarNombre({ apellidoPaterno: "Nunez", nombres: "Jose" });
    expect(a.nombre_normalizado).toBe(b.nombre_normalizado);
  });

  it("elimina acentos por NFD strip y aplica casefold a minúsculas", () => {
    const r = normalizarNombre({ nombres: "JOSÉ", apellidoPaterno: "GÓMEZ" });
    expect(r.tokens).toContain("jose");
    expect(r.tokens).toContain("gomez");
    expect(r.nombre_normalizado).toBe(r.nombre_normalizado.toLowerCase());
  });

  it("trata puntos y comas como separadores", () => {
    // Campos estructurados: puntuación residual no debe sobrevivir al fold.
    const r = normalizarNombre({ apellidoPaterno: "Gomez.", nombres: "Juan," });
    expect(r.tokens).toEqual(expect.arrayContaining(["gomez", "juan"]));
    expect(r.nombre_normalizado).not.toContain(".");
    expect(r.nombre_normalizado).not.toContain(",");
  });
});

describe("normalizarNombre — partículas y apellidos compuestos", () => {
  it("las partículas (de, del, la, los, y) NO entran en los tokens de blocking", () => {
    const r = normalizarNombre({ apellidoPaterno: "De la Fuente", nombres: "Carlos" });
    expect(r.tokens).not.toContain("de");
    expect(r.tokens).not.toContain("la");
    expect(r.tokens).toContain("fuente");
    expect(r.tokens).toContain("carlos");
  });

  it("apellido compuesto 'De la Fuente' conserva el apellido relevante", () => {
    const estructurado = normalizarNombre({
      apellidoPaterno: "De la Fuente",
      apellidoMaterno: "Rojas",
      nombres: "Carlos",
    });
    const votacion = normalizarNombre({ libre: "De la Fuente R., Carlos" });
    expect(votacion.nombre_normalizado).toBe(estructurado.nombre_normalizado);
  });
});

describe("normalizarNombre — estabilidad e independencia del orden", () => {
  it("nombre_normalizado es estable e independiente del orden de entrada (tokens ordenados)", () => {
    const r = normalizarNombre({ nombres: "Pablo Juan", apellidoPaterno: "Soto" });
    const tokensOrdenados = [...r.tokens].sort().join(" ");
    expect(r.nombre_normalizado).toBe(tokensOrdenados);
  });
});

describe("normalizarNombre — captura de alias (inicial del materno en formato votación)", () => {
  it("registra la inicial del materno como alias en formato 'Apellido P., Nombre'", () => {
    const r = normalizarNombre({ libre: "Muñoz P., Juan Pablo" });
    // la inicial del materno ('p') se captura como variante, no como token de blocking
    expect(r.alias_capturados.length).toBeGreaterThan(0);
    expect(r.tokens).not.toContain("p");
  });
});

describe("normalizarNombre — clave_estricta (WR-01: incluye el materno)", () => {
  it("la clave estricta INCLUYE el materno; el nombre_normalizado NO", () => {
    const r = normalizarNombre({
      nombres: "Juan",
      apellidoPaterno: "Perez",
      apellidoMaterno: "Gonzalez",
    });
    expect(r.nombre_normalizado).toBe("juan perez");
    expect(r.clave_estricta).toBe("gonzalez juan perez");
  });

  it("dos homónimos por nombre materno-less tienen clave_estricta DISTINTA si difieren en materno", () => {
    const a = normalizarNombre({ nombres: "Juan", apellidoPaterno: "Perez", apellidoMaterno: "Gonzalez" });
    const b = normalizarNombre({ nombres: "Juan", apellidoPaterno: "Perez", apellidoMaterno: "Soto" });
    expect(a.nombre_normalizado).toBe(b.nombre_normalizado); // colisión materno-less
    expect(a.clave_estricta).not.toBe(b.clave_estricta); // pero distinguibles por materno
  });

  it("sin materno, la clave estricta coincide con el nombre_normalizado (sin info espuria)", () => {
    const r = normalizarNombre({ nombres: "Ana", apellidoPaterno: "Gomez" });
    expect(r.clave_estricta).toBe(r.nombre_normalizado);
  });
});
