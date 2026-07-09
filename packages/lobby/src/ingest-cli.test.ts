// ingest-cli.test — validación de flags + comportamientos R2 (Wave 2, CRON-02/CRON-03/G10).
//
// Tests sin red: inyectan conectores fake y R2Store mock.

import { describe, it, expect } from "vitest";
import { parseArgs, main, LobbyCliArgsError } from "./ingest-cli";
import type { LeylobbyConnector } from "./connector-leylobby";
import { InMemoryLobbyWriter } from "./writer";

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
