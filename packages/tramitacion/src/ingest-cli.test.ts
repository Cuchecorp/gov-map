// ingest-cli.test — runIngest con conectores FAKE + fixtures (sin red) + validación de flags.
//
// runIngest ensambla parsers + reconciliación + timeline + upsert. Con conectores fake que
// devuelven los fixtures reales y un writer espía (InMemory), verifica que produce
// proyecto/votaciones/votos/eventos y que re-correr es IDEMPOTENTE. El CLI valida flags ANTES
// de tocar la red/DB.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Parlamentario } from "@obs/core";
import { MockMiniMaxProvider } from "@obs/adjudication";
import { runIngest } from "./ingest-run";
import { InMemoryTramitacionWriter } from "./writer";
import { parseArgs, IngestCliArgsError } from "./ingest-cli";
import type { CamaraConnector } from "./connector-camara";
import type { SenadoConnector } from "./connector-senado";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures");
const leer = (f: string) => readFileSync(join(FIXTURES, f), "utf8");

const camaraVotacionXml = leer("camara-votacion-boletin.xml");
const camaraDetalleXml = leer("camara-votacion-detalle.xml");
const senadoTramitacionXml = leer("senado-tramitacion.xml");
const senadoVotacionXml = leer("senado-votacion.xml");

/** Conectores FAKE: devuelven fixtures sin tocar la red. */
function fakeConnectors() {
  const camara = {
    async descubrirBoletines() {
      return ["14309-04"];
    },
    async fetchVotacionesBoletin() {
      return camaraVotacionXml;
    },
    async fetchVotacionDetalle() {
      return camaraDetalleXml;
    },
  } as unknown as CamaraConnector;

  const senado = {
    async fetchTramitacion() {
      return senadoTramitacionXml;
    },
    async fetchVotaciones() {
      return senadoVotacionXml;
    },
  } as unknown as SenadoConnector;

  return { camara, senado };
}

describe("runIngest — orquestación acotada (conectores fake + fixtures)", () => {
  it("produce proyecto/votaciones/votos/eventos para un boletín cross-cámara", async () => {
    const { camara, senado } = fakeConnectors();
    const writer = new InMemoryTramitacionWriter();
    const maestra: Parlamentario[] = [];

    const res = await runIngest({
      boletines: ["14309-04"],
      maestra,
      camara,
      senado,
      writer,
      provider: new MockMiniMaxProvider({
        decision: "no_match",
        chosen_id: null,
        confidence: 0,
        evidence: [],
        conflicts: [],
      }),
    });

    expect(res.proyectos).toBe(1);
    expect(res.votaciones).toBeGreaterThanOrEqual(1);
    expect(res.votos).toBeGreaterThanOrEqual(1);
    expect(res.eventos).toBeGreaterThanOrEqual(1);
    // El writer recibió las filas (proyecto del Senado: 18296 no es el boletín; el efectivo
    // es el del Senado parseado o el de entrada — al menos 1 proyecto persistido).
    expect(writer.proyectos.size).toBe(1);
    expect(writer.votaciones.size).toBeGreaterThanOrEqual(1);
    expect(writer.votos.size).toBeGreaterThanOrEqual(1);
  });

  it("re-correr con el mismo input es IDEMPOTENTE (conteos estables)", async () => {
    const { camara, senado } = fakeConnectors();
    const writer = new InMemoryTramitacionWriter();
    const provider = new MockMiniMaxProvider({
      decision: "no_match",
      chosen_id: null,
      confidence: 0,
      evidence: [],
      conflicts: [],
    });

    const first = await runIngest({
      boletines: ["14309-04"],
      maestra: [],
      camara,
      senado,
      writer,
      provider,
    });
    const sizesAfterFirst = {
      proyectos: writer.proyectos.size,
      votaciones: writer.votaciones.size,
      votos: writer.votos.size,
      eventos: writer.eventos.size,
    };

    await runIngest({
      boletines: ["14309-04"],
      maestra: [],
      camara,
      senado,
      writer,
      provider,
    });

    // El writer upserta por clave natural → re-correr NO duplica.
    expect(writer.proyectos.size).toBe(sizesAfterFirst.proyectos);
    expect(writer.votaciones.size).toBe(sizesAfterFirst.votaciones);
    expect(writer.votos.size).toBe(sizesAfterFirst.votos);
    expect(writer.eventos.size).toBe(sizesAfterFirst.eventos);
    expect(first.proyectos).toBe(1);
  });

  it("guarda LOCKED: con maestra vacía, los votos del Senado quedan sin parlamentario_id", async () => {
    const { camara, senado } = fakeConnectors();
    const writer = new InMemoryTramitacionWriter();
    await runIngest({
      boletines: ["14309-04"],
      maestra: [],
      camara,
      senado,
      writer,
      provider: new MockMiniMaxProvider({
        decision: "no_match",
        chosen_id: null,
        confidence: 0,
        evidence: [],
        conflicts: [],
      }),
    });
    // Votos del Senado (camara senado) con maestra vacía → parlamentario_id null + mención cruda.
    const votosSenado = [...writer.votos.values()].filter(
      (v) => v.votacion_id.startsWith("senado:"),
    );
    expect(votosSenado.length).toBeGreaterThan(0);
    for (const v of votosSenado) {
      expect(v.parlamentario_id).toBeNull();
      expect(v.mencion_nombre).toBeTruthy();
    }
  });

  it("tolera una fuente que falla sin abortar la corrida (reporta el error)", async () => {
    const { senado } = fakeConnectors();
    const camaraRota = {
      async fetchVotacionesBoletin() {
        throw new Error("403 WAF");
      },
      async fetchVotacionDetalle() {
        throw new Error("403 WAF");
      },
    } as unknown as CamaraConnector;
    const writer = new InMemoryTramitacionWriter();

    const res = await runIngest({
      boletines: ["18296-05"],
      maestra: [],
      camara: camaraRota,
      senado,
      writer,
    });
    // La Cámara falla pero el Senado (tramitación) sigue → hay proyecto + errores reportados.
    expect(res.proyectos).toBe(1);
    expect(res.errores.some((e) => e.etapa === "camara-votaciones")).toBe(true);
  });
});

describe("parseArgs — validación de flags ANTES de red/DB", () => {
  it("acepta flags válidos", () => {
    const o = parseArgs(["--anno", "2026", "--limite", "5", "--dry-run"]);
    expect(o.anno).toBe(2026);
    expect(o.limite).toBe(5);
    expect(o.dryRun).toBe(true);
  });

  it("acepta --boletines como lista coma-separada", () => {
    const o = parseArgs(["--boletines", "14309-04, 18296-05 ,"]);
    expect(o.boletines).toEqual(["14309-04", "18296-05"]);
  });

  it("rechaza --anno fuera de rango", () => {
    expect(() => parseArgs(["--anno", "1800"])).toThrow(IngestCliArgsError);
  });

  it("rechaza --limite no positivo", () => {
    expect(() => parseArgs(["--limite", "0"])).toThrow(IngestCliArgsError);
    expect(() => parseArgs(["--limite", "abc"])).toThrow(IngestCliArgsError);
  });

  it("rechaza --boletines vacío y flags desconocidos", () => {
    expect(() => parseArgs(["--boletines", ""])).toThrow(IngestCliArgsError);
    expect(() => parseArgs(["--frobnicate"])).toThrow(IngestCliArgsError);
  });
});
