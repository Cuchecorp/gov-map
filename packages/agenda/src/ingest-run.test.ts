// ingest-run.test — orquestación tolerante + degradación honesta (fake connectors, sin red).
//
// Verifica (con los fixtures reales de 06-01 para el parse):
//   (a) Cámara 403 PERSISTENTE → la corrida termina con el Senado poblado y Cámara marcada
//       degradada (NO throw).
//   (b) La tabla de Cámara NUNCA produce filas en sesion_sala/sesion_tabla_item (solo PDF).
//   (c) Camino feliz: enumera semanas de Cámara + ingesta Senado forward-only + tabla Senado.
//   (d) Idempotencia: re-correr no duplica (el writer upserta por clave natural).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runIngest } from "./ingest-run";
import { CamaraBloqueadaError, CAMARA_TABLA_PDF_URL } from "./connector-camara";
import { InMemoryAgendaWriter } from "./writer";
import type { CitacionesCamaraConnector } from "./connector-camara";
import type { SenadoActividadConnector } from "./connector-senado";
import type { SemanaIso } from "./semana-iso";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures");
const leer = (f: string) => readFileSync(join(FIXTURES, f), "utf8");
const camaraHtml = leer("camara-citaciones-semana.html");
const senadoCitacionesJson = leer("senado-commissions-citations.json");
const senadoTablaJson = leer("senado-weekly-table.json");

const SEMANAS: SemanaIso[] = [
  { year: 2026, week: 24 },
  { year: 2026, week: 25 },
];

/**
 * Fake del conector de Cámara con comportamiento configurable por semana. `runIngest` invoca
 * `fetchSemanaBytes` (Etapa 1 R2 opera sobre los bytes crudos); el fake lo modela devolviendo
 * el HTML codificado (o relanzando el error configurado, p.ej. `CamaraBloqueadaError`).
 */
function fakeCamara(behavior: {
  semana?: (year: number, week: number) => Promise<string>;
}): CitacionesCamaraConnector {
  const semanaFn = behavior.semana ?? (async () => camaraHtml);
  const enc = new TextEncoder();
  return {
    fetchSemanaBytes: async (year: number, week: number) => enc.encode(await semanaFn(year, week)),
    fetchSemana: semanaFn,
    fetchPdfTabla: () => ({ url: CAMARA_TABLA_PDF_URL, content_type: "application/pdf" }),
  } as unknown as CitacionesCamaraConnector;
}

/** Fake del conector del Senado. */
function fakeSenado(opts?: {
  citaciones?: () => Promise<string>;
  tabla?: () => Promise<string>;
}): SenadoActividadConnector {
  return {
    fetchCitaciones: opts?.citaciones ?? (async () => senadoCitacionesJson),
    fetchTablaSala: opts?.tabla ?? (async () => senadoTablaJson),
  } as unknown as SenadoActividadConnector;
}

describe("runIngest — tolerante + degradación honesta", () => {
  it("(a) Cámara 403 PERSISTENTE → Senado poblado y Cámara degradada, sin throw", async () => {
    const writer = new InMemoryAgendaWriter();
    const camara = fakeCamara({
      semana: async () => {
        throw new CamaraBloqueadaError("https://www.camara.cl/...", 403);
      },
    });
    const senado = fakeSenado();

    const res = await runIngest({
      conectorCamara: camara,
      conectorSenado: senado,
      writer,
      semanas: SEMANAS,
      reintentos403: 1,
      backoffMs: 0,
    });

    // Cámara degradada (no abortó): 0 citaciones de Cámara, marca de degradación presente.
    expect(res.camaraCitaciones).toBe(0);
    const degCamara = res.degradaciones.find((d) => d.fuente === "camara-citaciones");
    expect(degCamara).toBeDefined();
    // El Senado SÍ se ingesta a pesar del bloqueo de Cámara.
    expect(res.senadoCitaciones).toBeGreaterThanOrEqual(1);
    expect(res.senadoSesiones).toBeGreaterThanOrEqual(1);
    expect(writer.citaciones.size).toBeGreaterThanOrEqual(1); // del Senado
    expect(writer.sesiones.size).toBeGreaterThanOrEqual(1);
  });

  it("(b) la tabla de Cámara NUNCA produce filas en sesion_sala/sesion_tabla_item", async () => {
    const writer = new InMemoryAgendaWriter();
    const res = await runIngest({
      conectorCamara: fakeCamara({}),
      conectorSenado: fakeSenado(),
      writer,
      semanas: SEMANAS,
      backoffMs: 0,
    });

    // Todas las sesiones escritas son del Senado (camara === 'senado').
    for (const s of writer.sesiones.values()) {
      expect(s.camara).toBe("senado");
    }
    for (const it of writer.items.values()) {
      const sesion = writer.sesiones.get(it.sesion_id)!;
      expect(sesion.camara).toBe("senado");
    }
    // La tabla de Cámara se reporta como degradación honesta apuntando al PDF.
    const degTabla = res.degradaciones.find((d) => d.fuente === "camara-tabla-sala");
    expect(degTabla?.enlace).toBe(CAMARA_TABLA_PDF_URL);
    expect(degTabla?.enlace).toContain("prmTipo=TABLASEMANAL");
  });

  it("(c) camino feliz: enumera semanas de Cámara + Senado forward-only + tabla Senado", async () => {
    const writer = new InMemoryAgendaWriter();
    const semanasVistas: string[] = [];
    const camara = fakeCamara({
      semana: async (y, w) => {
        semanasVistas.push(`${y}-${w}`);
        return camaraHtml;
      },
    });

    const res = await runIngest({
      conectorCamara: camara,
      conectorSenado: fakeSenado(),
      writer,
      semanas: SEMANAS,
      backoffMs: 0,
    });

    expect(semanasVistas).toEqual(["2026-24", "2026-25"]); // enumeró ambas semanas
    expect(res.camaraCitaciones).toBeGreaterThanOrEqual(1);
    expect(res.senadoCitaciones).toBeGreaterThanOrEqual(1);
    expect(res.senadoSesiones).toBeGreaterThanOrEqual(1);
    expect(res.errores).toHaveLength(0);
  });

  it("(d) idempotente: re-correr la misma corrida no duplica", async () => {
    const writer = new InMemoryAgendaWriter();
    const args = {
      conectorCamara: fakeCamara({}),
      conectorSenado: fakeSenado(),
      writer,
      semanas: SEMANAS,
      backoffMs: 0,
    };
    await runIngest(args);
    const citaciones1 = writer.citaciones.size;
    const sesiones1 = writer.sesiones.size;
    await runIngest(args);
    expect(writer.citaciones.size).toBe(citaciones1);
    expect(writer.sesiones.size).toBe(sesiones1);
  });

  it("(e) --solo-senado omite Cámara por completo", async () => {
    const writer = new InMemoryAgendaWriter();
    let camaraTocada = false;
    const camara = fakeCamara({
      semana: async () => {
        camaraTocada = true;
        return camaraHtml;
      },
    });

    const res = await runIngest({
      conectorCamara: camara,
      conectorSenado: fakeSenado(),
      writer,
      semanas: SEMANAS,
      soloSenado: true,
      backoffMs: 0,
    });

    expect(camaraTocada).toBe(false);
    expect(res.camaraCitaciones).toBe(0);
    expect(res.senadoCitaciones).toBeGreaterThanOrEqual(1);
  });

  it("(f) Etapa 1 R2: el HTML crudo de cada semana de Cámara va a R2 content-addressed", async () => {
    const writer = new InMemoryAgendaWriter();
    const puestos: { source: string; resource: string; ext: string; sha: string }[] = [];
    const r2 = {
      putImmutable: async (
        source: string,
        resource: string,
        _date: string,
        sha: string,
        ext: string,
      ) => {
        puestos.push({ source, resource, ext, sha });
        return { r2Path: `${source}/${resource}/${sha}.${ext}`, existed: false };
      },
    };

    const res = await runIngest({
      conectorCamara: fakeCamara({}),
      conectorSenado: fakeSenado(),
      writer,
      semanas: SEMANAS,
      backoffMs: 0,
      r2,
      r2Enabled: true,
    });

    // Una escritura R2 por semana de Cámara (Etapa 1), con el namespace correcto.
    expect(puestos).toHaveLength(SEMANAS.length);
    for (const p of puestos) {
      expect(p.source).toBe("camara");
      expect(p.resource).toBe("citaciones-semana");
      expect(p.ext).toBe("html");
      expect(p.sha).toMatch(/^[0-9a-f]{64}$/); // content-addressed (sha256 hex)
    }
    // La Etapa 2 sigue igual: las citaciones se parsean y escriben.
    expect(res.camaraCitaciones).toBeGreaterThanOrEqual(1);
  });

  it("(g) R2 gateado: sin r2Enabled NO se toca R2 (degrada honesto)", async () => {
    const writer = new InMemoryAgendaWriter();
    let r2Tocado = false;
    const r2 = {
      putImmutable: async () => {
        r2Tocado = true;
        return { r2Path: "x", existed: false };
      },
    };

    const res = await runIngest({
      conectorCamara: fakeCamara({}),
      conectorSenado: fakeSenado(),
      writer,
      semanas: SEMANAS,
      backoffMs: 0,
      r2,
      r2Enabled: false, // gate cerrado
    });

    expect(r2Tocado).toBe(false); // R2 NO se tocó
    expect(res.camaraCitaciones).toBeGreaterThanOrEqual(1); // pero la ingesta sí corrió
  });

  it("(h) R2 best-effort: un fallo de R2 NO aborta la Etapa 2 (parse+upsert siguen)", async () => {
    const writer = new InMemoryAgendaWriter();
    const r2 = {
      putImmutable: async () => {
        throw new Error("R2 401 simulado");
      },
    };

    const res = await runIngest({
      conectorCamara: fakeCamara({}),
      conectorSenado: fakeSenado(),
      writer,
      semanas: SEMANAS,
      backoffMs: 0,
      r2,
      r2Enabled: true,
    });

    // El fallo de R2 no cuenta como error de ingesta ni bloquea la escritura.
    expect(res.camaraCitaciones).toBeGreaterThanOrEqual(1);
    expect(res.errores).toHaveLength(0);
  });
});
