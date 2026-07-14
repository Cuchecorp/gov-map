// run-dinero-masivo-cli.test — CLI de OPERADOR: construye el R2Store real de `.env R2_*`, threadea
// `--from-r2`, loguea destino LOCAL/REMOTO y REDACTA el `MERCADOPUBLICO_TICKET` en TODA salida
// (CR-01). 100% OFFLINE (env inyectada, conector fake, sin red/DB).

import { describe, it, expect } from "vitest";
import type { ChileCompraConnector } from "./connector-chilecompra";
import { InMemoryDineroWriter } from "./writer";
import { main, parseArgs, DineroMasivoArgsError } from "./run-dinero-masivo-cli";

const SECRET_TICKET = "S3CR3T-TICKET-MASIVO-70";
const RUT_JURIDICO = "76.123.456-0";

/** Conector fake normal (sin red): sirve buscarProveedor/ordenesDeCompra desde memoria. */
function conectorFake(): ChileCompraConnector {
  return {
    async buscarProveedor() {
      return { CodigoEmpresa: "17793", NombreEmpresa: "PROVEEDOR SA" };
    },
    async ordenesDeCompra() {
      return {
        Cantidad: 1,
        Listado: [{ Codigo: "OC-1", Nombre: "Compra X", FechaEnvio: "2024-02-02" }],
      };
    },
  } as unknown as ChileCompraConnector;
}

/** FakeR2Store en memoria (putImmutable/getObject) para verificar construccion + threading. */
class FakeR2Store {
  readonly puts: { r2Path: string; bytes: Uint8Array }[] = [];
  readonly byPath = new Map<string, Uint8Array>();
  async putImmutable(source: string, resource: string, date: string, sha: string, ext: string, bytes: Uint8Array) {
    const r2Path = `${source}/${resource}/${date}/${sha}.${ext}`;
    this.puts.push({ r2Path, bytes });
    this.byPath.set(r2Path, bytes);
    return { r2Path, existed: false };
  }
  async getObject(r2Path: string): Promise<Uint8Array> {
    const b = this.byPath.get(r2Path);
    if (!b) throw new Error(`R2 GET 404 para ${r2Path}`);
    return b;
  }
}

describe("parseArgs — flags del CLI masivo", () => {
  it("acepta --rut/--dia repetibles, --from-r2 y --dry-run", () => {
    const o = parseArgs(["--rut", "76.1-0", "--rut", "77.2-3", "--dia", "02022024", "--from-r2", "dinero/x/d/s.json", "--dry-run"]);
    expect(o.ruts).toEqual(["76.1-0", "77.2-3"]);
    expect(o.dias).toEqual(["02022024"]);
    expect(o.fromR2).toBe("dinero/x/d/s.json");
    expect(o.dryRun).toBe(true);
  });
  it("--dia invalido (no 8 digitos) lanza", () => {
    expect(() => parseArgs(["--dia", "2-2-24"])).toThrow(DineroMasivoArgsError);
  });
});

describe("run-dinero-masivo-cli — construccion del R2Store de .env R2_*", () => {
  it("con .env R2_* presente, construye un R2Store y lo threadea (Etapa 1 activa -> putImmutable dispara)", async () => {
    // No inyectamos deps.r2Store: forzamos la CONSTRUCCION desde env.
    const logs: string[] = [];
    const res = await main(
      { ruts: [RUT_JURIDICO], dias: ["02022024"], dryRun: true },
      {
        env: {
          R2_ACCESS_KEY_ID: "AK",
          R2_SECRET_ACCESS_KEY: "SK",
          R2_ENDPOINT_URL: "https://acct.r2.cloudflarestorage.com",
          R2_BUCKET: "crudo",
        },
        ticket: SECRET_TICKET,
        conector: conectorFake(),
        log: (m) => logs.push(m),
      },
    );
    // R2 activo (construido de env) + destino LOCAL logueado.
    expect(res.r2Activo).toBe(true);
    expect(logs.join("\n")).toContain("R2Store construido de .env");
    expect(logs.join("\n")).toContain("destino LOCAL");
    // El ticket NUNCA aparece en claro en NINGUN log.
    for (const l of logs) expect(l).not.toContain(SECRET_TICKET);
  });

  it("sin .env R2_*, degrada con WARN (Etapa 1 omitida) y NO construye R2Store", async () => {
    const logs: string[] = [];
    const res = await main(
      { ruts: [RUT_JURIDICO], dryRun: true },
      { env: {}, ticket: SECRET_TICKET, conector: conectorFake(), log: (m) => logs.push(m) },
    );
    expect(res.r2Activo).toBe(false);
    expect(logs.join("\n")).toContain("[WARN] R2 no configurado");
  });
});

describe("run-dinero-masivo-cli — --from-r2 threading + guard", () => {
  it("threadea --from-r2 a runIngestDinero: replay puebla desde el R2Store inyectado", async () => {
    const r2 = new FakeR2Store();
    // 1) Corrida normal para dejar el envelope en R2 (writer InMemory).
    await main(
      { ruts: [RUT_JURIDICO], dias: ["02022024"], dryRun: true },
      { r2Store: r2 as never, ticket: SECRET_TICKET, conector: conectorFake(), writer: new InMemoryDineroWriter() },
    );
    const r2Path = r2.puts[0]!.r2Path;
    // 2) Replay --from-r2 con un conector que LANZA si se toca (0 fetch).
    const conectorProhibido = {
      async buscarProveedor() {
        throw new Error("PROHIBIDO tocar la fuente en --from-r2");
      },
      async ordenesDeCompra() {
        throw new Error("PROHIBIDO tocar la fuente en --from-r2");
      },
    } as unknown as ChileCompraConnector;
    const writer = new InMemoryDineroWriter();
    const res = await main(
      { fromR2: r2Path },
      { r2Store: r2 as never, ticket: SECRET_TICKET, conector: conectorProhibido, writer },
    );
    expect(res.fromR2).toBe(r2Path);
    expect(res.contratos).toBe(1);
    expect(writer.contratos.size).toBe(1);
  });

  it("guard: --from-r2 sin R2 configurado LANZA (DineroMasivoArgsError)", async () => {
    await expect(
      main({ fromR2: "dinero/x/d/s.json" }, { env: {}, ticket: SECRET_TICKET, conector: conectorFake() }),
    ).rejects.toThrow(DineroMasivoArgsError);
  });
});

describe("run-dinero-masivo-cli — CR-01: el MERCADOPUBLICO_TICKET NUNCA aparece en claro", () => {
  it("aunque el conector surface un error con ticket= en la URL, la salida lo enmascara a ticket=***", async () => {
    const logs: string[] = [];
    // Conector que lanza un error CRUDO con el ticket embebido (simula una URL sin sanear).
    const conectorFuga = {
      async buscarProveedor() {
        throw new Error(
          `fallo GET https://api.mercadopublico.cl/x?rutempresaproveedor=76.1-0&ticket=${SECRET_TICKET}`,
        );
      },
      async ordenesDeCompra() {
        return { Cantidad: 0, Listado: [] };
      },
    } as unknown as ChileCompraConnector;
    const r2 = new FakeR2Store();
    const res = await main(
      { ruts: [RUT_JURIDICO], dias: ["02022024"], dryRun: true },
      {
        r2Store: r2 as never,
        ticket: SECRET_TICKET,
        conector: conectorFuga,
        writer: new InMemoryDineroWriter(),
        log: (m) => logs.push(m),
      },
    );
    // El error se capturo y quedo redactado en `errores`.
    expect(res.errores.length).toBeGreaterThan(0);
    for (const e of res.errores) expect(e.mensaje).not.toContain(SECRET_TICKET);
    // NINGUN log lleva el ticket en claro; si surfacea `ticket=` va enmascarado.
    for (const l of logs) {
      expect(l).not.toContain(SECRET_TICKET);
      if (/ticket=/i.test(l)) expect(l).toContain("ticket=***");
    }
  });
});
