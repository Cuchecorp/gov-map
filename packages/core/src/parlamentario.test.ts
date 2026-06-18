import { describe, it, expect } from "vitest";
import { ParlamentarioSeedSchema, type Parlamentario } from "./parlamentario";

function fila(overrides: Partial<Parlamentario>): Parlamentario {
  return {
    id: "S1",
    nombre_normalizado: "araya pedro",
    nombres: "Pedro",
    apellido_paterno: "Araya",
    apellido_materno: "Guerrero",
    camara: "senado",
    periodo: "senado-vigente-2026",
    region: "Región de Antofagasta",
    distrito: null,
    circunscripcion: "3",
    partido: "P.P.D.",
    rut: null,
    parlid_senado: "1110",
    id_diputado_camara: null,
    estado: "no_confirmado",
    email: "paraya@senado.cl",
    origen: "senado",
    fecha_captura: "2026-06-18T00:00:00.000Z",
    enlace: "https://tramitacion.senado.cl/wspublico/senadores_vigentes.php",
    ...overrides,
  };
}

describe("ParlamentarioSeedSchema — WR-06 (forma y cotas de campos libres)", () => {
  it("acepta una fila válida con email bien formado", () => {
    expect(() => ParlamentarioSeedSchema.parse(fila({}))).not.toThrow();
  });

  it("acepta email vacío '' (nodo vacío del catálogo) y null", () => {
    expect(() => ParlamentarioSeedSchema.parse(fila({ email: "" }))).not.toThrow();
    expect(() => ParlamentarioSeedSchema.parse(fila({ email: null }))).not.toThrow();
  });

  it("RECHAZA un email mal formado (basura / campo mis-mapeado)", () => {
    expect(() => ParlamentarioSeedSchema.parse(fila({ email: "esto no es un email" }))).toThrow();
    expect(() => ParlamentarioSeedSchema.parse(fila({ email: "@@@" }))).toThrow();
  });

  it("RECHAZA un nombre absurdamente largo (CURRICULUM mal mapeado)", () => {
    const blob = "x".repeat(5000);
    expect(() => ParlamentarioSeedSchema.parse(fila({ nombres: blob }))).toThrow();
  });

  it("RECHAZA un partido fuera de cota de longitud", () => {
    expect(() => ParlamentarioSeedSchema.parse(fila({ partido: "y".repeat(500) }))).toThrow();
  });
});
