// ingest-cli.test — validación de flags + comportamientos R2 (Wave 2, CRON-02/CRON-03/G10).
//
// Tests sin red: inyectan conectores fake y R2Store mock.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseArgs, main, LobbyCliArgsError, tareaDesdeR2Path } from "./ingest-cli";
import { sha256Hex } from "@obs/ingest";
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

/** Crudo de replay = el MISMO fixture, con su sha real (la key ES el sha del contenido). */
const CRUDO_BYTES = new TextEncoder().encode(readFileSync(FIXTURE_DETALLE, "utf8"));
const SHA_CRUDO = await sha256Hex(CRUDO_BYTES);
const KEY_R2 = `leylobby/AA001/2024/p3/2026-07-28/${SHA_CRUDO}.html`;

/** R2Store mock de sólo-lectura: sirve `bytes` por `getObject`, y delata cualquier PUT. */
function r2Lector(bytes: Uint8Array): {
  store: { getObject: (k: string) => Promise<Uint8Array>; putImmutable: () => never };
  leidas: string[];
} {
  const leidas: string[] = [];
  return {
    leidas,
    store: {
      async getObject(k: string) {
        leidas.push(k);
        return bytes;
      },
      putImmutable(): never {
        throw new Error("el replay NO debe escribir en R2 (Etapa 1 ya cumplida)");
      },
    },
  };
}

/** Conector que EXPLOTA si alguien lo usa: en replay la fuente es estructuralmente inalcanzable. */
function conectorProhibido(): LeylobbyConnector {
  const boom = () => {
    throw new Error("FETCH A LA FUENTE EN MODO REPLAY");
  };
  return {
    fetchAudiencias: boom,
    fetchDetalle: boom,
    urlAudiencias: () => "https://leylobby.gob.cl/x",
    urlDetalle: () => "https://leylobby.gob.cl/x",
  } as unknown as LeylobbyConnector;
}

describe("parseArgs — validación de flags ANTES de red/DB", () => {
  it("acepta flags conocidos", () => {
    const o = parseArgs(["--institucion", "AA001", "--anio", "2024", "--dry-run"]);
    expect(o.institucion).toBe("AA001");
    expect(o.anio).toBe(2024);
    expect(o.dryRun).toBe(true);
  });

  it("acepta --from-r2 con una key de la partición real del conector", () => {
    const o = parseArgs(["--from-r2", KEY_R2]);
    expect(o.fromR2).toBe(KEY_R2);
  });

  it("rechaza --from-r2 sin valor", () => {
    expect(() => parseArgs(["--from-r2"])).toThrow(LobbyCliArgsError);
  });

  it("rechaza --from-r2 seguido de otro flag (no lo consume como valor)", () => {
    expect(() => parseArgs(["--from-r2", "--dry-run"])).toThrow(LobbyCliArgsError);
  });

  // CR-01 — el r2Path es input del operador y termina siendo la key de `getObject`.
  it.each([
    ["leylobby/AA001/2024/abc.json", "sin sha completo ni partición de fecha"],
    ["leylobby/AA001/2024/p1/2026-07-28/deadbeef.html", "sha truncado"],
    [`camara-lobby/listadodeaudiencias/2026-07-28/${"a".repeat(64)}.html`, "otra fuente"],
    [`leylobby/../../etc/2024/p1/2026-07-28/${"a".repeat(64)}.html`, "path traversal"],
    [`/leylobby/AA001/2024/p1/2026-07-28/${"a".repeat(64)}.html`, "ruta absoluta"],
  ])("rechaza --from-r2 %s (%s)", (key) => {
    expect(() => parseArgs(["--from-r2", key])).toThrow(LobbyCliArgsError);
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

  it("G1 — corrida degradada: NINGUNO de los DOS cursores avanza (posición NI cobertura)", async () => {
    const writer = new InMemoryLobbyWriter();
    writer.cursorEstado.set("AA001", { institucionCodigo: "AA001", anio: 2024, pagina: 1 });
    // Cobertura previa de un parlamentario: una corrida degradada no puede moverla ni borrarla.
    await writer.marcarIngestado(["P00777"], "2026-06-22");

    const res = await main({
      dryRun: false,
      serviceKey: "fake-key",
      url: "http://fake-url",
      r2Store: null,
      conector: conectorBloqueado(),
      writer,
    });

    expect(res.degradaciones.length).toBeGreaterThan(0);
    // (1) leylobby_cursor_estado — POSICIÓN del barrido: quieta.
    expect(writer.cursorEstado.get("AA001")).toEqual({
      institucionCodigo: "AA001",
      anio: 2024,
      pagina: 1,
    });
    // (2) lobby_ingesta_estado — COBERTURA por parlamentario: intacta, sin filas nuevas.
    expect(res.parlamentariosMarcados).toBe(0);
    expect(res.marcadoHasta).toEqual({});
    expect(writer.ingestaEstado.size).toBe(1);
    expect(writer.ingestaEstado.get("P00777")?.ingestado_hasta).toBe("2026-06-22");
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

// ---------------------------------------------------------------------------------------------
// CR-01 (119-REVIEW) — `--from-r2` se parseaba y NUNCA se usaba: `main()` construía el conector
// real y corría LIVE. El flag documentado para "re-ingestar sin molestar al servidor" producía
// exactamente el fetch que quería evitar (regla LOCKED 2 de CLAUDE.md).
// ---------------------------------------------------------------------------------------------
describe("CR-01 — main() con --from-r2 corre la Etapa 2 DESDE R2, cero fetch a la fuente", () => {
  it("lee el crudo de R2 y NO toca el conector (fuente estructuralmente inalcanzable)", async () => {
    const writer = new InMemoryLobbyWriter();
    const { store, leidas } = r2Lector(CRUDO_BYTES);

    const res = await main({
      serviceKey: "fake-key",
      url: "http://fake-url",
      fromR2: KEY_R2,
      r2Store: store as never,
      // Si el replay cayera al conector inyectado, este explota (control positivo).
      conector: conectorProhibido(),
      writer,
      maestra: [],
    });

    expect(leidas).toEqual([KEY_R2]);
    expect(res.audiencias).toBeGreaterThan(0);
    expect(res.errores).toEqual([]);
  });

  it("deriva la tarea de la KEY (institución/año/página), no del cursor ni del reloj", async () => {
    const writer = new InMemoryLobbyWriter();
    const { store } = r2Lector(CRUDO_BYTES);
    let leerCursorLlamado = false;
    writer.leerCursor = async () => {
      leerCursorLlamado = true;
      return null;
    };

    const res = await main({
      serviceKey: "fake-key",
      url: "http://fake-url",
      fromR2: KEY_R2,
      r2Store: store as never,
      writer,
      maestra: [],
    });

    expect(res.tareas).toEqual(["AA001/2024/p3"]);
    // El replay NO consulta ni mueve el cursor durable: re-procesar un crudo viejo jamás
    // puede empujar el barrido histórico.
    expect(leerCursorLlamado).toBe(false);
    expect(writer.cursorEstado.size).toBe(0);
  });

  it("NO re-escribe el crudo en R2 (Etapa 1 ya cumplida) ni emite el [WARN] de degradación", async () => {
    const writer = new InMemoryLobbyWriter();
    const { store } = r2Lector(CRUDO_BYTES);
    const logs: string[] = [];

    await main({
      serviceKey: "fake-key",
      url: "http://fake-url",
      fromR2: KEY_R2,
      r2Store: store as never, // su putImmutable lanza si alguien lo invoca
      writer,
      maestra: [],
      log: (m) => logs.push(m),
    });

    expect(logs.some((l) => l.includes("[WARN] R2 no configurado"))).toBe(false);
    expect(logs.some((l) => l.includes("REPLAY desde R2"))).toBe(true);
  });

  it("falla LOUD si el sha del contenido no coincide con el de la key (jamás re-fetch)", async () => {
    const writer = new InMemoryLobbyWriter();
    const { store } = r2Lector(new TextEncoder().encode("<html>otro contenido</html>"));

    const res = await main({
      serviceKey: "fake-key",
      url: "http://fake-url",
      fromR2: KEY_R2,
      r2Store: store as never,
      writer,
      maestra: [],
    });

    // El error se registra por tarea (tolerante) y NO se escribió NADA.
    expect(res.audiencias).toBe(0);
    expect(res.errores.length).toBe(1);
    expect(res.errores[0]!.mensaje).toMatch(/sha del contenido/);
    expect(writer.audiencias.size).toBe(0);
  });

  it("rechaza una key ajena también desde main() (defensa en profundidad)", async () => {
    await expect(
      main({
        serviceKey: "fake-key",
        url: "http://fake-url",
        fromR2: "camara-lobby/listadodeaudiencias/2026-07-28/" + "a".repeat(64) + ".html",
        r2Store: r2Lector(CRUDO_BYTES).store as never,
        writer: new InMemoryLobbyWriter(),
      }),
    ).rejects.toThrow(LobbyCliArgsError);
  });

  it("falla LOUD si se pide replay sin R2 configurado (no degrada a fetch de la fuente)", async () => {
    await expect(
      main({
        serviceKey: "fake-key",
        url: "http://fake-url",
        fromR2: KEY_R2,
        r2Store: null,
        conector: conectorProhibido(),
        writer: new InMemoryLobbyWriter(),
      }),
    ).rejects.toThrow(/requiere R2 configurado/);
  });

  it("tareaDesdeR2Path deriva los cuatro campos de la key", () => {
    expect(tareaDesdeR2Path(KEY_R2)).toEqual({
      institucion: "AA001",
      year: 2024,
      page: 3,
      sha: SHA_CRUDO,
    });
    expect(tareaDesdeR2Path("leylobby/AA001/2024/abc.json")).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// WR-06 (119-REVIEW) — el cursor exigía `audiencias > 0` para avanzar, confundiendo "bloqueado"
// con "vacío": una página legítimamente vacía (o un `[skip]` del hash-check) dejaba la corrida
// semanal pidiendo LA MISMA página, indefinidamente, y el barrido histórico nunca llegaba a
// `anio-1`. Lo que debe frenar el cursor es la degradación REAL, no la ausencia de filas.
// ---------------------------------------------------------------------------------------------
describe("WR-06 — el cursor avanza ante ÉXITO, no ante 'trajo filas'", () => {
  /** Conector que responde 200 con una página SIN audiencias (vacía legítima, no bloqueada). */
  function conectorVacio(): LeylobbyConnector {
    return {
      async fetchAudiencias() {
        return "<html><body><table></table></body></html>";
      },
      async fetchDetalle() {
        return "<html></html>";
      },
      urlAudiencias: () => "https://leylobby.gob.cl/x",
      urlDetalle: () => "https://leylobby.gob.cl/x",
    } as unknown as LeylobbyConnector;
  }

  it("página vacía (200, 0 filas, 0 degradaciones) ⇒ el cursor AVANZA", async () => {
    const writer = new InMemoryLobbyWriter();
    writer.cursorEstado.set("AA001", { institucionCodigo: "AA001", anio: 2024, pagina: 3 });

    const res = await main({
      dryRun: false,
      serviceKey: "fake-key",
      url: "http://fake-url",
      r2Store: null,
      conector: conectorVacio(),
      writer,
      maestra: [],
    });

    expect(res.audiencias).toBe(0);
    expect(res.degradaciones).toEqual([]);
    expect(writer.cursorEstado.get("AA001")).toEqual({
      institucionCodigo: "AA001",
      anio: 2024,
      pagina: 4,
    });
  });

  it("dos corridas seguidas sobre páginas vacías NO se atascan (3 → 4 → 5)", async () => {
    const writer = new InMemoryLobbyWriter();
    writer.cursorEstado.set("AA001", { institucionCodigo: "AA001", anio: 2024, pagina: 3 });
    const comun = {
      dryRun: false,
      serviceKey: "fake-key",
      url: "http://fake-url",
      r2Store: null,
      conector: conectorVacio(),
      writer,
      maestra: [],
    };

    await main(comun);
    expect(writer.cursorEstado.get("AA001")!.pagina).toBe(4);
    await main(comun);
    expect(writer.cursorEstado.get("AA001")!.pagina).toBe(5);
  });

  it("[skip] del hash-check (crudo sin cambios) ⇒ el cursor AVANZA (es la corrida más sana)", async () => {
    const writer = new InMemoryLobbyWriter();
    writer.cursorEstado.set("AA001", { institucionCodigo: "AA001", anio: 2024, pagina: 2 });

    await main({
      dryRun: false,
      serviceKey: "fake-key",
      url: "http://fake-url",
      r2Store: {
        async putImmutable() {
          return { r2Path: "leylobby/AA001/2024/p2/2026-07-28/x.html", existed: true };
        },
      } as never,
      conector: conectorConAudiencias(),
      writer,
      maestra: [],
    });

    expect(writer.cursorEstado.get("AA001")!.pagina).toBe(3);
  });

  it("degradación REAL (403) ⇒ el cursor NO avanza (T-74-02 preservada)", async () => {
    const writer = new InMemoryLobbyWriter();
    writer.cursorEstado.set("AA001", { institucionCodigo: "AA001", anio: 2024, pagina: 3 });

    const res = await main({
      dryRun: false,
      serviceKey: "fake-key",
      url: "http://fake-url",
      r2Store: null,
      conector: conectorBloqueado(),
      writer,
      maestra: [],
    });

    expect(res.degradaciones.length).toBeGreaterThan(0);
    expect(writer.cursorEstado.get("AA001")).toEqual({
      institucionCodigo: "AA001",
      anio: 2024,
      pagina: 3,
    });
  });
});
