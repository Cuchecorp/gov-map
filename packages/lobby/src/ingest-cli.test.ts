// ingest-cli.test — validación de flags + comportamientos R2 (Wave 2, CRON-02/CRON-03/G10).
//
// Tests sin red: inyectan conectores fake y R2Store mock.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseArgs, main, LobbyCliArgsError } from "./ingest-cli";
import { LeylobbyBloqueadaError, type LeylobbyConnector } from "./connector-leylobby";
import { InMemoryLobbyWriter } from "./writer";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DETALLE = join(here, "..", "test", "fixtures", "audiencias-congreso.html");

/**
 * Conector fake que devuelve el fixture REAL de detalle (2 audiencias parseables) en fetchAudiencias
 * → `runIngestLobby` produce audiencias>0 (corrida "exitosa"). Sin red.
 */
function conectorConAudiencias(): LeylobbyConnector {
  const html = readFileSync(FIXTURE_DETALLE, "utf8");
  return {
    async fetchAudiencias() {
      return html;
    },
    async fetchDetalle() {
      return html;
    },
    urlAudiencias() {
      return "https://leylobby.gob.cl/x";
    },
    urlDetalle() {
      return "https://leylobby.gob.cl/x";
    },
  } as unknown as LeylobbyConnector;
}

/** Conector fake que SIEMPRE bloquea (403) → degradación honesta, audiencias===0. */
function conectorBloqueado(): LeylobbyConnector {
  return {
    async fetchAudiencias() {
      throw new LeylobbyBloqueadaError("https://leylobby.gob.cl/x", 403);
    },
    async fetchDetalle() {
      throw new LeylobbyBloqueadaError("https://leylobby.gob.cl/x", 403);
    },
    urlAudiencias() {
      return "https://leylobby.gob.cl/x";
    },
    urlDetalle() {
      return "https://leylobby.gob.cl/x";
    },
  } as unknown as LeylobbyConnector;
}

describe("parseArgs — validación de flags ANTES de red/DB", () => {
  it("acepta flags conocidos", () => {
    const o = parseArgs(["--institucion", "AA001", "--anio", "2024", "--dry-run"]);
    expect(o.institucion).toBe("AA001");
    expect(o.anio).toBe(2024);
    expect(o.dryRun).toBe(true);
  });

  it("acepta --from-r2 con un r2Path", () => {
    const o = parseArgs(["--from-r2", "leylobby/AA001/2024/abc.json"]);
    expect(o.fromR2).toBe("leylobby/AA001/2024/abc.json");
  });

  it("rechaza --from-r2 sin valor", () => {
    expect(() => parseArgs(["--from-r2"])).toThrow(LobbyCliArgsError);
  });

  it("rechaza flags desconocidos", () => {
    expect(() => parseArgs(["--frobnicate"])).toThrow(LobbyCliArgsError);
  });
});

describe("main() — WARN R2 no configurado", () => {
  it("emite [WARN] R2 no configurado cuando r2Store=null y dryRun=false", async () => {
    const warns: string[] = [];
    const fakeCon = {
      async fetchAudiencias() { return ""; },
      async fetchDetalle() { return ""; },
      urlAudiencias() { return ""; },
      urlDetalle() { return ""; },
    } as unknown as LeylobbyConnector;
    const writer = new InMemoryLobbyWriter();

    await main({
      dryRun: false,
      serviceKey: "fake-key",
      url: "http://fake-url",
      paginas: 1,
      r2Store: null,
      conector: fakeCon,
      writer,
      log: (m) => {
        if (m.includes("[WARN] R2 no configurado")) warns.push(m);
      },
    });

    expect(warns.length).toBeGreaterThan(0);
  });
});

describe("main() — hash-check: [skip] sin novedades — leylobby", () => {
  it("emite [skip] sin novedades cuando putImmutable devuelve existed=true", async () => {
    const skips: string[] = [];

    const mockR2 = {
      async putImmutable() {
        return { r2Path: "leylobby/AA001/2024/abc.json", existed: true };
      },
      async getObject(): Promise<Uint8Array> {
        throw new Error("no debería llamarse en hash-check");
      },
    };

    // Conector fake que devuelve HTML mínimo no vacío para que el Etapa 1 se ejecute.
    const fakeCon = {
      async fetchAudiencias() { return "<html><body>audiencias</body></html>"; },
      async fetchDetalle() { return ""; },
      urlAudiencias() { return "https://fake"; },
      urlDetalle() { return "https://fake"; },
    } as unknown as LeylobbyConnector;

    const writer = new InMemoryLobbyWriter();

    await main({
      paginas: 1,
      dryRun: false,
      serviceKey: "fake-key",
      url: "http://fake-url",
      r2Store: mockR2 as never,
      conector: fakeCon,
      writer,
      log: (m) => {
        if (m.includes("[skip] sin novedades")) skips.push(m);
      },
    });

    expect(skips.length).toBeGreaterThan(0);
    expect(skips[0]).toMatch(/\[skip\] sin novedades — leylobby/);
  });
});

describe("main() — cursor incremental (DEBT-02): leer antes / avanzar después", () => {
  it("corrida sin flags con cursor {2024,p1} + audiencias → avanza el writer a {2024,p2}", async () => {
    const writer = new InMemoryLobbyWriter();
    writer.cursorEstado.set("AA001", { institucionCodigo: "AA001", anio: 2024, pagina: 1 });

    const res = await main({
      dryRun: false,
      serviceKey: "fake-key",
      url: "http://fake-url",
      r2Store: null,
      conector: conectorConAudiencias(),
      writer,
    });

    expect(res.audiencias).toBeGreaterThan(0);
    expect(writer.cursorEstado.get("AA001")).toEqual({
      institucionCodigo: "AA001",
      anio: 2024,
      pagina: 2,
    });
  });

  it("sin fila previa (primera corrida) → deriva (año actual, pág 1) y avanza a pág 2", async () => {
    const writer = new InMemoryLobbyWriter();
    const anioActual = new Date().getFullYear();

    await main({
      dryRun: false,
      serviceKey: "fake-key",
      url: "http://fake-url",
      r2Store: null,
      conector: conectorConAudiencias(),
      writer,
    });

    expect(writer.cursorEstado.get("AA001")).toEqual({
      institucionCodigo: "AA001",
      anio: anioActual,
      pagina: 2,
    });
  });

  it("corrida degradada (403, audiencias===0) → NO avanza el cursor (permanece {2024,p1})", async () => {
    const writer = new InMemoryLobbyWriter();
    writer.cursorEstado.set("AA001", { institucionCodigo: "AA001", anio: 2024, pagina: 1 });

    const res = await main({
      dryRun: false,
      serviceKey: "fake-key",
      url: "http://fake-url",
      r2Store: null,
      conector: conectorBloqueado(),
      writer,
    });

    expect(res.audiencias).toBe(0);
    expect(res.degradaciones.length).toBeGreaterThan(0);
    expect(writer.cursorEstado.get("AA001")).toEqual({
      institucionCodigo: "AA001",
      anio: 2024,
      pagina: 1,
    });
  });

  it("con --anio/--paginas explícitos → NO consulta el cursor (override); leerCursor no se invoca", async () => {
    const writer = new InMemoryLobbyWriter();
    writer.cursorEstado.set("AA001", { institucionCodigo: "AA001", anio: 2024, pagina: 7 });
    let leerCursorLlamado = false;
    const orig = writer.leerCursor.bind(writer);
    writer.leerCursor = async (inst: string) => {
      leerCursorLlamado = true;
      return orig(inst);
    };

    const res = await main({
      dryRun: false,
      serviceKey: "fake-key",
      url: "http://fake-url",
      anio: 2020,
      paginas: 1,
      r2Store: null,
      conector: conectorConAudiencias(),
      writer,
    });

    expect(leerCursorLlamado).toBe(false);
    // La tarea corrió sobre el año del override (2020), no el del cursor (2024).
    expect(res.tareas).toEqual(["AA001/2020/p1"]);
    // El cursor NO se avanzó (sigue en 7).
    expect(writer.cursorEstado.get("AA001")).toEqual({
      institucionCodigo: "AA001",
      anio: 2024,
      pagina: 7,
    });
  });

  it("dry-run → NO consulta ni persiste el cursor", async () => {
    const writer = new InMemoryLobbyWriter();
    let avanzarLlamado = false;
    const origAvanzar = writer.avanzarCursor.bind(writer);
    writer.avanzarCursor = async (c) => {
      avanzarLlamado = true;
      return origAvanzar(c);
    };

    await main({
      dryRun: true,
      r2Store: null,
      conector: conectorConAudiencias(),
      writer,
    });

    expect(avanzarLlamado).toBe(false);
    expect(writer.cursorEstado.size).toBe(0);
  });
});
