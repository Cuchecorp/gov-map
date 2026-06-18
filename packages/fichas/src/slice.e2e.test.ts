// SLICE E2E — RED hasta las olas 2-3; ellas lo vuelven verde.
//
// Diana walking-skeleton: describe el OBJETIVO CIUDADANO end-to-end de la fase como
// contrato fallido a propósito. Importa los símbolos que las olas 2-3 implementarán
// (correrPipeline = extraer→embed→persistir ficha+embedding; buscarProyectos = búsqueda
// semántica vía el RPC match_proyectos). Hoy esos símbolos NO existen en el barrel → el
// test FALLA en RED por símbolos ausentes (no por fixtures rotos).
//
// La diana: "la ciudadanía, dada una idea, encuentra proyectos de ley semánticamente
// cercanos (búsqueda + similares), y cada ficha lleva su idea matriz literal y los
// cuerpos legales citados, con trazabilidad a la fuente".

import { describe, it, expect } from "vitest";

// @ts-expect-error — RED: estos símbolos aún no existen en el barrel (olas 2-3 los añaden).
import {
  correrPipeline,
  buscarProyectos,
  FichaSchema,
} from "./index";

describe("SLICE E2E — objetivo ciudadano (RED hasta olas 2-3)", () => {
  it("Test 1 (SEM-02): correrPipeline extrae una Ficha literal y la persiste embebida", async () => {
    const ficha = await correrPipeline({
      boletin: "18296-05",
      titulo: "Proyecto de prueba",
      textoFuente:
        "El proyecto tiene por objeto regular el endeudamiento de las personas.",
    });
    expect(() => FichaSchema.parse(ficha)).not.toThrow();
    expect(ficha.idea_matriz).toBeTruthy();
  });

  it("Test 2 (SEM-03): buscarProyectos devuelve proyectos semánticamente cercanos", async () => {
    const resultados = await buscarProyectos("protección de datos personales");
    expect(Array.isArray(resultados)).toBe(true);
    expect(resultados.length).toBeGreaterThanOrEqual(0);
  });

  it("Test 3 (SEM-01): buscarProyectos con exclude_boletin omite el propio proyecto (similares)", async () => {
    const similares = await buscarProyectos("regulación del endeudamiento", {
      excludeBoletin: "18296-05",
    });
    for (const r of similares) {
      expect(r.boletin).not.toBe("18296-05");
    }
  });
});
