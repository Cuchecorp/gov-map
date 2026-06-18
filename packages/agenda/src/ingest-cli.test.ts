// ingest-cli.test — los flags se validan ANTES de tocar red/DB; el rango de semanas se enumera
// correctamente; sin service key la corrida degrada a dry-run.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseArgs, parseSemanaIso, main, IngestCliArgsError } from "./ingest-cli";
import { CAMARA_TABLA_PDF_URL } from "./connector-camara";
import type { CitacionesCamaraConnector } from "./connector-camara";
import type { SenadoActividadConnector } from "./connector-senado";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures");
const leer = (f: string) => readFileSync(join(FIXTURES, f), "utf8");

/** Conectores fake (sin red) para los tests hermenéuticos de `main`. */
function fakeConectores() {
  const camara = {
    fetchSemana: async () => leer("camara-citaciones-semana.html"),
    fetchPdfTabla: () => ({ url: CAMARA_TABLA_PDF_URL, content_type: "application/pdf" }),
  } as unknown as CitacionesCamaraConnector;
  const senado = {
    fetchCitaciones: async () => leer("senado-commissions-citations.json"),
    fetchTablaSala: async () => leer("senado-weekly-table.json"),
  } as unknown as SenadoActividadConnector;
  return { conectorCamara: camara, conectorSenado: senado };
}

describe("parseSemanaIso — validación de YYYY-Www", () => {
  it("acepta una semana ISO válida", () => {
    expect(parseSemanaIso("2026-W25", "--desde")).toEqual({ year: 2026, week: 25 });
    expect(parseSemanaIso("2026-W05", "--desde")).toEqual({ year: 2026, week: 5 });
  });

  it("rechaza formatos inválidos ANTES de cualquier red/DB", () => {
    expect(() => parseSemanaIso("2026-25", "--desde")).toThrow(IngestCliArgsError);
    expect(() => parseSemanaIso("basura", "--desde")).toThrow(IngestCliArgsError);
    expect(() => parseSemanaIso(undefined, "--desde")).toThrow(IngestCliArgsError);
    expect(() => parseSemanaIso("2026-W99", "--desde")).toThrow(/semana fuera de rango/);
    expect(() => parseSemanaIso("1800-W01", "--desde")).toThrow(/año fuera de rango/);
  });
});

describe("parseArgs — flags validados antes de red/DB", () => {
  it("parsea --desde/--hasta/--solo-senado/--dry-run", () => {
    const opts = parseArgs([
      "--desde",
      "2026-W20",
      "--hasta",
      "2026-W25",
      "--solo-senado",
      "--dry-run",
    ]);
    expect(opts.desde).toEqual({ year: 2026, week: 20 });
    expect(opts.hasta).toEqual({ year: 2026, week: 25 });
    expect(opts.soloSenado).toBe(true);
    expect(opts.dryRun).toBe(true);
  });

  it("rechaza un flag desconocido", () => {
    expect(() => parseArgs(["--no-existe"])).toThrow(IngestCliArgsError);
  });

  it("rechaza --hasta anterior a --desde (validación cruzada, antes de red)", () => {
    expect(() => parseArgs(["--desde", "2026-W25", "--hasta", "2026-W20"])).toThrow(
      IngestCliArgsError,
    );
  });
});

describe("main — sin service key degrada a dry-run (no toca DB)", () => {
  it("corre en dry-run con InMemory writer cuando no hay service key", async () => {
    const logs: string[] = [];
    const res = await main({
      desde: { year: 2026, week: 24 },
      hasta: { year: 2026, week: 25 },
      serviceKey: "",
      conectores: fakeConectores(),
      log: (m) => logs.push(m),
    });

    expect(res.dryRun).toBe(true);
    expect(res.dbLoaded).toBe(false);
    expect(res.semanas).toEqual(["2026-W24", "2026-W25"]); // backfill del rango
    expect(logs.some((l) => l.includes("DRY-RUN"))).toBe(true);
    // Corrió la ingesta (dry-run) con datos reales de los fixtures.
    expect(res.senadoCitaciones).toBeGreaterThanOrEqual(1);
  });

  it("--solo-senado no toca Cámara aún con conectores presentes", async () => {
    let camaraTocada = false;
    const conectores = fakeConectores();
    const orig = conectores.conectorCamara.fetchSemana.bind(conectores.conectorCamara);
    conectores.conectorCamara.fetchSemana = async (y: number, w: number) => {
      camaraTocada = true;
      return orig(y, w);
    };

    const res = await main({
      desde: { year: 2026, week: 25 },
      soloSenado: true,
      serviceKey: "",
      conectores,
      log: () => {},
    });

    expect(camaraTocada).toBe(false);
    expect(res.camaraCitaciones).toBe(0);
  });
});
