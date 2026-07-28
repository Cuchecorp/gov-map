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
import { sha256Hex } from "@obs/ingest";
import { runProbidadTodos, runProbidadReplay, ReplayR2Error } from "./run-probidad-todos";
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

// ─────────────────────────────────────────────────────────────────────────────
// G6 (119-03): `existed` (412 de If-None-Match) consumido y VISIBLE.
// Divergencia declarada: la Etapa 1 de este conector corre DESPUÉS de la carga a
// Supabase, así que el skip NO ahorra parseo — evita re-registrar provenance y deja
// constancia de que el crudo de esta corrida es idéntico al de la anterior.
// ─────────────────────────────────────────────────────────────────────────────
describe("runProbidadTodos — G6: existed:true ⇒ sin novedades visible", () => {
  it("(1) existed:true ⇒ marca sinNovedades y log `[skip] sin novedades — infoprobidad declaraciones`", async () => {
    const writer = new InMemoryProbidadWriter();
    const logs: string[] = [];
    const putImmutable = vi.fn(async () => ({
      r2Path: "infoprobidad/declaraciones/2026-06-24/abc123.json",
      existed: true,
    }));
    const res = await runProbidadTodos({
      conector: mockConector(),
      writer,
      maestra,
      r2Store: { putImmutable } as unknown as R2Store,
      snapshotWriter: { write: vi.fn() } as unknown as SnapshotWriter,
      ingestadoHasta: "2026-06-24",
      log: (m) => logs.push(m),
    });

    expect(res.sinNovedades).toBe(true);
    expect(
      logs.some((l) => l.includes("[skip] sin novedades — infoprobidad declaraciones")),
    ).toBe(true);
  });

  it("(2) existed:false ⇒ comportamiento actual intacto (r2Path seteado, snapshot escrito)", async () => {
    const writer = new InMemoryProbidadWriter();
    const write = vi.fn(async () => ({ snapshotId: 1, r2Path: "x", contentHash: "y" }));
    const putImmutable = vi.fn(async () => ({
      r2Path: "infoprobidad/declaraciones/2026-06-24/abc123.json",
      existed: false,
    }));
    const res = await runProbidadTodos({
      conector: mockConector(),
      writer,
      maestra,
      r2Store: { putImmutable } as unknown as R2Store,
      snapshotWriter: { write } as unknown as SnapshotWriter,
      ingestadoHasta: "2026-06-24",
    });

    expect(res.sinNovedades).toBe(false);
    expect(res.r2Path).toBe("infoprobidad/declaraciones/2026-06-24/abc123.json");
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("(3) existed:true ⇒ NO se re-registra la provenance (snapshotWriter.write no se invoca)", async () => {
    const writer = new InMemoryProbidadWriter();
    const write = vi.fn();
    const putImmutable = vi.fn(async () => ({
      r2Path: "infoprobidad/declaraciones/2026-06-24/abc123.json",
      existed: true,
    }));
    const res = await runProbidadTodos({
      conector: mockConector(),
      writer,
      maestra,
      r2Store: { putImmutable } as unknown as R2Store,
      snapshotWriter: { write } as unknown as SnapshotWriter,
      ingestadoHasta: "2026-06-24",
    });

    expect(write).not.toHaveBeenCalled();
    // El r2Path sigue expuesto: el objeto EXISTE en R2 (412 = éxito idempotente), no es un fallo.
    expect(res.r2Path).toBe("infoprobidad/declaraciones/2026-06-24/abc123.json");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// G7 (119-05): Etapa 2 DESDE R2 (`--from-r2`). Re-ingesta del crudo agregado ya
// versionado, sin volver al CPLT (regla LOCKED 2 de CLAUDE.md) y sin poder fingir
// frescura (la fecha del cursor sale del crudo, jamás del reloj).
// ─────────────────────────────────────────────────────────────────────────────
describe("runProbidadReplay — Etapa 2 desde el crudo (G7)", () => {
  /** Un binding SPARQL mínimo válido: URI de nodo + fecha + label del declarante. */
  function binding(decl: string, declaranteLabel: string, fecha = "2026-03-30") {
    return {
      decl: { type: "uri", value: decl },
      fecha: { type: "literal", value: fecha },
      declaranteLabel: { type: "literal", value: declaranteLabel },
    };
  }

  /** Crudo AGREGADO por run: array de responses SPARQL (misma forma que escribe la Etapa 1). */
  const CRUDO = [
    { head: { vars: [] }, results: { bindings: [binding("https://datos.cplt.cl/D1", "JUAN PEREZ SOTO")] } },
    { head: { vars: [] }, results: { bindings: [binding("https://datos.cplt.cl/D2", "ANA ROJAS LILLO")] } },
  ];

  /** Construye la key content-addressed real + su fuente R2 fake. */
  async function fuenteR2(obj: unknown, hasta = "2026-06-24") {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    const sha = await sha256Hex(bytes);
    const r2Path = `infoprobidad/declaraciones/${hasta}/${sha}.json`;
    const leidos: string[] = [];
    return {
      r2Path,
      leidos,
      r2: {
        getObject: async (p: string) => {
          leidos.push(p);
          return bytes;
        },
      },
    };
  }

  it("(1) el conector InfoProbidad NO se invoca: las declaraciones salen del JSON agregado", async () => {
    const writer = new InMemoryProbidadWriter();
    const { r2, r2Path, leidos } = await fuenteR2(CRUDO);
    const fetchOriginal = globalThis.fetch;
    const fetchSpy = vi.fn(async () => {
      throw new Error("replay NO debe tocar la red");
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    try {
      const res = await runProbidadReplay({ r2, r2Path, writer, maestra });
      expect(leidos).toEqual([r2Path]);
      expect(res.declaraciones).toBe(2);
      expect(res.confirmados).toBe(2);
      expect(writer.declaraciones.size).toBe(2);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });

  it("(2) doble replay del mismo objeto es idempotente (mismos conteos, sin duplicar)", async () => {
    const writer = new InMemoryProbidadWriter();
    const { r2, r2Path } = await fuenteR2(CRUDO);
    const a = await runProbidadReplay({ r2, r2Path, writer, maestra });
    const n = writer.declaraciones.size;
    const b = await runProbidadReplay({ r2, r2Path, writer, maestra });
    expect(b.declaraciones).toBe(a.declaraciones);
    expect(writer.declaraciones.size).toBe(n);
  });

  it("(3) JSON malformado/forma inesperada ⇒ error LOUD con el path y CERO filas escritas", async () => {
    for (const malo of ["{no-es-json", JSON.stringify({ results: {} })]) {
      const writer = new InMemoryProbidadWriter();
      const upsert = vi.spyOn(writer, "upsertDeclaraciones");
      const marcar = vi.spyOn(writer, "marcarIngestado");
      const bytes = new TextEncoder().encode(malo);
      const sha = await sha256Hex(bytes);
      const r2Path = `infoprobidad/declaraciones/2026-06-24/${sha}.json`;
      await expect(
        runProbidadReplay({
          r2: { getObject: async () => bytes },
          r2Path,
          writer,
          maestra,
        }),
      ).rejects.toThrow(/infoprobidad\/declaraciones\/2026-06-24/);
      expect(upsert).not.toHaveBeenCalled();
      expect(marcar).not.toHaveBeenCalled();
      expect(writer.declaraciones.size).toBe(0);
    }
  });

  it("(4) la fecha de ingestado_hasta sale del CRUDO, NUNCA del reloj (no finge frescura)", async () => {
    const writer = new InMemoryProbidadWriter();
    const { r2, r2Path } = await fuenteR2(CRUDO, "2026-01-15");
    const res = await runProbidadReplay({ r2, r2Path, writer, maestra });

    const hoy = new Date().toISOString().slice(0, 10);
    expect(res.ingestadoHasta).toBe("2026-01-15");
    expect(res.ingestadoHasta).not.toBe(hoy);
    for (const est of writer.ingestaEstado.values()) {
      expect(est.ingestado_hasta).toBe("2026-01-15");
    }
  });

  it("(4b) key con prefijo desconocido o traversal ⇒ ReplayR2Error antes de leer R2", async () => {
    const writer = new InMemoryProbidadWriter();
    let leido = false;
    const r2 = {
      getObject: async () => {
        leido = true;
        return new Uint8Array();
      },
    };
    for (const malo of [
      "otra-fuente/declaraciones/2026-06-24/" + "a".repeat(64) + ".json",
      "../infoprobidad/declaraciones/2026-06-24/" + "a".repeat(64) + ".json",
      "infoprobidad/declaraciones/2026-06-24/" + "a".repeat(64) + ".html",
    ]) {
      await expect(
        runProbidadReplay({ r2, r2Path: malo, writer, maestra }),
      ).rejects.toBeInstanceOf(ReplayR2Error);
    }
    expect(leido).toBe(false);
  });
});
