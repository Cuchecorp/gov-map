// ingest-run.test — orquestación con DRIFT BLOQUEANTE + degradación honesta + nunca fabrica.
//
// (a) drift estructural → CUARENTENA (0 filas + degradación, NUNCA filas);
// (b) institución inalcanzable (403/503) → degradación honesta sin abortar;
// (c) corrida idempotente (2× mismo input → conteos idénticos);
// (d) nunca fabrica (fuente vacía → 0 filas).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { DriftStore } from "@obs/ingest";
import { fingerprint } from "@obs/ingest";
import { runIngestLobby } from "./ingest-run";
import { LeylobbyConnector, LeylobbyBloqueadaError } from "./connector-leylobby";
import { InMemoryLobbyWriter } from "./writer";
import { parseLobbyAudiencias } from "./parse-leylobby";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_HTML = readFileSync(
  join(here, "..", "test", "fixtures", "audiencias-congreso.html"),
  "utf8",
);

/** Conector fake: devuelve un HTML fijo por (institución/año/página), o lanza bloqueada. */
function fakeConector(opts: { html?: string; bloquea?: boolean }): LeylobbyConnector {
  return {
    urlAudiencias(code: string, year: number, page = 1) {
      return `https://www.leylobby.gob.cl/instituciones/${code}/audiencias/${year}?page=${page}`;
    },
    async fetchAudiencias(_code: string, _year: number, _page = 1) {
      if (opts.bloquea) throw new LeylobbyBloqueadaError("url", 503);
      return opts.html ?? "<html></html>";
    },
  } as unknown as LeylobbyConnector;
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

describe("runIngestLobby — drift bloqueante + degradación honesta + nunca fabrica", () => {
  it("(a) drift estructural → CUARENTENA: 0 filas + degradación, NUNCA escribe", async () => {
    const writer = new InMemoryLobbyWriter();
    // Un fingerprint "conocido" DISTINTO al actual → drift → cuarentena.
    const store = fakeDriftStore("fingerprint-viejo-que-no-coincide");
    const res = await runIngestLobby({
      conector: fakeConector({ html: FIXTURE_HTML }),
      writer,
      maestra: [],
      tareas: [{ institucionCodigo: "AA001", year: 2024, pages: [1] }],
      driftStore: store,
    });

    expect(res.driftQuarantine).toBe(true);
    expect(res.audiencias).toBe(0);
    expect(writer.audiencias.size).toBe(0); // NUNCA escribió filas
    expect(res.degradaciones.some((d) => d.driftQuarantine === true)).toBe(true);
    // Registró la alerta de drift (el nuevo fingerprint) aunque no escribió filas.
    expect(store.alerts.length).toBe(1);
  });

  it("primera corrida (sin fingerprint previo) NO es cuarentena: escribe + registra el golden", async () => {
    const writer = new InMemoryLobbyWriter();
    const store = fakeDriftStore(undefined); // sin previo
    const res = await runIngestLobby({
      conector: fakeConector({ html: FIXTURE_HTML }),
      writer,
      maestra: [],
      tareas: [{ institucionCodigo: "AA001", year: 2024, pages: [1] }],
      driftStore: store,
    });

    expect(res.driftQuarantine).toBe(false);
    expect(res.audiencias).toBe(2);
    expect(store.alerts.length).toBe(1); // registró el fingerprint inicial
  });

  it("(b) institución inalcanzable (503) → degradación honesta, NO aborta, 0 filas", async () => {
    const writer = new InMemoryLobbyWriter();
    const res = await runIngestLobby({
      conector: fakeConector({ bloquea: true }),
      writer,
      maestra: [],
      tareas: [{ institucionCodigo: "AA001", year: 2024, pages: [1] }],
    });

    expect(res.audiencias).toBe(0);
    expect(res.errores.length).toBe(0); // bloqueada ≠ error: es degradación
    expect(res.degradaciones.length).toBe(1);
    expect(res.driftQuarantine).toBe(false);
    expect(writer.audiencias.size).toBe(0);
  });

  it("(c) corrida idempotente: 2× el mismo input → conteos idénticos", async () => {
    const writer = new InMemoryLobbyWriter();
    const base = {
      conector: fakeConector({ html: FIXTURE_HTML }),
      writer,
      maestra: [],
      tareas: [{ institucionCodigo: "AA001", year: 2024, pages: [1] }],
    };
    const r1 = await runIngestLobby(base);
    const sizeAud1 = writer.audiencias.size;
    const sizeCp1 = writer.contrapartes.size;
    const r2 = await runIngestLobby(base);

    expect(r1.audiencias).toBe(r2.audiencias);
    expect(writer.audiencias.size).toBe(sizeAud1); // no creció
    expect(writer.contrapartes.size).toBe(sizeCp1);
    expect(sizeAud1).toBe(2);
  });

  it("(d) fuente vacía → 0 filas (NUNCA inventa)", async () => {
    const writer = new InMemoryLobbyWriter();
    const res = await runIngestLobby({
      conector: fakeConector({ html: "<html><body><table class='table'><tbody></tbody></table></body></html>" }),
      writer,
      maestra: [],
      tareas: [{ institucionCodigo: "AA001", year: 2024, pages: [1] }],
    });
    expect(res.audiencias).toBe(0);
    expect(writer.audiencias.size).toBe(0);
  });

  it("sin drift (fingerprint coincide) → escribe normal", async () => {
    // Calcula el fingerprint real de la forma de la 1.ª audiencia y lo prefija como "conocido".
    const aud = parseLobbyAudiencias(FIXTURE_HTML, { institucionCodigo: "AA001" });
    const fp = await fingerprint(aud[0]);
    const writer = new InMemoryLobbyWriter();
    const res = await runIngestLobby({
      conector: fakeConector({ html: FIXTURE_HTML }),
      writer,
      maestra: [],
      tareas: [{ institucionCodigo: "AA001", year: 2024, pages: [1] }],
      driftStore: fakeDriftStore(fp),
    });
    expect(res.driftQuarantine).toBe(false);
    expect(res.audiencias).toBe(2);
  });
});
