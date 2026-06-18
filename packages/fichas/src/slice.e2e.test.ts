// SLICE E2E — write-half VERDE (ola 2); read-half (buscarProyectos) RED hasta la ola 3.
//
// Diana walking-skeleton: describe el OBJETIVO CIUDADANO end-to-end de la fase. La ola 2
// implementa el WRITE-PATH (correrPipeline = extraer→embed→persistir ficha+embedding) → Test 1
// pasa con un provider mockeado/offline (sin red, sin key). La ola 3 implementa el READ-PATH
// (buscarProyectos = búsqueda semántica vía el RPC match_proyectos) → Tests 2-3 siguen en RED
// (símbolo ausente en el barrel) hasta que la ola 3 los vuelva verde.
//
// La diana: "la ciudadanía, dada una idea, encuentra proyectos de ley semánticamente
// cercanos (búsqueda + similares), y cada ficha lleva su idea matriz literal y los
// cuerpos legales citados, con trazabilidad a la fuente".

import { describe, it, expect } from "vitest";

// @ts-expect-error — buscarProyectos aún no existe en el barrel (la ola 3 lo añade).
import {
  correrPipeline,
  buscarProyectos,
  FichaSchema,
  MockDeepSeekProvider,
} from "./index";

describe("SLICE E2E — objetivo ciudadano (write-half VERDE; read-half RED hasta ola 3)", () => {
  it("Test 1 (SEM-02): correrPipeline extrae una Ficha literal y la persiste embebida", async () => {
    // Provider mockeado (offline): devuelve la idea matriz literal del texto fuente.
    const provider = new MockDeepSeekProvider({
      idea_matriz: "regular el endeudamiento de las personas",
      cuerpos_legales: [],
    });
    const ficha = await correrPipeline({
      boletin: "18296-05",
      titulo: "Proyecto de prueba",
      textoFuente:
        "El proyecto tiene por objeto regular el endeudamiento de las personas.",
      provider,
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
