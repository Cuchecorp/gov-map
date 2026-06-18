import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ParlamentarioSeedSchema } from "@obs/core";
import { parseSenado } from "./parse-senado";

const FIXTURE = readFileSync(
  fileURLToPath(new URL("../test/fixtures/senado-real.xml", import.meta.url)),
  "utf8",
);

describe("parseSenado (fixture real)", () => {
  it("parsea los senadores del XML real con camara='senado'", () => {
    const rows = parseSenado(FIXTURE);
    // El fixture real capturado live trae 31 <senador>.
    expect(rows.length).toBe(31);
    for (const r of rows) {
      expect(r.camara).toBe("senado");
    }
  });

  it("mapea PARLID, apellidos, nombres, region, circunscripcion, partido, email", () => {
    const rows = parseSenado(FIXTURE);
    // Primer senador del fixture: Araya Guerrero, Pedro (PARLID 1110).
    const araya = rows.find((r) => r.parlid_senado === "1110");
    expect(araya).toBeDefined();
    expect(araya!.apellido_paterno).toBe("Araya");
    expect(araya!.apellido_materno).toBe("Guerrero");
    expect(araya!.nombres).toBe("Pedro");
    expect(araya!.region).toBe("Región de Antofagasta");
    expect(araya!.circunscripcion).toBe("3");
    expect(araya!.partido).toBe("P.P.D.");
    expect(araya!.email).toBe("paraya@senado.cl");
    expect(araya!.distrito).toBeNull();
    expect(araya!.rut).toBeNull();
    expect(araya!.id_diputado_camara).toBeNull();
  });

  it("corre normalizarNombre: el nombre_normalizado existe y excluye el materno", () => {
    const rows = parseSenado(FIXTURE);
    const araya = rows.find((r) => r.parlid_senado === "1110")!;
    // Clave canonica = paterno + nombres, ordenada, sin acentos. Materno (Guerrero) -> alias.
    expect(araya.nombre_normalizado).toBe("araya pedro");
  });

  it("cada fila valida ParlamentarioSeedSchema (zod)", () => {
    const rows = parseSenado(FIXTURE);
    for (const r of rows) {
      expect(() => ParlamentarioSeedSchema.parse(r)).not.toThrow();
    }
  });

  it("estado inicial NO es 'confirmado' (compuerta humana)", () => {
    const rows = parseSenado(FIXTURE);
    for (const r of rows) {
      expect(r.estado).not.toBe("confirmado");
    }
  });
});

describe("parseSenado — robustez (CR-03, WR-05)", () => {
  function xmlSenado(inner: string): string {
    return `<?xml version="1.0"?><senadores>${inner}</senadores>`;
  }
  function senador(opts: { parlid?: string }): string {
    const id = opts.parlid != null ? `<PARLID>${opts.parlid}</PARLID>` : "";
    return `<senador>${id}<PARLAPELLIDOPATERNO>Apellido</PARLAPELLIDOPATERNO><PARLAPELLIDOMATERNO>Materno</PARLAPELLIDOMATERNO><PARLNOMBRE>Test</PARLNOMBRE><PARTIDO>X</PARTIDO></senador>`;
  }
  function relleno(n: number): string {
    return Array.from({ length: n }, (_, i) => senador({ parlid: String(5000 + i) })).join("");
  }

  it("CR-03: un <senador> sin PARLID LANZA (no fabrica id colisionable 'S?')", () => {
    const xml = xmlSenado(relleno(12) + senador({}));
    expect(() => parseSenado(xml)).toThrow(/sin PARLID/);
  });

  it("WR-05: conteo implausiblemente bajo (< 10) LANZA en vez de devolver snapshot recortado", () => {
    const xml = xmlSenado(relleno(3));
    expect(() => parseSenado(xml)).toThrow(/XML inesperado/);
  });
});
