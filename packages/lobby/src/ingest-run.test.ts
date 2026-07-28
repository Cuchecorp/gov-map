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
import type { Parlamentario } from "@obs/core";
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

// ─────────────────────────────────────────────────────────────────────────────
// G5 (119-04): provenance en `source_snapshot` tras cada put con existed:false.
// Best-effort: un fallo del writer no aborta la ingesta.
// ─────────────────────────────────────────────────────────────────────────────
describe("runIngestLobby — G5: SnapshotWriter (source_snapshot)", () => {
  /** R2 fake que devuelve siempre el mismo `existed`. */
  function r2Con(existed: boolean) {
    return {
      putImmutable: async (
        source: string,
        resource: string,
        date: string,
        sha: string,
        ext: string,
      ) => ({ r2Path: `${source}/${resource}/${date}/${sha}.${ext}`, existed }),
    } as never;
  }

  function stubWriter(falla = false) {
    const escrituras: Record<string, unknown>[] = [];
    return {
      escrituras,
      writer: {
        write: async (w: Record<string, unknown>) => {
          escrituras.push(w);
          if (falla) throw new Error("source_snapshot caído");
          return { r2Path: String(w.r2Path), contentHash: String(w.contentHash) };
        },
      },
    };
  }

  const TAREAS = [{ institucionCodigo: "AA001", year: 2024, pages: [1, 2] }];

  it("existed:false ⇒ write una vez por recurso nuevo, con los campos no vacíos", async () => {
    const { escrituras, writer: snap } = stubWriter();
    await runIngestLobby({
      conector: fakeConector({ html: FIXTURE_HTML }),
      writer: new InMemoryLobbyWriter(),
      maestra: [],
      tareas: TAREAS,
      r2Store: r2Con(false),
      snapshotWriter: snap as never,
    });

    expect(escrituras).toHaveLength(2); // una por página
    for (const e of escrituras) {
      expect(e.source).toBe("lobby-leylobby");
      expect(String(e.r2Path)).not.toBe("");
      expect(String(e.contentHash)).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(escrituras.map((e) => e.resource)).toEqual(["AA001/2024/p1", "AA001/2024/p2"]);
  });

  it("existed:true ⇒ CERO escrituras (nunca una fila sin objeto recién creado)", async () => {
    const { escrituras, writer: snap } = stubWriter();
    const res = await runIngestLobby({
      conector: fakeConector({ html: FIXTURE_HTML }),
      writer: new InMemoryLobbyWriter(),
      maestra: [],
      tareas: TAREAS,
      r2Store: r2Con(true),
      snapshotWriter: snap as never,
    });
    expect(escrituras).toHaveLength(0);
    expect(res.audiencias).toBe(0); // el skip de G6 sigue vigente
  });

  it("best-effort: si write lanza, la corrida termina OK y conserva los conteos", async () => {
    const logs: string[] = [];
    const { writer: snap } = stubWriter(true);
    const base = await runIngestLobby({
      conector: fakeConector({ html: FIXTURE_HTML }),
      writer: new InMemoryLobbyWriter(),
      maestra: [],
      tareas: TAREAS,
      r2Store: r2Con(false),
    });
    const conFallo = await runIngestLobby({
      conector: fakeConector({ html: FIXTURE_HTML }),
      writer: new InMemoryLobbyWriter(),
      maestra: [],
      tareas: TAREAS,
      r2Store: r2Con(false),
      snapshotWriter: snap as never,
      log: (m) => logs.push(m),
    });

    expect(conFallo.errores).toHaveLength(0);
    expect(conFallo.audiencias).toBe(base.audiencias);
    expect(logs.some((l) => l.includes("source_snapshot falló (no fatal)"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// G1 (119-06) — avance del MARCADOR DE COBERTURA `lobby_ingesta_estado.ingestado_hasta`.
//
// Diagnóstico (Task 1, causa (a)): la corrida semanal trae audiencias pero CERO parlamentarios
// confirmados ⇒ `marcados` queda vacío ⇒ `marcarIngestado` nunca corre. El fix NO es marcar de
// todos modos (eso fabricaría cobertura): es (1) derivar `hasta` de los DATOS y no del reloj,
// (2) no retroceder nunca, y (3) dejar ASEVERADO que sin confirmados no se marca.
// ---------------------------------------------------------------------------------------------

/** Maestra mínima que hace determinista al sujeto pasivo "Víctor Gutiérrez" del fixture. */
function maestroVictor(): Parlamentario {
  return {
    id: "P00777",
    nombre_normalizado: "gutierrez victor",
    nombres: "Víctor",
    apellido_paterno: "Gutiérrez",
    apellido_materno: "",
    camara: "senado",
    // Debe coincidir con el `PERIODO_LOBBY_DEFAULT` de reconciliar-sujeto.ts (no exportado).
    periodo: "senado-vigente-2026",
    region: null,
    distrito: null,
    circunscripcion: null,
    partido: null,
    rut: null,
    parlid_senado: null,
    id_diputado_camara: null,
    estado: "confirmado",
    email: null,
    origen: "senado",
    fecha_captura: "2026-01-01T00:00:00Z",
    enlace: "https://example.cl",
  };
}

const TAREA_G1 = [{ institucionCodigo: "AA001", year: 2024, pages: [1] }];

describe("G1 — lobby_ingesta_estado avanza con datos y SÓLO con datos", () => {
  it("Test 1: ≥1 parlamentario confirmado ⇒ marcarIngestado con la fecha MÁXIMA INGERIDA (no el reloj)", async () => {
    const writer = new InMemoryLobbyWriter();
    const res = await runIngestLobby({
      conector: fakeConector({ html: FIXTURE_HTML }),
      writer,
      maestra: [maestroVictor()],
      tareas: TAREA_G1,
      // Corte del reloj deliberadamente MUY posterior al lote: si el fix usara el reloj, el
      // assert de abajo fallaría.
      ingestadoHasta: "2026-07-28",
    });

    expect(res.parlamentariosMarcados).toBe(1);
    const fila = writer.ingestaEstado.get("P00777");
    expect(fila).toBeDefined();
    // La audiencia del fixture es del 2024-06-24 → ÉSA es la cobertura real, no "hoy".
    expect(fila?.ingestado_hasta).toBe("2024-06-24");
    expect(fila?.ingestado_hasta).not.toBe("2026-07-28");
  });

  it("Test 2: corrida degradada (503) ⇒ NINGÚN cursor avanza (T-74-02 preservada)", async () => {
    const writer = new InMemoryLobbyWriter();
    // Marca previa: una corrida degradada no puede tocarla ni crear filas nuevas.
    await writer.marcarIngestado(["P00777"], "2024-06-24");
    const res = await runIngestLobby({
      conector: fakeConector({ bloquea: true }),
      writer,
      maestra: [maestroVictor()],
      tareas: TAREA_G1,
      ingestadoHasta: "2026-07-28",
    });

    expect(res.audiencias).toBe(0);
    expect(res.degradaciones.length).toBeGreaterThan(0);
    expect(res.parlamentariosMarcados).toBe(0);
    // lobby_ingesta_estado intacto…
    expect(writer.ingestaEstado.get("P00777")?.ingestado_hasta).toBe("2024-06-24");
    expect(writer.ingestaEstado.size).toBe(1);
    // …y leylobby_cursor_estado jamás tocado por esta corrida.
    expect(writer.cursorEstado.size).toBe(0);
  });

  it("Test 3: audiencias pero CERO confirmados ⇒ NO se marca nada (marcar sería fabricar cobertura)", async () => {
    const writer = new InMemoryLobbyWriter();
    const res = await runIngestLobby({
      conector: fakeConector({ html: FIXTURE_HTML }),
      writer,
      maestra: [], // maestra vacía = el escenario REAL del cron (causa (a) del diagnóstico)
      tareas: TAREA_G1,
      ingestadoHasta: "2026-07-28",
    });

    expect(res.audiencias).toBeGreaterThan(0);
    expect(res.parlamentariosMarcados).toBe(0);
    // DECISIÓN EXPLÍCITA: un barrido que no confirmó a NADIE no es "ingestado" para nadie.
    expect(writer.ingestaEstado.size).toBe(0);
  });

  it("Test 4: doble corrida sobre el mismo lote es idempotente (upsert, sin duplicar ni mover)", async () => {
    const writer = new InMemoryLobbyWriter();
    const comun = {
      conector: fakeConector({ html: FIXTURE_HTML }),
      writer,
      maestra: [maestroVictor()],
      tareas: TAREA_G1,
      ingestadoHasta: "2026-07-28",
    };
    await runIngestLobby(comun);
    const antes = writer.ingestaEstado.get("P00777")?.ingestado_hasta;
    await runIngestLobby(comun);

    expect(writer.ingestaEstado.size).toBe(1);
    expect(writer.ingestaEstado.get("P00777")?.ingestado_hasta).toBe(antes);
    expect(antes).toBe("2024-06-24");
  });

  it("Test 5: `ingestado_hasta` NUNCA retrocede — un lote histórico posterior no baja la marca", async () => {
    const writer = new InMemoryLobbyWriter();
    // Marca ya adelantada (p.ej. por el conector de la Cámara o una corrida anterior).
    await writer.marcarIngestado(["P00777"], "2026-06-22");
    await runIngestLobby({
      conector: fakeConector({ html: FIXTURE_HTML }),
      writer,
      maestra: [maestroVictor()],
      tareas: TAREA_G1, // lote de 2024 — MÁS VIEJO que la marca existente
      ingestadoHasta: "2026-07-28",
    });

    expect(writer.ingestaEstado.get("P00777")?.ingestado_hasta).toBe("2026-06-22");
  });

  // CR-02 (119-REVIEW) — el fallback al reloj era la puerta trasera por la que se fabricaba
  // cobertura: una audiencia con `fecha` no parseable (la fuente entrega fechas sucias — por eso
  // existe `fechaRaw`) marcaba `ingestado_hasta = HOY` sin un solo dato de esa fecha.
  // OJO: la cadena aparece también en el comentario de cabecera del fixture ⇒ `replaceAll`
  // (un `replace` simple sólo tocaba el comentario y dejaba la celda intacta: test vacuo).
  const FIXTURE_FECHA_SUCIA = FIXTURE_HTML.replaceAll(
    "2024-06-24 12:30:00-04",
    "sin fecha informada",
  );

  it("Test 6 (CR-02): audiencia SIN fecha parseable ⇒ NO se marca cobertura (jamás el reloj)", async () => {
    // Control: el reemplazo del fixture efectivamente ocurrió (si no, el test sería vacuo).
    expect(FIXTURE_FECHA_SUCIA).not.toBe(FIXTURE_HTML);

    const writer = new InMemoryLobbyWriter();
    const res = await runIngestLobby({
      conector: fakeConector({ html: FIXTURE_FECHA_SUCIA }),
      writer,
      maestra: [maestroVictor()],
      tareas: TAREA_G1,
      ingestadoHasta: "2026-07-28",
    });

    // La audiencia SÍ se ingiere (el dato existe, sólo su fecha es ilegible)…
    expect(res.audiencias).toBeGreaterThan(0);
    // …pero el marcador de cobertura NO se mueve: no hay fecha del dato que lo respalde.
    expect(res.parlamentariosMarcados).toBe(0);
    expect(res.marcadoHasta).toEqual({});
    expect(writer.ingestaEstado.size).toBe(0);
  });

  it("Test 7 (CR-02): un confirmado sin ninguna fila fechada NO cae al corte de la corrida", async () => {
    const writer = new InMemoryLobbyWriter();
    await runIngestLobby({
      conector: fakeConector({ html: FIXTURE_FECHA_SUCIA }),
      writer,
      maestra: [maestroVictor()],
      tareas: TAREA_G1,
      ingestadoHasta: "2026-07-28",
    });

    // El bucle de relleno `for (const id of confirmados) marcados.set(id, hasta)` ya no existe:
    // ninguna fila lleva la marca al día de la corrida.
    expect(writer.ingestaEstado.get("P00777")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------------
// WR-09 (119-REVIEW) — el `marcarIngestado` de cierre estaba FUERA de todo manejo de error: un
// fallo de PostgREST allí tiraba la corrida completa y se perdía el reporte de lo ya ingerido.
// ---------------------------------------------------------------------------------------------
describe("WR-09 — un fallo del marcador de cobertura no tira la corrida entera", () => {
  it("marcarIngestado que lanza ⇒ error registrado + conteos de lo ya escrito conservados", async () => {
    const writer = new InMemoryLobbyWriter();
    writer.marcarIngestado = async () => {
      throw new Error("PostgREST 503 en lobby_ingesta_estado");
    };

    const res = await runIngestLobby({
      conector: fakeConector({ html: FIXTURE_HTML }),
      writer,
      maestra: [maestroVictor()],
      tareas: TAREA_G1,
      ingestadoHasta: "2026-07-28",
    });

    // La corrida DEVUELVE (no lanza) y conserva el reporte honesto…
    expect(res.audiencias).toBeGreaterThan(0);
    expect(res.contrapartes).toBeGreaterThanOrEqual(0);
    // …con el fallo del marcador declarado como error de SU fuente, no de la ingesta.
    expect(res.errores.length).toBe(1);
    expect(res.errores[0]!.fuente).toBe("lobby_ingesta_estado");
    expect(res.errores[0]!.mensaje).toMatch(/PostgREST 503/);
    // Las audiencias ya escritas siguen ahí.
    expect(writer.audiencias.size).toBeGreaterThan(0);
  });
});
