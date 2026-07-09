// run-probidad-todos.test — bloque R2 Etapa-1 + SnapshotWriter (INGEST-04, Phase 34-02).
//
// Verifica el contrato del paso R2/snapshot AGREGADO por run añadido a `runProbidadTodos`:
//   * Con r2Store + snapshotWriter mock → UN putImmutable (crudo agregado) + UN write con las 8
//     columnas NOT NULL pobladas; r2Path = la key devuelta por putImmutable.
//   * r2Store.putImmutable que LANZA → r2Path null, snapshotWriter.write NO se llama, la corrida
//     termina normalmente (best-effort, NO fatal): el writer de declaraciones igual se invocó.
//   * Sin r2Store → comportamiento idéntico al actual (no R2, no snapshot), r2Path null. Sin regresión.
//
// El crudo SPARQL se mockea VACÍO (parser tolerante → 0 declaraciones): el foco es el bloque R2,
// desacoplado del parser/reconciliador. Un objetivo sin apellidos NO se consulta (no aporta al crudo).

import { describe, it, expect, vi } from "vitest";
import { runProbidadTodos } from "./run-probidad-todos";
import { InMemoryProbidadWriter } from "./writer";
import type { InfoProbidadConnector } from "./connector-infoprobidad";
import type { Parlamentario } from "@obs/core";
import type { R2Store, SnapshotWriter } from "@obs/ingest";

/** SPARQL-results vacío (head sin vars, bindings vacío): parser → 0 declaraciones. */
function sparqlVacio(): unknown {
  return { head: { vars: [] }, results: { bindings: [] } };
}

/** Conector mock: cada fetchSparql devuelve el JSON vacío; urlSparql es determinista. */
function mockConector(onFetch?: (q: string) => unknown): InfoProbidadConnector {
  return {
    urlSparql: (q: string) => `https://datos.cplt.cl/sparql?query=${encodeURIComponent(q)}`,
    fetchSparql: async (q: string) => (onFetch ? onFetch(q) : sparqlVacio()),
  } as unknown as InfoProbidadConnector;
}

/** Maestra mínima: dos objetivos con ambos apellidos (se consultan ⇒ dos responses en el crudo). */
const maestra = [
  {
    id: "P00001",
    nombre_normalizado: "perez juan",
    nombres: "Juan",
    apellido_paterno: "Perez",
    apellido_materno: "Soto",
  },
  {
    id: "P00002",
    nombre_normalizado: "rojas ana",
    nombres: "Ana",
    apellido_paterno: "Rojas",
    apellido_materno: "Lillo",
  },
] as unknown as Parlamentario[];

describe("runProbidadTodos — Etapa 1 R2 + SnapshotWriter (INGEST-04)", () => {
  it("persiste UN crudo agregado por run a R2 y UNA fila source_snapshot con las 8 columnas NOT NULL", async () => {
    const writer = new InMemoryProbidadWriter();
    const conector = mockConector();

    const putImmutable = vi.fn(async () => ({
      r2Path: "infoprobidad/declaraciones/2026-06-24/abc123.json",
      existed: false,
    }));
    const r2Store = { putImmutable } as unknown as R2Store;
    const write = vi.fn(async () => ({
      snapshotId: 1,
      r2Path: "infoprobidad/declaraciones/2026-06-24/abc123.json",
      contentHash: "abc123",
    }));
    const snapshotWriter = { write } as unknown as SnapshotWriter;

    const res = await runProbidadTodos({
      conector,
      writer,
      maestra,
      r2Store,
      snapshotWriter,
      ingestadoHasta: "2026-06-24",
    });

    // UN put (crudo agregado por run, no por query) y UN write (una fila por run).
    expect(putImmutable).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);

    // putImmutable: source/resource/ext correctos.
    const putArgs = putImmutable.mock.calls[0]!;
    expect(putArgs[0]).toBe("infoprobidad");
    expect(putArgs[1]).toBe("declaraciones");
    expect(putArgs[2]).toBe("2026-06-24"); // date = ingestadoHasta
    expect(putArgs[4]).toBe("json");

    // write: las 8 columnas NOT NULL pobladas (no vacías) + r2Path = la key.
    const wrote = write.mock.calls[0]![0] as {
      source: string;
      resource: string;
      cacheKey: string;
      r2Path: string;
      contentHash: string;
      fingerprint: string;
      dateBucket: string;
      provenance: { sourceUrl: string; fetchedAt: string };
    };
    expect(wrote.source).toBe("infoprobidad");
    expect(wrote.resource).toBe("declaraciones");
    expect(wrote.r2Path).toBe("infoprobidad/declaraciones/2026-06-24/abc123.json");
    expect(wrote.dateBucket).toBe("2026-06-24");
    expect(wrote.cacheKey.length).toBeGreaterThan(0);
    expect(wrote.contentHash.length).toBeGreaterThan(0);
    expect(wrote.fingerprint.length).toBeGreaterThan(0);
    expect(wrote.provenance.sourceUrl.length).toBeGreaterThan(0);

    // El result expone la key.
    expect(res.r2Path).toBe("infoprobidad/declaraciones/2026-06-24/abc123.json");
  });

  it("best-effort: r2Store.putImmutable que LANZA deja r2Path null, NO llama snapshotWriter y NO aborta", async () => {
    const writer = new InMemoryProbidadWriter();
    const upsertSpy = vi.spyOn(writer, "upsertDeclaraciones");
    const conector = mockConector();

    const putImmutable = vi.fn(async () => {
      throw new Error("R2 caído");
    });
    const r2Store = { putImmutable } as unknown as R2Store;
    const write = vi.fn();
    const snapshotWriter = { write } as unknown as SnapshotWriter;

    const res = await runProbidadTodos({
      conector,
      writer,
      maestra,
      r2Store,
      snapshotWriter,
      ingestadoHasta: "2026-06-24",
    });

    expect(putImmutable).toHaveBeenCalledTimes(1);
    expect(write).not.toHaveBeenCalled(); // tras un put fallido NO se escribe snapshot
    expect(res.r2Path).toBeNull();
    // La corrida procedió: el writer de declaraciones se invocó (una vez por objetivo consultado).
    expect(upsertSpy).toHaveBeenCalled();
    expect(res.parlamentariosConsultados).toBe(2);
  });

  it("sin r2Store: comportamiento idéntico al actual (no R2, no snapshot), r2Path null", async () => {
    const writer = new InMemoryProbidadWriter();
    const conector = mockConector();

    const res = await runProbidadTodos({
      conector,
      writer,
      maestra,
      ingestadoHasta: "2026-06-24",
    });

    expect(res.r2Path).toBeNull();
    expect(res.parlamentariosConsultados).toBe(2);
  });
});
