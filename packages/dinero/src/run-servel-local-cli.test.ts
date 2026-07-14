// run-servel-local-cli.test — RED de Task 1 (Plan 71-02): el CLI de OPERADOR LOCAL de SERVEL.
//
// Espeja run-dinero-masivo-cli.test.ts (Phase 70), adaptado a que la SERVEL en modo LOCAL:
//   - NO fetchea el blob: la Etapa 1 la hizo el operador colocando el `.xlsx` en R2.
//   - La tarea LOCAL lleva `eleccion` + `r2Path` (SIN `url`) y se threadea `--from-r2`.
//   - El conector de fetch NUNCA se toca (fake que LANZA en `descargar` → 0 llamadas).
//
// Sin red, sin DB. Todo inyectado (env, r2Store, writer, conector, log).

import { describe, expect, it, vi } from "vitest";
import type { DescargaServel, ServelConnector } from "./connector-servel";
import { InMemoryServelWriter } from "./writer-servel";
import {
  main,
  parseArgs,
  ServelLocalArgsError,
} from "./run-servel-local-cli";

// --- Fakes -----------------------------------------------------------------

/** R2Store fake: siembra r2Path→bytes; cuenta getObject; putImmutable no se usa en LOCAL. */
class FakeR2Store {
  readonly byPath = new Map<string, Uint8Array>();
  getObjectCalls = 0;
  seed(r2Path: string, bytes: Uint8Array): void {
    this.byPath.set(r2Path, bytes);
  }
  async getObject(r2Path: string): Promise<Uint8Array> {
    this.getObjectCalls++;
    const b = this.byPath.get(r2Path);
    if (!b) throw new Error(`R2 GET 404 para ${r2Path}`);
    return b;
  }
  async putImmutable(): Promise<{ r2Path: string; existed: boolean }> {
    throw new Error("PROHIBIDO: modo LOCAL no debe hacer putImmutable (la Etapa 1 la hizo el operador)");
  }
}

/** Conector fake que LANZA si se le toca — prueba 0 fetch al blob en el modo LOCAL. */
function conectorQueLanza(spy: { calls: number }): ServelConnector {
  return {
    async descargar(): Promise<DescargaServel> {
      spy.calls++;
      throw new Error("PROHIBIDO: modo LOCAL NO debe tocar descargar (0 fetch a la fuente)");
    },
  } as unknown as ServelConnector;
}

const R2_ENV = {
  R2_ACCESS_KEY_ID: "AKIA_FAKE",
  R2_SECRET_ACCESS_KEY: "SECRET_FAKE",
  R2_ENDPOINT_URL: "https://fake.r2.cloudflarestorage.com",
  R2_BUCKET: "obs-crudo",
};

const R2_PATH = "servel/diputado-2025/2026-06-19/deadbeef.xlsx";

// --- parseArgs -------------------------------------------------------------

describe("parseArgs (run-servel-local-cli)", () => {
  it("acepta --eleccion / --r2-path / --anio / --dry-run", () => {
    const o = parseArgs([
      "--eleccion", "diputado-2025",
      "--r2-path", R2_PATH,
      "--anio", "2025",
      "--dry-run",
    ]);
    expect(o.eleccion).toBe("diputado-2025");
    expect(o.r2Path).toBe(R2_PATH);
    expect(o.anio).toBe("2025");
    expect(o.dryRun).toBe(true);
  });

  it("--from-r2 es alias de --r2-path", () => {
    const o = parseArgs(["--eleccion", "e", "--from-r2", R2_PATH]);
    expect(o.r2Path).toBe(R2_PATH);
  });

  it("--eleccion sin valor LANZA ServelLocalArgsError", () => {
    expect(() => parseArgs(["--eleccion"])).toThrow(ServelLocalArgsError);
  });

  it("--anio no-YYYY LANZA", () => {
    expect(() => parseArgs(["--anio", "25"])).toThrow(ServelLocalArgsError);
  });

  it("flag desconocido LANZA", () => {
    expect(() => parseArgs(["--nope"])).toThrow(ServelLocalArgsError);
  });
});

// --- main ------------------------------------------------------------------

describe("main (run-servel-local-cli) — operador LOCAL", () => {
  it("(a) construye un R2Store de .env R2_* cuando estan presentes (r2Activo=true)", async () => {
    const writer = new InMemoryServelWriter();
    const spy = { calls: 0 };
    const res = await main(
      { eleccion: "diputado-2025", r2Path: R2_PATH, dryRun: true },
      {
        env: { ...R2_ENV },
        conector: conectorQueLanza(spy),
        writer,
        // sin r2Store inyectado: main lo construye de .env
        log: () => {},
      },
    );
    expect(res.r2Activo).toBe(true);
  });

  it("(b) threadea la tarea LOCAL (eleccion+r2Path, SIN url) y --from-r2 a runIngestServel", async () => {
    const r2Store = new FakeR2Store();
    const spyRun = vi.fn(async () => ({
      aportes: 0, donantes: 0, parlamentariosMarcados: 0,
      cuarentenados: [], errores: [], degradaciones: [],
    }));
    const spy = { calls: 0 };
    await main(
      { eleccion: "diputado-2025", r2Path: R2_PATH, dryRun: true },
      {
        env: { ...R2_ENV },
        r2Store: r2Store as never,
        conector: conectorQueLanza(spy),
        writer: new InMemoryServelWriter(),
        runIngest: spyRun as never,
        log: () => {},
      },
    );
    expect(spyRun).toHaveBeenCalledTimes(1);
    const opts = spyRun.mock.calls[0]![0] as {
      tareas: { eleccion: string; url: string; r2Path?: string }[];
      fromR2?: string;
    };
    expect(opts.tareas).toHaveLength(1);
    expect(opts.tareas[0]!.eleccion).toBe("diputado-2025");
    expect(opts.tareas[0]!.r2Path).toBe(R2_PATH);
    expect(opts.tareas[0]!.url).toBe(""); // modo LOCAL: sin url (no fetchea).
    expect(opts.fromR2).toBe(R2_PATH);
  });

  it("(c) loguea el destino LOCAL (lee de R2)", async () => {
    const logs: string[] = [];
    const spy = { calls: 0 };
    await main(
      { eleccion: "e", r2Path: R2_PATH, dryRun: true },
      {
        env: { ...R2_ENV },
        r2Store: new FakeR2Store() as never,
        conector: conectorQueLanza(spy),
        writer: new InMemoryServelWriter(),
        runIngest: (async () => ({
          aportes: 0, donantes: 0, parlamentariosMarcados: 0,
          cuarentenados: [], errores: [], degradaciones: [],
        })) as never,
        log: (m) => logs.push(m),
      },
    );
    expect(logs.some((l) => /LOCAL/.test(l) && /R2/.test(l))).toBe(true);
  });

  it("(d) guard: --r2-path/--from-r2 sin R2 configurado LANZA ServelLocalArgsError", async () => {
    const spy = { calls: 0 };
    await expect(
      main(
        { eleccion: "e", r2Path: R2_PATH, dryRun: true },
        {
          env: {}, // sin R2_* → no se puede construir R2Store
          conector: conectorQueLanza(spy),
          writer: new InMemoryServelWriter(),
          log: () => {},
        },
      ),
    ).rejects.toThrow(ServelLocalArgsError);
  });

  it("(e) modo LOCAL: el conector de fetch NUNCA se construye/invoca (0 llamadas a descargar)", async () => {
    const spy = { calls: 0 };
    await main(
      { eleccion: "diputado-2025", r2Path: R2_PATH, dryRun: true },
      {
        env: { ...R2_ENV },
        r2Store: new FakeR2Store() as never,
        conector: conectorQueLanza(spy),
        writer: new InMemoryServelWriter(),
        runIngest: (async () => ({
          aportes: 0, donantes: 0, parlamentariosMarcados: 0,
          cuarentenados: [], errores: [], degradaciones: [],
        })) as never,
        log: () => {},
      },
    );
    expect(spy.calls).toBe(0);
  });

  it("(e') modo LOCAL end-to-end con runIngestServel real: 0 fetch, lee de R2", async () => {
    // Sin runIngest inyectado, main usa el runIngestServel real: el conector LANZA si se toca.
    // Como el r2Path no esta sembrado, runIngestServel degrada la eleccion (getObject 404) SIN
    // tocar el conector — lo que prueba que el fetch nunca ocurre en modo LOCAL.
    const r2Store = new FakeR2Store();
    const spy = { calls: 0 };
    const res = await main(
      { eleccion: "diputado-2025", r2Path: R2_PATH, dryRun: true },
      {
        env: { ...R2_ENV },
        r2Store: r2Store as never,
        conector: conectorQueLanza(spy),
        writer: new InMemoryServelWriter(),
        log: () => {},
      },
    );
    expect(spy.calls).toBe(0); // el fetch NUNCA se tocó.
    expect(res.r2Activo).toBe(true);
  });

  it("--eleccion vacia LANZA (una corrida LOCAL sin eleccion no tiene clave de crudo)", async () => {
    const spy = { calls: 0 };
    await expect(
      main(
        { eleccion: "", r2Path: R2_PATH, dryRun: true },
        {
          env: { ...R2_ENV },
          r2Store: new FakeR2Store() as never,
          conector: conectorQueLanza(spy),
          writer: new InMemoryServelWriter(),
          log: () => {},
        },
      ),
    ).rejects.toThrow(ServelLocalArgsError);
  });

  it("--r2-path vacio LANZA (modo LOCAL exige el crudo colocado por el operador)", async () => {
    const spy = { calls: 0 };
    await expect(
      main(
        { eleccion: "e", r2Path: "", dryRun: true },
        {
          env: { ...R2_ENV },
          r2Store: new FakeR2Store() as never,
          conector: conectorQueLanza(spy),
          writer: new InMemoryServelWriter(),
          log: () => {},
        },
      ),
    ).rejects.toThrow(ServelLocalArgsError);
  });
});
