// parse-infoprobidad.test — golden del parser contra el fixture SPARQL-JSON REAL de InfoProbidad.
//
// Verifica (INT-03/INT-04): (a) keying por (fuenteId, fechaPresentacion); (b) un declarante con
// ≥2 fechas → ≥2 versiones (versioning nativo, NO se colapsan); (c) cada versión lleva
// licencia CC BY 4.0; (d) los familiares se extraen anidados (crudos); (e) una fila malformada
// (sin fecha) se descarta sin fabricar; (f) el parser NO importa @obs/llm (assertion de imports).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseDeclaraciones } from "./parse-infoprobidad";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(here, "..", "test", "fixtures", "declaraciones-sparql.json");

function cargarFixture() {
  const json = JSON.parse(readFileSync(FIXTURE, "utf8"));
  return parseDeclaraciones(json, {
    enlace: "https://datos.cplt.cl/sparql",
    fechaCaptura: "2026-06-19T00:00:00Z",
  });
}

describe("parse-infoprobidad — golden del fixture SPARQL-JSON real", () => {
  it("(a) keya cada versión por (fuenteId, fechaPresentacion)", () => {
    const decls = cargarFixture();
    // 5 versiones reales (la última fila, sin fecha, se descarta como drift).
    expect(decls.length).toBe(5);
    const claves = decls.map((d) => `${d.fuenteId}∥${d.fechaPresentacion}`);
    // Todas las claves son únicas (ninguna versión colapsada).
    expect(new Set(claves).size).toBe(5);
    // El fuenteId es la URI del nodo Declaracion (no identificadorFuente).
    expect(decls.every((d) => d.fuenteId.includes("/declaracion_"))).toBe(true);
    // La fecha de presentación quedó como date ISO YYYY-MM-DD.
    expect(decls.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.fechaPresentacion))).toBe(true);
  });

  it("(b) un declarante con ≥2 fechas → ≥2 versiones (versioning INT-04, no se colapsan)", () => {
    const decls = cargarFixture();
    // Todas son del mismo declarante.
    expect(decls.every((d) => d.declaranteNombre === "CARLOS ANTONIO KARIM BIANCHI CHELECH")).toBe(true);
    const fechas = new Set(decls.map((d) => d.fechaPresentacion));
    // Al menos 2 fechas distintas → al menos 2 versiones.
    expect(fechas.size).toBeGreaterThanOrEqual(2);
    // La versión más reciente NO sobreescribió a las viejas: ambas coexisten.
    expect(fechas.has("2026-03-30")).toBe(true);
    expect(fechas.has("2021-08-19")).toBe(true);
  });

  it("(c) cada versión lleva licencia CC BY 4.0 + origen + el tipo resuelto (OQ3)", () => {
    const decls = cargarFixture();
    expect(decls.every((d) => d.licencia === "CC BY 4.0")).toBe(true);
    expect(decls.every((d) => d.origen === "infoprobidad-sparql")).toBe(true);
    // El tipo es el rdfs:label resuelto (no la URI cruda).
    const v2026 = decls.find((d) => d.fechaPresentacion === "2026-03-30")!;
    expect(v2026.tipo).toBe("ACTUALIZACIÓN PERIÓDICA (MARZO)");
  });

  it("bienes inmuebles literales se extraen anidados (VERBATIM, sin computar)", () => {
    const decls = cargarFixture();
    const v = decls.find((d) => d.fechaPresentacion === "2026-03-30")!;
    expect(v.bienes.inmuebles.length).toBe(2);
    const ubic = v.bienes.inmuebles.map((b) => b.ubicadoEn).sort();
    expect(ubic).toEqual(["HUERTO FAMILIAR 120 LOTE D 3", "JOSE MIGUEL CARRERA 375 "]);
    // El rol de avalúo se guarda VERBATIM como string (no se computa).
    expect(v.bienes.inmuebles.some((b) => b.rolAvaluo === "1011-99")).toBe(true);
  });

  it("(d) los familiares se extraen anidados crudos (deny-by-default, sin enlace)", () => {
    const decls = cargarFixture();
    const v = decls.find((d) => d.fechaPresentacion === "2026-03-30")!;
    expect(v.familiares.length).toBe(1);
    expect(v.familiares[0]!.relacion).toContain("esConyugeDe");
    // El familiar es texto crudo: ninguna forma de enlace a una persona.
    expect(v.familiares[0]).not.toHaveProperty("parlamentarioId");
    expect(v.familiares[0]).not.toHaveProperty("personaId");
  });

  it("(e) una fila sin fecha se descarta (drift) sin fabricar una versión", () => {
    const decls = cargarFixture();
    expect(decls.some((d) => d.fuenteId.includes("SIN_FECHA"))).toBe(false);
  });

  it("una fuente vacía produce 0 declaraciones (nunca inventa)", () => {
    expect(parseDeclaraciones({ head: { vars: [] }, results: { bindings: [] } })).toEqual([]);
  });

  it("(f) el árbol de imports del parser NO importa el paquete de modelos de lenguaje (contenido estructurado → sin LLM)", () => {
    const parserSrc = readFileSync(join(here, "parse-infoprobidad.ts"), "utf8");
    const sparqlSrc = readFileSync(join(here, "sparql.ts"), "utf8");
    const modelSrc = readFileSync(join(here, "model.ts"), "utf8");
    // Detecta SOLO sentencias `import ... from "@obs/llm"` (no menciones en comentarios).
    const importLlm = /\bfrom\s+["']@obs\/llm["']|\brequire\(\s*["']@obs\/llm["']\s*\)|\bimport\(\s*["']@obs\/llm["']\s*\)/;
    for (const src of [parserSrc, sparqlSrc, modelSrc]) {
      expect(importLlm.test(src)).toBe(false);
    }
  });
});
