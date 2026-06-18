import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Parlamentario } from "@obs/core";
import {
  Fetcher,
  HostRateLimiter,
  RobotsGuard,
} from "@obs/ingest";
import {
  runSeeder,
  upsertMaestra,
  reconciliarMaestra,
  vigentesDeCatalogo,
  derivarClaveEstricta,
  type MaestraWriter,
} from "./seeder";

const SENADO_XML = readFileSync(
  fileURLToPath(new URL("../test/fixtures/senado-real.xml", import.meta.url)),
  "utf8",
);
const CAMARA_XML = readFileSync(
  fileURLToPath(new URL("../test/fixtures/camara-real.xml", import.meta.url)),
  "utf8",
);

/** Writer fake in-memory: upsert por clave natural (parlid_senado / id_diputado_camara). */
function fakeWriter(): MaestraWriter & { rows: Map<string, Parlamentario> } {
  const rows = new Map<string, Parlamentario>();
  const keyOf = (p: Parlamentario) =>
    p.parlid_senado != null ? `S:${p.parlid_senado}` : `D:${p.id_diputado_camara}`;
  return {
    rows,
    async upsert(batch: Parlamentario[]) {
      for (const p of batch) rows.set(keyOf(p), p);
    },
  };
}

/** fetchFn mock que devuelve el fixture correcto según el host de la URL, sin red. */
function mockFetch(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    let body: string;
    if (url.includes("senado.cl")) body = SENADO_XML;
    else if (url.includes("camara.cl") && url.includes("WSDiputado")) body = CAMARA_XML;
    else if (url.endsWith("/robots.txt")) {
      return new Response("", { status: 404 });
    } else {
      return new Response("not found", { status: 404 });
    }
    return new Response(body, { status: 200 });
  }) as typeof fetch;
}

function makeDeps() {
  const fetchFn = mockFetch();
  return {
    fetcher: new Fetcher({ fetchFn }),
    rateLimiter: new HostRateLimiter({ minDelayMs: 0, jitterMs: 0 }),
    robots: new RobotsGuard({ fetchFn }),
  };
}

describe("runSeeder", () => {
  it("combina ambos catálogos (31 senadores + 155 diputados = 186)", async () => {
    const rows = await runSeeder(makeDeps());
    expect(rows.length).toBe(186);
    expect(rows.filter((r) => r.camara === "senado").length).toBe(31);
    expect(rows.filter((r) => r.camara === "diputados").length).toBe(155);
  });

  it("captura provenance (origen, fecha_captura, enlace) por fila", async () => {
    const rows = await runSeeder(makeDeps());
    for (const r of rows) {
      expect(r.origen === "senado" || r.origen === "diputados").toBe(true);
      expect(r.fecha_captura).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(r.enlace).toMatch(/^https:\/\//);
    }
  });

  it("corre matchDeterminista; NINGUNA fila se auto-confirma (compuerta humana)", async () => {
    const rows = await runSeeder(makeDeps());
    for (const r of rows) {
      expect(r.estado).not.toBe("confirmado");
    }
  });
});

describe("reconciliarMaestra (IN-01: la Resolution NO se descarta)", () => {
  it("devuelve una Resolution por cada fila, indexada por id", async () => {
    const rows = await runSeeder(makeDeps());
    const audit = reconciliarMaestra(rows);
    expect(audit.size).toBe(rows.length);
    for (const r of rows) {
      expect(audit.has(r.id)).toBe(true);
    }
  });

  it("ninguna fila auto-confirmada por el seeder muta su estado a 'confirmado'", async () => {
    const rows = await runSeeder(makeDeps());
    reconciliarMaestra(rows); // pura: no muta
    for (const r of rows) expect(r.estado).toBe("no_confirmado");
  });

  it("WR-01: un homónimo materno-less con materno distinto SÍ se confirma por clave estricta", () => {
    const base = {
      camara: "diputados" as const,
      periodo: "2026-2030",
      origen: "diputados",
      fecha_captura: "2026-06-18T00:00:00.000Z",
      enlace: "https://example.test",
      estado: "no_confirmado" as const,
      region: null, distrito: null, circunscripcion: null, partido: null,
      rut: null, parlid_senado: null, email: null,
    };
    // Mismo paterno + nombres (nombre_normalizado = "juan perez"), distinto materno.
    const a: Parlamentario = {
      ...base, id: "D1", id_diputado_camara: "1",
      nombres: "Juan", apellido_paterno: "Perez", apellido_materno: "Gonzalez",
      nombre_normalizado: "juan perez",
    };
    const b: Parlamentario = {
      ...base, id: "D2", id_diputado_camara: "2",
      nombres: "Juan", apellido_paterno: "Perez", apellido_materno: "Soto",
      nombre_normalizado: "juan perez",
    };
    // Precondición: derivamos clave estricta distinta.
    expect(derivarClaveEstricta(a)).not.toBe(derivarClaveEstricta(b));
    const audit = reconciliarMaestra([a, b]);
    // Ambos se distinguen por materno → confirmados por nombre-estricto.
    expect(audit.get("D1")).toMatchObject({ estado: "confirmado" });
    expect(audit.get("D2")).toMatchObject({ estado: "confirmado" });
  });
});

describe("vigentesDeCatalogo (CR-01 regla seed-catalog)", () => {
  it("incluye TODA fila proveniente de los catálogos oficiales (senado/diputados)", async () => {
    const rows = await runSeeder(makeDeps());
    const ids = vigentesDeCatalogo(rows);
    // Los 186 vigentes provienen del catálogo autoritativo → todos confirmables por la regla.
    expect(ids.size).toBe(rows.length);
    expect(ids.size).toBe(186);
  });

  it("NO incluye filas de un origen foráneo (votación/InfoProbidad)", async () => {
    const rows = await runSeeder(makeDeps());
    const foraneo = { ...rows[0]!, id: "X-foraneo", origen: "votacion" };
    const ids = vigentesDeCatalogo([...rows, foraneo]);
    expect(ids.has("X-foraneo")).toBe(false);
  });
});

describe("upsertMaestra (idempotencia)", () => {
  it("correr 2× con el mismo input deja el mismo estado (sin duplicados)", async () => {
    const rows = await runSeeder(makeDeps());
    const writer = fakeWriter();

    await upsertMaestra(rows, writer);
    const sizeAfter1 = writer.rows.size;

    await upsertMaestra(rows, writer);
    const sizeAfter2 = writer.rows.size;

    expect(sizeAfter1).toBe(186);
    expect(sizeAfter2).toBe(186); // idempotente: sin duplicados
  });
});
