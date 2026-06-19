// ingest-run.test — orquestación con DRIFT BLOQUEANTE + degradación honesta + nunca fabrica.
//
// (a) drift estructural → CUARENTENA (0 filas + degradación, NUNCA filas);
// (b) declarante inalcanzable (403/503) → degradación honesta sin abortar;
// (c) corrida idempotente (2× mismo input → conteos idénticos);
// (d) versioning end-to-end (≥2 fechas → ≥2 versiones persistidas);
// (e) nunca fabrica (fuente vacía → 0 filas).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { DriftStore } from "@obs/ingest";
import { fingerprint } from "@obs/ingest";
import { runIngestProbidad } from "./ingest-run";
import { InfoProbidadConnector, InfoProbidadBloqueadaError } from "./connector-infoprobidad";
import { InMemoryProbidadWriter } from "./writer";
import { parseDeclaraciones } from "./parse-infoprobidad";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_JSON = JSON.parse(
  readFileSync(join(here, "..", "test", "fixtures", "declaraciones-sparql.json"), "utf8"),
);

/** Conector fake: devuelve un JSON fijo, o lanza bloqueada, o JSON de forma inesperada. */
function fakeConector(opts: { json?: unknown; bloquea?: boolean }): InfoProbidadConnector {
  return {
    urlSparql(query: string) {
      return `https://datos.cplt.cl/sparql?query=${encodeURIComponent(query)}`;
    },
    async fetchSparql(_query: string) {
      if (opts.bloquea) throw new InfoProbidadBloqueadaError("url", 503);
      return opts.json ?? { head: { vars: [] }, results: { bindings: [] } };
    },
  } as unknown as InfoProbidadConnector;
}

/** DriftStore fake: fingerprint conocido prefijado + captura de alertas. */
function fakeDriftStore(known?: string): DriftStore & { alerts: unknown[] } {
  const alerts: unknown[] = [];
  return {
    alerts,
    async lastFingerprint() {
      return known;
    },
    async insertAlert(rec) {
      alerts.push(rec);
    },
  };
}

describe("runIngestProbidad — drift bloqueante + degradación honesta + nunca fabrica + versioning", () => {
  it("(a) drift estructural (forma cambió) → CUARENTENA: 0 filas + degradación, NUNCA escribe", async () => {
    const writer = new InMemoryProbidadWriter();
    const store = fakeDriftStore("fingerprint-viejo-que-no-coincide");
    const res = await runIngestProbidad({
      conector: fakeConector({ json: FIXTURE_JSON }),
      writer,
      maestra: [],
      tareas: [{ nombre: "bianchi chelech" }],
      driftStore: store,
    });

    expect(res.driftQuarantine).toBe(true);
    expect(res.declaraciones).toBe(0);
    expect(writer.declaraciones.size).toBe(0); // NUNCA escribió filas
    expect(res.degradaciones.some((d) => d.driftQuarantine === true)).toBe(true);
    expect(store.alerts.length).toBe(1); // registró la alerta de drift
  });

  it("(a') drift estructural por forma SPARQL-JSON inesperada (sin results.bindings) → CUARENTENA", async () => {
    const writer = new InMemoryProbidadWriter();
    const res = await runIngestProbidad({
      conector: fakeConector({ json: { unexpected: "shape" } }),
      writer,
      maestra: [],
      tareas: [{ nombre: "bianchi chelech" }],
    });
    expect(res.driftQuarantine).toBe(true);
    expect(res.declaraciones).toBe(0);
    expect(writer.declaraciones.size).toBe(0);
    expect(res.degradaciones.some((d) => d.driftQuarantine === true)).toBe(true);
  });

  it("primera corrida (sin fingerprint previo) NO es cuarentena: escribe + registra el golden", async () => {
    const writer = new InMemoryProbidadWriter();
    const store = fakeDriftStore(undefined);
    const res = await runIngestProbidad({
      conector: fakeConector({ json: FIXTURE_JSON }),
      writer,
      maestra: [],
      tareas: [{ nombre: "bianchi chelech" }],
      driftStore: store,
    });

    expect(res.driftQuarantine).toBe(false);
    expect(res.declaraciones).toBe(5); // 5 versiones reales del fixture
    expect(store.alerts.length).toBe(1);
  });

  it("(b) declarante inalcanzable (503) → degradación honesta, NO aborta, 0 filas", async () => {
    const writer = new InMemoryProbidadWriter();
    const res = await runIngestProbidad({
      conector: fakeConector({ bloquea: true }),
      writer,
      maestra: [],
      tareas: [{ nombre: "bianchi chelech" }],
    });

    expect(res.declaraciones).toBe(0);
    expect(res.errores.length).toBe(0); // bloqueada ≠ error: es degradación
    expect(res.degradaciones.length).toBe(1);
    expect(res.driftQuarantine).toBe(false);
    expect(writer.declaraciones.size).toBe(0);
  });

  it("(c) corrida idempotente: 2× el mismo input → conteos idénticos (versiones acumulan, no duplican)", async () => {
    const writer = new InMemoryProbidadWriter();
    const base = {
      conector: fakeConector({ json: FIXTURE_JSON }),
      writer,
      maestra: [],
      tareas: [{ nombre: "bianchi chelech" }],
    };
    const r1 = await runIngestProbidad(base);
    const size1 = writer.declaraciones.size;
    const r2 = await runIngestProbidad(base);

    expect(r1.declaraciones).toBe(r2.declaraciones);
    expect(writer.declaraciones.size).toBe(size1); // no creció
    expect(size1).toBe(5);
  });

  it("(d) versioning end-to-end: ≥2 fechas → ≥2 versiones persistidas (no se colapsan)", async () => {
    const writer = new InMemoryProbidadWriter();
    await runIngestProbidad({
      conector: fakeConector({ json: FIXTURE_JSON }),
      writer,
      maestra: [],
      tareas: [{ nombre: "bianchi chelech" }],
    });
    const fechas = new Set([...writer.declaraciones.values()].map((d) => d.fecha_presentacion));
    expect(fechas.size).toBeGreaterThanOrEqual(2);
    expect(writer.declaraciones.size).toBe(5);
    // Cada versión persistida lleva la licencia CC BY 4.0.
    expect([...writer.declaraciones.values()].every((d) => d.licencia === "CC BY 4.0")).toBe(true);
  });

  it("(e) fuente vacía → 0 filas (NUNCA inventa)", async () => {
    const writer = new InMemoryProbidadWriter();
    const res = await runIngestProbidad({
      conector: fakeConector({ json: { head: { vars: [] }, results: { bindings: [] } } }),
      writer,
      maestra: [],
      tareas: [{ nombre: "inexistente" }],
    });
    expect(res.declaraciones).toBe(0);
    expect(writer.declaraciones.size).toBe(0);
  });

  it("sin drift (fingerprint coincide) → escribe normal", async () => {
    const decls = parseDeclaraciones(FIXTURE_JSON, { enlace: "x" });
    const fp = await fingerprint(decls[0]);
    const writer = new InMemoryProbidadWriter();
    const res = await runIngestProbidad({
      conector: fakeConector({ json: FIXTURE_JSON }),
      writer,
      maestra: [],
      tareas: [{ nombre: "bianchi chelech" }],
      driftStore: fakeDriftStore(fp),
    });
    expect(res.driftQuarantine).toBe(false);
    expect(res.declaraciones).toBe(5);
  });
});
