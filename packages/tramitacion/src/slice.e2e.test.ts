// SLICE E2E — RED hasta ola 4; las olas 2-3 lo vuelven verde.
//
// Este test describe el OBJETIVO CIUDADANO end-to-end de la fase como contrato fallido a
// propósito: importa los símbolos que las olas 2-4 implementarán (parsers de Cámara/Senado,
// fusión de timeline, reconciliación de votos del Senado). Hoy esos símbolos NO existen en
// el barrel → el test FALLA en RED por símbolos ausentes (no por fixtures rotos).
//
// La diana: "la ciudadanía ve, para un boletín, qué se votó (totales), cómo tramitó (timeline
// cruzando cámaras) y cómo votó cada parlamentario (cuando el vínculo es confirmado)".

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// @ts-expect-error — RED: estos símbolos aún no existen en el barrel (olas 2-4 los añaden).
import {
  parseCamaraVotacion,
  parseSenadoTramitacion,
  parseSenadoVotacion,
  fusionarTimeline,
  reconciliarVotosSenado,
} from "./index";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures");
const leer = (f: string) => readFileSync(join(FIXTURES, f), "utf8");

const camaraVotacionXml = leer("camara-votacion-boletin.xml");
const senadoTramitacionXml = leer("senado-tramitacion.xml");
const senadoVotacionXml = leer("senado-votacion.xml");

describe("SLICE E2E — objetivo ciudadano (RED hasta ola 4)", () => {
  it("Test 1 (TRAM-01/06): parseCamaraVotacion produce ≥1 Votacion con boletín 14309-04 y totales", () => {
    const votaciones = parseCamaraVotacion(camaraVotacionXml);
    expect(votaciones.length).toBeGreaterThanOrEqual(1);
    const v = votaciones[0];
    expect(v.boletin).toBe("14309-04");
    expect(typeof v.total_si).toBe("number");
    expect(typeof v.total_no).toBe("number");
    expect(typeof v.total_abstencion).toBe("number");
  });

  it("Test 2 (TRAM-02/04): parseSenadoTramitacion produce Proyecto con estado/etapa + ≥1 evento", () => {
    const { proyecto, eventos } = parseSenadoTramitacion(senadoTramitacionXml);
    expect(proyecto.boletin).toBe("18296-05");
    expect(proyecto.estado).toBeTruthy();
    expect(proyecto.etapa).toBeTruthy();
    expect(eventos.length).toBeGreaterThanOrEqual(1);
  });

  it("Test 3 (TRAM-05): fusionarTimeline ordena eventos de ambas cámaras por fecha ascendente", () => {
    const { eventos } = parseSenadoTramitacion(senadoTramitacionXml);
    const fusion = fusionarTimeline([eventos]);
    for (let i = 1; i < fusion.length; i++) {
      expect(new Date(fusion[i].fecha).getTime()).toBeGreaterThanOrEqual(
        new Date(fusion[i - 1].fecha).getTime(),
      );
    }
  });

  it("Test 4 (TRAM-06b/guarda): reconciliarVotosSenado vincula parlamentario_id solo si determinista/confirmado", async () => {
    const { votacion, votos } = parseSenadoVotacion(senadoVotacionXml);
    expect(votacion.camara).toBe("senado");
    const reconciliados = await reconciliarVotosSenado(votos, []);
    // Con maestra vacía nada resuelve determinísticamente → todos sin vínculo.
    for (const voto of reconciliados) {
      expect(voto.parlamentario_id).toBeNull();
      expect(voto.mencion_nombre).toBeTruthy(); // se conserva el nombre crudo para display
    }
  });
});
